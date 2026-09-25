/**
 * Symbol-safe skill matcher and profile evidence resolver.
 *
 * Implements deterministic evidence search and guarantees the T-08 truthfulness invariant:
 * every profile_evidence.text is an exact substring of the value at field_path.
 */

import type { Profile } from "../schemas/profile.js";
import type { ProfileEvidenceItem } from "./schemas.js";

const REGEX_ESCAPE = /[.*+?^${}()|[\]\\]/g;

/**
 * Builds a symbol-safe boundary regex for technical skills.
 * Handles single letters (Go != Google), symbol suffixes (C++, C#),
 * and symbol prefixes (.NET).
 */
export function buildSkillRegex(skill: string): RegExp {
  const trimmed = skill.trim();
  const escaped = trimmed.replace(REGEX_ESCAPE, "\\$&");
  const leadBoundary = "(?<![A-Za-z0-9_])";
  const lastChar = trimmed.slice(-1);
  const trailBoundary = /[A-Za-z0-9_]/.test(lastChar) ? "(?![A-Za-z0-9_])" : "(?![A-Za-z_+#])";
  return new RegExp(`${leadBoundary}${escaped}${trailBoundary}`, "i");
}

/**
 * Extracts a substring of at most maxLen characters from source surrounding the match.
 * Always returns an exact substring of source.
 */
export function extractSnippet(
  source: string,
  matchIndex: number,
  matchLength: number,
  maxLen = 300,
): string {
  if (source.length <= maxLen) {
    return source;
  }
  const half = Math.floor((maxLen - matchLength) / 2);
  let start = Math.max(0, matchIndex - half);
  let end = start + maxLen;
  if (end > source.length) {
    end = source.length;
    start = Math.max(0, end - maxLen);
  }
  return source.slice(start, end);
}

/**
 * Searches a profile for evidence of a skill across:
 * 1. skills[i].name (equality)
 * 2. roles[i].title
 * 3. roles[i].highlights[j]
 * 4. certifications[i].name
 * 5. education[i].qualification
 * 6. summary_text
 *
 * Returns up to maxEvidence items.
 */
export function findSkillEvidence(
  profile: Profile,
  skill: string,
  maxEvidence = 5,
): readonly ProfileEvidenceItem[] {
  const results: ProfileEvidenceItem[] = [];
  const targetLower = skill.trim().toLowerCase();
  const regex = buildSkillRegex(skill);

  // 1. skills[i].name (exact case-insensitive equality)
  for (const [i, s] of profile.skills.entries()) {
    if (s.name.trim().toLowerCase() === targetLower) {
      results.push({
        field_path: `skills[${String(i)}].name`,
        text: s.name,
      });
    }
  }

  // 2. roles[i].title & highlights[j]
  for (const [i, r] of profile.roles.entries()) {
    const titleMatch = regex.exec(r.title);
    if (titleMatch) {
      results.push({
        field_path: `roles[${String(i)}].title`,
        text: extractSnippet(r.title, titleMatch.index, titleMatch[0].length),
      });
    }

    for (const [j, h] of r.highlights.entries()) {
      const hMatch = regex.exec(h);
      if (hMatch) {
        results.push({
          field_path: `roles[${String(i)}].highlights[${String(j)}]`,
          text: extractSnippet(h, hMatch.index, hMatch[0].length),
        });
      }
    }
  }

  // 3. certifications[i].name
  for (const [i, c] of profile.certifications.entries()) {
    const certMatch = regex.exec(c.name);
    if (certMatch) {
      results.push({
        field_path: `certifications[${String(i)}].name`,
        text: extractSnippet(c.name, certMatch.index, certMatch[0].length),
      });
    }
  }

  // 4. education[i].qualification
  for (const [i, e] of profile.education.entries()) {
    const eduMatch = regex.exec(e.qualification);
    if (eduMatch) {
      results.push({
        field_path: `education[${String(i)}].qualification`,
        text: extractSnippet(e.qualification, eduMatch.index, eduMatch[0].length),
      });
    }
  }

  // 5. summary_text
  if (profile.summary_text) {
    const sumMatch = regex.exec(profile.summary_text);
    if (sumMatch) {
      results.push({
        field_path: "summary_text",
        text: extractSnippet(profile.summary_text, sumMatch.index, sumMatch[0].length),
      });
    }
  }

  return results.slice(0, maxEvidence);
}

/**
 * Resolves a field path against a Profile, returning the string value if found.
 */
export function resolveFieldPath(profile: Profile, fieldPath: string): string | null {
  if (fieldPath === "summary_text") {
    return profile.summary_text;
  }

  const skillMatch = /^skills\[(\d+)\]\.name$/.exec(fieldPath);
  if (skillMatch?.[1] !== undefined) {
    const idx = parseInt(skillMatch[1], 10);
    return profile.skills[idx]?.name ?? null;
  }

  const roleTitleMatch = /^roles\[(\d+)\]\.title$/.exec(fieldPath);
  if (roleTitleMatch?.[1] !== undefined) {
    const idx = parseInt(roleTitleMatch[1], 10);
    return profile.roles[idx]?.title ?? null;
  }

  const roleHighlightMatch = /^roles\[(\d+)\]\.highlights\[(\d+)\]$/.exec(fieldPath);
  if (roleHighlightMatch?.[1] !== undefined && roleHighlightMatch[2] !== undefined) {
    const rIdx = parseInt(roleHighlightMatch[1], 10);
    const hIdx = parseInt(roleHighlightMatch[2], 10);
    return profile.roles[rIdx]?.highlights[hIdx] ?? null;
  }

  const certMatch = /^certifications\[(\d+)\]\.name$/.exec(fieldPath);
  if (certMatch?.[1] !== undefined) {
    const idx = parseInt(certMatch[1], 10);
    return profile.certifications[idx]?.name ?? null;
  }

  const eduMatch = /^education\[(\d+)\]\.qualification$/.exec(fieldPath);
  if (eduMatch?.[1] !== undefined) {
    const idx = parseInt(eduMatch[1], 10);
    return profile.education[idx]?.qualification ?? null;
  }

  return null;
}
