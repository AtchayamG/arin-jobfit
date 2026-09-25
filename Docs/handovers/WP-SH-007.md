WORK PACKAGE: WP-SH-007 — Local store (node:sqlite): jobs, profiles, audit, data rights, retention
STATUS: DONE
FILES CREATED:
- shared/job-core/src/store/types.ts
- shared/job-core/src/store/error.ts
- shared/job-core/src/store/id.ts
- shared/job-core/src/store/escape.ts
- shared/job-core/src/store/cursor.ts
- shared/job-core/src/store/data-dir.ts
- shared/job-core/src/store/jobs.ts
- shared/job-core/src/store/profiles.ts
- shared/job-core/src/store/audit.ts
- shared/job-core/src/store/rights.ts
- shared/job-core/src/store/retention.ts
- shared/job-core/src/store/open.ts
- shared/job-core/src/store/index.ts
- shared/job-core/tests/store/fixtures.ts
- shared/job-core/tests/store/data-dir.test.ts
- shared/job-core/tests/store/jobs.test.ts
- shared/job-core/tests/store/pagination.test.ts
- shared/job-core/tests/store/search.test.ts
- shared/job-core/tests/store/profiles.test.ts
- shared/job-core/tests/store/retention.test.ts
- shared/job-core/tests/store/rights.test.ts
- shared/job-core/tests/store/temp-persistence.test.ts
- shared/job-core/tests/store/audit-privacy.test.ts
- shared/job-core/tests/store/sql-safety.test.ts
- shared/job-core/tests/store/barrel.test.ts
- Docs/handovers/WP-SH-007.md
FILES MODIFIED:
- none (clean isolation preserved; Codex WIP untouched)

IMPLEMENTATION SUMMARY:
- Step 1 (Types & Errors): Implemented StoreError with codes INVALID_ID, LIMIT_EXCEEDED, CONFIRMATION_INVALID, CORRUPT_ROW, INVALID_DATA_DIR in src/store/error.ts. Defined Store, JobRepo, ProfileRepo, AuditRepo, DataRightsRepo interfaces in src/store/types.ts.
- Step 2 (ID Validation & Escape Utilities): Implemented validateJobId and validateProfileId in src/store/id.ts (enforcing exact regex matching, throwing INVALID_ID on failure). Implemented escapeLike in src/store/escape.ts escaping '\', '%', and '_' for SQLite LIKE ... ESCAPE '\' queries.
- Step 3 (Opaque Keyset Cursors): Implemented base64url encodeCursor and decodeCursor in src/store/cursor.ts with JSON schema and ID validation.
- Step 4 (Data Directory Resolver): Implemented pure resolveDataDir in src/store/data-dir.ts rejecting relative paths, UNC/device paths (\\?\), and bare root paths ('/', 'C:\'). Resolves platform-specific defaults for Windows (%LOCALAPPDATA%), macOS (~/Library/Application Support), and Linux ($XDG_DATA_HOME or ~/.local/share) under <appDataDir>/job-portal-mcp/<product>.
- Step 5 (Sqlite Database Engine & Migrations): Implemented openStore in src/store/open.ts with WAL mode, foreign keys ON, busy timeout, and schema v1 migrations (meta, jobs, profiles, audit, purge_tokens tables and indexes). Generates and persists unique 32-byte salt in meta table.
- Step 6 (Job Repository): Implemented SqliteJobRepo in src/store/jobs.ts with 10,000 job limit enforcement (LIMIT_EXCEEDED), fingerprint deduplication, keyset pagination (ingested_at DESC, job_id DESC), and escaped search over search_text.
- Step 7 (Profile Repository): Implemented SqliteProfileRepo in src/store/profiles.ts with 50 profile limit enforcement, auto-generated prof_<uuid>, upsert normalization, and JSON serialization.
- Step 8 (Audit Logging & Privacy Invariant): Implemented SqliteAuditRepo in src/store/audit.ts storing subject_hash = first 16 hex chars of sha256(salt + subjectId). Zero PII, payload, or JD text persisted.
- Step 9 (Data Rights & Purge): Implemented SqliteDataRightsRepo in src/store/rights.ts. exportAll exports jobs and profiles excluding audit. createPurgeToken creates cfm_<uuid> expiring in 300 seconds. purge enforces single-use token verification (CONFIRMATION_INVALID on expiry or reuse), deletes jobs, profiles, audit, and tokens, and appends a single final audit record for the purge.
- Step 10 (Retention Engine): Implemented runRetention in src/store/retention.ts deleting session jobs and standard_180d jobs older than 180 days relative to injected now, preserving pinned jobs. Automatically runs on openStore.

ADVERSARIAL FINDINGS:
1. SQL Injection Prevention & Dynamic Filter Parameterization:
   - Dynamic query building in SQL often leads to SQL injection or statement fragmentation when assembling filter clauses like remote_mode IN (...).
   - We engineered 100% static prepared statements leveraging SQLite's native json_each(?) function:
     WHERE (? IS NULL OR remote_mode IN (SELECT value FROM json_each(?)))
     AND (? IS NULL OR (ingested_at < ? OR (ingested_at = ? AND job_id < ?)))
   - Zero dynamic string concatenation or template literal interpolation is used anywhere in the store implementation. This is mechanically verified by tests/store/sql-safety.test.ts, which inspects all store source files.
2. Data Directory Path Traversal & Boundary Safety:
   - Untrusted directory inputs could point to arbitrary filesystem locations or bypass security boundaries via UNC paths (\\?\C:\...), network shares (\\server\share), or system roots.
   - resolveDataDir enforces absolute path validation, explicitly rejects relative paths, UNC namespaces, and bare roots (C:\, /, D:\), and normalizes paths cleanly across Windows, macOS, and Linux.
3. Keyset Cursor Tampering & ID Injection:
   - Pagination cursors exposed to external callers can be forged to manipulate SQL queries or access out-of-order data.
   - decodeCursor parses base64url-encoded JSON payloads, strictly verifies the shape ({ ingested_at, job_id }), and runs validateJobId against the unpacked job_id. Any tampering immediately throws StoreError("INVALID_ID") before hitting the database.
4. Audit Log Privacy Leak Prevention (T-10, T-13):
   - Storing user profile details, job descriptions, or raw IDs in audit logs creates secondary PII leakage vulnerabilities.
   - Audit logging only records tool, requestId, outcome, optional errorCode, and a one-way subject_hash = sha256(salt + subjectId).slice(0, 16). A unique 32-byte cryptographic salt is generated per database instance upon initialization. tests/store/audit-privacy.test.ts verifies that zero PII, JD text, or raw candidate data exists in the audit table after extensive store operations.
5. Purge Token Lifecycle & Race Condition Safety:
   - Confirmation tokens (cfm_<uuid>) must be strictly single-use and time-bounded.
   - createPurgeToken issues a token valid for exactly 300 seconds. purge verifies existence, status (used = 0), and expiry (now <= expires_at). Once validated, the transaction wipes jobs, profiles, prior audit logs, and tokens in a single atomic transaction before logging the purge event.

TEST RESULTS:
All 11 test files (58 tests) in tests/store passed. Full coverage report for src/store/**:

 % Coverage report from v8
--------------|---------|----------|---------|---------|-------------------
File          | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
--------------|---------|----------|---------|---------|-------------------
All files     |     100 |      100 |     100 |     100 |                   
 audit.ts     |     100 |      100 |     100 |     100 |                   
 cursor.ts    |     100 |      100 |     100 |     100 |                   
 data-dir.ts  |     100 |      100 |     100 |     100 |                   
 error.ts     |     100 |      100 |     100 |     100 |                   
 escape.ts    |     100 |      100 |     100 |     100 |                   
 id.ts        |     100 |      100 |     100 |     100 |                   
 index.ts     |       0 |        0 |       0 |       0 |                   
 jobs.ts      |     100 |      100 |     100 |     100 |                   
 open.ts      |     100 |      100 |     100 |     100 |                   
 profiles.ts  |     100 |      100 |     100 |     100 |                   
 retention.ts |     100 |      100 |     100 |     100 |                   
 rights.ts    |     100 |      100 |     100 |     100 |                   
 types.ts     |       0 |        0 |       0 |       0 |                   
--------------|---------|----------|---------|---------|-------------------

COMMANDS RUN:
- npx.cmd vitest run tests/store --coverage.enabled=true --coverage.include="src/store/**/*.ts"
- npx.cmd eslint "src/store/**/*.ts" "tests/store/**/*.ts"
- npx.cmd prettier --check "src/store/**/*.ts" "tests/store/**/*.ts"
- npx.cmd tsc --noEmit
- git add shared/job-core/src/store/ shared/job-core/tests/store/
- git commit -m "WP-SH-007: local store (node:sqlite) jobs profiles audit data-rights retention"
- git rev-parse --short HEAD

KNOWN LIMITATIONS:
- Full-text search uses SQLite LIKE ... ESCAPE '\' over normalized search_text; FTS5 virtual tables are not used to maintain strict portability and zero C-extension/external dependencies.
- Keyset cursor pagination is optimized for ingested_at DESC, job_id DESC ordering; custom multi-column sort orders require additional indexed cursor structures.

SECURITY/POLICY CHECK:
- Zero dynamic SQL string concatenation; 100% prepared statements with bound parameters verified by tests/store/sql-safety.test.ts.
- No network requests, external I/O, or browser automation.
- Audit table contains zero PII, JD text, or payload data (T-10, T-13); verified by tests/store/audit-privacy.test.ts.
- Maximum store limits (10,000 jobs, 50 profiles) strictly enforced.
- All production source files <= 250 lines (audit: 56, cursor: 41, data-dir: 138, error: 18, escape: 7, id: 20, index: 16, jobs: 239, open: 124, profiles: 151, retention: 30, rights: 123, types: 136).
- Zero new external npm dependencies (uses Node.js 24 native node:sqlite).

BLUEPRINT DEVIATIONS: none
REMAINING RISKS: none
RECOMMENDED NEXT STEP: Claude architecture review of WP-SH-007; Codex resumes WP-SH-003.
COMMIT: f3cfe2b WP-SH-007: local store (node:sqlite) jobs profiles audit data-rights retention
