export interface Drug {
  name: string;
  prompt: string;
  defaultDurationMinutes: number;
}

export class FirebaseAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FirebaseAuthError';
  }
}

export class FirebaseClient {
  constructor(
    private readonly apiUrl: string,
    private readonly apiKey: string
  ) {}

  async validateApiKey(): Promise<string> {
    // Issue 1: Wrap fetch in try-catch to handle network errors
    let response: Response;
    try {
      response = await fetch(`${this.apiUrl}/validateApiKey`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ apiKey: this.apiKey }),
      });
    } catch (error) {
      // Convert network errors to FirebaseAuthError for consistent error handling
      throw new FirebaseAuthError(
        `Network error during authentication: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    if (!response.ok) {
      throw new FirebaseAuthError(
        `Authentication failed: ${response.status} ${response.statusText}`
      );
    }

    // Issue 3: Wrap response.json() in try-catch to handle non-JSON responses
    let data: { userId: string; valid: boolean };
    try {
      data = await response.json() as { userId: string; valid: boolean };
    } catch (error) {
      throw new FirebaseAuthError(
        `Invalid response format: Expected JSON but received invalid data`
      );
    }

    // Issue 2: Validate that data.userId exists and is non-empty
    if (!data.userId || data.userId.trim() === '') {
      throw new FirebaseAuthError(
        `Invalid response: Missing or empty userId in response`
      );
    }

    return data.userId;
  }

  async fetchDrugs(): Promise<Drug[]> {
    const response = await fetch(`${this.apiUrl}/drugs`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch drugs: ${response.status}`);
    }

    const data = await response.json() as any;

    return data.documents.map((doc: any) => ({
      name: doc.fields.name.stringValue,
      prompt: doc.fields.prompt.stringValue,
      defaultDurationMinutes: parseInt(doc.fields.defaultDurationMinutes.integerValue, 10),
    }));
  }
}
