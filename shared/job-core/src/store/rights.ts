/**
 * SQLite implementation of DataRightsRepo.
 *
 * Implements data export and two-step single-use purge with cfm_ confirmation tokens per Doc 16 §3D and T-13.
 */

import crypto from "node:crypto";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import { type Job, jobSchema } from "../schemas/job.js";
import { type Profile, profileSchema } from "../schemas/profile.js";
import { StoreError } from "./error.js";
import type {
  AuditRepo,
  DataRightsRepo,
  ExportAllResult,
  JobRepo,
  ProfileRepo,
  PurgeResult,
  PurgeTokenSummary,
} from "./types.js";

const TOKEN_LIFETIME_MS = 5 * 60 * 1000; // 5 minutes

export class SqliteDataRightsRepo implements DataRightsRepo {
  private readonly db: DatabaseSync;
  private readonly jobRepo: JobRepo;
  private readonly profileRepo: ProfileRepo;
  private readonly auditRepo: AuditRepo;

  private readonly allJobsStmt: StatementSync;
  private readonly allProfilesStmt: StatementSync;
  private readonly insertTokenStmt: StatementSync;
  private readonly getTokenStmt: StatementSync;
  private readonly deleteJobsStmt: StatementSync;
  private readonly deleteProfilesStmt: StatementSync;
  private readonly deleteAuditStmt: StatementSync;
  private readonly deleteTokensStmt: StatementSync;

  constructor(db: DatabaseSync, jobRepo: JobRepo, profileRepo: ProfileRepo, auditRepo: AuditRepo) {
    this.db = db;
    this.jobRepo = jobRepo;
    this.profileRepo = profileRepo;
    this.auditRepo = auditRepo;

    this.allJobsStmt = this.db.prepare(
      "SELECT json FROM jobs ORDER BY ingested_at DESC, job_id DESC;",
    );
    this.allProfilesStmt = this.db.prepare("SELECT json FROM profiles ORDER BY updated_at DESC;");
    this.insertTokenStmt = this.db.prepare(
      "INSERT INTO purge_tokens (token, expires_at, used) VALUES (?, ?, 0);",
    );
    this.getTokenStmt = this.db.prepare(
      "SELECT token, expires_at, used FROM purge_tokens WHERE token = ?;",
    );
    this.deleteJobsStmt = this.db.prepare("DELETE FROM jobs;");
    this.deleteProfilesStmt = this.db.prepare("DELETE FROM profiles;");
    this.deleteAuditStmt = this.db.prepare("DELETE FROM audit;");
    this.deleteTokensStmt = this.db.prepare("DELETE FROM purge_tokens;");
  }

  exportAll(now?: string): ExportAllResult {
    const exportedAt = now ?? new Date().toISOString();
    const jobRows = this.allJobsStmt.all() as Array<{ json: string }>;
    const profileRows = this.allProfilesStmt.all() as Array<{ json: string }>;

    const jobs: Job[] = jobRows.map((r) => jobSchema.parse(JSON.parse(r.json)));
    const profiles: Profile[] = profileRows.map((r) => profileSchema.parse(JSON.parse(r.json)));

    return {
      export_version: "1",
      exported_at: exportedAt,
      jobs,
      profiles,
    };
  }

  createPurgeToken(now?: string): PurgeTokenSummary {
    const nowDate = now ? new Date(now) : new Date();
    const expiresAt = new Date(nowDate.getTime() + TOKEN_LIFETIME_MS).toISOString();
    const token = `cfm_${crypto.randomUUID()}`;

    const summary = {
      jobs: this.jobRepo.count(),
      profiles: this.profileRepo.count(),
    };

    this.insertTokenStmt.run(token, expiresAt);

    return { token, expires_at: expiresAt, summary };
  }

  purge(token: string, now?: string): PurgeResult {
    const row = this.getTokenStmt.get(token) as
      { token: string; expires_at: string; used: number } | undefined;
    const nowTime = now ? new Date(now).getTime() : Date.now();

    if (!row || row.used === 1 || nowTime > new Date(row.expires_at).getTime()) {
      throw new StoreError("CONFIRMATION_INVALID", "Invalid, used, or expired confirmation token");
    }

    const purgedJobs = this.jobRepo.count();
    const purgedProfiles = this.profileRepo.count();
    const purgedAudit = this.auditRepo.count();

    this.deleteJobsStmt.run();
    this.deleteProfilesStmt.run();
    this.deleteAuditStmt.run();
    this.deleteTokensStmt.run();

    this.auditRepo.append({
      tool: "data_purge",
      requestId: "purge",
      outcome: "ok",
      at: now,
    });

    return {
      purged_jobs: purgedJobs,
      purged_profiles: purgedProfiles,
      purged_audit: purgedAudit,
    };
  }
}
