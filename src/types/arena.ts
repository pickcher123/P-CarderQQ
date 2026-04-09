
export interface ArenaChallenge {
    id: string;
    name: string;
    prizeCardId: string;
    challengeCost: number;
    baseWinChance: number; // Base win chance from 0.0 to 1.0
    order: number;
    active: boolean;
}

export interface CardData {
    id: string;
    name: string;
    category: string;
    imageUrl: string;
    imageHint?: string;
    sellPrice?: number;
}

export interface UserCardData {
    id: string; // This is the unique ID of the document in the userCards sub-collection
    cardId: string; // This is the ID referencing a card in the allCards collection
    category: string;
    isFoil: boolean;
    rarity: string;
}

export type MergedCard = CardData & UserCardData;

export interface UserArenaProgress {
    challengeId: string;
    userId: string;
    consecutiveLosses: number;
}
