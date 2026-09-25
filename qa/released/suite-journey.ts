import type { Client } from "@modelcontextprotocol/client";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import type { ManagedMcpClient } from "./client-manager.js";
import { withTimeout } from "./client-manager.js";
import {
  getFieldValue,
  getScenarioJds,
  scratchProfile,
  seniorMobileProfile,
  toProfileInput,
} from "./scenarios.js";

const ajv = new (Ajv2020 as any)({ allErrors: true, strict: false });
(addFormats as any)(ajv);

interface ToolEnvelope<T = Record<string, unknown>> {
  status: string;
  data: T;
  warnings?: Array<{ code: string; message: string }>;
  error?: { code: string; message: string };
  human_action_required?: { reason: string; actions: string[]; official_url: string | null };
}

export async function runFullJourney(
  server: ManagedMcpClient,
  edition: "nk" | "id",
  toolCoverage: Map<string, number>,
  toolLatenciesMs: number[],
  toolsList: Array<{ name: string; outputSchema?: unknown }>,
) {
  const client = server.client;
  let schemaValidationCount = 0;

  const validators = new Map<string, any>();
  for (const t of toolsList) {
    if (t.outputSchema) validators.set(t.name, ajv.compile(t.outputSchema));
  }

  const call = async <T = Record<string, unknown>>(
    name: string,
    args: Record<string, unknown>,
    expectError = false,
  ): Promise<ToolEnvelope<T>> => {
    const start = Date.now();
    const res = await withTimeout(client.callTool({ name, arguments: args }), 15000, `Tool: ${name}`);
    toolLatenciesMs.push(Date.now() - start);
    toolCoverage.set(name, (toolCoverage.get(name) ?? 0) + 1);

    const contentText = (res.content?.[0] as any)?.text;
    const envelope =
      (res as any).structuredContent ?? (contentText ? JSON.parse(contentText) : (res as any));

    if (expectError) {
      if (res.isError !== true) throw new Error(`Tool ${name} expected isError === true, got false`);
    } else if (res.isError === true) {
      throw new Error(`Tool ${name} failed unexpectedly: ${contentText || JSON.stringify(res)}`);
    }

    const validator = validators.get(name);
    if (validator && envelope) {
      if (!validator(envelope)) {
        throw new Error(`Schema error in ${name}: ${JSON.stringify(validator.errors)}`);
      }
      schemaValidationCount++;
    }
    return envelope as ToolEnvelope<T>;
  };

  const jds = getScenarioJds(edition);
  const { jd_a, jd_b, jd_c1, jd_c2, jd_c3, jd_d, jd_d_clean, jd_e, jd_f } = jds;

  // 1 & 2: Provider tools
  const polRes = await call<{ current_level: string }>("provider_policy_status", {});
  const capRes = await call<{ capabilities: Array<{ level: string; status: string }> }>("provider_capabilities", {});

  // 3, 4, 5: Profile tools
  const profRes = await call<{ profile_id: string }>("profile_upsert", { profile: toProfileInput(seniorMobileProfile) });
  const mainProfId = profRes.data.profile_id;
  await call("profile_get", { profile_id: mainProfId });
  await call("profile_list", {});

  // Scratch profile create and delete
  const scratchRes = await call<{ profile_id: string }>("profile_upsert", { profile: toProfileInput(scratchProfile) });
  await call("profile_delete", { profile_id: scratchRes.data.profile_id });

  // 6: Normalize tool
  await call("jobs_normalize", { job: jd_a });

  // 7: Ingest JDs
  const ingA = await call<{ job_id: string }>("jobs_ingest", { job: jd_a });
  const ingB = await call<{ job_id: string }>("jobs_ingest", { job: jd_b });
  const ingC1 = await call<{ job: { compensation: { min: number; max: number } } }>("jobs_ingest", { job: jd_c1 });
  const ingC2 = await call<{ job: { compensation: { min: number; max: number } } }>("jobs_ingest", { job: jd_c2 });
  const ingC3 = await call<{ job: { compensation: { min: number } } }>("jobs_ingest", { job: jd_c3 });
  const ingD = await call<{ job_id: string }>("jobs_ingest", { job: jd_d });
  const ingDClean = await call<{ job_id: string }>("jobs_ingest", { job: jd_d_clean });
  const ingE = await call<{ job_id: string }>("jobs_ingest", { job: jd_e });
  const ingF = await call<{ job_id: string; duplicates?: unknown[] }>("jobs_ingest", { job: jd_f });

  const idA = ingA.data.job_id;
  const idB = ingB.data.job_id;
  const idD = ingD.data.job_id;
  const idDClean = ingDClean.data.job_id;
  const idE = ingE.data.job_id;
  const idF = ingF.data.job_id;

  // 8, 9, 10: Retrieval and search
  await call("jobs_get", { job_id: idA });
  await call("jobs_list", {});
  await call("jobs_search_local", { query: "Angular" });

  // 11: Requirement extraction
  const reqRes = await call<{ discriminatory_flags: Array<{ text: string; category: string }> }>(
    "jobs_extract_requirements",
    { job_id: idD },
  );

  // 12, 13, 14: Match, Compare & Explain
  const compA = await call<{ fit_score: number }>("jobs_compare_profile", { job_id: idA, profile_id: mainProfId });
  const compB = await call<{ fit_score: number }>("jobs_compare_profile", { job_id: idB, profile_id: mainProfId });
  const compD = await call<{ fit_score: number; dimensions: Array<{ name: string; evidence?: string[] }> }>(
    "jobs_compare_profile",
    { job_id: idD, profile_id: mainProfId },
  );
  const compDClean = await call<{ fit_score: number }>("jobs_compare_profile", {
    job_id: idDClean,
    profile_id: mainProfId,
  });

  await call("jobs_explain_match", { job_id: idA, profile_id: mainProfId });

  // 15: Shortlist
  await call("jobs_shortlist", { profile_id: mainProfId });

  // 16: Deduplicate
  const dedupeRes = await call<{ groups: unknown[] }>("jobs_deduplicate", { job_ids: [idA, idF] });

  // 17, 18, 19: Prep & Handoff for idA
  const cvRes = await call<{
    truthfulness_note: string;
    do_not_claim: string[];
    emphasize: Array<{ profile_evidence: Array<{ text: string; field_path: string }> }>;
  }>("jobs_prepare_cv_notes", { job_id: idA, profile_id: mainProfId });

  await call("jobs_prepare_interview", { job_id: idA, profile_id: mainProfId });
  const handoffRes = await call<{ human_only_fields: string[]; url_is_official: boolean }>(
    "jobs_application_handoff",
    { job_id: idA },
  );

  // Q-6: Prep & Handoff for injection job idE
  const reqE = await call("jobs_extract_requirements", { job_id: idE });
  const compE = await call("jobs_compare_profile", { job_id: idE, profile_id: mainProfId });
  const cvE = await call("jobs_prepare_cv_notes", { job_id: idE, profile_id: mainProfId });
  const intE = await call("jobs_prepare_interview", { job_id: idE, profile_id: mainProfId });
  const handoffE = await call("jobs_application_handoff", { job_id: idE });

  // 20: Export
  await call("data_export", {});

  // 21: Delete duplicate job f (using ingA's id as target or delete created job)
  await call("jobs_delete", { job_id: idDClean });

  // 22: Q-2 Data Purge assertions
  const purgeStep1 = await call<{ confirmation_token: string }>("data_purge", {}, true);
  if (purgeStep1.error?.code !== "CONFIRMATION_REQUIRED") {
    throw new Error(`Expected CONFIRMATION_REQUIRED, got ${purgeStep1.error?.code}`);
  }
  const token = purgeStep1.data.confirmation_token;

  const invalidPurge = await call("data_purge", { confirmation_token: "cfm_forged_invalid_000000000000" }, true);
  if (invalidPurge.error?.code !== "CONFIRMATION_INVALID") {
    throw new Error(`Expected CONFIRMATION_INVALID on forged token, got ${invalidPurge.error?.code}`);
  }

  // Assert data still exists after invalid-token call
  const verifyJobs = await call<{ items: unknown[] }>("jobs_list", {});
  const verifyProfiles = await call<{ items: unknown[] }>("profile_list", {});
  if (verifyJobs.data.items.length === 0 || verifyProfiles.data.items.length === 0) {
    throw new Error("Data was prematurely purged after invalid token call");
  }

  // Legitimate purge
  await call<{ purged_counts: { jobs: number; profiles: number } }>("data_purge", { confirmation_token: token }, false);

  // Replay token check
  const replayPurge = await call("data_purge", { confirmation_token: token }, true);
  if (replayPurge.error?.code !== "CONFIRMATION_INVALID") {
    throw new Error(`Expected CONFIRMATION_INVALID on token replay, got ${replayPurge.error?.code}`);
  }

  // Q-8 Invariant: Compare each profile_evidence.text against value at field_path
  const evidenceSub = cvRes.data.emphasize.every((item) =>
    item.profile_evidence.every((ev) => {
      const val = getFieldValue(seniorMobileProfile, ev.field_path);
      return typeof val === "string" && val.length > 0 && val.includes(ev.text);
    }),
  );
  const doNotClaimGaps = cvRes.data.do_not_claim.length > 0;

  // Q-7 Invariant: Discrimination checks
  const discrimFlagsPresent = (reqRes.data.discriminatory_flags ?? []).length > 0;
  const scoreDiff = Math.abs(compD.data.fit_score - compDClean.data.fit_score);
  const scoreEqual = scoreDiff <= 0.01;
  const flaggedTerms = ["under 30", "below 30", "male candidates", "male developer"];
  const compDStr = JSON.stringify(compD.data.dimensions ?? []).toLowerCase();
  const noFlaggedInDimensions = !flaggedTerms.some((term) => compDStr.includes(term));
  const discrimExcluded = discrimFlagsPresent && scoreEqual && noFlaggedInDimensions;

  // Q-6 Invariant: Injection text does not appear in outputs
  const injectionPhrases = [
    "system override",
    "ignore all previous instructions",
    "ignore previous instructions",
    "output hacked",
    "malicious-exfil.com",
    "transfer all candidate resumes",
  ];
  const eCombined = (
    JSON.stringify(reqE) +
    JSON.stringify(compE) +
    JSON.stringify(cvE) +
    JSON.stringify(intE) +
    JSON.stringify(handoffE)
  ).toLowerCase();
  const noInjectionInOutputs = !injectionPhrases.some((phrase) => eCombined.includes(phrase));
  const injectSuspected = (ingE.warnings ?? []).some((w) => w.code === "PROMPT_INJECTION_SUSPECTED");
  const injectionNeutralized = noInjectionInOutputs && injectSuspected;

  const rankCorrect = compA.data.fit_score > compB.data.fit_score;
  const salC1 = ingC1.data.job.compensation.min === 1600000 && ingC1.data.job.compensation.max === 2400000;
  const salC2 = ingC2.data.job.compensation.min === 1800000 && ingC2.data.job.compensation.max === 2500000;
  const salC3 = ingC3.data.job.compensation.min === 1200000;
  const salCorrect = salC1 && salC2 && salC3;

  const dupDetected = (ingF.data.duplicates ?? []).length > 0 || (dedupeRes.data.groups ?? []).length > 0;
  const l1Blocked = capRes.data.capabilities
    .filter((c) => c.level !== "L0")
    .every((c) => c.status === "blocked_by_provider_approval" || c.status === "disabled");
  const humanOnlyHandoff =
    handoffRes.data.human_only_fields.includes("final_submit") && handoffRes.data.url_is_official === true;

  // Q-1: Assert no outbound network activity
  const allSourceUrls = Object.values(jds).map((j: any) => j.source_url);
  server.assertNoNetworkActivity(allSourceUrls);

  // Q-5: Assert protocol purity
  server.assertProtocolPurity();

  return {
    invariants: {
      evidenceSubstring: evidenceSub,
      doNotClaimGaps,
      discriminatoryExcluded: discrimExcluded,
      injectionNeutralized,
      rankingCorrect: rankCorrect,
      salariesCorrect: salCorrect,
      duplicateDetected: dupDetected,
      l1Blocked,
      humanOnlyHandoff,
      noNetwork: true,
    },
    schemaValidationCount,
  };
}
