/**
 * Performance benchmark: 50 jobs × 20,000 chars description < 500 ms.
 */

import { describe, it, expect } from "vitest";
import { performance } from "node:perf_hooks";
import { createTestJob } from "../match/fixtures.js";
import { findDuplicates } from "../../src/dedupe/dedupe.js";
import type { Job } from "../../src/schemas/job.js";

describe("dedupe performance benchmark", () => {
  it("processes 50 jobs with 20,000-character descriptions in < 500 ms", () => {
    // Generate a 20,000 character description
    const sampleWords = [
      "software",
      "engineer",
      "cloud",
      "backend",
      "distributed",
      "systems",
      "architecture",
      "throughput",
      "concurrency",
      "performance",
      "database",
      "microservices",
      "kubernetes",
      "typescript",
      "golang",
      "scalability",
    ];
    let fullText = "";
    while (fullText.length < 20_000) {
      fullText += sampleWords.join(" ") + " ";
    }
    const desc20k = fullText.slice(0, 20_000);

    const jobs: Job[] = Array.from({ length: 50 }, (_, i) => {
      const hex = i.toString(16).padStart(12, "0");
      return createTestJob({
        job_id: `job_00000000-0000-4000-8000-${hex}`,
        fingerprint: `sha256:${i.toString(16).padStart(64, "0")}`,
        company: `Company ${String(i % 10)}`,
        title: `Staff Software Engineer Level ${String(i % 5)}`,
        description: desc20k,
      });
    });

    const start = performance.now();
    const { groups } = findDuplicates(jobs);
    const duration = performance.now() - start;

    expect(duration).toBeLessThan(500);
    expect(Array.isArray(groups)).toBe(true);
  });
});
