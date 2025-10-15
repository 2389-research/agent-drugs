#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import express from 'express';
import cors from 'cors';

import { loadConfig } from './config.js';
import { FirebaseClient } from './firebase-client.js';
import { StateManager } from './state-manager.js';
import { listDrugsTool } from './tools/list-drugs.js';
import { takeDrugTool } from './tools/take-drug.js';
import { activeDrugsTool } from './tools/active-drugs.js';
import { logger } from './logger.js';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // For OAuth token requests (application/x-www-form-urlencoded)

// Root endpoint - redirect to main website
app.get('/', (req, res) => {
  res.redirect(302, 'https://agent-drugs.web.app');
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'agent-drugs-mcp' });
});

// OAuth metadata endpoint - ONLY for local development
// In production, Claude Code should use the metadata_url from .mcp.json
// which points directly to Cloud Functions
if (!process.env.FLY_APP_NAME && process.env.NODE_ENV !== 'production') {
  app.get('/.well-known/oauth-authorization-server', (req, res) => {
    const startTime = Date.now();
    logger.oauth('Metadata discovery request (local dev)');

    const metadata = {
      issuer: `http://localhost:${port}`,
      authorization_endpoint: `http://localhost:${port}/authorize`,
      token_endpoint: `http://localhost:${port}/token`,
      registration_endpoint: `http://localhost:${port}/register`,
      scopes_supported: ['drugs:read', 'drugs:write'],
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code'],
      code_challenge_methods_supported: ['S256'],
    };

    res.json(metadata);
    logger.response('GET', '/.well-known/oauth-authorization-server', 200, Date.now() - startTime);
  });
}

// OAuth client registration endpoint (proxy to Cloud Functions)
app.post('/register', async (req, res) => {
  const startTime = Date.now();
  logger.oauth('Client registration request', {
    client_name: req.body.client_name,
    grant_types: req.body.grant_types
  });

  try {
    // Proxy to production registration endpoint
    const registrationEndpoint = 'https://us-central1-agent-drugs.cloudfunctions.net/oauthRegister';

    const response = await fetch(registrationEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json() as { client_id?: string; error?: string };

    if (!response.ok) {
      logger.warn('Client registration failed', {
        statusCode: response.status,
        error: data.error,
        duration: Date.now() - startTime
      });
      res.status(response.status).json(data);
      return;
    }

    logger.oauth('Client registered successfully', {
      clientId: data.client_id,
      duration: Date.now() - startTime
    });
    res.status(response.status).json(data);
  } catch (error) {
    logger.error('Registration proxy error', error, { duration: Date.now() - startTime });
    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to proxy registration request'
    });
  }
});

// OAuth authorization endpoint (proxy to Cloud Functions)
app.get('/authorize', async (req, res) => {
  const startTime = Date.now();
  logger.oauth('Authorization request', {
    client_id: req.query.client_id,
    response_type: req.query.response_type,
    has_code_challenge: !!req.query.code_challenge
  });

  try {
    // Proxy to production authorization endpoint
    const authEndpoint = 'https://us-central1-agent-drugs.cloudfunctions.net/oauthAuthorize';

    // Build URL with query parameters
    const url = new URL(authEndpoint);
    Object.entries(req.query).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value as string);
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'manual', // Handle redirects manually
    });

    // If it's a redirect, proxy the redirect
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        logger.oauth('Redirecting to authorization page', {
          location,
          duration: Date.now() - startTime
        });
        res.redirect(response.status, location);
        return;
      }
    }

    // Otherwise, return the response
    const data = await response.json() as { error?: string };
    logger.response('GET', '/authorize', response.status, Date.now() - startTime);
    res.status(response.status).json(data);
  } catch (error) {
    logger.error('Authorization proxy error', error, { duration: Date.now() - startTime });
    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to proxy authorization request'
    });
  }
});

// OAuth token endpoint (proxy to Cloud Functions)
app.post('/token', async (req, res) => {
  const startTime = Date.now();
  logger.oauth('Token exchange request', {
    grant_type: req.body.grant_type,
    client_id: req.body.client_id
  });

  try {
    // Proxy to production token endpoint
    const tokenEndpoint = 'https://us-central1-agent-drugs.cloudfunctions.net/oauthToken';

    const response = await fetch(tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    const data = await response.json() as { access_token?: string; error?: string };

    if (!response.ok) {
      logger.warn('Token exchange failed', {
        statusCode: response.status,
        error: data.error,
        duration: Date.now() - startTime
      });
      res.status(response.status).json(data);
      return;
    }

    logger.oauth('Token issued successfully', {
      hasToken: !!data.access_token,
      duration: Date.now() - startTime
    });
    res.status(response.status).json(data);
  } catch (error) {
    logger.error('Token proxy error', error, { duration: Date.now() - startTime });
    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to proxy token request'
    });
  }
});

// OAuth revocation endpoint (proxy to Cloud Functions)
app.post('/revoke', async (req, res) => {
  const startTime = Date.now();
  logger.oauth('Token revocation request', {
    token_hint: req.body.token_type_hint
  });

  try {
    // Proxy to production revocation endpoint
    const revokeEndpoint = 'https://us-central1-agent-drugs.cloudfunctions.net/oauthRevoke';

    const response = await fetch(revokeEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body),
    });

    // RFC 7009: Always return 200 for revocation (even if token doesn't exist)
    if (response.ok) {
      logger.oauth('Token revoked successfully', {
        duration: Date.now() - startTime
      });
      res.status(200).send('');
      return;
    }

    // Handle error responses
    const data = await response.json() as { error?: string };
    logger.warn('Token revocation failed', {
      statusCode: response.status,
      error: data.error,
      duration: Date.now() - startTime
    });
    res.status(response.status).json(data);
  } catch (error) {
    logger.error('Revocation proxy error', error, { duration: Date.now() - startTime });
    res.status(503).json({
      error: 'temporarily_unavailable',
      error_description: 'Service temporarily unavailable'
    });
  }
});

// OAuth callback endpoint (proxy to Cloud Functions)
app.get('/callback', async (req, res) => {
  const startTime = Date.now();
  logger.oauth('Callback request', {
    code: req.query.code ? '***' : undefined,
    state: req.query.state
  });

  try {
    // Proxy to production callback endpoint
    const callbackEndpoint = 'https://us-central1-agent-drugs.cloudfunctions.net/oauthCallback';

    // Build URL with query parameters
    const url = new URL(callbackEndpoint);
    Object.entries(req.query).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value as string);
    });

    const response = await fetch(url.toString(), {
      method: 'GET',
      redirect: 'manual',
    });

    // If it's a redirect, proxy the redirect
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (location) {
        logger.oauth('Redirecting after callback', {
          duration: Date.now() - startTime
        });
        res.redirect(response.status, location);
        return;
      }
    }

    // Otherwise, return the response
    const data = await response.json() as { error?: string };
    logger.response('GET', '/callback', response.status, Date.now() - startTime);
    res.status(response.status).json(data);
  } catch (error) {
    logger.error('Callback proxy error', error, { duration: Date.now() - startTime });
    res.status(500).json({
      error: 'server_error',
      error_description: 'Failed to proxy callback request'
    });
  }
});

// Store active MCP servers by session
const activeSessions = new Map<string, {
  server: Server;
  stateManager: StateManager;
  transport: StreamableHTTPServerTransport;
  firebaseClient: FirebaseClient;
}>();

// MCP endpoint (supports both GET, POST, and DELETE per Streamable HTTP spec)
app.all('/mcp', async (req, res) => {
  const startTime = Date.now();
  const sessionId = req.headers['mcp-session-id'] as string;

  logger.request(req.method, '/mcp', { sessionId });

  // Check if this is an initialize request (allowed without auth)
  const isInitialize = req.body?.method === 'initialize';

  // Extract bearer token from Authorization header
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

  // For non-initialize requests, require authentication
  if (!isInitialize && !bearerToken) {
    logger.warn('MCP request missing authorization', { method: req.method, sessionId });
    res.status(401).json({
      jsonrpc: '2.0',
      error: {
        code: -32001,
        message: 'Authentication required',
        data: {
          authType: 'oauth',
          oauthMetadataUrl: 'https://us-central1-agent-drugs.cloudfunctions.net/oauthMetadata'
        }
      },
      id: req.body?.id
    });
    return;
  }

  // For initialize without token, return OAuth requirement
  if (isInitialize && !bearerToken) {
    logger.info('Unauthenticated initialize request - returning OAuth requirement');
    res.status(200).json({
      jsonrpc: '2.0',
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'agent-drugs',
          version: '0.1.0'
        }
      },
      id: req.body?.id
    });
    return;
  }

  try {
    // At this point, bearerToken is guaranteed to be defined (we returned early if not)
    // TypeScript doesn't know this, so we need to assert it
    if (!bearerToken) {
      throw new Error('Bearer token missing after validation checks');
    }

    // Initialize components for this connection
    const config = loadConfig(false); // Don't require bearer token in env
    const firebaseClient = new FirebaseClient(
      bearerToken, // Use token from Authorization header
      config.firebaseProjectId,
      config.serviceAccountPath
    );

    // Validate bearer token
    const agentInfo = await firebaseClient.validateBearerToken();
    logger.auth('Agent authenticated', {
      agentName: agentInfo.name,
      agentId: agentInfo.agentId,
      userId: agentInfo.userId,
      sessionId
    });

    let sessionData = activeSessions.get(sessionId || '');

    // Update firebaseClient in existing session with new validated token
    if (sessionData) {
      sessionData.firebaseClient = firebaseClient;
    }

    if (!sessionData) {
      // New session - create MCP server and state manager
      // Initialize state manager with agent info
      const stateManager = new StateManager(agentInfo.agentId, agentInfo.userId);

      // Create MCP server instance for this session
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
              description: 'Take a digital drug to modify your behavior. Each drug has a fixed duration.',
              inputSchema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    description: 'Name of the drug to take',
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
          switch (request.params.name) {
            case 'list_drugs':
              return await listDrugsTool(firebaseClient) as any;

            case 'take_drug': {
              const args = request.params.arguments as { name: string };
              return await takeDrugTool(args, firebaseClient, stateManager) as any;
            }

            case 'active_drugs':
              return await activeDrugsTool(stateManager) as any;

            default:
              throw new Error(`Unknown tool: ${request.params.name}`);
          }
        });

        // Create Streamable HTTP transport with session management
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => `session_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          onsessioninitialized: (newSessionId) => {
            logger.session('initialized', newSessionId, {
              agentId: agentInfo.agentId,
              agentName: agentInfo.name
            });
            // Store session with the generated ID
            const newSessionData = { server, stateManager, transport, firebaseClient };
            activeSessions.set(newSessionId, newSessionData);
          },
          onsessionclosed: (closedSessionId) => {
            logger.session('closed', closedSessionId);
            activeSessions.delete(closedSessionId);
          },
        });

        // Connect server to transport
        await server.connect(transport);
        logger.info('MCP session created', {
          agentId: agentInfo.agentId,
          duration: Date.now() - startTime
        });

        // Handle this first request which will trigger onsessioninitialized callback
        // After this call, the session will be stored in activeSessions
        await transport.handleRequest(req, res, req.body);
        return; // Exit early - first request handled
      }

      // Existing session - use the stored transport to handle request
      await sessionData.transport.handleRequest(req, res, req.body);

  } catch (error) {
    logger.error('MCP connection error', error, {
      method: req.method,
      sessionId,
      duration: Date.now() - startTime
    });
    if (!res.headersSent) {
      res.status(401).json({ error: 'Authentication failed' });
    }
  }
});

// Start server
async function main() {
  try {
    const server = app.listen(port, () => {
      logger.info('Server started', {
        port,
        endpoints: {
          mcp: `http://localhost:${port}/mcp`,
          metadata: `http://localhost:${port}/.well-known/oauth-authorization-server`,
          registration: `http://localhost:${port}/register`,
          authorization: `http://localhost:${port}/authorize`,
          token: `http://localhost:${port}/token`,
          revoke: `http://localhost:${port}/revoke`,
          callback: `http://localhost:${port}/callback`,
          health: `http://localhost:${port}/health`
        },
        protocol: 'Streamable HTTP (MCP 2025-03-26)',
        logLevel: process.env.LOG_LEVEL || 'INFO'
      });
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error', error);
      process.exit(1);
    });

    // Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down gracefully...');

      // Close all active sessions
      for (const [sessionId, session] of activeSessions.entries()) {
        try {
          await session.server.close();
          logger.session('closed', sessionId, { reason: 'shutdown' });
        } catch (error) {
          logger.error('Error closing session during shutdown', error, { sessionId });
        }
      }
      activeSessions.clear();

      // Close HTTP server
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });

      // Force exit after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (error) {
    logger.error('Failed to start server', error);
    throw error;
  }
}

main().catch((error) => {
  logger.error('Fatal server startup error', error);
  process.exit(1);
});
