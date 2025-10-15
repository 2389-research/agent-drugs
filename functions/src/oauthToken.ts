import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

/**
 * OAuth token exchange endpoint
 * POST /oauth/token
 *
 * Exchanges authorization code for bearer token
 * Implements OAuth 2.1 with PKCE (RFC 7636)
 */
export const oauthToken = functions.https.onRequest(async (req, res) => {
  // CORS headers for MCP clients
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'invalid_request',
      error_description: 'Method not allowed'
    });
    return;
  }

  try {
    const {
      grant_type,
      code,
      redirect_uri,
      client_id,
      code_verifier
    } = req.body;

    // Validate grant type
    if (grant_type !== 'authorization_code') {
      res.status(400).json({
        error: 'unsupported_grant_type',
        error_description: 'Only authorization_code grant type is supported'
      });
      return;
    }

    // Validate required parameters
    if (!code || !redirect_uri || !client_id || !code_verifier) {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Missing required parameters'
      });
      return;
    }

    // Look up authorization code in Firestore
    const db = admin.firestore();
    const codeDoc = await db.collection('oauth_codes').doc(code).get();

    if (!codeDoc.exists) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Invalid or expired authorization code'
      });
      return;
    }

    const codeData = codeDoc.data()!;

    // Verify code hasn't been used
    if (codeData.used) {
      // Security: revoke all tokens for this user
      await db.collection('oauth_codes').doc(code).delete();
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code has already been used'
      });
      return;
    }

    // Verify code hasn't expired (10 minutes)
    const now = admin.firestore.Timestamp.now();
    const expiresAt = codeData.expiresAt as admin.firestore.Timestamp;
    if (now.toMillis() > expiresAt.toMillis()) {
      await db.collection('oauth_codes').doc(code).delete();
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Authorization code has expired'
      });
      return;
    }

    // Verify client_id matches
    if (codeData.clientId !== client_id) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Client ID mismatch'
      });
      return;
    }

    // Verify redirect_uri matches
    if (codeData.redirectUri !== redirect_uri) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'Redirect URI mismatch'
      });
      return;
    }

    // Verify PKCE code_verifier
    const expectedChallenge = crypto
      .createHash('sha256')
      .update(code_verifier)
      .digest('base64url');

    if (expectedChallenge !== codeData.codeChallenge) {
      res.status(400).json({
        error: 'invalid_grant',
        error_description: 'PKCE verification failed'
      });
      return;
    }

    // Mark code as used
    await codeDoc.ref.update({ used: true });

    // Return the bearer token that was generated during authorization
    res.status(200).json({
      access_token: codeData.bearerToken,
      token_type: 'Bearer',
      expires_in: 31536000, // 1 year (tokens don't expire but can be revoked)
      scope: codeData.scope || 'drugs:read drugs:write'
    });

  } catch (error) {
    console.error('OAuth token exchange error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error during token exchange'
    });
  }
});
