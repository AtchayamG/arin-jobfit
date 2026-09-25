import { describe, expect, it } from "vitest";
import { matchDimensionSchema, matchResultSchema } from "../../src/schemas/index.js";

const dimension = {
  name: "must_have_skills",
  weight: 0.35,
  score: 1,
  status: "matched",
  evidence: ["TypeScript"],
  gaps: [],
};

describe("match contract", () => {
  it("validates dimensions and the fixed result fields", () => {
    expect(matchDimensionSchema.safeParse(dimension).success).toBe(true);
    expect(
      matchDimensionSchema.safeParse({ ...dimension, status: "unknown", score: null }).success,
    ).toBe(true);
    expect(matchDimensionSchema.safeParse({ ...dimension, status: "unknown" }).success).toBe(false);
    expect(matchDimensionSchema.safeParse({ ...dimension, score: null }).success).toBe(false);
    const result = {
      job_id: "job_76aff94c-40f0-4283-9d6c-7644a636d020",
      profile_ref: "inline",
      scoring_version: "fit-v1",
      fit_score: 0.75,
      band: "strong",
      confidence: 0.9,
      dimensions: [dimension, dimension, dimension, dimension, dimension, dimension, dimension],
      blockers: [],
      disclaimer: "Decision support only; not a prediction of hiring outcome.",
    };
    expect(matchResultSchema.safeParse(result).success).toBe(true);
    expect(matchDimensionSchema.safeParse({ ...dimension, unexpected: true }).success).toBe(false);
    expect(matchResultSchema.safeParse({ ...result, fit_score: 0.755 }).success).toBe(false);
    expect(matchResultSchema.safeParse({ ...result, dimensions: [dimension] }).success).toBe(false);
    expect(
      matchResultSchema.safeParse({ ...result, disclaimer: "Hiring guaranteed" }).success,
    ).toBe(false);
  });
});
