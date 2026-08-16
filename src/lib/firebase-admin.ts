import * as admin from 'firebase-admin';

function getFirebaseAdminApp() {
  if (!admin.apps.length) {
    try {
      admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-8439816843-ca6d5',
      });
      console.log('Firebase Admin initialized successfully');
    } catch (error) {
      console.error('Firebase Admin initialization error', error);
    }
  }
  return admin.app();
}

export function getAdminDb() {
  getFirebaseAdminApp();
  return admin.firestore();
}

export function getAdminAuth() {
  getFirebaseAdminApp();
  return admin.auth();
}

// Proxies for backwards compatibility
export const adminDb = new Proxy({} as FirebaseFirestore.Firestore, {
  get(_, prop) {
    const db = getAdminDb();
    const val = (db as any)[prop];
    if (typeof val === 'function') {
      return val.bind(db);
    }
    return val;
  }
});

export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(_, prop) {
    const auth = getAdminAuth();
    const val = (auth as any)[prop];
    if (typeof val === 'function') {
      return val.bind(auth);
    }
    return val;
  }
});
