# Codex

Official documentation: [OpenAI Codex MCP](https://developers.openai.com/learn/docs-mcp).

Add one of these entries to `%USERPROFILE%\.codex\config.toml` on Windows or
`~/.codex/config.toml` on POSIX.

Published package, POSIX:

```toml
[mcp_servers.arin-jobfit-nk]
command = "npx"
args = ["-y", "arin-jobfit-nk"]
```

Published package, Windows:

```toml
[mcp_servers.arin-jobfit-nk]
command = "npx.cmd"
args = ["-y", "arin-jobfit-nk"]
```

From source, use `command = "node"` and `args = ["/path/to/Job-Portal-MCPs/naukri-mcp/dist/index.js"]`
on POSIX, or `args = ["C:\\Users\\<user>\\Job-Portal-MCPs\\naukri-mcp\\dist\\index.js"]`
on Windows. The optional data directory override is `NAUKRI_MCP_DATA_DIR`.
