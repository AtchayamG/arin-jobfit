import { describe, expect, it } from "vitest";
import { matchSkills, skillsTaxonomy, taxonomySchema } from "../../src/extract/taxonomy.js";

describe("skills taxonomy", () => {
  it("contains at least 300 skills with unique names and aliases", () => {
    expect(skillsTaxonomy.skills.length).toBeGreaterThanOrEqual(300);
    expect(taxonomySchema.safeParse(skillsTaxonomy).success).toBe(true);
    const keys = skillsTaxonomy.skills.flatMap((skill) =>
      [skill.name, ...skill.aliases].map((value) => value.toLowerCase()),
    );
    expect(new Set(keys).size).toBe(keys.length);
    expect(
      taxonomySchema.safeParse({
        ...skillsTaxonomy,
        skills: [...skillsTaxonomy.skills, skillsTaxonomy.skills[0]],
      }).success,
    ).toBe(false);
  });

  it("matches symbols safely and whole-word Go", () => {
    expect(matchSkills("C++ C# .NET Node.js CI/CD Go")).toEqual([
      "C++",
      "C#",
      ".NET",
      "Node.js",
      "CI/CD",
      "Go",
    ]);
    expect(matchSkills("going node.jsx C+++ C#foo .NETWORK microservicesci/cd")).toEqual([]);
    expect(matchSkills("We go to office; Golang experience helps")).toEqual(["Go"]);
    expect(matchSkills("Python python PYTHON")).toEqual(["Python"]);
  });
});
