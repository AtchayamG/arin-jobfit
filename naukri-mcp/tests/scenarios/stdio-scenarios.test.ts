import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  JD_NK_01,
  JD_NK_02,
  JD_NK_03,
  fresherProfile,
  midJavaProfile,
  seniorMobileProfile,
} from "../../../shared/job-core/tests/scenarios/fixtures.js";

const distPath = path.resolve(import.meta.dirname, "../../dist/index.js");

interface ToolEnvelope<T = Record<string, unknown>> {
  status: string;
  data: T;
  warnings?: Array<{ code: string; message: string }>;
  error?: { code: string; message: string };
  human_action_required?: { reason: string; actions: string[]; official_url: string | null };
}

function asEnvelope<T = Record<string, unknown>>(res: {
  structuredContent?: unknown;
}): ToolEnvelope<T> {
  return res.structuredContent as ToolEnvelope<T>;
}

function toProfileInput(profile: Record<string, unknown>): Record<string, unknown> {
  const copy = { ...profile };
  delete copy.profile_id;
  delete copy.schema_version;
  delete copy.created_at;
  delete copy.updated_at;
  return copy;
}

async function runScenarioPipeline(
  client: Client,
  jobInput: Record<string, unknown>,
  profileInput: Record<string, unknown>,
) {
  const ingestRes = await client.callTool({ name: "jobs_ingest", arguments: { job: jobInput } });
  expect(ingestRes.isError).toBe(false);
  const jobId = asEnvelope<{ job_id: string }>(ingestRes).data.job_id;

  const profRes = await client.callTool({
    name: "profile_upsert",
    arguments: { profile: profileInput },
  });
  expect(profRes.isError).toBe(false);
  const profileId = asEnvelope<{ profile_id: string }>(profRes).data.profile_id;

  const compRes = await client.callTool({
    name: "jobs_compare_profile",
    arguments: { job_id: jobId, profile_id: profileId },
  });
  expect(compRes.isError).toBe(false);

  const cvRes = await client.callTool({
    name: "jobs_prepare_cv_notes",
    arguments: { job_id: jobId, profile_id: profileId },
  });
  expect(cvRes.isError).toBe(false);

  const intRes = await client.callTool({
    name: "jobs_prepare_interview",
    arguments: { job_id: jobId, profile_id: profileId },
  });
  expect(intRes.isError).toBe(false);

  const handoffRes = await client.callTool({
    name: "jobs_application_handoff",
    arguments: { job_id: jobId },
  });
  expect(handoffRes.isError).toBe(false);

  return { jobId, profileId, compRes, cvRes, intRes, handoffRes };
}

describe("WP-SEC-001B: naukri-mcp stdio scenario suite (3 Naukri end-to-end flows)", () => {
  let tempDir: string;
  let client: Client;
  let transport: StdioClientTransport;

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "naukri-mcp-scenarios-"));
    transport = new StdioClientTransport({
      command: "node",
      args: [distPath],
      env: {
        ...process.env,
        NAUKRI_MCP_DATA_DIR: tempDir,
      },
      stderr: "pipe",
    });

    client = new Client({ name: "naukri-scenario-client", version: "1.0.0" });
    await client.connect(transport);
  });

  afterAll(async () => {
    try {
      await client.close();
      await transport.close();
    } catch {
      // Ignore teardown errors
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("Scenario 1: Senior Java Backend (JD_NK_01 + midJavaProfile)", async () => {
    const { jobId, profileId, compRes, cvRes, intRes, handoffRes } = await runScenarioPipeline(
      client,
      JD_NK_01.input,
      toProfileInput(midJavaProfile),
    );

    expect(jobId).toMatch(/^job_/);
    expect(profileId).toMatch(/^prof_/);

    const compData = asEnvelope<{ band: string; dimensions: unknown[] }>(compRes).data;
    expect(compData.band).toBe("strong");
    expect(compData.dimensions).toHaveLength(7);

    const cvData = asEnvelope<{ truthfulness_note: string; emphasize: unknown[] }>(cvRes).data;
    expect(cvData.truthfulness_note).toBeDefined();
    expect(cvData.emphasize.length).toBeGreaterThan(0);

    const intData = asEnvelope<{ topics: Array<{ topic: string }> }>(intRes).data;
    expect(intData.topics.length).toBeGreaterThan(0);
    expect(intData.topics.length).toBeLessThanOrEqual(40);

    const handoffEnv = asEnvelope<{ human_only_fields: string[]; url_is_official: boolean }>(
      handoffRes,
    );
    expect(handoffEnv.data.human_only_fields).toContain("final_submit");
    expect(handoffEnv.data.url_is_official).toBe(true);
    expect(handoffEnv.human_action_required?.official_url).toBe(JD_NK_01.input.source_url);
  });

  it("Scenario 2: Lead Angular Developer (JD_NK_02 + seniorMobileProfile, undisclosed salary)", async () => {
    const { compRes, cvRes, intRes, handoffRes } = await runScenarioPipeline(
      client,
      JD_NK_02.input,
      toProfileInput(seniorMobileProfile),
    );

    const compData = asEnvelope<{ band: string; dimensions: unknown[] }>(compRes).data;
    expect(compData.band).toBe("strong");
    expect(compData.dimensions).toHaveLength(7);

    const cvData = asEnvelope<{ truthfulness_note: string }>(cvRes).data;
    expect(cvData.truthfulness_note).toBeDefined();

    const intData = asEnvelope<{ topics: unknown[] }>(intRes).data;
    expect(intData.topics.length).toBeGreaterThan(0);

    const handoffEnv = asEnvelope<{ human_only_fields: string[]; url_is_official: boolean }>(
      handoffRes,
    );
    expect(handoffEnv.data.human_only_fields).toContain("final_submit");
    expect(handoffEnv.data.url_is_official).toBe(true);
  });

  it("Scenario 3: Junior Python Engineer (JD_NK_03 + fresherProfile, fresher range)", async () => {
    const { compRes, cvRes, intRes, handoffRes } = await runScenarioPipeline(
      client,
      JD_NK_03.input,
      toProfileInput(fresherProfile),
    );

    const compData = asEnvelope<{ band: string; dimensions: unknown[] }>(compRes).data;
    expect(compData.band).toBe("strong");
    expect(compData.dimensions).toHaveLength(7);

    const cvData = asEnvelope<{ truthfulness_note: string }>(cvRes).data;
    expect(cvData.truthfulness_note).toBeDefined();

    const intData = asEnvelope<{ topics: unknown[] }>(intRes).data;
    expect(intData.topics.length).toBeGreaterThan(0);

    const handoffEnv = asEnvelope<{ human_only_fields: string[]; url_is_official: boolean }>(
      handoffRes,
    );
    expect(handoffEnv.data.human_only_fields).toContain("final_submit");
    expect(handoffEnv.data.url_is_official).toBe(true);
  });
});
