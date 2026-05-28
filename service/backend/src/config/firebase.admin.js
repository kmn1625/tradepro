'use strict';
const admin = require('firebase-admin');

// Only initialize if not already initialized and all required credentials are present.
// When env vars are absent (local dev, CI), Firestore is gracefully disabled.
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

  if (projectId && privateKey && clientEmail) {
    const serviceAccount = {
      type: 'service_account',
      project_id: projectId,
      private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || '',
      private_key: privateKey,
      client_email: clientEmail,
      client_id: process.env.FIREBASE_CLIENT_ID || '',
      auth_uri: 'https://accounts.google.com/o/oauth2/auth',
      token_uri: 'https://oauth2.googleapis.com/token',
    };

    try {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId,
      });
      console.log('[Firebase Admin] Initialized — project:', projectId);
    } catch (err) {
      console.warn('[Firebase Admin] initializeApp failed:', err.message);
    }
  } else {
    console.warn(
      '[Firebase Admin] Credentials not configured — Firestore disabled. ' +
      'Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL in .env'
    );
  }
}

/**
 * Returns the Firestore instance, or null if Firebase is not initialized.
 * All callers must guard: if (!db) return;
 *
 * @returns {import('firebase-admin').firestore.Firestore | null}
 */
function getFirestore() {
  if (!admin.apps.length) return null;
  try {
    return admin.firestore();
  } catch (err) {
    console.warn('[Firebase Admin] getFirestore failed:', err.message);
    return null;
  }
}

module.exports = { admin, getFirestore };
