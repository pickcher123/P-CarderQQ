/**
 * 紅利加倍活動（Double Bonus Event）設定與計算工具
 */

export interface BonusEventConfig {
  isActive: boolean;
  multiplier: number; // 預設 2 倍
  title: string;
  subtitle: string;
  startDate?: string; // 格式 YYYY-MM-DD
  endDate?: string; // 格式 YYYY-MM-DD
  targets: {
    checkIn?: boolean; // 每日簽到雙倍
    purchase?: boolean; // 儲值加贈雙倍
    recycling?: boolean; // 卡片回收熔煉雙倍
    drawBonus?: boolean; // 抽卡紅利賞雙倍
  };
}

// 預設活動配置（安全預設為關閉，必須由後台 systemConfig/main 明確開啟才生效，避免重整時誤閃 2X 活動條）
export const DEFAULT_BONUS_EVENT: BonusEventConfig = {
  isActive: false,
  multiplier: 2,
  title: '🔥 全站紅利 2X 狂歡狂飆週',
  subtitle: '活動期間：每日簽到紅利 2 倍、儲值回饋 2 倍、卡片回收熔煉享雙倍 P+ 點數！',
  startDate: '2026-09-01',
  endDate: '2026-12-31',
  targets: {
    checkIn: true,
    purchase: true,
    recycling: true,
    drawBonus: true,
  },
};

function getLocalDateString(now: Date = new Date()): string {
  return (
    now.getFullYear() +
    '-' +
    String(now.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(now.getDate()).padStart(2, '0')
  );
}

function normalizeDateString(dateStr?: string): string | undefined {
  return dateStr?.trim().replace(/\//g, '-') || undefined;
}

/**
 * 檢查紅利加倍活動是否已超過結束日期
 */
export function isBonusEventExpired(config?: Partial<BonusEventConfig> | null): boolean {
  const target = config ?? DEFAULT_BONUS_EVENT;
  const endDate = normalizeDateString(target.endDate || DEFAULT_BONUS_EVENT.endDate);
  if (!endDate) return false;

  try {
    return getLocalDateString() > endDate;
  } catch {
    return false;
  }
}

/**
 * 檢查紅利加倍活動目前是否在生傚期間內
 */
export function isBonusEventActive(config?: Partial<BonusEventConfig> | null): boolean {
  // 尚未載入後台設定或未明確啟用時一律視為未開啟，避免重新整理頁面誤顯示 2X 加倍資訊給玩家
  if (!config || config.isActive !== true) return false;

  try {
    const todayStr = getLocalDateString();
    const startDate = normalizeDateString(config.startDate || DEFAULT_BONUS_EVENT.startDate);
    const endDate = normalizeDateString(config.endDate || DEFAULT_BONUS_EVENT.endDate);

    if (startDate && todayStr < startDate) {
      return false;
    }
    if (endDate && todayStr > endDate) {
      return false;
    }
  } catch (e) {
    return true;
  }

  return true;
}

/**
 * 取得特定管道的加倍倍率 (若活動未啟動或該項目未勾選則回傳 1)
 */
export function getBonusMultiplier(
  config?: Partial<BonusEventConfig> | null,
  target?: 'checkIn' | 'purchase' | 'recycling' | 'drawBonus'
): number {
  if (!isBonusEventActive(config)) {
    return 1;
  }

  const effectiveConfig = { ...DEFAULT_BONUS_EVENT, ...config };
  if (target && effectiveConfig.targets && !effectiveConfig.targets[target]) {
    return 1;
  }

  // 取得有效加倍倍率
  const rawMult = Number(effectiveConfig.multiplier);
  if (isNaN(rawMult) || rawMult <= 0) {
    return 1;
  }

  return rawMult;
}

/**
 * 計算加倍後的點數
 */
export function calculateBonusPoints(
  basePoints: number,
  config?: Partial<BonusEventConfig> | null,
  target?: 'checkIn' | 'purchase' | 'recycling' | 'drawBonus'
): number {
  if (basePoints <= 0) return 0;
  const multiplier = getBonusMultiplier(config, target);
  return Math.round(basePoints * multiplier);
}
