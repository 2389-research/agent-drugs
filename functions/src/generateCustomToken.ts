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
