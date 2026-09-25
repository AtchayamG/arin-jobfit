/**
 * SQLite implementation of AuditRepo.
 *
 * Implements salted subject hashing and PII-free audit logging per Doc 16 §3D and T-10.
 * Never stores payload content, CV text, or job descriptions.
 */

import crypto from "node:crypto";
import type { DatabaseSync, StatementSync } from "node:sqlite";
import type { AuditEntry, AuditRepo, AuditRow } from "./types.js";

export class SqliteAuditRepo implements AuditRepo {
  private readonly db: DatabaseSync;
  private readonly salt: string;
  private readonly insertStmt: StatementSync;
  private readonly listStmt: StatementSync;
  private readonly countStmt: StatementSync;

  constructor(db: DatabaseSync, salt: string) {
    this.db = db;
    this.salt = salt;
    this.insertStmt = this.db.prepare(
      "INSERT INTO audit (at, tool, request_id, outcome, error_code, subject_hash) VALUES (?, ?, ?, ?, ?, ?);",
    );
    this.listStmt = this.db.prepare(
      "SELECT id, at, tool, request_id, outcome, error_code, subject_hash FROM audit ORDER BY id DESC LIMIT ?;",
    );
    this.countStmt = this.db.prepare("SELECT COUNT(*) as c FROM audit;");
  }

  append(entry: AuditEntry): void {
    const at = entry.at ?? new Date().toISOString();
    const errorCode = entry.errorCode ?? null;
    let subjectHash: string | null = null;

    if (entry.subjectId) {
      subjectHash = crypto
        .createHash("sha256")
        .update(this.salt + entry.subjectId)
        .digest("hex")
        .slice(0, 16);
    }

    this.insertStmt.run(at, entry.tool, entry.requestId, entry.outcome, errorCode, subjectHash);
  }

  list(limit = 100): AuditRow[] {
    const clamped = Math.max(1, Math.min(limit, 1000));
    return this.listStmt.all(clamped) as unknown as AuditRow[];
  }

  count(): number {
    const row = this.countStmt.get() as { c: number };
    return row.c;
  }
}
