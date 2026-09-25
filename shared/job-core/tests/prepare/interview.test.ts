import { describe, expect, it } from "vitest";
import { buildInterviewPlan } from "../../src/prepare/interview.js";
import { interviewPlanSchema } from "../../src/prepare/schemas.js";
import {
  createJuniorProfile,
  createSeniorProfile,
  createTestJob,
  createTestRequirements,
} from "./fixtures.js";

describe("buildInterviewPlan", () => {
  const job = createTestJob();
  const requirements = createTestRequirements();
  const seniorProfile = createSeniorProfile();
  const juniorProfile = createJuniorProfile();

  it("builds a schema-valid interview plan with deterministic ordering", () => {
    const res = buildInterviewPlan(job, requirements, seniorProfile);
    const parsed = interviewPlanSchema.parse(res);

    expect(parsed.job_id).toBe(job.job_id);
    expect(parsed.topics.length).toBeGreaterThan(0);
    expect(parsed.topics.length).toBeLessThanOrEqual(40);

    // Verify ordering:
    // First: matched must-have (source: jd, topic starts with Must-Have)
    // Then: must-have gaps (source: gap, topic starts with Skill Gap)
    // Then: preferred (topic starts with Preferred)
    // Then: responsibilities (source: jd, topic starts with Responsibility)
    const topicPrefixes = parsed.topics.map((t) => t.topic.split(":")[0]);

    let stage = 0; // 0 = Must-Have, 1 = Skill Gap, 2 = Preferred, 3 = Responsibility
    for (const prefix of topicPrefixes) {
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
  });

  it("enforces NO URLs anywhere in study pointers", () => {
    const resSenior = buildInterviewPlan(job, requirements, seniorProfile);
    const resJunior = buildInterviewPlan(job, requirements, juniorProfile);

    for (const res of [resSenior, resJunior]) {
      for (const topic of res.topics) {
        expect(topic.study_pointers.length).toBeGreaterThan(0);
        expect(topic.study_pointers.length).toBeLessThanOrEqual(5);

        for (const pointer of topic.study_pointers) {
          expect(pointer).not.toMatch(/https?:\/\//i);
          expect(pointer.length).toBeLessThanOrEqual(300);
        }
      }
    }
  });

  it("includes honest-answer pointer on gap topics", () => {
    const res = buildInterviewPlan(job, requirements, juniorProfile);
    const gapTopics = res.topics.filter((t) => t.source === "gap");

    expect(gapTopics.length).toBeGreaterThan(0);
    for (const gap of gapTopics) {
      const hasHonestPointer = gap.study_pointers.some((p) =>
        p.toLowerCase().includes("prepare a truthful account of your exposure to"),
      );
      expect(hasHonestPointer, `Gap topic '${gap.topic}' must carry honest-answer pointer`).toBe(
        true,
      );
    }
  });

  it("falls back to requirements.responsibilities when job.responsibilities is empty", () => {
    const jobNoResp = createTestJob({ responsibilities: [] });
    const res = buildInterviewPlan(jobNoResp, requirements, seniorProfile);

    const respTopics = res.topics.filter((t) => t.topic.startsWith("Responsibility:"));
    expect(respTopics.length).toBe(3);
    expect(respTopics[0]?.requirement_ref).toBe(requirements.responsibilities[0]);
  });

  it("limits topics to at most 40 when requirements are very large", () => {
    const largeReqs = createTestRequirements({
      must_have: Array.from({ length: 30 }, (_, i) => ({
        text: `Requirement ${String(i)}`,
        skills: [`Skill${String(i)}`],
      })),
      preferred: Array.from({ length: 30 }, (_, i) => ({
        text: `Preferred ${String(i)}`,
        skills: [`PrefSkill${String(i)}`],
      })),
    });

    const res = buildInterviewPlan(job, largeReqs, seniorProfile);
    expect(res.topics.length).toBeLessThanOrEqual(40);
    expect(() => interviewPlanSchema.parse(res)).not.toThrow();
  });
});
