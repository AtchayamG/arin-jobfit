/**
 * Barrel export for deduplication module.
 */

export { findDuplicates, checkIngestDuplicates, areDuplicates } from "./dedupe.js";
export { normalizeCompany, extractTitleTokens, extractDescriptionShingles } from "./normalize.js";
export { calculateJaccard, prepareJob } from "./jaccard.js";
export { UnionFind } from "./union-find.js";
export type {
  DuplicateGroup,
  FindDuplicatesResult,
  DuplicateMatch,
  CheckIngestDuplicatesResult,
} from "./types.js";
export type { PreparedJob } from "./jaccard.js";
