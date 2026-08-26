import { DrawnPrize, CardPool, Rarity } from '@/types/draw';

export interface CardMapItem {
  id: string;
  name: string;
  category?: string;
  imageUrl?: string;
  sellPrice?: number;
  rarity?: Rarity;
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

