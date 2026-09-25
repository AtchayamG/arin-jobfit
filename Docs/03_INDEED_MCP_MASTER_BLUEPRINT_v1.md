# Indeed MCP — Master Blueprint v1

## 1. Product identity

Working product: `indeed-mcp` / “Indeed MCP”. Independent third-party software until Indeed provides written approval. Do not imply endorsement or official status.

## 2. Core constraint

Indeed's Developer Agreement and service-specific documentation govern every Indeed-facing capability. API keys or OAuth credentials do not imply permission for capabilities that have not been provisioned/approved.

The architecture must therefore be capability-gated and fail closed.

## 3. Runtime modes

### Standalone Safe Mode — default

Human supplies an Indeed JD or job details they are permitted to use. The MCP performs local analysis and returns the official Indeed URL for user action.

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
- `jobs.ingest`
- `jobs.get`
- `jobs.list`
- `jobs.search_local`
- `jobs.normalize`
- `jobs.extract_requirements`
- `jobs.compare_profile`
- `jobs.explain_match`
- `jobs.shortlist`
- `jobs.deduplicate`
- `jobs.prepare_cv_notes`
- `jobs.prepare_interview`
- `jobs.application_handoff`
- `provider.capabilities`
- `provider.policy_status`

An approved retrieval tool may be added only after Indeed provisions a service whose documentation permits the intended job-seeker use. Do not invent a generic `indeed.search` API contract based on unsupported assumptions.

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

Provide:
- concise product overview
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
