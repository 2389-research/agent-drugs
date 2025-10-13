import { takeDrugTool } from './take-drug';
import { FirebaseClient } from '../firebase-client';
import { StateManager } from '../state-manager';

describe('takeDrugTool', () => {
  it('should take a drug and record usage', async () => {
    const mockClient = {
      validateApiKey: jest.fn().mockResolvedValue('user_123'),
      fetchDrugs: jest.fn().mockResolvedValue([
        { name: 'focus', prompt: 'Be focused!', defaultDurationMinutes: 60 },
      ]),
      recordUsageEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    const mockState = {
      addDrug: jest.fn(),
    } as any;

    const args = { name: 'focus', duration: 60 };
    const result = await takeDrugTool(args, mockClient, mockState);

    expect(mockClient.validateApiKey).toHaveBeenCalled();
    expect(mockClient.recordUsageEvent).toHaveBeenCalledWith('user_123', 'focus', 60);
    expect(mockState.addDrug).toHaveBeenCalledWith('focus', 'Be focused!', expect.any(Date));
    expect(result.content[0].text).toContain('focus');
    expect(result.content[0].text).toContain('60 minutes');
  });

  it('should use default duration if not provided', async () => {
    const mockClient = {
      validateApiKey: jest.fn().mockResolvedValue('user_123'),
      fetchDrugs: jest.fn().mockResolvedValue([
        { name: 'creative', prompt: 'Be creative!', defaultDurationMinutes: 120 },
      ]),
      recordUsageEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    const mockState = {
      addDrug: jest.fn(),
    } as any;

    const args = { name: 'creative' };
    await takeDrugTool(args, mockClient, mockState);

    expect(mockClient.recordUsageEvent).toHaveBeenCalledWith('user_123', 'creative', 120);
  });

  it('should handle drug not found', async () => {
    const mockClient = {
      validateApiKey: jest.fn().mockResolvedValue('user_123'),
      fetchDrugs: jest.fn().mockResolvedValue([]),
    } as any;

    const mockState = {} as any;

    const args = { name: 'nonexistent' };
    const result = await takeDrugTool(args, mockClient, mockState);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('not found');
  });
});
