/**
 * Unit tests for skill-based fit-v1 dimensions (must-have, preferred, domain).
 */

import { describe, it, expect } from "vitest";
import { createTestJob, createTestRequirements, createTestProfile } from "./fixtures.js";
import {
  calculateMustHaveSkills,
  calculatePreferredSkills,
  calculateDomain,
} from "../../src/match/dimensions.js";

describe("skill-based dimension calculations", () => {
  describe("must_have_skills", () => {
    it("returns unknown when no skills in requirements or job", () => {
      const job = createTestJob({ required_skills: [] });
      const req = createTestRequirements({ must_have: [] });
      const profile = createTestProfile();

      const dim = calculateMustHaveSkills(job, req, profile);
      expect(dim.status).toBe("unknown");
      expect(dim.score).toBeNull();
      expect(dim.weight).toBe(0.35);
      expect(dim.evidence).toEqual([]);
      expect(dim.gaps).toEqual([]);
    });

    it("falls back to job.required_skills when requirements.must_have is empty", () => {
      const job = createTestJob({ required_skills: ["TypeScript", "Node.js"] });
      const req = createTestRequirements({ must_have: [] });
      const profile = createTestProfile({
        skills: [{ name: "TypeScript", years: 2, level: "intermediate" }],
        roles: [],
      });

      const dim = calculateMustHaveSkills(job, req, profile);
      expect(dim.status).toBe("partial");
      expect(dim.score).toBe(0.5);
      expect(dim.evidence).toEqual(["TypeScript"]);
      expect(dim.gaps).toEqual(["Node.js"]);
    });

    it("computes exact matched, partial, and missing statuses", () => {
      const job = createTestJob();
      const req = createTestRequirements({
        must_have: [{ text: "Core skills", skills: ["TypeScript", "Node.js"] }],
      });

      // 1. Matched (100%)
      const profMatched = createTestProfile({
        skills: [
          { name: "TypeScript", years: 4, level: "expert" },
          { name: "Node.js", years: 4, level: "expert" },
        ],
        roles: [],
      });
      const resMatched = calculateMustHaveSkills(job, req, profMatched);
      expect(resMatched.status).toBe("matched");
      expect(resMatched.score).toBe(1);
      expect(resMatched.evidence).toEqual(["TypeScript", "Node.js"]);
      expect(resMatched.gaps).toEqual([]);

      // 2. Partial (50%)
      const profPartial = createTestProfile({
        skills: [{ name: "TypeScript", years: 4, level: "expert" }],
        roles: [],
      });
      const resPartial = calculateMustHaveSkills(job, req, profPartial);
      expect(resPartial.status).toBe("partial");
      expect(resPartial.score).toBe(0.5);

      // 3. Missing (0%)
      const profMissing = createTestProfile({
        skills: [{ name: "Python", years: 4, level: "expert" }],
        roles: [],
      });
      const resMissing = calculateMustHaveSkills(job, req, profMissing);
      expect(resMissing.status).toBe("missing");
      expect(resMissing.score).toBe(0);
      expect(resMissing.evidence).toEqual([]);
      expect(resMissing.gaps).toEqual(["TypeScript", "Node.js"]);
    });
  });

  describe("preferred_skills", () => {
    it("returns unknown when preferred skills are absent in requirements and job", () => {
      const job = createTestJob({ preferred_skills: [] });
      const req = createTestRequirements({ preferred: [] });
      const profile = createTestProfile();

      const dim = calculatePreferredSkills(job, req, profile);
      expect(dim.status).toBe("unknown");
      expect(dim.score).toBeNull();
      expect(dim.weight).toBe(0.1);
    });

    it("evaluates preferred skills correctly", () => {
      const job = createTestJob({ preferred_skills: ["AWS", "Docker"] });
      const req = createTestRequirements({ preferred: [] });
      const profile = createTestProfile({
        skills: [{ name: "Docker", years: 2, level: "intermediate" }],
        roles: [],
      });

      const dim = calculatePreferredSkills(job, req, profile);
      expect(dim.status).toBe("partial");
      expect(dim.score).toBe(0.5);
    });

    it("evaluates preferred skills matched and missing statuses", () => {
      const job = createTestJob({ preferred_skills: ["AWS"] });
      const req = createTestRequirements({ preferred: [] });

      // Matched
      const profMatched = createTestProfile({
        skills: [{ name: "AWS", years: 2, level: "intermediate" }],
        roles: [],
      });
      expect(calculatePreferredSkills(job, req, profMatched).status).toBe("matched");

      // Missing
      const profMissing = createTestProfile({ skills: [], roles: [] });
      expect(calculatePreferredSkills(job, req, profMissing).status).toBe("missing");
    });
  });

  describe("domain", () => {
    it("returns unknown when skillCategory is undefined", () => {
      const job = createTestJob();
      const req = createTestRequirements();
      const profile = createTestProfile();

      const dim = calculateDomain(job, req, profile, undefined);
      expect(dim.status).toBe("unknown");
      expect(dim.score).toBeNull();
    });

    it("returns unknown when job has 0 domain-categorized skills", () => {
      const job = createTestJob({ required_skills: ["SkillA"], preferred_skills: [] });
      const req = createTestRequirements({ must_have: [], preferred: [] });
      const profile = createTestProfile();
      const skillCat = () => null;

      const dim = calculateDomain(job, req, profile, skillCat);
      expect(dim.status).toBe("unknown");
      expect(dim.score).toBeNull();
    });

    it("computes domain skill overlap score", () => {
      const job = createTestJob({ required_skills: ["AWS", "Kubernetes", "Docker"] });
      const req = createTestRequirements({ must_have: [], preferred: [] });
      const skillCat = (s: string) =>
        ["AWS", "Kubernetes", "Docker"].includes(s) ? "cloud" : null;

      // Profile has AWS and Docker, missing Kubernetes
      const profile = createTestProfile({
        skills: [
          { name: "AWS", years: 2, level: "intermediate" },
          { name: "Docker", years: 2, level: "intermediate" },
        ],
        roles: [],
      });

      const dim = calculateDomain(job, req, profile, skillCat);
      expect(dim.status).toBe("partial");
      expect(dim.score).toBeCloseTo(2 / 3);
      expect(dim.evidence).toEqual(["AWS (cloud)", "Docker (cloud)"]);
      expect(dim.gaps).toEqual(["Kubernetes (cloud)"]);
    });

    it("evaluates domain matched and missing statuses", () => {
      const job = createTestJob({ required_skills: ["AWS"] });
      const req = createTestRequirements({ must_have: [], preferred: [] });
      const skillCat = (s: string) => (s === "AWS" ? "cloud" : null);

      // 1. Matched
      const profMatched = createTestProfile({
        skills: [{ name: "AWS", years: 2, level: "expert" }],
        roles: [],
      });
      const resMatched = calculateDomain(job, req, profMatched, skillCat);
      expect(resMatched.status).toBe("matched");
      expect(resMatched.score).toBe(1);

      // 2. Missing
      const profMissing = createTestProfile({ skills: [], roles: [] });
      const resMissing = calculateDomain(job, req, profMissing, skillCat);
      expect(resMissing.status).toBe("missing");
      expect(resMissing.score).toBe(0);
    });
  });
});
