import { indeedJobDetails, naukriKeySkills } from "../normalize/provider-hints.js";

export type Section = "must" | "preferred" | "responsibility" | "general" | "metadata";
export interface SectionItem {
  section: Section;
  text: string;
}

const headings: ReadonlyArray<readonly [RegExp, Section]> = [
  [
    /^(?:requirements|qualifications|must[- ]have|must have|mandatory|desired candidate profile|key skills)\s*[:\-–—]?\s*(.*)$/i,
    "must",
  ],
  [
    /^(?:nice[- ]to[- ]have|nice to have|preferred|good[- ]to[- ]have|good to have|bonus)\s*[:\-–—]?\s*(.*)$/i,
    "preferred",
  ],
  [
    /^(?:responsibilities|roles and responsibilities|what you(?:'ll| will) do)\s*[:\-–—]?\s*(.*)$/i,
    "responsibility",
  ],
  [
    /^(?:job description|about (?:the |our )?(?:job|role|team|company|us)|job summary|role summary|overview|summary)\s*[:\-–—]?\s*(.*)$/i,
    "general",
  ],
  [
    /^(?:salary|compensation|pay|benefits|perks|job details)\s*(?:[:\-–—]\s*(.*)|\s+(\d.*)|$)/i,
    "metadata",
  ],
];

const inlineHeadingRegex =
  /(?<=[.!?;\s]|^)(?=(?:requirements|qualifications|must[- ]have|mandatory|desired candidate profile|key skills|nice[- ]to[- ]have|good[- ]to[- ]have|preferred|bonus|responsibilities|roles and responsibilities|what you(?:'ll| will) do|job description|about (?:the |our )?(?:job|role|team|company|us)|job summary|role summary|overview|summary|benefits|perks|job details)\s*[:\-–—]|(?:salary|compensation|pay)\s*(?:[:\-–—]|\d|[₹$]))/gi;

const sentenceSplitRegex = /(?<!\b(?:e\.g|i\.e|etc|vs)\.)(?<=[.!?])\s+(?=[A-Z0-9#*-])/i;

function splitSentences(text: string): string[] {
  return text
    .split(sentenceSplitRegex)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function isPureMetadata(text: string): boolean {
  const t = text.trim();
  if (
    /^(?:full[ -]?time|part[ -]?time|contract(?:ual)?|internship|temporary|permanent)\.?$/i.test(t)
  ) {
    return true;
  }
  if (/^(?:salary|compensation|pay|ctc|remuneration)\b/i.test(t)) {
    return true;
  }
  if (/\b\d+\s*[-–]\s*\d+\s*(?:lpa|ctc|per annum)\b/i.test(t)) {
    return true;
  }
  return false;
}

export function sectionItems(description: string): SectionItem[] {
  const items: SectionItem[] = [];
  let section: Section = "general";

  const lines = description
    .split(/\r?\n/)
    .flatMap((line) => line.split(inlineHeadingRegex))
    .map((l) =>
      l
        .trim()
        .replace(/^(?:#+\s*|[-*•]|\d+[.)])\s*/, "")
        .replace(/^\*\*|\*\*$/g, "")
        .trim(),
    )
    .filter((l) => l.length > 0);

  for (const line of lines) {
    const tags = naukriKeySkills.exec(line);
    if (tags) {
      section = "must";
      for (const tag of (tags[1] ?? "").split(/[,;]+/)) {
        if (tag.trim()) items.push({ section, text: tag.trim() });
      }
      continue;
    }
    const detail = indeedJobDetails.exec(line);
    if (detail) {
      section = "metadata";
      if (detail[1]?.trim()) {
        for (const sent of splitSentences(detail[1].trim())) {
          items.push({ section, text: sent });
        }
      }
      continue;
    }
    const heading = headings.find(([pattern]) => pattern.test(line));
    if (heading) {
      section = heading[1];
      const match = heading[0].exec(line);
      const content = (match?.[1] ?? match?.[2] ?? "").trim();
      if (content) {
        for (const sent of splitSentences(content)) {
          items.push({ section, text: sent });
        }
      }
      continue;
    }
    for (const sent of splitSentences(line)) {
      items.push({ section, text: sent });
    }
  }
  return items;
}

export function classifyItem(item: SectionItem, hasSkills: boolean): Section {
  if (item.section === "metadata") return "metadata";
  if (!hasSkills && isPureMetadata(item.text)) return "metadata";
  if (/\b(?:nice to have|preferred|good to have|plus)\b/i.test(item.text)) return "preferred";
  const hasRequirementCue = /\b(?:must|mandatory|required)\b/i.test(item.text);
  if (hasRequirementCue) return "must";
  const isIntro =
    /^(?:we are (?:hiring|looking for|seeking)|about (?:the |our )?(?:company|role|team|us)|who we are|join our team|our company is)\b/i.test(
      item.text,
    );
  if (isIntro && !hasSkills) return "responsibility";
  if (item.section !== "general") return item.section;
  return hasSkills ? "must" : "responsibility";
}
