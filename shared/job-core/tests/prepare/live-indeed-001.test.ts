import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { normalizeAndExtract } from "../../src/extract/index.js";
import { computeFit } from "../../src/match/index.js";
import { buildCvNotes } from "../../src/prepare/cv-notes.js";
import { buildInterviewPlan } from "../../src/prepare/interview.js";
import {
  jobInputSchema,
  jobSchema,
  profileSchema,
  requirementsSchema,
} from "../../src/schemas/index.js";

describe("live-indeed-001 end-to-end golden verification", () => {
  const fixturePath = resolve(import.meta.dirname, "..", "fixtures", "jd", "live-indeed-001.json");
  const rawFixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
    provider: string;
    input: unknown;
    expected: unknown;
    profile: unknown;
  };

  const input = jobInputSchema.parse(rawFixture.input);
  const profile = profileSchema.parse(rawFixture.profile);

  const { job, requirements } = normalizeAndExtract(input, {
    provider: "indeed",
    now: new Date("2026-09-25T12:00:00Z"),
    jobId: "job_00000000-0000-4000-8000-000000000001",
    url: { value: "https://www.indeed.com/viewjob?jk=abc123", isOfficial: true },
    provenance: [
      { kind: "user_supplied", detail: "live test", captured_at: "2026-09-25T12:00:00Z" },
    ],
  });

  it("validates job and requirements against schemas", () => {
    expect(() => jobSchema.parse(job)).not.toThrow();
    expect(() => requirementsSchema.parse(requirements)).not.toThrow();
  });

  it("Fix 1: extracts required and preferred skills cleanly without metadata", () => {
    expect(job.required_skills).toEqual(["Angular", "TypeScript", "RxJS", "REST"]);
    expect(job.preferred_skills).toEqual(["Ionic", "Capacitor", "AWS"]);
    expect(requirements.must_have.length).toBeGreaterThan(0);

    const allReqTexts = [...requirements.must_have, ...requirements.preferred].map((r) => r.text);
    for (const text of allReqTexts) {
      expect(text).not.toMatch(/salary|compensation|18-25 lpa/i);
      expect(text).not.toMatch(/^full time\.?$/i);
    }
  });

  it("Fix 2: normalizes Indian compensation (LPA) into INR yearly", () => {
    expect(job.compensation).toEqual({
      raw: "18-25 LPA",
      currency: "INR",
      min: 1800000,
      max: 2500000,
      period: "year",
      disclosed: true,
    });
    expect(job.compensation.raw).toBe("18-25 LPA");
    expect((job.compensation.raw ?? "").length).toBeLessThanOrEqual(200);
  });

  it("Fix 3: strips work mode modifier from city and sets remote_mode to hybrid", () => {
    expect(job.location.city).toBe("Chennai");
    expect(job.remote_mode).toBe("hybrid");
  });

  it("Fix 4: computeFit location_remote score is 1.0 with canonical city match", () => {
    const fit = computeFit(job, requirements, profile);
    const locDim = fit.result.dimensions.find((d) => d.name === "location_remote");
    expect(locDim).toBeDefined();
    expect(locDim?.score).toBe(1.0);
    expect(locDim?.status).toBe("matched");
  });

  it("Fix 5: buildCvNotes adds every missing job skill (required and preferred) to do_not_claim", () => {
    const cvNotes = buildCvNotes(job, requirements, profile, profile.profile_id);

    expect(cvNotes.do_not_claim).toContain("No evidence in profile for RxJS; do not claim it.");
    expect(cvNotes.do_not_claim).toContain("No evidence in profile for REST; do not claim it.");
    expect(cvNotes.do_not_claim).toContain("No evidence in profile for AWS; do not claim it.");
  });

  it("Fix 6: buildInterviewPlan generates at least 7 topics with correct ordering and honesty pointers", () => {
    const plan = buildInterviewPlan(job, requirements, profile);

    expect(plan.topics.length).toBeGreaterThanOrEqual(7);
    expect(plan.topics.length).toBeLessThanOrEqual(40);

    const prefixes = plan.topics.map((t) => t.topic.split(":")[0]);
    expect(prefixes).toContain("Must-Have");
    expect(prefixes).toContain("Skill Gap");
    expect(prefixes).toContain("Preferred");

    let stage = 0; // 0 = Must-Have, 1 = Skill Gap, 2 = Preferred, 3 = Responsibility
    for (const prefix of prefixes) {
      if (prefix === "Must-Have") {
        expect(stage).toBeLessThanOrEqual(0);
        stage = 0;
      } else if (prefix === "Skill Gap") {
        expect(stage).toBeLessThanOrEqual(1);
        stage = 1;
      } else if (prefix === "Preferred") {
        expect(stage).toBeLessThanOrEqual(2);
        stage = 2;
      } else if (prefix === "Responsibility") {
        expect(stage).toBeLessThanOrEqual(3);
        stage = 3;
      }
    }

    const gapTopics = plan.topics.filter((t) => t.source === "gap");
    expect(gapTopics.length).toBeGreaterThan(0);
    for (const gap of gapTopics) {
      const hasHonestPointer = gap.study_pointers.some((p) =>
        p.toLowerCase().includes("prepare a truthful account of your exposure to"),
      );
      expect(hasHonestPointer).toBe(true);
    }
  });
});
