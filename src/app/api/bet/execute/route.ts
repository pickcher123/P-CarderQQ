import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyUserRequest } from '@/lib/server-auth';
import { createProvablyFairRound } from '@/lib/provably-fair';
import type { LevelBenefit } from '@/types/system';

export const dynamic = 'force-dynamic';

const DEFAULT_LEVELS = [
  { level: '新手收藏家', threshold: 0 },
  { level: '進階收藏家', threshold: 15000 },
  { level: '資深收藏家', threshold: 50000 },
  { level: '卡牌大師', threshold: 100000 },
  { level: '殿堂級玩家', threshold: 500000 },
  { level: '傳奇收藏家', threshold: 1000000 },
  { level: 'P+卡神', threshold: 2000000 },
];

function calculateLevel(totalSpent: number, benefits?: LevelBenefit[]): string {
  const levels = benefits && benefits.length > 0 ? benefits : DEFAULT_LEVELS;
  const validLevelNames = DEFAULT_LEVELS.map((l) => l.level);
  const sorted = [...levels]
    .filter((l) => validLevelNames.includes(l.level))
    .sort((a, b) => b.threshold - a.threshold);
  const matched = sorted.find((l) => totalSpent >= l.threshold);
  return matched ? matched.level : DEFAULT_LEVELS[0].level;
}

export async function POST(req: Request) {
  try {
    const auth = await verifyUserRequest(req);
    if (!auth.ok) return auth.response;

    const uid = auth.user.uid;
    const db = getAdminDb();
    if (!db) {
      return NextResponse.json({ success: false, error: '資料庫尚未就緒，請稍後再試。' }, { status: 503 });
    }

    const body = await req.json();
    const mode = body.mode === 'direct_buy' ? 'direct_buy' : 'spin';
    const cardId = typeof body.cardId === 'string' ? body.cardId.trim() : '';
    const categoryName = typeof body.categoryName === 'string' ? decodeURIComponent(body.categoryName.trim()) : '';
    const paymentCurrency: 'diamond' | 'p-point' =
      body.paymentCurrency === 'p-point' || body.paymentCurrency === 'pplus' ? 'p-point' : 'diamond';

    if (!cardId) {
      return NextResponse.json({ success: false, error: '缺少卡片 ID。' }, { status: 400 });
    }

    let selectedNumbers: number[] = [];
    if (mode === 'spin') {
      const rawNums = Array.isArray(body.selectedNumbers) ? body.selectedNumbers : [];
      selectedNumbers = Array.from(
        new Set<number>(rawNums.map((x: unknown) => Number(x)).filter((n: number) => Number.isInteger(n) && n >= 1 && n <= 10))
      ).sort((a, b) => a - b);

      if (selectedNumbers.length === 0 || selectedNumbers.length > 9) {
        return NextResponse.json(
          { success: false, error: '請選擇 1 至 9 個幸運號碼（1~10）。' },
          { status: 400 }
        );
      }
    }

    const txResult = await db.runTransaction(async (tx) => {
      const cardRef = db.collection('allCards').doc(cardId);
      const userRef = db.collection('users').doc(uid);
      const sysConfigRef = db.collection('systemConfig').doc('main');

      const [cardSnap, userSnap, sysSnap] = await Promise.all([
        tx.get(cardRef),
        tx.get(userRef),
        tx.get(sysConfigRef),
      ]);

      if (!cardSnap.exists) {
        throw new Error('找不到此卡片或已下架。');
      }
      if (!userSnap.exists) {
        throw new Error('找不到會員資料。');
      }

      const cardData = cardSnap.data() || {};
      const userData = userSnap.data() || {};
      const sysData = sysSnap.exists ? (sysSnap.data() || {}) : {};

      if (cardData.isSold) {
        throw new Error('此卡片已被其他玩家抽出或已售出，請重新整理後再試。');
      }

      // 檢查是否被他人鎖定中
      if (cardData.lockedBy && cardData.lockedBy !== uid && cardData.lockedAt) {
        const lockedMs =
          typeof cardData.lockedAt.toMillis === 'function' ? cardData.lockedAt.toMillis() : 0;
        if (Date.now() - lockedMs < 25000) {
          throw new Error('此卡片正在被其他玩家挑戰中，請稍候 30 秒再試。');
        }
      }

      // 檢查等級門檻
      const levelNames = DEFAULT_LEVELS.map((l) => l.level);
      const userLevelIdx = Math.max(0, levelNames.indexOf(String(userData.userLevel || '新手收藏家')));
      const minLevelIdx = cardData.minLevel ? levelNames.indexOf(String(cardData.minLevel)) : 0;
      if (minLevelIdx > 0 && userLevelIdx < minLevelIdx) {
        throw new Error(`僅限「${cardData.minLevel}」以上會員參與。`);
      }

      const sellPrice = Number(cardData.sellPrice || 0);
      if (sellPrice <= 0) {
        throw new Error('此卡片尚未設定售價。');
      }

      const walletField = paymentCurrency === 'diamond' ? 'points' : 'bonusPoints';
      const walletBalance = Number(userData[walletField] || 0);

      if (mode === 'direct_buy') {
        const finalPrice = paymentCurrency === 'diamond' ? sellPrice : sellPrice * 10;
        if (walletBalance < finalPrice) {
          throw new Error('點數餘額不足，請先儲值後再試。');
        }

        const userUpdates: Record<string, any> = {
          [walletField]: FieldValue.increment(-finalPrice),
        };
        if (paymentCurrency === 'diamond') {
          const nextSpent = Number(userData.totalSpent || 0) + finalPrice;
          userUpdates.totalSpent = FieldValue.increment(finalPrice);
          userUpdates.userLevel = calculateLevel(nextSpent, sysData.levelBenefits);
        }
        tx.update(userRef, userUpdates);

        tx.set(db.collection('users').doc(uid).collection('userCards').doc(), {
          userId: uid,
          cardId,
          isFoil: false,
          rarity: cardData.rarity || 'unknown',
          category: cardData.category || 'betting',
          source: 'direct-buy',
          acquiredAt: FieldValue.serverTimestamp(),
        });

        tx.update(cardRef, {
          isSold: true,
          status: 'sold',
          soldVia: 'direct-buy',
          soldBy: uid,
          soldAt: FieldValue.serverTimestamp(),
          lockedBy: null,
          lockedAt: null,
        });

        const targetCat = cardData.category || categoryName;
        if (targetCat && targetCat !== 'all') {
          tx.set(
            db.collection('betting-items').doc(targetCat),
            { soldCardIds: FieldValue.arrayUnion(cardId) },
            { merge: true }
          );
        }

        tx.set(db.collection('transactions').doc(), {
          userId: uid,
          targetId: cardId,
          transactionType: 'Purchase',
          section: 'betting-direct',
          currency: paymentCurrency,
          amount: -finalPrice,
          details: `【直接購買】${cardData.name || '卡牌'}`,
          transactionDate: FieldValue.serverTimestamp(),
        });

        return { mode: 'direct_buy' as const, cardName: cardData.name || '卡牌' };
      }

      // === 拼卡挑戰轉盤模式 (mode === 'spin') ===
      const diamondUnitPrice = Math.max(1, Math.round(sellPrice * 0.1));
      const unitPrice = paymentCurrency === 'diamond' ? diamondUnitPrice : diamondUnitPrice * 10;
      const totalPrice = selectedNumbers.length * unitPrice;

      if (walletBalance < totalPrice) {
        throw new Error('錢包餘額不足，請先儲值或調整格數。');
      }

      const storeProtection = sysData.storeProtection;
      const prevSpinCount = Number(cardData.bettingSpinCount || 0);
      const nextSpinCount = prevSpinCount + 1;
      const minSpinRequired = Number(storeProtection?.bettingMinSpin ?? 3);

      // 使用 Node.js 密碼學安全隨機數 (crypto.randomInt)
      let winningSpot = crypto.randomInt(1, 11); // 1 ~ 10
      if (storeProtection?.enabled && nextSpinCount < minSpinRequired) {
        const nonWinningSpots = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].filter(
          (n) => !selectedNumbers.includes(n)
        );
        if (nonWinningSpots.length > 0) {
          winningSpot = nonWinningSpots[crypto.randomInt(0, nonWinningSpots.length)];
        }
      }
      const didWin = selectedNumbers.includes(winningSpot);

      const userUpdates: Record<string, any> = {
        [walletField]: FieldValue.increment(-totalPrice),
      };
      if (paymentCurrency === 'diamond') {
        const nextSpent = Number(userData.totalSpent || 0) + totalPrice;
        userUpdates.totalSpent = FieldValue.increment(totalPrice);
        userUpdates.userLevel = calculateLevel(nextSpent, sysData.levelBenefits);
      }
      tx.update(userRef, userUpdates);

      const pfData = await createProvablyFairRound({
        clientSeed: `${uid.substring(0, 8)}_${Date.now()}`,
        outcomeType: 'bet',
        poolSize: 10,
      });
      const fullFairness = {
        ...pfData,
        poolSize: 10,
        winningSpot,
        isWin: didWin,
        luckyNumber: (winningSpot - 1) * 1000 + 500,
        luckyPercent: Number((((winningSpot - 1) * 10) + 5).toFixed(2)),
      };

      const winText = didWin ? '中獎' : '未中獎';
      const currencyLabel = paymentCurrency === 'diamond' ? '鑽石' : 'P+';
      const detailString = `【拼卡】${cardData.name || '卡牌'} (${currencyLabel}) 下注:[${selectedNumbers.join(',')}] 開出:[${winningSpot}] 結果:${winText}`;

      tx.set(db.collection('transactions').doc(), {
        userId: uid,
        targetId: cardId,
        transactionType: 'Purchase',
        section: 'betting',
        currency: paymentCurrency,
        amount: -totalPrice,
        details: detailString,
        provablyFair: fullFairness,
        transactionDate: FieldValue.serverTimestamp(),
      });

      const cardUpdates: Record<string, any> = {
        lockedBy: null,
        lockedAt: null,
        bettingSpinCount: nextSpinCount,
      };

      if (didWin) {
        tx.set(db.collection('users').doc(uid).collection('userCards').doc(), {
          userId: uid,
          cardId,
          isFoil: true,
          rarity: cardData.rarity || 'unknown',
          category: cardData.category || 'betting',
          source: 'betting',
          acquiredAt: FieldValue.serverTimestamp(),
        });

        cardUpdates.isSold = true;
        cardUpdates.status = 'sold';
        cardUpdates.soldVia = 'betting';
        cardUpdates.soldBy = uid;
        cardUpdates.soldAt = FieldValue.serverTimestamp();

        const targetCat = cardData.category || categoryName;
        if (targetCat && targetCat !== 'all') {
          tx.set(
            db.collection('betting-items').doc(targetCat),
            { soldCardIds: FieldValue.arrayUnion(cardId) },
            { merge: true }
          );
        }
      }

      tx.update(cardRef, cardUpdates);

      return {
        mode: 'spin' as const,
        won: didWin,
        spot: winningSpot,
        fairness: fullFairness,
      };
    });

    return NextResponse.json({ success: true, ...txResult });
  } catch (error: any) {
    console.error('[API /api/bet/execute] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || '操作失敗，請稍後再試。' },
      { status: 400 }
    );
  }
}
