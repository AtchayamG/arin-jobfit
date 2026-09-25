# Claude Code

UNVERIFIED — to be confirmed in WP-CMP-001.

Official documentation: [Claude Code CLI MCP](https://docs.anthropic.com/en/docs/claude-code/cli-usage).

Example command:

```sh
claude mcp add naukri-mcp -- "C:\Users\<user>\Job-Portal-MCPs\naukri-mcp\dist\index.js"
```

Project `.mcp.json` example:

```json
{
  "mcpServers": {
    "naukri-mcp": {
      "command": "node",
      "args": ["C:\\Users\\<user>\\Job-Portal-MCPs\\naukri-mcp\\dist\\index.js"]
    }
  }
}
```
