import * as admin from 'firebase-admin';

// Initialize Firebase Admin
admin.initializeApp();

// Export functions
export { generateCustomToken } from './generateCustomToken';
