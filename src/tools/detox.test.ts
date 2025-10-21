import { detoxTool } from './detox';
import { StateManager } from '../state-manager';

// Mock the logger module
jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn(),
  },
}));

describe('detoxTool', () => {
  it('should clear all active drugs', async () => {
    const mockState = {
      getActiveDrugs: jest.fn().mockResolvedValue([
        {
          name: 'focus',
          prompt: 'You are focused',
          expiresAt: new Date(Date.now() + 60000),
        },
        {
          name: 'creative',
          prompt: 'You are creative',
          expiresAt: new Date(Date.now() + 120000),
        },
      ]),
      clearAllDrugs: jest.fn().mockResolvedValue(undefined),
    } as any;

    const result = await detoxTool(mockState);

    expect(mockState.getActiveDrugs).toHaveBeenCalledTimes(1);
    expect(mockState.clearAllDrugs).toHaveBeenCalledTimes(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Successfully cleared all active drugs');
    expect(result.content[0].text).toContain('focus');
    expect(result.content[0].text).toContain('creative');
  });

  it('should handle case when no drugs are active (no-op, no write)', async () => {
    const mockState = {
      getActiveDrugs: jest.fn().mockResolvedValue([]),
      clearAllDrugs: jest.fn().mockResolvedValue(undefined),
    } as any;

    const result = await detoxTool(mockState);

    expect(mockState.getActiveDrugs).toHaveBeenCalledTimes(1);
    // Should NOT call clearAllDrugs when no drugs are active (optimization)
    expect(mockState.clearAllDrugs).not.toHaveBeenCalled();
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('No active drugs to clear');
    expect(result.content[0].text).toContain('already clean');
  });

  it('should handle errors gracefully', async () => {
    const mockState = {
      getActiveDrugs: jest.fn().mockRejectedValue(new Error('Firestore error')),
      clearAllDrugs: jest.fn(),
    } as any;

    const result = await detoxTool(mockState);

    expect(result.isError).toBe(true);
    // Should return generic error message, not expose internal details
    expect(result.content[0].text).toContain('Failed to clear drugs');
    expect(result.content[0].text).not.toContain('Firestore error');
    // Should not attempt to clear when discovery fails
    expect(mockState.clearAllDrugs).not.toHaveBeenCalled();
  });
});
