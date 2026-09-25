# Adversarial Security Review Report: SEC-001A

**Scope**: `shared/job-core` and `indeed-mcp` (Local stdio MCP deployment)  
**Date**: 2026-09-25  
**Reviewer**: AGY (Senior Developer / Adversarial Reviewer)  
**Status**: COMPLETE — ALL GATES GREEN  

---

## 1. Executive Summary

An adversarial security review of `shared/job-core` and the `indeed-mcp` stdio server was conducted against the 17 threat categories defined in `Docs/18_THREAT_MODEL_v1.md`. 

All 17 threat vectors were tested using automated executable test suites in `shared/job-core/tests/security/` (17 tests) and `indeed-mcp/tests/security/` (6 tests). Zero critical or high security vulnerabilities were identified. All mitigations specified in the threat model and MCP tool schema plan are validated by passing executable tests.

---

## 2. Threat Verification Matrix

| ID | Threat Category | Adversarial Probe / Attack Attempted | Result | Severity | Test Suite Path | Recommendation |
|---|---|---|---|---|---|---|
| **T-01** | Indirect Prompt Injection | Hostile JDs with zero-width smuggling, bidi overrides, entity markup, exfil links, and instruction injection | **PASS** | High | `shared/job-core/tests/security/threats-t01-t02.test.ts` | Maintain NFKC normalization, tag-stripping, and injection warning codes. |
| **T-02** | Tool Poisoning / Rug Pull | Hostile inputs attempting to mutate catalog, inject dynamic tools, or alter tool count | **PASS** | High | `shared/job-core/tests/security/threats-t01-t02.test.ts` | Keep static 22-tool catalog immutable with deterministic alphabetical ordering. |
| **T-03** | Policy Gate Tampering | Corrupted policy state with unauthorized L1 elevation or missing partner approval | **PASS** | High | `shared/job-core/tests/security/threats-t03-t05.test.ts` | Fail closed on any missing approval reference or partner flag. |
| **T-04** | Unauthorized Elevation | Runtime network monkey-patching and static codebase scans for fetch/net/http imports | **PASS** | Critical | `shared/job-core/tests/security/threats-t03-t05.test.ts` | Retain static import scan and zero-network isolation in CI. |
| **T-05** | SSRF & Scraping Drift | RFC 3986 probe with IP literals, private subnets (127.0.0.1, 169.254.169.254), userinfo, and non-HTTPS | **PASS** | High | `shared/job-core/tests/security/threats-t03-t05.test.ts` | Keep URL validator strictly rejecting userinfo, ports, and IP literals. |
| **T-06** | DoS / ReDoS Timing | Oversized payloads (>50k chars) and pathological repetitive regex backtracking inputs | **PASS** | Medium | `shared/job-core/tests/security/threats-t06-t07.test.ts` | Enforce 50k character input limit (<40ms execution achieved; limit is 500ms). |
| **T-07** | SQL Injection | SQL metacharacters (`' OR 1=1`, UNION, stacked statements) across IDs, queries, and cursors | **PASS** | Critical | `shared/job-core/tests/security/threats-t06-t07.test.ts` | Maintain parameterized statements across node:sqlite store queries. |
| **T-08** | Fabrication Invariant | Probing CV notes and interview prep to claim unpossessed skills or fake credentials | **PASS** | High | `shared/job-core/tests/security/threats-t08-t09.test.ts` | Strict enforcement of exact substring proof for all profile evidence. |
| **T-09** | Discrimination / Bias | Probing scoring neutralizers with discriminatory age, gender, and personal requirements | **PASS** | Medium | `shared/job-core/tests/security/threats-t08-t09.test.ts` | Flag discriminatory requirements and exclude from fit_score calculation. |
| **T-10** | Log / Audit PII Leakage | Checking stderr stream and audit database for candidate PII, phone, email, and raw JD text | **PASS** | High | `shared/job-core/tests/security/threats-t10-t13.test.ts`, `indeed-mcp/tests/security/stdio-environment.test.ts` | Retain 16-hex salted hashes in audit table; stderr remains redacted. |
| **T-11** | Stdout Protocol Purity | Injecting malformed JSON-RPC, syntax errors, and tool failures across stdio transport | **PASS** | High | `indeed-mcp/tests/security/stdio-protocol.test.ts` | Ensure 100% of stdout lines remain valid JSON-RPC frames under all conditions. |
| **T-12** | Cross-Product Leakage | Static code and runtime isolation checks ensuring indeed-mcp cannot access naukri data | **PASS** | Medium | `indeed-mcp/tests/security/stdio-environment.test.ts` | Provider separation strictly maintained by isolated data directories and env vars. |
| **T-13** | Repudiation / Destructive Misuse | Replay attacks, forged purge tokens, and cross-store confirmation token reuse | **PASS** | High | `shared/job-core/tests/security/threats-t10-t13.test.ts` | Require two-step token confirmation with 5-minute expiry and store binding. |
| **T-14** | Supply Chain Integrity | Verifying zero production dependencies in package.json and clean standalone dist bundle | **PASS** | Medium | `indeed-mcp/tests/security/stdio-environment.test.ts` | Keep zero runtime dependencies for stdio distribution. |
| **T-15** | Path Traversal / Data Dir | Relative paths, parent traversal (`../../`), UNC paths, and root directories in env vars | **PASS** | High | `indeed-mcp/tests/security/stdio-environment.test.ts` | Immediately exit with code 1 and descriptive error when data dir is unsafe. |
| **T-16** | Human-Control Boundary | Verifying catalog has zero autonomous apply/submit tools and handoff requires human action | **PASS** | Critical | `shared/job-core/tests/security/threats-t16-t17.test.ts`, `indeed-mcp/tests/security/stdio-environment.test.ts` | `final_submit` is marked as human-only; application handoff returns official URL. |
| **T-17** | Trademark / Misrepresentation | Checking tool descriptions and instructions for untrusted data warnings and disclaimers | **PASS** | Low | `shared/job-core/tests/security/threats-t16-t17.test.ts`, `indeed-mcp/tests/security/stdio-environment.test.ts` | Prominent independent disclaimer present in all server descriptions. |

---

## 3. Findings & Residual Risk Analysis

1. **Zero Critical/High Residual Vulnerabilities**: Both `shared/job-core` and `indeed-mcp` demonstrate robust defensive architecture.
2. **Defensive Layering**:
   - Injection attacks are suppressed at three levels: ingestion sanitization, requirement extraction heuristics, and profile matching.
   - Database operations are completely parameterized; schema validation rejects malformed identifiers before SQL query construction.
   - The MCP stdio transport is isolated from logs; warnings and diagnostics route exclusively to stderr.
3. **Recommendations for Future Phases**:
   - When extending to `naukri-mcp` (SEC-001B), replicate the stdio protocol purity and environment validation tests.
   - Ensure future L1 capabilities continue to strictly adhere to the fail-closed policy engine and capability gate.
