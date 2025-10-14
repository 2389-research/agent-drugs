# JWT OAuth Architecture - Agent Drugs

## Architecture Overview

Following the agent-tunes pattern:

```
User → Firebase OAuth → Cloud Functions (JWT Issuer) → Firestore (agents collection)
                                                              ↓
MCP Client (with JWT) → fly.io MCP Server → Validates JWT → Firestore
```

## Components

### 1. Firebase Cloud Functions
- **OAuth Callback Handler** (`/oauth/callback`)
  - Handles OAuth redirect
  - Creates user session
  - Generates agent credentials

- **JWT Issuer** (`generateJWT`)
  - Creates JWT for agent authentication
  - Stores in `agents` collection
  - Returns JWT to user

### 2. Firestore Collections

**agents:**
```typescript
{
  id: string;              // Auto-generated
  userId: string;          // Firebase Auth UID
  name: string;            // Agent name
  jwt: string;             // JWT token for MCP auth
  apiKey: string;          // Legacy, can deprecate
  createdAt: Timestamp;
  lastUsedAt: Timestamp;
}
```

**usage_events:**
```typescript
{
  agentId: string;         // Reference to agent
  userId: string;          // Firebase Auth UID
  drugName: string;
  timestamp: Timestamp;
  durationMinutes: number;
  expiresAt: Timestamp;
}
```

### 3. MCP Server (fly.io)

**Environment:**
- Firebase service account JSON
- Streaming HTTP endpoint
- JWT validation middleware

**Flow:**
1. Client sends JWT in Authorization header
2. Server validates JWT against Firestore `agents` collection
3. Server uses firebase-admin with service account for Firestore access
4. Returns MCP protocol responses via streaming HTTP

### 4. Web Frontend (Firebase Hosting)

**Pages:**
- Login (OAuth redirect)
- Agent management
- Copy JWT for MCP configuration

## Authentication Flow

1. User clicks "Login with Google/GitHub"
2. Redirects to Firebase OAuth
3. After success, redirect to `/oauth/callback` Cloud Function
4. Function generates JWT, stores in `agents` collection
5. User copies JWT
6. MCP client configured with JWT
7. MCP server validates JWT on each request

## Deployment

### Firebase Functions
```bash
firebase deploy --only functions
```

### MCP Server to fly.io
```bash
fly deploy
```

### Local Development
```bash
docker-compose up
```

## Security

- JWTs are cryptographically signed
- Stored in Firestore `agents` collection
- MCP server validates on each request
- Firestore rules enforce per-user access
- Service account has admin access (server-side only)
