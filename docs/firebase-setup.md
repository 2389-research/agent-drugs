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
