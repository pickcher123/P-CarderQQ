'use client';

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
  type Firestore,
} from 'firebase/firestore';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function shouldFallbackToClient(status: number, errorMsg?: string): boolean {
  if (status >= 500) return true;
  if (errorMsg && (errorMsg.includes('資料庫尚未就緒') || errorMsg.includes('Admin'))) return true;
  return false;
}

function validateReferralProfile(userData: any): { ok: boolean; realName: string; normalizedPhone: string } {
  const realName = String(userData?.realName || '').trim();
  const normalizedPhone = String(userData?.phone || '').replace(/\D/g, '');
  return {
    ok: realName.length >= 2 && normalizedPhone.length >= 8,
    realName,
    normalizedPhone,
  };
}

export async function generateReferralCodeClient(
  firestore: Firestore | null,
  userId: string,
  customCode?: string
): Promise<{ success: boolean; inviteCode?: string; error?: string }> {
  // 1. 優先呼叫伺服器 API（攜帶 Firebase ID Token）
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // ignore if auth not ready
    }
    const res = await fetch('/api/referral/generate', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        userId,
        customCode: customCode || undefined,
      }),
    });
    const data = await res.json();
    if (data.success || !shouldFallbackToClient(res.status, data.error)) {
      return data;
    }
  } catch {
    // 伺服器 API 不可用時改走前端 Firestore 保底流程
  }

  if (!firestore) {
    return { success: false, error: '資料庫連線初始化中，請稍候再試' };
  }

  try {
    const userRef = doc(firestore, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.exists() ? userSnap.data() : {};

    const profileCheck = validateReferralProfile(userData);
    if (!profileCheck.ok) {
      return {
        success: false,
        error: '請先至「會員中心」填寫真實姓名與聯絡電話，完成基本資料後即可啟用專屬推薦碼！',
      };
    }

    if (userData?.inviteCode && !customCode) {
      return { success: true, inviteCode: userData.inviteCode };
    }

    let codeToUse = '';
    if (customCode) {
      codeToUse = customCode.trim().toUpperCase();
      if (!/^[A-Z0-9]{4,12}$/.test(codeToUse)) {
        return { success: false, error: '推薦碼格式限定 4-12 碼英數字' };
      }

      const dupSnap = await getDocs(
        query(collection(firestore, 'users'), where('inviteCode', '==', codeToUse), limit(2))
      );
      if (!dupSnap.empty && dupSnap.docs.some((d) => d.id !== userId)) {
        return { success: false, error: '此推薦碼已被其他人使用' };
      }

      const officialSnap = await getDoc(doc(firestore, 'referralCodes', codeToUse));
      if (officialSnap.exists()) {
        return { success: false, error: '此推薦碼為官方保留代碼' };
      }
    } else {
      for (let attempt = 0; attempt < 8; attempt++) {
        let candidate = '';
        for (let i = 0; i < 6; i++) {
          candidate += CHARS.charAt(Math.floor(Math.random() * CHARS.length));
        }
        const dupSnap = await getDocs(
          query(collection(firestore, 'users'), where('inviteCode', '==', candidate), limit(1))
        );
        const officialSnap = await getDoc(doc(firestore, 'referralCodes', candidate));
        if (dupSnap.empty && !officialSnap.exists()) {
          codeToUse = candidate;
          break;
        }
      }
      if (!codeToUse) {
        codeToUse = 'P' + userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
      }
    }

    if (userSnap.exists()) {
      await updateDoc(userRef, { inviteCode: codeToUse });
    } else {
      await setDoc(userRef, { inviteCode: codeToUse }, { merge: true });
    }

    return { success: true, inviteCode: codeToUse };
  } catch (err: any) {
    return { success: false, error: err?.message || '推薦碼啟用失敗，請稍候再試' };
  }
}

export async function checkReferralCodeClient(
  firestore: Firestore | null,
  code: string
): Promise<{ success: boolean; valid: boolean; referrerName?: string; code?: string; error?: string }> {
  const cleanCode = code.trim().toUpperCase();
  if (!cleanCode) return { success: false, valid: false, error: '缺少代碼' };

  try {
    const res = await fetch(`/api/referral/check?code=${encodeURIComponent(cleanCode)}`);
    const data = await res.json();
    if (!shouldFallbackToClient(res.status, data.error)) {
      return data;
    }
  } catch {
    // fallback
  }

  if (!firestore) {
    return { success: false, valid: false, error: '資料庫連線中' };
  }

  try {
    const userSnap = await getDocs(
      query(collection(firestore, 'users'), where('inviteCode', '==', cleanCode), limit(1))
    );
    if (!userSnap.empty) {
      const u = userSnap.docs[0].data();
      return {
        success: true,
        valid: true,
        referrerName: u.username || 'P+ 藏友',
        code: cleanCode,
      };
    }

    const customDoc = await getDoc(doc(firestore, 'referralCodes', cleanCode));
    if (customDoc.exists() && customDoc.data()?.isActive !== false) {
      const data = customDoc.data();
      return {
        success: true,
        valid: true,
        referrerName: data?.campaignName || '官方推廣專案',
        code: cleanCode,
      };
    }

    return { success: true, valid: false, error: '此推薦碼無效或已過期' };
  } catch (err: any) {
    return { success: false, valid: false, error: err?.message || '驗證失敗' };
  }
}

export async function applyReferralCodeClient(
  firestore: Firestore | null,
  newUserId: string,
  referralCode: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
  rewards?: {
    referrerName: string;
    bonusPoints: number;
    diamonds: number;
    freeDrawTickets: number;
  };
}> {
  const cleanCode = referralCode.trim().toUpperCase();
  if (!newUserId || !cleanCode) {
    return { success: false, error: '缺少會員 ID 或推薦碼' };
  }

  // 1. 優先呼叫伺服器 API（攜帶 Firebase ID Token 驗證身分）
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    try {
      const { getAuth } = await import('firebase/auth');
      const token = await getAuth().currentUser?.getIdToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
    } catch {
      // ignore if auth not ready
    }
    const res = await fetch('/api/referral/apply', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        newUserId,
        userId: newUserId,
        referralCode: cleanCode,
      }),
    });
    const data = await res.json();
    if (data.success || !shouldFallbackToClient(res.status, data.error)) {
      return data;
    }
  } catch {
    // fallback
  }

  if (!firestore) {
    return { success: false, error: '資料庫連線初始化中，請稍候再試' };
  }

  try {
    const newUserRef = doc(firestore, 'users', newUserId);
    const newUserSnap = await getDoc(newUserRef);
    if (!newUserSnap.exists()) {
      return { success: false, error: '找不到該會員資料' };
    }

    const newUserData = newUserSnap.data();
    if (newUserData.invitedBy || newUserData.referredBy) {
      return { success: false, error: '該帳號已綁定過推薦碼' };
    }

    const profileCheck = validateReferralProfile(newUserData);
    if (!profileCheck.ok) {
      return {
        success: false,
        error: '請先至「會員中心」填寫真實姓名與聯絡電話，完成基本資料後才能使用推薦碼領取獎勵！',
      };
    }

    const dupPhoneSnap = await getDocs(
      query(collection(firestore, 'referralLogs'), where('newUserPhone', '==', profileCheck.normalizedPhone), limit(1))
    );
    if (!dupPhoneSnap.empty) {
      return {
        success: false,
        error: '此聯絡電話已領取過推薦碼獎勵，每組手機號碼僅限領取乙次。',
      };
    }

    // 讀取推薦碼獎勵設定
    let settings = {
      isEnabled: true,
      referrerBonusPoints: 100,
      refereeBonusPoints: 50,
      refereeDiamonds: 0,
      freeDrawTickets: 1,
    };

    try {
      const cfgSnap = await getDoc(doc(firestore, 'systemConfig', 'referral'));
      if (cfgSnap.exists()) {
        const d = cfgSnap.data();
        settings = {
          isEnabled: d.isEnabled !== false,
          referrerBonusPoints: typeof d.referrerBonusPoints === 'number' ? d.referrerBonusPoints : 100,
          refereeBonusPoints: typeof d.refereeBonusPoints === 'number' ? d.refereeBonusPoints : 50,
          refereeDiamonds: typeof d.refereeDiamonds === 'number' ? d.refereeDiamonds : 0,
          freeDrawTickets: typeof d.freeDrawTickets === 'number' ? d.freeDrawTickets : 1,
        };
      }
    } catch {
      // 使用預設設定
    }

    if (!settings.isEnabled) {
      return { success: false, error: '推薦碼活動目前已暫停' };
    }

    // 查找推薦人或官方推薦碼
    const refSnap = await getDocs(
      query(collection(firestore, 'users'), where('inviteCode', '==', cleanCode), limit(1))
    );

    let referrerDoc: { id: string; data: any } | null = null;
    let isOfficialCode = false;
    let campaignName = cleanCode;

    if (!refSnap.empty) {
      const first = refSnap.docs[0];
      if (first.id === newUserId) {
        return { success: false, error: '不能填寫自己的推薦碼' };
      }
      referrerDoc = { id: first.id, data: first.data() };
    } else {
      const officialSnap = await getDoc(doc(firestore, 'referralCodes', cleanCode));
      if (officialSnap.exists() && officialSnap.data()?.isActive !== false) {
        isOfficialCode = true;
        const od = officialSnap.data();
        campaignName = od?.campaignName || cleanCode;
        if (typeof od?.referrerBonusPoints === 'number') settings.referrerBonusPoints = od.referrerBonusPoints;
        if (typeof od?.refereeBonusPoints === 'number') settings.refereeBonusPoints = od.refereeBonusPoints;
        if (typeof od?.freeDrawTickets === 'number') settings.freeDrawTickets = od.freeDrawTickets;
      }
    }

    if (!referrerDoc && !isOfficialCode) {
      return { success: false, error: '無效或不存在的推薦碼' };
    }

    const batch = writeBatch(firestore);
    const newUserUpdates: Record<string, any> = {
      invitedBy: cleanCode,
      referredBy: cleanCode,
      invitedAt: serverTimestamp(),
    };
    if (settings.refereeBonusPoints > 0) {
      newUserUpdates.bonusPoints = increment(settings.refereeBonusPoints);
      newUserUpdates.totalBonusEarned = increment(settings.refereeBonusPoints);
    }
    if (settings.refereeDiamonds > 0) {
      newUserUpdates.points = increment(settings.refereeDiamonds);
    }
    if (settings.freeDrawTickets > 0) {
      newUserUpdates.freeDrawTickets = increment(settings.freeDrawTickets);
    }
    batch.update(newUserRef, newUserUpdates);

    const newTxRef = doc(collection(firestore, 'transactions'));
    batch.set(newTxRef, {
      userId: newUserId,
      amount: settings.refereeBonusPoints,
      currency: 'p-point',
      transactionType: 'Issuance',
      section: 'admin',
      details:
        `使用推薦碼【${cleanCode}】迎新獎勵：獲得 ${settings.refereeBonusPoints} 紅利 P+` +
        (settings.freeDrawTickets > 0 ? ` 與 ${settings.freeDrawTickets} 張免費抽卡券` : ''),
      transactionDate: serverTimestamp(),
    });

    const referrerName = referrerDoc?.data?.username || campaignName || '官方活動';

    if (referrerDoc) {
      batch.update(doc(firestore, 'users', referrerDoc.id), {
        inviteCount: increment(1),
        bonusPoints: increment(settings.referrerBonusPoints),
        totalBonusEarned: increment(settings.referrerBonusPoints),
      });

      const refTxRef = doc(collection(firestore, 'transactions'));
      batch.set(refTxRef, {
        userId: referrerDoc.id,
        amount: settings.referrerBonusPoints,
        currency: 'p-point',
        transactionType: 'Issuance',
        section: 'admin',
        details: `成功推薦好友【${newUserData.username || '新會員'}】回饋：+${settings.referrerBonusPoints} 紅利 P+`,
        transactionDate: serverTimestamp(),
      });
    }

    const logRef = doc(collection(firestore, 'referralLogs'));
    batch.set(logRef, {
      code: cleanCode,
      referralCode: cleanCode,
      referrerId: referrerDoc?.id || 'OFFICIAL',
      referrerName,
      newUserId: newUserId,
      refereeId: newUserId,
      newUserName: newUserData.username || '新會員',
      refereeName: newUserData.username || '新會員',
      newUserRealName: profileCheck.realName,
      newUserPhone: profileCheck.normalizedPhone,
      referrerReward: referrerDoc ? settings.referrerBonusPoints : 0,
      refereeReward: settings.refereeBonusPoints,
      freeDrawTickets: settings.freeDrawTickets,
      createdAt: serverTimestamp(),
    });

    await batch.commit();

    return {
      success: true,
      message: `已成功綁定推薦碼【${cleanCode}】，獲得 +${settings.refereeBonusPoints} 紅利 P+` + (settings.freeDrawTickets > 0 ? ` 與 ${settings.freeDrawTickets} 張免費抽卡券！` : '！'),
      rewards: {
        referrerName,
        bonusPoints: settings.refereeBonusPoints,
        diamonds: settings.refereeDiamonds,
        freeDrawTickets: settings.freeDrawTickets,
      },
    };
  } catch (err: any) {
    return { success: false, error: err?.message || '推薦碼綁定失敗，請稍候再試' };
  }
}
