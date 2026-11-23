'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  collection,
  documentId,
  getDocs,
  query,
  where,
  type Firestore,
} from 'firebase/firestore';

export interface PoolCardTemplate {
  id: string;
  name: string;
  imageUrl: string;
  imageHint: string;
  backImageUrl?: string;
  isSold?: boolean;
  [key: string]: any;
}

// 跨頁面共享的模組級卡片快取：在 /draw、/draw/open、/bet、/lucky-bags 間切換時直接命中記憶體，不重複抓整座 allCards
const sharedCardsCache = new Map<string, PoolCardTemplate>();
const fetchedCardIds = new Set<string>();
const inFlightCardIds = new Set<string>();

/**
 * 收集卡池陣列實際會顯示到的所有 cardId（去重）
 */
function collectPoolCardIds(pools: any[] | null | undefined): string[] {
  if (!pools || pools.length === 0) return [];
  const ids = new Set<string>();

  for (const pool of pools) {
    if (!pool) continue;
    if (pool.lastPrizeCardId) ids.add(pool.lastPrizeCardId);
    if (Array.isArray(pool.cards)) {
      for (const c of pool.cards) {
        if (c?.cardId) ids.add(c.cardId);
      }
    }
    if (Array.isArray(pool.kujiTickets)) {
      for (const t of pool.kujiTickets) {
        if (t?.cardId) ids.add(t.cardId);
      }
    }
    if (pool.cardRarities && typeof pool.cardRarities === 'object') {
      for (const id of Object.keys(pool.cardRarities)) {
        if (id) ids.add(id);
      }
    }
  }

  return Array.from(ids);
}

/**
 * 按需批次載入指定 cardIds 的卡片模板（附帶載入狀態），
 * 取代原本下載整座 allCards 資料庫集合，並跨頁面快取。
 */
export function useCardTemplatesByIdsWithState(
  firestore: Firestore | null,
  cardIds: string[] | null | undefined
): { cardsMap: Map<string, PoolCardTemplate>; isLoading: boolean } {
  const [version, setVersion] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const cardIdsKey = useMemo(() => {
    if (!cardIds || cardIds.length === 0) return '';
    const unique = Array.from(new Set(cardIds.filter(Boolean)));
    unique.sort();
    return unique.join(',');
  }, [cardIds]);

  useEffect(() => {
    if (!firestore || !cardIdsKey) {
      setIsLoading(false);
      return;
    }
    const allIds = cardIdsKey.split(',').filter(Boolean);
    const missingIds = allIds.filter(
      (id) => !fetchedCardIds.has(id) && !inFlightCardIds.has(id)
    );
    if (missingIds.length === 0) {
      setIsLoading(allIds.some((id) => inFlightCardIds.has(id)));
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    missingIds.forEach((id) => inFlightCardIds.add(id));

    const chunks: string[][] = [];
    for (let i = 0; i < missingIds.length; i += 30) {
      chunks.push(missingIds.slice(i, i + 30));
    }

    Promise.all(
      chunks.map(async (chunk) => {
        try {
          const snap = await getDocs(
            query(collection(firestore, 'allCards'), where(documentId(), 'in', chunk))
          );
          snap.forEach((d) => {
            const data = d.data() as Record<string, any>;
            sharedCardsCache.set(d.id, {
              ...data,
              id: d.id,
              name: data.name ?? '',
              imageUrl: data.imageUrl ?? '',
              imageHint: data.imageHint ?? '',
            });
          });
          chunk.forEach((id) => fetchedCardIds.add(id));
        } catch {
          // 單批失敗不影響其他批次
        }
      })
    )
      .finally(() => {
        missingIds.forEach((id) => inFlightCardIds.delete(id));
        if (!cancelled) {
          setVersion((v) => v + 1);
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [firestore, cardIdsKey]);

  const cardsMap = useMemo(() => {
    void version;
    return new Map(sharedCardsCache);
  }, [version, cardIdsKey]);

  return { cardsMap, isLoading };
}

/**
 * 按需批次載入指定 cardIds 的卡片模板（每次最多 30 筆 documentId IN 查詢），
 * 取代原本下載整座 allCards 資料庫集合，並跨頁面快取。
 */
export function useCardTemplatesByIds(
  firestore: Firestore | null,
  cardIds: string[] | null | undefined
): Map<string, PoolCardTemplate> {
  return useCardTemplatesByIdsWithState(firestore, cardIds).cardsMap;
}

/**
 * 按需批次載入卡池實際使用的卡片模板（每次最多 30 筆 documentId IN 查詢），
 * 取代原本下載整座 allCards 資料庫集合，並跨頁面快取。
 */
export function usePoolCardsMap(
  firestore: Firestore | null,
  pools: any[] | null | undefined
): Map<string, PoolCardTemplate> {
  const cardIds = useMemo(() => collectPoolCardIds(pools), [pools]);
  return useCardTemplatesByIds(firestore, cardIds);
}
