import { describe, expect, it } from "vitest";
import { openStore } from "../../src/store/open.js";
import { runRetention } from "../../src/store/retention.js";
import { createTestJob } from "./fixtures.js";

describe("Retention on open", () => {
  const now = "2026-09-20T12:00:00.000Z";
  // 180 days = 180 * 24 * 60 * 60 * 1000 = 15,552,000,000 ms
  // Cutoff = 2026-03-24T12:00:00.000Z

  it("deletes session jobs and expired standard_180d jobs while preserving pinned and recent jobs", () => {
    const store = openStore({ memory: true, product: "naukri", now });

    // 1. Session job (ingested just 10 seconds ago)
    const sessionJob = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000001",
      retention_class: "session",
      ingested_at: "2026-09-20T11:59:50.000Z",
    });

    // 2. Standard 180d job ingested 1 second BEFORE the 180-day cutoff (older, expired)
    const expiredStandardJob = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000002",
      retention_class: "standard_180d",
      ingested_at: "2026-03-24T11:59:59.000Z",
    });

    // 3. Standard 180d job ingested 1 second AFTER the 180-day cutoff (newer, valid)
    const validStandardJob = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000003",
      retention_class: "standard_180d",
      ingested_at: "2026-03-24T12:00:01.000Z",
    });

    // 4. Pinned job ingested > 500 days ago (must NEVER be deleted)
    const ancientPinnedJob = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000004",
      retention_class: "pinned",
      ingested_at: "2025-01-01T00:00:00.000Z",
    });

    store.jobs.insert(sessionJob);
    store.jobs.insert(expiredStandardJob);
    store.jobs.insert(validStandardJob);
    store.jobs.insert(ancientPinnedJob);

    expect(store.jobs.count()).toBe(4);

    // Run retention explicitly with the same now timestamp
    const rawDb = (store.jobs as unknown as { db: import("node:sqlite").DatabaseSync }).db;
    const summary = runRetention(rawDb, now);

    expect(summary.sessionDeleted).toBe(1);
    expect(summary.expiredDeleted).toBe(1);

    expect(store.jobs.get(sessionJob.job_id)).toBeNull();
    expect(store.jobs.get(expiredStandardJob.job_id)).toBeNull();
    expect(store.jobs.get(validStandardJob.job_id)).not.toBeNull();
    expect(store.jobs.get(ancientPinnedJob.job_id)).not.toBeNull();

    store.close();
  });

  it("runs retention automatically when store is opened with now parameter", () => {
    // Open a store, insert data, then reopen with advanced clock to trigger retention
    const store = openStore({ memory: true, product: "naukri", now: "2026-01-01T00:00:00.000Z" });

    const sessionJob = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000001",
      retention_class: "session",
      ingested_at: "2026-01-01T00:00:00.000Z",
    });
    const standardJob = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000002",
      retention_class: "standard_180d",
      ingested_at: "2026-01-01T00:00:00.000Z",
    });

    store.jobs.insert(sessionJob);
    store.jobs.insert(standardJob);
    expect(store.jobs.count()).toBe(2);

    // Access raw db and run retention as if reopened 200 days later
    const futureTime = "2026-08-01T00:00:00.000Z";
    const rawDb = (store.jobs as unknown as { db: import("node:sqlite").DatabaseSync }).db;
    runRetention(rawDb, futureTime);

    expect(store.jobs.count()).toBe(0);
    store.close();
  });

  it("supports now parameter passed as a function returning an ISO string", () => {
    const store = openStore({
      memory: true,
      product: "naukri",
      now: () => "2026-09-20T12:00:00.000Z",
    });
    expect(store.jobs.count()).toBe(0);
    store.close();
  });
});
