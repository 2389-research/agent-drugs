# Quick Start Guide

## ✅ Server is Running!

The mock agent-drugs server is up and running:
- **URL**: http://localhost:3001
- **Health**: http://localhost:3001/health
- **MCP Endpoint**: http://localhost:3001/mcp
- **Database**: `./mock-agent-drugs.db` (SQLite)

## How to Use with Claude Code

### 1. Edit Your MCP Configuration

Update `.mcp.json` in your project to point to the mock server:

```json
{
  "mcpServers": {
    "agent-drugs": {
      "type": "http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

**Important**: Remove any `oauth` field - the mock server doesn't require authentication!

### 2. Restart Claude Code

After updating the config, restart Claude Code for the changes to take effect.

### 3. Test It

Try these commands in Claude Code:
```
/drugs                 - List available drugs
/take focus           - Take the focus drug
/active               - Check active drugs
```

Or use the MCP tools directly via tool calls.

## Running in tmux

To run the server persistently in the background:

```bash
# Start new tmux session
tmux new -s agent-drugs

# In tmux, run the server
cd /Users/michaelsugimura/Documents/GitHub/agent-drugs/mock-agent-drugs-server
source ~/.cargo/env
cargo run

# Detach from tmux (server keeps running)
# Press: Ctrl+b, then d

# Later, reattach to check on it
tmux attach -t agent-drugs
```

## Testing from Command Line

### Health Check
```bash
curl http://localhost:3001/health
```

### List Available Drugs
```bash
curl -s -X POST http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -d '{"method": "tools/call", "params": {"name": "list_drugs", "arguments": {}}}' \
  | jq -r '.result.content[0].text'
```

### Take a Drug
```bash
curl -s -X POST http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -d '{"method": "tools/call", "params": {"name": "take_drug", "arguments": {"name": "focus"}}}' \
  | jq -r '.result.content[0].text'
```

### Check Active Drugs
```bash
curl -s -X POST http://localhost:3001/mcp \
  -H 'Content-Type: application/json' \
  -d '{"method": "tools/call", "params": {"name": "active_drugs", "arguments": {}}}' \
  | jq -r '.result.content[0].text'
```

## For Docker Experiments

### Each Container with In-Memory Database
```bash
docker build -t mock-agent-drugs .
docker run -e DATABASE_URL=sqlite::memory: -p 3001:3001 mock-agent-drugs
```

### Multiple Containers on Different Ports
```bash
# Container 1
docker run -e DATABASE_URL=sqlite::memory: -p 3001:3001 mock-agent-drugs

# Container 2
docker run -e DATABASE_URL=sqlite::memory: -e PORT=3002 -p 3002:3002 mock-agent-drugs

# Container 3
docker run -e DATABASE_URL=sqlite::memory: -e PORT=3003 -p 3003:3003 mock-agent-drugs
```

Then point different experiments to different ports.

## Stopping the Server

If running in foreground: `Ctrl+C`

If running in tmux:
```bash
tmux attach -t agent-drugs
# Then Ctrl+C
```

Or kill the process:
```bash
lsof -ti:3001 | xargs kill
```

## Pre-Seeded Drugs

The server comes with 8 drugs ready to use:

| Drug | Duration | Effect |
|------|----------|--------|
| `focus` | 60min | Extremely focused and detail-oriented |
| `creative` | 45min | Think outside the box |
| `concise` | 30min | Extreme brevity |
| `verbose` | 45min | Detailed explanations |
| `debug` | 90min | Deep debugging mindset |
| `speed` | 30min | Rapid decisions |
| `cautious` | 60min | Question everything |
| `experimental` | 45min | Try new approaches |

## Troubleshooting

### "Connection refused"
Server isn't running. Start it with:
```bash
cd mock-agent-drugs-server
source ~/.cargo/env
cargo run
```

### Claude Code can't connect
1. Verify server is running: `curl http://localhost:3001/health`
2. Check `.mcp.json` URL is `http://localhost:3001/mcp`
3. Remove any `oauth` config from `.mcp.json`
4. Restart Claude Code

### Port already in use
Change the port:
```bash
PORT=8080 cargo run
```

Then update your `.mcp.json` URL accordingly.

## What's Different from Production?

| Feature | Production | Mock Server |
|---------|-----------|-------------|
| Database | Firestore (cloud) | SQLite (local) |
| Auth | OAuth 2.1 | None (open) |
| Multi-user | Yes | Single user (mock-user) |
| Persistence | Cloud | Local file |
| Setup | Complex | Just run it |

## Next Steps

- Configure Claude Code to use this server
- Run experiments with hundreds of Docker containers
- Each container can have isolated state (in-memory DB)
- No external dependencies or API keys needed!
