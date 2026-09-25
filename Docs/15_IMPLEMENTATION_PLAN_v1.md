# Implementation Plan v1

Author: Claude (Principal Architect) · Date: 2026-09-25 · Depends on: Doc 14 (ADR-001..009), Doc 17, Doc 18.

## 1. Target repository layout

```text
Job-Portal-MCPs/
├─ README.md  AGENTS.md  .gitignore  .gitattributes  MANIFEST.json
├─ Docs/
│  ├─ 00–19 authority / plan docs
│  └─ handovers/                 # one file per work package (ADR-008)
├─ Prompts/
├─ shared/
│  ├─ contracts/                 # tool-manifest.v1.json (generated) + README
│  ├─ schemas/                   # *.schema.json (generated from job-core zod) + README
│  └─ job-core/                  # @jpm/job-core — provider-neutral library (ADR-003)
│     ├─ package.json  tsconfig.json  eslint.config.js  vitest.config.ts
│     ├─ data/skills-taxonomy.v1.json
│     ├─ scripts/                # export-schemas.ts, policy-lint.ts
│     ├─ src/
│     │  ├─ schemas/             # zod: job, profile, match, envelope, error, provenance
│     │  ├─ envelope/            # envelope + error builders
│     │  ├─ policy/              # capability registry, gate engine, staleness
│     │  ├─ sanitize/            # untrusted-text sanitizer + injection detector, url validator
│     │  ├─ normalize/           # JobInput → Job
│     │  ├─ extract/             # requirements, skills, experience, compensation, flags
│     │  ├─ match/               # fit-v1 scoring, explain, shortlist
│     │  ├─ dedupe/
│     │  ├─ prepare/             # cv-notes, interview, handoff builders
│     │  ├─ store/               # repository interfaces + sqlite impl + retention + audit
│     │  ├─ mcp/                 # tool registry, result mapping, handlers (SDK v2 adapter)
│     │  └─ index.ts
│     └─ tests/                  # mirrors src/ ; tests/fixtures/ (incl. adversarial corpus)
├─ naukri-mcp/
│  ├─ package.json  tsconfig.json  tsup.config.ts
│  ├─ config/policy.json         # Naukri capability policy (ADR-006)
│  ├─ src/                       # composition root: product config, host allowlist, stdio entry
│  ├─ tests/                     # product + stdio integration tests
│  ├─ docs/                      # install guides per MCP client
│  └─ scripts/
└─ indeed-mcp/                   # same shape, fully independent
```

Rules:

- No root `package.json` and no npm workspaces. Each of the three packages has its own `package.json` and lockfile.
- Products consume `@jpm/job-core` via `"file:../shared/job-core"` and bundle it (tsup `noExternal`). A product's `dist/` must run without the `shared/` folder present.
- `naukri-mcp` must never import from `indeed-mcp`, and the reverse. `job-core` must never import from either product and must contain no provider names in logic, except the `ProviderId` enum and `provider-hints` data files.
- Production source files ≤ 250 lines where practical.

## 2. Module responsibilities (job-core)

| Module | Responsibility | Must not |
|---|---|---|
| schemas | Single source of truth for all contract types (zod 4). Generates JSON Schema. | Contain logic. |
| envelope | Build success/error envelopes (Doc 17 §3). Map to MCP `CallToolResult` (`structuredContent` + JSON text + `isError`). | Swallow provider errors into empty data. |
| policy | Load/validate `policy.json`. `evaluate(capabilityId) → {allowed, level, reason, approval_ref}`. Staleness downgrade. `policy-lint`. | Allow anything absent from config (fail closed). |
| sanitize | NFKC normalization; strip control, zero-width and bidi characters; HTML→text; size limits; injection-pattern detection → warnings; URL validation. | Execute, fetch or interpret content. |
| normalize | `JobInput` → `Job` (Doc 17 §6). Fingerprint. Provider hints (for example "Lacs P.A."). | Fetch URLs. |
| extract | Sections; must-have vs preferred; skills via taxonomy; experience/compensation/location/remote/employment type; discriminatory-requirement flags. | Score on protected attributes. |
| match | fit-v1 deterministic scoring, per-dimension evidence, explain data, shortlist ranking. | Use any field not in the profile/job schema. |
| dedupe | Exact fingerprint plus near-duplicate (5-gram Jaccard) with evidence. | — |
| prepare | CV-notes evidence map, interview topic plan, application handoff checklist. | Invent profile content (truthfulness invariant). |
| store | `JobRepo`, `ProfileRepo`, `AuditRepo` interfaces. `node:sqlite` implementation. Migrations. Retention purge. Export/purge. | Build SQL from string concatenation. |
| mcp | Tool definitions (name, description, input/output schema, annotations), handler wiring, `createServer(productConfig)`. SDK v2 isolated here. | Leak stack traces or secrets to clients. |

## 3. Phases and exit criteria

| Phase | Name | Key WPs | Exit criteria (all required) |
|---|---|---|---|
| P0 | Architecture freeze | this doc set | Docs 14–18 issued. BCP-001..003 decided. git initialized (WP-SH-000). |
| P1 | job-core domain | SH-001..SH-007 | All modules above except `mcp` are implemented and tested. Coverage ≥ 90% lines, 100% branches in `policy/`. `npm run verify` green on Node 22 and 24. Claude review PASS. |
| P2 | Products over stdio | SH-008, NK-001, IN-001 | Both products start over stdio. `tools/list` is deterministic. Every tool returns a schema-valid envelope. L1+ calls return `BLOCKED_BY_PROVIDER_APPROVAL`. Gate A plus the stdio part of Gate C pass. |
| P3 | Security hardening | SEC-001, QA-001 | Gate E (local scope) passes. Adversarial report shows no open High findings. |
| P4 | Client compatibility | CMP-001 | Gate D: Claude Code and Codex verified with documented repeatable tests; Gemini CLI and Kimi Code verified or limitations documented. |
| P5 | Partner pack v1 | DOC-001 + Claude | Gate F evidence; architecture/data-flow diagrams; privacy statement; demo script; public brand decided (BCP-004). |
| P6 | Hosted Streamable HTTP | HS-001..00n (designed later) | OAuth 2.1 resource server, tenancy, rate limits, DPDP controls, Gate C (remote) and Gate E (hosted). Grok verification. |
| P7 | Provider adapters | — | **BLOCKED_BY_PROVIDER_APPROVAL.** Starts only after a written approval is recorded in Docs/09. |
| P8 | Commercial beta | — | Metering/entitlements, Gate G. |

## 4. Quality gates mapping (Doc 07)

- **Gate A (Contract):** generated schemas are checked into `shared/schemas` and a CI check fails on drift (`npm run schemas:check`). The contract test validates every tool output against its `outputSchema`.
- **Gate B (Unit):** each module has unit tests. Fixtures include real-world-shaped Naukri/Indeed JD text written by the developers (never scraped).
- **Gate C (Integration):** SDK v2 client drives each product over stdio (P2/P3). Remote in P6.
- **Gate D:** `naukri-mcp/docs/clients/*.md` and `indeed-mcp/docs/clients/*.md` hold repeatable steps and results.
- **Gate E:** `npm audit --omit=dev` (high+ = fail), secret scan (gitleaks, if available, else a documented alternative), adversarial suite, ReDoS timing tests.
- **Gate F:** `npm run policy:lint` in each product.
- **Gate G:** Docs/19 plus a release checklist.

## 5. Standard commands (each package)

```text
npm ci
npm run lint          # eslint + prettier --check
npm run typecheck     # tsc --noEmit
npm test              # vitest run --coverage
npm run build         # tsup
npm run verify        # all of the above (+ schemas:check in job-core, policy:lint in products)
```

Commands must work on Windows (PowerShell) and POSIX. Use no bash-only syntax in npm scripts; use node scripts instead.

## 6. Git and parallel-work protocol (ADR-008)

1. Single branch `main`. Each WP commits only files it owns: `git add <explicit paths>`, never `git add -A` or `git add .`.
2. Commit message format: `WP-XX-NNN: <summary>`.
3. Shared files (`package.json`, lockfile, `tsconfig`, `eslint.config.js`, `src/index.ts` barrel) are owned by the WP named in Doc 16. Other WPs that need a change there must STOP and request it in their handover.
4. Each developer writes `Docs/handovers/<WP-ID>.md` (handover format in Doc 16 §4) and pastes the same text into chat for Atchayam.
5. Only Claude edits `Docs/09`, `10`, `11`, `14–19`, the Blueprints and the Shared Contract.

## 7. Pre-development validation (run by WP-SH-000)

- Node ≥ 22.13 and npm ≥ 10 available on the developer machine.
- `git init` done; `.gitattributes` with `* text=auto eol=lf`.
- Initial commit of the existing authority package.
- `shared/job-core` builds and passes `npm run verify` with a trivial smoke test.
