import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/client";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { policy } from "@jpm/job-core";
import naukriPolicyJson from "../config/naukri-policy.json" with { type: "json" };
import indeedPolicyJson from "../config/indeed-policy.json" with { type: "json" };
import { createRequestHandler } from "../src/http.js";
import { sampleIndeedJob, sampleJob, sampleProfile } from "./fixtures.js";

const testNaukriPolicy = policy.loadPolicy(naukriPolicyJson, new Date("2026-09-25T00:00:00Z"));
const testIndeedPolicy = policy.loadPolicy(indeedPolicyJson, new Date("2026-09-25T00:00:00Z"));

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
}

describe("HTTP Integration Tests — Two Hosted Editions", () => {
  let server: Server;
  let baseUrl: string;

  beforeAll(async () => {
    const handler = createRequestHandler({
      naukriPolicy: testNaukriPolicy,
      indeedPolicy: testIndeedPolicy,
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
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  it("checks /health, /healthz, /, and /privacy endpoints", async () => {
    const health = await fetch(`${baseUrl}/health`);
    expect(health.status).toBe(200);
    const healthJson = (await health.json()) as { status: string; version: string };
    expect(healthJson.status).toBe("ok");

    const landing = await fetch(`${baseUrl}/`);
    expect(landing.status).toBe(200);
    const landingHtml = await landing.text();
    expect(landingHtml).toContain("/naukri/mcp");
    expect(landingHtml).toContain("/indeed/mcp");

    const privacy = await fetch(`${baseUrl}/privacy`);
    expect(privacy.status).toBe(200);
    expect(await privacy.text()).toContain("Privacy Statement");
  });

  it("handles Accept: application/json only without 406 error", async () => {
    const res = await fetch(`${baseUrl}/naukri/mcp`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "initialize",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
        id: 1,
      }),
    });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const json = (await res.json()) as { result: { serverInfo: { name: string } } };
    expect(json.result.serverInfo.name).toBe("Arin JobFit — Naukri edition");
  });

  it("completes full 6-tool journey on /naukri/mcp with Naukri serverInfo and URL allowlist", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/naukri/mcp`));
    const client = new Client({ name: "naukri-test-client", version: "1.0.0" });
    await client.connect(transport);

    expect(client.getServerVersion()?.name).toBe("Arin JobFit — Naukri edition");

    // 1. jd_analyze
    const r1 = (await client.callTool({
      name: "jd_analyze",
      arguments: { job: sampleJob },
    })) as unknown as EnvelopeResult;
    assertValidEnvelope(r1);
    expect(r1.structuredContent.meta.server).toBe("naukri-mcp");

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

    // 4. interview_prep
    const r4 = (await client.callTool({
      name: "interview_prep",
      arguments: { job: sampleJob, profile: sampleProfile },
    })) as unknown as EnvelopeResult;
    assertValidEnvelope(r4);

    // 5. application_handoff: official on Naukri, unofficial on Indeed
    const r5Naukri = (await client.callTool({
      name: "application_handoff",
      arguments: { job: sampleJob },
    })) as unknown as EnvelopeResult;
    expect(r5Naukri.structuredContent.data["url_is_official"]).toBe(true);

    const r5Indeed = (await client.callTool({
      name: "application_handoff",
      arguments: { job: sampleIndeedJob },
    })) as unknown as EnvelopeResult;
    expect(r5Indeed.structuredContent.data["url_is_official"]).toBe(false);

    // 6. capabilities_list
    const r6 = (await client.callTool({
      name: "capabilities_list",
      arguments: {},
    })) as unknown as EnvelopeResult;
    assertValidEnvelope(r6);

    await client.close();
    await transport.close();
  });

  it("connects to /indeed/mcp with Indeed serverInfo and URL allowlist", async () => {
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/indeed/mcp`));
    const client = new Client({ name: "indeed-test-client", version: "1.0.0" });
    await client.connect(transport);

    expect(client.getServerVersion()?.name).toBe("Arin JobFit — Indeed edition");

    const rIndeed = (await client.callTool({
      name: "application_handoff",
      arguments: { job: sampleIndeedJob },
    })) as unknown as EnvelopeResult;
    expect(rIndeed.structuredContent.data["url_is_official"]).toBe(true);

    const rNaukri = (await client.callTool({
      name: "application_handoff",
      arguments: { job: sampleJob },
    })) as unknown as EnvelopeResult;
    expect(rNaukri.structuredContent.data["url_is_official"]).toBe(false);

    await client.close();
    await transport.close();
  });
});
