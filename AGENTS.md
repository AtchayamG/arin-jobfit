# Agent Operating Rules — Job Portal MCPs

These rules apply to Claude, Codex, AGY and every other coding/review agent working in this repository.

## Roles

- **Claude**: Principal Architect / Product & Compliance Architect. Owns architecture, blueprint interpretation, decomposition, interface design and architecture review. Claude must not duplicate routine implementation assigned to Codex or AGY.
- **Codex**: Senior Developer / Implementation Validator. Implements only assigned work packages and validates them against the blueprint.
- **AGY**: Senior Developer / Independent Implementer + Adversarial Reviewer. Implements separately assigned packages and performs independent security/policy/reliability review. Do not duplicate Codex tasks unless the Architect explicitly assigns a paired review.
- **Human owner**: final authority for product strategy, portal outreach, credentials, production release and any consequential portal action.

## Non-negotiable constraints

1. No CAPTCHA bypass, anti-bot evasion, undocumented/private API reverse engineering, cookie/session theft, credential harvesting or browser stealth automation.
2. No autonomous bulk job applications.
3. No fabricated CV claims, experience, salary history, qualifications, screening answers or work authorization.
4. No portal-specific API capability may be enabled until its approval/permission is documented.
5. Keep provider-specific code isolated. `naukri-mcp` must never depend on Indeed credentials/code and vice versa.
6. Secrets never enter source control. Use environment variables or an approved secret manager.
7. Human approval is mandatory before any future write/submission capability that affects an external portal account.
8. No Placeholder Completion Rule: a feature cannot be marked Complete if it contains TODO handlers, mock production integrations, fake success responses, unverified portal behavior or knowingly skipped quality gates.
9. Keep production source files <= 250 lines where practical. Split by responsibility rather than compressing readability.
10. After material work, write a handover to `Docs/handovers/<WP-ID>.md` (format: `Docs/16_WORK_PACKAGE_ASSIGNMENTS_v1.md` §4). Only the Architect updates `Docs/09`, `Docs/10_TASK_STATUS.md`, `Docs/11_HANDOVER.md` and Docs 14–19 (ADR-008, avoids parallel-edit conflicts).
11. Modify only files your work package owns (Doc 16). Commit with explicit paths only; never `git add -A` / `git add .`.

## Clean repository policy

Root stays clean. Production code belongs only inside `naukri-mcp/` or `indeed-mcp/`. Shared protocol definitions belong in `shared/`. Research, decisions and plans belong in `Docs/`. Prompts belong in `Prompts/`. Generated build output, caches, secrets, screenshots and temporary downloads never belong in the root.
