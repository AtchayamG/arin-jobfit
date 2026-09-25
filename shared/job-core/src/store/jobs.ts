/**
 * SQLite implementation of JobRepo.
 *
 * Implements bounded job storage (max 10,000), keyset pagination,
 * filters, and escaped LIKE search with 100% prepared static SQL queries.
 */

import type { DatabaseSync, StatementSync } from "node:sqlite";
import { type Job, jobSchema, type JobSummary } from "../schemas/job.js";
import { decodeCursor, encodeCursor } from "./cursor.js";
import { StoreError } from "./error.js";
import { escapeLike } from "./escape.js";
import { validateJobId } from "./id.js";
import type { JobListOptions, JobPageResult, JobRepo, JobSearchOptions } from "./types.js";

const MAX_JOBS_LIMIT = 10_000;

export function toJobSummary(job: Job): JobSummary {
  return {
    job_id: job.job_id,
    provider: job.provider,
    title: job.title,
    company: job.company,
    remote_mode: job.remote_mode,
    employment_type: job.employment_type,
    ingested_at: job.ingested_at,
    retention_class: job.retention_class,
    source_url_is_official: job.source_url_is_official,
    location_raw: job.location.raw,
    experience_min_years: job.experience.min_years,
    experience_max_years: job.experience.max_years,
    compensation_disclosed: job.compensation.disclosed,
    flag_count: job.flags.length,
  };
}

function parseJobJson(jsonStr: string): Job {
  try {
    const raw = JSON.parse(jsonStr) as unknown;
    return jobSchema.parse(raw);
  } catch {
    throw new StoreError("CORRUPT_ROW", "Corrupt job row in database");
  }
}

export class SqliteJobRepo implements JobRepo {
  private readonly db: DatabaseSync;
  private readonly checkExistsStmt: StatementSync;
  private readonly countStmt: StatementSync;
  private readonly insertStmt: StatementSync;
  private readonly getStmt: StatementSync;
  private readonly findByFpStmt: StatementSync;
  private readonly deleteStmt: StatementSync;
  private readonly recentStmt: StatementSync;
  private readonly listStmt: StatementSync;
  private readonly searchStmt: StatementSync;

  constructor(db: DatabaseSync) {
    this.db = db;

    this.checkExistsStmt = this.db.prepare("SELECT 1 FROM jobs WHERE job_id = ?;");
    this.countStmt = this.db.prepare("SELECT COUNT(*) as c FROM jobs;");
    this.insertStmt = this.db.prepare(
      "INSERT OR REPLACE INTO jobs (job_id, fingerprint, ingested_at, retention_class, remote_mode, employment_type, search_text, json) VALUES (?, ?, ?, ?, ?, ?, ?, ?);",
    );
    this.getStmt = this.db.prepare("SELECT json FROM jobs WHERE job_id = ?;");
    this.findByFpStmt = this.db.prepare("SELECT json FROM jobs WHERE fingerprint = ? LIMIT 1;");
    this.deleteStmt = this.db.prepare("DELETE FROM jobs WHERE job_id = ?;");
    this.recentStmt = this.db.prepare(
      "SELECT json FROM jobs ORDER BY ingested_at DESC, job_id DESC LIMIT ?;",
    );
    this.listStmt = this.db.prepare(
      "SELECT json FROM jobs WHERE (? IS NULL OR remote_mode IN (SELECT value FROM json_each(?))) AND (? IS NULL OR employment_type IN (SELECT value FROM json_each(?))) AND (? IS NULL OR retention_class IN (SELECT value FROM json_each(?))) AND (? IS NULL OR (ingested_at < ? OR (ingested_at = ? AND job_id < ?))) ORDER BY ingested_at DESC, job_id DESC LIMIT ?;",
    );
    this.searchStmt = this.db.prepare(
      "SELECT json FROM jobs WHERE search_text LIKE ? ESCAPE '\\' AND (? IS NULL OR remote_mode IN (SELECT value FROM json_each(?))) AND (? IS NULL OR employment_type IN (SELECT value FROM json_each(?))) AND (? IS NULL OR retention_class IN (SELECT value FROM json_each(?))) AND (? IS NULL OR (ingested_at < ? OR (ingested_at = ? AND job_id < ?))) ORDER BY ingested_at DESC, job_id DESC LIMIT ?;",
    );
  }

  count(): number {
    const row = this.countStmt.get() as { c: number };
    return row.c;
  }

  insert(job: Job): void {
    validateJobId(job.job_id);
    const validated = jobSchema.parse(job);

    const exists = this.checkExistsStmt.get(validated.job_id) !== undefined;
    if (!exists && this.count() >= MAX_JOBS_LIMIT) {
      throw new StoreError("LIMIT_EXCEEDED", "Job store limit of 10,000 exceeded");
    }

    const searchText = [
      validated.title,
      validated.company ?? "",
      validated.location.raw ?? "",
      validated.location.city ?? "",
      validated.location.country ?? "",
      ...validated.required_skills,
      ...validated.preferred_skills,
      validated.description,
    ]
      .join(" ")
      .toLowerCase();

    const jsonStr = JSON.stringify(validated);
    this.insertStmt.run(
      validated.job_id,
      validated.fingerprint,
      validated.ingested_at,
      validated.retention_class,
      validated.remote_mode,
      validated.employment_type,
      searchText,
      jsonStr,
    );
  }

  get(id: string): Job | null {
    validateJobId(id);
    const row = this.getStmt.get(id) as { json: string } | undefined;
    if (!row) return null;
    return parseJobJson(row.json);
  }

  findByFingerprint(fp: string): Job | null {
    const row = this.findByFpStmt.get(fp) as { json: string } | undefined;
    if (!row) return null;
    return parseJobJson(row.json);
  }

  delete(id: string): boolean {
    validateJobId(id);
    const result = this.deleteStmt.run(id);
    return Number(result.changes) > 0;
  }

  recent(limit = 50): Job[] {
    const clamped = Math.max(1, Math.min(limit, 500));
    const rows = this.recentStmt.all(clamped) as Array<{ json: string }>;
    return rows.map((r) => parseJobJson(r.json));
  }

  list(opts?: JobListOptions): JobPageResult {
    const pageSize = Math.max(1, Math.min(opts?.pageSize ?? 20, 50));
    const decoded = opts?.cursor ? decodeCursor(opts.cursor) : null;

    const remoteCheck =
      opts?.filters?.remote_mode && opts.filters.remote_mode.length > 0 ? "active" : null;
    const remoteJson = remoteCheck ? JSON.stringify(opts?.filters?.remote_mode) : null;

    const empCheck =
      opts?.filters?.employment_type && opts.filters.employment_type.length > 0 ? "active" : null;
    const empJson = empCheck ? JSON.stringify(opts?.filters?.employment_type) : null;

    const retCheck =
      opts?.filters?.retention_class && opts.filters.retention_class.length > 0 ? "active" : null;
    const retJson = retCheck ? JSON.stringify(opts?.filters?.retention_class) : null;

    const cursorCheck = decoded ? "active" : null;
    const curIngested = decoded ? decoded.ingested_at : "";
    const curJobId = decoded ? decoded.job_id : "";

    const rows = this.listStmt.all(
      remoteCheck,
      remoteJson,
      empCheck,
      empJson,
      retCheck,
      retJson,
      cursorCheck,
      curIngested,
      curIngested,
      curJobId,
      pageSize + 1,
    ) as Array<{ json: string }>;

    const jobs = rows.map((r) => parseJobJson(r.json));
    const hasMore = jobs.length > pageSize;
    const pagedJobs = hasMore ? jobs.slice(0, pageSize) : jobs;
    const items = pagedJobs.map(toJobSummary);

    const lastItem = pagedJobs[pagedJobs.length - 1];
    const nextCursor =
      hasMore && lastItem ? encodeCursor(lastItem.ingested_at, lastItem.job_id) : null;

    return { items, nextCursor };
  }

  search(opts: JobSearchOptions): JobPageResult {
    const pageSize = Math.max(1, Math.min(opts.pageSize ?? 20, 50));
    const decoded = opts.cursor ? decodeCursor(opts.cursor) : null;
    const query = opts.query.slice(0, 200).trim().toLowerCase();
    const pattern = `%${escapeLike(query)}%`;

    const remoteCheck =
      opts.filters?.remote_mode && opts.filters.remote_mode.length > 0 ? "active" : null;
    const remoteJson = remoteCheck ? JSON.stringify(opts.filters?.remote_mode) : null;

    const empCheck =
      opts.filters?.employment_type && opts.filters.employment_type.length > 0 ? "active" : null;
    const empJson = empCheck ? JSON.stringify(opts.filters?.employment_type) : null;

    const retCheck =
      opts.filters?.retention_class && opts.filters.retention_class.length > 0 ? "active" : null;
    const retJson = retCheck ? JSON.stringify(opts.filters?.retention_class) : null;

    const cursorCheck = decoded ? "active" : null;
    const curIngested = decoded ? decoded.ingested_at : "";
    const curJobId = decoded ? decoded.job_id : "";

    const rows = this.searchStmt.all(
      pattern,
      remoteCheck,
      remoteJson,
      empCheck,
      empJson,
      retCheck,
      retJson,
      cursorCheck,
      curIngested,
      curIngested,
      curJobId,
      pageSize + 1,
    ) as Array<{ json: string }>;

    const jobs = rows.map((r) => parseJobJson(r.json));
    const hasMore = jobs.length > pageSize;
    const pagedJobs = hasMore ? jobs.slice(0, pageSize) : jobs;
    const items = pagedJobs.map(toJobSummary);

    const lastItem = pagedJobs[pagedJobs.length - 1];
    const nextCursor =
      hasMore && lastItem ? encodeCursor(lastItem.ingested_at, lastItem.job_id) : null;

    return { items, nextCursor };
  }
}
