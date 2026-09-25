import { checkIngestDuplicates } from "../dedupe/index.js";
import { normalizeAndExtract } from "../extract/index.js";
import { detectInjection, sanitizeText, validateSourceUrl } from "../sanitize/index.js";
import {
  jobInputSchema,
  type Job,
  type JobInput,
  type Provenance,
  type ProviderId,
  type Requirements,
  type Warning,
} from "../schemas/index.js";
import type { Store } from "../store/index.js";

export class PipelineError extends Error {
  constructor(readonly code: "INPUT_TOO_LARGE" | "INVALID_INPUT" | "UNSAFE_URL") {
    super(code);
  }
}

export interface IngestContext {
  provider: ProviderId;
  now: Date;
  hostAllowlist: readonly string[];
  store?: Store;
  retentionClass?: Job["retention_class"];
}

export interface IngestResult {
  job: Job;
  requirements: Requirements;
  warnings: Warning[];
  provenance: Provenance[];
  duplicates: { job_id: string; reason: string }[];
}

const textLimits = {
  title: 200,
  description: 50_000,
  company: 200,
  location: 200,
  source_url: 2_048,
  employment_type_text: 100,
  experience_text: 100,
  compensation_text: 200,
  posted_at_text: 100,
  provider_job_id: 100,
  relay_source: 100,
} as const;

export function ingestPipeline(input: JobInput, ctx: IngestContext): IngestResult {
  const sanitized: Record<string, string> = {};
  const warnings: Warning[] = [];
  for (const [field, maxLength] of Object.entries(textLimits)) {
    const value = input[field as keyof typeof textLimits];
    if (value === undefined) continue;
    const result = sanitizeText(value, { field, maxLength });
    if (!result.ok) throw new PipelineError("INPUT_TOO_LARGE");
    sanitized[field] = result.text;
    warnings.push(...result.warnings);
  }
  const parsed = jobInputSchema.safeParse({ ...input, ...sanitized });
  if (!parsed.success) throw new PipelineError("INVALID_INPUT");
  const jobInput = parsed.data;
  const injection = detectInjection(jobInput.description);
  if (injection.suspected) {
    warnings.push({
      code: "PROMPT_INJECTION_SUSPECTED",
      message: "Job text may contain instructions",
    });
  }
  const url = jobInput.source_url
    ? validateSourceUrl(jobInput.source_url, ctx.hostAllowlist)
    : null;
  if (url && !url.ok) throw new PipelineError("UNSAFE_URL");
  if (url && !url.isOfficial)
    warnings.push({ code: "URL_NOT_OFFICIAL", message: "Source URL is not an official host" });
  const provenance: Provenance[] = [
    {
      kind: jobInput.origin === "agent_relay" ? "agent_relay" : "user_supplied",
      detail:
        jobInput.origin === "agent_relay"
          ? (jobInput.relay_source ?? "Agent relay")
          : "User supplied",
      captured_at: ctx.now.toISOString(),
    },
  ];
  const normalized = normalizeAndExtract(jobInput, {
    provider: ctx.provider,
    now: ctx.now,
    url: { value: url?.url ?? null, isOfficial: url?.isOfficial ?? false },
    provenance,
  });
  const job: Job = {
    ...normalized.job,
    retention_class: ctx.retentionClass ?? "standard_180d",
  };
  warnings.push(...normalized.warnings);
  const duplicates = ctx.store
    ? checkIngestDuplicates(job, ctx.store.jobs.recent(500))
    : { duplicates: [], warnings: [] };
  warnings.push(...duplicates.warnings);
  warnings.push({
    code: "UNTRUSTED_CONTENT",
    message: "Job description is untrusted third-party content",
  });
  job.flags = warnings.slice(0, 50);
  if (ctx.store) ctx.store.jobs.insert(job);
  return {
    job,
    requirements: normalized.requirements,
    warnings: warnings.slice(0, 50),
    provenance,
    duplicates: duplicates.duplicates,
  };
}
