export type PeelCorner = 'tl' | 'tr' | 'bl' | 'br' | 'top' | 'bottom' | 'left' | 'right';

export const PEEL_CORNER_LABELS: Record<PeelCorner, string> = {
  tl: '左上角',
  tr: '右上角',
  bl: '左下角',
  br: '右下角',
  top: '上方',
  bottom: '下方',
  left: '左側',
  right: '右側',
};

/**
 * 依據指標/手指在卡片上的點擊位置，判定最近的方向（四角或四邊）
 */
export function detectPeelCorner(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): PeelCorner {
  if (rect.width <= 0 || rect.height <= 0) return 'bottom';
  const nx = (clientX - rect.left) / rect.width;
  const ny = (clientY - rect.top) / rect.height;

  // 若落在中央區域，預設由下往上翻開
  if (nx > 0.28 && nx < 0.72 && ny > 0.28 && ny < 0.72) {
    return ny < 0.5 ? 'top' : 'bottom';
  }

  // 四邊中段區域
  if (nx >= 0.3 && nx <= 0.7) {
    return ny < 0.5 ? 'top' : 'bottom';
  }
  if (ny >= 0.3 && ny <= 0.7) {
    return nx < 0.5 ? 'left' : 'right';
  }

  // 四個角落
  const isRight = nx >= 0.5;
  const isBottom = ny >= 0.5;
  if (!isRight && !isBottom) return 'tl';
  if (isRight && !isBottom) return 'tr';
  if (!isRight && isBottom) return 'bl';
  return 'br';
}

/**
 * 依據拖曳手勢向量 (dx, dy) 即時判定全方位 8 向翻開方向
 */
export function detectPeelDirectionFromSwipe(dx: number, dy: number): PeelCorner {
  const angle = Math.atan2(dy, dx) * (180 / Math.PI); // -180 ~ 180
  // 右拉 (從左側掀開)
  if (angle >= -25 && angle <= 25) return 'left';
  // 右下拉 (從左上角掀開)
  if (angle > 25 && angle < 65) return 'tl';
  // 下拉 (從上方掀開)
  if (angle >= 65 && angle <= 115) return 'top';
  // 左下拉 (從右上角掀開)
  if (angle > 115 && angle < 155) return 'tr';
  // 左拉 (從右側掀開)
  if (angle >= 155 || angle <= -155) return 'right';
  // 左上拉 (從右下角掀開)
  if (angle > -155 && angle < -115) return 'br';
  // 上拉 (從下方掀開)
  if (angle >= -115 && angle <= -65) return 'bottom';
  // 右上拉 (從左下角掀開)
  return 'bl';
}

/**
 * 判斷是否直接點擊在卡片可輕觸區域內（全卡片皆支援輕觸翻開）
 */
export function isNearCornerHotspot(
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>
): boolean {
  if (rect.width <= 0 || rect.height <= 0) return false;
  return (
    clientX >= rect.left &&
    clientX <= rect.left + rect.width &&
    clientY >= rect.top &&
    clientY <= rect.top + rect.height
  );
}

/**
 * 將任意方向的拖曳位移轉換為 0 ~ 100 的掀開進度百分比
 */
export function computeCornerPeelPercent(
  corner: PeelCorner,
  dx: number,
  dy: number,
  width: number,
  height: number
): number {
  const safeW = Math.max(140, width);
  const safeH = Math.max(200, height);

  switch (corner) {
    case 'top':
      return Math.max(0, Math.min(100, (dy / (safeH * 0.62)) * 100));
    case 'bottom':
      return Math.max(0, Math.min(100, (-dy / (safeH * 0.62)) * 100));
    case 'left':
      return Math.max(0, Math.min(100, (dx / (safeW * 0.65)) * 100));
    case 'right':
      return Math.max(0, Math.min(100, (-dx / (safeW * 0.65)) * 100));
    default: {
      const ix = corner === 'tl' || corner === 'bl' ? dx : -dx;
      const iy = corner === 'tl' || corner === 'tr' ? dy : -dy;
      const inwardDist = Math.max(0, ix * 0.72 + iy * 0.72, ix * 0.85, iy * 0.85);
      const maxDist = Math.max(140, Math.hypot(safeW, safeH) * 0.5);
      return Math.max(0, Math.min(100, (inwardDist / maxDist) * 100));
    }
  }
}

/**
 * 計算連續 5 頂點遮罩與金屬反折角（支援全方位 8 向，全程頂點數恆定 60fps 絲滑過渡）
 */
export function getCornerPeelGeometry(corner: PeelCorner, percent: number): {
  coverClipPath: string;
  flapClipPath: string;
  flapGradient: string;
  tiltTransform: string;
} {
  const clamped = Math.max(0, Math.min(100, percent));
  const tiltRatio = Math.sin((clamped / 100) * Math.PI) * 5.5;

  // 直向與橫向全方位翻開
  if (corner === 'top' || corner === 'bottom' || corner === 'left' || corner === 'right') {
    const p = clamped <= 0 ? 0 : Math.min(100, clamped);
    const flapSpan = Math.min(22, p * 0.35, (100 - p) * 0.9);

    switch (corner) {
      case 'top':
        return {
          coverClipPath: `polygon(0% ${p}%, 50% ${p}%, 100% ${p}%, 100% 100%, 0% 100%)`,
          flapClipPath: `polygon(0% ${p}%, 100% ${p}%, 100% ${Math.min(100, p + flapSpan)}%, 0% ${Math.min(100, p + flapSpan)}%)`,
          flapGradient: 'linear-gradient(180deg, rgba(253,230,138,0.92) 0%, rgba(148,163,184,0.85) 55%, rgba(15,23,42,0.95) 100%)',
          tiltTransform: `perspective(1000px) rotateX(${-tiltRatio * 1.4}deg) scale(1.02)`,
        };
      case 'bottom':
        return {
          coverClipPath: `polygon(0% 0%, 100% 0%, 100% ${100 - p}%, 50% ${100 - p}%, 0% ${100 - p}%)`,
          flapClipPath: `polygon(0% ${Math.max(0, 100 - p - flapSpan)}%, 100% ${Math.max(0, 100 - p - flapSpan)}%, 100% ${100 - p}%, 0% ${100 - p}%)`,
          flapGradient: 'linear-gradient(0deg, rgba(253,230,138,0.92) 0%, rgba(148,163,184,0.85) 55%, rgba(15,23,42,0.95) 100%)',
          tiltTransform: `perspective(1000px) rotateX(${tiltRatio * 1.4}deg) scale(1.02)`,
        };
      case 'left':
        return {
          coverClipPath: `polygon(${p}% 0%, 100% 0%, 100% 100%, ${p}% 100%, ${p}% 50%)`,
          flapClipPath: `polygon(${p}% 0%, ${Math.min(100, p + flapSpan)}% 0%, ${Math.min(100, p + flapSpan)}% 100%, ${p}% 100%)`,
          flapGradient: 'linear-gradient(90deg, rgba(253,230,138,0.92) 0%, rgba(148,163,184,0.85) 55%, rgba(15,23,42,0.95) 100%)',
          tiltTransform: `perspective(1000px) rotateY(${tiltRatio * 1.4}deg) scale(1.02)`,
        };
      case 'right':
        return {
          coverClipPath: `polygon(0% 0%, ${100 - p}% 0%, ${100 - p}% 50%, ${100 - p}% 100%, 0% 100%)`,
          flapClipPath: `polygon(${Math.max(0, 100 - p - flapSpan)}% 0%, ${100 - p}% 0%, ${100 - p}% 100%, ${Math.max(0, 100 - p - flapSpan)}% 100%)`,
          flapGradient: 'linear-gradient(270deg, rgba(253,230,138,0.92) 0%, rgba(148,163,184,0.85) 55%, rgba(15,23,42,0.95) 100%)',
          tiltTransform: `perspective(1000px) rotateY(${-tiltRatio * 1.4}deg) scale(1.02)`,
        };
    }
  }

  // 四角對角掀開
  const s = clamped <= 0 ? 0 : Math.min(200, (clamped / 100) * 202);
  const a = Math.min(100, s);
  const b = Math.max(0, Math.min(100, s - 100));
  const foldSpan = Math.min(100, b + (a - b) * 0.86);

  switch (corner) {
    case 'tl':
      return {
        coverClipPath: `polygon(${a}% ${b}%, 100% ${b}%, 100% 100%, ${b}% 100%, ${b}% ${a}%)`,
        flapClipPath: `polygon(${a}% ${b}%, ${foldSpan}% ${foldSpan}%, ${b}% ${a}%)`,
        flapGradient: 'linear-gradient(135deg, rgba(253,230,138,0.95) 0%, rgba(148,163,184,0.88) 48%, rgba(15,23,42,0.95) 100%)',
        tiltTransform: `perspective(1000px) rotateX(${-tiltRatio}deg) rotateY(${tiltRatio}deg) scale(1.02)`,
      };
    case 'tr':
      return {
        coverClipPath: `polygon(${100 - a}% ${b}%, 0% ${b}%, 0% 100%, ${100 - b}% 100%, ${100 - b}% ${a}%)`,
        flapClipPath: `polygon(${100 - a}% ${b}%, ${100 - foldSpan}% ${foldSpan}%, ${100 - b}% ${a}%)`,
        flapGradient: 'linear-gradient(225deg, rgba(253,230,138,0.95) 0%, rgba(148,163,184,0.88) 48%, rgba(15,23,42,0.95) 100%)',
        tiltTransform: `perspective(1000px) rotateX(${-tiltRatio}deg) rotateY(${-tiltRatio}deg) scale(1.02)`,
      };
    case 'bl':
      return {
        coverClipPath: `polygon(${a}% ${100 - b}%, 100% ${100 - b}%, 100% 0%, ${b}% 0%, ${b}% ${100 - a}%)`,
        flapClipPath: `polygon(${a}% ${100 - b}%, ${foldSpan}% ${100 - foldSpan}%, ${b}% ${100 - a}%)`,
        flapGradient: 'linear-gradient(45deg, rgba(253,230,138,0.95) 0%, rgba(148,163,184,0.88) 48%, rgba(15,23,42,0.95) 100%)',
        tiltTransform: `perspective(1000px) rotateX(${tiltRatio}deg) rotateY(${tiltRatio}deg) scale(1.02)`,
      };
    case 'br':
    default:
      return {
        coverClipPath: `polygon(${100 - a}% ${100 - b}%, 0% ${100 - b}%, 0% 0%, ${100 - b}% 0%, ${100 - b}% ${100 - a}%)`,
        flapClipPath: `polygon(${100 - a}% ${100 - b}%, ${100 - foldSpan}% ${100 - foldSpan}%, ${100 - b}% ${100 - a}%)`,
        flapGradient: 'linear-gradient(315deg, rgba(253,230,138,0.95) 0%, rgba(148,163,184,0.88) 48%, rgba(15,23,42,0.95) 100%)',
        tiltTransform: `perspective(1000px) rotateX(${tiltRatio}deg) rotateY(${-tiltRatio}deg) scale(1.02)`,
      };
  }
}
