WORK PACKAGE: WP-IN-001
STATUS: DONE
FILES CREATED:
- indeed-mcp/{package.json,package-lock.json,tsconfig.json,tsup.config.ts,vitest.config.ts,eslint.config.js,.prettierrc.json,.prettierignore}
- indeed-mcp/src/index.ts
- indeed-mcp/tests/{fixtures.ts,stdio.e2e.test.ts}
- indeed-mcp/docs/clients/{claude-code.md,codex.md,gemini-cli.md,kimi-code.md}
FILES MODIFIED: indeed-mcp/README.md
IMPLEMENTATION SUMMARY: Packaged standalone indeed-mcp ESM stdio server bundling @jpm/job-core. Configured CLI flags (--version/--help/exit 2 on unknown), node:sqlite warning suppression, in-memory policy loader, data dir resolution (INDEED_MCP_DATA_DIR), graceful shutdown, BCP-003 agent-relay support, comprehensive documentation and client configs.
TESTS ADDED: indeed-mcp/tests/stdio.e2e.test.ts (14 tests: tools/list 22 tools, L1+ blocked, jobs_ingest untrusted warning, injection detection, profile match, application handoff, data_purge two-step flow, agent-relay ingestion, CLI flags, standalone execution without node_modules, product isolation).
TEST RESULTS: 14/14 passed in indeed-mcp; 582/582 passed in shared/job-core. npm audit: 0 vulnerabilities.
COMMANDS RUN: npm ci, npm run verify (lint, typecheck, policy:lint, build, test), npm audit --omit=dev.
KNOWN LIMITATIONS: Client configs marked UNVERIFIED pending WP-CMP-001.
SECURITY/POLICY CHECK: policy:lint passed (PASS against Docs/09). Capability gate fail-closed verified. Product isolation test verified no reference to naukri or NAUKRI_MCP_DATA_DIR.
ADVERSARIAL FINDINGS: esbuild strips "node:" from "node:sqlite" on platform node; resolved via tsup onSuccess rewriting "sqlite" to "node:sqlite". Profile schema requires strict fields (label, total_experience_years, preferences).
BLUEPRINT DEVIATIONS: none
REMAINING RISKS: Client compatibility variations across MCP client implementations (to be verified in WP-CMP-001).
RECOMMENDED NEXT STEP: WP-QA-001 (Codex) / WP-SEC-001 (AGY).
COMMIT: 78243dd WP-IN-001: indeed-mcp product over stdio

## R-1 Fix (R-12)
WORK PACKAGE: WP-IN-001-R1
STATUS: DONE
FILES MODIFIED: indeed-mcp/src/index.ts, indeed-mcp/src/warnings.ts, indeed-mcp/tests/stdio.e2e.test.ts, Docs/handovers/WP-IN-001.md
IMPLEMENTATION SUMMARY: Added process.removeAllListeners("warning") at start of installWarningFilter in src/warnings.ts. Forwarded non-SQLite warnings to stderr.
TESTS ADDED: Deterministic warning filter test in tests/stdio.e2e.test.ts verifying suppression of SQLite ExperimentalWarning and passthrough of DeprecationWarning.
TEST RESULTS: 15/15 passed in indeed-mcp on Node v24.18.0. npm run verify 100% green.
COMMIT: 91ff2ed WP-IN-001: R-12 warning filter fix

