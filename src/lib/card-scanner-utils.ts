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

  // 卡片資訊 (僅由正面/AI 或預查卡表產生)
  inventoryCode?: string; // 庫存代碼 (例如 10-1BK)
  presetPosition?: string; // 預查表位置 (例如 上排右（1）)
  presetNote?: string; // 預查表附註 (例如 【成交過舊】、【查無成交】)
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
 * 旋轉時直接對原圖繞裁切中心採樣，避免預先裁切造成四角黑邊／裁角
 */
export async function cropImageFromSource(
  imageElement: HTMLImageElement,
  cropBox: CropBox,
  mimeType: string = 'image/png',
  quality: number = 0.95
): Promise<{ blob: Blob; dataUrl: string; optimizedDataUrl: string }> {
  return new Promise((resolve, reject) => {
    try {
      const naturalWidth = imageElement.naturalWidth || imageElement.width;
      const naturalHeight = imageElement.naturalHeight || imageElement.height;
      if (!naturalWidth || !naturalHeight) {
        reject(new Error('圖片尚未載入完成'));
        return;
      }

      // 安全限制座標範圍於 0 ~ 100%
      const clampedX = Math.max(0, Math.min(99, cropBox.x));
      const clampedY = Math.max(0, Math.min(99, cropBox.y));
      const clampedW = Math.max(1, Math.min(100 - clampedX, cropBox.width));
      const clampedH = Math.max(1, Math.min(100 - clampedY, cropBox.height));

      // 計算在原始大圖上的像素位置與尺寸
      const pixelX = (clampedX / 100) * naturalWidth;
      const pixelY = (clampedY / 100) * naturalHeight;
      const pixelWidth = Math.max(1, (clampedW / 100) * naturalWidth);
      const pixelHeight = Math.max(1, (clampedH / 100) * naturalHeight);

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      const normalizedRot = ((cropBox.rotation % 360) + 360) % 360;
      const rotationRad = (cropBox.rotation * Math.PI) / 180;
      const is90or270 = normalizedRot === 90 || normalizedRot === 270;

      if (is90or270) {
        canvas.width = Math.max(1, Math.round(pixelHeight));
        canvas.height = Math.max(1, Math.round(pixelWidth));
      } else {
        canvas.width = Math.max(1, Math.round(pixelWidth));
        canvas.height = Math.max(1, Math.round(pixelHeight));
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      ctx.save();
      if (normalizedRot === 0) {
        ctx.drawImage(
          imageElement,
          pixelX,
          pixelY,
          pixelWidth,
          pixelHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );
      } else {
        // 繞原圖上該裁切框中心點旋轉並繪製完整來源圖，杜絕微調角度時的四角裁切與空白三角
        const centerX = pixelX + pixelWidth / 2;
        const centerY = pixelY + pixelHeight / 2;
        ctx.translate(canvas.width / 2, canvas.height / 2);
        ctx.rotate(rotationRad);
        ctx.drawImage(imageElement, -centerX, -centerY, naturalWidth, naturalHeight);
      }
      ctx.restore();

      // 另行生成輕量化、極高清晰度儲存專用 Data URL（最大寬度 720px）
      let optimizedDataUrl = '';
      try {
        const optMaxW = 720;
        let optW = canvas.width;
        let optH = canvas.height;
        if (optW > optMaxW) {
          optH = Math.max(1, Math.round((optH * optMaxW) / optW));
          optW = optMaxW;
        }
        const optCanvas = document.createElement('canvas');
        optCanvas.width = optW;
        optCanvas.height = optH;
        const optCtx = optCanvas.getContext('2d');
        if (optCtx) {
          optCtx.imageSmoothingEnabled = true;
          optCtx.imageSmoothingQuality = 'high';
          optCtx.drawImage(canvas, 0, 0, optW, optH);
          optimizedDataUrl =
            optCanvas.toDataURL('image/webp', 0.9) || optCanvas.toDataURL('image/jpeg', 0.88);
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
 * 專供 AI 辨識 / PSA 標籤 OCR 使用的輕量高清裁切（JPEG、最大邊 1280px，約 100~220KB）
 * 徹底避免傳送原圖無壓縮 PNG（動輒 5~12MB）導致 API 413 Payload Too Large 或超時失敗
 */
export async function cropImageForAi(
  imageElement: HTMLImageElement,
  cropBox: CropBox,
  maxDimension: number = 1280
): Promise<string> {
  const naturalWidth = imageElement.naturalWidth || imageElement.width;
  const naturalHeight = imageElement.naturalHeight || imageElement.height;
  if (!naturalWidth || !naturalHeight) {
    throw new Error('圖片尚未載入完成');
  }

  const clampedX = Math.max(0, Math.min(99, cropBox.x));
  const clampedY = Math.max(0, Math.min(99, cropBox.y));
  const clampedW = Math.max(1, Math.min(100 - clampedX, cropBox.width));
  const clampedH = Math.max(1, Math.min(100 - clampedY, cropBox.height));

  const pixelX = (clampedX / 100) * naturalWidth;
  const pixelY = (clampedY / 100) * naturalHeight;
  const pixelWidth = Math.max(1, (clampedW / 100) * naturalWidth);
  const pixelHeight = Math.max(1, (clampedH / 100) * naturalHeight);

  const normalizedRot = ((cropBox.rotation % 360) + 360) % 360;
  const rotationRad = (cropBox.rotation * Math.PI) / 180;
  const is90or270 = normalizedRot === 90 || normalizedRot === 270;

  let outW = is90or270 ? pixelHeight : pixelWidth;
  let outH = is90or270 ? pixelWidth : pixelHeight;
  let scale = 1;
  if (outW > maxDimension || outH > maxDimension) {
    scale = maxDimension / Math.max(outW, outH);
    outW = Math.max(1, Math.round(outW * scale));
    outH = Math.max(1, Math.round(outH * scale));
  } else {
    outW = Math.max(1, Math.round(outW));
    outH = Math.max(1, Math.round(outH));
  }

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  ctx.save();
  if (normalizedRot === 0) {
    ctx.drawImage(imageElement, pixelX, pixelY, pixelWidth, pixelHeight, 0, 0, outW, outH);
  } else {
    const centerX = pixelX + pixelWidth / 2;
    const centerY = pixelY + pixelHeight / 2;
    ctx.translate(outW / 2, outH / 2);
    ctx.rotate(rotationRad);
    ctx.scale(scale, scale);
    ctx.drawImage(imageElement, -centerX, -centerY, naturalWidth, naturalHeight);
  }
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.86);
}

/**
 * 將圖片縮放至適合 AI 偵測邊界的清晰解析度（預設 1536px JPEG，兼顧多卡邊緣銳利度與傳輸速度）
 */
export function compressImageForDetection(
  imageElement: HTMLImageElement,
  maxDimension: number = 1536
): string {
  const canvas = document.createElement('canvas');
  let width = imageElement.naturalWidth || imageElement.width;
  let height = imageElement.naturalHeight || imageElement.height;

  if (width > maxDimension || height > maxDimension) {
    if (width > height) {
      height = Math.max(1, Math.round((height * maxDimension) / width));
      width = maxDimension;
    } else {
      width = Math.max(1, Math.round((width * maxDimension) / height));
      height = maxDimension;
    }
  }

  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imageElement, 0, 0, width, height);
  }
  return canvas.toDataURL('image/jpeg', 0.85);
}

/**
 * 動態行分群排序（由上至下、同一排由左至右）
 */
export function sortCropBoxes(boxes: CropBox[]): CropBox[] {
  if (boxes.length <= 1) return [...boxes];

  const byCenterY = [...boxes].sort(
    (a, b) => a.y + a.height / 2 - (b.y + b.height / 2)
  );
  const rows: CropBox[][] = [];

  for (const box of byCenterY) {
    const centerY = box.y + box.height / 2;
    let placed = false;
    for (const row of rows) {
      const rowAvgY =
        row.reduce((sum, r) => sum + (r.y + r.height / 2), 0) / row.length;
      const rowMinH = Math.min(...row.map((r) => r.height));
      if (Math.abs(centerY - rowAvgY) < Math.min(box.height, rowMinH) * 0.48) {
        row.push(box);
        placed = true;
        break;
      }
    }
    if (!placed) {
      rows.push([box]);
    }
  }

  rows.sort((rowA, rowB) => {
    const avgA = rowA.reduce((s, b) => s + b.y, 0) / rowA.length;
    const avgB = rowB.reduce((s, b) => s + b.y, 0) / rowB.length;
    return avgA - avgB;
  });

  const sorted: CropBox[] = [];
  for (const row of rows) {
    row.sort((a, b) => a.x - b.x);
    sorted.push(...row);
  }
  return sorted;
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
 * 純前端多卡獨立邊界偵測（僅作為雲端 AI 無法連線時的離線備援）
 * 結合四周背景中位數色差 + 彩度 + 邊緣梯度 + 連通區域分析
 */
export function detectCardBoundariesLocally(imageElement: HTMLImageElement): CropBox[] {
  try {
    const canvas = document.createElement('canvas');
    const sampleWidth = 480;
    const natW = imageElement.naturalWidth || imageElement.width || 800;
    const natH = imageElement.naturalHeight || imageElement.height || 600;
    const sampleHeight = Math.max(120, Math.round((sampleWidth / natW) * natH));
    canvas.width = sampleWidth;
    canvas.height = sampleHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return generateGridBoxes(1, 1, 5);
    ctx.drawImage(imageElement, 0, 0, sampleWidth, sampleHeight);

    const imgData = ctx.getImageData(0, 0, sampleWidth, sampleHeight);
    const data = imgData.data;
    const totalPixels = sampleWidth * sampleHeight;

    // 0. 採樣四邊極外圍像素估算背景代表色（中位數）
    const borderR: number[] = [];
    const borderG: number[] = [];
    const borderB: number[] = [];
    for (let x = 0; x < sampleWidth; x += 4) {
      for (const y of [1, 2, sampleHeight - 2, sampleHeight - 3]) {
        const idx = (y * sampleWidth + x) * 4;
        borderR.push(data[idx]);
        borderG.push(data[idx + 1]);
        borderB.push(data[idx + 2]);
      }
    }
    for (let y = 0; y < sampleHeight; y += 4) {
      for (const x of [1, 2, sampleWidth - 2, sampleWidth - 3]) {
        const idx = (y * sampleWidth + x) * 4;
        borderR.push(data[idx]);
        borderG.push(data[idx + 1]);
        borderB.push(data[idx + 2]);
      }
    }
    const median = (arr: number[]) => {
      if (arr.length === 0) return 240;
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)];
    };
    const bgR = median(borderR);
    const bgG = median(borderG);
    const bgB = median(borderB);

    // 1. 建立前景遮罩：背景色差 + 彩度 + 局部邊緣梯度
    const padBorderX = Math.max(3, Math.round(sampleWidth * 0.015));
    const padBorderY = Math.max(3, Math.round(sampleHeight * 0.015));
    const mask = new Uint8Array(totalPixels);
    for (let y = padBorderY; y < sampleHeight - padBorderY; y++) {
      for (let x = padBorderX; x < sampleWidth - padBorderX; x++) {
        const p = y * sampleWidth + x;
        const idx = p * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const bgDist = Math.abs(r - bgR) + Math.abs(g - bgG) + Math.abs(b - bgB);
        const sat = Math.max(r, g, b) - Math.min(r, g, b);

        const idxR = (y * sampleWidth + (x + 1)) * 4;
        const idxD = ((y + 1) * sampleWidth + x) * 4;
        const edgeGrad =
          Math.abs(r - data[idxR]) +
          Math.abs(g - data[idxR + 1]) +
          Math.abs(b - data[idxR + 2]) +
          Math.abs(r - data[idxD]) +
          Math.abs(g - data[idxD + 1]) +
          Math.abs(b - data[idxD + 2]);

        if (bgDist > 55 || sat > 28 || edgeGrad > 42) {
          mask[p] = 1;
        }
      }
    }

    // 2. 分離式閉運算（膨脹後侵蝕，填補卡片內部白邊與標籤縫隙）
    const temp = new Uint8Array(totalPixels);
    const closed = new Uint8Array(totalPixels);
    for (let y = padBorderY; y < sampleHeight - padBorderY; y++) {
      for (let x = padBorderX; x < sampleWidth - padBorderX; x++) {
        const p = y * sampleWidth + x;
        let hit = false;
        for (let dy = -3; dy <= 3 && !hit; dy++) {
          const ny = y + dy;
          if (ny < padBorderY || ny >= sampleHeight - padBorderY) continue;
          const rowOff = ny * sampleWidth;
          for (let dx = -2; dx <= 2; dx++) {
            const nx = x + dx;
            if (nx >= padBorderX && nx < sampleWidth - padBorderX && mask[rowOff + nx]) {
              hit = true;
              break;
            }
          }
        }
        if (hit) temp[p] = 1;
      }
    }
    for (let y = padBorderY + 2; y < sampleHeight - padBorderY - 2; y++) {
      for (let x = padBorderX + 2; x < sampleWidth - padBorderX - 2; x++) {
        const p = y * sampleWidth + x;
        if (
          temp[p] &&
          temp[p - 1] &&
          temp[p + 1] &&
          temp[p - sampleWidth] &&
          temp[p + sampleWidth]
        ) {
          closed[p] = 1;
        }
      }
    }

    // 3. BFS 連通區域標記
    const visited = new Uint8Array(totalPixels);
    const candidateBoxes: Array<CropBox & { areaPct: number }> = [];
    const queue = new Int32Array(totalPixels);

    for (let y = padBorderY; y < sampleHeight - padBorderY; y++) {
      for (let x = padBorderX; x < sampleWidth - padBorderX; x++) {
        const startIdx = y * sampleWidth + x;
        if (!closed[startIdx] || visited[startIdx]) continue;

        let head = 0;
        let tail = 0;
        queue[tail++] = startIdx;
        visited[startIdx] = 1;

        let minX = x, maxX = x, minY = y, maxY = y;
        let area = 0;

        while (head < tail) {
          const curr = queue[head++];
          const cx = curr % sampleWidth;
          const cy = (curr - cx) / sampleWidth;
          area++;
          if (cx < minX) minX = cx;
          if (cx > maxX) maxX = cx;
          if (cy < minY) minY = cy;
          if (cy > maxY) maxY = cy;

          const neighbors = [curr - 1, curr + 1, curr - sampleWidth, curr + sampleWidth];
          for (let n = 0; n < 4; n++) {
            const ni = neighbors[n];
            if (ni >= 0 && ni < totalPixels && closed[ni] && !visited[ni]) {
              visited[ni] = 1;
              queue[tail++] = ni;
            }
          }
        }

        const wPct = ((maxX - minX + 1) / sampleWidth) * 100;
        const hPct = ((maxY - minY + 1) / sampleHeight) * 100;
        const areaPct = (area / totalPixels) * 100;

        if (wPct < 7 || hPct < 4 || areaPct < 0.6) continue;
        if (wPct > 95 && hPct > 95) continue;

        const padX = 0.5;
        const padY = 0.5;
        const normX = Math.max(0.5, Math.round(((minX / sampleWidth) * 100 - padX) * 10) / 10);
        const normY = Math.max(0.5, Math.round(((minY / sampleHeight) * 100 - padY) * 10) / 10);
        const normW = Math.min(99 - normX, Math.round((wPct + padX * 2) * 10) / 10);
        const normH = Math.min(99 - normY, Math.round((hPct + padY * 2) * 10) / 10);

        candidateBoxes.push({
          id: `local-card-${uuidv4().slice(0, 8)}`,
          x: normX,
          y: normY,
          width: normW,
          height: normH,
          rotation: 0,
          areaPct,
        });
      }
    }

    // 4. 自動合併垂直對齊的「鑑定標籤 + 卡面」
    const consumedLabelIndices = new Set<number>();
    for (let i = 0; i < candidateBoxes.length; i++) {
      const topBox = candidateBoxes[i];
      if (topBox.height >= 15) continue;
      for (let j = 0; j < candidateBoxes.length; j++) {
        if (i === j || consumedLabelIndices.has(j)) continue;
        const cardBox = candidateBoxes[j];
        if (cardBox.height < 14) continue;
        const overlapLeft = Math.max(topBox.x, cardBox.x);
        const overlapRight = Math.min(topBox.x + topBox.width, cardBox.x + cardBox.width);
        const overlapW = Math.max(0, overlapRight - overlapLeft);
        const minW = Math.min(topBox.width, cardBox.width);
        const verticalGap = cardBox.y - (topBox.y + topBox.height);

        if (overlapW / Math.max(0.1, minW) > 0.55 && verticalGap >= -2 && verticalGap < 6) {
          const mergedX = Math.min(topBox.x, cardBox.x);
          const mergedY = Math.min(topBox.y, cardBox.y);
          const mergedRight = Math.max(topBox.x + topBox.width, cardBox.x + cardBox.width);
          const mergedBottom = Math.max(topBox.y + topBox.height, cardBox.y + cardBox.height);
          cardBox.x = mergedX;
          cardBox.y = mergedY;
          cardBox.width = Math.round((mergedRight - mergedX) * 10) / 10;
          cardBox.height = Math.round((mergedBottom - mergedY) * 10) / 10;
          cardBox.areaPct += topBox.areaPct;
          consumedLabelIndices.add(i);
          break;
        }
      }
    }

    const rawBoxes: CropBox[] = candidateBoxes
      .filter((b, idx) => !consumedLabelIndices.has(idx) && b.height >= 10 && b.areaPct >= 1.5)
      .map(({ areaPct: _areaPct, ...rest }) => rest);

    // 5. 移除被外框包覆的內部子框
    const boxes = rawBoxes.filter((box, idx) => {
      const boxArea = box.width * box.height;
      return !rawBoxes.some((other, oIdx) => {
        if (idx === oIdx) return false;
        const otherArea = other.width * other.height;
        if (otherArea < boxArea || (otherArea === boxArea && oIdx > idx)) return false;
        const ix1 = Math.max(box.x, other.x);
        const iy1 = Math.max(box.y, other.y);
        const ix2 = Math.min(box.x + box.width, other.x + other.width);
        const iy2 = Math.min(box.y + box.height, other.y + other.height);
        if (ix2 <= ix1 || iy2 <= iy1) return false;
        const interArea = (ix2 - ix1) * (iy2 - iy1);
        return interArea / Math.max(0.1, boxArea) > 0.6;
      });
    });

    if (boxes.length > 0) {
      return sortCropBoxes(boxes);
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

