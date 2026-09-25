import { createHash } from "node:crypto";
import { z } from "zod";
import { fail, ok, partial, toCallToolResult, type EnvelopeContext } from "../envelope/index.js";
import { PipelineError } from "../pipeline/index.js";
import { evaluate } from "../policy/index.js";
import { StoreError } from "../store/index.js";
import type { ErrorCode, Envelope } from "../schemas/index.js";
import type { ToolDef } from "./catalog.js";
import { DomainError, type DomainResult, type ProductConfig } from "./types.js";

const maxRequestBytes = 256 * 1024;
const subjectPattern = /^(?:job|prof)_[0-9a-f-]{36}$/;

function safeLog(config: ProductConfig, tool: string, requestId: string, error: unknown): void {
  const errorType =
    error instanceof Error && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(error.name)
      ? error.name
      : "UnknownError";
  const digest = createHash("sha256")
    .update(error instanceof Error ? error.message : String(error))
    .digest("hex");
  const line = JSON.stringify({
    tool,
    request_id: requestId,
    error_type: errorType,
    error_digest: digest,
  });
  try {
    (config.logger ?? ((value: string) => process.stderr.write(`${value}\n`)))(line);
  } catch {
    /* logging must not change the result */
  }
}

function errorCode(error: unknown): ErrorCode {
  if (error instanceof DomainError || error instanceof PipelineError) return error.code;
  if (error instanceof StoreError) {
    switch (error.code) {
      case "INVALID_ID":
        return "INVALID_INPUT";
      case "LIMIT_EXCEEDED":
        return "CONFLICT";
      case "CONFIRMATION_INVALID":
        return "CONFIRMATION_INVALID";
      default:
        return "INTERNAL";
    }
  }
  if (error instanceof z.ZodError) return "INVALID_INPUT";
  return "INTERNAL";
}

function audit(
  config: ProductConfig,
  tool: string,
  requestId: string,
  outcome: "ok" | "error",
  code: string | null,
  subjectId?: string,
): void {
  config.store.audit.append({
    tool,
    requestId,
    outcome,
    errorCode: code,
    subjectId: subjectId && subjectPattern.test(subjectId) ? subjectId : null,
    at: (config.now?.() ?? new Date()).toISOString(),
  });
}

export function handleTool(def: ToolDef, args: unknown, config: ProductConfig) {
  const requestId = crypto.randomUUID();
  const ctx: EnvelopeContext = {
    tool: def.name,
    provider: config.provider,
    serverName: config.serverName,
    serverVersion: config.serverVersion,
    policySnapshotDate: config.policy.snapshot_date,
    capabilityMode: "L0",
    requestId,
  };
  let outcome: Envelope<unknown>;
  let subjectId: string | undefined;
  try {
    if (Buffer.byteLength(JSON.stringify(args), "utf8") > maxRequestBytes)
      throw new DomainError("INPUT_TOO_LARGE");
    const decision = evaluate(config.policy, def.capabilityId, config.now?.() ?? new Date());
    if (!decision.allowed) throw new DomainError(decision.error_code);
    const parsed = def.inputSchema.parse(args) as Record<string, unknown>;
    if (
      def.name === "jobs_ingest" &&
      (parsed.job as { origin?: string }).origin === "agent_relay"
    ) {
      const relay = evaluate(config.policy, "l0.agent_relay_ingest", config.now?.() ?? new Date());
      if (!relay.allowed) throw new DomainError(relay.error_code);
    }
    const result: DomainResult = def.handler(def.name, parsed, config);
    subjectId = result.subjectId;
    if (result.confirmationRequired) {
      outcome = {
        ...fail(ctx, "CONFIRMATION_REQUIRED", "Confirm deletion with the single-use token", {
          remediation: "Call data_purge again with confirmation_token.",
        }),
        data: result.data,
      };
    } else {
      const options = {
        ...(result.warnings ? { warnings: result.warnings } : {}),
        ...(result.provenance ? { provenance: result.provenance } : {}),
        ...(result.humanAction ? { humanAction: result.humanAction } : {}),
      };
      outcome = result.warnings?.length
        ? partial(ctx, result.data, options)
        : ok(ctx, result.data, options);
    }
  } catch (error) {
    const code = errorCode(error);
    if (code === "INTERNAL") safeLog(config, def.name, requestId, error);
    subjectId = error instanceof DomainError ? error.subjectId : undefined;
    outcome = fail(ctx, code, code === "INTERNAL" ? "" : code.replaceAll("_", " "), {
      remediation: code === "INTERNAL" ? "" : "Check the request and local policy, then retry.",
      ...(code === "CAPABILITY_DISABLED" ||
      code === "BLOCKED_BY_PROVIDER_APPROVAL" ||
      code === "POLICY_STALE"
        ? { capabilityId: def.capabilityId }
        : {}),
    });
  }
  try {
    audit(
      config,
      def.name,
      requestId,
      outcome.status === "error" ? "error" : "ok",
      outcome.error?.code ?? null,
      subjectId,
    );
  } catch (error) {
    safeLog(config, def.name, requestId, error);
  }
  return toCallToolResult(outcome);
}
