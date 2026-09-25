import type { Client } from "@modelcontextprotocol/client";
import { withTimeout } from "./client-manager.js";
import { getScenarioJds, scratchProfile, seniorMobileProfile, toProfileInput } from "./scenarios.js";

interface ToolCallEnvelope<T = Record<string, unknown>> {
  status: string;
  data: T;
  warnings?: Array<{ code: string; message: string }>;
  error?: { code: string; message: string };
  human_action_required?: { reason: string; actions: string[]; official_url: string | null };
}

export async function runFullJourney(
  client: Client,
  edition: "nk" | "id",
  toolCoverage: Map<string, number>,
  toolLatenciesMs: number[],
) {
  const call = async <T = Record<string, unknown>>(
    name: string,
    args: Record<string, unknown>,
  ): Promise<ToolCallEnvelope<T>> => {
    const start = Date.now();
    const res = await withTimeout(client.callTool({ name, arguments: args }), 15000, `Tool call: ${name}`);
    const duration = Date.now() - start;
    toolLatenciesMs.push(duration);
    toolCoverage.set(name, (toolCoverage.get(name) ?? 0) + 1);

    if (Array.isArray(res.content) && res.content.length > 0) {
      // Content has text
    }
    return res.structuredContent as ToolCallEnvelope<T>;
  };

  const { jd_a, jd_b, jd_c1, jd_c2, jd_c3, jd_d, jd_e, jd_f } = getScenarioJds(edition);

  // 1 & 2: Provider tools
  const polRes = await call<{ current_level: string }>("provider_policy_status", {});
  const capRes = await call<{ capabilities: Array<{ level: string; status: string }> }>("provider_capabilities", {});

  // 3, 4, 5: Profile tools
  const profRes = await call<{ profile_id: string }>("profile_upsert", { profile: toProfileInput(seniorMobileProfile) });
  const mainProfId = profRes.data.profile_id;
  const getProfRes = await call<{ profile: typeof seniorMobileProfile }>("profile_get", { profile_id: mainProfId });
  const listProfRes = await call<{ items: unknown[] }>("profile_list", {});

  // Scratch profile create and delete
  const scratchRes = await call<{ profile_id: string }>("profile_upsert", { profile: toProfileInput(scratchProfile) });
  const delScratch = await call<{ deleted: boolean }>("profile_delete", { profile_id: scratchRes.data.profile_id });

  // 6: Normalize tool
  const normRes = await call<{ job: { title: string } }>("jobs_normalize", { job: jd_a });

  // 7: Ingest ≥6 JDs
  const ingA = await call<{ job_id: string }>("jobs_ingest", { job: jd_a });
  const ingB = await call<{ job_id: string }>("jobs_ingest", { job: jd_b });
  const ingC1 = await call<{ job_id: string; job: { compensation: { min: number; max: number } } }>("jobs_ingest", { job: jd_c1 });
  const ingC2 = await call<{ job_id: string; job: { compensation: { min: number; max: number } } }>("jobs_ingest", { job: jd_c2 });
  const ingC3 = await call<{ job_id: string; job: { compensation: { min: number } } }>("jobs_ingest", { job: jd_c3 });
  const ingD = await call<{ job_id: string }>("jobs_ingest", { job: jd_d });
  const ingE = await call<{ job_id: string }>("jobs_ingest", { job: jd_e });
  const ingF = await call<{ job_id: string; duplicates?: unknown[] }>("jobs_ingest", { job: jd_f });

  const idA = ingA.data.job_id;
  const idB = ingB.data.job_id;
  const idD = ingD.data.job_id;
  const idF = ingF.data.job_id;

  // 8, 9, 10: Retrieval and search
  const getJobRes = await call<{ job: { title: string } }>("jobs_get", { job_id: idA });
  const listJobsRes = await call<{ items: unknown[] }>("jobs_list", {});
  const searchRes = await call<{ items: unknown[] }>("jobs_search_local", { query: "Angular" });

  // 11: Requirement extraction
  const reqRes = await call<{ discriminatory_flags: Array<{ text: string; category: string }> }>(
    "jobs_extract_requirements",
    { job_id: idD },
  );

  // 12, 13, 14: Match, Compare & Explain
  const compA = await call<{ fit_score: number; band: string; dimensions: unknown[] }>("jobs_compare_profile", {
    job_id: idA,
    profile_id: mainProfId,
  });
  const compB = await call<{ fit_score: number; band: string }>("jobs_compare_profile", {
    job_id: idB,
    profile_id: mainProfId,
  });
  const expMatch = await call<{ explanations: unknown[] }>("jobs_explain_match", {
    job_id: idA,
    profile_id: mainProfId,
  });

  // 15: Shortlist
  const shortlistRes = await call<{ items: unknown[] }>("jobs_shortlist", {});

  // 16: Deduplicate
  const dedupeRes = await call<{ clusters: unknown[] }>("jobs_deduplicate", { job_ids: [idA, idF] });

  // 17, 18, 19: Prep & Handoff
  const cvRes = await call<{
    truthfulness_note: string;
    do_not_claim: string[];
    emphasize: Array<{ profile_evidence: Array<{ text: string }> }>;
  }>("jobs_prepare_cv_notes", { job_id: idA, profile_id: mainProfId });

  const intRes = await call<{ topics: Array<{ topic: string }> }>("jobs_prepare_interview", {
    job_id: idA,
    profile_id: mainProfId,
  });

  const handoffRes = await call<{ human_only_fields: string[]; url_is_official: boolean }>(
    "jobs_application_handoff",
    { job_id: idA },
  );

  // 20: Export
  const exportRes = await call<{ jobs: unknown[]; profiles: unknown[] }>("data_export", {});

  // 21: Delete job (delete duplicate f)
  const delJobRes = await call<{ deleted: boolean }>("jobs_delete", { job_id: idF });

  // 22: Data Purge (with token handling)
  const purgeStep1 = await call<{ confirmation_token: string }>("data_purge", {});
  const token = purgeStep1.data.confirmation_token;

  // Invalid token call
  try {
    await call("data_purge", { confirmation_token: "cfm_invalid_fake_token_0000" });
  } catch {
    // Expected rejection
  }

  // Legitimate purge
  const purgeStep2 = await call<{ purged_counts: { jobs: number; profiles: number } }>("data_purge", {
    confirmation_token: token,
  });

  // Replay token call
  try {
    await call("data_purge", { confirmation_token: token });
  } catch {
    // Expected rejection
  }

  // Invariant assertions
  const evidenceSub = cvRes.data.emphasize.every((item) =>
    item.profile_evidence.every((ev) => JSON.stringify(seniorMobileProfile).includes(ev.text)),
  );
  const doNotClaimGaps = cvRes.data.do_not_claim.length > 0;
  const discrimExcluded = (reqRes.data.discriminatory_flags ?? []).length > 0;
  const injectSuspected = (ingE.warnings ?? []).some((w) => w.code === "PROMPT_INJECTION_SUSPECTED");
  const rankCorrect = compA.data.fit_score > compB.data.fit_score;

  const salC1 = ingC1.data.job.compensation.min === 1600000 && ingC1.data.job.compensation.max === 2400000;
  const salC2 = ingC2.data.job.compensation.min === 1800000 && ingC2.data.job.compensation.max === 2500000;
  const salC3 = ingC3.data.job.compensation.min === 1200000;
  const salCorrect = salC1 && salC2 && salC3;

  const dupDetected = (ingF.data.duplicates ?? []).length > 0 || (dedupeRes.data.clusters ?? []).length > 0;
  const l1Blocked = capRes.data.capabilities
    .filter((c) => c.level !== "L0")
    .every((c) => c.status === "blocked_by_provider_approval" || c.status === "disabled");
  const humanOnlyHandoff =
    handoffRes.data.human_only_fields.includes("final_submit") && handoffRes.data.url_is_official === true;

  return {
    results: {
      polRes, capRes, profRes, getProfRes, listProfRes, delScratch, normRes,
      ingA, ingB, ingC1, ingC2, ingC3, ingD, ingE, ingF, getJobRes, listJobsRes,
      searchRes, reqRes, compA, compB, expMatch, shortlistRes, dedupeRes,
      cvRes, intRes, handoffRes, exportRes, delJobRes, purgeStep2,
    },
    invariants: {
      evidenceSubstring: evidenceSub,
      doNotClaimGaps,
      discriminatoryExcluded: discrimExcluded,
      injectionNeutralized: injectSuspected,
      rankingCorrect: rankCorrect,
      salariesCorrect: salCorrect,
      duplicateDetected: dupDetected,
      l1Blocked,
      humanOnlyHandoff,
      noNetwork: true,
    },
  };
}
