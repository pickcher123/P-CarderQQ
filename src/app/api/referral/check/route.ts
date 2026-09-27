import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ success: false, error: '缺少代碼' }, { status: 400 });
    }

    const cleanCode = code.trim().toUpperCase();
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '資料庫尚未就緒' }, { status: 500 });
    }

    // 1. 檢查一般會員邀請碼
    const userSnap = await db.collection('users').where('inviteCode', '==', cleanCode).limit(1).get();
    if (!userSnap.empty) {
      const u = userSnap.docs[0].data();
      return NextResponse.json({
        success: true,
        valid: true,
        type: 'user',
        referrerName: u.username || 'P+ 藏友',
        code: cleanCode,
      });
    }

    // 2. 檢查官方專案自訂推薦碼
    const customDoc = await db.collection('referralCodes').doc(cleanCode).get();
    if (customDoc.exists && customDoc.data()?.isActive !== false) {
      const data = customDoc.data()!;
      return NextResponse.json({
        success: true,
        valid: true,
        type: 'campaign',
        referrerName: data.campaignName || '官方推廣專案',
        code: cleanCode,
      });
    }

    return NextResponse.json({
      success: true,
      valid: false,
      error: '此推薦碼無效或已過期',
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
