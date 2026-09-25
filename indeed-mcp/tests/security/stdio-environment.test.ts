import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { describe, expect, it } from "vitest";
import { syntheticIndeedJob, testProfile } from "../fixtures.js";

const distPath = path.resolve(import.meta.dirname, "../../dist/index.js");

interface ToolEnvelope<T = Record<string, unknown>> {
  status: string;
  data: T;
  human_action_required?: { reason: string; official_url: string };
  error?: { code: string; message?: string };
}

function asEnvelope<T = Record<string, unknown>>(res: {
  structuredContent?: unknown;
}): ToolEnvelope<T> {
  return res.structuredContent as ToolEnvelope<T>;
}

describe("T-10, T-12, T-14, T-15, T-16, T-17: Environment, Stderr Privacy, Isolation, and Handoff", () => {
  it("T-15: rejects relative, traversal, UNC, and root data-dir values with exit code 1", () => {
    const maliciousPaths = [
      "./relative_data_dir",
      "../traversal_data_dir",
      "../../../../tmp/evil_dir",
      "\\\\malicious-host\\share\\data",
      process.platform === "win32" ? "C:\\" : "/",
    ];

    for (const testPath of maliciousPaths) {
      const res = spawnSync("node", [distPath], {
        env: {
          ...process.env,
          INDEED_MCP_DATA_DIR: testPath,
        },
        encoding: "utf-8",
      });

      expect(res.status, `Path ${testPath} should cause exit code 1`).toBe(1);
      expect(res.stderr.length).toBeGreaterThan(0);
      expect(res.stderr).toMatch(/data dir|path|invalid/i);

      // Verify no sqlite file was created at the target
      const possibleDb = path.join(testPath, "indeed-mcp.sqlite3");
      expect(fs.existsSync(possibleDb), `File ${possibleDb} must not be created`).toBe(false);
    }
  });

  it("T-10: verifies stderr logs contain zero candidate PII or raw JD text during full workflow", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "indeed-sec-env-"));
    let capturedStderr = "";

    const transport = new StdioClientTransport({
      command: "node",
      args: [distPath],
      env: {
        ...process.env,
        INDEED_MCP_DATA_DIR: tempDir,
      },
      stderr: "pipe",
    });

    transport.stderr?.on("data", (chunk: Buffer) => {
      capturedStderr += chunk.toString("utf-8");
    });

    const client = new Client({ name: "sec-tester", version: "1.0.0" });
    await client.connect(transport);

    try {
      const secretJdText = "SuperConfidentialProjectApolloStrategy";
      const piiEmail = "stealth.engineer@classified.gov";
      const piiPhone = "+1-555-019-8833";

      // 1. Ingest job with confidential text
      const ingest = await client.callTool({
        name: "jobs_ingest",
        arguments: {
          job: {
            ...syntheticIndeedJob,
            description: `Role details: ${secretJdText}\nRequirements:\n- 5+ years TypeScript`,
          },
        },
      });
      const jobId = asEnvelope<{ job_id: string }>(ingest).data.job_id;

      // 2. Save profile with PII
      const profRes = await client.callTool({
        name: "profile_upsert",
        arguments: {
          profile: {
            ...testProfile,
            headline: `Lead Developer - ${piiEmail}`,
            summary_text: `Direct contact: ${piiPhone}`,
          },
        },
      });
      const profileId = asEnvelope<{ profile_id: string }>(profRes).data.profile_id;

      // 3. Compare profile, extract requirements, export
      await client.callTool({
        name: "jobs_compare_profile",
        arguments: { job_id: jobId, profile_id: profileId },
      });
      await client.callTool({
        name: "jobs_extract_requirements",
        arguments: { job_id: jobId },
      });
      await client.callTool({ name: "data_export" });

      // 4. Assert stderr contains no sensitive strings
      expect(capturedStderr).not.toContain(secretJdText);
      expect(capturedStderr).not.toContain(piiEmail);
      expect(capturedStderr).not.toContain(piiPhone);
    } finally {
      await client.close();
      await transport.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("T-12: verifies cross-product isolation: no naukri references and isolated database", () => {
    // Static scan of indeed-mcp/src/**
    const srcDir = path.resolve(import.meta.dirname, "../../src");
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    for (const file of files) {
      if (!file.endsWith(".ts")) continue;
      const code = fs.readFileSync(path.join(srcDir, file), "utf-8");
      expect(code).not.toMatch(/naukri/i);
      expect(code).not.toContain("NAUKRI_MCP_DATA_DIR");
    }
  });

  it("T-14: verifies zero runtime dependencies in package.json and clean standalone dist", () => {
    const pkgPath = path.resolve(import.meta.dirname, "../../package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as {
      dependencies?: Record<string, string>;
    };
    // Production dependencies must be absent or empty
    expect(pkg.dependencies ?? {}).toEqual({});

    // Dist bundle must start with shebang
    const bundleHeader = fs.readFileSync(distPath, "utf-8").slice(0, 50);
    expect(bundleHeader).toMatch(/^#!\/usr\/bin\/env node/);
  });

  it("T-16 & T-17: verifies human_only_fields and non-autonomous boundary over stdio", async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "indeed-sec-handoff-"));
    const transport = new StdioClientTransport({
      command: "node",
      args: [distPath],
      env: {
        ...process.env,
        INDEED_MCP_DATA_DIR: tempDir,
      },
      stderr: "pipe",
    });

    const client = new Client({ name: "sec-handoff-tester", version: "1.0.0" });
    await client.connect(transport);

    try {
      const ingest = await client.callTool({
        name: "jobs_ingest",
        arguments: { job: syntheticIndeedJob },
      });
      const jobId = asEnvelope<{ job_id: string }>(ingest).data.job_id;

      const handoff = await client.callTool({
        name: "jobs_application_handoff",
        arguments: { job_id: jobId },
      });

      expect(handoff.isError).toBe(false);
      const envelope = asEnvelope<{ human_only_fields: string[]; url_is_official: boolean }>(
        handoff,
      );
      const data = envelope.data;
      expect(data.human_only_fields).toContain("final_submit");
      expect(data.url_is_official).toBe(true);

      const action = envelope.human_action_required;
      expect(action).toBeDefined();
      expect(action?.official_url).toBe(syntheticIndeedJob.source_url);
    } finally {
      await client.close();
      await transport.close();
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
