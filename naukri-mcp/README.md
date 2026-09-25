# Arin JobFit — Naukri edition

An independent, local-first MCP server for organizing and analyzing user-provided job information. It is not affiliated with, endorsed by, or operated by Naukri or Info Edge.

## Privacy and human control

Data is stored only on this device in SQLite. The default location is `%APPDATA%\naukri-mcp` on Windows, `~/Library/Application Support/naukri-mcp` on macOS, and `$XDG_DATA_HOME/naukri-mcp` (or `~/.local/share/naukri-mcp`) on Linux. Set `NAUKRI_MCP_DATA_DIR` to choose another absolute location. The server does not fetch job listings or submit applications. `data_export` exports local records and `data_purge` deletes them through a confirmation flow. Final application actions remain human-controlled.

## Tools

The server exposes the 22 tools in the shared [tool manifest](../shared/contracts/tool-manifest.v1.json).

## Install after publication

```sh
npx -y arin-jobfit-nk
```

## Build from source

## Build

Prerequisite: Node.js 22.13+ and npm 10+.

PowerShell:

```powershell
cd shared/job-core
npm ci
cd ../../naukri-mcp
npm ci
npm run verify
```

POSIX shell:

```sh
cd shared/job-core && npm ci
cd ../../naukri-mcp && npm ci && npm run verify
```

The build produces a self-contained `dist/index.js` executable.
