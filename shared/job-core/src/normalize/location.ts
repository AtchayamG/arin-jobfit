import type { Location } from "../schemas/index.js";
import type { Parsed } from "./experience.js";

export const indianCities = [
  "ahmedabad",
  "ajmer",
  "amritsar",
  "aurangabad",
  "bengaluru",
  "bangalore",
  "bhopal",
  "bhubaneswar",
  "chandigarh",
  "chennai",
  "coimbatore",
  "dehradun",
  "delhi",
  "ncr",
  "faridabad",
  "ghaziabad",
  "goa",
  "gurugram",
  "gurgaon",
  "guwahati",
  "hyderabad",
  "indore",
  "jaipur",
  "jalandhar",
  "jamshedpur",
  "jodhpur",
  "kanpur",
  "kochi",
  "kolkata",
  "lucknow",
  "ludhiana",
  "madurai",
  "mangalore",
  "mumbai",
  "mysuru",
  "mysore",
  "nagpur",
  "nashik",
  "noida",
  "patna",
  "pune",
  "rajkot",
  "ranchi",
  "surat",
  "thiruvananthapuram",
  "tiruchirappalli",
  "udaipur",
  "vadodara",
  "varanasi",
  "vijayawada",
  "visakhapatnam",
  "warangal",
] as const;

const countries: ReadonlyArray<readonly [string, string]> = [
  ["india", "IN"],
  ["united states", "US"],
  ["usa", "US"],
  ["united kingdom", "GB"],
  ["uk", "GB"],
  ["canada", "CA"],
  ["australia", "AU"],
  ["germany", "DE"],
  ["singapore", "SG"],
  ["united arab emirates", "AE"],
  ["uae", "AE"],
];

const containsPhrase = (text: string, phrase: string): boolean => {
  for (let index = text.indexOf(phrase); index >= 0; index = text.indexOf(phrase, index + 1)) {
    const before = index === 0 ? "" : (text[index - 1] ?? "");
    const after = text[index + phrase.length] ?? "";
    if (!/[a-z]/.test(before) && !/[a-z]/.test(after)) return true;
  }
  return false;
};

function cleanCity(rawCity: string): string | null {
  const stripped = rawCity
    .replace(/\s*\([^)]*\)/g, "")
    .replace(
      /\s*[-/|–—]\s*(?:hybrid|remote|onsite|on-site|wfh|work from home|work from office|full[ -]?time|part[ -]?time)\b.*$/i,
      "",
    )
    .replace(/\s+\b(?:hybrid|remote|onsite|on-site|wfh)\b.*$/i, "")
    .trim();
  if (/^(?:remote|hybrid|onsite|on-site|wfh|anywhere|unspecified)$/i.test(stripped)) {
    return null;
  }
  return stripped.slice(0, 100) || null;
}

export function parseLocation(raw: string | undefined): Parsed<Location> {
  if (!raw?.trim()) return { value: { raw: null, city: null, country: null } };
  const text = raw.trim();
  const first = text.split(",", 1)[0]?.trim() ?? "";
  const city = cleanCity(first);
  const lower = text.toLowerCase();
  const explicit = countries.find(([name]) => containsPhrase(lower, name))?.[1];
  const country =
    explicit ?? (indianCities.some((name) => containsPhrase(lower, name)) ? "IN" : null);
  return { value: { raw: text, city, country } };
}
