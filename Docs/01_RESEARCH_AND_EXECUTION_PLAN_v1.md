# Job Portal MCPs — Research & Execution Plan v1

Research snapshot: 25 September 2026.

## 1. Key research findings

### Indeed

Indeed operates a formal Partner/Developer ecosystem. Its Developer Agreement says API access is permissioned, integrations can require written approval before use/promotion/distribution, and the approved purpose controls what the integration may do. Indeed also requires separate OAuth applications for separate applications/testing-production contexts where applicable.

The current Partner Console documentation states that services are provisioned to an app and that review status is visible in the console. To request additional services, Indeed directs partners to their Indeed representative or `marketplacesupport@indeed.com`.

Critically, the Developer Agreement includes restrictions against scraping/circumventing limits and against algorithmic queries/calls that replace human input. Therefore `indeed-mcp` must not be designed as a scheduled autonomous mass-search bot against Indeed APIs. Every provider call must be backed by an allowed documented capability and appropriate human initiation/consent.

Official sources:
- https://docs.indeed.com/legal-terms/developer-agreement
- https://docs.indeed.com/legal-terms/developer-agreement-third-party
- https://docs.indeed.com/getstarted/partner-console
- https://docs.indeed.com/support/
- https://docs.indeed.com/legal-terms/oauth

### Naukri / Info Edge ecosystem

Naukri publicly documents an apply-integration contact at `applyintegration@naukri.com`. The Zwayam developer portal describes an integration developer ecosystem and provides `opendoors@zwayam.com` as an integration contact.

This research did not identify a general public job-seeker API that can safely be assumed to allow third-party job search/profile management/application automation. Therefore `naukri-mcp` starts with a standalone human-assisted mode. Any direct Naukri API/search/apply capability is a disabled Partner Mode feature until written approval and official technical documentation are received.

Official sources:
- https://recruiterzone.naukri.com/make-your-job-posting-apply-process-seamless/
- https://developers.zwayam.com/customdomain

### Agent / MCP compatibility

MCP is a suitable cross-agent contract:
- Codex supports MCP server configuration.
- Claude Code supports MCP servers and project-level `.mcp.json`.
- Gemini CLI supports MCP servers.
- Kimi Code supports stdio and HTTP MCP servers.
- Grok supports custom remote MCP connectors; the server must be internet reachable for Grok's hosted connector flow.

Official sources:
- https://developers.openai.com/learn/docs-mcp
- https://docs.anthropic.com/en/docs/mcp
- https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md
- https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html
- https://docs.x.ai/grok/connectors
- https://docs.x.ai/developers/tools/remote-mcp

## 2. Product split

There are two deployable products, not one multi-portal runtime:

```text
Job-Portal-MCPs/
  naukri-mcp/
  indeed-mcp/
```

They can share schemas and design conventions, but must have independent configuration, release version, credentials, portal-policy gate, telemetry namespace and deployment.

## 3. Deployment modes

### Local developer / power-user mode

Use MCP stdio. Target clients: Claude Code, Codex, Gemini CLI, Kimi Code and compatible local clients.

### Hosted commercial mode

Use HTTPS Streamable HTTP MCP with OAuth or another approved user-authentication model. Required for hosted clients such as Grok custom remote MCP.

## 4. Capability maturity levels

- **L0 — Analysis only:** user supplies JD text/details; connector analyzes it locally.
- **L1 — Permitted retrieval:** official portal API or approved public source retrieves job data.
- **L2 — Account-linked read:** OAuth-approved user account data, only when documented/approved.
- **L3 — Assisted write:** future actions that change a portal account; always human-confirmed and only with written permission.
- **L4 — Application submission:** out of scope by default; enable only if explicitly authorized by portal documentation and the human confirms the exact application.

Current default for both products: L0. Indeed/Naukri provider adapters must fail closed when approval is absent.

## 5. Development phases

1. Architecture & contract freeze
2. Core normalization + profile/JD intelligence
3. Naukri standalone safe-mode MVP
4. Indeed standalone safe-mode MVP
5. MCP stdio compatibility matrix
6. Remote Streamable HTTP + tenant/auth layer
7. Security/privacy hardening
8. Portal partnership/approval requests
9. Official provider adapter implementation after permission
10. Commercial beta + metering/entitlements

## 6. Commercial paths

- End-user subscription for the portal-independent intelligence layer.
- Team/enterprise license.
- White-label or embedded integration.
- Portal partner/marketplace relationship if approved.
- Sponsored co-innovation only if the portal explicitly offers/negotiates it.

Do not assume sponsorship, official recognition, revenue share or marketplace placement until it is agreed in writing.
