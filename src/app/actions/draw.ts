'use server'

import { adminDb } from '@/lib/firebase-admin';
import * as admin from 'firebase-admin';
import { drawFromPool } from '@/lib/draw-utils';
import { cleanFirestoreData } from '@/lib/utils';

export async function performDrawAction(userId: string, poolId: string, count: number) {
  try {
    const result = await adminDb.runTransaction(async (transaction: any) => {
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

      // 更新統計 (先完成所有讀取，再執行寫入，遵守 Firestore Transaction 規範)
      const todayStr = new Date().toISOString().split('T')[0];
      const poolStatsRef = adminDb.collection('users').doc(userId).collection('poolStats').doc(poolId);
      const poolStatsSnap = await transaction.get(poolStatsRef);
      const poolStatsData = poolStatsSnap.exists ? poolStatsSnap.data() : { count: 0, lastDrawDate: '' };
      const newCount = (poolStatsData.lastDrawDate === todayStr ? (poolStatsData.count || 0) : 0) + count;

      // 讀取卡池中所有關聯的 allCards 資料以帶入完整卡片圖案與名稱
      const cardIds = Array.from(new Set(
        [
          ...(Array.isArray(poolData.cards) ? poolData.cards.map((c: any) => String(c.cardId || '')).filter(Boolean) : []),
          ...(poolData.lastPrizeCardId ? [String(poolData.lastPrizeCardId)] : []),
        ]
      ));
      const cardsMap = new Map<string, any>();
      if (cardIds.length > 0) {
        const cardSnaps = await Promise.all(
          cardIds.map((cid) => transaction.get(adminDb.collection('allCards').doc(cid)))
        );
        cardSnaps.forEach((snap: any) => {
          if (snap.exists) {
            cardsMap.set(snap.id, { id: snap.id, ...snap.data() });
          }
        });
      }

      // 抽卡邏輯
      const { drawn, updatedCards, updatedPointPrizes } = drawFromPool(poolData, count, cardsMap);
      if (drawn.length === 0) throw new Error('卡池目前已無獎項可供抽取');

      const packsConsumed = drawn.length;
      let claimLastPrize = false;
      if (
        poolData.remainingPacks !== undefined &&
        poolData.remainingPacks !== null &&
        poolData.remainingPacks - packsConsumed <= 0 &&
        poolData.lastPrizeCardId &&
        !poolData.lastPrizeClaimed
      ) {
        const lpDetails = cardsMap.get(String(poolData.lastPrizeCardId));
        drawn.push({
          id: String(poolData.lastPrizeCardId),
          name: lpDetails?.name || '最後賞限定大獎',
          imageUrl: lpDetails?.imageUrl || '',
          backImageUrl: lpDetails?.backImageUrl || '',
          imageHint: lpDetails?.name || '最後賞限定大獎',
          category: (lpDetails?.category && lpDetails.category !== '抽賞' && lpDetails.category !== 'all') ? lpDetails.category : '一般',
          rarity: 'legendary',
          sellPrice: lpDetails?.sellPrice || 0,
          type: 'last-prize',
        } as any);
        claimLastPrize = true;
      }

      transaction.set(poolStatsRef, {
        count: newCount,
        lastDrawDate: todayStr
      }, { merge: true });

      // 儲存抽出的卡片至玩家收藏庫 (users/{userId}/userCards)，並將實體大獎標記為已抽出鎖定
      const soldCardIdsToLock = new Set<string>();
      for (const prize of drawn) {
        const newUserCardRef = adminDb.collection('users').doc(userId).collection('userCards').doc();
        const serialNumber = `${Math.floor(Math.random() * 9000) + 1000}`;
        const isPointOrRandom = prize.type === 'points' || Boolean((prize as any).isPoints) || Boolean(prize.name?.includes('隨機球員'));
        const rawId = String(prize.id || '');
        const cardPayload: any = isPointOrRandom
          ? {
              cardId: rawId.startsWith('random-player-') ? rawId : `random-player-${rawId || 'points_50'}`,
              name: prize.name || '隨機球員 普/特 卡',
              userId,
              category: '抽賞',
              rarity: prize.rarity || 'common',
              isFoil: false,
              isPoints: true,
              points: Number((prize as any).points || 50),
              source: 'draw',
              poolId,
              serialNumber,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            }
          : {
              cardId: rawId,
              name: prize.name || '典藏球員卡',
              imageUrl: prize.imageUrl || '',
              backImageUrl: (prize as any).backImageUrl || '',
              sellPrice: Number((prize as any).sellPrice || 0),
              userId,
              category: (prize.category && !['抽賞', 'all', 'normal'].includes(prize.category)) ? prize.category : '一般',
              rarity: prize.rarity || 'common',
              isFoil: prize.rarity === 'legendary' || prize.type === 'last-prize',
              isPoints: false,
              source: 'draw',
              poolId,
              poolName: poolData.name || '',
              serialNumber,
              ...( (prize as any).tierCode ? { tierCode: (prize as any).tierCode } : {} ),
              ...( (prize as any).buybackPoints ? { buybackPoints: (prize as any).buybackPoints } : {} ),
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            };
        transaction.set(newUserCardRef, cleanFirestoreData(cardPayload));
        (prize as any).serialNumber = serialNumber;
        (prize as any).userCardId = newUserCardRef.id;

        if (!isPointOrRandom && rawId && cardsMap.has(rawId)) {
          soldCardIdsToLock.add(rawId);
        }
      }

      // 若為明池盲開＋隱藏 SP 模式，寫入公開開獎紀錄（防作弊證明）
      const totalPacksNum = Number(poolData.totalPacks || 100);
      const prevRemainingNum = Number(poolData.remainingPacks ?? totalPacksNum);
      const rawDisplayName = String(userData.displayName || userData.username || userData.email || userId);
      const maskedUsername = rawDisplayName.length <= 2
        ? `${rawDisplayName[0] || 'u'}***`
        : `${rawDisplayName.slice(0, 2)}***${rawDisplayName.slice(-1)}`;
      let spDrawnInBatch = false;

      drawn.forEach((prize: any, idx: number) => {
        if (prize.tierCode === 'SP') spDrawnInBatch = true;
        const pullNumber = prize.type === 'last-prize'
          ? totalPacksNum
          : Math.max(1, totalPacksNum - prevRemainingNum + idx + 1);
        const publicLogRef = poolRef.collection('drawLogs').doc();
        transaction.set(publicLogRef, cleanFirestoreData({
          poolId,
          pullNumber,
          userId,
          maskedUsername,
          tierCode: prize.type === 'last-prize' ? 'LAST' : (prize.tierCode || (prize.rarity === 'legendary' ? 'A' : prize.rarity === 'rare' ? 'B' : 'D')),
          prizeId: String(prize.id || ''),
          prizeName: prize.name || '典藏卡包獎項',
          userCardId: prize.userCardId || null,
          isOpened: true,
          redeemedAsPoints: false,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        }));
      });

      soldCardIdsToLock.forEach((soldCardId) => {
        transaction.update(adminDb.collection('allCards').doc(soldCardId), {
          isSold: true,
          status: 'sold',
          soldVia: 'draw',
          soldFromPoolId: poolId,
          soldBy: userId,
          soldAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

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
        remainingPacks: admin.firestore.FieldValue.increment(-packsConsumed),
        cards: updatedCards
      };
      if (updatedPointPrizes && updatedPointPrizes.length > 0) {
        poolUpdates.pointPrizes = updatedPointPrizes;
      }
      if (claimLastPrize) {
        poolUpdates.lastPrizeClaimed = true;
      }
      if (spDrawnInBatch) {
        poolUpdates.spRevealed = true;
      }
      transaction.update(poolRef, cleanFirestoreData(poolUpdates));

      return {
        drawn,
        userData: userSnap.data()!,
        poolData,
        newRemaining: prevRemainingNum - packsConsumed,
        updatedCards,
      };
    });

    // 尾盤自動警報 Webhook（當剩餘抽數降至門檻以下且池內仍有 A 或 SP 賞時）
    const snipeThreshold = Number(result.poolData.snipeAlertThreshold ?? 15);
    if (
      result.poolData.isHybridBlindSpMode &&
      result.poolData.snipeWebhookUrl &&
      result.newRemaining > 0 &&
      result.newRemaining <= snipeThreshold
    ) {
      const cardTiers = result.poolData.cardTiers || {};
      const hasTopTierLeft = (result.updatedCards || []).some(
        (c: any) => c.quantity > 0 && (cardTiers[c.cardId] === 'A' || cardTiers[c.cardId] === 'SP')
      );
      if (hasTopTierLeft) {
        fetch(String(result.poolData.snipeWebhookUrl), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            event: 'snipe_alert',
            poolId,
            poolName: result.poolData.name,
            remainingPulls: result.newRemaining,
            message: `🔥【尾盤高勝率狙擊中】「${result.poolData.name}」僅剩 ${result.newRemaining} 抽，池內仍保有 A 賞 / SP 賞大獎！`,
          }),
        }).catch(() => {});
      }
    }

    // 推送中獎通知
    if (result.drawn.some((card: any) => card.rarity === 'rare' || card.rarity === 'super-rare')) {
      const { pushLineMessage } = await import('@/lib/line');
      if (result.userData.lineUserId) {
        await pushLineMessage(result.userData.lineUserId, `恭喜抽中大獎！\n獎項：${result.drawn.filter((c: any) => c.rarity === 'rare' || c.rarity === 'super-rare').map((c: any) => c.name).join(', ')}`);
      }
    }

    return { success: true, data: result.drawn };
  } catch (error: any) {
    console.error('Server Action Error:', error);
    return { success: false, error: error.message };
  }
}

/**
 * SP 賞（黑盒）一鍵點數回收：原子鎖定卡片並將 buybackPoints 入帳至玩家錢包
 */
export async function redeemSpBuybackAction(
  userId: string,
  userCardId: string,
  poolId?: string
): Promise<{ success: boolean; creditedPoints?: number; error?: string }> {
  try {
    if (!userId || !userCardId) {
      throw new Error('缺少必要參數，無法執行點數回收。');
    }

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
