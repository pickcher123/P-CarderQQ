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
      throw new Error('用戶資料不存在，請重新整理頁面');
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
