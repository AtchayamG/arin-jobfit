import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";
import {
  capabilityLevelSchema,
  compensationSchema,
  employmentTypeSchema,
  envelopeSchema,
  errorCodeSchema,
  experienceSchema,
  fingerprintSchema,
  humanActionSchema,
  jobInputSchema,
  jobIdSchema,
  jobSchema,
  jobSummarySchema,
  locationSchema,
  matchDimensionSchema,
  matchResultSchema,
  profileIdSchema,
  profileInputSchema,
  profileSchema,
  providerIdSchema,
  provenanceSchema,
  remoteModeSchema,
  requirementsSchema,
  retentionClassSchema,
  skillNameSchema,
  toolErrorSchema,
  warningCodeSchema,
  warningSchema,
} from "../src/schemas/index.js";

const outputDir = resolve(import.meta.dirname, "..", "..", "schemas");
const schemas = {
  "capability-level": capabilityLevelSchema,
  compensation: compensationSchema,
  "employment-type": employmentTypeSchema,
  envelope: envelopeSchema(z.unknown()),
  "error-code": errorCodeSchema,
  experience: experienceSchema,
  fingerprint: fingerprintSchema,
  "human-action": humanActionSchema,
  "job-input": jobInputSchema,
  "job-id": jobIdSchema,
  job: jobSchema,
  "job-summary": jobSummarySchema,
  location: locationSchema,
  "match-dimension": matchDimensionSchema,
  "match-result": matchResultSchema,
  "profile-id": profileIdSchema,
  "profile-input": profileInputSchema,
  profile: profileSchema,
  "provider-id": providerIdSchema,
  provenance: provenanceSchema,
  "remote-mode": remoteModeSchema,
  requirements: requirementsSchema,
  "retention-class": retentionClassSchema,
  "skill-name": skillNameSchema,
  "tool-error": toolErrorSchema,
  "warning-code": warningCodeSchema,
  warning: warningSchema,
} as const;

function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value !== null && typeof value === "object") {
    const object = Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, sorted(item)]),
    );
    if (object.type === "string" && Array.isArray(object.enum)) {
      return Object.fromEntries(
        Object.entries({
          ...object,
          maxLength: Math.max(...object.enum.map((item: string) => item.length)),
        }).sort(([left], [right]) => left.localeCompare(right)),
      );
    }
    return object;
  }
  return value;
}

function portableDocument(schema: z.ZodType): unknown {
  const { $schema: _schema, ...document } = z.toJSONSchema(schema, {
    target: "draft-07",
    io: "input",
  });
  return sorted(document);
}

export function renderSchemas(): Record<string, string> {
  return Object.fromEntries(
    Object.entries(schemas).map(([name, schema]) => [
      name,
      `${JSON.stringify(portableDocument(schema), null, 2)}\n`,
    ]),
  );
}

const mode = process.argv[2];
if (mode === "export" || mode === "check") {
  const rendered = renderSchemas();
  if (mode === "check") {
    const actual = readdirSync(outputDir)
      .filter((name) => name.endsWith(".schema.json"))
      .sort();
    const expected = Object.keys(rendered)
      .map((name) => `${name}.schema.json`)
      .sort();
    if (JSON.stringify(actual) !== JSON.stringify(expected))
      throw new Error("Schema file set drift");
  }
  for (const [name, content] of Object.entries(rendered)) {
    const path = resolve(outputDir, `${name}.schema.json`);
    if (mode === "export") writeFileSync(path, content, "utf8");
    else if (readFileSync(path, "utf8") !== content) throw new Error(`Schema drift: ${name}`);
  }
} else if (process.argv[1]?.endsWith("export-schemas.ts")) {
  throw new Error("Usage: tsx scripts/export-schemas.ts export|check");
}
