import { z } from "zod";
import { providerIdSchema, provenanceSchema, warningSchema } from "./common.js";
import {
  compensationSchema,
  employmentTypeSchema,
  experienceSchema,
  fingerprintSchema,
  jobIdSchema,
  locationSchema,
  remoteModeSchema,
  retentionClassSchema,
  skillNameSchema,
} from "./domain.js";

const httpsUrl = z
  .url({ protocol: /^https$/ })
  .max(2_048)
  .meta({ format: "uri", pattern: "^https://" });
const phrases = z.array(z.string().max(1_000)).max(100);

export const jobSchema = z.strictObject({
  job_id: jobIdSchema,
  provider: providerIdSchema,
  provider_job_id: z.string().max(100).nullable(),
  source_url: httpsUrl.nullable(),
  source_url_is_official: z.boolean(),
  title: z.string().min(1).max(200),
  company: z.string().max(200).nullable(),
  location: locationSchema,
  remote_mode: remoteModeSchema,
  employment_type: employmentTypeSchema,
  experience: experienceSchema,
  compensation: compensationSchema,
  description: z.string().min(1).max(50_000),
  required_skills: z.array(skillNameSchema).max(100),
  preferred_skills: z.array(skillNameSchema).max(100),
  responsibilities: phrases,
  qualifications: phrases,
  posted_at: z.iso.datetime().nullable(),
  posted_at_raw: z.string().max(100).nullable(),
  ingested_at: z.iso.datetime(),
  source_provenance: z.array(provenanceSchema).min(1).max(10),
  retention_class: retentionClassSchema,
  fingerprint: fingerprintSchema,
  flags: z.array(warningSchema).max(50),
});

export const jobSummarySchema = z.strictObject({
  job_id: jobIdSchema,
  provider: providerIdSchema,
  title: z.string().min(1).max(200),
  company: z.string().max(200).nullable(),
  remote_mode: remoteModeSchema,
  employment_type: employmentTypeSchema,
  ingested_at: z.iso.datetime(),
  retention_class: retentionClassSchema,
  source_url_is_official: z.boolean(),
  location_raw: z.string().max(200).nullable(),
  experience_min_years: z.number().min(0).max(60).nullable(),
  experience_max_years: z.number().min(0).max(60).nullable(),
  compensation_disclosed: z.boolean(),
  flag_count: z.number().int().min(0).max(50),
});

const requirement = z.strictObject({
  text: z.string().max(500),
  skills: z.array(skillNameSchema).max(20),
});

export const requirementsSchema = z.strictObject({
  job_id: jobIdSchema,
  must_have: z.array(requirement).max(100),
  preferred: z.array(requirement).max(100),
  responsibilities: phrases,
  experience: experienceSchema,
  location: locationSchema,
  remote_mode: remoteModeSchema,
  employment_type: employmentTypeSchema,
  compensation: compensationSchema,
  constraints: z
    .array(
      z.strictObject({
        kind: z.enum([
          "notice_period",
          "shift",
          "travel",
          "relocation",
          "work_authorization",
          "certification",
          "education",
          "other",
        ]),
        text: z.string().max(500),
      }),
    )
    .max(50),
  discriminatory_flags: z
    .array(
      z.strictObject({
        text: z.string().max(500),
        category: z.enum([
          "age",
          "gender",
          "religion",
          "caste",
          "marital_status",
          "nationality_origin",
          "disability",
          "appearance",
          "other",
        ]),
      }),
    )
    .max(50),
});

export type Job = z.infer<typeof jobSchema>;
export type JobSummary = z.infer<typeof jobSummarySchema>;
export type Requirements = z.infer<typeof requirementsSchema>;
