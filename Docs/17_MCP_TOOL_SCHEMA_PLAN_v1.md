# MCP Tool Schema Plan v1

Author: Claude (Principal Architect) · Date: 2026-09-25 · Contract version: `1.0.0`
Tool names assume **BCP-001 (snake_case)**. Tools marked ★ assume **BCP-002**. If either BCP is rejected, this document is revised before Phase 2 and Phase 1 is unaffected.

## 1. Protocol targets

- Serve both 2025-era clients (2025-06-18 / 2025-11-25) and 2026-07-28 clients via SDK v2.
- **Stateless:** no per-connection state. Cross-call state only through server-minted IDs (`job_…`, `prof_…`, `cfm_…`).
- **Tools only.** No resources, prompts, sampling, roots, elicitation or logging capability in v1. Logs go to stderr.
- `tools/list` returns tools in a fixed alphabetical order. Descriptions are static strings and never include user or JD content.

## 2. Tool result mapping

Every tool call returns:

- `structuredContent`: the Envelope (§3), valid against the tool's `outputSchema`.
- `content`: one `text` item holding `JSON.stringify(envelope)`, for clients without `structuredContent` support. Truncated with a warning if it exceeds 64 KB.
- `isError`: `true` if and only if `envelope.status === "error"`.

JSON-RPC protocol errors (`-32602`) are used only for requests the SDK rejects before a handler runs (schema-invalid arguments). All domain, policy and permission failures are tool results with `isError: true`, **never empty data**.

## 3. Envelope (`envelope.schema.json`)

```jsonc
{
  "contract_version": "1.0.0",
  "status": "ok | partial | error",
  "provider": "naukri | indeed",
  "capability_mode": "L0 | L1 | L2 | L3 | L4",
  "source_provenance": [ { "kind": "user_supplied | agent_relay | provider_api | derived",
                           "detail": "string ≤200", "captured_at": "RFC3339" } ],
  "data": { } | null,
  "warnings": [ { "code": "WARNING_CODE", "message": "string", "field": "string?" } ],
  "human_action_required": null | { "reason": "string", "actions": ["string"],
                                    "official_url": "https URL | null" },
  "error": null | { "code": "ERROR_CODE", "message": "string", "retryable": false,
                    "remediation": "string", "capability_id": "string?" },
  "meta": { "tool": "string", "request_id": "uuid", "server": "naukri-mcp|indeed-mcp",
            "server_version": "semver", "policy_snapshot_date": "YYYY-MM-DD",
            "scoring_version": "fit-v1?" }
}
```

### Error codes

`INVALID_INPUT`, `INPUT_TOO_LARGE`, `NOT_FOUND`, `UNSAFE_URL`, `CONFLICT`, `CONFIRMATION_REQUIRED`, `CONFIRMATION_INVALID`, `CAPABILITY_DISABLED`, `BLOCKED_BY_PROVIDER_APPROVAL`, `POLICY_STALE`, `RATE_LIMITED`, `UNAUTHORIZED`\*, `FORBIDDEN`\*, `INTERNAL`. (\* hosted only)

### Warning codes

`UNTRUSTED_CONTENT`, `PROMPT_INJECTION_SUSPECTED`, `CONTENT_SANITIZED`, `POTENTIALLY_DISCRIMINATORY_REQUIREMENT`, `FIELD_UNPARSED`, `URL_NOT_OFFICIAL`, `DUPLICATE_SUSPECTED`, `OUTPUT_TRUNCATED`, `LOW_CONFIDENCE`.

`INTERNAL` errors carry a generic message and the `request_id` only. Details go to the stderr log, redacted.

## 4. Tool catalogue (identical in both products)

Annotation key: RO = `readOnlyHint`, D = `destructiveHint`, I = `idempotentHint`. `openWorldHint` is **false** for every L0 tool.

| Tool | Level | Ann. | Input (summary) | `data` output (summary) |
|---|---|---|---|---|
| `provider_capabilities` | L0 | RO | `{}` | `capabilities[] {id, level, status: enabled\|disabled\|blocked_by_provider_approval\|pending, reason, approval_ref}` |
| `provider_policy_status` | L0 | RO | `{}` | `{snapshot_date, stale, stale_after_days, partner_approval_recorded: bool, approvals[]}` |
| `jobs_normalize` | L0 | RO,I | `{job: JobInput}` | `{job: Job}`, not persisted |
| `jobs_ingest` | L0 | — | `{job: JobInput, retention_class?}` | `{job_id, job: Job, duplicates[]}` |
| `jobs_get` | L0 | RO,I | `{job_id, include_description?: bool=false}` | `{job: Job}`. Description only when requested, wrapped as untrusted |
| `jobs_list` | L0 | RO,I | `{filters?, page_size≤50, cursor?}` | `{items: JobSummary[], next_cursor}` |
| `jobs_search_local` | L0 | RO,I | `{query ≤200, filters?, page_size≤50, cursor?}` | as `jobs_list`, local store only |
| `jobs_extract_requirements` | L0 | RO,I | `{job_id}` | `Requirements` (§6) |
| `jobs_compare_profile` | L0 | RO,I | `{job_id, profile_id? \| profile?}` (exactly one) | `MatchResult` (§7) |
| `jobs_explain_match` | L0 | RO,I | same | `{summary_facts[], dimensions[{name, evidence[], gaps[]}], disclaimer}` |
| `jobs_shortlist` | L0 | RO,I | `{profile_id? \| profile?, filters?, limit≤50}` | `{ranked[{job_id, fit_score, band, top_reasons[], blockers[]}]}` |
| `jobs_deduplicate` | L0 | RO,I | `{job_ids[2..50]}` | `{groups[{job_ids[], evidence[]}]}` |
| `jobs_prepare_cv_notes` | L0 | RO,I | `{job_id, profile_id? \| profile?}` | `{emphasize[{requirement, profile_evidence[{field_path, text}]}], gaps[], do_not_claim[], truthfulness_note}` |
| `jobs_prepare_interview` | L0 | RO,I | `{job_id, profile_id? \| profile?}` | `{topics[{topic, source: jd\|gap, requirement_ref, question_seeds[], study_pointers[]}]}` |
| `jobs_application_handoff` | L0 | RO,I | `{job_id}` | `{official_url, url_is_official, checklist[], human_only_fields[]}`, always with `human_action_required` |
| ★ `jobs_delete` | L0 | D,I | `{job_id}` | `{deleted: bool}` |
| ★ `profile_upsert` | L0 | — | `{profile: ProfileInput, profile_id?}` | `{profile_id, profile}` |
| ★ `profile_get` | L0 | RO,I | `{profile_id}` | `{profile}` |
| ★ `profile_list` | L0 | RO,I | `{}` | `{items[{profile_id, label, updated_at}]}` |
| ★ `profile_delete` | L0 | D,I | `{profile_id}` | `{deleted: bool}` |
| ★ `data_export` | L0 | RO | `{}` | `{export_version, jobs[], profiles[], exported_at}` (no audit PII) |
| ★ `data_purge` | L0 | D | `{confirmation_token?}` | Step 1 → `CONFIRMATION_REQUIRED` + `{confirmation_token (cfm_…, 5 min, single use), summary}`. Step 2 with token → `{purged_counts}` |

`jobs_application_handoff` never submits anything. `human_only_fields` always lists: screening answers, salary declaration, notice period, personal-information changes, and final submit.

Future `provider_*` tools (L1+) are **not registered** until approved. Capabilities for them appear in `provider_capabilities` as `blocked_by_provider_approval`.

## 5. Portable Schema Subset (all `inputSchema`s)

Required for Gemini CLI, Kimi, Grok and OpenAI compatibility:

- Root is `type: "object"` with `properties`, `required` and `additionalProperties: false`.
- Allowed keywords: `type`, `properties`, `required`, `items`, `enum` (strings), `description`, `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`, `additionalProperties: false`, `default`.
- **Not allowed** in input schemas: `$ref`, `$defs`, `oneOf`, `anyOf`, `allOf`, `not`, `patternProperties`, `if/then/else`, `const`, tuple `items`, and `format` other than `date`, `date-time` and `uri`.
- "Exactly one of `profile_id` / `profile`" is enforced in the handler (`INVALID_INPUT`), not in the schema.
- Nesting depth ≤ 4. Every string has `maxLength`. Every array has `maxItems`.
- `outputSchema` may use `anyOf` for nullable fields, since clients do not send it to model APIs. Keep it simple anyway.
- A unit test walks every generated input schema and fails on any disallowed keyword.

## 6. Core data shapes

**JobInput** (user or agent supplied):

- `title` 1–200 (required)
- `description` 1–50,000 (required)
- `company` ≤200
- `location` ≤200
- `source_url` ≤2,048
- `employment_type_text` ≤100
- `experience_text` ≤100
- `compensation_text` ≤200
- `posted_at_text` ≤100
- `provider_job_id` ≤100
- `origin`: `user_paste | agent_relay` (default `user_paste`)
- `relay_source` ≤100 (for example `indeed_official_mcp`)

**Job** (normalized, Blueprint §6):

- `job_id`, `provider`, `provider_job_id|null`, `source_url|null`, `source_url_is_official`
- `title`, `company|null`, `location{raw, city|null, country|null}`
- `remote_mode: onsite|hybrid|remote|unknown`
- `employment_type: full_time|part_time|contract|internship|temporary|unknown`
- `experience{min_years|null, max_years|null, raw|null}`
- `compensation{raw|null, currency|null, min|null, max|null, period: year|month|hour|unknown, disclosed: bool}`
- `description` (sanitized)
- `required_skills[]`, `preferred_skills[]`, `responsibilities[]`, `qualifications[]`
- `posted_at|null`, `ingested_at`, `source_provenance[]`
- `retention_class: session|standard_180d|pinned`
- `fingerprint`, `flags[]`

**Requirements:** `{must_have[{text, skills[]}], preferred[...], responsibilities[], experience, location, remote_mode, employment_type, compensation, constraints[], discriminatory_flags[{text, category}]}`

**ProfileInput** (strict; **no protected-attribute fields exist**):

- `label` ≤100
- `headline` ≤300
- `total_experience_years` 0–60
- `skills[≤200]{name, years?, level?: beginner|intermediate|advanced|expert}`
- `roles[≤50]{title, company, start (YYYY-MM), end (YYYY-MM|present), highlights[≤20] ≤500}`
- `education[≤20]{qualification, institution, year?}`
- `certifications[≤50]{name, issuer?, year?}`
- `preferences{locations[], remote_modes[], employment_types[], min_compensation?{amount, currency, period}, deal_breakers[≤20]}`
- `summary_text` ≤20,000 (optional pasted CV text)

## 7. fit-v1 scoring (deterministic)

| Dimension | Weight | Basis |
|---|---|---|
| must_have_skills | 0.35 | share of JD must-have skills found in profile skills/role highlights |
| experience | 0.20 | profile years vs JD min/max (graded, not binary) |
| preferred_skills | 0.10 | share of preferred skills covered |
| seniority | 0.10 | title-level keywords vs years (lookup table) |
| location_remote | 0.10 | preference vs job location/remote mode |
| employment_type | 0.05 | preference match |
| domain | 0.10 | overlap of domain keywords (taxonomy categories) |

- A dimension whose job data is `unknown` is **excluded** and its weight re-normalized. It is reported as `status: unknown`.
- `confidence = Σweights(known) / 1.0`. If confidence < 0.6, add the `LOW_CONFIDENCE` warning.
- A deal-breaker hit caps the score at 0.30 and adds `blockers[]`.
- Bands: `strong` ≥ 0.75, `moderate` ≥ 0.50, `weak` < 0.50.
- Output `MatchResult`: `{fit_score 0–1 (2dp), band, confidence, dimensions[{name, weight, score, status: matched|partial|missing|unknown, evidence[], gaps[]}], blockers[], disclaimer}`.
- The disclaimer text is fixed: *"Decision support only; not a prediction of hiring outcome."*
- The score never uses discriminatory flags, name, gender, age or any inferred attribute.

## 8. Limits (defaults, configurable down, never up without Architect approval)

| Item | Limit |
|---|---|
| Any single request | 256 KB |
| JD description | 50,000 chars |
| Profile summary_text | 20,000 chars |
| Jobs per local store | 10,000 |
| Profiles | 50 |
| Page size | 50 |
| Regex processing per field | < 50 ms at the maximum input size (tested) |

## 6A. Authoritative field definitions (Addendum 2026-09-25, resolves WP-SH-001 query)

Conventions: all objects strict. `T|null` fields are required keys whose value may be null. Timestamps are RFC 3339 UTC strings. Arrays of strings are de-duplicated by the producer. Money amounts are in whole currency units (INR 1,200,000, not "12 lakh").

**Common**
- `JobId`: `^job_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$` (lowercase UUID v4)
- `ProfileId`: same pattern with the `prof_` prefix
- `Fingerprint`: `^sha256:[0-9a-f]{64}$`
- `RemoteMode`: onsite | hybrid | remote | unknown
- `EmploymentType`: full_time | part_time | contract | internship | temporary | unknown
- `RetentionClass`: session | standard_180d | pinned
- `SkillName`: string 1–100 (canonical taxonomy name)
- `Location`: `{raw: string≤200|null, city: string≤100|null, country: ^[A-Z]{2}$|null}` (ISO 3166-1 alpha-2)
- `Experience`: `{min_years: number 0–60|null, max_years: number 0–60|null, raw: string≤100|null}`; refine: min ≤ max when both are non-null
- `Compensation`: `{raw: string≤200|null, currency: ^[A-Z]{3}$|null, min: number 0–1e9|null, max: number 0–1e9|null, period: year|month|hour|unknown, disclosed: boolean}`; refine: min ≤ max when both are non-null

**Job** (stored/normalized)
- `job_id`: JobId
- `provider`: ProviderId
- `provider_job_id`: string≤100|null
- `source_url`: https uri ≤2048|null
- `source_url_is_official`: boolean
- `title`: 1–200
- `company`: ≤200|null
- `location`: Location
- `remote_mode`: RemoteMode
- `employment_type`: EmploymentType
- `experience`: Experience
- `compensation`: Compensation
- `description`: 1–50,000 (sanitized)
- `required_skills`, `preferred_skills`: SkillName[≤100]
- `responsibilities`, `qualifications`: string≤1000[≤100]
- `posted_at`: date-time|null (only an absolute, parseable date; otherwise null)
- `posted_at_raw`: string≤100|null
- `ingested_at`: date-time
- `source_provenance`: Provenance[1..10]
- `retention_class`: RetentionClass
- `fingerprint`: Fingerprint
- `flags`: Warning[≤50]

**JobSummary** (list/search items)
- `job_id`, `provider`, `title`, `company`, `remote_mode`, `employment_type`, `ingested_at`, `retention_class`, `source_url_is_official`: as in Job
- `location_raw`: string≤200|null
- `experience_min_years`, `experience_max_years`: number|null
- `compensation_disclosed`: boolean
- `flag_count`: integer 0–50

**Requirements**
- `job_id`: JobId
- `must_have`, `preferred`: `{text: string≤500, skills: SkillName[≤20]}`[≤100]
- `responsibilities`: string≤1000[≤100]
- `experience`: Experience
- `location`: Location
- `remote_mode`: RemoteMode
- `employment_type`: EmploymentType
- `compensation`: Compensation
- `constraints`: `{kind: notice_period|shift|travel|relocation|work_authorization|certification|education|other, text: string≤500}`[≤50]
- `discriminatory_flags`: `{text: string≤500, category: age|gender|religion|caste|marital_status|nationality_origin|disability|appearance|other}`[≤50]

**Profile** (stored) = all ProfileInput fields (optional fields become `T|null`, and arrays default to `[]`) plus:
- `profile_id`: ProfileId
- `schema_version`: "1"
- `created_at`, `updated_at`: date-time

**MatchDimension**
- `name`: must_have_skills|experience|preferred_skills|seniority|location_remote|employment_type|domain
- `weight`: number 0–1
- `score`: number 0–1|null (null when status is unknown)
- `status`: matched|partial|missing|unknown
- `evidence`, `gaps`: string≤500[≤20]

**MatchResult**
- `job_id`: JobId
- `profile_ref`: ProfileId|"inline"
- `scoring_version`: "fit-v1"
- `fit_score`: number 0–1 (2dp)
- `band`: strong|moderate|weak
- `confidence`: number 0–1
- `dimensions`: MatchDimension[7]
- `blockers`: string≤500[≤20]
- `disclaimer`: string (the fixed text in §7)

**Architect ruling (review 1):** The stricter ProfileInput limits Codex chose in WP-SH-001 are accepted as normative:
- names 200 chars
- location preferences 50×200
- remote/employment preferences 4/6
- deal breakers 500 chars
- skill years 0–60
- years 1900–2100
- money 0–1e9 with ISO-4217 currency

§6A's UTC (`Z`) timestamps supersede the broader RFC 3339 wording in §3.
