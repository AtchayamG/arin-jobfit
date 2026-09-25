/**
 * Type definitions for fit-v1 matching, explanation, and shortlisting.
 */

import type { MatchDimension, MatchResult } from "../schemas/match.js";
import type { Warning } from "../schemas/common.js";

export interface ComputeFitOptions {
  profileRef?: string | undefined;
  skillCategory?: ((skill: string) => string | null) | undefined;
}

export interface ComputeFitOutput {
  result: MatchResult;
  warnings: Warning[];
}

export interface ExplainMatchDimension {
  name: MatchDimension["name"];
  evidence: string[];
  gaps: string[];
}

export interface ExplainMatchResult {
  summary_facts: string[];
  dimensions: ExplainMatchDimension[];
  disclaimer: string;
}

export interface ShortlistOptions {
  limit?: number | undefined;
  profileRef?: string | undefined;
  skillCategory?: ((skill: string) => string | null) | undefined;
}

export interface ShortlistRankedItem {
  job_id: string;
  fit_score: number;
  band: "strong" | "moderate" | "weak";
  top_reasons: string[];
  blockers: string[];
}

export interface ShortlistResult {
  ranked: ShortlistRankedItem[];
}
