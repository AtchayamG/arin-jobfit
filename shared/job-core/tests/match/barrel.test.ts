/**
 * Barrel export verification test for match module.
 */

import { describe, it, expect } from "vitest";
import * as MatchModule from "../../src/match/index.js";
import * as DimensionsModule from "../../src/match/dimensions.js";

describe("match barrel exports", () => {
  it("exports all public match functions and utilities", () => {
    expect(typeof MatchModule.computeFit).toBe("function");
    expect(typeof MatchModule.explainMatch).toBe("function");
    expect(typeof MatchModule.shortlist).toBe("function");
    expect(typeof MatchModule.buildSkillRegex).toBe("function");
    expect(typeof MatchModule.buildWordBoundaryRegex).toBe("function");
    expect(typeof MatchModule.profileHasSkill).toBe("function");
  });

  it("exports all dimension calculators from dimensions barrel", () => {
    expect(typeof DimensionsModule.calculateMustHaveSkills).toBe("function");
    expect(typeof DimensionsModule.calculatePreferredSkills).toBe("function");
    expect(typeof DimensionsModule.calculateDomain).toBe("function");
    expect(typeof DimensionsModule.calculateExperience).toBe("function");
    expect(typeof DimensionsModule.calculateSeniority).toBe("function");
    expect(typeof DimensionsModule.calculateLocationRemote).toBe("function");
    expect(typeof DimensionsModule.calculateEmploymentType).toBe("function");
  });
});
