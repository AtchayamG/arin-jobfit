/**
 * Barrel export for fit-v1 matching module.
 */

export { computeFit } from "./fit.js";
export { explainMatch } from "./explain.js";
export { shortlist } from "./shortlist.js";
export { buildSkillRegex, buildWordBoundaryRegex, profileHasSkill } from "./matcher.js";
export type {
  ComputeFitOptions,
  ComputeFitOutput,
  ExplainMatchDimension,
  ExplainMatchResult,
  ShortlistOptions,
  ShortlistRankedItem,
  ShortlistResult,
} from "./types.js";
