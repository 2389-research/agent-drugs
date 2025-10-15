import * as functions from 'firebase-functions';

/**
 * OAuth 2.0 Authorization Server Metadata (RFC 8414)
 * Required by MCP clients for OAuth discovery
 */
export interface OAuthMetadata {
  issuer: string;
  authorization_endpoint: string;
  token_endpoint: string;
  registration_endpoint?: string;
  scopes_supported: string[];
  response_types_supported: string[];
  grant_types_supported: string[];
  code_challenge_methods_supported: string[];
}

/**
 * Returns OAuth 2.0 Authorization Server Metadata
 * MCP clients use this for OAuth discovery (RFC 8414)
 */
export async function getOAuthMetadataHandler(): Promise<OAuthMetadata> {
  const functionsBaseUrl = 'https://us-central1-agent-drugs.cloudfunctions.net';
  const hostingBaseUrl = 'https://agent-drugs.web.app';

  return {
    issuer: hostingBaseUrl,
    authorization_endpoint: `${functionsBaseUrl}/oauthAuthorize`,
    token_endpoint: `${functionsBaseUrl}/oauthToken`,
    registration_endpoint: `${functionsBaseUrl}/oauthRegister`,
    scopes_supported: ['drugs:read', 'drugs:write'],
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code'], // Only authorization_code is implemented
    code_challenge_methods_supported: ['S256'],
  };
}

/**
 * OAuth metadata endpoint
 * GET /.well-known/oauth-authorization-server
 */
export const oauthMetadata = functions.https.onRequest(async (req, res) => {
  // CORS headers for MCP clients
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const metadata = await getOAuthMetadataHandler();
  res.status(200).json(metadata);
});

/**
 * OAuth authorization initiation
 * Redirects to Firebase Hosting OAuth authorization page
 */
export const oauthAuthorize = functions.https.onRequest(async (req, res) => {
  // Extract OAuth parameters
  const {
    client_id,
    redirect_uri,
    response_type,
    scope,
    state,
    code_challenge,
    code_challenge_method
  } = req.query;

  // Validate required parameters
  if (!client_id || !redirect_uri || response_type !== 'code') {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing or invalid OAuth parameters'
    });
    return;
  }

  // Validate PKCE
  if (!code_challenge || code_challenge_method !== 'S256') {
    res.status(400).json({
      error: 'invalid_request',
      error_description: 'PKCE with S256 is required'
    });
    return;
  }

  // Build redirect URL to hosted authorization page
  const authUrl = new URL('https://agent-drugs.web.app/oauth-authorize.html');
  authUrl.searchParams.set('client_id', client_id as string);
  authUrl.searchParams.set('redirect_uri', redirect_uri as string);
  authUrl.searchParams.set('response_type', 'code');
  if (scope) authUrl.searchParams.set('scope', scope as string);
  if (state) authUrl.searchParams.set('state', state as string);
  authUrl.searchParams.set('code_challenge', code_challenge as string);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  // Redirect to authorization page
  res.redirect(authUrl.toString());
});
