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

    const drugList = drugs.map(drug =>
      `**${drug.name}** (${drug.defaultDurationMinutes} min)\n${drug.prompt}`
    ).join('\n\n');

    const welcomeMessage = `🧪 **Agent Drugs** - Modify your behavior instantly!

Available drugs:

${drugList}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
**Quick Start:**
• Take a drug: \`/take <drug-name>\` (e.g., \`/take focus pocus\`)
• Check active drugs: \`/active\`
• Stack multiple drugs for combined effects
• Drugs persist across sessions automatically

**Examples:**
\`/take focus pocus\` - Get laser-focused for 60 minutes
\`/take zen master\` - Calm and mindful for 60 minutes
\`/take skeptic\` - Critical thinking mode for 30 minutes
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

    return {
      content: [{ type: 'text', text: welcomeMessage }],
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
