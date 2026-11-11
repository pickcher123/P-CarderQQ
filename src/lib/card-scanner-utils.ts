import JSZip from 'jszip';
import { v4 as uuidv4 } from 'uuid';

export interface CropBox {
  id: string;
  // 歸一化座標 (0 ~ 100)
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // 角度 (-180 ~ 180)
}

export interface ScannedCardItem {
  id: string;
  index: number;
  // 正面
  frontCropBox: CropBox;
  frontPreview?: string;
  frontBlob?: Blob;
  
  // 背面 (不需文字，自動對應)
  backCropBox?: CropBox;
  backPreview?: string;
  backBlob?: Blob;

  // 卡片資訊 (僅由正面/AI 產生)
  name: string;
  category: string;
  sellPrice: number;
  grade?: string;
  rarity?: string;
  cardNumber?: string;
  features?: string[];
  description?: string;
  targetArea?: string; // 'all' | 'draw' | 'betting' | 'lucky-bag' | 'group-break'

  // PSA / BGS 評級標籤文字辨識
  slabLabelText?: string;
  certNumber?: string;
  subgrades?: string;
  formattedTitle?: string;

  // 白色貼紙/標籤去除狀態與原圖備份
  hasRemovedSticker?: boolean;
  originalFrontBlob?: Blob;
  originalFrontPreview?: string;

  // 卡價市場行情
  priceRange?: string;
  priceRationale?: string;
  isPriceChecking?: boolean;

  isAiRecognizing?: boolean;
  isOcrRunning?: boolean;
  isRemovingSticker?: boolean;
}

/**
 * 依據原始圖片的高解析度尺寸，對指定的 CropBox 進行無損旋轉與裁切
 */
export async function cropImageFromSource(
  imageElement: HTMLImageElement,
  cropBox: CropBox,
  mimeType: string = 'image/png',
  quality: number = 0.95
): Promise<{ blob: Blob; dataUrl: string; optimizedDataUrl: string }> {
  return new Promise((resolve, reject) => {
    try {
      const naturalWidth = imageElement.naturalWidth;
      const naturalHeight = imageElement.naturalHeight;

      // 計算在原始大圖上的像素位置與尺寸
      const pixelX = (cropBox.x / 100) * naturalWidth;
      const pixelY = (cropBox.y / 100) * naturalHeight;
      const pixelWidth = (cropBox.width / 100) * naturalWidth;
      const pixelHeight = (cropBox.height / 100) * naturalHeight;

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // 如果有旋轉角度
      const rotationRad = (cropBox.rotation * Math.PI) / 180;
      const is90or270 = Math.abs(cropBox.rotation % 180) === 90;

      if (is90or270) {
        canvas.width = Math.round(pixelHeight);
        canvas.height = Math.round(pixelWidth);
      } else {
        canvas.width = Math.round(pixelWidth);
        canvas.height = Math.round(pixelHeight);
      }

      ctx.save();
      // 移動至中心旋轉
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate(rotationRad);

      // 繪製裁切區域
      ctx.drawImage(
        imageElement,
        pixelX,
        pixelY,
        pixelWidth,
        pixelHeight,
        -pixelWidth / 2,
        -pixelHeight / 2,
        pixelWidth,
        pixelHeight
      );
      ctx.restore();

      // 另行生成輕量化、極高清晰度儲存專用 Data URL（最大寬度 720px）
      let optimizedDataUrl = '';
      try {
        const optMaxW = 720;
        let optW = canvas.width;
        let optH = canvas.height;
        if (optW > optMaxW) {
          optH = Math.round((optH * optMaxW) / optW);
          optW = optMaxW;
        }
        const optCanvas = document.createElement('canvas');
        optCanvas.width = optW;
        optCanvas.height = optH;
        const optCtx = optCanvas.getContext('2d');
        if (optCtx) {
          optCtx.drawImage(canvas, 0, 0, optW, optH);
          // 使用 webp 或 png 保留 Alpha 透明度通道，避免產生醜陋黑邊或黑角
          optimizedDataUrl = optCanvas.toDataURL('image/webp', 0.9) || optCanvas.toDataURL('image/png');
        }
      } catch (optErr) {
        console.warn('Optimized dataUrl generation fallback:', optErr);
      }

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          const dataUrl = canvas.toDataURL(mimeType, quality);
          resolve({ blob, dataUrl, optimizedDataUrl: optimizedDataUrl || dataUrl });
        },
        mimeType,
        quality
      );
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * 將圖片縮放至適合 AI 分析的輕量解析度 (1024px，避免超出 HTTP payload 限制)
 */
export function compressImageForDetection(imageElement: HTMLImageElement, maxDimension: number = 1024): string {
  const canvas = document.createElement('canvas');
  let width = imageElement.naturalWidth;
  let height = imageElement.naturalHeight;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.round((height * maxDimension) / width);
      width = maxDimension;
    } else {
      width = Math.round((width * maxDimension) / height);
      height = maxDimension;
    }
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(imageElement, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', 0.75);
}

/**
 * 快速生成多卡網格切分 (例如 2x2, 2x3, 3x3)
 */
export function generateGridBoxes(rows: number, cols: number, padding: number = 4): CropBox[] {
  const boxes: CropBox[] = [];
  const colWidth = (100 - padding * (cols + 1)) / cols;
  const rowHeight = (100 - padding * (rows + 1)) / rows;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const x = padding + c * (colWidth + padding);
      const y = padding + r * (rowHeight + padding);
      boxes.push({
        id: `box-${r}-${c}-${uuidv4().slice(0, 8)}`,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        width: Math.round(colWidth * 10) / 10,
        height: Math.round(rowHeight * 10) / 10,
        rotation: 0,
      });
    }
  }

  return boxes;
}

/**
 * 純前端智能影像邊界備援分析（當後端網路超時時自動接手）
 */
export function detectCardBoundariesLocally(imageElement: HTMLImageElement): CropBox[] {
  try {
    const canvas = document.createElement('canvas');
    const sampleWidth = 200;
    const sampleHeight = Math.round((sampleWidth / imageElement.naturalWidth) * imageElement.naturalHeight);
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return generateGridBoxes(1, 1, 10);
    ctx.drawImage(imageElement, 0, 0, sampleWidth, sampleHeight);

    const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
    const data = imgData.data;

    // 計算四邊角落作為背景基準色
    let bgR = 0, bgG = 0, bgB = 0;
    const samplePoints = [[0, 0], [sampleWidth - 1, 0], [0, sampleHeight - 1], [sampleWidth - 1, sampleHeight - 1]];
    samplePoints.forEach(([px, py]) => {
      const idx = (py * sampleWidth + px) * 4;
      bgR += data[idx];
      bgG += data[idx + 1];
      bgB += data[idx + 2];
    });
    bgR /= 4;
    bgG /= 4;
    bgB /= 4;

    // 尋找與背景有明顯差異的前景邊界
    let minX = sampleWidth, maxX = 0, minY = sampleHeight, maxY = 0;
    let foregroundCount = 0;

    for (let y = 0; y < sampleHeight; y++) {
      for (let x = 0; x < sampleWidth; x++) {
        const idx = (y * sampleWidth + x) * 4;
        const diff = Math.abs(data[idx] - bgR) + Math.abs(data[idx + 1] - bgG) + Math.abs(data[idx + 2] - bgB);
        if (diff > 45) { // 顯著差異於背景
          foregroundCount++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (foregroundCount > (sampleWidth * sampleHeight * 0.05) && maxX > minX && maxY > minY) {
      // 找到卡片大致邊界，給予 2% 餘量
      const normX = Math.max(2, Math.round(((minX / sampleWidth) * 100) - 1));
      const normY = Math.max(2, Math.round(((minY / sampleHeight) * 100) - 1));
      const normW = Math.min(96, Math.round((((maxX - minX) / sampleWidth) * 100) + 2));
      const normH = Math.min(96, Math.round((((maxY - minY) / sampleHeight) * 100) + 2));

      return [{
        id: `local-detect-${uuidv4().slice(0, 8)}`,
        x: normX,
        y: normY,
        width: normW,
        height: normH,
        rotation: 0,
      }];
    }
  } catch (e) {
    console.warn('Local boundary detection fallback error:', e);
  }

  // 預設居中單卡框
  return [{
    id: `default-box-${uuidv4().slice(0, 8)}`,
    x: 15,
    y: 10,
    width: 70,
    height: 80,
    rotation: 0,
  }];
}

/**
 * 打包所有卡片正面與背面為 ZIP 並觸發瀏覽器下載
 */
export async function downloadCardsZip(cards: ScannedCardItem[], zipName: string = 'cards_export.zip') {
  const zip = new JSZip();

  cards.forEach((card, i) => {
    const cardNum = String(i + 1).padStart(2, '0');
    const safeName = (card.name || `Card_${cardNum}`).replace(/[/\\?%*:|"<>]/g, '_');
    const gradeTag = card.grade && card.grade !== 'RAW' ? `_${card.grade.replace(/\s+/g, '')}` : '';

    if (card.frontBlob) {
      const frontFileName = `${cardNum}_${safeName}${gradeTag}_front.jpg`;
      zip.file(frontFileName, card.frontBlob);
    }

    if (card.backBlob) {
      const backFileName = `${cardNum}_${safeName}${gradeTag}_back.jpg`;
      zip.file(backFileName, card.backBlob);
    }
  });

  const content = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(content);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 安全載入圖片物件，對 Blob 與 Data URL 自動略過 crossOrigin 避免瀏覽器安全性例外
 */
export async function safeLoadImage(source: HTMLImageElement | string): Promise<HTMLImageElement> {
  if (typeof source !== 'string') return source;
  const img = new Image();
  if (source.startsWith('http://') || source.startsWith('https://')) {
    img.crossOrigin = 'anonymous';
  }
  return new Promise((resolve, reject) => {
    img.onload = () => resolve(img);
    img.onerror = () => {
      // 備援：若帶 crossOrigin 失敗，嘗試不帶 crossOrigin 重新載入
      const fallback = new Image();
      fallback.onload = () => resolve(fallback);
      fallback.onerror = (err) => reject(new Error('圖片載入失敗，請確認檔案格式正常'));
      fallback.src = source;
    };
    img.src = source;
  });
}

/**
 * 自動精準偵測卡片左上角/頂部空白貼紙的邊界範圍 (Connected-Component Blob Detector)
 */
export async function detectWhiteStickerBox(
  imageSource: HTMLImageElement | string,
  searchRegion: { xPct: number; yPct: number; wPct: number; hPct: number } = { xPct: 0, yPct: 0, wPct: 40, hPct: 22 }
): Promise<{ x: number; y: number; width: number; height: number; found: boolean }> {
  let img: HTMLImageElement;
  try {
    img = await safeLoadImage(imageSource);
  } catch (err) {
    return { x: 0, y: 0, width: 0, height: 0, found: false };
  }

  const canvas = document.createElement('canvas');
  const w = img.naturalWidth || img.width || 500;
  const h = img.naturalHeight || img.height || 700;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { x: 0, y: 0, width: 0, height: 0, found: false };
  ctx.drawImage(img, 0, 0);

  const scanH = Math.min(h, Math.round(h * 0.22));
  const seedMaxX = Math.min(w, Math.round(w * 0.40));

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  // 判斷是否為白色/淺乳白長方形貼紙像素 (明度高且飽和度極低)
  const isWhite = (px: number, py: number) => {
    if (px < 0 || px >= w || py < 0 || py >= scanH) return false;
    const idx = (py * w + px) * 4;
    const a = data[idx + 3];
    if (a < 150) return false;
    const r = data[idx];
    const g = data[idx + 1];
    const b = data[idx + 2];
    const bright = r * 0.299 + g * 0.587 + b * 0.114;
    const maxDiff = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(b - r));
    return bright > 180 && maxDiff < 40;
  };

  const visited = new Uint8Array(w * scanH);
  const components: Array<{ minX: number; maxX: number; minY: number; maxY: number; bw: number; bh: number; count: number; density: number; aspect: number }> = [];

  for (let y = 0; y < scanH; y++) {
    for (let x = 0; x < seedMaxX; x++) {
      const idx = y * w + x;
      if (!visited[idx] && isWhite(x, y)) {
        let cMinX = x, cMaxX = x, cMinY = y, cMaxY = y, count = 0;
        const queue = [idx];
        visited[idx] = 1;
        let qHead = 0;

        while (qHead < queue.length) {
          const curr = queue[qHead++];
          count++;
          const cx = curr % w;
          const cy = Math.floor(curr / w);
          if (cx < cMinX) cMinX = cx;
          if (cx > cMaxX) cMaxX = cx;
          if (cy < cMinY) cMinY = cy;
          if (cy > cMaxY) cMaxY = cy;

          const neighbors = [
            cy > 0 ? (cy - 1) * w + cx : -1,
            cy < scanH - 1 ? (cy + 1) * w + cx : -1,
            cx > 0 ? cy * w + (cx - 1) : -1,
            cx < w - 1 ? cy * w + (cx + 1) : -1,
          ];

          for (const n of neighbors) {
            if (n >= 0 && !visited[n]) {
              const nx = n % w;
              const ny = Math.floor(n / w);
              if (isWhite(nx, ny)) {
                visited[n] = 1;
                queue.push(n);
              }
            }
          }
        }

        const bw = cMaxX - cMinX + 1;
        const bh = cMaxY - cMinY + 1;
        const density = count / (bw * bh);
        const aspect = bw / Math.max(1, bh);

        // 🌟 核心過濾條件：
        // 1. 若該白色區塊橫向延伸超過卡片寬度 42% (cMaxX > w * 0.42)，說明是整條 PSA 標籤橫幅，絕非左上角貼紙！
        // 2. 貼紙寬度在 20px 至 38% 卡寬之間，高度在 8px 至 14% 卡高之間
        // 3. 長寬比 1.4 ~ 7.0 (典型橫式貼紙)
        // 4. 填滿密度 >= 0.45，白色像素點數至少 80 顆
        if (
          cMaxX <= w * 0.42 &&
          bw >= 20 &&
          bw <= w * 0.38 &&
          bh >= 8 &&
          bh <= h * 0.14 &&
          aspect >= 1.4 &&
          aspect <= 7.0 &&
          density >= 0.45 &&
          count >= 80
        ) {
          components.push({ minX: cMinX, maxX: cMaxX, minY: cMinY, maxY: cMaxY, bw, bh, count, density, aspect });
        }
      }
    }
  }

  if (components.length > 0) {
    // 依據「面積 × 密度」排序，優先選取最具實體特徵的貼紙塊
    components.sort((a, b) => (b.count * b.density) - (a.count * a.density));
    const best = components[0];
    return {
      x: best.minX,
      y: best.minY,
      width: best.bw,
      height: best.bh,
      found: true,
    };
  }

  // 若無貼紙，精準回傳 found: false，絕不誤傷乾淨卡片
  return {
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    found: false,
  };
}

/**
 * 在卡片指定點擊座標處，以連通區域 Flood-Fill 智慧抓取貼紙邊框
 */
export async function detectStickerAtPoint(
  imageSource: HTMLImageElement | string,
  clickX: number,
  clickY: number
): Promise<{ x: number; y: number; width: number; height: number; found: boolean }> {
  let img: HTMLImageElement;
  try {
    img = await safeLoadImage(imageSource);
  } catch (err) {
    return { x: Math.max(0, clickX - 40), y: Math.max(0, clickY - 15), width: 80, height: 30, found: true };
  }

  const canvas = document.createElement('canvas');
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { x: Math.max(0, clickX - 40), y: Math.max(0, clickY - 15), width: 80, height: 30, found: true };

  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const isWhite = (px: number, py: number) => {
    if (px < 0 || px >= w || py < 0 || py >= h) return false;
    const idx = (py * w + px) * 4;
    const bright = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    const maxDiff = Math.max(Math.abs(data[idx] - data[idx + 1]), Math.abs(data[idx + 1] - data[idx + 2]), Math.abs(data[idx + 2] - data[idx]));
    return bright > 185 && maxDiff < 45;
  };

  // 檢查點擊點附近 5px 是否有白色像素
  let seedX = clickX;
  let seedY = clickY;
  let foundSeed = isWhite(seedX, seedY);

  if (!foundSeed) {
    for (let r = 1; r <= 8 && !foundSeed; r++) {
      const candidates = [
        [clickX + r, clickY], [clickX - r, clickY],
        [clickX, clickY + r], [clickX, clickY - r],
        [clickX + r, clickY + r], [clickX - r, clickY - r]
      ];
      for (const [cx, cy] of candidates) {
        if (isWhite(cx, cy)) {
          seedX = cx;
          seedY = cy;
          foundSeed = true;
          break;
        }
      }
    }
  }

  if (!foundSeed) {
    // 預設一個合適大小的貼紙框
    const defW = Math.round(w * 0.18);
    const defH = Math.round(h * 0.05);
    return {
      x: Math.max(0, Math.min(w - defW, Math.round(clickX - defW / 2))),
      y: Math.max(0, Math.min(h - defH, Math.round(clickY - defH / 2))),
      width: defW,
      height: defH,
      found: true
    };
  }

  // 從 seed 開始 BFS 連通分量
  const visited = new Uint8Array(w * h);
  const queue = [seedY * w + seedX];
  visited[seedY * w + seedX] = 1;
  let minX = seedX, maxX = seedX, minY = seedY, maxY = seedY;
  let qHead = 0;

  // 限制最大搜尋半徑，防止整個白色標籤連通
  const maxSearchDistX = Math.round(w * 0.25);
  const maxSearchDistY = Math.round(h * 0.10);

  while (qHead < queue.length && queue.length < 50000) {
    const curr = queue[qHead++];
    const cx = curr % w;
    const cy = Math.floor(curr / w);

    if (cx < minX) minX = cx;
    if (cx > maxX) maxX = cx;
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;

    const neighbors = [
      cy > 0 ? (cy - 1) * w + cx : -1,
      cy < h - 1 ? (cy + 1) * w + cx : -1,
      cx > 0 ? cy * w + (cx - 1) : -1,
      cx < w - 1 ? cy * w + (cx + 1) : -1,
    ];

    for (const n of neighbors) {
      if (n >= 0 && !visited[n]) {
        const nx = n % w;
        const ny = Math.floor(n / w);
        if (Math.abs(nx - seedX) <= maxSearchDistX && Math.abs(ny - seedY) <= maxSearchDistY && isWhite(nx, ny)) {
          visited[n] = 1;
          queue.push(n);
        }
      }
    }
  }

  return {
    x: Math.max(0, minX - 2),
    y: Math.max(0, minY - 2),
    width: Math.min(w - minX, (maxX - minX + 1) + 4),
    height: Math.min(h - minY, (maxY - minY + 1) + 4),
    found: true,
  };
}

/**
 * 智慧去除卡片左上角/頂部的空白白色貼紙標籤 (Inpaint / Sticker Cleaner)
 * 針對實體卡店常見貼在卡套、黑框外殼或鑑定殼左上角的白色標籤紙進行連通分量精準偵測與無痕邊界融合
 * @param imageSource 圖片元素 (HTMLImageElement) 或 Data URL 字串
 * @param manualRegion 可選：手動指定的去除矩形 (像素座標 x, y, width, height)
 */
export async function removeTopLeftLabelFromImage(
  imageSource: HTMLImageElement | string,
  manualRegion?: { x: number; y: number; width: number; height: number }
): Promise<{ blob: Blob; dataUrl: string; optimizedDataUrl: string; usedRegion: { x: number; y: number; width: number; height: number } }> {
  return new Promise(async (resolve, reject) => {
    try {
      const img = await safeLoadImage(imageSource);

      const canvas = document.createElement('canvas');
      const w = img.naturalWidth || img.width || 500;
      const h = img.naturalHeight || img.height || 700;
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('無法取得 Canvas 2D 上下文');

      ctx.drawImage(img, 0, 0);

      // 1. 決定貼紙區域（優先使用手動指定，否則使用連通區域自動偵測）
      let targetBox: { minX: number; maxX: number; minY: number; maxY: number };

      if (manualRegion && manualRegion.width > 5 && manualRegion.height > 5) {
        targetBox = {
          minX: Math.max(0, Math.round(manualRegion.x)),
          maxX: Math.min(w - 1, Math.round(manualRegion.x + manualRegion.width)),
          minY: Math.max(0, Math.round(manualRegion.y)),
          maxY: Math.min(h - 1, Math.round(manualRegion.y + manualRegion.height)),
        };
      } else {
        const detected = await detectWhiteStickerBox(img);
        if (detected && detected.found && detected.width > 5 && detected.height > 5) {
          // 向外擴充 5px 緩衝區消除貼紙白色鋸齒邊緣與貼紙陰影
          targetBox = {
            minX: Math.max(0, detected.x - 5),
            maxX: Math.min(w - 1, detected.x + detected.width + 5),
            minY: Math.max(0, detected.y - 5),
            maxY: Math.min(h - 1, detected.y + detected.height + 5),
          };
        } else {
          // 安全預設左上角典型空白標籤範圍 (x: 2.5%~22%, y: 1.5%~6.5%)
          targetBox = {
            minX: Math.round(w * 0.025),
            maxX: Math.round(w * 0.22),
            minY: Math.round(h * 0.015),
            maxY: Math.round(h * 0.065),
          };
        }
      }

      const { minX, maxX, minY, maxY } = targetBox;
      const stickerW = maxX - minX + 1;
      const stickerH = maxY - minY + 1;

      const imgData = ctx.getImageData(0, 0, w, h);
      const data = imgData.data;

      // 2. 四邊周圍採樣 (Top, Bottom, Left, Right)：採樣貼紙邊緣外側 2~5px
      let topR = 0, topG = 0, topB = 0, topCount = 0;
      let btmR = 0, btmG = 0, btmB = 0, btmCount = 0;
      let leftR = 0, leftG = 0, leftB = 0, leftCount = 0;
      let rightR = 0, rightG = 0, rightB = 0, rightCount = 0;

      // 頂部邊界採樣
      for (let x = minX; x <= maxX; x += 2) {
        for (let dy = 2; dy <= 5; dy++) {
          const sy = minY - dy;
          if (sy >= 0) {
            const idx = (sy * w + x) * 4;
            topR += data[idx]; topG += data[idx + 1]; topB += data[idx + 2]; topCount++;
          }
        }
      }

      // 底部邊界採樣
      for (let x = minX; x <= maxX; x += 2) {
        for (let dy = 2; dy <= 5; dy++) {
          const sy = maxY + dy;
          if (sy < h) {
            const idx = (sy * w + x) * 4;
            btmR += data[idx]; btmG += data[idx + 1]; btmB += data[idx + 2]; btmCount++;
          }
        }
      }

      // 左側邊界採樣
      for (let y = minY; y <= maxY; y += 2) {
        for (let dx = 2; dx <= 5; dx++) {
          const sx = minX - dx;
          if (sx >= 0) {
            const idx = (y * w + sx) * 4;
            leftR += data[idx]; leftG += data[idx + 1]; leftB += data[idx + 2]; leftCount++;
          }
        }
      }

      // 右側邊界採樣
      for (let y = minY; y <= maxY; y += 2) {
        for (let dx = 2; dx <= 5; dx++) {
          const sx = maxX + dx;
          if (sx < w) {
            const idx = (y * w + sx) * 4;
            rightR += data[idx]; rightG += data[idx + 1]; rightB += data[idx + 2]; rightCount++;
          }
        }
      }

      // 動態彙整周邊有效採樣，防止頂部或左側貼紙緊貼邊界時採樣不到而硬套黑色
      const validSides: number[][] = [];
      if (topCount > 0) validSides.push([topR / topCount, topG / topCount, topB / topCount]);
      if (btmCount > 0) validSides.push([btmR / btmCount, btmG / btmCount, btmB / btmCount]);
      if (leftCount > 0) validSides.push([leftR / leftCount, leftG / leftCount, leftB / leftCount]);
      if (rightCount > 0) validSides.push([rightR / rightCount, rightG / rightCount, rightB / rightCount]);

      const globalBorderAvg = validSides.length > 0
        ? [
            validSides.reduce((acc, c) => acc + c[0], 0) / validSides.length,
            validSides.reduce((acc, c) => acc + c[1], 0) / validSides.length,
            validSides.reduce((acc, c) => acc + c[2], 0) / validSides.length,
          ]
        : [25, 25, 25];

      const avgTop = topCount > 0 ? [topR / topCount, topG / topCount, topB / topCount] : globalBorderAvg;
      const avgBtm = btmCount > 0 ? [btmR / btmCount, btmG / btmCount, btmB / btmCount] : globalBorderAvg;
      const avgLeft = leftCount > 0 ? [leftR / leftCount, leftG / leftCount, leftB / leftCount] : globalBorderAvg;
      const avgRight = rightCount > 0 ? [rightR / rightCount, rightG / rightCount, rightB / rightCount] : globalBorderAvg;

      // 檢測是否為深色/黑色外殼邊框（如 Messi 卡之黑框外殼：周圍大多是暗色）
      const perimeterBright = (globalBorderAvg[0] + globalBorderAvg[1] + globalBorderAvg[2]) / 3;
      const isBlackFrame = perimeterBright < 65;

      // 3. 雙向連續線性插值與外圍 4px 軟羽化無痕融合（確保連貼紙邊緣都完全看不出任何接縫）
      const feather = 4;

      for (let y = minY; y <= maxY; y++) {
        const vWeight = (y - minY) / Math.max(1, stickerH); // 0 (頂) -> 1 (底)

        for (let x = minX; x <= maxX; x++) {
          const hWeight = (x - minX) / Math.max(1, stickerW); // 0 (左) -> 1 (右)

          let fillR: number, fillG: number, fillB: number;

          if (isBlackFrame) {
            // 黑框外殼情境：使用均勻暗黑框色混合微量雜訊以求完全自然
            const baseDark = globalBorderAvg[0];
            const noise = ((x * 13 + y * 7) % 5) - 2;
            fillR = Math.max(8, Math.min(45, Math.round(baseDark + noise)));
            fillG = fillR;
            fillB = fillR;
          } else {
            // 壓克力/金屬標籤情境：四邊雙向權重混合
            const vertR = avgTop[0] * (1 - vWeight) + avgBtm[0] * vWeight;
            const vertG = avgTop[1] * (1 - vWeight) + avgBtm[1] * vWeight;
            const vertB = avgTop[2] * (1 - vWeight) + avgBtm[2] * vWeight;

            const horizR = avgLeft[0] * (1 - hWeight) + avgRight[0] * hWeight;
            const horizG = avgLeft[1] * (1 - hWeight) + avgRight[1] * hWeight;
            const horizB = avgLeft[2] * (1 - hWeight) + avgRight[2] * hWeight;

            fillR = Math.round((vertR + horizR) / 2);
            fillG = Math.round((vertG + horizG) / 2);
            fillB = Math.round((vertB + horizB) / 2);
          }

          // 計算離邊緣的距離以執行羽化漸變（Feathering）
          const distToEdge = Math.min(x - minX, maxX - x, y - minY, maxY - y);
          const blendFactor = distToEdge < feather ? distToEdge / feather : 1.0;

          const curIdx = (y * w + x) * 4;
          const origR = data[curIdx];
          const origG = data[curIdx + 1];
          const origB = data[curIdx + 2];

          data[curIdx] = Math.round(fillR * blendFactor + origR * (1 - blendFactor));
          data[curIdx + 1] = Math.round(fillG * blendFactor + origG * (1 - blendFactor));
          data[curIdx + 2] = Math.round(fillB * blendFactor + origB * (1 - blendFactor));
          data[curIdx + 3] = 255;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      canvas.toBlob((blob) => {
        if (!blob) return reject(new Error('Canvas toBlob failed'));
        const dataUrl = canvas.toDataURL('image/jpeg', 0.95);

        // 生成輕量化 Data URL（最大寬度 720px，約 50KB~80KB，保證寫入 Firestore 絕不超限）
        let optimizedDataUrl = '';
        try {
          const optMaxW = 720;
          let optW = canvas.width;
          let optH = canvas.height;
          if (optW > optMaxW) {
            optH = Math.round((optH * optMaxW) / optW);
            optW = optMaxW;
          }
          const optCanvas = document.createElement('canvas');
          optCanvas.width = optW;
          optCanvas.height = optH;
          const optCtx = optCanvas.getContext('2d');
          if (optCtx) {
            optCtx.drawImage(canvas, 0, 0, optW, optH);
            optimizedDataUrl = optCanvas.toDataURL('image/jpeg', 0.85);
          }
        } catch (optErr) {
          console.warn('Inpaint optimizedDataUrl fallback:', optErr);
        }

        resolve({ 
          blob, 
          dataUrl, 
          optimizedDataUrl: optimizedDataUrl || dataUrl,
          usedRegion: { x: minX, y: minY, width: stickerW, height: stickerH }
        });
      }, 'image/jpeg', 0.95);

    } catch (e) {
      reject(e);
    }
  });
}

