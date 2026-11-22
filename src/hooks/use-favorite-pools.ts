'use client';

import { useState, useEffect, useCallback } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { useFirestore, useUser } from '@/firebase';

const STORAGE_KEY = 'pcarder_favorite_pool_ids';
const SYNC_EVENT = 'pcarder-favorite-pools-changed';

function readLocalFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeLocalFavorites(ids: string[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: ids }));
  } catch {
    // ignore storage errors
  }
}

export function useFavoritePools(remoteFavoriteIds?: string[] | null) {
  const { user } = useUser();
  const firestore = useFirestore();
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readLocalFavorites());

  // 同步來自 Firestore userProfile 的收藏清單（聯集，避免覆蓋未登入時剛點選的追蹤）
  useEffect(() => {
    if (!Array.isArray(remoteFavoriteIds) || remoteFavoriteIds.length === 0) return;
    setFavoriteIds((prev) => {
      const merged = Array.from(new Set([...remoteFavoriteIds, ...prev]));
      if (merged.length !== prev.length) {
        writeLocalFavorites(merged);
      }
      return merged;
    });
  }, [remoteFavoriteIds]);

  // 跨元件即時同步（在 PoolCard 點愛心時，DrawPage 的「我的追蹤」膠囊與尾盤提醒立即更新）
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: Event) => {
      const ce = e as CustomEvent<string[]>;
      if (Array.isArray(ce.detail)) {
        setFavoriteIds(ce.detail);
      }
    };
    window.addEventListener(SYNC_EVENT, handler);
    return () => window.removeEventListener(SYNC_EVENT, handler);
  }, []);

  const toggleFavorite = useCallback(
    (poolId: string): boolean => {
      const current = readLocalFavorites();
      const exists = current.includes(poolId);
      const next = exists ? current.filter((id) => id !== poolId) : [...current, poolId];
      setFavoriteIds(next);
      writeLocalFavorites(next);

      if (user?.uid && firestore) {
        updateDoc(doc(firestore, 'users', user.uid), {
          favoritePoolIds: next,
        }).catch(() => {
          // 靜默保留本地追蹤狀態
        });
      }

      return !exists;
    },
    [user?.uid, firestore]
  );

  const isFavorite = useCallback(
    (poolId: string) => favoriteIds.includes(poolId),
    [favoriteIds]
  );

  return {
    favoriteIds,
    isFavorite,
    toggleFavorite,
  };
}
