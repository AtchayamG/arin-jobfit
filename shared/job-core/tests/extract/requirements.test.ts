import { describe, expect, it } from "vitest";
import { discriminationWarnings, extractRequirements } from "../../src/extract/requirements.js";
import type { Job } from "../../src/schemas/index.js";

function makeJob(description: string): Job {
  return {
    job_id: "job_01234567-89ab-cdef-0123-456789abcdef",
    title: "Senior Software Engineer",
    company: "Tech Corp",
    description,
    location: { city: "Bengaluru", country: "IN", raw: "Bengaluru, India" },
    remote_mode: "hybrid",
    employment_type: "full_time",
    experience: { min_years: 5, max_years: 8, raw: "5-8 years" },
    compensation: {
      min: 2000000,
      max: 3000000,
      currency: "INR",
      period: "year",
      raw: "20-30 LPA",
      disclosed: true,
    },
    required_skills: ["Java", "Spring Boot"],
    preferred_skills: ["AWS", "Docker"],
    responsibilities: ["Develop scalable microservices"],
    qualifications: ["B.Tech in Computer Science"],
    provider: "naukri",
    provider_job_id: null,
    source_url: "https://example.com/jobs/123",
    source_url_is_official: false,
    posted_at: "2026-09-25T10:00:00.000Z",
    posted_at_raw: null,
    ingested_at: "2026-09-25T10:00:00.000Z",
    retention_class: "standard_180d",
    fingerprint: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    source_provenance: [
      { kind: "user_supplied", detail: "Unit test", captured_at: "2026-09-25T10:00:00.000Z" },
    ],
    flags: [],
  };
}

describe("extractRequirements", () => {
  it("extracts multiple discriminatory flags from a single line (R-9)", () => {
    const jd = `
Job Description
Female candidates only. Age below 30 years.
Requirements:
Java and Spring Boot
`;
    const job = makeJob(jd);
    const req = extractRequirements(job);
    expect(req.discriminatory_flags.length).toBe(2);
    expect(req.discriminatory_flags.map((f) => f.category).sort()).toEqual(["age", "gender"]);
    // Must not appear in must_have or preferred
    expect(req.must_have.some((item) => item.text.includes("Female candidates"))).toBe(false);
  });

  it("caps discriminatory flags at 50", () => {
    const lines = Array.from({ length: 60 }, (_, i) => `Male only candidate ${String(i)}`);
    const job = makeJob(lines.join("\n"));
    const req = extractRequirements(job);
    expect(req.discriminatory_flags.length).toBe(50);
  });

  it("extracts all constraint kinds correctly", () => {
    const jd = `
Requirements:
- Notice period: 30 days maximum
- Must work in night shift
- Travel required 25% of time
- Relocation to Bangalore required
- Must be authorized to work in India
- AWS certification is mandatory
- B.Tech degree required
`;
    const job = makeJob(jd);
    const req = extractRequirements(job);
    const kinds = req.constraints.map((c) => c.kind);
    expect(kinds).toContain("notice_period");
    expect(kinds).toContain("shift");
    expect(kinds).toContain("travel");
    expect(kinds).toContain("relocation");
    expect(kinds).toContain("work_authorization");
    expect(kinds).toContain("certification");
    expect(kinds).toContain("education");

    // AWS certification has skill "AWS", so it is retained in must_have
    expect(req.must_have.some((m) => m.skills.includes("AWS"))).toBe(true);
    // B.Tech degree has no taxonomy skill, so it is skipped from must_have
    expect(req.must_have.some((m) => m.text.includes("B.Tech"))).toBe(false);
  });

  it("caps constraints at 50", () => {
    const lines = Array.from(
      { length: 60 },
      (_, i) => `Immediate joiner notice period ${String(i)}`,
    );
    const job = makeJob(lines.join("\n"));
    const req = extractRequirements(job);
    expect(req.constraints.length).toBe(50);
  });

  it("caps responsibilities at 100", () => {
    const lines = [
      "Responsibilities:",
      ...Array.from({ length: 120 }, (_, i) => `Execute system maintenance task ${String(i)}`),
    ];
    const job = makeJob(lines.join("\n"));
    const req = extractRequirements(job);
    expect(req.responsibilities.length).toBe(100);
  });

  it("caps must_have at 100", () => {
    const lines = [
      "Requirements:",
      ...Array.from({ length: 120 }, (_, i) => `Mandatory requirement ${String(i)} for Python`),
    ];
    const job = makeJob(lines.join("\n"));
    const req = extractRequirements(job);
    expect(req.must_have.length).toBe(100);
  });

  it("skips metadata items from requirements and responsibilities", () => {
    const jd = `
Job details: Full-time
Job details: Permanent
Job Description:
Build backend systems
`;
    const job = makeJob(jd);
    const req = extractRequirements(job);
    expect(req.must_have.some((m) => m.text.includes("Full-time"))).toBe(false);
    expect(req.responsibilities.some((r) => r.includes("Full-time"))).toBe(false);
  });

  it("generates discrimination warnings matching detected flags", () => {
    const jd = `
Female candidates only. Age below 30 years.
`;
    const job = makeJob(jd);
    const req = extractRequirements(job);
    const warnings = discriminationWarnings(req);
    expect(warnings.length).toBe(2);
    expect(warnings.every((w) => w.code === "POTENTIALLY_DISCRIMINATORY_REQUIREMENT")).toBe(true);
    expect(warnings.some((w) => w.message.includes("age"))).toBe(true);
    expect(warnings.some((w) => w.message.includes("gender"))).toBe(true);
  });
});
