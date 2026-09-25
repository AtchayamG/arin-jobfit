/**
 * Interview plan builder.
 *
 * Implements deterministic interview preparation guidance per Doc 16 §3C and Doc 17 §4.
 * Generates topics strictly ordered: matched must-have, must-have gaps, preferred, and top 5 responsibilities.
 * Enforces NO URLs in study pointers and honest-answer pointers on gaps.
 */

import type { Job, Requirements } from "../schemas/job.js";
import type { Profile } from "../schemas/profile.js";
import { findSkillEvidence } from "./matcher.js";
import type { InterviewPlan, InterviewTopic } from "./schemas.js";

function truncateText(text: string, maxLen: number): string {
  return text.slice(0, maxLen);
}

/**
 * Builds a deterministic interview preparation plan with question seeds and study pointers.
 */
export function buildInterviewPlan(
  job: Job,
  requirements: Requirements,
  profile: Profile,
): InterviewPlan {
  const topics: InterviewTopic[] = [];

  // Phase 1: Matched must-have requirements
  for (const req of requirements.must_have) {
    if (req.skills.length === 0) continue;

    const matchedSkills: string[] = [];
    for (const skill of req.skills) {
      if (findSkillEvidence(profile, skill, 1).length > 0) {
        matchedSkills.push(skill);
      }
    }

    if (matchedSkills.length > 0) {
      const primarySkill = matchedSkills[0] as string;
      topics.push({
        topic: truncateText(`Must-Have: ${matchedSkills.join(", ")}`, 200),
        source: "jd",
        requirement_ref: truncateText(req.text, 500),
        question_seeds: [
          truncateText(
            `How have you applied ${primarySkill} in your recent production projects?`,
            300,
          ),
          truncateText(
            `Describe an architectural challenge or technical trade-off you faced working with ${primarySkill}.`,
            300,
          ),
          truncateText(
            `How do you handle testing, performance optimization, and debugging in ${primarySkill}?`,
            300,
          ),
        ],
        study_pointers: [
          truncateText(
            `Review system design and production trade-offs involving ${primarySkill}.`,
            300,
          ),
          truncateText(
            `Prepare concrete quantifiable metrics demonstrating business impact using ${primarySkill}.`,
            300,
          ),
          truncateText(
            `Refresh fundamental concurrency, memory, and performance characteristics in ${primarySkill}.`,
            300,
          ),
        ],
      });
    }
  }

  // Phase 2: Must-have gaps
  for (const req of requirements.must_have) {
    if (req.skills.length === 0) continue;

    const missingSkills: string[] = [];
    for (const skill of req.skills) {
      if (findSkillEvidence(profile, skill, 1).length === 0) {
        missingSkills.push(skill);
      }
    }

    for (const missingSkill of missingSkills) {
      topics.push({
        topic: truncateText(`Skill Gap: ${missingSkill}`, 200),
        source: "gap",
        requirement_ref: truncateText(req.text, 500),
        question_seeds: [
          truncateText(
            `What is your exposure to ${missingSkill}, and how would you ramp up quickly?`,
            300,
          ),
          truncateText(
            `Which analogous tools or technologies have you used that relate to ${missingSkill}?`,
            300,
          ),
        ],
        study_pointers: [
          truncateText(`prepare a truthful account of your exposure to ${missingSkill}`, 300),
          truncateText(
            `Identify transferable concepts from familiar technologies that accelerate learning ${missingSkill}.`,
            300,
          ),
          truncateText(
            `Review standard reference manuals and core architectural concepts of ${missingSkill}.`,
            300,
          ),
        ],
      });
    }
  }

  // Phase 3: Preferred requirements
  for (const req of requirements.preferred) {
    if (req.skills.length === 0) continue;

    const matchedSkills: string[] = [];
    for (const skill of req.skills) {
      if (findSkillEvidence(profile, skill, 1).length > 0) {
        matchedSkills.push(skill);
      }
    }

    const primarySkill = req.skills[0] as string;
    const hasMatch = matchedSkills.length > 0;

    topics.push({
      topic: truncateText(`Preferred: ${req.skills.join(", ")}`, 200),
      source: hasMatch ? "jd" : "gap",
      requirement_ref: truncateText(req.text, 500),
      question_seeds: [
        truncateText(
          `How does your experience with ${primarySkill} complement the primary requirements of this role?`,
          300,
        ),
        truncateText(
          `Can you provide an example where knowledge of ${primarySkill} improved system delivery?`,
          300,
        ),
      ],
      study_pointers: hasMatch
        ? [
            truncateText(
              `Prepare specific examples of how you leveraged ${primarySkill} in previous initiatives.`,
              300,
            ),
            truncateText(
              `Highlight how familiarity with ${primarySkill} shortens onboarding time.`,
              300,
            ),
          ]
        : [
            truncateText(`prepare a truthful account of your exposure to ${primarySkill}`, 300),
            truncateText(
              `Review foundational use cases and high-level architecture for ${primarySkill}.`,
              300,
            ),
          ],
    });
  }

  // Phase 4: Top 5 responsibilities
  const responsibilities =
    job.responsibilities.length > 0 ? job.responsibilities : requirements.responsibilities;

  const topResponsibilities = responsibilities.slice(0, 5);
  for (const resp of topResponsibilities) {
    topics.push({
      topic: truncateText(`Responsibility: ${resp}`, 200),
      source: "jd",
      requirement_ref: truncateText(resp, 500),
      question_seeds: [
        truncateText(`How have you executed responsibilities similar to: ${resp}?`, 300),
        truncateText(
          `What metrics or outcomes did you use to evaluate success when delivering: ${resp}?`,
          300,
        ),
      ],
      study_pointers: [
        truncateText(
          `Structure a STAR method response detailing a project where you drove: ${resp}.`,
          300,
        ),
        truncateText(
          `Identify key stakeholder interactions and collaboration examples related to: ${resp}.`,
          300,
        ),
      ],
    });
  }

  return {
    job_id: job.job_id,
    topics: topics.slice(0, 40),
  };
}
