/**
 * Shortlist ranking engine (pure function, deterministic).
 */

import type { Job, Requirements } from "../schemas/job.js";
import type { Profile } from "../schemas/profile.js";
import type { MatchDimension } from "../schemas/match.js";
import type { ShortlistOptions, ShortlistResult, ShortlistRankedItem } from "./types.js";
import { computeFit } from "./fit.js";

export function getDimensionReason(dim: MatchDimension): string | null {
  if (dim.score === null || dim.score <= 0) {
    return null;
  }
  switch (dim.name) {
    case "must_have_skills": {
      const skills = dim.evidence.slice(0, 3).join(", ");
      return skills ? `Must-have skills matched: ${skills}` : "Must-have skills matched";
    }
    case "experience":
      return "Experience requirement matched";
    case "preferred_skills": {
      const skills = dim.evidence.slice(0, 3).join(", ");
      return skills ? `Preferred skills matched: ${skills}` : "Preferred skills matched";
    }
    case "seniority":
      return "Seniority level aligned";
    case "location_remote":
      return "Location and remote preference aligned";
    case "employment_type":
      return "Employment type matched";
    case "domain": {
      const skills = dim.evidence.slice(0, 3).join(", ");
      return skills ? `Domain expertise matched: ${skills}` : "Domain expertise matched";
    }
    default:
      return null;
  }
}

/**
 * Ranks an array of jobs against a candidate profile.
 * Deterministic ordering: fit_score DESC, job_id ASC.
 */
export function shortlist(
  items: { job: Job; requirements: Requirements }[],
  profile: Profile,
  options?: ShortlistOptions,
): ShortlistResult {
  const maxLimit = Math.min(Math.max(options?.limit ?? 50, 1), 50);

  const scored: ShortlistRankedItem[] = items.map(({ job, requirements }) => {
    const { result } = computeFit(job, requirements, profile, {
      profileRef: options?.profileRef,
      skillCategory: options?.skillCategory,
    });

    // Select top positive dimensions sorted by impact (weight * score)
    const positiveDims = result.dimensions
      .filter((d) => d.score !== null && d.score > 0)
      .sort(
        (a, b) =>
          (typeof b.score === "number" ? b.score : 0) * b.weight -
          (typeof a.score === "number" ? a.score : 0) * a.weight,
      );

    const topReasons: string[] = [];
    for (const dim of positiveDims) {
      const reason = getDimensionReason(dim);
      if (reason) {
        topReasons.push(reason.slice(0, 500));
        if (topReasons.length >= 3) {
          break;
        }
      }
    }

    return {
      job_id: job.job_id,
      fit_score: result.fit_score,
      band: result.band,
      top_reasons: topReasons,
      blockers: result.blockers,
    };
  });

  // Sort descending by fit_score, then ascending by job_id for deterministic tie-breaking
  scored.sort((a, b) => {
    if (b.fit_score !== a.fit_score) {
      return b.fit_score - a.fit_score;
    }
    return a.job_id.localeCompare(b.job_id);
  });

  return {
    ranked: scored.slice(0, maxLimit),
  };
}
