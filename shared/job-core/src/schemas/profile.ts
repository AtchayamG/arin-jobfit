import { z } from "zod";
import {
  employmentTypeSchema,
  profileIdSchema,
  remoteModeSchema,
  skillNameSchema,
} from "./domain.js";

const yearMonth = z
  .string()
  .min(7)
  .max(7)
  .refine((value) => /^\d{4}-(0[1-9]|1[0-2])$/.test(value));
const year = z.number().int().min(1900).max(2100);
const currency = z
  .string()
  .min(3)
  .max(3)
  .refine((value) => /^[A-Z]{3}$/.test(value));
const level = z.enum(["beginner", "intermediate", "advanced", "expert"]);
const money = z.strictObject({
  amount: z.number().min(0).max(1e9),
  currency,
  period: z.enum(["year", "month", "hour"]),
});

const inputSkill = z.strictObject({
  name: skillNameSchema,
  years: z.number().min(0).max(60).optional(),
  level: level.optional(),
});
const storedSkill = z.strictObject({
  name: skillNameSchema,
  years: z.number().min(0).max(60).nullable(),
  level: level.nullable(),
});
const role = z.strictObject({
  title: z.string().min(1).max(200),
  company: z.string().min(1).max(200),
  start: yearMonth,
  end: z
    .string()
    .min(7)
    .max(7)
    .refine((value) => value === "present" || /^\d{4}-(0[1-9]|1[0-2])$/.test(value)),
  highlights: z.array(z.string().max(500)).max(20),
});
const inputEducation = z.strictObject({
  qualification: z.string().min(1).max(200),
  institution: z.string().min(1).max(200),
  year: year.optional(),
});
const storedEducation = z.strictObject({
  qualification: z.string().min(1).max(200),
  institution: z.string().min(1).max(200),
  year: year.nullable(),
});
const inputCertification = z.strictObject({
  name: z.string().min(1).max(200),
  issuer: z.string().max(200).optional(),
  year: year.optional(),
});
const storedCertification = z.strictObject({
  name: z.string().min(1).max(200),
  issuer: z.string().max(200).nullable(),
  year: year.nullable(),
});
const preferenceFields = {
  locations: z.array(z.string().max(200)).max(50),
  remote_modes: z.array(remoteModeSchema).max(4),
  employment_types: z.array(employmentTypeSchema).max(6),
  deal_breakers: z.array(z.string().max(500)).max(20),
};

export const profileInputSchema = z.strictObject({
  label: z.string().min(1).max(100),
  headline: z.string().max(300),
  total_experience_years: z.number().min(0).max(60),
  skills: z.array(inputSkill).max(200).default([]),
  roles: z.array(role).max(50).default([]),
  education: z.array(inputEducation).max(20).default([]),
  certifications: z.array(inputCertification).max(50).default([]),
  preferences: z.strictObject({
    locations: preferenceFields.locations.default([]),
    remote_modes: preferenceFields.remote_modes.default([]),
    employment_types: preferenceFields.employment_types.default([]),
    deal_breakers: preferenceFields.deal_breakers.default([]),
    min_compensation: money.optional(),
  }),
  summary_text: z.string().max(20_000).optional(),
});

export const profileSchema = z.strictObject({
  profile_id: profileIdSchema,
  schema_version: z.literal("1"),
  created_at: z.iso.datetime(),
  updated_at: z.iso.datetime(),
  label: z.string().min(1).max(100),
  headline: z.string().max(300),
  total_experience_years: z.number().min(0).max(60),
  skills: z.array(storedSkill).max(200),
  roles: z.array(role).max(50),
  education: z.array(storedEducation).max(20),
  certifications: z.array(storedCertification).max(50),
  preferences: z.strictObject({
    ...preferenceFields,
    min_compensation: money.nullable(),
  }),
  summary_text: z.string().max(20_000).nullable(),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;
export type Profile = z.infer<typeof profileSchema>;
