# Handover: WP-SH-012 — Indian digit grouping, 2dp rounding, F-1

**WORK PACKAGE**: WP-SH-012
**STATUS**: Complete

## FIX 1: DEFECT-001 (Indian & Western digit grouping)
- "₹16,00,000 - ₹24,00,000 a year": before: min 16, max 24 → after: INR 1,600,000–2,400,000 year
- "₹ 1,20,00,000 per annum": before: min 1, max 1 → after: INR 12,000,000 year
- "12,50,000 - 18,00,000 P.A.": before: min 12, max 18 → after: INR 1,250,000–1,800,000 year
- "INR 8,50,000": before: unparsed/8 → after: INR 850,000 unknown period
- "$1,600,000 a year" / "1,600,000": 1,600,000 (Western grouping preserved)
- "₹30,000 - ₹45,000 a month": INR 30,000–45,000 month (unchanged)
- Malformed ("12,34", "12,34,56", "16,00,00", "1,2,3"): rejected with FIELD_UNPARSED
- Strict linear-time validation (< 50 ms for 50k char). Flipped QA-002 DEFECT-001 test to passing.

## FIX 2: 2dp Dimension & Match Rounding
- Applied half-up 2dp rounding (`round2dp`) to every `MatchDimension.score`, `confidence`, and `fit_score`.
- Preserved dimension weights untouched. Added unit test in `fit.test.ts`.

## FIX 3: F-1 Pre-Handler Schema Rejections
- Inspecting `@modelcontextprotocol/server` revealed no supported hook to intercept schema validation failures before handler dispatch without weakening advertised schemas in `tools/list`.
- Documented SDK limitation in `shared/contracts/README.md`.
- Added test in `tests/mcp/schema-rejection.test.ts` documenting plain text `isError: true` without envelope/audit.

## TEST RESULTS
- shared/job-core: 643 passed (73 test files), 0 failures. `npm run verify` passed cleanly.
- indeed-mcp: 24 passed (4 test files).

## BLUEPRINT DEVIATIONS
- F-1: Pre-handler schema rejections return SDK text error with `isError: true`; no envelope/audit.
