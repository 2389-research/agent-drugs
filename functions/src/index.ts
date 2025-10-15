import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export OAuth functions only
// generateBearerToken is internal - only used by oauthCallback
export { oauthMetadata, oauthAuthorize } from './oauthMetadata';
export { oauthToken } from './oauthToken';
export { oauthCallback } from './oauthCallback';
export { oauthRegister } from './oauthRegister';
