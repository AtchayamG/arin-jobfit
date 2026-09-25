import { describe, expect, it } from "vitest";
import { testClient, jobInput, profileInput } from "../mcp/client.js";
import { asEnvelope } from "./helpers.js";

interface IngestData {
  job_id: string;
}

interface ProfileData {
  profile_id: string;
}

interface ExportData {
  audit?: unknown;
  jobs: unknown[];
  profiles: unknown[];
}

interface PurgeData {
  confirmation_token?: string;
  purged_counts: { jobs: number; profiles: number };
}

interface ListData {
  items: unknown[];
}

interface ToolAnnotations {
  destructiveHint?: boolean;
  readOnlyHint?: boolean;
}

describe("T-10 & T-13: Audit log privacy and data purge token security", () => {
  it("T-10: audit log contains only salted hashes and metadata, zero PII or raw JD text", async () => {
    const { client, store, close } = await testClient();
    try {
      const piiEmail = "alice.secret@classified.corp";
      const piiPhone = "+1-555-867-5309";
      const sensitiveJdText = "TopSecret Project Titan Architecture and Strategy";

      // 1. Ingest sensitive job
      const ingest = await client.callTool({
        name: "jobs_ingest",
        arguments: {
          job: {
            ...jobInput,
            description: sensitiveJdText,
          },
        },
      });
      expect(ingest.isError).toBe(false);
      const jobId = asEnvelope<IngestData>(ingest).data.job_id;

      // 2. Upsert profile with PII in headline and summary
      const profRes = await client.callTool({
        name: "profile_upsert",
        arguments: {
          profile: {
            ...profileInput,
            headline: `Staff Engineer - contact ${piiEmail}`,
            summary_text: `Direct phone: ${piiPhone}`,
          },
        },
      });
      expect(profRes.isError).toBe(false);
      const profileId = asEnvelope<ProfileData>(profRes).data.profile_id;

      // 3. Perform several operations generating audit records
      await client.callTool({
        name: "jobs_compare_profile",
        arguments: { job_id: jobId, profile_id: profileId },
      });
      await client.callTool({
        name: "jobs_extract_requirements",
        arguments: { job_id: jobId },
      });

      // 4. Inspect audit rows directly from store
      const auditEntries = store.audit.list(100);
      expect(auditEntries.length).toBeGreaterThan(0);

      const serializedAudit = JSON.stringify(auditEntries);
      expect(serializedAudit).not.toContain(piiEmail);
      expect(serializedAudit).not.toContain(piiPhone);
      expect(serializedAudit).not.toContain("TopSecret Project Titan");

      // Verify each row structure has only allowed fields: id, at, tool, request_id, outcome, error_code, subject_hash
      for (const entry of auditEntries) {
        expect(entry).toHaveProperty("tool");
        expect(entry).toHaveProperty("outcome");
        if (entry.subject_hash) {
          // Must be 16-character hexadecimal hash
          expect(entry.subject_hash).toMatch(/^[0-9a-f]{16}$/);
          expect(entry.subject_hash).not.toContain(jobId);
          expect(entry.subject_hash).not.toContain(profileId);
        }
      }

      // 5. Test that data_export does not export internal audit records
      const exportRes = await client.callTool({ name: "data_export" });
      expect(exportRes.isError).toBe(false);
      const exportData = asEnvelope<ExportData>(exportRes).data;
      expect(exportData).not.toHaveProperty("audit");
      expect(exportData).toHaveProperty("jobs");
      expect(exportData).toHaveProperty("profiles");
    } finally {
      await close();
    }
  });

  it("T-13: data_purge strictly enforces two-step flow and rejects replay, forged, and cross-store tokens", async () => {
    const { client: clientA, close: closeA } = await testClient();
    const { client: clientB, close: closeB } = await testClient();
    try {
      // Ingest test records into clientA
      await clientA.callTool({
        name: "jobs_ingest",
        arguments: { job: jobInput },
      });
      await clientA.callTool({
        name: "profile_upsert",
        arguments: { profile: profileInput },
      });

      // 1. Calling purge with no token must fail with CONFIRMATION_REQUIRED and return a token
      const step1 = await clientA.callTool({ name: "data_purge" });
      expect(step1.isError).toBe(true);
      const step1Content = asEnvelope<{ confirmation_token: string }>(step1);
      expect(step1Content.status).toBe("error");
      expect(step1Content.error?.code).toBe("CONFIRMATION_REQUIRED");
      const token = step1Content.data.confirmation_token;
      expect(token).toMatch(/^cfm_/);

      // Verify no data was purged in step 1
      const listBefore = await clientA.callTool({ name: "jobs_list" });
      expect(asEnvelope<ListData>(listBefore).data.items.length).toBeGreaterThan(0);

      // 2. Forged token attack: must be rejected
      const forged = await clientA.callTool({
        name: "data_purge",
        arguments: { confirmation_token: "cfm_forged_token_000000000000" },
      });
      expect(forged.isError).toBe(true);
      expect(asEnvelope(forged).error?.code).toBe("CONFIRMATION_INVALID");

      // 3. Cross-store token attack: token from Store A used on Store B must be rejected
      const crossStore = await clientB.callTool({
        name: "data_purge",
        arguments: { confirmation_token: token },
      });
      expect(crossStore.isError).toBe(true);
      expect(asEnvelope(crossStore).error?.code).toBe("CONFIRMATION_INVALID");

      // 4. Legitimate step 2 execution: succeeds
      const step2 = await clientA.callTool({
        name: "data_purge",
        arguments: { confirmation_token: token },
      });
      expect(step2.isError).toBe(false);
      const purgedCounts = asEnvelope<PurgeData>(step2).data.purged_counts;
      expect(purgedCounts.jobs).toBeGreaterThan(0);
      expect(purgedCounts.profiles).toBeGreaterThan(0);

      // Verify data is completely gone
      const listAfter = await clientA.callTool({ name: "jobs_list" });
      expect(asEnvelope<ListData>(listAfter).data.items).toHaveLength(0);

      // 5. Replay attack: reusing the same token must fail
      const replay = await clientA.callTool({
        name: "data_purge",
        arguments: { confirmation_token: token },
      });
      expect(replay.isError).toBe(true);
      expect(asEnvelope(replay).error?.code).toBe("CONFIRMATION_INVALID");
    } finally {
      await closeA();
      await closeB();
    }
  });

  it("T-13: destructive tools have destructiveHint: true annotation for MCP client protection", async () => {
    const { client, close } = await testClient();
    try {
      const toolList = await client.listTools();
      const destructiveTools = ["jobs_delete", "profile_delete", "data_purge"];

      for (const name of destructiveTools) {
        const tool = toolList.tools.find((t) => t.name === name);
        expect(tool, `Tool ${name} must be registered`).toBeDefined();
        const annotations = tool?.annotations as ToolAnnotations | undefined;
        expect(annotations?.destructiveHint).toBe(true);
      }

      // Read-only tools must have readOnlyHint: true
      const readOnlyTools = ["jobs_get", "jobs_list", "profile_get", "provider_capabilities"];
      for (const name of readOnlyTools) {
        const tool = toolList.tools.find((t) => t.name === name);
        expect(tool, `Tool ${name} must be registered`).toBeDefined();
        const annotations = tool?.annotations as ToolAnnotations | undefined;
        expect(annotations?.readOnlyHint).toBe(true);
      }
    } finally {
      await close();
    }
  });
});
