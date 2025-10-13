import { StateManager } from './state-manager';

describe('StateManager', () => {
  let manager: StateManager;

  beforeEach(() => {
    manager = new StateManager();
  });

  it('should add a drug with expiration', () => {
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    manager.addDrug('focus', 'Be focused!', expiresAt);

    const active = manager.getActiveDrugs();
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('focus');
    expect(active[0].prompt).toBe('Be focused!');
  });

  it('should filter out expired drugs', () => {
    const past = new Date(Date.now() - 1000); // 1 second ago
    const future = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    manager.addDrug('expired', 'Old prompt', past);
    manager.addDrug('active', 'Active prompt', future);

    const active = manager.getActiveDrugs();
    expect(active).toHaveLength(1);
    expect(active[0].name).toBe('active');
  });

  it('should return empty array when no drugs are active', () => {
    const active = manager.getActiveDrugs();
    expect(active).toEqual([]);
  });
});
