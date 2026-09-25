# Arin JobFit

Arin JobFit is a pair of local MCP servers that turn a pasted job description
into an explainable fit score, gaps, truthful CV notes, interview preparation,
and a human-only application handoff. The servers do not submit applications.

## Why it is different

- Runs locally with SQLite; no scraping, telemetry, or automatic applications.
- Portal capabilities fail closed until approval and documented support exist.
- Deterministic, no-LLM server logic with prompt-injection hardening.
- Truthfulness invariant: generated notes cannot invent qualifications.

## Editions

| Package | Edition | Product guide |
| --- | --- | --- |
| `arin-jobfit-nk` | Naukri | [naukri-mcp](naukri-mcp/README.md) |
| `arin-jobfit-id` | Indeed | [indeed-mcp](indeed-mcp/README.md) |

## Quick start

After publication:

```sh
npx -y arin-jobfit-nk
npx -y arin-jobfit-id
```

Client setup guides are available for [Claude Code](naukri-mcp/docs/clients/claude-code.md),
[Codex](naukri-mcp/docs/clients/codex.md), [Gemini CLI](naukri-mcp/docs/clients/gemini-cli.md),
and [Kimi Code](naukri-mcp/docs/clients/kimi-code.md). Gemini CLI and Kimi Code
guides are community-verified pending. Use the corresponding `indeed-mcp/docs/clients/`
guide for the Indeed edition. From-source commands are in each product README.

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

## Tools

Each edition exposes 22 local MCP tools for intake, normalization, extraction,
profiles, matching, preparation, handoff, and data rights. The authoritative
contract is [tool-manifest.v1.json](shared/contracts/tool-manifest.v1.json).

## Privacy and data

Job descriptions, profiles, results, and audit records stay in a local SQLite
database. The default directory is `%APPDATA%\naukri-mcp` or
`%APPDATA%\indeed-mcp` on Windows, `~/Library/Application Support/<product>`
on macOS, and `$XDG_DATA_HOME/<product>` (or `~/.local/share/<product>`) on
Linux. The edition-specific environment variables override the location.
`data_export` exports local records and `data_purge` permanently deletes them
through confirmation steps.

## Architecture

```text
pasted job description -> local MCP client -> edition server -> job-core
                                             |              |
                                      policy gates      SQLite data
                                             |
                              human-only application handoff
```

See the [architect audit](Docs/14_ARCHITECT_AUDIT_v1.md),
[implementation plan](Docs/15_IMPLEMENTATION_PLAN_v1.md),
[work packages](Docs/16_WORK_PACKAGE_ASSIGNMENTS_v1.md),
[tool schema plan](Docs/17_MCP_TOOL_SCHEMA_PLAN_v1.md), and
[threat model](Docs/18_THREAT_MODEL_v1.md).

## How this was built

Claude served as architect and reviewer; Codex and AGY implemented separate
work packages and performed independent reviews. See the [assignment map](Docs/16_WORK_PACKAGE_ASSIGNMENTS_v1.md),
[implementation changelog](Docs/19_IMPLEMENTATION_CHANGELOG.md), and
[handover records](Docs/handovers/).

## Status and roadmap

Local stdio operation is the release baseline. Hosted mode for ChatGPT, Grok,
and web clients is later work and remains subject to provider approval,
authentication, and privacy review.

## Disclaimer and license

Arin JobFit is independent and is not affiliated with, endorsed by, sponsored
by, or operated by Naukri, Info Edge, Indeed, Inc., or any other job portal.
Naukri and Indeed are trademarks of their respective owners. Licensed under
the [Apache License 2.0](LICENSE).
