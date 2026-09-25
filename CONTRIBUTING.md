# Contributing

## Development setup

Use Node.js 22.13 or newer and npm 10 or newer. Install and verify each
package independently:

```sh
cd shared/job-core && npm ci && npm run verify
cd ../../naukri-mcp && npm ci && npm run verify
cd ../indeed-mcp && npm ci && npm run verify
```

On Windows PowerShell, use `npm.cmd` if execution policy blocks `npm.ps1`.

## Contribution rules

- Do not add scraping, auto-apply, CAPTCHA bypass, stealth automation, or
  undocumented/private portal endpoints.
- Keep provider-specific code isolated and never commit credentials or personal
  CV data.
- Human approval is required for any future external-portal write capability.
- Keep production files focused and preferably under 250 lines.

Before opening a pull request, run the scoped `verify` command for the package
you changed. Follow the work-package ownership and handover format in
`Docs/16_WORK_PACKAGE_ASSIGNMENTS_v1.md`.

## Commits

Use explicit work-package prefixes, for example:
`WP-REL-001: checkpoint release packaging`. Stage only owned paths; do not use
`git add -A` or `git add .`.
