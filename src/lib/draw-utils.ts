import { DrawnPrize, CardPool, Rarity } from '@/types/draw';

/**
 * Perform a draw from a card pool based on remaining quantities.
 * This function handles the probability logic based on current stock.
 */
export function drawFromPool(
  poolData: Partial<CardPool>,
  count: number
): { drawn: DrawnPrize[]; updatedCards: { cardId: string; quantity: number }[] } {
  const drawn: DrawnPrize[] = [];
  const updatedCards = poolData.cards ? JSON.parse(JSON.stringify(poolData.cards)) : [];

  for (let i = 0; i < count; i++) {
    const totalCards = updatedCards.reduce((acc: number, c: any) => acc + (c.quantity || 0), 0);
    
    if (totalCards <= 0) break;

    let rand = Math.random() * totalCards;

    for (const card of updatedCards) {
      if (rand < (card.quantity || 0)) {
        card.quantity = (card.quantity || 0) - 1;
        drawn.push({
          id: card.cardId,
          name: "獲得卡片",
          imageUrl: `https://picsum.photos/seed/${card.cardId}/400/600`, // Default for missing images
          imageHint: "幸運獲獎",
          category: "抽賞",
          rarity: (poolData.cardRarities?.[card.cardId] as Rarity) || 'common',
          type: 'card'
        } as any);
        break;
      }
      rand -= (card.quantity || 0);
    }
  }

  return { drawn, updatedCards };
}
