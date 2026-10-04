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

  isAiRecognizing?: boolean;
}

/**
 * 依據原始圖片的高解析度尺寸，對指定的 CropBox 進行無損旋轉與裁切
 */
export async function cropImageFromSource(
  imageElement: HTMLImageElement,
  cropBox: CropBox,
  mimeType: string = 'image/jpeg',
  quality: number = 0.95
): Promise<{ blob: Blob; dataUrl: string }> {
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

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          const dataUrl = canvas.toDataURL(mimeType, quality);
          resolve({ blob, dataUrl });
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
