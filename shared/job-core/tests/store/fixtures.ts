/**
 * Test fixtures for Store tests.
 */

import { type Job, jobSchema } from "../../src/schemas/job.js";
import {
  type Profile,
  type ProfileInput,
  profileInputSchema,
  profileSchema,
} from "../../src/schemas/profile.js";

export function createTestJob(overrides: Partial<Job> = {}): Job {
  const base: Job = {
    job_id: "job_00000000-0000-4000-8000-000000000001",
    provider: "naukri",
    provider_job_id: "NK-12345",
    source_url: "https://naukri.com/job/12345",
    source_url_is_official: true,
    title: "Senior Backend Engineer",
    company: "Acme Cloud Corp",
    location: { raw: "Bangalore, India", city: "Bangalore", country: "IN" },
    remote_mode: "hybrid",
    employment_type: "full_time",
    experience: { min_years: 5, max_years: 10, raw: "5-10 years" },
    compensation: {
      raw: "25-35 LPA",
      currency: "INR",
      min: 2500000,
      max: 3500000,
      period: "year",
      disclosed: true,
    },
    description:
      "Seeking a Senior Backend Engineer experienced in TypeScript, Node.js, Go, and PostgreSQL.",
    required_skills: ["TypeScript", "Node.js", "Go", "PostgreSQL", "Docker"],
    preferred_skills: ["Kubernetes", "AWS", "GraphQL"],
    responsibilities: [
      "Architect and scale microservices for high throughput",
      "Mentor engineers on concurrency and system design",
    ],
    qualifications: ["B.Tech in computer science", "5+ years backend engineering"],
    posted_at: "2026-09-20T10:00:00Z",
    posted_at_raw: "20 Sep 2026",
    ingested_at: "2026-09-21T10:00:00Z",
    source_provenance: [
      { kind: "user_supplied", detail: "manual ingest", captured_at: "2026-09-21T10:00:00Z" },
    ],
    retention_class: "standard_180d",
    fingerprint: `sha256:${"a".repeat(64)}`,
    flags: [],
  };

  const merged = { ...base, ...overrides };
  return jobSchema.parse(merged);
}

export function createTestProfileInput(overrides: Partial<ProfileInput> = {}): ProfileInput {
  const base: ProfileInput = {
    label: "Senior Backend Engineer",
    headline: "Senior Software Engineer with 8 years building scalable services",
    total_experience_years: 8,
    skills: [
      { name: "TypeScript", years: 6, level: "expert" },
      { name: "Node.js", years: 6, level: "expert" },
      { name: "Go", years: 3, level: "advanced" },
    ],
    roles: [
      {
        title: "Staff Backend Engineer",
        company: "Apex Platforms",
        start: "2022-01",
        end: "present",
        highlights: ["Led development of high-throughput backend services in Go"],
      },
    ],
    education: [
      { qualification: "B.Tech in Computer Science", institution: "IIT Madras", year: 2018 },
    ],
    certifications: [
      { name: "AWS Certified Solutions Architect", issuer: "Amazon Web Services", year: 2023 },
    ],
    preferences: {
      locations: ["Bangalore"],
      remote_modes: ["hybrid", "remote"],
      employment_types: ["full_time"],
      deal_breakers: ["gambling"],
      min_compensation: { amount: 2800000, currency: "INR", period: "year" },
    },
    summary_text: "Experienced backend engineer specializing in Go and Node.js.",
  };

  const merged = { ...base, ...overrides };
  return profileInputSchema.parse(merged);
}

export function createTestProfile(overrides: Partial<Profile> = {}): Profile {
  const base: Profile = {
    profile_id: "prof_00000000-0000-4000-8000-000000000001",
    schema_version: "1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    label: "Senior Backend Engineer",
    headline: "Senior Software Engineer with 8 years building scalable services",
    total_experience_years: 8,
    skills: [
      { name: "TypeScript", years: 6, level: "expert" },
      { name: "Node.js", years: 6, level: "expert" },
    ],
    roles: [
      {
        title: "Staff Backend Engineer",
        company: "Apex Platforms",
        start: "2022-01",
        end: "present",
        highlights: ["Led development of high-throughput backend services"],
      },
    ],
    education: [
      { qualification: "B.Tech in Computer Science", institution: "IIT Madras", year: 2018 },
    ],
    certifications: [],
    preferences: {
      locations: ["Bangalore"],
      remote_modes: ["hybrid"],
      employment_types: ["full_time"],
      deal_breakers: [],
      min_compensation: null,
    },
    summary_text: "Experienced engineer.",
  };

  const merged = { ...base, ...overrides };
  return profileSchema.parse(merged);
}
