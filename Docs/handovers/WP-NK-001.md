WORK PACKAGE: WP-NK-001 — naukri-mcp product package over stdio
STATUS: PARTIAL — blocked by concurrent shared/job-core typecheck failure
FILES CREATED: naukri-mcp package/config files; src/index.ts; src/warnings.ts; scripts/restore-sqlite-builtin.ts; tests/stdio.e2e.test.ts; tests/warnings.test.ts; tests/isolation.test.ts; docs/clients/{claude-code,codex,gemini-cli,kimi-code}.md
FILES MODIFIED: naukri-mcp/README.md
IMPLEMENTATION SUMMARY: Added aliased job-core consumption, bundled stdio executable, warning filter, local store/policy composition, CLI flags, policy lint, docs, and end-to-end coverage. Installed dev versions: @eslint/js 10.0.1; @modelcontextprotocol/client 2.1.0; @types/node 26.6.2; @vitest/coverage-v8 5.0.2; eslint 10.11.0; prettier 3.9.9; tsup 8.5.1; tsx 4.23.15; typescript-eslint 8.70.1; typescript 6.0.3; vitest 5.0.2. Node v22.22.3; npm 10.9.8.
TESTS ADDED: stdio tools/policy/ingest/hostile-JD/inline-profile/handoff/purge flow; copied-bundle --version; SQLite-versus-deprecation warning child process; provider isolation scan.
TEST RESULTS: Targeted typecheck/build/tests passed before the final verify; 3 test files, 4 tests passed. Full verify blocked at typecheck: ../shared/job-core/src/match/fit.ts:54 — Cannot find name 'MatchDimension'.
COMMANDS RUN: shared/job-core npm ci; naukri-mcp npm install --ignore-scripts; npm ci; npm run format; npm run typecheck; npm run build; npm run test -- --reporter=dot; npm run verify; npm audit --omit=dev; git status --porcelain; git rev-parse --short HEAD.
KNOWN LIMITATIONS: Final verification and requested product commit are pending resolution of the shared type error. Working tree contains unrelated shared/* in-progress changes; none were staged.
SECURITY/POLICY CHECK: Production dependency list is empty; audit found 0 vulnerabilities. No provider retrieval or network code added. Policy JSON content was left unchanged. Warnings go to stderr; SQLite ExperimentalWarning is filtered.
BLUEPRINT DEVIATIONS: esbuild 8.5.1 rewrites node:sqlite to sqlite; build runs a narrow post-bundle correction restoring the Node builtin specifier.
REMAINING RISKS: Verify and clean-tree acceptance remain unconfirmed; shared/job-core in-progress edits must be stabilized first.
RECOMMENDED NEXT STEP: After shared/job-core changes are committed/stable, rerun npm ci and npm run verify in naukri-mcp, then stage only naukri-mcp-owned paths and this handover.
COMMIT: Not committed — stopped before final commit; HEAD d862af3.
