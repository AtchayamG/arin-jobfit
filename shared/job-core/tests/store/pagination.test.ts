import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { decodeCursor } from "../../src/store/cursor.js";
import { StoreError } from "../../src/store/error.js";
import { openStore } from "../../src/store/open.js";
import type { Store } from "../../src/store/types.js";
import { createTestJob } from "./fixtures.js";

describe("JobRepo Pagination & Cursor", () => {
  let store: Store;

  beforeEach(() => {
    store = openStore({ memory: true, product: "naukri" });
  });

  afterEach(() => {
    store.close();
  });

  it("paginates cleanly through 50 jobs with pageSize 15", () => {
    // Insert 50 jobs with distinct ingested_at times
    for (let i = 0; i < 50; i++) {
      const hex = i.toString(16).padStart(12, "0");
      const day = (i % 28) + 1;
      const dayStr = day.toString().padStart(2, "0");
      const job = createTestJob({
        job_id:
          `job_00000000-0000-4000-8000-${hex}` as unknown as "job_00000000-0000-4000-8000-000000000001",
        ingested_at: `2026-08-${dayStr}T10:00:00Z`,
      });
      store.jobs.insert(job);
    }

    const allRetrievedIds: string[] = [];
    let currentCursor: string | undefined = undefined;
    let pages = 0;

    while (pages < 10) {
      const result = store.jobs.list({ pageSize: 15, cursor: currentCursor });
      pages++;
      for (const item of result.items) {
        allRetrievedIds.push(item.job_id);
      }
      if (!result.nextCursor) {
        break;
      }
      currentCursor = result.nextCursor;
    }

    expect(pages).toBe(4); // 15 + 15 + 15 + 5 = 50 in 4 pages
    expect(allRetrievedIds.length).toBe(50);
    const uniqueIds = new Set(allRetrievedIds);
    expect(uniqueIds.size).toBe(50);
  });

  it("generates opaque base64url cursors and decodes them correctly", () => {
    const job1 = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000001",
      ingested_at: "2026-09-20T10:00:00Z",
    });
    const job2 = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000002",
      ingested_at: "2026-09-19T10:00:00Z",
    });

    store.jobs.insert(job1);
    store.jobs.insert(job2);

    const page1 = store.jobs.list({ pageSize: 1 });
    expect(page1.items.length).toBe(1);
    expect(page1.items[0]?.job_id).toBe(job1.job_id);
    expect(page1.nextCursor).not.toBeNull();
    const nextCursor1 = page1.nextCursor ?? "";

    const decoded = decodeCursor(nextCursor1);
    expect(decoded.job_id).toBe(job1.job_id);
    expect(decoded.ingested_at).toBe(job1.ingested_at);

    const page2 = store.jobs.list({ pageSize: 1, cursor: nextCursor1 });
    expect(page2.items.length).toBe(1);
    expect(page2.items[0]?.job_id).toBe(job2.job_id);
    expect(page2.nextCursor).toBeNull();
  });

  it("rejects tampered or malformed cursors with INVALID_ID", () => {
    const badCursors = [
      "not-base64-url!",
      Buffer.from("not-json").toString("base64url"),
      Buffer.from(
        JSON.stringify({ ingested_at: "2026-09-20T10:00:00Z", job_id: "bad_id" }),
      ).toString("base64url"),
      Buffer.from(
        JSON.stringify({
          ingested_at: "bad_date",
          job_id: "job_00000000-0000-4000-8000-000000000001",
        }),
      ).toString("base64url"),
    ];

    for (const badCursor of badCursors) {
      expect(() => store.jobs.list({ cursor: badCursor })).toThrow(StoreError);
      try {
        store.jobs.list({ cursor: badCursor });
      } catch (e) {
        expect(e instanceof StoreError && e.code === "INVALID_ID").toBe(true);
      }
    }
  });

  it("applies filters correctly during pagination", () => {
    const remoteJob = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000001",
      remote_mode: "remote",
      employment_type: "full_time",
      retention_class: "standard_180d",
    });
    const onsiteJob = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000002",
      remote_mode: "onsite",
      employment_type: "contract",
      retention_class: "session",
    });

    store.jobs.insert(remoteJob);
    store.jobs.insert(onsiteJob);

    const remoteRes = store.jobs.list({ filters: { remote_mode: ["remote"] } });
    expect(remoteRes.items.length).toBe(1);
    expect(remoteRes.items[0]?.job_id).toBe(remoteJob.job_id);

    const sessionRes = store.jobs.list({ filters: { retention_class: ["session"] } });
    expect(sessionRes.items.length).toBe(1);
    expect(sessionRes.items[0]?.job_id).toBe(onsiteJob.job_id);

    const contractRes = store.jobs.list({ filters: { employment_type: ["contract"] } });
    expect(contractRes.items.length).toBe(1);
    expect(contractRes.items[0]?.job_id).toBe(onsiteJob.job_id);
  });
});
