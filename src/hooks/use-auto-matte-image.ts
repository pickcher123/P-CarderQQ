'use client';

import { useState, useEffect } from 'react';
import { removeCardBlackBorders, AutoMatteOptions } from '@/lib/image-auto-matte';

/**
 * 自動為卡片圖片執行黑邊消除與去背的 React Hook
 */
export function useAutoMatteImage(
  src: string | undefined | null,
  options?: AutoMatteOptions
): string {
  const [cleanedSrc, setCleanedSrc] = useState<string>(src || '');

  useEffect(() => {
    if (!src) {
      setCleanedSrc('');
      return;
    }

    let isMounted = true;

    // 先顯示原圖，避免空白
    setCleanedSrc(src);

    // 異步執行去黑邊處理
    removeCardBlackBorders(src, options).then((res) => {
      if (isMounted && res) {
        setCleanedSrc(res);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [src, options?.darkThreshold, options?.trimInset, options?.feather]);

  return cleanedSrc || src || '';
}
