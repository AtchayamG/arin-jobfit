/**
 * Unit tests for shortlist ranking, tie-breaking, and limit clamping.
 */

import { describe, it, expect } from "vitest";
import { createTestJob, createTestRequirements, createTestProfile } from "./fixtures.js";
import { shortlist, getDimensionReason } from "../../src/match/shortlist.js";

describe("shortlist", () => {
  it("ranks jobs by fit_score descending", () => {
    const profile = createTestProfile({
      skills: [{ name: "TypeScript", years: 5, level: "expert" }],
      roles: [],
      preferences: {
        locations: ["Bangalore"],
        remote_modes: ["hybrid"],
        employment_types: ["full_time"],
        deal_breakers: [],
      },
    });

    const jobHigh = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000001",
      required_skills: ["TypeScript"],
      preferred_skills: [],
    });
    const reqHigh = createTestRequirements({
      job_id: jobHigh.job_id,
      must_have: [{ text: "TypeScript", skills: ["TypeScript"] }],
      preferred: [],
    });

    const jobLow = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000002",
      required_skills: ["Ruby", "Scala"],
      preferred_skills: [],
    });
    const reqLow = createTestRequirements({
      job_id: jobLow.job_id,
      must_have: [{ text: "Ruby", skills: ["Ruby", "Scala"] }],
      preferred: [],
    });

    const { ranked } = shortlist(
      [
        { job: jobLow, requirements: reqLow },
        { job: jobHigh, requirements: reqHigh },
      ],
      profile,
    );

    expect(ranked.length).toBe(2);
    expect(ranked[0]?.job_id).toBe(jobHigh.job_id);
    expect(ranked[1]?.job_id).toBe(jobLow.job_id);
    expect(ranked[0]?.fit_score).toBeGreaterThan(ranked[1]?.fit_score ?? 0);
  });

  it("breaks score ties by job_id ascending", () => {
    const profile = createTestProfile();

    const jobB = createTestJob({
      job_id: "job_00000000-0000-4000-8000-00000000000b",
      title: "Senior Backend Engineer",
    });
    const reqB = createTestRequirements({ job_id: jobB.job_id });

    const jobA = createTestJob({
      job_id: "job_00000000-0000-4000-8000-00000000000a",
      title: "Senior Backend Engineer",
    });
    const reqA = createTestRequirements({ job_id: jobA.job_id });

    // Pass B first, then A
    const { ranked } = shortlist(
      [
        { job: jobB, requirements: reqB },
        { job: jobA, requirements: reqA },
      ],
      profile,
    );

    expect(ranked[0]?.fit_score).toBe(ranked[1]?.fit_score);
    // Alphabetically 'a' comes before 'b'
    expect(ranked[0]?.job_id).toBe(jobA.job_id);
    expect(ranked[1]?.job_id).toBe(jobB.job_id);
  });

  it("enforces limit and clamps to maximum 50", () => {
    const profile = createTestProfile();
    const items = Array.from({ length: 60 }, (_, i) => {
      const hex = i.toString(16).padStart(12, "0");
      const job = createTestJob({
        job_id: `job_00000000-0000-4000-8000-${hex}`,
      });
      const req = createTestRequirements({ job_id: job.job_id });
      return { job, requirements: req };
    });

    // Custom limit 5
    const res5 = shortlist(items, profile, { limit: 5 });
    expect(res5.ranked.length).toBe(5);

    // Limit over 50 is clamped to 50
    const resDefault = shortlist(items, profile, { limit: 100 });
    expect(resDefault.ranked.length).toBe(50);
  });

  it("includes up to 3 top reasons", () => {
    const profile = createTestProfile();
    const job = createTestJob();
    const req = createTestRequirements();

    const { ranked } = shortlist([{ job, requirements: req }], profile);
    expect(ranked[0]?.top_reasons.length).toBeGreaterThan(0);
    expect(ranked[0]?.top_reasons.length).toBeLessThanOrEqual(3);
  });

  it("stops collecting top reasons when 3 reasons are reached", () => {
    const profile = createTestProfile();
    const job = createTestJob();
    const req = createTestRequirements();
    const skillCategory = () => "tech";

    const { ranked } = shortlist([{ job, requirements: req }], profile, { skillCategory });
    expect(ranked[0]?.top_reasons.length).toBe(3);
  });

  describe("getDimensionReason", () => {
    it("returns null for score null or non-positive", () => {
      expect(
        getDimensionReason({
          name: "must_have_skills",
          weight: 0.35,
          score: null,
          status: "unknown",
          evidence: [],
          gaps: [],
        }),
      ).toBeNull();
      expect(
        getDimensionReason({
          name: "must_have_skills",
          weight: 0.35,
          score: 0,
          status: "missing",
          evidence: [],
          gaps: [],
        }),
      ).toBeNull();
    });

    it("returns appropriate reasons across all dimensions", () => {
      // must_have with and without evidence
      expect(
        getDimensionReason({
          name: "must_have_skills",
          weight: 0.35,
          score: 1,
          status: "matched",
          evidence: ["TS", "Node"],
          gaps: [],
        }),
      ).toBe("Must-have skills matched: TS, Node");
      expect(
        getDimensionReason({
          name: "must_have_skills",
          weight: 0.35,
          score: 1,
          status: "matched",
          evidence: [],
          gaps: [],
        }),
      ).toBe("Must-have skills matched");

      // experience
      expect(
        getDimensionReason({
          name: "experience",
          weight: 0.2,
          score: 1,
          status: "matched",
          evidence: [],
          gaps: [],
        }),
      ).toBe("Experience requirement matched");

      // preferred_skills with and without evidence
      expect(
        getDimensionReason({
          name: "preferred_skills",
          weight: 0.1,
          score: 1,
          status: "matched",
          evidence: ["Docker"],
          gaps: [],
        }),
      ).toBe("Preferred skills matched: Docker");
      expect(
        getDimensionReason({
          name: "preferred_skills",
          weight: 0.1,
          score: 1,
          status: "matched",
          evidence: [],
          gaps: [],
        }),
      ).toBe("Preferred skills matched");

      // seniority
      expect(
        getDimensionReason({
          name: "seniority",
          weight: 0.1,
          score: 1,
          status: "matched",
          evidence: [],
          gaps: [],
        }),
      ).toBe("Seniority level aligned");

      // location_remote
      expect(
        getDimensionReason({
          name: "location_remote",
          weight: 0.1,
          score: 1,
          status: "matched",
          evidence: [],
          gaps: [],
        }),
      ).toBe("Location and remote preference aligned");

      // employment_type
      expect(
        getDimensionReason({
          name: "employment_type",
          weight: 0.05,
          score: 1,
          status: "matched",
          evidence: [],
          gaps: [],
        }),
      ).toBe("Employment type matched");

      // domain with and without evidence
      expect(
        getDimensionReason({
          name: "domain",
          weight: 0.1,
          score: 1,
          status: "matched",
          evidence: ["Cloud"],
          gaps: [],
        }),
      ).toBe("Domain expertise matched: Cloud");
      expect(
        getDimensionReason({
          name: "domain",
          weight: 0.1,
          score: 1,
          status: "matched",
          evidence: [],
          gaps: [],
        }),
      ).toBe("Domain expertise matched");

      // unknown dimension
      expect(
        getDimensionReason({
          name: "invalid" as never,
          weight: 0.1,
          score: 1,
          status: "matched",
          evidence: [],
          gaps: [],
        }),
      ).toBeNull();
    });
  });
});
