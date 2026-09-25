/**
 * Unit tests for findDuplicates, areDuplicates, and checkIngestDuplicates.
 */

import { describe, it, expect } from "vitest";
import { createTestJob } from "../match/fixtures.js";
import { findDuplicates, checkIngestDuplicates, areDuplicates } from "../../src/dedupe/dedupe.js";
import { prepareJob } from "../../src/dedupe/jaccard.js";

describe("deduplication engine", () => {
  describe("areDuplicates", () => {
    it("matches identical fingerprint as duplicate regardless of text", () => {
      const job1 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000001",
        fingerprint: `sha256:${"1".repeat(64)}`,
        company: "Company Alpha",
        title: "Frontend Engineer",
      });
      const job2 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000002",
        fingerprint: `sha256:${"1".repeat(64)}`,
        company: "Company Beta",
        title: "Backend Engineer",
      });

      const res = areDuplicates(prepareJob(job1), prepareJob(job2));
      expect(res.isDuplicate).toBe(true);
      expect(res.evidence).toContain("Identical fingerprint");
    });

    it("matches reposted job with minor edits at same company (heuristic duplicate)", () => {
      const desc1 =
        "We are looking for a Senior Software Engineer to design, build, and deploy cloud services using Go and PostgreSQL. The ideal candidate will have strong architectural and mentoring skills.";
      const desc2 =
        "We are looking for a Senior Software Engineer to design, build, and deploy cloud services using Go and PostgreSQL. The ideal candidate will have strong architectural and mentoring experience.";

      const job1 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000001",
        fingerprint: `sha256:${"1".repeat(64)}`,
        company: "Acme Tech Inc.",
        title: "Senior Software Engineer (Go)",
        description: desc1,
      });
      const job2 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000002",
        fingerprint: `sha256:${"2".repeat(64)}`,
        company: "Acme Tech LLC",
        title: "Senior Software Engineer - Go",
        description: desc2,
      });

      const res = areDuplicates(prepareJob(job1), prepareJob(job2));
      expect(res.isDuplicate).toBe(true);
      expect(res.evidence).toContain("Heuristic match");
    });

    it("does NOT match jobs with same title at different companies", () => {
      const desc =
        "We are looking for a Senior Software Engineer to design, build, and deploy cloud services using Go and PostgreSQL.";

      const job1 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000001",
        fingerprint: `sha256:${"1".repeat(64)}`,
        company: "Google LLC",
        title: "Senior Software Engineer",
        description: desc,
      });
      const job2 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000002",
        fingerprint: `sha256:${"2".repeat(64)}`,
        company: "Microsoft Corporation",
        title: "Senior Software Engineer",
        description: desc,
      });

      const res = areDuplicates(prepareJob(job1), prepareJob(job2));
      expect(res.isDuplicate).toBe(false);
    });

    it("does NOT match when company is null in one or both jobs", () => {
      const desc =
        "Identical description for testing null company behavior across multiple postings.";
      const job1 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000001",
        fingerprint: `sha256:${"1".repeat(64)}`,
        company: null,
        title: "Software Engineer",
        description: desc,
      });
      const job2 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000002",
        fingerprint: `sha256:${"2".repeat(64)}`,
        company: "Acme",
        title: "Software Engineer",
        description: desc,
      });

      expect(areDuplicates(prepareJob(job1), prepareJob(job2)).isDuplicate).toBe(false);
    });

    it("does NOT match when title similarity is below 0.8", () => {
      const desc = "Identical description for testing title divergence across jobs.";
      const job1 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000001",
        fingerprint: `sha256:${"1".repeat(64)}`,
        company: "Acme Tech",
        title: "Frontend React Developer",
        description: desc,
      });
      const job2 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000002",
        fingerprint: `sha256:${"2".repeat(64)}`,
        company: "Acme Tech",
        title: "Database Administrator Architect",
        description: desc,
      });

      expect(areDuplicates(prepareJob(job1), prepareJob(job2)).isDuplicate).toBe(false);
    });

    it("does NOT match when description shingle similarity is below 0.85", () => {
      const job1 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000001",
        fingerprint: `sha256:${"1".repeat(64)}`,
        company: "Acme Tech",
        title: "Senior Engineer",
        description:
          "Focusing strictly on frontend UI components, React hooks, and design systems.",
      });
      const job2 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000002",
        fingerprint: `sha256:${"2".repeat(64)}`,
        company: "Acme Tech",
        title: "Senior Engineer",
        description:
          "Focusing strictly on backend kernel optimization, C memory management, and socket servers.",
      });

      expect(areDuplicates(prepareJob(job1), prepareJob(job2)).isDuplicate).toBe(false);
    });
  });

  describe("findDuplicates", () => {
    it("returns empty groups when jobs array has less than 2 jobs", () => {
      expect(findDuplicates([]).groups).toEqual([]);
      expect(findDuplicates([createTestJob()]).groups).toEqual([]);
    });

    it("clusters multiple duplicates using Union-Find transitively", () => {
      // Job 1 and Job 2 have same fingerprint
      const job1 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000001",
        fingerprint: `sha256:${"a".repeat(64)}`,
      });
      const job2 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000002",
        fingerprint: `sha256:${"a".repeat(64)}`,
      });

      // Job 3 duplicates Job 2 via heuristic match
      const job3 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000003",
        fingerprint: `sha256:${"b".repeat(64)}`,
        company: job2.company,
        title: job2.title,
        description: job2.description,
      });

      // Job 4 is unique
      const job4 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000004",
        fingerprint: `sha256:${"c".repeat(64)}`,
        company: "Different Company",
        title: "Completely Different Title",
        description: "Completely distinct description content.",
      });

      const { groups } = findDuplicates([job1, job2, job3, job4]);
      expect(groups.length).toBe(1);
      expect(groups[0]?.job_ids).toEqual([job1.job_id, job2.job_id, job3.job_id]);
      expect(groups[0]?.evidence.length).toBeGreaterThanOrEqual(1);
    });

    it("sorts multiple duplicate groups deterministically by their first job_id ASC", () => {
      // Group B (higher job_ids, distinct company)
      const jobB1 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000003",
        fingerprint: `sha256:${"b".repeat(64)}`,
        company: "Beta Corp",
      });
      const jobB2 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000004",
        fingerprint: `sha256:${"b".repeat(64)}`,
        company: "Beta Corp",
      });

      // Group A (lower job_ids, distinct company)
      const jobA1 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000001",
        fingerprint: `sha256:${"a".repeat(64)}`,
        company: "Alpha Corp",
      });
      const jobA2 = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000002",
        fingerprint: `sha256:${"a".repeat(64)}`,
        company: "Alpha Corp",
      });

      // Pass in reverse order [jobB1, jobB2, jobA1, jobA2]
      const { groups } = findDuplicates([jobB1, jobB2, jobA1, jobA2]);
      expect(groups.length).toBe(2);
      expect(groups[0]?.job_ids).toEqual([jobA1.job_id, jobA2.job_id]);
      expect(groups[1]?.job_ids).toEqual([jobB1.job_id, jobB2.job_id]);
    });
  });

  describe("checkIngestDuplicates", () => {
    it("returns empty matches and no warnings when existing list is empty", () => {
      const newJob = createTestJob();
      const res = checkIngestDuplicates(newJob, []);
      expect(res.duplicates).toEqual([]);
      expect(res.warnings).toEqual([]);
    });

    it("identifies duplicate and adds DUPLICATE_SUSPECTED warning", () => {
      const existingJob = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000001",
        fingerprint: `sha256:${"f".repeat(64)}`,
      });
      const newJob = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000002",
        fingerprint: `sha256:${"f".repeat(64)}`,
      });

      const res = checkIngestDuplicates(newJob, [existingJob]);
      expect(res.duplicates.length).toBe(1);
      expect(res.duplicates[0]?.job_id).toBe(existingJob.job_id);
      expect(res.warnings.length).toBe(1);
      expect(res.warnings[0]?.code).toBe("DUPLICATE_SUSPECTED");
    });

    it("returns empty duplicates and no warnings when existing jobs do not match", () => {
      const existingJob = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000001",
        fingerprint: `sha256:${"1".repeat(64)}`,
        company: "Company Alpha",
        title: "Frontend",
      });
      const newJob = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000002",
        fingerprint: `sha256:${"2".repeat(64)}`,
        company: "Company Beta",
        title: "Backend",
      });

      const res = checkIngestDuplicates(newJob, [existingJob]);
      expect(res.duplicates).toEqual([]);
      expect(res.warnings).toEqual([]);
    });

    it("handles multiple existing jobs with mixed match and non-match", () => {
      const matchJob = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000001",
        fingerprint: `sha256:${"1".repeat(64)}`,
      });
      const nonMatchJob = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000002",
        fingerprint: `sha256:${"2".repeat(64)}`,
        company: "Completely Different Inc",
        title: "Completely Different Role",
        description: "Completely different text.",
      });
      const newJob = createTestJob({
        job_id: "job_00000000-0000-4000-8000-000000000003",
        fingerprint: `sha256:${"1".repeat(64)}`,
      });

      const res = checkIngestDuplicates(newJob, [matchJob, nonMatchJob]);
      expect(res.duplicates.length).toBe(1);
      expect(res.duplicates[0]?.job_id).toBe(matchJob.job_id);
    });
  });

  describe("UnionFind", () => {
    it("handles all rank scenarios and duplicate union calls", async () => {
      const { UnionFind } = await import("../../src/dedupe/union-find.js");
      const uf = new UnionFind(5);

      // 0 and 1 union (ranks 0 == 0 -> rank of 0 becomes 1)
      expect(uf.union(0, 1)).toBe(true);
      // Already united
      expect(uf.union(0, 1)).toBe(false);

      // 2 and 3 union (rank 0 == 0 -> rank of 2 becomes 1)
      expect(uf.union(2, 3)).toBe(true);

      // Union sets with unequal ranks:
      // rank of 0 is 1, 4 has rank 0.
      // rankX > rankY branch: union(0, 4)
      expect(uf.union(0, 4)).toBe(true);

      // rankX < rankY branch: union a rank 0 item to set with rank 1
      const uf2 = new UnionFind(4);
      uf2.union(0, 1); // root 0 has rank 1
      // root 2 has rank 0. union(2, 0) -> rankX < rankY branch!
      expect(uf2.union(2, 0)).toBe(true);

      // Path compression verification: find deep nodes
      expect(uf.find(4)).toBe(uf.find(1));
    });
  });
});
