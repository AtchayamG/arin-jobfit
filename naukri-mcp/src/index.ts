import "./warnings.js";
import { homedir } from "node:os";
import policyJson from "../config/policy.json" with { type: "json" };

declare const __PACKAGE_VERSION__: string;

const version = __PACKAGE_VERSION__;
const usage = `Arin JobFit — Naukri edition
Independent; not affiliated with Naukri or Info Edge.
Data directory override: NAUKRI_MCP_DATA_DIR
Usage: arin-jobfit-nk [--version | --help]`;

async function main(): Promise<void> {
  const argument = process.argv[2];
  if (argument === "--version") {
    process.stdout.write(`${version}\n`);
    return;
  }
  if (argument === "--help") {
    process.stdout.write(`${usage}\n`);
    return;
  }
  if (argument !== undefined) {
    process.stderr.write(`${usage}\n`);
    process.exitCode = 2;
    return;
  }

  const core = await import("@jpm/job-core");
  let policy;
  try {
    policy = core.policy.loadPolicy(policyJson, new Date());
  } catch {
    process.stderr.write("Unable to load the bundled Naukri policy.\n");
    process.exitCode = 1;
    return;
  }

  let dataDir: string;
  try {
    dataDir = core.store.resolveDataDir({
      envValue: process.env.NAUKRI_MCP_DATA_DIR,
      product: "naukri-mcp",
      platform: process.platform,
      home: homedir(),
      appData: process.env.APPDATA,
      xdgDataHome: process.env.XDG_DATA_HOME,
    });
  } catch {
    process.stderr.write("Unable to resolve a safe Naukri data directory.\n");
    process.exitCode = 1;
    return;
  }

  let store: ReturnType<typeof core.store.openStore>;
  try {
    store = core.store.openStore({ dataDir, product: "naukri-mcp" });
  } catch {
    process.stderr.write("Unable to open the local Naukri data store.\n");
    process.exitCode = 1;
    return;
  }

  let stopped = false;
  const shutdown = (): void => {
    if (stopped) return;
    stopped = true;
    store.close();
    process.exitCode ??= 0;
  };
  const stopOnSignal = (): void => {
    shutdown();
    process.stdin.destroy();
  };
  process.once("SIGINT", stopOnSignal);
  process.once("SIGTERM", stopOnSignal);

  try {
    const handle = core.runStdio({
      serverName: "naukri-mcp",
      serverVersion: version,
      provider: "naukri",
      policy,
      hostAllowlist: (process.env.NAUKRI_HOSTS ?? "naukri.com")
        .split(",")
        .map((host) => host.trim()),
      store,
    });
    await new Promise<void>((resolveEnd) => {
      process.stdin.once("end", resolveEnd);
      process.stdin.resume();
    });
    await handle.close();
  } catch {
    process.stderr.write("Naukri MCP stdio server stopped unexpectedly.\n");
    process.exitCode = 1;
  } finally {
    shutdown();
    process.stdin.pause();
  }
}

void main().catch(() => {
  process.stderr.write("Naukri MCP startup failed.\n");
  process.exitCode = 1;
});
