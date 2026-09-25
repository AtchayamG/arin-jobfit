/**
 * Zod schemas and policy loader.
 *
 * Implements strict policy schema validation per ADR-006 and fail-closed security.
 */

import { z } from "zod";
import type { Policy } from "./types.js";

export class PolicyError extends Error {
  public readonly code: string;

  constructor(message: string, code = "INVALID_POLICY") {
    super(message);
    this.name = "PolicyError";
    this.code = code;
    Object.setPrototypeOf(this, PolicyError.prototype);
  }
}

export function isValidCalendarDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const parts = dateStr.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

export function isFutureDate(dateStr: string, now: Date): boolean {
  const parts = dateStr.split("-");
  const year = Number(parts[0]);
  const month = Number(parts[1]);
  const day = Number(parts[2]);
  const snapTime = Date.UTC(year, month - 1, day);
  const nowDayTime = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  // Allow +1 day tolerance for timezone differences (e.g. IST midnight vs UTC)
  return snapTime - nowDayTime > 86400000;
}

export const policyCapabilitySchema = z
  .object({
    id: z
      .string()
      .min(1, "Capability id cannot be empty")
      .regex(
        /^[a-z0-9_.-]+$/,
        "Capability id must contain only lowercase alphanumeric characters, '.', '_' and '-'",
      ),
    level: z.enum(["L0", "L1", "L2", "L3", "L4"]),
    status: z.enum(["enabled", "disabled", "blocked_by_provider_approval", "pending"]),
    reason: z
      .string()
      .min(1, "Reason cannot be empty")
      .max(300, "Reason must not exceed 300 characters")
      .refine((r) => r.trim().length > 0, "Reason cannot be whitespace only"),
    approval_ref: z
      .string()
      .min(1, "approval_ref cannot be empty string")
      .refine(
        (ref) => ref.trim() === ref,
        "approval_ref must not contain leading or trailing whitespace",
      )
      .nullable(),
    sources: z
      .array(
        z.url("Source must be a valid URL").refine((url) => url.startsWith("https://"), {
          message: "Source URL must use https scheme",
        }),
      )
      .min(1, "At least one source URL is required"),
  })
  .strict();

export const policyFileSchema = z
  .object({
    policy_version: z.literal("1"),
    product: z.string().min(1, "Product name cannot be empty"),
    provider: z.string().min(1, "Provider name cannot be empty"),
    snapshot_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "snapshot_date must match YYYY-MM-DD format")
      .refine(isValidCalendarDate, "snapshot_date must be a valid calendar date"),
    stale_after_days: z
      .number()
      .int("stale_after_days must be an integer")
      .min(1, "stale_after_days must be at least 1")
      .max(365, "stale_after_days cannot exceed 365")
      .default(90),
    partner_approval_recorded: z.boolean(),
    capabilities: z.array(policyCapabilitySchema).refine(
      (caps) => {
        const ids = new Set<string>();
        for (const cap of caps) {
          if (ids.has(cap.id)) {
            return false;
          }
          ids.add(cap.id);
        }
        return true;
      },
      {
        message: "Capability IDs must be unique within policy",
      },
    ),
  })
  .strict();

function hasPrototypePollutionKey(obj: unknown): boolean {
  if (typeof obj !== "object" || obj === null) {
    return false;
  }
  if (Object.prototype.hasOwnProperty.call(obj, "__proto__")) {
    return true;
  }
  if (Object.prototype.hasOwnProperty.call(obj, "prototype")) {
    return true;
  }
  for (const value of Object.values(obj)) {
    if (hasPrototypePollutionKey(value)) {
      return true;
    }
  }
  return false;
}

/**
 * Pure function to parse and validate policy JSON.
 *
 * @throws PolicyError if validation fails or snapshot_date is in the future.
 * Never performs partial loads.
 */
export function loadPolicy(json: unknown, now: Date): Policy {
  if (!(now instanceof Date) || isNaN(now.getTime())) {
    throw new PolicyError("Invalid 'now' Date provided", "INVALID_DATE");
  }

  if (hasPrototypePollutionKey(json)) {
    throw new PolicyError(
      "Policy contains forbidden prototype pollution key",
      "PROTOTYPE_POLLUTION_DETECTED",
    );
  }

  const parsed = policyFileSchema.safeParse(json);
  if (!parsed.success) {
    const errorDetails = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
      .join("; ");
    throw new PolicyError(`Policy validation failed: ${errorDetails}`, "INVALID_POLICY_SCHEMA");
  }

  const policy = parsed.data;

  if (isFutureDate(policy.snapshot_date, now)) {
    throw new PolicyError(
      `Policy snapshot_date ${policy.snapshot_date} is in the future relative to current date`,
      "FUTURE_SNAPSHOT_DATE",
    );
  }

  return policy;
}
