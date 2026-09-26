# Handover — WP-HS-003: Two Hosted Editions + Auth-less Discovery

- **Status**: Complete & Verified live on Cloud Run.
- **Root Cause & Evidence**: Claude.ai connector probe logs (`python-httpx/0.28.1`) showed 404s on OAuth discovery routes (`/.well-known/oauth-protected-resource/*`, `/.well-known/oauth-authorization-server`, `/register`) triggering client registration failure. Added compliant 404 JSON `{"error":"not_found"}` responses, normalized `Accept` headers to prevent 406 from SDK transport, and enabled CORS for `claude.ai` and `chatgpt.com`.
- **Two Endpoints**:
  - `POST /naukri/mcp`: Name `"Arin JobFit — Naukri edition"`, L0 policy, Naukri host allowlist only.
  - `POST /indeed/mcp`: Name `"Arin JobFit — Indeed edition"`, L0 policy, Indeed host allowlist only.
  - Generic `POST /mcp`: Returns 404 with JSON hint listing both endpoints.
  - Rate limiting scoped strictly to `POST /*/mcp`; health, discovery, landing, privacy unmetered.
- **Verification**: Local `npm run verify` passed (32/32 tests, >93% coverage on all files, lint/build/policy clean).
- **Deployment**: Image `asia-south1-docker.pkg.dev/arin-jobfit-335873/arin/arin-jobfit:cea71e7` deployed to Cloud Run revision `arin-jobfit-00006-k79`.
- **Live Smoke**: `scripts/smoke-live.mjs` passed 100% against `https://arin-jobfit-495824502157.asia-south1.run.app` (both edition serverInfo names, tool journeys, official URL gating, discovery 404 JSON, and generic 404 hint).
- **PR**: https://github.com/AtchayamG/arin-jobfit/pull/3 (`feat/hosted-6a`)
