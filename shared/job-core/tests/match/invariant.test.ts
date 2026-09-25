/**
 * Invariant test: T-09 Non-discrimination invariant.
 * requirements.discriminatory_flags and any flagged text must never affect the match score.
 */

import { describe, it, expect } from "vitest";
import { createTestJob, createTestRequirements, createTestProfile } from "./fixtures.js";
import { computeFit } from "../../src/match/fit.js";

describe("T-09 Discriminatory Flag Invariance", () => {
  it("produces identical MatchResult and warnings regardless of discriminatory flags", () => {
    const job = createTestJob();
    const cleanRequirements = createTestRequirements({
      discriminatory_flags: [],
    });

    const flaggedRequirements = createTestRequirements({
      discriminatory_flags: [
        { text: "Female candidates only", category: "gender" },
        { text: "Age must be under 30", category: "age" },
        { text: "Only candidates of specific community", category: "religion" },
        { text: "No physical disabilities accepted", category: "disability" },
        { text: "Single unmarried applicants only", category: "marital_status" },
      ],
    });

    const profile = createTestProfile();
    const skillCategory = (s: string) => (s === "TypeScript" ? "language" : null);

    const cleanOutcome = computeFit(job, cleanRequirements, profile, {
      profileRef: "prof_00000000-0000-4000-8000-000000000001",
      skillCategory,
    });

    const flaggedOutcome = computeFit(job, flaggedRequirements, profile, {
      profileRef: "prof_00000000-0000-4000-8000-000000000001",
      skillCategory,
    });

    // Score, confidence, band, dimensions, blockers, and warnings must be exactly equal
    expect(flaggedOutcome.result.fit_score).toBe(cleanOutcome.result.fit_score);
    expect(flaggedOutcome.result.confidence).toBe(cleanOutcome.result.confidence);
    expect(flaggedOutcome.result.band).toBe(cleanOutcome.result.band);
    expect(flaggedOutcome.result.blockers).toEqual(cleanOutcome.result.blockers);
    expect(flaggedOutcome.result.dimensions).toEqual(cleanOutcome.result.dimensions);
    expect(flaggedOutcome.warnings).toEqual(cleanOutcome.warnings);
    expect(JSON.stringify(flaggedOutcome)).toBe(JSON.stringify(cleanOutcome));
  });
});
