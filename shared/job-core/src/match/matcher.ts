/**
 * Symbol-safe skill and phrase matcher for fit-v1 scoring.
 */

import type { Profile } from "../schemas/profile.js";

const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;

export function escapeRegex(text: string): string {
  return text.replace(REGEX_ESCAPE, "\\$&");
}

/**
 * Builds a symbol-safe boundary regex for technical skills.
 * Handles single letters (Go != Google), symbol suffixes (C++, C#),
 * and symbol prefixes (.NET).
 */
export function buildSkillRegex(skill: string): RegExp {
  const trimmed = skill.trim();
  const escaped = escapeRegex(trimmed);
  const leadBoundary = "(?<![A-Za-z0-9_])";
  const lastChar = trimmed.slice(-1);
  const trailBoundary = /[A-Za-z0-9_]/.test(lastChar) ? "(?![A-Za-z0-9_])" : "(?![A-Za-z_+#])";
  return new RegExp(`${leadBoundary}${escaped}${trailBoundary}`, "i");
}

/**
 * Builds a word-boundary regex for deal-breaker phrases.
 */
export function buildWordBoundaryRegex(phrase: string): RegExp {
  const trimmed = phrase.trim();
  const escaped = escapeRegex(trimmed);
  return new RegExp(`(?<![A-Za-z0-9_])${escaped}(?![A-Za-z0-9_])`, "i");
}

/**
 * Determines whether a profile possesses a given skill.
 * A profile "has" a skill if `skills[].name` equals it (case-insensitive),
 * or it appears in `roles[].title` or `roles[].highlights[]` (symbol-safe regex).
 */
export function profileHasSkill(profile: Profile, skill: string): boolean {
  const target = skill.trim().toLowerCase();
  if (!target) {
    return false;
  }

  // 1. Direct match on profile skills (case-insensitive equality)
  for (const s of profile.skills) {
    if (s.name.trim().toLowerCase() === target) {
      return true;
    }
  }

  // 2. Roles title and highlights (symbol-safe regex boundary)
  const regex = buildSkillRegex(skill);
  for (const role of profile.roles) {
    if (regex.test(role.title)) {
      return true;
    }
    for (const highlight of role.highlights) {
      if (regex.test(highlight)) {
        return true;
      }
    }
  }

  return false;
}
