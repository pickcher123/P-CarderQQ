'use client';

import { useState, useEffect } from 'react';

export interface AutoMatteOptions {
  darkThreshold?: number;
  trimInset?: number;
  feather?: boolean;
}

// 記憶體快取已去背後的 transparent PNG Data URL，避免重複運算
const clientMatteCache = new Map<string, string>();

/**
 * 使用 Canvas 邊緣泛洪演算法 (Edge Flood-Fill) 去除卡片外圍黑底並自動裁切留白
 * 僅從圖片四邊向外連通的暗色像素進行透明化，不會誤傷卡片內部的深色球衣或頭髮
 */
async function removeBlackBackgroundOnCanvas(
  fetchUrl: string,
  darkThreshold = 52,
  trimInset = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.decoding = 'async';

    img.onload = () => {
      try {
        const srcW = img.naturalWidth || img.width;
        const srcH = img.naturalHeight || img.height;
        if (!srcW || !srcH) {
          resolve(fetchUrl);
          return;
        }

        // 縮放至最大邊長 640px 進行高速像素處理
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(srcW, srcH));
        const w = Math.max(1, Math.round(srcW * scale));
        const h = Math.max(1, Math.round(srcH * scale));

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(fetchUrl);
          return;
        }

        ctx.drawImage(img, 0, 0, w, h);
        const imageData = ctx.getImageData(0, 0, w, h);
        const data = imageData.data;

        const isDark = (idx: number) => {
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          const a = data[idx + 3];
          if (a < 15) return true;
          // 檢查亮度與低飽和度（避免誤刪鮮豔深色邊框）
          const maxC = Math.max(r, g, b);
          const minC = Math.min(r, g, b);
          return maxC <= darkThreshold && (maxC - minC) <= 28;
        };

        const visited = new Uint8Array(w * h);
        const queue = new Int32Array(w * h);
        let head = 0;
        let tail = 0;

        const pushIfDark = (x: number, y: number) => {
          const pos = y * w + x;
          if (visited[pos]) return;
          if (isDark(pos * 4)) {
            visited[pos] = 1;
            queue[tail++] = pos;
          }
        };

        // 從四條外邊界開始 BFS 泛洪
        for (let x = 0; x < w; x++) {
          pushIfDark(x, 0);
          pushIfDark(x, h - 1);
        }
        for (let y = 1; y < h - 1; y++) {
          pushIfDark(0, y);
          pushIfDark(w - 1, y);
        }

        while (head < tail) {
          const pos = queue[head++];
          const px = pos % w;
          const py = (pos - px) / w;

          // 將連通的黑底設為完全透明
          data[pos * 4 + 3] = 0;

          if (px > 0) pushIfDark(px - 1, py);
          if (px < w - 1) pushIfDark(px + 1, py);
          if (py > 0) pushIfDark(px, py - 1);
          if (py < h - 1) pushIfDark(px, py + 1);
        }

        // 邊緣柔化：將緊鄰透明區且偏暗的 1px 鋸齒邊緣半透明化
        for (let y = 1; y < h - 1; y++) {
          for (let x = 1; x < w - 1; x++) {
            const pos = y * w + x;
            const idx = pos * 4;
            if (data[idx + 3] === 0) continue;

            const hasTransparentNeighbor =
              data[(pos - 1) * 4 + 3] === 0 ||
              data[(pos + 1) * 4 + 3] === 0 ||
              data[(pos - w) * 4 + 3] === 0 ||
              data[(pos + w) * 4 + 3] === 0;

            if (hasTransparentNeighbor) {
              const maxC = Math.max(data[idx], data[idx + 1], data[idx + 2]);
              if (maxC <= darkThreshold + 24) {
                data[idx + 3] = Math.round(data[idx + 3] * 0.45);
              }
            }
          }
        }

        ctx.putImageData(imageData, 0, 0);

        // 自動裁切透明邊界 (Auto-Trim)
        let minX = w, minY = h, maxX = -1, maxY = -1;
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            if (data[(y * w + x) * 4 + 3] > 20) {
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (maxX <= minX || maxY <= minY) {
          resolve(fetchUrl);
          return;
        }

        const cropX = Math.min(maxX, minX + trimInset);
        const cropY = Math.min(maxY, minY + trimInset);
        const cropW = Math.max(1, maxX - cropX + 1 - trimInset);
        const cropH = Math.max(1, maxY - cropY + 1 - trimInset);

        const outCanvas = document.createElement('canvas');
        outCanvas.width = cropW;
        outCanvas.height = cropH;
        const outCtx = outCanvas.getContext('2d');
        if (!outCtx) {
          resolve(fetchUrl);
          return;
        }

        outCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        resolve(outCanvas.toDataURL('image/png'));
      } catch {
        resolve(fetchUrl);
      }
    };

    img.onerror = () => reject(new Error('Failed to load image for matting'));
    img.src = fetchUrl;
  });
}

/**
 * 自動為卡片圖片執行黑邊消除與去背的 React Hook
 * 使用 Canvas 邊緣泛洪演算法自動去除黑底並裁切留白，跨平台皆可穩定去背
 */
export function useAutoMatteImage(
  src: string | undefined | null,
  options?: AutoMatteOptions
): string {
  const darkThreshold = options?.darkThreshold ?? 55;
  const trimInset = options?.trimInset ?? 1;

  const [mattedSrc, setMattedSrc] = useState<string>(() => {
    if (!src || typeof src !== 'string') return '';
    return clientMatteCache.get(src.trim()) || '';
  });

  useEffect(() => {
    if (!src || typeof src !== 'string') {
      setMattedSrc('');
      return;
    }

    const trimmed = src.trim();
    if (!trimmed) {
      setMattedSrc('');
      return;
    }

    if (clientMatteCache.has(trimmed)) {
      setMattedSrc(clientMatteCache.get(trimmed)!);
      return;
    }

    // 外部圖片透過同源代理抓取以避開 Canvas CORS 限制（不依賴伺服器端 ImageMagick）
    const fetchUrl =
      trimmed.startsWith('http://') || trimmed.startsWith('https://')
        ? `/api/image-proxy?url=${encodeURIComponent(trimmed)}`
        : trimmed;

    let cancelled = false;
    removeBlackBackgroundOnCanvas(fetchUrl, darkThreshold, trimInset)
      .then((resultUrl) => {
        if (cancelled) return;
        if (resultUrl.startsWith('data:image/png')) {
          clientMatteCache.set(trimmed, resultUrl);
          setMattedSrc(resultUrl);
        } else {
          setMattedSrc(trimmed);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMattedSrc(trimmed);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [src, darkThreshold, trimInset]);

  return mattedSrc;
}
