# Work Package Assignments v1

Author: Claude (Principal Architect) · Date: 2026-09-25

Rule: Codex and AGY never own the same file in the same period. A WP may only modify the files listed under "Owns". Anything else → STOP and report.

## 1. Registry

| WP | Agent | Tier | Phase | Depends on | Summary | Status |
|---|---|---|---|---|---|---|
| WP-SH-000 | Codex | LOW | P0 | — | git init, job-core package scaffold + toolchain | **PASS (review 1)** |
| WP-SH-001 | Codex | STANDARD | P1 | SH-000 | zod contract schemas, envelope/error builders, JSON Schema export | READY after SH-000 |
| WP-SH-002 | AGY | STANDARD | P1 | SH-000 | policy/capability gate engine, policy-lint, product policy.json files | **PASS (review 1)** |
| WP-SH-003 | Codex | STANDARD | P1 | SH-001 | normalization, requirement/skill extraction, skills taxonomy v1, provider hints | **READY** |
| WP-SH-004 | AGY | STANDARD | P1 | SH-001 | untrusted-text sanitizer, injection detector, URL validator, adversarial corpus | **READY** |
| WP-SH-005 | Codex | STANDARD | P1 | SH-003 | fit-v1 matching, explain, shortlist, dedupe | planned |
| WP-SH-006 | AGY | STANDARD | P1 | SH-003 | CV-notes, interview, handoff builders + truthfulness invariant | **READY (pulled forward)** |
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

## 3B. Detailed specifications — Wave 2 (issued 2026-09-25 after review 1)

### WP-SH-003 — Normalization + requirement extraction + skills taxonomy (Codex, STANDARD)

**Owns:**
- `shared/job-core/src/normalize/**`, `src/extract/**`
- `shared/job-core/data/skills-taxonomy.v1.json`
- `tests/normalize/**`, `tests/extract/**`, `tests/fixtures/jd/**`
- `src/index.ts`, `src/schemas/envelope.ts` (R-1 only), `package.json`, `package-lock.json`, `tsup.config.ts`
- `Docs/handovers/WP-SH-003.md`

**Review-1 fixes, done first and committed separately as `WP-SH-003: review-1 fixes`:**

- **R-1:** `envelopeSchema` gets a runtime refinement:
  - `status === "error"` ⇔ `error !== null`
  - `status === "error"` ⇒ `data === null`
  - Add tests.
- **R-2:** Replace every `"latest"` in devDependencies with the caret of the installed version:
  - `@eslint/js ^10.0.1`, `@types/node ^26.6.2`, `@vitest/coverage-v8 ^5.0.1`, `eslint ^10.11.0`, `prettier ^3.9.9`, `tsup ^8.5.1`, `tsx ^4.23.15`, `typescript ^6.0.3`, `typescript-eslint ^8.70.1`, `vitest ^5.0.1`
  - Set `zod` to `^4.6.5`.
  - Run `npm install --ignore-scripts` to refresh the lockfile. `npm ci` must still pass.
- **R-3:** Every handover's `COMMIT:` line must equal `git rev-parse --short HEAD` taken after the final commit. (Review 1 found mismatched hashes in the SH-000 and SH-002 handovers.)

**Functional requirements:**

1. `normalizeJob(input: JobInput, ctx) → {job: Job, warnings: Warning[]}`.
   - `ctx` = `{provider, now: Date, jobId?: string, url: {value: string|null, isOfficial: boolean}, provenance: Provenance[]}`.
   - The URL assessment is computed by the caller (the SH-004 validator). **normalize never fetches and never validates URLs itself.**
   - Input text is assumed already sanitized (composition happens in SH-008).
   - `job_id` = `job_${crypto.randomUUID()}` unless `ctx.jobId` is given.
   - `retention_class` defaults to `standard_180d`.
2. Fingerprint:
   - Computed as `sha256:` + hex sha256 (`node:crypto`) of `NFKC-lowercase(title)|company|location_raw|whitespace-collapsed description`.
   - Deterministic; unit-tested.
3. Parsers. Each is linear-time and returns a value plus an optional `FIELD_UNPARSED` warning.
   - **experience:**
     - `5-8 years`, `5 - 10 Yrs`, `5+ years` (min 5, max null), `minimum 5 years`, `at least 3 yrs`
     - `fresher` → 0–1
     - Prefer `experience_text`, else scan the description.
   - **compensation:**
     - `₹ 12-18 Lacs P.A.` / `12-18 LPA` → INR 1,200,000–1,800,000 per year
     - `1.2 Cr` → 12,000,000
     - `Not Disclosed` → `disclosed: false`
     - `₹30,000 - ₹45,000 a month`
     - `$120,000 - $150,000 a year`
     - `$25 an hour`
     - Amounts are whole units; lakh = 1e5, crore = 1e7.
   - **remote_mode:** remote / WFH / work from home → remote; hybrid → hybrid; work from office / on-site / onsite → onsite; else unknown.
   - **employment_type:** `Full Time, Permanent` → full_time; contract; internship; part-time; temporary; else unknown.
   - **location:**
     - `raw` = input.
     - `city` = first comma segment when it is not "Remote" or "Hybrid".
     - `country` = `IN` if the raw text contains "India" or a city from a ≥ 40-entry Indian city list (including Chennai, Bengaluru/Bangalore, Mumbai, Pune, Hyderabad, Delhi/NCR, Noida, Gurugram/Gurgaon, Kolkata, Ahmedabad, Kochi, Coimbatore); explicit country names map to ISO-2; else null.
   - **posted_at:** only absolute dates (ISO, `25 Sep 2026`, `25/09/2026` read as DD/MM for provider `naukri`). Relative text (`3 days ago`, `Just posted`) → `posted_at: null`, raw kept.
4. `extractRequirements(job: Job) → Requirements`.
   - **Section detection** (case-insensitive headings): Requirements, Qualifications, Must have, Mandatory, Key Skills, Desired Candidate Profile, Nice to have, Preferred, Good to have, Bonus, Responsibilities, Roles and Responsibilities, What you'll do, Job Description.
   - Split into bullet or line items.
   - **Classification:** must vs preferred by section, then by inline cues ("must", "required", "mandatory" vs "nice to have", "preferred", "plus", "good to have").
   - **Skills:** taxonomy alias matching with symbol-safe boundaries (`C++`, `C#`, `.NET`, `Node.js`, `CI/CD`, `Go` as a whole word only).
   - `required_skills` = union of must-have skills.
   - `preferred_skills` = preferred minus required.
   - Naukri "Key Skills" tag lists count as must-have.
   - **constraints** (kinds per §6A): notice period / immediate joiner, shift, travel, relocation, work authorization, certification, education (B.E./B.Tech/MCA/MBA …).
   - **discriminatory_flags:**
     - Phrase patterns for age limits/ranges, gender-restricted hiring, religion, caste, marital status, nationality/"locals only", disability exclusion, appearance (complexion, height, "good looking").
     - Each emits a flag **and** a `POTENTIALLY_DISCRIMINATORY_REQUIREMENT` warning.
     - Flagged lines are excluded from must_have/preferred.
     - Use ≥ 30 phrase tests, including negatives such as "equal opportunity employer regardless of gender" (must NOT flag).
5. Also export `normalizeAndExtract` returning `{job` (with `required_skills`/`preferred_skills`/`responsibilities`/`qualifications` filled from the requirements), `requirements, warnings}`.
6. Taxonomy `data/skills-taxonomy.v1.json`:
   - `{version: "1", skills: [{name, aliases[], category}]}` with ≥ 300 skills.
   - Categories: language, framework, frontend, backend, mobile, cloud, devops, data, ai_ml, testing, security, database, tool, domain (banking, payments, lending, insurance, healthcare, ecommerce, logistics, telecom), methodology.
   - Tests: no alias maps to two names; names are unique; the file loads under the zod schema.
   - Import via JSON import attributes so tsup bundles it; `dist` must work without `data/`.
7. `provider-hints.ts` is the **only** file allowed to contain provider-specific idioms (Naukri: `Lacs P.A.`, `Yrs`, `Key Skills`, `Not Disclosed`; Indeed: `a year`/`a month`/`an hour`, `Job details`).

**Tests:**
- ≥ 6 synthetic but realistic JD fixtures (3 Naukri-style, 3 Indeed-style) written by you, **never copied or scraped from live portals**, with golden expected outputs.
- A parser table for each parser.
- Timing: every parser plus extraction on 50,000-char input < 50 ms (median of 5 runs).
- Coverage thresholds as configured.

**Acceptance:** `npm run verify` green; `npm ci` green; files ≤ 250 lines where practical; only owned files touched. Commits: `WP-SH-003: review-1 fixes` and `WP-SH-003: normalization and extraction`.

### WP-SH-004 — Untrusted-text sanitizer, injection detector, URL validator, adversarial corpus (AGY, STANDARD)

**Owns:**
- `shared/job-core/src/sanitize/**`, `tests/sanitize/**`, `tests/fixtures/adversarial/**`
- `src/policy/**` and `tests/policy/**` (fix R-4 only)
- `Docs/handovers/WP-SH-004.md`

**Review-1 fix, done first and committed separately as `WP-SH-004: review-1 fix`:**

- **R-4 (timezone):** `loadPolicy` throws, and `evaluate` returns `POLICY_STALE`, when `snapshot_date` is later than the UTC date. For an India-based maintainer, a policy dated "today" in IST is "tomorrow" in UTC between 00:00 and 05:30 IST, so the server would refuse to start.
  - Allow a tolerance of **+1 day** (snapshot ≤ UTC today + 1).
  - Treat age −1 as 0.
  - Anything further ahead still throws / fails closed.
  - Tests: IST 00:30 on the snapshot date; +1 day accepted; +2 days rejected.
- R-3 applies as well: the `COMMIT:` line must equal `git rev-parse --short HEAD`.

**Functional requirements:**

1. `sanitizeText(input: string, {field, maxLength}) → {ok: true, text, changed, warnings} | {ok: false, code: "INPUT_TOO_LARGE", field}`. In order:
   1. Length check on the raw input. Never silently truncate.
   2. NFKC.
   3. Remove C0/C1 controls except `
` and `	`.
   4. Remove zero-width characters (U+200B–U+200D, U+2060, U+FEFF), bidi controls (U+202A–U+202E, U+2066–U+2069) and Unicode tag characters (U+E0000–U+E007F, "ASCII smuggling").
   5. HTML → text with no DOM dependency: drop `<script>`, `<style>`, `<noscript>` and `<!-- -->` contents; strip tags; `<br>`, `<p>` and `<li>` become newlines; decode named and numeric entities (numeric entities that decode to removed characters are removed too).
   6. Normalize CRLF.
   7. Collapse 3+ blank lines to 2.
   8. Trim.
   - `changed: true` ⇒ `CONTENT_SANITIZED` warning with `field`.
2. `detectInjection(text) → {suspected: boolean, signals: string[]}` with ≥ 25 signal patterns, including:
   - override phrases ("ignore/disregard/forget previous|prior|above instructions")
   - role hijack ("you are now", "act as", "system prompt", "developer mode")
   - tool-steering ("call/use/invoke the … tool", "send an email", "forward", "upload", "delete all")
   - chat-template tokens (`<|im_start|>`, `[INST]`, `### system`, `assistant:`)
   - markdown image or link exfiltration with query strings
   - long base64 blobs (≥ 200 chars)
   - a few Hindi/Tamil override phrases
   - `suspected` ⇒ `PROMPT_INJECTION_SUSPECTED` warning.
   - Detection is advisory. It never blocks ingestion.
3. `validateSourceUrl(raw, allowlist: string[]) → {ok: true, url: string, isOfficial: boolean} | {ok: false, code: "UNSAFE_URL", reason}`:
   - WHATWG `URL` parsing; https only; no userinfo; no explicit port other than 443.
   - Hostname is not an IPv4/IPv6 literal (including decimal/octal/hex forms that `URL` normalizes), not `localhost`, not `*.local`/`*.internal`/`*.localhost`.
   - Length ≤ 2,048.
   - `isOfficial` iff the hostname equals, or is a subdomain of, an allowlist entry (exact label match, so `naukri.com.evil.io` and `evilnaukri.com` are false).
   - Punycode/IDN hosts are never official unless listed.
   - **Never fetch.**
   - Default allowlists are exported: `NAUKRI_HOSTS = ["naukri.com"]`, `INDEED_HOSTS = ["indeed.com", "indeed.co.in"]`.
4. Adversarial corpus `tests/fixtures/adversarial/corpus.v1.json`:
   - ≥ 40 cases `{id, category, input, expect}`.
   - Categories: injection-direct, injection-multilingual, unicode-smuggling, bidi, zero-width, html-script, markdown-exfil, oversize, redos-candidate, ssrf-url, idn-homograph, discriminatory-phrase (the last is data for SH-003/SEC-001).
   - All cases are driven by a table test.
5. Performance: `sanitizeText` + `detectInjection` on a 50,000-char hostile input < 50 ms (median of 5). Regexes have no nested quantifiers; add a ReDoS test using known pathological strings.
6. `src/sanitize/index.ts` exports everything. Do **not** edit `src/index.ts`; Codex wires the barrel in SH-008.

**Tests:** 100% branch coverage of `src/sanitize`; the corpus table; URL cases (including `http:`, `file:`, `javascript:`, `127.0.0.1`, `[::1]`, `169.254.169.254`, `2130706433`, `0x7f.1`, `user@naukri.com`, `naukri.com:8443`, Cyrillic homograph).

**Acceptance:** scoped tests and `npm run verify` green. Commits: `WP-SH-004: review-1 fix` and `WP-SH-004: sanitizer, injection detector, url validator`.

## 3C. WP-SH-006 — Preparation builders (AGY, STANDARD) — pulled forward 2026-09-25

This package was pulled forward while Codex is paused on its usage limit. It depends only on the **committed** schemas (`src/schemas`), not on SH-003 code.

**Owns:**
- `shared/job-core/src/prepare/**`, `tests/prepare/**`
- `Docs/handovers/WP-SH-006.md`

**Must not touch:** Codex's uncommitted SH-003 work-in-progress (`src/normalize/**`, `src/extract/**`, `data/**`, `tests/normalize/**`, `tests/extract/**`, `tests/fixtures/jd/**`, `src/index.ts`, `tsup.config.ts`). Do not import from `src/normalize` or `src/extract`. Take `Job`, `Requirements` and `Profile` (types from `src/schemas`) as inputs.

**Requirements:**

1. `src/prepare/schemas.ts` holds zod output schemas for everything below (strict; limits as stated).
2. `buildCvNotes(job, requirements, profile, profileRef)` → `{job_id, profile_ref, emphasize, gaps, do_not_claim, unassessed, truthfulness_note}`:
   - `profile_ref` = `ProfileId` or `"inline"`.
   - `emphasize`: up to 100 entries of `{requirement ≤500, requirement_kind: must_have|preferred, profile_evidence[1..5] {field_path ≤100, text ≤300}}`.
   - `gaps`: up to 100 entries of `{requirement ≤500, requirement_kind, missing_skills: SkillName[]}`.
   - `do_not_claim`: up to 100 strings of ≤200 chars, one per required skill with no evidence ("No evidence in profile for <skill>; do not claim it.").
   - `unassessed`: up to 100 strings of ≤500 chars (requirements that have no skills).
   - `truthfulness_note` is fixed text.
   - **Evidence search** per requirement skill (case-insensitive, symbol-safe word boundary, so `Go` ≠ `Google`, and `C++` and `.NET` are safe): `skills[i].name` (equality), `roles[i].title`, `roles[i].highlights[j]`, `certifications[i].name`, `education[i].qualification`, `summary_text`.
   - `field_path` uses the form `skills[2].name` or `roles[0].highlights[3]`.
   - **INVARIANT (T-08):** every `profile_evidence.text` is an exact substring of the value found at `field_path` in the profile. A snippet of ≤300 chars around the match is allowed.
3. `buildInterviewPlan(job, requirements, profile)` → `{job_id, topics[≤40] {topic ≤200, source: jd|gap, requirement_ref ≤500, question_seeds[≤5] ≤300, study_pointers[≤5] ≤300}}`:
   - Deterministic templates.
   - Order: matched must-have, then must-have gaps, then preferred, then the top 5 responsibilities.
   - Gap topics carry an honest-answer pointer ("prepare a truthful account of your exposure to <skill>").
   - **No URLs** anywhere in study pointers.
4. `buildApplicationHandoff(job)` → `{data: {official_url, url_is_official, checklist[≤15], human_only_fields}, humanAction: {reason, actions, official_url}, warnings}`:
   - `human_only_fields` is fixed: `screening_answers`, `salary_declaration`, `notice_period`, `personal_information_changes`, `final_submit`.
   - A null URL gives the checklist item "Open the listing on the official portal yourself".
   - A non-official URL gives the `URL_NOT_OFFICIAL` warning.
   - It never performs or simulates submission.
5. Pure functions: no I/O, no `any`, no console. Deterministic (same input → identical output). Files ≤ 250 lines.

**Tests (100% branch coverage of src/prepare):**
- ≥ 2 synthetic profiles and hand-built `Job`/`Requirements` objects that validate under the schemas.
- The invariant checked over ≥ 200 seeded pseudo-random profiles, using an in-repo seeded PRNG (no new dependency).
- Symbol and boundary cases.
- Handoff cases.
- Output schema validation and a determinism check.

**Verification:** run scoped tests and a scoped lint on your own paths. If full `npm run verify` fails **only** because of Codex's uncommitted work-in-progress files, report it and do not fix it. Commit only your paths: `WP-SH-006: preparation builders`.

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
