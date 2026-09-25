import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreError } from "../../src/store/error.js";
import { openStore } from "../../src/store/open.js";
import type { Store } from "../../src/store/types.js";
import { createTestJob, createTestProfileInput } from "./fixtures.js";

describe("Data Rights (exportAll, purgeToken, purge)", () => {
  let store: Store;
  const now = "2026-09-20T12:00:00.000Z";

  beforeEach(() => {
    store = openStore({ memory: true, product: "naukri", now });
  });

  afterEach(() => {
    store.close();
  });

  it("exports all jobs and profiles while excluding audit data", () => {
    const job = createTestJob();
    const profileRes = store.profiles.upsert(createTestProfileInput());
    store.jobs.insert(job);

    store.audit.append({
      tool: "jobs_get",
      requestId: "req-1",
      outcome: "ok",
      subjectId: job.job_id,
    });

    const exportData = store.rights.exportAll(now);

    expect(exportData.export_version).toBe("1");
    expect(exportData.exported_at).toBe(now);
    expect(exportData.jobs.length).toBe(1);
    expect(exportData.jobs[0]?.job_id).toBe(job.job_id);
    expect(exportData.profiles.length).toBe(1);
    expect(exportData.profiles[0]?.profile_id).toBe(profileRes.profile_id);

    // Audit must not be present in export
    expect((exportData as unknown as { audit?: unknown }).audit).toBeUndefined();
  });

  it("manages the lifecycle of single-use purge tokens", () => {
    store.jobs.insert(createTestJob());
    store.profiles.upsert(createTestProfileInput());

    const tokenSummary = store.rights.createPurgeToken(now);
    expect(tokenSummary.token).toMatch(
      /^cfm_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );

    // Expiry should be exactly +5 minutes (300,000 ms)
    const expectedExpiry = new Date(new Date(now).getTime() + 5 * 60 * 1000).toISOString();
    expect(tokenSummary.expires_at).toBe(expectedExpiry);
    expect(tokenSummary.summary).toEqual({ jobs: 1, profiles: 1 });

    // Purge execution with valid token
    const purgeResult = store.rights.purge(tokenSummary.token, "2026-09-20T12:02:00.000Z");
    expect(purgeResult.purged_jobs).toBe(1);
    expect(purgeResult.purged_profiles).toBe(1);
    expect(store.jobs.count()).toBe(0);
    expect(store.profiles.count()).toBe(0);

    // Purge action creates exactly one audit entry
    expect(store.audit.count()).toBe(1);
    const auditRows = store.audit.list();
    expect(auditRows[0]?.tool).toBe("data_purge");
    expect(auditRows[0]?.outcome).toBe("ok");

    // Attempting to reuse the same token throws CONFIRMATION_INVALID
    expect(() => store.rights.purge(tokenSummary.token, "2026-09-20T12:03:00.000Z")).toThrow(
      StoreError,
    );
    try {
      store.rights.purge(tokenSummary.token, "2026-09-20T12:03:00.000Z");
    } catch (e) {
      expect(e instanceof StoreError && e.code === "CONFIRMATION_INVALID").toBe(true);
    }
  });

  it("rejects expired confirmation tokens with CONFIRMATION_INVALID", () => {
    const tokenSummary = store.rights.createPurgeToken(now);

    // Present token 5 minutes and 1 second later (expired)
    const expiredTime = new Date(new Date(now).getTime() + 5 * 60 * 1000 + 1000).toISOString();
    expect(() => store.rights.purge(tokenSummary.token, expiredTime)).toThrow(StoreError);
    try {
      store.rights.purge(tokenSummary.token, expiredTime);
    } catch (e) {
      expect(e instanceof StoreError && e.code === "CONFIRMATION_INVALID").toBe(true);
    }
  });

  it("rejects unknown confirmation tokens with CONFIRMATION_INVALID", () => {
    expect(() => store.rights.purge("cfm_00000000-0000-4000-8000-000000000000", now)).toThrow(
      StoreError,
    );
    try {
      store.rights.purge("cfm_00000000-0000-4000-8000-000000000000", now);
    } catch (e) {
      expect(e instanceof StoreError && e.code === "CONFIRMATION_INVALID").toBe(true);
    }
  });

  it("handles exportAll, createPurgeToken, and purge when now parameter is omitted", () => {
    const exportResult = store.rights.exportAll();
    expect(exportResult.exported_at).toBeDefined();

    const tokenRes = store.rights.createPurgeToken();
    expect(tokenRes.token).toBeDefined();

    const purgeRes = store.rights.purge(tokenRes.token);
    expect(purgeRes.purged_jobs).toBe(0);
  });
});
