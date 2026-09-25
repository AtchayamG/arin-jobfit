import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { Client } from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import { beforeAll, describe, expect, it } from "vitest";
import {
  JD_IN_01,
  JD_NK_01,
  midJavaProfile,
} from "../../../shared/job-core/tests/scenarios/fixtures.js";

const naukriDistPath = path.resolve(import.meta.dirname, "../../dist/index.js");
const indeedDistPath = path.resolve(import.meta.dirname, "../../../indeed-mcp/dist/index.js");

interface ToolEnvelope<T = Record<string, unknown>> {
  status: string;
  data: T;
  error?: { code: string; message?: string };
}

function asEnvelope<T = Record<string, unknown>>(res: {
  structuredContent?: unknown;
}): ToolEnvelope<T> {
  return res.structuredContent as ToolEnvelope<T>;
}

describe("T-12: Cross-product isolation (naukri-mcp vs indeed-mcp)", () => {
  beforeAll(() => {
    if (!fs.existsSync(indeedDistPath)) {
      throw new Error(
        "Cross-product isolation test requires indeed-mcp to be built first: cd indeed-mcp && npm ci && npm run build",
      );
    }
  });

  it("runs naukri-mcp and indeed-mcp with the same parent data directory in total isolation", async () => {
    // Both products pointed to the exact SAME parent directory
    const sharedParentDir = fs.mkdtempSync(path.join(os.tmpdir(), "jpm-cross-isolation-"));

    const naukriTransport = new StdioClientTransport({
      command: "node",
      args: [naukriDistPath],
      env: {
        ...process.env,
        NAUKRI_MCP_DATA_DIR: sharedParentDir,
      },
      stderr: "pipe",
    });

    const indeedTransport = new StdioClientTransport({
      command: "node",
      args: [indeedDistPath],
      env: {
        ...process.env,
        INDEED_MCP_DATA_DIR: sharedParentDir,
      },
      stderr: "pipe",
    });

    const naukriClient = new Client({ name: "naukri-test-client", version: "1.0.0" });
    const indeedClient = new Client({ name: "indeed-test-client", version: "1.0.0" });

    await naukriClient.connect(naukriTransport);
    await indeedClient.connect(indeedTransport);

    try {
      // 1. Ingest Naukri job into naukri-mcp
      const nkIngest = await naukriClient.callTool({
        name: "jobs_ingest",
        arguments: { job: JD_NK_01.input },
      });
      expect(nkIngest.isError).toBe(false);
      const nkJobId = asEnvelope<{ job_id: string }>(nkIngest).data.job_id;

      // 2. Ingest Indeed job into indeed-mcp
      const inIngest = await indeedClient.callTool({
        name: "jobs_ingest",
        arguments: { job: JD_IN_01.input },
      });
      expect(inIngest.isError).toBe(false);
      const inJobId = asEnvelope<{ job_id: string }>(inIngest).data.job_id;

      // 3. Verify SQLite files created in sharedParentDir
      const naukriDbPath = path.join(sharedParentDir, "naukri-mcp.sqlite3");
      const indeedDbPath = path.join(sharedParentDir, "indeed-mcp.sqlite3");
      expect(fs.existsSync(naukriDbPath), "naukri-mcp.sqlite3 must exist").toBe(true);
      expect(fs.existsSync(indeedDbPath), "indeed-mcp.sqlite3 must exist").toBe(true);

      // 4. Assert naukri-mcp cannot see indeed-mcp's job
      const nkList = await naukriClient.callTool({ name: "jobs_list", arguments: {} });
      const nkItems = asEnvelope<{ items: Array<{ job_id: string }> }>(nkList).data.items;
      expect(nkItems.map((j) => j.job_id)).toContain(nkJobId);
      expect(nkItems.map((j) => j.job_id)).not.toContain(inJobId);

      const nkGetForeign = await naukriClient.callTool({
        name: "jobs_get",
        arguments: { job_id: inJobId },
      });
      expect(nkGetForeign.isError).toBe(true);
      expect(asEnvelope(nkGetForeign).error?.code).toBe("NOT_FOUND");

      // 5. Assert indeed-mcp cannot see naukri-mcp's job
      const inList = await indeedClient.callTool({ name: "jobs_list", arguments: {} });
      const inItems = asEnvelope<{ items: Array<{ job_id: string }> }>(inList).data.items;
      expect(inItems.map((j) => j.job_id)).toContain(inJobId);
      expect(inItems.map((j) => j.job_id)).not.toContain(nkJobId);

      const inGetForeign = await indeedClient.callTool({
        name: "jobs_get",
        arguments: { job_id: nkJobId },
      });
      expect(inGetForeign.isError).toBe(true);
      expect(asEnvelope(inGetForeign).error?.code).toBe("NOT_FOUND");

      // 6. Profile isolation: Upsert in naukri-mcp; indeed-mcp must see 0 profiles
      const profileInput = { ...midJavaProfile };
      delete (profileInput as Record<string, unknown>).profile_id;
      delete (profileInput as Record<string, unknown>).schema_version;
      delete (profileInput as Record<string, unknown>).created_at;
      delete (profileInput as Record<string, unknown>).updated_at;

      const profUpsert = await naukriClient.callTool({
        name: "profile_upsert",
        arguments: { profile: profileInput },
      });
      const profId = asEnvelope<{ profile_id: string }>(profUpsert).data.profile_id;

      const inProfList = await indeedClient.callTool({ name: "profile_list", arguments: {} });
      const inProfItems = asEnvelope<{ items: Array<{ profile_id: string }> }>(inProfList).data
        .items;
      expect(inProfItems.map((p) => p.profile_id)).not.toContain(profId);

      // 7. Purge in naukri-mcp must not affect indeed-mcp
      const purgeReq = await naukriClient.callTool({ name: "data_purge", arguments: {} });
      const token = asEnvelope<{ confirmation_token: string }>(purgeReq).data.confirmation_token;
      await naukriClient.callTool({
        name: "data_purge",
        arguments: { confirmation_token: token },
      });

      // naukri-mcp is empty
      const nkListAfter = await naukriClient.callTool({ name: "jobs_list", arguments: {} });
      expect(asEnvelope<{ items: unknown[] }>(nkListAfter).data.items).toHaveLength(0);

      // indeed-mcp still has its job intact
      const inListAfter = await indeedClient.callTool({ name: "jobs_list", arguments: {} });
      const inItemsAfter = asEnvelope<{ items: Array<{ job_id: string }> }>(inListAfter).data.items;
      expect(inItemsAfter.map((j) => j.job_id)).toContain(inJobId);
    } finally {
      await naukriClient.close();
      await indeedClient.close();
      await naukriTransport.close();
      await indeedTransport.close();
      fs.rmSync(sharedParentDir, { recursive: true, force: true });
    }
  });
});
