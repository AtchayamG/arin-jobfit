import { z } from "zod";

export const jobIdSchema = z
  .string()
  .regex(/^job_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const profileIdSchema = z
  .string()
  .regex(/^prof_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
export const fingerprintSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/);
export const remoteModeSchema = z.enum(["onsite", "hybrid", "remote", "unknown"]);
export const employmentTypeSchema = z.enum([
  "full_time",
  "part_time",
  "contract",
  "internship",
  "temporary",
  "unknown",
]);
export const retentionClassSchema = z.enum(["session", "standard_180d", "pinned"]);
export const skillNameSchema = z.string().min(1).max(100);
export const locationSchema = z.strictObject({
  raw: z.string().max(200).nullable(),
  city: z.string().max(100).nullable(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .nullable(),
});
export const experienceSchema = z
  .strictObject({
    min_years: z.number().min(0).max(60).nullable(),
    max_years: z.number().min(0).max(60).nullable(),
    raw: z.string().max(100).nullable(),
  })
  .refine(
    (value) =>
      value.min_years === null || value.max_years === null || value.min_years <= value.max_years,
  );
export const compensationSchema = z
  .strictObject({
    raw: z.string().max(200).nullable(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .nullable(),
    min: z.number().min(0).max(1e9).nullable(),
    max: z.number().min(0).max(1e9).nullable(),
    period: z.enum(["year", "month", "hour", "unknown"]),
    disclosed: z.boolean(),
  })
  .refine((value) => value.min === null || value.max === null || value.min <= value.max);

export type JobId = z.infer<typeof jobIdSchema>;
export type ProfileId = z.infer<typeof profileIdSchema>;
export type Fingerprint = z.infer<typeof fingerprintSchema>;
export type Location = z.infer<typeof locationSchema>;
export type Experience = z.infer<typeof experienceSchema>;
export type Compensation = z.infer<typeof compensationSchema>;
