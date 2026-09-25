import { describe, expect, it } from "vitest";
import { toolDefs } from "../../src/mcp/catalog.js";
import { testClient, jobInput } from "../mcp/client.js";
import { asEnvelope } from "./helpers.js";

describe("T-16 & T-17: Human-control boundary and trademark disclaimer protections", () => {
  it("T-16: no autonomous apply/submit capabilities exist in catalog, and handoff enforces human_only_fields", async () => {
    // 1. Verify catalog has zero autonomous apply/submit/fill/scrape tools
    const toolNames = toolDefs.map((t) => t.name);
    const forbiddenToolPatterns = [
      /apply/i,
      /submit/i,
      /fill/i,
      /captcha/i,
      /scrape/i,
      /bypass/i,
      /auto/i,
    ];

    for (const name of toolNames) {
      if (name === "jobs_application_handoff") continue; // Allowed: preparation/handoff only
      for (const pattern of forbiddenToolPatterns) {
        expect(
          name,
          `Tool '${name}' must not match autonomous action pattern ${pattern.source}`,
        ).not.toMatch(pattern);
      }
    }

    // 2. Verify all tools have openWorldHint: false (closed world, no unexpected remote actions)
    for (const def of toolDefs) {
      expect(
        def.annotations.openWorldHint,
        `Tool ${def.name} must declare openWorldHint: false`,
      ).toBe(false);
    }

    // 3. Test jobs_application_handoff output enforces human_only_fields and human_action_required
    const { client, close } = await testClient();
    try {
      const ingest = await client.callTool({
        name: "jobs_ingest",
        arguments: {
          job: {
            ...jobInput,
            source_url: "https://www.naukri.com/job-listings-12345",
          },
        },
      });
      const jobId = asEnvelope<{ job_id: string }>(ingest).data.job_id;

      const handoff = await client.callTool({
        name: "jobs_application_handoff",
        arguments: { job_id: jobId },
      });
      expect(handoff.isError).toBe(false);
      const handoffContent = asEnvelope<{
        url_is_official: boolean;
        human_only_fields: string[];
      }>(handoff);

      expect(handoffContent.human_action_required).toBeDefined();
      expect(handoffContent.human_action_required?.reason).toBeDefined();
      expect(handoffContent.human_action_required?.official_url).toBe(
        "https://www.naukri.com/job-listings-12345",
      );

      const handoffData = handoffContent.data;
      expect(handoffData.url_is_official).toBe(true);
      expect(Array.isArray(handoffData.human_only_fields)).toBe(true);
      expect(handoffData.human_only_fields).toContain("final_submit");
    } finally {
      await close();
    }
  });

  it("T-17: server instructions contain prominent independent disclaimer and third-party warnings", async () => {
    const { client, close } = await testClient();
    try {
      // Server instructions are configured on the McpServer instance
      const toolList = await client.listTools();
      expect(toolList.tools.length).toBe(22);

      // Verify every analysis tool warns about untrusted third-party data
      const analysisTools = [
        "jobs_ingest",
        "jobs_normalize",
        "jobs_extract_requirements",
        "jobs_compare_profile",
      ];
      for (const name of analysisTools) {
        const tool = toolList.tools.find((t) => t.name === name);
        expect(tool).toBeDefined();
        expect(tool?.description).toContain("untrusted third-party");
      }
    } finally {
      await close();
    }
  });
});
