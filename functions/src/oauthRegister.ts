import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import * as crypto from 'crypto';

/**
 * OAuth 2.0 Dynamic Client Registration (RFC 7591)
 * Allows MCP clients to register themselves and receive a client_id
 */

interface ClientRegistrationRequest {
  client_name?: string;
  client_uri?: string;
  redirect_uris?: string[];
  grant_types?: string[];
  response_types?: string[];
  scope?: string;
  token_endpoint_auth_method?: string;
}

interface ClientRegistrationResponse {
  client_id: string;
  client_name?: string;
  client_uri?: string;
  redirect_uris?: string[];
  grant_types: string[];
  response_types: string[];
  token_endpoint_auth_method: string;
  client_id_issued_at: number;
}

/**
 * OAuth Dynamic Client Registration endpoint
 * POST /oauthRegister
 */
export const oauthRegister = functions.https.onRequest(async (req, res) => {
  // CORS headers
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({
      error: 'invalid_request',
      error_description: 'Only POST method is supported'
    });
    return;
  }

  try {
    const registrationRequest: ClientRegistrationRequest = req.body;

    // Validate request
    if (!registrationRequest || typeof registrationRequest !== 'object') {
      res.status(400).json({
        error: 'invalid_request',
        error_description: 'Invalid registration request'
      });
      return;
    }

    // Generate client_id
    const clientId = `client_${crypto.randomBytes(16).toString('hex')}`;
    const issuedAt = Math.floor(Date.now() / 1000);

    // Default values
    const requestedGrantTypes = registrationRequest.grant_types || ['authorization_code'];
    const responseTypes = registrationRequest.response_types || ['code'];
    const tokenEndpointAuthMethod = 'none'; // PKCE, no client secret needed

    // Filter grant types - only register those we support
    // Per RFC 7591, server should accept the registration but only register supported grant types
    const allowedGrantTypes = ['authorization_code'];
    const grantTypes = requestedGrantTypes.filter(gt => allowedGrantTypes.includes(gt));

    // If no valid grant types remain after filtering, reject
    if (grantTypes.length === 0) {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'No supported grant types requested. Supported: authorization_code'
      });
      return;
    }

    // Validate response types
    if (!responseTypes.includes('code')) {
      res.status(400).json({
        error: 'invalid_client_metadata',
        error_description: 'Only response_type "code" is supported'
      });
      return;
    }

    // Store client registration in Firestore
    const db = admin.firestore();
    await db.collection('oauth_clients').doc(clientId).set({
      client_id: clientId,
      client_name: registrationRequest.client_name || null,
      client_uri: registrationRequest.client_uri || null,
      redirect_uris: registrationRequest.redirect_uris || [],
      grant_types: grantTypes,
      response_types: responseTypes,
      scope: registrationRequest.scope || 'drugs:read drugs:write',
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      client_id_issued_at: admin.firestore.Timestamp.fromMillis(issuedAt * 1000),
      created_at: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Build response
    const response: ClientRegistrationResponse = {
      client_id: clientId,
      grant_types: grantTypes,
      response_types: responseTypes,
      token_endpoint_auth_method: tokenEndpointAuthMethod,
      client_id_issued_at: issuedAt,
    };

    // Include optional fields if provided
    if (registrationRequest.client_name) {
      response.client_name = registrationRequest.client_name;
    }
    if (registrationRequest.client_uri) {
      response.client_uri = registrationRequest.client_uri;
    }
    if (registrationRequest.redirect_uris) {
      response.redirect_uris = registrationRequest.redirect_uris;
    }

    res.status(201).json(response);

  } catch (error) {
    console.error('Client registration error:', error);
    res.status(500).json({
      error: 'server_error',
      error_description: 'Internal server error during client registration'
    });
  }
});
