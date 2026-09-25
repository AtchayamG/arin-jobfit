import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";

const distPath = path.resolve(import.meta.dirname, "../../dist/index.js");

describe("T-04: Zero runtime network calls and unregistered tool rejection", () => {
  it("T-04: enforces zero network modules in source code", () => {
    const srcDir = path.resolve(import.meta.dirname, "../../src");
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const networkModules = [
      "node:http",
      "node:https",
      "node:net",
      "node:tls",
      "node:dgram",
      "undici",
      "axios",
    ];
    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      const code = fs.readFileSync(path.join(srcDir, file), "utf-8");
      for (const mod of networkModules) {
        const importPattern = new RegExp(`from\\s+['"]${mod}['"]`, "i");
        expect(code, `Found forbidden network import '${mod}' in ${file}`).not.toMatch(
          importPattern,
        );
      }
    }
  });

  it("T-04: rejects unregistered provider_* tool calls over stdio", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "naukri-sec-unreg-"));
    const transport = new StdioClientTransport({
      command: "node",
      args: [distPath],
      env: {
        ...process.env,
        NAUKRI_MCP_DATA_DIR: tempDir,
      },
    });
    const client = new Client({ name: "unreg-tool-tester", version: "1.0.0" });
    await client.connect(transport);
    try {
      await expect(client.callTool({ name: "provider_search", arguments: {} })).rejects.toThrow();

      await expect(
        client.callTool({ name: "provider_naukri_apply", arguments: {} }),
      ).rejects.toThrow();
    } finally {
      await client.close();
      await transport.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
