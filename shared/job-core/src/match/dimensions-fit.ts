/**
 * Attribute-based fit-v1 match dimension calculators:
 * experience, seniority, location_remote, and employment_type.
 */

import type { Job, Requirements } from "../schemas/job.js";
import type { Profile } from "../schemas/profile.js";
import type { MatchDimension } from "../schemas/match.js";

const SENIORITY_LEVELS: { level: number; regex: RegExp }[] = [
  { level: 5, regex: /\b(head|director|vp)\b/i },
  { level: 4, regex: /\b(lead|principal|staff|architect|manager)\b/i },
  { level: 3, regex: /\b(senior|sr)\b/i },
  { level: 2, regex: /\b(engineer|developer|analyst|consultant)\b/i },
  { level: 1, regex: /\b(junior|associate)\b/i },
  { level: 0, regex: /\b(intern|trainee)\b/i },
];

export function calculateExperience(
  job: Job,
  requirements: Requirements,
  profile: Profile,
): MatchDimension {
  const min = requirements.experience.min_years ?? job.experience.min_years;
  const max = requirements.experience.max_years ?? job.experience.max_years;

  if (min === null && max === null) {
    return {
      name: "experience",
      weight: 0.2,
      score: null,
      status: "unknown",
      evidence: [],
      gaps: [],
    };
  }

  const y = profile.total_experience_years;
  let score: number;
  if (min !== null && y < min) {
    score = Math.max(0, 1 - (min - y) / Math.max(min, 1));
  } else if (max !== null && y > max) {
    if (y - max <= 2) {
      score = 1;
    } else {
      score = Math.max(0.5, 1 - (y - max - 2) * 0.1);
    }
  } else {
    score = 1;
  }

  const status = score === 1 ? "matched" : score > 0 ? "partial" : "missing";
  const evidence: string[] = [];
  const gaps: string[] = [];

  if (score > 0) {
    const minStr = min !== null ? String(min) : "0";
    const maxStr = max !== null ? String(max) : "any";
    evidence.push(
      `Profile experience (${String(y)}y) vs JD requirements (${minStr}-${maxStr}y)`.slice(0, 500),
    );
  }
  if (score < 1) {
    if (min !== null && y < min) {
      gaps.push(
        `Profile experience (${String(y)}y) is below minimum requirement (${String(min)}y)`.slice(
          0,
          500,
        ),
      );
    } else {
      const maxStr = max !== null ? String(max) : "any";
      gaps.push(
        `Profile experience (${String(y)}y) exceeds maximum requirement (${maxStr}y)`.slice(0, 500),
      );
    }
  }

  return { name: "experience", weight: 0.2, score, status, evidence, gaps };
}

export function calculateSeniority(job: Job, profile: Profile): MatchDimension {
  let jobLevel: number | null = null;
  for (const item of SENIORITY_LEVELS) {
    if (item.regex.test(job.title)) {
      jobLevel = item.level;
      break;
    }
  }

  if (jobLevel === null) {
    return {
      name: "seniority",
      weight: 0.1,
      score: null,
      status: "unknown",
      evidence: [],
      gaps: [],
    };
  }

  const y = profile.total_experience_years;
  let profileLevel = 5;
  if (y < 1) profileLevel = 0;
  else if (y < 3) profileLevel = 1;
  else if (y < 6) profileLevel = 2;
  else if (y < 10) profileLevel = 3;
  else if (y < 15) profileLevel = 4;

  const diff = Math.abs(profileLevel - jobLevel);
  const score = Math.max(0, 1 - 0.34 * diff);
  const status = score === 1 ? "matched" : score > 0 ? "partial" : "missing";

  const evidence: string[] = [];
  const gaps: string[] = [];
  if (score > 0) {
    evidence.push(
      `Title level ${String(jobLevel)} corresponds to profile experience level ${String(profileLevel)}`.slice(
        0,
        500,
      ),
    );
  }
  if (score < 1) {
    gaps.push(`Seniority difference of ${String(diff)} level(s)`.slice(0, 500));
  }

  return { name: "seniority", weight: 0.1, score, status, evidence, gaps };
}

const CITY_SYNONYMS: Readonly<Record<string, string>> = {
  bangalore: "bengaluru",
  bengaluru: "bengaluru",
  gurgaon: "gurugram",
  gurugram: "gurugram",
  calcutta: "kolkata",
  kolkata: "kolkata",
  bombay: "mumbai",
  mumbai: "mumbai",
  madras: "chennai",
  chennai: "chennai",
  mysore: "mysuru",
  mysuru: "mysuru",
  cochin: "kochi",
  kochi: "kochi",
  trivandrum: "thiruvananthapuram",
  thiruvananthapuram: "thiruvananthapuram",
  baroda: "vadodara",
  vadodara: "vadodara",
};

export function canonicalCity(raw: string | null | undefined): string {
  if (!raw) return "";
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/\s*\([^)]*\)/g, "")
    .replace(/\s*[-/|–—].*$/, "")
    .replace(/[.,]/g, "")
    .trim();
  return CITY_SYNONYMS[cleaned] ?? cleaned;
}

export function calculateLocationRemote(job: Job, profile: Profile): MatchDimension {
  const hasProfileLoc = profile.preferences.locations.length > 0;
  const hasProfileRemote = profile.preferences.remote_modes.length > 0;
  const hasJobCity = job.location.city !== null && job.location.city.trim().length > 0;
  const isJobRemoteKnown = job.remote_mode !== "unknown";

  if ((!hasProfileLoc && !hasProfileRemote) || (!hasJobCity && !isJobRemoteKnown)) {
    return {
      name: "location_remote",
      weight: 0.1,
      score: null,
      status: "unknown",
      evidence: [],
      gaps: [],
    };
  }

  const jobCityNorm = canonicalCity(job.location.city);
  const cityMatched =
    jobCityNorm.length > 0 &&
    profile.preferences.locations.some((loc) => canonicalCity(loc) === jobCityNorm);

  let score = 0;
  if (job.remote_mode === "remote" && profile.preferences.remote_modes.includes("remote")) {
    score = 1;
  } else if (cityMatched) {
    score = 1;
  } else if (isJobRemoteKnown && profile.preferences.remote_modes.includes(job.remote_mode)) {
    score = 0.5;
  }

  const status = score === 1 ? "matched" : score > 0 ? "partial" : "missing";
  const evidence: string[] = [];
  const gaps: string[] = [];

  if (score > 0) {
    evidence.push(
      `Job remote mode '${job.remote_mode}' and location '${job.location.city ?? "unspecified"}' match preferences`.slice(
        0,
        500,
      ),
    );
  } else {
    gaps.push(
      `Job remote mode '${job.remote_mode}' and location '${job.location.city ?? "unspecified"}' do not match preferences`.slice(
        0,
        500,
      ),
    );
  }

  return { name: "location_remote", weight: 0.1, score, status, evidence, gaps };
}

export function calculateEmploymentType(job: Job, profile: Profile): MatchDimension {
  if (job.employment_type === "unknown" || profile.preferences.employment_types.length === 0) {
    return {
      name: "employment_type",
      weight: 0.05,
      score: null,
      status: "unknown",
      evidence: [],
      gaps: [],
    };
  }

  const matched = profile.preferences.employment_types.includes(job.employment_type);
  const score = matched ? 1 : 0;
  const status = matched ? "matched" : "missing";

  return {
    name: "employment_type",
    weight: 0.05,
    score,
    status,
    evidence: matched ? [`Employment type '${job.employment_type}' matches preference`] : [],
    gaps: matched ? [] : [`Job employment type '${job.employment_type}' not in preferred types`],
  };
}
