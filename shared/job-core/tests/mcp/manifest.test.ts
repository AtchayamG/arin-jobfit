import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderManifest } from "../../scripts/export-manifest.js";
import { testClient } from "./client.js";

const path = resolve(import.meta.dirname, "..", "..", "..", "contracts", "tool-manifest.v1.json");
const allowed = new Set([
  "type",
  "properties",
  "required",
  "items",
  "enum",
  "description",
  "minimum",
  "maximum",
  "minLength",
  "maxLength",
  "minItems",
  "maxItems",
  "additionalProperties",
  "default",
]);

function portable(node: unknown, depth = 0): void {
  if (!node || typeof node !== "object" || Array.isArray(node)) return;
  const value = node as Record<string, unknown>;
  for (const [key, item] of Object.entries(value)) {
    expect(allowed.has(key), `disallowed input keyword ${key}`).toBe(true);
    if (key === "properties") {
      for (const child of Object.values(item as Record<string, unknown>))
        portable(child, depth + 1);
    } else if (key === "items") portable(item, depth);
  }
  if (value.type === "object") {
    expect(value.additionalProperties).toBe(false);
    expect(Array.isArray(value.required)).toBe(true);
    expect(depth).toBeLessThanOrEqual(4);
  }
  if (value.type === "string") expect(typeof value.maxLength).toBe("number");
  if (value.type === "array") expect(typeof value.maxItems).toBe("number");
  if (value.enum)
    expect((value.enum as unknown[]).every((item) => typeof item === "string")).toBe(true);
}

describe("portable and stable tool manifest", () => {
  it("has no drift", () => {
    expect(readFileSync(path, "utf8")).toBe(renderManifest());
  });
  it("advertises the portable subset for every SDK-listed input", async () => {
    const { client, close } = await testClient();
    try {
      const tools = (await client.listTools()).tools;
      for (const tool of tools) {
        expect(tool.inputSchema.type).toBe("object");
        expect(tool.inputSchema.properties).toBeDefined();
        portable(tool.inputSchema);
      }
      const manifest = JSON.parse(readFileSync(path, "utf8")) as {
        tools: { inputSchema: unknown }[];
      };
      for (const tool of manifest.tools) portable(tool.inputSchema);
    } finally {
      await close();
    }
  });
});
