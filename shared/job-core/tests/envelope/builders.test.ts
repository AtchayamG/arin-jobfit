import { describe, expect, it } from "vitest";
import { z } from "zod";
import { fail, ok, partial, toCallToolResult } from "../../src/envelope/index.js";
import { envelopeSchema } from "../../src/schemas/index.js";

const ctx = {
  tool: "jobs_get",
  provider: "naukri" as const,
  serverName: "naukri-mcp" as const,
  serverVersion: "0.1.0",
  policySnapshotDate: "2026-09-25",
  capabilityMode: "L0" as const,
};
const schema = envelopeSchema(z.strictObject({ value: z.string() }));

describe("envelope builders", () => {
  it("builds valid ok and partial envelopes with distinct request IDs", () => {
    const first = ok(ctx, { value: "yes" });
    const second = partial(
      ctx,
      { value: "maybe" },
      {
        warnings: [{ code: "LOW_CONFIDENCE", message: "Sparse data" }],
        humanAction: { reason: "Review", actions: ["Check"], official_url: null },
      },
    );
    expect(schema.safeParse(first).success).toBe(true);
    expect(schema.safeParse(second).success).toBe(true);
    expect(first.meta.request_id).not.toBe(second.meta.request_id);
    expect(toCallToolResult(first).isError).toBe(false);
    expect(toCallToolResult(second).isError).toBe(false);
  });

  it("maps domain failure to isError and preserves actionable fields", () => {
    const result = fail(ctx, "NOT_FOUND", "Job missing", {
      remediation: "Check the job ID",
      capabilityId: "l0.analysis",
      retryable: true,
    });
    expect(envelopeSchema(z.unknown()).safeParse(result).success).toBe(true);
    expect(result.error?.capability_id).toBe("l0.analysis");
    expect(result.error?.retryable).toBe(true);
    expect(toCallToolResult(result).isError).toBe(true);
  });

  it("never includes underlying INTERNAL details", () => {
    const secret = "sensitive CV text";
    const result = fail(ctx, "INTERNAL", secret, {
      remediation: secret,
      capabilityId: secret,
      retryable: true,
    });
    expect(JSON.stringify(result)).not.toContain(secret);
    expect(result.error?.message).toContain("request ID");
    expect(result.error?.retryable).toBe(false);
  });

  it("truncates the text fallback and warns in structured content", () => {
    const envelope = ok(ctx, { value: "x".repeat(70_000) });
    const result = toCallToolResult(envelope);
    expect(Buffer.byteLength(result.content[0].text, "utf8")).toBeLessThanOrEqual(65_536);
    expect(result.structuredContent.warnings.map((warning) => warning.code)).toContain(
      "OUTPUT_TRUNCATED",
    );
    expect(JSON.parse(result.content[0].text)).toMatchObject({ data: null, status: "ok" });
    expect((result.structuredContent.data as { value: string }).value).toHaveLength(70_000);
  });
});
