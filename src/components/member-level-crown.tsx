'use client';

import { cn } from "@/lib/utils";
import {
    RankNoviceEmblem,
    RankAdeptEmblem,
    RankVeteranEmblem,
    RankMasterEmblem,
    RankHallOfFameEmblem,
    RankLegendaryEmblem,
    RankGodEmblem,
} from '@/components/rank-emblems';

/**
 * 全站統一的 7 個等級樣式定義（深邃曜石底色襯托高對比金屬／晶鑽紋章）
 */
export const userLevels = [
    { 
        level: '新手收藏家', 
        threshold: 0, 
        color: 'text-slate-300', 
        border: 'border-slate-500/50', 
        glow: 'shadow-[0_4px_14px_rgba(0,0,0,0.65)]', 
        bg: 'bg-[radial-gradient(circle_at_30%_25%,#1e293b_0%,#0b101b_65%,#05070d_100%)]',
        animate: '',
        icon: RankNoviceEmblem
    },
    { 
        level: '進階收藏家', 
        threshold: 15000, 
        color: 'text-slate-100', 
        border: 'border-slate-300/60', 
        glow: 'shadow-[0_4px_16px_rgba(148,163,184,0.2)]', 
        bg: 'bg-[radial-gradient(circle_at_30%_25%,#263244_0%,#0d1320_65%,#05080f_100%)]',
        animate: '',
        icon: RankAdeptEmblem
    },
    { 
        level: '資深收藏家', 
        threshold: 50000, 
        color: 'text-amber-300', 
        border: 'border-amber-400/60', 
        glow: 'shadow-[0_4px_18px_rgba(245,158,11,0.22)]', 
        bg: 'bg-[radial-gradient(circle_at_30%_25%,#231a0b_0%,#0d1018_65%,#05070c_100%)]',
        animate: '',
        icon: RankVeteranEmblem
    },
    { 
        level: '卡牌大師', 
        threshold: 100000, 
        color: 'text-yellow-300', 
        border: 'border-yellow-400/70', 
        glow: 'shadow-[0_4px_20px_rgba(250,204,21,0.28)]', 
        bg: 'bg-[radial-gradient(circle_at_30%_25%,#261e09_0%,#0d1018_65%,#05070c_100%)]', 
        animate: '',
        icon: RankMasterEmblem
    },
    { 
        level: '殿堂級玩家', 
        threshold: 500000, 
        color: 'text-rose-300', 
        border: 'border-rose-400/75', 
        glow: 'shadow-[0_4px_22px_rgba(244,63,94,0.3)]', 
        bg: 'bg-[radial-gradient(circle_at_30%_25%,#280c15_0%,#0e0d16_65%,#06060b_100%)]', 
        animate: '',
        icon: RankHallOfFameEmblem
    },
    { 
        level: '傳奇收藏家', 
        threshold: 1000000, 
        color: 'text-purple-300', 
        border: 'border-purple-400/80', 
        glow: 'shadow-[0_4px_24px_rgba(168,85,247,0.35)]', 
        bg: 'bg-[radial-gradient(circle_at_30%_25%,#1f0e2e_0%,#0d0d18_65%,#05060c_100%)]', 
        animate: '',
        icon: RankLegendaryEmblem
    },
    { 
        level: 'P+卡神', 
        threshold: 2000000, 
        color: 'text-cyan-300', 
        border: 'border-cyan-400/85', 
        glow: 'shadow-[0_4px_26px_rgba(34,211,238,0.38)]', 
        bg: 'bg-[radial-gradient(circle_at_30%_25%,#082530_0%,#09111c_65%,#04070d_100%)]', 
        animate: '',
        icon: RankGodEmblem
    },
];

interface MemberLevelCrownProps {
    level: string;
    showLabel?: boolean;
    className?: string;
    size?: 'sm' | 'md' | 'lg';
}

export function MemberLevelCrown({ level, showLabel = false, className, size = 'md' }: MemberLevelCrownProps) {
    const levelInfo = userLevels.find(l => l.level === level) || userLevels[0];
    const IconComponent = levelInfo.icon;
    
    const sizeClasses = {
        sm: 'w-10 h-10 border-[1.5px]',
        md: 'w-16 h-16 sm:w-20 sm:h-20 border-2',
        lg: 'w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 border-2 sm:border-[3px]'
    };

    const iconSizeClasses = {
        sm: 'w-6 h-6',
        md: 'w-10 h-10 sm:w-12 sm:h-12',
        lg: 'w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16'
    };

    const isHighLevel = level === '傳奇收藏家' || level === 'P+卡神' || level === '卡牌大師' || level === '殿堂級玩家';

    return (
        <div className={cn("flex flex-col items-center gap-3", className)}>
            <div className={cn(
                "relative flex items-center justify-center rounded-full transition-all duration-300 ring-1 ring-inset ring-white/15",
                levelInfo.bg,
                levelInfo.border,
                levelInfo.glow,
                sizeClasses[size],
                isHighLevel && "ring-offset-2 ring-offset-slate-950"
            )}>
                {/* 外圍細緻星軌環 */}
                {isHighLevel && (
                    <div className={cn(
                        "absolute -inset-1.5 rounded-full border border-dashed animate-spin-slow opacity-30 pointer-events-none",
                        levelInfo.border
                    )} />
                )}

                <IconComponent className={cn(
                    "drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)]",
                    levelInfo.animate,
                    iconSizeClasses[size]
                )} />
            </div>

            {showLabel && (
                <div className={cn(
                    "px-4 py-1.5 rounded-full text-[10px] md:text-sm font-black font-headline tracking-[0.15em] bg-black/60 border backdrop-blur-sm whitespace-nowrap shadow-xl",
                    levelInfo.border,
                    "text-white", // 將 levelInfo.color 強制強制固定為白色
                    isHighLevel && "animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent bg-[length:200%_100%]"
                )}>
                    {level.toUpperCase()}
                </div>
            )}
        </div>
    );
}
