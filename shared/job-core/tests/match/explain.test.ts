/**
 * Unit tests for explainMatch transformer.
 */

import { describe, it, expect } from "vitest";
import { createTestJob, createTestRequirements, createTestProfile } from "./fixtures.js";
import { computeFit } from "../../src/match/fit.js";
import { explainMatch } from "../../src/match/explain.js";

describe("explainMatch", () => {
  it("generates comprehensive explanation facts, dimension breakdown, and disclaimer", () => {
    const job = createTestJob();
    const req = createTestRequirements();
    const profile = createTestProfile();

    const { result } = computeFit(job, req, profile);
    const explanation = explainMatch(result);

    expect(explanation.disclaimer).toBe(
      "Decision support only; not a prediction of hiring outcome.",
    );
    expect(explanation.summary_facts.length).toBeGreaterThanOrEqual(3);
    expect(explanation.summary_facts[0]).toContain("Overall fit score");
    expect(explanation.summary_facts[1]).toContain("Confidence level");
    expect(explanation.summary_facts[2]).toContain("Dimension summary");

    expect(explanation.dimensions.length).toBe(7);
    for (const dim of explanation.dimensions) {
      expect(typeof dim.name).toBe("string");
      expect(Array.isArray(dim.evidence)).toBe(true);
      expect(Array.isArray(dim.gaps)).toBe(true);
    }
  });

  it("includes blocker fact when deal-breakers are triggered", () => {
    const job = createTestJob({ title: "Casino Operations Lead" });
    const req = createTestRequirements();
    const profile = createTestProfile({
      preferences: {
        locations: ["Bangalore"],
        remote_modes: ["hybrid"],
        employment_types: ["full_time"],
        deal_breakers: ["casino"],
      },
    });

    const { result } = computeFit(job, req, profile);
    const explanation = explainMatch(result);

    expect(result.blockers.length).toBe(1);
    expect(explanation.summary_facts.some((fact) => fact.includes("deal-breaker blocker"))).toBe(
      true,
    );
  });
});
