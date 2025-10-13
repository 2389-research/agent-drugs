"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const admin = require("firebase-admin");
const generateCustomToken_1 = require("./generateCustomToken");
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
        admin.auth.mockReturnValue(mockAuth);
        const mockRequest = {
            auth: {
                uid: 'user_123'
            }
        };
        const result = await (0, generateCustomToken_1.generateCustomTokenHandler)(mockRequest);
        expect(mockAuth.createCustomToken).toHaveBeenCalledWith('user_123');
        expect(result).toEqual({
            token: 'mock_custom_token_xyz'
        });
    });
    it('should throw error if user is not authenticated', async () => {
        const mockRequest = {
            auth: undefined
        };
        await expect((0, generateCustomToken_1.generateCustomTokenHandler)(mockRequest)).rejects.toThrow('User must be authenticated');
    });
});
//# sourceMappingURL=generateCustomToken.test.js.map