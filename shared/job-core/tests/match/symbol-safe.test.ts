/**
 * Unit tests for symbol-safe technical skill matching (Go vs Google, C++, C#, .NET, Node.js).
 */

import { describe, it, expect } from "vitest";
import { profileHasSkill, buildSkillRegex } from "../../src/match/matcher.js";
import { createTestProfile } from "./fixtures.js";

describe("symbol-safe skill matching", () => {
  it("distinguishes Go from Google, Golang, MongoDB, and Django", () => {
    // 1. Negative cases: words containing "go" substring
    const profFalse = createTestProfile({
      skills: [],
      roles: [
        {
          title: "Senior Engineer at Google",
          company: "Alphabet",
          start: "2020-01",
          end: "present",
          highlights: [
            "Implemented data pipelines using MongoDB and Django",
            "Interested in learning Golang in the future",
          ],
        },
      ],
    });

    expect(profileHasSkill(profFalse, "Go")).toBe(false);

    // 2. Positive cases: explicit skill or boundary-separated Go
    const profTrueRole = createTestProfile({
      skills: [],
      roles: [
        {
          title: "Go Backend Developer",
          company: "Tech Corp",
          start: "2020-01",
          end: "present",
          highlights: ["Engineered services in Go and Python"],
        },
      ],
    });
    expect(profileHasSkill(profTrueRole, "Go")).toBe(true);

    const profTrueSkill = createTestProfile({
      skills: [{ name: "go", years: 3, level: "advanced" }],
      roles: [],
    });
    expect(profileHasSkill(profTrueSkill, "Go")).toBe(true);
  });

  it("handles C++ symbol boundaries correctly", () => {
    // Negative: plain "C" does not match "C++"
    const profPlainC = createTestProfile({
      skills: [{ name: "C", years: 4, level: "intermediate" }],
      roles: [
        {
          title: "Systems Programmer",
          company: "Hardware Inc",
          start: "2020-01",
          end: "present",
          highlights: ["Wrote high-speed drivers in C and Assembly"],
        },
      ],
    });
    expect(profileHasSkill(profPlainC, "C++")).toBe(false);

    // Positive: C++ in skills, title, or highlights
    const profCpp = createTestProfile({
      skills: [],
      roles: [
        {
          title: "C++ Software Engineer",
          company: "Simulations Corp",
          start: "2020-01",
          end: "present",
          highlights: ["Refactored rendering engine using modern C++20"],
        },
      ],
    });
    expect(profileHasSkill(profCpp, "C++")).toBe(true);
  });

  it("handles C# and .NET symbol boundaries correctly", () => {
    const profDotNet = createTestProfile({
      skills: [],
      roles: [
        {
          title: "Senior C# .NET Developer",
          company: "Enterprise Ltd",
          start: "2020-01",
          end: "present",
          highlights: ["Engineered microservices using ASP.NET Core and C#"],
        },
      ],
    });

    expect(profileHasSkill(profDotNet, "C#")).toBe(true);
    expect(profileHasSkill(profDotNet, ".NET")).toBe(true);
  });

  it("handles Node.js boundary matching correctly", () => {
    const profNode = createTestProfile({
      skills: [],
      roles: [
        {
          title: "Fullstack Engineer",
          company: "Web Tech",
          start: "2020-01",
          end: "present",
          highlights: ["Architected scalable APIs with Node.js and Express"],
        },
      ],
    });

    expect(profileHasSkill(profNode, "Node.js")).toBe(true);
  });

  it("handles empty and whitespace skill queries gracefully", () => {
    const profile = createTestProfile();
    expect(profileHasSkill(profile, "")).toBe(false);
    expect(profileHasSkill(profile, "   ")).toBe(false);
  });

  it("buildSkillRegex matches boundaries for symbol and word endings", () => {
    const regexWord = buildSkillRegex("Python");
    expect(regexWord.test("Python developer")).toBe(true);
    expect(regexWord.test("CPython")).toBe(false);

    const regexSymbol = buildSkillRegex("C++");
    expect(regexSymbol.test("C++ developer")).toBe(true);
    expect(regexSymbol.test("C+++")).toBe(false);
  });
});
