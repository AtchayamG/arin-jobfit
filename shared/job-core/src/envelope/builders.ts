import type {
  CapabilityLevel,
  Envelope,
  ErrorCode,
  HumanAction,
  Provenance,
  ProviderId,
  Warning,
} from "../schemas/index.js";

export interface EnvelopeContext {
  tool: string;
  provider: ProviderId;
  serverName: "naukri-mcp" | "indeed-mcp";
  serverVersion: string;
  policySnapshotDate: string;
  capabilityMode: CapabilityLevel;
  requestId?: string;
}

interface SuccessOptions {
  warnings?: Warning[];
  provenance?: Provenance[];
  humanAction?: HumanAction;
}

const base = (ctx: EnvelopeContext) => ({
  contract_version: "1.0.0" as const,
  provider: ctx.provider,
  capability_mode: ctx.capabilityMode,
  source_provenance: [] as Provenance[],
  warnings: [] as Warning[],
  human_action_required: null as HumanAction | null,
  meta: {
    tool: ctx.tool,
    request_id: ctx.requestId ?? crypto.randomUUID(),
    server: ctx.serverName,
    server_version: ctx.serverVersion,
    policy_snapshot_date: ctx.policySnapshotDate,
  },
});

const success = <T>(
  status: "ok" | "partial",
  ctx: EnvelopeContext,
  data: T,
  options: SuccessOptions = {},
): Envelope<T> => ({
  ...base(ctx),
  status,
  data,
  source_provenance: options.provenance ?? [],
  warnings: options.warnings ?? [],
  human_action_required: options.humanAction ?? null,
  error: null,
});

export const ok = <T>(ctx: EnvelopeContext, data: T, options?: SuccessOptions): Envelope<T> =>
  success("ok", ctx, data, options);

export const partial = <T>(ctx: EnvelopeContext, data: T, options?: SuccessOptions): Envelope<T> =>
  success("partial", ctx, data, options);

export const fail = (
  ctx: EnvelopeContext,
  code: ErrorCode,
  message: string,
  options: { remediation: string; retryable?: boolean; capabilityId?: string },
): Envelope<null> => ({
  ...base(ctx),
  status: "error",
  data: null,
  error: {
    code,
    message: code === "INTERNAL" ? "Internal error. Refer to the request ID." : message,
    retryable: code === "INTERNAL" ? false : (options.retryable ?? false),
    remediation: code === "INTERNAL" ? "Contact support with the request ID." : options.remediation,
    ...(code === "INTERNAL" || options.capabilityId === undefined
      ? {}
      : { capability_id: options.capabilityId }),
  },
});
