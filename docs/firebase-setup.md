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

### api_keys collection

Will be auto-created when first user signs in via the web app. Each document contains:
```json
{
  "key": "agdrug_[random32chars]",
  "userId": "firebase-user-id",
  "createdAt": "timestamp"
}
```

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

## 5. Enable Authentication

### 5.1 Get Firebase Web App Config

1. Go to Project Settings → Your apps
2. Click "Add app" → Web (</>) icon
3. App nickname: "agent-drugs-web"
4. Register app
5. Copy the Firebase config object (apiKey, authDomain, projectId, etc.)
6. Update `/Users/clint/code/agent-drugs/public/app.js` with these values

### 5.2 Enable Google OAuth

1. Go to Authentication → Sign-in method
2. Click "Google" provider
3. Enable it
4. Save

### 5.3 Enable GitHub OAuth

1. Go to GitHub → Settings → Developer settings → OAuth Apps → New OAuth App
2. Application name: "Agent Drugs"
3. Homepage URL: `https://agent-drugs.web.app` (or your domain)
4. Authorization callback URL: `https://agent-drugs.firebaseapp.com/__/auth/handler`
5. Register application
6. Copy Client ID and Client Secret
7. In Firebase Console → Authentication → Sign-in method
8. Click "GitHub" provider
9. Enable it
10. Paste Client ID and Client Secret
11. Save

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
