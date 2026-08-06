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
 */
export function drawFromPool(
  poolData: Partial<CardPool>,
  count: number,
  cardsMap?: Map<string, CardMapItem> | Record<string, CardMapItem>
): { 
  drawn: DrawnPrize[]; 
  updatedCards: { cardId: string; quantity: number }[];
  updatedPointPrizes: { prizeId: string; points: number; quantity: number; rarity: Rarity }[];
} {
  const drawn: DrawnPrize[] = [];
  const updatedCards = poolData.cards ? JSON.parse(JSON.stringify(poolData.cards)) : [];
  const updatedPointPrizes = poolData.pointPrizes ? JSON.parse(JSON.stringify(poolData.pointPrizes)) : [];

  for (let i = 0; i < count; i++) {
    // 1) Sum up available card quantities
    const totalCardQty = updatedCards.reduce((acc: number, c: any) => acc + Math.max(0, c.quantity || 0), 0);
    // 2) Sum up available point prize quantities
    const totalPointQty = updatedPointPrizes.reduce((acc: number, p: any) => acc + Math.max(0, p.quantity || 0), 0);
    const totalPoolQty = totalCardQty + totalPointQty;

    if (totalPoolQty <= 0) break;

    let rand = Math.random() * totalPoolQty;
    let drawnFound = false;

    // Check cards array first
    for (const card of updatedCards) {
      const q = Math.max(0, card.quantity || 0);
      if (q <= 0) continue;

      if (rand < q) {
        card.quantity = q - 1;
        drawnFound = true;

        const cardDetails = cardsMap instanceof Map 
          ? cardsMap.get(card.cardId) 
          : (cardsMap ? (cardsMap as Record<string, CardMapItem>)[card.cardId] : undefined);

        const cardRarity = (poolData.cardRarities?.[card.cardId] as Rarity) || cardDetails?.rarity || 'common';

        drawn.push({
          id: card.cardId,
          name: cardDetails?.name || "精選卡片",
          imageUrl: cardDetails?.imageUrl || `https://picsum.photos/seed/${card.cardId}/400/600`,
          imageHint: "幸運獲獎",
          category: cardDetails?.category || "抽賞",
          rarity: cardRarity,
          type: 'card'
        } as any);
        break;
      }
      rand -= q;
    }

    if (!drawnFound) {
      // Check pointPrizes array
      for (const pPrize of updatedPointPrizes) {
        const q = Math.max(0, pPrize.quantity || 0);
        if (q <= 0) continue;

        if (rand < q) {
          pPrize.quantity = q - 1;
          drawnFound = true;

          if (pPrize.name === '隨機球員 普/特 卡' || pPrize.name?.includes('隨機球員')) {
            drawn.push({
              id: `random-player-${pPrize.prizeId}`,
              name: pPrize.name || '隨機球員 普/特 卡',
              points: pPrize.points || 300,
              imageUrl: '',
              imageHint: '隨機球員賞',
              category: '抽賞',
              rarity: pPrize.rarity || 'common',
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
              rarity: pPrize.rarity || 'common',
              type: 'points',
              isPoints: true
            } as any);
          }
          break;
        }
        rand -= q;
      }
    }
  }

  return { drawn, updatedCards, updatedPointPrizes };
}

