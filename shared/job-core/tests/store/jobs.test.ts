import { DatabaseSync } from "node:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { StoreError } from "../../src/store/error.js";
import { SqliteJobRepo } from "../../src/store/jobs.js";
import { openStore } from "../../src/store/open.js";
import type { Store } from "../../src/store/types.js";
import { createTestJob } from "./fixtures.js";

describe("JobRepo", () => {
  let store: Store;

  beforeEach(() => {
    store = openStore({ memory: true, product: "naukri" });
  });

  afterEach(() => {
    store.close();
  });

  it("inserts and retrieves a job by ID", () => {
    const job = createTestJob();
    store.jobs.insert(job);

    expect(store.jobs.count()).toBe(1);

    const retrieved = store.jobs.get(job.job_id);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.job_id).toBe(job.job_id);
    expect(retrieved?.title).toBe(job.title);
    expect(retrieved?.fingerprint).toBe(job.fingerprint);
  });

  it("finds a job by fingerprint", () => {
    const job = createTestJob();
    store.jobs.insert(job);

    const found = store.jobs.findByFingerprint(job.fingerprint);
    expect(found).not.toBeNull();
    expect(found?.job_id).toBe(job.job_id);

    const notFound = store.jobs.findByFingerprint(`sha256:${"b".repeat(64)}`);
    expect(notFound).toBeNull();
  });

  it("deletes a job by ID and reports deletion status", () => {
    const job = createTestJob();
    store.jobs.insert(job);

    expect(store.jobs.delete(job.job_id)).toBe(true);
    expect(store.jobs.count()).toBe(0);
    expect(store.jobs.get(job.job_id)).toBeNull();

    // Second delete returns false (not found)
    expect(store.jobs.delete(job.job_id)).toBe(false);
  });

  it("retrieves recent jobs ordered by ingested_at DESC, job_id DESC", () => {
    const job1 = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000001",
      ingested_at: "2026-09-20T10:00:00Z",
    });
    const job2 = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000002",
      ingested_at: "2026-09-21T10:00:00Z",
    });

    store.jobs.insert(job1);
    store.jobs.insert(job2);

    const recent = store.jobs.recent(10);
    expect(recent.length).toBe(2);
    expect(recent[0]?.job_id).toBe(job2.job_id);
    expect(recent[1]?.job_id).toBe(job1.job_id);
  });

  it("rejects malformed job IDs with INVALID_ID", () => {
    const invalidIds = ["123", "job_invalid", "prof_00000000-0000-4000-8000-000000000001", ""];
    const baseJob = createTestJob();
    for (const badId of invalidIds) {
      expect(() => store.jobs.get(badId)).toThrow(StoreError);
      expect(() => store.jobs.delete(badId)).toThrow(StoreError);
      expect(() => {
        store.jobs.insert({
          ...baseJob,
          job_id: badId,
        });
      }).toThrow(StoreError);
    }
  });

  it("handles corrupt rows by throwing CORRUPT_ROW", () => {
    const rawDb = new DatabaseSync(":memory:");
    rawDb.exec(
      "CREATE TABLE jobs (job_id TEXT PRIMARY KEY, fingerprint TEXT, ingested_at TEXT, retention_class TEXT, remote_mode TEXT, employment_type TEXT, search_text TEXT, json TEXT);",
    );
    rawDb.exec(
      "INSERT INTO jobs VALUES ('job_00000000-0000-4000-8000-000000000001', 'sha256:corrupt', '2026-09-20', 'standard_180d', 'remote', 'full_time', 'text', '{corrupt json');",
    );

    const repo = new SqliteJobRepo(rawDb);
    expect(() => repo.get("job_00000000-0000-4000-8000-000000000001")).toThrow(StoreError);
    expect(() => repo.findByFingerprint("sha256:corrupt")).toThrow(StoreError);
    expect(() => repo.list()).toThrow(StoreError);
    expect(() => repo.search({ query: "text" })).toThrow(StoreError);
    rawDb.close();
  });

  it("enforces the 10,000 job limit and allows updating existing jobs", () => {
    const rawDb = new DatabaseSync(":memory:");
    rawDb.exec(
      "CREATE TABLE jobs (job_id TEXT PRIMARY KEY, fingerprint TEXT, ingested_at TEXT, retention_class TEXT, remote_mode TEXT, employment_type TEXT, search_text TEXT, json TEXT);",
    );

    rawDb.exec("BEGIN TRANSACTION;");
    const insertStmt = rawDb.prepare(
      "INSERT INTO jobs (job_id, fingerprint, ingested_at, retention_class, remote_mode, employment_type, search_text, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
    );

    const baseJob = createTestJob();
    const jsonStr = JSON.stringify(baseJob);

    // Fast-insert 10,000 records
    for (let i = 0; i < 10000; i++) {
      const hex = i.toString(16).padStart(12, "0");
      const id = `job_00000000-0000-4000-8000-${hex}`;
      insertStmt.run(
        id,
        `fp_${hex}`,
        "2026-09-20T10:00:00Z",
        "standard_180d",
        "remote",
        "full_time",
        "text",
        jsonStr,
      );
    }
    rawDb.exec("COMMIT;");

    const repo = new SqliteJobRepo(rawDb);
    expect(repo.count()).toBe(10000);

    // Inserting a brand new job beyond limit throws LIMIT_EXCEEDED
    const overflowJob = createTestJob({
      job_id: "job_00000000-0000-4000-8000-ffffffffffff",
    });
    expect(() => {
      repo.insert(overflowJob);
    }).toThrow(StoreError);
    try {
      repo.insert(overflowJob);
    } catch (e) {
      expect(e instanceof StoreError && e.code === "LIMIT_EXCEEDED").toBe(true);
    }

    // Updating an existing job among the 10,000 succeeds
    const existingJobId = "job_00000000-0000-4000-8000-000000000005";
    const updateJob = createTestJob({
      job_id: existingJobId,
      title: "Updated Senior Engineer",
    });
    expect(() => {
      repo.insert(updateJob);
    }).not.toThrow();
    expect(repo.get(existingJobId)?.title).toBe("Updated Senior Engineer");

    rawDb.close();
  });

  it("handles jobs with null company and null location fields", () => {
    const jobWithNulls = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000099",
      company: null,
      location: { raw: null, city: null, country: null },
    });
    store.jobs.insert(jobWithNulls);

    const retrieved = store.jobs.get(jobWithNulls.job_id);
    expect(retrieved?.company).toBeNull();
    expect(retrieved?.location.raw).toBeNull();
    expect(retrieved?.location.city).toBeNull();
  });
});
