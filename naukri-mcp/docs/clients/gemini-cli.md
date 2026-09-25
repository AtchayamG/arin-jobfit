# Gemini CLI

UNVERIFIED — to be confirmed in WP-CMP-001.

Official documentation: [Gemini CLI MCP](https://github.com/google-gemini/gemini-cli/blob/main/docs/tools/mcp-server.md).

Add a stdio server to `~/.gemini/settings.json` (Windows: `%USERPROFILE%\.gemini\settings.json`):

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
