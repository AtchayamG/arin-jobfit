import { indeedJobDetails, naukriKeySkills } from "../normalize/provider-hints.js";

export type Section = "must" | "preferred" | "responsibility" | "general" | "metadata";
export interface SectionItem {
  section: Section;
  text: string;
}

const headings: ReadonlyArray<readonly [RegExp, Section]> = [
  [
    /^(?:requirements|qualifications|must have|mandatory|desired candidate profile)\s*:?\s*(.*)$/i,
    "must",
  ],
  [/^(?:nice to have|preferred|good to have|bonus)\s*:?\s*(.*)$/i, "preferred"],
  [
    /^(?:responsibilities|roles and responsibilities|what you'll do)\s*:?\s*(.*)$/i,
    "responsibility",
  ],
  [/^job description\s*:?\s*(.*)$/i, "general"],
];

export function sectionItems(description: string): SectionItem[] {
  const items: SectionItem[] = [];
  let section: Section = "general";
  for (const line of description.split(/\r?\n/)) {
    const trimmed = line
      .trim()
      .replace(/^(?:[-*•]|\d+[.)])\s*/, "")
      .trim();
    if (!trimmed) continue;
    const tags = naukriKeySkills.exec(trimmed);
    if (tags) {
      section = "must";
      for (const tag of (tags[1] ?? "").split(/[,;]+/)) {
        if (tag.trim()) items.push({ section, text: tag.trim() });
      }
      continue;
    }
    const detail = indeedJobDetails.exec(trimmed);
    if (detail) {
      section = "metadata";
      if (detail[1]?.trim()) items.push({ section, text: detail[1].trim() });
      continue;
    }
    const heading = headings.find(([pattern]) => pattern.test(trimmed));
    if (heading) {
      section = heading[1];
      const content = heading[0].exec(trimmed)?.[1]?.trim();
      if (content) items.push({ section, text: content });
      continue;
    }
    items.push({ section, text: trimmed });
  }
  return items;
}

export function classifyItem(item: SectionItem, hasSkills: boolean): Section {
  if (item.section === "metadata") return "metadata";
  if (/\b(?:nice to have|preferred|good to have|plus)\b/i.test(item.text)) return "preferred";
  if (/\b(?:must|mandatory|required)\b/i.test(item.text)) return "must";
  if (item.section !== "general") return item.section;
  return hasSkills ? "must" : "responsibility";
}
