import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyUserRequest } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // 1. 嚴格驗證 Firebase ID Token（禁止冒用他人 UID 綁定推薦碼）
    const auth = await verifyUserRequest(req);
    if (!auth.ok) return auth.response;

    const newUserId = auth.user.uid;
    const body = await req.json();
    const { referralCode } = body;

    if (!referralCode || typeof referralCode !== 'string') {
      return NextResponse.json({ success: false, error: '缺少推薦碼' }, { status: 400 });
    }

    const cleanCode = referralCode.trim().toUpperCase();
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '資料庫尚未就緒' }, { status: 500 });
    }

    // 2. 讀取系統推薦碼配置與搜尋推薦人（唯讀查詢）
    const systemConfigSnap = await db.collection('systemConfig').doc('referral').get();
    let referralSettings = {
      isEnabled: true,
      referrerBonusPoints: 100,
      refereeBonusPoints: 50,
      refereeDiamonds: 0,
      freeDrawTickets: 1,
    };

    if (systemConfigSnap.exists) {
      const data = systemConfigSnap.data()!;
      referralSettings = {
        isEnabled: data.isEnabled !== false,
        referrerBonusPoints: typeof data.referrerBonusPoints === 'number' ? data.referrerBonusPoints : 100,
        refereeBonusPoints: typeof data.refereeBonusPoints === 'number' ? data.refereeBonusPoints : 50,
        refereeDiamonds: typeof data.refereeDiamonds === 'number' ? data.refereeDiamonds : 0,
        freeDrawTickets: typeof data.freeDrawTickets === 'number' ? data.freeDrawTickets : 1,
      };
    }

    if (!referralSettings.isEnabled) {
      return NextResponse.json({ success: false, error: '推薦碼活動目前已暫停' }, { status: 400 });
    }

    let referrerSnap = await db.collection('users').where('inviteCode', '==', cleanCode).limit(1).get();
    let isOfficialCode = false;
    let officialCampaignName = '';

    if (referrerSnap.empty) {
      const customCodeDoc = await db.collection('referralCodes').doc(cleanCode).get();
      if (customCodeDoc.exists && customCodeDoc.data()?.isActive !== false) {
        const customData = customCodeDoc.data()!;
        isOfficialCode = true;
        officialCampaignName = customData.campaignName || cleanCode;
        if (customData.referrerBonusPoints !== undefined) {
          referralSettings.referrerBonusPoints = customData.referrerBonusPoints;
        }
        if (customData.refereeBonusPoints !== undefined) {
          referralSettings.refereeBonusPoints = customData.refereeBonusPoints;
        }
        if (customData.freeDrawTickets !== undefined) {
          referralSettings.freeDrawTickets = customData.freeDrawTickets;
        }
      } else {
        const directUser = await db.collection('users').doc(cleanCode.toLowerCase()).get();
        if (directUser.exists) {
          referrerSnap = { empty: false, docs: [directUser] } as any;
        }
      }
    }

    let referrerUserId: string | null = null;
    let referrerDisplayName = officialCampaignName || '官方專案';
    if (!referrerSnap.empty) {
      const doc = referrerSnap.docs[0];
      if (doc.id === newUserId) {
        return NextResponse.json({ success: false, error: '不能填寫自己的推薦碼' }, { status: 400 });
      }
      referrerUserId = doc.id;
      referrerDisplayName = doc.data()?.username || '推薦好友';
    } else if (!isOfficialCode) {
      return NextResponse.json({ success: false, error: '無效或不存在的推薦碼' }, { status: 404 });
    }

    // 3. 在單一 Firestore 原子交易內完成防重複綁定、手機唯一鎖與派獎（徹底防範併發 Race Condition）
    const txOutcome = await db.runTransaction(async (tx) => {
      const newUserRef = db.collection('users').doc(newUserId);
      const newUserSnap = await tx.get(newUserRef);

      if (!newUserSnap.exists) {
        return { ok: false as const, status: 404, error: '找不到該會員' };
      }

      const newUserData = newUserSnap.data()!;
      if (newUserData.invitedBy || newUserData.referredBy) {
        return { ok: false as const, status: 400, error: '該帳號已綁定過推薦碼' };
      }

      const realName = String(newUserData.realName || '').trim();
      const rawPhone = String(newUserData.phone || '').trim();
      const normalizedPhone = rawPhone.replace(/\D/g, '');
      if (realName.length < 2 || normalizedPhone.length < 8) {
        return {
          ok: false as const,
          status: 400,
          code: 'PROFILE_INCOMPLETE',
          error: '請先至「會員中心」填寫真實姓名與聯絡電話，完成基本資料後才能使用推薦碼領取獎勵！',
        };
      }

      // 原子手機唯一鎖文件（防止同一手機號併發註冊多帳號重複領獎）
      const phoneClaimRef = db.collection('referralPhoneClaims').doc(normalizedPhone);
      const phoneClaimSnap = await tx.get(phoneClaimRef);
      if (phoneClaimSnap.exists) {
        return {
          ok: false as const,
          status: 400,
          code: 'DUPLICATE_PHONE',
          error: '此聯絡電話已領取過推薦碼獎勵，每組手機號碼僅限領取乙次。',
        };
      }

      // 兼容歷史舊紀錄（尚未有 phoneClaim 文件前建立的 referralLogs）
      const legacyDupSnap = await tx.get(
        db.collection('referralLogs').where('newUserPhone', '==', normalizedPhone).limit(1)
      );
      if (!legacyDupSnap.empty) {
        return {
          ok: false as const,
          status: 400,
          code: 'DUPLICATE_PHONE',
          error: '此聯絡電話已領取過推薦碼獎勵，每組手機號碼僅限領取乙次。',
        };
      }

      // 寫入原子手機鎖
      tx.set(phoneClaimRef, {
        userId: newUserId,
        code: cleanCode,
        claimedAt: FieldValue.serverTimestamp(),
      });

      // 更新新人資料與獎勵
      const newUserUpdates: Record<string, any> = {
        invitedBy: cleanCode,
        referredBy: cleanCode,
        invitedAt: FieldValue.serverTimestamp(),
      };
      if (referralSettings.refereeBonusPoints > 0) {
        newUserUpdates.bonusPoints = FieldValue.increment(referralSettings.refereeBonusPoints);
      }
      if (referralSettings.refereeDiamonds > 0) {
        newUserUpdates.points = FieldValue.increment(referralSettings.refereeDiamonds);
      }
      if (referralSettings.freeDrawTickets > 0) {
        newUserUpdates.freeDrawTickets = FieldValue.increment(referralSettings.freeDrawTickets);
      }
      tx.update(newUserRef, newUserUpdates);

      // 新人交易紀錄
      tx.set(db.collection('transactions').doc(), {
        userId: newUserId,
        amount: referralSettings.refereeBonusPoints,
        currency: 'p-point',
        transactionType: 'Issuance',
        section: 'admin',
        details:
          `使用推薦碼【${cleanCode}】註冊獎勵：獲得 ${referralSettings.refereeBonusPoints} 紅利 P+` +
          (referralSettings.freeDrawTickets > 0 ? ` 與 ${referralSettings.freeDrawTickets} 張免費抽卡券` : ''),
        transactionDate: FieldValue.serverTimestamp(),
      });

      // 發放推薦人回饋
      if (referrerUserId) {
        const referrerRef = db.collection('users').doc(referrerUserId);
        tx.update(referrerRef, {
          inviteCount: FieldValue.increment(1),
          bonusPoints: FieldValue.increment(referralSettings.referrerBonusPoints),
        });
        tx.set(db.collection('transactions').doc(), {
          userId: referrerUserId,
          amount: referralSettings.referrerBonusPoints,
          currency: 'p-point',
          transactionType: 'Issuance',
          section: 'admin',
          details: `好友【${newUserData.username || '新會員'}】使用您的推薦碼【${cleanCode}】註冊：獲得 ${referralSettings.referrerBonusPoints} 紅利 P+`,
          transactionDate: FieldValue.serverTimestamp(),
        });
      }

      // 寫入推薦紀錄
      tx.set(db.collection('referralLogs').doc(), {
        code: cleanCode,
        referrerId: referrerUserId || 'OFFICIAL',
        referrerName: referrerDisplayName,
        newUserId,
        newUserName: newUserData.username || '新會員',
        newUserRealName: realName,
        newUserPhone: normalizedPhone,
        newUserEmail: newUserData.email || '',
        referrerBonusGiven: referrerUserId ? referralSettings.referrerBonusPoints : 0,
        refereeBonusGiven: referralSettings.refereeBonusPoints,
        refereeTicketsGiven: referralSettings.freeDrawTickets,
        createdAt: FieldValue.serverTimestamp(),
      });

      if (isOfficialCode) {
        tx.update(db.collection('referralCodes').doc(cleanCode), {
          usageCount: FieldValue.increment(1),
          lastUsedAt: FieldValue.serverTimestamp(),
        });
      }

      return { ok: true as const };
    });

    if (!txOutcome.ok) {
      return NextResponse.json(
        { success: false, ...(txOutcome.code ? { code: txOutcome.code } : {}), error: txOutcome.error },
        { status: txOutcome.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: '推薦碼綁定成功！',
      rewards: {
        bonusPoints: referralSettings.refereeBonusPoints,
        diamonds: referralSettings.refereeDiamonds,
        freeDrawTickets: referralSettings.freeDrawTickets,
        referrerName: referrerDisplayName,
      },
    });
  } catch (error: any) {
    console.error('Apply referral error:', error);
    return NextResponse.json({ success: false, error: error.message || '處理失敗' }, { status: 500 });
  }
}
