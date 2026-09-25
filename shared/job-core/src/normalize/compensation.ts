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
const amountPattern = /([₹$])?\s*(\d{1,3}(?:,\d{3})*|\d{1,9})(?:\.(\d{1,2}))?\s*(lakh|lac|crore)?/i;

function amount(
  text: string,
): { amount: number; currency: string | null; unit: string | null } | null {
  const match = amountPattern.exec(text);
  if (!match) return null;
  const numeric = Number((match[2] ?? "").replace(/,/g, "") + (match[3] ? `.${match[3]}` : ""));
  const unit = match[4]?.toLowerCase() ?? null;
  const multiplier = unit === "lakh" || unit === "lac" ? 1e5 : unit === "crore" ? 1e7 : 1;
  const result = Math.round(numeric * multiplier);
  if (!Number.isFinite(result) || result > 1e9) return null;
  return {
    amount: result,
    currency: match[1] === "₹" ? "INR" : match[1] === "$" ? "USD" : null,
    unit,
  };
}

export function parseCompensation(
  text: string | undefined,
  provider: ProviderId,
): Parsed<Compensation> {
  if (!text?.trim()) return { value: unknown(null) };
  const canonical = canonicalCompensationText(provider, text);
  if (/\bundisclosed\b/i.test(canonical)) return { value: unknown(text.slice(0, 200)) };
  const dash = /\s*[-–]\s*/.exec(canonical);
  const first = amount(dash ? canonical.slice(0, dash.index) : canonical);
  const second = dash ? amount(canonical.slice(dash.index + dash[0].length)) : null;
  const currency =
    first?.currency ??
    second?.currency ??
    (/\b(?:lakh|lac|crore)\b/i.test(canonical) ? "INR" : null);
  const period = /\bper\s*year\b/i.test(canonical)
    ? "year"
    : /\bper\s*month\b/i.test(canonical)
      ? "month"
      : /\bper\s*hour\b/i.test(canonical)
        ? "hour"
        : /\b(?:lakh|lac|crore)\b/i.test(canonical)
          ? "year"
          : "unknown";
  if (first && currency && (!dash || second)) {
    const firstUnit = first.unit ?? second?.unit;
    const secondUnit = second?.unit ?? first.unit;
    const adjustedFirst = first.unit
      ? first.amount
      : firstUnit === "lakh" || firstUnit === "lac"
        ? Math.round(first.amount * 1e5)
        : firstUnit === "crore"
          ? Math.round(first.amount * 1e7)
          : first.amount;
    const adjustedSecond = second
      ? second.unit
        ? second.amount
        : secondUnit === "lakh" || secondUnit === "lac"
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
          raw: text.slice(0, 200),
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
    value: unknown(text.slice(0, 200)),
    warning: {
      code: "FIELD_UNPARSED",
      message: "Compensation could not be parsed",
      field: "compensation",
    },
  };
}
