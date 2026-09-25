import type { StandardSchemaWithJSON } from "@modelcontextprotocol/server";
import { z } from "zod";

function normalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  const object = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalize(item)]),
  );
  if (object.type === "string" && object.maxLength === undefined && Array.isArray(object.enum))
    object.maxLength = Math.max(...object.enum.map((item: string) => item.length));
  if (object.type === "object" && object.required === undefined) object.required = [];
  return object;
}

export function portableInputJson(schema: z.ZodType): Record<string, unknown> {
  const document = z.toJSONSchema(schema, {
    target: "draft-07",
    io: "input",
  });
  delete document.$schema;
  return normalize(document) as Record<string, unknown>;
}

export function standardInput(schema: z.ZodType): StandardSchemaWithJSON {
  const original = schema["~standard"];
  return {
    "~standard": {
      ...original,
      jsonSchema: {
        input: () => portableInputJson(schema),
        output: ({ target }) => z.toJSONSchema(schema, { target, io: "output" }),
      },
    },
  };
}
