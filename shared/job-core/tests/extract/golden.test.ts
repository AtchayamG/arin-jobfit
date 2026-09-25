import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAndExtract } from "../../src/extract/index.js";
import {
  jobInputSchema,
  jobSchema,
  providerIdSchema,
  requirementsSchema,
} from "../../src/schemas/index.js";

const fixtureDir = resolve(import.meta.dirname, "..", "fixtures", "jd");
const files = readdirSync(fixtureDir)
  .filter((name) => name.endsWith(".json"))
  .sort();
interface Fixture {
  provider: string;
  input: unknown;
  expected: {
    required_skills: string[];
    preferred_skills: string[];
    experience: [number | null, number | null];
    compensation: [number | null, number | null, string | null, string];
    country: string | null;
    posted_at: string | null;
    constraints: string[];
    discriminatory_flags: string[];
  };
}

describe("synthetic JD golden cases", () => {
  it("includes three provider-shaped fixtures of each style", () => {
    expect(files.filter((name) => name.startsWith("naukri-")).length).toBe(3);
    expect(files.filter((name) => name.startsWith("indeed-")).length).toBe(3);
  });

  it.each(files)("normalizes and extracts %s", (name) => {
    const fixture = JSON.parse(readFileSync(resolve(fixtureDir, name), "utf8")) as Fixture;
    const input = jobInputSchema.parse(fixture.input);
    const provider = providerIdSchema.parse(fixture.provider);
    const result = normalizeAndExtract(input, {
      provider,
      now: new Date("2026-09-25T12:00:00Z"),
      jobId: "job_76aff94c-40f0-4283-9d6c-7644a636d020",
      url: { value: null, isOfficial: false },
      provenance: [
        { kind: "user_supplied", detail: "Synthetic test", captured_at: "2026-09-25T12:00:00Z" },
      ],
    });
    expect(jobSchema.safeParse(result.job).success).toBe(true);
    expect(requirementsSchema.safeParse(result.requirements).success).toBe(true);
    expect(result.job.required_skills).toEqual(fixture.expected.required_skills);
    expect(result.job.preferred_skills).toEqual(fixture.expected.preferred_skills);
    expect([result.job.experience.min_years, result.job.experience.max_years]).toEqual(
      fixture.expected.experience,
    );
    expect([
      result.job.compensation.min,
      result.job.compensation.max,
      result.job.compensation.currency,
      result.job.compensation.period,
    ]).toEqual(fixture.expected.compensation);
    expect(result.job.location.country).toBe(fixture.expected.country);
    expect(result.job.posted_at).toBe(fixture.expected.posted_at);
    expect(result.requirements.constraints.map((item) => item.kind)).toEqual(
      fixture.expected.constraints,
    );
    expect(result.requirements.discriminatory_flags.map((item) => item.category)).toEqual(
      fixture.expected.discriminatory_flags,
    );
    for (const flag of result.requirements.discriminatory_flags) {
      expect(result.requirements.must_have.map((item) => item.text)).not.toContain(flag.text);
      expect(result.requirements.preferred.map((item) => item.text)).not.toContain(flag.text);
      expect(result.warnings.map((warning) => warning.code)).toContain(
        "POTENTIALLY_DISCRIMINATORY_REQUIREMENT",
      );
    }
  });
});
