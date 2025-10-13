export interface Config {
  apiKey: string;
  firebaseProjectId: string;
  firebaseApiUrl: string;
}

export function loadConfig(): Config {
  const apiKey = process.env.AGENT_DRUGS_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('AGENT_DRUGS_API_KEY not set');
  }

  const firebaseProjectId = process.env.FIREBASE_PROJECT_ID || 'agent-drugs-prod';
  const firebaseApiUrl = `https://firestore.googleapis.com/v1/projects/${firebaseProjectId}/databases/(default)/documents`;

  return {
    apiKey,
    firebaseProjectId,
    firebaseApiUrl,
  };
}
