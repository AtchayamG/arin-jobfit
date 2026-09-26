# Cloud Run Deployment Guide — Arin JobFit Hosted MCP

This guide documents the exact deployment and verification procedure for the stateless hosted MCP server deployed to Google Cloud Run under project `arin-jobfit-335873` in region `asia-south1`.

## Live Service Information

- **Live Service URL**: `https://arin-jobfit-495824502157.asia-south1.run.app`
- **Streamable HTTP MCP Endpoint**: `https://arin-jobfit-495824502157.asia-south1.run.app/mcp`
- **Health Check Endpoint**: `https://arin-jobfit-495824502157.asia-south1.run.app/health` (`/healthz` also supported locally; `/health` used on Cloud Run as Google Front End reserves `*z` paths at the edge)
- **Status / Privacy Disclosures**:
  - `GET /` — Public landing page and stateless disclosure
  - `GET /privacy` — Privacy statement
- **GCP Project**: `arin-jobfit-335873` (Number: `495824502157`)
- **Region**: `asia-south1` (Mumbai)
- **Container Registry**: `asia-south1-docker.pkg.dev/arin-jobfit-335873/arin/arin-jobfit`

---

## Deployment Procedure (Step-by-Step)

### 1. Artifact Registry Repository Creation

```powershell
gcloud.cmd artifacts repositories create arin `
  --repository-format=docker `
  --location=asia-south1
```

### 2. Multi-Stage Container Build & Push via Cloud Build

From repo root (with repo-root context for shared/job-core):

```powershell
$SHORT_SHA = (git rev-parse --short HEAD)
gcloud.cmd builds submit `
  --config hosted-mcp/cloudbuild.yaml `
  --substitutions=SHORT_SHA=$SHORT_SHA .
```

### 3. Deploy Service to Cloud Run

```powershell
gcloud.cmd run deploy arin-jobfit `
  --image asia-south1-docker.pkg.dev/arin-jobfit-335873/arin/arin-jobfit:$SHORT_SHA `
  --region asia-south1 `
  --allow-unauthenticated `
  --min-instances 0 `
  --max-instances 2 `
  --concurrency 20 `
  --memory 512Mi `
  --cpu 1 `
  --timeout 30 `
  --set-env-vars TRUST_PROXY=1,ALLOWED_HOSTS=placeholder
```

### 4. Lock ALLOWED_HOSTS to Live Domain

Read service URL from output, then lock down `ALLOWED_HOSTS` to prevent DNS rebinding:

```powershell
gcloud.cmd run services update arin-jobfit `
  --region asia-south1 `
  --update-env-vars ALLOWED_HOSTS=arin-jobfit-495824502157.asia-south1.run.app
```

---

## Automated Live Smoke Verification

Run the full end-to-end smoke test against the live Cloud Run deployment:

```powershell
node hosted-mcp/scripts/smoke-live.mjs https://arin-jobfit-495824502157.asia-south1.run.app
```

The script verifies:

1. `GET /health` returns 200 OK (`status: "ok"`, `version: "0.1.0"`).
2. `GET /` and `GET /privacy` return 200 OK with required disclosures.
3. Host header validation: unallowed Host returns 403 Forbidden.
4. MCP Client over Streamable HTTP: connects and lists 6 tools.
5. Full 6-tool journey (`jd_analyze`, `fit_score`, `cv_notes`, `interview_prep`, `application_handoff`, `capabilities_list`) with AJV envelope schema validation.
6. Prompt injection JD detection: flagged with `PROMPT_INJECTION_SUSPECTED`.
7. Rate limiting: 35 rapid requests trigger 429 with `Retry-After`.
