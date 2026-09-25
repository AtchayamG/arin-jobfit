import { z } from "zod";

export const providerIdSchema = z.enum(["naukri", "indeed"]);
export const capabilityLevelSchema = z.enum(["L0", "L1", "L2", "L3", "L4"]);
export const provenanceSchema = z.strictObject({
  kind: z.enum(["user_supplied", "agent_relay", "provider_api", "derived"]),
  detail: z.string().max(200),
  captured_at: z.iso.datetime(),
});
export const warningCodeSchema = z.enum([
  "UNTRUSTED_CONTENT",
  "PROMPT_INJECTION_SUSPECTED",
  "CONTENT_SANITIZED",
  "POTENTIALLY_DISCRIMINATORY_REQUIREMENT",
  "FIELD_UNPARSED",
  "URL_NOT_OFFICIAL",
  "DUPLICATE_SUSPECTED",
  "OUTPUT_TRUNCATED",
  "LOW_CONFIDENCE",
]);
export const warningSchema = z.strictObject({
  code: warningCodeSchema,
  message: z.string(),
  field: z.string().optional(),
});
export const errorCodeSchema = z.enum([
  "INVALID_INPUT",
  "INPUT_TOO_LARGE",
  "NOT_FOUND",
  "UNSAFE_URL",
  "CONFLICT",
  "CONFIRMATION_REQUIRED",
  "CONFIRMATION_INVALID",
  "CAPABILITY_DISABLED",
  "BLOCKED_BY_PROVIDER_APPROVAL",
  "POLICY_STALE",
  "RATE_LIMITED",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "INTERNAL",
]);
export const toolErrorSchema = z.strictObject({
  code: errorCodeSchema,
  message: z.string(),
  retryable: z.boolean(),
  remediation: z.string(),
  capability_id: z.string().optional(),
});

export type ProviderId = z.infer<typeof providerIdSchema>;
export type CapabilityLevel = z.infer<typeof capabilityLevelSchema>;
export type Provenance = z.infer<typeof provenanceSchema>;
export type Warning = z.infer<typeof warningSchema>;
export type ErrorCode = z.infer<typeof errorCodeSchema>;
export type ToolError = z.infer<typeof toolErrorSchema>;
