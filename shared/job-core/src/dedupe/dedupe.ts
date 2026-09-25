/**
 * Core deduplication logic using fingerprint matching and heuristic similarity.
 */

import type { Job } from "../schemas/job.js";
import type { Warning } from "../schemas/common.js";
import type {
  DuplicateGroup,
  FindDuplicatesResult,
  DuplicateMatch,
  CheckIngestDuplicatesResult,
} from "./types.js";
import { calculateJaccard, prepareJob, type PreparedJob } from "./jaccard.js";
import { UnionFind } from "./union-find.js";

/**
 * Checks if two preprocessed jobs are duplicates per Doc 16 §3E.
 * Criteria: identical fingerprint OR (normalized companies equal & non-empty
 * AND title-token Jaccard >= 0.8 AND description 5-shingle Jaccard >= 0.85).
 */
export function areDuplicates(
  a: PreparedJob,
  b: PreparedJob,
): { isDuplicate: true; evidence: string } | { isDuplicate: false; evidence?: undefined } {
  // 1. Identical fingerprint
  if (a.job.fingerprint === b.job.fingerprint) {
    return {
      isDuplicate: true,
      evidence: `Identical fingerprint: ${a.job.fingerprint}`,
    };
  }

  // 2. Heuristic match: both companies must be non-null, non-empty, and identical
  if (!a.normalizedCompany || !b.normalizedCompany || a.normalizedCompany !== b.normalizedCompany) {
    return { isDuplicate: false };
  }

  // Title token Jaccard threshold: 0.8
  const titleJaccard = calculateJaccard(a.titleTokens, b.titleTokens);
  if (titleJaccard < 0.8) {
    return { isDuplicate: false };
  }

  // Description 5-shingle Jaccard threshold: 0.85 (first 20,000 characters)
  const descJaccard = calculateJaccard(a.descriptionShingles, b.descriptionShingles);
  if (descJaccard < 0.85) {
    return { isDuplicate: false };
  }

  return {
    isDuplicate: true,
    evidence: `Heuristic match: company '${a.normalizedCompany}', title similarity ${titleJaccard.toFixed(2)}, description similarity ${descJaccard.toFixed(2)}`,
  };
}

/**
 * Finds groups of duplicate jobs using Union-Find clustering.
 */
export function findDuplicates(jobs: Job[]): FindDuplicatesResult {
  if (jobs.length < 2) {
    return { groups: [] };
  }

  const prepared = jobs.map(prepareJob);
  const uf = new UnionFind(jobs.length);
  const pairEvidence: { i: number; j: number; evidence: string }[] = [];

  for (let i = 0; i < jobs.length; i++) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- bounded array index
    const jobI = prepared[i]!;
    for (let j = i + 1; j < jobs.length; j++) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- bounded array index
      const jobJ = prepared[j]!;
      const check = areDuplicates(jobI, jobJ);
      if (check.isDuplicate) {
        uf.union(i, j);
        pairEvidence.push({ i, j, evidence: check.evidence });
      }
    }
  }

  const rawGroups = uf.getGroups();
  const groups: DuplicateGroup[] = [];

  for (const [, indices] of rawGroups) {
    if (indices.length >= 2) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- bounded array index
      const groupJobIds = indices.map((idx) => jobs[idx]!.job_id).sort();
      const indexSet = new Set(indices);
      const evidence = Array.from(
        new Set(
          pairEvidence.filter((p) => indexSet.has(p.i) && indexSet.has(p.j)).map((p) => p.evidence),
        ),
      );

      groups.push({
        job_ids: groupJobIds,
        evidence,
      });
    }
  }

  // Sort groups deterministically by their first job_id
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- group has at least 2 job_ids
  groups.sort((a, b) => a.job_ids[0]!.localeCompare(b.job_ids[0]!));

  return { groups };
}

/**
 * Checks if a newly ingested job duplicates any existing job in the store.
 */
export function checkIngestDuplicates(newJob: Job, existing: Job[]): CheckIngestDuplicatesResult {
  if (existing.length === 0) {
    return { duplicates: [], warnings: [] };
  }

  const prepNew = prepareJob(newJob);
  const duplicates: DuplicateMatch[] = [];

  for (const ex of existing) {
    const prepEx = prepareJob(ex);
    const check = areDuplicates(prepNew, prepEx);
    if (check.isDuplicate) {
      duplicates.push({
        job_id: ex.job_id,
        reason: check.evidence,
      });
    }
  }

  const warnings: Warning[] = [];
  if (duplicates.length > 0) {
    warnings.push({
      code: "DUPLICATE_SUSPECTED",
      message: `Job appears to be a duplicate of existing job(s): ${duplicates.map((d) => d.job_id).join(", ")}`,
    });
  }

  return { duplicates, warnings };
}
