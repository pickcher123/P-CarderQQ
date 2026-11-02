'use client';

import { useMemo } from 'react';

export interface AutoMatteOptions {
  darkThreshold?: number;
  trimInset?: number;
  feather?: boolean;
}

/**
 * 自動為卡片圖片執行黑邊消除與去背的 React Hook
 * 透過 /api/image-proxy?matte=1 瞬間返回已去除黑底與黑邊裁切的透明卡牌
 */
export function useAutoMatteImage(
  src: string | undefined | null,
  options?: AutoMatteOptions
): string {
  return useMemo(() => {
    if (!src || typeof src !== 'string') return '';
    const trimmed = src.trim();
    if (!trimmed) return '';

    // 如果已經是 data URL 或是內部 local asset (例如 /assets/...)
    if (trimmed.startsWith('data:') || trimmed.startsWith('/assets/')) {
      return trimmed;
    }

    // 若是外部 HTTP/HTTPS 圖片 (例如 Firebase Storage)，使用本站代理直接完成黑底消除與裁切
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return `/api/image-proxy?url=${encodeURIComponent(trimmed)}&matte=1`;
    }

    return trimmed;
  }, [src]);
}

