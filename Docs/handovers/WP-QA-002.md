# Handover: WP-QA-002 — Automated real-world scenario suite

## Summary
Created a 24-scenario end-to-end automated test suite for `shared/job-core` and 3 stdio MCP client scenarios in `indeed-mcp`. Discovered 1 genuine parser defect recorded as an expected-fail test (`it.fails`).

## Fixtures & Test Matrix
- **12 Synthetic JDs**: 4 Naukri (Java backend, Lead Angular, Fresher Python, Principal Mobile), 4 Indeed (Intern, Backend Java/Cloud, Mobile Lead, Fullstack), 4 Edge/Adversarial (inline headings, HTML/emoji, discriminatory age+gender, prompt-injection+zero-width).
- **3 Synthetic Profiles**: Fresher (0-1y), Mid Java (5y), Senior Mobile Lead (13y).
- **24 Test Pairs**: Evaluated against golden expectations across normalization, fit scoring, CV notes truthfulness (exact quote check), interview prep topics, and handoff (`final_submit` enforcement).
- **3 Stdio E2E MCP Runs**: Ingest -> Profile Upsert -> Compare -> CV Notes -> Interview -> Handoff via JSON-RPC.

## Defects Discovered
- **DEFECT-001 (Severity: High)**: Indian numbering comma grouping (`₹16,00,000 - ₹24,00,000 a year`) parses as `min: 16, max: 24` instead of `min: 1600000, max: 2400000`.
  - Cause: `shared/job-core/src/normalize/compensation.ts` regex `(?:\d{1,3}(?:,\d{3})*|\d{1,9})` assumes 3-digit comma intervals and truncates after first comma.
  - Recorded as `it.fails("DEFECT-001: ...")` in `shared/job-core/tests/scenarios/scenarios.test.ts`.

## Files Created
- `shared/job-core/tests/scenarios/{types.ts,fixtures-naukri.ts,fixtures-indeed.ts,fixtures-edge.ts,fixtures-profiles.ts,pairs.ts,fixtures.ts,scenarios.test.ts}`
- `indeed-mcp/tests/scenarios/{fixtures.ts,stdio-scenarios.test.ts}`
- `Docs/handovers/WP-QA-002.md`

## Verification
- `shared/job-core`: 633 passed | 1 expected fail (634 tests in 72 test files). Lint & typecheck clean. All files <= 232 lines.
- `indeed-mcp`: 24/24 passed (including 3 new stdio E2E scenarios). Lint & typecheck clean. All test files <= 249 lines.
