import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { policy } from "@jpm/job-core";
import policyJson from "../config/policy.json" with { type: "json" };
import { createRequestHandler } from "../src/http.js";
import { sampleJob, sampleProfile } from "./fixtures.js";

const testPolicy = policy.loadPolicy(policyJson, new Date("2026-09-25T00:00:00Z"));

interface EnvelopeResult {
  isError?: boolean;
  structuredContent: {
    contract_version: string;
    status: string;
    provider: string;
    meta: { tool: string; server: string };
    data: Record<string, unknown>;
  };
}

function assertValidEnvelope(result: unknown): asserts result is EnvelopeResult {
  expect(result).toBeDefined();
  const res = result as EnvelopeResult;
  expect(res.isError).toBeFalsy();
  expect(res.structuredContent).toBeDefined();
  expect(typeof res.structuredContent.contract_version).toBe("string");
  expect(["ok", "partial", "error"]).toContain(res.structuredContent.status);
  expect(["naukri", "indeed"]).toContain(res.structuredContent.provider);
  expect(res.structuredContent.meta.tool).toBeDefined();
  expect(["naukri-mcp", "indeed-mcp"]).toContain(res.structuredContent.meta.server);
}

describe("HTTP Integration Tests — 6-Tool Journey via MCP Client SDK", () => {
  let server: Server;
  let baseUrl: string;
  let client: Client;
  let transport: StreamableHTTPClientTransport;

  beforeAll(async () => {
    const handler = createRequestHandler({
      policy: testPolicy,
      isProduction: false,
    });
    server = createServer((req, res) => {
      void handler(req, res);
    });
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        resolve();
      });
    });
    const addr = server.address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${String(addr.port)}`;

    transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`));
    client = new Client({ name: "test-client", version: "1.0.0" });
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close().catch(() => {});
    await transport.close().catch(() => {});
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  it("checks /healthz, /, and /privacy endpoints", async () => {
    const healthz = await fetch(`${baseUrl}/healthz`);
    expect(healthz.status).toBe(200);
    const healthJson = (await healthz.json()) as { status: string; version: string };
    expect(healthJson.status).toBe("ok");
    expect(healthJson.version).toBe("0.1.0");

    const landing = await fetch(`${baseUrl}/`);
    expect(landing.status).toBe(200);
    const landingHtml = await landing.text();
    expect(landingHtml).toContain("Arin JobFit");
    expect(landingHtml).toContain("stores nothing");

    const privacy = await fetch(`${baseUrl}/privacy`);
    expect(privacy.status).toBe(200);
    const privacyText = await privacy.text();
    expect(privacyText).toContain("Privacy Statement");
    expect(privacyText).toContain("No Storage");
  });

  it("completes full 6-tool journey over Streamable HTTP and validates schema envelopes", async () => {
    // 1. jd_analyze
    const r1 = (await client.callTool({
      name: "jd_analyze",
      arguments: { job: sampleJob, portal: "naukri" },
    })) as unknown as EnvelopeResult;
    assertValidEnvelope(r1);
    const jobData = r1.structuredContent.data["job"] as { title: string };
    expect(jobData.title).toBe("Senior Full Stack Engineer");

    // 2. fit_score
    const r2 = (await client.callTool({
      name: "fit_score",
      arguments: { job: sampleJob, profile: sampleProfile },
    })) as unknown as EnvelopeResult;
    assertValidEnvelope(r2);
    expect(r2.structuredContent.data["fit_score"]).toBeDefined();

    // 3. cv_notes
    const r3 = (await client.callTool({
      name: "cv_notes",
      arguments: { job: sampleJob, profile: sampleProfile },
    })) as unknown as EnvelopeResult;
    assertValidEnvelope(r3);
    expect(r3.structuredContent.data["emphasize"]).toBeDefined();

    // 4. interview_prep
    const r4 = (await client.callTool({
      name: "interview_prep",
      arguments: { job: sampleJob, profile: sampleProfile },
    })) as unknown as EnvelopeResult;
    assertValidEnvelope(r4);
    expect(r4.structuredContent.data["topics"]).toBeDefined();

    // 5. application_handoff
    const r5 = (await client.callTool({
      name: "application_handoff",
      arguments: { job: sampleJob },
    })) as unknown as EnvelopeResult;
    assertValidEnvelope(r5);
    const handoffData = r5.structuredContent.data["human_only_fields"] as string[];
    expect(handoffData).toContain("final_submit");

    // 6. capabilities_list
    const r6 = (await client.callTool({
      name: "capabilities_list",
      arguments: {},
    })) as unknown as EnvelopeResult;
    assertValidEnvelope(r6);
    const capsData = r6.structuredContent.data["capabilities"] as unknown[];
    expect(capsData.length).toBeGreaterThan(0);
  });
});
