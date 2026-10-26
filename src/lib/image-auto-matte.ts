/**
 * 智慧卡片圖片去背與黑邊消除工具 (Smart Card Auto-Matte & Black Border Removal)
 * 
 * 解決痛點：
 * 拍實體卡片 / 鑑定卡殼 (PSA/BGS/CGC) 時，照片四周往往有黑色桌布、暗色邊框或裁切殘留黑條。
 * 本模組提供：
 * 1. 外圍連通區域去黑底 (Exterior Flood-Fill Alpha Mask)：僅清除從圖片外邊緣連通向內的深色背景，絕不破壞卡片內部文字與黑色圖案。
 * 2. 邊緣微羽化抗鋸齒 (Anti-aliasing Feathering)：讓透明過渡極其平滑，告別生硬黑邊。
 * 3. 前端高效快取 (In-Memory Cache)：相同圖片不重複計算，瞬間返回。
 */

const mattedImageCache = new Map<string, string>();

export interface AutoMatteOptions {
  /** 判定為背景黑色的亮度閥值 (0~255)，預設 42 */
  darkThreshold?: number;
  /** 外圍微收邊像素 (0~6px)，預設 2px，可切除微細邊緣相框黑縫 */
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
  
  // 檢查快取
  const cacheKey = `${imageUrl}_th${options.darkThreshold || 42}_in${options.trimInset ?? 2}`;
  if (mattedImageCache.has(cacheKey)) {
    return mattedImageCache.get(cacheKey)!;
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      try {
        const width = img.naturalWidth || img.width;
        const height = img.naturalHeight || img.height;
        if (!width || !height) {
          resolve(imageUrl);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) {
          resolve(imageUrl);
          return;
        }

        ctx.drawImage(img, 0, 0);
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        const threshold = options.darkThreshold ?? 42;
        const trimInset = options.trimInset ?? 2;
        const feather = options.feather ?? true;

        // 快速判斷像素是否為深黑/暗色雜邊
        const isDarkPixel = (idx: number) => {
          const a = data[idx + 3];
          if (a < 15) return true; // 已經是透明的
          const r = data[idx];
          const g = data[idx + 1];
          const b = data[idx + 2];
          // 亮度和最大色差（確保不是深藍或深紅，而是純深灰黑背景）
          const brightness = (r * 0.299 + g * 0.587 + b * 0.114);
          const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
          return brightness < threshold && maxDiff < 25;
        };

        // 建立訪問與背景標記矩陣
        const totalPixels = width * height;
        const isBackground = new Uint8Array(totalPixels);
        const visited = new Uint8Array(totalPixels);

        // 使用 BFS 佇列從 4 個外圍邊界的像素開始擴散
        // 只有與邊界連通的黑底才會被標記，卡片內部的黑色內容 100% 安全
        const queue: number[] = [];

        // 加入上下邊界
        for (let x = 0; x < width; x++) {
          // 頂邊
          const topIdx = (0 * width + x);
          if (isDarkPixel(topIdx * 4)) {
            visited[topIdx] = 1;
            isBackground[topIdx] = 1;
            queue.push(topIdx);
          }
          // 底邊
          const btmIdx = ((height - 1) * width + x);
          if (isDarkPixel(btmIdx * 4)) {
            visited[btmIdx] = 1;
            isBackground[btmIdx] = 1;
            queue.push(btmIdx);
          }
        }

        // 加入左右邊界
        for (let y = 0; y < height; y++) {
          // 左邊
          const leftIdx = (y * width + 0);
          if (!visited[leftIdx] && isDarkPixel(leftIdx * 4)) {
            visited[leftIdx] = 1;
            isBackground[leftIdx] = 1;
            queue.push(leftIdx);
          }
          // 右邊
          const rightIdx = (y * width + (width - 1));
          if (!visited[rightIdx] && isDarkPixel(rightIdx * 4)) {
            visited[rightIdx] = 1;
            isBackground[rightIdx] = 1;
            queue.push(rightIdx);
          }
        }

        // 若圖片四周邊界都沒有黑色像素，說明這張圖本身已無黑邊，直接返回
        if (queue.length === 0 && trimInset === 0) {
          mattedImageCache.set(cacheKey, imageUrl);
          resolve(imageUrl);
          return;
        }

        // BFS 洪水填充擴散
        let head = 0;
        while (head < queue.length) {
          const curr = queue[head++];
          const cx = curr % width;
          const cy = Math.floor(curr / width);

          // 4 鄰近像素
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

        // 應用背景透明度與收邊羽化
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const pIdx = y * width + x;
            const dataIdx = pIdx * 4;

            // 若是被標記的外圍黑底
            if (isBackground[pIdx]) {
              data[dataIdx + 3] = 0; // Alpha 設為 0 完全透明
            } else if (trimInset > 0) {
              // 檢查與邊界或背景的距離，如果在邊緣 1~2px 內且為暗色，平滑弱化
              const isNearBorder = (x < trimInset || x >= width - trimInset || y < trimInset || y >= height - trimInset);
              if (isNearBorder && isDarkPixel(dataIdx)) {
                data[dataIdx + 3] = 0;
              } else if (feather) {
                // 檢查是否與透明背景相鄰，做邊緣羽化
                const hasTransparentNeighbor = 
                  (cx_check(x - 1, y, width, height, isBackground)) ||
                  (cx_check(x + 1, y, width, height, isBackground)) ||
                  (cx_check(x, y - 1, width, height, isBackground)) ||
                  (cx_check(x, y + 1, width, height, isBackground));

                if (hasTransparentNeighbor) {
                  // 邊緣微羽化，消除鋸齒
                  data[dataIdx + 3] = Math.round(data[dataIdx + 3] * 0.7);
                }
              }
            }
          }
        }

        ctx.putImageData(imgData, 0, 0);
        const resultUrl = canvas.toDataURL('image/webp', 0.95) || canvas.toDataURL('image/png');
        mattedImageCache.set(cacheKey, resultUrl);
        resolve(resultUrl);
      } catch (err) {
        console.warn('Auto matte failed, fallback to original:', err);
        resolve(imageUrl);
      }
    };

    img.onerror = () => {
      resolve(imageUrl);
    };

    img.src = imageUrl;
  });
}

function cx_check(x: number, y: number, w: number, h: number, isBg: Uint8Array): boolean {
  if (x < 0 || x >= w || y < 0 || y >= h) return true;
  return isBg[y * w + x] === 1;
}
