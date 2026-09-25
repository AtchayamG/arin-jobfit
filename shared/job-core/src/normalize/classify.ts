import type { Job } from "../schemas/index.js";
import type { Parsed } from "./experience.js";

export function parseRemoteMode(text: string): Parsed<Job["remote_mode"]> {
  if (/\bhybrid\b/i.test(text)) return { value: "hybrid" };
  if (/\b(?:remote|wfh|work from home)\b/i.test(text)) return { value: "remote" };
  if (/\b(?:work from office|on[ -]?site)\b/i.test(text)) return { value: "onsite" };
  return { value: "unknown" };
}

export function parseEmploymentType(text: string): Parsed<Job["employment_type"]> {
  if (/\b(?:internship|intern)\b/i.test(text)) return { value: "internship" };
  if (/\bpart[ -]?time\b/i.test(text)) return { value: "part_time" };
  if (/\b(?:temporary|temp)\b/i.test(text)) return { value: "temporary" };
  if (/\b(?:contract|contractual)\b/i.test(text)) return { value: "contract" };
  if (/\bfull[ -]?time\b/i.test(text)) return { value: "full_time" };
  return { value: "unknown" };
}
