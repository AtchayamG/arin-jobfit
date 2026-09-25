# Work Package Assignments v1

Author: Claude (Principal Architect) · Date: 2026-09-25

Rule: Codex and AGY never own the same file in the same period. A WP may only modify the files listed under "Owns". Anything else → STOP and report.

## 1. Registry

| WP | Agent | Tier | Phase | Depends on | Summary | Status |
|---|---|---|---|---|---|---|
| WP-SH-000 | Codex | LOW | P0 | — | git init, job-core package scaffold + toolchain | **READY** |
| WP-SH-001 | Codex | STANDARD | P1 | SH-000 | zod contract schemas, envelope/error builders, JSON Schema export | READY after SH-000 |
| WP-SH-002 | AGY | STANDARD | P1 | SH-000 | policy/capability gate engine, policy-lint, product policy.json files | READY after SH-000 |
| WP-SH-003 | Codex | STANDARD | P1 | SH-001 | normalization, requirement/skill extraction, skills taxonomy v1, provider hints | planned |
| WP-SH-004 | AGY | STANDARD | P1 | SH-001 | untrusted-text sanitizer, injection detector, URL validator, adversarial corpus | planned |
| WP-SH-005 | Codex | STANDARD | P1 | SH-003 | fit-v1 matching, explain, shortlist, dedupe | planned |
| WP-SH-006 | AGY | STANDARD | P1 | SH-003 | CV-notes, interview, handoff builders + truthfulness invariant | planned |
| WP-SH-007 | Codex | STANDARD | P1 | SH-001 | store interfaces, node:sqlite impl, migrations, retention, audit, export/purge | planned |
| WP-SH-008 | Codex | HIGH | P2 | SH-002..007, BCP-001/002 | MCP tool-kit on SDK v2: tool defs, handlers, pipeline, result mapping | planned |
| WP-NK-001 | Codex | STANDARD | P2 | SH-008 | naukri-mcp product: config, stdio entry, bundle, client install docs | planned |
| WP-IN-001 | AGY | STANDARD | P2 | SH-008 | indeed-mcp product: same, independent | planned |
| WP-QA-001 | Codex | STANDARD | P3 | NK-001, IN-001 | stdio integration + contract tests via SDK client | planned |
| WP-SEC-001 | AGY | HIGH | P3 | NK-001, IN-001 | adversarial security review + suite (T-01..T-17) | planned |
| WP-CMP-001 | AGY | STANDARD | P4 | QA-001 | client compatibility matrix (Claude Code, Codex, Gemini CLI, Kimi) | planned |
| WP-DOC-001 | Codex | LOW | P5 | CMP-001 | partner-pack docs assembly | planned |
| WP-HS-* | TBD | HIGH | P6 | P5 + hosted ADR | hosted Streamable HTTP/OAuth/tenancy | not designed |
| WP-NK-P*, WP-IN-P* | — | — | P7 | written approval | provider adapters | **BLOCKED_BY_PROVIDER_APPROVAL** |

Execution order: SH-000 → (SH-001 ∥ SH-002) → (SH-003 ∥ SH-004 ∥ SH-007*) → (SH-005 ∥ SH-006) → SH-008 → (NK-001 ∥ IN-001) → (QA-001 ∥ SEC-001) → CMP-001 → DOC-001.
\*SH-007 may run in the same Codex session after SH-003 if convenient. It shares no files with SH-003.

## 2. Shared-file ownership (job-core)

| File | Owner |
|---|---|
| `shared/job-core/package.json`, `package-lock.json`, tool configs | Codex (all WPs) |
| `shared/job-core/src/index.ts` (barrel) | Codex. AGY modules expose `src/<module>/index.ts`; Codex wires them into the barrel in its next WP. |
| `shared/job-core/src/policy/**`, `tests/policy/**` | AGY (SH-002) |
| `shared/job-core/src/sanitize/**`, `tests/sanitize/**`, `tests/fixtures/adversarial/**` | AGY (SH-004) |
| `shared/job-core/src/prepare/**`, `tests/prepare/**` | AGY (SH-006) |
| All other `src/**` and `tests/**` in job-core | Codex |
| `naukri-mcp/config/policy.json`, `indeed-mcp/config/policy.json` | AGY (SH-002) |

If AGY needs a new npm dependency or a package.json script, AGY STOPs and requests it in the handover. It does not edit package.json.

## 3. Detailed specifications — current wave

### WP-SH-000 — Repository init and job-core scaffold (Codex, LOW)

**Objective:** Put the repo under git and create a buildable, testable, empty `shared/job-core` package.

**Owns:**
- repository `.git` (init)
- `.gitattributes` (root)
- `shared/job-core/{package.json, package-lock.json, tsconfig.json, eslint.config.js, .prettierrc.json, .prettierignore, vitest.config.ts, tsup.config.ts, README.md, src/index.ts, tests/smoke.test.ts}`
- `Docs/handovers/WP-SH-000.md`

**Requirements:**

1. `git init -b main`. Add `.gitattributes` with `* text=auto eol=lf`. First commit: every file present when you start (the authority package including Docs 14–19), unmodified (message `WP-SH-000: import authority package`). Check first that no secrets or `.env` files exist.
2. `package.json`:
   - `name: "@jpm/job-core"`, `version: "0.1.0"`, `private: true`, `type: "module"`, `engines.node: ">=22.13"`
   - runtime deps: `zod@^4` only
   - dev deps: `typescript`, `@types/node`, `vitest`, `@vitest/coverage-v8`, `eslint`, `@eslint/js`, `typescript-eslint`, `prettier`, `tsup`, `tsx` (latest stable of each; record exact versions in the handover)
3. Scripts: `lint` (eslint + prettier --check), `format`, `typecheck` (tsc --noEmit), `test` (vitest run --coverage), `build` (tsup → dist, ESM + d.ts), `verify` (lint && typecheck && test && build via a cross-platform chain, for example `npm run lint && …`, which works in PowerShell 7 and cmd).
4. tsconfig:
   - `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`
   - `module`/`moduleResolution: NodeNext`, `target: ES2023`, `isolatedModules`
5. eslint: typescript-eslint `strictTypeChecked`; ban `any`; `no-console` error in `src/` (warn is not allowed). `max-lines` 300 as error (allows headroom over the 250 guideline).
6. vitest coverage thresholds: lines 90, branches 85, functions 90, statements 90 (globally). The smoke test asserts the `JOB_CORE_VERSION` export.
7. `src/index.ts` exports only `export const JOB_CORE_VERSION = "0.1.0";`. This is the only content, and it is not a placeholder: the version constant is used by the envelope in SH-001.
8. `.gitignore` already covers `node_modules`, `dist` and `coverage`. Do not modify it; report if it is insufficient.
9. `npm audit --omit=dev` must report 0 high/critical.

**Acceptance:**
- `npm ci && npm run verify` is green on the developer machine.
- `git log` shows 2 commits (import and scaffold).
- No files outside the Owns list are changed.

### WP-SH-001 — Contract schemas and envelope (Codex, STANDARD)

**Objective:** Implement the contract types of Doc 17 §3 and §6 as zod 4 schemas, the envelope/error builders, and a JSON Schema export with a drift check.

**Owns:**
- `shared/job-core/src/schemas/**`, `src/envelope/**`, `src/index.ts`
- `tests/schemas/**`, `tests/envelope/**`
- `scripts/export-schemas.ts`
- `package.json` (scripts only)
- `shared/schemas/*.schema.json`, `shared/schemas/README.md`
- `Docs/handovers/WP-SH-001.md`

**Requirements:**

1. Schemas:
   - `ProviderId`, `CapabilityLevel`, `Provenance`, `Warning` (+ code enum), `ToolError` (+ code enum)
   - `Envelope<T>` (generic factory `envelopeSchema(dataSchema)`)
   - `JobInput`, `Job`, `JobSummary`, `Requirements`
   - `ProfileInput`, `Profile`
   - `MatchResult`, `MatchDimension`
2. Every field has the limits from Doc 17. Use strict objects (unknown keys rejected). `ProfileInput` has no protected-attribute fields.
3. Builders:
   - `ok(ctx, data, {warnings?, provenance?, humanAction?})`
   - `partial(...)`
   - `fail(ctx, code, message, {remediation, retryable?, capabilityId?})`
   - `ctx` = `{tool, provider, serverName, serverVersion, policySnapshotDate, capabilityMode, requestId?}`. `request_id` is generated via `crypto.randomUUID()` if absent.
   - `INTERNAL` errors must not include the error message of the underlying exception.
4. `toCallToolResult(envelope)` → `{structuredContent, content:[{type:"text", text}], isError}` per Doc 17 §2, including 64 KB text truncation with the `OUTPUT_TRUNCATED` warning. Define a local minimal `CallToolResultLike` type. **Do not add the MCP SDK dependency yet.**
5. `scripts/export-schemas.ts` uses zod 4 `z.toJSONSchema` to write `shared/schemas/<name>.schema.json` (sorted keys, stable output).
   - Script `schemas:export` writes the files.
   - Script `schemas:check` regenerates in memory and fails on any difference. Add it to `verify`.
6. A portable-subset test (Doc 17 §5) runs against `JobInput`, `ProfileInput` and all other input-side schemas.
7. Barrel exports schemas and envelope.

**Tests:** valid and invalid cases per schema (boundary lengths, unknown keys, enum violations); builder outputs validate against `envelopeSchema`; truncation; the INTERNAL message is not leaked; schema drift check.

**Acceptance:** `npm run verify` green; coverage thresholds met; generated schemas committed.

### WP-SH-002 — Policy and capability gate engine (AGY, STANDARD)

**Objective:** Fail-closed capability gating as code (ADR-006, threats T-03/T-04).

**Owns:**
- `shared/job-core/src/policy/**`, `tests/policy/**`
- `shared/job-core/scripts/policy-lint.ts`
- `naukri-mcp/config/policy.json`, `indeed-mcp/config/policy.json`
- `Docs/handovers/WP-SH-002.md`

**Requirements:**

1. `policyFileSchema` (zod) with:
   - `policy_version: "1"`, `product`, `provider`, `snapshot_date` (YYYY-MM-DD), `stale_after_days` (1–365, default 90), `partner_approval_recorded: boolean`
   - `capabilities[]: {id, level: L0..L4, status: enabled|disabled|blocked_by_provider_approval|pending, reason (≤300), approval_ref: string|null, sources: https-url[]}`
   - Unique IDs. Strict objects.
2. `loadPolicy(json: unknown, now: Date) → Policy` (pure; the caller reads the file). Invalid → throws `PolicyError` with an actionable message. **No partial load.**
3. `evaluate(policy, capabilityId, now) → CapabilityDecision {allowed, capability_id, level, status, reason, error_code?: CAPABILITY_DISABLED|BLOCKED_BY_PROVIDER_APPROVAL|POLICY_STALE, approval_ref}`:
   - unknown id → denied `CAPABILITY_DISABLED`
   - status ≠ enabled → denied with the matching code
   - level ≥ L1 and enabled but `approval_ref` null → denied `BLOCKED_BY_PROVIDER_APPROVAL`
   - level ≥ L1 and snapshot age > `stale_after_days` → denied `POLICY_STALE`
   - L0 enabled → allowed regardless of staleness
   - L4 is always denied in v1 (hard rule, independent of config)
4. `listCapabilities(policy, now)` → data for the `provider_capabilities` tool. `policyStatus(policy, now)` → data for `provider_policy_status`.
5. `lintPolicy(policy, decisionsLogText) → LintResult[]`:
   - error if any capability with level ≥ L1 has status `enabled` and its `approval_ref` (format `APPROVAL-(NAUKRI|INDEED)-\d{3}`) does not appear verbatim in the decisions log
   - error if `partner_approval_recorded` is true without any such ref
   - `scripts/policy-lint.ts <policy.json> <Docs/09_DECISIONS_LOG.md>` exits non-zero on errors (run it with `npx tsx`)
6. Define the `ProviderGateway` interface: `(decision: CapabilityDecision & {allowed: true}, request) => Promise<…>`, with **no implementation**. Document in TSDoc that L1+ implementations are BLOCKED_BY_PROVIDER_APPROVAL.
7. Author both `policy.json` files, snapshot_date `2026-09-25`, containing:
   - `l0.analysis` and `l0.local_store`: L0, enabled
   - `l0.agent_relay_ingest`: L0, enabled (Indeed: reason cites BCP-003 local-only; Naukri: generic agent relay of user-visible content)
   - `hosted.retain_relayed_content`: L1, blocked_by_provider_approval
   - `l1.provider_job_search`, `l1.provider_job_detail`: L1, blocked_by_provider_approval
   - `l2.account_profile_read`: L2, blocked_by_provider_approval
   - `l3.account_write`: L3, blocked_by_provider_approval
   - `l4.application_submit`: L4, disabled, reason "out of scope v1"
   - `sources`: official URLs from Docs/12 only
8. Files ≤ 250 lines. No `any`. No I/O inside `src/policy` (pure functions; `now` injected).
9. Import SH-001 types only if SH-001 is already committed. Otherwise define local string-literal types in `src/policy/types.ts`. Codex reconciles them in SH-008.

**Tests (100% branch coverage of src/policy):** every decision path; staleness boundary (exact day); unknown capability; duplicate IDs rejected; malformed JSON variants; lint pass/fail cases; both shipped policy files load and lint clean against the current Docs/09; the L4 hard-deny ignores config.

**Acceptance:** run `npx vitest run tests/policy --coverage` (policy-scoped) and the full `npm run verify` green. Handover lists any adversarial observations about gate bypass.

## 4. Handover format (mandatory for every WP)

Write it to `Docs/handovers/<WP-ID>.md` **and** paste it in chat:

```text
WORK PACKAGE:
STATUS: DONE | PARTIAL | BLOCKED | BLOCKED_BY_PROVIDER_APPROVAL
FILES CREATED:
FILES MODIFIED:
IMPLEMENTATION SUMMARY:
TESTS ADDED:
TEST RESULTS: (paste summary lines + coverage table)
COMMANDS RUN:
KNOWN LIMITATIONS:
SECURITY/POLICY CHECK:
BLUEPRINT DEVIATIONS: (none | list — if any, you must have STOPPED)
REMAINING RISKS:
RECOMMENDED NEXT STEP:
COMMIT: <hash> <message>
```

## 5. Definition of Done (all WPs)

- Only owned files are changed. The commit is path-scoped with message `WP-ID: …`.
- `npm run verify` is green in every package touched. Coverage thresholds are met.
- No TODO/FIXME, no mock success paths in production code, no `any`, no disabled lint rules without an inline justification.
- Files ≤ 250 lines where practical.
- The handover file is written.
- Claude review returns PASS. "Done" is not final until then.
