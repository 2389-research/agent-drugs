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
    const response = await fetch(`${this.apiUrl}/validateApiKey`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ apiKey: this.apiKey }),
    });

    if (!response.ok) {
      throw new FirebaseAuthError(
        `Authentication failed: ${response.status} ${response.statusText}`
      );
    }

    const data = await response.json() as { userId: string; valid: boolean };
    return data.userId;
  }
}
