/**
 * Schemas for preparation builders (CV notes, interview plan, application handoff).
 *
 * Implements output contracts per Doc 16 §3C, Doc 17 §4/§6A, and Threat Model T-08/T-16.
 */

import { z } from "zod";
import { warningSchema } from "../schemas/common.js";
import { jobIdSchema, profileIdSchema, skillNameSchema } from "../schemas/domain.js";
import { humanActionSchema } from "../schemas/envelope.js";

export const HUMAN_ONLY_FIELDS = [
  "screening_answers",
  "salary_declaration",
  "notice_period",
  "personal_information_changes",
  "final_submit",
] as const;

export const TRUTHFULNESS_NOTE =
  "Never fabricate CV claims, experience, or qualifications. Gaps and unverified skills must not be claimed.";

export const profileEvidenceItemSchema = z.strictObject({
  field_path: z.string().min(1).max(100),
  text: z.string().min(1).max(300),
});

export const emphasizeItemSchema = z.strictObject({
  requirement: z.string().min(1).max(500),
  requirement_kind: z.enum(["must_have", "preferred"]),
  profile_evidence: z.array(profileEvidenceItemSchema).min(1).max(5),
});

export const gapItemSchema = z.strictObject({
  requirement: z.string().min(1).max(500),
  requirement_kind: z.enum(["must_have", "preferred"]),
  missing_skills: z.array(skillNameSchema).max(50),
});

export const cvNotesSchema = z.strictObject({
  job_id: jobIdSchema,
  profile_ref: z.union([profileIdSchema, z.literal("inline")]),
  emphasize: z.array(emphasizeItemSchema).max(100),
  gaps: z.array(gapItemSchema).max(100),
  do_not_claim: z.array(z.string().min(1).max(200)).max(100),
  unassessed: z.array(z.string().min(1).max(500)).max(100),
  truthfulness_note: z.string().min(1).max(500),
});

export const interviewTopicSchema = z.strictObject({
  topic: z.string().min(1).max(200),
  source: z.enum(["jd", "gap"]),
  requirement_ref: z.string().min(1).max(500),
  question_seeds: z.array(z.string().min(1).max(300)).max(5),
  study_pointers: z
    .array(z.string().min(1).max(300))
    .max(5)
    .refine((pointers) => pointers.every((p) => !/https?:\/\//i.test(p)), {
      message: "Study pointers must not contain URLs",
    }),
});

export const interviewPlanSchema = z.strictObject({
  job_id: jobIdSchema,
  topics: z.array(interviewTopicSchema).max(40),
});

const httpsUrl = z
  .url({ protocol: /^https$/ })
  .max(2048)
  .meta({ format: "uri", pattern: "^https://" });

export const applicationHandoffDataSchema = z.strictObject({
  official_url: httpsUrl.nullable(),
  url_is_official: z.boolean(),
  checklist: z.array(z.string().min(1).max(300)).max(15),
  human_only_fields: z.array(z.string().min(1).max(100)).max(10),
});

export const applicationHandoffResultSchema = z.strictObject({
  data: applicationHandoffDataSchema,
  humanAction: humanActionSchema,
  warnings: z.array(warningSchema),
});

export type ProfileEvidenceItem = z.infer<typeof profileEvidenceItemSchema>;
export type EmphasizeItem = z.infer<typeof emphasizeItemSchema>;
export type GapItem = z.infer<typeof gapItemSchema>;
export type CvNotes = z.infer<typeof cvNotesSchema>;
export type InterviewTopic = z.infer<typeof interviewTopicSchema>;
export type InterviewPlan = z.infer<typeof interviewPlanSchema>;
export type ApplicationHandoffData = z.infer<typeof applicationHandoffDataSchema>;
export type ApplicationHandoffResult = z.infer<typeof applicationHandoffResultSchema>;
