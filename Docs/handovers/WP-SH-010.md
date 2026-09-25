WORK PACKAGE: WP-SH-010 — SH-003 review fixes (R-7 punctuation skill misses, R-8 age discrimination, R-9 multi-category flags, R-10 taxonomy gaps, R-11 intro lines, coverage)
STATUS: DONE
FILES CREATED:
- shared/job-core/tests/extract/requirements.test.ts
- shared/job-core/tests/extract/sections.test.ts
- Docs/handovers/WP-SH-010.md
FILES MODIFIED:
- shared/job-core/data/skills-taxonomy.v1.json
- shared/job-core/src/extract/discrimination.ts
- shared/job-core/src/extract/requirements.ts
- shared/job-core/src/extract/sections.ts
- shared/job-core/src/extract/taxonomy.ts
- shared/job-core/tests/extract/discrimination.test.ts
- shared/job-core/tests/extract/taxonomy.test.ts
- shared/job-core/tests/normalize/parsers.test.ts

IMPLEMENTATION SUMMARY:
- R-7 (Trailing punctuation skill misses, medium):
  * Updated regex boundary in `src/extract/taxonomy.ts` to `(?<![\p{L}\p{N}+#]|\.)(?:${aliases.map((entry) => escape(entry.alias)).join("|")})(?![\p{L}\p{N}+#]|\.[\p{L}\p{N}])`.
  * Allows `. , ; : ) ] ! ?` and end-of-line to cleanly terminate skills while keeping `.NET`, `Node.js`, `C++`, `C#`, and preventing `Go` matching `Google` or property/domain matches like `Kubernetes.io` and `Java.class`.
  * Verified with all review probe strings: `"Docker, Kubernetes."`, `"Must know Go and Java."`, `"Good to have: Flutter, Go, AWS."`.
- R-8 (Age discrimination missed, medium):
  * Updated age discrimination pattern in `src/extract/discrimination.ts` to cover: `age below/under/above/over N`, `age limit N`, `max/min age`, `age N–M`, `age between N and M`, `not/no more than N years old`, `under N years old`, `below N years of age`, `born after/before YYYY`, `aged N to M`, and `young candidates only`.
  * Avoids false positives on experience requirements (e.g., `"below 5 years of experience"`).
- R-9 (Multi-category discrimination reporting, low):
  * Added and exported `detectDiscriminatoryAll(text: string): DiscriminatoryFlag[]` in `src/extract/discrimination.ts` to report all distinct categories matching a line.
  * Preserved `detectDiscriminatory(text: string): DiscriminatoryFlag | null` returning `flags[0] ?? null` for backward compatibility.
  * Updated `extractRequirements` in `src/extract/requirements.ts` to collect all returned flags up to the 50-flag cap.
- R-10 (Taxonomy gaps, low):
  * Added 9 missing skills to `data/skills-taxonomy.v1.json`: `RxJS`, `NgRx`, `Hibernate`, `PL/SQL`, `SAP ABAP`, `Salesforce`, `Appium`, `JMeter`, `Informatica`.
  * Updated existing skills with missing aliases: `Spring Boot` (`["SpringBoot"]`), `REST` (`["REST API", "RESTful", "REST APIs", "RESTful APIs"]`), `Microservices` (`["Microservice", "Microservice Architecture"]`), `Oracle` (`["Oracle Database", "Oracle DB", "Oracle SQL"]`).
  * Validated 100% alias uniqueness across all 326 skills via `taxonomySchema`.
- R-11 (Intro lines leaking into must_have, low):
  * Updated `sectionItems` in `src/extract/sections.ts` to strip markdown prefixes (`#+\s*`, `\*\*`).
  * In `classifyItem`, added an intro guard (`/^(?:we are (?:hiring|looking for|seeking)|about (?:the |our )?(?:company|role|team|us)|who we are|join our team|our company is)\b/i`). If an item matches intro phrasing and contains neither taxonomy skills nor requirement cues, it is classified as `responsibility` instead of `must`.
- Coverage:
  * Raised `src/extract` branch coverage from 83.87% to 98.48% (target ≥ 90%).
  * Raised `src/normalize` branch coverage to 91.20%.

TESTS ADDED:
- `shared/job-core/tests/extract/taxonomy.test.ts`:
  * All R-7 probe cases.
  * 19-row boundary table test for trailing punctuation (`. , ; : ) ] ! ? \n`) across symbol-bearing and standard skills.
  * False-positive rejection tests (`Google`, `foo.NET`, `..NET`, `Kubernetes.io`, `Java.class`).
- `shared/job-core/tests/extract/discrimination.test.ts`:
  * 17 age discrimination positive test cases (R-8).
  * 6 negative experience cases verifying experience constraints are not flagged as age discrimination.
  * 4 multi-category detection tests covering `detectDiscriminatoryAll` and `detectDiscriminatory` compatibility.
- `shared/job-core/tests/extract/sections.test.ts`:
  * Markdown heading stripping and same-line content parsing.
  * Naukri key skills and Indeed job details handling.
  * Heading synonym parsing (`Desired Candidate Profile`, `Bonus`, `What you'll do`, `About our team`).
  * R-11 intro line classification tests (generic intro vs intro with skills vs intro with cues).
  * `classifyItem` general rules (metadata, preferred, must, section persistence, skill presence).
- `shared/job-core/tests/extract/requirements.test.ts`:
  * Multi-category discriminatory flags extraction.
  * 50-flag cap enforcement.
  * All 7 constraint patterns (`notice_period`, `shift`, `travel`, `relocation`, `work_authorization`, `certification`, `education`).
  * Skill retention vs non-skill skipping for constraints.
  * 50-constraint cap enforcement.
  * 100-item caps for responsibilities and must_have.
  * Metadata item skipping.
  * Discrimination warning emission.
- `shared/job-core/tests/normalize/parsers.test.ts`:
  * Crore compensation units (`1 - 2 Crore`, `1.2 Cr`).
  * Inverted experience ranges (`10-5 years`).
  * Single amounts without units (`₹50,000`).
  * Inverted compensation bounds and out-of-range numbers.

TEST RESULTS:
All 8 test files (172 tests) passed.
Extract branch coverage: 98.48% (target ≥ 90%).
Normalize branch coverage: 91.20%.

 % Coverage report from v8
-------------------|---------|----------|---------|---------|-------------------
File               | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s 
-------------------|---------|----------|---------|---------|-------------------
All files          |   98.84 |     92.9 |     100 |   99.05 |                   
 extract           |     100 |    98.48 |     100 |     100 |                   
  compose.ts       |     100 |      100 |     100 |     100 |                   
  ...rimination.ts |     100 |      100 |     100 |     100 |                   
  index.ts         |       0 |        0 |       0 |       0 |                   
  requirements.ts  |     100 |      100 |     100 |     100 |                   
  sections.ts      |     100 |    96.66 |     100 |     100 | 38                
  taxonomy.ts      |     100 |      100 |     100 |     100 |                   
 normalize         |   97.74 |     91.2 |     100 |   98.18 |                   
  classify.ts      |     100 |      100 |     100 |     100 |                   
  compensation.ts  |     100 |     96.2 |     100 |     100 | 20,68-70          
  experience.ts    |   94.11 |     87.5 |     100 |     100 | 15,34-39          
  fingerprint.ts   |     100 |      100 |     100 |     100 |                   
  index.ts         |       0 |        0 |       0 |       0 |                   
  job.ts           |     100 |    93.33 |     100 |     100 | 38-39             
  location.ts      |     100 |    86.36 |     100 |     100 | 75,85-86          
  posted-at.ts     |      92 |    75.86 |     100 |   91.66 | 49-50             
  ...ider-hints.ts |     100 |      100 |     100 |     100 |                   
-------------------|---------|----------|---------|---------|-------------------

ADVERSARIAL FINDINGS:
- Trailing period lookahead: `(?![\\p{L}\\p{N}+#]|\\.[\\p{L}\\p{N}])` correctly stops skill match before sentence-ending punctuation (`.`) while preventing domain name exploitation (`Kubernetes.io`) and class file names (`Java.class`).
- Age regex boundary: requiring explicit age anchors (`years old`, `years of age`, `born after/before`, `age below/under/limit`) strictly isolates discriminatory age rules from legitimate experience phrases like `below 5 years of experience`.
- Canonical taxonomy normalization: when adding aliases that matched existing composite names (such as `REST APIs` and `Oracle Database`), refactoring canonical entries to `REST` and `Oracle` avoided NFKC alias collision while providing full synonym coverage (`REST API`, `RESTful`, `Oracle DB`, `Oracle SQL`).

COMMANDS RUN:
- npx vitest run tests/extract tests/normalize --coverage --coverage.include="src/extract/**" --coverage.include="src/normalize/**"
- npx vitest run tests/extract/performance.test.ts
- npx vitest run tests/extract/golden.test.ts
- npx eslint src/extract src/normalize tests/extract tests/normalize
- npx prettier --check src/extract src/normalize tests/extract tests/normalize data
- npx tsc --noEmit
- git add shared/job-core/data/skills-taxonomy.v1.json shared/job-core/src/extract/ shared/job-core/tests/extract/ shared/job-core/tests/normalize/
- git commit -m "WP-SH-010: SH-003 review fixes"
- git add Docs/handovers/WP-SH-010.md
- git commit -m "WP-SH-010: finalize handover"
- git rev-parse --short HEAD

KNOWN LIMITATIONS:
- Skills taxonomy contains curated enterprise stack skills; uncommon custom acronyms not in the 326 taxonomy entries will not be detected as skills.

SECURITY/POLICY CHECK:
- Pure functions only; no external network requests, no DOM, no disk I/O, no process spawning.
- All production source files ≤ 250 lines (max is `compensation.ts` at 95 lines; `sections.ts` at 69 lines, `taxonomy.ts` at 70 lines, `requirements.ts` at 63 lines, `discrimination.ts` at 47 lines).
- Clean repository isolation preserved: Codex WIP files in `src/mcp/**`, `src/pipeline/**`, `package.json`, etc. were never touched or staged.
- 50k-char performance test runs in ~10ms, well below the 50ms SLA.

BLUEPRINT DEVIATIONS: none
REMAINING RISKS: none
RECOMMENDED NEXT STEP: Claude review of WP-SH-010; Codex completes WP-SH-008.
COMMIT: 85ddbbf (fixes)
