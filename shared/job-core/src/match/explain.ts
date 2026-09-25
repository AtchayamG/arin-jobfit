/**
 * Pure transformer to explain a fit-v1 MatchResult.
 */

import type { MatchResult } from "../schemas/match.js";
import type { ExplainMatchResult } from "./types.js";

/**
 * Transforms a MatchResult into human-readable explanation facts and dimension summaries.
 * Pure function, zero side-effects.
 */
export function explainMatch(result: MatchResult): ExplainMatchResult {
  const matched = result.dimensions.filter((d) => d.status === "matched").length;
  const partial = result.dimensions.filter((d) => d.status === "partial").length;
  const missing = result.dimensions.filter((d) => d.status === "missing").length;
  const unknown = result.dimensions.filter((d) => d.status === "unknown").length;

  const summaryFacts: string[] = [
    `Overall fit score: ${String(Math.round(result.fit_score * 100))}% (${result.band} match)`,
    `Confidence level: ${String(Math.round(result.confidence * 100))}% based on known job dimensions`,
    `Dimension summary: ${String(matched)} matched, ${String(partial)} partial, ${String(missing)} missing, ${String(unknown)} unknown`,
  ];

  if (result.blockers.length > 0) {
    summaryFacts.push(
      `Score capped at 0.30 due to ${String(result.blockers.length)} deal-breaker blocker(s)`,
    );
  }

  const dimensions = result.dimensions.map((d) => ({
    name: d.name,
    evidence: d.evidence,
    gaps: d.gaps,
  }));

  return {
    summary_facts: summaryFacts,
    dimensions,
    disclaimer: result.disclaimer,
  };
}
