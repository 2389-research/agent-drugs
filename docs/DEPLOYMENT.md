# Deployment Guide

## Architecture

The Agent Drugs system consists of three components:

1. **Firebase Hosting** - Web UI for OAuth authorization
2. **Firebase Cloud Functions** - OAuth endpoints and token generation
3. **MCP Server** - Deployed on fly.io, validates tokens and serves MCP protocol over HTTP

## OAuth 2.1 Flow

```
1. MCP Client (Claude Code)
   ↓ Discovers OAuth endpoints
2. GET https://us-central1-agent-drugs.cloudfunctions.net/oauthMetadata
   ↓ Returns authorization_endpoint, token_endpoint
3. MCP Client opens browser to authorization_endpoint
   ↓ User authorizes
4. https://agent-drugs.web.app/oauth-authorize.html
   ↓ User signs in with Google/GitHub
5. Cloud Function generates bearer token + authorization code
   ↓ Redirects back to client
6. MCP Client exchanges code for token at token_endpoint
   ↓ Validates PKCE
7. MCP Client connects to MCP server with bearer token
   ↓ Each request includes: Authorization: Bearer agdrug_xxx
8. MCP Server (fly.io) validates token against Firestore
   ↓ Serves MCP protocol
```

## Firebase Deployment

### Prerequisites

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login
firebase login
```

### Deploy

```bash
# Deploy everything
firebase deploy

# Or deploy specific components
firebase deploy --only functions
firebase deploy --only hosting
firebase deploy --only firestore:rules,firestore:indexes
```

### Cloud Functions

Deployed functions:
- `generateBearerToken` - Manual token generation (callable)
- `oauthMetadata` - OAuth discovery (RFC 8414)
- `oauthAuthorize` - OAuth authorization initiation
- `oauthToken` - OAuth token exchange (with PKCE)
- `oauthCallback` - OAuth callback handler (callable)

## Fly.io Deployment

### Prerequisites

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Login
fly auth login
```

### Setup Service Account

1. **Download Firebase service account credentials:**

```bash
# Go to Firebase Console > Project Settings > Service Accounts
# Click "Generate new private key"
# Save as service-account.json
```

2. **Set up fly.io secrets:**

```bash
# Create app (first time only)
fly apps create agent-drugs-mcp

# Set service account credentials
# Convert JSON to base64 for secrets
cat service-account.json | base64 > /tmp/sa-base64.txt
fly secrets set GOOGLE_APPLICATION_CREDENTIALS_BASE64=$(cat /tmp/sa-base64.txt)
rm /tmp/sa-base64.txt

# Or use fly.io volumes (better approach)
fly volumes create agent_drugs_data --region sjc --size 1
```

3. **Update Dockerfile to decode credentials:**

Add to Dockerfile:
```dockerfile
# In production stage, before CMD
RUN if [ -n "$GOOGLE_APPLICATION_CREDENTIALS_BASE64" ]; then \
      echo "$GOOGLE_APPLICATION_CREDENTIALS_BASE64" | base64 -d > /app/service-account.json; \
      export GOOGLE_APPLICATION_CREDENTIALS=/app/service-account.json; \
    fi
```

### Deploy to Fly.io

```bash
# Deploy
fly deploy

# Check status
fly status

# View logs
fly logs

# Check health
curl https://agent-drugs-mcp.fly.dev/health
```

### Test MCP Server

```bash
# Test MCP endpoint (requires valid bearer token)
curl -H "Authorization: Bearer agdrug_xxx..." \
  https://agent-drugs-mcp.fly.dev/mcp
```

## MCP Client Configuration

### Option 1: OAuth Flow (Production)

Claude Code will automatically discover OAuth endpoints:

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

### Option 2: Manual Bearer Token (Development)

Get token from https://agent-drugs.web.app:

```json
{
  "mcpServers": {
    "agent-drugs": {
      "url": "https://agent-drugs-mcp.fly.dev/mcp",
      "headers": {
        "Authorization": "Bearer agdrug_xxx..."
      }
    }
  }
}
```

## Local Development

### Run HTTP MCP Server Locally

```bash
# Set environment variables
export FIREBASE_PROJECT_ID=agent-drugs
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Build and run
npm run build
npm start

# Or run in development mode
npm run dev:http
```

### Run with Docker

```bash
# Update docker-compose.yml with your service account path
docker-compose up
```

### Test Locally

```bash
# Health check
curl http://localhost:3000/health

# MCP endpoint (requires valid bearer token)
curl -H "Authorization: Bearer agdrug_xxx..." \
  http://localhost:3000/mcp
```

## Monitoring

### Firebase

- **Console**: https://console.firebase.google.com/project/agent-drugs
- **Functions logs**: `firebase functions:log`
- **Hosting**: https://agent-drugs.web.app

### Fly.io

- **Dashboard**: https://fly.io/apps/agent-drugs-mcp
- **Logs**: `fly logs`
- **Metrics**: `fly status --all`
- **SSH**: `fly ssh console`

## Security

### Bearer Tokens

- 256-bit random tokens (not cryptographic JWTs)
- Stored in Firestore `agents` collection
- Per-user access control via Firestore rules
- Can be revoked by deleting agent document

### OAuth Codes

- 10-minute expiration
- Single-use (marked as used after exchange)
- PKCE with S256 required
- Stored in Firestore `oauth_codes` collection

### Service Account

- Firebase Admin SDK requires service account
- MCP server needs read/write to Firestore
- Store credentials securely:
  - Local dev: `GOOGLE_APPLICATION_CREDENTIALS` env var
  - Fly.io: Secrets or mounted volumes
  - **Never commit service-account.json to git**

## Troubleshooting

### Function deployment fails

```bash
# Check Firebase project billing
firebase projects:list

# Verify functions build
cd functions && npm run build

# Check logs
firebase functions:log
```

### Fly.io deployment fails

```bash
# Check build logs
fly logs

# Verify service account is set
fly secrets list

# SSH into container
fly ssh console
```

### OAuth flow not working

1. Check OAuth metadata endpoint:
   ```bash
   curl https://us-central1-agent-drugs.cloudfunctions.net/oauthMetadata
   ```

2. Verify authorization endpoint redirects properly

3. Check browser console for errors on oauth-authorize.html

4. Verify Firestore rules allow oauth_codes writes

### MCP server connection fails

1. Check bearer token is valid:
   ```bash
   # Query Firestore
   firebase firestore:get agents/{agentId}
   ```

2. Verify service account has Firestore access

3. Check MCP server logs for authentication errors

4. Test health endpoint:
   ```bash
   curl https://agent-drugs-mcp.fly.dev/health
   ```
