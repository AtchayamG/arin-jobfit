import { describe, expect, it } from "vitest";
import { detectDiscriminatory, detectDiscriminatoryAll } from "../../src/extract/discrimination.js";

const positives = [
  // Age discrimination cases (R-8: >= 10 cases)
  ["Age below 30 years", "age"],
  ["Age under 28", "age"],
  ["Age above 21", "age"],
  ["Age over 35", "age"],
  ["Age limit 25", "age"],
  ["Max age: 30", "age"],
  ["Minimum age: 21", "age"],
  ["Age 25-30", "age"],
  ["Age between 22 and 28 years", "age"],
  ["Not more than 30 years old", "age"],
  ["No more than 28 years old", "age"],
  ["Under 35 years old", "age"],
  ["Below 25 years of age", "age"],
  ["Born after 1995", "age"],
  ["Born before 2000", "age"],
  ["Aged 30 to 40", "age"],
  ["Young candidates only", "age"],
  // Gender
  ["Male only", "gender"],
  ["Female candidates only", "gender"],
  ["Only women", "gender"],
  ["Gender: male", "gender"],
  // Religion
  ["Hindu only", "religion"],
  ["Muslim candidates only", "religion"],
  ["Only Christian", "religion"],
  ["Religion: Sikh", "religion"],
  // Caste
  ["Upper caste applicants", "caste"],
  ["Lower caste applicants", "caste"],
  ["Brahmin only", "caste"],
  ["Caste: General", "caste"],
  // Marital status
  ["Unmarried only", "marital_status"],
  ["Only unmarried", "marital_status"],
  ["Must be single", "marital_status"],
  ["Married women need not apply", "marital_status"],
  // Nationality / origin
  ["Locals only", "nationality_origin"],
  ["Only locals", "nationality_origin"],
  ["Indians only", "nationality_origin"],
  ["Native-born only", "nationality_origin"],
  // Disability
  ["No disabled applicants", "disability"],
  ["Able-bodied only", "disability"],
  ["Persons with disabilities need not apply", "disability"],
  ["No wheelchair users", "disability"],
  // Appearance
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
  // Negative experience cases (must not trigger age flags)
  "Below 5 years of experience",
  "Under 3 years of experience",
  "Over 10 years of experience",
  "Not more than 5 years of experience required",
  "Minimum 3 years experience",
  "Maximum 8 years experience",
];

describe("discriminatory requirement flags", () => {
  it.each(positives)("flags %s as %s", (text, category) => {
    expect(detectDiscriminatory(text)?.category).toBe(category);
  });

  it.each(negatives)("does not flag inclusive or unrelated text: %s", (text) => {
    expect(detectDiscriminatory(text)).toBeNull();
  });

  describe("multi-category reporting (R-9)", () => {
    it("reports all categories on a single line", () => {
      const flags = detectDiscriminatoryAll("Female candidates only. Age below 30 years.");
      expect(flags.map((f) => f.category).sort()).toEqual(["age", "gender"]);
      expect(flags.every((f) => f.text === "Female candidates only. Age below 30 years.")).toBe(
        true,
      );
    });

    it("reports gender, caste, and marital status on combined line", () => {
      const flags = detectDiscriminatoryAll("Brahmin only, unmarried male only");
      expect(flags.map((f) => f.category).sort()).toEqual(["caste", "gender", "marital_status"]);
    });

    it("returns empty array when no flags are found", () => {
      expect(detectDiscriminatoryAll("Software Engineer with 5 years experience")).toEqual([]);
    });

    it("keeps detectDiscriminatory returning first flag for backward compatibility", () => {
      const first = detectDiscriminatory("Female candidates only. Age below 30 years.");
      const all = detectDiscriminatoryAll("Female candidates only. Age below 30 years.");
      expect(first).toEqual(all[0]);
    });
  });
});
