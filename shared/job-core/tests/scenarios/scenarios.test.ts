import { describe, expect, it } from "vitest";
import { normalizeAndExtract } from "../../src/extract/index.js";
import { computeFit } from "../../src/match/index.js";
import {
  buildApplicationHandoff,
  buildCvNotes,
  buildInterviewPlan,
} from "../../src/prepare/index.js";
import { resolveFieldPath } from "../../src/prepare/matcher.js";
import { cvNotesSchema, interviewPlanSchema } from "../../src/prepare/schemas.js";
import { detectInjection, sanitizeText } from "../../src/sanitize/index.js";
import {
  jobInputSchema,
  jobSchema,
  matchResultSchema,
  profileSchema,
  requirementsSchema,
  type JobInput,
} from "../../src/schemas/index.js";
import { SCENARIO_PAIRS, type ScenarioPair } from "./fixtures.js";

describe("WP-QA-002: Automated real-world scenario suite (24 JD×Profile pairs)", () => {
  it.each(SCENARIO_PAIRS)(
    "executes scenario $id ($jd.name + $profile.label)",
    (pair: ScenarioPair) => {
      const { jd, profile, expectedFitBand, expectedMissingSkills } = pair;

      // 1. Schema validations on inputs
      const input = jobInputSchema.parse(jd.input);
      const validProfile = profileSchema.parse(profile);

      // 2. Normalization & extraction pipeline (with text sanitization per pipeline flow)
      const sanitizedDesc = sanitizeText(input.description, {
        field: "description",
        maxLength: 50_000,
      });
      if (!sanitizedDesc.ok) {
        throw new Error(`Sanitization failed: ${sanitizedDesc.code}`);
      }
      const sanitizedInput: JobInput = {
        ...input,
        description: sanitizedDesc.text,
      };

      const { job, requirements, warnings } = normalizeAndExtract(sanitizedInput, {
        provider: jd.provider,
        now: new Date("2026-09-25T12:00:00Z"),
        url: { value: jd.input.source_url ?? null, isOfficial: true },
        provenance: [
          {
            kind: "user_supplied",
            detail: "QA scenario test",
            captured_at: "2026-09-25T12:00:00Z",
          },
        ],
      });

      expect(() => jobSchema.parse(job)).not.toThrow();
      expect(() => requirementsSchema.parse(requirements)).not.toThrow();

      // 2A. Stable JD Extraction Assertions
      for (const skill of jd.expected.required_skills_superset) {
        expect(
          job.required_skills,
          `Expected job.required_skills to include '${skill}' in ${jd.id}`,
        ).toContain(skill);
      }

      if (jd.expected.preferred_skills_superset) {
        for (const skill of jd.expected.preferred_skills_superset) {
          expect(
            job.preferred_skills,
            `Expected job.preferred_skills to include '${skill}' in ${jd.id}`,
          ).toContain(skill);
        }
      }

      expect([job.experience.min_years, job.experience.max_years]).toEqual(jd.expected.experience);

      expect({
        currency: job.compensation.currency,
        min: job.compensation.min,
        max: job.compensation.max,
        period: job.compensation.period,
        disclosed: job.compensation.disclosed,
      }).toEqual(jd.expected.compensation);

      if (jd.expected.city) {
        expect(job.location.city).toMatch(new RegExp(jd.expected.city, "i"));
      } else {
        expect(job.location.city).toBeNull();
      }
      expect(job.location.country).toBe(jd.expected.country);
      expect(job.remote_mode).toBe(jd.expected.remote_mode);
      expect(job.employment_type).toBe(jd.expected.employment_type);

      // 2B. Discriminatory requirements validation
      if (jd.expected.discriminatory_categories) {
        const detectedCategories = requirements.discriminatory_flags.map((f) => f.category);
        for (const cat of jd.expected.discriminatory_categories) {
          expect(detectedCategories).toContain(cat);
        }
        expect(warnings.map((w) => w.code)).toContain("POTENTIALLY_DISCRIMINATORY_REQUIREMENT");

        // Verify discriminatory requirements are strictly excluded from must_have and preferred
        const allReqTexts = [...requirements.must_have, ...requirements.preferred].map(
          (r) => r.text,
        );
        for (const flag of requirements.discriminatory_flags) {
          expect(allReqTexts).not.toContain(flag.text);
        }
      }

      // 2C. Hostile JD / Security Warning validations
      if (jd.expected.warning_codes) {
        if (jd.expected.warning_codes.includes("PROMPT_INJECTION_SUSPECTED")) {
          const injection = detectInjection(job.description);
          expect(injection.suspected).toBe(true);
        }
      }

      // 3. Compute Fit
      const fit = computeFit(job, requirements, validProfile);
      expect(() => matchResultSchema.parse(fit.result)).not.toThrow();
      expect(fit.result.band).toBe(expectedFitBand);
      expect(fit.result.dimensions).toHaveLength(7);

      if (
        requirements.must_have.length > 0 &&
        requirements.must_have.some((r) => r.skills.length > 0)
      ) {
        const mustHaveDim = fit.result.dimensions.find((d) => d.name === "must_have_skills");
        expect(mustHaveDim).toBeDefined();
        expect(mustHaveDim?.status).not.toBe("unknown");
      }

      // 4. Build CV Notes
      const cvNotes = buildCvNotes(job, requirements, validProfile, validProfile.profile_id);
      expect(() => cvNotesSchema.parse(cvNotes)).not.toThrow();

      // Verify expected missing skills are flagged in do_not_claim
      for (const missingSkill of expectedMissingSkills) {
        const hasDoNotClaim = cvNotes.do_not_claim.some((claim) =>
          claim.includes(`No evidence in profile for ${missingSkill}; do not claim it.`),
        );
        expect(
          hasDoNotClaim,
          `Expected '${missingSkill}' in do_not_claim for scenario ${pair.id}`,
        ).toBe(true);
      }

      // T-08 Substring invariant: no fabricated evidence text
      for (const item of cvNotes.emphasize) {
        for (const ev of item.profile_evidence) {
          const sourceVal = resolveFieldPath(validProfile, ev.field_path);
          expect(sourceVal, `Field path ${ev.field_path} should resolve`).not.toBeNull();
          expect(
            sourceVal?.includes(ev.text),
            `Evidence '${ev.text}' must be exact substring of field '${ev.field_path}'`,
          ).toBe(true);
        }
      }

      // 5. Build Interview Plan
      const interviewPlan = buildInterviewPlan(job, requirements, validProfile);
      expect(() => interviewPlanSchema.parse(interviewPlan)).not.toThrow();
      expect(interviewPlan.topics.length).toBeLessThanOrEqual(40);

      // Topic ordering invariant: Must-Have -> Skill Gap -> Preferred -> Responsibility
      let stage = 0;
      for (const topic of interviewPlan.topics) {
        const prefix = topic.topic.split(":")[0];
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

      // Gap topics must contain honest answer pointer
      const gapTopics = interviewPlan.topics.filter((t) => t.source === "gap");
      for (const gap of gapTopics) {
        const hasHonestPointer = gap.study_pointers.some((p) =>
          p.toLowerCase().includes("prepare a truthful account of your exposure to"),
        );
        expect(hasHonestPointer).toBe(true);
      }

      // 6. Build Application Handoff
      const handoff = buildApplicationHandoff(job);
      expect(handoff.data.human_only_fields).toContain("final_submit");
      expect(handoff.data.checklist.length).toBeGreaterThan(0);
      expect(handoff.humanAction.reason).toBeDefined();
      expect(handoff.humanAction.actions.length).toBeGreaterThan(0);
    },
  );
});

describe("DEFECTS discovered by automated real-world scenarios", () => {
  it.fails(
    "DEFECT-001: Indian numbering comma format '₹16,00,000 - ₹24,00,000' parses min=16 instead of 1600000",
    () => {
      // Input: compensation_text with Indian comma grouping (lakhs 2-digit comma grouping: 16,00,000)
      // Expected: min=1600000, max=2400000
      // Actual: min=16, max=24 because amountPattern assumes western 3-digit comma grouping (\d{1,3}(?:,\d{3})*)
      const { job } = normalizeAndExtract(
        {
          title: "Backend Engineer - Java & Cloud",
          description: "Requirements: Java, Spring Boot. Full time.",
          compensation_text: "₹16,00,000 - ₹24,00,000 a year",
          origin: "user_paste",
        },
        {
          provider: "indeed",
          now: new Date("2026-09-25T12:00:00Z"),
          url: { value: null, isOfficial: false },
          provenance: [],
        },
      );
      expect(job.compensation.min).toBe(1600000);
      expect(job.compensation.max).toBe(2400000);
    },
  );
});
