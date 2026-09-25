import { z } from "zod";
import { jobIdSchema, profileIdSchema } from "./domain.js";

export const matchDimensionSchema = z
  .strictObject({
    name: z.enum([
      "must_have_skills",
      "experience",
      "preferred_skills",
      "seniority",
      "location_remote",
      "employment_type",
      "domain",
    ]),
    weight: z.number().min(0).max(1),
    score: z.number().min(0).max(1).nullable(),
    status: z.enum(["matched", "partial", "missing", "unknown"]),
    evidence: z.array(z.string().max(500)).max(20),
    gaps: z.array(z.string().max(500)).max(20),
  })
  .refine((value) => (value.status === "unknown") === (value.score === null));

export const matchResultSchema = z.strictObject({
  job_id: jobIdSchema,
  profile_ref: z.union([profileIdSchema, z.literal("inline")]),
  scoring_version: z.literal("fit-v1"),
  fit_score: z.number().min(0).max(1).multipleOf(0.01),
  band: z.enum(["strong", "moderate", "weak"]),
  confidence: z.number().min(0).max(1),
  dimensions: z.array(matchDimensionSchema).length(7),
  blockers: z.array(z.string().max(500)).max(20),
  disclaimer: z.literal("Decision support only; not a prediction of hiring outcome."),
});

export type MatchDimension = z.infer<typeof matchDimensionSchema>;
export type MatchResult = z.infer<typeof matchResultSchema>;
