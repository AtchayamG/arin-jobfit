import { z } from "zod";
import {
  jobSchema,
  matchResultSchema,
  prepare,
  profileInputSchema,
  profileSchema,
  requirementsSchema,
  warningSchema,
} from "@jpm/job-core";

const jobParamSchema = z.strictObject({
  title: z.string().max(200).optional(),
  company: z.string().max(200).optional(),
  location: z.string().max(200).optional(),
  compensation_text: z.string().max(200).optional(),
  employment_type_text: z.string().max(100).optional(),
  description: z.string().min(1).max(50_000),
  source_url: z.string().max(2048).optional(),
});

export const jdAnalyzeInputSchema = z.strictObject({
  job: jobParamSchema,
  portal: z.enum(["naukri", "indeed", "other"]).optional(),
});

export const jdAnalyzeDataSchema = z.strictObject({
  job: jobSchema,
  requirements: requirementsSchema,
  discriminatory_flags: requirementsSchema.shape.discriminatory_flags,
  warnings: z.array(warningSchema),
});

export const fitScoreInputSchema = z.strictObject({
  job: z.union([jobSchema, jobParamSchema]),
  profile: z.union([profileInputSchema, profileSchema]),
});

export const explainMatchSchema = z.strictObject({
  summary_facts: z.array(z.string()),
  dimensions: z.array(
    z.strictObject({
      name: z.string(),
      evidence: z.array(z.string()),
      gaps: z.array(z.string()),
    }),
  ),
  disclaimer: z.string(),
});

export const fitScoreDataSchema = z.strictObject({
  ...matchResultSchema.shape,
  explanation: explainMatchSchema,
});

export const cvNotesInputSchema = z.strictObject({
  job: z.union([jobSchema, jobParamSchema]),
  profile: z.union([profileInputSchema, profileSchema]),
});

export const cvNotesDataSchema = prepare.cvNotesSchema;

export const interviewPrepInputSchema = z.strictObject({
  job: z.union([jobSchema, jobParamSchema]),
  profile: z.union([profileInputSchema, profileSchema]),
});

export const interviewPrepDataSchema = prepare.interviewPlanSchema;

export const applicationHandoffInputSchema = z.strictObject({
  job: z.union([jobSchema, jobParamSchema]),
  profile: z.union([profileInputSchema, profileSchema]).optional(),
});

export const applicationHandoffDataOutputSchema = prepare.applicationHandoffDataSchema;

export const capabilitiesListInputSchema = z.strictObject({});

export const capabilitiesListDataSchema = z.strictObject({
  capabilities: z.array(
    z.strictObject({
      id: z.string(),
      level: z.string(),
      status: z.string(),
      reason: z.string(),
      approval_ref: z.string().nullable(),
    }),
  ),
});

export type JdAnalyzeInput = z.infer<typeof jdAnalyzeInputSchema>;
export type FitScoreInput = z.infer<typeof fitScoreInputSchema>;
export type CvNotesInput = z.infer<typeof cvNotesInputSchema>;
export type InterviewPrepInput = z.infer<typeof interviewPrepInputSchema>;
export type ApplicationHandoffInput = z.infer<typeof applicationHandoffInputSchema>;
export type CapabilitiesListInput = z.infer<typeof capabilitiesListInputSchema>;
