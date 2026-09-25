WORK PACKAGE: WP-SH-008 — MCP tool-kit on SDK v2
STATUS: DONE
FILES CREATED:
- shared/contracts/tool-manifest.v1.json, shared/job-core/scripts/export-manifest.ts
- shared/job-core/src/mcp/** (catalog, handlers, server, stdio, wrapper, types, portable)
- shared/job-core/src/pipeline/** (ingest pipeline)
- shared/job-core/tests/mcp/**, shared/job-core/tests/pipeline/**
- Docs/handovers/WP-SH-008.md
FILES MODIFIED:
- shared/contracts/README.md, shared/job-core/package.json, shared/job-core/package-lock.json
- shared/job-core/src/index.ts, shared/job-core/src/schemas/envelope.ts
IMPLEMENTATION SUMMARY:
- 22 MCP tools registered via @modelcontextprotocol/server (^2.1.0) and tested with @modelcontextprotocol/client (^2.1.0).
- Strict handler wrapper: 256KB request cap, policy check, domain logic, audit log, stderr-only logging.
- Ingestion pipeline with sanitization, injection detection, URL validation, and dedupe checks.
- Exported tool manifest in shared/contracts/tool-manifest.v1.json passing Portable Schema Subset checks.
TESTS ADDED:
- tests/mcp/roundtrip.test.ts, list.test.ts, security.test.ts, security-content.test.ts
- tests/mcp/manifest.test.ts, stdio.test.ts, stdio-era.test.ts, tests/pipeline/ingest.test.ts
TEST RESULTS:
- 582 tests passed across 18 test files; verify green (lint, types, coverage, schemas, manifest, build).
- Coverage: src/mcp (96.15% stmts, 86.12% branch); src/pipeline (100% stmts, 97.05% branch).
COMMANDS RUN:
- npx prettier --write tests/mcp/roundtrip.test.ts
- npm run manifest:export
- npm run verify
- npm audit --omit=dev
- git add <paths> && git commit -m "WP-SH-008: MCP tool-kit (implemented by Codex, finalized by AGY)"
KNOWN LIMITATIONS:
- In-memory store and mock stdio transports used for test verification; stdio process verified in NK-001/IN-001.
SECURITY/POLICY CHECK:
- Policy evaluated per call; audit table contains no raw text/PII; stdout purity enforced (stderr logger only).
- Production source files <= 250 lines; 0 npm audit production vulnerabilities.
BLUEPRINT DEVIATIONS: Implemented by Codex; finalized by AGY; no logic changes
REMAINING RISKS: none
RECOMMENDED NEXT STEP: Claude architectural review of WP-SH-008; Wave 2 complete.
COMMIT: f403b48
