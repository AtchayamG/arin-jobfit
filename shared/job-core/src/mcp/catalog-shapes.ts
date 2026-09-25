import { z } from "zod";
import { runAnalysis } from "./handlers-analysis.js";
import { runStore } from "./handlers-store.js";
import type { DomainResult, ProductConfig } from "./types.js";
import {
  employmentTypeSchema,
  jobSummarySchema,
  profileInputSchema,
  remoteModeSchema,
  retentionClassSchema,
} from "../schemas/index.js";

export const empty = z.strictObject({});
export const id = z.string().min(1).max(64);
export const jobId = z.strictObject({ job_id: id });
export const profileId = z.strictObject({ profile_id: id });
export const selector = { profile_id: id.optional(), profile: profileInputSchema.optional() };
export const jobWithProfile = z.strictObject({ job_id: id, ...selector });
export const filters = z.strictObject({
  remote_mode: z.array(remoteModeSchema).max(4).optional(),
  employment_type: z.array(employmentTypeSchema).max(6).optional(),
  retention_class: z.array(retentionClassSchema).max(3).optional(),
});
export const page = {
  filters: filters.optional(),
  page_size: z.number().int().min(1).max(50).default(50),
  cursor: z.string().max(2_048).optional(),
};
export const listOutput = z.strictObject({
  items: z.array(jobSummarySchema),
  next_cursor: z.string().nullable(),
});
export const groups = z.strictObject({
  groups: z.array(z.strictObject({ job_ids: z.array(id), evidence: z.array(z.string()) })),
});
export const explained = z.strictObject({
  summary_facts: z.array(z.string()),
  dimensions: z.array(
    z.strictObject({ name: z.string(), evidence: z.array(z.string()), gaps: z.array(z.string()) }),
  ),
  disclaimer: z.string(),
});
export const shortlistOutput = z.strictObject({
  ranked: z.array(
    z.strictObject({
      job_id: id,
      fit_score: z.number(),
      band: z.enum(["strong", "moderate", "weak"]),
      top_reasons: z.array(z.string()),
      blockers: z.array(z.string()),
    }),
  ),
});
export const purgeData = z.union([
  z.strictObject({
    confirmation_token: z.string(),
    summary: z.strictObject({ jobs: z.number(), profiles: z.number() }),
  }),
  z.strictObject({
    purged_counts: z.strictObject({ jobs: z.number(), profiles: z.number(), audit: z.number() }),
  }),
]);

export interface ToolDef {
  name: string;
  title: string;
  description: string;
  capabilityId: "l0.analysis" | "l0.local_store";
  inputSchema: z.ZodType;
  dataSchema: z.ZodType;
  handler: (name: string, args: Record<string, unknown>, config: ProductConfig) => DomainResult;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
    openWorldHint: false;
  };
}

export const def = (
  name: string,
  title: string,
  description: string,
  capabilityId: ToolDef["capabilityId"],
  inputSchema: z.ZodType,
  dataSchema: z.ZodType,
  readOnlyHint = false,
  destructiveHint = false,
  idempotentHint = false,
): ToolDef => ({
  name,
  title,
  description,
  capabilityId,
  inputSchema,
  dataSchema,
  handler: capabilityId === "l0.analysis" ? runAnalysis : runStore,
  annotations: { readOnlyHint, destructiveHint, idempotentHint, openWorldHint: false },
});
