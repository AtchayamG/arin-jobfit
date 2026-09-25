/**
 * Type definitions for deduplication module.
 */

import type { Warning } from "../schemas/common.js";

export interface DuplicateGroup {
  job_ids: string[];
  evidence: string[];
}

export interface FindDuplicatesResult {
  groups: DuplicateGroup[];
}

export interface DuplicateMatch {
  job_id: string;
  reason: string;
}

export interface CheckIngestDuplicatesResult {
  duplicates: DuplicateMatch[];
  warnings: Warning[];
}
