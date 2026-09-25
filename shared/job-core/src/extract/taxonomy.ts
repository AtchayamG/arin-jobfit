import { z } from "zod";
import rawTaxonomy from "../../data/skills-taxonomy.v1.json" with { type: "json" };

export const taxonomySchema = z
  .strictObject({
    version: z.literal("1"),
    skills: z
      .array(
        z.strictObject({
          name: z.string().min(1).max(100),
          aliases: z.array(z.string().min(1).max(100)),
          category: z.enum([
            "language",
            "framework",
            "frontend",
            "backend",
            "mobile",
            "cloud",
            "devops",
            "data",
            "ai_ml",
            "testing",
            "security",
            "database",
            "tool",
            "domain",
            "methodology",
          ]),
        }),
      )
      .min(300),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    for (const skill of value.skills) {
      for (const alias of [skill.name, ...skill.aliases]) {
        const key = alias.normalize("NFKC").toLowerCase();
        if (seen.has(key))
          ctx.addIssue({ code: "custom", message: `Duplicate skill alias: ${alias}` });
        seen.add(key);
      }
    }
  });

export const skillsTaxonomy = taxonomySchema.parse(rawTaxonomy);
export type TaxonomySkill = (typeof skillsTaxonomy.skills)[number];

const aliases = skillsTaxonomy.skills
  .flatMap((skill) => [skill.name, ...skill.aliases].map((alias) => ({ alias, name: skill.name })))
  .sort((left, right) => right.alias.length - left.alias.length);
const escape = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const matcher = new RegExp(
  `(?<![\\p{L}\\p{N}+#]|\\.)(?:${aliases.map((entry) => escape(entry.alias)).join("|")})(?![\\p{L}\\p{N}+#]|\\.[\\p{L}\\p{N}])`,
  "giu",
);
const canonical = new Map(aliases.map((entry) => [entry.alias.toLowerCase(), entry.name]));

export function matchSkills(text: string): string[] {
  const found = new Set<string>();
  matcher.lastIndex = 0;
  for (const match of text.matchAll(matcher)) {
    const word = match[0];
    const name = canonical.get(word.toLowerCase());
    if (
      !name ||
      ((name === "Go" || name === "R" || name === "C") &&
        word.length === name.length &&
        word !== name)
    )
      continue;
    found.add(name);
  }
  return [...found];
}
