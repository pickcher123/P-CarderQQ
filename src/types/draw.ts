export type Rarity = 'legendary' | 'rare' | 'common';
export type HybridTierCode = 'A' | 'SP' | 'B' | 'C' | 'D' | 'LAST';

export interface Card {
    id: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
    imageHint: string;
    category: string;
    sellPrice?: number;
    isSold?: boolean;
    rarity?: Rarity;
    isPoints?: boolean;
    points?: number;
    certNumber?: string;
    inventoryCode?: string;
}

export type CardItem = Card;

export interface PointPrize {
    prizeId: string;
    points: number;
    quantity: number;
    rarity: Rarity;
    name?: string;
    tierCode?: 'C' | 'D';
    unitCost?: number;
}

export interface KujiTicketItem {
    number: number;
    cardId?: string;
    pointPrizeId?: string;
    isDrawn: boolean;
    drawnBy?: string;
    drawnByName?: string;
    drawnAt?: any;
}

export interface CardPool {
    id: string;
    price?: number;
    price3Draws?: number;
    price10Draws?: number;
    cards: { cardId: string; quantity: number }[];
    pointPrizes?: PointPrize[];
    cardRarities: Record<string, Rarity>;
    remainingPacks: number;
    totalPacks?: number;
    hasProtection?: boolean;
    isFeatured?: boolean;
    isActive?: boolean;
    agentId?: string;
    description?: string;
    imageUrl?: string;
    startsAt?: any;
    expiresAt?: any;
    currency?: 'diamond' | 'p-point';
    type?: string;
    name?: string;
    categoryId?: string;
    lastPrizeCardId?: string;
    lockedBy?: string;
    lockedAt?: { seconds: number; nanoseconds: number; };
    dailyLimit?: number;
    minLevel?: string;
    isAdult?: boolean;
    allowFreeDraw?: boolean;
    isEventPool?: boolean;
    exclusiveTicketOnly?: boolean;
    eventTicketName?: string;
    eventRules?: string;
    eventMaxDrawsPerUser?: number;
    // 一番賞自選號碼模式 (Pick a number)
    enablePickNumber?: boolean;
    totalTicketsCount?: number;
    kujiTickets?: KujiTicketItem[];
    // Blez 盲盒模式（隱藏機率、剩餘數量與大獎是否已被抽出）
    isBlindBoxMode?: boolean;
    // 明池盲開 ＋ 隱藏 SP 賞綜合模式
    isHybridBlindSpMode?: boolean;
    presetUsed?: string;
    snipeAlertThreshold?: number;
    snipeWebhookUrl?: string;
    cardTiers?: Record<string, HybridTierCode>;
    cardCosts?: Record<string, number>;
    cardCertNumbers?: Record<string, string>;
    spBuybackPoints?: Record<string, number>;
    lastPrizeCost?: number;
    spRevealed?: boolean;
    healthStatus?: 'green' | 'yellow' | 'red';
    actualCogs?: number;
    actualPayoutPct?: number;
    actualGrossProfit?: number;
}

export type DrawnPrize =
    | (Card & {
          rarity: Rarity;
          type: 'card' | 'last-prize';
          serialNumber?: string;
          ticketNumber?: number;
          tierCode?: HybridTierCode;
          buybackPoints?: number;
          isHiddenSp?: boolean;
          userCardId?: string;
      })
    | (PointPrize & {
          type: 'points';
          rarity: Rarity;
          ticketNumber?: number;
          tierCode?: HybridTierCode;
      });

export type Step = 'init-loading' | 'waiting-to-start' | 'loading' | 'summoning' | 'ready-to-reveal' | 'revealing' | 'done' | 'error';
