# Handover

## Current state (2026-09-25, after Review 1)

job-core has contract schemas, envelope builders, JSON Schema export and the fail-closed policy engine; both product policy.json files ship with L0 only. All verified independently by the Architect on a clean checkout. No portal approvals exist.

## Pending owner decisions
BCP-001..004 (Doc 14 §5). Needed before WP-SH-008.

## Next actors (parallel)
- Codex — WP-SH-003 (review-1 fixes R-1/R-2 first, then normalization + extraction + taxonomy).
- AGY — WP-SH-004 (R-4 policy timezone fix first, then sanitizer/injection/URL/corpus).
Return both handovers to Claude for Review 2.

## Developer protocol
Doc 16 §2 ownership, path-scoped commits, `Docs/handovers/<WP-ID>.md`, COMMIT line = `git rev-parse --short HEAD`.
