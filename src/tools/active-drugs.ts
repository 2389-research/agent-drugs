import { StateManager } from '../state-manager';
import { ToolResult } from './list-drugs';
import { logger } from '../logger.js';

/**
 * Format time remaining in a user-friendly way
 * Examples: "2h 15m", "45m 30s", "15s"
 */
function formatTimeRemaining(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);

  if (totalSeconds <= 0) {
    return '0s';
  }

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts: string[] = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 && hours === 0) parts.push(`${seconds}s`); // Only show seconds if < 1 hour

  return parts.join(' ') || '0s';
}

export async function activeDrugsTool(state: StateManager): Promise<ToolResult> {
  const startTime = Date.now();
  logger.info('Tool: active_drugs invoked');

  const drugs = await state.getActiveDrugs();

  logger.info('Tool: active_drugs succeeded', {
    count: drugs.length,
    drugs: drugs.map(d => d.name),
    elapsed: Date.now() - startTime
  });

  if (drugs.length === 0) {
    return {
      content: [{ type: 'text', text: 'No active drugs.' }],
    };
  }

  const now = Date.now();
  const text = drugs.map(drug => {
    const remainingMs = drug.expiresAt.getTime() - now;
    const timeRemaining = formatTimeRemaining(remainingMs);
    const expiresAtTime = drug.expiresAt.toLocaleTimeString();

    return `**${drug.name}** - ${timeRemaining} remaining (expires at ${expiresAtTime})\n${drug.prompt}`;
  }).join('\n\n');

  return {
    content: [{ type: 'text', text: `Active drugs:\n\n${text}` }],
  };
}
