import os from "node:os";
import policyJson from "../config/policy.json" with { type: "json" };

const PACKAGE_VERSION: string = process.env.PACKAGE_VERSION ?? "0.1.0";

function installWarningFilter(): void {
  process.on("warning", (warning: Error) => {
    if (warning.name === "ExperimentalWarning" && /sqlite/i.test(warning.message)) {
      return;
    }
    process.stderr.write(`${warning.name}: ${warning.message}\n`);
  });
}

function handleCliArgs(): void {
  const args = process.argv.slice(2);
  if (args.includes("--version") || args.includes("-v")) {
    console.log(PACKAGE_VERSION);
    process.exit(0);
  }
  if (args.includes("--help") || args.includes("-h")) {
    console.log(`Usage: indeed-mcp [options]

Privacy-preserving MCP server for Indeed job search and analysis.

Options:
  -v, --version  Show version number
  -h, --help     Show help`);
    process.exit(0);
  }
  if (args.length > 0) {
    process.stderr.write(`Unknown argument(s): ${args.join(" ")}\nUsage: indeed-mcp [options]\n`);
    process.exit(2);
  }
}

async function main(): Promise<void> {
  handleCliArgs();
  installWarningFilter();

  const {
    policy: { loadPolicy },
    store: { resolveDataDir, openStore },
    sanitize: { INDEED_HOSTS },
    runStdio,
  } = await import("@jpm/job-core");

  let policy: ReturnType<typeof loadPolicy>;
  try {
    policy = loadPolicy(policyJson, new Date());
  } catch (err) {
    process.stderr.write(`Failed to load policy: ${(err as Error).message}\n`);
    process.exit(1);
  }

  let dataDir: string;
  try {
    dataDir = resolveDataDir({
      envValue: process.env.INDEED_MCP_DATA_DIR,
      product: "indeed-mcp",
      platform: process.platform,
      home: os.homedir(),
      appData: process.env.APPDATA,
      xdgDataHome: process.env.XDG_DATA_HOME,
    });
  } catch (err) {
    process.stderr.write(`Failed to resolve data directory: ${(err as Error).message}\n`);
    process.exit(1);
  }

  let store: ReturnType<typeof openStore>;
  try {
    store = openStore({
      dataDir,
      product: "indeed-mcp",
    });
  } catch (err) {
    process.stderr.write(`Failed to open store: ${(err as Error).message}\n`);
    process.exit(1);
  }

  let closed = false;
  const shutdown = () => {
    if (closed) return;
    closed = true;
    try {
      store.close();
    } catch {
      // Ignore close error on shutdown
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.stdin.on("end", shutdown);
  process.stdin.on("close", shutdown);

  runStdio({
    serverName: "indeed-mcp",
    serverVersion: PACKAGE_VERSION,
    provider: "indeed",
    policy,
    hostAllowlist: [...INDEED_HOSTS],
    store,
  });
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal error: ${(err as Error).message}\n`);
  process.exit(1);
});
