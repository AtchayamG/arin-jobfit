import type { Requirements } from "../schemas/index.js";

export type DiscriminatoryFlag = Requirements["discriminatory_flags"][number];
const patterns: ReadonlyArray<readonly [DiscriminatoryFlag["category"], RegExp]> = [
  [
    "age",
    /\b(?:age\s*(?:limit|between|:)?\s*\d{1,2}|aged?\s+\d{1,2}|under\s+\d{1,2}\s+years?\s+old|young candidates? only|below\s+\d{1,2}\s+years?\s+of\s+age)\b/i,
  ],
  [
    "gender",
    /\b(?:(?:male|female|men|women)\s+(?:only|candidates? only|applicants? only)|only\s+(?:male|female|men|women)|gender\s*:\s*(?:male|female)|(?:male|female)\s+preferred)\b/i,
  ],
  [
    "religion",
    /\b(?:(?:hindu|muslim|christian|sikh)\s+(?:only|candidates? only)|only\s+(?:hindu|muslim|christian|sikh)|religion\s*:\s*\w+)\b/i,
  ],
  ["caste", /\b(?:upper\s+caste|lower\s+caste|brahmin\s+only|caste\s*:\s*\w+|specific\s+caste)\b/i],
  [
    "marital_status",
    /\b(?:unmarried\s+only|only\s+unmarried|must\s+be\s+single|married\s+(?:women|men)\s+need\s+not\s+apply|single\s+(?:women|men)\s+only)\b/i,
  ],
  [
    "nationality_origin",
    /\b(?:locals?\s+only|only\s+locals?|indians?\s+only|only\s+indians?|native[ -]born\s+only|citizens?\s+only|only\s+citizens?)\b/i,
  ],
  [
    "disability",
    /\b(?:no\s+disabled\s+(?:applicants?|candidates?)|able[ -]bodied\s+only|persons?\s+with\s+disabilities\s+need\s+not\s+apply|no\s+wheelchair\s+users?)\b/i,
  ],
  [
    "appearance",
    /\b(?:fair\s+complexion|minimum\s+height|height\s+at\s+least|good[ -]looking|attractive\s+(?:female|male)|light[ -]skinned)\b/i,
  ],
];

export function detectDiscriminatory(text: string): DiscriminatoryFlag | null {
  const category = patterns.find(([, pattern]) => pattern.test(text))?.[0];
  return category ? { text: text.slice(0, 500), category } : null;
}
