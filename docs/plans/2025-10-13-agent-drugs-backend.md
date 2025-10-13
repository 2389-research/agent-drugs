# Agent Drugs Backend Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Build an MCP server that allows Claude Code agents to "take digital drugs" that modify their behavior via prompt injection, with Firebase backend for auth, drug storage, and telemetry.

**Architecture:** TypeScript MCP server provides tools (list_drugs, take_drug, active_drugs, authenticate) and SessionStart hook. In-memory state tracks active drugs with real-time expiration. Firebase REST API for auth validation and Firestore for drug definitions and usage events.

**Tech Stack:** TypeScript, @modelcontextprotocol/sdk, Firebase REST API (Auth + Firestore), Jest, MCP Inspector

---

## Task 1: Project Initialization

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.gitignore`
- Create: `README.md`

**Step 1: Initialize npm project**

Run:
```bash
npm init -y
```

Expected: Creates package.json

**Step 2: Install dependencies**

Run:
```bash
npm install @modelcontextprotocol/sdk
npm install --save-dev typescript @types/node jest ts-jest @types/jest
```

Expected: Dependencies installed, package-lock.json created

**Step 3: Create TypeScript config**

Create `tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**Step 4: Create gitignore**

Create `.gitignore`:
```
node_modules/
dist/
*.log
.env
.DS_Store
```

**Step 5: Add build scripts to package.json**

Modify `package.json` to add:
```json
{
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "dev": "tsc --watch"
  },
  "main": "dist/index.js",
  "bin": {
    "agent-drugs-mcp": "./dist/index.js"
  }
}
```

**Step 6: Create README**

Create `README.md`:
```markdown
# Agent Drugs MCP Server

MCP server for Claude Code agents to take "digital drugs" that modify their behavior.

## Installation

\`\`\`bash
npm install -g @agent-drugs/mcp-server
\`\`\`

## Configuration

Add to Claude Code MCP config with your API key:

\`\`\`json
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
\`\`\`

## Development

\`\`\`bash
npm run build
npm test
\`\`\`

## Testing with MCP Inspector

\`\`\`bash
npx @modelcontextprotocol/inspector node dist/index.js
\`\`\`
```

**Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: initialize project with TypeScript and MCP SDK"
```

---

## Task 2: Config Module (TDD)

**Files:**
- Create: `src/config.ts`
- Create: `src/config.test.ts`

**Step 1: Write failing test for config loading**

Create `src/config.test.ts`:
```typescript
import { loadConfig, Config } from './config';

describe('loadConfig', () => {
  it('should load API key from environment', () => {
    process.env.AGENT_DRUGS_API_KEY = 'test_key_123';
    const config = loadConfig();
    expect(config.apiKey).toBe('test_key_123');
  });

  it('should throw if API key is missing', () => {
    delete process.env.AGENT_DRUGS_API_KEY;
    expect(() => loadConfig()).toThrow('AGENT_DRUGS_API_KEY not set');
  });

  it('should use provided Firebase project ID or default', () => {
    process.env.AGENT_DRUGS_API_KEY = 'test_key';
    process.env.FIREBASE_PROJECT_ID = 'my-project';
    const config = loadConfig();
    expect(config.firebaseProjectId).toBe('my-project');
  });
});
```

**Step 2: Configure Jest**

Create `jest.config.js`:
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.test.ts'],
};
```

**Step 3: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - module './config' not found

**Step 4: Write minimal implementation**

Create `src/config.ts`:
```typescript
export interface Config {
  apiKey: string;
  firebaseProjectId: string;
  firebaseApiUrl: string;
}

export function loadConfig(): Config {
  const apiKey = process.env.AGENT_DRUGS_API_KEY;
  if (!apiKey) {
    throw new Error('AGENT_DRUGS_API_KEY environment variable must be set');
  }

  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'agent-drugs-prod';
  const firebaseApiUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents`;

  return {
    apiKey,
    firebaseProjectId,
    firebaseApiUrl,
  };
}
```

**Step 5: Run test to verify it passes**

Run: `npm test`

Expected: PASS - all tests pass

**Step 6: Commit**

```bash
git add src/config.ts src/config.test.ts jest.config.js
git commit -m "feat: add config module with API key loading"
```

---

## Task 3: Firebase Client - Authentication (TDD)

**Files:**
- Create: `src/firebase-client.ts`
- Create: `src/firebase-client.test.ts`

**Step 1: Write failing test for API key validation**

Create `src/firebase-client.test.ts`:
```typescript
import { FirebaseClient, FirebaseAuthError } from './firebase-client';

describe('FirebaseClient', () => {
  describe('validateApiKey', () => {
    it('should validate API key and return user ID', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ userId: 'user_123', valid: true }),
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://api.example.com', 'test_key');
      const userId = await client.validateApiKey();

      expect(userId).toBe('user_123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/validateApiKey',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: 'test_key' }),
        })
      );
    });

    it('should throw FirebaseAuthError on invalid key', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://api.example.com', 'bad_key');

      await expect(client.validateApiKey()).rejects.toThrow(FirebaseAuthError);
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - module './firebase-client' not found

**Step 3: Write minimal implementation**

Create `src/firebase-client.ts`:
```typescript
export class FirebaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirebaseAuthError';
  }
}

export class FirebaseClient {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string
  ) {}

  async validateApiKey(): Promise<string> {
    const response = await fetch(`${this.apiUrl}/validateApiKey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey: this.apiKey }),
    });

    if (!response.ok) {
      throw new FirebaseAuthError(
        `Authentication failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json();
    return data.userId;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/firebase-client.ts src/firebase-client.test.ts
git commit -m "feat: add Firebase client with API key validation"
```

---

## Task 4: Firebase Client - Fetch Drugs (TDD)

**Files:**
- Modify: `src/firebase-client.ts`
- Modify: `src/firebase-client.test.ts`

**Step 1: Write failing test for fetching drugs**

Add to `src/firebase-client.test.ts`:
```typescript
describe('FirebaseClient', () => {
  // ... existing tests ...

  describe('fetchDrugs', () => {
    it('should fetch all drugs from Firestore', async () => {
      const mockDrugs = [
        {
          name: 'focus',
          prompt: 'You are extremely focused and detail-oriented.',
          defaultDurationMinutes: 60,
        },
        {
          name: 'creative',
          prompt: 'You are highly creative and think outside the box.',
          defaultDurationMinutes: 120,
        },
      ];

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          documents: mockDrugs.map(drug => ({
            name: `projects/test/databases/(default)/documents/drugs/${drug.name}`,
            fields: {
              name: { stringValue: drug.name },
              prompt: { stringValue: drug.prompt },
              defaultDurationMinutes: { integerValue: drug.defaultDurationMinutes.toString() },
            },
          })),
        }),
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents', 'test_key');
      const drugs = await client.fetchDrugs();

      expect(drugs).toEqual(mockDrugs);
    });
  });
});
```

**Step 2: Add Drug type definition**

Add to top of `src/firebase-client.ts`:
```typescript
export interface Drug {
  name: string;
  prompt: string;
  defaultDurationMinutes: number;
}
```

**Step 3: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - fetchDrugs is not a function

**Step 4: Write minimal implementation**

Add to `src/firebase-client.ts` (in FirebaseClient class):
```typescript
async fetchDrugs(): Promise<Drug[]> {
  const response = await fetch(`${this.apiUrl}/drugs`, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch drugs: ${response.status}`);
  }

  const data = await response.json();

  return data.documents.map((doc: any) => ({
    name: doc.fields.name.stringValue,
    prompt: doc.fields.prompt.stringValue,
    defaultDurationMinutes: parseInt(doc.fields.defaultDurationMinutes.integerValue, 10),
  }));
}
```

**Step 5: Run test to verify it passes**

Run: `npm test`

Expected: PASS - all tests pass

**Step 6: Commit**

```bash
git add src/firebase-client.ts src/firebase-client.test.ts
git commit -m "feat: add drug fetching from Firestore"
```

---

## Task 5: Firebase Client - Record Usage Event (TDD)

**Files:**
- Modify: `src/firebase-client.ts`
- Modify: `src/firebase-client.test.ts`

**Step 1: Write failing test for recording usage**

Add to `src/firebase-client.test.ts`:
```typescript
describe('FirebaseClient', () => {
  // ... existing tests ...

  describe('recordUsageEvent', () => {
    it('should write usage event to Firestore', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'projects/test/databases/(default)/documents/usage_events/evt_123' }),
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents', 'test_key');
      await client.recordUsageEvent('user_123', 'focus', 60);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents/usage_events',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"userId"'),
        })
      );
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - recordUsageEvent is not a function

**Step 3: Write minimal implementation**

Add to `src/firebase-client.ts` (in FirebaseClient class):
```typescript
async recordUsageEvent(
  userId: string,
  drugName: string,
  durationMinutes: number
): Promise<void> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

  const document = {
    fields: {
      userId: { stringValue: userId },
      drugName: { stringValue: drugName },
      timestamp: { timestampValue: now.toISOString() },
      durationMinutes: { integerValue: durationMinutes.toString() },
      expiresAt: { timestampValue: expiresAt.toISOString() },
    },
  };

  const response = await fetch(`${this.apiUrl}/usage_events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(document),
  });

  if (!response.ok) {
    throw new Error(`Failed to record usage event: ${response.status}`);
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/firebase-client.ts src/firebase-client.test.ts
git commit -m "feat: add usage event recording to Firestore"
```

---

## Task 6: State Manager - Active Drugs Tracking (TDD)

**Files:**
- Create: `src/state-manager.ts`
- Create: `src/state-manager.test.ts`

**Step 1: Write failing test for adding and checking active drugs**

Create `src/state-manager.test.ts`:
```typescript
import { StateManager } from './state-manager';

describe('StateManager', () => {
  let manager: StateManager;

  beforeEach(() => {
    manager = new StateManager();
  });

  it('should add a drug with expiration', () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    manager.addDrug('focus', 'Be focused!', expiresAt);

    const active = manager.getActiveDrugs();
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('focus');
    expect(active[0].prompt).toBe('Be focused!');
  });

  it('should filter out expired drugs', () => {
    const past = new Date(Date.now() - 1000); // 1 second ago
    const future = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    manager.addDrug('expired', 'Old prompt', past);
    manager.addDrug('active', 'Active prompt', future);

    const active = manager.getActiveDrugs();
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('active');
  });

  it('should return empty array when no drugs are active', () => {
    const active = manager.getActiveDrugs();
    expect(active).toEqual([]);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - module './state-manager' not found

**Step 3: Write minimal implementation**

Create `src/state-manager.ts`:
```typescript
export interface ActiveDrug {
  name: string;
  prompt: string;
  expiresAt: Date;
}

export class StateManager {
  private drugs: Map<string, ActiveDrug> = new Map();

  addDrug(name: string, prompt: string, expiresAt: Date): void {
    this.drugs.set(name, { name, prompt, expiresAt });
  }

  getActiveDrugs(): ActiveDrug[] {
    const now = new Date();
    const active: ActiveDrug[] = [];

    for (const [name, drug] of this.drugs.entries()) {
      if (drug.expiresAt > now) {
        active.push(drug);
      } else {
        // Clean up expired drugs
        this.drugs.delete(name);
      }
    }

    return active;
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/state-manager.ts src/state-manager.test.ts
git commit -m "feat: add state manager for active drugs tracking"
```

---

## Task 7: MCP Tools - List Drugs (TDD)

**Files:**
- Create: `src/tools/list-drugs.ts`
- Create: `src/tools/list-drugs.test.ts`

**Step 1: Write failing test for list drugs tool**

Create `src/tools/list-drugs.test.ts`:
```typescript
import { listDrugsTool } from './list-drugs';
import { FirebaseClient } from '../firebase-client';

describe('listDrugsTool', () => {
  it('should return list of available drugs', async () => {
    const mockClient = {
      fetchDrugs: jest.fn().mockResolvedValue([
        { name: 'focus', prompt: 'Be focused', defaultDurationMinutes: 60 },
        { name: 'creative', prompt: 'Be creative', defaultDurationMinutes: 120 },
      ]),
    } as any;

    const result = await listDrugsTool(mockClient);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('focus');
    expect(result.content[0].text).toContain('creative');
  });

  it('should handle errors gracefully', async () => {
    const mockClient = {
      fetchDrugs: jest.fn().mockRejectedValue(new Error('Network error')),
    } as any;

    const result = await listDrugsTool(mockClient);

    expect(result.content[0].text).toContain('Error');
    expect(result.isError).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - module './list-drugs' not found

**Step 3: Write minimal implementation**

Create `src/tools/list-drugs.ts`:
```typescript
import { FirebaseClient } from '../firebase-client';

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export async function listDrugsTool(client: FirebaseClient): Promise<ToolResult> {
  try {
    const drugs = await client.fetchDrugs();

    const text = drugs.map(drug =>
      `**${drug.name}** (${drug.defaultDurationMinutes} min)\n${drug.prompt}`
    ).join('\n\n');

    return {
      content: [{ type: 'text', text: `Available drugs:\n\n${text}` }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error fetching drugs: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/tools/list-drugs.ts src/tools/list-drugs.test.ts
git commit -m "feat: add list_drugs tool implementation"
```

---

## Task 8: MCP Tools - Take Drug (TDD)

**Files:**
- Create: `src/tools/take-drug.ts`
- Create: `src/tools/take-drug.test.ts`

**Step 1: Write failing test for take drug tool**

Create `src/tools/take-drug.test.ts`:
```typescript
import { takeDrugTool } from './take-drug';
import { FirebaseClient } from '../firebase-client';
import { StateManager } from '../state-manager';

describe('takeDrugTool', () => {
  it('should take a drug and record usage', async () => {
    const mockClient = {
      validateApiKey: jest.fn().mockResolvedValue('user_123'),
      fetchDrugs: jest.fn().mockResolvedValue([
        { name: 'focus', prompt: 'Be focused!', defaultDurationMinutes: 60 },
      ]),
      recordUsageEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    const mockState = {
      addDrug: jest.fn(),
    } as any;

    const args = { name: 'focus', duration: 60 };
    const result = await takeDrugTool(args, mockClient, mockState);

    expect(mockClient.validateApiKey).toHaveBeenCalled();
    expect(mockClient.recordUsageEvent).toHaveBeenCalledWith('user_123', 'focus', 60);
    expect(mockState.addDrug).toHaveBeenCalledWith('focus', 'Be focused!', expect.any(Date));
    expect(result.content[0].text).toContain('focus');
    expect(result.content[0].text).toContain('60 minutes');
  });

  it('should use default duration if not provided', async () => {
    const mockClient = {
      validateApiKey: jest.fn().mockResolvedValue('user_123'),
      fetchDrugs: jest.fn().mockResolvedValue([
        { name: 'creative', prompt: 'Be creative!', defaultDurationMinutes: 120 },
      ]),
      recordUsageEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    const mockState = {
      addDrug: jest.fn(),
    } as any;

    const args = { name: 'creative' };
    await takeDrugTool(args, mockClient, mockState);

    expect(mockClient.recordUsageEvent).toHaveBeenCalledWith('user_123', 'creative', 120);
  });

  it('should handle drug not found', async () => {
    const mockClient = {
      validateApiKey: jest.fn().mockResolvedValue('user_123'),
      fetchDrugs: jest.fn().mockResolvedValue([]),
    } as any;

    const mockState = {} as any;

    const args = { name: 'nonexistent' };
    const result = await takeDrugTool(args, mockClient, mockState);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - module './take-drug' not found

**Step 3: Write minimal implementation**

Create `src/tools/take-drug.ts`:
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
    // Validate user
    const userId = await client.validateApiKey();

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
    await client.recordUsageEvent(userId, drug.name, duration);

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

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/tools/take-drug.ts src/tools/take-drug.test.ts
git commit -m "feat: add take_drug tool implementation"
```

---

## Task 9: MCP Tools - Active Drugs (TDD)

**Files:**
- Create: `src/tools/active-drugs.ts`
- Create: `src/tools/active-drugs.test.ts`

**Step 1: Write failing test for active drugs tool**

Create `src/tools/active-drugs.test.ts`:
```typescript
import { activeDrugsTool } from './active-drugs';
import { StateManager } from '../state-manager';

describe('activeDrugsTool', () => {
  it('should return list of active drugs with time remaining', () => {
    const now = Date.now();
    const mockState = {
      getActiveDrugs: jest.fn().mockReturnValue([
        {
          name: 'focus',
          prompt: 'Be focused!',
          expiresAt: new Date(now + 30 * 60 * 1000), // 30 min remaining
        },
        {
          name: 'creative',
          prompt: 'Be creative!',
          expiresAt: new Date(now + 90 * 60 * 1000), // 90 min remaining
        },
      ]),
    } as any;

    const result = activeDrugsTool(mockState);

    expect(result.content[0].text).toContain('focus');
    expect(result.content[0].text).toContain('creative');
    expect(result.content[0].text).toMatch(/30.*min/);
    expect(result.content[0].text).toMatch(/90.*min/);
  });

  it('should handle no active drugs', () => {
    const mockState = {
      getActiveDrugs: jest.fn().mockReturnValue([]),
    } as any;

    const result = activeDrugsTool(mockState);

    expect(result.content[0].text).toContain('No active drugs');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - module './active-drugs' not found

**Step 3: Write minimal implementation**

Create `src/tools/active-drugs.ts`:
```typescript
import { StateManager } from '../state-manager';
import { ToolResult } from './list-drugs';

export function activeDrugsTool(state: StateManager): ToolResult {
  const drugs = state.getActiveDrugs();

  if (drugs.length === 0) {
    return {
      content: [{ type: 'text', text: 'No active drugs.' }],
    };
  }

  const now = Date.now();
  const text = drugs.map(drug => {
    const remainingMs = drug.expiresAt.getTime() - now;
    const remainingMin = Math.ceil(remainingMs / 60 / 1000);
    return `**${drug.name}** - ${remainingMin} min remaining\n${drug.prompt}`;
  }).join('\n\n');

  return {
    content: [{ type: 'text', text: `Active drugs:\n\n${text}` }],
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/tools/active-drugs.ts src/tools/active-drugs.test.ts
git commit -m "feat: add active_drugs tool implementation"
```

---

## Task 10: SessionStart Hook (TDD)

**Files:**
- Create: `src/hooks.ts`
- Create: `src/hooks.test.ts`

**Step 1: Write failing test for hook prompt generation**

Create `src/hooks.test.ts`:
```typescript
import { generateSessionStartHook } from './hooks';
import { StateManager } from './state-manager';

describe('generateSessionStartHook', () => {
  it('should generate hook output with active drug prompts', () => {
    const now = Date.now();
    const mockState = {
      getActiveDrugs: jest.fn().mockReturnValue([
        {
          name: 'focus',
          prompt: 'You are extremely focused and detail-oriented.',
          expiresAt: new Date(now + 60 * 60 * 1000),
        },
        {
          name: 'creative',
          prompt: 'You think outside the box and generate novel ideas.',
          expiresAt: new Date(now + 120 * 60 * 1000),
        },
      ]),
    } as any;

    const result = generateSessionStartHook(mockState);

    expect(result.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(result.hookSpecificOutput.additionalContext).toContain('focus');
    expect(result.hookSpecificOutput.additionalContext).toContain('creative');
    expect(result.hookSpecificOutput.additionalContext).toContain('You are extremely focused');
    expect(result.hookSpecificOutput.additionalContext).toContain('You think outside the box');
  });

  it('should return empty context when no drugs are active', () => {
    const mockState = {
      getActiveDrugs: jest.fn().mockReturnValue([]),
    } as any;

    const result = generateSessionStartHook(mockState);

    expect(result.hookSpecificOutput.additionalContext).toBe('');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`

Expected: FAIL - module './hooks' not found

**Step 3: Write minimal implementation**

Create `src/hooks.ts`:
```typescript
import { StateManager } from './state-manager';

export interface HookOutput {
  hookSpecificOutput: {
    hookEventName: string;
    additionalContext: string;
  };
}

export function generateSessionStartHook(state: StateManager): HookOutput {
  const drugs = state.getActiveDrugs();

  if (drugs.length === 0) {
    return {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: '',
      },
    };
  }

  const promptText = drugs
    .map(drug => `**${drug.name}**: ${drug.prompt}`)
    .join('\n\n');

  const context = `<AGENT_DRUGS_ACTIVE>\nYou currently have the following behavioral modifications active:\n\n${promptText}\n</AGENT_DRUGS_ACTIVE>`;

  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  };
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`

Expected: PASS - all tests pass

**Step 5: Commit**

```bash
git add src/hooks.ts src/hooks.test.ts
git commit -m "feat: add SessionStart hook with prompt injection"
```

---

## Task 11: Main MCP Server

**Files:**
- Create: `src/index.ts`

**Step 1: Write main server file**

Create `src/index.ts`:
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

// Initialize components
const config = loadConfig();
const firebaseClient = new FirebaseClient(config.firebaseApiUrl, config.apiKey);
const stateManager = new StateManager();

// Create MCP server
const server = new Server(
  {
    name: 'agent-drugs',
    version: '0.1.0',
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
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agent Drugs MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
```

**Step 2: Build the server**

Run: `npm run build`

Expected: Successful compilation to dist/

**Step 3: Test with MCP Inspector**

Run:
```bash
AGENT_DRUGS_API_KEY=test_key_123 npx @modelcontextprotocol/inspector node dist/index.js
```

Expected: MCP Inspector opens in browser, shows 3 tools

**Step 4: Manual test in Inspector**
- Click "list_drugs" tool - should show error (no real Firebase yet, but tool executes)
- Click "active_drugs" tool - should return "No active drugs"

**Step 5: Commit**

```bash
git add src/index.ts
git commit -m "feat: add main MCP server with all tools and hooks"
```

---

## Task 12: Firebase Setup Documentation

**Files:**
- Create: `docs/firebase-setup.md`

**Step 1: Create Firebase setup guide**

Create `docs/firebase-setup.md`:
```markdown
# Firebase Setup Guide

## 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project"
3. Name: `agent-drugs-dev` (or production name)
4. Disable Google Analytics (optional)
5. Click "Create project"

## 2. Enable Firestore

1. In Firebase Console, click "Firestore Database"
2. Click "Create database"
3. Start in **production mode** (we'll add security rules)
4. Choose location (e.g., `us-central1`)

## 3. Create Collections

### drugs collection

Create first document manually:
```json
{
  "name": "focus",
  "prompt": "You are extremely focused and detail-oriented. Break down problems systematically and don't skip steps.",
  "defaultDurationMinutes": 60,
  "createdAt": "2025-10-13T00:00:00Z"
}
```

### usage_events collection

Will be auto-created when first drug is taken.

## 4. Set up Security Rules

Go to Firestore → Rules, replace with:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Anyone can read drugs
    match /drugs/{drugId} {
      allow read: if true;
      allow write: if false; // Only admins via console
    }

    // Authenticated users can write their own usage events
    match /usage_events/{eventId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null;
    }

    // API keys collection (created later for auth)
    match /api_keys/{keyId} {
      allow read, write: if false; // Only via backend
    }
  }
}
```

## 5. Enable Authentication

1. Go to Authentication → Get started
2. Enable "Anonymous" provider (for now, until web UI built)
3. Later: Enable Google, GitHub OAuth

## 6. Get Project Credentials

1. Project Settings → General
2. Note your Project ID: `agent-drugs-dev`
3. This goes in `FIREBASE_PROJECT_ID` env var

## 7. Create Test Drug

Add a second test drug via Firestore console:
```json
{
  "name": "creative",
  "prompt": "You are highly creative and think outside the box. Propose unconventional solutions and novel approaches.",
  "defaultDurationMinutes": 120,
  "createdAt": "2025-10-13T00:00:00Z"
}
```

## Testing

Set environment variables:
```bash
export FIREBASE_PROJECT_ID=agent-drugs-dev
export AGENT_DRUGS_API_KEY=test_key_for_dev
```

Note: Actual API key validation will be implemented in Phase 2 (web UI).
```

**Step 2: Commit**

```bash
git add docs/firebase-setup.md
git commit -m "docs: add Firebase setup guide"
```

---

## Task 13: End-to-End Testing Guide

**Files:**
- Create: `docs/testing-guide.md`

**Step 1: Create testing documentation**

Create `docs/testing-guide.md`:
```markdown
# Testing Guide

## Unit Tests

Run all unit tests:
```bash
npm test
```

Run with coverage:
```bash
npm test -- --coverage
```

## MCP Inspector Testing

Test the server in isolation:

```bash
# Set test environment
export AGENT_DRUGS_API_KEY=test_key_123
export FIREBASE_PROJECT_ID=agent-drugs-dev

# Build
npm run build

# Launch inspector
npx @modelcontextprotocol/inspector node dist/index.js
```

### Test Scenarios in Inspector

1. **List Drugs**
   - Click "list_drugs" in Tools tab
   - Execute
   - Should return list of drugs from Firestore

2. **Active Drugs (empty state)**
   - Click "active_drugs"
   - Execute
   - Should return "No active drugs"

3. **Take Drug**
   - Click "take_drug"
   - Fill params: `{ "name": "focus", "duration": 30 }`
   - Execute
   - Should confirm drug taken

4. **Active Drugs (with active drug)**
   - Click "active_drugs" again
   - Should show "focus" with ~30 min remaining

5. **SessionStart Hook**
   - Check Notifications pane
   - Should not show errors

## Claude Code Integration Testing

### Setup

1. Build the server:
   ```bash
   npm run build
   ```

2. Add to Claude Code MCP config (`~/.claude/config.json`):
   ```json
   {
     "mcpServers": {
       "agent-drugs": {
         "command": "node",
         "args": ["/absolute/path/to/agent-drugs/dist/index.js"],
         "env": {
           "AGENT_DRUGS_API_KEY": "test_key_123",
           "FIREBASE_PROJECT_ID": "agent-drugs-dev"
         }
       }
     }
   }
   ```

3. Restart Claude Code

### Test Flow

1. **Verify tools are available**
   - In Claude Code, type: "What MCP tools do you have access to?"
   - Should mention agent-drugs tools

2. **List drugs**
   - "Use the list_drugs tool"
   - Should show available drugs

3. **Take a drug**
   - "Take the focus drug for 60 minutes"
   - Should confirm success

4. **Check active drugs**
   - "What drugs are currently active?"
   - Should show focus with time remaining

5. **Test hook injection**
   - Restart Claude Code session or trigger compaction
   - Ask: "Do you have any special behavioral modifications active?"
   - Should mention the focus drug prompt

6. **Test expiration**
   - Take a drug with 1-minute duration
   - Wait 2 minutes
   - Check active drugs - should be empty

## Firebase Console Verification

After taking a drug in Claude Code:

1. Open Firebase Console
2. Go to Firestore → usage_events collection
3. Verify new document was created with:
   - userId
   - drugName
   - timestamp
   - expiresAt

## Troubleshooting

### "AGENT_DRUGS_API_KEY not set"
- Check MCP config has env vars set
- Restart Claude Code after config changes

### "Failed to fetch drugs"
- Verify Firebase project ID is correct
- Check Firestore security rules allow reading drugs collection
- Check Firestore has drugs collection with documents

### Hook not injecting prompts
- Verify drugs are active with active_drugs tool
- Check Claude Code logs for hook errors
- Restart session to trigger SessionStart hook
```

**Step 2: Commit**

```bash
git add docs/testing-guide.md
git commit -m "docs: add comprehensive testing guide"
```

---

## Next Steps

At this point, you have a fully functional backend:
- ✅ MCP server with tools (list_drugs, take_drug, active_drugs)
- ✅ SessionStart hook that injects active drug prompts
- ✅ Firebase integration for drug storage and telemetry
- ✅ State management for active drugs
- ✅ Comprehensive test coverage

**To continue development:**

1. **Set up real Firebase project** (follow `docs/firebase-setup.md`)
2. **Test end-to-end** (follow `docs/testing-guide.md`)
3. **Add more drugs** to Firestore via console
4. **Publish to npm** as `@agent-drugs/mcp-server`
5. **Build Phase 2: Web UI** (signup, dashboard, leaderboard)

**For Phase 2 (Web UI), you would need:**
- Firebase hosting for web app
- OAuth integration (Google, GitHub)
- API key generation and management
- Dashboard showing usage stats/timeline
- Admin interface for managing drugs
