import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { createJobPortalServer } from "./server.js";
import type { ProductConfig } from "./types.js";

export function runStdio(config: ProductConfig) {
  return serveStdio(() => createJobPortalServer(config));
}
