# Kimi Code CLI MCP Integration

> **Status:** UNVERIFIED — to be confirmed in WP-CMP-001

Documentation reference: [Kimi Code MCP Documentation](https://www.kimi.com/code/docs/en/kimi-code-cli/customization/mcp.html)

---

## Configuration (`mcp.json`)

To register `indeed-mcp` with Kimi Code CLI, add the server to your Kimi configuration file (e.g., `~/.kimi/mcp.json` or project-level configuration).

### Windows Configuration

```json
{
  "mcpServers": {
    "indeed-mcp": {
      "command": "node",
      "args": ["D:\\Work\\Codex\\Job-Portal-MCPs\\indeed-mcp\\dist\\index.js"],
      "env": {
        "INDEED_MCP_DATA_DIR": "%APPDATA%\\indeed-mcp"
      }
    }
  }
}
```

### POSIX Configuration (Linux / macOS)

```json
{
  "mcpServers": {
    "indeed-mcp": {
      "command": "node",
      "args": ["/home/user/Work/Job-Portal-MCPs/indeed-mcp/dist/index.js"],
      "env": {
        "INDEED_MCP_DATA_DIR": "/home/user/.local/share/indeed-mcp"
      }
    }
  }
}
```
