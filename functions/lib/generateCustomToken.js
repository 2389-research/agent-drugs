"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBearerToken = exports.generateBearerTokenHandler = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
/**
 * Generate a secure bearer token for MCP authentication
 * Stores agent credentials in Firestore agents collection
 *
 * Note: This is a bearer token (random string), not a cryptographic JWT.
 * MCP spec calls these "tokens" or "bearer tokens" for OAuth 2.1 compliance.
 */
async function generateBearerTokenHandler(request) {
    // Verify user is authenticated
    if (!request.auth || !request.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to generate bearer token');
    }
    const uid = request.auth.uid;
    const agentName = request.data?.agentName || 'Default Agent';
    // Generate secure random bearer token (256 bits = 32 bytes = 64 hex chars)
    const bearerToken = 'agdrug_' + crypto.randomBytes(32).toString('hex');
    // Store agent in Firestore
    const db = admin.firestore();
    const agentRef = await db.collection('agents').add({
        userId: uid,
        name: agentName,
        bearerToken: bearerToken,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
        bearerToken: bearerToken,
        agentId: agentRef.id,
        agentName: agentName,
    };
}
exports.generateBearerTokenHandler = generateBearerTokenHandler;
// Export the Cloud Function
exports.generateBearerToken = functions.https.onCall(async (request) => {
    return generateBearerTokenHandler({ auth: request.auth, data: request.data });
});
//# sourceMappingURL=generateCustomToken.js.map