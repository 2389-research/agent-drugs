export interface Config {
  bearerToken?: string;
  firebaseProjectId: string;
  serviceAccountPath?: string;
}

export function loadConfig(requireBearerToken: boolean = true): Config {
  // Bearer token is required for stdio mode, optional for HTTP mode (per-connection)
  const bearerToken = process.env.AGENT_DRUGS_BEARER_TOKEN;
  if (requireBearerToken && (!bearerToken || bearerToken.trim() === '')) {
    throw new Error('AGENT_DRUGS_BEARER_TOKEN environment variable must be set');
  }

  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'agent-drugs';

  // Service account path for firebase-admin SDK
  // In production (fly.io), this is provided by the container
  // In development, use GOOGLE_APPLICATION_CREDENTIALS
  const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  return {
    bearerToken: bearerToken || undefined,
    firebaseProjectId,
    serviceAccountPath,
  };
}
