/**
 * Skill-based fit-v1 match dimension calculators:
 * must_have_skills, preferred_skills, and domain.
 */

import type { Job, Requirements } from "../schemas/job.js";
import type { Profile } from "../schemas/profile.js";
import type { MatchDimension } from "../schemas/match.js";
import { profileHasSkill, round2dp } from "./matcher.js";

export function calculateMustHaveSkills(
  job: Job,
  requirements: Requirements,
  profile: Profile,
): MatchDimension {
  const reqSkills = requirements.must_have.flatMap((m) => m.skills);
  const skills = Array.from(new Set(reqSkills.length > 0 ? reqSkills : job.required_skills));

  if (skills.length === 0) {
    return {
      name: "must_have_skills",
      weight: 0.35,
      score: null,
      status: "unknown",
      evidence: [],
      gaps: [],
    };
  }

  const covered = skills.filter((s) => profileHasSkill(profile, s));
  const missing = skills.filter((s) => !profileHasSkill(profile, s));
  const score = round2dp(covered.length / skills.length);
  const status = score === 1 ? "matched" : score > 0 ? "partial" : "missing";

  return {
    name: "must_have_skills",
    weight: 0.35,
    score,
    status,
    evidence: covered.slice(0, 20).map((s) => s.slice(0, 500)),
    gaps: missing.slice(0, 20).map((s) => s.slice(0, 500)),
  };
}

export function calculatePreferredSkills(
  job: Job,
  requirements: Requirements,
  profile: Profile,
): MatchDimension {
  const prefSkills = requirements.preferred.flatMap((p) => p.skills);
  const skills = Array.from(new Set(prefSkills.length > 0 ? prefSkills : job.preferred_skills));

  if (skills.length === 0) {
    return {
      name: "preferred_skills",
      weight: 0.1,
      score: null,
      status: "unknown",
      evidence: [],
      gaps: [],
    };
  }

  const covered = skills.filter((s) => profileHasSkill(profile, s));
  const missing = skills.filter((s) => !profileHasSkill(profile, s));
  const score = round2dp(covered.length / skills.length);
  const status = score === 1 ? "matched" : score > 0 ? "partial" : "missing";

  return {
    name: "preferred_skills",
    weight: 0.1,
    score,
    status,
    evidence: covered.slice(0, 20).map((s) => s.slice(0, 500)),
    gaps: missing.slice(0, 20).map((s) => s.slice(0, 500)),
  };
}

export function calculateDomain(
  job: Job,
  requirements: Requirements,
  profile: Profile,
  skillCategory?: (skill: string) => string | null,
): MatchDimension {
  if (!skillCategory) {
    return {
      name: "domain",
      weight: 0.1,
      score: null,
      status: "unknown",
      evidence: [],
      gaps: [],
    };
  }

  const mustHave = requirements.must_have.flatMap((m) => m.skills);
  const pref = requirements.preferred.flatMap((p) => p.skills);
  const rawSkills = Array.from(
    new Set([...mustHave, ...pref, ...job.required_skills, ...job.preferred_skills]),
  );

  const domainSkills = rawSkills.filter((s) => {
    const cat = skillCategory(s);
    return cat !== null && cat.trim() !== "";
  });

  if (domainSkills.length === 0) {
    return {
      name: "domain",
      weight: 0.1,
      score: null,
      status: "unknown",
      evidence: [],
      gaps: [],
    };
  }

  const covered = domainSkills.filter((s) => profileHasSkill(profile, s));
  const missing = domainSkills.filter((s) => !profileHasSkill(profile, s));
  const score = round2dp(covered.length / domainSkills.length);
  const status = score === 1 ? "matched" : score > 0 ? "partial" : "missing";

  return {
    name: "domain",
    weight: 0.1,
    score,
    status,
    evidence: covered.slice(0, 20).map((s) => `${s} (${skillCategory(s) ?? ""})`.slice(0, 500)),
    gaps: missing.slice(0, 20).map((s) => `${s} (${skillCategory(s) ?? ""})`.slice(0, 500)),
  };
}
