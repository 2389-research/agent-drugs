import { StateManager } from './state-manager';

export interface HookOutput {
  hookSpecificOutput: {
    hookEventName: string;
    additionalContext: string;
  };
}

export function generateSessionStartHook(state: StateManager): HookOutput {
  const drugs = state.getActiveDrugs();

  if (drugs.length === 0) {
    return {
      hookSpecificOutput: {
        hookEventName: 'SessionStart',
        additionalContext: '',
      },
    };
  }

  const promptText = drugs
    .map(drug => `**${drug.name}**: ${drug.prompt}`)
    .join('\n\n');

  const context = `<AGENT_DRUGS_ACTIVE>\nYou currently have the following behavioral modifications active:\n\n${promptText}\n</AGENT_DRUGS_ACTIVE>`;

  return {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: context,
    },
  };
}
