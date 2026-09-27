import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { newUserId, referralCode } = body;

    if (!newUserId || !referralCode) {
      return NextResponse.json({ success: false, error: '缺少會員 ID 或推薦碼' }, { status: 400 });
    }

    const cleanCode = String(referralCode).trim().toUpperCase();
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '資料庫尚未就緒' }, { status: 500 });
    }

    // 1. 取得新註冊會員資料
    const newUserRef = db.collection('users').doc(newUserId);
    const newUserSnap = await newUserRef.get();
    if (!newUserSnap.exists) {
      return NextResponse.json({ success: false, error: '找不到該會員' }, { status: 404 });
    }

    const newUserData = newUserSnap.data()!;
    // 若該會員已經綁定過推薦人，不可重複套用
    if (newUserData.invitedBy) {
      return NextResponse.json({ success: false, error: '該帳號已綁定過推薦碼' }, { status: 400 });
    }

    // 2. 讀取系統推薦碼配置 (systemConfig/referral 或 systemConfig/main)
    const systemConfigSnap = await db.collection('systemConfig').doc('referral').get();
    let referralSettings = {
      isEnabled: true,
      referrerBonusPoints: 100, // 推薦人獲得紅利 P+
      refereeBonusPoints: 50,   // 新人獲得紅利 P+
      refereeDiamonds: 0,       // 新人獲得鑽石
      freeDrawTickets: 1,       // 新人額外免費抽卡券
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

    // 3. 搜尋持有此推薦碼之推薦人
    // 先查專屬自訂推薦碼 / inviteCode，或使用者 ID 前 8 碼 / UID
    let referrerSnap = await db.collection('users').where('inviteCode', '==', cleanCode).limit(1).get();
    
    // 若無符合，檢查是否為官方特定通用推薦活動代碼 (例如 VIP888、FRIEND2025 等)
    let isOfficialCode = false;
    let officialCampaignName = '';

    if (referrerSnap.empty) {
      // 檢查自訂推薦碼集合 referralCodes
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
        // 亦可相容比對使用 UID 精確匹配
        const directUser = await db.collection('users').doc(cleanCode.toLowerCase()).get();
        if (directUser.exists) {
          referrerSnap = { empty: false, docs: [directUser] } as any;
        }
      }
    }

    let referrerUserDoc: any = null;
    if (!referrerSnap.empty) {
      referrerUserDoc = referrerSnap.docs[0];
      // 不可推薦自己
      if (referrerUserDoc.id === newUserId) {
        return NextResponse.json({ success: false, error: '不能填寫自己的推薦碼' }, { status: 400 });
      }
    } else if (!isOfficialCode) {
      return NextResponse.json({ success: false, error: '無效或不存在的推薦碼' }, { status: 404 });
    }

    const batch = db.batch();

    // 4. 更新新人 (被推薦人)
    const newUserUpdates: Record<string, any> = {
      invitedBy: cleanCode,
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

    batch.update(newUserRef, newUserUpdates);

    // 新人交易紀錄
    const newTxRef = db.collection('transactions').doc();
    batch.set(newTxRef, {
      userId: newUserId,
      amount: referralSettings.refereeBonusPoints,
      currency: 'p-point',
      transactionType: 'Issuance',
      section: 'admin',
      details: `使用推薦碼【${cleanCode}】註冊獎勵：獲得 ${referralSettings.refereeBonusPoints} 紅利 P+` + 
        (referralSettings.freeDrawTickets > 0 ? ` 與 ${referralSettings.freeDrawTickets} 張免費抽卡券` : ''),
      transactionDate: FieldValue.serverTimestamp(),
    });

    // 5. 若有具體推薦人 (一般會員)，發放推薦人回饋
    if (referrerUserDoc) {
      const referrerRef = referrerUserDoc.ref;
      const referrerData = referrerUserDoc.data();

      batch.update(referrerRef, {
        inviteCount: FieldValue.increment(1),
        bonusPoints: FieldValue.increment(referralSettings.referrerBonusPoints),
      });

      // 推薦人交易紀錄
      const refTxRef = db.collection('transactions').doc();
      batch.set(refTxRef, {
        userId: referrerUserDoc.id,
        amount: referralSettings.referrerBonusPoints,
        currency: 'p-point',
        transactionType: 'Issuance',
        section: 'admin',
        details: `好友【${newUserData.username || '新會員'}】使用您的推薦碼【${cleanCode}】註冊：獲得 ${referralSettings.referrerBonusPoints} 紅利 P+`,
        transactionDate: FieldValue.serverTimestamp(),
      });
    }

    // 6. 記錄全站推薦紀錄集合 referralLogs
    const logRef = db.collection('referralLogs').doc();
    batch.set(logRef, {
      code: cleanCode,
      referrerId: referrerUserDoc ? referrerUserDoc.id : 'OFFICIAL',
      referrerName: referrerUserDoc ? (referrerUserDoc.data().username || '推薦好友') : (officialCampaignName || '官方專案'),
      newUserId: newUserId,
      newUserName: newUserData.username || '新會員',
      newUserEmail: newUserData.email || '',
      referrerBonusGiven: referrerUserDoc ? referralSettings.referrerBonusPoints : 0,
      refereeBonusGiven: referralSettings.refereeBonusPoints,
      refereeTicketsGiven: referralSettings.freeDrawTickets,
      createdAt: FieldValue.serverTimestamp(),
    });

    // 若為官方代碼，更新使用次數
    if (isOfficialCode) {
      const customCodeRef = db.collection('referralCodes').doc(cleanCode);
      batch.update(customCodeRef, {
        usageCount: FieldValue.increment(1),
        lastUsedAt: FieldValue.serverTimestamp(),
      });
    }

    await batch.commit();

    return NextResponse.json({
      success: true,
      message: '推薦碼綁定成功！',
      rewards: {
        bonusPoints: referralSettings.refereeBonusPoints,
        diamonds: referralSettings.refereeDiamonds,
        freeDrawTickets: referralSettings.freeDrawTickets,
        referrerName: referrerUserDoc ? (referrerUserDoc.data().username || '好友') : (officialCampaignName || '官方專案'),
      }
    });
  } catch (error: any) {
    console.error('Apply referral error:', error);
    return NextResponse.json({ success: false, error: error.message || '處理失敗' }, { status: 500 });
  }
}
