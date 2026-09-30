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
    checkIn: boolean; // 每日簽到雙倍
    purchase: boolean; // 儲值加贈雙倍
    recycling: boolean; // 卡片回收熔煉雙倍
    drawBonus: boolean; // 抽卡紅利賞雙倍
  };
}

// 預設活動配置 (開箱即可享受限時 2 倍盛典)
export const DEFAULT_BONUS_EVENT: BonusEventConfig = {
  isActive: true,
  multiplier: 2,
  title: '🔥 全站紅利 2X 狂歡狂飆週',
  subtitle: '活動期間：每日簽到紅利 2 倍、儲值回饋 2 倍、卡片回收熔煉享雙倍 P+ 點數！',
  startDate: '2026-09-28',
  endDate: '2026-10-15',
  targets: {
    checkIn: true,
    purchase: true,
    recycling: true,
    drawBonus: true,
  },
};

/**
 * 檢查紅利加倍活動目前是否在生傚期間內
 */
export function isBonusEventActive(config?: Partial<BonusEventConfig> | null): boolean {
  if (!config) return DEFAULT_BONUS_EVENT.isActive;
  if (config.isActive === false) return false;

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  const startDate = config.startDate || DEFAULT_BONUS_EVENT.startDate;
  const endDate = config.endDate || DEFAULT_BONUS_EVENT.endDate;

  if (startDate && todayStr < startDate) {
    return false;
  }
  if (endDate && todayStr > endDate) {
    return false;
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

  return Math.max(1, effectiveConfig.multiplier || 2);
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
