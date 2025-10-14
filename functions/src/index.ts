import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export functions
export { generateJWT } from './generateCustomToken';
export { oauthMetadata, oauthAuthorize } from './oauthMetadata';
