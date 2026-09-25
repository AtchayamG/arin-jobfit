/**
 * Set Jaccard index computation and precomputed job profile helper.
 */

import type { Job } from "../schemas/job.js";
import { normalizeCompany, extractTitleTokens, extractDescriptionShingles } from "./normalize.js";

export interface PreparedJob {
  job: Job;
  normalizedCompany: string;
  titleTokens: Set<string>;
  descriptionShingles: Set<string>;
}

/**
 * Computes Jaccard similarity index between two sets.
 * J(A, B) = |A ∩ B| / |A ∪ B|.
 */
export function calculateJaccard<T>(setA: Set<T>, setB: Set<T>): number {
  if (setA.size === 0 && setB.size === 0) {
    return 1;
  }
  if (setA.size === 0 || setB.size === 0) {
    return 0;
  }

  let intersection = 0;
  const [smaller, larger] = setA.size <= setB.size ? [setA, setB] : [setB, setA];
  for (const item of smaller) {
    if (larger.has(item)) {
      intersection++;
    }
  }

  const union = setA.size + setB.size - intersection;
  return intersection / union;
}

/**
 * Pre-processes a job for efficient deduplication checks.
 */
export function prepareJob(job: Job): PreparedJob {
  return {
    job,
    normalizedCompany: normalizeCompany(job.company),
    titleTokens: extractTitleTokens(job.title),
    descriptionShingles: extractDescriptionShingles(job.description),
  };
}
