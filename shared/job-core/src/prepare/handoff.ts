/**
 * Application handoff builder.
 *
 * Implements human-in-the-loop application preparation per Doc 16 §3C, Doc 17 §4, and Threat Model T-16.
 * Enforces human-only fields and NEVER performs autonomous application submission.
 */

import type { Warning } from "../schemas/common.js";
import type { Job } from "../schemas/job.js";
import { type ApplicationHandoffResult, HUMAN_ONLY_FIELDS } from "./schemas.js";

/**
 * Builds the application handoff package directing the human user to finalize their application on the portal.
 */
export function buildApplicationHandoff(job: Job): ApplicationHandoffResult {
  const checklist: string[] = [];

  if (job.source_url === null) {
    checklist.push("Open the listing on the official portal yourself");
  } else if (job.source_url_is_official) {
    checklist.push(`Open the listing on the official portal: ${job.source_url}`);
  } else {
    checklist.push(`Review the listing at source URL: ${job.source_url}`);
  }

  checklist.push(
    "Verify required skills and qualifications against your profile",
    "Prepare tailored CV emphasizing matched strengths and evidence",
    "Review interview preparation plan and gap mitigation talking points",
    "Complete screening questions truthfully on the portal",
    "Confirm and declare compensation expectations",
    "Verify and submit current notice period and availability date",
    "Perform final human review and submit application manually on portal",
  );

  const warnings: Warning[] = [];
  if (job.source_url !== null && !job.source_url_is_official) {
    warnings.push({
      code: "URL_NOT_OFFICIAL",
      message: "Job source URL is not from an official portal allowlist",
      field: "source_url",
    });
  }

  const humanAction = {
    reason: "Application submission requires manual human review and completion on the portal",
    actions: [
      "Review job listing details",
      "Complete screening questions",
      "Confirm salary expectations",
      "Verify notice period",
      "Manually submit application",
    ],
    official_url: job.source_url_is_official ? job.source_url : null,
  };

  return {
    data: {
      official_url: job.source_url,
      url_is_official: job.source_url_is_official,
      checklist,
      human_only_fields: [...HUMAN_ONLY_FIELDS],
    },
    humanAction,
    warnings,
  };
}
