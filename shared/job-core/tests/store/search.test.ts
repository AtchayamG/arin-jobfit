import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStore } from "../../src/store/open.js";
import type { Store } from "../../src/store/types.js";
import { createTestJob } from "./fixtures.js";

describe("JobRepo Search & LIKE Escaping", () => {
  let store: Store;

  beforeEach(() => {
    store = openStore({ memory: true, product: "naukri" });
  });

  afterEach(() => {
    store.close();
  });

  it("escapes '%' wildcard so '100%' matches literally and not as wildcard", () => {
    const jobPercent = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000001",
      description: "Offering 100% remote flexibility for engineers",
    });
    const jobDigits = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000002",
      description: "Offering 1000 opportunities for candidates",
    });

    store.jobs.insert(jobPercent);
    store.jobs.insert(jobDigits);

    const res = store.jobs.search({ query: "100%" });
    expect(res.items.length).toBe(1);
    expect(res.items[0]?.job_id).toBe(jobPercent.job_id);
  });

  it("escapes '_' wildcard so 'node_js' matches literally and not single character wildcard", () => {
    const jobUnderscore = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000001",
      description: "Specialized in node_js backend architecture",
    });
    const jobSpace = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000002",
      description: "Specialized in node js backend architecture",
    });

    store.jobs.insert(jobUnderscore);
    store.jobs.insert(jobSpace);

    const res = store.jobs.search({ query: "node_js" });
    expect(res.items.length).toBe(1);
    expect(res.items[0]?.job_id).toBe(jobUnderscore.job_id);
  });

  it("escapes backslashes so 'C:\\tools' matches literally", () => {
    const jobBackslash = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000001",
      description: "Installs binary at C:\\tools\\cli",
    });

    store.jobs.insert(jobBackslash);

    const res = store.jobs.search({ query: "C:\\tools" });
    expect(res.items.length).toBe(1);
    expect(res.items[0]?.job_id).toBe(jobBackslash.job_id);
  });

  it("performs case-insensitive searches across title, company, location, skills, and description", () => {
    const job = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000001",
      title: "Distributed Systems Lead",
      company: "Starlight Tech",
      location: { raw: "Pune, India", city: "Pune", country: "IN" },
      required_skills: ["Rust", "Raft"],
      preferred_skills: ["Tokio"],
      description: "Building consensus algorithms for high throughput storage",
    });
    store.jobs.insert(job);

    expect(store.jobs.search({ query: "DISTRIBUTED" }).items.length).toBe(1);
    expect(store.jobs.search({ query: "starlight" }).items.length).toBe(1);
    expect(store.jobs.search({ query: "pune" }).items.length).toBe(1);
    expect(store.jobs.search({ query: "RAFT" }).items.length).toBe(1);
    expect(store.jobs.search({ query: "tokio" }).items.length).toBe(1);
    expect(store.jobs.search({ query: "consensus algorithms" }).items.length).toBe(1);
    expect(store.jobs.search({ query: "nonexistent query" }).items.length).toBe(0);
  });

  it("supports search combined with filters and pagination cursor", () => {
    const job1 = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000001",
      ingested_at: "2026-09-20T10:00:00Z",
      remote_mode: "remote",
      title: "Rust Lead 1",
    });
    const job2 = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000002",
      ingested_at: "2026-09-21T10:00:00Z",
      remote_mode: "remote",
      title: "Rust Lead 2",
    });
    const job3 = createTestJob({
      job_id: "job_00000000-0000-4000-8000-000000000003",
      ingested_at: "2026-09-22T10:00:00Z",
      remote_mode: "onsite",
      title: "Rust Lead 3",
    });

    store.jobs.insert(job1);
    store.jobs.insert(job2);
    store.jobs.insert(job3);

    // Search 'Rust' with remote_mode=['remote'] and pageSize=1
    const page1 = store.jobs.search({
      query: "Rust",
      filters: { remote_mode: ["remote"] },
      pageSize: 1,
    });

    expect(page1.items.length).toBe(1);
    expect(page1.items[0]?.job_id).toBe(job2.job_id); // newer remote job
    expect(page1.nextCursor).not.toBeNull();

    const page2 = store.jobs.search({
      query: "Rust",
      filters: { remote_mode: ["remote"] },
      pageSize: 1,
      cursor: page1.nextCursor ?? undefined,
    });

    expect(page2.items.length).toBe(1);
    expect(page2.items[0]?.job_id).toBe(job1.job_id); // older remote job
    expect(page2.nextCursor).toBeNull();

    // Search with employment_type and retention_class filters
    const filteredSearch = store.jobs.search({
      query: "Rust",
      filters: {
        employment_type: ["full_time"],
        retention_class: ["standard_180d"],
      },
    });
    expect(filteredSearch.items.length).toBe(3);
  });
});
