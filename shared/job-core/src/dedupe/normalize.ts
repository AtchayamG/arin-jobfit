/**
 * Normalization utilities for company names, job titles, and description shingles.
 */

const CORP_SUFFIX_REGEX =
  /\b(private\s+limited|pvt\s+ltd|pvt|private|limited|ltd|incorporated|inc|llc|corporation|corp)\b/gi;

/**
 * Normalizes a company name for deduplication.
 * Converts to lowercase, strips corporate suffixes (pvt ltd, inc, llc, corp, etc.),
 * strips punctuation, and normalizes whitespace.
 */
export function normalizeCompany(company: string | null | undefined): string {
  if (!company) {
    return "";
  }
  const clean = company
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(CORP_SUFFIX_REGEX, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return clean;
}

/**
 * Extracts normalized alphanumeric tokens from a job title.
 */
export function extractTitleTokens(title: string): Set<string> {
  if (!title) {
    return new Set();
  }
  const tokens = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  return new Set(tokens);
}

/**
 * Extracts 5-word shingles from the first 20,000 characters of a job description.
 */
export function extractDescriptionShingles(description: string, maxChars = 20_000): Set<string> {
  if (!description) {
    return new Set();
  }

  const truncated = description.slice(0, maxChars);
  const words = truncated
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) {
    return new Set();
  }

  if (words.length < 5) {
    return new Set([words.join(" ")]);
  }

  const shingles = new Set<string>();
  const limit = words.length - 5;
  for (let i = 0; i <= limit; i++) {
    shingles.add(words.slice(i, i + 5).join(" "));
  }

  return shingles;
}
