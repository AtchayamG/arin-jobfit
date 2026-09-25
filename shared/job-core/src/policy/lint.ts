/**
 * Policy linter.
 *
 * Implements cross-validation against Docs/09 decisions log per ADR-006 and Doc 16 §3.
 */

import type { LintResult, Policy } from "./types.js";

const APPROVAL_REF_REGEX = /^APPROVAL-(?:NAUKRI|INDEED)-\d{3}$/;

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function appearsVerbatimInLog(ref: string, decisionsLogText: string): boolean {
  // Enforce exact token boundary to prevent substring bypasses
  const pattern = new RegExp(`(?<![A-Za-z0-9_-])${escapeRegex(ref)}(?![A-Za-z0-9_-])`);
  return pattern.test(decisionsLogText);
}

/**
 * Lints a loaded Policy against decisions log text.
 *
 * Rules:
 * - Error if any capability with level ≥ L1 is enabled and its approval_ref
 *   (format APPROVAL-(NAUKRI|INDEED)-\d{3}) does not appear verbatim in decisions log.
 * - Error if partner_approval_recorded is true without any verified ref in decisions log.
 * - Error if any L4 capability has status "enabled".
 * - Error if approval_ref provider prefix contradicts policy.provider.
 */
export function lintPolicy(policy: Policy, decisionsLogText: string): LintResult[] {
  const results: LintResult[] = [];
  const verifiedApprovalRefs = new Set<string>();

  for (const cap of policy.capabilities) {
    // Rule: L4 can never be enabled
    if (cap.level === "L4" && cap.status === "enabled") {
      results.push({
        level: "error",
        message: `Capability '${cap.id}' has level L4 which cannot be enabled in v1`,
        capability_id: cap.id,
      });
    }

    // Check approval_ref validity whenever present
    if (cap.approval_ref !== null) {
      if (!APPROVAL_REF_REGEX.test(cap.approval_ref)) {
        results.push({
          level: "error",
          message: `Capability '${cap.id}' approval_ref '${cap.approval_ref}' does not match required format APPROVAL-(NAUKRI|INDEED)-\\d{3}`,
          capability_id: cap.id,
        });
      } else {
        // Check provider isolation
        const expectedPrefix =
          policy.provider === "naukri"
            ? "APPROVAL-NAUKRI-"
            : policy.provider === "indeed"
              ? "APPROVAL-INDEED-"
              : null;

        if (expectedPrefix && !cap.approval_ref.startsWith(expectedPrefix)) {
          results.push({
            level: "error",
            message: `Capability '${cap.id}' approval_ref '${cap.approval_ref}' does not match policy provider '${policy.provider}'`,
            capability_id: cap.id,
          });
        }

        if (appearsVerbatimInLog(cap.approval_ref, decisionsLogText)) {
          verifiedApprovalRefs.add(cap.approval_ref);
        }
      }
    }

    // Rule: L1+ enabled requires valid approval_ref in decisions log
    if (cap.level !== "L0" && cap.status === "enabled") {
      if (cap.approval_ref === null || cap.approval_ref.trim().length === 0) {
        results.push({
          level: "error",
          message: `Capability '${cap.id}' (level ${cap.level}) is enabled but has no approval_ref`,
          capability_id: cap.id,
        });
      } else if (!APPROVAL_REF_REGEX.test(cap.approval_ref)) {
        // already flagged above
      } else if (!appearsVerbatimInLog(cap.approval_ref, decisionsLogText)) {
        results.push({
          level: "error",
          message: `Capability '${cap.id}' has approval_ref '${cap.approval_ref}' which does not appear verbatim in decisions log`,
          capability_id: cap.id,
        });
      }
    }
  }

  // Rule: partner_approval_recorded requires at least one verified ref in log
  if (policy.partner_approval_recorded && verifiedApprovalRefs.size === 0) {
    results.push({
      level: "error",
      message:
        "partner_approval_recorded is true, but no verified approval reference was found in decisions log",
    });
  }

  return results;
}
