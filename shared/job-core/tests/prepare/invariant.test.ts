import { describe, expect, it } from "vitest";
import { buildCvNotes } from "../../src/prepare/cv-notes.js";
import { resolveFieldPath } from "../../src/prepare/matcher.js";
import { cvNotesSchema } from "../../src/prepare/schemas.js";
import type { Job, Requirements } from "../../src/schemas/job.js";
import type { Profile } from "../../src/schemas/profile.js";
import { createPrng, randomChoice, randomInt, randomSample } from "./prng.js";

const SKILL_POOL = [
  "TypeScript",
  "JavaScript",
  "Go",
  "Python",
  "Java",
  "C++",
  "C#",
  ".NET",
  "Node.js",
  "Docker",
  "Kubernetes",
  "AWS",
  "PostgreSQL",
  "MongoDB",
  "Redis",
  "GraphQL",
  "React",
  "Linux",
  "SQL",
  "Rust",
] as const;

function generateRandomProfile(prng: () => number, index: number): Profile {
  const hex = index.toString(16).padStart(12, "0");
  const profileId = `prof_00000000-0000-4000-8000-${hex}`;

  const numSkills = randomInt(prng, 3, 10);
  const selectedSkills = randomSample(prng, SKILL_POOL, numSkills);

  const skills = selectedSkills.map((name) => ({
    name,
    years: randomInt(prng, 1, 10),
    level: randomChoice(prng, ["beginner", "intermediate", "advanced", "expert"] as const),
  }));

  const numRoles = randomInt(prng, 1, 3);
  const roles = [];
  for (let r = 0; r < numRoles; r++) {
    const roleSkill1 = randomChoice(prng, SKILL_POOL);
    const roleSkill2 = randomChoice(prng, SKILL_POOL);
    roles.push({
      title: `Software Engineer specializing in ${roleSkill1}`,
      company: `Enterprise Corp ${String(r + 1)}`,
      start: "2020-01",
      end: r === 0 ? "present" : "2022-12",
      highlights: [
        `Architected and delivered scalable services with ${roleSkill1}.`,
        `Led infrastructure optimization and data pipelines in ${roleSkill2}.`,
      ],
    });
  }

  const hasSummary = prng() > 0.3;
  const summarySkill = randomChoice(prng, SKILL_POOL);
  const summary_text = hasSummary
    ? `Professional software engineer with deep expertise in ${summarySkill} and distributed systems.`
    : null;

  return {
    profile_id: profileId,
    schema_version: "1",
    created_at: "2026-09-01T00:00:00Z",
    updated_at: "2026-09-20T00:00:00Z",
    label: `Synthetic Candidate ${String(index)}`,
    headline: "Full Stack Engineer",
    total_experience_years: randomInt(prng, 1, 15),
    skills,
    roles,
    education: [
      {
        qualification: "B.Tech in Computer Science",
        institution: "National University",
        year: 2018,
      },
    ],
    certifications: [
      { name: "Certified Cloud Practitioner", issuer: "Cloud Provider", year: 2022 },
    ],
    preferences: {
      locations: ["Bangalore"],
      remote_modes: ["remote", "hybrid"],
      employment_types: ["full_time"],
      deal_breakers: [],
      min_compensation: null,
    },
    summary_text,
  };
}

function generateRandomJobAndReqs(
  prng: () => number,
  index: number,
): { job: Job; reqs: Requirements } {
  const hex = index.toString(16).padStart(12, "0");
  const jobId = `job_00000000-0000-4000-8000-${hex}`;

  const mustSkills = randomSample(prng, SKILL_POOL, randomInt(prng, 2, 4));
  const prefSkills = randomSample(prng, SKILL_POOL, randomInt(prng, 1, 3));

  const job: Job = {
    job_id: jobId,
    provider: "naukri",
    provider_job_id: null,
    source_url: "https://naukri.com/job/sample",
    source_url_is_official: true,
    title: "Software Engineer",
    company: "Hiring Corp",
    location: { raw: "Bangalore", city: "Bangalore", country: "IN" },
    remote_mode: "hybrid",
    employment_type: "full_time",
    experience: { min_years: 3, max_years: 8, raw: "3-8 yrs" },
    compensation: {
      raw: null,
      currency: null,
      min: null,
      max: null,
      period: "unknown",
      disclosed: false,
    },
    description: "Standard job description with requirements.",
    required_skills: mustSkills,
    preferred_skills: prefSkills,
    responsibilities: ["Build backend APIs", "Write tests"],
    qualifications: ["Bachelor degree"],
    posted_at: null,
    posted_at_raw: null,
    ingested_at: "2026-09-20T00:00:00Z",
    source_provenance: [
      { kind: "user_supplied", detail: "test", captured_at: "2026-09-20T00:00:00Z" },
    ],
    retention_class: "standard_180d",
    fingerprint: `sha256:${"b".repeat(64)}`,
    flags: [],
  };

  const reqs: Requirements = {
    job_id: jobId,
    must_have: mustSkills.map((skill) => ({
      text: `Must have production experience with ${skill}`,
      skills: [skill],
    })),
    preferred: prefSkills.map((skill) => ({
      text: `Nice to have experience with ${skill}`,
      skills: [skill],
    })),
    responsibilities: ["Build backend APIs", "Write tests"],
    experience: job.experience,
    location: job.location,
    remote_mode: job.remote_mode,
    employment_type: job.employment_type,
    compensation: job.compensation,
    constraints: [],
    discriminatory_flags: [],
  };

  return { job, reqs };
}

describe("Truthfulness Invariant T-08 across 200 seeded pseudo-random profiles", () => {
  it("satisfies exact substring match and schema validity across 200 random profiles", () => {
    const prng = createPrng(987654321);
    const PROFILE_COUNT = 200;

    for (let i = 1; i <= PROFILE_COUNT; i++) {
      const profile = generateRandomProfile(prng, i);
      const { job, reqs } = generateRandomJobAndReqs(prng, i);

      const notes = buildCvNotes(job, reqs, profile, profile.profile_id);

      // 1. Schema check
      expect(() => cvNotesSchema.parse(notes)).not.toThrow();

      // 2. Invariant T-08: Every evidence.text must be an exact substring of the referenced field_path
      for (const item of notes.emphasize) {
        expect(item.profile_evidence.length).toBeGreaterThanOrEqual(1);
        expect(item.profile_evidence.length).toBeLessThanOrEqual(5);

        for (const ev of item.profile_evidence) {
          const sourceText = resolveFieldPath(profile, ev.field_path);
          expect(
            typeof sourceText,
            `field_path '${ev.field_path}' in profile ${profile.profile_id} must resolve to string`,
          ).toBe("string");

          if (sourceText !== null) {
            expect(
              sourceText.includes(ev.text),
              `T-08 Invariant Violation: '${ev.text}' is not a substring of '${ev.field_path}' (${sourceText}) in profile ${profile.profile_id}`,
            ).toBe(true);
          }

          expect(ev.text.length).toBeLessThanOrEqual(300);
          expect(ev.field_path.length).toBeLessThanOrEqual(100);
        }
      }

      // 3. Do not claim verification: No required skill in do_not_claim should have evidence
      for (const dnc of notes.do_not_claim) {
        const match = /^No evidence in profile for (.*); do not claim it\.$/.exec(dnc);
        expect(match).not.toBeNull();
        if (match && match[1] !== undefined) {
          const skill = match[1];
          // Candidate skills must not contain this skill
          const hasSkill = profile.skills.some((s) => s.name.toLowerCase() === skill.toLowerCase());
          expect(hasSkill).toBe(false);
        }
      }
    }
  });
});
