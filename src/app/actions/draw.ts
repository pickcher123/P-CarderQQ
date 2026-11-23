'use server'

import { adminDb, getAdminAuth } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

/**
 * 舊版未驗證抽卡 Server Action 已停用，所有正式抽卡統一走已驗證 Firebase ID Token 之 /api/draw/execute
 */
export async function performDrawAction() {
  return {
    success: false,
    error: '此抽卡端點已停用，請透過正式抽卡流程進行操作。',
  };
}

/**
 * SP 賞（黑盒）一鍵點數回收：強制驗證 Firebase ID Token 後才允許原子鎖定卡片並入帳
 */
export async function redeemSpBuybackAction(
  idToken: string,
  userCardId: string,
  poolId?: string
): Promise<{ success: boolean; creditedPoints?: number; error?: string }> {
  try {
    if (!idToken || !userCardId) {
      throw new Error('缺少必要驗證憑證，無法執行點數回收。');
    }

    const adminAuth = getAdminAuth();
    if (!adminAuth) {
      throw new Error('後端驗證服務尚未就緒，請稍後再試。');
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const userId = decoded.uid;

    const result = await adminDb.runTransaction(async (transaction: any) => {
      const userRef = adminDb.collection('users').doc(userId);
      const userCardRef = userRef.collection('userCards').doc(userCardId);

      const [userSnap, userCardSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(userCardRef),
      ]);

      if (!userSnap.exists) throw new Error('找不到會員帳號');
      if (!userCardSnap.exists) throw new Error('找不到該張 SP 卡片紀錄');

      const cardData = userCardSnap.data()!;
      if (cardData.isRecycled || cardData.redeemedAsPoints) {
        throw new Error('此張 SP 賞已完成點數回收，請勿重複操作。');
      }

      const buybackPoints = Number(cardData.buybackPoints || Math.round(Number(cardData.sellPrice || 0) * 0.8));
      if (!Number.isFinite(buybackPoints) || buybackPoints <= 0) {
        throw new Error('無效的回收點數設定，請聯繫客服。');
      }

      transaction.update(userCardRef, {
        isRecycled: true,
        redeemedAsPoints: true,
        status: 'recycled',
        recycledAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      transaction.update(userRef, {
        points: admin.firestore.FieldValue.increment(buybackPoints),
      });

      return { buybackPoints };
    });

    if (poolId) {
      const logsSnap = await adminDb
        .collection('cardPools')
        .doc(poolId)
        .collection('drawLogs')
        .where('userCardId', '==', userCardId)
        .limit(1)
        .get();
      if (!logsSnap.empty) {
        await logsSnap.docs[0].ref.update({ redeemedAsPoints: true });
      }
    }

    return { success: true, creditedPoints: result.buybackPoints };
  } catch (error: any) {
    console.error('SP Buyback Error:', error);
    return { success: false, error: error.message || 'SP 點數回收失敗' };
  }
}
