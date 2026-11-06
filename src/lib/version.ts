import type { SystemConfig, AppVersionConfig } from '@/types/system';

/**
 * @fileOverview 全站版本編號管理
 * 預設版本為公測版 6.0，支援從後台 SystemConfig 動態即時切換「公測版 / 正式版」與自訂版本號。
 */
export const DEFAULT_APP_VERSION = "公測版 6.0";

export const DEFAULT_VERSION_CONFIG: AppVersionConfig = {
  stage: 'beta',
  versionNumber: '6.0',
  customDisplay: '公測版 6.0'
};

/**
 * 依據後台系統設定格式化版本顯示名稱
 * 例如：'公測版 6.0' 或 '正式版 1.0'
 */
export function formatAppVersion(config?: AppVersionConfig | null): string {
  if (!config) return DEFAULT_APP_VERSION;
  if (config.customDisplay && config.customDisplay.trim()) {
    return config.customDisplay.trim();
  }
  const stageName = config.stage === 'production' ? '正式版' : (config.stage === 'rc' ? '候選版' : '公測版');
  const ver = config.versionNumber ? config.versionNumber.trim() : '6.0';
  return `${stageName} ${ver}`;
}

export function getAppVersionFromSystem(systemConfig?: SystemConfig | null): string {
  return formatAppVersion(systemConfig?.appVersionConfig);
}

// 供向後相容使用的靜態版本常數
export const APP_VERSION = DEFAULT_APP_VERSION;
