/**
 * Tool data providers for provider_capabilities and provider_policy_status.
 *
 * Implements capability listing and status reporting per ADR-006 and Doc 17 §4.
 */

import { calculateSnapshotAgeDays, evaluate } from "./evaluate.js";
import type {
  CapabilityStatus,
  ListedCapability,
  Policy,
  ProviderCapabilitiesData,
  ProviderPolicyStatusData,
} from "./types.js";

/**
 * Returns data for the provider_capabilities MCP tool.
 *
 * Evaluates effective capability status against current time, ensuring
 * that stale snapshots or unapproved L1+ capabilities are downgraded.
 */
export function listCapabilities(policy: Policy, now: Date): ProviderCapabilitiesData {
  const capabilities: ListedCapability[] = policy.capabilities.map((cap) => {
    const decision = evaluate(policy, cap.id, now);

    let effectiveStatus: CapabilityStatus = cap.status;
    let reason = cap.reason;

    if (cap.level === "L4") {
      effectiveStatus = "disabled";
      reason = cap.reason;
    } else if (cap.status === "enabled" && !decision.allowed) {
      if (decision.error_code === "POLICY_STALE") {
        effectiveStatus = "disabled";
        reason = `[STALE SNAPSHOT] ${cap.reason}`;
      } else {
        effectiveStatus = "blocked_by_provider_approval";
      }
    }

    return {
      id: cap.id,
      level: cap.level,
      status: effectiveStatus,
      reason,
      approval_ref: cap.approval_ref,
    };
  });

  return { capabilities };
}

/**
 * Returns data for the provider_policy_status MCP tool.
 */
export function policyStatus(policy: Policy, now: Date): ProviderPolicyStatusData {
  const ageDays = calculateSnapshotAgeDays(policy.snapshot_date, now);
  const stale = ageDays < 0 || ageDays > policy.stale_after_days;

  const approvals = Array.from(
    new Set(
      policy.capabilities
        .map((c) => c.approval_ref)
        .filter((ref): ref is string => ref !== null && ref.trim().length > 0),
    ),
  );

  return {
    snapshot_date: policy.snapshot_date,
    stale,
    stale_after_days: policy.stale_after_days,
    partner_approval_recorded: policy.partner_approval_recorded,
    approvals,
  };
}
