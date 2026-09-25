# Claude Code

Official documentation: [Claude Code CLI MCP](https://docs.anthropic.com/en/docs/claude-code/cli-usage).

## Published package

POSIX:

```sh
claude mcp add arin-jobfit-nk -- npx -y arin-jobfit-nk
```

Windows PowerShell:

```powershell
claude mcp add arin-jobfit-nk -- npx.cmd -y arin-jobfit-nk
```

## From source

POSIX: `claude mcp add arin-jobfit-nk -- node /path/to/Job-Portal-MCPs/naukri-mcp/dist/index.js`

Windows PowerShell: `claude mcp add arin-jobfit-nk -- node C:\Users\<user>\Job-Portal-MCPs\naukri-mcp\dist\index.js`

The optional data directory override is `NAUKRI_MCP_DATA_DIR`.
