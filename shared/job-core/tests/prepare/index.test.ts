import { describe, expect, it } from "vitest";
import * as prepare from "../../src/prepare/index.js";

describe("Prepare module exports", () => {
  it("exports all schemas and constants", () => {
    expect(prepare.cvNotesSchema).toBeDefined();
    expect(prepare.interviewPlanSchema).toBeDefined();
    expect(prepare.applicationHandoffResultSchema).toBeDefined();
    expect(prepare.HUMAN_ONLY_FIELDS).toBeDefined();
    expect(prepare.TRUTHFULNESS_NOTE).toBeDefined();
  });

  it("exports all builder and matcher functions", () => {
    expect(typeof prepare.buildCvNotes).toBe("function");
    expect(typeof prepare.buildInterviewPlan).toBe("function");
    expect(typeof prepare.buildApplicationHandoff).toBe("function");
    expect(typeof prepare.buildSkillRegex).toBe("function");
    expect(typeof prepare.extractSnippet).toBe("function");
    expect(typeof prepare.findSkillEvidence).toBe("function");
    expect(typeof prepare.resolveFieldPath).toBe("function");
  });
});
