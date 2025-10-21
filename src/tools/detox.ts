import { StateManager } from '../state-manager';
import { ToolResult } from './list-drugs';
import { logger } from '../logger';

export async function detoxTool(state: StateManager): Promise<ToolResult> {
  const startTime = Date.now();
  logger.info('Tool: detox invoked');

  try {
    // Get current active drugs before clearing
    const drugs = await state.getActiveDrugs();
    const drugNames = drugs.map(d => d.name);

    // If no drugs are active, return early without performing a write
    if (drugs.length === 0) {
      logger.info('Tool: detox succeeded (no-op)', {
        count: 0,
        elapsed: Date.now() - startTime
      });
      return {
        content: [{
          type: 'text',
          text: '✨ No active drugs to clear. You\'re already clean!'
        }],
      };
    }

    // Clear all active drugs (only when there are drugs to clear)
    await state.clearAllDrugs();

    // Log count at INFO level, drug names at DEBUG level to minimize sensitive data exposure
    logger.info('Tool: detox succeeded', {
      count: drugs.length,
      elapsed: Date.now() - startTime
    });
    logger.debug?.('Tool: detox details', { drugs: drugNames });

    const clearedList = drugNames.map(name => `- ${name}`).join('\n');

    return {
      content: [{
        type: 'text',
        text: `✅ Successfully cleared all active drugs!

**Removed drugs:**
${clearedList}

You are now operating with standard behavior. All behavioral modifications have been removed from this session and future sessions.`
      }],
    };
  } catch (error) {
    logger.error('Tool: detox error', error, {
      elapsed: Date.now() - startTime
    });
    // Return generic error message to user, keep details in logs
    return {
      content: [{
        type: 'text',
        text: 'Failed to clear drugs. Please try again.',
      }],
      isError: true,
    };
  }
}
