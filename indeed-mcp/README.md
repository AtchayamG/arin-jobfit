# indeed-mcp

> **Notice:** `indeed-mcp` is an internal engineering working name (BCP-004). It is an independent open-source project and is **not** affiliated with, endorsed by, sponsored by, or an official product of Indeed, Inc. "Indeed" is a registered trademark of Indeed, Inc.

`indeed-mcp` is a local, privacy-first Model Context Protocol (MCP) server running over standard I/O (`stdio`). It provides structured job analysis, requirement extraction, candidate-job match scoring (`fit-v1`), truthful CV notes preparation, interview planning, and human-controlled application handoff for jobs sourced from Indeed.

---

## BCP-003 Companion Positioning (Complements Indeed's Official MCP)

Indeed operates an official MCP server (beta; see [Indeed MCP documentation](https://docs.indeed.com/mcp/)) offering job search, job details, resume retrieval, and company data.

`indeed-mcp` is designed as a **complementary, local analysis and preparation companion**:

- It **never** calls Indeed's APIs or scraping endpoints.
- It **never** duplicates Indeed's official search or retrieval features.
- It operates completely on the user's local machine, analyzing job postings supplied directly by the user or relayed by an MCP client agent from Indeed's official connector.

### Agent-Relay Usage Example

When an MCP client agent retrieves a job posting via Indeed's official MCP connector, it can relay the job content into `indeed-mcp` for private evaluation using `jobs_ingest`:

```json
{
  "title": "Senior Staff Software Engineer",
  "company": "Acme Corporation",
  "location": "Austin, TX",
  "description": "Full job description text...",
  "source_url": "https://www.indeed.com/viewjob?jk=1234567890abcdef",
  "origin": "agent_relay",
  "relay_source": "indeed_official_mcp"
}
```

- **Local Mode:** Allowed. Job data stays strictly on the user's local workstation.
- **Hosted Mode:** Retaining relayed Indeed content is fail-closed (`blocked_by_provider_approval`) until approved in writing.

---

## Local-Only Privacy & Data Sovereignty

`indeed-mcp` is architected for strict data privacy and zero cloud telemetry:

- **Local Storage:** All ingested postings, profiles, match results, and audit trails reside in a local SQLite database (`node:sqlite`).
- **Default Database Location:**
  - **Windows:** `%APPDATA%\indeed-mcp\indeed-mcp.sqlite3`
  - **Linux / POSIX:** `${XDG_DATA_HOME:-$HOME/.local/share}/indeed-mcp/indeed-mcp.sqlite3`
  - **macOS:** `~/Library/Application Support/indeed-mcp/indeed-mcp.sqlite3`
  - **Custom Location:** Override via the `INDEED_MCP_DATA_DIR` environment variable.
- **Data Retention & Lifecycle:** Automatic pruning removes job postings older than configured retention limits (default: 90 days).
- **User Data Rights:**
  - `data_export`: Exports all stored profiles, jobs, applications, and audit records as structured JSON.
  - `data_purge`: A mandatory two-step confirmation flow (`step: 1` issues a token, `step: 2` executes) to permanently delete all local data.

---

## Human-Control Boundary

1. **Zero Autonomous Submissions:** `indeed-mcp` does not apply to jobs autonomously.
2. **Truthfulness Invariant:** CV preparation (`jobs_prepare_cv_notes`) and interview planning (`jobs_prepare_interview`) enforce that no skill or qualification claim is made that cannot be substantiated by the user's profile.
3. **Application Handoff:** `jobs_application_handoff` validates that the job URL belongs to an official Indeed domain (`indeed.com` and international equivalents) and marks critical actions (such as `final_submit`) as `human_only_fields`.
4. **Fail-Closed Policy Engine:** Provider write capabilities are gated by `config/policy.json` and fail closed (`blocked_by_provider_approval`).

---

## Tool Overview

`indeed-mcp` exposes 22 MCP tools. The authoritative schema specifications are defined in [`shared/contracts/tool-manifest.v1.json`](../shared/contracts/tool-manifest.v1.json).

- **Catalog & Discovery:** `tools/list`, `provider_capabilities`
- **Job Intake & Retrieval:** `jobs_ingest`, `jobs_get`, `jobs_list`, `jobs_search_local`, `jobs_delete`
- **Analysis & Extraction:** `jobs_normalize`, `jobs_extract_requirements`
- **Candidate Profiles:** `profile_save`, `profile_get`, `profile_list`, `profile_delete`
- **Matching & Deduplication:** `jobs_compare_profile`, `jobs_explain_match`, `jobs_shortlist`, `jobs_deduplicate`
- **Preparation & Handoff:** `jobs_prepare_cv_notes`, `jobs_prepare_interview`, `jobs_application_handoff`
- **Data Rights:** `data_export`, `data_purge`

---

## Build and Run

### Prerequisites

- Node.js >= 22.0.0
- npm >= 10.0.0

### Windows (PowerShell)

```powershell
# 1. Install dependencies in shared/job-core
cd ..\shared\job-core
npm ci

# 2. Install dependencies in indeed-mcp
cd ..\..\indeed-mcp
npm ci

# 3. Build standalone bundle
npm run build

# 4. Run verification gates
npm run verify

# 5. Run the MCP server
node dist/index.js
```

### POSIX (Linux / macOS)

```bash
# 1. Install dependencies in shared/job-core
cd ../shared/job-core
npm ci

# 2. Install dependencies in indeed-mcp
cd ../../indeed-mcp
npm ci

# 3. Build standalone bundle
npm run build

# 4. Run verification gates
npm run verify

# 5. Run the MCP server
node dist/index.js
```

---

## Client Integration

Guides for connecting `indeed-mcp` to popular MCP clients:

- [Claude Code](docs/clients/claude-code.md)
- [Codex CLI](docs/clients/codex.md)
- [Gemini CLI](docs/clients/gemini-cli.md)
- [Kimi Code](docs/clients/kimi-code.md)
