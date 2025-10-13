import { FirebaseClient, FirebaseAuthError } from './firebase-client';

describe('FirebaseClient', () => {
  describe('validateApiKey', () => {
    it('should validate API key and return user ID', async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ userId: 'user_123', valid: true }),
      });
      global.fetch = mockFetch as any;

      const client = new FirebaseClient('https://api.example.com', 'test_key');
      const userId = await client.validateApiKey();

      expect(userId).toBe('user_123');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/validateApiKey',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ apiKey: 'test_key' }),
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
  });
});
