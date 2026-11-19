import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ poolId: string }> }
) {
  try {
    const { poolId } = await params;
    const poolSnap = await adminDb.collection('cardPools').doc(poolId).get();
    if (!poolSnap.exists) {
      return NextResponse.json({ error: 'Pool not found' }, { status: 404 });
    }

    const poolData = { id: poolSnap.id, ...poolSnap.data() } as any;
    const isHybrid = Boolean(poolData.isHybridBlindSpMode);
    const spRevealed = Boolean(poolData.spRevealed);
    const cardTiers = (poolData.cardTiers || {}) as Record<string, string>;

    // 讀取公開開獎紀錄（最近 50 筆）
    const logsSnap = await adminDb
      .collection('cardPools')
      .doc(poolId)
      .collection('drawLogs')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const drawLogs = logsSnap.docs.map((d: any) => {
      const data = d.data();
      const hideSpName = isHybrid && !spRevealed && data.tierCode === 'SP';
      return {
        id: d.id,
        pullNumber: data.pullNumber,
        maskedUsername: data.maskedUsername,
        tierCode: data.tierCode,
        prizeName: hideSpName ? '神秘隱藏黑包（SP 賞）' : data.prizeName,
        isOpened: Boolean(data.isOpened),
        redeemedAsPoints: Boolean(data.redeemedAsPoints),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate().toISOString() : null,
      };
    });

    // 過濾卡片明細：若為明池盲開＋隱藏 SP 模式且 SP 尚未開出，絕不回傳 SP 卡的 card_name 與 image_url
    const cardIds = Array.from(
      new Set([
        ...(Array.isArray(poolData.cards) ? poolData.cards.map((c: any) => String(c.cardId || '')).filter(Boolean) : []),
        ...(poolData.lastPrizeCardId ? [String(poolData.lastPrizeCardId)] : []),
      ])
    );

    const prizes: any[] = [];
    if (cardIds.length > 0) {
      const snaps = await Promise.all(cardIds.map((cid) => adminDb.collection('allCards').doc(cid).get()));
      snaps.forEach((snap) => {
        if (!snap.exists) return;
        const c = snap.data()!;
        const tierCode = cardTiers[snap.id] || 'B';
        const stockEntry = (poolData.cards || []).find((x: any) => x.cardId === snap.id);
        const unitCost = poolData.cardCosts?.[snap.id] ?? c.sellPrice ?? 0;
        const buybackPoints = poolData.spBuybackPoints?.[snap.id] ?? Math.round(unitCost * 0.8);

        if (isHybrid && tierCode === 'SP' && !spRevealed) {
          prizes.push({
            id: `hidden-sp-${snap.id}`,
            tierCode: 'SP',
            displayMode: 'hidden_sp',
            isHiddenSp: true,
            guaranteedMarketValue: unitCost,
            buybackPoints,
            remainingQty: stockEntry?.quantity ?? 0,
            // 故意不輸出 card_name / image_url / cert_number
          });
        } else {
          prizes.push({
            id: snap.id,
            tierCode,
            cardName: c.name,
            imageUrl: c.imageUrl || '',
            certNumber: poolData.cardCertNumbers?.[snap.id] || c.serialNumber || '',
            remainingQty: snap.id === poolData.lastPrizeCardId ? (poolData.lastPrizeClaimed ? 0 : 1) : (stockEntry?.quantity ?? 0),
          });
        }
      });
    }

    return NextResponse.json({
      pool: {
        id: poolData.id,
        name: poolData.name,
        price: poolData.price,
        totalPacks: poolData.totalPacks,
        remainingPacks: poolData.remainingPacks,
        isHybridBlindSpMode: isHybrid,
        spRevealed,
        snipeAlertThreshold: poolData.snipeAlertThreshold ?? 15,
      },
      prizes,
      drawLogs,
    });
  } catch (error: any) {
    console.error('GET /api/pools/[poolId] error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to load pool' }, { status: 500 });
  }
}
