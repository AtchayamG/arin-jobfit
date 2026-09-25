import type { Job, Requirements, Warning } from "../schemas/index.js";
import { detectDiscriminatoryAll } from "./discrimination.js";
import { classifyItem, sectionItems } from "./sections.js";
import { matchSkills } from "./taxonomy.js";

const constraintPatterns: ReadonlyArray<
  readonly [Requirements["constraints"][number]["kind"], RegExp]
> = [
  ["notice_period", /\b(?:notice period|immediate joiner|join immediately)\b/i],
  ["shift", /\b(?:night shift|rotational shift|shifts?)\b/i],
  ["travel", /\btravel\b/i],
  ["relocation", /\brelocat(?:e|ion|ing)\b/i],
  ["work_authorization", /\b(?:work authorization|authorized to work|visa|work permit)\b/i],
  ["certification", /\b(?:certification|certified|certificate|pmp)\b/i],
  ["education", /(?:\bb\.e\.|\bb\.tech\b|\bmca\b|\bmba\b|\bbachelor\b|\bdegree\b)/i],
];

export function extractRequirements(job: Job): Requirements {
  const must_have: Requirements["must_have"] = [];
  const preferred: Requirements["preferred"] = [];
  const responsibilities: string[] = [];
  const constraints: Requirements["constraints"] = [];
  const discriminatory_flags: Requirements["discriminatory_flags"] = [];
  for (const item of sectionItems(job.description)) {
    const text = item.text.slice(0, 500);
    const flags = detectDiscriminatoryAll(text);
    if (flags.length > 0) {
      for (const flag of flags) {
        if (discriminatory_flags.length < 50) discriminatory_flags.push(flag);
      }
      continue;
    }
    const kind = constraintPatterns.find(([, pattern]) => pattern.test(text))?.[0];
    if (kind && constraints.length < 50) constraints.push({ kind, text });
    const skills = matchSkills(text).slice(0, 20);
    if (kind && skills.length === 0) continue;
    const section = classifyItem(item, skills.length > 0);
    if (section === "metadata") continue;
    if (section === "responsibility") {
      if (responsibilities.length < 100) responsibilities.push(item.text.slice(0, 1_000));
    } else {
      const target = section === "preferred" ? preferred : must_have;
      if (target.length < 100) target.push({ text, skills });
    }
  }
  return {
    job_id: job.job_id,
    must_have,
    preferred,
    responsibilities,
    experience: job.experience,
    location: job.location,
    remote_mode: job.remote_mode,
    employment_type: job.employment_type,
    compensation: job.compensation,
    constraints,
    discriminatory_flags,
  };
}

export function discriminationWarnings(requirements: Requirements): Warning[] {
  return requirements.discriminatory_flags.map((flag) => ({
    code: "POTENTIALLY_DISCRIMINATORY_REQUIREMENT",
    message: `Potentially discriminatory ${flag.category} requirement`,
  }));
}
