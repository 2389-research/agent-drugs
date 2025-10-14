# Phase 2: Web UI and Authentication Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Build minimal web UI for user signup (Google/GitHub OAuth) and API key generation, plus update MCP server to validate keys via Firestore queries.

**Architecture:** Static web app on Firebase Hosting uses Firebase Auth SDK for OAuth. On first login, generates random API key and stores in Firestore `api_keys` collection. MCP server queries this collection via Firestore REST API to validate keys instead of calling non-existent endpoint.

**Tech Stack:** Firebase Auth, Firebase Hosting, Vanilla JavaScript, Firestore REST API (server-side)

---

## Task 1: Update MCP Server - Firestore Query for validateApiKey (TDD)

**Files:**
- Modify: `src/firebase-client.ts:20-62`
- Modify: `src/firebase-client.test.ts`

**Step 1: Write failing test for Firestore query validation**

Add to `src/firebase-client.test.ts` after existing validateApiKey tests:

```typescript
describe('FirebaseClient', () => {
  // ... existing tests ...

  describe('validateApiKey with Firestore query', () => {
    it('should query api_keys collection and return userId', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            document: {
              name: 'projects/test/databases/(default)/documents/api_keys/key123',
              fields: {
                key: { stringValue: 'test_key_123' },
                userId: { stringValue: 'user_456' },
                createdAt: { timestampValue: '2025-10-13T00:00:00Z' }
              }
            }
          }
        ])
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient(
        'https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents',
        'test_key_123'
      );
      const userId = await client.validateApiKey();

      expect(userId).toBe('user_456');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(':runQuery'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('api_keys')
        })
      );
    });

    it('should throw if no matching API key found', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ([]) // Empty result
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient(
        'https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents',
        'invalid_key'
      );

      await expect(client.validateApiKey()).rejects.toThrow(FirebaseAuthError);
      await expect(client.validateApiKey()).rejects.toThrow('Invalid API key');
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test src/firebase-client.test.ts`

Expected: FAIL - tests timeout or fail because validateApiKey still uses old POST logic

**Step 3: Rewrite validateApiKey to use Firestore query**

Replace the `validateApiKey()` method in `src/firebase-client.ts`:

```typescript
async validateApiKey(): Promise<string> {
  // Construct Firestore runQuery endpoint
  const queryUrl = `${this.apiUrl}:runQuery`;

  // Build structured query to find API key
  const query = {
    structuredQuery: {
      from: [{ collectionId: 'api_keys' }],
      where: {
        fieldFilter: {
          field: { fieldPath: 'key' },
          op: 'EQUAL',
          value: { stringValue: this.apiKey }
        }
      },
      limit: 1
    }
  };

  let response: Response;
  try {
    response = await fetch(queryUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(query),
    });
  } catch (error) {
    throw new FirebaseAuthError(
      `Network error during authentication: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }

  if (!response.ok) {
    throw new FirebaseAuthError(
      `Firestore query failed: ${response.status} ${response.statusText}`
    );
  }

  let results: any[];
  try {
    results = await response.json();
  } catch (error) {
    throw new FirebaseAuthError(
      `Invalid response format: Expected JSON but received invalid data`
    );
  }

  // Check if we got a result
  if (!results || results.length === 0 || !results[0].document) {
    throw new FirebaseAuthError('Invalid API key');
  }

  // Extract userId from Firestore document
  const doc = results[0].document;
  const userId = doc.fields?.userId?.stringValue;

  if (!userId || userId.trim() === '') {
    throw new FirebaseAuthError('Invalid response: Missing userId in API key document');
  }

  return userId;
}
```

**Step 4: Run test to verify it passes**

Run: `npm test src/firebase-client.test.ts`

Expected: PASS - all tests pass (may need to adjust mock response format)

**Step 5: Commit**

```bash
git add src/firebase-client.ts src/firebase-client.test.ts
git commit -m "feat: update validateApiKey to query Firestore api_keys collection"
```

---

## Task 2: Create Web App Structure

**Files:**
- Create: `public/index.html`
- Create: `public/app.js`
- Create: `public/styles.css`
- Create: `firebase.json`
- Create: `.firebaserc`

**Step 1: Create Firebase hosting config**

Create `firebase.json`:
```json
{
  "hosting": {
    "public": "public",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ]
  }
}
```

Create `.firebaserc`:
```json
{
  "projects": {
    "default": "agent-drugs"
  }
}
```

**Step 2: Create HTML structure**

Create `public/index.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agent Drugs - Get Your API Key</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="container">
    <h1>🧪 Agent Drugs</h1>
    <p class="tagline">Give your AI agent superpowers</p>

    <!-- Login section (shown when not authenticated) -->
    <div id="login-section" class="section">
      <p>Sign in to get your API key</p>
      <button id="google-signin" class="btn btn-google">Sign in with Google</button>
      <button id="github-signin" class="btn btn-github">Sign in with GitHub</button>
    </div>

    <!-- API key section (shown when authenticated) -->
    <div id="key-section" class="section hidden">
      <h2>Your API Key</h2>
      <div class="key-container">
        <code id="api-key" class="api-key">Loading...</code>
        <button id="copy-key" class="btn btn-copy">Copy</button>
      </div>

      <h3>Installation</h3>
      <p>Add this to your Claude Code MCP config:</p>
      <pre><code>{
  "mcpServers": {
    "agent-drugs": {
      "command": "npx",
      "args": ["@agent-drugs/mcp-server"],
      "env": {
        "AGENT_DRUGS_API_KEY": "<span id="key-in-config">your-key-here</span>",
        "FIREBASE_PROJECT_ID": "agent-drugs"
      }
    }
  }
}</code></pre>

      <button id="sign-out" class="btn btn-secondary">Sign Out</button>
    </div>

    <!-- Error section -->
    <div id="error-section" class="section hidden">
      <p class="error" id="error-message"></p>
    </div>
  </div>

  <!-- Firebase SDKs -->
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
  <script src="app.js"></script>
</body>
</html>
```

**Step 3: Create CSS styles**

Create `public/styles.css`:
```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.container {
  background: white;
  border-radius: 16px;
  padding: 40px;
  max-width: 600px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

h1 {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  text-align: center;
}

.tagline {
  text-align: center;
  color: #666;
  margin-bottom: 2rem;
}

.section {
  margin-top: 2rem;
}

.hidden {
  display: none !important;
}

.btn {
  display: inline-block;
  padding: 12px 24px;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  width: 100%;
  margin-bottom: 10px;
}

.btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.btn-google {
  background: #4285f4;
  color: white;
}

.btn-github {
  background: #24292e;
  color: white;
}

.btn-copy {
  background: #10b981;
  color: white;
  width: auto;
  margin-left: 10px;
}

.btn-secondary {
  background: #e5e7eb;
  color: #374151;
}

.key-container {
  display: flex;
  align-items: center;
  margin: 1rem 0;
}

.api-key {
  flex: 1;
  padding: 12px;
  background: #f3f4f6;
  border-radius: 8px;
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.9rem;
  word-break: break-all;
}

pre {
  background: #1f2937;
  color: #e5e7eb;
  padding: 20px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 1rem 0;
}

pre code {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 0.85rem;
}

#key-in-config {
  color: #fbbf24;
  font-weight: bold;
}

.error {
  color: #dc2626;
  padding: 12px;
  background: #fee2e2;
  border-radius: 8px;
  text-align: center;
}

h2, h3 {
  margin-top: 1.5rem;
  margin-bottom: 0.5rem;
}
```

**Step 4: Create JavaScript app logic stub**

Create `public/app.js`:
```javascript
// Firebase configuration (will be filled in next task)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "agent-drugs.firebaseapp.com",
  projectId: "agent-drugs",
  storageBucket: "agent-drugs.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

// DOM elements
const loginSection = document.getElementById('login-section');
const keySection = document.getElementById('key-section');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const googleSignInBtn = document.getElementById('google-signin');
const githubSignInBtn = document.getElementById('github-signin');
const signOutBtn = document.getElementById('sign-out');
const copyKeyBtn = document.getElementById('copy-key');
const apiKeyDisplay = document.getElementById('api-key');
const keyInConfig = document.getElementById('key-in-config');

// Show error
function showError(message) {
  errorMessage.textContent = message;
  errorSection.classList.remove('hidden');
  setTimeout(() => {
    errorSection.classList.add('hidden');
  }, 5000);
}

// Auth state observer (placeholder for next task)
auth.onAuthStateChanged((user) => {
  if (user) {
    console.log('User logged in:', user.uid);
    // Will implement key generation in next task
  } else {
    loginSection.classList.remove('hidden');
    keySection.classList.add('hidden');
  }
});

// Sign in handlers (placeholder)
googleSignInBtn.addEventListener('click', () => {
  console.log('Google sign-in clicked');
});

githubSignInBtn.addEventListener('click', () => {
  console.log('GitHub sign-in clicked');
});

signOutBtn.addEventListener('click', () => {
  auth.signOut();
});

copyKeyBtn.addEventListener('click', () => {
  const keyText = apiKeyDisplay.textContent;
  navigator.clipboard.writeText(keyText).then(() => {
    copyKeyBtn.textContent = 'Copied!';
    setTimeout(() => {
      copyKeyBtn.textContent = 'Copy';
    }, 2000);
  });
});
```

**Step 5: Commit**

```bash
git add public/ firebase.json .firebaserc
git commit -m "feat: create web app structure with HTML, CSS, JS"
```

---

## Task 3: Implement OAuth Sign-In

**Files:**
- Modify: `public/app.js`

**Step 1: Add Firebase config**

Replace the placeholder `firebaseConfig` in `public/app.js` with actual values from Firebase Console (Project Settings → Your apps → Web app).

**Step 2: Implement Google Sign-In**

Replace the Google sign-in handler:

```javascript
googleSignInBtn.addEventListener('click', async () => {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error('Google sign-in error:', error);
    showError('Failed to sign in with Google. Please try again.');
  }
});
```

**Step 3: Implement GitHub Sign-In**

Replace the GitHub sign-in handler:

```javascript
githubSignInBtn.addEventListener('click', async () => {
  try {
    const provider = new firebase.auth.GithubAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (error) {
    console.error('GitHub sign-in error:', error);
    showError('Failed to sign in with GitHub. Please try again.');
  }
});
```

**Step 4: Test locally**

Run: `firebase serve --only hosting`

Expected: Can click sign-in buttons, OAuth popup appears (will fail without enabling providers)

**Step 5: Commit**

```bash
git add public/app.js
git commit -m "feat: implement OAuth sign-in with Google and GitHub"
```

---

## Task 4: Implement API Key Generation

**Files:**
- Modify: `public/app.js`

**Step 1: Add key generation function**

Add before the `auth.onAuthStateChanged` block:

```javascript
// Generate random API key
function generateApiKey() {
  const prefix = 'agdrug_';
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const length = 32;
  let key = prefix;

  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);

  for (let i = 0; i < length; i++) {
    key += charset[randomValues[i] % charset.length];
  }

  return key;
}

// Get or create API key for user
async function getOrCreateApiKey(userId) {
  try {
    // Query for existing key
    const snapshot = await db.collection('api_keys')
      .where('userId', '==', userId)
      .limit(1)
      .get();

    if (!snapshot.empty) {
      // Return existing key
      return snapshot.docs[0].data().key;
    }

    // Generate new key
    const newKey = generateApiKey();
    await db.collection('api_keys').add({
      key: newKey,
      userId: userId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    return newKey;
  } catch (error) {
    console.error('Error getting/creating API key:', error);
    throw error;
  }
}
```

**Step 2: Update auth state handler**

Replace the `auth.onAuthStateChanged` block:

```javascript
auth.onAuthStateChanged(async (user) => {
  if (user) {
    loginSection.classList.add('hidden');
    keySection.classList.remove('hidden');

    try {
      // Get or create API key
      const apiKey = await getOrCreateApiKey(user.uid);

      // Display key
      apiKeyDisplay.textContent = apiKey;
      keyInConfig.textContent = apiKey;
    } catch (error) {
      console.error('Error loading API key:', error);
      showError('Failed to load API key. Please refresh the page.');
    }
  } else {
    loginSection.classList.remove('hidden');
    keySection.classList.add('hidden');
  }
});
```

**Step 3: Test locally**

Run: `firebase serve --only hosting`

Expected: After sign-in, should generate and display API key

**Step 4: Commit**

```bash
git add public/app.js
git commit -m "feat: implement API key generation and display"
```

---

## Task 5: Configure Firebase Auth Providers

**Files:**
- None (Firebase Console configuration)

**Step 1: Enable Google OAuth**

1. Go to Firebase Console → Authentication → Sign-in method
2. Click "Google" provider
3. Enable it
4. Save

**Step 2: Enable GitHub OAuth**

1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Application name: "Agent Drugs"
3. Homepage URL: `https://agent-drugs.web.app`
4. Authorization callback URL: `https://agent-drugs.firebaseapp.com/__/auth/handler`
5. Register application
6. Copy Client ID and Client Secret
7. In Firebase Console → Authentication → Sign-in method
8. Click "GitHub" provider
9. Enable it
10. Paste Client ID and Client Secret
11. Save

**Step 3: Update Firestore Security Rules**

In Firebase Console → Firestore Database → Rules, replace with:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Anyone can read drugs
    match /drugs/{drugId} {
      allow read: if true;
      allow write: if false;
    }

    // API keys: users can only read/create their own
    match /api_keys/{keyId} {
      allow read: if request.auth != null &&
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null &&
        request.resource.data.userId == request.auth.uid &&
        request.resource.data.keys().hasAll(['key', 'userId', 'createdAt']);
    }

    // Usage events: authenticated users can create, only read their own
    match /usage_events/{eventId} {
      allow read: if request.auth != null &&
        resource.data.userId == request.auth.uid;
      allow create: if request.auth != null;
    }
  }
}
```

**Step 4: Publish rules**

Click "Publish" in Firestore Rules editor

**Step 5: Document**

Create note in `docs/firebase-setup.md` about OAuth configuration steps

---

## Task 6: Deploy to Firebase Hosting

**Files:**
- None (deployment only)

**Step 1: Build MCP server**

Run: `npm run build`

Expected: Clean build, no errors

**Step 2: Install Firebase CLI (if not installed)**

Run: `npm install -g firebase-tools`

Expected: Firebase CLI installed

**Step 3: Login to Firebase**

Run: `firebase login`

Expected: Browser opens, successful login

**Step 4: Deploy hosting**

Run: `firebase deploy --only hosting`

Expected: Deployment succeeds, shows URL: https://agent-drugs.web.app

**Step 5: Test deployed app**

1. Visit https://agent-drugs.web.app
2. Sign in with Google or GitHub
3. Verify API key appears
4. Click copy button
5. Verify key is copied

**Step 6: Document deployment**

Add deployment instructions to README.md:

```markdown
## Deployment

Deploy web app:
```bash
firebase deploy --only hosting
```

Deploy Firestore rules:
```bash
firebase deploy --only firestore:rules
```
```

**Step 7: Commit**

```bash
git add README.md
git commit -m "docs: add Firebase deployment instructions"
```

---

## Task 7: End-to-End Testing

**Files:**
- Create: `docs/e2e-testing.md`

**Step 1: Create E2E test documentation**

Create `docs/e2e-testing.md`:

```markdown
# End-to-End Testing Guide

## Prerequisites
- Firebase project configured with Auth (Google, GitHub)
- Web app deployed to Firebase Hosting
- MCP server built (`npm run build`)

## Test Flow

### 1. Web App Sign-Up
1. Visit https://agent-drugs.web.app
2. Click "Sign in with Google"
3. Complete OAuth flow
4. ✓ Verify: API key appears (starts with `agdrug_`)
5. Click "Copy" button
6. ✓ Verify: Button shows "Copied!" briefly

### 2. Check Firestore
1. Go to Firebase Console → Firestore Database
2. Open `api_keys` collection
3. ✓ Verify: Document exists with your userId and key
4. Check `createdAt` timestamp

### 3. Configure Claude Code
1. Open Claude Code MCP config (`~/.claude/config.json`)
2. Add agent-drugs server with your API key:
   ```json
   {
     "mcpServers": {
       "agent-drugs": {
         "command": "node",
         "args": ["/path/to/agent-drugs/dist/index.js"],
         "env": {
           "AGENT_DRUGS_API_KEY": "agdrug_your_actual_key",
           "FIREBASE_PROJECT_ID": "agent-drugs"
         }
       }
     }
   }
   ```
3. Restart Claude Code

### 4. Test MCP Tools
1. In Claude Code, ask: "What MCP tools do you have?"
2. ✓ Verify: Shows agent-drugs tools (list_drugs, take_drug, active_drugs)

3. Ask: "Use the list_drugs tool"
4. ✓ Verify: Returns list of available drugs from Firestore

5. Ask: "Use the active_drugs tool"
6. ✓ Verify: Returns "No active drugs"

7. Ask: "Take the [drug-name] drug for 60 minutes"
8. ✓ Verify: Success message (no authentication error)

9. Ask: "What drugs are currently active?"
10. ✓ Verify: Shows the drug you just took with time remaining

### 5. Verify Firebase Writes
1. Go to Firebase Console → Firestore Database
2. Open `usage_events` collection
3. ✓ Verify: New document created with:
   - userId (your uid)
   - drugName
   - timestamp (recent)
   - expiresAt (timestamp + duration)

### 6. Test Expiration
1. Take a drug with 1-minute duration
2. Wait 2 minutes
3. Ask: "What drugs are currently active?"
4. ✓ Verify: Shows "No active drugs"

### 7. Test Multiple Users
1. Sign out of web app
2. Sign in with different account (GitHub if used Google before)
3. ✓ Verify: Gets different API key
4. Configure second Claude Code instance with new key
5. ✓ Verify: Both instances work independently

## Troubleshooting

### "Authentication failed: 400 Bad Request"
- Old error from Phase 1, should not occur anymore
- If still happening: check AGENT_DRUGS_API_KEY is correct
- Verify key exists in Firestore `api_keys` collection

### "Invalid API key"
- Key not found in Firestore
- Check you copied the correct key from web app
- Verify Firestore security rules allow reads

### Web app shows "Failed to load API key"
- Check browser console for errors
- Verify Firestore security rules
- Check user is authenticated (try signing out and back in)

### "Failed to fetch drugs"
- Check drug exists in Firestore `drugs` collection
- Verify security rules allow reading drugs
```

**Step 2: Run E2E test**

Follow the steps in the document you just created

**Step 3: Document results**

In the same file, add a "Test Results" section with:
- Date tested
- Pass/fail for each step
- Any issues encountered

**Step 4: Commit**

```bash
git add docs/e2e-testing.md
git commit -m "docs: add end-to-end testing guide"
```

---

## Next Steps

After completing all tasks, you will have:

✅ Web app for user signup and API key generation
✅ MCP server that validates keys via Firestore
✅ OAuth with Google and GitHub
✅ Complete documentation
✅ End-to-end tested system

**To continue development:**

1. **Publish MCP server to npm** as `@agent-drugs/mcp-server`
2. **Add key regeneration** feature to web app
3. **Build Phase 3**: Dashboard with usage stats and leaderboard
4. **Add more drugs** to Firestore collection
