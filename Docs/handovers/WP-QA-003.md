# Handover: WP-QA-003 — Full-Usage E2E Test of Published npm Packages

**WORK PACKAGE**: WP-QA-003
**ROLE**: Senior Developer + Adversarial Tester (AGY)
**STATUS**: Complete

## What Was Tested
- Registry packages `arin-jobfit-nk@0.1.0` and `arin-jobfit-id@0.1.0` spawned exclusively via `npx -y` over stdio.
- All 22 tools per edition (44 tool evaluations total) exercising full candidate journey: profile CRUD, normalization, ingestion (6 JDs), retrieval, search, requirements extraction, comparison, match explanation, shortlisting, deduplication, CV notes, interview prep, handoff, export, deletion, and 2-step token-authenticated purge.
- CLI flags (`--version`, `--help`, unknown arguments), cold/warm launch latency, tool p50/max latencies.
- Invariants: evidence substring citations, gap listings, discrimination exclusions, prompt injection neutralization, Indian salary normalization, duplicate detection, L1+ policy gating, human application handoff, and zero outbound network.
- Disk persistence across restarts, error paths (missing arguments, unknown IDs, oversized inputs >50k chars), and concurrent cross-product isolation.

## Results Summary
- **Tool Coverage**: 22/22 PASS on `arin-jobfit-nk`, 22/22 PASS on `arin-jobfit-id` (44/44 total).
- **CLI Checks**: `--version` PASS (`0.1.0`), `--help` PASS, unknown arg PASS (exit 2).
- **Spawn Latency**:
  - `arin-jobfit-nk`: cold 1225ms, warm 1246ms.
  - `arin-jobfit-id`: cold 1240ms, warm 1172ms.
- **Tool Latencies**:
  - `arin-jobfit-nk`: p50 = 4ms, max = 212ms.
  - `arin-jobfit-id`: p50 = 4ms, max = 187ms.
- **Cross-Product Isolation**: PASS (independent storage, zero cross-store leakage).
- **Report**: Generated at `qa/released/REPORT-0.1.0.md`.

## Defects Found
- None (0 product defects discovered).
- Documented limitations noted: F-1 SDK schema pre-handler validation throws MCP error frames; Doc 17 §8 safely rejects inputs >50,000 characters.

## Notes for Next Agent
- To rerun suite at any time: `cd qa/released && npm run e2e`.
- Harness has zero dependencies on local source code or workspace builds.
