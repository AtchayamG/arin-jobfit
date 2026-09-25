import { describe, expect, it } from "vitest";
import { ingestPipeline, PipelineError } from "../../src/pipeline/index.js";
import { openStore } from "../../src/store/index.js";
import { fixedNow, jobInput } from "../mcp/client.js";

const context = { provider: "naukri" as const, now: fixedNow, hostAllowlist: ["naukri.com"] };

describe("sanitized ingestion pipeline", () => {
  it("normalizes without persisting and records a user provenance", () => {
    const result = ingestPipeline({ ...jobInput, source_url: undefined }, context);
    expect(result.job.source_url).toBeNull();
    expect(result.provenance[0]?.kind).toBe("user_supplied");
    expect(result.duplicates).toEqual([]);
    expect(result.warnings.some((item) => item.code === "UNTRUSTED_CONTENT")).toBe(true);
  });

  it("sanitizes every supplied text field and records relay provenance", () => {
    const result = ingestPipeline(
      {
        ...jobInput,
        title: "Ａcme Engineer",
        company: "<b>Acme</b>",
        description: "<p>Must know Java.</p>",
        origin: "agent_relay",
        relay_source: "Agency",
      },
      { ...context, retentionClass: "pinned" },
    );
    expect(result.job.title).toBe("Acme Engineer");
    expect(result.job.company).toBe("Acme");
    expect(result.job.retention_class).toBe("pinned");
    expect(result.provenance[0]).toMatchObject({ kind: "agent_relay", detail: "Agency" });
    expect(result.warnings.some((item) => item.code === "CONTENT_SANITIZED")).toBe(true);
  });

  it("marks nonofficial URLs but never fetches them", () => {
    const result = ingestPipeline(
      { ...jobInput, source_url: "https://example.com/listing" },
      context,
    );
    expect(result.job.source_url_is_official).toBe(false);
    expect(result.warnings.map((item) => item.code)).toContain("URL_NOT_OFFICIAL");
  });

  it("rejects unsafe URLs and oversized or emptied text", () => {
    expect(() => ingestPipeline({ ...jobInput, source_url: "http://localhost/" }, context)).toThrow(
      new PipelineError("UNSAFE_URL"),
    );
    expect(() => ingestPipeline({ ...jobInput, description: "x".repeat(50_001) }, context)).toThrow(
      new PipelineError("INPUT_TOO_LARGE"),
    );
    expect(() => ingestPipeline({ ...jobInput, title: "<script>x</script>" }, context)).toThrow(
      new PipelineError("INVALID_INPUT"),
    );
  });

  it("checks duplicates before inserting and preserves warnings", () => {
    const store = openStore({ memory: true, product: "naukri-mcp", now: fixedNow.toISOString() });
    try {
      const first = ingestPipeline(jobInput, { ...context, store });
      const second = ingestPipeline(jobInput, { ...context, store });
      expect(first.duplicates).toEqual([]);
      expect(second.duplicates.some((item) => item.job_id === first.job.job_id)).toBe(true);
      expect(second.warnings.map((item) => item.code)).toContain("DUPLICATE_SUSPECTED");
      expect(store.jobs.count()).toBe(2);
    } finally {
      store.close();
    }
  });
});
