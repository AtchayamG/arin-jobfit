# OpenAI Codex CLI MCP Integration

> **Status:** UNVERIFIED — to be confirmed in WP-CMP-001

Documentation reference: [OpenAI Codex MCP Documentation](https://developers.openai.com/learn/docs-mcp)

---

## Configuration (`~/.codex/config.toml`)

To register `indeed-mcp` with OpenAI Codex CLI, edit your user configuration file located at `~/.codex/config.toml` (or `%USERPROFILE%\.codex\config.toml` on Windows).

### Windows Configuration

```toml
[mcp_servers.indeed-mcp]
command = "node"
args = ["D:\\Work\\Codex\\Job-Portal-MCPs\\indeed-mcp\\dist\\index.js"]

[mcp_servers.indeed-mcp.env]
INDEED_MCP_DATA_DIR = "C:\\Users\\User\\AppData\\Roaming\\indeed-mcp"
```

### POSIX Configuration (Linux / macOS)

```toml
[mcp_servers.indeed-mcp]
command = "node"
args = ["/home/user/Work/Job-Portal-MCPs/indeed-mcp/dist/index.js"]

[mcp_servers.indeed-mcp.env]
INDEED_MCP_DATA_DIR = "/home/user/.local/share/indeed-mcp"
```
