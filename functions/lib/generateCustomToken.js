"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateCustomToken = exports.generateCustomTokenHandler = void 0;
const functions = require("firebase-functions");
const admin = require("firebase-admin");
async function generateCustomTokenHandler(request) {
    // Verify user is authenticated
    if (!request.auth || !request.auth.uid) {
        throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated to generate token');
    }
    const uid = request.auth.uid;
    // Generate custom token using Admin SDK
    const customToken = await admin.auth().createCustomToken(uid);
    return {
        token: customToken
    };
}
exports.generateCustomTokenHandler = generateCustomTokenHandler;
// Export the Cloud Function
exports.generateCustomToken = functions.https.onCall(async (data, context) => {
    return generateCustomTokenHandler(context);
});
//# sourceMappingURL=generateCustomToken.js.map