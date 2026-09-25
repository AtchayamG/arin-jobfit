import { execSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";

export function killProcessTree(pid: number | undefined): void {
  if (!pid) return;
  try {
    if (process.platform === "win32") {
      execSync(`taskkill /PID ${pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(-pid, "SIGKILL");
    }
  } catch {
    // Process might already have exited
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage: string,
  onTimeout?: () => void,
): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      onTimeout?.();
      reject(new Error(`TIMEOUT (${ms}ms): ${errorMessage}`));
    }, ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer!);
  }
}

export class MonitoredStdioClientTransport extends StdioClientTransport {
  stdoutLines: string[] = [];
  private _stdoutBuf = "";

  async start(): Promise<void> {
    await super.start();
    const proc = (this as any)._process;
    if (proc?.stdout) {
      proc.stdout.on("data", (chunk: Buffer) => {
        this._stdoutBuf += chunk.toString("utf-8");
        const parts = this._stdoutBuf.split("\n");
        this._stdoutBuf = parts.pop() ?? "";
        for (const part of parts) {
          const trimmed = part.trim();
          if (trimmed) this.stdoutLines.push(trimmed);
        }
      });
    }
  }

  flushStdout(): void {
    const trimmed = this._stdoutBuf.trim();
    if (trimmed) {
      this.stdoutLines.push(trimmed);
      this._stdoutBuf = "";
    }
  }
}

export interface ManagedMcpClient {
  client: Client;
  transport: MonitoredStdioClientTransport;
  getStderr: () => string;
  getStdoutLines: () => string[];
  assertProtocolPurity: () => void;
  assertNoNetworkActivity: (sourceUrlsToCheck?: string[]) => void;
  close: () => Promise<void>;
}

export async function spawnMcpServer(
  packageSpec: string,
  dataDirEnv: string,
  dataDir: string,
  timeoutMs = 60000,
): Promise<ManagedMcpClient> {
  let stderrBuffer = "";
  const isWindows = process.platform === "win32";

  const command = isWindows ? "npx.cmd" : "npx";
  const args = ["-y", packageSpec];

  const env: Record<string, string | undefined> = {
    ...process.env,
    [dataDirEnv]: dataDir,
  };

  let transport = new MonitoredStdioClientTransport({
    command,
    args,
    env: env as Record<string, string>,
    stderr: "pipe",
  });

  transport.stderr?.on("data", (chunk: Buffer) => {
    stderrBuffer += chunk.toString("utf-8");
  });

  const client = new Client({ name: "qa-released-tester", version: "1.0.0" });

  try {
    await withTimeout(
      client.connect(transport),
      timeoutMs,
      `Connecting to ${packageSpec} via ${command}`,
      () => killProcessTree(transport.pid),
    );
  } catch (err) {
    killProcessTree(transport.pid);
    if (isWindows) {
      stderrBuffer = "";
      transport = new MonitoredStdioClientTransport({
        command: "cmd.exe",
        args: ["/d", "/s", "/c", "npx", "-y", packageSpec],
        env: env as Record<string, string>,
        stderr: "pipe",
      });
      transport.stderr?.on("data", (chunk: Buffer) => {
        stderrBuffer += chunk.toString("utf-8");
      });
      await withTimeout(
        client.connect(transport),
        timeoutMs,
        `Connecting to ${packageSpec} via cmd.exe fallback`,
        () => killProcessTree(transport.pid),
      );
    } else {
      throw err;
    }
  }

  const assertProtocolPurity = (): void => {
    transport.flushStdout();
    if (stderrBuffer.includes("ExperimentalWarning")) {
      throw new Error(`stderr contains forbidden "ExperimentalWarning":\n${stderrBuffer}`);
    }
    const lines = transport.stdoutLines.filter((l) => l.trim().length > 0);
    for (const line of lines) {
      try {
        const parsed = JSON.parse(line);
        if (!parsed || parsed.jsonrpc !== "2.0") {
          throw new Error(`Stdout line is not valid JSON-RPC 2.0: ${line.slice(0, 100)}`);
        }
      } catch (err: any) {
        throw new Error(`Stdout line is not valid JSON-RPC: "${line.slice(0, 100)}" - ${err.message}`);
      }
    }
  };

  const assertNoNetworkActivity = (sourceUrlsToCheck?: string[]): void => {
    const netErrorPatterns = [/ECONNREFUSED/i, /ENOTFOUND/i, /fetch failed/i, /undici/i, /socket hang up/i];
    for (const pattern of netErrorPatterns) {
      if (pattern.test(stderrBuffer)) {
        throw new Error(`Outbound network activity detected in stderr matching ${pattern}:\n${stderrBuffer}`);
      }
    }
    if (sourceUrlsToCheck) {
      for (const url of sourceUrlsToCheck) {
        try {
          const parsed = new URL(url);
          if (stderrBuffer.includes(parsed.hostname)) {
            throw new Error(`Hostname ${parsed.hostname} was accessed: detected in stderr`);
          }
        } catch {
          // ignore
        }
      }
    }
  };

  const close = async (): Promise<void> => {
    try {
      await withTimeout(client.close(), 5000, "client.close()", () => killProcessTree(transport.pid));
    } catch {
      // Ignore teardown timeouts
    } finally {
      killProcessTree(transport.pid);
    }
  };

  return {
    client,
    transport,
    getStderr: () => stderrBuffer,
    getStdoutLines: () => {
      transport.flushStdout();
      return [...transport.stdoutLines];
    },
    assertProtocolPurity,
    assertNoNetworkActivity,
    close,
  };
}

export function verifyPackageHasNoNetworkCalls(packageName: string): { pass: boolean; details: string } {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "qa-pkg-scan-"));
  try {
    const isWin = process.platform === "win32";
    const npmCmd = isWin ? "npm.cmd" : "npm";
    const packRes = spawnSync(npmCmd, ["pack", packageName], {
      cwd: tmp,
      encoding: "utf-8",
      shell: isWin,
      timeout: 30000,
    });
    const tarball = packRes.stdout.trim().split("\n").pop()?.trim();
    if (!tarball) {
      return { pass: false, details: `npm pack failed: ${packRes.stderr || "no output"}` };
    }
    spawnSync("tar", ["-xzf", tarball], { cwd: tmp, timeout: 30000 });
    const pkgDir = path.join(tmp, "package");

    const netPatterns = [/\bfetch\s*\(/, /\bhttp\.request\b/, /\bhttps\.request\b/, /\bnet\.connect\b/];
    const hits: string[] = [];

    function scanDir(dir: string) {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(full);
        } else if (entry.isFile() && entry.name.endsWith(".js")) {
          const content = fs.readFileSync(full, "utf-8");
          for (const pat of netPatterns) {
            if (pat.test(content)) hits.push(`${entry.name}: ${pat}`);
          }
        }
      }
    }
    scanDir(path.join(pkgDir, "dist"));

    const pass = hits.length === 0;
    return {
      pass,
      details: pass
        ? `Static scan verified 0 network calls (fetch, http.request, https.request, net.connect) in ${packageName} dist`
        : `Network calls found: ${hits.join(", ")}`,
    };
  } catch (err: any) {
    return { pass: false, details: `Scan error: ${err.message}` };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}
