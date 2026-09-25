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

### `provider.capabilities()`
Reports enabled, disabled and pending capabilities with the reason/source of authority.

### `provider.policy_status()`
Reports policy snapshot date and whether official partner approval is recorded.

### `jobs.ingest(job)`
Accepts user/authorized-source supplied job information and creates a normalized record.

### `jobs.get(job_id)`
Reads a normalized stored job.

### `jobs.list(filters)`
Lists stored jobs.

### `jobs.search_local(query, filters)`
Searches only the connector's authorized local store. It must not silently turn into live portal scraping.

### `jobs.normalize(job)`
Transforms provider/user input into common schema.

### `jobs.extract_requirements(job_id)`
Returns must-have, preferred, responsibilities, experience, location, compensation and constraints when present.

### `jobs.compare_profile(job_id, profile_id|profile)`
Returns explainable match dimensions and gaps.

### `jobs.explain_match(job_id, profile_id|profile)`
Returns human-readable evidence for each score component.

### `jobs.shortlist(profile, filters)`
Ranks only already-authorized records using transparent criteria.

### `jobs.deduplicate(job_ids)`
Identifies likely duplicates and explains the matching evidence.

### `jobs.prepare_cv_notes(job_id, profile)`
Suggests truthful emphasis/reordering; never invents experience.

### `jobs.prepare_interview(job_id, profile)`
Generates interview topics/questions grounded in the JD and profile.

### `jobs.application_handoff(job_id)`
Returns official source URL plus a human checklist. No submission is performed.

## Human approval envelope for any future write tool

If partner approval later allows external writes, every write must use a two-stage preview/confirm pattern:
1. prepare immutable preview
2. human explicitly confirms the exact action
3. execute once
4. read-back verification

Never allow “approve all future applications”.
