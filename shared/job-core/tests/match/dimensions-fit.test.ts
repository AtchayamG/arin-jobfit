/**
 * Unit tests for attribute-based fit-v1 dimensions (experience, seniority, location_remote, employment_type).
 */

import { describe, it, expect } from "vitest";
import { createTestJob, createTestRequirements, createTestProfile } from "./fixtures.js";
import {
  calculateExperience,
  calculateSeniority,
  calculateLocationRemote,
  calculateEmploymentType,
} from "../../src/match/dimensions.js";

describe("attribute-based dimension calculations", () => {
  describe("experience", () => {
    it("returns unknown when both job experience bounds are null", () => {
      const job = createTestJob({ experience: { min_years: null, max_years: null, raw: null } });
      const req = createTestRequirements({
        experience: { min_years: null, max_years: null, raw: null },
      });
      const profile = createTestProfile({ total_experience_years: 5 });

      const dim = calculateExperience(job, req, profile);
      expect(dim.status).toBe("unknown");
      expect(dim.score).toBeNull();
      expect(dim.weight).toBe(0.2);
    });

    it("scores 1.0 when candidate is within [min, max]", () => {
      const job = createTestJob({ experience: { min_years: 5, max_years: 10, raw: "5-10" } });
      const req = createTestRequirements({
        experience: { min_years: 5, max_years: 10, raw: "5-10" },
      });

      for (const y of [5, 7, 10]) {
        const profile = createTestProfile({ total_experience_years: y });
        const dim = calculateExperience(job, req, profile);
        expect(dim.status).toBe("matched");
        expect(dim.score).toBe(1);
      }
    });

    it("evaluates below minimum graded formula: max(0, 1 - (min - y)/max(min, 1))", () => {
      const job = createTestJob({ experience: { min_years: 5, max_years: 10, raw: null } });
      const req = createTestRequirements({
        experience: { min_years: 5, max_years: 10, raw: null },
      });

      // y = 4 -> 1 - (5-4)/5 = 0.8
      expect(
        calculateExperience(job, req, createTestProfile({ total_experience_years: 4 })).score,
      ).toBeCloseTo(0.8);
      // y = 0 -> 1 - (5-0)/5 = 0
      expect(
        calculateExperience(job, req, createTestProfile({ total_experience_years: 0 })).score,
      ).toBe(0);

      // min = 0 boundary check (max(min, 1))
      const zeroMinJob = createTestJob({ experience: { min_years: 0, max_years: 2, raw: null } });
      const zeroMinReq = createTestRequirements({
        experience: { min_years: 0, max_years: 2, raw: null },
      });
      expect(
        calculateExperience(
          zeroMinJob,
          zeroMinReq,
          createTestProfile({ total_experience_years: 0 }),
        ).score,
      ).toBe(1);
    });

    it("evaluates above maximum by <= 2 years (1.0) and > 2 years graded", () => {
      const job = createTestJob({ experience: { min_years: 3, max_years: 5, raw: null } });
      const req = createTestRequirements({ experience: { min_years: 3, max_years: 5, raw: null } });

      // y = 6 (over by 1 <= 2) -> 1.0
      expect(
        calculateExperience(job, req, createTestProfile({ total_experience_years: 6 })).score,
      ).toBe(1);
      // y = 7 (over by 2 <= 2) -> 1.0
      expect(
        calculateExperience(job, req, createTestProfile({ total_experience_years: 7 })).score,
      ).toBe(1);
      // y = 8 (over by 3 > 2): 1 - (8 - 5 - 2)*0.1 = 1 - 0.1 = 0.9
      expect(
        calculateExperience(job, req, createTestProfile({ total_experience_years: 8 })).score,
      ).toBeCloseTo(0.9);
      // y = 14 (over by 9 > 2): max(0.5, 1 - 0.7) = 0.5
      expect(
        calculateExperience(job, req, createTestProfile({ total_experience_years: 14 })).score,
      ).toBe(0.5);
    });

    it("handles min only and max only scenarios", () => {
      // min only: min = 5, max = null
      const minOnlyJob = createTestJob({
        experience: { min_years: 5, max_years: null, raw: null },
      });
      const minOnlyReq = createTestRequirements({
        experience: { min_years: 5, max_years: null, raw: null },
      });
      const profAboveMin = createTestProfile({ total_experience_years: 7 });
      const profBelowMin = createTestProfile({ total_experience_years: 3 });

      const resAbove = calculateExperience(minOnlyJob, minOnlyReq, profAboveMin);
      expect(resAbove.score).toBe(1);
      expect(resAbove.evidence[0]).toContain("any");

      const resBelow = calculateExperience(minOnlyJob, minOnlyReq, profBelowMin);
      expect(resBelow.score).toBeCloseTo(0.6);
      expect(resBelow.gaps[0]).toContain("below minimum");

      // max only: min = null, max = 5
      const maxOnlyJob = createTestJob({
        experience: { min_years: null, max_years: 5, raw: null },
      });
      const maxOnlyReq = createTestRequirements({
        experience: { min_years: null, max_years: 5, raw: null },
      });
      const profBelowMax = createTestProfile({ total_experience_years: 3 });
      const profAboveMax = createTestProfile({ total_experience_years: 10 });

      expect(calculateExperience(maxOnlyJob, maxOnlyReq, profBelowMax).score).toBe(1);
      const resOver = calculateExperience(maxOnlyJob, maxOnlyReq, profAboveMax);
      expect(resOver.score).toBeLessThan(1);
      expect(resOver.gaps[0]).toContain("exceeds maximum");
    });
  });

  describe("seniority", () => {
    it("returns unknown when no seniority keywords in job title", () => {
      const job = createTestJob({ title: "Ninja FullStack Rockstar" });
      const profile = createTestProfile({ total_experience_years: 5 });

      const dim = calculateSeniority(job, profile);
      expect(dim.status).toBe("unknown");
      expect(dim.score).toBeNull();
      expect(dim.weight).toBe(0.1);
    });

    it("picks highest keyword level present in job title", () => {
      // "Lead Developer" -> Developer is level 2, Lead is level 4 -> picks 4
      const job = createTestJob({ title: "Lead Software Developer" });
      // Profile has 12 years -> level 4 (<15)
      const profile = createTestProfile({ total_experience_years: 12 });

      const dim = calculateSeniority(job, profile);
      expect(dim.status).toBe("matched");
      expect(dim.score).toBe(1);
    });

    it("computes difference score according to formula max(0, 1 - 0.34 * |diff|)", () => {
      // Job title: "Senior Engineer" -> Senior (3), Engineer (2) -> picks 3
      const job = createTestJob({ title: "Senior Software Engineer" });

      // Profile y=0 (<1) -> level 0. diff = |0 - 3| = 3. max(0, 1 - 1.02) = 0.
      expect(calculateSeniority(job, createTestProfile({ total_experience_years: 0 })).score).toBe(
        0,
      );

      // Profile y=2 (<3) -> level 1. diff = |1 - 3| = 2. max(0, 1 - 0.68) = 0.32.
      expect(
        calculateSeniority(job, createTestProfile({ total_experience_years: 2 })).score,
      ).toBeCloseTo(0.32);

      // Profile y=5 (<6) -> level 2. diff = |2 - 3| = 1. max(0, 1 - 0.34) = 0.66.
      expect(
        calculateSeniority(job, createTestProfile({ total_experience_years: 5 })).score,
      ).toBeCloseTo(0.66);

      // Profile y=8 (<10) -> level 3. diff = 0. score = 1.0.
      expect(calculateSeniority(job, createTestProfile({ total_experience_years: 8 })).score).toBe(
        1,
      );

      // Profile y=14 (<15) -> level 4. diff = 1. score = 0.66.
      expect(
        calculateSeniority(job, createTestProfile({ total_experience_years: 14 })).score,
      ).toBeCloseTo(0.66);

      // Profile y=20 (>=15) -> level 5. diff = 2. score = 0.32.
      expect(
        calculateSeniority(job, createTestProfile({ total_experience_years: 20 })).score,
      ).toBeCloseTo(0.32);
    });
  });

  describe("location_remote", () => {
    it("returns unknown when profile has no locations and no remote preference", () => {
      const job = createTestJob({
        location: { raw: "Mumbai", city: "Mumbai", country: "IN" },
        remote_mode: "onsite",
      });
      const profile = createTestProfile({
        preferences: {
          locations: [],
          remote_modes: [],
          employment_types: ["full_time"],
          deal_breakers: [],
        },
      });

      const dim = calculateLocationRemote(job, profile);
      expect(dim.status).toBe("unknown");
      expect(dim.score).toBeNull();
    });

    it("returns unknown when job has no city and remote_mode is unknown", () => {
      const job = createTestJob({
        location: { raw: null, city: null, country: null },
        remote_mode: "unknown",
      });
      const profile = createTestProfile({
        preferences: {
          locations: ["Bangalore"],
          remote_modes: ["remote"],
          employment_types: ["full_time"],
          deal_breakers: [],
        },
      });

      const dim = calculateLocationRemote(job, profile);
      expect(dim.status).toBe("unknown");
      expect(dim.score).toBeNull();
    });

    it("scores 1.0 for remote job with remote preference", () => {
      const job = createTestJob({
        location: { raw: null, city: null, country: null },
        remote_mode: "remote",
      });
      const profile = createTestProfile({
        preferences: {
          locations: [],
          remote_modes: ["remote"],
          employment_types: ["full_time"],
          deal_breakers: [],
        },
      });

      const dim = calculateLocationRemote(job, profile);
      expect(dim.status).toBe("matched");
      expect(dim.score).toBe(1);
    });

    it("scores 1.0 for city match (case-insensitive)", () => {
      const job = createTestJob({
        location: { raw: "bAnGaLoRe, India", city: "Bangalore", country: "IN" },
        remote_mode: "onsite",
      });
      const profile = createTestProfile({
        preferences: {
          locations: ["bangalore"],
          remote_modes: ["onsite"],
          employment_types: ["full_time"],
          deal_breakers: [],
        },
      });

      const dim = calculateLocationRemote(job, profile);
      expect(dim.status).toBe("matched");
      expect(dim.score).toBe(1);
    });

    it("scores 0.5 for accepted remote mode but different city", () => {
      const job = createTestJob({
        location: { raw: "Pune", city: "Pune", country: "IN" },
        remote_mode: "hybrid",
      });
      const profile = createTestProfile({
        preferences: {
          locations: ["Bangalore"],
          remote_modes: ["hybrid"],
          employment_types: ["full_time"],
          deal_breakers: [],
        },
      });

      const dim = calculateLocationRemote(job, profile);
      expect(dim.status).toBe("partial");
      expect(dim.score).toBe(0.5);
    });

    it("scores 0 for incompatible location and remote preference", () => {
      const job = createTestJob({
        location: { raw: "Delhi", city: "Delhi", country: "IN" },
        remote_mode: "onsite",
      });
      const profile = createTestProfile({
        preferences: {
          locations: ["Bangalore"],
          remote_modes: ["remote"],
          employment_types: ["full_time"],
          deal_breakers: [],
        },
      });

      const dim = calculateLocationRemote(job, profile);
      expect(dim.status).toBe("missing");
      expect(dim.score).toBe(0);
    });

    it("formats gaps when remote job has no city and does not match preferences", () => {
      const job = createTestJob({
        location: { raw: null, city: null, country: null },
        remote_mode: "onsite",
      });
      const profile = createTestProfile({
        preferences: {
          locations: ["Bangalore"],
          remote_modes: ["remote"],
          employment_types: ["full_time"],
          deal_breakers: [],
        },
      });

      const dim = calculateLocationRemote(job, profile);
      expect(dim.status).toBe("missing");
      expect(dim.gaps[0]).toContain("unspecified");
    });
  });

  describe("employment_type", () => {
    it("returns unknown when job employment_type is unknown or profile has no preference", () => {
      const job = createTestJob({ employment_type: "unknown" });
      const profile = createTestProfile();
      expect(calculateEmploymentType(job, profile).status).toBe("unknown");

      const validJob = createTestJob({ employment_type: "full_time" });
      const noPrefProfile = createTestProfile({
        preferences: { locations: [], remote_modes: [], employment_types: [], deal_breakers: [] },
      });
      expect(calculateEmploymentType(validJob, noPrefProfile).status).toBe("unknown");
    });

    it("scores 1.0 on match and 0 on mismatch", () => {
      const job = createTestJob({ employment_type: "contract" });
      const profileMatch = createTestProfile({
        preferences: {
          locations: [],
          remote_modes: [],
          employment_types: ["contract", "full_time"],
          deal_breakers: [],
        },
      });
      expect(calculateEmploymentType(job, profileMatch).score).toBe(1);

      const profileMismatch = createTestProfile({
        preferences: {
          locations: [],
          remote_modes: [],
          employment_types: ["part_time"],
          deal_breakers: [],
        },
      });
      expect(calculateEmploymentType(job, profileMismatch).score).toBe(0);
    });
  });
});
