/**
 * Unit tests for computeFit aggregation, re-normalization, confidence, and deal-breakers.
 */

import { describe, it, expect } from "vitest";
import { createTestJob, createTestRequirements, createTestProfile } from "./fixtures.js";
import { computeFit } from "../../src/match/fit.js";
import { matchResultSchema } from "../../src/schemas/match.js";

describe("computeFit", () => {
  it("computes strong match with high confidence when all dimensions align", () => {
    const job = createTestJob();
    const req = createTestRequirements();
    const profile = createTestProfile({
      preferences: {
        locations: ["Bangalore"],
        remote_modes: ["hybrid"],
        employment_types: ["full_time"],
        deal_breakers: [],
      },
    });

    const skillCategory = (s: string) =>
      ["TypeScript", "Node.js", "Go", "PostgreSQL", "Docker", "Kubernetes", "AWS"].includes(s)
        ? "tech"
        : null;
    const { result, warnings } = computeFit(job, req, profile, { skillCategory });

    expect(result.scoring_version).toBe("fit-v1");
    expect(result.confidence).toBe(1.0);
    expect(result.fit_score).toBeGreaterThanOrEqual(0.75);
    expect(result.band).toBe("strong");
    expect(result.blockers).toEqual([]);
    expect(warnings).toEqual([]);

    // Strict schema check
    expect(() => matchResultSchema.parse(result)).not.toThrow();
  });

  it("excludes unknown dimensions and re-normalizes weights", () => {
    // Leave domain and seniority unknown
    const job = createTestJob({ title: "Custom Role Specialist" }); // no seniority keyword
    const req = createTestRequirements();
    const profile = createTestProfile({
      preferences: {
        locations: ["Bangalore"],
        remote_modes: ["hybrid"],
        employment_types: ["full_time"],
        deal_breakers: [],
      },
    });

    // Without skillCategory, domain is unknown
    const { result } = computeFit(job, req, profile);

    // Known weights: must_have(0.35) + experience(0.20) + preferred(0.10) + location(0.10) + employment(0.05) = 0.80
    expect(result.confidence).toBe(0.8);
    const seniorityDim = result.dimensions.find((d) => d.name === "seniority");
    const domainDim = result.dimensions.find((d) => d.name === "domain");
    expect(seniorityDim?.status).toBe("unknown");
    expect(domainDim?.status).toBe("unknown");
    expect(seniorityDim?.score).toBeNull();
    expect(domainDim?.score).toBeNull();

    // Output schema validation
    expect(() => matchResultSchema.parse(result)).not.toThrow();
  });

  it("emits LOW_CONFIDENCE warning when confidence < 0.60", () => {
    // Only must_have_skills known (weight 0.35)
    const job = createTestJob({
      title: "Ninja Specialist", // seniority unknown
      required_skills: ["TypeScript"],
      preferred_skills: [], // preferred unknown
      experience: { min_years: null, max_years: null, raw: null }, // experience unknown
      location: { raw: null, city: null, country: null }, // location unknown
      remote_mode: "unknown",
      employment_type: "unknown", // employment unknown
    });
    const req = createTestRequirements({
      must_have: [{ text: "TypeScript", skills: ["TypeScript"] }],
      preferred: [],
      experience: { min_years: null, max_years: null, raw: null },
      location: { raw: null, city: null, country: null },
      remote_mode: "unknown",
      employment_type: "unknown",
    });
    const profile = createTestProfile({
      preferences: { locations: [], remote_modes: [], employment_types: [], deal_breakers: [] },
    });

    const { result, warnings } = computeFit(job, req, profile);
    expect(result.confidence).toBe(0.35);
    expect(warnings.some((w) => w.code === "LOW_CONFIDENCE")).toBe(true);
    expect(() => matchResultSchema.parse(result)).not.toThrow();
  });

  it("handles case where all dimensions are unknown (confidence 0, score 0)", () => {
    const job = createTestJob({
      title: "Ninja Specialist",
      required_skills: [],
      preferred_skills: [],
      experience: { min_years: null, max_years: null, raw: null },
      location: { raw: null, city: null, country: null },
      remote_mode: "unknown",
      employment_type: "unknown",
    });
    const req = createTestRequirements({
      must_have: [],
      preferred: [],
      experience: { min_years: null, max_years: null, raw: null },
      location: { raw: null, city: null, country: null },
      remote_mode: "unknown",
      employment_type: "unknown",
    });
    const profile = createTestProfile({
      preferences: { locations: [], remote_modes: [], employment_types: [], deal_breakers: [] },
    });

    const { result, warnings } = computeFit(job, req, profile);
    expect(result.confidence).toBe(0);
    expect(result.fit_score).toBe(0);
    expect(result.band).toBe("weak");
    expect(warnings.some((w) => w.code === "LOW_CONFIDENCE")).toBe(true);
    expect(() => matchResultSchema.parse(result)).not.toThrow();
  });

  it("caps score at 0.30 and adds blockers when deal-breaker matches", () => {
    const job = createTestJob({
      title: "Senior Crypto Platform Engineer",
      description: "Building high-performance blockchain and crypto infrastructure.",
    });
    const req = createTestRequirements();
    const profile = createTestProfile({
      preferences: {
        locations: ["Bangalore"],
        remote_modes: ["hybrid"],
        employment_types: ["full_time"],
        deal_breakers: ["crypto", "blockchain", "  "], // whitespace deal-breaker should be ignored
      },
    });

    const { result } = computeFit(job, req, profile);
    expect(result.blockers.length).toBeGreaterThanOrEqual(1);
    expect(result.blockers.some((b) => b.includes("crypto"))).toBe(true);
    expect(result.fit_score).toBeLessThanOrEqual(0.3);
    expect(result.band).toBe("weak");
    expect(() => matchResultSchema.parse(result)).not.toThrow();
  });

  it("evaluates deal-breakers across requirements constraints and responsibilities", () => {
    const job = createTestJob({
      title: "Senior Engineer",
      description: "Standard job description.",
    });
    const req = createTestRequirements({
      constraints: [{ kind: "shift", text: "Requires mandatory night shift rotation" }],
    });
    const profile = createTestProfile({
      preferences: {
        locations: ["Bangalore"],
        remote_modes: ["hybrid"],
        employment_types: ["full_time"],
        deal_breakers: ["night shift"],
      },
    });

    const { result } = computeFit(job, req, profile);
    expect(result.blockers.some((b) => b.includes("night shift"))).toBe(true);
    expect(result.fit_score).toBeLessThanOrEqual(0.3);
  });

  it("is strictly deterministic", () => {
    const job = createTestJob();
    const req = createTestRequirements();
    const profile = createTestProfile();

    const first = computeFit(job, req, profile);
    for (let i = 0; i < 20; i++) {
      const next = computeFit(job, req, profile);
      expect(JSON.stringify(next)).toBe(JSON.stringify(first));
    }
  });

  it("defaults profile_ref to inline when profile_id is empty", () => {
    const job = createTestJob();
    const req = createTestRequirements();
    const profile = createTestProfile();
    const inlineProfile = { ...profile, profile_id: "" as never };

    const { result } = computeFit(job, req, inlineProfile);
    expect(result.profile_ref).toBe("inline");
  });
});
