# Tool manifest

`tool-manifest.v1.json` is the deterministic, reviewable MCP tool catalogue for both local products. Regenerate it from `shared/job-core` with `npm run manifest:export`; `npm run verify` checks for drift. Inputs use the portable JSON Schema subset; outputs describe the structured envelope.

## Pre-handler schema rejections

Pre-handler schema rejections are returned by the SDK as isError text; no envelope/audit. When client tool arguments violate the advertised `inputSchema` (such as extra unknown properties on strict objects or values violating constraints), `@modelcontextprotocol/server` rejects the call during input validation before reaching any application handler. Consequently, the SDK returns a standard text error with `isError: true` without invoking the application error envelope or appending an audit entry.
