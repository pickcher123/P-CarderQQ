import { Firestore, doc, getDoc, updateDoc, increment, arrayUnion, serverTimestamp, setDoc, runTransaction, collection, query, where, getDocs, limit } from 'firebase/firestore';

export interface PromoCodeDefinition {
  code: string;
  label: string;
  freePlays: number;
  description: string;
  source: string;
}

export const VALID_PROMO_CODES: Record<string, PromoCodeDefinition> = {
  'OPEN2024': {
    code: 'OPEN2024',
    label: '🎉 盛大開幕・全場免費首抽',
    freePlays: 1,
    description: '慶祝盛大開幕，全場卡池免費抽卡券 1 張！',
    source: 'LINE 官方社群'
  },
  'LUCKYCARD': {
    code: 'LUCKYCARD',
    label: '🎁 轉盤專屬・加碼券',
    freePlays: 2,
    description: '轉盤大福袋專屬 2 次抽獎加碼！',
    source: 'DISCORD'
  },
  'KUJI888': {
    code: 'KUJI888',
    label: '✨ 一番賞・首抽特典',
    freePlays: 1,
    description: '活動套一番賞免費撕籤 1 次！',
    source: 'IG'
  },
  'VIPGIFT': {
    code: 'VIPGIFT',
    label: '👑 貴賓專屬・九宮格券',
    freePlays: 3,
    description: '九宮格盲盒 3 次破箱連線挑戰！',
    source: 'VIP'
  },
  'FREE888': {
    code: 'FREE888',
    label: '🎁 幸運發發・限時福利券',
    freePlays: 1,
    description: '官方福利加碼，贈送免費抽卡券 1 張！',
    source: '官網活動'
  },
  'CARD2025': {
    code: 'CARD2025',
    label: '🃏 卡迷狂歡・專屬抽卡券',
    freePlays: 1,
    description: '卡迷狂歡季限定！免費抽卡券 1 張！',
    source: 'Discord 卡友群'
  },
  'WELCOME': {
    code: 'WELCOME',
    label: '⭐ 新手專屬・見面禮加碼券',
    freePlays: 1,
    description: '新手專屬福利加碼，免費體驗頂級卡池！',
    source: '新手大禮包'
  },
  'VIP666': {
    code: 'VIP666',
    label: '👑 尊爵貴賓・特邀抽卡券',
    freePlays: 2,
    description: '特邀貴賓尊榮好禮，免費抽卡券 2 張！',
    source: 'VIP 特邀'
  }
};

/**
 * 產生用戶的邀請碼 (CARD-前6碼)
 */
export function generateUserInviteCode(userId: string): string {
  if (!userId) return 'CARD-VIP';
  const cleanId = userId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  return `CARD-${cleanId.slice(0, 6).padEnd(6, '8')}`;
}

/**
 * 領取新玩家免費首抽禮包 (1次)
 */
export async function claimWelcomeFreeDraw(firestore: Firestore, userId: string, userName?: string) {
  if (!firestore || !userId) throw new Error('使用者未登入');

  const userRef = doc(firestore, 'users', userId);
  
  return await runTransaction(firestore, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    
    if (!userSnap.exists()) {
      const inviteCode = generateUserInviteCode(userId);
      transaction.set(userRef, {
        id: userId,
        username: userName || '新玩家',
        points: 1000,
        bonusPoints: 0,
        role: 'user',
        userLevel: '普通會員',
        freeDrawTickets: 1,
        claimedWelcomeTicket: true,
        inviteCode,
        inviteCount: 0,
        claimedPromoCodes: ['WELCOME_PACK'],
        createdAt: serverTimestamp()
      });
      return { success: true, ticketsAdded: 1, message: '恭喜領取新玩家首抽禮包！獲得 1 張免費抽卡券！' };
    }

    const data = userSnap.data();
    if (data.claimedWelcomeTicket) {
      throw new Error('您已經領取過新玩家首抽禮包囉！可以透過輸入兌換碼或邀請好友獲得更多抽卡券！');
    }

    const currentTickets = data.freeDrawTickets || 0;
    const inviteCode = data.inviteCode || generateUserInviteCode(userId);

    transaction.update(userRef, {
      freeDrawTickets: currentTickets + 1,
      claimedWelcomeTicket: true,
      inviteCode,
      claimedPromoCodes: arrayUnion('WELCOME_PACK')
    });

    return { success: true, ticketsAdded: 1, message: '恭喜獲得新玩家專屬免費抽卡券 1 張！' };
  });
}

/**
 * 輸入兌換碼領取抽卡券
 */
export async function redeemPromoDrawCode(firestore: Firestore, userId: string, rawCode: string) {
  if (!firestore || !userId) throw new Error('使用者未登入');
  const code = rawCode.trim().toUpperCase();
  if (!code) throw new Error('請輸入兌換碼');

  const promo = VALID_PROMO_CODES[code];
  if (!promo) {
    throw new Error('此兌換碼無效或已過期，請確認代碼是否輸入正確。');
  }

  const userRef = doc(firestore, 'users', userId);

  return await runTransaction(firestore, async (transaction) => {
    const userSnap = await transaction.get(userRef);
    if (!userSnap.exists()) {
      const inviteCode = generateUserInviteCode(userId);
      transaction.set(userRef, {
        id: userId,
        username: '玩家',
        points: 1000,
        bonusPoints: 0,
        role: 'user',
        userLevel: '普通會員',
        freeDrawTickets: promo.freePlays,
        inviteCode,
        inviteCount: 0,
        claimedPromoCodes: [code],
        createdAt: serverTimestamp()
      });
      return { 
        success: true, 
        ticketsAdded: promo.freePlays, 
        label: promo.label, 
        message: `兌換成功！已獲得 ${promo.freePlays} 張免費抽卡券！` 
      };
    }

    const data = userSnap.data();
    const claimedCodes = data.claimedPromoCodes || [];

    if (claimedCodes.includes(code)) {
      throw new Error(`您已經兌換過「${code}」囉！每組兌換碼限使用乙次。`);
    }

    const currentTickets = data.freeDrawTickets || 0;

    transaction.update(userRef, {
      freeDrawTickets: currentTickets + promo.freePlays,
      claimedPromoCodes: arrayUnion(code)
    });

    return { 
      success: true, 
      ticketsAdded: promo.freePlays, 
      label: promo.label, 
      message: `兌換成功！已獲得 ${promo.freePlays} 張免費抽卡券！` 
    };
  });
}

/**
 * 輸入好友邀請碼 (雙方各得 1 張免費抽卡券)
 */
export async function redeemFriendInviteCode(firestore: Firestore, currentUserId: string, targetInviteCode: string) {
  if (!firestore || !currentUserId) throw new Error('使用者未登入');
  const code = targetInviteCode.trim().toUpperCase();
  if (!code) throw new Error('請輸入好友邀請碼');

  const myInviteCode = generateUserInviteCode(currentUserId);
  if (code === myInviteCode) {
    throw new Error('不能填寫自己的邀請碼喔！快分享給好友一起領取吧！');
  }

  const currentUserRef = doc(firestore, 'users', currentUserId);

  return await runTransaction(firestore, async (transaction) => {
    const currentUserSnap = await transaction.get(currentUserRef);
    if (!currentUserSnap.exists()) {
      throw new Error('用戶資料不存在，請稍候重試');
    }

    const currentUserData = currentUserSnap.data();
    if (currentUserData.invitedBy) {
      throw new Error('您已經綁定過好友邀請碼囉！您可以將自己的邀請碼分享給其他人賺取抽卡券！');
    }

    // 尋找持有該邀請碼的好友
    const usersCol = collection(firestore, 'users');
    const q = query(usersCol, where('inviteCode', '==', code), limit(1));
    const inviterQuerySnap = await getDocs(q);

    let inviterDocRef: any = null;
    let inviterName = '好友';

    if (!inviterQuerySnap.empty) {
      const inviterDoc = inviterQuerySnap.docs[0];
      if (inviterDoc.id === currentUserId) {
        throw new Error('不能填寫自己的邀請碼喔！');
      }
      inviterDocRef = doc(firestore, 'users', inviterDoc.id);
      inviterName = inviterDoc.data()?.username || '好友';
    }

    // 給當前用戶 +1 票券
    const myCurrentTickets = currentUserData.freeDrawTickets || 0;
    transaction.update(currentUserRef, {
      freeDrawTickets: myCurrentTickets + 1,
      invitedBy: code,
      inviteCode: currentUserData.inviteCode || myInviteCode
    });

    // 如果找到邀請人，也給邀請人 +1 票券
    if (inviterDocRef) {
      transaction.update(inviterDocRef, {
        freeDrawTickets: increment(1),
        inviteCount: increment(1)
      });
    }

    return {
      success: true,
      ticketsAdded: 1,
      inviterName,
      message: `成功綁定 ${inviterName} 的邀請碼！雙方各獲得 1 張免費抽卡券！`
    };
  });
}

/**
 * 點擊加入社群獲得免費首抽券 1 張 (限領一次)
 */
export async function claimCommunityFreeDraw(firestore: Firestore, userId: string, communitySource: string = '官方社群') {
  if (!firestore || !userId) throw new Error('使用者未登入');

  const userRef = doc(firestore, 'users', userId);

  return await runTransaction(firestore, async (transaction) => {
    const userSnap = await transaction.get(userRef);

    if (!userSnap.exists()) {
      const inviteCode = generateUserInviteCode(userId);
      transaction.set(userRef, {
        id: userId,
        points: 1000,
        bonusPoints: 0,
        role: 'user',
        userLevel: '普通會員',
        freeDrawTickets: 1,
        claimedCommunityTicket: true,
        inviteCode,
        inviteCount: 0,
        claimedPromoCodes: ['COMMUNITY_JOIN'],
        createdAt: serverTimestamp()
      });
      return { 
        success: true, 
        ticketsAdded: 1, 
        alreadyClaimed: false,
        message: '🎉 感謝加入社群！已成功發送免費首抽券 1 張！' 
      };
    }

    const data = userSnap.data();
    if (data.claimedCommunityTicket) {
      return { 
        success: false, 
        alreadyClaimed: true, 
        message: '您已經領取過社群專屬免費首抽券囉！歡迎在社群與卡友熱情交流！' 
      };
    }

    const currentTickets = data.freeDrawTickets || 0;
    const inviteCode = data.inviteCode || generateUserInviteCode(userId);

    transaction.update(userRef, {
      freeDrawTickets: currentTickets + 1,
      claimedCommunityTicket: true,
      inviteCode,
      claimedPromoCodes: arrayUnion('COMMUNITY_JOIN')
    });

    return { 
      success: true, 
      ticketsAdded: 1, 
      alreadyClaimed: false,
      message: `🎉 感謝加入${communitySource}！已為您發送免費首抽券 1 張！` 
    };
  });
}

/**
 * 自動同步瀏覽器 localStorage 內的領券紀錄至 Firestore
 * 用於處理未登入時領券、或先前背景同步失敗的客戶，讓客戶一進卡池或登入後免費券 100% 入帳可用
 */
export async function syncLocalPromoClaimsToFirestore(firestore: Firestore, userId: string): Promise<number> {
  if (!firestore || !userId || typeof window === 'undefined') return 0;

  try {
    const raw1 = localStorage.getItem('card_exhibition_promo_claims');
    const raw2 = localStorage.getItem('promo_claim_history');
    const list1: any[] = raw1 ? JSON.parse(raw1) : [];
    const list2: any[] = raw2 ? JSON.parse(raw2) : [];
    const combined = [...(Array.isArray(list1) ? list1 : []), ...(Array.isArray(list2) ? list2 : [])];
    if (combined.length === 0) return 0;

    const activeItems = combined.filter(item => item && (item.status === 'ACTIVE' || !item.status) && item.code);
    if (activeItems.length === 0) return 0;

    const userRef = doc(firestore, 'users', userId);
    
    return await runTransaction(firestore, async (transaction) => {
      const userSnap = await transaction.get(userRef);
      let data: any = {};
      let isNewUser = false;

      if (!userSnap.exists()) {
        isNewUser = true;
        data = {
          id: userId,
          username: '新玩家',
          points: 1000,
          bonusPoints: 0,
          role: 'user',
          userLevel: '普通會員',
          freeDrawTickets: 0,
          claimedPromoCodes: [],
          inviteCode: generateUserInviteCode(userId),
          inviteCount: 0,
          createdAt: serverTimestamp()
        };
      } else {
        data = userSnap.data() || {};
      }

      const existingCodes: string[] = data.claimedPromoCodes || [];
      let totalTicketsToAdd = 0;
      const codesToAdd: string[] = [];
      let setCommunityClaimed = false;

      for (const item of activeItems) {
        const codeUpper = item.code.trim().toUpperCase();
        if (codeUpper === 'COMMUNITY_JOIN') {
          if (!data.claimedCommunityTicket && !existingCodes.includes('COMMUNITY_JOIN')) {
            totalTicketsToAdd += 1;
            codesToAdd.push('COMMUNITY_JOIN');
            setCommunityClaimed = true;
          }
        } else if (VALID_PROMO_CODES[codeUpper]) {
          if (!existingCodes.includes(codeUpper)) {
            totalTicketsToAdd += (VALID_PROMO_CODES[codeUpper].freePlays || 1);
            codesToAdd.push(codeUpper);
          }
        } else if (item.freePlays && item.freePlays > 0 && !existingCodes.includes(codeUpper)) {
          totalTicketsToAdd += item.freePlays;
          codesToAdd.push(codeUpper);
        }
      }

      if (totalTicketsToAdd <= 0 && !isNewUser) {
        return 0;
      }

      const currentTickets = data.freeDrawTickets || 0;
      const newTicketCount = currentTickets + totalTicketsToAdd;

      const updates: any = {
        freeDrawTickets: newTicketCount,
        claimedPromoCodes: Array.from(new Set([...existingCodes, ...codesToAdd]))
      };
      if (setCommunityClaimed) {
        updates.claimedCommunityTicket = true;
      }

      if (isNewUser) {
        transaction.set(userRef, {
          ...data,
          ...updates
        });
      } else {
        transaction.update(userRef, updates);
      }

      return totalTicketsToAdd;
    });
  } catch (err) {
    console.warn('syncLocalPromoClaimsToFirestore warning:', err);
    return 0;
  }
}

/**
 * 從本地 localStorage 計算所有已領取的免費券總張數
 */
export function getLocalAvailableTicketsCount(): number {
  if (typeof window === 'undefined') return 0;
  try {
    let count = 0;
    // 檢查卡展領取紀錄
    const claimsRaw = localStorage.getItem('card_exhibition_promo_claims');
    if (claimsRaw) {
      const claims = JSON.parse(claimsRaw);
      if (Array.isArray(claims)) {
        claims.forEach((c: any) => {
          count += (c.freePlays || 1);
        });
      }
    }
    // 檢查歷史紀錄
    const historyRaw = localStorage.getItem('promo_claim_history');
    if (historyRaw) {
      const history = JSON.parse(historyRaw);
      if (Array.isArray(history)) {
        history.forEach((h: any) => {
          // 如果是社群或兌換碼
          if (h.code && !claimsRaw?.includes(h.code)) {
            count += (h.freePlays || 1);
          }
        });
      }
    }
    return count;
  } catch (e) {
    return 0;
  }
}

/**
 * 取得用戶真正的有效免費抽卡券張數（融合 Firestore 與 LocalStorage 紀錄）
 */
export function getEffectiveTicketCount(userProfile?: any): number {
  const remoteTickets = typeof userProfile?.freeDrawTickets === 'number' ? userProfile.freeDrawTickets : 0;
  // 若 remoteTickets 大於 0，直接以 Firestore 為準
  if (remoteTickets > 0) return remoteTickets;
  // 若 remoteTickets 為 0，檢查本地是否有已領取但尚未同步的券
  const localTickets = getLocalAvailableTicketsCount();
  return Math.max(remoteTickets, localTickets);
}


