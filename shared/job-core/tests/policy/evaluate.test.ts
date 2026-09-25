import { describe, expect, it } from "vitest";
import { evaluate } from "../../src/policy/index.js";
import { createValidPolicy } from "./schema.test.js";

describe("WP-SH-002: Capability Evaluation Engine", () => {
  const baseNow = new Date("2026-09-25T12:00:00Z");

  it("returns CAPABILITY_DISABLED for unknown capability id", () => {
    const policy = createValidPolicy();
    const decision = evaluate(policy, "nonexistent.capability", baseNow);
    expect(decision.allowed).toBe(false);
    expect(decision.error_code).toBe("CAPABILITY_DISABLED");
    expect(decision.level).toBe("unknown");
    expect(decision.status).toBe("disabled");
  });

  it("returns CAPABILITY_DISABLED when now is invalid Date", () => {
    const policy = createValidPolicy();
    const decision = evaluate(policy, "l0.analysis", new Date("invalid"));
    expect(decision.allowed).toBe(false);
    expect(decision.error_code).toBe("CAPABILITY_DISABLED");
  });

  it("allows L0 enabled capability regardless of staleness", () => {
    const policy = createValidPolicy({ snapshot_date: "2025-01-01" });
    const decision = evaluate(policy, "l0.analysis", baseNow);
    expect(decision.allowed).toBe(true);
    expect(decision.level).toBe("L0");
    expect(decision.status).toBe("enabled");
  });

  it("denies when status is blocked_by_provider_approval", () => {
    const policy = createValidPolicy();
    const decision = evaluate(policy, "l1.provider_job_search", baseNow);
    expect(decision.allowed).toBe(false);
    expect(decision.error_code).toBe("BLOCKED_BY_PROVIDER_APPROVAL");
    expect(decision.level).toBe("L1");
  });

  it("denies when status is disabled", () => {
    const policy = createValidPolicy();
    const decision = evaluate(policy, "l4.application_submit", baseNow);
    expect(decision.allowed).toBe(false);
    expect(decision.error_code).toBe("CAPABILITY_DISABLED");
  });

  it("denies when status is pending", () => {
    const policy = createValidPolicy({
      capabilities: [
        {
          id: "l1.pending_test",
          level: "L1",
          status: "pending",
          reason: "Pending rollout",
          approval_ref: null,
          sources: ["https://example.com"],
        },
      ],
    });
    const decision = evaluate(policy, "l1.pending_test", baseNow);
    expect(decision.allowed).toBe(false);
    expect(decision.error_code).toBe("CAPABILITY_DISABLED");
  });

  it("denies L1+ enabled capability if approval_ref is null", () => {
    const policy = createValidPolicy({
      capabilities: [
        {
          id: "l1.provider_job_search",
          level: "L1",
          status: "enabled",
          reason: "Unapproved enabled attempt",
          approval_ref: null,
          sources: ["https://example.com"],
        },
      ],
    });
    const decision = evaluate(policy, "l1.provider_job_search", baseNow);
    expect(decision.allowed).toBe(false);
    expect(decision.error_code).toBe("BLOCKED_BY_PROVIDER_APPROVAL");
  });

  it("denies L1+ enabled capability if approval_ref format is invalid", () => {
    const policy = createValidPolicy({
      capabilities: [
        {
          id: "l1.provider_job_search",
          level: "L1",
          status: "enabled",
          reason: "Invalid ref format",
          approval_ref: "INVALID-REF",
          sources: ["https://example.com"],
        },
      ],
    });
    const decision = evaluate(policy, "l1.provider_job_search", baseNow);
    expect(decision.allowed).toBe(false);
    expect(decision.error_code).toBe("BLOCKED_BY_PROVIDER_APPROVAL");
  });

  it("enforces exact day staleness boundary for L1+ capability", () => {
    const policy = createValidPolicy({
      snapshot_date: "2026-09-25",
      stale_after_days: 90,
      capabilities: [
        {
          id: "l1.provider_job_search",
          level: "L1",
          status: "enabled",
          reason: "Approved capability",
          approval_ref: "APPROVAL-NAUKRI-001",
          sources: ["https://example.com"],
        },
      ],
    });

    // Day 0: 2026-09-25 -> allowed
    const day0 = new Date("2026-09-25T12:00:00Z");
    expect(evaluate(policy, "l1.provider_job_search", day0).allowed).toBe(true);

    // Day 90: 2026-12-24 -> allowed (not stale yet, 90 <= 90)
    const day90 = new Date("2026-12-24T12:00:00Z");
    expect(evaluate(policy, "l1.provider_job_search", day90).allowed).toBe(true);

    // Day 91: 2026-12-25 -> denied POLICY_STALE (91 > 90)
    const day91 = new Date("2026-12-25T12:00:00Z");
    const staleDecision = evaluate(policy, "l1.provider_job_search", day91);
    expect(staleDecision.allowed).toBe(false);
    expect(staleDecision.error_code).toBe("POLICY_STALE");

    // R-4: snapshot +1 day ahead (evaluated at 00:30 IST on snapshot day) -> allowed (age -1 treated as 0)
    const istEarlyMorning = new Date("2026-09-24T19:00:00.000Z");
    const istDecision = evaluate(policy, "l1.provider_job_search", istEarlyMorning);
    expect(istDecision.allowed).toBe(true);

    // R-4: snapshot +2 days ahead -> denied POLICY_STALE (age -2 < 0)
    const twoDaysBefore = new Date("2026-09-23T12:00:00.000Z");
    const twoDaysEarlyDecision = evaluate(policy, "l1.provider_job_search", twoDaysBefore);
    expect(twoDaysEarlyDecision.allowed).toBe(false);
    expect(twoDaysEarlyDecision.error_code).toBe("POLICY_STALE");
  });

  it("always denies L4 capabilities independent of configuration", () => {
    const policy = createValidPolicy({
      capabilities: [
        {
          id: "l4.application_submit",
          level: "L4",
          status: "enabled",
          reason: "Permissive attempt",
          approval_ref: "APPROVAL-NAUKRI-001",
          sources: ["https://example.com"],
        },
      ],
    });
    const decision = evaluate(policy, "l4.application_submit", baseNow);
    expect(decision.allowed).toBe(false);
    expect(decision.error_code).toBe("CAPABILITY_DISABLED");
    expect(decision.reason).toContain("strictly disabled in v1");
  });
});
