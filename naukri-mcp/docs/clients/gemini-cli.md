# Gemini CLI

UNVERIFIED — community verification pending.

Official documentation: [Gemini CLI MCP](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md).

Add this to `~/.gemini/settings.json` (Windows: `%USERPROFILE%\.gemini\settings.json`).
Use `npx` on POSIX and `npx.cmd` on Windows:

```json
{
  "mcpServers": {
    "arin-jobfit-nk": {
      "command": "npx",
      "args": ["-y", "arin-jobfit-nk"]
    }
  }
}
```

On Windows, change `command` to `npx.cmd`. From source, use `command: "node"`
and the edition's `dist/index.js` path. The optional data directory override is
`NAUKRI_MCP_DATA_DIR`.
