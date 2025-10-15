// Mock firebase-admin BEFORE importing the module
const mockAdd = jest.fn();
const mockCollection = jest.fn();
const mockFirestore = jest.fn(() => ({
  collection: mockCollection
}));

const mockServerTimestamp = jest.fn(() => 'TIMESTAMP');

jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(),
  firestore: Object.assign(mockFirestore, {
    FieldValue: {
      serverTimestamp: mockServerTimestamp
    }
  })
}));

jest.mock('firebase-functions', () => ({
  https: {
    HttpsError: class HttpsError extends Error {
      constructor(public code: string, message: string) {
        super(message);
        this.name = 'HttpsError';
      }
    },
    onCall: jest.fn((handler) => handler)
  }
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => ({
    toString: jest.fn(() => 'a'.repeat(64))
  }))
}));

// NOW import the module
import { generateBearerTokenHandler } from './generateCustomToken';

describe('generateBearerTokenHandler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.mockReturnValue({
      add: mockAdd
    });
  });

  it('should generate bearer token and store agent for authenticated user', async () => {
    mockAdd.mockResolvedValue({ id: 'agent_123' });

    const mockRequest = {
      auth: {
        uid: 'user_123'
      },
      data: {
        agentName: 'Test Agent'
      }
    };

    const result = await generateBearerTokenHandler(mockRequest as any);

    expect(result.bearerToken).toContain('agdrug_');
    expect(result.agentId).toBe('agent_123');
    expect(result.agentName).toBe('Test Agent');
    expect(mockCollection).toHaveBeenCalledWith('agents');
    expect(mockAdd).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_123',
        name: 'Test Agent',
        bearerToken: expect.stringContaining('agdrug_')
      })
    );
  });

  it('should use default agent name if not provided', async () => {
    mockAdd.mockResolvedValue({ id: 'agent_456' });

    const mockRequest = {
      auth: {
        uid: 'user_123'
      },
      data: {}
    };

    const result = await generateBearerTokenHandler(mockRequest as any);

    expect(result.agentName).toBe('Default Agent');
  });

  it('should throw error if user is not authenticated', async () => {
    const mockRequest = {
      auth: undefined
    };

    await expect(
      generateBearerTokenHandler(mockRequest as any)
    ).rejects.toThrow('User must be authenticated');
  });
});
