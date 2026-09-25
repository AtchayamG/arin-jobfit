# Shared MCP Contract v1

## Design objective

Claude, Codex, Gemini, Kimi, Grok and other MCP clients should see a predictable tool vocabulary regardless of portal. Provider-specific differences are exposed through capability metadata rather than hidden behavior.

## Tool behavior rules

Every tool response should include:
- `status`
- `provider`
- `capability_mode`
- `source_provenance`
- `data`
- `warnings[]`
- `human_action_required` when relevant

Errors must be structured and actionable. Provider permission errors are not converted into empty results.

## Core tools

### `provider_capabilities()`
Reports enabled, disabled and pending capabilities with the reason/source of authority.

### `provider_policy_status()`
Reports policy snapshot date and whether official partner approval is recorded.

### `jobs_ingest(job)`
Accepts user/authorized-source supplied job information and creates a normalized record.

### `jobs_get(job_id)`
Reads a normalized stored job.

### `jobs_list(filters)`
Lists stored jobs.

### `jobs_search_local(query, filters)`
Searches only the connector's authorized local store. It must not silently turn into live portal scraping.

### `jobs_normalize(job)`
Transforms provider/user input into common schema.

### `jobs_extract_requirements(job_id)`
Returns must-have, preferred, responsibilities, experience, location, compensation and constraints when present.

### `jobs_compare_profile(job_id, profile_id|profile)`
Returns explainable match dimensions and gaps.

### `jobs_explain_match(job_id, profile_id|profile)`
Returns human-readable evidence for each score component.

### `jobs_shortlist(profile, filters)`
Ranks only already-authorized records using transparent criteria.

### `jobs_deduplicate(job_ids)`
Identifies likely duplicates and explains the matching evidence.

### `jobs_prepare_cv_notes(job_id, profile)`
Suggests truthful emphasis/reordering; never invents experience.

### `jobs_prepare_interview(job_id, profile)`
Generates interview topics/questions grounded in the JD and profile.

### `jobs_application_handoff(job_id)`
Returns official source URL plus a human checklist. No submission is performed.


Tool naming (BCP-001, approved 2026-09-25): tool names use `snake_case` `<domain>_<verb>` and must match `^[a-zA-Z0-9_-]{1,64}$` (Claude API, OpenAI/Codex and Copilot reject dots).

### Profile & data-rights tools (BCP-002)
- `profile_upsert(profile, profile_id?)` creates or updates a stored profile (strict schema, no protected attributes).
- `profile_get(profile_id)` / `profile_list()` read stored profiles.
- `profile_delete(profile_id)` / `jobs_delete(job_id)` delete one record (destructive; annotated).
- `data_export()` exports all jobs and profiles (no audit data).
- `data_purge(confirmation_token?)`: step 1 returns a single-use, 5-minute token plus a summary; step 2 with the token deletes all user data.

Full schemas: `Docs/17_MCP_TOOL_SCHEMA_PLAN_v1.md`.

## Human approval envelope for any future write tool

If partner approval later allows external writes, every write must use a two-stage preview/confirm pattern:
1. prepare immutable preview
2. human explicitly confirms the exact action
3. execute once
4. read-back verification

Never allow “approve all future applications”.


## Change history
- 2026-09-25: BCP-001 and BCP-002 approved by owner.
