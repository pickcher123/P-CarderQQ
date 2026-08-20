'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Zap, Star, Diamond, Layers, X, Package, Sparkles, Eye, ChevronRight } from 'lucide-react';
import { PPlusIcon, DiamondIcon } from '@/components/icons';
import { SafeImage } from '@/components/safe-image';
import { format } from 'date-fns';
import { CardItem } from '@/components/card-item';
import { RandomPlayerCard } from '@/components/random-player-card';
import { userLevels } from '@/components/member-level-crown';
import { VerifyAgeModal } from '@/components/verify-age-modal';

// (Re-adding interfaces and constants as in the file)
const RARITIES = ['legendary', 'rare', 'common'] as const;
type Rarity = typeof RARITIES[number];
const rarityStyles: Record<Rarity, { text: string, bg: string, border: string, shadow: string, label: string, icon: any, badgeBg: string }> = {
  legendary: { 
    text: 'text-amber-400', 
    bg: 'bg-gradient-to-br from-amber-500/20 via-slate-900 to-slate-950', 
    border: 'border-amber-500/50', 
    shadow: 'shadow-[0_0_20px_rgba(245,158,11,0.25)]', 
    label: '傳說賞', 
    icon: Star,
    badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/50'
  },
  rare: { 
    text: 'text-purple-400', 
    bg: 'bg-gradient-to-br from-purple-500/20 via-slate-900 to-slate-950', 
    border: 'border-purple-500/50', 
    shadow: 'shadow-[0_0_20px_rgba(168,85,247,0.25)]', 
    label: '稀有賞', 
    icon: Diamond,
    badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/50'
  },
  common: { 
    text: 'text-cyan-400', 
    bg: 'bg-gradient-to-br from-cyan-500/15 via-slate-900 to-slate-950', 
    border: 'border-cyan-500/40', 
    shadow: 'shadow-[0_0_15px_rgba(34,211,238,0.2)]', 
    label: '普通賞', 
    icon: Layers,
    badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
  },
};

const pointPrizeStyles: Record<Rarity, { text: string, bg: string, border: string, glow: string }> = {
  legendary: { 
    text: 'text-amber-400', 
    bg: 'bg-gradient-to-br from-amber-500/30 via-slate-900 to-slate-950', 
    border: 'border-amber-400/60', 
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.3)]' 
  },
  rare: { 
    text: 'text-purple-400', 
    bg: 'bg-gradient-to-br from-purple-500/30 via-slate-900 to-slate-950', 
    border: 'border-purple-400/60', 
    glow: 'shadow-[0_0_30px_rgba(168,85,247,0.3)]' 
  },
  common: { 
    text: 'text-cyan-400', 
    bg: 'bg-gradient-to-br from-cyan-500/25 via-slate-900 to-slate-950', 
    border: 'border-cyan-400/50', 
    glow: 'shadow-[0_0_25px_rgba(34,211,238,0.25)]' 
  },
};

interface CardData { id: string; name: string; imageUrl: string; backImageUrl?: string; imageHint: string; isSold?: boolean; }
interface CardPool { id: string; name: string; description: string; price?: number; price3Draws?: number; price10Draws?: number; totalPacks?: number; remainingPacks?: number; hasProtection?: boolean; isFeatured?: boolean; currency?: 'diamond' | 'p-point'; cardRarities?: { [cardId: string]: Rarity }; cards?: { cardId: string; quantity: number }[]; pointPrizes?: { prizeId: string; points: number; quantity: number; rarity: Rarity; name?: string }[]; lastPrizeCardId?: string; imageUrl?: string; startsAt?: { seconds: number; nanoseconds: number; }; expiresAt?: { seconds: number; nanoseconds: number; }; pointMultiplier?: number; pointMultiplierExpiresAt?: { seconds: number; nanoseconds: number; }; lockedBy?: string; lockedAt?: { seconds: number; nanoseconds: number; }; categoryId?: string; dailyLimit?: number; minLevel?: string; isAdult?: boolean; }
const LOCK_DURATION = 120;

export function PoolCard({ pool, allCardsMap, userProfile }: { pool: CardPool, allCardsMap: Map<string, CardData>, userProfile: any }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [previewCard, setPreviewCard] = useState<any | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [isAgeVerifiedModalOpen, setIsAgeVerifiedModalOpen] = useState(false);
    const [pendingDraws, setPendingDraws] = useState<number>(0);

    const isAuthReady = !isUserLoading;
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const poolStatsRef = useMemoFirebase(() => (firestore && user?.uid && pool.id) ? doc(firestore, 'users', user.uid, 'poolStats', pool.id) : null, [firestore, user?.uid, pool.id]);
    const { data: poolStats, isLoading: isLoadingStats } = useDoc<any>(poolStatsRef);

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const todayDrawCount = useMemo(() => {
        if (!poolStats || poolStats.lastDrawDate !== todayStr) return 0;
        return poolStats.count || 0;
    }, [poolStats, todayStr]);

    const isDailyLimitReached = useMemo(() => {
        return !!(pool.dailyLimit && pool.dailyLimit > 0 && todayDrawCount >= pool.dailyLimit);
    }, [pool.dailyLimit, todayDrawCount]);

    const isMultiplierActive = useMemo(() => {
        if (!pool.pointMultiplier || pool.pointMultiplier <= 1) return false;
        if (!pool.pointMultiplierExpiresAt) return true;
        return currentTime < new Date(pool.pointMultiplierExpiresAt.seconds * 1000);
    }, [pool.pointMultiplier, pool.pointMultiplierExpiresAt, currentTime]);

    const poolStatus = useMemo(() => {
        const isSoldOut = (pool.remainingPacks ?? 0) <= 0;
        if (isSoldOut) return { status: 'sold-out', disabled: true, message: '已全數售罄' };
        if (pool.expiresAt && currentTime > new Date(pool.expiresAt.seconds * 1000)) return { status: 'expired', disabled: true, message: '已結束' };
        if (pool.startsAt) {
            const start = new Date(pool.startsAt.seconds * 1000);
            if (currentTime < start) return { status: 'not-started', disabled: true, message: format(start, "MM-dd HH:mm") + ' 開放' };
        }
        if (pool.hasProtection !== false && pool.lockedAt) {
            const lockTime = typeof (pool.lockedAt as any).seconds === 'number'
                ? new Date((pool.lockedAt as any).seconds * 1000)
                : ((pool.lockedAt as any) instanceof Date ? (pool.lockedAt as any) : new Date());
            const diff = Math.floor((currentTime.getTime() - lockTime.getTime()) / 1000);
            if (diff < LOCK_DURATION) {
                return { status: pool.lockedBy === user?.uid ? 'locked-by-me' : 'locked', disabled: pool.lockedBy !== user?.uid, message: `${LOCK_DURATION - diff}秒` };
            }
        }
        if (!isAuthReady || isLoadingStats) return { status: 'loading', disabled: true, message: '驗證中...' };
        const userLevelInfo = userLevels.find(l => l.level === userProfile?.userLevel) || userLevels[0];
        const minLevelInfo = userLevels.find(l => l.level === pool.minLevel);
        if (pool.minLevel && pool.minLevel !== '新手收藏家' && userLevelInfo && minLevelInfo && userLevelInfo.threshold < minLevelInfo.threshold) {
             return { status: 'level-too-low', disabled: true, message: `需等級 ${pool.minLevel} 以上` };
        }
        if (isDailyLimitReached) return { status: 'limit-reached', disabled: true, message: '今日次數已用完' };
        return { status: 'open', disabled: false, message: '' };
    }, [pool, currentTime, user, isDailyLimitReached, isLoadingStats, isAuthReady, userProfile]);
    
    const rarityDetails = useMemo(() => {
        const counts = { legendary: 0, rare: 0, common: 0 };
        let total = 0;
        
        if ((pool.remainingPacks ?? 0) > 0) {
            pool.cards?.forEach(c => {
                const r = pool.cardRarities?.[c.cardId] || 'common';
                const cardData = allCardsMap.get(c.cardId);
                if (c.quantity > 0 && cardData && !cardData.isSold) {
                    if (r in counts) counts[r as Rarity] += c.quantity;
                    total += c.quantity;
                }
            });
            pool.pointPrizes?.forEach(p => {
                const r = p.rarity || 'common';
                if (p.quantity > 0) {
                    if (r in counts) counts[r as Rarity] += p.quantity;
                    total += p.quantity;
                }
            });
        }

        return {
            legendary: { count: counts.legendary, prob: total > 0 ? (counts.legendary / total) * 100 : 0 },
            rare: { count: counts.rare, prob: total > 0 ? (counts.rare / total) * 100 : 0 },
            common: { count: counts.common, prob: total > 0 ? (counts.common / total) * 100 : 0 },
            total
        };
    }, [pool, allCardsMap]);

    const lastPrizeCard = pool.lastPrizeCardId ? allCardsMap.get(pool.lastPrizeCardId) : null;
    
    const topPrizesPreview = useMemo(() => {
        const availableCards: any[] = [];
        const addedCardIds = new Set<string>();

        if (pool.cards && pool.cards.length > 0) {
            for (const c of pool.cards) {
                if (!c.cardId || (c.quantity || 0) <= 0) continue;
                if (addedCardIds.has(c.cardId)) continue;

                const data = allCardsMap.get(c.cardId);
                if (data && !data.isSold) {
                    const rarity = pool.cardRarities?.[c.cardId] || 'common';
                    const cardVal = (data as any).sellPrice ?? (data as any).estimatedValue ?? (data as any).price ?? (data as any).points ?? (data as any).value ?? 0;
                    
                    availableCards.push({
                        ...data,
                        type: 'card',
                        rarity,
                        quantity: c.quantity,
                        cardVal: Number(cardVal) || 0,
                    });
                    addedCardIds.add(c.cardId);
                }
            }
        }

        if (pool.cardRarities) {
            Object.entries(pool.cardRarities).forEach(([id, rarity]) => {
                if (addedCardIds.has(id)) return;
                const data = allCardsMap.get(id);
                const qty = pool.cards?.filter(c => c.cardId === id).reduce((acc, c) => acc + (c.quantity || 0), 0) || 0;
                if (data && qty > 0 && !data.isSold) {
                    const cardVal = (data as any).sellPrice ?? (data as any).estimatedValue ?? (data as any).price ?? (data as any).points ?? (data as any).value ?? 0;
                    availableCards.push({
                        ...data,
                        type: 'card',
                        rarity,
                        quantity: qty,
                        cardVal: Number(cardVal) || 0,
                    });
                    addedCardIds.add(id);
                }
            });
        }

        const rarityOrder: Record<string, number> = { legendary: 3, rare: 2, common: 1 };

        availableCards.sort((a, b) => {
            if (b.cardVal !== a.cardVal) {
                return b.cardVal - a.cardVal;
            }
            const rA = rarityOrder[a.rarity] || 0;
            const rB = rarityOrder[b.rarity] || 0;
            if (rB !== rA) {
                return rB - rA;
            }
            return (a.name || '').localeCompare(b.name || '');
        });

        return availableCards;
    }, [pool, allCardsMap]);

    const allPrizesInPool = useMemo(() => {
        const list: any[] = [];
        if (pool.cards) {
            pool.cards.forEach(c => {
                const data = allCardsMap.get(c.cardId);
                const rarity = pool.cardRarities?.[c.cardId] || 'common';
                if (data) {
                    list.push({
                        id: c.cardId,
                        name: data.name,
                        imageUrl: data.imageUrl,
                        backImageUrl: data.backImageUrl,
                        rarity,
                        quantity: c.quantity,
                        isSoldOut: c.quantity <= 0 || data.isSold,
                        isPoints: false,
                    });
                }
            });
        }
        if (pool.pointPrizes) {
            pool.pointPrizes.forEach((p, idx) => {
                list.push({
                    id: p.prizeId || `pp-${idx}`,
                    name: p.name || '隨機球員 普/特 卡',
                    imageUrl: '',
                    rarity: p.rarity || 'common',
                    quantity: p.quantity,
                    isSoldOut: p.quantity <= 0,
                    isPoints: true,
                    points: p.points,
                });
            });
        }
        return list;
    }, [pool, allCardsMap]);

    const handleDraw = (draws: number) => {
        if (pool.isAdult) {
            setPendingDraws(draws);
            setIsAgeVerifiedModalOpen(true);
        } else {
            setIsDrawing(true);
            setTimeout(() => {
                router.push(`/draw/open?poolId=${pool.id}&draws=${draws}`);
            }, 800);
        }
    };

    const handleTrialDraw = () => {
        setIsDrawing(true);
        setTimeout(() => {
            router.push(`/draw/open?poolId=${pool.id}&draws=1&trial=true`);
        }, 300);
    };

    return (
        <div className="relative font-sans text-slate-100">
            <VerifyAgeModal 
                isOpen={isAgeVerifiedModalOpen}
                onClose={() => setIsAgeVerifiedModalOpen(false)}
                onConfirm={() => {
                    setIsAgeVerifiedModalOpen(false);
                    router.push(`/draw/open?poolId=${pool.id}&draws=${pendingDraws}`);
                }}
            />
            
            <div className="relative w-full max-w-3xl bg-slate-900/60 backdrop-blur-xl border border-slate-700/60 rounded-2xl sm:rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.6)] overflow-hidden p-3.5 sm:p-6 md:p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 via-amber-400 to-purple-600"></div>

                {/* 👑 一體化標題與焦點頭獎 HERO SHOWCASE */}
                <div className="mb-4 sm:mb-6 relative group">
                    {/* Golden/Cyan Ambient Backdrop Glow */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500/20 via-amber-500/25 to-indigo-500/20 rounded-2xl blur-md opacity-80 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <div className="relative bg-gradient-to-b from-[#111827]/95 via-[#0f1524]/95 to-[#090d16]/98 backdrop-blur-md border-2 border-amber-500/50 rounded-2xl p-3.5 sm:p-5 shadow-[0_10px_30px_rgba(0,0,0,0.5)] overflow-hidden">
                        {/* Top Accent Shimmer Line */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-amber-400 to-indigo-500 bg-[length:200%_100%] animate-shimmer" />

                        {/* 特殊機制標籤列 */}
                        <div className="flex items-center justify-center gap-1.5 mb-2.5 flex-wrap">
                            {pool.isFeatured && (
                                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold text-[10px] px-2 py-0.5">
                                    <Sparkles className="w-3 h-3 mr-1 text-amber-400" /> 熱門精選
                                </Badge>
                            )}
                            {pool.hasProtection && (
                                <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/50 font-bold text-[10px] px-2 py-0.5">
                                    <Trophy className="w-3 h-3 mr-1 text-cyan-400" /> 保底機制
                                </Badge>
                            )}
                            {isMultiplierActive && (
                                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold text-[10px] px-2 py-0.5 animate-pulse">
                                    <Zap className="w-3 h-3 mr-1 text-amber-400" /> {pool.pointMultiplier}x P點加倍
                                </Badge>
                            )}
                            {pool.minLevel && (
                                <Badge className="bg-purple-500/20 text-purple-300 border border-purple-500/50 font-bold text-[10px] px-2 py-0.5">
                                    <Star className="w-3 h-3 mr-1 text-purple-400" /> VIP限定
                                </Badge>
                            )}
                            {pool.isAdult && (
                                <Badge className="bg-rose-500/20 text-rose-300 border border-rose-500/50 font-bold text-[10px] px-2 py-0.5">
                                    🔞 18+ 專區
                                </Badge>
                            )}
                        </div>

                        {/* 卡池標題與頂部操作 */}
                        <div className="relative pb-3 mb-3 border-b border-slate-700/60 text-center">
                            {/* 置中標題與說明 */}
                            <h1 className="text-lg sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-amber-200 to-indigo-200 tracking-wider break-words leading-tight text-center drop-shadow-sm">
                                {pool.name}
                            </h1>
                            {pool.description && (
                                <p className="text-slate-300/90 text-xs sm:text-sm mt-1.5 break-words leading-relaxed text-center mx-auto max-w-xl">{pool.description}</p>
                            )}

                            {/* 賞品清冊按鈕：置中融合於標題與頭獎之間 */}
                            <div className="mt-3 flex justify-center">
                                <button 
                                    onClick={() => setIsInventoryOpen(true)}
                                    className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-white bg-amber-500/15 hover:bg-amber-500/30 border border-amber-400/60 px-4 py-1.5 rounded-full transition-all cursor-pointer shadow-sm hover:shadow-[0_0_16px_rgba(245,158,11,0.4)] active:scale-95 group/btn"
                                >
                                    <Trophy className="w-3.5 h-3.5 text-amber-400 group-hover/btn:scale-110 transition-transform" />
                                    <span>查看賞品清冊</span>
                                    <ChevronRight className="w-3.5 h-3.5 text-amber-400/80 group-hover/btn:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        </div>

                        {/* 焦點頭獎資訊 (排版優化：圖片加大立體展示，手持設備垂直置中 / 大螢幕橫向精美卡片) */}
                        {topPrizesPreview.length > 0 && topPrizesPreview[0] ? (
                            <div className="space-y-2.5">
                                {/* 焦點頭獎 Header Line */}
                                <div className="flex items-center justify-between px-1">
                                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                                        <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                                        <span className="tracking-wider">焦點頭獎</span>
                                    </div>
                                    <span className="text-[11px] text-amber-300/90 font-medium">本池最高價值賞品</span>
                                </div>

                                {/* 卡片展示主區塊 */}
                                <div 
                                    onClick={() => setPreviewCard(topPrizesPreview[0])}
                                    className="relative bg-gradient-to-b from-amber-950/40 via-slate-900/90 to-slate-950/95 border border-amber-400/60 hover:border-amber-300 rounded-xl p-3.5 sm:p-5 flex flex-col sm:flex-row items-center sm:items-start gap-4 cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_25px_rgba(245,158,11,0.35)] group/hero"
                                >
                                    {/* 卡片圖片 (立體陰影與亮框，大小升級且居中/獨立顯示) */}
                                    <div className="relative w-28 sm:w-32 md:w-36 aspect-[2.5/3.5] rounded-xl overflow-hidden border-2 border-amber-400/90 bg-slate-950 shrink-0 shadow-[0_8px_20px_rgba(0,0,0,0.6)] group-hover/hero:border-amber-300 group-hover/hero:shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all">
                                        <SafeImage src={topPrizesPreview[0].imageUrl} alt={topPrizesPreview[0].name} sizes="200px" fill className="object-cover rounded-lg group-hover/hero:scale-105 transition-transform duration-500" />
                                    </div>

                                    {/* 卡片資訊 */}
                                    <div className="flex-1 min-w-0 w-full text-center sm:text-left flex flex-col justify-between self-stretch py-1">
                                        <div>
                                            <div className="flex items-center justify-center sm:justify-start gap-2 mb-2 flex-wrap">
                                                <span className={cn(
                                                    "px-2.5 py-0.5 rounded-full text-xs font-black uppercase tracking-wider border shrink-0",
                                                    rarityStyles[topPrizesPreview[0].rarity as Rarity]?.badgeBg || "bg-amber-500/20 text-amber-300 border-amber-500/50"
                                                )}>
                                                    {rarityStyles[topPrizesPreview[0].rarity as Rarity]?.label || '傳說賞'}
                                                </span>
                                                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-400/50 text-amber-200 shrink-0">
                                                    剩餘 {topPrizesPreview[0].quantity ?? 1} 張
                                                </span>
                                            </div>

                                            <h4 className="text-base sm:text-lg md:text-xl font-black text-white break-words leading-snug mb-2 group-hover/hero:text-amber-200 transition-colors">
                                                {topPrizesPreview[0].name}
                                            </h4>
                                        </div>

                                        <div className="mt-2 sm:mt-0 flex items-center justify-center sm:justify-start">
                                            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/50 px-3.5 py-1 rounded-full group-hover/hero:border-amber-300 transition-all shadow-sm">
                                                <Eye className="w-3.5 h-3.5 text-amber-400" /> 點擊查看卡片細節
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-3 text-slate-400 text-xs">
                                目前尚無大獎資訊
                            </div>
                        )}
                    </div>
                </div>

                {/* 📊 整合一體化：賞別剩餘張數、機率與存量面板（極簡精煉設計） */}
                <div className="mb-3.5 bg-slate-950/80 backdrop-blur-md rounded-xl sm:rounded-2xl border border-slate-800/80 p-3 sm:p-4 shadow-sm">
                    {/* 賞別 3 欄精簡統計 */}
                    <div className="grid grid-cols-3 gap-2 divide-x divide-slate-800/80">
                        {RARITIES.map((r, idx) => {
                            const detail = rarityDetails[r];
                            const RarityIcon = rarityStyles[r].icon;

                            return (
                                <div key={r} className={cn(
                                    "flex flex-col items-center justify-center text-center",
                                    idx > 0 && "pl-2"
                                )}>
                                    {/* 賞別標題 */}
                                    <div className="flex items-center gap-1 mb-1">
                                        <RarityIcon className={cn("w-3 h-3 shrink-0", rarityStyles[r].text)} />
                                        <span className={cn("text-[11px] sm:text-xs font-bold tracking-tight", rarityStyles[r].text)}>
                                            {rarityStyles[r].label}
                                        </span>
                                    </div>

                                    {/* 剩餘張數 */}
                                    <div className="text-white font-mono text-lg sm:text-xl font-black leading-none my-0.5">
                                        {detail.count}
                                        <span className="text-[10px] sm:text-xs font-normal text-slate-400 ml-0.5">張</span>
                                    </div>

                                    {/* 機率 */}
                                    <span className="text-[10px] font-mono text-slate-400 mt-0.5">
                                        {detail.prob.toFixed(1)}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* 卡池剩餘包數與進度條（精簡版） */}
                    <div className="mt-3 pt-2.5 border-t border-slate-800/70">
                        <div className="flex justify-between items-center text-xs mb-1.5 font-medium">
                            <span className="text-slate-400 flex items-center gap-1 text-[11px] sm:text-xs">
                                <Zap className="w-3 h-3 text-cyan-400" />
                                剩餘包數
                            </span>
                            <div className="flex items-baseline gap-1 font-mono text-xs">
                                <span className="font-bold text-white text-sm">{pool.remainingPacks}</span>
                                <span className="text-slate-500 text-[11px]">/{pool.totalPacks}</span>
                                <span className="text-cyan-400 text-[11px] font-bold ml-1">
                                    ({((pool.remainingPacks || 0) / (pool.totalPacks || 1) * 100).toFixed(0)}%)
                                </span>
                            </div>
                        </div>
                        <div className="h-1.5 sm:h-2 w-full bg-slate-900 rounded-full overflow-hidden p-0">
                            <div 
                                className="h-full bg-gradient-to-r from-cyan-400 to-amber-400 rounded-full transition-all duration-500"
                                style={{ width: `${Math.max(0, Math.min(100, (pool.remainingPacks || 0) / (pool.totalPacks || 1) * 100))}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* 狀態列（極簡行） */}
                <div className="flex justify-between items-center px-1 mb-3 text-[11px] text-slate-400 font-medium">
                    <div>
                        已抽 <span className="text-cyan-400 font-mono font-bold">{todayDrawCount}</span> 次
                    </div>
                    {pool.expiresAt && (
                        <div className="flex items-center text-slate-400" suppressHydrationWarning>
                            <Clock className="w-3 h-3 mr-1 text-slate-500" />
                            截止 {format(new Date(pool.expiresAt.seconds * 1000), "MM/dd HH:mm")}
                        </div>
                    )}
                </div>

                {/* 抽卡操作按鈕 */}
                <div className="grid grid-cols-3 gap-2 sm:gap-3 relative">
                    {isDrawing && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
                            <div className="flex space-x-1.5">
                                <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-2.5 h-2.5 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}

                    {[1, 3, 10].map((drawCount) => {
                        const canDraw = !poolStatus.disabled;
                        const baseCost = (pool.price || 0) * drawCount;
                        const price = drawCount === 1 ? (pool.price || 0) 
                                    : drawCount === 3 ? (pool.price3Draws || baseCost) 
                                    : (pool.price10Draws || baseCost);
                        const savings = baseCost - price;
                        const label = `${drawCount} 抽`;
                        const isPPoint = pool.currency === 'p-point';
                        
                        return (
                            <Button 
                                key={drawCount}
                                disabled={!canDraw || isDrawing}
                                className={cn(
                                    "relative h-auto py-2 sm:py-2.5 px-1 flex flex-col items-center justify-center rounded-xl transition-all active:scale-95 overflow-hidden border group cursor-pointer",
                                    drawCount === 10
                                        ? "bg-gradient-to-b from-blue-600 to-indigo-800 border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:brightness-110"
                                        : drawCount === 3
                                        ? "bg-gradient-to-b from-slate-800 to-slate-900 border-indigo-500/40 hover:border-indigo-400"
                                        : "bg-gradient-to-b from-slate-800 to-slate-900 border-slate-700/80 hover:border-slate-600"
                                )}
                                onClick={() => handleDraw(drawCount)}
                            >
                                {/* Savings Badge */}
                                {savings > 0 && (
                                    <span className="absolute top-0 right-0 bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-bl-md leading-none">
                                        省{savings >= 10000 ? `${(savings / 1000).toFixed(0)}k` : savings.toLocaleString()}
                                    </span>
                                )}

                                <span className={cn(
                                    "font-bold text-xs sm:text-sm tracking-wide",
                                    drawCount === 10 ? "text-cyan-100 font-black" : "text-slate-200"
                                )}>
                                    {label}
                                </span>
                                
                                <span className="flex items-center justify-center text-white font-mono font-black text-xs sm:text-sm tracking-tight mt-0.5">
                                    <span>{price.toLocaleString()}</span>
                                    {isPPoint ? (
                                        <PPlusIcon className="w-3.5 h-3.5 ml-0.5 shrink-0 text-amber-400" />
                                    ) : (
                                        <DiamondIcon className={cn("w-3.5 h-3.5 ml-0.5 shrink-0", drawCount === 10 ? "text-cyan-300" : "text-cyan-400")} />
                                    )}
                                </span>
                            </Button>
                        )
                    })}
                </div>

                <Button 
                    variant="outline" 
                    className="w-full mt-2 h-9 sm:h-10 text-xs font-bold rounded-xl border border-purple-500/40 bg-purple-950/40 text-purple-200 hover:text-white hover:bg-purple-900/60 hover:border-purple-400 flex items-center justify-center gap-1.5 transition-all cursor-pointer active:scale-[0.99]"
                    onClick={handleTrialDraw}
                    disabled={isDrawing}
                >
                    <Sparkles className="w-3.5 h-3.5 text-fuchsia-400" />
                    <span>免費試手氣 (模擬抽)</span>
                </Button>
            </div>
            
            {isInventoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 animate-in fade-in-0 duration-200" onClick={() => setIsInventoryOpen(false)}>
                    <div 
                        className="relative max-w-4xl w-full bg-[#080d1a]/95 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 max-h-[85vh] sm:max-h-[90vh] overflow-y-auto shadow-[0_0_80px_rgba(6,182,212,0.35)] group/modal" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 頂部動態流光邊框 */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 bg-[length:200%_100%] animate-shimmer" />

                        {/* Modal Header */}
                        <div className="flex justify-between items-center mb-4 pb-2.5 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <h2 className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-fuchsia-300 tracking-wider font-headline">
                                        卡池完整清冊
                                    </h2>
                                    <span className="text-[11px] font-mono text-cyan-300 bg-cyan-950/80 px-2.5 py-0.5 rounded-full border border-cyan-500/30">
                                        剩餘 {pool.remainingPacks ?? 0} / {pool.totalPacks ?? 0} 包
                                    </span>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-full hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition-colors h-8 w-8"
                                onClick={() => setIsInventoryOpen(false)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* 內容區域 - 直接展示卡片與獎項名冊 */}
                        <div className="space-y-4 sm:space-y-5">
                            {/* 最後賞 特殊區塊 */}
                            {lastPrizeCard && (
                                <div 
                                    className="relative overflow-hidden border-2 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-slate-950 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.2)] flex flex-col sm:flex-row items-center gap-3 sm:gap-5 cursor-pointer hover:scale-[1.01] transition-all group/last"
                                    onClick={() => setPreviewCard({ ...lastPrizeCard, rarity: 'legendary' })}
                                >
                                    <div className="absolute top-2 right-2 z-20 px-2.5 py-0.5 rounded-full bg-slate-950/90 border border-amber-400/80 text-amber-300 text-[9px] sm:text-[10px] font-black uppercase tracking-widest flex items-center gap-1 shadow-lg backdrop-blur-md">
                                        <Trophy className="w-3 h-3 text-amber-400 shrink-0" />
                                        <span>LAST PRIZE</span>
                                    </div>
                                    <div className="relative z-10 w-20 sm:w-24 aspect-[2.5/3.5] rounded-xl overflow-hidden border-2 border-amber-400/60 p-0 bg-slate-950 shrink-0 shadow-lg group-hover/last:border-amber-300 mt-1 sm:mt-0">
                                        <SafeImage src={lastPrizeCard.imageUrl} alt="lp" sizes="120px" fill className="object-cover rounded-lg" />
                                    </div>
                                    <div className="text-center sm:text-left flex-1">
                                        <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider block mb-0.5">【最後賞】抽完最後一包即刻獲得</span>
                                        <h4 className="text-sm sm:text-base font-black text-white mb-1 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]">
                                            {lastPrizeCard.name}
                                        </h4>
                                        <p className="text-[11px] text-slate-300 leading-relaxed max-w-lg">
                                            本卡池最終限定大獎！清空此卡池剩餘存量時，將自動作為最終獎勵發放至您的收藏庫中。
                                        </p>
                                        <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300 font-bold mt-1.5 hover:underline">
                                            <Eye className="w-3 h-3" /> 點擊放大查看大圖與詳細資訊
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* 各稀有度群組 */}
                            {RARITIES.map(r => { 
                                const prizes = allPrizesInPool.filter(x => x.rarity === r); 
                                if (prizes.length === 0) return null; 
                                const style = rarityStyles[r];
                                const RarityIcon = style.icon;
                                const totalQtyInRarity = prizes.reduce((sum, p) => sum + (p.quantity || 0), 0);

                                return (
                                    <div key={r} className="space-y-2">
                                        {/* 稀有度標題列 - 超高對比與霓虹圖示 */}
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                            <div className="flex items-center gap-1.5">
                                                <div className={cn("p-1 rounded-lg border", style.bg, style.border)}>
                                                    <RarityIcon className={cn("w-3.5 h-3.5 sm:w-4 sm:h-4", style.text)} />
                                                </div>
                                                <h3 className={cn("font-black text-xs sm:text-sm tracking-wider uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]", style.text)}>
                                                    {style.label}
                                                </h3>
                                            </div>
                                            <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800">
                                                {prizes.length} 款品項 · 剩餘 <span className={cn("font-bold", style.text)}>{totalQtyInRarity}</span> 包
                                            </span>
                                        </div>

                                        {/* 該稀有度獎項列表 */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                            {prizes.map(c => (
                                                <div 
                                                    key={c.id} 
                                                    className={cn(
                                                        "group/item relative flex flex-col items-center p-2 rounded-xl border transition-all duration-300 cursor-pointer",
                                                        "bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-cyan-400/60 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:-translate-y-0.5",
                                                        c.isSoldOut && "opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
                                                    )}
                                                    onClick={() => setPreviewCard(c)}
                                                >
                                                    {/* 卡片圖像/P+ 點數賞容器 */}
                                                    <div className={cn(
                                                        "relative w-full aspect-[2.5/3.5] mb-1.5 rounded-lg overflow-hidden border p-0 bg-slate-950 flex flex-col items-center justify-center shadow-md",
                                                        c.isSoldOut ? "border-slate-800" : style.border
                                                    )}>
                                                        {c.isPoints ? (
                                                            <RandomPlayerCard 
                                                                rarity={c.rarity} 
                                                                points={c.points} 
                                                                title={c.name}
                                                                showBuybackHint={false} 
                                                            />
                                                        ) : (
                                                            <SafeImage src={c.imageUrl} alt={c.name} sizes="140px" fill className="object-cover rounded-md p-0" />
                                                        )}

                                                        {/* 已售罄水印印章 */}
                                                        {c.isSoldOut && (
                                                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[1px] flex items-center justify-center z-10">
                                                                <span className="px-2 py-1 bg-rose-600/90 text-white font-black text-[10px] uppercase tracking-wider rounded border border-rose-400/50 shadow-lg">
                                                                    已完售
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 品項名稱 */}
                                                    <h4 className="w-full text-center text-[11px] font-bold text-slate-100 truncate mb-1 px-0.5 group-hover/item:text-cyan-300 transition-colors">
                                                        {c.name}
                                                    </h4>

                                                    {/* 剩餘數量膠囊 Badge */}
                                                    {!c.isSoldOut ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.15)] flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                                            剩餘: {c.quantity} 包
                                                        </span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-slate-950 border border-slate-800 text-slate-500">
                                                            0 包剩餘
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* 卡片大圖預覽對話框 */}
            {!!previewCard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200" onClick={() => setPreviewCard(null)}>
                    <div 
                        className="relative max-w-[min(90vw,380px)] w-full bg-[#080d1a]/95 border border-cyan-500/40 rounded-3xl p-4 sm:p-5 flex flex-col items-center justify-center gap-3 shadow-[0_0_60px_rgba(6,182,212,0.3)]" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 頂部動態流光邊框 */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 bg-[length:200%_100%] animate-shimmer rounded-t-3xl" />

                        <div className="text-center w-full">
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full border inline-block mb-1",
                                rarityStyles[previewCard.rarity as Rarity]?.badgeBg || "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            )}>
                                {rarityStyles[previewCard.rarity as Rarity]?.label || previewCard.rarity}
                            </span>
                            <h2 className="text-base sm:text-lg font-black text-white text-center px-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] font-headline">
                                {previewCard.name}
                            </h2>
                        </div>

                        <div className="w-full max-w-[240px] sm:max-w-[260px] my-0.5">
                            {previewCard.isPoints ? (
                                <RandomPlayerCard 
                                    rarity={previewCard.rarity} 
                                    points={previewCard.points} 
                                    title={previewCard.name}
                                    showBuybackHint={false} 
                                />
                            ) : (
                                <CardItem name={previewCard.name} imageUrl={previewCard.imageUrl} backImageUrl={previewCard.backImageUrl} imageHint={previewCard.name} rarity={previewCard.rarity} isFlippable={true}/>
                            )}
                        </div>

                        {!previewCard.isPoints && (
                            <p className="text-[10px] text-cyan-400 font-bold uppercase animate-pulse flex items-center gap-1">
                                <Sparkles className="w-3 h-3" /> 點擊卡片可翻轉看背面
                            </p>
                        )}

                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="rounded-full bg-slate-900 border border-slate-700 hover:bg-cyan-500/20 hover:border-cyan-400 text-white transition-all h-9 w-9 sm:h-10 sm:w-10 mt-0.5 shadow-lg" 
                            onClick={() => setPreviewCard(null)}
                        >
                            <X className="h-4 w-4 sm:h-5 sm:w-5" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
