import { describe, expect, it } from "vitest";
import { listCapabilities, lintPolicy, policyStatus } from "../../src/policy/index.js";
import { createValidPolicy } from "./schema.test.js";

describe("WP-SH-002: listCapabilities and policyStatus", () => {
  const baseNow = new Date("2026-09-25T12:00:00Z");

  it("lists capabilities accurately with effective status", () => {
    const policy = createValidPolicy({
      snapshot_date: "2026-01-01",
      stale_after_days: 90,
      capabilities: [
        {
          id: "l0.analysis",
          level: "L0",
          status: "enabled",
          reason: "Local analysis",
          approval_ref: null,
          sources: ["https://example.com"],
        },
        {
          id: "l1.test_stale",
          level: "L1",
          status: "enabled",
          reason: "Stale capability",
          approval_ref: "APPROVAL-NAUKRI-001",
          sources: ["https://example.com"],
        },
        {
          id: "l1.test_unapproved",
          level: "L1",
          status: "enabled",
          reason: "Unapproved capability",
          approval_ref: null,
          sources: ["https://example.com"],
        },
        {
          id: "l4.application_submit",
          level: "L4",
          status: "enabled",
          reason: "L4 attempt",
          approval_ref: null,
          sources: ["https://example.com"],
        },
      ],
    });

    const result = listCapabilities(policy, baseNow);
    expect(result.capabilities).toHaveLength(4);

    const l0 = result.capabilities.find((c) => c.id === "l0.analysis");
    expect(l0?.status).toBe("enabled");

    const staleL1 = result.capabilities.find((c) => c.id === "l1.test_stale");
    expect(staleL1?.status).toBe("disabled");
    expect(staleL1?.reason).toContain("[STALE SNAPSHOT]");

    const unapprovedL1 = result.capabilities.find((c) => c.id === "l1.test_unapproved");
    expect(unapprovedL1?.status).toBe("blocked_by_provider_approval");

    const l4 = result.capabilities.find((c) => c.id === "l4.application_submit");
    expect(l4?.status).toBe("disabled");
  });

  it("reports policyStatus correctly", () => {
    const policy = createValidPolicy({
      snapshot_date: "2026-09-25",
      stale_after_days: 90,
      partner_approval_recorded: false,
      capabilities: [
        {
          id: "l0.analysis",
          level: "L0",
          status: "enabled",
          reason: "Local",
          approval_ref: "APPROVAL-NAUKRI-001",
          sources: ["https://example.com"],
        },
        {
          id: "l0.store",
          level: "L0",
          status: "enabled",
          reason: "Local",
          approval_ref: "APPROVAL-NAUKRI-001",
          sources: ["https://example.com"],
        },
      ],
    });

    const status = policyStatus(policy, baseNow);
    expect(status.snapshot_date).toBe("2026-09-25");
    expect(status.stale).toBe(false);
    expect(status.stale_after_days).toBe(90);
    expect(status.partner_approval_recorded).toBe(false);
    expect(status.approvals).toEqual(["APPROVAL-NAUKRI-001"]);
  });
});

describe("WP-SH-002: lintPolicy", () => {
  const dummyLog = `
# Decisions Log
## Approval reference format
APPROVAL-NAUKRI-001 recorded on 2026-09-25.
`;

  it("passes lint when all rules are satisfied", () => {
    const policy = createValidPolicy({
      partner_approval_recorded: true,
      capabilities: [
        {
          id: "l1.provider_job_search",
          level: "L1",
          status: "enabled",
          reason: "Approved",
          approval_ref: "APPROVAL-NAUKRI-001",
          sources: ["https://example.com"],
        },
      ],
    });

    const results = lintPolicy(policy, dummyLog);
    const errors = results.filter((r) => r.level === "error");
    expect(errors).toHaveLength(0);
  });

  it("errors if L1+ enabled capability lacks approval_ref", () => {
    const policy = createValidPolicy({
      capabilities: [
        {
          id: "l1.provider_job_search",
          level: "L1",
          status: "enabled",
          reason: "No ref",
          approval_ref: null,
          sources: ["https://example.com"],
        },
      ],
    });
    const results = lintPolicy(policy, dummyLog);
    expect(results.some((r) => r.message.includes("has no approval_ref"))).toBe(true);
  });

  it("errors if approval_ref does not match required format", () => {
    const policy = createValidPolicy({
      capabilities: [
        {
          id: "l1.provider_job_search",
          level: "L1",
          status: "enabled",
          reason: "Bad ref",
          approval_ref: "NOT-A-VALID-REF",
          sources: ["https://example.com"],
        },
      ],
    });
    const results = lintPolicy(policy, dummyLog);
    expect(results.some((r) => r.message.includes("does not match required format"))).toBe(true);
  });

  it("errors if approval_ref does not appear in decisions log", () => {
    const policy = createValidPolicy({
      capabilities: [
        {
          id: "l1.provider_job_search",
          level: "L1",
          status: "enabled",
          reason: "Missing from log",
          approval_ref: "APPROVAL-NAUKRI-999",
          sources: ["https://example.com"],
        },
      ],
    });
    const results = lintPolicy(policy, dummyLog);
    expect(results.some((r) => r.message.includes("does not appear verbatim"))).toBe(true);
  });

  it("errors if partner_approval_recorded is true without any verified ref", () => {
    const policy = createValidPolicy({
      partner_approval_recorded: true,
      capabilities: [
        {
          id: "l0.analysis",
          level: "L0",
          status: "enabled",
          reason: "Local",
          approval_ref: null,
          sources: ["https://example.com"],
        },
      ],
    });
    const results = lintPolicy(policy, dummyLog);
    expect(results.some((r) => r.message.includes("partner_approval_recorded is true"))).toBe(true);
  });

  it("errors if L4 capability is enabled in lint", () => {
    const policy = createValidPolicy({
      capabilities: [
        {
          id: "l4.application_submit",
          level: "L4",
          status: "enabled",
          reason: "L4 attempt",
          approval_ref: null,
          sources: ["https://example.com"],
        },
      ],
    });
    const results = lintPolicy(policy, dummyLog);
    expect(results.some((r) => r.message.includes("level L4"))).toBe(true);
  });
});
