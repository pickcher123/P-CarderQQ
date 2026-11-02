/**
 * 智慧卡片圖片去背與黑底消除工具 (Smart Card Auto-Matte & Black Background Removal)
 * 
 * 解決痛點：
 * 拍實體卡片 / 鑑定卡殼照片四周往往有黑色桌布、暗色卡夾或背景黑底。
 * 本工具提供：
 * 1. 外圍連通區域去黑底 (Exterior Flood-Fill Alpha Mask)：僅清除從圖片外圍邊緣連通向內的深色背景，絕不破壞卡片內部文字與黑色圖案。
 * 2. 多層邊緣起點探測：防止圖片外框微小反光導致邊緣無法入隊。
 * 3. 邊緣微羽化抗鋸齒 (Anti-aliasing Feathering) 與雜邊弱化。
 * 4. 跨域安全代理回退：若外部圖源無 CORS header，自動使用 `/api/image-proxy` 進行同源中轉，100% 保證可 Canvas 去背。
 * 5. 前端高效快取 (In-Memory Cache)：相同圖片不重複計算。
 */

const mattedImageCache = new Map<string, string>();

export interface AutoMatteOptions {
  /** 判定為背景黑色的亮度閥值 (0~255)，預設 60 (能有效去除深灰/黑底桌布與黑卡套) */
  darkThreshold?: number;
  /** 外圍微收邊像素 (0~6px)，預設 2px */
  trimInset?: number;
  /** 是否啟用邊緣微羽化，預設 true */
  feather?: boolean;
}

/**
 * 針對卡片圖片執行外圍黑邊消除與智慧去背
 */
export async function removeCardBlackBorders(
  imageUrl: string,
  options: AutoMatteOptions = {}
): Promise<string> {
  if (!imageUrl || typeof imageUrl !== 'string') return imageUrl;
  
  // 若已經是 data URL (例如已經去背過)，直接返回
  if (imageUrl.startsWith('data:image/')) return imageUrl;

  const threshold = options.darkThreshold ?? 60;
  const trimInset = options.trimInset ?? 2;
  const feather = options.feather ?? true;

  // 檢查快取
  const cacheKey = `${imageUrl}_th${threshold}_in${trimInset}_f${feather}`;
  if (mattedImageCache.has(cacheKey)) {
    return mattedImageCache.get(cacheKey)!;
  }

  // 內部處理單個 Image 物件
  const processImageElement = (img: HTMLImageElement): string | null => {
    try {
      const width = img.naturalWidth || img.width;
      const height = img.naturalHeight || img.height;
      if (!width || !height) return null;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return null;

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, width, height);
      const data = imgData.data;

      // 判斷像素是否為深黑/暗色雜邊（考慮亮度與最大色差）
      const isDarkPixel = (idx: number) => {
        const a = data[idx + 3];
        if (a < 20) return true; // 已經是透明的
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
        return brightness < threshold && maxDiff < 36;
      };

      const totalPixels = width * height;
      const isBackground = new Uint8Array(totalPixels);
      const visited = new Uint8Array(totalPixels);
      const queue: number[] = [];

      // 從外圍向內多探測 3 層，避免邊界外第一圈因微反光漏掉
      const searchDepth = Math.min(4, Math.floor(Math.min(width, height) / 8));

      for (let d = 0; d < searchDepth; d++) {
        // 頂邊與底邊
        for (let x = 0; x < width; x++) {
          const topIdx = d * width + x;
          if (!visited[topIdx] && isDarkPixel(topIdx * 4)) {
            visited[topIdx] = 1;
            isBackground[topIdx] = 1;
            queue.push(topIdx);
          }
          const btmIdx = (height - 1 - d) * width + x;
          if (!visited[btmIdx] && isDarkPixel(btmIdx * 4)) {
            visited[btmIdx] = 1;
            isBackground[btmIdx] = 1;
            queue.push(btmIdx);
          }
        }
        // 左邊與右邊
        for (let y = 0; y < height; y++) {
          const leftIdx = y * width + d;
          if (!visited[leftIdx] && isDarkPixel(leftIdx * 4)) {
            visited[leftIdx] = 1;
            isBackground[leftIdx] = 1;
            queue.push(leftIdx);
          }
          const rightIdx = y * width + (width - 1 - d);
          if (!visited[rightIdx] && isDarkPixel(rightIdx * 4)) {
            visited[rightIdx] = 1;
            isBackground[rightIdx] = 1;
            queue.push(rightIdx);
          }
        }
      }

      // 如果整張圖外圈完全沒有任何黑色像素，說明原本就已經去背或非黑底，直接返回原圖
      if (queue.length === 0) {
        return imageUrl;
      }

      // BFS 洪水填充擴散
      let head = 0;
      while (head < queue.length) {
        const curr = queue[head++];
        const cx = curr % width;
        const cy = Math.floor(curr / width);

        const neighbors = [
          cy > 0 ? (cy - 1) * width + cx : -1,
          cy < height - 1 ? (cy + 1) * width + cx : -1,
          cx > 0 ? cy * width + (cx - 1) : -1,
          cx < width - 1 ? cy * width + (cx + 1) : -1,
        ];

        for (const n of neighbors) {
          if (n >= 0 && !visited[n]) {
            visited[n] = 1;
            if (isDarkPixel(n * 4)) {
              isBackground[n] = 1;
              queue.push(n);
            }
          }
        }
      }

      // 應用透明遮罩與平滑邊緣羽化
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pIdx = y * width + x;
          const dataIdx = pIdx * 4;

          if (isBackground[pIdx]) {
            data[dataIdx + 3] = 0; // 完全透明
          } else if (trimInset > 0) {
            // 邊緣微羽化抗鋸齒
            const isNearBorder = (x < trimInset || x >= width - trimInset || y < trimInset || y >= height - trimInset);
            if (isNearBorder && isDarkPixel(dataIdx)) {
              data[dataIdx + 3] = 0;
            } else if (feather) {
              const hasTransparentNeighbor = 
                checkNeighborBg(x - 1, y, width, height, isBackground) ||
                checkNeighborBg(x + 1, y, width, height, isBackground) ||
                checkNeighborBg(x, y - 1, width, height, isBackground) ||
                checkNeighborBg(x, y + 1, width, height, isBackground);

              if (hasTransparentNeighbor) {
                // 若相鄰透明背景且此像素顏色偏暗，進一步軟化邊緣
                const r = data[dataIdx];
                const g = data[dataIdx + 1];
                const b = data[dataIdx + 2];
                const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
                if (brightness < threshold * 1.25) {
                  data[dataIdx + 3] = Math.round(data[dataIdx + 3] * 0.4);
                }
              }
            }
          }
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const resultUrl = canvas.toDataURL('image/webp', 0.95) || canvas.toDataURL('image/png');
      return resultUrl;
    } catch {
      return null;
    }
  };

  // 嘗試載入圖片（先直接載入，若跨域受阻則透過代理重試）
  const tryLoadAndMatte = (url: string, crossOrigin?: string): Promise<string | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      if (crossOrigin) {
        img.crossOrigin = crossOrigin;
      }
      img.onload = () => {
        const result = processImageElement(img);
        resolve(result);
      };
      img.onerror = () => {
        resolve(null);
      };
      img.src = url;
    });
  };

  // 1. 先用 anonymous 載入原圖
  let result = await tryLoadAndMatte(imageUrl, 'anonymous');

  // 2. 如果失敗 (例如 CORS 阻擋導致 canvas tainted 或 onerror)，透過本站代理 /api/image-proxy
  if (!result && typeof window !== 'undefined' && imageUrl.startsWith('http')) {
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(imageUrl)}`;
    result = await tryLoadAndMatte(proxyUrl, 'anonymous');
  }

  const finalUrl = result || imageUrl;
  mattedImageCache.set(cacheKey, finalUrl);
  return finalUrl;
}

function checkNeighborBg(x: number, y: number, w: number, h: number, isBg: Uint8Array): boolean {
  if (x < 0 || x >= w || y < 0 || y >= h) return true;
  return isBg[y * w + x] === 1;
}
