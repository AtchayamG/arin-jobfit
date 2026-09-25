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

  const seenSkills = new Set<string>();

  // Phase 1: Matched must-have requirements (one topic per skill)
  for (const req of requirements.must_have) {
    for (const skill of req.skills) {
      const skillKey = skill.toLowerCase();
      if (seenSkills.has(skillKey)) continue;

      if (findSkillEvidence(profile, skill, 1).length > 0) {
        seenSkills.add(skillKey);
        topics.push({
          topic: truncateText(`Must-Have: ${skill}`, 200),
          source: "jd",
          requirement_ref: truncateText(req.text, 500),
          question_seeds: [
            truncateText(`How have you applied ${skill} in your recent production projects?`, 300),
            truncateText(
              `Describe an architectural challenge or technical trade-off you faced working with ${skill}.`,
              300,
            ),
            truncateText(
              `How do you handle testing, performance optimization, and debugging in ${skill}?`,
              300,
            ),
          ],
          study_pointers: [
            truncateText(`Review system design and production trade-offs involving ${skill}.`, 300),
            truncateText(
              `Prepare concrete quantifiable metrics demonstrating business impact using ${skill}.`,
              300,
            ),
            truncateText(
              `Refresh fundamental concurrency, memory, and performance characteristics in ${skill}.`,
              300,
            ),
          ],
        });
      }
    }
  }

  // Phase 2: Must-have gaps (one topic per missing skill)
  for (const req of requirements.must_have) {
    for (const skill of req.skills) {
      const skillKey = skill.toLowerCase();
      if (seenSkills.has(skillKey)) continue;

      if (findSkillEvidence(profile, skill, 1).length === 0) {
        seenSkills.add(skillKey);
        topics.push({
          topic: truncateText(`Skill Gap: ${skill}`, 200),
          source: "gap",
          requirement_ref: truncateText(req.text, 500),
          question_seeds: [
            truncateText(
              `What is your exposure to ${skill}, and how would you ramp up quickly?`,
              300,
            ),
            truncateText(
              `Which analogous tools or technologies have you used that relate to ${skill}?`,
              300,
            ),
          ],
          study_pointers: [
            truncateText(`prepare a truthful account of your exposure to ${skill}`, 300),
            truncateText(
              `Identify transferable concepts from familiar technologies that accelerate learning ${skill}.`,
              300,
            ),
            truncateText(
              `Review standard reference manuals and core architectural concepts of ${skill}.`,
              300,
            ),
          ],
        });
      }
    }
  }

  // Phase 3: Preferred requirements (one topic per skill)
  for (const req of requirements.preferred) {
    for (const skill of req.skills) {
      const skillKey = skill.toLowerCase();
      if (seenSkills.has(skillKey)) continue;
      seenSkills.add(skillKey);

      const hasMatch = findSkillEvidence(profile, skill, 1).length > 0;

      topics.push({
        topic: truncateText(`Preferred: ${skill}`, 200),
        source: hasMatch ? "jd" : "gap",
        requirement_ref: truncateText(req.text, 500),
        question_seeds: [
          truncateText(
            `How does your experience with ${skill} complement the primary requirements of this role?`,
            300,
          ),
          truncateText(
            `Can you provide an example where knowledge of ${skill} improved system delivery?`,
            300,
          ),
        ],
        study_pointers: hasMatch
          ? [
              truncateText(
                `Prepare specific examples of how you leveraged ${skill} in previous initiatives.`,
                300,
              ),
              truncateText(
                `Highlight how familiarity with ${skill} shortens onboarding time.`,
                300,
              ),
            ]
          : [
              truncateText(`prepare a truthful account of your exposure to ${skill}`, 300),
              truncateText(
                `Review foundational use cases and high-level architecture for ${skill}.`,
                300,
              ),
            ],
      });
    }
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
