import { describe, expect, it } from "vitest";
import { policy, type Job, type Requirements } from "@jpm/job-core";
import naukriPolicyJson from "../config/naukri-policy.json" with { type: "json" };
import indeedPolicyJson from "../config/indeed-policy.json" with { type: "json" };
import {
  handleApplicationHandoff,
  handleCapabilitiesList,
  handleCvNotes,
  handleFitScore,
  handleInterviewPrep,
  handleJdAnalyze,
} from "../src/tools.js";
import {
  discriminatoryJob,
  injectionJob,
  sampleIndeedJob,
  sampleJob,
  sampleProfile,
} from "./fixtures.js";

const testNaukriPolicy = policy.loadPolicy(naukriPolicyJson, new Date("2026-09-25T00:00:00Z"));
const testIndeedPolicy = policy.loadPolicy(indeedPolicyJson, new Date("2026-09-25T00:00:00Z"));

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected object");
  }
  return value as Record<string, unknown>;
}

describe("Unit Tests — Hosted MCP Tools", () => {
  describe("jd_analyze", () => {
    it("analyzes standard job and normalizes INR salary ₹16,00,000 -> 1600000", () => {
      const res = handleJdAnalyze({ job: sampleJob }, testNaukriPolicy);
      expect(res.isError).toBe(false);
      const data = asRecord(res.structuredContent.data);
      const job = data["job"] as Job;
      const reqs = data["requirements"] as Requirements;
      expect(job.title).toBe("Senior Full Stack Engineer");
      expect(job.compensation.currency).toBe("INR");
      expect(job.compensation.min).toBe(1_600_000);
      expect(job.compensation.max).toBe(2_400_000);
      expect(reqs.must_have.length).toBeGreaterThan(0);
      expect(res.structuredContent.meta.server).toBe("naukri-mcp");
    });

    it("reports Indeed provider and server when run with Indeed policy", () => {
      const res = handleJdAnalyze({ job: sampleIndeedJob }, testIndeedPolicy);
      expect(res.isError).toBe(false);
      expect(res.structuredContent.provider).toBe("indeed");
      expect(res.structuredContent.meta.server).toBe("indeed-mcp");
    });

    it("flags prompt injection with PROMPT_INJECTION_SUSPECTED warning", () => {
      const res = handleJdAnalyze({ job: injectionJob }, testNaukriPolicy);
      const warnings = res.structuredContent.warnings;
      const injectionWarning = warnings.find((w) => w.code === "PROMPT_INJECTION_SUSPECTED");
      expect(injectionWarning).toBeDefined();
    });

    it("extracts discriminatory flags and ensures they are never scored", () => {
      const res = handleJdAnalyze({ job: discriminatoryJob }, testNaukriPolicy);
      const data = asRecord(res.structuredContent.data);
      const flags = data["discriminatory_flags"] as Array<{ text: string }>;
      const reqs = data["requirements"] as Requirements;
      expect(flags.length).toBeGreaterThan(0);

      const allScoredReqs = [
        ...reqs.must_have.map((r) => r.text),
        ...reqs.preferred.map((r) => r.text),
      ];
      for (const flag of flags) {
        expect(allScoredReqs).not.toContain(flag.text);
      }
    });
  });

  describe("fit_score", () => {
    it("computes fit-v1 match score, dimensions, and explanation", () => {
      const res = handleFitScore({ job: sampleJob, profile: sampleProfile }, testNaukriPolicy);
      expect(res.isError).toBe(false);
      const data = asRecord(res.structuredContent.data);
      const score = data["fit_score"] as number;
      const dims = data["dimensions"] as unknown[];
      const explanation = asRecord(data["explanation"]);
      const facts = explanation["summary_facts"] as string[];
      const expDims = explanation["dimensions"] as unknown[];

      expect(data["scoring_version"]).toBe("fit-v1");
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
      expect(dims.length).toBe(7);
      expect(facts.length).toBeGreaterThan(0);
      expect(expDims.length).toBe(7);
    });
  });

  describe("cv_notes", () => {
    it("enforces truthfulness invariant: every evidence text is an exact substring of profile", () => {
      const res = handleCvNotes({ job: sampleJob, profile: sampleProfile }, testNaukriPolicy);
      expect(res.isError).toBe(false);
      const data = asRecord(res.structuredContent.data);
      expect(data["truthfulness_note"]).toBeDefined();

      function getValueByPath(obj: Record<string, unknown>, path: string): string {
        const parts = path.replace(/\]/g, "").split(/[.[]/);
        let curr: unknown = obj;
        for (const p of parts) {
          if (typeof curr === "object" && curr !== null) {
            curr = (curr as Record<string, unknown>)[p];
          }
        }
        return typeof curr === "string" ? curr : "";
      }

      const emphasize = data["emphasize"] as Array<{
        profile_evidence: Array<{ field_path: string; text: string }>;
      }>;

      for (const item of emphasize) {
        for (const ev of item.profile_evidence) {
          const fieldValue = getValueByPath(sampleProfile, ev.field_path);
          expect(fieldValue).toContain(ev.text);
        }
      }
    });

    it("strictly places unproven required skills in do_not_claim", () => {
      const jobRequiringRust = {
        title: "Systems Engineer",
        description: "Must have: 5 years experience in Rust, C++, Kubernetes.",
      };
      const res = handleCvNotes(
        { job: jobRequiringRust, profile: sampleProfile },
        testNaukriPolicy,
      );
      const data = asRecord(res.structuredContent.data);
      const doNotClaim = data["do_not_claim"] as string[];
      expect(doNotClaim.length).toBeGreaterThan(0);
      expect(doNotClaim.some((s) => /rust/i.test(s))).toBe(true);
    });
  });

  describe("interview_prep", () => {
    it("produces deterministic interview plan with question seeds and pointers without URLs", () => {
      const res = handleInterviewPrep({ job: sampleJob, profile: sampleProfile }, testNaukriPolicy);
      expect(res.isError).toBe(false);
      const data = asRecord(res.structuredContent.data);
      const topics = data["topics"] as Array<{ topic: string; study_pointers: string[] }>;
      expect(topics.length).toBeGreaterThan(0);
      for (const topic of topics) {
        expect(topic.topic).toBeDefined();
        for (const pointer of topic.study_pointers) {
          expect(pointer).not.toMatch(/https?:\/\//i);
        }
      }
    });
  });

  describe("application_handoff", () => {
    it("verifies official URL allowlist: true only for its own portal host", () => {
      // Naukri edition: naukri URL is official, indeed URL is NOT
      const naukriRes1 = handleApplicationHandoff({ job: sampleJob }, testNaukriPolicy);
      expect(asRecord(naukriRes1.structuredContent.data)["url_is_official"]).toBe(true);

      const naukriRes2 = handleApplicationHandoff({ job: sampleIndeedJob }, testNaukriPolicy);
      expect(asRecord(naukriRes2.structuredContent.data)["url_is_official"]).toBe(false);

      // Indeed edition: indeed URL is official, naukri URL is NOT
      const indeedRes1 = handleApplicationHandoff({ job: sampleIndeedJob }, testIndeedPolicy);
      expect(asRecord(indeedRes1.structuredContent.data)["url_is_official"]).toBe(true);

      const indeedRes2 = handleApplicationHandoff({ job: sampleJob }, testIndeedPolicy);
      expect(asRecord(indeedRes2.structuredContent.data)["url_is_official"]).toBe(false);
    });

    it("marks unofficial URL appropriately without fetching", () => {
      const unofficialJob = {
        ...sampleJob,
        source_url: "https://some-unverified-board.com/post-99",
      };
      const res = handleApplicationHandoff({ job: unofficialJob }, testNaukriPolicy);
      const data = asRecord(res.structuredContent.data);
      expect(data["url_is_official"]).toBe(false);
    });
  });

  describe("capabilities_list", () => {
    it("lists L0 capabilities enabled and L1+ blocked by provider approval", () => {
      const res = handleCapabilitiesList(testNaukriPolicy);
      expect(res.isError).toBe(false);
      const data = asRecord(res.structuredContent.data);
      const capabilities = data["capabilities"] as Array<{
        level: string;
        status: string;
      }>;
      expect(capabilities.length).toBeGreaterThan(0);

      const l0 = capabilities.find((c) => c.level === "L0");
      expect(l0?.status).toBe("enabled");

      const l1Plus = capabilities.filter((c) => c.level !== "L0");
      for (const cap of l1Plus) {
        expect(["blocked_by_provider_approval", "disabled"]).toContain(cap.status);
      }
    });
  });
});
