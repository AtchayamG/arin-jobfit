import { describe, expect, it } from "vitest";
import { openStore } from "../../src/store/open.js";
import { createTestJob, createTestProfileInput } from "./fixtures.js";

describe("Audit privacy and PII-free invariant", () => {
  it("contains no JD text, profile text, or raw PII after a full workflow", () => {
    const store = openStore({ memory: true, product: "naukri" });

    const secretDescription = "Proprietary confidential backend project involving ProjectZeus";
    const sensitiveCandidateName = "Atchayam Secret Candidate";
    const sensitiveSummary = "Secret summary detailing highly classified projects";

    const job = createTestJob({
      description: secretDescription,
      title: "Confidential Architect",
      company: "TopSecret Corp",
    });
    store.jobs.insert(job);

    const profileInput = createTestProfileInput({
      label: sensitiveCandidateName,
      summary_text: sensitiveSummary,
    });
    const profileRes = store.profiles.upsert(profileInput);

    // Simulate various audit entries
    store.audit.append({
      tool: "jobs_get",
      requestId: "req-001",
      outcome: "ok",
      subjectId: job.job_id,
    });

    store.audit.append({
      tool: "profile_get",
      requestId: "req-002",
      outcome: "ok",
      subjectId: profileRes.profile_id,
    });

    store.audit.append({
      tool: "jobs_search",
      requestId: "req-003",
      outcome: "error",
      errorCode: "INVALID_INPUT",
    });

    const token = store.rights.createPurgeToken();
    store.rights.purge(token.token);

    // Inspect all audit rows directly from the table
    const rows = store.audit.list(100);
    expect(rows.length).toBeGreaterThanOrEqual(1);

    const forbiddenPhrases = [
      secretDescription,
      "ProjectZeus",
      sensitiveCandidateName,
      sensitiveSummary,
      "Confidential Architect",
      "TopSecret Corp",
      job.job_id, // raw ID should not appear; only salted hash
      profileRes.profile_id,
    ];

    for (const row of rows) {
      // Validate subject_hash format
      if (row.subject_hash !== null) {
        expect(row.subject_hash).toMatch(/^[0-9a-f]{16}$/);
      }

      // Check all fields for forbidden content
      for (const phrase of forbiddenPhrases) {
        expect(row.tool.includes(phrase)).toBe(false);
        expect(row.request_id.includes(phrase)).toBe(false);
        expect(row.outcome.includes(phrase)).toBe(false);
        if (row.error_code) {
          expect(row.error_code.includes(phrase)).toBe(false);
        }
        if (row.subject_hash) {
          expect(row.subject_hash.includes(phrase)).toBe(false);
        }
      }
    }

    store.close();
  });

  it("produces distinct salted subject hashes across different database instances", () => {
    const store1 = openStore({ memory: true, product: "naukri" });
    const store2 = openStore({ memory: true, product: "naukri" });

    const subjectId = "job_00000000-0000-4000-8000-000000000001";

    store1.audit.append({
      tool: "jobs_get",
      requestId: "req-1",
      outcome: "ok",
      subjectId,
    });
    store2.audit.append({
      tool: "jobs_get",
      requestId: "req-2",
      outcome: "ok",
      subjectId,
    });

    const row1 = store1.audit.list(1)[0];
    const row2 = store2.audit.list(1)[0];

    expect(row1?.subject_hash).not.toBeNull();
    expect(row2?.subject_hash).not.toBeNull();
    expect(row1?.subject_hash).not.toBe(row2?.subject_hash);

    store1.close();
    store2.close();
  });
});
