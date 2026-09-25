/**
 * CV notes builder.
 *
 * Implements truthfulness-focused CV preparation guidance per Doc 16 §3C and Threat Model T-08.
 * Guarantees every profile_evidence.text is an exact substring of the referenced profile field.
 */

import type { ProfileId } from "../schemas/domain.js";
import type { Job, Requirements } from "../schemas/job.js";
import type { Profile } from "../schemas/profile.js";
import { findSkillEvidence } from "./matcher.js";
import {
  type CvNotes,
  type EmphasizeItem,
  type GapItem,
  type ProfileEvidenceItem,
  TRUTHFULNESS_NOTE,
} from "./schemas.js";

/**
 * Builds tailored CV notes mapping candidate evidence to job requirements.
 *
 * Requirements with evidence are emphasized. Gaps are identified honestly.
 * Required skills with no profile evidence are strictly added to do_not_claim.
 */
export function buildCvNotes(
  job: Job,
  requirements: Requirements,
  profile: Profile,
  profileRef: ProfileId,
): CvNotes {
  const emphasize: EmphasizeItem[] = [];
  const gaps: GapItem[] = [];
  const unassessed: string[] = [];
  const missingSkillsWithNoEvidence = new Set<string>();

  // Process must_have requirements
  for (const req of requirements.must_have) {
    if (req.skills.length === 0) {
      unassessed.push(req.text);
      continue;
    }

    const reqEvidence: ProfileEvidenceItem[] = [];
    const missingSkills: string[] = [];
    const seenPaths = new Set<string>();

    for (const skill of req.skills) {
      const evidence = findSkillEvidence(profile, skill, 5);
      if (evidence.length === 0) {
        missingSkills.push(skill);
        missingSkillsWithNoEvidence.add(skill);
      } else {
        for (const item of evidence) {
          if (!seenPaths.has(item.field_path)) {
            seenPaths.add(item.field_path);
            reqEvidence.push(item);
          }
        }
      }
    }

    if (reqEvidence.length > 0) {
      emphasize.push({
        requirement: req.text,
        requirement_kind: "must_have",
        profile_evidence: reqEvidence.slice(0, 5),
      });
    }

    if (missingSkills.length > 0) {
      gaps.push({
        requirement: req.text,
        requirement_kind: "must_have",
        missing_skills: missingSkills,
      });
    }
  }

  // Process preferred requirements
  for (const req of requirements.preferred) {
    if (req.skills.length === 0) {
      unassessed.push(req.text);
      continue;
    }

    const reqEvidence: ProfileEvidenceItem[] = [];
    const missingSkills: string[] = [];
    const seenPaths = new Set<string>();

    for (const skill of req.skills) {
      const evidence = findSkillEvidence(profile, skill, 5);
      if (evidence.length === 0) {
        missingSkills.push(skill);
        missingSkillsWithNoEvidence.add(skill);
      } else {
        for (const item of evidence) {
          if (!seenPaths.has(item.field_path)) {
            seenPaths.add(item.field_path);
            reqEvidence.push(item);
          }
        }
      }
    }

    if (reqEvidence.length > 0) {
      emphasize.push({
        requirement: req.text,
        requirement_kind: "preferred",
        profile_evidence: reqEvidence.slice(0, 5),
      });
    }

    if (missingSkills.length > 0) {
      gaps.push({
        requirement: req.text,
        requirement_kind: "preferred",
        missing_skills: missingSkills,
      });
    }
  }

  // Check top-level required_skills and preferred_skills from Job for any missing skills
  for (const skill of [...job.required_skills, ...job.preferred_skills]) {
    const evidence = findSkillEvidence(profile, skill, 1);
    if (evidence.length === 0) {
      missingSkillsWithNoEvidence.add(skill);
    }
  }

  // Build do_not_claim list for all job skills with no evidence
  const do_not_claim: string[] = [];
  for (const skill of missingSkillsWithNoEvidence) {
    do_not_claim.push(`No evidence in profile for ${skill}; do not claim it.`);
  }

  return {
    job_id: job.job_id,
    profile_ref: profileRef,
    emphasize: emphasize.slice(0, 100),
    gaps: gaps.slice(0, 100),
    do_not_claim: do_not_claim.slice(0, 100),
    unassessed: unassessed.slice(0, 100),
    truthfulness_note: TRUTHFULNESS_NOTE,
  };
}
