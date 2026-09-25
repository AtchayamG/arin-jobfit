import { describe, expect, it } from "vitest";
import { extractRequirements, matchSkills } from "../../src/extract/index.js";
import {
  normalizeJob,
  parseCompensation,
  parseEmploymentType,
  parseExperience,
  parseLocation,
  parsePostedAt,
  parseRemoteMode,
} from "../../src/normalize/index.js";

const maximumText = "z".repeat(50_000);
const ctx = {
  provider: "naukri" as const,
  now: new Date("2026-09-25T00:00:00Z"),
  url: { value: null, isOfficial: false },
  provenance: [
    { kind: "user_supplied" as const, detail: "Synthetic", captured_at: "2026-09-25T00:00:00Z" },
  ],
};
const job = normalizeJob(
  { title: "Engineer", description: maximumText, origin: "user_paste" },
  ctx,
).job;

function medianMs(run: () => unknown): number {
  run();
  const timings = Array.from({ length: 5 }, () => {
    const start = performance.now();
    run();
    return performance.now() - start;
  }).sort((left, right) => left - right);
  return timings[2] ?? Infinity;
}

describe("maximum-input timing", () => {
  it.each([
    ["experience", () => parseExperience(maximumText, "naukri")],
    ["compensation", () => parseCompensation(maximumText, "naukri")],
    ["remote mode", () => parseRemoteMode(maximumText)],
    ["employment type", () => parseEmploymentType(maximumText)],
    ["location", () => parseLocation(maximumText)],
    ["posted date", () => parsePostedAt(maximumText, "naukri")],
    ["skills", () => matchSkills(maximumText)],
    ["requirements", () => extractRequirements(job)],
  ] as const)("keeps %s under 50 ms median", (_name, run) => {
    expect(medianMs(run)).toBeLessThan(50);
  });
});
