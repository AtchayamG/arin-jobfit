# Tool manifest

`tool-manifest.v1.json` is the deterministic, reviewable MCP tool catalogue for both local products. Regenerate it from `shared/job-core` with `npm run manifest:export`; `npm run verify` checks for drift. Inputs use the portable JSON Schema subset; outputs describe the structured envelope.
