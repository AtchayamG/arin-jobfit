import { describe, expect, it } from "vitest";
import { buildApplicationHandoff } from "../../src/prepare/handoff.js";
import * as prepareExports from "../../src/prepare/index.js";
import { buildInterviewPlan } from "../../src/prepare/interview.js";
import { buildCvNotes } from "../../src/prepare/cv-notes.js";
import {
  createJuniorProfile,
  createSeniorProfile,
  createTestJob,
  createTestRequirements,
} from "./fixtures.js";

describe("Preparation Builders Determinism", () => {
  const job = createTestJob();
  const requirements = createTestRequirements();
  const seniorProfile = createSeniorProfile();
  const juniorProfile = createJuniorProfile();

  it("buildCvNotes produces strictly deterministic identical outputs", () => {
    const resA1 = buildCvNotes(job, requirements, seniorProfile, seniorProfile.profile_id);
    const resA2 = buildCvNotes(job, requirements, seniorProfile, seniorProfile.profile_id);
    expect(resA1).toEqual(resA2);

    const resB1 = buildCvNotes(job, requirements, juniorProfile, "inline");
    const resB2 = buildCvNotes(job, requirements, juniorProfile, "inline");
    expect(resB1).toEqual(resB2);
  });

  it("buildInterviewPlan produces strictly deterministic identical outputs", () => {
    const resA1 = buildInterviewPlan(job, requirements, seniorProfile);
    const resA2 = buildInterviewPlan(job, requirements, seniorProfile);
    expect(resA1).toEqual(resA2);

    const resB1 = buildInterviewPlan(job, requirements, juniorProfile);
    const resB2 = buildInterviewPlan(job, requirements, juniorProfile);
    expect(resB1).toEqual(resB2);
  });

  it("buildApplicationHandoff produces strictly deterministic identical outputs", () => {
    const res1 = buildApplicationHandoff(job);
    const res2 = buildApplicationHandoff(job);
    expect(res1).toEqual(res2);
  });

  it("exports all expected builders, helpers, and schemas from barrel index", () => {
    expect(typeof prepareExports.buildCvNotes).toBe("function");
    expect(typeof prepareExports.buildInterviewPlan).toBe("function");
    expect(typeof prepareExports.buildApplicationHandoff).toBe("function");
    expect(typeof prepareExports.buildSkillRegex).toBe("function");
    expect(typeof prepareExports.findSkillEvidence).toBe("function");
    expect(typeof prepareExports.resolveFieldPath).toBe("function");
    expect(prepareExports.cvNotesSchema).toBeDefined();
    expect(prepareExports.interviewPlanSchema).toBeDefined();
    expect(prepareExports.applicationHandoffResultSchema).toBeDefined();
    expect(Array.isArray(prepareExports.HUMAN_ONLY_FIELDS)).toBe(true);
    expect(typeof prepareExports.TRUTHFULNESS_NOTE).toBe("string");
  });
});
