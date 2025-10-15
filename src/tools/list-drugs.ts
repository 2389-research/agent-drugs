import { FirebaseClient } from '../firebase-client';
import { logger } from '../logger.js';

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export async function listDrugsTool(client: FirebaseClient): Promise<ToolResult> {
  const startTime = Date.now();
  logger.info('Tool: list_drugs invoked');

  try {
    const drugs = await client.fetchDrugs();

    logger.info('Tool: list_drugs succeeded', {
      count: drugs.length,
      drugs: drugs.map(d => d.name),
      elapsed: Date.now() - startTime
    });

    const text = drugs.map(drug =>
      `**${drug.name}** (${drug.defaultDurationMinutes} min)\n${drug.prompt}`
    ).join('\n\n');

    return {
      content: [{ type: 'text', text: `Available drugs:\n\n${text}` }],
    };
  } catch (error) {
    logger.error('Tool: list_drugs error', error, {
      elapsed: Date.now() - startTime
    });
    return {
      content: [{ type: 'text', text: `Error fetching drugs: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}
