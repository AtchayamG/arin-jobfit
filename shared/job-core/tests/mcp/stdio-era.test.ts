import { Client, InMemoryTransport } from "@modelcontextprotocol/client";
import { serveStdio } from "@modelcontextprotocol/server/stdio";
import { describe, expect, it } from "vitest";
import { createJobPortalServer } from "../../src/mcp/index.js";
import { testClient } from "./client.js";

describe("SDK stdio era router", () => {
  it("offers the 2026-07-28 tool catalogue through the server factory", async () => {
    const { config, close } = await testClient();
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    const handle = serveStdio(() => createJobPortalServer(config), { transport: serverTransport });
    const modern = new Client(
      { name: "modern-test", version: "0.1.0" },
      { versionNegotiation: { mode: { pin: "2026-07-28" } } },
    );
    try {
      await modern.connect(clientTransport);
      expect((await modern.listTools()).tools).toHaveLength(22);
      const result = await modern.callTool({ name: "provider_policy_status", arguments: {} });
      expect(result.isError).toBe(false);
    } finally {
      await modern.close();
      await handle.close();
      await close();
    }
  });
});
