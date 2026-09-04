'use client';

import { useState, useEffect } from 'react';
import type { SystemConfig } from '@/types/system';

const STORAGE_KEY = 'card_applet_feature_flags_cache';

export interface FeatureFlagsState {
  isDrawEnabled?: boolean;
  isLuckyBagEnabled?: boolean;
  isBettingEnabled?: boolean;
  isGroupBreakEnabled?: boolean;
  isMarqueeEnabled?: boolean;
  showPromoHints?: boolean;
  isPredictionsEnabled?: boolean;
  isExhibitionsEnabled?: boolean;
}

// 同步取得本機端快取，杜絕頁面重新整理時「先出現又消失」的畫面跳動 (Anti-Flicker)
function getInitialCachedFlags(): FeatureFlagsState {
  if (typeof window === 'undefined') return {};
  try {
    const cached = window.localStorage.getItem(STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    // ignore parse error
  }
  return {};
}

export function useFeatureFlags(systemConfig?: SystemConfig | null) {
  const [flags, setFlags] = useState<FeatureFlagsState>(getInitialCachedFlags);

  useEffect(() => {
    if (systemConfig?.featureFlags) {
      setFlags(systemConfig.featureFlags);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(systemConfig.featureFlags));
      } catch {
        // ignore storage error
      }
    }
  }, [systemConfig?.featureFlags]);

  /**
   * 判斷某項功能是否啟用
   * @param flagKey 功能旗標鍵值
   * @param defaultValue 預設值 (預設為 true)
   */
  const isFeatureEnabled = (
    flagKey?: keyof FeatureFlagsState | string,
    defaultValue: boolean = true
  ): boolean => {
    if (!flagKey) return true;
    const val = (flags as any)?.[flagKey];
    if (typeof val === 'boolean') {
      return val;
    }
    return defaultValue;
  };

  return {
    flags,
    isFeatureEnabled,
  };
}
