/**
 * Barrel export verification test for dedupe module.
 */

import { describe, it, expect } from "vitest";
import * as DedupeModule from "../../src/dedupe/index.js";

describe("dedupe barrel exports", () => {
  it("exports all public dedupe functions and utilities", () => {
    expect(typeof DedupeModule.findDuplicates).toBe("function");
    expect(typeof DedupeModule.checkIngestDuplicates).toBe("function");
    expect(typeof DedupeModule.areDuplicates).toBe("function");
    expect(typeof DedupeModule.normalizeCompany).toBe("function");
    expect(typeof DedupeModule.extractTitleTokens).toBe("function");
    expect(typeof DedupeModule.extractDescriptionShingles).toBe("function");
    expect(typeof DedupeModule.calculateJaccard).toBe("function");
    expect(typeof DedupeModule.prepareJob).toBe("function");
    expect(typeof DedupeModule.UnionFind).toBe("function");
  });
});
