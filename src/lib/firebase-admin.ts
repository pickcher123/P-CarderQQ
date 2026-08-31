import * as admin from 'firebase-admin';

function getFirebaseAdminApp() {
  if (typeof window !== 'undefined') return null;
  if (!admin.apps.length) {
    try {
      return admin.initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'studio-8439816843-ca6d5',
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Firebase Admin initialization deferred:', error);
      }
      return null;
    }
  }
  return admin.app();
}

export function getAdminDb() {
  const app = getFirebaseAdminApp();
  return app ? admin.firestore() : null;
}

export function getAdminAuth() {
  const app = getFirebaseAdminApp();
  return app ? admin.auth() : null;
}

// Proxies for backwards compatibility
export const adminDb = new Proxy({} as any, {
  get(_, prop) {
    const db = getAdminDb();
    if (!db) return undefined;
    const val = (db as any)[prop];
    if (typeof val === 'function') {
      return val.bind(db);
    }
    return val;
  }
});

export const adminAuth = new Proxy({} as any, {
  get(_, prop) {
    const auth = getAdminAuth();
    if (!auth) return undefined;
    const val = (auth as any)[prop];
    if (typeof val === 'function') {
      return val.bind(auth);
    }
    return val;
  }
});

