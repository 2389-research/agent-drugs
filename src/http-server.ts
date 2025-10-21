#!/usr/bin/env node
import express from 'express';
import cors from 'cors';

import { loadConfig } from './config.js';
import { FirebaseClient } from './firebase-client.js';
import { StateManager } from './state-manager.js';
import { listDrugsTool } from './tools/list-drugs.js';
import { takeDrugTool } from './tools/take-drug.js';
import { activeDrugsTool } from './tools/active-drugs.js';
import { detoxTool } from './tools/detox.js';
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

// OAuth metadata endpoint
app.get('/.well-known/oauth-authorization-server', async (req, res) => {
  const startTime = Date.now();
  logger.oauth('Metadata discovery request');

  try {
    // Fetch metadata from upstream Cloud Functions endpoint
    const upstream = 'https://us-central1-agent-drugs.cloudfunctions.net/oauthMetadata';
    const response = await fetch(upstream);

    // Honor upstream status - if upstream is down, don't claim we're OK
    if (!response.ok) {
      logger.warn('Upstream metadata not OK', { status: response.status });
      res.status(response.status).json({
        error: 'temporarily_unavailable',
        error_description: 'OAuth metadata temporarily unavailable'
      });
      logger.response('GET', '/.well-known/oauth-authorization-server', response.status, Date.now() - startTime);
      return;
    }

    const metadata = await response.json();

    // Rewrite metadata to use local endpoints for dev testing
    const base = `${req.protocol}://${req.get('host')}`;
    const rewritten = {
      ...metadata,
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      revocation_endpoint: `${base}/revoke`,
      registration_endpoint: `${base}/register`,
    };

    logger.oauth('Metadata fetched and rewritten to local endpoints', {
      duration: Date.now() - startTime
    });
    res.status(200).json(rewritten);
    logger.response('GET', '/.well-known/oauth-authorization-server', 200, Date.now() - startTime);
  } catch (error) {
    logger.error('Metadata fetch error', error, { duration: Date.now() - startTime });
    res.status(503).json({
      error: 'temporarily_unavailable',
      error_description: 'OAuth metadata temporarily unavailable'
    });
  }
});

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

// MCP endpoint - stateless JSON-RPC over HTTP
app.post('/mcp', async (req, res) => {
  const startTime = Date.now();

  logger.request(req.method, '/mcp', {
    method: req.body?.method,
    id: req.body?.id
  });

  try {
    const jsonrpcRequest = req.body;

    // Validate JSON-RPC request
    if (!jsonrpcRequest || jsonrpcRequest.jsonrpc !== '2.0') {
      res.status(400).json({
        jsonrpc: '2.0',
        error: {
          code: -32600,
          message: 'Invalid Request'
        },
        id: jsonrpcRequest?.id || null
      });
      return;
    }

    // Handle initialize method
    if (jsonrpcRequest.method === 'initialize') {
      logger.info('Initialize request');
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
        id: jsonrpcRequest.id
      });
      return;
    }

    // Handle notifications (no response needed per JSON-RPC 2.0 spec)
    if (jsonrpcRequest.method?.startsWith('notifications/')) {
      logger.info('Notification received', { method: jsonrpcRequest.method });
      res.status(200).end(); // Acknowledge but don't send response body
      return;
    }

    // For all other methods, require authentication
    const authHeader = req.headers.authorization;
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : undefined;

    if (!bearerToken) {
      logger.warn('MCP request missing authorization', { method: jsonrpcRequest.method });
      res.status(401).json({
        jsonrpc: '2.0',
        error: {
          code: -32001,
          message: 'Authentication required',
          data: {
            authType: 'oauth',
            oauthMetadataUrl: `${req.protocol}://${req.get('host')}/.well-known/oauth-authorization-server`
          }
        },
        id: jsonrpcRequest.id
      });
      return;
    }

    // Initialize components for this request
    const config = loadConfig(false);
    const firebaseClient = new FirebaseClient(
      bearerToken,
      config.firebaseProjectId,
      config.serviceAccountPath
    );

    // Validate bearer token
    const agentInfo = await firebaseClient.validateBearerToken();
    logger.auth('Agent authenticated', {
      agentName: agentInfo.name,
      agentId: agentInfo.agentId,
      userId: agentInfo.userId
    });

    // Create state manager for this request
    const stateManager = new StateManager(agentInfo.agentId, agentInfo.userId);

    // Handle tools/list method
    if (jsonrpcRequest.method === 'tools/list') {
      logger.info('Listing tools');
      const tools = [
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
        {
          name: 'detox',
          description: 'Remove all active drugs and return to standard behavior',
          inputSchema: {
            type: 'object',
            properties: {},
          },
        },
      ];

      res.status(200).json({
        jsonrpc: '2.0',
        result: { tools },
        id: jsonrpcRequest.id
      });
      return;
    }

    // Handle tools/call method
    if (jsonrpcRequest.method === 'tools/call') {
      const toolName = jsonrpcRequest.params?.name;
      const toolArgs = jsonrpcRequest.params?.arguments || {};

      logger.info('Tool call', { tool: toolName, args: toolArgs });

      let result;
      switch (toolName) {
        case 'list_drugs':
          result = await listDrugsTool(firebaseClient);
          break;

        case 'take_drug':
          result = await takeDrugTool(toolArgs, firebaseClient, stateManager);
          break;

        case 'active_drugs':
          result = await activeDrugsTool(stateManager);
          break;

        case 'detox':
          result = await detoxTool(stateManager);
          break;

        default:
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32601,
              message: `Unknown tool: ${toolName}`
            },
            id: jsonrpcRequest.id
          });
          return;
      }

      res.status(200).json({
        jsonrpc: '2.0',
        result,
        id: jsonrpcRequest.id
      });
      logger.response('POST', '/mcp', 200, Date.now() - startTime);
      return;
    }

    // Unknown method
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: `Method not found: ${jsonrpcRequest.method}`
      },
      id: jsonrpcRequest.id
    });

  } catch (error) {
    logger.error('MCP request error', error, {
      duration: Date.now() - startTime
    });

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error'
        },
        id: req.body?.id || null
      });
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
    const shutdown = () => {
      logger.info('Shutting down gracefully...');

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
