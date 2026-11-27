import { NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';

const SUPER_ADMIN_EMAILS = ['pickcher123@gmail.com'];

export interface VerifiedUser {
  uid: string;
  email: string;
  token: any;
}

export type AuthCheckResult =
  | { ok: true; user: VerifiedUser }
  | { ok: false; response: NextResponse };

/**
 * 驗證請求標頭中的 Firebase ID Token (`Authorization: Bearer <token>`)
 */
export async function verifyUserRequest(req: Request): Promise<AuthCheckResult> {
  const authHeader = req.headers.get('authorization') || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  if (!idToken) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '未登入或缺少身分驗證憑證，請重新登入後再試。' },
        { status: 401 }
      ),
    };
  }

  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '伺服器驗證服務尚未就緒，請稍後再試。' },
        { status: 503 }
      ),
    };
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    return {
      ok: true,
      user: {
        uid: decoded.uid,
        email: (decoded.email || '').toLowerCase().trim(),
        token: decoded,
      },
    };
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '身分驗證憑證無效或已過期，請重新登入。' },
        { status: 401 }
      ),
    };
  }
}

/**
 * 驗證請求者是否為合法管理員（與 firestore.rules `isVerifiedAdmin()` 邏輯完全一致）
 */
export async function verifyAdminRequest(req: Request): Promise<AuthCheckResult> {
  const userCheck = await verifyUserRequest(req);
  if (!userCheck.ok) return userCheck;

  const { uid, email } = userCheck.user;

  // 1. 超級管理員白名單
  if (email && SUPER_ADMIN_EMAILS.includes(email)) {
    return userCheck;
  }

  const db = getAdminDb();
  if (!db) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, error: '資料庫服務尚未就緒，無法驗證管理員權限。' },
        { status: 503 }
      ),
    };
  }

  try {
    // 2. 檢查 admins/{uid}、admins/{email} 與 users/{uid}
    const checks = [
      db.collection('admins').doc(uid).get(),
      db.collection('users').doc(uid).get(),
      ...(email ? [db.collection('admins').doc(email).get()] : []),
    ];
    const [adminByUid, userDoc, adminByEmail] = await Promise.all(checks);

    if (adminByUid?.exists || adminByEmail?.exists) {
      return userCheck;
    }

    if (userDoc?.exists) {
      const data = userDoc.data() || {};
      const role = String(data.role || '').toLowerCase().trim();
      if (role === 'admin' || role === 'superadmin' || data.isAdmin === true || data.is_admin === true) {
        return userCheck;
      }
    }
  } catch (err) {
    console.error('[verifyAdminRequest] Firestore lookup error:', err);
  }

  return {
    ok: false,
    response: NextResponse.json(
      { success: false, error: '權限不足：僅限管理員存取此操作。' },
      { status: 403 }
    ),
  };
}

/**
 * 驗證 Cron / Bot 內部排程金鑰（支援 CRON_SECRET 或合法管理員 Token）
 */
export async function verifyCronOrAdminRequest(req: Request): Promise<NextResponse | null> {
  const cronSecret = process.env.CRON_SECRET?.trim();
  const url = new URL(req.url);
  const keyParam = url.searchParams.get('key') || url.searchParams.get('secret') || '';
  const authHeader = req.headers.get('authorization') || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';

  // 若請求攜帶正確的 CRON_SECRET，直接放行
  if (cronSecret && (keyParam === cronSecret || bearer === cronSecret)) {
    return null;
  }

  // 若請求攜帶管理員 Firebase ID Token，也放行（方便後台手動觸發）
  if (bearer) {
    const adminCheck = await verifyAdminRequest(req);
    if (adminCheck.ok) return null;
  }

  return NextResponse.json(
    { success: false, error: '未授權的排程呼叫：請提供有效的 CRON_SECRET 或管理員憑證。' },
    { status: 401 }
  );
}
