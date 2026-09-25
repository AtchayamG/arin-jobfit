import { describe, expect, it } from "vitest";
import { testClient } from "./client.js";

describe("SDK v2 tool registration", () => {
  it("lists exactly 22 static tools in alphabetical order", async () => {
    const { client, close } = await testClient();
    try {
      const list = await client.listTools();
      expect(list.tools.map((tool) => tool.name)).toEqual([
        "data_export",
        "data_purge",
        "jobs_application_handoff",
        "jobs_compare_profile",
        "jobs_deduplicate",
        "jobs_delete",
        "jobs_explain_match",
        "jobs_extract_requirements",
        "jobs_get",
        "jobs_ingest",
        "jobs_list",
        "jobs_normalize",
        "jobs_prepare_cv_notes",
        "jobs_prepare_interview",
        "jobs_search_local",
        "jobs_shortlist",
        "profile_delete",
        "profile_get",
        "profile_list",
        "profile_upsert",
        "provider_capabilities",
        "provider_policy_status",
      ]);
      expect(list.tools.every((tool) => tool.annotations?.openWorldHint === false)).toBe(true);
    } finally {
      await close();
    }
  });
});
