import type { ProviderId } from "../schemas/index.js";

export const naukriKeySkills = /^key skills\s*:?\s*(.*)$/i;
export const indeedJobDetails = /^job details\s*:?\s*(.*)$/i;
export const usesDayFirstSlashDates = (provider: ProviderId): boolean => provider === "naukri";

export function canonicalExperienceText(provider: ProviderId, text: string): string {
  return provider === "naukri" ? text.replace(/\byrs?\b/gi, "years") : text;
}

export function canonicalCompensationText(provider: ProviderId, text: string): string {
  const result = text
    .replace(/\blacs?\s*p\.?\s*a\.?\b/gi, "lakh per year")
    .replace(/\blpa\b/gi, "lakh per year")
    .replace(/\bcr\b/gi, "crore")
    .replace(/\bnot disclosed\b/gi, "undisclosed")
    .replace(/\ba year\b/gi, "per year")
    .replace(/\ba month\b/gi, "per month")
    .replace(/\ban hour\b/gi, "per hour");
  return result;
}
