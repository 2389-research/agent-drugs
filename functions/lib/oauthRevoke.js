"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.oauthRevoke = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
/**
 * OAuth token revocation endpoint
 * POST /oauth/revoke
 *
 * Revokes a bearer token (RFC 7009)
 */
exports.oauthRevoke = functions.https.onRequest(async (req, res) => {
    // CORS headers for MCP clients
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
            error_description: 'Method not allowed'
        });
        return;
    }
    try {
        const { token } = req.body;
        // Validate required parameters
        if (!token) {
            res.status(400).json({
                error: 'invalid_request',
                error_description: 'Missing token parameter'
            });
            return;
        }
        // Look up bearer token in Firestore
        const db = admin.firestore();
        const tokenDoc = await db.collection('bearer_tokens').doc(token).get();
        if (!tokenDoc.exists) {
            // RFC 7009: The authorization server responds with HTTP status code 200
            // if the token has been revoked successfully or if the client submitted
            // an invalid token.
            console.log(`Token not found for revocation: ${token.substring(0, 10)}...`);
            res.status(200).send('');
            return;
        }
        // Delete the token from Firestore
        await tokenDoc.ref.delete();
        console.log(`Token revoked successfully for agent: ${tokenDoc.data()?.agentId}`);
        // RFC 7009: Successful responses return HTTP 200
        res.status(200).send('');
    }
    catch (error) {
        console.error('OAuth token revocation error:', error);
        // RFC 7009: The authorization server validates the token and if valid,
        // revokes the token. The authorization server responds with HTTP status
        // code 200 if the token has been revoked successfully or if the client
        // submitted an invalid token.
        // In case of server errors, we return 503 instead
        res.status(503).json({
            error: 'temporarily_unavailable',
            error_description: 'Service temporarily unavailable'
        });
    }
});
//# sourceMappingURL=oauthRevoke.js.map