# Naukri MCP — Master Blueprint v1

## 1. Product identity

Working product: `naukri-mcp` / “Naukri MCP” — **internal working names only** (BCP-004, approved 2026-09-25). Before any public release the owner selects a neutral public brand, subject to trademark review; `naukri-mcp` remains the internal/serverInfo identifier until then. Independent third-party software unless and until Naukri/Info Edge provides written approval. Public releases must not imply endorsement.

## 2. Goal

Provide an MCP interface for understanding, organizing and preparing for Naukri opportunities while using only capabilities that are explicitly allowed.

## 3. Runtime modes

### Standalone Safe Mode — default

Input originates from the human or another source the user is authorized to provide. Example: JD text, title, employer, location, experience, salary range and URL copied from a Naukri listing.

Allowed:
- ingest supplied job data
- normalize and deduplicate
- extract skills/requirements
- compare with user-supplied profile/CV
- explain match and gaps
- shortlist stored jobs
- prepare truthful CV tailoring notes
- prepare interview questions and study plan
- return official source URL for manual action

Not allowed:
- automated authenticated scraping
- private endpoint calls
- CAPTCHA/bot-control bypass
- automatic profile edits
- automatic applications

### Partner Mode — disabled until written approval

A provider adapter may call official Naukri/Info Edge/Zwayam interfaces only after documentation, credentials, scope and usage limits are recorded in `Docs/09_DECISIONS_LOG.md`.

## 4. Proposed MCP tools

Read/analysis tools:
- `jobs_ingest`
- `jobs_get`
- `jobs_list`
- `jobs_search_local`
- `jobs_normalize`
- `jobs_extract_requirements`
- `jobs_compare_profile`
- `jobs_explain_match`
- `jobs_shortlist`
- `jobs_deduplicate`
- `jobs_prepare_cv_notes`
- `jobs_prepare_interview`
- `jobs_application_handoff`
- `provider_capabilities`
- `provider_policy_status`

Future partner-only tools must use a `provider_` name prefix and remain hard-disabled until approved.


Profile & data-rights tools (added by BCP-002, approved 2026-09-25; local store only, L0):
- `profile_upsert`
- `profile_get`
- `profile_list`
- `profile_delete`
- `jobs_delete`
- `data_export`
- `data_purge` (two-step confirmation token)

Tool naming (BCP-001, approved 2026-09-25): tool names use `snake_case` `<domain>_<verb>` and must match `^[a-zA-Z0-9_-]{1,64}$` (Claude API, OpenAI/Codex and Copilot reject dots).

## 5. Fit scoring

The “Fit Score” is decision support, not an employability prediction. It must be explainable and decompose into visible factors such as:
- must-have skill coverage
- relevant experience coverage
- seniority alignment
- location/remote alignment
- employment-type alignment
- domain relevance
- explicit deal-breakers

Never infer protected characteristics or use them in scoring.

## 6. Data model

Minimum normalized job fields:
- provider
- provider_job_id when permitted
- source_url
- title
- company
- location
- remote_mode
- employment_type
- experience_min/max
- compensation text/range when supplied
- description
- required_skills
- preferred_skills
- responsibilities
- qualifications
- posted_at when supplied
- retrieved/ingested_at
- source_provenance
- retention_class

## 7. Partner-readiness

Prepare:
- architecture diagram
- data-flow diagram
- tool manifest
- threat model
- privacy statement
- deletion/retention behavior
- demo video
- test report
- list of requested Naukri capabilities
- business value statement for job seekers and Naukri

## 8. Official contact path identified

- `applyintegration@naukri.com` — published by Naukri Recruiter Zone for apply integration enquiries.
- `opendoors@zwayam.com` — published by the Zwayam integration developer hub.

Contact is for partnership discovery; it does not by itself authorize API use.


## Change history
- 2026-09-25: BCP-001 (snake_case tool names), BCP-002 (profile & data-rights tools), BCP-004 (internal working name) approved by owner.
