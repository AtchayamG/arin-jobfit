/**
 * Capability evaluation engine.
 *
 * Implements pure fail-closed gating logic per ADR-001, ADR-006, and T-03/T-04.
 */

import type { CapabilityDecision, Policy, PolicyErrorCode } from "./types.js";

/**
 * Calculates calendar age in days between snapshot_date and now in UTC.
 */
export function calculateSnapshotAgeDays(snapshotDateStr: string, now: Date): number {
  const parts = snapshotDateStr.split("-");
  const yearStr = parts[0];
  const monthStr = parts[1];
  const dayStr = parts[2];
  if (yearStr === undefined || monthStr === undefined || dayStr === undefined) {
    return Number.POSITIVE_INFINITY;
  }
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  const snapTime = Date.UTC(year, month - 1, day);
  const nowDayTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diffDays = Math.floor((nowDayTime - snapTime) / 86400000);
  return diffDays === -1 ? 0 : diffDays;
}

/**
 * Pure evaluation of a capability against policy at a specific point in time.
 *
 * Decision flow:
 * 1. Unknown id -> denied CAPABILITY_DISABLED
 * 2. L4 hard rule -> denied CAPABILITY_DISABLED (ignores configuration)
 * 3. Status ≠ enabled -> denied with matching error code
 * 4. L0 enabled -> allowed regardless of staleness
 * 5. Level ≥ L1 enabled without valid approval_ref -> denied BLOCKED_BY_PROVIDER_APPROVAL
 * 6. Level ≥ L1 enabled with snapshot age > stale_after_days -> denied POLICY_STALE
 * 7. Level ≥ L1 enabled with valid approval_ref and fresh snapshot -> allowed
 */
export function evaluate(policy: Policy, capabilityId: string, now: Date): CapabilityDecision {
  if (!(now instanceof Date) || isNaN(now.getTime())) {
    return {
      allowed: false,
      capability_id: capabilityId,
      level: "unknown",
      status: "disabled",
      reason: "Invalid 'now' Date provided for policy evaluation",
      error_code: "CAPABILITY_DISABLED",
      approval_ref: null,
    };
  }

  // Safe search preventing prototype traversal
  const capability = policy.capabilities.find((c) => c.id === capabilityId);
  if (!capability) {
    return {
      allowed: false,
      capability_id: capabilityId,
      level: "unknown",
      status: "disabled",
      reason: `Unknown capability: ${capabilityId}`,
      error_code: "CAPABILITY_DISABLED",
      approval_ref: null,
    };
  }

  // Hard rule: L4 is ALWAYS denied in v1 (independent of config)
  if (capability.level === "L4") {
    return {
      allowed: false,
      capability_id: capability.id,
      level: "L4",
      status: capability.status,
      reason:
        capability.status === "disabled"
          ? capability.reason
          : "L4 capabilities are strictly disabled in v1",
      error_code: "CAPABILITY_DISABLED",
      approval_ref: capability.approval_ref,
    };
  }

  // Status check: status ≠ enabled -> denied with matching code
  if (capability.status !== "enabled") {
    const errorCode: PolicyErrorCode =
      capability.status === "blocked_by_provider_approval"
        ? "BLOCKED_BY_PROVIDER_APPROVAL"
        : "CAPABILITY_DISABLED";

    return {
      allowed: false,
      capability_id: capability.id,
      level: capability.level,
      status: capability.status,
      reason: capability.reason,
      error_code: errorCode,
      approval_ref: capability.approval_ref,
    };
  }

  // L0 enabled is allowed regardless of staleness
  if (capability.level === "L0") {
    return {
      allowed: true,
      capability_id: capability.id,
      level: "L0",
      status: "enabled",
      reason: capability.reason,
      approval_ref: capability.approval_ref,
    };
  }

  // Level ≥ L1 enabled requires a valid approval reference
  if (
    !capability.approval_ref ||
    !/^APPROVAL-(?:NAUKRI|INDEED)-\d{3}$/.test(capability.approval_ref)
  ) {
    return {
      allowed: false,
      capability_id: capability.id,
      level: capability.level,
      status: capability.status,
      reason: `Capability '${capability.id}' requires a valid written provider approval reference`,
      error_code: "BLOCKED_BY_PROVIDER_APPROVAL",
      approval_ref: capability.approval_ref,
    };
  }

  // Level ≥ L1 enabled requires a fresh snapshot
  const ageDays = calculateSnapshotAgeDays(policy.snapshot_date, now);
  if (ageDays < 0 || ageDays > policy.stale_after_days) {
    return {
      allowed: false,
      capability_id: capability.id,
      level: capability.level,
      status: capability.status,
      reason: `Policy snapshot is stale (${String(ageDays)} days old, max allowed is ${String(policy.stale_after_days)} days)`,
      error_code: "POLICY_STALE",
      approval_ref: capability.approval_ref,
    };
  }

  return {
    allowed: true,
    capability_id: capability.id,
    level: capability.level,
    status: "enabled",
    reason: capability.reason,
    approval_ref: capability.approval_ref,
  };
}
