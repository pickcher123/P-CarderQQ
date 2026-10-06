export type Rarity = 'legendary' | 'rare' | 'common';

export interface Card {
    id: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
    imageHint: string;
    category: string;
    sellPrice?: number;
    isSold?: boolean;
}

export interface PointPrize {
    prizeId: string;
    points: number;
    quantity: number;
    rarity: Rarity;
    name?: string;
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
    cards: { cardId: string; quantity: number }[];
    pointPrizes?: PointPrize[];
    cardRarities: Record<string, Rarity>;
    remainingPacks: number;
    totalPacks?: number;
    hasProtection?: boolean;
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
}

export type DrawnPrize = (Card & { rarity: Rarity; type: 'card' | 'last-prize'; serialNumber?: string; ticketNumber?: number }) | (PointPrize & { type: 'points'; rarity: Rarity; ticketNumber?: number });

export type Step = 'init-loading' | 'waiting-to-start' | 'loading' | 'summoning' | 'ready-to-reveal' | 'revealing' | 'done' | 'error';
