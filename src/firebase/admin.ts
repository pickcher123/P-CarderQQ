import admin from 'firebase-admin';
import firebaseConfigData from '../../firebase-applet-config.json';

export function hasAdminCredentials(): boolean {
  if (typeof window !== 'undefined') return false;
  return !!(
    (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) ||
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  );
}

/**
 * 延遲初始化 Firebase Admin
 * 確保在 Next.js 建置期間與伺服器啟動時不因缺少金鑰而崩潰
 */
export function getAdminApp() {
  if (typeof window !== 'undefined') return null;
  
  if (!admin.apps.length) {
    try {
      const defaultProjectId = firebaseConfigData?.projectId || 'studio-8439816843-ca6d5';
      if (process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL) {
        return admin.initializeApp({
          credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          }),
        });
      }
      return admin.initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || defaultProjectId,
      });
    } catch (error) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Firebase admin initialization deferred or missing credentials:', error);
      }
      return null;
    }
  }
  return admin.app();
}

/**
 * 使用 Getter 模式獲取實例，防止建置與啟動期崩潰
 * 僅在具備合法服務帳戶憑證時才返回實例，避免未授權 gRPC 拋出 PERMISSION_DENIED
 */
export const getAdminDb = () => {
  if (!hasAdminCredentials()) return null;
  const app = getAdminApp();
  return app ? app.firestore() : null;
};

export const getAdminAuth = () => {
  if (!hasAdminCredentials()) return null;
  const app = getAdminApp();
  return app ? app.auth() : null;
};

// 採用 Lazy Proxy 避免在模組載入時立即呼叫 getAdminApp()
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

