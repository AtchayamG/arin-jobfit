import { describe, expect, it } from "vitest";
import { loadPolicy, Policy, PolicyError } from "../../src/policy/index.js";

export function createValidPolicy(overrides: Partial<Policy> = {}): Policy {
  return {
    policy_version: "1",
    product: "test-product",
    provider: "naukri",
    snapshot_date: "2026-09-25",
    stale_after_days: 90,
    partner_approval_recorded: false,
    capabilities: [
      {
        id: "l0.analysis",
        level: "L0",
        status: "enabled",
        reason: "Local analysis",
        approval_ref: null,
        sources: ["https://example.com/source"],
      },
      {
        id: "l1.provider_job_search",
        level: "L1",
        status: "blocked_by_provider_approval",
        reason: "Requires partner approval",
        approval_ref: null,
        sources: ["https://example.com/source"],
      },
      {
        id: "l4.application_submit",
        level: "L4",
        status: "disabled",
        reason: "out of scope v1",
        approval_ref: null,
        sources: ["https://example.com/source"],
      },
    ],
    ...overrides,
  };
}

describe("WP-SH-002: Policy Loader and Schema", () => {
  const baseNow = new Date("2026-09-25T12:00:00Z");

  it("loads a valid policy successfully without partial load", () => {
    const raw = createValidPolicy();
    const policy = loadPolicy(raw, baseNow);
    expect(policy.policy_version).toBe("1");
    expect(policy.capabilities).toHaveLength(3);
  });

  it("throws PolicyError if now is invalid", () => {
    const raw = createValidPolicy();
    expect(() => loadPolicy(raw, new Date("invalid"))).toThrow(PolicyError);
  });

  it("throws PolicyError if policy schema validation fails", () => {
    const raw = { invalid: true };
    expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
  });

  it("throws PolicyError on duplicate capability IDs", () => {
    const raw = createValidPolicy({
      capabilities: [
        {
          id: "l0.analysis",
          level: "L0",
          status: "enabled",
          reason: "Reason 1",
          approval_ref: null,
          sources: ["https://example.com"],
        },
        {
          id: "l0.analysis",
          level: "L0",
          status: "disabled",
          reason: "Reason 2",
          approval_ref: null,
          sources: ["https://example.com"],
        },
      ],
    });
    expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
  });

  it("throws PolicyError on invalid snapshot date format or calendar date", () => {
    const rawFormat = createValidPolicy({ snapshot_date: "25-09-2026" });
    expect(() => loadPolicy(rawFormat, baseNow)).toThrow(PolicyError);

    const rawCalendar = createValidPolicy({ snapshot_date: "2026-02-30" });
    expect(() => loadPolicy(rawCalendar, baseNow)).toThrow(PolicyError);
  });

  it("throws PolicyError if snapshot_date is in the future", () => {
    const rawFuture = createValidPolicy({ snapshot_date: "2026-09-26" });
    expect(() => loadPolicy(rawFuture, baseNow)).toThrow(PolicyError);
  });
});
