# Codex

Official documentation: [OpenAI Codex MCP](https://developers.openai.com/learn/docs-mcp).

Add one of these entries to `%USERPROFILE%\.codex\config.toml` on Windows or
`~/.codex/config.toml` on POSIX.

Published package, POSIX:

```toml
[mcp_servers.arin-jobfit-id]
command = "npx"
args = ["-y", "arin-jobfit-id"]
```

Published package, Windows:

```toml
[mcp_servers.arin-jobfit-id]
command = "npx.cmd"
args = ["-y", "arin-jobfit-id"]
```

From source, use `command = "node"` and `args = ["/path/to/Job-Portal-MCPs/indeed-mcp/dist/index.js"]`
on POSIX, or `args = ["C:\\Users\\<user>\\Job-Portal-MCPs\\indeed-mcp\\dist\\index.js"]`
on Windows. The optional data directory override is `INDEED_MCP_DATA_DIR`.
