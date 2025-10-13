# Agent Drugs MCP Server

MCP server for Claude Code agents to take "digital drugs" that modify their behavior.

## Installation

```bash
npm install -g @agent-drugs/mcp-server
```

## Configuration

Add to Claude Code MCP config with your API key:

```json
{
  "mcpServers": {
    "agent-drugs": {
      "command": "npx",
      "args": ["@agent-drugs/mcp-server"],
      "env": {
        "AGENT_DRUGS_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

## Development

```bash
npm run build
npm test
```

## Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```
