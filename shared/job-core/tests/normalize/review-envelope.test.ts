import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fail, ok, partial } from "../../src/envelope/index.js";
import { envelopeSchema } from "../../src/schemas/envelope.js";

const ctx = {
  tool: "jobs_normalize",
  provider: "naukri" as const,
  serverName: "naukri-mcp" as const,
  serverVersion: "0.1.0",
  policySnapshotDate: "2026-09-25",
  capabilityMode: "L0" as const,
};

describe("review-1 envelope invariant", () => {
  const schema = envelopeSchema(z.string());

  it("accepts existing builders", () => {
    expect(schema.safeParse(ok(ctx, "job")).success).toBe(true);
    expect(schema.safeParse(partial(ctx, "job")).success).toBe(true);
    expect(
      schema.safeParse(fail(ctx, "NOT_FOUND", "Missing", { remediation: "Check ID" })).success,
    ).toBe(true);
  });

  it("rejects every invalid status/error/data combination", () => {
    const valid = ok(ctx, "job");
    const error = fail(ctx, "NOT_FOUND", "Missing", { remediation: "Check ID" }).error;
    for (const candidate of [
      { ...valid, status: "error", error: null, data: null },
      { ...valid, status: "error", error, data: "job" },
      { ...valid, status: "ok", error },
      { ...valid, status: "partial", error },
    ]) {
      expect(schema.safeParse(candidate).success).toBe(false);
    }
  });
});
