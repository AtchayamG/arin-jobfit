# Implementation Changelog

Maintained by the Architect. Newest first. One entry per accepted work package or architecture cycle.

| Date | Cycle / WP | Result | Summary |
|---|---|---|---|
| 2026-09-25 | WP-SH-009 review-2a fixes (AGY) | PASS | Architect probe: entity-encoded and double-encoded `<script>` and `<img onerror>` payloads now come out empty. Legitimate "C# & .NET, salary < 10 LPA, 5 > 3" is preserved. The sanitize and dedupe scoped suites pass 144 tests at 100% coverage. R-5 and R-6 closed. |
| 2026-09-25 | Review 2a: WP-SH-004 / 005 / 006 / 007 (AGY) | PASS ×4 (with follow-ups) | Clean-checkout run at 734e636 (excluding Codex SH-003 WIP): verify green, 49 files / 377 tests, coverage 99.7% stmts / 98.5% branches; policy, prepare, sanitize, store 100%. Architect probes: URL validator rejected every IP form, internal host, backslash and whitespace case, with exact-label allowlist matching. Follow-ups: R-5 (M) sanitizeText decodes entity-encoded tags into literal `<script>` markup; tags must be re-stripped after entity decoding. R-6 (L) src/dedupe branch coverage 94.1% < 95% target. |
| 2026-09-25 | Review 1: WP-SH-000 / 001 / 002 (Claude) | PASS ×3 (with follow-ups) | Independent clean-checkout run: `npm ci` + `verify` green (91 tests; policy 100% branch), `schemas:check` exit 0, policy-lint PASS both products, audit 0. Follow-ups carried into Wave 2: R-1 envelope status invariants, R-2 pin devDependencies (were "latest"), R-3 handover hashes must match git, R-4 policy snapshot +1 day tolerance (IST/UTC). Codex's ProfileInput limits accepted. |
| 2026-09-25 | Doc 17 §6A addendum (Claude) | ISSUED | Added authoritative field shapes/limits for Job, JobSummary, Requirements, stored Profile and MatchResult, in answer to a WP-SH-001 clarification query from Codex. |
| 2026-09-25 | Architecture audit (Claude) | ISSUED | Docs 14–18 created. ADR-001..009 recorded. BCP-001..004 raised (pending owner). Folder policy amended for `shared/job-core` and `Docs/handovers/`. AGENTS.md rule 10 amended (ADR-008). WP-SH-000 released. |
