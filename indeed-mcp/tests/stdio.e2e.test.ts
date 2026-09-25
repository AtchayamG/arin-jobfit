import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { hostileJob, syntheticIndeedJob, testProfile, type ToolEnvelope } from "./fixtures.js";

const distPath = path.resolve(import.meta.dirname, "../dist/index.js");

describe("indeed-mcp stdio E2E suite", () => {
  let tempDir: string;
  let client: Client;
  let transport: StdioClientTransport;
  let stderrOutput = "",
    ingestedJobId = "";

  beforeAll(async () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "indeed-mcp-e2e-"));
    transport = new StdioClientTransport({
      command: "node",
      args: [distPath],
      env: {
        ...process.env,
        INDEED_MCP_DATA_DIR: tempDir,
      },
      stderr: "pipe",
    });

    transport.stderr?.on("data", (chunk: Buffer | string) => {
      stderrOutput += chunk.toString();
    });

    client = new Client({ name: "e2e-client", version: "1.0.0" });
    await client.connect(transport);
  });

  afterAll(async () => {
    try {
      await client.close();
    } catch {
      // Ignore client close errors on teardown
    }
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("lists exactly 22 tools in alphabetical order", async () => {
    const list = await client.listTools();
    expect(list.tools).toHaveLength(22);
    const names = list.tools.map((t) => t.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it("shows provider capabilities with L1+ blocked by provider approval", async () => {
    const res = await client.callTool({ name: "provider_capabilities" });
    const content = res.structuredContent as ToolEnvelope<{
      capabilities: Array<{ id: string; level: string; status: string }>;
    }>;
    const l1Caps = content.data.capabilities.filter((c) => c.level === "L1");
    expect(l1Caps.length).toBeGreaterThan(0);
    expect(l1Caps.every((c) => c.status === "blocked_by_provider_approval")).toBe(true);
  });

  it("ingests a synthetic Indeed job returning ok and UNTRUSTED_CONTENT warning", async () => {
    const res = await client.callTool({
      name: "jobs_ingest",
      arguments: { job: syntheticIndeedJob },
    });
    expect(res.isError).toBe(false);
    const content = res.structuredContent as ToolEnvelope<{ job_id: string }>;
    expect(["ok", "partial"]).toContain(content.status);
    expect(content.warnings?.map((w) => w.code)).toContain("UNTRUSTED_CONTENT");
    expect(content.data.job_id).toMatch(/^job_/);
    ingestedJobId = content.data.job_id;
  });

  it("warns PROMPT_INJECTION_SUSPECTED on hostile JD ingestion", async () => {
    const res = await client.callTool({
      name: "jobs_ingest",
      arguments: { job: hostileJob },
    });
    const content = res.structuredContent as ToolEnvelope;
    expect(content.warnings?.map((w) => w.code)).toContain("PROMPT_INJECTION_SUSPECTED");
  });

  it("compares an inline profile against an ingested job", async () => {
    const res = await client.callTool({
      name: "jobs_compare_profile",
      arguments: {
        job_id: ingestedJobId,
        profile: testProfile,
      },
    });
    expect(res.isError).toBe(false);
    const content = res.structuredContent as ToolEnvelope<{
      fit_score: number;
      confidence: number;
    }>;
    expect(["ok", "partial"]).toContain(content.status);
    expect(typeof content.data.fit_score).toBe("number");
    expect(typeof content.data.confidence).toBe("number");
  });

  it("handles application handoff with official Indeed URL and human_only_fields", async () => {
    const res = await client.callTool({
      name: "jobs_application_handoff",
      arguments: { job_id: ingestedJobId },
    });
    expect(res.isError).toBe(false);
    const content = res.structuredContent as ToolEnvelope<{
      url_is_official: boolean;
      human_only_fields: string[];
    }>;
    expect(["ok", "partial"]).toContain(content.status);
    expect(content.data.url_is_official).toBe(true);
    expect(content.human_action_required).toBeDefined();
    expect(content.data.human_only_fields).toContain("final_submit");
  });

  it("executes the data_purge two-step flow", async () => {
    const step1 = await client.callTool({ name: "data_purge" });
    expect(step1.isError).toBe(true);
    const step1Content = step1.structuredContent as ToolEnvelope<{ confirmation_token: string }>;
    expect(step1Content.status).toBe("error");
    expect(step1Content.error?.code).toBe("CONFIRMATION_REQUIRED");
    const token = step1Content.data.confirmation_token;
    expect(token).toBeDefined();

    const step2 = await client.callTool({
      name: "data_purge",
      arguments: { confirmation_token: token },
    });
    expect(step2.isError).toBe(false);
    const step2Content = step2.structuredContent as ToolEnvelope<{
      purged_counts: { jobs: number; profiles: number };
    }>;
    expect(["ok", "partial"]).toContain(step2Content.status);
    expect(step2Content.data.purged_counts).toBeDefined();
  });

  it("accepts agent_relay ingestion with relay_source indeed_official_mcp", async () => {
    const relayJob = {
      ...syntheticIndeedJob,
      title: "Staff Engineer (Relayed)",
      origin: "agent_relay" as const,
      relay_source: "indeed_official_mcp",
    };
    const res = await client.callTool({
      name: "jobs_ingest",
      arguments: { job: relayJob },
    });
    expect(res.isError).toBe(false);
    const content = res.structuredContent as ToolEnvelope<{ job_id: string }>;
    expect(["ok", "partial"]).toContain(content.status);

    const get = await client.callTool({
      name: "jobs_get",
      arguments: { job_id: content.data.job_id },
    });
    expect(get.isError).toBe(false);
    const getContent = get.structuredContent as ToolEnvelope<{
      job: { source_provenance: Array<{ kind: string; detail?: string }> };
    }>;
    const hasRelay = getContent.data.job.source_provenance.some(
      (p) => p.kind === "agent_relay" && p.detail?.includes("indeed_official_mcp"),
    );
    expect(hasRelay).toBe(true);
  });

  it("verifies stderr has no ExperimentalWarning and sqlite file was created", () => {
    expect(stderrOutput).not.toContain("ExperimentalWarning");
    const dbFile = path.join(tempDir, "indeed-mcp.sqlite3");
    expect(fs.existsSync(dbFile)).toBe(true);
  });

  it("suppresses SQLite ExperimentalWarning deterministically while forwarding other warnings", () => {
    const mod = pathToFileURL(path.resolve(import.meta.dirname, "../src/warnings.ts")).href;
    const script = `
      import { installWarningFilter } from "${mod}";
      installWarningFilter();
      process.emitWarning("SQLite is an experimental feature", "ExperimentalWarning");
      process.emitWarning("Arbitrary other warning", "DeprecationWarning");
    `;
    const res = spawnSync(
      process.execPath,
      ["--import", "tsx", "--input-type=module", "-e", script],
      { encoding: "utf-8" },
    );
    expect(res.status).toBe(0);
    expect(res.stderr).not.toContain("ExperimentalWarning");
    expect(res.stderr).not.toContain("SQLite is an experimental feature");
    expect(res.stderr).toContain("DeprecationWarning: Arbitrary other warning");
  });

  describe("CLI arguments and standalone bundle", () => {
    it("prints package version on --version", () => {
      const output = execFileSync("node", [distPath, "--version"], { encoding: "utf-8" }).trim();
      expect(output).toBe("0.1.0");
    });

    it("prints usage instructions on --help", () => {
      const output = execFileSync("node", [distPath, "--help"], { encoding: "utf-8" });
      expect(output).toContain("Usage: indeed-mcp");
    });

    it("exits with code 2 on unknown arguments", () => {
      try {
        execFileSync("node", [distPath, "--unknown-flag"], { encoding: "utf-8" });
        expect.unreachable("should have thrown on unknown flag");
      } catch (err) {
        const error = err as { status: number; stderr: string };
        expect(error.status).toBe(2);
        expect(error.stderr).toContain("Unknown argument(s)");
      }
    });

    it("runs standalone from a directory with no node_modules", () => {
      const freshTmp = fs.mkdtempSync(path.join(os.tmpdir(), "indeed-mcp-standalone-"));
      try {
        const copiedDist = path.join(freshTmp, "index.js");
        fs.copyFileSync(distPath, copiedDist);
        const output = execFileSync("node", [copiedDist, "--version"], {
          encoding: "utf-8",
        }).trim();
        expect(output).toBe("0.1.0");
      } finally {
        fs.rmSync(freshTmp, { recursive: true, force: true });
      }
    });
  });

  describe("product isolation scan", () => {
    it("scans src/** ensuring no reference to other products or env vars", () => {
      const srcDir = path.resolve(import.meta.dirname, "../src");
      const files = (fs.readdirSync(srcDir, { recursive: true }) as string[]).filter((f) =>
        f.endsWith(".ts"),
      );
      for (const file of files) {
        const code = fs.readFileSync(path.join(srcDir, file), "utf-8");
        expect(code).not.toMatch(/naukri/i);
        expect(code).not.toContain("NAUKRI_MCP_DATA_DIR");
      }
    });
  });
});
