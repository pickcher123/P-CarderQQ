export interface LevelBenefit {
    level: string;
    threshold: number;
    freeShipping: boolean;
    depositBonus: number; // 百分比，例如 5 代表 5%
    cashbackRate: number; // 百分比，例如 1 代表 1%
}

export interface MaintenanceConfig {
    enabled: boolean;
    title?: string;
    message?: string;
    estimatedEndTime?: string; // 預計恢復時間，例如 "2026-10-21 18:00"
    allowAdminBypass?: boolean; // 管理員是否可穿透預覽（預設為 true）
    contactUrl?: string; // 維護期間緊急客服或官方 LINE 連結
    lastUpdated?: string;
    updatedBy?: string;
}

export interface SystemConfig {
    logoUrl?: string;
    backgroundUrl?: string;
    aboutOriginImageUrl?: string; // 新增：關於頁面起源圖片
    showFloatingBackground?: boolean; // 新增：首頁 3D 浮動卡片動態背景開關
    backgroundOpacity?: number;
    wallpaperParticleEffect?: 'gold_dust' | 'stars' | 'none'; // 桌布背景顆粒特效 (金粉 / 星空 / 關閉)
    dailyStyleRotation?: boolean; // 每天 12 點自動換風格開關
    dailyRotationType?: 'every_12_hours' | 'daily_at_noon'; // 輪換模式：每 12 小時(中午/午夜) 或 每日中午 12 點
    cardOpacity?: number; // 新增：遊戲卡片不透明度
    liveYoutubeUrl?: string;
    isLiveEnabled?: boolean;
    supportLineUrl?: string;
    isSupportEnabled?: boolean;
    communityUrl?: string;
    isCommunityEnabled?: boolean;
    maintenance?: MaintenanceConfig; // 🚧 全站維護模式配置
    featureFlags?: {
        isDrawEnabled?: boolean;
        isLuckyBagEnabled?: boolean;
        isBettingEnabled?: boolean;
        isGroupBreakEnabled?: boolean;
        isMarqueeEnabled?: boolean; // 新增：跑馬燈開關
        showPromoHints?: boolean; // 新增：前台活動代碼快捷推薦開關
        isPredictionsEnabled?: boolean; // 新增：賽事預測開關
        isExhibitionsEnabled?: boolean; // 新增：卡展行事曆開關
    };
    showPromoCodeHints?: boolean; // 前台活動專區是否公開顯示熱門兌換碼清單 (預設隱藏)
    levelBenefits?: LevelBenefit[];
    bettingAutoRelistOnBuyBack?: boolean; // 拼卡 Buy Back (轉點) 自動重新上架開關
    bonusEvent?: {
        isActive?: boolean;
        multiplier?: number;
        title?: string;
        subtitle?: string;
        startDate?: string;
        endDate?: string;
        targets?: {
            checkIn?: boolean;
            purchase?: boolean;
            recycling?: boolean;
            drawBonus?: boolean;
        };
    };
}
