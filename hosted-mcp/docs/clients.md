# Client Setup Guide — Arin JobFit Hosted MCP

> **Notice:** All client integrations listed below are **to be verified** once the hosted service is live.

## 1. ChatGPT (Developer Mode / Custom Connector)

- **Status:** To be verified
- **Steps:**
  1. Open ChatGPT web interface.
  2. Navigate to **Settings** → **Apps & Connectors** → **Advanced** → **Developer mode**.
  3. Click **Create connector**.
  4. Enter Connector URL: `https://<service-host>/mcp`
  5. Select Authentication: **No authentication**
  6. Save and test querying job analysis.

## 2. Claude.ai (Custom Connector)

- **Status:** To be verified
- **Steps:**
  1. Open Claude.ai.
  2. Navigate to **Settings** → **Connectors**.
  3. Click **Add custom connector**.
  4. Enter Server URL: `https://<service-host>/mcp`
  5. Save and enable connector.

## 3. MCP Inspector

- **Status:** To be verified
- **Steps:**
  1. Launch MCP Inspector:
     ```bash
     npx @modelcontextprotocol/inspector
     ```
  2. Select Transport: **Streamable HTTP**
  3. Enter URL: `https://<service-host>/mcp` (or `http://localhost:8080/mcp` for local development)
  4. Connect and test calling tools (`jd_analyze`, `fit_score`, `cv_notes`, `interview_prep`, `application_handoff`, `capabilities_list`).
