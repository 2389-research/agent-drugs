import { activeDrugsTool } from './active-drugs';
import { StateManager } from '../state-manager';

describe('activeDrugsTool', () => {
  it('should return list of active drugs with time remaining', () => {
    const now = Date.now();
    const mockState = {
      getActiveDrugs: jest.fn().mockReturnValue([
        {
          name: 'focus',
          prompt: 'Be focused!',
          expiresAt: new Date(now + 30 * 60 * 1000), // 30 min remaining
        },
        {
          name: 'creative',
          prompt: 'Be creative!',
          expiresAt: new Date(now + 90 * 60 * 1000), // 90 min remaining
        },
      ]),
    } as any;

    const result = activeDrugsTool(mockState);

    expect(result.content[0].text).toContain('focus');
    expect(result.content[0].text).toContain('creative');
    expect(result.content[0].text).toMatch(/30.*min/);
    expect(result.content[0].text).toMatch(/90.*min/);
  });

  it('should handle no active drugs', () => {
    const mockState = {
      getActiveDrugs: jest.fn().mockReturnValue([]),
    } as any;

    const result = activeDrugsTool(mockState);

    expect(result.content[0].text).toContain('No active drugs');
  });
});
