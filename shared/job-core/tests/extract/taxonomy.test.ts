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

  it("handles trailing punctuation per R-7 probe strings", () => {
    expect(matchSkills("Docker, Kubernetes.")).toEqual(["Docker", "Kubernetes"]);
    expect(matchSkills("Must know Go and Java.")).toEqual(["Go", "Java"]);
    expect(matchSkills("Good to have: Flutter, Go, AWS.")).toEqual(["Flutter", "Go", "AWS"]);
  });

  describe("trailing punctuation boundary table", () => {
    const cases = [
      { text: "Experience with Kubernetes.", expected: ["Kubernetes"] },
      { text: "Proficient in Docker, Kubernetes, AWS", expected: ["Docker", "Kubernetes", "AWS"] },
      { text: "Required: Docker; Kubernetes; AWS;", expected: ["Docker", "Kubernetes", "AWS"] },
      { text: "Core skill: AWS: expert level", expected: ["AWS"] },
      { text: "Tools (Docker, Kubernetes)", expected: ["Docker", "Kubernetes"] },
      { text: "Stack [Docker, Kubernetes]", expected: ["Docker", "Kubernetes"] },
      { text: "We love Kubernetes!", expected: ["Kubernetes"] },
      { text: "Do you know Kubernetes?", expected: ["Kubernetes"] },
      { text: "Cloud skills:\nKubernetes\nDocker", expected: ["Kubernetes", "Docker"] },
      { text: "Strong in .NET.", expected: [".NET"] },
      { text: "Proficient in Node.js.", expected: ["Node.js"] },
      { text: "Experience in C++.", expected: ["C++"] },
      { text: "Skilled in C#.", expected: ["C#"] },
      { text: "Hands-on with RxJS.", expected: ["RxJS"] },
      { text: "Design REST APIs.", expected: ["REST"] },
      { text: "Enterprise SAP ABAP.", expected: ["SAP ABAP"] },
      { text: "Database: Oracle.", expected: ["Oracle"] },
      { text: "Stored procedures in PL/SQL.", expected: ["PL/SQL"] },
      { text: "Testing with Appium and JMeter.", expected: ["Appium", "JMeter"] },
    ];

    it.each(cases)("extracts skills from '$text'", ({ text, expected }) => {
      expect(matchSkills(text)).toEqual(expected);
    });
  });

  it("rejects false positives across symbol boundaries", () => {
    expect(matchSkills("Google")).toEqual([]);
    expect(matchSkills("foo.NET")).toEqual([]);
    expect(matchSkills("..NET")).toEqual([]);
    expect(matchSkills("Kubernetes.io")).toEqual([]);
    expect(matchSkills("Java.class")).toEqual([]);
  });
});
