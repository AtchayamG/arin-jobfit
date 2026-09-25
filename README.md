# Job Portal MCPs

Two independent, agent-compatible MCP products:

- `naukri-mcp` — Naukri-focused job intelligence connector.
- `indeed-mcp` — Indeed-focused job intelligence connector.

Both products are designed for Claude Code, OpenAI Codex and other MCP-capable agents. The shared contract is intentionally provider-neutral, but provider-specific policies, credentials, approval paths and runtime capabilities stay isolated.

## Current operating mode

Until a portal has granted the permissions needed for a particular capability, that capability remains disabled. The safe baseline is human-assisted job-description ingestion, normalization, match analysis, shortlisting, application preparation and interview preparation. Final application submission remains human-controlled.

## Authority hierarchy

1. Applicable law and portal terms / written portal approvals
2. Product-specific Master Blueprint
3. Shared MCP Contract + Security/Privacy policy
4. Implementation Plan approved by the Architect
5. Assigned developer task
6. Developer implementation choice

Lower levels must never override higher levels.

## Start here

Read `AGENTS.md`, then every document under `Docs/`, before writing production code.

## Working names and trademarks

`Naukri MCP` and `Indeed MCP` are descriptive working names. Until written approval exists, neither product may present itself as official, endorsed, certified, sponsored or affiliated with Naukri/Info Edge or Indeed. Public packaging must include a clear independent-product disclaimer and must comply with applicable trademark requirements.
