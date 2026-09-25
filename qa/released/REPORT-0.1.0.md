# E2E Verification Report: Arin JobFit (Published Registry Packages)

**Date**: 2026-09-25T20:43:57.785Z  
**Environment**: Windows (win32 (x64)), Node v24.18.0, npm 11.0.0  
**Packages Tested**: `arin-jobfit-nk@0.1.1`, `arin-jobfit-id@0.1.1`  
**Target Registry**: npm public registry (`https://registry.npmjs.org/`)  
**Scope**: 100% published artifacts via `npx -y` (zero local source/dist references)  

---

## 1. Executive Summary

Both published packages (`arin-jobfit-nk@0.1.1` and `arin-jobfit-id@0.1.1`) were installed and tested end-to-end against the live npm registry.

- **Tool Coverage**: 22 / 22 tools verified on both editions (44 / 44 total tool evaluations).
- **Schema Validations**: 90 output payloads validated against each tool's `outputSchema` via Ajv (Draft 2020-12).
- **Invariants**: 100% of privacy, security, and match invariants validated (substring citations, gap detection, discrimination isolation, prompt injection neutralization, and human-only boundary).
- **Zero Network Verification**: Verified via static package dist inspection (`npm pack` dist code scan: 0 `fetch`, `http.request`, `https.request`, `net.connect`) and runtime stderr checking (0 connection attempts, 0 network errors recorded, and 0 source_urls resolved).
- **Protocol Purity**: 100% of stdout lines are valid JSON-RPC 2.0; stderr clean of `ExperimentalWarning` and unhandled exceptions.
- **Cross-Product Isolation**: Both editions run concurrently in separate directories with total isolation.

---

## 2. Edition Test Matrix

| Category / Check | Naukri Edition (`arin-jobfit-nk`) | Indeed Edition (`arin-jobfit-id`) | Notes |
|---|---|---|---|
| **CLI: --version** | PASS (`0.1.1`) | PASS (`0.1.1`) | Exactly 0.1.1 |
| **CLI: --help** | PASS | PASS | Contains exact binary name |
| **CLI: Unknown Flag** | PASS (exit code 2) | PASS (exit code 2) | Exit 2 + usage printed |
| **Tools: 22 Count** | PASS (22/22) | PASS (22/22) | Matches `tool-manifest.v1.json` |
| **Tools: Stable Order** | PASS | PASS | Deterministic alphabetical sort |
| **Schema Validations** | 45 passed | 45 passed | Validated with Ajv against `outputSchema` |
| **Persistence Across Reboots** | PASS | PASS | Disk state restored; clean purge |
| **Error: Missing Args** | PASS | PASS | Fail-closed validation |
| **Error: Unknown Job ID** | PASS | PASS | Returns structured error envelope |
| **Error: Oversized Input** | PASS | PASS | >50k char inputs rejected |

---

## 3. Tool Coverage Table (22 Tools × 2 Editions)

| # | Tool Name | Naukri (`nk`) Status | Calls (`nk`) | Indeed (`id`) Status | Calls (`id`) |
|---|---|---|---|---|---|
| 1 | `data_export` | PASS | 1 | PASS | 1 |
| 2 | `data_purge` | PASS | 4 | PASS | 4 |
| 3 | `jobs_application_handoff` | PASS | 2 | PASS | 2 |
| 4 | `jobs_compare_profile` | PASS | 5 | PASS | 5 |
| 5 | `jobs_deduplicate` | PASS | 1 | PASS | 1 |
| 6 | `jobs_delete` | PASS | 1 | PASS | 1 |
| 7 | `jobs_explain_match` | PASS | 1 | PASS | 1 |
| 8 | `jobs_extract_requirements` | PASS | 2 | PASS | 2 |
| 9 | `jobs_get` | PASS | 1 | PASS | 1 |
| 10 | `jobs_ingest` | PASS | 9 | PASS | 9 |
| 11 | `jobs_list` | PASS | 2 | PASS | 2 |
| 12 | `jobs_normalize` | PASS | 1 | PASS | 1 |
| 13 | `jobs_prepare_cv_notes` | PASS | 2 | PASS | 2 |
| 14 | `jobs_prepare_interview` | PASS | 2 | PASS | 2 |
| 15 | `jobs_search_local` | PASS | 1 | PASS | 1 |
| 16 | `jobs_shortlist` | PASS | 1 | PASS | 1 |
| 17 | `profile_delete` | PASS | 1 | PASS | 1 |
| 18 | `profile_get` | PASS | 1 | PASS | 1 |
| 19 | `profile_list` | PASS | 2 | PASS | 2 |
| 20 | `profile_upsert` | PASS | 2 | PASS | 2 |
| 21 | `provider_capabilities` | PASS | 1 | PASS | 1 |
| 22 | `provider_policy_status` | PASS | 1 | PASS | 1 |

---

## 4. Invariants & Security Validations

| Invariant | Description | Naukri | Indeed |
|---|---|---|---|
| **Evidence Substring** | Field-path value contains exact profile_evidence.text | PASS | PASS |
| **Do-Not-Claim Gaps** | Profile gaps accurately listed in `do_not_claim` | PASS | PASS |
| **Discriminatory Excluded** | Age/gender flags isolated; match scores identical (±0.01) to clean copy; no discriminatory text in match dimensions | PASS | PASS |
| **Injection Neutralized** | Hostile instructions flagged (`PROMPT_INJECTION_SUSPECTED`); instruction text absent from all outputs | PASS | PASS |
| **Ranking Accuracy** | Senior match scores higher than junior mismatch | PASS | PASS |
| **Salary Normalization** | Indian formats ("₹16,00,000", "18-25 LPA", "12 Lacs P.A.") parsed | PASS | PASS |
| **Duplicate Detection** | Duplicate JD accurately detected during ingestion / dedupe | PASS | PASS |
| **L1+ Gated Boundary** | Autonomous actions blocked (`blocked_by_provider_approval`) | PASS | PASS |
| **Human-Only Handoff** | Application handoff requires human final submit action | PASS | PASS |
| **Zero Network Activity** | No outbound HTTP/HTTPS requests attempted (static dist inspection + runtime stderr verified) | PASS | PASS |

---

## 5. Cross-Product Isolation

- **Status**: PASS
- **Verification**: NK isolated: true, ID isolated: true, Cross-gets rejected: true

---

## 6. Performance & Latency Benchmarks

| Metric | Naukri (`nk`) | Indeed (`id`) |
|---|---|---|
| **Cold Start (npx download & spawn)** | 1905 ms | 2207 ms |
| **Warm Start (cached npx spawn)** | 1703 ms | 4309 ms |
| **Tool Latency (p50)** | 5 ms | 3 ms |
| **Tool Latency (Max)** | 268 ms | 164 ms |

---

## 7. Defect & Limitation Registry

### Discovered Defects
_Zero defects discovered during full end-to-end evaluation._

### Documented Limitations Hit
- **F-1 SDK Pre-Handler Validation**: Schema rejections prior to handler dispatch emit standard MCP error frames rather than tool result envelopes.
- **Doc 17 §8 Size Limit**: Inputs > 50,000 characters are safely rejected by sanitization gates.
