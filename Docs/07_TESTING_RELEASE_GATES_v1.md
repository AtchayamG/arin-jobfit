# Testing & Release Gates v1

A product cannot be marked release-ready until all applicable gates pass.

## Gate A — Contract
- MCP tool schemas validate
- error schemas validate
- capability metadata present
- no hidden provider calls from local-only tools

## Gate B — Unit
- normalization
- requirement extraction
- match scoring
- deduplication
- policy gate
- consent gate
- redaction

## Gate C — Integration
- stdio MCP client session
- remote Streamable HTTP session
- auth failure behavior
- expired token behavior
- provider permission-denied behavior
- timeout/retry behavior

## Gate D — Client compatibility
Verify at minimum:
- Claude Code
- OpenAI Codex

Then verify when available:
- Gemini CLI
- Kimi Code
- Grok remote MCP

A client is “supported” only after a repeatable test is documented.

## Gate E — Security
- dependency scan
- secrets scan
- prompt-injection tests
- SSRF/URL validation tests
- tenant isolation tests for hosted mode
- abuse/rate-limit tests

## Gate F — Portal compliance
- exact enabled capabilities mapped to current written authority
- portal-required disclosures present
- prohibited capabilities remain disabled
- no unsupported scraping/private endpoint dependency

## Gate G — Release evidence
- test report
- changelog
- known limitations
- deployment rollback plan
- handover updated

No Placeholder Completion Rule applies to every gate.
