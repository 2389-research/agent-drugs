import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

/**
 * OAuth callback handler
 * Called by web UI after user authorizes
 *
 * Creates authorization code and stores with bearer token
 */
export interface OAuthCallbackRequest {
  auth?: {
    uid: string;
  };
  data: {
    clientId: string;
    redirectUri: string;
    scope?: string;
    state?: string;
    codeChallenge: string;
    codeChallengeMethod: string;
    agentName?: string;
    existingAgentId?: string;
  };
}

export interface OAuthCallbackResponse {
  authorizationCode: string;
  redirectUri: string;
  state?: string;
}

/**
 * Completes OAuth authorization flow
 * - Generates bearer token for agent
 * - Creates authorization code
 * - Returns code for client redirect
 */
export async function oauthCallbackHandler(
  request: OAuthCallbackRequest
): Promise<OAuthCallbackResponse> {
  // Verify user is authenticated
  if (!request.auth || !request.auth.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to authorize OAuth'
    );
  }

  const {
    clientId,
    redirectUri,
    scope,
    state,
    codeChallenge,
    codeChallengeMethod,
    agentName,
    existingAgentId
  } = request.data;

  // Validate PKCE
  if (codeChallengeMethod !== 'S256') {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Only S256 code_challenge_method is supported'
    );
  }

  if (!codeChallenge) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'code_challenge is required'
    );
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  let agentId: string;
  let bearerToken: string;

  // Check if user wants to reuse an existing agent
  if (existingAgentId) {
    // Fetch the existing agent and verify it belongs to this user
    const agentDoc = await db.collection('agents').doc(existingAgentId).get();

    if (!agentDoc.exists) {
      throw new functions.https.HttpsError(
        'not-found',
        'Specified agent not found'
      );
    }

    const agentData = agentDoc.data();
    if (agentData?.userId !== uid) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'You do not have permission to use this agent'
      );
    }

    // Reuse existing agent
    agentId = agentDoc.id;
    bearerToken = agentData.bearerToken;

    // Update lastUsedAt
    await agentDoc.ref.update({
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } else {
    // Create a new agent
    const finalAgentName = agentName || `${clientId} Agent`;
    bearerToken = 'agdrug_' + crypto.randomBytes(32).toString('hex');

    const agentRef = await db.collection('agents').add({
      userId: uid,
      name: finalAgentName,
      bearerToken: bearerToken,
      clientId: clientId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    agentId = agentRef.id;
  }

  // Generate authorization code
  const authorizationCode = 'authcode_' + crypto.randomBytes(32).toString('hex');

  // Store authorization code (expires in 10 minutes)
  const now = admin.firestore.Timestamp.now();
  const expiresAt = admin.firestore.Timestamp.fromMillis(
    now.toMillis() + 10 * 60 * 1000
  );

  await db.collection('oauth_codes').doc(authorizationCode).set({
    code: authorizationCode,
    userId: uid,
    agentId: agentId,
    bearerToken: bearerToken,
    clientId: clientId,
    redirectUri: redirectUri,
    scope: scope || 'drugs:read drugs:write',
    codeChallenge: codeChallenge,
    codeChallengeMethod: codeChallengeMethod,
    used: false,
    createdAt: now,
    expiresAt: expiresAt
  });

  return {
    authorizationCode,
    redirectUri,
    state
  };
}

/**
 * OAuth callback Cloud Function
 * Web UI calls this after user authorizes
 */
export const oauthCallback = functions.https.onCall(
  async (request) => {
    return oauthCallbackHandler({ auth: request.auth, data: request.data });
  }
);
