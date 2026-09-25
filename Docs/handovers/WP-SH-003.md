WORK PACKAGE: WP-SH-003 — Normalization, requirement extraction, and skills taxonomy
STATUS: PARTIAL (implementation complete; Claude review pending)
FILES CREATED:
- shared/job-core/data/skills-taxonomy.v1.json
- shared/job-core/src/normalize/{classify,compensation,experience,fingerprint,index,job,location,posted-at,provider-hints}.ts
- shared/job-core/src/extract/{compose,discrimination,index,requirements,sections,taxonomy}.ts
- shared/job-core/tests/normalize/{parsers,review-envelope}.test.ts
- shared/job-core/tests/extract/{discrimination,golden,performance,taxonomy}.test.ts
- shared/job-core/tests/fixtures/jd/{naukri-1,naukri-2,naukri-3,indeed-1,indeed-2,indeed-3}.json
- Docs/handovers/WP-SH-003.md
FILES MODIFIED:
- shared/job-core/src/index.ts
- shared/job-core/src/schemas/envelope.ts (R-1 commit only)
- shared/job-core/package.json and package-lock.json (R-2 commit only)
- shared/job-core/tsup.config.ts
IMPLEMENTATION SUMMARY:
- R-1 enforces envelope status/error/data consistency at runtime. R-2 pins the specified dependency ranges; both are in commit 3dcdb91.
- Implemented normalizeJob, deterministic SHA-256 fingerprints, experience/compensation/location/remote/employment/date parsers, requirement and constraint extraction, discriminatory-line exclusion and warnings, and normalizeAndExtract.
- Added 317 unique taxonomy skills with aliases and categories; JSON import attributes bundle the taxonomy into the ESM output. Provider-specific idioms are centralized in provider-hints.ts.
- No other package dependencies were added. tsup's DTS build specifies Node types for the node:crypto import.
TESTS ADDED:
- Six original synthetic JD golden fixtures (three per provider style), parser tables, taxonomy integrity, 33 positive and 12 negative discriminatory-phrase cases, 50,000-character median timing checks, and R-1 invalid-envelope tests.
TEST RESULTS:
- npm ci: pass. npm run verify: pass (54 files, 489 tests; lint, typecheck, coverage, build, and schema drift all pass).
- Coverage: statements 99.36% (1415/1424); branches 96.33% (1052/1092); functions 100% (216/216); lines 99.77% (1328/1331). src/normalize branches 89.81%; src/extract branches 83.33%; overall configured thresholds pass.
- Isolated dist/index.js copy loaded with no adjacent data directory; C++ and Node.js taxonomy matching passed.
- npm audit --omit=dev: 0 vulnerabilities.
COMMANDS RUN:
- npm ci; scoped npx prettier --write; npm run verify; npm audit --omit=dev; isolated bundle import; git status --porcelain; git rev-parse --short HEAD.
KNOWN LIMITATIONS:
- Heuristic extraction does not infer implicit skills or parse relative posting dates; unrecognized values remain unknown/null with warnings where applicable.
SECURITY/POLICY CHECK:
- No network or filesystem reads in runtime normalization/extraction; no console, any, TODO, or FIXME. Discriminatory lines are flagged and excluded from requirements. No portal API or account action. Only owned paths are staged; AGY and Architect files are untouched.
BLUEPRINT DEVIATIONS:
- R-3's literal requirement to put the final commit's hash inside a file in that same commit is self-referential: changing the file changes the commit hash. This committed handover uses symbolic HEAD; the exact resolved final hash is supplied in chat after commit. No functional blueprint deviation.
REMAINING RISKS:
- Claude review is pending; requirement extraction remains heuristic and requires review against future real-world, user-supplied text.
RECOMMENDED NEXT STEP: Claude review of WP-SH-003 and integration in WP-SH-008.
COMMIT: HEAD WP-SH-003: normalization and extraction
