# Indeed MCP — Master Blueprint v1

## 1. Product identity

Working product: `indeed-mcp` / “Indeed MCP” — **internal working names only** (BCP-004, approved 2026-09-25). Indeed operates its own official product named Indeed MCP, so this name must never be used publicly. Before any public release the owner selects a neutral public brand, subject to trademark review. Independent third-party software until Indeed provides written approval. Do not imply endorsement or official status.

## 2. Core constraint

Indeed's Developer Agreement and service-specific documentation govern every Indeed-facing capability. API keys or OAuth credentials do not imply permission for capabilities that have not been provisioned/approved.

The architecture must therefore be capability-gated and fail closed.

## 2A. Market fact: Indeed's official MCP server (BCP-003, approved 2026-09-25)

Indeed operates an official MCP server (beta) offering Job Search, Job Detail, Get Resume and Get Company Data. It is available as a Claude connector and is subject to Indeed's Terms of Service and Privacy Policy (https://docs.indeed.com/mcp/).

`indeed-mcp` is therefore positioned as a **complementary, privacy-preserving analysis layer**: explainable fit scoring, gap analysis, truthful CV notes, interview preparation and human-controlled handoff. It is **not** an Indeed retrieval or search connector, and it must not duplicate or compete with Indeed's official MCP.

## 3. Runtime modes

### Standalone Safe Mode — default

Human supplies an Indeed JD or job details they are permitted to use. The MCP performs local analysis and returns the official Indeed URL for user action.

### Agent-relay ingestion (BCP-003)

A user's MCP client may obtain job content through Indeed's official connector and pass it to `jobs_ingest` with `origin: agent_relay` and `relay_source: indeed_official_mcp`.

- **Local mode:** allowed. The content is user-visible and user-directed, and it stays on the user's device.
- **Hosted mode:** retaining relayed Indeed content is `BLOCKED_BY_PROVIDER_APPROVAL` until Indeed confirms in writing that it is permitted.
- `indeed-mcp` itself never calls Indeed's MCP server or any Indeed API.

### Approved Partner Mode — disabled initially

Only services provisioned for the application in Indeed Partner Console may be enabled. Testing and production credentials/applications must follow Indeed's current authorization requirements.

## 4. Important Indeed-specific design implications

- Do not scrape or circumvent access controls.
- Do not exceed documented scope or retrieve unnecessary data.
- Do not use an Indeed API for a purpose other than the approved integration.
- Do not create autonomous algorithmic query loops that replace human input.
- Do not use one app's credentials for unrelated applications.
- Keep test and production environments separate where required.
- Respect Indeed consent/UI/terms disclosures required by the applicable service.
- Treat API/service availability as runtime capability data, not a compile-time assumption.

## 5. Proposed MCP tools

Safe-mode tools mirror the shared contract:
- `jobs_ingest`
- `jobs_get`
- `jobs_list`
- `jobs_search_local`
- `jobs_normalize`
- `jobs_extract_requirements`
- `jobs_compare_profile`
- `jobs_explain_match`
- `jobs_shortlist`
- `jobs_deduplicate`
- `jobs_prepare_cv_notes`
- `jobs_prepare_interview`
- `jobs_application_handoff`
- `provider_capabilities`
- `provider_policy_status`

The earlier premise that `indeed-mcp` would provide Indeed retrieval is withdrawn (BCP-003). An approved retrieval tool may still be added only after Indeed provisions a service whose documentation permits the intended job-seeker use. Do not invent a generic `indeed.search` API contract based on unsupported assumptions.


Profile & data-rights tools (added by BCP-002, approved 2026-09-25; local store only, L0):
- `profile_upsert`
- `profile_get`
- `profile_list`
- `profile_delete`
- `jobs_delete`
- `data_export`
- `data_purge` (two-step confirmation token)

Tool naming (BCP-001, approved 2026-09-25): tool names use `snake_case` `<domain>_<verb>` and must match `^[a-zA-Z0-9_-]{1,64}$` (Claude API, OpenAI/Codex and Copilot reject dots).

## 6. OAuth and credentials

- secrets stored outside source control
- scope-minimization
- encrypted at rest in hosted mode
- per-environment credentials
- token rotation/revocation support
- no secrets in telemetry
- consent/audit record for account-linked operations

## 7. Partner process

Indeed's Partner Console documentation states that app services are provisioned and tracked by status. Service requests can go through the Indeed representative or `marketplacesupport@indeed.com`. The Help Center also provides “Become a partner” and support paths.

Before implementing an Indeed provider API adapter, obtain written clarification that the intended job-seeker connector use is supported and identify the exact API/service and constraints.

## 8. Partner submission pack

Provide (repositioned per BCP-003 as a complement to Indeed's official MCP; the ask is permission and guidance, not API access for search):
- concise product overview
- how the product complements Indeed's official MCP server
- the agent-relay question (local vs hosted retention)
- naming/trademark guidance request
- supported MCP clients
- architecture/data flow
- exact requested Indeed capabilities
- user-consent flow
- privacy/security documentation
- human-control model
- abuse controls/rate limits
- test plan
- demo
- commercial model

Never promise sponsorship or distribution; request discussion and let Indeed define available partner programs.


## Change history
- 2026-09-25: BCP-001 (snake_case tool names), BCP-002 (profile & data-rights tools), BCP-003 (repositioning alongside Indeed official MCP; agent-relay), BCP-004 (internal working name) approved by owner.
