import { describe, expect, it } from "vitest";
import {
  compensationSchema,
  experienceSchema,
  fingerprintSchema,
  jobIdSchema,
  jobSchema,
  jobSummarySchema,
  profileIdSchema,
  profileInputSchema,
  profileSchema,
  requirementsSchema,
} from "../../src/schemas/index.js";

const jobId = "job_76aff94c-40f0-4283-9d6c-7644a636d020";
const profileId = "prof_76aff94c-40f0-4283-9d6c-7644a636d020";
const location = { raw: "Bengaluru", city: "Bengaluru", country: "IN" };
const experience = { min_years: 2, max_years: 5, raw: "2–5 years" };
const compensation = {
  raw: null,
  currency: null,
  min: null,
  max: null,
  period: "unknown",
  disclosed: false,
};
const job = {
  job_id: jobId,
  provider: "naukri",
  provider_job_id: null,
  source_url: "https://example.com/jobs/1",
  source_url_is_official: false,
  title: "Engineer",
  company: null,
  location,
  remote_mode: "hybrid",
  employment_type: "full_time",
  experience,
  compensation,
  description: "Build software",
  required_skills: ["TypeScript"],
  preferred_skills: [],
  responsibilities: [],
  qualifications: [],
  posted_at: null,
  posted_at_raw: null,
  ingested_at: "2026-09-25T00:00:00Z",
  source_provenance: [
    { kind: "user_supplied", detail: "Pasted", captured_at: "2026-09-25T00:00:00Z" },
  ],
  retention_class: "session",
  fingerprint: `sha256:${"a".repeat(64)}`,
  flags: [],
};
const inputProfile = {
  label: "My CV",
  headline: "Engineer",
  total_experience_years: 3,
  skills: [{ name: "TypeScript", years: 3, level: "advanced" }],
  roles: [
    {
      title: "Engineer",
      company: "Example",
      start: "2023-01",
      end: "present",
      highlights: ["Built tools"],
    },
  ],
  education: [{ qualification: "BSc", institution: "University", year: 2022 }],
  certifications: [{ name: "Certificate", issuer: "Example", year: 2024 }],
  preferences: {
    locations: ["Bengaluru"],
    remote_modes: ["hybrid"],
    employment_types: ["full_time"],
    deal_breakers: [],
  },
  summary_text: "Experienced engineer",
};

describe("domain contracts", () => {
  it("validates common IDs, bounds, and min/max order", () => {
    expect(jobIdSchema.safeParse(jobId).success).toBe(true);
    expect(profileIdSchema.safeParse(profileId).success).toBe(true);
    expect(fingerprintSchema.safeParse(job.fingerprint).success).toBe(true);
    expect(jobIdSchema.safeParse(jobId.toUpperCase()).success).toBe(false);
    expect(profileIdSchema.safeParse(jobId).success).toBe(false);
    expect(fingerprintSchema.safeParse("sha256:abc").success).toBe(false);
    expect(experienceSchema.safeParse(experience).success).toBe(true);
    expect(experienceSchema.safeParse({ ...experience, min_years: null }).success).toBe(true);
    expect(experienceSchema.safeParse({ ...experience, max_years: null }).success).toBe(true);
    expect(experienceSchema.safeParse({ ...experience, min_years: 6 }).success).toBe(false);
    expect(compensationSchema.safeParse(compensation).success).toBe(true);
    expect(compensationSchema.safeParse({ ...compensation, min: 1 }).success).toBe(true);
    expect(compensationSchema.safeParse({ ...compensation, max: 1 }).success).toBe(true);
    expect(compensationSchema.safeParse({ ...compensation, min: 2, max: 1 }).success).toBe(false);
  });

  it("validates normalized Job, JobSummary, and Requirements", () => {
    expect(jobSchema.safeParse(job).success).toBe(true);
    expect(jobSchema.safeParse({ ...job, source_url: "http://example.com" }).success).toBe(false);
    expect(jobSchema.safeParse({ ...job, source_provenance: [] }).success).toBe(false);
    expect(
      jobSchema.safeParse({ ...job, location: { ...location, postal_code: "1" } }).success,
    ).toBe(false);
    const summary = {
      job_id: jobId,
      provider: "naukri",
      title: "Engineer",
      company: null,
      remote_mode: "hybrid",
      employment_type: "full_time",
      ingested_at: job.ingested_at,
      retention_class: "session",
      source_url_is_official: false,
      location_raw: "Bengaluru",
      experience_min_years: 2,
      experience_max_years: 5,
      compensation_disclosed: false,
      flag_count: 0,
    };
    expect(jobSummarySchema.safeParse(summary).success).toBe(true);
    expect(jobSummarySchema.safeParse({ ...summary, flag_count: 51 }).success).toBe(false);
    const requirements = {
      job_id: jobId,
      must_have: [{ text: "TypeScript", skills: ["TypeScript"] }],
      preferred: [],
      responsibilities: [],
      experience,
      location,
      remote_mode: "hybrid",
      employment_type: "full_time",
      compensation,
      constraints: [],
      discriminatory_flags: [],
    };
    expect(requirementsSchema.safeParse(requirements).success).toBe(true);
    expect(
      requirementsSchema.safeParse({
        ...requirements,
        discriminatory_flags: [{ text: "age", category: "made_up" }],
      }).success,
    ).toBe(false);
    expect(
      requirementsSchema.safeParse({
        ...requirements,
        must_have: [{ text: "x".repeat(501), skills: [] }],
      }).success,
    ).toBe(false);
  });

  it("validates ProfileInput without protected fields and stored Profile with nulls", () => {
    expect(profileInputSchema.safeParse(inputProfile).success).toBe(true);
    expect(profileInputSchema.safeParse({ ...inputProfile, gender: "female" }).success).toBe(false);
    expect(
      profileInputSchema.safeParse({ ...inputProfile, summary_text: "x".repeat(20_000) }).success,
    ).toBe(true);
    expect(
      profileInputSchema.safeParse({ ...inputProfile, summary_text: "x".repeat(20_001) }).success,
    ).toBe(false);
    expect(
      profileInputSchema.parse({
        label: "My CV",
        headline: "Engineer",
        total_experience_years: 3,
        preferences: {},
      }).preferences.locations,
    ).toEqual([]);
    expect(
      profileInputSchema.safeParse({ ...inputProfile, skills: [{ name: "x", years: 61 }] }).success,
    ).toBe(false);
    expect(
      profileInputSchema.safeParse({
        ...inputProfile,
        roles: [{ ...inputProfile.roles[0], start: "2023-13" }],
      }).success,
    ).toBe(false);
    expect(
      profileInputSchema.safeParse({
        ...inputProfile,
        roles: [{ ...inputProfile.roles[0], end: "2023-13" }],
      }).success,
    ).toBe(false);
    expect(
      profileInputSchema.safeParse({
        ...inputProfile,
        roles: [{ ...inputProfile.roles[0], end: "2024-01" }],
      }).success,
    ).toBe(true);
    expect(
      profileInputSchema.safeParse({
        ...inputProfile,
        preferences: {
          ...inputProfile.preferences,
          min_compensation: { amount: 1, currency: "inr", period: "year" },
        },
      }).success,
    ).toBe(false);
    expect(
      profileInputSchema.safeParse({
        ...inputProfile,
        preferences: {
          ...inputProfile.preferences,
          min_compensation: { amount: 1, currency: "INR", period: "year" },
        },
      }).success,
    ).toBe(true);
    const stored = {
      ...inputProfile,
      profile_id: profileId,
      schema_version: "1",
      created_at: "2026-09-25T00:00:00Z",
      updated_at: "2026-09-25T00:00:00Z",
      skills: [{ name: "TypeScript", years: null, level: null }],
      education: [{ qualification: "BSc", institution: "University", year: null }],
      certifications: [{ name: "Certificate", issuer: null, year: null }],
      preferences: { ...inputProfile.preferences, min_compensation: null },
      summary_text: null,
    };
    expect(profileSchema.safeParse(stored).success).toBe(true);
    expect(profileSchema.safeParse({ ...stored, summary_text: undefined }).success).toBe(false);
    expect(profileSchema.safeParse({ ...stored, caste: "x" }).success).toBe(false);
    expect(
      profileInputSchema.safeParse({
        ...inputProfile,
        education: [{ qualification: "BSc", institution: "University", year: 1899 }],
      }).success,
    ).toBe(false);
  });
});
