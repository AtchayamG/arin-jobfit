WORK PACKAGE: WP-SH-009 — Review-2a fixes (R-5 sanitizer entity-decoded markup, R-6 dedupe coverage)
STATUS: DONE
FILES CREATED:
- Docs/handovers/WP-SH-009.md
FILES MODIFIED:
- shared/job-core/src/sanitize/text.ts
- shared/job-core/tests/sanitize/text.test.ts
- shared/job-core/tests/sanitize/adversarial.test.ts
- shared/job-core/tests/fixtures/adversarial/corpus.v1.json
- shared/job-core/src/dedupe/dedupe.ts
- shared/job-core/tests/dedupe/dedupe.test.ts

IMPLEMENTATION SUMMARY:
- R-5 (Sanitizer entity-decoded markup, security/medium):
  * Replaced single-pass stripHtml with stripHtmlTags and sanitizeHtmlAndEntities in src/sanitize/text.ts.
  * Implemented bounded multi-pass loop (max 3 passes) applying stripHtmlTags, decodeHtmlEntities, and stripForbiddenUnicode iteratively until the text stops changing.
  * Added a final post-loop cleanup pass of stripHtmlTags and stripForbiddenUnicode to ensure any tags or forbidden characters revealed by late decodes are eliminated.
  * Updated tag stripping regex to <\/?(?:[a-zA-Z]|!|\?)[^>]*> and unclosed <\/?(?:[a-zA-Z]|!|\?)[^>]*$, cleanly removing HTML tags while preserving legitimate lone '<' and '>' inequality signs (e.g., 'salary < 10 LPA', '5 > 3', 'C# & .NET').
  * Neutralized single-encoded (&lt;script&gt;alert(1)&lt;/script&gt;) and double-encoded (&amp;lt;script&amp;gt;alert(1)&amp;lt;/script&amp;gt;) script vectors, as well as entity-encoded <img> tags (&lt;img src=x onerror=alert(1)&gt;).
- R-6 (Dedupe branch coverage, low):
  * Updated areDuplicates return signature to discriminated union { isDuplicate: true; evidence: string } | { isDuplicate: false; evidence?: undefined }, eliminating redundant && check.evidence branches.
  * Replaced unreachable defensive if (!jobI) continue; and if (!jobJ) continue; runtime branches with typed non-null assertions on bounded loop indices.
  * Added test for findDuplicates sorting multiple duplicate groups deterministically by their first job_id ASC, covering the groups.sort comparator.
  * Raised src/dedupe branch coverage from 94.11% to 100.0%.

TESTS ADDED:
- shared/job-core/tests/sanitize/text.test.ts:
  * Entity-encoded script tag test ensuring no '<script' and no 'alert(1)' in output.
  * Double-encoded script tag test ensuring full neutralization.
  * Entity-encoded <img src=x onerror=alert(1)> test ensuring no '<img' in output.
  * Legitimate inequality and ampersand survival test ('C# & .NET, salary < 10 LPA, 5 > 3').
  * Entity-encoded legitimate inequality and ampersand test ('C# &amp; .NET, salary &lt; 10 LPA, 5 &gt; 3').
- shared/job-core/tests/sanitize/adversarial.test.ts:
  * Updated double-encoded entity test expectation to verify complete script and payload neutralization.
- shared/job-core/tests/fixtures/adversarial/corpus.v1.json:
  * ADV-HTM-006: Entity-encoded script tag with inner payload stripped.
  * ADV-HTM-007: Double entity-encoded script tag stripped without residual script or alert.
  * ADV-HTM-008: Entity-encoded img tag with onerror payload stripped cleanly.
  * ADV-HTM-009: Legitimate inequality operators and ampersands preserved intact.
- shared/job-core/tests/dedupe/dedupe.test.ts:
  * Test verifying deterministic sorting of multiple duplicate groups by first job_id ASC.

TEST RESULTS:
All 10 test files (144 tests) in tests/sanitize and tests/dedupe passed.
Full branch and statement coverage at 100%:

 % Coverage report from v8
----------------|---------|----------|---------|---------|-------------------
File            | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
----------------|---------|----------|---------|---------|-------------------
All files       |     100 |      100 |     100 |     100 |                   
 dedupe         |     100 |      100 |     100 |     100 |                   
  dedupe.ts     |     100 |      100 |     100 |     100 |                   
  index.ts      |       0 |        0 |       0 |       0 |                   
  jaccard.ts    |     100 |      100 |     100 |     100 |                   
  normalize.ts  |     100 |      100 |     100 |     100 |                   
  types.ts      |       0 |        0 |       0 |       0 |                   
  union-find.ts |     100 |      100 |     100 |     100 |                   
 sanitize       |     100 |      100 |     100 |     100 |                   
  index.ts      |       0 |        0 |       0 |       0 |                   
  injection.ts  |     100 |      100 |     100 |     100 |                   
  text.ts       |     100 |      100 |     100 |     100 |                   
  types.ts      |       0 |        0 |       0 |       0 |                   
  url.ts        |     100 |      100 |     100 |     100 |                   
----------------|---------|----------|---------|---------|-------------------

COMMANDS RUN:
- npx vitest run tests/sanitize tests/dedupe --coverage --coverage.include=src/sanitize/** --coverage.include=src/dedupe/**
- npx eslint src/sanitize src/dedupe tests/sanitize tests/dedupe
- npx prettier --check src/sanitize src/dedupe tests/sanitize tests/dedupe tests/fixtures/adversarial
- npx tsc --noEmit
- git status --porcelain
- git commit -m "WP-SH-009: review-2a fixes"
- git add Docs/handovers/WP-SH-009.md
- git commit -m "WP-SH-009: finalize handover"
- git rev-parse --short HEAD

KNOWN LIMITATIONS:
- Multi-pass entity decoding bounded at max 3 passes; entities encoded 4+ times will decode up to 3 passes, with any resulting tags stripped on the final pass.

SECURITY/POLICY CHECK:
- Pure functions only; no external network requests, no DOM, no disk I/O, no process spawning.
- Production file size constraints satisfied: dedupe.ts (141 lines <= 250), text.ts (203 lines <= 250).
- Clean repository isolation preserved; Codex WIP files untouched.
- 50k-char hostile input processed in ~23ms, well within the 50ms SLA.

BLUEPRINT DEVIATIONS: none
REMAINING RISKS: none
RECOMMENDED NEXT STEP: Claude review of WP-SH-009; Codex resumes WP-SH-003.
COMMIT: 956a718 (fixes commit)
