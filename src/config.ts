export interface Config {
  jwt: string;
  firebaseProjectId: string;
  serviceAccountPath?: string;
}

export function loadConfig(): Config {
  // JWT token is required for authentication
  const jwt = process.env.AGENT_DRUGS_JWT;
  if (!jwt || jwt.trim() === '') {
    throw new Error('AGENT_DRUGS_JWT environment variable must be set');
  }

  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'agent-drugs';

  // Service account path for firebase-admin SDK
  // In production (fly.io), this is provided by the container
  // In development, use GOOGLE_APPLICATION_CREDENTIALS
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  return {
    jwt,
    firebaseProjectId,
    serviceAccountPath,
  };
}
