import { describe, expect, it } from "vitest";
import {
  fingerprintJob,
  parseCompensation,
  parseEmploymentType,
  parseExperience,
  parseLocation,
  parsePostedAt,
  parseRemoteMode,
} from "../../src/normalize/index.js";

describe("normalization parsers", () => {
  it.each([
    ["5-8 years", "indeed", 5, 8],
    ["5 - 10 Yrs", "naukri", 5, 10],
    ["5+ years", "indeed", 5, null],
    ["minimum 5 years", "indeed", 5, null],
    ["at least 3 yrs", "naukri", 3, null],
    ["fresher", "naukri", 0, 1],
  ] as const)("parses experience %s", (text, provider, min, max) => {
    const result = parseExperience(text, provider);
    expect(result.value).toMatchObject({ min_years: min, max_years: max });
    expect(result.warning).toBeUndefined();
  });

  it.each([
    ["₹ 12-18 Lacs P.A.", "naukri", "INR", 1_200_000, 1_800_000, "year"],
    ["12-18 LPA", "naukri", "INR", 1_200_000, 1_800_000, "year"],
    ["1.2 Cr", "naukri", "INR", 12_000_000, 12_000_000, "year"],
    ["1 - 2 Crore", "naukri", "INR", 10_000_000, 20_000_000, "year"],
    ["₹30,000 - ₹45,000 a month", "indeed", "INR", 30_000, 45_000, "month"],
    ["$120,000 - $150,000 a year", "indeed", "USD", 120_000, 150_000, "year"],
    ["$25 an hour", "indeed", "USD", 25, 25, "hour"],
    ["₹50,000", "indeed", "INR", 50_000, 50_000, "unknown"],
  ] as const)("parses compensation %s", (text, provider, currency, min, max, period) => {
    const result = parseCompensation(text, provider);
    expect(result.value).toMatchObject({ currency, min, max, period, disclosed: true });
    expect(result.warning).toBeUndefined();
  });

  it("does not invent unreadable values", () => {
    expect(parseExperience("unknown years", "indeed").warning?.code).toBe("FIELD_UNPARSED");
    expect(parseExperience("61 years", "indeed").value.min_years).toBeNull();
    expect(parseExperience("10-5 years", "indeed").warning?.code).toBe("FIELD_UNPARSED");
    expect(parseCompensation("salary TBD", "indeed").warning?.code).toBe("FIELD_UNPARSED");
    expect(parseCompensation("Not Disclosed", "naukri").value.disclosed).toBe(false);
    expect(parseCompensation("", "indeed").value.disclosed).toBe(false);
    expect(parseCompensation(undefined, "indeed").value.disclosed).toBe(false);
    expect(parseCompensation("₹200 - ₹100", "indeed").warning?.code).toBe("FIELD_UNPARSED");
    expect(parseCompensation("₹2,000,000,000", "indeed").warning?.code).toBe("FIELD_UNPARSED");
  });

  it.each([
    ["Remote role", "remote"],
    ["WFH", "remote"],
    ["work from home", "remote"],
    ["Hybrid schedule", "hybrid"],
    ["work from office", "onsite"],
    ["on-site", "onsite"],
    ["unspecified", "unknown"],
  ] as const)("classifies remote mode %s", (text, expected) => {
    expect(parseRemoteMode(text).value).toBe(expected);
  });

  it.each([
    ["Full Time, Permanent", "full_time"],
    ["contractual role", "contract"],
    ["internship", "internship"],
    ["part-time", "part_time"],
    ["temporary role", "temporary"],
    ["unspecified", "unknown"],
  ] as const)("classifies employment type %s", (text, expected) => {
    expect(parseEmploymentType(text).value).toBe(expected);
  });

  it.each([
    ["Bengaluru, India", "Bengaluru", "IN"],
    ["Delhi/NCR", "Delhi/NCR", "IN"],
    ["Toronto, Canada", "Toronto", "CA"],
    ["Remote, United States", null, "US"],
    ["Unknownville", "Unknownville", null],
    ["Newnoida, Noida", "Newnoida", "IN"],
  ] as const)("parses location %s", (text, city, country) => {
    expect(parseLocation(text).value).toEqual({ raw: text, city, country });
  });

  it.each([
    ["2026-09-25", "indeed", "2026-09-25T00:00:00.000Z"],
    ["25 Sep 2026", "indeed", "2026-09-25T00:00:00.000Z"],
    ["25/09/2026", "naukri", "2026-09-25T00:00:00.000Z"],
    ["3 days ago", "indeed", null],
    ["Just posted", "indeed", null],
    ["25/09/2026", "indeed", null],
    ["2026-02-30", "indeed", null],
  ] as const)("parses absolute posted date %s", (text, provider, expected) => {
    expect(parsePostedAt(text, provider).value).toBe(expected);
  });

  it("fingerprints normalized content deterministically", () => {
    const left = {
      title: "Ｆｕｌｌ Stack",
      company: "Acme",
      location: "Pune",
      description: "Hello   World",
      origin: "user_paste" as const,
    };
    const right = {
      ...left,
      title: "full stack",
      company: "ACME",
      location: "PUNE",
      description: "hello world",
    };
    expect(fingerprintJob(left)).toBe(fingerprintJob(right));
    expect(fingerprintJob(left)).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(fingerprintJob({ ...left, description: "Different" })).not.toBe(fingerprintJob(left));
  });
});
