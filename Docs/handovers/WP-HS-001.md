# Handover: WP-HS-000 & WP-HS-001 — Hosted Stateless MCP (Phase 6a)

## Part A: WP-HS-000 Google Cloud Setup
- **Project**: `arin-jobfit-335873` (Number: `495824502157`), Region: `asia-south1`
- **Billing**: Account `0195A3-6103C9-0112ED` ("My Maps Billing Account 1", open)
- **Enabled APIs**: `run.googleapis.com`, `artifactregistry.googleapis.com`, `cloudbuild.googleapis.com`, `billingbudgets.googleapis.com`
- **Budget**: ID `b7d96c59-a32b-4355-9c9c-af075abe990b`, Amount: ₹100 INR, Thresholds: 50%, 90%, 100%
- **gcloud CLI**: Google Cloud SDK 539.0.0 (core 2025.09.19)

## Part B: WP-HS-001 Implementation
- **Status**: Complete
- **Commit**: (Pending commit) `WP-HS-001: hosted stateless MCP (Phase 6a)`
- **Files Created/Modified**:
  - `hosted-mcp/` (`package.json`, `tsconfig.json`, `tsup.config.ts`, `vitest.config.ts`, `eslint.config.js`, `.prettierrc.json`)
  - `hosted-mcp/config/policy.json` (L0 enabled, L1+ blocked)
  - `hosted-mcp/src/` (`index.ts`, `server.ts`, `tools.ts`, `resolve.ts`, `types.ts`, `security.ts`, `http.ts` - all <= 200 lines)
  - `hosted-mcp/tests/` (`fixtures.ts`, `unit-tools.test.ts`, `security.test.ts`, `invariants.test.ts`, `edge-cases.test.ts`, `integration-http.test.ts`)
  - `hosted-mcp/docs/` (`DEPLOY.md`, `clients.md`)
  - `hosted-mcp/Dockerfile`, `hosted-mcp/.dockerignore`
  - `.github/workflows/ci.yml` (added hosted-mcp install, build, verify, audit)
- **Tools Exposed (6)**: `jd_analyze`, `fit_score`, `cv_notes`, `interview_prep`, `application_handoff`, `capabilities_list`
- **Tests & Coverage**: 26 tests (5 test suites, 100% pass), 92.53% line coverage (>= 90% gate met)
- **Security Controls**:
  1. 64 KB JSON request body limit (`413 Payload Too Large`)
  2. Token-bucket rate limiter ~30 req/min per IP (`429 Too Many Requests` + `Retry-After`)
  3. Host header validation / DNS rebinding protection (`403 Forbidden`)
  4. Strict CORS allowing configured origins with preflight support (no wildcard `*`)
  5. Privacy-preserving HTTP logging (zero body/auth logging, generic sanitized 500 errors)
- **Docker Note**: Multi-stage non-root container image defined in `Dockerfile`. Local container run skipped per rule B8 (Docker daemon not running); deployment is ready for Cloud Run buildpacks or direct Docker push.
- **job-core Exports**: No additions required; all functions imported cleanly from existing modules.
- **Open Risks / Next Steps**: Phase 6b Cloud Run deployment (`gcloud run deploy --source .`) and live endpoint smoke verification with Claude Desktop / LibreChat / Gemini CLI.
