import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  discriminatoryJob,
  fresherProfile,
  hostileJob,
  midJavaProfile,
  mobileLeadJob,
  seniorProfile,
  type ToolEnvelope,
} from "./fixtures.js";

const distPath = path.resolve(import.meta.dirname, "../../dist/index.js");

describe("WP-QA-002: indeed-mcp stdio scenario suite (3 end-to-end flows)", () => {
  let tempDir: string;
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "indeed-mcp-scenarios-"));
    transport = new StdioClientTransport({
      command: "node",
      args: [distPath],
      env: {
        ...process.env,
        INDEED_MCP_DATA_DIR: tempDir,
      },
      stderr: "pipe",
    });

    client = new Client({ name: "scenario-client", version: "1.0.0" });
    await client.connect(transport);
  });

  afterAll(async () => {
    try {
      await client.close();
    } catch {
      // Ignore teardown errors
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("Scenario 1 (Strong Fit): Ingest → Upsert → Compare → CV Notes → Interview → Handoff", async () => {
    // 1. Ingest
    const ingestRes = await client.callTool({
      name: "jobs_ingest",
      arguments: { job: mobileLeadJob },
    });
    expect(ingestRes.isError).toBe(false);
    const ingestEnv = ingestRes.structuredContent as ToolEnvelope<{ job_id: string }>;
    const jobId = ingestEnv.data.job_id;
    expect(jobId).toMatch(/^job_/);

    // 2. Upsert profile
    const profileRes = await client.callTool({
      name: "profile_upsert",
      arguments: { profile: seniorProfile },
    });
    expect(profileRes.isError).toBe(false);
    const profileId = (profileRes.structuredContent as ToolEnvelope<{ profile_id: string }>).data
      .profile_id;
    expect(profileId).toMatch(/^prof_/);

    // 3. Compare profile
    const compareRes = await client.callTool({
      name: "jobs_compare_profile",
      arguments: { job_id: jobId, profile_id: profileId },
    });
    expect(compareRes.isError).toBe(false);
    const compareEnv = compareRes.structuredContent as ToolEnvelope<{
      band: string;
      dimensions: unknown[];
    }>;
    expect(compareEnv.data.band).toBe("strong");
    expect(compareEnv.data.dimensions).toHaveLength(7);

    // 4. CV Notes
    const cvRes = await client.callTool({
      name: "jobs_prepare_cv_notes",
      arguments: { job_id: jobId, profile_id: profileId },
    });
    expect(cvRes.isError).toBe(false);
    const cvEnv = cvRes.structuredContent as ToolEnvelope<{
      truthfulness_note: string;
      emphasize: unknown[];
    }>;
    expect(cvEnv.data.truthfulness_note).toBeDefined();
    expect(cvEnv.data.emphasize.length).toBeGreaterThan(0);

    // 5. Interview Plan
    const intRes = await client.callTool({
      name: "jobs_prepare_interview",
      arguments: { job_id: jobId, profile_id: profileId },
    });
    expect(intRes.isError).toBe(false);
    const intEnv = intRes.structuredContent as ToolEnvelope<{ topics: Array<{ topic: string }> }>;
    expect(intEnv.data.topics.length).toBeGreaterThan(0);
    expect(intEnv.data.topics.length).toBeLessThanOrEqual(40);

    // 6. Application Handoff
    const handoffRes = await client.callTool({
      name: "jobs_application_handoff",
      arguments: { job_id: jobId },
    });
    expect(handoffRes.isError).toBe(false);
    const handoffEnv = handoffRes.structuredContent as ToolEnvelope<{
      human_only_fields: string[];
      checklist: string[];
    }>;
    expect(handoffEnv.data.human_only_fields).toContain("final_submit");
    expect(handoffEnv.human_action_required).toBeDefined();
  });

  it("Scenario 2 (Discriminatory JD): Ingest flags warnings → Full preparation succeeds", async () => {
    // 1. Ingest
    const ingestRes = await client.callTool({
      name: "jobs_ingest",
      arguments: { job: discriminatoryJob },
    });
    expect(ingestRes.isError).toBe(false);
    const ingestEnv = ingestRes.structuredContent as ToolEnvelope<{ job_id: string }>;
    const jobId = ingestEnv.data.job_id;
    const warnings = ingestEnv.warnings?.map((w) => w.code) ?? [];
    expect(warnings).toContain("POTENTIALLY_DISCRIMINATORY_REQUIREMENT");

    // 2. Upsert profile
    const profileRes = await client.callTool({
      name: "profile_upsert",
      arguments: { profile: midJavaProfile },
    });
    expect(profileRes.isError).toBe(false);
    const profileId = (profileRes.structuredContent as ToolEnvelope<{ profile_id: string }>).data
      .profile_id;

    // 3. Compare profile
    const compareRes = await client.callTool({
      name: "jobs_compare_profile",
      arguments: { job_id: jobId, profile_id: profileId },
    });
    expect(compareRes.isError).toBe(false);
    const compareEnv = compareRes.structuredContent as ToolEnvelope<{ band: string }>;
    expect(compareEnv.data.band).toBe("strong");

    // 4. CV Notes
    const cvRes = await client.callTool({
      name: "jobs_prepare_cv_notes",
      arguments: { job_id: jobId, profile_id: profileId },
    });
    expect(cvRes.isError).toBe(false);

    // 5. Interview Plan
    const intRes = await client.callTool({
      name: "jobs_prepare_interview",
      arguments: { job_id: jobId, profile_id: profileId },
    });
    expect(intRes.isError).toBe(false);

    // 6. Application Handoff
    const handoffRes = await client.callTool({
      name: "jobs_application_handoff",
      arguments: { job_id: jobId },
    });
    expect(handoffRes.isError).toBe(false);
    const handoffEnv = handoffRes.structuredContent as ToolEnvelope<{
      human_only_fields: string[];
    }>;
    expect(handoffEnv.data.human_only_fields).toContain("final_submit");
  });

  it("Scenario 3 (Hostile Injection): Ingest warns PROMPT_INJECTION_SUSPECTED → Gaps correctly flagged", async () => {
    // 1. Ingest
    const ingestRes = await client.callTool({
      name: "jobs_ingest",
      arguments: { job: hostileJob },
    });
    expect(ingestRes.isError).toBe(false);
    const ingestEnv = ingestRes.structuredContent as ToolEnvelope<{ job_id: string }>;
    const jobId = ingestEnv.data.job_id;
    const warnings = ingestEnv.warnings?.map((w) => w.code) ?? [];
    expect(warnings).toContain("PROMPT_INJECTION_SUSPECTED");
    expect(warnings).toContain("UNTRUSTED_CONTENT");

    // 2. Upsert profile
    const profileRes = await client.callTool({
      name: "profile_upsert",
      arguments: { profile: fresherProfile },
    });
    expect(profileRes.isError).toBe(false);
    const profileId = (profileRes.structuredContent as ToolEnvelope<{ profile_id: string }>).data
      .profile_id;

    // 3. Compare profile
    const compareRes = await client.callTool({
      name: "jobs_compare_profile",
      arguments: { job_id: jobId, profile_id: profileId },
    });
    expect(compareRes.isError).toBe(false);
    const compareEnv = compareRes.structuredContent as ToolEnvelope<{ band: string }>;
    expect(compareEnv.data.band).toBe("weak");

    // 4. CV Notes (Docker & PostgreSQL missing)
    const cvRes = await client.callTool({
      name: "jobs_prepare_cv_notes",
      arguments: { job_id: jobId, profile_id: profileId },
    });
    expect(cvRes.isError).toBe(false);
    const cvEnv = cvRes.structuredContent as ToolEnvelope<{ do_not_claim: string[] }>;
    expect(cvEnv.data.do_not_claim.some((c) => c.includes("Docker"))).toBe(true);
    expect(cvEnv.data.do_not_claim.some((c) => c.includes("PostgreSQL"))).toBe(true);

    // 5. Interview Plan
    const intRes = await client.callTool({
      name: "jobs_prepare_interview",
      arguments: { job_id: jobId, profile_id: profileId },
    });
    expect(intRes.isError).toBe(false);
    const intEnv = intRes.structuredContent as ToolEnvelope<{
      topics: Array<{ source: string; study_pointers: string[] }>;
    }>;
    const gapTopics = intEnv.data.topics.filter((t) => t.source === "gap");
    expect(gapTopics.length).toBeGreaterThan(0);
    for (const gap of gapTopics) {
      expect(
        gap.study_pointers.some((p) =>
          p.toLowerCase().includes("prepare a truthful account of your exposure to"),
        ),
      ).toBe(true);
    }

    // 6. Application Handoff
    const handoffRes = await client.callTool({
      name: "jobs_application_handoff",
      arguments: { job_id: jobId },
    });
    expect(handoffRes.isError).toBe(false);
    const handoffEnv = handoffRes.structuredContent as ToolEnvelope<{
      human_only_fields: string[];
    }>;
    expect(handoffEnv.data.human_only_fields).toContain("final_submit");
  });
});
