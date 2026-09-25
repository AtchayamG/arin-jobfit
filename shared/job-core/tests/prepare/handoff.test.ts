import { describe, expect, it } from "vitest";
import { buildApplicationHandoff } from "../../src/prepare/handoff.js";
import { applicationHandoffResultSchema, HUMAN_ONLY_FIELDS } from "../../src/prepare/schemas.js";
import { createTestJob } from "./fixtures.js";

describe("buildApplicationHandoff", () => {
  it("handles job with official URL correctly", () => {
    const job = createTestJob({
      source_url: "https://naukri.com/job/12345",
      source_url_is_official: true,
    });

    const res = buildApplicationHandoff(job);
    const parsed = applicationHandoffResultSchema.parse(res);

    expect(parsed.data.official_url).toBe("https://naukri.com/job/12345");
    expect(parsed.data.url_is_official).toBe(true);
    expect(parsed.humanAction.official_url).toBe("https://naukri.com/job/12345");
    expect(parsed.warnings).toEqual([]);

    expect(parsed.data.checklist).toContain(
      "Open the listing on the official portal: https://naukri.com/job/12345",
    );
    expect(parsed.data.human_only_fields).toEqual(HUMAN_ONLY_FIELDS);
  });

  it("handles job with null URL correctly and advises manual portal navigation", () => {
    const job = createTestJob({
      source_url: null,
      source_url_is_official: false,
    });

    const res = buildApplicationHandoff(job);
    const parsed = applicationHandoffResultSchema.parse(res);

    expect(parsed.data.official_url).toBeNull();
    expect(parsed.data.url_is_official).toBe(false);
    expect(parsed.humanAction.official_url).toBeNull();
    expect(parsed.warnings).toEqual([]);

    expect(parsed.data.checklist).toContain("Open the listing on the official portal yourself");
  });

  it("emits URL_NOT_OFFICIAL warning for non-official source URL", () => {
    const job = createTestJob({
      source_url: "https://aggregator.io/job/9999",
      source_url_is_official: false,
    });

    const res = buildApplicationHandoff(job);
    const parsed = applicationHandoffResultSchema.parse(res);

    expect(parsed.data.official_url).toBe("https://aggregator.io/job/9999");
    expect(parsed.data.url_is_official).toBe(false);
    expect(parsed.humanAction.official_url).toBeNull();

    expect(parsed.warnings).toEqual([
      {
        code: "URL_NOT_OFFICIAL",
        message: "Job source URL is not from an official portal allowlist",
        field: "source_url",
      },
    ]);

    expect(parsed.data.checklist).toContain(
      "Review the listing at source URL: https://aggregator.io/job/9999",
    );
  });

  it("always provides fixed human_only_fields without omission", () => {
    const job = createTestJob();
    const res = buildApplicationHandoff(job);

    expect(res.data.human_only_fields).toEqual([
      "screening_answers",
      "salary_declaration",
      "notice_period",
      "personal_information_changes",
      "final_submit",
    ]);
  });

  it("preserves checklist length under 15 items", () => {
    const job = createTestJob();
    const res = buildApplicationHandoff(job);
    expect(res.data.checklist.length).toBeLessThanOrEqual(15);
  });
});
