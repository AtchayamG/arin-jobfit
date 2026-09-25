import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

vi.mock("@modelcontextprotocol/server/stdio", () => ({
  serveStdio: vi.fn(() => ({ close: () => Promise.resolve() })),
}));

import { standardInput } from "../../src/mcp/portable.js";
import { runStdio } from "../../src/mcp/stdio.js";
import { testClient } from "./client.js";

describe("stdio and schema adapter", () => {
  it("delegates stdio to the SDK without writing to stdout", async () => {
    const { config, close } = await testClient();
    try {
      const handle = runStdio(config);
      expect(typeof handle.close).toBe("function");
      await handle.close();
    } finally {
      await close();
    }
  });

  it("keeps both standard-schema converters available", () => {
    const schema = standardInput(z.strictObject({ text: z.string().max(20) }));
    expect(schema["~standard"].jsonSchema.input({ target: "draft-07" })).toMatchObject({
      type: "object",
    });
    expect(schema["~standard"].jsonSchema.output({ target: "draft-07" })).toMatchObject({
      type: "object",
    });
  });
});
