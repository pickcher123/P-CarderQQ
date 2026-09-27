import type { SystemConfig } from '@/types/system';

export type ParticleMode = 'gold_dust' | 'stars' | 'none';

export interface StyleDetails {
  mode: ParticleMode;
  name: string;
  badge: string;
  description: string;
  themeColor: string;
}

export const STYLE_DEFINITIONS: Record<ParticleMode, StyleDetails> = {
  gold_dust: {
    mode: 'gold_dust',
    name: '璀璨金粒',
    badge: '奢華微金',
    description: '細膩微米金色微粒，溫潤低調漂浮',
    themeColor: '#D4AF37',
  },
  stars: {
    mode: 'stars',
    name: '夢幻星空',
    badge: '靜謐星芒',
    description: '深邃夜空與優雅流星星芒',
    themeColor: '#818CF8',
  },
  none: {
    mode: 'none',
    name: '完全關閉',
    badge: '純淨底色',
    description: '無任何流動特效，僅保留桌布原圖',
    themeColor: '#94A3B8',
  },
};

/**
 * 計算下一次 12:00 切換的目標時間與倒數
 */
export function getNextSwitchTime(
  type: 'every_12_hours' | 'daily_at_noon' = 'every_12_hours',
  now: Date = new Date()
): { nextDate: Date; remainingMs: number; displayText: string } {
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const next = new Date(now);
  next.setSeconds(0);
  next.setMilliseconds(0);

  if (type === 'every_12_hours') {
    // 每天 12 點雙時段切換 (中午 12:00 與 午夜 00:00 / 24:00)
    if (currentHour < 12) {
      // 下一個是今天中午 12:00
      next.setHours(12, 0, 0, 0);
    } else {
      // 下一個是明天午夜 00:00 (今晚 24:00)
      next.setDate(next.getDate() + 1);
      next.setHours(0, 0, 0, 0);
    }
  } else {
    // 每天中午 12:00 切換
    if (currentHour < 12) {
      next.setHours(12, 0, 0, 0);
    } else {
      next.setDate(next.getDate() + 1);
      next.setHours(12, 0, 0, 0);
    }
  }

  const remainingMs = Math.max(0, next.getTime() - now.getTime());
  const hours = Math.floor(remainingMs / (1000 * 60 * 60));
  const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));

  const isToday = next.getDate() === now.getDate();
  const timeStr = `${next.getHours().toString().padStart(2, '0')}:00`;
  const displayText = `${isToday ? '今日' : '明日'} ${timeStr}（約 ${hours} 小時 ${minutes} 分後）`;

  return { nextDate: next, remainingMs, displayText };
}

/**
 * 依據系統設定與目前時間，取得當前應生效的風格
 * 當管理員手動在後台指定桌面效果時，將優先以管理員設定為主（無視 12 點更換）
 */
export function getEffectiveParticleEffect(
  config?: SystemConfig | null,
  now: Date = new Date()
): ParticleMode {
  // 只有當管理員明確啟用「每日 12 點自動換風格」(dailyStyleRotation === true) 時，才執行定時計算
  if (config?.dailyStyleRotation === true) {
    const rotationType = config?.dailyRotationType || 'every_12_hours';
    const hour = now.getHours();

    if (rotationType === 'every_12_hours') {
      // 每天 12 點雙時段切換：
      // 中午 12:00 ~ 23:59: 璀璨金粒
      // 00:00 ~ 11:59: 夢幻星空
      return hour >= 12 ? 'gold_dust' : 'stars';
    } else {
      // 每日中午 12 點交替輪換（今日中午12:00 ~ 明日中午11:59）
      const noonOffsetMs = 12 * 60 * 60 * 1000;
      const effectiveDayNumber = Math.floor((now.getTime() - noonOffsetMs) / (24 * 60 * 60 * 1000));
      return effectiveDayNumber % 2 === 0 ? 'gold_dust' : 'stars';
    }
  }

  // 管理員手動在後台直接指定效果（無視 12 點更換）
  return config?.wallpaperParticleEffect || 'gold_dust';
}
