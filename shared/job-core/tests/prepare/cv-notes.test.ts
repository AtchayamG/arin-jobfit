import { describe, expect, it } from "vitest";
import { buildCvNotes } from "../../src/prepare/cv-notes.js";
import { resolveFieldPath } from "../../src/prepare/matcher.js";
import { cvNotesSchema, TRUTHFULNESS_NOTE } from "../../src/prepare/schemas.js";
import {
  createJuniorProfile,
  createSeniorProfile,
  createTestJob,
  createTestRequirements,
} from "./fixtures.js";

describe("buildCvNotes", () => {
  const job = createTestJob();
  const requirements = createTestRequirements();
  const seniorProfile = createSeniorProfile();
  const juniorProfile = createJuniorProfile();

  it("builds valid CV notes for senior candidate matching primary skills", () => {
    const res = buildCvNotes(job, requirements, seniorProfile, seniorProfile.profile_id);
    const parsed = cvNotesSchema.parse(res);

    expect(parsed.job_id).toBe(job.job_id);
    expect(parsed.profile_ref).toBe(seniorProfile.profile_id);
    expect(parsed.truthfulness_note).toBe(TRUTHFULNESS_NOTE);

    // Senior profile has TypeScript, Node.js, Go, PostgreSQL, Docker, AWS
    expect(parsed.emphasize.length).toBeGreaterThan(0);
    const mustHaveEmphasize = parsed.emphasize.filter((e) => e.requirement_kind === "must_have");
    expect(mustHaveEmphasize.length).toBeGreaterThanOrEqual(3);

    // Preferred skill AWS matches certification
    const prefEmphasize = parsed.emphasize.filter((e) => e.requirement_kind === "preferred");
    expect(prefEmphasize.some((e) => e.requirement.includes("AWS"))).toBe(true);

    // Requirement with no skills goes to unassessed
    expect(parsed.unassessed).toContain("Proven team leadership and communication skills");

    // Preferred gaps: Kubernetes, GraphQL are not in senior profile
    expect(parsed.gaps.some((g) => g.missing_skills.includes("Kubernetes"))).toBe(true);
    expect(parsed.gaps.some((g) => g.missing_skills.includes("GraphQL"))).toBe(true);

    // Preferred gaps (Kubernetes, GraphQL) have no evidence, so they are added to do_not_claim
    expect(parsed.do_not_claim).toEqual([
      "No evidence in profile for Kubernetes; do not claim it.",
      "No evidence in profile for GraphQL; do not claim it.",
    ]);
  });

  it("supports 'inline' as profile_ref", () => {
    const res = buildCvNotes(job, requirements, seniorProfile, "inline");
    expect(res.profile_ref).toBe("inline");
    expect(() => cvNotesSchema.parse(res)).not.toThrow();
  });

  it("identifies gaps and populates do_not_claim for missing required and preferred skills", () => {
    const res = buildCvNotes(job, requirements, juniorProfile, juniorProfile.profile_id);
    const parsed = cvNotesSchema.parse(res);

    // Junior has TypeScript, but lacks Go, PostgreSQL, Docker, Kubernetes, AWS, GraphQL
    expect(parsed.gaps.length).toBeGreaterThan(0);

    // Must-have missing skills are added to do_not_claim
    expect(parsed.do_not_claim).toContain("No evidence in profile for Go; do not claim it.");
    expect(parsed.do_not_claim).toContain(
      "No evidence in profile for PostgreSQL; do not claim it.",
    );
    expect(parsed.do_not_claim).toContain("No evidence in profile for Docker; do not claim it.");

    // Preferred missing skills are also added to do_not_claim per Fix 5 truthfulness invariant
    expect(parsed.gaps.some((g) => g.missing_skills.includes("Kubernetes"))).toBe(true);
    expect(parsed.do_not_claim).toContain(
      "No evidence in profile for Kubernetes; do not claim it.",
    );
  });

  it("enforces T-08 invariant: every evidence text is an exact substring of the referenced field", () => {
    const res = buildCvNotes(job, requirements, seniorProfile, seniorProfile.profile_id);

    for (const item of res.emphasize) {
      expect(item.profile_evidence.length).toBeGreaterThanOrEqual(1);
      expect(item.profile_evidence.length).toBeLessThanOrEqual(5);

      for (const ev of item.profile_evidence) {
        const sourceVal = resolveFieldPath(seniorProfile, ev.field_path);
        expect(sourceVal, `Path ${ev.field_path} should resolve`).not.toBeNull();
        expect(
          sourceVal?.includes(ev.text),
          `Evidence '${ev.text}' must be exact substring of field '${ev.field_path}'`,
        ).toBe(true);
        expect(ev.text.length).toBeLessThanOrEqual(300);
      }
    }
  });

  it("handles requirements and job with no skills gracefully", () => {
    const emptyJob = createTestJob({ required_skills: [], preferred_skills: [] });
    const emptyReqs = createTestRequirements({
      must_have: [{ text: "Must be a good culture fit", skills: [] }],
      preferred: [{ text: "Nice to have open source contributions", skills: [] }],
    });

    const res = buildCvNotes(emptyJob, emptyReqs, seniorProfile, "inline");
    expect(res.emphasize).toEqual([]);
    expect(res.gaps).toEqual([]);
    expect(res.do_not_claim).toEqual([]);
    expect(res.unassessed).toEqual([
      "Must be a good culture fit",
      "Nice to have open source contributions",
    ]);
  });
});
