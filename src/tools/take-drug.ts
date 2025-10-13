import { FirebaseClient } from '../firebase-client';
import { StateManager } from '../state-manager';
import { ToolResult } from './list-drugs';

export interface TakeDrugArgs {
  name: string;
  duration?: number;
}

export async function takeDrugTool(
  args: TakeDrugArgs,
  client: FirebaseClient,
  state: StateManager
): Promise<ToolResult> {
  try {
    // Validate user
    const userId = await client.validateApiKey();

    // Find the drug
    const drugs = await client.fetchDrugs();
    const drug = drugs.find(d => d.name === args.name);

    if (!drug) {
      return {
        content: [{ type: 'text', text: `Drug '${args.name}' not found. Use list_drugs() to see available options.` }],
        isError: true,
      };
    }

    // Use provided duration or default
    const duration = args.duration ?? drug.defaultDurationMinutes;
    const expiresAt = new Date(Date.now() + duration * 60 * 1000);

    // Record to Firebase
    await client.recordUsageEvent(userId, drug.name, duration);

    // Update local state
    state.addDrug(drug.name, drug.prompt, expiresAt);

    return {
      content: [{
        type: 'text',
        text: `Successfully took ${drug.name}! Active for ${duration} minutes.\n\nEffect: ${drug.prompt}`,
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error taking drug: ${error instanceof Error ? error.message : 'Unknown error'}`,
      }],
      isError: true,
    };
  }
}
