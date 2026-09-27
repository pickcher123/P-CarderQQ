import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '資料庫尚未就緒' }, { status: 500 });
    }

    // 取得所有官方活動推薦碼
    const codesSnap = await db.collection('referralCodes').orderBy('createdAt', 'desc').limit(100).get();
    const codes = codesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 取得最新 100 筆推薦成功紀錄
    const logsSnap = await db.collection('referralLogs').orderBy('createdAt', 'desc').limit(100).get();
    const logs = logsSnap.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAtFormatted: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
      };
    });

    // 統計前 10 名推薦達人會員
    const topReferrersSnap = await db.collection('users')
      .where('inviteCount', '>', 0)
      .orderBy('inviteCount', 'desc')
      .limit(10)
      .get();
    const topReferrers = topReferrersSnap.docs.map(doc => ({
      id: doc.id,
      username: doc.data().username || '未命名',
      email: doc.data().email || '',
      inviteCode: doc.data().inviteCode || '-',
      inviteCount: doc.data().inviteCount || 0,
      userLevel: doc.data().userLevel || '新手收藏家',
    }));

    return NextResponse.json({
      success: true,
      codes,
      logs,
      topReferrers,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, code, campaignName, referrerBonusPoints, refereeBonusPoints, freeDrawTickets, isActive } = body;

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '資料庫尚未就緒' }, { status: 500 });
    }

    if (action === 'create') {
      if (!code || !campaignName) {
        return NextResponse.json({ success: false, error: '代碼與專案名稱為必填' }, { status: 400 });
      }

      const cleanCode = String(code).trim().toUpperCase();
      const codeRef = db.collection('referralCodes').doc(cleanCode);
      const existing = await codeRef.get();
      if (existing.exists) {
        return NextResponse.json({ success: false, error: '此推薦碼代號已存在' }, { status: 400 });
      }

      await codeRef.set({
        code: cleanCode,
        campaignName: campaignName.trim(),
        referrerBonusPoints: Number(referrerBonusPoints) || 0,
        refereeBonusPoints: Number(refereeBonusPoints) || 50,
        freeDrawTickets: Number(freeDrawTickets) || 1,
        isActive: true,
        usageCount: 0,
        createdAt: FieldValue.serverTimestamp(),
      });

      return NextResponse.json({ success: true, message: '專案推薦碼建立成功' });
    }

    if (action === 'toggle') {
      if (!code) return NextResponse.json({ success: false, error: '缺少代碼' }, { status: 400 });
      const cleanCode = String(code).trim().toUpperCase();
      const codeRef = db.collection('referralCodes').doc(cleanCode);
      await codeRef.update({
        isActive: Boolean(isActive),
      });
      return NextResponse.json({ success: true, message: '狀態已更新' });
    }

    if (action === 'delete') {
      if (!code) return NextResponse.json({ success: false, error: '缺少代碼' }, { status: 400 });
      const cleanCode = String(code).trim().toUpperCase();
      await db.collection('referralCodes').doc(cleanCode).delete();
      return NextResponse.json({ success: true, message: '已刪除推薦碼' });
    }

    return NextResponse.json({ success: false, error: '未知的操作類型' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
