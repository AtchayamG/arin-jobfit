import {
  fail,
  match,
  ok,
  partial,
  policy,
  prepare,
  toCallToolResult,
  type CallToolResultLike,
  type EnvelopeContext,
} from "@jpm/job-core";
import { resolveJob, resolveProfile, type Policy } from "./resolve.js";
import type {
  ApplicationHandoffInput,
  CvNotesInput,
  FitScoreInput,
  InterviewPrepInput,
  JdAnalyzeInput,
} from "./types.js";

const DEFAULT_SERVER_VERSION = "0.1.0";

function createCtx(tool: string, provider: "naukri" | "indeed", p: Policy): EnvelopeContext {
  return {
    tool,
    provider,
    serverName: provider === "indeed" ? "indeed-mcp" : "naukri-mcp",
    serverVersion: DEFAULT_SERVER_VERSION,
    policySnapshotDate: p.snapshot_date,
    capabilityMode: "L0",
    requestId: crypto.randomUUID(),
  };
}

function resolveProvider(p: Policy, override?: "naukri" | "indeed"): "naukri" | "indeed" {
  if (override) return override;
  return p.provider === "indeed" ? "indeed" : "naukri";
}

export function handleJdAnalyze(
  args: JdAnalyzeInput,
  p: Policy,
  now: Date = new Date(),
  overrideProvider?: "naukri" | "indeed",
): CallToolResultLike {
  const provider = resolveProvider(p, overrideProvider);
  const ctx = createCtx("jd_analyze", provider, p);
  try {
    const { job, requirements, warnings } = resolveJob(args.job, provider, now);
    const data = {
      job,
      requirements,
      discriminatory_flags: requirements.discriminatory_flags,
      warnings,
    };
    const envelope = warnings.length > 0 ? partial(ctx, data, { warnings }) : ok(ctx, data);
    return toCallToolResult(envelope);
  } catch (err) {
    return toCallToolResult(
      fail(ctx, "INVALID_INPUT", (err as Error).message, {
        remediation: "Check job description parameters, then retry.",
      }),
    );
  }
}

export function handleFitScore(
  args: FitScoreInput,
  p: Policy,
  now: Date = new Date(),
  overrideProvider?: "naukri" | "indeed",
): CallToolResultLike {
  const provider = resolveProvider(p, overrideProvider);
  const ctx = createCtx("fit_score", provider, p);
  try {
    const { job, requirements, warnings: jobWarnings } = resolveJob(args.job, provider, now);
    const { profile, profileRef } = resolveProfile(args.profile, now);
    const fitOutput = match.computeFit(job, requirements, profile, { profileRef });
    const explanation = match.explainMatch(fitOutput.result);
    const data = { ...fitOutput.result, explanation };
    const allWarnings = [...jobWarnings, ...fitOutput.warnings];
    const envelope =
      allWarnings.length > 0 ? partial(ctx, data, { warnings: allWarnings }) : ok(ctx, data);
    return toCallToolResult(envelope);
  } catch (err) {
    return toCallToolResult(
      fail(ctx, "INVALID_INPUT", (err as Error).message, {
        remediation: "Check job and profile inputs, then retry.",
      }),
    );
  }
}

export function handleCvNotes(
  args: CvNotesInput,
  p: Policy,
  now: Date = new Date(),
  overrideProvider?: "naukri" | "indeed",
): CallToolResultLike {
  const provider = resolveProvider(p, overrideProvider);
  const ctx = createCtx("cv_notes", provider, p);
  try {
    const { job, requirements, warnings } = resolveJob(args.job, provider, now);
    const { profile, profileRef } = resolveProfile(args.profile, now);
    const data = prepare.buildCvNotes(job, requirements, profile, profileRef);
    const envelope = warnings.length > 0 ? partial(ctx, data, { warnings }) : ok(ctx, data);
    return toCallToolResult(envelope);
  } catch (err) {
    return toCallToolResult(
      fail(ctx, "INVALID_INPUT", (err as Error).message, {
        remediation: "Check job and profile inputs, then retry.",
      }),
    );
  }
}

export function handleInterviewPrep(
  args: InterviewPrepInput,
  p: Policy,
  now: Date = new Date(),
  overrideProvider?: "naukri" | "indeed",
): CallToolResultLike {
  const provider = resolveProvider(p, overrideProvider);
  const ctx = createCtx("interview_prep", provider, p);
  try {
    const { job, requirements, warnings } = resolveJob(args.job, provider, now);
    const { profile } = resolveProfile(args.profile, now);
    const data = prepare.buildInterviewPlan(job, requirements, profile);
    const envelope = warnings.length > 0 ? partial(ctx, data, { warnings }) : ok(ctx, data);
    return toCallToolResult(envelope);
  } catch (err) {
    return toCallToolResult(
      fail(ctx, "INVALID_INPUT", (err as Error).message, {
        remediation: "Check job and profile inputs, then retry.",
      }),
    );
  }
}

export function handleApplicationHandoff(
  args: ApplicationHandoffInput,
  p: Policy,
  now: Date = new Date(),
  overrideProvider?: "naukri" | "indeed",
): CallToolResultLike {
  const provider = resolveProvider(p, overrideProvider);
  const ctx = createCtx("application_handoff", provider, p);
  try {
    const { job, warnings } = resolveJob(args.job, provider, now);
    const handoff = prepare.buildApplicationHandoff(job);
    const combinedWarnings = [...warnings, ...handoff.warnings];
    const envelope =
      combinedWarnings.length > 0
        ? partial(ctx, handoff.data, {
            warnings: combinedWarnings,
            humanAction: handoff.humanAction,
          })
        : ok(ctx, handoff.data, { humanAction: handoff.humanAction });
    return toCallToolResult(envelope);
  } catch (err) {
    return toCallToolResult(
      fail(ctx, "INVALID_INPUT", (err as Error).message, {
        remediation: "Check job input, then retry.",
      }),
    );
  }
}

export function handleCapabilitiesList(
  p: Policy,
  now: Date = new Date(),
  overrideProvider?: "naukri" | "indeed",
): CallToolResultLike {
  const provider = resolveProvider(p, overrideProvider);
  const ctx = createCtx("capabilities_list", provider, p);
  try {
    const data = policy.listCapabilities(p, now);
    return toCallToolResult(ok(ctx, data));
  } catch (err) {
    return toCallToolResult(
      fail(ctx, "INTERNAL", (err as Error).message, {
        remediation: "Server policy inspection failed.",
      }),
    );
  }
}
