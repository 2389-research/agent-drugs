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
    // Construct Firestore runQuery endpoint
    const queryUrl = `${this.apiUrl}:runQuery`;

    // Build structured query to find API key
    const query = {
      structuredQuery: {
        from: [{ collectionId: 'api_keys' }],
        where: {
          fieldFilter: {
            field: { fieldPath: 'key' },
            op: 'EQUAL',
            value: { stringValue: this.apiKey }
          }
        },
        limit: 1
      }
    };

    let response: Response;
    try {
      response = await fetch(queryUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      });
    } catch (error) {
      throw new FirebaseAuthError(
        `Network error during authentication: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    if (!response.ok) {
      throw new FirebaseAuthError(
        `Firestore query failed: ${response.status} ${response.statusText}`
      );
    }

    let results: any[];
    try {
      results = await response.json() as any[];
    } catch (error) {
      throw new FirebaseAuthError(
        `Invalid response format: Expected JSON but received invalid data`
      );
    }

    // Check if we got a result
    if (!results || results.length === 0 || !results[0] || !results[0].document) {
      throw new FirebaseAuthError('Invalid API key');
    }

    // Extract userId from Firestore document
    const doc = results[0].document;
    const userId = doc.fields?.userId?.stringValue;

    if (!userId || userId.trim() === '') {
      throw new FirebaseAuthError('Invalid response: Missing userId in API key document');
    }

    return userId;
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

  async recordUsageEvent(
    userId: string,
    drugName: string,
    durationMinutes: number
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + durationMinutes * 60 * 1000);

    const document = {
      fields: {
        userId: { stringValue: userId },
        drugName: { stringValue: drugName },
        timestamp: { timestampValue: now.toISOString() },
        durationMinutes: { integerValue: durationMinutes.toString() },
        expiresAt: { timestampValue: expiresAt.toISOString() },
      },
    };

    const response = await fetch(`${this.apiUrl}/usage_events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(document),
    });

    if (!response.ok) {
      throw new Error(`Failed to record usage event: ${response.status}`);
    }
  }
}
