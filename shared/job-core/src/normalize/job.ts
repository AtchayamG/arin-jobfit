import type { Job, JobInput, Provenance, ProviderId, Warning } from "../schemas/index.js";
import { parseEmploymentType, parseRemoteMode } from "./classify.js";
import { parseCompensation } from "./compensation.js";
import { parseExperience } from "./experience.js";
import { fingerprintJob } from "./fingerprint.js";
import { parseLocation } from "./location.js";
import { parsePostedAt } from "./posted-at.js";
import { canonicalCompensationText } from "./provider-hints.js";

export interface NormalizeContext {
  provider: ProviderId;
  now: Date;
  jobId?: string;
  url: { value: string | null; isOfficial: boolean };
  provenance: Provenance[];
}

const payLine = (text: string, provider: ProviderId): string | undefined =>
  text
    .split(/\r?\n/)
    .find((line) =>
      /[₹$]|\b(?:salary|compensation|pay|lakh|crore)\b/i.test(
        canonicalCompensationText(provider, line),
      ),
    );

export function normalizeJob(
  input: JobInput,
  ctx: NormalizeContext,
): { job: Job; warnings: Warning[] } {
  const experience = parseExperience(input.experience_text ?? input.description, ctx.provider);
  const compensation = parseCompensation(
    input.compensation_text ?? payLine(input.description, ctx.provider),
    ctx.provider,
  );
  const posted = parsePostedAt(input.posted_at_text, ctx.provider);
  const warnings = [
    ...(input.experience_text && experience.warning ? [experience.warning] : []),
    ...(input.compensation_text && compensation.warning ? [compensation.warning] : []),
    ...(posted.warning ? [posted.warning] : []),
  ];
  const job: Job = {
    job_id: ctx.jobId ?? `job_${crypto.randomUUID()}`,
    provider: ctx.provider,
    provider_job_id: input.provider_job_id ?? null,
    source_url: ctx.url.value,
    source_url_is_official: ctx.url.isOfficial,
    title: input.title,
    company: input.company ?? null,
    location: parseLocation(input.location).value,
    remote_mode: parseRemoteMode(`${input.location ?? ""}\n${input.description}`).value,
    employment_type: parseEmploymentType(
      `${input.employment_type_text ?? ""}\n${input.description}`,
    ).value,
    experience:
      !input.experience_text && experience.warning
        ? { min_years: null, max_years: null, raw: null }
        : experience.value,
    compensation: compensation.value,
    description: input.description,
    required_skills: [],
    preferred_skills: [],
    responsibilities: [],
    qualifications: [],
    posted_at: posted.value,
    posted_at_raw: input.posted_at_text ?? null,
    ingested_at: ctx.now.toISOString(),
    source_provenance: ctx.provenance,
    retention_class: "standard_180d",
    fingerprint: fingerprintJob(input),
    flags: warnings,
  };
  return { job, warnings };
}
