'use client';

import { Crown, Gem, Sparkles, Star, Trophy, Shield, Award } from 'lucide-react';
import { cn } from "@/lib/utils";

/**
 * 全站統一的 7 個等級樣式定義
 */
export const userLevels = [
    { 
        level: '新手收藏家', 
        threshold: 0, 
        color: 'text-slate-400', 
        border: 'border-slate-600', 
        glow: 'shadow-[0_0_15px_rgba(148,163,184,0.1)]', 
        bg: 'bg-gradient-to-br from-slate-800 via-slate-900 to-black',
        icon: Shield
    },
    { 
        level: '進階收藏家', 
        threshold: 15000, 
        color: 'text-slate-200', 
        border: 'border-slate-400', 
        glow: 'shadow-[0_0_20px_rgba(203,213,225,0.2)]', 
        bg: 'bg-gradient-to-br from-slate-600 via-slate-800 to-slate-950',
        icon: Star
    },
    { 
        level: '資深收藏家', 
        threshold: 50000, 
        color: 'text-amber-400', 
        border: 'border-amber-500/50', 
        glow: 'shadow-[0_0_25px_rgba(251,191,36,0.3)]', 
        bg: 'bg-gradient-to-br from-amber-700 via-amber-900 to-black',
        icon: Award
    },
    { 
        level: '卡牌大師', 
        threshold: 100000, 
        color: 'text-yellow-300', 
        border: 'border-yellow-400/60', 
        glow: 'shadow-[0_0_30px_rgba(253,224,71,0.4)]', 
        bg: 'bg-gradient-to-br from-yellow-600 via-yellow-800 to-amber-950', 
        animate: 'animate-pulse',
        icon: Gem
    },
    { 
        level: '殿堂級玩家', 
        threshold: 500000, 
        color: 'text-rose-400', 
        border: 'border-rose-500/70', 
        glow: 'shadow-[0_0_35px_rgba(251,113,133,0.5)]', 
        bg: 'bg-gradient-to-br from-rose-600 via-rose-800 to-black', 
        animate: 'animate-pulse',
        icon: Trophy
    },
    { 
        level: '傳奇收藏家', 
        threshold: 1000000, 
        color: 'text-purple-400', 
        border: 'border-purple-500/80', 
        glow: 'shadow-[0_0_40px_rgba(192,132,252,0.6)]', 
        bg: 'bg-gradient-to-br from-purple-600 via-purple-800 to-black', 
        animate: 'animate-pulse',
        icon: Sparkles
    },
    { 
        level: 'P+卡神', 
        threshold: 2000000, 
        color: 'text-cyan-400', 
        border: 'border-cyan-400', 
        glow: 'shadow-[0_0_50px_rgba(34,211,238,0.7)]', 
        bg: 'bg-gradient-to-br from-cyan-500 via-cyan-700 to-black', 
        animate: 'animate-bounce',
        icon: Crown
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
        sm: 'w-5 h-5',
        md: 'w-8 h-8 sm:w-10 sm:h-10',
        lg: 'w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14'
    };

    const isHighLevel = level === '傳奇收藏家' || level === 'P+卡神' || level === '卡牌大師';

    return (
        <div className={cn("flex flex-col items-center gap-3", className)}>
            <div className={cn(
                "relative flex items-center justify-center rounded-full transition-all duration-1000",
                levelInfo.bg,
                levelInfo.border,
                levelInfo.glow,
                sizeClasses[size],
                isHighLevel && "ring-4 ring-offset-4 ring-offset-background ring-white/5"
            )}>
                {/* Progressive Aura Effect */}
                {isHighLevel && (
                    <div className={cn(
                        "absolute -inset-2 rounded-full border-2 border-dashed animate-spin-slow",
                        levelInfo.color,
                        "opacity-30"
                    )} />
                )}

                {/* Dynamic Starburst Effect */}
                {isHighLevel && (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <div className={cn("absolute w-full h-full rounded-full animate-ping opacity-20", levelInfo.bg)} />
                        <Sparkles className={cn("absolute -top-2 -right-2 w-1/3 h-1/3 animate-pulse", levelInfo.color)} />
                        <Sparkles className={cn("absolute -bottom-2 -left-2 w-1/4 h-1/4 animate-pulse delay-700", levelInfo.color)} />
                    </div>
                )}

                <IconComponent className={cn(
                    "drop-shadow-[0_0_10px_currentColor]", 
                    levelInfo.color, 
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
