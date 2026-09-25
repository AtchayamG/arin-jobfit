import { describe, expect, it } from "vitest";
import { evaluate, loadPolicy, Policy, PolicyError } from "../../src/policy/index.js";

function getBasePolicy(): Policy {
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
        reason: "Valid L0 analysis",
        approval_ref: null,
        sources: ["https://example.com/source"],
      },
    ],
  };
}

describe("WP-SH-002 Adversarial: Type Coercion, Case and Whitespace", () => {
  const baseNow = new Date("2026-09-25T12:00:00Z");

  describe("1. Type coercion attempts", () => {
    it("rejects string stale_after_days without coercion", () => {
      const raw: unknown = {
        ...getBasePolicy(),
        stale_after_days: "90",
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });

    it("rejects numeric policy_version without coercion", () => {
      const raw: unknown = {
        ...getBasePolicy(),
        policy_version: 1,
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });

    it("rejects string partner_approval_recorded", () => {
      const raw: unknown = {
        ...getBasePolicy(),
        partner_approval_recorded: "true",
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });

    it("rejects numeric level", () => {
      const raw: unknown = {
        ...getBasePolicy(),
        capabilities: [
          {
            id: "l0.analysis",
            level: 0,
            status: "enabled",
            reason: "test",
            approval_ref: null,
            sources: ["https://example.com"],
          },
        ],
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });
  });

  describe("2. Case variant bypass attempts", () => {
    it("rejects uppercase or titlecase status values", () => {
      const rawUpper: unknown = {
        ...getBasePolicy(),
        capabilities: [
          {
            id: "l0.analysis",
            level: "L0",
            status: "ENABLED",
            reason: "test",
            approval_ref: null,
            sources: ["https://example.com"],
          },
        ],
      };
      expect(() => loadPolicy(rawUpper, baseNow)).toThrow(PolicyError);

      const rawTitle: unknown = {
        ...getBasePolicy(),
        capabilities: [
          {
            id: "l0.analysis",
            level: "L0",
            status: "Enabled",
            reason: "test",
            approval_ref: null,
            sources: ["https://example.com"],
          },
        ],
      };
      expect(() => loadPolicy(rawTitle, baseNow)).toThrow(PolicyError);
    });

    it("rejects lowercase level values like l0 or l1", () => {
      const raw: unknown = {
        ...getBasePolicy(),
        capabilities: [
          {
            id: "l0.analysis",
            level: "l0",
            status: "enabled",
            reason: "test",
            approval_ref: null,
            sources: ["https://example.com"],
          },
        ],
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });

    it("does not match capability IDs with differing case in evaluate", () => {
      const policy = getBasePolicy();
      const decision = evaluate(policy, "L0.ANALYSIS", baseNow);
      expect(decision.allowed).toBe(false);
      expect(decision.error_code).toBe("CAPABILITY_DISABLED");
    });
  });

  describe("3. Whitespace bypass attempts", () => {
    it("rejects status with whitespace padding", () => {
      const raw: unknown = {
        ...getBasePolicy(),
        capabilities: [
          {
            id: "l0.analysis",
            level: "L0",
            status: " enabled ",
            reason: "test",
            approval_ref: null,
            sources: ["https://example.com"],
          },
        ],
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });

    it("rejects approval_ref with leading or trailing whitespace", () => {
      const raw: unknown = {
        ...getBasePolicy(),
        capabilities: [
          {
            id: "l1.test",
            level: "L1",
            status: "blocked_by_provider_approval",
            reason: "test",
            approval_ref: " APPROVAL-NAUKRI-001 ",
            sources: ["https://example.com"],
          },
        ],
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });

    it("rejects reason with whitespace only", () => {
      const raw: unknown = {
        ...getBasePolicy(),
        capabilities: [
          {
            id: "l0.analysis",
            level: "L0",
            status: "enabled",
            reason: "   \t \n  ",
            approval_ref: null,
            sources: ["https://example.com"],
          },
        ],
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });

    it("rejects capability ID with whitespace", () => {
      const raw: unknown = {
        ...getBasePolicy(),
        capabilities: [
          {
            id: " l0.analysis ",
            level: "L0",
            status: "enabled",
            reason: "test",
            approval_ref: null,
            sources: ["https://example.com"],
          },
        ],
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });
  });
});
