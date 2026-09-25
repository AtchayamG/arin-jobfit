import { describe, expect, it } from "vitest";
import { detectDiscriminatory } from "../../src/extract/discrimination.js";

const positives = [
  ["Age limit 25", "age"],
  ["Aged 30 to 40", "age"],
  ["Under 35 years old", "age"],
  ["Young candidates only", "age"],
  ["Male only", "gender"],
  ["Female candidates only", "gender"],
  ["Only women", "gender"],
  ["Gender: male", "gender"],
  ["Hindu only", "religion"],
  ["Muslim candidates only", "religion"],
  ["Only Christian", "religion"],
  ["Religion: Sikh", "religion"],
  ["Upper caste applicants", "caste"],
  ["Lower caste applicants", "caste"],
  ["Brahmin only", "caste"],
  ["Caste: General", "caste"],
  ["Unmarried only", "marital_status"],
  ["Only unmarried", "marital_status"],
  ["Must be single", "marital_status"],
  ["Married women need not apply", "marital_status"],
  ["Locals only", "nationality_origin"],
  ["Only locals", "nationality_origin"],
  ["Indians only", "nationality_origin"],
  ["Native-born only", "nationality_origin"],
  ["No disabled applicants", "disability"],
  ["Able-bodied only", "disability"],
  ["Persons with disabilities need not apply", "disability"],
  ["No wheelchair users", "disability"],
  ["Fair complexion", "appearance"],
  ["Minimum height 170 cm", "appearance"],
  ["Good looking", "appearance"],
  ["Light-skinned candidate", "appearance"],
  ["Equal opportunity employer; male only", "gender"],
] as const;

const negatives = [
  "Equal opportunity employer regardless of gender",
  "All genders welcome",
  "We do not discriminate on age or religion",
  "People of all backgrounds may apply",
  "Work authorization required",
  "Authorized to work in India",
  "Religious holidays are supported",
  "Age of the software platform is two years",
  "Gender equality is a core value",
  "Accessible workplace for persons with disabilities",
  "Fair pay for all candidates",
  "Caste studies research position",
];

describe("discriminatory requirement flags", () => {
  it.each(positives)("flags %s as %s", (text, category) => {
    expect(detectDiscriminatory(text)?.category).toBe(category);
  });

  it.each(negatives)("does not flag inclusive or unrelated text: %s", (text) => {
    expect(detectDiscriminatory(text)).toBeNull();
  });
});
