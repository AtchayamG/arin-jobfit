import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { renderSchemas } from "../../scripts/export-schemas.js";

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
  "format",
]);

function checkPortable(value: unknown, depth = 0): void {
  expect(depth).toBeLessThanOrEqual(4);
  if (Array.isArray(value)) {
    for (const item of value) checkPortable(item, depth);
    return;
  }
  if (value === null || typeof value !== "object") return;
  const record = value as Record<string, unknown>;
  for (const [key, item] of Object.entries(record)) {
    expect(allowed.has(key), `disallowed keyword ${key}`).toBe(true);
    if (key === "properties") {
      for (const child of Object.values(item as Record<string, unknown>)) {
        checkPortable(child, depth + 1);
      }
    } else if (key === "items") {
      expect(Array.isArray(item)).toBe(false);
      checkPortable(item, depth + 1);
    } else if (key === "format") {
      expect(["date", "date-time", "uri"]).toContain(item);
    }
  }
  if (record.type === "string") expect(record.maxLength).toEqual(expect.any(Number));
  if (record.type === "array") expect(record.maxItems).toEqual(expect.any(Number));
  if (record.type === "object") expect(record.additionalProperties).toBe(false);
}

describe("JSON Schema export", () => {
  it("matches every committed schema exactly", () => {
    for (const [name, content] of Object.entries(renderSchemas())) {
      expect(
        readFileSync(
          resolve(import.meta.dirname, "..", "..", "..", "schemas", `${name}.schema.json`),
          "utf8",
        ),
      ).toBe(content);
    }
  });

  it("keeps every generated input-side schema in the portable subset", () => {
    for (const name of ["job-input", "profile-input"]) {
      const schema = JSON.parse(renderSchemas()[name] ?? "null") as Record<string, unknown>;
      expect(schema.type).toBe("object");
      expect(schema.properties).toBeDefined();
      expect(schema.required).toBeDefined();
      checkPortable(schema);
    }
  });
});
