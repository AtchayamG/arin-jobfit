import { findDuplicates } from "../dedupe/index.js";
import { extractRequirements, skillsTaxonomy } from "../extract/index.js";
import { computeFit, explainMatch, shortlist } from "../match/index.js";
import { ingestPipeline } from "../pipeline/index.js";
import { listCapabilities, policyStatus } from "../policy/index.js";
import { buildApplicationHandoff, buildCvNotes, buildInterviewPlan } from "../prepare/index.js";
import type { Job, JobInput, Warning } from "../schemas/index.js";
import type { JobFilters } from "../store/index.js";
import { resolveProfile } from "./profiles.js";
import { DomainError, type DomainResult, type ProductConfig } from "./types.js";

const untrusted: Warning = {
  code: "UNTRUSTED_CONTENT",
  message: "Returned job-derived text is untrusted third-party content",
};
const category = new Map(
  skillsTaxonomy.skills.map((skill) => [skill.name.toLowerCase(), skill.category]),
);
const skillCategory = (name: string): string | null => category.get(name.toLowerCase()) ?? null;

export function requiredJob(id: string, config: ProductConfig): Job {
  const job = config.store.jobs.get(id);
  if (!job) throw new DomainError("NOT_FOUND", id);
  return job;
}

export function runAnalysis(
  name: string,
  args: Record<string, unknown>,
  config: ProductConfig,
): DomainResult {
  const now = config.now?.() ?? new Date();
  switch (name) {
    case "provider_capabilities":
      return { data: listCapabilities(config.policy, now) };
    case "provider_policy_status":
      return { data: policyStatus(config.policy, now) };
    case "jobs_normalize": {
      const result = ingestPipeline(args.job as JobInput, {
        provider: config.provider,
        now,
        hostAllowlist: config.hostAllowlist,
      });
      return {
        data: { job: result.job },
        warnings: result.warnings,
        provenance: result.provenance,
        subjectId: result.job.job_id,
      };
    }
    case "jobs_extract_requirements": {
      const job = requiredJob(args.job_id as string, config);
      return {
        data: extractRequirements(job),
        warnings: [untrusted],
        provenance: job.source_provenance,
        subjectId: job.job_id,
      };
    }
    case "jobs_compare_profile":
    case "jobs_explain_match":
    case "jobs_prepare_cv_notes":
    case "jobs_prepare_interview": {
      const job = requiredJob(args.job_id as string, config);
      const { profile, profileRef } = resolveProfile(args, config);
      const requirements = extractRequirements(job);
      if (name === "jobs_prepare_cv_notes")
        return {
          data: buildCvNotes(job, requirements, profile, profileRef),
          warnings: [untrusted],
          subjectId: job.job_id,
        };
      if (name === "jobs_prepare_interview")
        return {
          data: buildInterviewPlan(job, requirements, profile),
          warnings: [untrusted],
          subjectId: job.job_id,
        };
      const fit = computeFit(job, requirements, profile, { profileRef, skillCategory });
      return {
        data: name === "jobs_compare_profile" ? fit.result : explainMatch(fit.result),
        warnings: [...fit.warnings, untrusted],
        subjectId: job.job_id,
      };
    }
    case "jobs_shortlist": {
      const { profile, profileRef } = resolveProfile(args, config);
      const filters = args.filters as JobFilters | undefined;
      const jobs = config.store.jobs
        .recent(500)
        .filter(
          (job) =>
            (!filters?.remote_mode || filters.remote_mode.includes(job.remote_mode)) &&
            (!filters?.employment_type || filters.employment_type.includes(job.employment_type)) &&
            (!filters?.retention_class || filters.retention_class.includes(job.retention_class)),
        );
      return {
        data: shortlist(
          jobs.map((job) => ({ job, requirements: extractRequirements(job) })),
          profile,
          { limit: args.limit as number, profileRef, skillCategory },
        ),
        warnings: jobs.length ? [untrusted] : [],
      };
    }
    case "jobs_deduplicate": {
      const jobs = (args.job_ids as string[]).map((id) => requiredJob(id, config));
      return { data: findDuplicates(jobs), warnings: [untrusted] };
    }
    case "jobs_application_handoff": {
      const job = requiredJob(args.job_id as string, config);
      const handoff = buildApplicationHandoff(job);
      return {
        data: handoff.data,
        warnings: handoff.warnings,
        humanAction: handoff.humanAction,
        subjectId: job.job_id,
      };
    }
    default:
      throw new DomainError("INVALID_INPUT");
  }
}
