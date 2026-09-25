# Claude Code

Official documentation: [Claude Code CLI MCP](https://docs.anthropic.com/en/docs/claude-code/cli-usage).

## Published package

POSIX:

```sh
claude mcp add arin-jobfit-id -- npx -y arin-jobfit-id
```

Windows PowerShell:

```powershell
claude mcp add arin-jobfit-id -- npx.cmd -y arin-jobfit-id
```

## From source

POSIX: `claude mcp add arin-jobfit-id -- node /path/to/Job-Portal-MCPs/indeed-mcp/dist/index.js`

Windows PowerShell: `claude mcp add arin-jobfit-id -- node C:\Users\<user>\Job-Portal-MCPs\indeed-mcp\dist\index.js`

The optional data directory override is `INDEED_MCP_DATA_DIR`.
