/**
 * Types for Policy and Capability Gating Engine.
 *
 * Implements fail-closed capability gates per ADR-001, ADR-006, and T-03/T-04.
 */

export type ProviderId = "naukri" | "indeed";

export type CapabilityLevel = "L0" | "L1" | "L2" | "L3" | "L4";

export type CapabilityStatus = "enabled" | "disabled" | "blocked_by_provider_approval" | "pending";

export type PolicyErrorCode =
  "CAPABILITY_DISABLED" | "BLOCKED_BY_PROVIDER_APPROVAL" | "POLICY_STALE";

export interface PolicyCapability {
  readonly id: string;
  readonly level: CapabilityLevel;
  readonly status: CapabilityStatus;
  readonly reason: string;
  readonly approval_ref: string | null;
  readonly sources: readonly string[];
}

export interface Policy {
  readonly policy_version: "1";
  readonly product: string;
  readonly provider: string;
  readonly snapshot_date: string;
  readonly stale_after_days: number;
  readonly partner_approval_recorded: boolean;
  readonly capabilities: readonly PolicyCapability[];
}

export interface AllowedCapabilityDecision {
  readonly allowed: true;
  readonly capability_id: string;
  readonly level: CapabilityLevel;
  readonly status: "enabled";
  readonly reason: string;
  readonly approval_ref: string | null;
  readonly error_code?: never;
}

export interface DeniedCapabilityDecision {
  readonly allowed: false;
  readonly capability_id: string;
  readonly level: CapabilityLevel | "unknown";
  readonly status: CapabilityStatus | "unknown";
  readonly reason: string;
  readonly error_code: PolicyErrorCode;
  readonly approval_ref: string | null;
}

export type CapabilityDecision = AllowedCapabilityDecision | DeniedCapabilityDecision;

export interface ListedCapability {
  readonly id: string;
  readonly level: CapabilityLevel;
  readonly status: CapabilityStatus;
  readonly reason: string;
  readonly approval_ref: string | null;
}

export interface ProviderCapabilitiesData {
  readonly capabilities: readonly ListedCapability[];
}

export interface ProviderPolicyStatusData {
  readonly snapshot_date: string;
  readonly stale: boolean;
  readonly stale_after_days: number;
  readonly partner_approval_recorded: boolean;
  readonly approvals: readonly string[];
}

export interface LintResult {
  readonly level: "error" | "warn";
  readonly message: string;
  readonly capability_id?: string;
}

/**
 * ProviderGateway interface for provider-facing operations.
 *
 * @remarks
 * At Capability Level L0, there is NO provider implementation.
 * All L1+ portal integrations are strictly BLOCKED_BY_PROVIDER_APPROVAL
 * until official written portal authorization is documented in Docs/09.
 *
 * Any future provider gateway execution must pass a verified CapabilityDecision
 * where `allowed: true`.
 */
export interface ProviderGateway<TRequest = unknown, TResponse = unknown> {
  (
    decision: CapabilityDecision & { readonly allowed: true },
    request: TRequest,
  ): Promise<TResponse>;
}
