/**
 * Retention engine run upon opening the store per Doc 16 §3D.
 *
 * Deletes all session jobs and standard_180d jobs older than 180 days.
 * Pinned jobs are never deleted by retention.
 */

import type { DatabaseSync } from "node:sqlite";

const RETENTION_180_DAYS_MS = 180 * 24 * 60 * 60 * 1000;

export function runRetention(
  db: DatabaseSync,
  now: string,
): { sessionDeleted: number; expiredDeleted: number } {
  const deleteSessionStmt = db.prepare("DELETE FROM jobs WHERE retention_class = 'session';");
  const deleteExpiredStmt = db.prepare(
    "DELETE FROM jobs WHERE retention_class = 'standard_180d' AND ingested_at < ?;",
  );

  const cutoff = new Date(new Date(now).getTime() - RETENTION_180_DAYS_MS).toISOString();

  const sessionResult = deleteSessionStmt.run();
  const expiredResult = deleteExpiredStmt.run(cutoff);

  return {
    sessionDeleted: Number(sessionResult.changes),
    expiredDeleted: Number(expiredResult.changes),
  };
}
