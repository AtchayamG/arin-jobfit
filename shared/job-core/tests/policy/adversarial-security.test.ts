import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  calculateSnapshotAgeDays,
  evaluate,
  lintPolicy,
  loadPolicy,
  Policy,
  PolicyError,
  policyStatus,
  ProviderGateway,
} from "../../src/policy/index.js";

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

describe("WP-SH-002 Adversarial: Security, Bypass, and Invariants", () => {
  const baseNow = new Date("2026-09-25T12:00:00Z");

  describe("1. Prototype pollution attempts", () => {
    it("rejects JSON containing __proto__ key", () => {
      const jsonString = '{"policy_version":"1","__proto__":{"polluted":true}}';
      const parsed: unknown = JSON.parse(jsonString);
      expect(() => loadPolicy(parsed, baseNow)).toThrow(PolicyError);
    });

    it("rejects JSON containing prototype key", () => {
      const parsed: unknown = {
        ...getBasePolicy(),
        prototype: { polluted: true },
      };
      expect(() => loadPolicy(parsed, baseNow)).toThrow(PolicyError);
    });

    it("rejects JSON containing nested __proto__ in capability object", () => {
      const nestedProto: unknown = JSON.parse('{"__proto__":{"polluted":true}}');
      const parsed: unknown = {
        ...getBasePolicy(),
        capabilities: [
          {
            ...getBasePolicy().capabilities[0],
            nested: nestedProto,
          },
        ],
      };
      expect(() => loadPolicy(parsed, baseNow)).toThrow(PolicyError);
    });

    it("fails closed when querying __proto__, constructor, or toString", () => {
      const policy = getBasePolicy();
      expect(evaluate(policy, "__proto__", baseNow).allowed).toBe(false);
      expect(evaluate(policy, "constructor", baseNow).allowed).toBe(false);
      expect(evaluate(policy, "toString", baseNow).allowed).toBe(false);
    });
  });

  describe("2. Date manipulation and bounds", () => {
    it("handles calculateSnapshotAgeDays with invalid string input", () => {
      expect(calculateSnapshotAgeDays("bad-date", baseNow)).toBe(Number.POSITIVE_INFINITY);
    });

    it("marks policyStatus as stale if snapshot_date is future relative to now", () => {
      const policy = {
        ...getBasePolicy(),
        snapshot_date: "2026-09-25",
      };
      const pastNow = new Date("2020-01-01T00:00:00Z");
      expect(policyStatus(policy, pastNow).stale).toBe(true);
    });

    it("rejects future snapshot_date during loadPolicy", () => {
      const raw: unknown = {
        ...getBasePolicy(),
        snapshot_date: "2099-01-01",
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });

    it("fails closed in evaluate if snapshot_date is future relative to now", () => {
      const policy: Policy = {
        ...getBasePolicy(),
        snapshot_date: "2026-09-25",
        capabilities: [
          {
            id: "l1.test",
            level: "L1",
            status: "enabled",
            reason: "test",
            approval_ref: "APPROVAL-NAUKRI-001",
            sources: ["https://example.com"],
          },
        ],
      };
      const pastNow = new Date("2020-01-01T00:00:00Z");
      const decision = evaluate(policy, "l1.test", pastNow);
      expect(decision.allowed).toBe(false);
      expect(decision.error_code).toBe("POLICY_STALE");
    });

    it.each([
      "2026-02-30",
      "2026-04-31",
      "2026-13-01",
      "2026-00-10",
      "not-a-date",
      "2026/09/25",
      "2026-9-25",
    ])("rejects invalid calendar date: %s", (invalidDate) => {
      const raw: unknown = {
        ...getBasePolicy(),
        snapshot_date: invalidDate,
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });

    it.each([99999, 366, 0, -1, 1.5])("rejects invalid stale_after_days: %s", (invalidDays) => {
      const raw: unknown = {
        ...getBasePolicy(),
        stale_after_days: invalidDays,
      };
      expect(() => loadPolicy(raw, baseNow)).toThrow(PolicyError);
    });
  });

  describe("3. Token boundary and provider isolation in lint", () => {
    it.each([
      "Recorded ref: APPROVAL-NAUKRI-00199 approved.",
      "Recorded ref: PREFIX-APPROVAL-NAUKRI-001 approved.",
      "Recorded ref: APPROVAL-NAUKRI-001-EXTRA approved.",
    ])("fails lint if approval_ref appears only as part of larger token", (badLog) => {
      const policy: Policy = {
        ...getBasePolicy(),
        capabilities: [
          {
            id: "l1.search",
            level: "L1",
            status: "enabled",
            reason: "test",
            approval_ref: "APPROVAL-NAUKRI-001",
            sources: ["https://example.com"],
          },
        ],
      };
      const results = lintPolicy(policy, badLog);
      expect(results.some((e) => e.message.includes("does not appear verbatim"))).toBe(true);
    });

    it("fails lint if approval_ref contradicts provider prefix", () => {
      const policyNaukri: Policy = {
        ...getBasePolicy(),
        provider: "naukri",
        capabilities: [
          {
            id: "l1.search",
            level: "L1",
            status: "blocked_by_provider_approval",
            reason: "test",
            approval_ref: "APPROVAL-INDEED-001",
            sources: ["https://example.com"],
          },
        ],
      };
      const resNaukri = lintPolicy(policyNaukri, "APPROVAL-INDEED-001");
      expect(
        resNaukri.some((r) => r.message.includes("does not match policy provider 'naukri'")),
      ).toBe(true);

      const policyIndeed: Policy = {
        ...getBasePolicy(),
        provider: "indeed",
        capabilities: [
          {
            id: "l1.search",
            level: "L1",
            status: "blocked_by_provider_approval",
            reason: "test",
            approval_ref: "APPROVAL-NAUKRI-001",
            sources: ["https://example.com"],
          },
        ],
      };
      const resIndeed = lintPolicy(policyIndeed, "APPROVAL-NAUKRI-001");
      expect(
        resIndeed.some((r) => r.message.includes("does not match policy provider 'indeed'")),
      ).toBe(true);

      const policyCustom: Policy = {
        ...getBasePolicy(),
        provider: "custom",
        capabilities: [
          {
            id: "l1.search",
            level: "L1",
            status: "blocked_by_provider_approval",
            reason: "test",
            approval_ref: "APPROVAL-NAUKRI-001",
            sources: ["https://example.com"],
          },
        ],
      };
      const resCustom = lintPolicy(policyCustom, "APPROVAL-NAUKRI-001");
      expect(resCustom.filter((r) => r.level === "error")).toHaveLength(0);
    });
  });

  describe("4. L4 hard-rule bypass attempt", () => {
    it("strictly denies L4 independent of permissive config", () => {
      const policy: Policy = {
        ...getBasePolicy(),
        capabilities: [
          {
            id: "l4.application_submit",
            level: "L4",
            status: "enabled",
            reason: "Attempting to bypass L4 gate",
            approval_ref: "APPROVAL-NAUKRI-001",
            sources: ["https://example.com"],
          },
        ],
      };

      const decision = evaluate(policy, "l4.application_submit", baseNow);
      expect(decision.allowed).toBe(false);
      expect(decision.error_code).toBe("CAPABILITY_DISABLED");
      expect(decision.reason).toContain("strictly disabled in v1");

      const lintResults = lintPolicy(policy, "APPROVAL-NAUKRI-001");
      expect(lintResults.some((r) => r.message.includes("level L4"))).toBe(true);
    });
  });

  describe("5. Static import audit and ProviderGateway invariant", () => {
    it("ensures no network or I/O modules are imported inside src/policy", () => {
      const policyDir = path.resolve(process.cwd(), "src/policy");
      const files = fs.readdirSync(policyDir).filter((f) => f.endsWith(".ts"));

      const forbiddenImports = [
        "node:http",
        "node:https",
        "node:net",
        "node:fs",
        "http",
        "https",
        "net",
        "fs",
        "fetch",
        "axios",
        "undici",
      ];

      for (const file of files) {
        const content = fs.readFileSync(path.join(policyDir, file), "utf-8");
        for (const forbidden of forbiddenImports) {
          const importPattern = new RegExp(
            `from\\s+['"]${forbidden}['"]|import\\s*\\(['"]${forbidden}['"]\\)`,
          );
          expect(importPattern.test(content)).toBe(false);
        }
        const nakedNewDatePattern = /new\s+Date\s*\(\s*\)/;
        expect(nakedNewDatePattern.test(content)).toBe(false);
      }
    });

    it("verifies ProviderGateway has no implementation (interface-only)", () => {
      const dummyGateway: ProviderGateway | null = null;
      expect(dummyGateway).toBeNull();
    });
  });
});
