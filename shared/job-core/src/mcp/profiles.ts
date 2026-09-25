import { profileInputSchema, type Profile, type ProfileInput } from "../schemas/index.js";
import type { ProductConfig } from "./types.js";
import { DomainError } from "./types.js";

export function resolveProfile(
  args: { profile_id?: string; profile?: ProfileInput },
  config: ProductConfig,
): { profile: Profile; profileRef: string } {
  if ((args.profile_id === undefined) === (args.profile === undefined))
    throw new DomainError("INVALID_INPUT");
  if (args.profile_id !== undefined) {
    const profile = config.store.profiles.get(args.profile_id);
    if (!profile) throw new DomainError("NOT_FOUND", args.profile_id);
    return { profile, profileRef: args.profile_id };
  }
  const input = profileInputSchema.parse(args.profile);
  const now = (config.now?.() ?? new Date()).toISOString();
  return {
    profileRef: "inline",
    profile: {
      profile_id: `prof_${crypto.randomUUID()}`,
      schema_version: "1",
      created_at: now,
      updated_at: now,
      label: input.label,
      headline: input.headline,
      total_experience_years: input.total_experience_years,
      skills: input.skills.map((skill) => ({
        ...skill,
        years: skill.years ?? null,
        level: skill.level ?? null,
      })),
      roles: input.roles,
      education: input.education.map((item) => ({ ...item, year: item.year ?? null })),
      certifications: input.certifications.map((item) => ({
        ...item,
        issuer: item.issuer ?? null,
        year: item.year ?? null,
      })),
      preferences: {
        ...input.preferences,
        min_compensation: input.preferences.min_compensation ?? null,
      },
      summary_text: input.summary_text ?? null,
    },
  };
}
