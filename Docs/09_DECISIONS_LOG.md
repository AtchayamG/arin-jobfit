# Decisions Log

## 2026-09-25

- Two separate products: `naukri-mcp` and `indeed-mcp`.
- No person-specific “Arin” branding in public connector names.
- Claude is Principal Architect; Codex and AGY are Senior Developers with non-overlapping implementation assignments.
- MCP is the primary interoperability contract.
- Local stdio + hosted Streamable HTTP are target transports.
- Human-controlled application submission is the default product boundary.
- Naukri direct portal integration is disabled until written official permission/API documentation exists.
- Indeed provider features are capability-gated by provisioned/approved services.
- Root repository must remain clean.
- No Placeholder Completion Rule adopted.

## 2026-09-25 — Architecture audit (Claude, Docs 14–18)

Architecture decisions (Architect authority; detail in Doc 14 §4):

- ADR-001: Both products at L0; every L1+ capability `BLOCKED_BY_PROVIDER_APPROVAL`, structured error, never empty result.
- ADR-002: Stack = TypeScript strict, Node >=22.13 (CI 22 + 24), MCP TS SDK v2 (`@modelcontextprotocol/server` / `node` >=2.1.0), zod 4, vitest, eslint, prettier, tsup.
- ADR-003: `shared/job-core` provider-neutral library approved under Folder Policy 06 exception; products bundle a pinned copy; no network I/O or credentials in it.
- ADR-004: Server is deterministic — no LLM calls, no MCP sampling (deprecated in spec 2026-07-28).
- ADR-005: Local persistence `node:sqlite`, per-product data dir, parameterized SQL only.
- ADR-006: Policy as code (`<product>/config/policy.json`) + `policy-lint`; stale snapshot downgrades L1+.
- ADR-007: stdio first; stateless Streamable HTTP only in Phase 6 behind OAuth.
- ADR-008: Parallel-work protocol — disjoint file ownership, path-scoped commits, `Docs/handovers/<WP-ID>.md`; only Architect edits Docs/09–11, 14–19, Blueprints, Shared Contract.
- ADR-009: No L0 tool ever fetches an external URL.

Blueprint Change Proposals (Doc 14 §5):

- BCP-001 snake_case tool names — **APPROVED by owner 2026-09-25**
- BCP-002 profile & data-rights tools — **APPROVED by owner 2026-09-25**
- BCP-003 Indeed Blueprint repositioning (official Indeed MCP exists) — **APPROVED by owner 2026-09-25**
- BCP-004 public naming neutral brand — **APPROVED by owner 2026-09-25**

## Approval reference format

Written portal approvals are recorded here under a heading `APPROVAL-NAUKRI-NNN` or `APPROVAL-INDEED-NNN` with date, sender, scope, services, limits and a link/attachment reference. `policy-lint` requires the exact token to exist here before any L1+ capability can be enabled. No such approvals exist as of 2026-09-25.

## 2026-09-25 — Owner approvals (Atchayam G)

- BCP-001, BCP-002, BCP-003 and BCP-004 were approved as recommended. Blueprints 02 and 03 and Shared Contract 04 were amended the same day.
- BCP-003 follow-up: a short clarification email to Indeed was authorized ("send mail if needed"). It is recorded in Doc 13.
- BCP-004: the public brand is still to be chosen by the owner before Phase 5.
