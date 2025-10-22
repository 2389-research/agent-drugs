# Mock Agent Drugs Server

A lightweight, SQLite-based mock server that mimics the production agent-drugs MCP server. Perfect for local testing, Docker experiments, and development without Firebase dependencies.

## Features

- ✅ Full MCP protocol implementation
- ✅ SQLite database (no external dependencies)
- ✅ No authentication required (insecure mode)
- ✅ All drug operations: list, take, active, detox
- ✅ Persistent state across restarts
- ✅ Pre-seeded with sample drugs
- ✅ Easy to run in tmux or Docker

## Quick Start

### Prerequisites

- Rust (latest stable) - [Install from rustup.rs](https://rustup.rs/)

### Run the Server

```bash
cd mock-agent-drugs-server
cargo run
```

The server will:
1. Create `mock-agent-drugs.db` SQLite database
2. Set up schema automatically
3. Seed 8 sample drugs
4. Start HTTP server on port 3001

Output:
```
🧪 Mock Agent Drugs Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 Database: sqlite:./mock-agent-drugs.db
✅ Database schema ready
✅ Seeded 8 drugs
🚀 Server running on http://0.0.0.0:3001
💡 Configure MCP client with:
   URL: http://localhost:3001/mcp
   No authentication needed!
```

### Run in tmux

```bash
tmux new -s agent-drugs
cd mock-agent-drugs-server
cargo run
# Detach with Ctrl+b, d
```

Reattach later:
```bash
tmux attach -t agent-drugs
```

## Configuration

### Environment Variables

- `PORT` - Server port (default: 3001)
- `DATABASE_URL` - SQLite database path (default: `sqlite:./mock-agent-drugs.db`)

Example:
```bash
PORT=8080 DATABASE_URL=sqlite:./custom.db cargo run
```

## Configure Claude Code MCP Client

To point your agent-drugs plugin to the mock server:

### Option 1: Modify .mcp.json (Temporary)

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

**No `oauth` field needed** - the mock server doesn't require authentication!

### Option 2: Use .mcp.local.json

Create `.mcp.local.json` in your project:

```json
{
  "mcpServers": {
    "agent-drugs-mock": {
      "type": "http",
      "url": "http://localhost:3001/mcp"
    }
  }
}
```

Then use the mock server in development:
```bash
claude --mcp-config .mcp.local.json
```

### Option 3: Point to Remote Server

If running on a remote server:

```json
{
  "mcpServers": {
    "agent-drugs": {
      "type": "http",
      "url": "http://your-server:3001/mcp"
    }
  }
}
```

## Available Drugs

The mock server comes pre-seeded with these drugs:

| Drug | Duration | Effect |
|------|----------|--------|
| `focus` | 60min | Extremely focused and detail-oriented |
| `creative` | 45min | Think outside the box, unconventional solutions |
| `concise` | 30min | Extreme brevity, straight to the point |
| `verbose` | 45min | Detailed explanations with examples |
| `debug` | 90min | Deep debugging mindset, systematic tracing |
| `speed` | 30min | Rapid task completion, quick decisions |
| `cautious` | 60min | Extreme caution, validate everything |
| `experimental` | 45min | Embrace experiments, learn from failures |

## Usage Examples

Once configured, use the normal MCP tools:

```bash
# List available drugs
/drugs

# Take a drug
/take focus

# Check active drugs
/active

# Remove all drugs
Use the detox tool directly
```

Or via MCP tool calls in Claude Code:
- `list_drugs` - See all available drugs
- `take_drug` - Activate a drug
- `active_drugs` - Check what's active
- `detox` - Clear all active drugs

## API Endpoints

### Health Check
```bash
curl http://localhost:3001/health
```

### MCP Endpoint
```bash
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/list"
  }'
```

## Docker Usage

### Build and Run

```bash
# From mock-agent-drugs-server directory
docker build -t mock-agent-drugs .
docker run -p 3001:3001 mock-agent-drugs
```

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  mock-agent-drugs:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - DATABASE_URL=sqlite:./mock-agent-drugs.db
    volumes:
      - ./data:/app/data
```

Run:
```bash
docker-compose up -d
```

### For Experiments (Hundreds of Containers)

Each container can use its own database:

```bash
docker run -e DATABASE_URL=sqlite::memory: mock-agent-drugs
```

This uses an in-memory SQLite database that's isolated per container.

## Architecture

### vs Production Server

| Feature | Production | Mock Server |
|---------|-----------|-------------|
| Database | Firestore | SQLite |
| Auth | OAuth 2.1 | None (insecure mode) |
| Protocol | MCP | MCP (same) |
| State | Cloud | Local file/memory |
| Dependencies | Firebase, Cloud Functions | None |
| Setup | Complex OAuth flow | Just run it |

### Database Schema

**drugs table:**
```sql
CREATE TABLE drugs (
    name TEXT PRIMARY KEY,
    prompt TEXT NOT NULL,
    defaultDurationMinutes INTEGER NOT NULL
)
```

**active_drugs table:**
```sql
CREATE TABLE active_drugs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    userId TEXT NOT NULL,
    agentId TEXT NOT NULL,
    name TEXT NOT NULL,
    prompt TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    UNIQUE(userId, agentId, name)
)
```

**Mock User/Agent:**
- `userId`: `mock-user` (fixed)
- `agentId`: `mock-agent` (fixed)

All operations use these fixed IDs. For multi-user experiments, you can modify the code to extract user/agent from request headers.

## Development

### Project Structure

```
mock-agent-drugs-server/
├── src/
│   ├── main.rs       # HTTP server, MCP handler, DB setup
│   └── models.rs     # Data structures
├── Cargo.toml        # Dependencies
└── README.md         # This file
```

### Adding New Drugs

Edit the `seed_sample_data()` function in `src/main.rs`:

```rust
let drugs = vec![
    ("your-drug", "Your behavioral prompt here", 60),
    // ...
];
```

Or insert directly into SQLite:

```bash
sqlite3 mock-agent-drugs.db
INSERT INTO drugs (name, prompt, defaultDurationMinutes)
VALUES ('your-drug', 'Your prompt', 60);
```

### Testing

```bash
# Test health check
curl http://localhost:3001/health

# Test MCP tools/list
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"method": "tools/list"}'

# Test list_drugs
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "list_drugs",
      "arguments": {}
    }
  }'

# Test take_drug
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "tools/call",
    "params": {
      "name": "take_drug",
      "arguments": {"name": "focus"}
    }
  }'
```

## Troubleshooting

### Port Already in Use

Change the port:
```bash
PORT=8080 cargo run
```

Or kill the existing process:
```bash
lsof -ti:3001 | xargs kill -9
```

### Database Locked

If using shared database in Docker, use in-memory mode:
```bash
DATABASE_URL=sqlite::memory: cargo run
```

### Claude Code Can't Connect

1. Check server is running: `curl http://localhost:3001/health`
2. Verify .mcp.json URL is correct
3. Restart Claude Code after config changes
4. Check no OAuth config in .mcp.json (not needed for mock)

## Production vs Mock

**When to use mock:**
- ✅ Local development
- ✅ Docker experiments
- ✅ CI/CD testing
- ✅ No internet connection needed
- ✅ Fast iteration

**When to use production:**
- ❌ Multi-user scenarios
- ❌ Cross-device persistence
- ❌ OAuth authentication required
- ❌ Cloud deployment

## License

Same as parent project (agent-drugs)
