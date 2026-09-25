import type { Compensation, ProviderId } from "../schemas/index.js";
import type { Parsed } from "./experience.js";
import { canonicalCompensationText } from "./provider-hints.js";

const unknown = (raw: string | null): Compensation => ({
  raw,
  currency: null,
  min: null,
  max: null,
  period: "unknown",
  disclosed: false,
});

const amountPattern =
  /([₹$€£])?\s*(\d{1,3}(?:,\d{3})*|\d{1,9})(?:\.(\d{1,2}))?\s*(lakhs?|lacs?|lpa|crores?|cr|l\b)?/i;

export const compensationFragmentPattern =
  /(?:(?:salary|compensation|pay|ctc)\s*[:\-–—]?\s*)?[₹$€£]?\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|lacs?|crores?|cr|l\b)?\s*(?:[-–—]|to)\s*[₹$€£]?\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|lacs?|crores?|cr|l\b|per\s*annum|p\.a\.|per\s*year|a\s*year|per\s*month|per\s*hour)?(?:\s*ctc)?|(?:(?:salary|compensation|pay|ctc)\s*[:\-–—]?\s*)?[₹$€£]?\s*\d+(?:\.\d+)?\s*(?:lpa|lakhs?|lacs?|crores?|cr|l\b|per\s*annum|p\.a\.|per\s*year|a\s*year|per\s*month|per\s*hour)(?:\s*ctc)?/i;

export function extractCompensationFragment(text: string): string | undefined {
  const match = compensationFragmentPattern.exec(text);
  if (!match) return undefined;
  const fragment = match[0].trim().replace(/^(?:salary|compensation|pay|ctc)\s*[:\-–—]?\s*/i, "");
  return fragment.slice(0, 200);
}

function amount(
  text: string,
): { amount: number; currency: string | null; unit: string | null } | null {
  const match = amountPattern.exec(text);
  if (!match) return null;
  const numeric = Number((match[2] ?? "").replace(/,/g, "") + (match[3] ? `.${match[3]}` : ""));
  const rawUnit = match[4]?.toLowerCase() ?? null;
  const isLakh =
    rawUnit === "lakh" ||
    rawUnit === "lakhs" ||
    rawUnit === "lac" ||
    rawUnit === "lacs" ||
    rawUnit === "lpa" ||
    rawUnit === "l";
  const isCrore = rawUnit === "crore" || rawUnit === "crores" || rawUnit === "cr";
  const multiplier = isLakh ? 1e5 : isCrore ? 1e7 : 1;
  const result = Math.round(numeric * multiplier);
  if (!Number.isFinite(result) || result > 1e9) return null;
  const currency =
    match[1] === "₹"
      ? "INR"
      : match[1] === "$"
        ? "USD"
        : match[1] === "€"
          ? "EUR"
          : match[1] === "£"
            ? "GBP"
            : null;
  return {
    amount: result,
    currency,
    unit: isLakh ? "lakh" : isCrore ? "crore" : rawUnit,
  };
}

export function parseCompensation(
  text: string | undefined,
  provider: ProviderId,
): Parsed<Compensation> {
  if (!text?.trim()) return { value: unknown(null) };
  const rawClean = text.trim();
  const unlabelled = rawClean.replace(/^(?:salary|compensation|pay|ctc)\s*[:\-–—]?\s*/i, "");
  const canonical = canonicalCompensationText(provider, unlabelled);
  if (/\bundisclosed\b/i.test(canonical)) return { value: unknown(rawClean.slice(0, 200)) };

  const dash = /\s*[-–—]\s*|\s+to\s+/i.exec(canonical);
  const first = amount(dash ? canonical.slice(0, dash.index) : canonical);
  const second = dash ? amount(canonical.slice(dash.index + dash[0].length)) : null;

  const isIndianContext =
    /\b(?:lakh|lac|crore|lpa|ctc|inr)\b/i.test(canonical) ||
    /[₹]/.test(rawClean) ||
    /\b(?:lpa|ctc)\b/i.test(rawClean);

  const isYearlyIndian =
    /\b(?:lakhs?|lacs?|crores?|cr|lpa|ctc)\b/i.test(canonical) ||
    /\b(?:lpa|ctc|l\b)\b/i.test(rawClean);

  const currency = first?.currency ?? second?.currency ?? (isIndianContext ? "INR" : null);

  const period = /\bper\s*year\b/i.test(canonical)
    ? "year"
    : /\bper\s*month\b/i.test(canonical)
      ? "month"
      : /\bper\s*hour\b/i.test(canonical)
        ? "hour"
        : isYearlyIndian
          ? "year"
          : "unknown";

  if (first && currency && (!dash || second)) {
    const firstUnit = first.unit ?? second?.unit;
    const secondUnit = second?.unit ?? first.unit;
    const adjustedFirst = first.unit
      ? first.amount
      : firstUnit === "lakh"
        ? Math.round(first.amount * 1e5)
        : firstUnit === "crore"
          ? Math.round(first.amount * 1e7)
          : first.amount;
    const adjustedSecond = second
      ? second.unit
        ? second.amount
        : secondUnit === "lakh"
          ? Math.round(second.amount * 1e5)
          : secondUnit === "crore"
            ? Math.round(second.amount * 1e7)
            : second.amount
      : null;
    if (
      adjustedFirst <= 1e9 &&
      (adjustedSecond === null || (adjustedSecond <= 1e9 && adjustedFirst <= adjustedSecond))
    ) {
      return {
        value: {
          raw: rawClean.slice(0, 200),
          currency,
          min: adjustedFirst,
          max: adjustedSecond ?? adjustedFirst,
          period,
          disclosed: true,
        },
      };
    }
  }
  return {
    value: unknown(rawClean.slice(0, 200)),
    warning: {
      code: "FIELD_UNPARSED",
      message: "Compensation could not be parsed",
      field: "compensation",
    },
  };
}
