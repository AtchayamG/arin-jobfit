/**
 * Test fixtures for preparation builders.
 *
 * All fixtures are strictly valid according to committed schemas.
 */

import {
  type Job,
  jobSchema,
  type Requirements,
  requirementsSchema,
} from "../../src/schemas/job.js";
import { type Profile, profileSchema } from "../../src/schemas/profile.js";

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
      "Ensure 99.99% service availability and disaster recovery",
    ],
    qualifications: [
      "B.Tech or equivalent degree in computer science",
      "At least 5 years hands-on production engineering",
    ],
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

export function createTestRequirements(overrides: Partial<Requirements> = {}): Requirements {
  const base: Requirements = {
    job_id: "job_00000000-0000-4000-8000-000000000001",
    must_have: [
      {
        text: "Strong proficiency in TypeScript and Node.js for backend APIs",
        skills: ["TypeScript", "Node.js"],
      },
      { text: "Production experience building concurrent services in Go", skills: ["Go"] },
      { text: "Experience with PostgreSQL query tuning", skills: ["PostgreSQL"] },
      { text: "Hands-on containerization with Docker", skills: ["Docker"] },
      { text: "Proven team leadership and communication skills", skills: [] },
    ],
    preferred: [
      { text: "Familiarity with container orchestration using Kubernetes", skills: ["Kubernetes"] },
      { text: "Cloud infrastructure experience on AWS", skills: ["AWS"] },
      { text: "API design using GraphQL", skills: ["GraphQL"] },
      {
        text: "Experience with TypeScript and Node.js backend systems",
        skills: ["TypeScript", "Node.js"],
      },
      { text: "Active participation in technical open source communities", skills: [] },
    ],
    responsibilities: [
      "Architect and scale microservices for high throughput",
      "Mentor engineers on concurrency and system design",
      "Ensure 99.99% service availability and disaster recovery",
    ],
    experience: { min_years: 5, max_years: 10, raw: "5-10 years" },
    location: { raw: "Bangalore, India", city: "Bangalore", country: "IN" },
    remote_mode: "hybrid",
    employment_type: "full_time",
    compensation: {
      raw: "25-35 LPA",
      currency: "INR",
      min: 2500000,
      max: 3500000,
      period: "year",
      disclosed: true,
    },
    constraints: [],
    discriminatory_flags: [],
  };

  const merged = { ...base, ...overrides };
  return requirementsSchema.parse(merged);
}

export function createSeniorProfile(overrides: Partial<Profile> = {}): Profile {
  const base: Profile = {
    profile_id: "prof_00000000-0000-4000-8000-000000000001",
    schema_version: "1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    label: "Senior Backend Engineer",
    headline:
      "Senior Software Engineer with 8 years building scalable services in Go, Node.js, and TypeScript",
    total_experience_years: 8,
    skills: [
      { name: "TypeScript", years: 6, level: "expert" },
      { name: "Node.js", years: 6, level: "expert" },
      { name: "Go", years: 3, level: "advanced" },
      { name: "PostgreSQL", years: 5, level: "advanced" },
      { name: "Docker", years: 4, level: "intermediate" },
      { name: "C++", years: 2, level: "intermediate" },
      { name: ".NET", years: 1, level: "beginner" },
    ],
    roles: [
      {
        title: "Staff Backend Engineer",
        company: "Apex Platforms",
        start: "2022-01",
        end: "present",
        highlights: [
          "Led development of high-throughput backend services in Go handling 15,000 rps",
          "Scaled PostgreSQL database cluster across multiple availability zones",
          "Containerized all microservices with Docker and automated CI/CD",
        ],
      },
      {
        title: "Software Engineer",
        company: "NextGen Software",
        start: "2018-06",
        end: "2021-12",
        highlights: [
          "Built customer-facing APIs using Node.js and TypeScript",
          "Collaborated on database schema design and integration tests",
        ],
      },
    ],
    education: [
      { qualification: "B.Tech in Computer Science", institution: "IIT Madras", year: 2018 },
    ],
    certifications: [
      { name: "AWS Certified Solutions Architect", issuer: "Amazon Web Services", year: 2023 },
    ],
    preferences: {
      locations: ["Bangalore", "Hyderabad"],
      remote_modes: ["hybrid", "remote"],
      employment_types: ["full_time"],
      deal_breakers: ["gambling"],
      min_compensation: { amount: 2800000, currency: "INR", period: "year" },
    },
    summary_text:
      "Experienced backend engineer specializing in Go, Node.js, and distributed data stores.",
  };

  const merged = { ...base, ...overrides };
  return profileSchema.parse(merged);
}

export function createJuniorProfile(overrides: Partial<Profile> = {}): Profile {
  const base: Profile = {
    profile_id: "prof_00000000-0000-4000-8000-000000000002",
    schema_version: "1",
    created_at: "2026-09-10T00:00:00Z",
    updated_at: "2026-09-22T00:00:00Z",
    label: "Junior Developer",
    headline: "Junior Developer with foundational knowledge in TypeScript and web technologies",
    total_experience_years: 1,
    skills: [
      { name: "TypeScript", years: 1, level: "beginner" },
      { name: "HTML/CSS", years: 1, level: "intermediate" },
    ],
    roles: [
      {
        title: "Junior Frontend Intern",
        company: "Startup Co",
        start: "2025-06",
        end: "2026-05",
        highlights: ["Developed responsive UI components using TypeScript"],
      },
    ],
    education: [
      {
        qualification: "B.E. in Information Technology",
        institution: "Anna University",
        year: 2025,
      },
    ],
    certifications: [],
    preferences: {
      locations: ["Chennai", "Bangalore"],
      remote_modes: ["onsite", "hybrid"],
      employment_types: ["full_time", "internship"],
      deal_breakers: [],
      min_compensation: null,
    },
    summary_text: null,
  };

  const merged = { ...base, ...overrides };
  return profileSchema.parse(merged);
}
