import { describe, expect, it } from "vitest";
import {
  buildSkillRegex,
  extractSnippet,
  findSkillEvidence,
  resolveFieldPath,
} from "../../src/prepare/matcher.js";

describe("Symbol-safe skill boundaries", () => {
  it("matches 'Go' on word boundaries and rejects substring false positives", () => {
    const regex = buildSkillRegex("Go");

    // True positives
    expect(regex.test("Go developer")).toBe(true);
    expect(regex.test("Senior engineer (Go, Python)")).toBe(true);
    expect(regex.test("Built services in Go.")).toBe(true);
    expect(regex.test("Go/gRPC backend")).toBe(true);
    expect(regex.test("go microservices")).toBe(true);

    // False positives to avoid
    expect(regex.test("Google Cloud Engineer")).toBe(false);
    expect(regex.test("Golang expert")).toBe(false);
    expect(regex.test("Django web framework")).toBe(false);
    expect(regex.test("MongoDB database")).toBe(false);
    expect(regex.test("Outgoing personality")).toBe(false);
  });

  it("handles 'C++' symbol suffix safely", () => {
    const regex = buildSkillRegex("C++");

    expect(regex.test("C++ developer")).toBe(true);
    expect(regex.test("Modern C++20 standard")).toBe(true);
    expect(regex.test("Low latency C++/STL programming")).toBe(true);
    expect(regex.test("Proficient in (C++)")).toBe(true);

    // Should not match plain C or other languages
    expect(regex.test("C programming language")).toBe(false);
    expect(regex.test("Objective-C programmer")).toBe(false);
  });

  it("handles 'C#' symbol suffix safely", () => {
    const regex = buildSkillRegex("C#");

    expect(regex.test("C# backend engineer")).toBe(true);
    expect(regex.test("C#/.NET Core applications")).toBe(true);
    expect(regex.test("Languages: C#, TypeScript")).toBe(true);

    expect(regex.test("C programming")).toBe(false);
  });

  it("handles '.NET' symbol prefix safely", () => {
    const regex = buildSkillRegex(".NET");

    expect(regex.test(".NET Core developer")).toBe(true);
    expect(regex.test("Built enterprise apps in C# and .NET")).toBe(true);
    expect(regex.test("Microsoft .NET 8")).toBe(true);

    // Should not match random words ending in net
    expect(regex.test("Internet architecture")).toBe(false);
    expect(regex.test("Network engineer")).toBe(false);
  });

  it("handles 'Node.js' with internal period safely", () => {
    const regex = buildSkillRegex("Node.js");

    expect(regex.test("Node.js backend developer")).toBe(true);
    expect(regex.test("Built APIs in NODE.JS and Express")).toBe(true);

    // Should not falsely trigger on standalone JavaScript or Node without .js
    expect(regex.test("JavaScript frontend")).toBe(false);
  });

  describe("extractSnippet", () => {
    it("returns entire string when length is <= maxLen", () => {
      const shortText = "Go developer with 5 years experience.";
      const snippet = extractSnippet(shortText, 0, 2, 300);
      expect(snippet).toBe(shortText);
      expect(shortText.includes(snippet)).toBe(true);
    });

    it("extracts exact substring <= maxLen when source is very long", () => {
      const prefix = "A".repeat(500);
      const matchWord = "TypeScript";
      const suffix = "B".repeat(500);
      const longText = `${prefix}${matchWord}${suffix}`;

      const matchIdx = longText.indexOf(matchWord);
      const snippet = extractSnippet(longText, matchIdx, matchWord.length, 300);

      expect(snippet.length).toBeLessThanOrEqual(300);
      expect(snippet).toContain(matchWord);
      expect(longText.includes(snippet)).toBe(true);
    });

    it("handles match occurring near the very end of a long source string", () => {
      const prefix = "A".repeat(400);
      const matchWord = "PostgreSQL";
      const longText = `${prefix}${matchWord}`;

      const matchIdx = longText.indexOf(matchWord);
      const snippet = extractSnippet(longText, matchIdx, matchWord.length, 300);

      expect(snippet.length).toBe(300);
      expect(snippet).toContain(matchWord);
      expect(longText.includes(snippet)).toBe(true);
    });
  });

  describe("Education evidence matching and path resolution", () => {
    it("finds skill evidence in education qualification and resolves field path", () => {
      const profile = {
        profile_id: "prof_00000000-0000-4000-8000-000000000099" as const,
        schema_version: "1" as const,
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-20T00:00:00Z",
        label: "Grad",
        headline: "Graduate",
        total_experience_years: 0,
        skills: [],
        roles: [],
        education: [
          {
            qualification: "M.S. in Computer Science focusing on Python and Machine Learning",
            institution: "Stanford",
            year: 2024,
          },
        ],
        certifications: [],
        preferences: {
          locations: ["Bangalore"],
          remote_modes: ["remote" as const],
          employment_types: ["full_time" as const],
          deal_breakers: [],
          min_compensation: null,
        },
        summary_text: null,
      };

      const evidence = findSkillEvidence(profile, "Python");
      expect(evidence.length).toBe(1);
      expect(evidence[0]?.field_path).toBe("education[0].qualification");
      expect(evidence[0]?.text).toContain("Python");

      const resolved = resolveFieldPath(profile, "education[0].qualification");
      expect(resolved).toBe("M.S. in Computer Science focusing on Python and Machine Learning");
    });

    it("resolves null for out-of-bounds indices and unknown paths", () => {
      const profile = {
        profile_id: "prof_00000000-0000-4000-8000-000000000099" as const,
        schema_version: "1" as const,
        created_at: "2026-09-01T00:00:00Z",
        updated_at: "2026-09-20T00:00:00Z",
        label: "Grad",
        headline: "Graduate",
        total_experience_years: 0,
        skills: [{ name: "Rust", years: 1, level: "beginner" as const }],
        roles: [
          {
            title: "Dev",
            company: "Co",
            start: "2024-01",
            end: "present",
            highlights: ["Built backend"],
          },
        ],
        education: [{ qualification: "B.Tech", institution: "College", year: 2024 }],
        certifications: [{ name: "CKA", issuer: "CNCF", year: 2024 }],
        preferences: {
          locations: ["Bangalore"],
          remote_modes: ["remote" as const],
          employment_types: ["full_time" as const],
          deal_breakers: [],
          min_compensation: null,
        },
        summary_text: "Summary text",
      };

      expect(resolveFieldPath(profile, "skills[99].name")).toBeNull();
      expect(resolveFieldPath(profile, "roles[99].title")).toBeNull();
      expect(resolveFieldPath(profile, "roles[0].highlights[99]")).toBeNull();
      expect(resolveFieldPath(profile, "roles[99].highlights[0]")).toBeNull();
      expect(resolveFieldPath(profile, "certifications[99].name")).toBeNull();
      expect(resolveFieldPath(profile, "education[99].qualification")).toBeNull();
      expect(resolveFieldPath(profile, "unknown_field")).toBeNull();
    });
  });
});
