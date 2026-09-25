import { describe, expect, it, vi } from "vitest";
import { StoreError } from "../../src/store/index.js";
import { createJobPortalServer } from "../../src/mcp/index.js";
import { testClient, testPolicy, jobInput, profileInput } from "./client.js";

const code = (value: unknown): string | undefined =>
  (value as { error?: { code: string } | null }).error?.code;

describe("tool security boundaries", () => {
  it("denies a disabled analysis capability with a structured error", async () => {
    const { client, close } = await testClient({ policy: testPolicy(false) });
    try {
      const result = await client.callTool({
        name: "jobs_normalize",
        arguments: { job: jobInput },
      });
      expect(result.isError).toBe(true);
      expect(code(result.structuredContent)).toBe("BLOCKED_BY_PROVIDER_APPROVAL");
      expect((result.structuredContent as { data: unknown }).data).toBeNull();
    } finally {
      await close();
    }
  });

  it("uses the same policy-denied envelope for every registered tool", async () => {
    const policy = testPolicy(false);
    const disabled = {
      ...policy,
      capabilities: policy.capabilities.map((item) =>
        item.id === "l0.local_store" ? { ...item, status: "disabled" as const } : item,
      ),
    };
    const { client, close } = await testClient({ policy: disabled });
    const jobId = `job_${crypto.randomUUID()}`;
    const profileId = `prof_${crypto.randomUUID()}`;
    const args: Record<string, Record<string, unknown>> = {
      jobs_ingest: { job: jobInput },
      jobs_normalize: { job: jobInput },
      jobs_get: { job_id: jobId },
      jobs_delete: { job_id: jobId },
      jobs_extract_requirements: { job_id: jobId },
      jobs_application_handoff: { job_id: jobId },
      jobs_compare_profile: { job_id: jobId, profile_id: profileId },
      jobs_explain_match: { job_id: jobId, profile_id: profileId },
      jobs_prepare_cv_notes: { job_id: jobId, profile_id: profileId },
      jobs_prepare_interview: { job_id: jobId, profile_id: profileId },
      jobs_shortlist: { profile_id: profileId },
      jobs_deduplicate: { job_ids: [jobId, `job_${crypto.randomUUID()}`] },
      jobs_search_local: { query: "Java" },
      profile_upsert: { profile: profileInput },
      profile_get: { profile_id: profileId },
      profile_delete: { profile_id: profileId },
    };
    try {
      for (const tool of (await client.listTools()).tools) {
        const result = await client.callTool({ name: tool.name, arguments: args[tool.name] ?? {} });
        expect(result.isError, tool.name).toBe(true);
        expect(["CAPABILITY_DISABLED", "BLOCKED_BY_PROVIDER_APPROVAL"]).toContain(
          code(result.structuredContent),
        );
        expect((result.structuredContent as { data: unknown }).data).toBeNull();
      }
    } finally {
      await close();
    }
  });

  it("never registers provider retrieval and reports L1 blocked", async () => {
    const { client, close } = await testClient();
    try {
      const tools = await client.listTools();
      expect(
        tools.tools.some(
          (tool) =>
            tool.name.startsWith("provider_") &&
            !["provider_capabilities", "provider_policy_status"].includes(tool.name),
        ),
      ).toBe(false);
      const result = await client.callTool({ name: "provider_capabilities", arguments: {} });
      const capabilities = (
        result.structuredContent as { data: { capabilities: { level: string; status: string }[] } }
      ).data.capabilities;
      expect(
        capabilities
          .filter((item) => item.level === "L1")
          .every((item) => item.status === "blocked_by_provider_approval"),
      ).toBe(true);
    } finally {
      await close();
    }
  });

  it("enforces profile XOR and missing IDs", async () => {
    const { client, close } = await testClient();
    try {
      const ingested = await client.callTool({ name: "jobs_ingest", arguments: { job: jobInput } });
      const jobId = (ingested.structuredContent as { data: { job_id: string } }).data.job_id;
      for (const args of [
        { job_id: jobId },
        { job_id: jobId, profile_id: `prof_${crypto.randomUUID()}`, profile: profileInput },
      ]) {
        const result = await client.callTool({ name: "jobs_compare_profile", arguments: args });
        expect(code(result.structuredContent)).toBe("INVALID_INPUT");
      }
      const missing = await client.callTool({
        name: "jobs_compare_profile",
        arguments: { job_id: jobId, profile_id: `prof_${crypto.randomUUID()}` },
      });
      expect(code(missing.structuredContent)).toBe("NOT_FOUND");
      const missingJob = await client.callTool({
        name: "jobs_get",
        arguments: { job_id: `job_${crypto.randomUUID()}` },
      });
      expect(code(missingJob.structuredContent)).toBe("NOT_FOUND");
    } finally {
      await close();
    }
  });

  it("uses inline profiles only in memory", async () => {
    const { client, store, close } = await testClient();
    try {
      const ingested = await client.callTool({ name: "jobs_ingest", arguments: { job: jobInput } });
      const jobId = (ingested.structuredContent as { data: { job_id: string } }).data.job_id;
      const compared = await client.callTool({
        name: "jobs_compare_profile",
        arguments: { job_id: jobId, profile: profileInput },
      });
      expect(
        (compared.structuredContent as { data: { profile_ref: string } }).data.profile_ref,
      ).toBe("inline");
      const shortlist = await client.callTool({
        name: "jobs_shortlist",
        arguments: { profile: profileInput },
      });
      expect(shortlist.isError).toBe(false);
      const richer = {
        ...profileInput,
        skills: [{ name: "Java", years: 4, level: "advanced" }],
        education: [{ qualification: "B.Tech", institution: "University", year: 2018 }],
        certifications: [{ name: "Java", issuer: "Acme", year: 2020 }],
        summary_text: "Built Java services",
        preferences: {
          ...profileInput.preferences,
          min_compensation: { amount: 1000, currency: "INR", period: "month" },
        },
      };
      const notes = await client.callTool({
        name: "jobs_prepare_cv_notes",
        arguments: { job_id: jobId, profile: richer },
      });
      expect(notes.isError).toBe(false);
      expect(store.profiles.count()).toBe(0);
    } finally {
      await close();
    }
  });

  it("maps store and pipeline failures to domain errors", async () => {
    const { client, store, close } = await testClient();
    try {
      const badId = await client.callTool({ name: "jobs_get", arguments: { job_id: "bad" } });
      expect(code(badId.structuredContent)).toBe("INVALID_INPUT");
      const unsafe = await client.callTool({
        name: "jobs_normalize",
        arguments: { job: { ...jobInput, source_url: "http://127.0.0.1/private" } },
      });
      expect(code(unsafe.structuredContent)).toBe("UNSAFE_URL");
      const invalidToken = await client.callTool({
        name: "data_purge",
        arguments: { confirmation_token: "cfm_bad" },
      });
      expect(code(invalidToken.structuredContent)).toBe("CONFIRMATION_INVALID");
      const insert = vi.spyOn(store.jobs, "insert").mockImplementation(() => {
        throw new StoreError("LIMIT_EXCEEDED", "No space");
      });
      try {
        const full = await client.callTool({ name: "jobs_ingest", arguments: { job: jobInput } });
        expect(code(full.structuredContent)).toBe("CONFLICT");
      } finally {
        insert.mockRestore();
      }
      const empty = await client.callTool({ name: "data_export", arguments: {} });
      expect((empty.structuredContent as { warnings: unknown[] }).warnings).toEqual([]);
      const absentDelete = await client.callTool({
        name: "profile_delete",
        arguments: { profile_id: `prof_${crypto.randomUUID()}` },
      });
      expect((absentDelete.structuredContent as { data: { deleted: boolean } }).data.deleted).toBe(
        false,
      );
    } finally {
      await close();
    }
  });

  it("gates agent relay ingest separately", async () => {
    const policy = testPolicy();
    const { client, close } = await testClient({
      policy: {
        ...policy,
        capabilities: policy.capabilities.map((item) =>
          item.id === "l0.agent_relay_ingest" ? { ...item, status: "disabled" } : item,
        ),
      },
    });
    try {
      const denied = await client.callTool({
        name: "jobs_ingest",
        arguments: { job: { ...jobInput, origin: "agent_relay" } },
      });
      expect(code(denied.structuredContent)).toBe("CAPABILITY_DISABLED");
    } finally {
      await close();
    }
  });

  it("refuses a mismatched product policy at startup", async () => {
    const { config, close } = await testClient();
    try {
      expect(() => createJobPortalServer({ ...config, provider: "indeed" })).toThrow();
    } finally {
      await close();
    }
  });

  it("rejects a valid-schema request larger than 256 KB", async () => {
    const { client, close } = await testClient();
    try {
      const role = {
        title: "Engineer",
        company: "Acme",
        start: "2020-01",
        end: "present",
        highlights: Array(20).fill("x".repeat(300)),
      };
      const result = await client.callTool({
        name: "profile_upsert",
        arguments: { profile: { ...profileInput, roles: Array(50).fill(role) } },
      });
      expect(code(result.structuredContent)).toBe("INPUT_TOO_LARGE");
    } finally {
      await close();
    }
  });
});
