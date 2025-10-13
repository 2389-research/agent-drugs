import { generateSessionStartHook } from './hooks';
import { StateManager } from './state-manager';

describe('generateSessionStartHook', () => {
  it('should generate hook output with active drug prompts', () => {
    const now = Date.now();
    const mockState = {
      getActiveDrugs: jest.fn().mockReturnValue([
        {
          name: 'focus',
          prompt: 'You are extremely focused and detail-oriented.',
          expiresAt: new Date(now + 60 * 60 * 1000),
        },
        {
          name: 'creative',
          prompt: 'You think outside the box and generate novel ideas.',
          expiresAt: new Date(now + 120 * 60 * 1000),
        },
      ]),
    } as any;

    const result = generateSessionStartHook(mockState);

    expect(result.hookSpecificOutput.hookEventName).toBe('SessionStart');
    expect(result.hookSpecificOutput.additionalContext).toContain('focus');
    expect(result.hookSpecificOutput.additionalContext).toContain('creative');
    expect(result.hookSpecificOutput.additionalContext).toContain('You are extremely focused');
    expect(result.hookSpecificOutput.additionalContext).toContain('You think outside the box');
  });

  it('should return empty context when no drugs are active', () => {
    const mockState = {
      getActiveDrugs: jest.fn().mockReturnValue([]),
    } as any;

    const result = generateSessionStartHook(mockState);

    expect(result.hookSpecificOutput.additionalContext).toBe('');
  });
});
