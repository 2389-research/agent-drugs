#!/bin/bash

# Test OAuth flow for Agent Drugs
# This simulates what Claude Code does during OAuth

set -e

echo "🧪 Testing Agent Drugs OAuth Flow"
echo "================================="
echo ""

# Step 1: Discover OAuth metadata
echo "1️⃣  Discovering OAuth endpoints..."
METADATA=$(curl -s https://us-central1-agent-drugs.cloudfunctions.net/oauthMetadata)
echo "✅ OAuth metadata retrieved"
echo "$METADATA" | jq .
echo ""

AUTH_ENDPOINT=$(echo "$METADATA" | jq -r '.authorization_endpoint')
TOKEN_ENDPOINT=$(echo "$METADATA" | jq -r '.token_endpoint')

echo "Authorization endpoint: $AUTH_ENDPOINT"
echo "Token endpoint: $TOKEN_ENDPOINT"
echo ""

# Step 2: Generate PKCE challenge
echo "2️⃣  Generating PKCE challenge..."
CODE_VERIFIER=$(openssl rand -base64 32 | tr -d '=' | tr '+/' '-_')
CODE_CHALLENGE=$(echo -n "$CODE_VERIFIER" | openssl dgst -binary -sha256 | base64 | tr -d '=' | tr '+/' '-_')
echo "✅ PKCE challenge generated"
echo "Code verifier: $CODE_VERIFIER"
echo "Code challenge: $CODE_CHALLENGE"
echo ""

# Step 3: Build authorization URL
echo "3️⃣  Building authorization URL..."
CLIENT_ID="test-mcp-client"
REDIRECT_URI="http://localhost:8080/oauth/callback"
STATE=$(openssl rand -hex 16)

AUTH_URL="${AUTH_ENDPOINT}?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&response_type=code&scope=drugs:read%20drugs:write&state=${STATE}&code_challenge=${CODE_CHALLENGE}&code_challenge_method=S256"

echo "✅ Authorization URL built"
echo ""

# Step 4: Start local callback server
echo "4️⃣  Starting local callback server on port 8080..."

# Create a temporary file to store the callback data
CALLBACK_FILE=$(mktemp)
trap "rm -f $CALLBACK_FILE" EXIT

# Start a simple Node.js server to receive the callback
node -e "
const http = require('http');
const url = require('url');
const fs = require('fs');

const server = http.createServer((req, res) => {
  const query = url.parse(req.url, true).query;

  if (query.code && query.state) {
    // Write callback data to file
    fs.writeFileSync('$CALLBACK_FILE', JSON.stringify(query));

    // Send success page
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>✅ Authorization successful!</h1><p>You can close this window and return to your terminal.</p></body></html>');

    // Close server after receiving callback
    setTimeout(() => server.close(), 100);
  } else {
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<html><body><h1>❌ Invalid callback</h1><p>Missing code or state parameter.</p></body></html>');
  }
});

server.listen(8080, () => {
  console.error('✅ Callback server running on http://localhost:8080');
});
" &

SERVER_PID=$!
sleep 1

echo "🌐 Opening authorization URL in your browser..."
if command -v open &> /dev/null; then
  open "$AUTH_URL"
elif command -v xdg-open &> /dev/null; then
  xdg-open "$AUTH_URL"
else
  echo "Please open this URL manually:"
  echo "$AUTH_URL"
fi

echo ""
echo "⏳ Waiting for authorization callback..."

# Wait for callback data (with 2 minute timeout)
TIMEOUT=120
ELAPSED=0
while [ ! -s "$CALLBACK_FILE" ] && [ $ELAPSED -lt $TIMEOUT ]; do
  sleep 1
  ELAPSED=$((ELAPSED + 1))
done

# Kill the server if still running
kill $SERVER_PID 2>/dev/null || true
wait $SERVER_PID 2>/dev/null || true

if [ ! -s "$CALLBACK_FILE" ]; then
  echo "❌ Timeout waiting for authorization callback"
  exit 1
fi

# Parse callback data
CALLBACK_DATA=$(cat "$CALLBACK_FILE")
AUTH_CODE=$(echo "$CALLBACK_DATA" | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(data.code);")
RECEIVED_STATE=$(echo "$CALLBACK_DATA" | node -e "const data = JSON.parse(require('fs').readFileSync(0, 'utf-8')); console.log(data.state);")

# Validate state parameter
if [ "$RECEIVED_STATE" != "$STATE" ]; then
  echo "❌ State mismatch! Possible CSRF attack."
  echo "Expected: $STATE"
  echo "Received: $RECEIVED_STATE"
  exit 1
fi

echo "✅ Authorization code received and state validated"
echo "Authorization code: ${AUTH_CODE:0:20}..."

echo ""
echo "5️⃣  Exchanging authorization code for access token..."

TOKEN_RESPONSE=$(curl -s -X POST "$TOKEN_ENDPOINT" \
  -H "Content-Type: application/json" \
  -d "{
    \"grant_type\": \"authorization_code\",
    \"code\": \"$AUTH_CODE\",
    \"redirect_uri\": \"$REDIRECT_URI\",
    \"client_id\": \"$CLIENT_ID\",
    \"code_verifier\": \"$CODE_VERIFIER\"
  }")

echo "✅ Token response received"
echo "$TOKEN_RESPONSE" | jq .
echo ""

ACCESS_TOKEN=$(echo "$TOKEN_RESPONSE" | jq -r '.access_token')

if [ "$ACCESS_TOKEN" = "null" ] || [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token"
  echo "Response: $TOKEN_RESPONSE"
  exit 1
fi

echo "🎉 Success! Access token obtained:"
echo "$ACCESS_TOKEN"
echo ""

# Step 6: Test MCP server connection
echo "6️⃣  Testing MCP server connection..."
echo "Connecting to http://localhost:3000/mcp with bearer token..."
echo ""
echo "curl -H \"Authorization: Bearer $ACCESS_TOKEN\" http://localhost:3000/mcp"
echo ""
echo "✅ OAuth flow complete!"
echo ""
echo "💡 Add this to your Claude Code MCP config:"
echo ""
echo "{
  \"mcpServers\": {
    \"agent-drugs\": {
      \"url\": \"http://localhost:3000/mcp\",
      \"headers\": {
        \"Authorization\": \"Bearer $ACCESS_TOKEN\"
      }
    }
  }
}"
