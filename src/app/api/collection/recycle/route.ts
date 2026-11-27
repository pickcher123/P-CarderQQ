import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { verifyUserRequest } from '@/lib/server-auth';
import { getBonusMultiplier } from '@/lib/bonus-event';

export const dynamic = 'force-dynamic';

const LEVEL_REBATE_RATES: Record<string, number> = {
  '新手收藏家': 0,
  '進階收藏家': 2,
  '資深收藏家': 3,
  '卡牌大師': 5,
  '殿堂級玩家': 7,
  '傳奇收藏家': 9,
  'P+卡神': 12,
};

function isRandomPlayerCardData(cardData: any, masterCard: any): boolean {
  const name = String(cardData?.name || masterCard?.name || '');
  const cardId = String(cardData?.cardId || '');
  const rarity = String(cardData?.rarity || '').toLowerCase();
  if (cardId === 'random-player-card' || cardId.startsWith('random_')) return true;
  if (name.includes('隨機球員')) return true;
  if (!masterCard && rarity === 'common' && cardData?.source === 'draw' && !cardData?.tierCode) {
    return name.includes('普') || name.includes('特');
  }
  return false;
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
    const mode = body.mode === 'random_count' ? 'random_count' : 'selected';
    const requestedIds: string[] = Array.isArray(body.userCardIds)
      ? Array.from(new Set(body.userCardIds.filter((id: any) => typeof id === 'string' && id.trim()).map((id: string) => id.trim())))
      : [];
    const requestedCount = Math.max(0, Math.min(200, Math.floor(Number(body.count || 0))));

    if (mode === 'selected' && requestedIds.length === 0) {
      return NextResponse.json({ success: false, error: '請先選擇要轉點的卡片。' }, { status: 400 });
    }
    if (mode === 'selected' && requestedIds.length > 200) {
      return NextResponse.json({ success: false, error: '單次最多可轉點 200 張卡片。' }, { status: 400 });
    }
    if (mode === 'random_count' && requestedCount <= 0) {
      return NextResponse.json({ success: false, error: '請輸入正確的普特卡轉點數量。' }, { status: 400 });
    }

    // 預讀 betting-items 供拼卡自動重新上架判斷
    const bettingSnap = await db.collection('betting-items').get();
    const bettingItemDocs = bettingSnap.docs;

    const result = await db.runTransaction(async (tx) => {
      const userRef = db.collection('users').doc(uid);
      const sysConfigRef = db.collection('systemConfig').doc('main');
      const [userSnap, sysSnap] = await Promise.all([tx.get(userRef), tx.get(sysConfigRef)]);

      if (!userSnap.exists) {
        throw new Error('找不到會員資料。');
      }

      const userData = userSnap.data() || {};
      const sysData = sysSnap.exists ? (sysSnap.data() || {}) : {};
      const autoRelistBetting = sysData.bettingAutoRelistOnBuyBack !== false;
      const bonusMultiplier = getBonusMultiplier(sysData.bonusEvent, 'recycling');
      const userLevel = String(userData.userLevel || '新手收藏家');
      const rebateRatePct = LEVEL_REBATE_RATES[userLevel] ?? 0;

      // 1. 取得要回收的 userCards 文件
      let targetUserCardSnaps: FirebaseFirestore.DocumentSnapshot[] = [];
      if (mode === 'selected') {
        const refs = requestedIds.map((id) => db.collection('users').doc(uid).collection('userCards').doc(id));
        const snaps = await Promise.all(refs.map((r) => tx.get(r)));
        targetUserCardSnaps = snaps.filter((s) => s.exists);
      } else {
        const allUserCardsSnap = await tx.get(db.collection('users').doc(uid).collection('userCards'));
        const randomDocs = allUserCardsSnap.docs.filter((d) => isRandomPlayerCardData(d.data(), null));
        targetUserCardSnaps = randomDocs.slice(0, requestedCount);
      }

      if (targetUserCardSnaps.length === 0) {
        throw new Error('所選卡片不存在或已完成轉點，請重新整理收藏庫。');
      }

      // 2. 預讀對應的 allCards 主檔以取得真實卡價（嚴禁信任前端金額）
      const masterCardIds = Array.from(
        new Set(
          targetUserCardSnaps
            .map((s) => s.data()?.cardId)
            .filter((cid): cid is string => typeof cid === 'string' && cid.trim().length > 0 && cid !== 'random-player-card')
        )
      );
      const masterCardMap = new Map<string, any>();
      if (masterCardIds.length > 0) {
        const masterSnaps = await Promise.all(
          masterCardIds.map((cid) => tx.get(db.collection('allCards').doc(cid)))
        );
        masterSnaps.forEach((ms) => {
          if (ms.exists) masterCardMap.set(ms.id, ms.data());
        });
      }

      let totalDiamonds = 0;
      let totalPPoints = 0;
      const soldNames: string[] = [];
      const soldUserCardIds: string[] = [];

      for (const ucSnap of targetUserCardSnaps) {
        const uc = ucSnap.data() || {};
        if (uc.source === 'group-break') {
          continue; // 團拆限定卡不可轉點
        }

        const master = uc.cardId ? masterCardMap.get(uc.cardId) : null;
        const isRandom = isRandomPlayerCardData(uc, master);

        let cardDiamonds = 0;
        let cardPPoints = 0;

        if (isRandom) {
          cardDiamonds = 40;
          cardPPoints = 0;
        } else {
          const basePrice = Number(master?.sellPrice ?? uc.sellPrice ?? 10);
          const isGodPack = Boolean(uc.isHybridBlindSpMode || uc.tierCode);
          const isBetting = uc.source === 'betting' || uc.source === 'bet';

          if (isGodPack) {
            const isTierCD = uc.tierCode === 'C' || uc.tierCode === 'D';
            const rate = isTierCD ? 0.9 : 0.8;
            cardDiamonds = Math.round(basePrice * rate);
            cardPPoints = Math.round(basePrice * (rebateRatePct / 100) * (bonusMultiplier || 1));
          } else if (isBetting) {
            cardDiamonds = Math.round(basePrice * 0.9);
            cardPPoints = 0;
          } else {
            cardDiamonds = Math.round(basePrice * 0.8);
            cardPPoints = 0;
          }
        }

        totalDiamonds += cardDiamonds;
        totalPPoints += cardPPoints;
        soldNames.push(String(master?.name || uc.name || '球員卡'));
        soldUserCardIds.push(ucSnap.id);

        // 刪除該張 userCard
        tx.delete(ucSnap.ref);

        // 更新 allCards 狀態（或拼卡自動重新上架）
        if (uc.cardId && master) {
          const isBettingCard =
            uc.source === 'betting' ||
            uc.source === 'direct-buy' ||
            bettingItemDocs.some((d) => Array.isArray(d.data()?.allCardIds) && d.data().allCardIds.includes(uc.cardId));

          if (isBettingCard && autoRelistBetting) {
            tx.update(db.collection('allCards').doc(uc.cardId), {
              isSold: false,
              isRecycled: false,
            });
            for (const itemDoc of bettingItemDocs) {
              const itemData = itemDoc.data();
              if (Array.isArray(itemData?.soldCardIds) && itemData.soldCardIds.includes(uc.cardId)) {
                tx.update(itemDoc.ref, {
                  soldCardIds: FieldValue.arrayRemove(uc.cardId),
                });
              }
            }
          } else {
            tx.update(db.collection('allCards').doc(uc.cardId), {
              isSold: true,
              isRecycled: true,
            });
          }
        }
      }

      if (soldUserCardIds.length === 0) {
        throw new Error('所選項目均為團拆限定，無法進行轉點。');
      }

      const finalDiamonds = Math.round(totalDiamonds);
      const finalPPoints = Math.round(totalPPoints);

      const userUpdates: Record<string, any> = {};
      if (finalDiamonds > 0) userUpdates.points = FieldValue.increment(finalDiamonds);
      if (finalPPoints > 0) userUpdates.bonusPoints = FieldValue.increment(finalPPoints);
      if (Object.keys(userUpdates).length > 0) {
        tx.update(userRef, userUpdates);
      }

      const summaryNames =
        mode === 'random_count'
          ? `隨機球員 普/特 卡 x ${soldUserCardIds.length}`
          : soldNames.slice(0, 10).join(', ') + (soldNames.length > 10 ? ` ...等 ${soldNames.length} 張` : '');

      if (finalDiamonds > 0) {
        tx.set(db.collection('transactions').doc(), {
          userId: uid,
          transactionType: 'QuickSell',
          currency: 'diamond',
          amount: finalDiamonds,
          details:
            mode === 'random_count'
              ? `普特卡批量轉點 ${soldUserCardIds.length} 張 (獲得鑽石)。卡片內容: [${summaryNames}]`
              : `快速轉點 ${soldUserCardIds.length} 張卡片 (獲得鑽石)。卡片內容: [${summaryNames}]`,
          transactionDate: FieldValue.serverTimestamp(),
          section: 'admin',
        });
      }

      if (finalPPoints > 0) {
        tx.set(db.collection('transactions').doc(), {
          userId: uid,
          transactionType: 'QuickSell',
          currency: 'p-point',
          amount: finalPPoints,
          details: `快速轉點 ${soldUserCardIds.length} 張卡片 (獲得紅利P點)。卡片內容: [${summaryNames}]`,
          transactionDate: FieldValue.serverTimestamp(),
          section: 'admin',
        });
      }

      return {
        diamonds: finalDiamonds,
        pPoints: finalPPoints,
        count: soldUserCardIds.length,
        soldUserCardIds,
      };
    });

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[API /api/collection/recycle] Error:', error);
    return NextResponse.json(
      { success: false, error: error?.message || '轉點失敗，請稍後再試。' },
      { status: 400 }
    );
  }
}
