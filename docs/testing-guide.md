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
