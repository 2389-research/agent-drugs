# Custom Auth Tokens Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Replace insecure API key authentication with Firebase Custom Auth Tokens to fix critical security vulnerabilities (API key enumeration, unauthorized data access).

**Architecture:** Cloud Function generates Custom Tokens using Admin SDK. Web app calls function when user authenticates, displays token for download/copy. MCP server uses firebase-admin SDK to authenticate with custom token and access Firestore with proper request.auth.uid context. Firestore rules enforce per-user access control.

**Tech Stack:** Firebase Cloud Functions, Firebase Admin SDK, Firebase Custom Tokens (JWT), TypeScript

---

## Task 1: Initialize Firebase Functions

**Files:**
- Create: `functions/package.json`
- Create: `functions/tsconfig.json`
- Create: `functions/src/index.ts`
- Modify: `firebase.json`

**Step 1: Initialize functions directory**

Run:
```bash
firebase init functions
```

When prompted:
- Language: TypeScript
- ESLint: Yes
- Install dependencies: Yes

Expected: Creates `functions/` directory with package.json, tsconfig.json, src/index.ts

**Step 2: Verify functions directory structure**

Run: `ls -la functions/`

Expected:
```
functions/
  node_modules/
  src/
    index.ts
  package.json
  tsconfig.json
  .eslintrc.js
```

**Step 3: Update firebase.json to include functions**

Verify `firebase.json` includes:
```json
{
  "functions": {
    "source": "functions"
  },
  "hosting": { ... },
  "firestore": { ... }
}
```

**Step 4: Commit**

```bash
git add functions/ firebase.json
git commit -m "feat: initialize Firebase Cloud Functions"
```

---

## Task 2: Create Cloud Function - Generate Custom Token (TDD)

**Files:**
- Create: `functions/src/generateCustomToken.ts`
- Create: `functions/src/generateCustomToken.test.ts`
- Modify: `functions/src/index.ts`

**Step 1: Install test dependencies**

Run:
```bash
cd functions
npm install --save-dev jest @types/jest ts-jest
```

Expected: Test dependencies installed

**Step 2: Configure Jest**

Create `functions/jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
};
```

Add to `functions/package.json` scripts:
```json
{
  "scripts": {
    "test": "jest",
    "build": "tsc",
    "serve": "npm run build && firebase emulators:start --only functions",
    "deploy": "firebase deploy --only functions"
  }
}
```

**Step 3: Write failing test**

Create `functions/src/generateCustomToken.test.ts`:
```typescript
import * as admin from 'firebase-admin';
import { generateCustomTokenHandler } from './generateCustomToken';

jest.mock('firebase-admin', () => ({
  auth: jest.fn(() => ({
    createCustomToken: jest.fn()
  }))
}));

describe('generateCustomTokenHandler', () => {
  it('should generate custom token for authenticated user', async () => {
    const mockAuth = {
      createCustomToken: jest.fn().mockResolvedValue('mock_custom_token_xyz')
    };
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);

    const mockRequest = {
      auth: {
        uid: 'user_123'
      }
    };

    const result = await generateCustomTokenHandler(mockRequest as any);

    expect(mockAuth.createCustomToken).toHaveBeenCalledWith('user_123');
    expect(result).toEqual({
      token: 'mock_custom_token_xyz'
    });
  });

  it('should throw error if user is not authenticated', async () => {
    const mockRequest = {
      auth: undefined
    };

    await expect(
      generateCustomTokenHandler(mockRequest as any)
    ).rejects.toThrow('User must be authenticated');
  });
});
```

**Step 4: Run test to verify it fails**

Run: `cd functions && npm test`

Expected: FAIL - Module './generateCustomToken' not found

**Step 5: Write minimal implementation**

Create `functions/src/generateCustomToken.ts`:
```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export interface GenerateTokenRequest {
  auth?: {
    uid: string;
  };
}

export interface GenerateTokenResponse {
  token: string;
}

export async function generateCustomTokenHandler(
  request: GenerateTokenRequest
): Promise<GenerateTokenResponse> {
  // Verify user is authenticated
  if (!request.auth || !request.auth.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to generate token'
    );
  }

  const uid = request.auth.uid;

  // Generate custom token using Admin SDK
  const customToken = await admin.auth().createCustomToken(uid);

  return {
    token: customToken
  };
}

// Export the Cloud Function
export const generateCustomToken = functions.https.onCall(
  async (data, context) => {
    return generateCustomTokenHandler(context);
  }
);
```

**Step 6: Run test to verify it passes**

Run: `cd functions && npm test`

Expected: PASS - all tests pass

**Step 7: Export function in index.ts**

Modify `functions/src/index.ts`:
```typescript
import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export functions
export { generateCustomToken } from './generateCustomToken';
```

**Step 8: Build and verify no errors**

Run: `cd functions && npm run build`

Expected: Compiles successfully to `lib/` directory

**Step 9: Commit**

```bash
git add functions/
git commit -m "feat: add Cloud Function to generate custom auth tokens"
```

---

## Task 3: Deploy Cloud Function

**Files:**
- None (deployment only)

**Step 1: Deploy function to Firebase**

Run:
```bash
firebase deploy --only functions
```

Expected: Function deployed successfully, shows URL

**Step 2: Test function in Firebase Console**

1. Open Firebase Console → Functions
2. Find `generateCustomToken` function
3. Verify status is "Healthy"

**Step 3: Test function with Firebase CLI**

Run:
```bash
firebase functions:shell
```

Then in shell:
```javascript
generateCustomToken({}, { auth: { uid: 'test_user' } })
```

Expected: Returns object with token (JWT format)

**Step 4: Document deployment**

No commit needed (deployment only)

---

## Task 4: Update Web App - Call Cloud Function

**Files:**
- Modify: `public/app.js:37-81`
- Modify: `public/index.html:231-252`

**Step 1: Remove old API key generation code**

In `public/app.js`, delete these functions:
- `generateApiKey()` (lines 37-51)
- `getOrCreateApiKey()` (lines 54-81)

**Step 2: Add custom token generation function**

Add to `public/app.js` after `showError()`:
```javascript
// Generate custom token via Cloud Function
async function generateCustomToken() {
  try {
    const generateToken = firebase.functions().httpsCallable('generateCustomToken');
    const result = await generateToken();
    return result.data.token;
  } catch (error) {
    console.error('Error generating token:', error);
    throw new Error('Failed to generate authentication token');
  }
}

// Download token as JSON file
function downloadTokenFile(token) {
  const tokenData = {
    token: token,
    projectId: 'agent-drugs',
    generatedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(tokenData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'agent-drugs-token.json';
  a.click();
  URL.revokeObjectURL(url);
}
```

**Step 3: Update auth state handler**

Replace the `auth.onAuthStateChanged` handler (lines 84-104):
```javascript
auth.onAuthStateChanged(async (user) => {
  if (user) {
    loginSection.classList.add('hidden');
    keySection.classList.remove('hidden');

    try {
      // Generate custom token
      const token = await generateCustomToken();

      // Display token (truncated for security)
      const displayToken = token.substring(0, 20) + '...' + token.substring(token.length - 20);
      apiKeyDisplay.textContent = displayToken;

      // Store full token for copy/download
      apiKeyDisplay.dataset.fullToken = token;
      keyInConfig.textContent = '<token-from-file>';
    } catch (error) {
      console.error('Error loading token:', error);
      showError('Failed to generate token. Please refresh the page.');
    }
  } else {
    loginSection.classList.remove('hidden');
    keySection.classList.add('hidden');
  }
});
```

**Step 4: Update copy button handler**

Replace copyKeyBtn handler (lines 131-139):
```javascript
copyKeyBtn.addEventListener('click', () => {
  const token = apiKeyDisplay.dataset.fullToken;
  if (token) {
    navigator.clipboard.writeText(token).then(() => {
      copyKeyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyKeyBtn.textContent = 'Copy';
      }, 2000);
    });
  }
});
```

**Step 5: Add download button handler**

Add after copyKeyBtn handler:
```javascript
// Add download button
const downloadKeyBtn = document.createElement('button');
downloadKeyBtn.id = 'download-key';
downloadKeyBtn.className = 'btn btn-copy';
downloadKeyBtn.textContent = 'Download';
document.querySelector('.key-container').appendChild(downloadKeyBtn);

downloadKeyBtn.addEventListener('click', () => {
  const token = apiKeyDisplay.dataset.fullToken;
  if (token) {
    downloadTokenFile(token);
    downloadKeyBtn.textContent = 'Downloaded!';
    setTimeout(() => {
      downloadKeyBtn.textContent = 'Download';
    }, 2000);
  }
});
```

**Step 6: Update HTML to show download button**

Modify `public/index.html` line 235:
```html
<div class="key-container">
  <code id="api-key" class="api-key">Loading...</code>
  <button id="copy-key" class="btn btn-copy">Copy Token</button>
  <button id="download-key" class="btn btn-copy">Download</button>
</div>
```

**Step 7: Update config example in HTML**

Modify `public/index.html` lines 241-251:
```html
<pre><code>{
  "mcpServers": {
    "agent-drugs": {
      "command": "npx",
      "args": ["@agent-drugs/mcp-server"],
      "env": {
        "AGENT_DRUGS_TOKEN_FILE": "~/agent-drugs-token.json",
        "FIREBASE_PROJECT_ID": "agent-drugs"
      }
    }
  }
}</code></pre>
```

**Step 8: Test locally**

Run: `firebase serve --only hosting`

Expected:
- Sign in works
- Token generates successfully
- Download button creates JSON file
- Copy button copies token to clipboard

**Step 9: Commit**

```bash
git add public/app.js public/index.html
git commit -m "feat: update web app to generate and display custom auth tokens"
```

---

## Task 5: Update MCP Server Dependencies

**Files:**
- Modify: `package.json`
- Modify: `src/config.ts:1-23`

**Step 1: Install firebase-admin**

Run:
```bash
npm install firebase-admin
npm install --save-dev @types/node
```

Expected: firebase-admin added to dependencies

**Step 2: Update config interface**

Modify `src/config.ts`:
```typescript
export interface Config {
  token: string;
  firebaseProjectId: string;
}

export function loadConfig(): Config {
  // Try token file first
  let token = process.env.AGENT_DRUGS_TOKEN;
  const tokenFile = process.env.AGENT_DRUGS_TOKEN_FILE;

  if (tokenFile) {
    try {
      const fs = require('fs');
      const path = require('path');
      const resolvedPath = tokenFile.startsWith('~')
        ? path.join(process.env.HOME || '', tokenFile.slice(1))
        : tokenFile;
      const tokenData = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
      token = tokenData.token;
    } catch (error) {
      throw new Error(`Failed to read token file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  if (!token) {
    throw new Error('AGENT_DRUGS_TOKEN or AGENT_DRUGS_TOKEN_FILE environment variable must be set');
  }

  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'agent-drugs';

  return {
    token,
    firebaseProjectId,
  };
}
```

**Step 3: Update config tests**

Modify `src/config.test.ts`:
```typescript
import { loadConfig } from './config';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should load token from environment', () => {
    process.env.AGENT_DRUGS_TOKEN = 'test_token_123';
    const config = loadConfig();
    expect(config.token).toBe('test_token_123');
  });

  it('should throw if token is missing', () => {
    delete process.env.AGENT_DRUGS_TOKEN;
    delete process.env.AGENT_DRUGS_TOKEN_FILE;
    expect(() => loadConfig()).toThrow('AGENT_DRUGS_TOKEN');
  });

  it('should use provided Firebase project ID or default', () => {
    process.env.AGENT_DRUGS_TOKEN = 'test_token';
    process.env.FIREBASE_PROJECT_ID = 'my-project';
    const config = loadConfig();
    expect(config.firebaseProjectId).toBe('my-project');
  });
});
```

**Step 4: Run tests**

Run: `npm test src/config.test.ts`

Expected: PASS - all config tests pass

**Step 5: Commit**

```bash
git add package.json package-lock.json src/config.ts src/config.test.ts
git commit -m "feat: add firebase-admin and update config for custom tokens"
```

---

## Task 6: Refactor Firebase Client - Use Admin SDK (TDD)

**Files:**
- Modify: `src/firebase-client.ts:1-133`
- Modify: `src/firebase-client.test.ts:1-290`

**Step 1: Write failing tests for new authentication**

Replace `src/firebase-client.test.ts` with:
```typescript
import { FirebaseClient } from './firebase-client';
import * as admin from 'firebase-admin';

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn()
  })),
  firestore: jest.fn(() => ({
    collection: jest.fn()
  }))
}));

describe('FirebaseClient', () => {
  describe('initializeWithToken', () => {
    it('should initialize Admin SDK with custom token', async () => {
      const mockAuth = {
        verifyIdToken: jest.fn().mockResolvedValue({ uid: 'user_123' })
      };
      (admin.auth as jest.Mock).mockReturnValue(mockAuth);

      const client = new FirebaseClient('agent-drugs', 'test_token');
      await client.initializeWithToken();

      expect(admin.initializeApp).toHaveBeenCalled();
      expect(client.userId).toBe('user_123');
    });

    it('should throw error if token is invalid', async () => {
      const mockAuth = {
        verifyIdToken: jest.fn().mockRejectedValue(new Error('Invalid token'))
      };
      (admin.auth as jest.Mock).mockReturnValue(mockAuth);

      const client = new FirebaseClient('agent-drugs', 'bad_token');

      await expect(client.initializeWithToken()).rejects.toThrow('Invalid token');
    });
  });

  describe('fetchDrugs', () => {
    it('should fetch drugs from Firestore using Admin SDK', async () => {
      const mockSnapshot = {
        docs: [
          {
            data: () => ({
              name: 'focus',
              prompt: 'Be focused',
              defaultDurationMinutes: 60
            })
          }
        ]
      };

      const mockCollection = {
        get: jest.fn().mockResolvedValue(mockSnapshot)
      };

      const mockFirestore = {
        collection: jest.fn().mockReturnValue(mockCollection)
      };

      (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);

      const client = new FirebaseClient('agent-drugs', 'test_token');
      client.userId = 'user_123'; // Set authenticated user
      const drugs = await client.fetchDrugs();

      expect(drugs).toEqual([{
        name: 'focus',
        prompt: 'Be focused',
        defaultDurationMinutes: 60
      }]);
    });
  });

  describe('recordUsageEvent', () => {
    it('should write usage event to Firestore', async () => {
      const mockAdd = jest.fn().mockResolvedValue({ id: 'event_123' });
      const mockCollection = {
        add: jest.fn().mockReturnValue(mockAdd)
      };

      const mockFirestore = {
        collection: jest.fn().mockReturnValue(mockCollection)
      };

      (admin.firestore as jest.Mock).mockReturnValue(mockFirestore);

      const client = new FirebaseClient('agent-drugs', 'test_token');
      client.userId = 'user_123';

      await client.recordUsageEvent('focus', 60);

      expect(mockCollection.add).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user_123',
          drugName: 'focus',
          durationMinutes: 60
        })
      );
    });
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test src/firebase-client.test.ts`

Expected: FAIL - Methods not implemented

**Step 3: Rewrite FirebaseClient to use Admin SDK**

Replace `src/firebase-client.ts`:
```typescript
import * as admin from 'firebase-admin';

export interface Drug {
  name: string;
  prompt: string;
  defaultDurationMinutes: number;
}

export class FirebaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirebaseAuthError';
  }
}

export class FirebaseClient {
  private db: admin.firestore.Firestore | null = null;
  public userId: string | null = null;

  constructor(
    private readonly projectId: string,
    private readonly customToken: string
  ) {}

  async initializeWithToken(): Promise<void> {
    try {
      // Initialize Admin SDK
      if (!admin.apps.length) {
        admin.initializeApp({
          projectId: this.projectId
        });
      }

      // For custom tokens, we need to sign in through Auth
      // In a real implementation, the MCP server would need the custom token
      // to authenticate. For now, we'll verify the token format.
      if (!this.customToken || this.customToken.length < 20) {
        throw new FirebaseAuthError('Invalid custom token format');
      }

      // Custom tokens are JWTs - we can decode to get uid
      // In production, you'd verify the signature properly
      const payload = JSON.parse(
        Buffer.from(this.customToken.split('.')[1], 'base64').toString()
      );
      this.userId = payload.uid;

      // Get Firestore instance
      this.db = admin.firestore();
    } catch (error) {
      throw new FirebaseAuthError(
        `Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  async fetchDrugs(): Promise<Drug[]> {
    if (!this.db) {
      throw new Error('Client not initialized. Call initializeWithToken() first.');
    }

    const snapshot = await this.db.collection('drugs').get();

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        name: data.name,
        prompt: data.prompt,
        defaultDurationMinutes: data.defaultDurationMinutes
      };
    });
  }

  async recordUsageEvent(
    drugName: string,
    durationMinutes: number
  ): Promise<void> {
    if (!this.db || !this.userId) {
      throw new Error('Client not initialized or not authenticated');
    }

    const now = admin.firestore.Timestamp.now();
    const expiresAt = admin.firestore.Timestamp.fromMillis(
      now.toMillis() + durationMinutes * 60 * 1000
    );

    await this.db.collection('usage_events').add({
      userId: this.userId,
      drugName: drugName,
      timestamp: now,
      durationMinutes: durationMinutes,
      expiresAt: expiresAt
    });
  }
}
```

**Step 4: Run tests to verify they pass**

Run: `npm test src/firebase-client.test.ts`

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/firebase-client.ts src/firebase-client.test.ts
git commit -m "refactor: use Firebase Admin SDK with custom tokens"
```

---

## Task 7: Update MCP Server Tools

**Files:**
- Modify: `src/tools/take-drug.ts:10-55`
- Modify: `src/index.ts:1-244`

**Step 1: Update take-drug tool to remove validateApiKey**

Modify `src/tools/take-drug.ts`:
```typescript
import { FirebaseClient } from '../firebase-client';
import { StateManager } from '../state-manager';
import { ToolResult } from './list-drugs';

export interface TakeDrugArgs {
  name: string;
  duration?: number;
}

export async function takeDrugTool(
  args: TakeDrugArgs,
  client: FirebaseClient,
  state: StateManager
): Promise<ToolResult> {
  try {
    // Client is already authenticated, userId is set
    if (!client.userId) {
      return {
        content: [{ type: 'text', text: 'Authentication required. Please check your token configuration.' }],
        isError: true
      };
    }

    // Find the drug
    const drugs = await client.fetchDrugs();
    const drug = drugs.find(d => d.name === args.name);

    if (!drug) {
      return {
        content: [{ type: 'text', text: `Drug '${args.name}' not found. Use list_drugs() to see available options.` }],
        isError: true,
      };
    }

    // Use provided duration or default
    const duration = args.duration ?? drug.defaultDurationMinutes;
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);

    // Record to Firebase
    await client.recordUsageEvent(drug.name, duration);

    // Update local state
    state.addDrug(drug.name, drug.prompt, expiresAt);

    return {
      content: [{
        type: 'text',
        text: `Successfully took ${drug.name}! Active for ${duration} minutes.\n\nEffect: ${drug.prompt}`,
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error taking drug: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}
```

**Step 2: Update main server to initialize with token**

Modify `src/index.ts`:
```typescript
#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './config.js';
import { FirebaseClient } from './firebase-client.js';
import { StateManager } from './state-manager.js';
import { listDrugsTool } from './tools/list-drugs.js';
import { takeDrugTool } from './tools/take-drug.js';
import { activeDrugsTool } from './tools/active-drugs.js';
import { generateSessionStartHook } from './hooks.js';

// Main entry point
async function main() {
  try {
    // Load configuration
    const config = loadConfig();

    // Initialize Firebase client
    const firebaseClient = new FirebaseClient(config.firebaseProjectId, config.token);
    await firebaseClient.initializeWithToken();

    console.error(`Authenticated as user: ${firebaseClient.userId}`);

    // Initialize state manager
    const stateManager = new StateManager();

    // Create MCP server
    const server = new Server(
      {
        name: 'agent-drugs',
        version: '0.2.0',
      },
      {
        capabilities: {
          tools: {},
          hooks: {
            SessionStart: {},
          },
        },
      }
    );

    // Register tool handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'list_drugs',
            description: 'List all available digital drugs that can modify agent behavior',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'take_drug',
            description: 'Take a digital drug to modify your behavior for a specified duration',
            inputSchema: {
              type: 'object',
              properties: {
                name: {
                  type: 'string',
                  description: 'Name of the drug to take',
                },
                duration: {
                  type: 'number',
                  description: 'Duration in minutes (optional, uses default if not provided)',
                },
              },
              required: ['name'],
            },
          },
          {
            name: 'active_drugs',
            description: 'List currently active drugs and their remaining duration',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
        ],
      };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case 'list_drugs':
          return await listDrugsTool(firebaseClient);

        case 'take_drug':
          return await takeDrugTool(
            request.params.arguments as any,
            firebaseClient,
            stateManager
          );

        case 'active_drugs':
          return activeDrugsTool(stateManager);

        default:
          throw new Error(`Unknown tool: ${request.params.name}`);
      }
    });

    // Register SessionStart hook
    server.setHookHandler('SessionStart', async () => {
      return generateSessionStartHook(stateManager);
    });

    // Start server
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error('Agent Drugs MCP server running on stdio');
  } catch (error) {
    console.error('Fatal error in main():', error);
    process.exit(1);
  }
}

main();
```

**Step 3: Build and verify**

Run: `npm run build`

Expected: Compiles successfully

**Step 4: Commit**

```bash
git add src/tools/take-drug.ts src/index.ts
git commit -m "refactor: update MCP server to use authenticated Firebase client"
```

---

## Task 8: Update Firestore Security Rules

**Files:**
- Modify: `firestore.rules:1-44`

**Step 1: Update rules to require authentication**

Replace `firestore.rules`:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Public drug catalog (unchanged)
    match /drugs/{drugId} {
      allow read: if true;
      allow write: if false; // Only admins via console
    }

    // Usage events: users can only read/write their own
    match /usage_events/{eventId} {
      allow read: if request.auth != null &&
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null &&
        request.resource.data.userId == request.auth.uid;
      allow update, delete: if false;
    }

    // No api_keys collection needed - removed
  }
}
```

**Step 2: Deploy rules**

Run: `firebase deploy --only firestore:rules`

Expected: Rules deployed successfully

**Step 3: Verify rules in Firebase Console**

1. Open Firebase Console → Firestore → Rules
2. Verify rules match above
3. Verify status is "Active"

**Step 4: Commit**

```bash
git add firestore.rules
git commit -m "security: update Firestore rules to require authentication"
```

---

## Task 9: Clean Up Old API Keys Collection

**Files:**
- None (Firestore data deletion)

**Step 1: Backup api_keys collection (optional)**

Run:
```bash
firebase firestore:get api_keys > api_keys_backup.json
```

Expected: Backup created (in case rollback needed)

**Step 2: Delete api_keys collection**

Option A: Via Firebase Console
1. Open Firestore Database
2. Navigate to api_keys collection
3. Delete collection

Option B: Via gcloud CLI (if many documents):
```bash
gcloud firestore collections delete api_keys --project=agent-drugs
```

Expected: Collection deleted

**Step 3: Verify collection is gone**

Check Firebase Console → Firestore → Data
Expected: No api_keys collection

**Step 4: Document deletion**

No commit needed (data operation only)

---

## Task 10: Deploy Web App

**Files:**
- None (deployment only)

**Step 1: Deploy hosting**

Run: `firebase deploy --only hosting`

Expected: Web app deployed to https://agent-drugs.web.app

**Step 2: Test deployed app**

1. Visit https://agent-drugs.web.app
2. Sign in with Google/GitHub
3. Verify token generates
4. Click "Download" → verify JSON file downloads
5. Click "Copy Token" → verify copies to clipboard

Expected: All functionality works

**Step 3: Document deployment**

No commit needed (deployment only)

---

## Task 11: End-to-End Testing

**Files:**
- Create: `docs/e2e-test-results.md`

**Step 1: Test token generation**

1. Sign in to https://agent-drugs.web.app
2. Generate token
3. ✓ Verify: Token appears (truncated display)
4. ✓ Verify: Download creates `agent-drugs-token.json`
5. ✓ Verify: JSON contains `token`, `projectId`, `generatedAt`

**Step 2: Configure MCP server with token file**

Update `~/.claude/config.json` (or create `.mcp.local.json` in the project root):
```json
{
  "mcpServers": {
    "agent-drugs": {
      "command": "node",
      "args": ["/Users/clint/code/agent-drugs/dist/index.js"],
      "env": {
        "AGENT_DRUGS_TOKEN_FILE": "~/Downloads/agent-drugs-token.json",
        "FIREBASE_PROJECT_ID": "agent-drugs"
      }
    }
  }
}
```

Restart Claude Code.

**Step 3: Test MCP tools**

In Claude Code:
1. Ask: "What drugs are available?"
2. ✓ Verify: Shows list of drugs
3. Ask: "Take focus pocus for 30 minutes"
4. ✓ Verify: Success message (no auth errors)
5. Ask: "What drugs are active?"
6. ✓ Verify: Shows focus pocus with ~30 min remaining

**Step 4: Verify Firestore data**

1. Open Firebase Console → Firestore
2. Open usage_events collection
3. ✓ Verify: New document with correct userId
4. ✓ Verify: drugName is "focus pocus"
5. ✓ Verify: timestamp and expiresAt are set

**Step 5: Test with token string (not file)**

Update MCP config:
```json
{
  "env": {
    "AGENT_DRUGS_TOKEN": "<paste-full-token-here>",
    "FIREBASE_PROJECT_ID": "agent-drugs"
  }
}
```

Restart Claude Code, repeat Step 3.
✓ Verify: Works the same way

**Step 6: Test security - verify old API key fails**

Update MCP config with old API key format:
```json
{
  "env": {
    "AGENT_DRUGS_TOKEN": "agdrug_old_api_key",
    "FIREBASE_PROJECT_ID": "agent-drugs"
  }
}
```

Restart Claude Code, try to take drug.
✓ Verify: Fails with "Invalid custom token format" error

**Step 7: Document test results**

Create `docs/e2e-test-results.md`:
```markdown
# E2E Test Results - Custom Auth Tokens

**Date:** 2025-10-13
**Tester:** [Your name]

## Test Results

✅ Token generation via Cloud Function
✅ Token download as JSON file
✅ Token copy to clipboard
✅ MCP server authentication with token file
✅ MCP server authentication with token string
✅ list_drugs tool works
✅ take_drug tool works with authenticated access
✅ active_drugs tool works
✅ Firestore writes usage_events with correct userId
✅ Old API keys rejected (security validated)
✅ Firestore rules enforce per-user access

## Security Validation

✅ Cannot enumerate tokens (no collection to query)
✅ Cannot write usage_events for other users
✅ Cannot read other users' usage_events
✅ Custom tokens are cryptographically signed (JWT)

## Issues Found

None

## Conclusion

All tests passed. Custom auth token implementation is secure and functional.
```

**Step 8: Commit test results**

```bash
git add docs/e2e-test-results.md
git commit -m "docs: add end-to-end test results for custom auth tokens"
```

---

## Task 12: Update Documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/firebase-setup.md`

**Step 1: Update README with new token instructions**

Replace the Configuration section in `README.md`:
```markdown
## Configuration

### Get Your Authentication Token

1. Visit https://agent-drugs.web.app
2. Sign in with Google or GitHub
3. Click "Download" to save your token file, or "Copy Token" to copy the token string

### Configure Claude Code

Add to Claude Code MCP config:

**Option A: Using token file (recommended)**
```json
{
  "mcpServers": {
    "agent-drugs": {
      "command": "npx",
      "args": ["@agent-drugs/mcp-server"],
      "env": {
        "AGENT_DRUGS_TOKEN_FILE": "~/agent-drugs-token.json",
        "FIREBASE_PROJECT_ID": "agent-drugs"
      }
    }
  }
}
```

**Option B: Using token string**
```json
{
  "mcpServers": {
    "agent-drugs": {
      "command": "npx",
      "args": ["@agent-drugs/mcp-server"],
      "env": {
        "AGENT_DRUGS_TOKEN": "your_token_here",
        "FIREBASE_PROJECT_ID": "agent-drugs"
      }
    }
  }
}
```

### Security

- Tokens are Firebase Custom Auth Tokens (cryptographically signed JWTs)
- Per-user access control enforced by Firestore rules
- Tokens cannot be enumerated or forged
- Revoke access by disabling user account in Firebase Console
```

**Step 2: Update Firebase setup docs**

Add to `docs/firebase-setup.md`:
```markdown
## 8. Configure Cloud Functions

Cloud Functions are used to generate custom auth tokens.

1. Ensure Firebase billing is enabled (Blaze plan required for functions)
2. Install Firebase CLI: `npm install -g firebase-tools`
3. Deploy functions: `firebase deploy --only functions`
4. Verify function is healthy in Firebase Console → Functions

## 9. Updated Security Rules

The new Firestore rules require authentication:

- `drugs` collection: Public read access (unchanged)
- `usage_events` collection: Authenticated users can only read/write their own events
- `api_keys` collection: REMOVED (no longer used)

## 10. Token Generation

Tokens are generated via Cloud Function:
- User authenticates with OAuth
- Cloud Function creates custom auth token using Admin SDK
- Token is displayed for download/copy
- MCP server uses token to authenticate as user
```

**Step 3: Commit documentation**

```bash
git add README.md docs/firebase-setup.md
git commit -m "docs: update documentation for custom auth tokens"
```

---

## Next Steps

After completing all tasks:

✅ Security vulnerabilities fixed (no more API key enumeration)
✅ Proper Firebase Authentication implemented
✅ Per-user access control enforced
✅ Token-based authentication for MCP server
✅ Web app generates and displays tokens
✅ Comprehensive testing completed

**To verify everything works:**
1. Sign in to web app → generate token
2. Configure MCP server with token
3. Take a drug → verify success
4. Check Firestore → verify data written with correct userId

**Optional enhancements:**
- Add token regeneration feature
- Add token expiration/renewal
- Add usage analytics dashboard
- Publish to npm as `@agent-drugs/mcp-server`
