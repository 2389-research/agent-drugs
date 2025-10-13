#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { loadConfig } from './config.js';
import { FirebaseClient } from './firebase-client.js';
import { StateManager } from './state-manager.js';
import { listDrugsTool } from './tools/list-drugs.js';
import { takeDrugTool } from './tools/take-drug.js';
import { activeDrugsTool } from './tools/active-drugs.js';

// Initialize components
const config = loadConfig();
const firebaseClient = new FirebaseClient(config.firebaseApiUrl, config.apiKey);
const stateManager = new StateManager();

// Create MCP server
const server = new Server(
  {
    name: 'agent-drugs',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'list_drugs',
        description: 'List all available digital drugs that can modify agent behavior',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'take_drug',
        description: 'Take a digital drug to modify your behavior for a specified duration',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the drug to take',
            },
            duration: {
              type: 'number',
              description: 'Duration in minutes (optional, uses default if not provided)',
            },
          },
          required: ['name'],
        },
      },
      {
        name: 'active_drugs',
        description: 'List currently active drugs and their remaining duration',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const result: any = await (async () => {
    switch (request.params.name) {
      case 'list_drugs':
        return await listDrugsTool(firebaseClient);

      case 'take_drug':
        return await takeDrugTool(
          request.params.arguments as any,
          firebaseClient,
          stateManager
        );

      case 'active_drugs':
        return activeDrugsTool(stateManager);

      default:
        throw new Error(`Unknown tool: ${request.params.name}`);
    }
  })();
  return result;
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Agent Drugs MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error in main():', error);
  process.exit(1);
});
