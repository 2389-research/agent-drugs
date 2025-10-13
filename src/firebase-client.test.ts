import { FirebaseClient, FirebaseAuthError } from './firebase-client';

describe('FirebaseClient', () => {
  describe('validateApiKey', () => {
    it('should validate API key and return user ID', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            document: {
              name: 'projects/test/databases/(default)/documents/api_keys/key123',
              fields: {
                key: { stringValue: 'test_key' },
                userId: { stringValue: 'user_123' },
                createdAt: { timestampValue: '2025-10-13T00:00:00Z' }
              }
            }
          }
        ])
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://api.example.com', 'test_key');
      const userId = await client.validateApiKey();

      expect(userId).toBe('user_123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com:runQuery',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should throw FirebaseAuthError on invalid key', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://api.example.com', 'bad_key');

      await expect(client.validateApiKey()).rejects.toThrow(FirebaseAuthError);
    });

    it('should handle network errors (timeout, DNS failure, etc.)', async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error('Network timeout'));
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://api.example.com', 'test_key');

      await expect(client.validateApiKey()).rejects.toThrow(FirebaseAuthError);
      await expect(client.validateApiKey()).rejects.toThrow('Network error during authentication');
    });

    it('should handle non-JSON responses', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error('Unexpected token in JSON');
        },
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://api.example.com', 'test_key');

      await expect(client.validateApiKey()).rejects.toThrow(FirebaseAuthError);
      await expect(client.validateApiKey()).rejects.toThrow('Invalid response format');
    });

    it('should throw FirebaseAuthError if userId is missing from response', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            document: {
              name: 'projects/test/databases/(default)/documents/api_keys/key123',
              fields: {
                key: { stringValue: 'test_key' },
                createdAt: { timestampValue: '2025-10-13T00:00:00Z' }
              }
            }
          }
        ])
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://api.example.com', 'test_key');

      await expect(client.validateApiKey()).rejects.toThrow(FirebaseAuthError);
      await expect(client.validateApiKey()).rejects.toThrow('Missing userId');
    });

    it('should throw FirebaseAuthError if userId is empty string', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            document: {
              name: 'projects/test/databases/(default)/documents/api_keys/key123',
              fields: {
                key: { stringValue: 'test_key' },
                userId: { stringValue: '' },
                createdAt: { timestampValue: '2025-10-13T00:00:00Z' }
              }
            }
          }
        ])
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://api.example.com', 'test_key');

      await expect(client.validateApiKey()).rejects.toThrow(FirebaseAuthError);
      await expect(client.validateApiKey()).rejects.toThrow('Missing userId');
    });

    it('should throw FirebaseAuthError if userId is only whitespace', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            document: {
              name: 'projects/test/databases/(default)/documents/api_keys/key123',
              fields: {
                key: { stringValue: 'test_key' },
                userId: { stringValue: '   ' },
                createdAt: { timestampValue: '2025-10-13T00:00:00Z' }
              }
            }
          }
        ])
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://api.example.com', 'test_key');

      await expect(client.validateApiKey()).rejects.toThrow(FirebaseAuthError);
      await expect(client.validateApiKey()).rejects.toThrow('Missing userId');
    });
  });

  describe('fetchDrugs', () => {
    it('should fetch all drugs from Firestore', async () => {
      const mockDrugs = [
        {
          name: 'focus',
          prompt: 'You are extremely focused and detail-oriented.',
          defaultDurationMinutes: 60,
        },
        {
          name: 'creative',
          prompt: 'You are highly creative and think outside the box.',
          defaultDurationMinutes: 120,
        },
      ];

      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          documents: mockDrugs.map(drug => ({
            name: `projects/test/databases/(default)/documents/drugs/${drug.name}`,
            fields: {
              name: { stringValue: drug.name },
              prompt: { stringValue: drug.prompt },
              defaultDurationMinutes: { integerValue: drug.defaultDurationMinutes.toString() },
            },
          })),
        }),
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents', 'test_key');
      const drugs = await client.fetchDrugs();

      expect(drugs).toEqual(mockDrugs);
    });
  });

  describe('recordUsageEvent', () => {
    it('should write usage event to Firestore', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ name: 'projects/test/databases/(default)/documents/usage_events/evt_123' }),
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents', 'test_key');
      await client.recordUsageEvent('user_123', 'focus', 60);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents/usage_events',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"userId"'),
        })
      );
    });
  });

  describe('validateApiKey with Firestore query', () => {
    it('should query api_keys collection and return userId', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ([
          {
            document: {
              name: 'projects/test/databases/(default)/documents/api_keys/key123',
              fields: {
                key: { stringValue: 'test_key_123' },
                userId: { stringValue: 'user_456' },
                createdAt: { timestampValue: '2025-10-13T00:00:00Z' }
              }
            }
          }
        ])
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient(
        'https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents',
        'test_key_123'
      );
      const userId = await client.validateApiKey();

      expect(userId).toBe('user_456');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(':runQuery'),
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('api_keys')
        })
      );
    });

    it('should throw if no matching API key found', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ([]) // Empty result
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient(
        'https://firestore.googleapis.com/v1/projects/test/databases/(default)/documents',
        'invalid_key'
      );

      await expect(client.validateApiKey()).rejects.toThrow(FirebaseAuthError);
      await expect(client.validateApiKey()).rejects.toThrow('Invalid API key');
    });
  });
});
