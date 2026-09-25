import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { envelopeSchema } from "../../src/schemas/index.js";
import { testClient, jobInput, profileInput } from "./client.js";

const code = (value: unknown): string | undefined =>
  (value as { error?: { code: string } | null }).error?.code;

describe("content and logging boundaries", () => {
  it("sanitizes a hostile JD, warns, and keeps audit free of input text", async () => {
    const corpus = JSON.parse(
      readFileSync(
        resolve(import.meta.dirname, "..", "fixtures", "adversarial", "corpus.v1.json"),
        "utf8",
      ),
    ) as { id: string; input: string }[];
    const hostile = corpus.find((item) => item.id === "ADV-INJ-001")?.input;
    if (!hostile) throw new Error("Adversarial fixture missing");
    const { client, store, close } = await testClient();
    try {
      const description = `<p>${hostile}\u200b</p>`;
      const result = await client.callTool({
        name: "jobs_ingest",
        arguments: { job: { ...jobInput, description } },
      });
      const envelope = result.structuredContent as {
        data: { job: { description: string } };
        warnings: { code: string }[];
      };
      expect(envelope.warnings.map((item) => item.code)).toEqual(
        expect.arrayContaining([
          "CONTENT_SANITIZED",
          "PROMPT_INJECTION_SUSPECTED",
          "UNTRUSTED_CONTENT",
        ]),
      );
      expect(envelope.data.job.description).not.toContain("<p>");
      expect(JSON.stringify(store.audit.list())).not.toContain(hostile);
      expect(JSON.stringify(store.audit.list())).not.toContain(profileInput.headline);
    } finally {
      await close();
    }
  });

  it("logs unexpected failures to stderr only without raw PII", async () => {
    const { client, store, close } = await testClient();
    const stderr = vi.spyOn(process.stderr, "write").mockImplementation(() => true);
    const stdout = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const get = vi.spyOn(store.jobs, "get").mockImplementation(() => {
      throw new Error("candidate@example.com 9876543210 " + "private CV ".repeat(30));
    });
    try {
      const result = await client.callTool({
        name: "jobs_get",
        arguments: { job_id: `job_${crypto.randomUUID()}` },
      });
      expect(code(result.structuredContent)).toBe("INTERNAL");
      expect(JSON.stringify(stderr.mock.calls)).not.toContain("candidate@example.com");
      expect(JSON.stringify(stderr.mock.calls)).not.toContain("private CV");
      expect(stderr).toHaveBeenCalled();
      expect(stdout).not.toHaveBeenCalled();
    } finally {
      get.mockRestore();
      stderr.mockRestore();
      stdout.mockRestore();
      await close();
    }
  });

  it("keeps large exports in structured content while bounding text fallback", async () => {
    const { client, close } = await testClient();
    try {
      for (const title of ["First engineer", "Second engineer"]) {
        const result = await client.callTool({
          name: "jobs_ingest",
          arguments: { job: { ...jobInput, title, description: "Java ".repeat(9_000) } },
        });
        expect(result.isError).toBe(false);
      }
      const exported = await client.callTool({ name: "data_export", arguments: {} });
      const envelope = exported.structuredContent as {
        data: { jobs: unknown[] };
        warnings: { code: string }[];
      };
      expect(envelope.data.jobs).toHaveLength(2);
      expect(envelope.warnings.map((item) => item.code)).toContain("OUTPUT_TRUNCATED");
      const fallback = exported.content[0];
      expect(fallback?.type).toBe("text");
      if (fallback?.type === "text")
        expect(Buffer.byteLength(fallback.text, "utf8")).toBeLessThanOrEqual(64 * 1024);
    } finally {
      await close();
    }
  });

  it("allows only confirmation-required errors to carry data", () => {
    const base = {
      contract_version: "1.0.0",
      status: "error",
      provider: "naukri",
      capability_mode: "L0",
      source_provenance: [],
      warnings: [],
      human_action_required: null,
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "Confirm",
        retryable: false,
        remediation: "Retry",
      },
      meta: {
        tool: "data_purge",
        request_id: crypto.randomUUID(),
        server: "naukri-mcp",
        server_version: "0.1.0",
        policy_snapshot_date: "2026-09-25",
      },
    };
    const schema = envelopeSchema(
      z.strictObject({
        confirmation_token: z.string(),
        summary: z.strictObject({ jobs: z.number(), profiles: z.number() }),
      }),
    );
    const data = { confirmation_token: "cfm_token", summary: { jobs: 1, profiles: 0 } };
    expect(schema.safeParse({ ...base, data }).success).toBe(true);
    expect(schema.safeParse({ ...base, data: null }).success).toBe(false);
    expect(
      schema.safeParse({ ...base, error: { ...base.error, code: "NOT_FOUND" }, data }).success,
    ).toBe(false);
  });
});
