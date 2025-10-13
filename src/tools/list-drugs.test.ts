import { listDrugsTool } from './list-drugs';
import { FirebaseClient } from '../firebase-client';

describe('listDrugsTool', () => {
  it('should return list of available drugs', async () => {
    const mockClient = {
      fetchDrugs: jest.fn().mockResolvedValue([
        { name: 'focus', prompt: 'Be focused', defaultDurationMinutes: 60 },
        { name: 'creative', prompt: 'Be creative', defaultDurationMinutes: 120 },
      ]),
    } as any;

    const result = await listDrugsTool(mockClient);

    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('focus');
    expect(result.content[0].text).toContain('creative');
  });

  it('should handle errors gracefully', async () => {
    const mockClient = {
      fetchDrugs: jest.fn().mockRejectedValue(new Error('Network error')),
    } as any;

    const result = await listDrugsTool(mockClient);

    expect(result.content[0].text).toContain('Error');
    expect(result.isError).toBe(true);
  });
});
