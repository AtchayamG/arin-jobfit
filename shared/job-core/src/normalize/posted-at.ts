import type { ProviderId, Warning } from "../schemas/index.js";
import type { Parsed } from "./experience.js";
import { usesDayFirstSlashDates } from "./provider-hints.js";

const months: Record<string, number> = {
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  may: 5,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};
const warning: Warning = {
  code: "FIELD_UNPARSED",
  message: "Posted date is not an absolute date",
  field: "posted_at",
};

function utcDate(year: number, month: number, day: number): string | null {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() + 1 === month &&
    date.getUTCDate() === day
    ? date.toISOString()
    : null;
}

export function parsePostedAt(
  text: string | undefined,
  provider: ProviderId,
): Parsed<string | null> {
  if (!text?.trim()) return { value: null };
  const value = text.trim();
  const isoDay = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (isoDay) {
    const date = utcDate(Number(isoDay[1]), Number(isoDay[2]), Number(isoDay[3]));
    return date ? { value: date } : { value: null, warning };
  }
  const isoTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
    value,
  );
  if (isoTime) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? { value: null, warning } : { value: date.toISOString() };
  }
  const named = /^(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})$/.exec(value);
  if (named) {
    const month = months[(named[2] ?? "").toLowerCase()];
    const date = month ? utcDate(Number(named[3]), month, Number(named[1])) : null;
    return date ? { value: date } : { value: null, warning };
  }
  const slash = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (slash && usesDayFirstSlashDates(provider)) {
    const date = utcDate(Number(slash[3]), Number(slash[2]), Number(slash[1]));
    return date ? { value: date } : { value: null, warning };
  }
  return { value: null, warning };
}
