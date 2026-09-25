# Clean Folder Policy v1

Target extraction path:

`D:\Work\Codex\Job-Portal-MCPs`

## Required structure

```text
Job-Portal-MCPs/
├─ README.md
├─ AGENTS.md
├─ .gitignore
├─ Docs/
├─ Prompts/
├─ shared/
│  ├─ contracts/
│  └─ schemas/
├─ naukri-mcp/
│  ├─ README.md
│  └─ docs/
└─ indeed-mcp/
   ├─ README.md
   └─ docs/
```

## Root cleanliness rule

Do not add source files, screenshots, downloaded portal pages, build outputs, logs, temporary JSON, credentials or generated reports to the root.

## Product isolation

When development begins, each product gets its own internal structure, for example:

```text
naukri-mcp/
  src/
  tests/
  docs/
  scripts/
  config/
```

and independently:

```text
indeed-mcp/
  src/
  tests/
  docs/
  scripts/
  config/
```

Do not create one shared runtime package that makes the two releases inseparable. `shared/` contains protocol/schema definitions only unless the Architect explicitly approves a small versioned library with independent tests.

## Naming

- lowercase kebab-case package/folder names
- versioned authority docs
- no person-specific branding in public connector names
- no “official”, “certified”, “partner” or portal logos until authorized

## Generated artifacts

Put local generated artifacts under each product's ignored `tmp/`, `logs/`, `coverage/` or `dist/` folders. Release artifacts go to CI release storage, not repository root.

## Amendment 2026-09-25 (Architect, ADR-003 / ADR-008)

- `shared/job-core/` is approved as the single provider-neutral library (schemas, domain logic, local store, MCP tool-kit). It contains no network I/O, credentials or provider branding. Products bundle a pinned copy so releases stay independent. `shared/schemas/` holds generated JSON Schemas; `shared/contracts/` the generated tool manifest.
- `Docs/handovers/` holds one handover file per work package.
- `.gitattributes` is permitted at root.
- No root `package.json` / workspaces.

## Amendment 2026-09-25 (release, WP-REL-001)

The following are permitted at the repository root: `LICENSE`, `NOTICE`, `SECURITY.md`, `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md` and `.github/` (CI workflows and templates).
