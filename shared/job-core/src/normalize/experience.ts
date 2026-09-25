import type { Experience, ProviderId, Warning } from "../schemas/index.js";
import { canonicalExperienceText } from "./provider-hints.js";

export interface Parsed<T> {
  value: T;
  warning?: Warning;
}

const unknown = (raw: string | null): Experience => ({ min_years: null, max_years: null, raw });

export function parseExperience(
  text: string | undefined,
  provider: ProviderId,
): Parsed<Experience> {
  if (!text?.trim()) return { value: unknown(null) };
  const canonical = canonicalExperienceText(provider, text);
  if (/\bfresher\b/i.test(canonical))
    return { value: { min_years: 0, max_years: 1, raw: "fresher" } };
  const range = /\b(\d{1,2})\s*[-–]\s*(\d{1,2})\s*years?\b/i.exec(canonical);
  const plus = /\b(\d{1,2})\s*\+\s*years?\b/i.exec(canonical);
  const minimum = /\b(?:minimum|at least)\s*(\d{1,2})\s*years?\b/i.exec(canonical);
  const single = /\b(\d{1,2})\s*years?\b/i.exec(canonical);
  const min = range
    ? Number(range[1])
    : plus
      ? Number(plus[1])
      : minimum
        ? Number(minimum[1])
        : single
          ? Number(single[1])
          : null;
  const max = range ? Number(range[2]) : plus || minimum ? null : min;
  if (min !== null && min <= 60 && (max === null || (max <= 60 && min <= max))) {
    const matched = range?.[0] ?? plus?.[0] ?? minimum?.[0] ?? single?.[0] ?? "";
    return {
      value: {
        min_years: min,
        max_years: max,
        raw: text.trim().length <= 100 ? text.trim() : matched.slice(0, 100),
      },
    };
  }
  return {
    value: unknown(text.slice(0, 100)),
    warning: {
      code: "FIELD_UNPARSED",
      message: "Experience could not be parsed",
      field: "experience",
    },
  };
}
