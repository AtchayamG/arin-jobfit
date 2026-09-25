import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import { outputSchemaFor, toolDefs } from "../src/mcp/catalog.js";
import { portableInputJson } from "../src/mcp/portable.js";

const target = resolve(import.meta.dirname, "..", "..", "contracts", "tool-manifest.v1.json");

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, item]) => [key, sorted(item)]),
    );
  return value;
}

function schema(value: z.ZodType, input: boolean): unknown {
  const { $schema: _version, ...body } = z.toJSONSchema(value, {
    target: "draft-07",
    io: input ? "input" : "output",
  });
  return sorted(body);
}

export function renderManifest(): string {
  const tools = toolDefs.map((tool) => ({
    name: tool.name,
    title: tool.title,
    description: tool.description,
    annotations: tool.annotations,
    capabilityId: tool.capabilityId,
    inputSchema: portableInputJson(tool.inputSchema),
    outputSchema: schema(outputSchemaFor(tool), false),
  }));
  return `${JSON.stringify(sorted({ version: "1", tools }), null, 2)}\n`;
}

const mode = process.argv[2];
if (mode === "export") writeFileSync(target, renderManifest(), "utf8");
else if (mode === "check") {
  if (readFileSync(target, "utf8") !== renderManifest()) throw new Error("Tool manifest drift");
} else if (process.argv[1]?.endsWith("export-manifest.ts")) {
  throw new Error("Usage: tsx scripts/export-manifest.ts export|check");
}
