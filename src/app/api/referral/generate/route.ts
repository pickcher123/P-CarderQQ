import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, customCode } = body;

    if (!userId) {
      return NextResponse.json({ success: false, error: '缺少會員 ID' }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '資料庫尚未就緒' }, { status: 500 });
    }

    const userRef = db.collection('users').doc(userId);
    const userSnap = await userRef.get();
    if (!userSnap.exists) {
      return NextResponse.json({ success: false, error: '找不到該會員' }, { status: 404 });
    }

    const userData = userSnap.data()!;
    // 如果已經有邀請碼且未指定變更
    if (userData.inviteCode && !customCode) {
      return NextResponse.json({ success: true, inviteCode: userData.inviteCode });
    }

    let codeToUse = '';
    if (customCode) {
      codeToUse = String(customCode).trim().toUpperCase();
      if (!/^[A-Z0-9]{4,12}$/.test(codeToUse)) {
        return NextResponse.json({ success: false, error: '推薦碼格式限定 4-12 碼英數字' }, { status: 400 });
      }

      // 檢查是否與其他人重複
      const checkSnap = await db.collection('users').where('inviteCode', '==', codeToUse).get();
      if (!checkSnap.empty && checkSnap.docs.some(d => d.id !== userId)) {
        return NextResponse.json({ success: false, error: '此推薦碼已被其他人使用' }, { status: 400 });
      }

      // 檢查是否與官方代碼重複
      const officialCheck = await db.collection('referralCodes').doc(codeToUse).get();
      if (officialCheck.exists) {
        return NextResponse.json({ success: false, error: '此推薦碼為官方保留代碼' }, { status: 400 });
      }
    } else {
      // 隨機生成 6 碼大寫英數字推薦碼
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let foundUnique = false;
      let attempts = 0;

      while (!foundUnique && attempts < 10) {
        attempts++;
        let randomStr = '';
        for (let i = 0; i < 6; i++) {
          randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
        }

        const existing = await db.collection('users').where('inviteCode', '==', randomStr).limit(1).get();
        const existingOfficial = await db.collection('referralCodes').doc(randomStr).get();
        if (existing.empty && !existingOfficial.exists) {
          codeToUse = randomStr;
          foundUnique = true;
        }
      }

      if (!codeToUse) {
        codeToUse = 'REF' + userId.substring(0, 5).toUpperCase();
      }
    }

    await userRef.update({
      inviteCode: codeToUse,
    });

    return NextResponse.json({
      success: true,
      inviteCode: codeToUse,
    });
  } catch (error: any) {
    console.error('Generate invite code error:', error);
    return NextResponse.json({ success: false, error: error.message || '生成失敗' }, { status: 500 });
  }
}
