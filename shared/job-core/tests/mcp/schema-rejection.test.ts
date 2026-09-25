/**
 * Test documenting F-1 behavior:
 * Pre-handler schema rejections are returned by the SDK as isError text; no envelope/audit.
 */

import { describe, expect, it } from "vitest";
import { testClient, jobInput } from "./client.js";

describe("F-1: pre-handler schema rejections by MCP SDK", () => {
  it("returns isError plain text without envelope and without audit log on invalid arguments", async () => {
    const { client, store, close } = await testClient();
    try {
      const initialAudit = store.audit.list();
      expect(initialAudit).toHaveLength(0);

      // Pass an invalid extra argument on strict input schema
      const result = await client.callTool({
        name: "jobs_normalize",
        arguments: {
          job: jobInput,
          unexpected_extra_key: "forbidden",
        },
      });

      // 1. Result is flagged as error by SDK
      expect(result.isError).toBe(true);

      // 2. No structuredContent envelope returned by SDK
      expect(result.structuredContent).toBeUndefined();

      // 3. Content contains plain text error message from the SDK
      expect(result.content).toHaveLength(1);
      const textItem = result.content[0];
      expect(textItem?.type).toBe("text");
      expect((textItem as { text?: string } | undefined)?.text).toMatch(/Input validation error/i);

      // 4. No audit log entry was created because application handler was never entered
      const afterAudit = store.audit.list();
      expect(afterAudit).toHaveLength(0);
    } finally {
      await close();
    }
  });

  it("rejects oversized fields before handler execution without audit row", async () => {
    const { client, store, close } = await testClient();
    try {
      const initialAudit = store.audit.list();
      expect(initialAudit).toHaveLength(0);

      // Job description exceeding max length of 50,000
      const oversizedJob = {
        ...jobInput,
        description: "A".repeat(50_001),
      };

      const result = await client.callTool({
        name: "jobs_normalize",
        arguments: {
          job: oversizedJob,
        },
      });

      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      expect(result.content[0]?.type).toBe("text");
      expect((result.content[0] as { text?: string } | undefined)?.text).toMatch(
        /Input validation error/i,
      );

      const afterAudit = store.audit.list();
      expect(afterAudit).toHaveLength(0);
    } finally {
      await close();
    }
  });
});
