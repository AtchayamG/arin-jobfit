# Handover: WP-SH-011 — Real-world test fixes (live indeed-mcp test)

## Summary
Resolved 6 parser and preparation issues surfaced during the first live test of indeed-mcp against real-world job posting data. All 589 tests in shared/job-core pass cleanly with zero regressions.

## Fixes (Before -> After)
- Fix 1 (Extract): Inline headings and sentences were merged into one block, including metadata. Split inline headings and sentences into discrete items; filtered metadata (salary, perks, job details) from requirements. `must_have` retains `Angular, TypeScript, RxJS, REST`, `preferred` retains `Ionic, Capacitor, AWS`.
- Fix 2 (Normalize): Indian compensation formats ("18-25 LPA", "₹18L-25L") defaulted to unknown period and `compensation.raw` captured whole description. Supported LPA/Lakh/Crore/CTC and INR yearly normalization; `compensation.raw` is now the extracted snippet (18-25 LPA, <=200 chars).
- Fix 3 (Normalize): City retained modifiers (e.g., "Chennai (Hybrid)"). Stripped work-mode modifiers and parentheticals from city ("Chennai"), propagating hybrid mode to `remote_mode`.
- Fix 4 (Match): Location remote score missed synchronic city variants. Implemented city synonym mapping (Bangalore/Bengaluru, Gurgaon/Gurugram, Madras/Chennai) yielding 1.0 match score for Chennai/Hybrid.
- Fix 5 (Prepare): `buildCvNotes` only marked missing must-have skills in `do_not_claim`. Now checks every job skill (must-have and preferred) lacking profile evidence (`RxJS, REST, AWS` in `do_not_claim`).
- Fix 6 (Prepare): `buildInterviewPlan` grouped skills by requirement line. Now generates 1 topic per distinct skill with strict ordering (Must-Have -> Skill Gap -> Preferred -> Responsibility, cap 40) and honest pointers on gaps (>=7 topics).

## Files Modified & Created
- Created: `shared/job-core/tests/fixtures/jd/live-indeed-001.json`
- Created: `shared/job-core/tests/prepare/live-indeed-001.test.ts`
- Modified: `shared/job-core/src/extract/sections.ts`
- Modified: `shared/job-core/src/normalize/{compensation.ts,provider-hints.ts,job.ts,location.ts}`
- Modified: `shared/job-core/src/match/dimensions-fit.ts`
- Modified: `shared/job-core/src/prepare/{cv-notes.ts,interview.ts}`
- Modified: `shared/job-core/tests/prepare/cv-notes.test.ts`

## Verification
- Tests: 589/589 passed (including 7 new golden e2e tests in `live-indeed-001.test.ts`).
- Performance: 50k-char hostile sanitizer input < 25ms (under 50ms requirement).
- Verification: `npm run verify` passed (lint, typecheck, tests with coverage, build, schemas:check, manifest:check).
