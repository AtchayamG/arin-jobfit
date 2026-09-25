/**
 * fit-v1 scoring engine (pure function, deterministic).
 */

import type { Job, Requirements } from "../schemas/job.js";
import type { Profile } from "../schemas/profile.js";
import type { Warning } from "../schemas/common.js";
import { matchResultSchema, type MatchResult } from "../schemas/match.js";
import type { ComputeFitOptions, ComputeFitOutput } from "./types.js";
import { buildWordBoundaryRegex } from "./matcher.js";
import {
  calculateMustHaveSkills,
  calculateExperience,
  calculatePreferredSkills,
  calculateSeniority,
  calculateLocationRemote,
  calculateEmploymentType,
  calculateDomain,
} from "./dimensions.js";

const DISCLAIMER = "Decision support only; not a prediction of hiring outcome." as const;

/**
 * Computes fit-v1 match score between a job listing and candidate profile.
 * Fail-closed, pure function, no I/O, no console.
 */
export function computeFit(
  job: Job,
  requirements: Requirements,
  profile: Profile,
  options?: ComputeFitOptions,
): ComputeFitOutput {
  const profileRef = options?.profileRef ?? (profile.profile_id ? profile.profile_id : "inline");

  // 1. Calculate each of the 7 dimensions
  const dMustHave = calculateMustHaveSkills(job, requirements, profile);
  const dExperience = calculateExperience(job, requirements, profile);
  const dPreferred = calculatePreferredSkills(job, requirements, profile);
  const dSeniority = calculateSeniority(job, profile);
  const dLocationRemote = calculateLocationRemote(job, profile);
  const dEmploymentType = calculateEmploymentType(job, profile);
  const dDomain = calculateDomain(job, requirements, profile, options?.skillCategory);

  const dimensions = [
    dMustHave,
    dExperience,
    dPreferred,
    dSeniority,
    dLocationRemote,
    dEmploymentType,
    dDomain,
  ];

  // 2. Evaluate deal-breaker phrases
  const blockers: string[] = [];
  const candidateTexts: string[] = [
    job.title,
    job.description,
    ...requirements.must_have.map((m) => m.text),
    ...requirements.preferred.map((p) => p.text),
    ...requirements.responsibilities,
    ...requirements.constraints.map((c) => c.text),
  ];

  for (const phrase of profile.preferences.deal_breakers) {
    const trimmed = phrase.trim();
    if (!trimmed) {
      continue;
    }
    const regex = buildWordBoundaryRegex(trimmed);
    if (candidateTexts.some((text) => regex.test(text))) {
      blockers.push(`Deal breaker '${trimmed}' matched in job listing`.slice(0, 500));
    }
  }

  // 3. Aggregate known dimensions and re-normalize
  const known = dimensions.filter((d) => d.status !== "unknown" && d.score !== null);
  const rawConfidence = known.reduce((sum, d) => sum + d.weight, 0);
  const confidence = Number((Math.round(rawConfidence * 100) / 100).toFixed(2));

  let rawScore = 0;
  if (known.length > 0 && confidence > 0) {
    const weightedSum = known.reduce(
      (sum, d) => sum + (typeof d.score === "number" ? d.score : 0) * d.weight,
      0,
    );
    rawScore = weightedSum / confidence;
  }

  let fitScore = Number((Math.round(rawScore * 100) / 100).toFixed(2));

  // Deal-breaker caps score at 0.30
  if (blockers.length > 0) {
    fitScore = Math.min(fitScore, 0.3);
    fitScore = Number((Math.round(fitScore * 100) / 100).toFixed(2));
  }

  const band = fitScore >= 0.75 ? "strong" : fitScore >= 0.5 ? "moderate" : "weak";

  // 4. Warnings
  const warnings: Warning[] = [];
  if (confidence < 0.6) {
    warnings.push({
      code: "LOW_CONFIDENCE",
      message: "Match confidence is below 0.60 due to unknown job dimensions.",
    });
  }

  const result: MatchResult = {
    job_id: job.job_id,
    profile_ref: profileRef,
    scoring_version: "fit-v1",
    fit_score: fitScore,
    band,
    confidence,
    dimensions,
    blockers: blockers.slice(0, 20),
    disclaimer: DISCLAIMER,
  };

  // Validate output against schema
  matchResultSchema.parse(result);

  return { result, warnings };
}
