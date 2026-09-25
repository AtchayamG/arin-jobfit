import { ingestPipeline } from "../pipeline/index.js";
import type { JobInput, ProfileInput } from "../schemas/index.js";
import type { JobFilters } from "../store/index.js";
import { requiredJob } from "./handlers-analysis.js";
import { DomainError, type DomainResult, type ProductConfig } from "./types.js";

export function runStore(
  name: string,
  args: Record<string, unknown>,
  config: ProductConfig,
): DomainResult {
  const now = (config.now?.() ?? new Date()).toISOString();
  switch (name) {
    case "jobs_ingest": {
      const result = ingestPipeline(args.job as JobInput, {
        provider: config.provider,
        now: new Date(now),
        hostAllowlist: config.hostAllowlist,
        store: config.store,
        ...(args.retention_class === undefined
          ? {}
          : { retentionClass: args.retention_class as "session" | "standard_180d" | "pinned" }),
      });
      return {
        data: { job_id: result.job.job_id, job: result.job, duplicates: result.duplicates },
        warnings: result.warnings,
        provenance: result.provenance,
        subjectId: result.job.job_id,
      };
    }
    case "jobs_get": {
      const job = requiredJob(args.job_id as string, config);
      const { description, ...withoutDescription } = job;
      const include = args.include_description === true;
      return {
        data: { job: withoutDescription, untrusted_description: include ? description : null },
        warnings: include
          ? [
              {
                code: "UNTRUSTED_CONTENT",
                message: "Job description is untrusted third-party content",
              },
            ]
          : [],
        provenance: job.source_provenance,
        subjectId: job.job_id,
      };
    }
    case "jobs_list": {
      const page = config.store.jobs.list({
        filters: args.filters as JobFilters | undefined,
        pageSize: args.page_size as number,
        cursor: args.cursor as string | undefined,
      });
      return { data: { items: page.items, next_cursor: page.nextCursor } };
    }
    case "jobs_search_local": {
      const page = config.store.jobs.search({
        query: args.query as string,
        filters: args.filters as JobFilters | undefined,
        pageSize: args.page_size as number,
        cursor: args.cursor as string | undefined,
      });
      return { data: { items: page.items, next_cursor: page.nextCursor } };
    }
    case "jobs_delete":
      return {
        data: { deleted: config.store.jobs.delete(args.job_id as string) },
        subjectId: args.job_id as string,
      };
    case "profile_upsert": {
      const result = config.store.profiles.upsert(args.profile as ProfileInput, {
        ...(args.profile_id === undefined ? {} : { profileId: args.profile_id as string }),
        now,
      });
      return { data: result, subjectId: result.profile_id };
    }
    case "profile_get": {
      const profile = config.store.profiles.get(args.profile_id as string);
      if (!profile) throw new DomainError("NOT_FOUND", args.profile_id as string);
      return { data: { profile }, subjectId: profile.profile_id };
    }
    case "profile_list":
      return { data: { items: config.store.profiles.list() } };
    case "profile_delete":
      return {
        data: { deleted: config.store.profiles.delete(args.profile_id as string) },
        subjectId: args.profile_id as string,
      };
    case "data_export": {
      const data = config.store.rights.exportAll(now);
      return {
        data,
        warnings: data.jobs.length
          ? [{ code: "UNTRUSTED_CONTENT", message: "Export contains untrusted job descriptions" }]
          : [],
      };
    }
    case "data_purge": {
      if (args.confirmation_token === undefined) {
        const token = config.store.rights.createPurgeToken(now);
        return {
          data: { confirmation_token: token.token, summary: token.summary },
          confirmationRequired: true,
        };
      }
      const counts = config.store.rights.purge(args.confirmation_token as string, now);
      return {
        data: {
          purged_counts: {
            jobs: counts.purged_jobs,
            profiles: counts.purged_profiles,
            audit: counts.purged_audit,
          },
        },
      };
    }
    default:
      throw new DomainError("INVALID_INPUT");
  }
}
