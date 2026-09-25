import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

async function sources(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) return sources(path);
      return entry.name.endsWith(".ts") ? [path] : [];
    }),
  );
  return nested.flat();
}

describe("provider isolation", () => {
  it("does not mention the other product or its environment variable in source", async () => {
    const root = fileURLToPath(new URL("../src", import.meta.url));
    const files = await sources(root);
    const content = await Promise.all(files.map((file) => readFile(file, "utf8")));
    expect(content.join("\n")).not.toMatch(/indeed-mcp|INDEED_MCP_DATA_DIR/i);
  });
});
