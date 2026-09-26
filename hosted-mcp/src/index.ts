import { createServer } from "node:http";
import { policy } from "@jpm/job-core";
import policyJson from "../config/policy.json" with { type: "json" };
import { createRequestHandler } from "./http.js";

declare const __PACKAGE_VERSION__: string | undefined;
const version = typeof __PACKAGE_VERSION__ !== "undefined" ? __PACKAGE_VERSION__ : "0.1.0";

export { createRequestHandler } from "./http.js";
export { createHostedMcpServer } from "./server.js";
export * from "./types.js";
export * from "./tools.js";
export * from "./resolve.js";
export * from "./security.js";

function main(): void {
  let loadedPolicy;
  try {
    loadedPolicy = policy.loadPolicy(policyJson, new Date());
  } catch (err) {
    process.stderr.write(`Failed to load policy: ${(err as Error).message}\n`);
    process.exit(1);
  }

  const port = parseInt(process.env.PORT ?? "8080", 10);
  const handler = createRequestHandler({ policy: loadedPolicy, version });
  const server = createServer((req, res) => {
    void handler(req, res);
  });

  server.listen(port, () => {
    process.stdout.write(`Arin JobFit Hosted MCP running on port ${String(port)}\n`);
  });

  const shutdown = (): void => {
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  main();
}
