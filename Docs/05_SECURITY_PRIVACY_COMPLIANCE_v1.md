# Security, Privacy & Compliance v1

## Principles

- data minimization
- least privilege
- fail closed
- explicit consent
- transparent provenance
- short retention by default
- user deletion/export
- environment isolation
- auditable consequential actions

## Data classes

1. Public job content
2. User profile/CV data
3. Portal account identifiers
4. OAuth tokens/API secrets
5. Application/screening content
6. Telemetry/audit events

Classes 3–5 require stronger controls. Credentials are never returned through MCP tool output.

## Hosted multi-tenant requirements

- tenant-scoped storage keys
- row/object-level authorization checks
- encrypted transport
- secrets vault
- encrypted sensitive storage
- access logs
- abuse/rate controls
- deletion workflow
- backup retention policy
- incident response runbook
- dependency/SBOM scanning

## LLM-specific controls

- treat job descriptions and external content as untrusted input
- never execute instructions embedded in a JD
- tool allowlists
- schema validation on all MCP inputs/outputs
- size limits
- URL allowlists for portal adapters
- no arbitrary shell/browser execution from provider content
- redact secrets and high-risk PII from logs

## Privacy-by-design

Profile/JD comparison should run locally when possible. Hosted mode must clearly explain what is stored and for how long. Do not use user CV/job data to train models without explicit permission.

## Policy change handling

Portal policy is versioned configuration. If policy status is stale/unknown, provider-specific online capabilities downgrade to safe mode until reviewed.
