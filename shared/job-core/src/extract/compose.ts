import type { Job, JobInput, Requirements, Warning } from "../schemas/index.js";
import { normalizeJob, type NormalizeContext } from "../normalize/job.js";
import { discriminationWarnings, extractRequirements } from "./requirements.js";

const unique = (values: string[]): string[] => [...new Set(values)];

export function normalizeAndExtract(
  input: JobInput,
  ctx: NormalizeContext,
): { job: Job; requirements: Requirements; warnings: Warning[] } {
  const normalized = normalizeJob(input, ctx);
  const requirements = extractRequirements(normalized.job);
  const required_skills = unique(requirements.must_have.flatMap((item) => item.skills)).slice(
    0,
    100,
  );
  const preferred_skills = unique(requirements.preferred.flatMap((item) => item.skills))
    .filter((name) => !required_skills.includes(name))
    .slice(0, 100);
  const warnings = [...normalized.warnings, ...discriminationWarnings(requirements)].slice(0, 50);
  const job: Job = {
    ...normalized.job,
    required_skills,
    preferred_skills,
    responsibilities: requirements.responsibilities,
    qualifications: requirements.must_have.map((item) => item.text).slice(0, 100),
    flags: warnings,
  };
  return { job, requirements, warnings };
}
