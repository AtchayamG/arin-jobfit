WORK PACKAGE: WP-SH-005 — fit-v1 matching, explain, shortlist, dedupe
STATUS: DONE
FILES CREATED:
- shared/job-core/src/match/types.ts
- shared/job-core/src/match/matcher.ts
- shared/job-core/src/match/dimensions-skills.ts
- shared/job-core/src/match/dimensions-fit.ts
- shared/job-core/src/match/dimensions.ts
- shared/job-core/src/match/fit.ts
- shared/job-core/src/match/explain.ts
- shared/job-core/src/match/shortlist.ts
- shared/job-core/src/match/index.ts
- shared/job-core/src/dedupe/types.ts
- shared/job-core/src/dedupe/normalize.ts
- shared/job-core/src/dedupe/jaccard.ts
- shared/job-core/src/dedupe/union-find.ts
- shared/job-core/src/dedupe/dedupe.ts
- shared/job-core/src/dedupe/index.ts
- shared/job-core/tests/match/fixtures.ts
- shared/job-core/tests/match/dimensions-skills.test.ts
- shared/job-core/tests/match/dimensions-fit.test.ts
- shared/job-core/tests/match/fit.test.ts
- shared/job-core/tests/match/symbol-safe.test.ts
- shared/job-core/tests/match/invariant.test.ts
- shared/job-core/tests/match/explain.test.ts
- shared/job-core/tests/match/shortlist.test.ts
- shared/job-core/tests/match/barrel.test.ts
- shared/job-core/tests/dedupe/normalize.test.ts
- shared/job-core/tests/dedupe/dedupe.test.ts
- shared/job-core/tests/dedupe/perf.test.ts
- shared/job-core/tests/dedupe/barrel.test.ts
- Docs/handovers/WP-SH-005.md
FILES MODIFIED:
- none (clean isolation preserved; Codex WIP untouched)

IMPLEMENTATION SUMMARY:
- Step 1 (Types & Matching Primitives): Defined ComputeFitOptions, ComputeFitOutput, ExplainMatchResult, ShortlistOptions, ShortlistResult in src/match/types.ts. Implemented symbol-safe regex matching in src/match/matcher.ts (Go != Google/Golang/MongoDB/Django, C++, C#, .NET, Node.js) with boundary-aware escape sequences.
- Step 2 (Dimension Calculators): Implemented all 7 fit-v1 scoring dimensions across src/match/dimensions-skills.ts and src/match/dimensions-fit.ts:
  * must_have_skills (base weight 0.35): matched / total; null if requirements empty.
  * experience (base weight 0.20): 1.0 if within range or exceeds min by <= 3 yrs, 0.75 if exceeds min by > 3 yrs, 0.50 if within 1 yr below min, 0.0 if > 1 yr below; null if JD has no min experience.
  * preferred_skills (base weight 0.10): matched / total; null if preferred skills empty.
  * seniority (base weight 0.10): exact/within 1 level = 1.0, 2 levels = 0.5, >= 3 levels = 0.0; null if unknown.
  * location_remote (base weight 0.10): exact remote mode match = 1.0; hybrid-with-common-city = 1.0; onsite/hybrid city mismatch = 0.0; null if unknown.
  * employment_type (base weight 0.05): exact match = 1.0, else 0.0; null if unstated.
  * domain (base weight 0.10): overlap count / job domains count; null if unstated.
- Step 3 (Fit Aggregation & Normalization): Implemented computeFit in src/match/fit.ts. Handles missing dimensions by re-normalizing weights (weight / total_known_weight). Calculates confidence as sum of known base weights. Emits LOW_CONFIDENCE warning if confidence < 0.60. Deal-breakers are detected against job title, description, and requirements using word boundaries; if present, fit_score is capped at 0.30 and blockers populated.
- Step 4 (Explain Match): Implemented explainMatch in src/match/explain.ts. Pure transformer generating summary_facts, per-dimension analysis with weights and reasons, and the mandatory non-prediction disclaimer ("Decision support only; not a prediction of hiring outcome.").
- Step 5 (Deterministic Shortlist): Implemented shortlist in src/match/shortlist.ts. Computes fit for all candidate jobs, applies optional min_fit filter, sorts deterministically by fit_score DESC, job_id ASC, clamps limit <= 50, and extracts up to 3 top_reasons from highest-scoring dimensions.
- Step 6 (Deduplication Engine): Implemented high-performance duplicate detection in src/dedupe/:
  * normalize.ts: normalizeCompany strips corporate suffixes (Inc, LLC, Corp, Ltd, Pvt, etc.) and non-alphanumeric chars; extractTitleTokens strips punctuation and stopwords; extractDescriptionShingles creates 5-word shingles.
  * jaccard.ts: Set Jaccard calculation and pre-tokenization caching.
  * union-find.ts: UnionFind with path compression and rank optimization for transitive clustering.
  * dedupe.ts: areDuplicates checks identical fingerprint OR (normalized company match AND title Jaccard >= 0.8 AND description 5-shingle Jaccard >= 0.85). findDuplicates clusters jobs into DuplicateGroups sorted by job_id ASC. checkIngestDuplicates checks a new job against existing jobs and emits DUPLICATE_SUSPECTED warning.

ADVERSARIAL FINDINGS:
1. Keyword Stuffing & Profile Highlights vs Exact Word Boundaries:
   - Candidates or untrusted input could attempt to inflate skill match scores by embedding keywords inside longer words (e.g., "Google" matching "Go", "Django" matching "Go", "asp.net" matching "C", "Node.js" matching "JS").
   - We engineered buildSkillRegex and buildWordBoundaryRegex in src/match/matcher.ts with custom symbol-aware boundaries. Words starting/ending with word characters (\w) use \b; special symbols like C++, C#, .NET, Node.js escape meta-characters and enforce non-word / end-of-string boundaries:
     (?<![a-zA-Z0-9_])Go(?![a-zA-Z0-9_])
   - Thoroughly verified in tests/match/symbol-safe.test.ts: "Go" matches "Go Developer" and "Golang / Go", but NEVER matches "Google", "MongoDB", or "Django".
2. Deal-Breaker Evasion via Whitespace, Casing, and Synonyms:
   - Attackers or ill-fitting listings could attempt to bypass deal-breakers through whitespace variations, capitalization, or punctuation embedding (e.g., "no sponsorship", "Relocation required", "On-site only").
   - Deal-breaker matching strips punctuation, collapses internal whitespace, and uses boundary-aware regex to search across job title, description, and requirements notes. When triggered, the overall score is strictly capped at 0.30 regardless of skill or experience matches.
3. Discriminatory Flag Invariance (T-09):
   - Requirements extraction may detect discriminatory criteria (e.g., age, gender, race, religion preferences). Under no circumstances should discriminatory flags or biased text alter candidate scoring, whether positively or negatively.
   - Verified by tests/match/invariant.test.ts: two identical jobs — one with discriminatory_flags populated and offensive text, and one pristine — produce byte-for-byte identical MatchResult scores and dimension values.
4. Jaccard Token Collision & Performance DoS:
   - Comparing 50 jobs with large descriptions (20,000+ chars each) naively using O(N^2) pairwise string operations could cause high CPU consumption or event-loop blocking.
   - Pre-tokenization and pre-shingling (prepareJob in src/dedupe/jaccard.ts) computes 5-word shingles once per job. Benchmark test tests/dedupe/perf.test.ts verifies that 50 jobs x 20,000 chars process in ~110 ms, well below the 500 ms SLA requirement.

TEST RESULTS:
All 12 test files (76 tests) in tests/match and tests/dedupe passed.
Branch coverage: 95.86% (threshold >= 95% met).
Statement coverage: 99.46%.
Function coverage: 100%.
Line coverage: 100%.

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   99.46 |    95.86 |     100 |     100 |                   
 dedupe            |   98.43 |    94.11 |     100 |     100 |                   
  dedupe.ts        |   96.61 |    89.18 |     100 |     100 | 70-73,106         
  index.ts         |       0 |        0 |       0 |       0 |                   
  jaccard.ts       |     100 |      100 |     100 |     100 |                   
  normalize.ts     |     100 |      100 |     100 |     100 |                   
  types.ts         |       0 |        0 |       0 |       0 |                   
  union-find.ts    |     100 |      100 |     100 |     100 |                   
 match             |     100 |    96.46 |     100 |     100 |                   
  ...nsions-fit.ts |     100 |       99 |     100 |     100 | 72                
  ...ons-skills.ts |     100 |    93.33 |     100 |     100 | 128-129           
  dimensions.ts    |       0 |        0 |       0 |       0 |                   
  explain.ts       |     100 |      100 |     100 |     100 |                   
  fit.ts           |     100 |    95.83 |     100 |     100 | 84                
  index.ts         |       0 |        0 |       0 |       0 |                   
  matcher.ts       |     100 |      100 |     100 |     100 |                   
  shortlist.ts     |     100 |    90.62 |     100 |     100 | 63-70             
  types.ts         |       0 |        0 |       0 |       0 |                   
-------------------|---------|----------|---------|---------|-------------------

COMMANDS RUN:
- npx.cmd vitest run --coverage.enabled --coverage.reporter=text --coverage.include="src/match/**" --coverage.include="src/dedupe/**" tests/match tests/dedupe
- npx.cmd eslint src/match src/dedupe tests/match tests/dedupe
- npx.cmd prettier --check "src/match/**/*.ts" "src/dedupe/**/*.ts" "tests/match/**/*.ts" "tests/dedupe/**/*.ts"
- npx.cmd tsc --noEmit
- git add shared/job-core/src/match shared/job-core/src/dedupe shared/job-core/tests/match shared/job-core/tests/dedupe
- git commit -m "WP-SH-005: matching and dedupe"
- git add Docs/handovers/WP-SH-005.md
- git commit -m "WP-SH-005: finalize handover"
- git rev-parse --short HEAD

KNOWN LIMITATIONS:
- Shingle-based description similarity uses 5-word shingles; descriptions with fewer than 5 words fall back to full token set comparison.
- Skill synonyms are matched directly against extracted skills; semantic taxonomy expansion (e.g. "ReactJS" <-> "React") is handled at the extract/taxonomy stage prior to computeFit.

SECURITY/POLICY CHECK:
- Pure functions only: no network requests, no filesystem I/O, no database access, no process spawning.
- All production source files <= 250 lines (dedupe.ts: 142, index.ts: 15, jaccard.ts: 49, normalize.ts: 76, types.ts: 24, union-find.ts: 72, dimensions-fit.ts: 209, dimensions-skills.ts: 131, dimensions.ts: 16, explain.ts: 41, fit.ts: 125, matcher.ts: 68, shortlist.ts: 98, types.ts: 46).
- Zero console logging in production modules.
- Non-discrimination invariant T-09 verified by automated invariant test.
- Mandatory disclaimer ("Decision support only; not a prediction of hiring outcome.") hardcoded in explainMatch.

BLUEPRINT DEVIATIONS: none
REMAINING RISKS: none
RECOMMENDED NEXT STEP: Claude architecture review of WP-SH-005; Codex completes WP-SH-003.
COMMIT: c303187 WP-SH-005: matching and dedupe
