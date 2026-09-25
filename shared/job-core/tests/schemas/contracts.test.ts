import { describe, expect, it } from "vitest";
import {
  capabilityLevelSchema,
  envelopeSchema,
  errorCodeSchema,
  jobInputSchema,
  providerIdSchema,
  provenanceSchema,
  toolErrorSchema,
  warningCodeSchema,
  warningSchema,
} from "../../src/schemas/index.js";
import { z } from "zod";

describe("contract schemas", () => {
  it("accepts all declared enum values and rejects others", () => {
    for (const [schema, value] of [
      [providerIdSchema, "naukri"],
      [capabilityLevelSchema, "L4"],
      [warningCodeSchema, "OUTPUT_TRUNCATED"],
      [errorCodeSchema, "BLOCKED_BY_PROVIDER_APPROVAL"],
    ] as const) {
      expect(schema.safeParse(value).success).toBe(true);
      expect(schema.safeParse("made_up").success).toBe(false);
    }
  });

  it("enforces strict objects and provenance detail length", () => {
    const provenance = {
      kind: "user_supplied",
      detail: "x".repeat(200),
      captured_at: "2026-09-25T00:00:00Z",
    };
    expect(provenanceSchema.safeParse(provenance).success).toBe(true);
    expect(provenanceSchema.safeParse({ ...provenance, detail: "x".repeat(201) }).success).toBe(
      false,
    );
    expect(provenanceSchema.safeParse({ ...provenance, extra: true }).success).toBe(false);
    expect(
      warningSchema.safeParse({ code: "FIELD_UNPARSED", message: "bad", extra: 1 }).success,
    ).toBe(false);
    expect(
      toolErrorSchema.safeParse({
        code: "NOT_FOUND",
        message: "missing",
        retryable: false,
        remediation: "Check the ID",
        extra: 1,
      }).success,
    ).toBe(false);
    expect(
      warningSchema.safeParse({
        code: "FIELD_UNPARSED",
        message: "Could not parse",
        field: "salary",
      }).success,
    ).toBe(true);
    expect(
      toolErrorSchema.safeParse({
        code: "NOT_FOUND",
        message: "missing",
        retryable: false,
        remediation: "Check the ID",
      }).success,
    ).toBe(true);
  });

  it("enforces JobInput bounds, defaults, and unknown-key rejection", () => {
    const valid = { title: "x", description: "y" };
    expect(jobInputSchema.parse(valid).origin).toBe("user_paste");
    expect(
      jobInputSchema.safeParse({ title: "x".repeat(200), description: "y".repeat(50_000) }).success,
    ).toBe(true);
    for (const invalid of [
      { ...valid, title: "" },
      { ...valid, title: "x".repeat(201) },
      { ...valid, description: "" },
      { ...valid, description: "y".repeat(50_001) },
      { ...valid, source_url: "x".repeat(2_049) },
      { ...valid, company: "x".repeat(201) },
      { ...valid, employment_type_text: "x".repeat(101) },
      { ...valid, origin: "provider_api" },
      { ...valid, gender: "female" },
    ]) {
      expect(jobInputSchema.safeParse(invalid).success).toBe(false);
    }
  });

  it("validates envelope shape and rejects unknown keys", () => {
    const value = {
      contract_version: "1.0.0",
      status: "ok",
      provider: "indeed",
      capability_mode: "L0",
      source_provenance: [],
      data: { id: "job_1" },
      warnings: [],
      human_action_required: null,
      error: null,
      meta: {
        tool: "jobs_get",
        request_id: "76aff94c-40f0-4283-9d6c-7644a636d020",
        server: "indeed-mcp",
        server_version: "0.1.0",
        policy_snapshot_date: "2026-09-25",
      },
    };
    const schema = envelopeSchema(z.strictObject({ id: z.string() }));
    expect(schema.safeParse(value).success).toBe(true);
    expect(schema.safeParse({ ...value, extra: true }).success).toBe(false);
    expect(schema.safeParse({ ...value, data: { id: "job_1", extra: true } }).success).toBe(false);
    expect(schema.safeParse({ ...value, meta: { ...value.meta, server: "other" } }).success).toBe(
      false,
    );
  });
});
