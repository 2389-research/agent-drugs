import { FirebaseClient } from '../firebase-client';
import { StateManager } from '../state-manager';
import { ToolResult } from './list-drugs';
import { logger } from '../logger.js';

export interface TakeDrugArgs {
  name: string;
}

/**
 * Wrap text to fit within a specific width, breaking on word boundaries
 */
function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (testLine.length <= width) {
      currentLine = testLine;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.length > 0 ? lines : [''];
}

export async function takeDrugTool(
  args: TakeDrugArgs,
  client: FirebaseClient,
  state: StateManager
): Promise<ToolResult> {
  const startTime = Date.now();
  logger.info('Tool: take_drug invoked', { drugName: args.name });

  try {
    // JWT is validated at server startup, no need to validate again

    // Find the drug
    const drugs = await client.fetchDrugs();
    const drug = drugs.find(d => d.name === args.name);

    if (!drug) {
      logger.warn('Tool: take_drug failed - drug not found', {
        drugName: args.name,
        duration: Date.now() - startTime
      });
      return {
        content: [{ type: 'text', text: `Drug '${args.name}' not found. Use list_drugs() to see available options.` }],
        isError: true,
      };
    }

    // Use drug's fixed duration
    const duration = drug.defaultDurationMinutes;
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);

    // Record to Firebase (userId is handled internally)
    await client.recordUsageEvent(drug.name, duration);

    // Update local state - MUST await to prevent race condition
    await state.addDrug(drug.name, drug.prompt, expiresAt);

    const expiresAtTime = expiresAt.toLocaleTimeString();

    logger.info('Tool: take_drug succeeded', {
      drugName: args.name,
      duration: duration,
      expiresAt: expiresAt.toISOString(),
      elapsed: Date.now() - startTime
    });

    // Format the response with prominent behavioral prompt display
    // This ensures the drug takes effect IMMEDIATELY in the current session
    const boxWidth = 62;
    const promptLines = wrapText(drug.prompt, boxWidth - 4);
    const formattedPrompt = promptLines.map(line => `║  ${line.padEnd(boxWidth - 4)}  ║`).join('\n');

    return {
      content: [{
        type: 'text',
        text: `✅ Successfully took **${drug.name}**! Active for ${duration} minutes (expires at ${expiresAtTime}).

╔${'═'.repeat(boxWidth)}╗
║  🎯 ACTIVE BEHAVIORAL MODIFICATION${' '.repeat(boxWidth - 35)}║
╠${'═'.repeat(boxWidth)}╣
║${' '.repeat(boxWidth)}║
${formattedPrompt}
║${' '.repeat(boxWidth)}║
║  ⚡ This modification is now ACTIVE and will affect your${' '.repeat(3)}║
║  behavior immediately, including in this current session.${' '.repeat(4)}║
║${' '.repeat(boxWidth)}║
╚${'═'.repeat(boxWidth)}╝

The modification will automatically persist to future sessions via the SessionStart hook.`,
      }],
    };
  } catch (error) {
    logger.error('Tool: take_drug error', error, {
      drugName: args.name,
      elapsed: Date.now() - startTime
    });
    return {
      content: [{
        type: 'text',
        text: `Error taking drug: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}
