# Cloud Run Deployment Guide — Arin JobFit Hosted MCP

This guide outlines deploying the stateless hosted MCP server to Google Cloud Run under project `arin-jobfit-335873` in region `asia-south1`.

## Prerequisites

1. Google Cloud SDK installed and authenticated:

   ```powershell
   gcloud.cmd auth login
   gcloud.cmd config set project arin-jobfit-335873
   gcloud.cmd config set run/region asia-south1
   ```

2. Required APIs already enabled (from WP-HS-000):
   - `run.googleapis.com`
   - `artifactregistry.googleapis.com`
   - `cloudbuild.googleapis.com`
   - `billingbudgets.googleapis.com`

3. Budget alert active (100 INR with 50%, 90%, 100% threshold rules).

## Deploy to Cloud Run

Deploy directly from source with buildpack/Dockerfile:

```powershell
gcloud.cmd run deploy arin-jobfit `
  --source hosted-mcp `
  --region asia-south1 `
  --allow-unauthenticated `
  --min-instances 0 `
  --max-instances 2 `
  --concurrency 20 `
  --memory 512Mi `
  --set-env-vars ALLOWED_HOSTS=<service-host>
```

Replace `<service-host>` with the assigned Cloud Run service domain (e.g. `arin-jobfit-xxxxxxxxxx-el.a.run.app`).

## Verification Post-Deployment

1. Health check:

   ```powershell
   curl.exe https://<service-host>/healthz
   ```

   Expected response: `{"status":"ok","version":"0.1.0"}`

2. Landing page:

   ```powershell
   curl.exe https://<service-host>/
   ```

3. Privacy statement:
   ```powershell
   curl.exe https://<service-host>/privacy
   ```
