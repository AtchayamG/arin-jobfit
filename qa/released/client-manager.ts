import { execSync } from "node:child_process";
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

export interface ManagedMcpClient {
  client: Client;
  transport: StdioClientTransport;
  getStderr: () => string;
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

  let transport = new StdioClientTransport({
    command,
    args,
    env: {
      ...process.env,
      [dataDirEnv]: dataDir,
    },
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
      // Fallback to cmd.exe /d /s /c npx -y ...
      stderrBuffer = "";
      transport = new StdioClientTransport({
        command: "cmd.exe",
        args: ["/d", "/s", "/c", "npx", "-y", packageSpec],
        env: {
          ...process.env,
          [dataDirEnv]: dataDir,
        },
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

  const close = async (): Promise<void> => {
    try {
      await withTimeout(client.close(), 5000, "client.close()", () =>
        killProcessTree(transport.pid),
      );
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
    close,
  };
}
