"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateJWT = exports.generateJWTHandler = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
const crypto = require("crypto");
/**
 * Generate a secure JWT for MCP authentication
 * Stores agent credentials in Firestore agents collection
 */
async function generateJWTHandler(request) {
    var _a;
    // Verify user is authenticated
    if (!request.auth || !request.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to generate JWT');
    }
    const uid = request.auth.uid;
    const agentName = ((_a = request.data) === null || _a === void 0 ? void 0 : _a.agentName) || 'Default Agent';
    // Generate secure random JWT (256 bits = 32 bytes = 64 hex chars)
    const jwt = 'agdrug_jwt_' + crypto.randomBytes(32).toString('hex');
    // Store agent in Firestore
    const db = admin.firestore();
    const agentRef = await db.collection('agents').add({
        userId: uid,
        name: agentName,
        jwt: jwt,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastUsedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return {
        jwt: jwt,
        agentId: agentRef.id,
        agentName: agentName,
    };
}
exports.generateJWTHandler = generateJWTHandler;
// Export the Cloud Function
exports.generateJWT = functions.https.onCall(async (data, context) => {
    return generateJWTHandler({ auth: context.auth, data });
});
//# sourceMappingURL=generateCustomToken.js.map