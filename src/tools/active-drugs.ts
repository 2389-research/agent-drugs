import { StateManager } from '../state-manager';
import { ToolResult } from './list-drugs';

export function activeDrugsTool(state: StateManager): ToolResult {
  const drugs = state.getActiveDrugs();

  if (drugs.length === 0) {
    return {
      content: [{ type: 'text', text: 'No active drugs.' }],
    };
  }

  const now = Date.now();
  const text = drugs.map(drug => {
    const remainingMs = drug.expiresAt.getTime() - now;
    const remainingMin = Math.ceil(remainingMs / 60 / 1000);
    return `**${drug.name}** - ${remainingMin} min remaining\n${drug.prompt}`;
  }).join('\n\n');

  return {
    content: [{ type: 'text', text: `Active drugs:\n\n${text}` }],
  };
}
