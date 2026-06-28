'use client';

import { Crown, Gem, Sparkles, Star, Trophy } from 'lucide-react';
import { cn } from "@/lib/utils";

/**
 * 全站統一的 7 個等級樣式定義
 */
export const userLevels = [
    { 
        level: '新手收藏家', 
        threshold: 0, 
        color: 'text-slate-400', 
        border: 'border-slate-700', 
        glow: 'shadow-none', 
        bg: 'bg-gradient-to-br from-slate-800 to-slate-900',
        icon: Crown
    },
    { 
        level: '進階收藏家', 
        threshold: 15000, 
        color: 'text-slate-200', 
        border: 'border-slate-500', 
        glow: 'shadow-lg shadow-slate-500/10', 
        bg: 'bg-gradient-to-br from-slate-700 to-slate-800',
        icon: Crown
    },
    { 
        level: '資深收藏家', 
        threshold: 50000, 
        color: 'text-amber-300', 
        border: 'border-amber-500/50', 
        glow: 'shadow-[0_0_20px_rgba(245,158,11,0.3)]', 
        bg: 'bg-gradient-to-br from-amber-900/50 to-amber-700/50',
        icon: Crown
    },
    { 
        level: '卡牌大師', 
        threshold: 100000, 
        color: 'text-yellow-400', 
        border: 'border-yellow-400/60', 
        glow: 'shadow-[0_0_40px_rgba(250,204,21,0.5)]', 
        bg: 'bg-gradient-to-br from-yellow-900 to-yellow-600', 
        animate: 'animate-pulse',
        icon: Gem
    },
    { 
        level: '殿堂級玩家', 
        threshold: 500000, 
        color: 'text-rose-400', 
        border: 'border-rose-500/70', 
        glow: 'shadow-[0_0_50px_rgba(225,29,72,0.6)]', 
        bg: 'bg-gradient-to-br from-rose-950 to-rose-700', 
        animate: 'animate-pulse',
        icon: Trophy
    },
    { 
        level: '傳奇收藏家', 
        threshold: 1000000, 
        color: 'text-purple-300', 
        border: 'border-purple-400/80', 
        glow: 'shadow-[0_0_60px_rgba(192,132,252,0.6)]', 
        bg: 'bg-gradient-to-br from-purple-950 to-purple-600', 
        animate: 'animate-pulse',
        icon: Crown
    },
    { 
        level: 'P+卡神', 
        threshold: 2000000, 
        color: 'text-cyan-300', 
        border: 'border-cyan-400', 
        glow: 'shadow-[0_0_80px_rgba(34,211,238,0.8)]', 
        bg: 'bg-gradient-to-br from-cyan-950 to-cyan-600', 
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
        md: 'w-20 h-20 border-2',
        lg: 'w-52 h-52 border-4'
    };

    const iconSizeClasses = {
        sm: 'w-5 h-5',
        md: 'w-10 h-10',
        lg: 'w-28 h-28'
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
