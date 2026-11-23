import { DrawnPrize, CardPool, Rarity, KujiTicketItem, HybridTierCode } from '@/types/draw';

/**
 * 密碼學級安全亂數（相容 Node.js 與現代瀏覽器，回傳 [0, 1) 均勻浮點數）
 */
function secureRandomFloat(): number {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    globalThis.crypto.getRandomValues(buf);
    return buf[0] / 0x100000000;
  }
  return Math.random();
}

/**
 * 密碼學級無偏差安全整數（回傳 [0, maxExclusive - 1]）
 */
function secureRandomInt(maxExclusive: number): number {
  if (maxExclusive <= 1) return 0;
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.getRandomValues) {
    const buf = new Uint32Array(1);
    const limit = Math.floor(0x100000000 / maxExclusive) * maxExclusive;
    let value = 0;
    do {
      globalThis.crypto.getRandomValues(buf);
      value = buf[0];
    } while (value >= limit);
    return value % maxExclusive;
  }
  return Math.floor(Math.random() * maxExclusive);
}

export interface CardMapItem {
  id: string;
  name: string;
  category?: string;
  imageUrl?: string;
  backImageUrl?: string;
  serialNumber?: string;
  sellPrice?: number;
  rarity?: Rarity;
  isSold?: boolean;
  isRecycled?: boolean;
  status?: string;
}

/**
 * 隨機打散一番賞籤位 (Fisher-Yates Shuffle)
 * 將卡池內現有的 cards 與 pointPrizes 展開並打亂編入 1 ~ N 號籤位
 */
export function generateKujiTickets(
  poolData: Partial<CardPool>,
  customTotalCount?: number
): KujiTicketItem[] {
  const items: { cardId?: string; pointPrizeId?: string }[] = [];

  // 1. 展開實體卡片（嚴格限制同一張實體卡片在單一籤表中最多出現一次，杜絕重複開出大獎）
  const seenCardIds = new Set<string>();
  if (poolData.cards && Array.isArray(poolData.cards)) {
    for (const c of poolData.cards) {
      if (!c?.cardId || seenCardIds.has(c.cardId)) continue;
      const qty = Math.min(1, Math.max(0, c.quantity || 0));
      if (qty > 0) {
        seenCardIds.add(c.cardId);
        items.push({ cardId: c.cardId });
      }
    }
  }

  // 2. 展開點數/紅利獎項
  const pointTemplates: { pointPrizeId: string }[] = [];
  if (poolData.pointPrizes && Array.isArray(poolData.pointPrizes)) {
    for (const p of poolData.pointPrizes) {
      const qty = Math.max(0, p.quantity || 0);
      if (p.prizeId) pointTemplates.push({ pointPrizeId: p.prizeId });
      for (let i = 0; i < qty; i++) {
        items.push({ pointPrizeId: p.prizeId });
      }
    }
  }

  // 若指定的總抽數大於目前的獎項總數，僅允許以點數小賞補齊，絕對不可複製實體大獎 cardId！
  const targetTotal = customTotalCount && customTotalCount > 0 ? customTotalCount : items.length;
  if (items.length < targetTotal && pointTemplates.length > 0) {
    for (let i = items.length; i < targetTotal; i++) {
      items.push({ ...pointTemplates[(i - items.length) % pointTemplates.length] });
    }
  }

  // Fisher-Yates 洗牌（採用密碼學安全亂數）
  for (let i = items.length - 1; i > 0; i--) {
    const j = secureRandomInt(i + 1);
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }

  // 生成帶有 1~N 號碼的 KujiTicketItem 清單，嚴格杜絕 undefined 屬性
  return items.slice(0, targetTotal).map((item, idx) => {
    const ticket: KujiTicketItem = {
      number: idx + 1,
      isDrawn: false,
    };
    if (item.cardId) {
      ticket.cardId = item.cardId;
    }
    if (item.pointPrizeId) {
      ticket.pointPrizeId = item.pointPrizeId;
    }
    return ticket;
  });
}

/**
 * 從一番賞號碼池中抽出指定或隨機號碼
 */
export function drawKujiTickets(
  poolData: Partial<CardPool>,
  selectedNumbers?: number[],
  count: number = 1,
  cardsMap?: Map<string, CardMapItem> | Record<string, CardMapItem>
): {
  drawn: DrawnPrize[];
  updatedTickets: KujiTicketItem[];
  updatedCards: { cardId: string; quantity: number }[];
  updatedPointPrizes: { prizeId: string; points: number; quantity: number; rarity: Rarity }[];
} {
  const currentTickets: KujiTicketItem[] = poolData.kujiTickets && poolData.kujiTickets.length > 0 
    ? poolData.kujiTickets.map(t => {
        const ticket: KujiTicketItem = {
          number: t.number,
          isDrawn: !!t.isDrawn,
        };
        if (t.cardId) ticket.cardId = t.cardId;
        if (t.pointPrizeId) ticket.pointPrizeId = t.pointPrizeId;
        if (t.drawnBy) ticket.drawnBy = t.drawnBy;
        if (t.drawnByName) ticket.drawnByName = t.drawnByName;
        if (t.drawnAt) ticket.drawnAt = t.drawnAt;
        return ticket;
      })
    : generateKujiTickets(poolData, poolData.totalPacks || poolData.remainingPacks || 80);

  const updatedCards = poolData.cards 
    ? poolData.cards
        .filter((c: any) => c && c.cardId)
        .map((c: any) => ({
          cardId: String(c.cardId),
          quantity: Math.max(0, c.quantity || 0),
        })) 
    : [];

  const updatedPointPrizes = poolData.pointPrizes 
    ? poolData.pointPrizes
        .filter((p: any) => p && (p.prizeId || p.points))
        .map((p: any) => {
          const prizeObj: any = {
            prizeId: String(p.prizeId || `points_${p.points || 0}`),
            points: p.points || 0,
            quantity: Math.max(0, p.quantity || 0),
            rarity: (p.rarity as Rarity) || 'common',
          };
          if (p.name) prizeObj.name = p.name;
          return prizeObj;
        }) 
    : [];
  const drawn: DrawnPrize[] = [];

  // 確定要抽的號碼
  let targetNumbers: number[] = [];
  if (selectedNumbers && selectedNumbers.length > 0) {
    targetNumbers = [...selectedNumbers];
  } else {
    // 未指定號碼，從未開出 (isDrawn === false) 的號碼中隨機挑選 count 個
    const availableNumbers = currentTickets.filter(t => !t.isDrawn).map(t => t.number);
    for (let i = availableNumbers.length - 1; i > 0; i--) {
      const j = secureRandomInt(i + 1);
      [availableNumbers[i], availableNumbers[j]] = [availableNumbers[j], availableNumbers[i]];
    }
    targetNumbers = availableNumbers.slice(0, count);
  }

  const getCardRarity = (cardId: string): Rarity => {
    const cardDetails = cardsMap instanceof Map
      ? cardsMap.get(cardId)
      : (cardsMap ? (cardsMap as Record<string, CardMapItem>)[cardId] : undefined);
    return (poolData.cardRarities?.[cardId] as Rarity) || cardDetails?.rarity || 'common';
  };

  for (const num of targetNumbers) {
    const ticketIdx = currentTickets.findIndex(t => t.number === num);
    if (ticketIdx === -1) continue;
    const ticket = currentTickets[ticketIdx];
    if (ticket.isDrawn) continue;

    // 標記抽中
    ticket.isDrawn = true;

    if (ticket.cardId) {
      // 扣減卡片數量
      const cardEntry = updatedCards.find(c => c.cardId === ticket.cardId);
      if (cardEntry && cardEntry.quantity > 0) {
        cardEntry.quantity -= 1;
      }

      const cardDetails = cardsMap instanceof Map
        ? cardsMap.get(ticket.cardId)
        : (cardsMap ? (cardsMap as Record<string, CardMapItem>)[ticket.cardId] : undefined);

      const rarity = getCardRarity(ticket.cardId);
      const resolvedName = cardDetails?.name || '精選頂級球員卡';
      const resolvedImage = cardDetails?.imageUrl || (cardDetails as any)?.image || '';
      const resolvedCategory = (cardDetails?.category && cardDetails.category !== '抽賞' && cardDetails.category !== 'all')
        ? cardDetails.category
        : '一般';

      drawn.push({
        id: cardDetails?.id || ticket.cardId,
        name: resolvedName,
        imageUrl: resolvedImage,
        backImageUrl: cardDetails?.backImageUrl || '',
        serialNumber: cardDetails?.serialNumber || '',
        imageHint: resolvedName,
        category: resolvedCategory,
        rarity,
        sellPrice: cardDetails?.sellPrice || 0,
        type: 'card',
        ticketNumber: ticket.number,
      } as any);
    } else if (ticket.pointPrizeId) {
      const pointEntry = updatedPointPrizes.find(p => p.prizeId === ticket.pointPrizeId);
      if (pointEntry && pointEntry.quantity > 0) {
        pointEntry.quantity -= 1;
      }
      const rarity = (pointEntry?.rarity as Rarity) || 'common';
      const points = pointEntry?.points || 50;
      const prizeName = pointEntry?.name || '隨機球員 普/特 卡';
      const isRandomCardPrize = prizeName.includes('隨機球員') || prizeName.includes('普/特') || !pointEntry?.name;
      const normalizedPrizeId = isRandomCardPrize
        ? (String(ticket.pointPrizeId).startsWith('random-player-') ? String(ticket.pointPrizeId) : `random-player-${ticket.pointPrizeId}`)
        : String(ticket.pointPrizeId);

      drawn.push({
        id: normalizedPrizeId,
        name: prizeName,
        points,
        imageUrl: '',
        imageHint: isRandomCardPrize ? '隨機球員賞' : '紅利賞',
        category: isRandomCardPrize ? '抽賞' : '紅利',
        rarity,
        type: 'points',
        isPoints: true,
        ticketNumber: ticket.number,
      } as any);
    }
  }

  return { drawn, updatedTickets: currentTickets, updatedCards, updatedPointPrizes };
}

/**
 * Perform a draw from a card pool based on remaining quantities.
 * Handles probability logic based on current stock of both card prizes and point prizes.
 * @param isTrial When true, significantly boosts the probability of legendary and rare prizes (試手氣超高爆率體驗).
 */
export function drawFromPool(
  poolData: Partial<CardPool>,
  count: number,
  cardsMap?: Map<string, CardMapItem> | Record<string, CardMapItem>,
  isTrial: boolean = false,
  storeProtection?: { enabled?: boolean; poolMinProgressPct?: number }
): { 
  drawn: DrawnPrize[]; 
  updatedCards: { cardId: string; quantity: number }[];
  updatedPointPrizes: { prizeId: string; points: number; quantity: number; rarity: Rarity }[];
} {
  const drawn: DrawnPrize[] = [];
  const updatedCards = poolData.cards 
    ? poolData.cards
        .filter((c: any) => c && c.cardId)
        .map((c: any) => ({
          cardId: String(c.cardId),
          quantity: Math.max(0, c.quantity || 0),
        })) 
    : [];

  const updatedPointPrizes = poolData.pointPrizes 
    ? poolData.pointPrizes
        .filter((p: any) => p && (p.prizeId || p.points))
        .map((p: any) => {
          const item: any = {
            prizeId: String(p.prizeId || `points_${p.points || 0}`),
            points: p.points || 0,
            quantity: Math.max(0, p.quantity || 0),
            rarity: (p.rarity as Rarity) || 'common',
          };
          if (p.name) item.name = p.name;
          if (p.tierCode) item.tierCode = p.tierCode;
          if (p.unitCost !== undefined) item.unitCost = p.unitCost;
          return item;
        }) 
    : [];

  for (let i = 0; i < count; i++) {
    // Helper to get item rarity
    const getCardRarity = (cardId: string): Rarity => {
      const cardDetails = cardsMap instanceof Map 
        ? cardsMap.get(cardId) 
        : (cardsMap ? (cardsMap as Record<string, CardMapItem>)[cardId] : undefined);
      return (poolData.cardRarities?.[cardId] as Rarity) || cardDetails?.rarity || 'common';
    };

    // Calculate effective weight for trial boost
    // In trial mode: legendary gets x25 weight, rare gets x10 weight, making big hits much more frequent!
    const getWeight = (rarity: Rarity, baseQty: number): number => {
      if (baseQty <= 0) return 0;
      if (!isTrial) return baseQty;
      if (rarity === 'legendary') return baseQty * 25;
      if (rarity === 'rare') return baseQty * 10;
      return baseQty;
    };

    // 1) Calculate weighted total for cards (正式抽卡時若實體卡片已在別處抽出標記 isSold，強制權重歸零防重抽)
    const cardEntries = updatedCards.map(c => {
      const cardDetails = cardsMap instanceof Map
        ? cardsMap.get(c.cardId)
        : (cardsMap ? (cardsMap as Record<string, CardMapItem>)[c.cardId] : undefined);
      const alreadySoldElsewhere = !isTrial && Boolean(cardDetails?.isSold || cardDetails?.isRecycled || cardDetails?.status === 'sold');
      if (alreadySoldElsewhere && c.quantity > 0) {
        c.quantity = 0;
      }
      const q = alreadySoldElsewhere ? 0 : Math.max(0, c.quantity || 0);
      const rarity = getCardRarity(c.cardId);
      const weight = getWeight(rarity, q);
      return { card: c, q, rarity, weight };
    });

    // 2) Calculate weighted total for point prizes
    const pointEntries = updatedPointPrizes.map(p => {
      const q = Math.max(0, p.quantity || 0);
      const rarity = (p.rarity as Rarity) || 'common';
      const weight = getWeight(rarity, q);
      return { prize: p, q, rarity, weight };
    });

    // 店家保護機制：當啟用時，卡池已抽進度未達門檻（預設 30%）前不出大獎（若非大獎已抽完則放行防死池）
    const totalPoolPacks = Math.max(1, Number(poolData.totalPacks || poolData.remainingPacks || 100));
    const currentRemaining =
      cardEntries.reduce((s, e) => s + e.q, 0) + pointEntries.reduce((s, e) => s + e.q, 0);
    const drawnSoFar = Math.max(0, totalPoolPacks - currentRemaining);
    const progressPct = (drawnSoFar / totalPoolPacks) * 100;
    const minProgressPct = storeProtection?.poolMinProgressPct ?? 30;
    const shouldSuppressTopHits = !isTrial && Boolean(storeProtection?.enabled) && progressPct < minProgressPct;

    if (shouldSuppressTopHits) {
      const isTopHitCard = (cardId: string, r: Rarity) => {
        const tier = poolData.cardTiers?.[cardId];
        return tier === 'A' || tier === 'SP' || r === 'legendary';
      };
      const nonTopWeight =
        cardEntries.reduce((s, e) => s + (isTopHitCard(e.card.cardId, e.rarity) ? 0 : e.weight), 0) +
        pointEntries.reduce((s, e) => s + (e.rarity === 'legendary' ? 0 : e.weight), 0);

      if (nonTopWeight > 0) {
        cardEntries.forEach((e) => {
          if (isTopHitCard(e.card.cardId, e.rarity)) e.weight = 0;
        });
        pointEntries.forEach((e) => {
          if (e.rarity === 'legendary') e.weight = 0;
        });
      }
    }

    const totalWeight = cardEntries.reduce((sum, e) => sum + e.weight, 0) +
                        pointEntries.reduce((sum, e) => sum + e.weight, 0);

    if (totalWeight <= 0) break;

    let rand = secureRandomFloat() * totalWeight;
    let drawnFound = false;

    // Check cards first
    for (const entry of cardEntries) {
      if (entry.weight <= 0) continue;

      if (rand < entry.weight) {
        entry.card.quantity = Math.max(0, entry.q - 1);
        drawnFound = true;

        const cardDetails = cardsMap instanceof Map 
          ? cardsMap.get(entry.card.cardId) 
          : (cardsMap ? (cardsMap as Record<string, CardMapItem>)[entry.card.cardId] : undefined);

        const resolvedName = cardDetails?.name || "精選頂級球員卡";
        const resolvedImage = cardDetails?.imageUrl || (cardDetails as any)?.image || "";
        const resolvedCategory = (cardDetails?.category && cardDetails.category !== '抽賞' && cardDetails.category !== 'all')
          ? cardDetails.category
          : '一般';

        const cardIdKey = cardDetails?.id || entry.card.cardId;
        const resolvedTier: HybridTierCode | undefined = poolData.isHybridBlindSpMode
          ? ((poolData.cardTiers?.[cardIdKey] as HybridTierCode) ||
              (entry.rarity === 'legendary' ? 'A' : entry.rarity === 'rare' ? 'B' : 'C'))
          : undefined;
        const unitCost = poolData.cardCosts?.[cardIdKey] ?? cardDetails?.sellPrice ?? 0;
        const resolvedBuybackPoints =
          resolvedTier === 'SP'
            ? (poolData.spBuybackPoints?.[cardIdKey] ?? Math.round(unitCost * 0.8))
            : undefined;
        const resolvedCertNumber = poolData.cardCertNumbers?.[cardIdKey] || cardDetails?.serialNumber || '';

        drawn.push({
          id: cardIdKey,
          name: resolvedName,
          imageUrl: resolvedImage,
          backImageUrl: cardDetails?.backImageUrl || '',
          serialNumber: resolvedCertNumber,
          certNumber: resolvedCertNumber,
          imageHint: resolvedName,
          category: resolvedCategory,
          rarity: entry.rarity || cardDetails?.rarity || 'common',
          sellPrice: unitCost || cardDetails?.sellPrice || 0,
          type: 'card',
          ...(resolvedTier ? { tierCode: resolvedTier } : {}),
          ...(resolvedTier === 'SP' ? { isHiddenSp: true, buybackPoints: resolvedBuybackPoints } : {}),
        } as any);
        break;
      }
      rand -= entry.weight;
    }

    if (!drawnFound) {
      // Check pointPrizes
      for (const entry of pointEntries) {
        if (entry.weight <= 0) continue;

        if (rand < entry.weight) {
          entry.prize.quantity = Math.max(0, entry.q - 1);
          drawnFound = true;
          const pPrize = entry.prize;

          const resolvedPointTier: HybridTierCode | undefined = poolData.isHybridBlindSpMode
            ? ((pPrize as any).tierCode || (entry.rarity === 'rare' ? 'C' : 'D'))
            : undefined;

          if (pPrize.name === '隨機球員 普/特 卡' || pPrize.name?.includes('隨機球員')) {
            drawn.push({
              id: `random-player-${pPrize.prizeId}`,
              name: pPrize.name || '隨機球員 普/特 卡',
              points: pPrize.points || 50,
              imageUrl: '',
              imageHint: '隨機球員賞',
              category: '抽賞',
              rarity: entry.rarity,
              type: 'points',
              isPoints: true,
              ...(resolvedPointTier ? { tierCode: resolvedPointTier } : {}),
            } as any);
          } else {
            drawn.push({
              id: pPrize.prizeId || `point-${pPrize.points}`,
              name: pPrize.name || `${pPrize.points} 紅利點數`,
              points: pPrize.points,
              imageUrl: '',
              imageHint: '紅利賞',
              category: '紅利',
              rarity: entry.rarity,
              type: 'points',
              isPoints: true,
              ...(resolvedPointTier ? { tierCode: resolvedPointTier } : {}),
            } as any);
          }
          break;
        }
        rand -= entry.weight;
      }
    }
  }

  return { drawn, updatedCards, updatedPointPrizes };
}

