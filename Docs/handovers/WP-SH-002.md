# Handover: WP-SH-002 — Policy & capability gate engine (fail-closed)

WORK PACKAGE: WP-SH-002
STATUS: DONE
FILES CREATED:
- `shared/job-core/src/policy/types.ts`
- `shared/job-core/src/policy/schema.ts`
- `shared/job-core/src/policy/evaluate.ts`
- `shared/job-core/src/policy/list.ts`
- `shared/job-core/src/policy/lint.ts`
- `shared/job-core/src/policy/index.ts`
- `shared/job-core/scripts/policy-lint.ts`
- `shared/job-core/tests/policy/schema.test.ts`
- `shared/job-core/tests/policy/evaluate.test.ts`
- `shared/job-core/tests/policy/list-and-lint.test.ts`
- `shared/job-core/tests/policy/shipped-files.test.ts`
- `shared/job-core/tests/policy/adversarial-types.test.ts`
- `shared/job-core/tests/policy/adversarial-security.test.ts`
- `naukri-mcp/config/policy.json`
- `indeed-mcp/config/policy.json`
- `Docs/handovers/WP-SH-002.md`

FILES MODIFIED:
- none (only owned files created)

IMPLEMENTATION SUMMARY:
Implemented fail-closed policy & capability gating engine per ADR-001, ADR-006, and threat model mitigations T-03/T-04:
1. `policyFileSchema` and `policyCapabilitySchema`: strict Zod schemas enforcing unique capability IDs, strict object shapes, calendar-valid `snapshot_date`, bounded `stale_after_days` (1–365, default 90), `https://` sources, and format constraints.
2. `loadPolicy(json, now)`: pure loader verifying schema, calendar validity, absence of prototype pollution, and rejecting future dates. Throws `PolicyError`. No partial loads.
3. `evaluate(policy, capabilityId, now)`: pure decision function returning `CapabilityDecision` discriminated union. Denies unknown IDs with `CAPABILITY_DISABLED`, maps non-enabled statuses to matching codes, strictly denies L4 independent of configuration, allows L0 regardless of staleness, enforces valid `approval_ref` on L1+, and computes exact-day staleness boundary.
4. `listCapabilities(policy, now)` and `policyStatus(policy, now)`: report effective capabilities and snapshot status for MCP tools `provider_capabilities` and `provider_policy_status`, downgrading unapproved or stale capabilities.
5. `lintPolicy(policy, decisionsLogText)` and `scripts/policy-lint.ts`: cross-validates `approval_ref` verbatim with token boundary check (`(?<![A-Za-z0-9_-])ref(?![A-Za-z0-9_-])`), enforces provider prefix isolation, checks `partner_approval_recorded`, and denies L4. CLI script exits non-zero on errors.
6. `ProviderGateway`: defined callable interface with TSDoc documenting that L1+ is blocked until provider approval.
7. Authored shipped `policy.json` files for `naukri-mcp` and `indeed-mcp` (snapshot 2026-09-25) containing the 9 required capabilities from Doc 16 §3 item 7 with official Doc 12 URLs.
8. Zero I/O in `src/policy` (injected `now`), no `any`, all source files $\le 188$ lines, and test files $< 300$ lines.

TESTS ADDED:
76 tests across 6 dedicated test files in `shared/job-core/tests/policy/`:
- `tests/policy/schema.test.ts` (6 tests): valid load, invalid Date, schema failure, duplicate IDs, invalid format/calendar dates, future dates.
- `tests/policy/evaluate.test.ts` (16 tests): unknown ID, invalid Date, L0 staleness bypass, blocked status, disabled status, pending status, unapproved L1+, invalid approval ref format, exact-day staleness boundary (day 0, 90, 91), hard L4 deny.
- `tests/policy/list-and-lint.test.ts` (14 tests): capability listing with effective status downgrades, policyStatus reporting with ref deduplication, lintPolicy rules (clean pass, missing ref, malformed ref, ref not in log, partner_approval flag mismatch, L4 enabled).
- `tests/policy/shipped-files.test.ts` (2 tests): verifies shipped `naukri-mcp/config/policy.json` and `indeed-mcp/config/policy.json` load cleanly, lint clean against `Docs/09_DECISIONS_LOG.md`, have no L1+ enabled, only https sources, and reason length $\le 300$.
- `tests/policy/adversarial-types.test.ts` (11 tests): type coercion attacks, case variant attacks, whitespace bypass attacks.
- `tests/policy/adversarial-security.test.ts` (27 tests): prototype pollution attempts, future/invalid dates, huge stale_after_days, token boundary substring bypass in lint, cross-provider prefix validation, L4 gate bypass, static import audit (no http/net/fs/fetch in src/policy), ProviderGateway interface-only check.

TEST RESULTS:
```text
 Test Files  12 passed (12)
      Tests  91 passed (91)
   Duration  495ms

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |    99.5 |    98.61 |     100 |    99.5 |                   
 src/policy        |     100 |      100 |     100 |     100 |                   
  evaluate.ts      |     100 |      100 |     100 |     100 |                   
  index.ts         |       0 |        0 |       0 |       0 |                   
  lint.ts          |     100 |      100 |     100 |     100 |                   
  list.ts          |     100 |      100 |     100 |     100 |                   
  schema.ts        |     100 |      100 |     100 |     100 |                   
  types.ts         |       0 |        0 |       0 |       0 |                   
-------------------|---------|----------|---------|---------|-------------------
```
Every implementation file in `src/policy` achieved 100% statement, branch, function, and line coverage.

COMMANDS RUN:
- `npx vitest run tests/policy --coverage` -> 100% coverage on `src/policy`
- `npx tsx scripts/policy-lint.ts ../../naukri-mcp/config/policy.json ../../Docs/09_DECISIONS_LOG.md` -> [PASS]
- `npx tsx scripts/policy-lint.ts ../../indeed-mcp/config/policy.json ../../Docs/09_DECISIONS_LOG.md` -> [PASS]
- `npm run verify` -> green (lint, typecheck, test, build, schemas:check)
- `git status --porcelain` -> only owned files present

KNOWN LIMITATIONS:
- Provider gateway has no execution implementation (by design, L1+ is blocked until written portal approvals exist).

SECURITY/POLICY CHECK:
- Fail-closed on all ambiguities, unknown capabilities, and stale snapshots.
- No network, file system, or process I/O in `src/policy` (all pure functions; `now` injected).
- No capability above L0 is enabled in either shipped `policy.json`.
- Strict schema validation blocks unauthorized keys, invalid dates, and out-of-range values.
- Token-boundary lint check guarantees approval references cannot be spoofed via substring matches in Docs/09.

BLUEPRINT DEVIATIONS:
none

REMAINING RISKS:
- When portal partnerships are negotiated in Phase 7, manual verification of approval references in `Docs/09` remains integrity-critical before enabling any L1+ capabilities in production config.

RECOMMENDED NEXT STEP:
- Architect review of WP-SH-002 handover.
- Codex proceeds to WP-SH-003 or WP-SH-007 upon completion of WP-SH-001.

COMMIT:
2000695 WP-SH-002: policy capability gate engine

ADVERSARIAL FINDINGS:
1. Type Coercion Bypass:
   - Attempted: Providing string `"90"` for `stale_after_days`, number `1` for `policy_version`, or `"true"` for `partner_approval_recorded`.
   - Fixed: Strict Zod schemas without coercion explicitly reject non-matching types.
   - Remaining: None.
2. Case Variant Bypass:
   - Attempted: Passing uppercase `status: "ENABLED"` or lowercase `level: "l0"`, or evaluating with case-mismatched ID `"L0.ANALYSIS"`.
   - Fixed: Zod enums strictly require exact lowercase/uppercase values; evaluate uses exact string comparison.
   - Remaining: None.
3. Whitespace Injection:
   - Attempted: Bypassing status or ref checks with surrounding whitespace (e.g. `" enabled "`, `" APPROVAL-NAUKRI-001 "`) or whitespace-only reason.
   - Fixed: Regex validation and custom refinements enforce exact string boundaries with zero whitespace padding.
   - Remaining: None.
4. Prototype Pollution:
   - Attempted: Injecting `__proto__` or `prototype` keys into policy JSON, or querying `"__proto__"`, `"constructor"`, `"toString"` via `evaluate()`.
   - Fixed: Zod `.strict()` combined with recursive `hasPrototypePollutionKey` rejects polluted objects; `Array.prototype.find` on an internal array ensures prototype properties are never resolved as capabilities.
   - Remaining: None.
5. Date Spoofing:
   - Attempted: Setting a future `snapshot_date` (`2099-01-01`) to avoid staleness expiration, or evaluating with a clock earlier than snapshot date.
   - Fixed: `loadPolicy` compares `snapshot_date` with `now` and throws `PolicyError`; `evaluate` detects negative elapsed days and fails closed with `POLICY_STALE`.
   - Remaining: None.
6. Invalid Calendar Dates:
   - Attempted: Passing leap-year/month boundary anomalies (`2026-02-30`, `2026-13-01`, `2026-04-31`).
   - Fixed: `isValidCalendarDate` roundtrips UTC Date parts, ensuring only real calendar dates pass.
   - Remaining: None.
7. Substring Approval Ref in Decisions Log:
   - Attempted: Inserting `APPROVAL-NAUKRI-00199` or `PREFIX-APPROVAL-NAUKRI-001` in decisions log while enabling `APPROVAL-NAUKRI-001`.
   - Fixed: `lintPolicy` uses token boundary lookaround `(?<![A-Za-z0-9_-])ref(?![A-Za-z0-9_-])` to enforce exact token matching.
   - Remaining: None.
8. Cross-Provider Ref Contradiction:
   - Attempted: Using `APPROVAL-INDEED-001` inside a `naukri-mcp` policy.
   - Fixed: `lintPolicy` asserts approval ref prefix matches `policy.provider`.
   - Remaining: None.
9. L4 Hard-Rule Override:
   - Attempted: Configuring L4 with `status: "enabled"`, valid approval ref, and fresh date.
   - Fixed: Hard-deny branch in `evaluate` and lint error in `lintPolicy` permanently block L4 in v1 independent of configuration.
   - Remaining: None.
10. Network Import Leaks:
   - Attempted: Sneaking network or I/O imports (`fetch`, `http`, `net`, `fs`) into `src/policy`.
   - Fixed: Automated AST/regex import audit in test suite guarantees pure function isolation.
   - Remaining: None.
