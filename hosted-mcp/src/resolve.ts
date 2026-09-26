import {
  extractRequirements,
  ingestPipeline,
  policy,
  sanitize,
  type Job,
  type Profile,
  type Requirements,
  type Warning,
} from "@jpm/job-core";
import type { JdAnalyzeInput } from "./types.js";

export type Policy = policy.Policy;

export function resolveJob(
  jobParam: JdAnalyzeInput["job"] | Job,
  provider: "naukri" | "indeed" = "naukri",
  now: Date = new Date(),
): { job: Job; requirements: Requirements; warnings: Warning[] } {
  if ("job_id" in jobParam && "required_skills" in jobParam) {
    const requirements = extractRequirements(jobParam);
    return { job: jobParam, requirements, warnings: jobParam.flags };
  }
  const hostAllowlist = provider === "indeed" ? sanitize.INDEED_HOSTS : sanitize.NAUKRI_HOSTS;
  const ingest = ingestPipeline(
    {
      title: jobParam.title && jobParam.title.trim().length > 0 ? jobParam.title : "Untitled Job",
      description: jobParam.description,
      origin: "user_paste",
      ...(jobParam.company ? { company: jobParam.company } : {}),
      ...(jobParam.location ? { location: jobParam.location } : {}),
      ...(jobParam.compensation_text ? { compensation_text: jobParam.compensation_text } : {}),
      ...(jobParam.employment_type_text
        ? { employment_type_text: jobParam.employment_type_text }
        : {}),
      ...(jobParam.source_url ? { source_url: jobParam.source_url } : {}),
    },
    { provider, now, hostAllowlist },
  );
  return { job: ingest.job, requirements: ingest.requirements, warnings: ingest.warnings };
}

export function resolveProfile(
  profileParam: unknown,
  now: Date = new Date(),
): {
  profile: Profile;
  profileRef: string;
} {
  const p = profileParam as Record<string, unknown>;
  if (typeof p["profile_id"] === "string" && p["schema_version"] === "1") {
    return { profile: p as unknown as Profile, profileRef: p["profile_id"] };
  }
  const iso = now.toISOString();
  const rawSkills = Array.isArray(p["skills"]) ? p["skills"] : [];
  const rawRoles = Array.isArray(p["roles"]) ? p["roles"] : [];
  const rawEdu = Array.isArray(p["education"]) ? p["education"] : [];
  const rawCert = Array.isArray(p["certifications"]) ? p["certifications"] : [];
  const rawPref = (p["preferences"] ?? {}) as Record<string, unknown>;

  const profile: Profile = {
    profile_id: `prof_${crypto.randomUUID()}`,
    schema_version: "1",
    created_at: iso,
    updated_at: iso,
    label: typeof p["label"] === "string" ? p["label"] : "Inline Profile",
    headline: typeof p["headline"] === "string" ? p["headline"] : "",
    total_experience_years:
      typeof p["total_experience_years"] === "number" ? p["total_experience_years"] : 0,
    skills: rawSkills.map((s: Record<string, unknown>) => ({
      name: typeof s["name"] === "string" ? s["name"] : "",
      years: typeof s["years"] === "number" ? s["years"] : null,
      level:
        typeof s["level"] === "string"
          ? (s["level"] as "beginner" | "intermediate" | "advanced" | "expert")
          : null,
    })),
    roles: rawRoles as Profile["roles"],
    education: rawEdu.map((e: Record<string, unknown>) => ({
      qualification: typeof e["qualification"] === "string" ? e["qualification"] : "",
      institution: typeof e["institution"] === "string" ? e["institution"] : "",
      year: typeof e["year"] === "number" ? e["year"] : null,
    })),
    certifications: rawCert.map((c: Record<string, unknown>) => ({
      name: typeof c["name"] === "string" ? c["name"] : "",
      issuer: typeof c["issuer"] === "string" ? c["issuer"] : null,
      year: typeof c["year"] === "number" ? c["year"] : null,
    })),
    preferences: {
      locations: Array.isArray(rawPref["locations"]) ? (rawPref["locations"] as string[]) : [],
      remote_modes: Array.isArray(rawPref["remote_modes"])
        ? (rawPref["remote_modes"] as Profile["preferences"]["remote_modes"])
        : [],
      employment_types: Array.isArray(rawPref["employment_types"])
        ? (rawPref["employment_types"] as Profile["preferences"]["employment_types"])
        : [],
      deal_breakers: Array.isArray(rawPref["deal_breakers"])
        ? (rawPref["deal_breakers"] as string[])
        : [],
      min_compensation:
        (rawPref["min_compensation"] as Profile["preferences"]["min_compensation"]) ?? null,
    },
    summary_text: typeof p["summary_text"] === "string" ? p["summary_text"] : null,
  };
  return { profile, profileRef: "inline" };
}
