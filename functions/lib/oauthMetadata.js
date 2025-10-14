"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthAuthorize = exports.oauthMetadata = exports.getOAuthMetadataHandler = void 0;
const functions = require("firebase-functions");
/**
 * Returns OAuth 2.0 Authorization Server Metadata
 * MCP clients use this for OAuth discovery (RFC 8414)
 */
async function getOAuthMetadataHandler() {
    const baseUrl = 'https://agent-drugs.web.app';
    return {
        issuer: baseUrl,
        authorization_endpoint: `${baseUrl}/oauth/authorize`,
        token_endpoint: `${baseUrl}/oauth/token`,
        registration_endpoint: `${baseUrl}/oauth/register`,
        scopes_supported: ['drugs:read', 'drugs:write'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
    };
}
exports.getOAuthMetadataHandler = getOAuthMetadataHandler;
/**
 * OAuth metadata endpoint
 * GET /.well-known/oauth-authorization-server
 */
exports.oauthMetadata = functions.https.onRequest(async (req, res) => {
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
 * Redirects to Firebase Auth for user login
 */
exports.oauthAuthorize = functions.https.onRequest(async (req, res) => {
    // Extract OAuth parameters
    const { client_id, redirect_uri, response_type, scope, state, code_challenge, code_challenge_method } = req.query;
    // Validate required parameters
    if (!client_id || !redirect_uri || response_type !== 'code') {
        res.status(400).json({
            error: 'invalid_request',
            error_description: 'Missing or invalid OAuth parameters'
        });
        return;
    }
    // Store OAuth session in cookie for callback
    res.cookie('oauth_session', JSON.stringify({
        client_id,
        redirect_uri,
        scope,
        state,
        code_challenge,
        code_challenge_method
    }), {
        httpOnly: true,
        secure: true,
        maxAge: 600000 // 10 minutes
    });
    // Redirect to Firebase hosted login page
    res.redirect('/login?oauth=true');
});
//# sourceMappingURL=oauthMetadata.js.map