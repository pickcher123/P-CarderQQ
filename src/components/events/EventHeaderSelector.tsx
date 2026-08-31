'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Sparkles, Disc3, Ticket, Eye, Grid3X3, Flame, Trophy, Crown, Gift, QrCode } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type EventTabType = 'wheel' | 'kuji' | 'price-guess' | 'punch-grid';

export interface EventOption {
    id: EventTabType;
    number: number;
    title: string;
    subtitle: string;
    badge: string;
    badgeColor: string;
    icon: React.ComponentType<{ className?: string }>;
    accentColor: string;
    gradient: string;
    borderGlow: string;
    description: string;
}

export const EVENT_OPTIONS: EventOption[] = [
    {
        id: 'wheel',
        number: 1,
        title: '轉盤大福袋',
        subtitle: '3D 擲骰隨機洗牌・實時大轉盤抽獎',
        badge: '經典必備',
        badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-400/30',
        icon: Disc3,
        accentColor: 'text-cyan-400',
        gradient: 'from-cyan-500/20 via-blue-500/10 to-transparent',
        borderGlow: 'hover:border-cyan-400/50 hover:shadow-[0_0_25px_rgba(6,182,212,0.3)]',
        description: '支援 6~120 格、3D 骰子隨機打亂、零內定公平開獎與得獎名冊匯出。'
    },
    {
        id: 'kuji',
        number: 2,
        title: '活動套一番賞',
        subtitle: '真實撕籤互動・Last One 賞・大螢幕配率看板',
        badge: '超人氣玩法',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-400/30',
        icon: Ticket,
        accentColor: 'text-amber-400',
        gradient: 'from-amber-500/20 via-orange-500/10 to-transparent',
        borderGlow: 'hover:border-amber-400/50 hover:shadow-[0_0_25px_rgba(245,158,11,0.3)]',
        description: 'A/B/C/D 賞等級配置、80 籤撕籤牆、雙重中獎序號、全包套計算與最後一抽獎勵！'
    },
    {
        id: 'price-guess',
        number: 3,
        title: '卡展估價王',
        subtitle: '神之眼競猜挑戰・真實現況拍賣價・雙人對決 PK',
        badge: '卡展狂熱首推 🌟',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
        icon: Eye,
        accentColor: 'text-emerald-400',
        gradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
        borderGlow: 'hover:border-emerald-400/50 hover:shadow-[0_0_25px_rgba(168,85,247,0.3)]',
        description: '考驗卡迷鑑賞眼光！限時猜出 PSA 10 頂級球星卡與寶可夢神卡真實拍賣結標價。'
    },
    {
        id: 'punch-grid',
        number: 4,
        title: '九宮格盲盒戳戳樂',
        subtitle: '3x3 盲盒破箱・賓果連線大加碼',
        badge: '現場排隊爆款 🔥',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
        icon: Grid3X3,
        accentColor: 'text-purple-400',
        gradient: 'from-purple-500/20 via-pink-500/10 to-transparent',
        borderGlow: 'hover:border-purple-400/50 hover:shadow-[0_0_25px_rgba(168,85,247,0.3)]',
        description: '9 款特製神祕卡磚盒盲戳，達成橫/豎/斜三連線立即觸發全場「Bingo 頂級加碼」！'
    }
];

interface EventHeaderSelectorProps {
    currentTab: EventTabType;
    onSelectTab: (tab: EventTabType) => void;
    onOpenPromoModal?: () => void;
}

export function EventHeaderSelector({ currentTab, onSelectTab, onOpenPromoModal }: EventHeaderSelectorProps) {
    return (
        <div className="space-y-4">
            {/* 頂部標題區 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-white/10">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="p-2 rounded-xl bg-purple-500/20 border border-purple-400/30 text-purple-300">
                            <Sparkles className="w-5 h-5 animate-pulse" />
                        </span>
                        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center gap-2">
                            卡展與現場活動專區
                            <Badge className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white text-[11px] font-bold border-0 px-2 py-0.5 shadow-[0_0_15px_rgba(168,85,247,0.5)]">
                                4 大互動玩法
                            </Badge>
                        </h1>
                    </div>
                    <p className="text-xs sm:text-sm text-slate-400">
                        專為卡牌展覽、店家實體活動與線上直播打造的互動娛樂系統，點擊下方卡片即可隨時切換活動模式！
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto">
                    {/* 🎁 開幕免費領券入口按鈕 */}
                    {onOpenPromoModal && (
                        <Button
                            id="btn-open-promo-center"
                            onClick={onOpenPromoModal}
                            className="h-9 px-4 rounded-xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-400 hover:to-indigo-500 text-white font-black text-xs shadow-[0_0_20px_rgba(236,72,153,0.4)] border border-pink-400/40 animate-pulse active:scale-95 transition-all"
                        >
                            <Gift className="w-4 h-4 mr-1.5" />
                            🎁 開幕免費領券 / 兌換碼
                        </Button>
                    )}

                    <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900/80 px-3.5 py-2 rounded-xl border border-white/10">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
                        <span>現場連線中</span>
                    </div>
                </div>
            </div>

            {/* 4 大分類卡片切換區 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                {EVENT_OPTIONS.map((item) => {
                    const isSelected = currentTab === item.id;
                    const Icon = item.icon;

                    return (
                        <div
                            key={item.id}
                            id={`event-tab-${item.id}`}
                            onClick={() => onSelectTab(item.id)}
                            className={cn(
                                "group relative p-4 rounded-2xl cursor-pointer transition-all duration-300 select-none overflow-hidden",
                                "border backdrop-blur-xl",
                                isSelected
                                    ? "bg-slate-900/95 border-2 border-cyan-400/90 shadow-[0_0_30px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/40"
                                    : "bg-slate-900/60 border-white/10 hover:bg-slate-900/80 hover:border-white/20",
                                item.borderGlow
                            )}
                        >
                            {/* 頂部柔和漸層背景 */}
                            <div className={cn(
                                "absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none transition-opacity",
                                item.gradient,
                                isSelected ? "opacity-100" : "group-hover:opacity-80"
                            )} />

                            {/* 選中發光線條 */}
                            {isSelected && (
                                <motion.div 
                                    layoutId="event-tab-active-indicator"
                                    className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-cyan-400 via-purple-400 to-amber-400 shadow-[0_0_12px_rgba(6,182,212,0.8)]" 
                                />
                            )}

                            <div className="relative z-10 space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                        <div className={cn(
                                            "w-9 h-9 rounded-xl flex items-center justify-center font-black transition-all",
                                            isSelected 
                                                ? "bg-gradient-to-br from-cyan-500 to-blue-600 text-white shadow-[0_0_15px_rgba(6,182,212,0.5)] scale-105" 
                                                : "bg-slate-800 border border-white/10 text-slate-300 group-hover:scale-105"
                                        )}>
                                            <Icon className={cn("w-5 h-5", isSelected ? "text-white" : item.accentColor)} />
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[11px] font-mono text-slate-400">#{item.number}</span>
                                                <h3 className={cn(
                                                    "text-sm font-black transition-colors",
                                                    isSelected ? "text-white text-base" : "text-slate-200 group-hover:text-white"
                                                )}>
                                                    {item.title}
                                                </h3>
                                            </div>
                                        </div>
                                    </div>

                                    <Badge className={cn("text-[10px] px-2 py-0.5 shrink-0 border", item.badgeColor)}>
                                        {item.badge}
                                    </Badge>
                                </div>

                                <p className="text-xs text-slate-300 font-medium line-clamp-1">
                                    {item.subtitle}
                                </p>

                                <p className="text-[11px] text-slate-400 line-clamp-2 leading-relaxed">
                                    {item.description}
                                </p>

                                <div className="pt-2 flex items-center justify-between text-[11px] font-bold border-t border-white/10">
                                    <span className={cn(
                                        "transition-colors",
                                        isSelected ? item.accentColor : "text-slate-400 group-hover:text-slate-300"
                                    )}>
                                        {isSelected ? '● 正在進行中' : '點擊切換進入 ›'}
                                    </span>
                                    {isSelected && (
                                        <span className="px-2 py-0.5 rounded-full bg-white/10 text-white text-[10px]">
                                            使用中
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
