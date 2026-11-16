export type PeelCorner = 'tl' | 'tr' | 'bl' | 'br';

export const PEEL_CORNER_LABELS: Record<PeelCorner, string> = {
  tl: '左上',
  tr: '右上',
  bl: '左下',
  br: '右下',
};

/**
 * 依據指標/手指在卡片或卡包上的點擊座標，自動判定玩家選擇從哪一個角落開啟
 */
export function detectPeelCorner(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): PeelCorner {
  const relX = clientX - rect.left;
  const relY = clientY - rect.top;
  const isRight = relX >= rect.width / 2;
  const isBottom = relY >= rect.height / 2;

  if (!isRight && !isBottom) return 'tl';
  if (isRight && !isBottom) return 'tr';
  if (!isRight && isBottom) return 'bl';
  return 'br';
}

/**
 * 判斷是否直接點擊在四個折角熱區內（支援單點輕觸任一角落直接從該角掀開）
 */
export function isNearCornerHotspot(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;
  const nearX = nx <= 0.34 || nx >= 0.66;
  const nearY = ny <= 0.28 || ny >= 0.72;
  return nearX && nearY;
}

/**
 * 將任意角落的拖曳位移轉換為 0 ~ 100 的掀開進度百分比
 */
export function computeCornerPeelPercent(
  corner: PeelCorner,
  dx: number,
  dy: number,
  width: number,
  height: number
): number {
  const ix = corner === 'tl' || corner === 'bl' ? dx : -dx;
  const iy = corner === 'tl' || corner === 'tr' ? dy : -dy;

  // 同時支援對角斜拉、橫拉、直拉三種自然手勢
  const inwardDist = Math.max(0, ix * 0.72 + iy * 0.72, ix * 0.85, iy * 0.85);
  const maxDist = Math.max(140, Math.hypot(width, height) * 0.5);
  return Math.max(0, Math.min(100, (inwardDist / maxDist) * 100));
}

/**
 * 計算連續 5 頂點遮罩與 3 頂點金屬反折角（全程頂點數恆定，確保 CSS 60fps 絲滑過渡）
 */
export function getCornerPeelGeometry(corner: PeelCorner, percent: number): {
  coverClipPath: string;
  flapClipPath: string;
  flapGradient: string;
  tiltTransform: string;
} {
  const clamped = Math.max(0, Math.min(100, percent));
  // 靜止時保留微小折角缺口作為視覺引導，拖曳時由 0 平滑展開至 202
  const s = clamped <= 0 ? 0 : Math.min(200, (clamped / 100) * 202);
  const a = Math.min(100, s);
  const b = Math.max(0, Math.min(100, s - 100));
  const foldSpan = Math.min(100, b + (a - b) * 0.86);

  const tiltRatio = Math.sin((clamped / 100) * Math.PI) * 5.5;

  switch (corner) {
    case 'tl':
      return {
        coverClipPath: `polygon(${a}% ${b}%, 100% ${b}%, 100% 100%, ${b}% 100%, ${b}% ${a}%)`,
        flapClipPath: `polygon(${a}% ${b}%, ${foldSpan}% ${foldSpan}%, ${b}% ${a}%)`,
        flapGradient: 'linear-gradient(135deg, rgba(226,232,240,0.95) 0%, rgba(148,163,184,0.88) 48%, rgba(15,23,42,0.95) 100%)',
        tiltTransform: `perspective(1000px) rotateX(${-tiltRatio}deg) rotateY(${tiltRatio}deg) scale(1.02)`,
      };
    case 'tr':
      return {
        coverClipPath: `polygon(${100 - a}% ${b}%, 0% ${b}%, 0% 100%, ${100 - b}% 100%, ${100 - b}% ${a}%)`,
        flapClipPath: `polygon(${100 - a}% ${b}%, ${100 - foldSpan}% ${foldSpan}%, ${100 - b}% ${a}%)`,
        flapGradient: 'linear-gradient(225deg, rgba(226,232,240,0.95) 0%, rgba(148,163,184,0.88) 48%, rgba(15,23,42,0.95) 100%)',
        tiltTransform: `perspective(1000px) rotateX(${-tiltRatio}deg) rotateY(${-tiltRatio}deg) scale(1.02)`,
      };
    case 'bl':
      return {
        coverClipPath: `polygon(${a}% ${100 - b}%, 100% ${100 - b}%, 100% 0%, ${b}% 0%, ${b}% ${100 - a}%)`,
        flapClipPath: `polygon(${a}% ${100 - b}%, ${foldSpan}% ${100 - foldSpan}%, ${b}% ${100 - a}%)`,
        flapGradient: 'linear-gradient(45deg, rgba(226,232,240,0.95) 0%, rgba(148,163,184,0.88) 48%, rgba(15,23,42,0.95) 100%)',
        tiltTransform: `perspective(1000px) rotateX(${tiltRatio}deg) rotateY(${tiltRatio}deg) scale(1.02)`,
      };
    case 'br':
    default:
      return {
        coverClipPath: `polygon(${100 - a}% ${100 - b}%, 0% ${100 - b}%, 0% 0%, ${100 - b}% 0%, ${100 - b}% ${100 - a}%)`,
        flapClipPath: `polygon(${100 - a}% ${100 - b}%, ${100 - foldSpan}% ${100 - foldSpan}%, ${100 - b}% ${100 - a}%)`,
        flapGradient: 'linear-gradient(315deg, rgba(226,232,240,0.95) 0%, rgba(148,163,184,0.88) 48%, rgba(15,23,42,0.95) 100%)',
        tiltTransform: `perspective(1000px) rotateX(${tiltRatio}deg) rotateY(${-tiltRatio}deg) scale(1.02)`,
      };
  }
}
