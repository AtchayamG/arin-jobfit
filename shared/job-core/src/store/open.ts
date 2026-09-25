/**
 * Store opening, database migration, and lifecycle management per Doc 16 §3D.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SqliteAuditRepo } from "./audit.js";
import { StoreError } from "./error.js";
import { SqliteJobRepo } from "./jobs.js";
import { SqliteProfileRepo } from "./profiles.js";
import { runRetention } from "./retention.js";
import { SqliteDataRightsRepo } from "./rights.js";
import type { OpenStoreOptions, Store } from "./types.js";

const INIT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS jobs (
  job_id TEXT PRIMARY KEY,
  fingerprint TEXT NOT NULL,
  ingested_at TEXT NOT NULL,
  retention_class TEXT NOT NULL,
  remote_mode TEXT NOT NULL,
  employment_type TEXT NOT NULL,
  search_text TEXT NOT NULL,
  json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_fingerprint ON jobs(fingerprint);
CREATE INDEX IF NOT EXISTS idx_jobs_ingested_id ON jobs(ingested_at, job_id);

CREATE TABLE IF NOT EXISTS profiles (
  profile_id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  tool TEXT NOT NULL,
  request_id TEXT NOT NULL,
  outcome TEXT NOT NULL,
  error_code TEXT,
  subject_hash TEXT
);

CREATE TABLE IF NOT EXISTS purge_tokens (
  token TEXT PRIMARY KEY,
  expires_at TEXT NOT NULL,
  used INTEGER NOT NULL DEFAULT 0
);
`;

export function openStore(opts: OpenStoreOptions): Store {
  let db: DatabaseSync;

  if (opts.memory === true) {
    db = new DatabaseSync(":memory:");
  } else {
    if (!opts.dataDir) {
      throw new StoreError("INVALID_DATA_DIR", "dataDir is required when memory mode is false");
    }
    try {
      fs.mkdirSync(opts.dataDir, { recursive: true, mode: 0o700 });
    } catch {
      throw new StoreError("INVALID_DATA_DIR", "Failed to create data directory");
    }
    const dbPath = path.join(opts.dataDir, `${opts.product}.sqlite3`);
    db = new DatabaseSync(dbPath);
  }

  // Set SQLite pragmas
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");

  // Run schema migrations
  db.exec(INIT_SCHEMA_SQL);

  // Initialize or read metadata
  const getMetaStmt = db.prepare("SELECT value FROM meta WHERE key = ?;");
  const insertMetaStmt = db.prepare("INSERT INTO meta (key, value) VALUES (?, ?);");

  const schemaVersionRow = getMetaStmt.get("schema_version") as { value: string } | undefined;
  if (!schemaVersionRow) {
    insertMetaStmt.run("schema_version", "1");
  }

  let auditSalt: string;
  const auditSaltRow = getMetaStmt.get("audit_salt") as { value: string } | undefined;
  if (!auditSaltRow) {
    auditSalt = crypto.randomBytes(32).toString("hex");
    insertMetaStmt.run("audit_salt", auditSalt);
  } else {
    auditSalt = auditSaltRow.value;
  }

  // Run retention on open
  const nowStr =
    typeof opts.now === "function" ? opts.now() : (opts.now ?? new Date().toISOString());
  runRetention(db, nowStr);

  // Initialize repositories
  const jobs = new SqliteJobRepo(db);
  const profiles = new SqliteProfileRepo(db);
  const audit = new SqliteAuditRepo(db, auditSalt);
  const rights = new SqliteDataRightsRepo(db, jobs, profiles, audit);

  return {
    jobs,
    profiles,
    audit,
    rights,
    close(): void {
      db.close();
    },
  };
}
