# Agent Drugs MCP Server

MCP server for Claude Code agents to take "digital drugs" that modify their behavior.

## Quick Start

Agent Drugs uses **OAuth 2.1** for secure authentication. Claude Code automatically handles the OAuth flow.

### Configuration

Add this to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "agent-drugs": {
      "url": "https://agent-drugs-mcp.fly.dev/mcp",
      "oauth": {
        "metadata_url": "https://us-central1-agent-drugs.cloudfunctions.net/oauthMetadata"
      }
    }
  }
}
```

### First Connection

When you first connect:
1. Claude Code discovers the OAuth endpoints
2. Opens your browser to https://agent-drugs.web.app/oauth-authorize.html
3. You sign in with Google or GitHub
4. You authorize the agent's access
5. Redirects back to Claude Code
6. Connection established!

### Managing Access

Visit https://agent-drugs.web.app to:
- View all authorized agents
- See token expiration dates (90 days)
- Revoke access for specific agents

## Architecture

- **Web UI** (Firebase Hosting): https://agent-drugs.web.app
- **OAuth Endpoints** (Cloud Functions): OAuth 2.1 with PKCE
- **MCP Server** (Fly.io): Streamable HTTP transport (MCP 2025-03-26), validates bearer tokens
- **Database** (Firestore): Stores agents, drugs, usage events

## Available Tools

- `list_drugs` - View all available digital drugs
- `take_drug` - Take a drug to modify AI behavior
- `active_drugs` - Check currently active drugs and their remaining duration

## Development

### Local Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run stdio version (for local testing)
export AGENT_DRUGS_BEARER_TOKEN="your_token_here"
export FIREBASE_PROJECT_ID="agent-drugs"
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
npm run dev:stdio

# Run HTTP version (for production-like testing)
npm run dev:http
```

### Testing

```bash
npm test
```

### Docker

```bash
docker-compose up
```

## Deployment

See [DEPLOYMENT.md](docs/DEPLOYMENT.md) for complete deployment instructions including:

- Firebase Cloud Functions
- Firebase Hosting
- Fly.io MCP server
- Service account configuration
- OAuth flow setup

## Security

- OAuth 2.1 with PKCE (S256)
- Bearer tokens (256-bit random, not JWTs)
- Per-user access control via Firestore rules
- Service account for server-to-server Firebase access
- Single-use authorization codes with 10-minute expiration

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

ISC
