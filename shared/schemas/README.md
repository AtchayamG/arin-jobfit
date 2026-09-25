# Shared Schemas

Generated JSON Schemas for the provider-neutral job-core contract. Do not edit the `.schema.json` files by hand.

From `shared/job-core`, run `npm run schemas:export` after changing a Zod schema, then `npm run schemas:check` to verify committed output. `npm run verify` includes the drift check. The `job-input` and `profile-input` schemas are the portable input subset described in Doc 17 §5; the other files describe output and shared types.
