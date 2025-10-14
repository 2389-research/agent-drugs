import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

export interface GenerateJWTRequest {
  auth?: {
    uid: string;
  };
  data?: {
    agentName?: string;
  };
}

export interface GenerateJWTResponse {
  jwt: string;
  agentId: string;
  agentName: string;
}

/**
 * Generate a secure JWT for MCP authentication
 * Stores agent credentials in Firestore agents collection
 */
export async function generateJWTHandler(
  request: GenerateJWTRequest
): Promise<GenerateJWTResponse> {
  // Verify user is authenticated
  if (!request.auth || !request.auth.uid) {
    throw new functions.https.HttpsError(
      'unauthenticated',
      'User must be authenticated to generate JWT'
    );
  }

  const uid = request.auth.uid;
  const agentName = request.data?.agentName || 'Default Agent';

  // Generate secure random JWT (256 bits = 32 bytes = 64 hex chars)
  const jwt = 'agdrug_jwt_' + crypto.randomBytes(32).toString('hex');

  // Store agent in Firestore
  const db = admin.firestore();
  const agentRef = await db.collection('agents').add({
    userId: uid,
    name: agentName,
    jwt: jwt,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return {
    jwt: jwt,
    agentId: agentRef.id,
    agentName: agentName,
  };
}

// Export the Cloud Function
export const generateJWT = functions.https.onCall(
  async (data, context) => {
    return generateJWTHandler({ auth: context.auth, data });
  }
);
