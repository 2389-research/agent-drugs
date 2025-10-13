import { loadConfig, Config } from './config';

describe('loadConfig', () => {
  it('should load API key from environment', () => {
    process.env.AGENT_DRUGS_API_KEY = 'test_key_123';
    const config = loadConfig();
    expect(config.apiKey).toBe('test_key_123');
  });

  it('should throw if API key is missing', () => {
    delete process.env.AGENT_DRUGS_API_KEY;
    expect(() => loadConfig()).toThrow('AGENT_DRUGS_API_KEY not set');
  });

  it('should use provided Firebase project ID or default', () => {
    process.env.AGENT_DRUGS_API_KEY = 'test_key';
    process.env.FIREBASE_PROJECT_ID = 'my-project';
    const config = loadConfig();
    expect(config.firebaseProjectId).toBe('my-project');
  });
});
