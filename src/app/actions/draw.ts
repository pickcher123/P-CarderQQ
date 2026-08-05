'use server'

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';

export async function performDrawAction(userId: string, poolId: string, count: number) {
  try {
    const result = await adminDb.runTransaction(async (transaction) => {
      const userRef = adminDb.collection('users').doc(userId);
      const poolRef = adminDb.collection('cardPools').doc(poolId);

      const [userSnap, poolSnap] = await Promise.all([
        transaction.get(userRef),
        transaction.get(poolRef)
      ]);

      if (!userSnap.exists) {
        // 自動初始化使用者
        transaction.set(userRef, {
          id: userId,
          points: 1000,
          bonusPoints: 0,
          role: 'user',
          userLevel: '普通會員',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        });
        throw new Error('帳號初始化中，請稍候再試一次。');
      }

      if (!poolSnap.exists) throw new Error('卡池不存在');

      const userData = userSnap.data()!;
      const poolData = poolSnap.data()!;

      // 計算金額
      const cost = count === 3 && poolData.price3Draws ? poolData.price3Draws : (poolData.price || 0) * count;
      const currencyField = poolData.currency === 'p-point' ? 'bonusPoints' : 'points';
      const balance = userData[currencyField] || 0;

      if (balance < cost) throw new Error('點數不足');

      // 更新統計
      const todayStr = new Date().toISOString().split('T')[0];
      const poolStatsRef = adminDb.collection('users').doc(userId).collection('poolStats').doc(poolId);
      const poolStatsSnap = await transaction.get(poolStatsRef);
      const poolStatsData = poolStatsSnap.exists ? poolStatsSnap.data() : { count: 0, lastDrawDate: '' };
      const newCount = (poolStatsData.lastDrawDate === todayStr ? (poolStatsData.count || 0) : 0) + count;
      transaction.set(poolStatsRef, {
        count: newCount,
        lastDrawDate: todayStr
      }, { merge: true });

      // 抽卡邏輯
      const { drawn, updatedCards, updatedPointPrizes } = drawFromPool(poolData, count);

      // 寫入抽卡日誌
      const logRef = adminDb.collection('drawnCardLogs').doc();
      transaction.set(logRef, {
        userId,
        poolId,
        agentId: poolData.agentId || null,
        drawnAt: admin.firestore.FieldValue.serverTimestamp(),
        cost,
        count
      });

      // 更新使用者與卡池
      transaction.update(userRef, {
        [currencyField]: admin.firestore.FieldValue.increment(-cost)
      });
      const poolUpdates: any = {
        remainingPacks: admin.firestore.FieldValue.increment(-drawn.length),
        cards: updatedCards
      };
      if (updatedPointPrizes && updatedPointPrizes.length > 0) {
        poolUpdates.pointPrizes = updatedPointPrizes;
      }
      transaction.update(poolRef, poolUpdates);

      return { drawn, userData: userSnap.data()! };
    });

    // 推送中獎通知
    if (result.drawn.some(card => card.rarity === 'rare' || card.rarity === 'super-rare')) {
      const { pushLineMessage } = await import('@/lib/line');
      if (result.userData.lineUserId) {
        await pushLineMessage(result.userData.lineUserId, `恭喜抽中大獎！\n獎項：${result.drawn.filter(c => c.rarity === 'rare' || c.rarity === 'super-rare').map(c => c.name).join(', ')}`);
      }
    }

    return { success: true, data: result.drawn };
  } catch (error: any) {
    console.error('Server Action Error:', error);
    return { success: false, error: error.message };
  }
}
