# Adversarial Security Review Report: SEC-001B

**Scope**: `naukri-mcp` (Local stdio MCP deployment) + Cross-product isolation with `indeed-mcp`  
**Date**: 2026-09-26  
**Reviewer**: AGY (Senior Developer / Adversarial Reviewer)  
**Status**: COMPLETE — ALL GATES GREEN  

---

## 1. Executive Summary

An adversarial security review and automated real-world scenario verification of `naukri-mcp` was conducted against the threats applicable to product packaging and stdio deployment defined in `Docs/18_THREAT_MODEL_v1.md`, porting the verification methodology established in `SEC-001A` and `QA-002`.

All security vectors were validated with executable automated test suites under `naukri-mcp/tests/security/` (10 tests) and `naukri-mcp/tests/scenarios/` (3 tests). Zero critical or high vulnerabilities were found. Cross-product isolation between `naukri-mcp` and `indeed-mcp` was proven at runtime using a shared parent directory.

---

## 2. Threat & Scenario Verification Matrix

| ID | Category / Scope | Adversarial Probe / Scenario Evaluated | Result | Severity | Test Suite Path | Findings & Mitigations |
|---|---|---|---|---|---|---|
| **T-04** | Unauthorized Elevation & Network Isolation | Static import scan for network modules (`http`, `net`, `fetch`) and runtime rejection of unregistered `provider_*` tools | **PASS** | Critical | `naukri-mcp/tests/security/stdio-network.test.ts` | Zero network module imports; unregistered tools (`provider_search`, `provider_naukri_apply`) fail closed over stdio. |
| **T-10** | Log / Audit PII Leakage | Full workflow execution inspecting captured stderr and SQLite `audit` table for candidate PII and secret JD text | **PASS** | High | `naukri-mcp/tests/security/stdio-environment.test.ts` | Zero candidate PII (phone, email) or raw JD text in stderr or sqlite `audit` rows; 16-hex salted hashes verified. |
| **T-11** | Stdout Protocol Purity | Injecting malformed frames, truncated JSON, tool errors, and unknown methods over stdio | **PASS** | High | `naukri-mcp/tests/security/stdio-protocol.test.ts` | 100% of stdout lines are valid JSON-RPC frames (`jsonrpc: "2.0"`); SQLite `ExperimentalWarning` cleanly suppressed. |
| **T-12** | Cross-Product Isolation | Static scan of `naukri-mcp/src/**` plus concurrent runtime execution with `indeed-mcp` in the same parent directory | **PASS** | Medium | `naukri-mcp/tests/security/stdio-environment.test.ts`, `naukri-mcp/tests/security/isolation-cross-product.test.ts` | Each server writes only its own database (`naukri-mcp.sqlite3` vs `indeed-mcp.sqlite3`); zero cross-reads or cross-store leakage. |
| **T-14** | Supply Chain Integrity | Auditing `package.json` for zero runtime dependencies and verifying executable shebang in standalone dist bundle | **PASS** | Medium | `naukri-mcp/tests/security/stdio-environment.test.ts` | `dependencies` is empty; dist bundle has valid node shebang. |
| **T-15** | Path Traversal / Data Dir | Relative paths, parent traversal (`../../`), UNC paths (`\\\\server\\share`), and root paths in `NAUKRI_MCP_DATA_DIR` | **PASS** | High | `naukri-mcp/tests/security/stdio-environment.test.ts` | Immediate process exit with code 1 and descriptive stderr; no stray database created. |
| **T-16 & T-17** | Human Boundary & Handoff | Validating `jobs_application_handoff` over stdio returns `human_only_fields` and official portal URL | **PASS** | Critical | `naukri-mcp/tests/security/stdio-environment.test.ts` | `final_submit` is marked human-only; `url_is_official` is true for `naukri.com`. |
| **SC-01** | Scenario: Senior Java Backend | `JD_NK_01` (5-10y, ₹ 12-18 Lacs P.A.) + `midJavaProfile` through full 6-tool stdio pipeline | **PASS** | - | `naukri-mcp/tests/scenarios/stdio-scenarios.test.ts` | Band: `strong`; 7 match dimensions; truthfulness note and emphasis evidence preserved. |
| **SC-02** | Scenario: Lead Angular Developer | `JD_NK_02` (8-14y, Undisclosed compensation) + `seniorMobileProfile` through stdio pipeline | **PASS** | - | `naukri-mcp/tests/scenarios/stdio-scenarios.test.ts` | Band: `strong`; undisclosed salary handled gracefully without throwing; 7 dimensions. |
| **SC-03** | Scenario: Junior Python Engineer | `JD_NK_03` (0-2y, ₹ 3-5 Lacs P.A.) + `fresherProfile` through stdio pipeline | **PASS** | - | `naukri-mcp/tests/scenarios/stdio-scenarios.test.ts` | Band: `strong`; entry-level experience and compensation verified over stdio. |

---

## 3. Findings & Residual Risk Analysis

1. **Zero Critical/High Residual Vulnerabilities**: `naukri-mcp` implements the identical defensive posture as `indeed-mcp`, ensuring secure packaging over `@jpm/job-core`.
2. **Defensive Isolation**:
   - Both products can coexist in shared file systems without database collision or cross-tenant data leakage.
   - Stdout stream integrity is strictly maintained; non-JSON-RPC diagnostic logs and experimental warnings are routed to stderr or silenced.
   - PII protection extends across the entire runtime surface (zero PII in stderr, salted hashes in SQLite audit table).
3. **Architect Note**:
   - `naukri-mcp` bundling relies on shared dependencies (`zod`, `@modelcontextprotocol/sdk`). When bundling standalone, ensure resolution paths or devDependencies account for job-core internal dependencies.
