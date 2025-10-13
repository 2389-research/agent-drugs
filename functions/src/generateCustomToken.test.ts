import * as admin from 'firebase-admin';
import { generateCustomTokenHandler } from './generateCustomToken';

jest.mock('firebase-admin', () => ({
  auth: jest.fn(() => ({
    createCustomToken: jest.fn()
  }))
}));

describe('generateCustomTokenHandler', () => {
  it('should generate custom token for authenticated user', async () => {
    const mockAuth = {
      createCustomToken: jest.fn().mockResolvedValue('mock_custom_token_xyz')
    };
    (admin.auth as jest.Mock).mockReturnValue(mockAuth);

    const mockRequest = {
      auth: {
        uid: 'user_123'
      }
    };

    const result = await generateCustomTokenHandler(mockRequest as any);

    expect(mockAuth.createCustomToken).toHaveBeenCalledWith('user_123');
    expect(result).toEqual({
      token: 'mock_custom_token_xyz'
    });
  });

  it('should throw error if user is not authenticated', async () => {
    const mockRequest = {
      auth: undefined
    };

    await expect(
      generateCustomTokenHandler(mockRequest as any)
    ).rejects.toThrow('User must be authenticated');
  });
});
