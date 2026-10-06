import { DrawnPrize, CardPool, Rarity, KujiTicketItem } from '@/types/draw';

export interface CardMapItem {
  id: string;
  name: string;
  category?: string;
  imageUrl?: string;
  sellPrice?: number;
  rarity?: Rarity;
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

  // 1. 展開卡片
  if (poolData.cards && Array.isArray(poolData.cards)) {
    for (const c of poolData.cards) {
      const qty = Math.max(0, c.quantity || 0);
      for (let i = 0; i < qty; i++) {
        items.push({ cardId: c.cardId });
      }
    }
  }

  // 2. 展開點數/紅利獎項
  if (poolData.pointPrizes && Array.isArray(poolData.pointPrizes)) {
    for (const p of poolData.pointPrizes) {
      const qty = Math.max(0, p.quantity || 0);
      for (let i = 0; i < qty; i++) {
        items.push({ pointPrizeId: p.prizeId });
      }
    }
  }

  // 若使用者指定的總抽數大於目前的獎項總數，補齊預設項目
  const targetTotal = customTotalCount && customTotalCount > 0 ? customTotalCount : items.length;
  if (items.length < targetTotal && items.length > 0) {
    // 重複循環填充至 targetTotal
    const originalLen = items.length;
    for (let i = originalLen; i < targetTotal; i++) {
      items.push({ ...items[i % originalLen] });
    }
  }

  // Fisher-Yates 洗牌
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = items[i];
    items[i] = items[j];
    items[j] = temp;
  }

  // 生成帶有 1~N 號碼的 KujiTicketItem 清單
  return items.slice(0, targetTotal).map((item, idx) => ({
    number: idx + 1,
    cardId: item.cardId,
    pointPrizeId: item.pointPrizeId,
    isDrawn: false,
  }));
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
  const currentTickets = poolData.kujiTickets && poolData.kujiTickets.length > 0 
    ? poolData.kujiTickets.map(t => ({ ...t })) 
    : generateKujiTickets(poolData, poolData.totalPacks || poolData.remainingPacks || 80);
  const updatedCards = poolData.cards ? poolData.cards.map((c: any) => ({ ...c })) : [];
  const updatedPointPrizes = poolData.pointPrizes ? poolData.pointPrizes.map((p: any) => ({ ...p })) : [];
  const drawn: DrawnPrize[] = [];

  // 確定要抽的號碼
  let targetNumbers: number[] = [];
  if (selectedNumbers && selectedNumbers.length > 0) {
    targetNumbers = [...selectedNumbers];
  } else {
    // 未指定號碼，從未開出 (isDrawn === false) 的號碼中隨機挑選 count 個
    const availableNumbers = currentTickets.filter(t => !t.isDrawn).map(t => t.number);
    for (let i = availableNumbers.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
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

      let cardDetails = cardsMap instanceof Map
        ? cardsMap.get(ticket.cardId)
        : (cardsMap ? (cardsMap as Record<string, CardMapItem>)[ticket.cardId] : undefined);

      const rarity = getCardRarity(ticket.cardId);
      const resolvedName = cardDetails?.name || '精選頂級球員卡';
      const resolvedImage = cardDetails?.imageUrl || (cardDetails as any)?.image || '';

      drawn.push({
        id: cardDetails?.id || ticket.cardId,
        name: resolvedName,
        imageUrl: resolvedImage,
        backImageUrl: (cardDetails as any)?.backImageUrl || '',
        serialNumber: (cardDetails as any)?.serialNumber || '',
        imageHint: resolvedName,
        category: cardDetails?.category || '抽賞',
        rarity,
        sellPrice: (cardDetails as any)?.sellPrice || 0,
        type: 'card',
        ticketNumber: ticket.number,
      } as any);
    } else if (ticket.pointPrizeId) {
      const pointEntry = updatedPointPrizes.find(p => p.prizeId === ticket.pointPrizeId);
      if (pointEntry && pointEntry.quantity > 0) {
        pointEntry.quantity -= 1;
      }
      const rarity = (pointEntry?.rarity as Rarity) || 'common';
      const points = pointEntry?.points || 300;
      const prizeName = pointEntry?.name || `${points} 紅利點數`;

      drawn.push({
        id: ticket.pointPrizeId,
        name: prizeName,
        points,
        imageUrl: '',
        imageHint: '紅利賞',
        category: '紅利',
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
  isTrial: boolean = false
): { 
  drawn: DrawnPrize[]; 
  updatedCards: { cardId: string; quantity: number }[];
  updatedPointPrizes: { prizeId: string; points: number; quantity: number; rarity: Rarity }[];
} {
  const drawn: DrawnPrize[] = [];
  const updatedCards = poolData.cards ? poolData.cards.map((c: any) => ({ ...c })) : [];
  const updatedPointPrizes = poolData.pointPrizes ? poolData.pointPrizes.map((p: any) => ({ ...p })) : [];

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

    // 1) Calculate weighted total for cards
    const cardEntries = updatedCards.map(c => {
      const q = Math.max(0, c.quantity || 0);
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

    const totalWeight = cardEntries.reduce((sum, e) => sum + e.weight, 0) +
                        pointEntries.reduce((sum, e) => sum + e.weight, 0);

    if (totalWeight <= 0) break;

    let rand = Math.random() * totalWeight;
    let drawnFound = false;

    // Check cards first
    for (const entry of cardEntries) {
      if (entry.weight <= 0) continue;

      if (rand < entry.weight) {
        entry.card.quantity = Math.max(0, entry.q - 1);
        drawnFound = true;

        let cardDetails = cardsMap instanceof Map 
          ? cardsMap.get(entry.card.cardId) 
          : (cardsMap ? (cardsMap as Record<string, CardMapItem>)[entry.card.cardId] : undefined);

        // If card details not found by specific ID, find the best matching card from cardsMap
        if (!cardDetails && cardsMap) {
          const allCardsList = Array.from(cardsMap instanceof Map ? cardsMap.values() : Object.values(cardsMap)).filter(Boolean);
          if (allCardsList.length > 0) {
            const sameRarityCards = allCardsList.filter(c => c.rarity === entry.rarity);
            if (sameRarityCards.length > 0) {
              cardDetails = sameRarityCards[Math.floor(Math.random() * sameRarityCards.length)];
            } else {
              cardDetails = allCardsList[Math.floor(Math.random() * allCardsList.length)];
            }
          }
        }

        const resolvedName = cardDetails?.name || "精選頂級球員卡";
        const resolvedImage = cardDetails?.imageUrl || (cardDetails as any)?.image || "";

        drawn.push({
          id: cardDetails?.id || entry.card.cardId,
          name: resolvedName,
          imageUrl: resolvedImage,
          backImageUrl: (cardDetails as any)?.backImageUrl || '',
          serialNumber: (cardDetails as any)?.serialNumber || '',
          imageHint: resolvedName,
          category: cardDetails?.category || "抽賞",
          rarity: entry.rarity || cardDetails?.rarity || 'common',
          sellPrice: (cardDetails as any)?.sellPrice || 0,
          type: 'card'
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

          if (pPrize.name === '隨機球員 普/特 卡' || pPrize.name?.includes('隨機球員')) {
            drawn.push({
              id: `random-player-${pPrize.prizeId}`,
              name: pPrize.name || '隨機球員 普/特 卡',
              points: pPrize.points || 300,
              imageUrl: '',
              imageHint: '隨機球員賞',
              category: '抽賞',
              rarity: entry.rarity,
              type: 'points',
              isPoints: true
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
              isPoints: true
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

