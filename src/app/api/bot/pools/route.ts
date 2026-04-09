
import { NextResponse } from 'next/server';
import { getAdminDb } from '@/firebase/admin';
import admin from 'firebase-admin';

const { Timestamp } = admin.firestore;

export const dynamic = 'force-dynamic';

/**
 * @fileOverview 機器人專用 API 端點
 * 修正版：嚴格過濾「即時在線」卡池
 * 判定標準：剩餘包數 > 0 且 當前時間位於 startsAt 與 expiresAt 之間
 */

export async function GET() {
  const db = getAdminDb();
  
  if (!db) {
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }

  try {
    const nowSeconds = Timestamp.now().seconds;

    // 1. 同步獲取有庫存的卡池與所有卡片資料庫
    const [poolsSnap, cardsSnap] = await Promise.all([
      db.collection('cardPools').where('remainingPacks', '>', 0).get(),
      db.collection('allCards').get()
    ]);

    const allCardsMap = new Map();
    cardsSnap.docs.forEach(doc => {
      allCardsMap.set(doc.id, doc.data());
    });

    // 2. 進行時間過濾與數據封裝
    const report = poolsSnap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .filter(pool => {
        // 時間檢查邏輯
        const isStarted = !pool.startsAt || pool.startsAt.seconds <= nowSeconds;
        const isNotExpired = !pool.expiresAt || pool.expiresAt.seconds > nowSeconds;
        return isStarted && isNotExpired;
      })
      .map(pool => {
        const poolId = pool.id;

        // --- 計算機率與剩餘大獎 ---
        let legendaryCount = 0;
        const grandPrizes: any[] = [];

        // A. 計算卡片類獎項
        if (pool.cards && pool.cardRarities) {
          pool.cards.forEach((c: any) => {
            const rarity = pool.cardRarities[c.cardId];
            const cardData = allCardsMap.get(c.cardId);
            
            if (rarity === 'legendary' && c.quantity > 0 && !cardData?.isSold) {
              legendaryCount += c.quantity;
              grandPrizes.push({
                name: cardData?.name || '未知卡片',
                remaining: c.quantity
              });
            }
          });
        }

        // B. 計算點數類獎項
        if (pool.pointPrizes) {
          pool.pointPrizes.forEach((p: any) => {
            if (p.rarity === 'legendary' && p.quantity > 0) {
              legendaryCount += p.quantity;
              grandPrizes.push({
                name: `${p.points} P+ 點數獎`,
                remaining: p.quantity
              });
            }
          });
        }

        // --- 計算比例 ---
        const total = pool.totalPacks || 1;
        const remaining = pool.remainingPacks || 0;
        const ratio = ((remaining / total) * 100).toFixed(1) + '%';
        const legendaryProb = remaining > 0 ? ((legendaryCount / remaining) * 100).toFixed(2) + '%' : '0%';

        return {
          id: poolId,
          name: pool.name,
          stats: {
            totalPacks: total,
            remainingPacks: remaining,
            remainingRatio: ratio,
          },
          probabilities: {
            legendaryWinRate: legendaryProb
          },
          grandPrizesInPool: grandPrizes,
          lastPrizeSet: !!pool.lastPrizeCardId
        };
      });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      activePoolsCount: report.length,
      data: report
    }, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'no-store, max-age=0'
      }
    });

  } catch (error: any) {
    console.error('Bot API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
