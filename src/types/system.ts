export interface LevelBenefit {
    level: string;
    threshold: number;
    freeShipping: boolean;
    depositBonus: number; // 百分比，例如 5 代表 5%
    cashbackRate: number; // 百分比，例如 1 代表 1%
}

export interface SystemConfig {
    logoUrl?: string;
    backgroundUrl?: string;
    aboutOriginImageUrl?: string; // 新增：關於頁面起源圖片
    showFloatingBackground?: boolean; // 新增：首頁 3D 浮動卡片動態背景開關
    backgroundOpacity?: number;
    cardOpacity?: number; // 新增：遊戲卡片不透明度
    liveYoutubeUrl?: string;
    isLiveEnabled?: boolean;
    supportLineUrl?: string;
    isSupportEnabled?: boolean;
    communityUrl?: string;
    isCommunityEnabled?: boolean;
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
}
