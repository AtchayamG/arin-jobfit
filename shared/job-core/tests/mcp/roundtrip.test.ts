import { describe, expect, it } from "vitest";
import { testClient, jobInput, profileInput } from "./client.js";

describe("all MCP tools through the in-memory SDK client", () => {
  it("runs each of the 22 tools on a real local store", async () => {
    const { client, close } = await testClient();
    const called: string[] = [];
    const call = async (name: string, args: Record<string, unknown> = {}) => {
      called.push(name);
      const result = await client.callTool({ name, arguments: args });
      expect(result.structuredContent).toBeDefined();
      expect(result.content).toHaveLength(1);
      return result;
    };
    try {
      await call("provider_capabilities");
      await call("provider_policy_status");
      const normalized = await call("jobs_normalize", { job: jobInput });
      expect(normalized.isError).toBe(false);
      const ingested = await call("jobs_ingest", { job: jobInput });
      expect(ingested.isError).toBe(false);
      const jobId = (ingested.structuredContent as { data: { job_id: string } }).data.job_id;
      const second = await call("jobs_ingest", { job: { ...jobInput, title: "Java Engineer" } });
      const secondId = (second.structuredContent as { data: { job_id: string } }).data.job_id;
      const profile = await call("profile_upsert", { profile: profileInput });
      const profileId = (profile.structuredContent as { data: { profile_id: string } }).data
        .profile_id;
      const subject = { job_id: jobId, profile_id: profileId };
      const get = await call("jobs_get", { job_id: jobId });
      expect(
        (get.structuredContent as { data: { untrusted_description: string | null } }).data
          .untrusted_description,
      ).toBeNull();
      const described = await call("jobs_get", { job_id: jobId, include_description: true });
      expect(
        (described.structuredContent as { data: { untrusted_description: string | null } }).data
          .untrusted_description,
      ).toContain("Requirements");
      await call("jobs_list");
      await call("jobs_search_local", { query: "Java" });
      await call("jobs_extract_requirements", { job_id: jobId });
      await call("jobs_compare_profile", subject);
      await call("jobs_explain_match", subject);
      await call("jobs_shortlist", { profile_id: profileId });
      await call("jobs_deduplicate", { job_ids: [jobId, secondId] });
      await call("jobs_prepare_cv_notes", subject);
      await call("jobs_prepare_interview", subject);
      const handoff = await call("jobs_application_handoff", { job_id: jobId });
      expect(
        (handoff.structuredContent as { human_action_required: unknown }).human_action_required,
      ).not.toBeNull();
      await call("profile_get", { profile_id: profileId });
      await call("profile_upsert", {
        profile: { ...profileInput, headline: "Updated" },
        profile_id: profileId,
      });
      await call("profile_list");
      const exported = await call("data_export");
      expect(exported.isError).toBe(false);
      await call("jobs_delete", { job_id: secondId });
      await call("profile_delete", { profile_id: profileId });
      const challenge = await call("data_purge");
      expect(challenge.isError).toBe(true);
      const token = (challenge.structuredContent as { data: { confirmation_token: string } }).data
        .confirmation_token;
      const purged = await call("data_purge", { confirmation_token: token });
      expect(purged.isError).toBe(false);
      const reused = await call("data_purge", { confirmation_token: token });
      expect((reused.structuredContent as { error: { code: string } }).error.code).toBe(
        "CONFIRMATION_INVALID",
      );
      expect(new Set(called).size).toBe(22);
    } finally {
      await close();
    }
  });
});
