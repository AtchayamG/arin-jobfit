import { describe, expect, it } from "vitest";
import { classifyItem, sectionItems } from "../../src/extract/sections.js";

describe("sectionItems parsing and classification", () => {
  it("parses bullet points and markdown prefixes", () => {
    const jd = `
# Job Description
- Design and develop scalable microservices
* Collaborate with product teams
1. Write unit and integration tests
• Maintain production stability
`;
    const items = sectionItems(jd);
    expect(items.length).toBe(4);
    expect(items[0]?.text).toBe("Design and develop scalable microservices");
    expect(items[0]?.section).toBe("general");
  });

  it("handles headings with content on the same line", () => {
    const jd = `
Job Description: We are looking for an experienced engineer
Requirements: Strong proficiency in Go
Nice to have: Experience with Kubernetes
Responsibilities: Lead system architecture
`;
    const items = sectionItems(jd);
    expect(items.length).toBe(4);
    expect(items[0]).toEqual({
      section: "general",
      text: "We are looking for an experienced engineer",
    });
    expect(items[1]).toEqual({ section: "must", text: "Strong proficiency in Go" });
    expect(items[2]).toEqual({ section: "preferred", text: "Experience with Kubernetes" });
    expect(items[3]).toEqual({ section: "responsibility", text: "Lead system architecture" });
  });

  it("parses Naukri key skills with single, multiple, and empty tags", () => {
    const jd = `
Key Skills: Java, Spring Boot, , Microservices; Docker
`;
    const items = sectionItems(jd);
    expect(items.map((i) => i.text)).toEqual(["Java", "Spring Boot", "Microservices", "Docker"]);
    expect(items.every((i) => i.section === "must")).toBe(true);
  });

  it("parses Indeed job details with non-empty and empty content", () => {
    const jd = `
Job details: Full-time
Job details: 
Job details: ₹10,00,000 - ₹15,00,000 a year
`;
    const items = sectionItems(jd);
    expect(items.length).toBe(2);
    expect(items[0]).toEqual({ section: "metadata", text: "Full-time" });
    expect(items[1]).toEqual({ section: "metadata", text: "₹10,00,000 - ₹15,00,000 a year" });
  });

  it("supports diverse section heading synonyms", () => {
    const jd = `
Desired Candidate Profile:
Must have 5 years experience
Bonus:
Public speaking experience
What you'll do:
Build awesome products
About our team:
We build high-throughput systems
`;
    const items = sectionItems(jd);
    expect(items.find((i) => i.text.includes("5 years experience"))?.section).toBe("must");
    expect(items.find((i) => i.text.includes("Public speaking"))?.section).toBe("preferred");
    expect(items.find((i) => i.text.includes("Build awesome"))?.section).toBe("responsibility");
    expect(items.find((i) => i.text.includes("high-throughput"))?.section).toBe("general");
  });

  describe("R-11: intro lines leak into must_have", () => {
    it("classifies generic intro lines without skills or cues as responsibility", () => {
      const introItem = {
        section: "general" as const,
        text: "We are hiring a passionate developer",
      };
      expect(classifyItem(introItem, false)).toBe("responsibility");

      const lookingForItem = {
        section: "general" as const,
        text: "We are looking for a great teammate",
      };
      expect(classifyItem(lookingForItem, false)).toBe("responsibility");

      const seekingItem = {
        section: "general" as const,
        text: "We are seeking talented candidates",
      };
      expect(classifyItem(seekingItem, false)).toBe("responsibility");

      const aboutItem = {
        section: "general" as const,
        text: "About the company: innovative tech startup",
      };
      expect(classifyItem(aboutItem, false)).toBe("responsibility");

      const whoWeAreItem = {
        section: "general" as const,
        text: "Who we are: a global engineering firm",
      };
      expect(classifyItem(whoWeAreItem, false)).toBe("responsibility");
    });

    it("classifies intro lines as must when they contain a requirement cue", () => {
      const item = {
        section: "general" as const,
        text: "We are hiring a developer who must be available for immediate start",
      };
      expect(classifyItem(item, false)).toBe("must");
    });

    it("classifies intro lines as must when they contain taxonomy skills", () => {
      const item = {
        section: "general" as const,
        text: "We are hiring a Python developer with backend expertise",
      };
      expect(classifyItem(item, true)).toBe("must");
    });

    it("intercepts intro lines even under a must section when no skills or cues exist", () => {
      const item = {
        section: "must" as const,
        text: "We are looking for enthusiastic individuals",
      };
      expect(classifyItem(item, false)).toBe("responsibility");
    });
  });

  describe("classifyItem general rules", () => {
    it("preserves metadata section", () => {
      expect(classifyItem({ section: "metadata", text: "Full-time" }, false)).toBe("metadata");
      expect(classifyItem({ section: "metadata", text: "Full-time" }, true)).toBe("metadata");
    });

    it("classifies preferred cues as preferred", () => {
      expect(classifyItem({ section: "general", text: "Docker is nice to have" }, true)).toBe(
        "preferred",
      );
      expect(classifyItem({ section: "must", text: "Knowledge of Rust is a plus" }, true)).toBe(
        "preferred",
      );
      expect(classifyItem({ section: "general", text: "AWS is preferred" }, true)).toBe(
        "preferred",
      );
      expect(classifyItem({ section: "general", text: "GraphQL is good to have" }, true)).toBe(
        "preferred",
      );
    });

    it("classifies requirement cues as must", () => {
      expect(
        classifyItem({ section: "general", text: "Candidate required to know SQL" }, true),
      ).toBe("must");
      expect(
        classifyItem({ section: "responsibility", text: "Mandatory attendance at standup" }, false),
      ).toBe("must");
    });

    it("respects non-general section if not overridden", () => {
      expect(
        classifyItem({ section: "preferred", text: "Experience with cloud platforms" }, false),
      ).toBe("preferred");
      expect(
        classifyItem({ section: "responsibility", text: "Mentor junior developers" }, false),
      ).toBe("responsibility");
    });

    it("classifies general items based on skills presence", () => {
      expect(
        classifyItem({ section: "general", text: "Deep knowledge of React and TypeScript" }, true),
      ).toBe("must");
      expect(
        classifyItem({ section: "general", text: "Collaborate closely with designers" }, false),
      ).toBe("responsibility");
    });
  });
});
