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

    // Clear all active drugs
    await state.clearAllDrugs();

    logger.info('Tool: detox succeeded', {
      count: drugs.length,
      drugs: drugNames,
      elapsed: Date.now() - startTime
    });

    if (drugs.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '✨ No active drugs to clear. You\'re already clean!'
        }],
      };
    }

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
    return {
      content: [{
        type: 'text',
        text: `Error clearing drugs: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}
