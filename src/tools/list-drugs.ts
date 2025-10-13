import { FirebaseClient } from '../firebase-client';

export interface ToolResult {
  content: Array<{ type: string; text: string }>;
  isError?: boolean;
}

export async function listDrugsTool(client: FirebaseClient): Promise<ToolResult> {
  try {
    const drugs = await client.fetchDrugs();

    const text = drugs.map(drug =>
      `**${drug.name}** (${drug.defaultDurationMinutes} min)\n${drug.prompt}`
    ).join('\n\n');

    return {
      content: [{ type: 'text', text: `Available drugs:\n\n${text}` }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error fetching drugs: ${error instanceof Error ? error.message : 'Unknown error'}` }],
      isError: true,
    };
  }
}
