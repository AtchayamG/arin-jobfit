# Handover: WP-HS-001-R1 & WP-HS-002 — Cloud Run Deploy & Live Smoke

- **R-14/R-15 Fixes**: Repo-root Dockerfile build context with self-contained dist bundle (tsup stub for unused store/mcp); `getClientIp` supports `TRUST_PROXY=1` first-entry `X-Forwarded-For` with spoofed-header isolation. Local verify passed: 28 tests (5 suites, 100%), 92.8% line coverage.
- **Live MCP URL**: `https://arin-jobfit-495824502157.asia-south1.run.app/mcp`
- **Health / Disclosures**: `/health` (GFE reserves `*z` at edge; `/healthz` alias also supported), `/`, `/privacy`.
- **Live Smoke (`smoke-live.mjs`)**:
  - `GET /health`: 200 OK (cold start: 2.39s from scale-to-zero; warm latency ~489ms)
  - `GET /` & `GET /privacy`: 200 OK with required stateless disclaimers
  - Host validation: 403 Forbidden on unallowed Host header
  - MCP Client (Streamable HTTP): connected, listed 6 tools
  - 6-Tool Journey: `jd_analyze` (extracted), `fit_score` (0.89), `cv_notes` (emphasize/do_not_claim), `interview_prep` (8 topics), `application_handoff` (human gate `final_submit`), `capabilities_list` (7 caps) — 100% AJV schema envelope valid
  - Injection detection: flagged `PROMPT_INJECTION_SUSPECTED` on hostile JD
  - Rate limiting: 35 concurrent requests triggered 429 (`Retry-After: 2`)
- **Container Image**: `asia-south1-docker.pkg.dev/arin-jobfit-335873/arin/arin-jobfit:36745bf` (77.35 MiB compressed, non-root `node:22-slim`).
- **PR URL**: `https://github.com/AtchayamG/arin-jobfit/pull/3` (branch `feat/hosted-6a`).
- **Cost Notes**: 0 min instances, 512Mi RAM / 1 vCPU, 2 max instances; well within the ₹100 INR billing budget.
