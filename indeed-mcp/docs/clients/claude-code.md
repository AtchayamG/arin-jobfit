# Claude Code MCP Integration

> **Status:** UNVERIFIED — to be confirmed in WP-CMP-001

Documentation reference: [Claude Code CLI Documentation](https://docs.anthropic.com/en/docs/claude-code/cli-usage) | [Anthropic MCP](https://docs.anthropic.com/en/docs/mcp)

---

## Adding `indeed-mcp` to Claude Code

You can add `indeed-mcp` to Claude Code globally via the CLI or locally via a project `.mcp.json` file.

### CLI Command

```bash
# POSIX (Linux / macOS)
claude mcp add indeed-mcp -- node /path/to/indeed-mcp/dist/index.js
```

```powershell
# Windows (PowerShell)
claude mcp add indeed-mcp -- node D:\Work\Codex\Job-Portal-MCPs\indeed-mcp\dist\index.js
```

---

## Project Configuration (`.mcp.json`)

To configure `indeed-mcp` for a specific repository or workspace, create or edit `.mcp.json` at the project root:

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
      "args": ["/path/to/Job-Portal-MCPs/indeed-mcp/dist/index.js"],
      "env": {
        "INDEED_MCP_DATA_DIR": "/home/user/.local/share/indeed-mcp"
      }
    }
  }
}
```
