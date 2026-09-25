# Architect Audit v1

Author: Claude (Principal Architect) · Date: 2026-09-25 · Status: **ISSUED — awaiting owner approval of BCP-001..004**

Scope: full authority package (`README.md`, `AGENTS.md`, `MANIFEST.json`, `Docs/00–13`, product/shared READMEs, `Prompts/`). The repository contains documentation only; no source code exists yet.

---

## 1. Verdict

**SOUND WITH CONDITIONS.**

The compliance posture is correct and conservative: L0 analysis-only default, fail-closed provider gates, human-controlled application, no scraping, no private endpoints. The two-product split is justified by credential, policy, release and partner isolation.

Development of the L0 (Standalone Safe Mode) product may begin **now**, subject to:

1. The owner approving (or rejecting) Blueprint Change Proposals BCP-001..003 before MCP tool registration (Phase 2). Phase 1 work does not depend on them.
2. The repository being placed under git before the first developer commit (WP-SH-000).
3. Adoption of the architecture decisions in §4 (recorded in `Docs/09_DECISIONS_LOG.md` as ADR-001..ADR-009).

No portal-facing capability (L1–L4) may be built beyond a fail-closed seam. All are `BLOCKED_BY_PROVIDER_APPROVAL`.

---

## 2. New facts found during the audit (verified 2026-09-25)

| # | Fact | Source | Consequence |
|---|---|---|---|
| F1 | **Indeed operates its own official MCP server (beta)** with Job Search, Job Detail, Get Resume and Get Company Data tools, available as a Claude connector, subject to Indeed ToS/Privacy Policy. | https://docs.indeed.com/mcp/ · https://claude.com/connectors/indeed | `indeed-mcp` must not be positioned as an Indeed job-search connector. Its value is the portal-independent intelligence layer. An Indeed retrieval adapter is very unlikely to be approved. Public name "Indeed MCP" now collides with Indeed's own product (see BCP-003/004). |
| F2 | The Claude API, OpenAI function calling and GitHub Copilot reject tool names outside `^[a-zA-Z0-9_-]{1,64}$`. The MCP spec permits dots, but clients handle them inconsistently (some remap, some hard-fail). | SEP-986 · github/copilot-cli#2581 | Dotted names such as `jobs.ingest` in the Blueprints and the Shared Contract are an interoperability defect (BCP-001). |
| F3 | MCP spec **2026-07-28** is final: stateless protocol, no `initialize` handshake, no `Mcp-Session-Id`, `server/discover`, `resultType` on results. Sampling, Roots and Logging are **deprecated**. | modelcontextprotocol.io/specification/2026-07-28/changelog | The server must be stateless (explicit handles such as `job_id` only) and must not depend on sampling. |
| F4 | The official TypeScript SDK v2 (`@modelcontextprotocol/server` 2.1.0, `@modelcontextprotocol/node` 2.1.0, zod ^4) is stable and serves both 2025-era and 2026-07-28 clients. v1 `@modelcontextprotocol/sdk` is deprecated for new work. | npm registry · typescript-sdk `docs/migration/support-2026-07-28.md` | Stack decision ADR-002. |
| F5 | No public Naukri job-seeker API exists. The only Naukri "MCP" servers found are third-party scrapers. | Web search 2026-09-25 | Confirms Blueprint §3. Scraper-based competitors are a differentiation point for the partner pitch (compliant vs scraping). |
| F6 | The repository is **not a git repository**. | local check | No change control, no parallel-agent safety, no review diff. Fixed by WP-SH-000. |

---

## 3. Findings

Severity: **C** = critical (blocks a phase) · **H** = high · **M** = medium · **L** = low.

### 3.1 MCP interoperability

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| A-01 | C | Dotted tool names break Claude API, OpenAI/Codex and Copilot clients (F2). | BCP-001: `snake_case`, `<domain>_<verb>` (e.g. `jobs_ingest`). |
| A-02 | H | The Shared Contract has no transport mapping for the envelope (`structuredContent` vs text), no `outputSchema`, and no tool annotations. | Defined in Doc 17 §2–§4. |
| A-03 | H | Tool input schemas must stay portable across Gemini CLI, Kimi and Grok, which have historically been strict about JSON Schema keywords. | Doc 17 §5, "Portable Schema Subset". |
| A-04 | M | `profile_id` is referenced, but no tool creates, reads or deletes profiles. | BCP-002. |
| A-05 | M | Security policy requires "user deletion/export", but the contract has no such tools. | BCP-002. |
| A-06 | M | `jobs.normalize` and `jobs.ingest` overlap, and so do `compare_profile` and `explain_match`. | Kept, but separated clearly: `normalize` = pure preview with no persistence; `compare` = structured scores; `explain` = evidence narrative data (Doc 17). |
| A-07 | M | Spec 2026-07-28 statelessness (F3). | The design keeps no session state. All state is addressed by server-minted IDs. |
| A-08 | L | Grok connects only to remote MCP. Grok support therefore depends on Phase 6 (hosted). | Documented in the plan and not claimed earlier. |

### 3.2 Architecture and maintainability

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| B-01 | H | At L0 the two products are about 95% identical: the same normalization, extraction, scoring and preparation. Duplicating that code would double defects and review cost. Folder Policy 06 allows a shared library only with Architect approval. | ADR-003: `shared/job-core`, a versioned, provider-neutral TypeScript library with no network I/O and no credentials. Each product bundles its own pinned copy at build time, so releases stay independently deployable. |
| B-02 | H | No stack, runtime or tooling is chosen. | ADR-002: TypeScript (strict), Node ≥ 22.13 (24 LTS recommended), MCP TS SDK v2, zod 4, vitest, eslint, tsup, `node:sqlite`. |
| B-03 | H | Undecided whether the server calls an LLM for CV notes and interview prep. Sampling is deprecated (F3), and server-side LLM calls add cost, keys, privacy exposure and fabrication risk. | ADR-004: **the server is deterministic.** It returns grounded, structured material (evidence maps, gap lists, topic lists). The client's own LLM writes the prose. This improves privacy, testability and truthfulness guarantees. |
| B-04 | M | No persistence design. | ADR-005: local SQLite per product, in a separate OS user-data directory, behind a repository interface. Postgres is used for hosted mode (Phase 6). |
| B-05 | M | Parallel agents updating `Docs/10` and `Docs/11` will conflict. | ADR-008: developers write `Docs/handovers/<WP-ID>.md`. Only Claude edits 10/11/19. `AGENTS.md` rule 10 is amended accordingly. |
| B-06 | L | No implementation changelog exists. | Created as `Docs/19_IMPLEMENTATION_CHANGELOG.md`. |

### 3.3 Security and privacy

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| S-01 | H | Indirect prompt injection: JD text flows back into the client LLM, which may also hold powerful tools (email, shell). The server cannot control the client. | Threat model T-01: sanitize, detect and flag; limit echoing of raw JD text; static tool descriptions; destructive tools annotated and token-confirmed. |
| S-02 | H | Fabrication risk in CV notes. | Testable invariant: every evidence item in `jobs_prepare_cv_notes` must trace to a profile field (Doc 18 T-08). |
| S-03 | H | India DPDP Act 2023 and DPDP Rules 2025 apply to the hosted mode, which processes CVs (personal data). Not mentioned in the package. | Doc 18 §6. Hosted mode is gated on DPDP notice/consent/erasure/grievance design. Local mode keeps data on the user's device. |
| S-04 | M | Indian JDs sometimes contain unlawful or discriminatory requirements (age limits, gender, religion, marital status). | The extractor flags them as `POTENTIALLY_DISCRIMINATORY_REQUIREMENT` and never scores on them. The profile schema has **no** protected-attribute fields and uses strict `additionalProperties: false`. |
| S-05 | M | "Policy is versioned configuration", but there is no mechanism to prove that config matches written approvals. | ADR-006: machine-readable `config/policy.json` per product, plus a `policy-lint` CI check that fails if any L1+ capability is enabled without an `approval_ref` present in `Docs/09`. Stale snapshot → downgrade to L0. |
| S-06 | M | `source_url` handling could become an SSRF or scraping vector. | The server **never fetches URLs**. URLs are validated (https, no credentials, no IP literals, length) and marked `official: true` only when on the product's host allowlist. |

### 3.4 Portal policy and commercial

| ID | Sev | Finding | Resolution |
|---|---|---|---|
| P-01 | H | Indeed Blueprint §5/§7/§8 does not account for Indeed's official MCP (F1). The partner pitch as written would propose something Indeed already ships. | BCP-003. |
| P-02 | H | Public names "Naukri MCP" / "Indeed MCP" create trademark and confusion risk, which is now acute for Indeed. | BCP-004. Internal folder names stay. A neutral public brand is needed before any public release. Not a development blocker. |
| P-03 | M | Agent-relay use case: the user's MCP client reads a job via Indeed's official connector and passes it to `indeed-mcp`. Acceptable as user-supplied content in **local personal** mode. Storing it in a **hosted commercial** service is an open ToS question. | Local: allowed, with provenance `agent_relay`. Hosted: retention of relayed Indeed content is `BLOCKED_BY_PROVIDER_APPROVAL` until Indeed clarifies. Include in the follow-up to Indeed. |
| P-04 | L | The commercial plan assumes L0 has standalone value. That is true, but the value is portal-agnostic, so differentiation must come from match quality, truthfulness guarantees and privacy. | No change. Noted for Phase 8. |

### 3.5 What is correct and must be preserved

- Authority hierarchy and the No Placeholder Completion Rule.
- L0–L4 capability maturity model.
- Two-stage preview/confirm envelope for any future write.
- Separate credentials, telemetry namespaces and releases per product.
- Partner outreach via official channels only (both enquiries sent 2026-09-25).

---

## 4. Architecture decisions (Architect authority; recorded in Docs/09)

| ADR | Decision |
|---|---|
| ADR-001 | Both products run at L0 until approvals exist. Every L1+ capability is registered as `BLOCKED_BY_PROVIDER_APPROVAL` and returns a structured error, never an empty result. |
| ADR-002 | Stack: TypeScript strict; Node ≥ 22.13 (CI on 22 and 24); `@modelcontextprotocol/server` + `@modelcontextprotocol/node` v2 (≥ 2.1.0); zod 4; vitest; eslint (flat) + typescript-eslint; prettier; tsup. No other runtime dependencies without Architect approval. |
| ADR-003 | `shared/job-core` = provider-neutral library (schemas, sanitization, normalization, extraction, matching, dedupe, prep builders, envelope, policy engine, store interface + SQLite impl, MCP tool-kit). Products depend on it via `file:` and **bundle** it. No network I/O, no credentials, no provider branding. Generated JSON Schemas are emitted to `shared/schemas/`; the contract manifest goes to `shared/contracts/`. |
| ADR-004 | The server is deterministic: no LLM calls and no MCP sampling. Prose generation is the client LLM's job, using grounded structured output. |
| ADR-005 | Local persistence: `node:sqlite` in a per-product data dir (`NAUKRI_MCP_DATA_DIR` / `INDEED_MCP_DATA_DIR`, default OS user-data path). Parameterized SQL only. Hosted persistence is designed in Phase 6. |
| ADR-006 | Policy as code: `<product>/config/policy.json` validated by schema. `policy-lint` cross-checks `approval_ref` against Docs/09. A stale snapshot (default > 90 days) downgrades provider capabilities to disabled. |
| ADR-007 | Transports: stdio first (Phase 2). Streamable HTTP (stateless, 2025+2026 compatible) in Phase 6 only, behind OAuth. No local HTTP listener in v1. |
| ADR-008 | Parallel-work protocol: disjoint file ownership per WP, path-scoped commits on `main`, per-WP handover files in `Docs/handovers/`. Only the Architect edits Docs/09, 10, 11, 14–19. |
| ADR-009 | The server never fetches external URLs in any L0 tool. |

---

## 5. Blueprint Change Proposals (STOP — require owner approval)

### BCP-001 — Tool naming

- **PROPOSED BLUEPRINT CHANGE:** Rename all tools in Blueprints 02 §4 and 03 §5 and in Shared Contract 04 from dotted to snake_case: `jobs.ingest` → `jobs_ingest`, `provider.capabilities` → `provider_capabilities`, and so on. Future partner tools use the `provider_` prefix.
- **REASON:** F2. The Claude API, OpenAI/Codex and Copilot enforce `^[a-zA-Z0-9_-]{1,64}$`.
- **IMPACT:** Names only. Semantics are unchanged.
- **SECURITY IMPACT:** None.
- **PORTAL POLICY IMPACT:** None.
- **ALTERNATIVES:** Keep dots and rely on client remapping (fragile, fails on some clients); use hyphens (valid, but less idiomatic for LLM function names).
- **RECOMMENDATION:** Approve.

### BCP-002 — Profile and data-rights tools

- **PROPOSED BLUEPRINT CHANGE:** Add `profile_upsert`, `profile_get`, `profile_list`, `profile_delete`, `jobs_delete`, `data_export`, `data_purge` to both products' tool sets and to the Shared Contract.
- **REASON:** A-04, A-05, and Security Policy 05 (user deletion/export, consent).
- **IMPACT:** 7 additional local-only L0 tools.
- **SECURITY IMPACT:** Positive. `data_purge` and the delete tools are annotated `destructiveHint` and use a confirmation token.
- **PORTAL POLICY IMPACT:** None. Local data only.
- **ALTERNATIVES:** Accept inline profiles only (no persistence), which forces CV re-upload on every call and increases PII transit.
- **RECOMMENDATION:** Approve.

### BCP-003 — Indeed Blueprint repositioning

- **PROPOSED BLUEPRINT CHANGE:** Amend Blueprint 03:
  - (a) §2/§7: record that Indeed ships an official MCP server (beta).
  - (b) §3: add "agent-relay" ingestion. In local mode, content the user's client obtained through Indeed's official connector may be ingested with provenance `agent_relay`. In hosted mode, retention of such content is blocked until Indeed clarifies.
  - (c) §5/§8: remove the premise that `indeed-mcp` will provide Indeed retrieval. Reposition it as a complementary, privacy-preserving analysis layer, and change the partner ask accordingly.
- **REASON:** F1, P-01, P-03.
- **IMPACT:** Partner pitch and future adapter scope. No Phase 1–5 code impact.
- **SECURITY IMPACT:** None.
- **PORTAL POLICY IMPACT:** Reduces the risk of proposing a competing integration and makes the ToS question explicit.
- **ALTERNATIVES:** Keep the Blueprint unchanged (it is misaligned with market reality); drop `indeed-mcp` (loses a product line that still has value as an analysis layer).
- **RECOMMENDATION:** Approve. Also send a short follow-up to Indeed referencing their MCP and asking the agent-relay and naming questions.

### BCP-004 — Public product naming

- **PROPOSED BLUEPRINT CHANGE:** Blueprints 02/03 §1: "Naukri MCP" / "Indeed MCP" remain **internal working names only**. Before any public release, the owner selects a neutral public brand (for example "<Brand> Job Fit — Naukri edition"), subject to trademark review. The MCP `serverInfo.name` stays `naukri-mcp` / `indeed-mcp` until then; these are private builds only.
- **REASON:** P-02.
- **IMPACT:** Packaging and branding only.
- **SECURITY IMPACT:** None.
- **PORTAL POLICY IMPACT:** Reduces trademark/endorsement risk.
- **ALTERNATIVES:** Keep the names (high risk).
- **RECOMMENDATION:** Approve the principle now. The owner decides the brand before Phase 5.

---

## 6. Portal-approval blockers

| Capability | Naukri | Indeed |
|---|---|---|
| L0 analysis of user-supplied JD | Allowed | Allowed |
| L0 agent-relay ingestion (local) | n/a | Allowed (BCP-003) |
| Agent-relay retention in hosted mode | n/a | BLOCKED_BY_PROVIDER_APPROVAL |
| L1 retrieval via provider API | BLOCKED_BY_PROVIDER_APPROVAL (no public API) | BLOCKED_BY_PROVIDER_APPROVAL (unlikely; official MCP exists) |
| L2 account-linked read | BLOCKED_BY_PROVIDER_APPROVAL | BLOCKED_BY_PROVIDER_APPROVAL |
| L3 assisted write | BLOCKED_BY_PROVIDER_APPROVAL | BLOCKED_BY_PROVIDER_APPROVAL |
| L4 submission | Out of scope | Out of scope |
| Public use of portal names | Needs trademark guidance | Needs trademark guidance |

None of these blocks Phases 1–5.
