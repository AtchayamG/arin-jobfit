/**
 * Unit tests for deduplication normalization and Jaccard similarity.
 */

import { describe, it, expect } from "vitest";
import {
  normalizeCompany,
  extractTitleTokens,
  extractDescriptionShingles,
} from "../../src/dedupe/normalize.js";
import { calculateJaccard } from "../../src/dedupe/jaccard.js";

describe("dedupe normalization", () => {
  describe("normalizeCompany", () => {
    it("strips corporate suffixes and punctuation", () => {
      const cases: [string | null | undefined, string][] = [
        ["Google, Inc.", "google"],
        ["Google LLC", "google"],
        ["Google Corporation", "google"],
        ["Google Corp.", "google"],
        ["Infosys Limited", "infosys"],
        ["Infosys Ltd.", "infosys"],
        ["Acme Pvt. Ltd.", "acme"],
        ["Acme Private Limited", "acme"],
        ["Tata Consultancy Services Pvt Ltd", "tata consultancy services"],
        ["Amazon.com, Inc.", "amazon com"],
        ["Meta Platforms, Inc.", "meta platforms"],
        ["  Strip Whitespace LLC  ", "strip whitespace"],
        [null, ""],
        [undefined, ""],
        ["", ""],
        ["Inc.", ""],
        ["Pvt Ltd", ""],
      ];

      for (const [input, expected] of cases) {
        expect(normalizeCompany(input)).toBe(expected);
      }
    });
  });

  describe("extractTitleTokens", () => {
    it("extracts unique lowercase alphanumeric tokens", () => {
      const tokens = extractTitleTokens("Senior Software Engineer (Backend / Cloud)");
      expect(tokens).toEqual(new Set(["senior", "software", "engineer", "backend", "cloud"]));
    });

    it("handles empty or special character titles", () => {
      expect(extractTitleTokens("").size).toBe(0);
      expect(extractTitleTokens("---").size).toBe(0);
    });
  });

  describe("extractDescriptionShingles", () => {
    it("extracts 5-word shingles correctly", () => {
      const desc = "we are looking for a senior software engineer to join our team";
      const shingles = extractDescriptionShingles(desc);

      expect(shingles.size).toBe(8);
      expect(shingles.has("we are looking for a")).toBe(true);
      expect(shingles.has("engineer to join our team")).toBe(true);
    });

    it("handles descriptions shorter than 5 words", () => {
      const shortDesc = "hiring senior engineer";
      const shingles = extractDescriptionShingles(shortDesc);
      expect(shingles).toEqual(new Set(["hiring senior engineer"]));
    });

    it("handles empty description or punctuation-only description", () => {
      expect(extractDescriptionShingles("").size).toBe(0);
      expect(extractDescriptionShingles("@#$%^&*").size).toBe(0);
    });

    it("truncates at 20,000 characters before shingling", () => {
      const repeated = "word ".repeat(6000); // 30,000 chars
      const shingles = extractDescriptionShingles(repeated);
      expect(shingles.size).toBe(1); // all identical shingles: "word word word word word"
    });
  });

  describe("calculateJaccard", () => {
    it("computes exact set similarity", () => {
      const setA = new Set(["a", "b", "c"]);
      const setB = new Set(["b", "c", "d"]);

      // Intersection: {b, c} (2), Union: {a, b, c, d} (4) -> 0.5
      expect(calculateJaccard(setA, setB)).toBe(0.5);

      // Asymmetric size: setA.size > setB.size
      expect(calculateJaccard(new Set(["a", "b", "c", "d"]), new Set(["b", "c"]))).toBe(0.5);

      // Identical sets -> 1.0
      expect(calculateJaccard(setA, setA)).toBe(1.0);

      // Disjoint sets -> 0.0
      expect(calculateJaccard(setA, new Set(["x", "y"]))).toBe(0.0);

      // Empty sets -> 1.0
      expect(calculateJaccard(new Set(), new Set())).toBe(1.0);

      // One empty set -> 0.0
      expect(calculateJaccard(setA, new Set())).toBe(0.0);
    });
  });
});
