'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gem, Trophy, Clock, Zap, Star, Diamond, Layers, X, Package, Sparkles, Eye, ChevronRight } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { SafeImage } from '@/components/safe-image';
import { format } from 'date-fns';
import { CardItem } from '@/components/card-item';
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
interface CardData { id: string; name: string; imageUrl: string; backImageUrl?: string; imageHint: string; isSold?: boolean; }
interface CardPool { id: string; name: string; description: string; price?: number; price3Draws?: number; price10Draws?: number; totalPacks?: number; remainingPacks?: number; hasProtection?: boolean; isFeatured?: boolean; currency?: 'diamond' | 'p-point'; cardRarities?: { [cardId: string]: Rarity }; cards?: { cardId: string; quantity: number }[]; lastPrizeCardId?: string; imageUrl?: string; startsAt?: { seconds: number; nanoseconds: number; }; expiresAt?: { seconds: number; nanoseconds: number; }; lockedBy?: string; lockedAt?: { seconds: number; nanoseconds: number; }; categoryId?: string; dailyLimit?: number; minLevel?: string; isAdult?: boolean; }
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

    const poolStatus = useMemo(() => {
        const isSoldOut = (pool.remainingPacks ?? 0) <= 0;
        if (isSoldOut) return { status: 'sold-out', disabled: true, message: '已全數售罄' };
        if (pool.expiresAt && currentTime > new Date(pool.expiresAt.seconds * 1000)) return { status: 'expired', disabled: true, message: '已結束' };
        if (pool.startsAt) {
            const start = new Date(pool.startsAt.seconds * 1000);
            if (currentTime < start) return { status: 'not-started', disabled: true, message: format(start, "MM-dd HH:mm") + ' 開放' };
        }
        if (pool.hasProtection !== false && pool.lockedAt) {
            const lockTime = new Date(pool.lockedAt.seconds * 1000);
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
    
    const rarityProbabilities = useMemo(() => {
        if ((pool.remainingPacks ?? 0) <= 0) return { legendary: 0, rare: 0, common: 0 };
        const counts = { legendary: 0, rare: 0, common: 0 };
        let total = 0;
        pool.cards?.forEach(c => { const r = pool.cardRarities?.[c.cardId]; const cardData = allCardsMap.get(c.cardId); if (r && c.quantity > 0 && cardData && !cardData.isSold) { counts[r] += c.quantity; total += c.quantity; } });
        pool.pointPrizes?.forEach(p => { if (p.rarity && p.quantity > 0) { counts[p.rarity] += p.quantity; total += p.quantity; } });
        if (total === 0) return { legendary: 0, rare: 0, common: 0 };
        return { legendary: (counts.legendary / total) * 100, rare: (counts.rare / total) * 100, common: (counts.common / total) * 100 };
    }, [pool, allCardsMap]);

    const lastPrizeCard = pool.lastPrizeCardId ? allCardsMap.get(pool.lastPrizeCardId) : null;
    
    const topPrizesPreview = useMemo(() => {
        const result: any[] = [];
        const addedCardIds = new Set<string>();
        for (const rarity of RARITIES) {
            if (result.length >= 4) break;
            if (pool.cardRarities) {
                Object.entries(pool.cardRarities).filter(([, r]) => r === rarity).forEach(([id]) => {
                    if (result.length >= 4) return;
                    const data = allCardsMap.get(id);
                    const qty = pool.cards?.filter(c => c.cardId === id).reduce((acc, c) => acc + (c.quantity || 0), 0) || 0;
                    if (data && qty > 0 && !data.isSold && !addedCardIds.has(id)) { 
                        result.push({ ...data, type: 'card', rarity, quantity: qty }); 
                        addedCardIds.add(id); 
                    }
                });
            }
        }
        return result;
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
            
            <div className="relative w-full max-w-3xl bg-slate-900/80 backdrop-blur-xl border border-slate-700/50 rounded-3xl shadow-2xl overflow-hidden p-6 md:p-8">
                <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-600"></div>

                <div className="text-center mb-8">
                    <h1 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-500 tracking-wider">
                        {pool.name}
                    </h1>
                    <p className="text-slate-400 text-sm mt-2">{pool.description}</p>
                </div>

                <div className="mb-8 bg-slate-950/50 p-5 rounded-2xl border border-slate-800">
                    <div className="flex justify-between items-end mb-2">
                        <span className="text-cyan-400 font-bold tracking-wide flex items-center">
                            <Zap className="w-5 h-5 mr-1" /> 即時存量
                        </span>
                        <span className="text-2xl font-black text-white">
                            {pool.remainingPacks} <span className="text-slate-500 text-lg">/ {pool.totalPacks}</span>
                        </span>
                    </div>
                    <div className="h-3 w-full bg-slate-800 rounded-full overflow-hidden shadow-inner">
                        <div 
                            className="h-full bg-gradient-to-r from-cyan-400 to-blue-600 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.6)]"
                            style={{ width: `${(pool.remainingPacks || 0) / (pool.totalPacks || 1) * 100}%` }}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3 md:gap-4 mb-8">
                    {RARITIES.map(r => (
                        <div key={r} className={cn("flex flex-col items-center justify-center p-3 rounded-xl border relative overflow-hidden", 
                            r === 'legendary' ? "bg-gradient-to-b from-amber-500/10 to-slate-900 border-amber-500/30" : 
                            r === 'rare' ? "bg-gradient-to-b from-purple-500/10 to-slate-900 border-purple-500/30" :
                            "bg-gradient-to-b from-slate-500/10 to-slate-900 border-slate-600/30"
                        )}>
                            <span className={cn("text-xs font-bold tracking-widest mb-1", 
                                r === 'legendary' ? "text-amber-400" : r === 'rare' ? "text-purple-400" : "text-slate-400"
                            )}>{rarityStyles[r].label}</span>
                            <span className="text-white font-mono text-xs sm:text-sm md:text-base font-bold">{rarityProbabilities[r].toFixed(1)}%</span>
                        </div>
                    ))}
                </div>

                {/* 👑 本池焦點頭獎 HERO SHOWCASE */}
                <div className="mb-6 sm:mb-8 relative group">
                    {/* Golden Ambient Backdrop Glow */}
                    <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 via-yellow-400/20 to-amber-600/30 rounded-2xl blur-md opacity-80 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

                    <div className="relative bg-gradient-to-b from-[#13192a]/95 via-[#0c101d]/95 to-[#080b14]/95 border-2 border-amber-500/60 rounded-2xl p-4 sm:p-6 shadow-[0_10px_35px_rgba(245,158,11,0.2)] overflow-hidden">
                        {/* Animated Shimmer Stream */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-yellow-200 via-amber-500 to-amber-400 bg-[length:200%_100%] animate-shimmer" />

                        {/* Header */}
                        <div className="flex items-center justify-between mb-4 pb-3 border-b border-amber-500/30">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-xl bg-amber-500/20 border border-amber-400/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]">
                                    <Trophy className="w-5 h-5 text-amber-300 animate-bounce" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-sm sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-amber-400 tracking-wider font-headline flex items-center gap-1.5 truncate">
                                        <span>焦點頭獎</span>
                                        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse shrink-0" />
                                    </h3>
                                    <p className="text-[10px] sm:text-xs text-slate-400 truncate">本池最高價值賞品</p>
                                </div>
                            </div>

                            <button 
                                onClick={() => setIsInventoryOpen(true)}
                                className="shrink-0 flex items-center gap-1 text-[11px] sm:text-xs font-bold text-amber-300 hover:text-white bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400/50 px-3 py-1.5 rounded-full transition-all cursor-pointer shadow-sm hover:shadow-[0_0_12px_rgba(245,158,11,0.3)]"
                            >
                                <span>清冊</span>
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>

                        {/* Grand Prizes Content */}
                        {topPrizesPreview.length > 0 ? (
                            <div className="space-y-4">
                                {/* 1. Primary Top Prize Featured Hero */}
                                {topPrizesPreview[0] && (
                                    <div 
                                        onClick={() => setPreviewCard(topPrizesPreview[0])}
                                        className="relative bg-gradient-to-r from-amber-950/50 via-slate-900/90 to-amber-950/50 border border-amber-400/70 hover:border-amber-300 rounded-xl p-3 flex flex-row items-center gap-3 cursor-pointer transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] group/hero"
                                    >
                                        {/* Image / Point Box */}
                                        <div className="relative w-20 sm:w-24 aspect-[2.5/4] rounded-lg overflow-hidden border border-amber-400/80 p-1 bg-slate-950 shrink-0 shadow-lg group-hover/hero:border-amber-300 transition-colors">
                                            <SafeImage src={topPrizesPreview[0].imageUrl} alt={topPrizesPreview[0].name} sizes="100px" fill className="object-contain" />
                                        </div>

                                        {/* Details */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider border",
                                                    rarityStyles[topPrizesPreview[0].rarity as Rarity]?.badgeBg || "bg-amber-500/20 text-amber-300 border-amber-500/50"
                                                )}>
                                                    {rarityStyles[topPrizesPreview[0].rarity as Rarity]?.label || '傳說賞'}
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-500/25 border border-amber-400/50 text-amber-200">
                                                    剩 {topPrizesPreview[0].quantity ?? 1}
                                                </span>
                                            </div>

                                            <h4 className="text-sm sm:text-base font-black text-white truncate mb-1">
                                                {topPrizesPreview[0].name}
                                            </h4>
                                            
                                            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-400/80 font-bold group-hover/hero:text-amber-300">
                                                <Eye className="w-3 h-3" /> 查看細節
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* 2. Secondary Top Prizes Row */}
                                {topPrizesPreview.length > 1 && (
                                    <div className="grid grid-cols-2 gap-2">
                                            {topPrizesPreview.slice(1, 3).map(item => (
                                                <div 
                                                    key={item.id} 
                                                    onClick={() => setPreviewCard(item)}
                                                    className="bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 hover:border-amber-400/60 rounded-xl p-2 flex items-center gap-2 cursor-pointer transition-all shadow-sm group/sub"
                                                >
                                                    <div className="relative w-10 h-12 rounded-lg overflow-hidden border border-amber-400/40 bg-slate-950 shrink-0 flex items-center justify-center p-0.5">
                                                        <SafeImage src={item.imageUrl} alt={item.name} fill className="object-contain" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-[10px] font-bold text-slate-100 truncate group-hover/sub:text-amber-300">
                                                            {item.name}
                                                        </p>
                                                        <span className="text-[9px] text-slate-400">
                                                            剩 {item.quantity ?? 1}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-6 text-slate-400 text-xs">
                                目前尚無大獎資訊
                            </div>
                        )}

                        {/* 3. Last Prize Banner */}
                        {lastPrizeCard && (
                            <div 
                                onClick={() => setPreviewCard({ ...lastPrizeCard, rarity: 'legendary' })}
                                className="mt-4 bg-slate-900 border border-amber-500/30 rounded-xl p-2.5 flex items-center justify-between cursor-pointer transition-all hover:border-amber-500/60 shadow-inner group/last"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="relative w-8 h-10 rounded-lg border border-amber-400 bg-slate-950 shrink-0 overflow-hidden shadow-sm">
                                        <SafeImage src={lastPrizeCard.imageUrl} alt="last prize" fill className="object-contain" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1 text-[9px] font-black text-amber-400 uppercase tracking-widest">
                                            <Trophy className="w-2.5 h-2.5" />
                                            最後賞
                                        </div>
                                        <p className="text-[11px] font-black text-white truncate group-hover/last:text-amber-300">
                                            {lastPrizeCard.name}
                                        </p>
                                    </div>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-amber-400 shrink-0 ml-1" />
                            </div>
                        )}
                    </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                    <div className="bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 flex items-center shadow-inner">
                        <span className="text-slate-400 text-xs font-bold mr-1.5 uppercase">已抽</span>
                        <span className="text-cyan-400 font-mono font-bold text-sm">{todayDrawCount}</span>
                    </div>
                    <div className="flex items-center text-rose-400/90 text-xs bg-rose-500/10 px-4 py-1.5 rounded-full border border-rose-500/20 font-bold">
                        <Clock className="w-3.5 h-3.5 mr-1.5" />
                        下架: <span className="font-mono ml-1 text-xs">{pool.expiresAt ? format(new Date(pool.expiresAt.seconds * 1000), "MM-dd HH:mm") : '--'}</span>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3 md:gap-4 relative">
                    {isDrawing && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-2xl">
                            <div className="flex space-x-2">
                                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                <div className="w-3 h-3 bg-cyan-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                            </div>
                        </div>
                    )}

                    {[1, 3, 10].map((drawCount) => {
                        const canDraw = !poolStatus.disabled;
                        const price = drawCount === 1 ? (pool.price || 0) 
                                    : drawCount === 3 ? (pool.price3Draws || (pool.price || 0) * 3) 
                                    : (pool.price10Draws || (pool.price || 0) * 10);
                        const label = drawCount === 1 ? '抽 1 次' : `抽 ${drawCount} 次`;
                        
                        return (
                            <Button 
                                key={drawCount}
                                disabled={!canDraw || isDrawing}
                                className={cn("h-auto py-2.5 sm:py-4 px-1 flex flex-col items-center justify-center rounded-xl transition-all active:scale-95 overflow-hidden",
                                    drawCount === 10 ? "bg-gradient-to-b from-blue-600 to-indigo-800 border-2 border-cyan-400/50" : "bg-slate-800 border border-slate-600"
                                )}
                                onClick={() => handleDraw(drawCount)}
                            >
                                <span className="text-white font-bold text-xs sm:text-sm whitespace-nowrap">{label}</span>
                                <span className="flex items-center justify-center text-cyan-100 font-mono font-bold text-xs sm:text-base md:text-lg tracking-tight max-w-full truncate mt-0.5">
                                    <span className="truncate">{price.toLocaleString()}</span>
                                    <Gem className="w-3 h-3 sm:w-4 sm:h-4 ml-0.5 sm:ml-1 shrink-0" />
                                </span>
                            </Button>
                        )
                    })}
                </div>
            </div>
            
            {isInventoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-3 sm:p-6" onClick={() => setIsInventoryOpen(false)}>
                    <div 
                        className="relative max-w-4xl w-full bg-[#080d1a]/95 backdrop-blur-3xl border border-cyan-500/40 rounded-2xl sm:rounded-3xl p-4 sm:p-7 max-h-[85vh] overflow-y-auto shadow-[0_0_60px_rgba(6,182,212,0.25)] group/modal" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 頂部動態流光邊框 */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 bg-[length:200%_100%] animate-shimmer" />

                        {/* Modal Header */}
                        <div className="flex justify-between items-center mb-4 sm:mb-6 pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                                    <Package className="w-5 h-5 sm:w-6 sm:h-6 animate-pulse" />
                                </div>
                                <div>
                                    <h2 className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-fuchsia-300 tracking-wider font-headline">
                                        卡池完整清冊
                                    </h2>
                                    <p className="text-[11px] sm:text-xs text-slate-400">即時賞品剩餘量與全項目名冊</p>
                                </div>
                            </div>
                            <Button 
                                variant="ghost" 
                                size="icon" 
                                className="rounded-full hover:bg-cyan-500/20 text-slate-300 hover:text-cyan-300 transition-colors"
                                onClick={() => setIsInventoryOpen(false)}
                            >
                                <X className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* 統計概覽膠囊欄 */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-4 mb-6 p-3 bg-slate-950/70 rounded-xl border border-slate-800 text-xs">
                            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                                <span className="text-slate-400 text-[10px] sm:text-xs">剩餘總包數</span>
                                <span className="text-cyan-400 font-mono font-bold text-sm sm:text-base">{pool.remainingPacks ?? 0} / {pool.totalPacks ?? 0}</span>
                            </div>
                            <div className="flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                                <span className="text-slate-400 text-[10px] sm:text-xs">清冊品項總數</span>
                                <span className="text-fuchsia-400 font-mono font-bold text-sm sm:text-base">{allPrizesInPool.length} 款</span>
                            </div>
                            <div className="col-span-2 sm:col-span-1 flex flex-col items-center justify-center p-2 rounded-lg bg-slate-900/60 border border-slate-800">
                                <span className="text-slate-400 text-[10px] sm:text-xs">包含最後賞</span>
                                <span className="text-amber-400 font-mono font-bold text-sm sm:text-base">{lastPrizeCard ? '有 (1款)' : '無'}</span>
                            </div>
                        </div>

                        {/* 內容區域 */}
                        <div className="space-y-6 sm:space-y-8">
                            {/* 最後賞 特殊區塊 */}
                            {lastPrizeCard && (
                                <div 
                                    className="relative overflow-hidden border-2 p-4 sm:p-6 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-slate-950 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.2)] flex flex-col sm:flex-row items-center gap-4 sm:gap-6 cursor-pointer hover:scale-[1.01] transition-all group/last"
                                    onClick={() => setPreviewCard({ ...lastPrizeCard, rarity: 'legendary' })}
                                >
                                    <div className="absolute top-2 right-2 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                                        <Trophy className="w-3 h-3 text-amber-400" />
                                        LAST PRIZE
                                    </div>
                                    <div className="relative w-24 sm:w-28 aspect-[2.5/4] rounded-xl overflow-hidden border-2 border-amber-400/60 p-1 bg-slate-950 shrink-0 shadow-lg group-hover/last:border-amber-300">
                                        <SafeImage src={lastPrizeCard.imageUrl} alt="lp" sizes="120px" fill className="object-contain" />
                                    </div>
                                    <div className="text-center sm:text-left flex-1">
                                        <span className="text-xs font-black text-amber-400 uppercase tracking-wider block mb-1">【最後賞】抽完最後一包即刻獲得</span>
                                        <h4 className="text-base sm:text-lg font-black text-white mb-1.5 drop-shadow-[0_2px_8px_rgba(245,158,11,0.5)]">
                                            {lastPrizeCard.name}
                                        </h4>
                                        <p className="text-xs text-slate-300 leading-relaxed max-w-lg">
                                            本卡池最終限定大獎！清空此卡池剩餘存量時，將自動作為最終獎勵發放至您的收藏庫中。
                                        </p>
                                        <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300 font-bold mt-2.5 hover:underline">
                                            <Eye className="w-3.5 h-3.5" /> 點擊放大查看大圖與詳細資訊
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
                                    <div key={r} className="space-y-3">
                                        {/* 稀有度標題列 - 超高對比與霓虹圖示 */}
                                        <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                                            <div className="flex items-center gap-2">
                                                <div className={cn("p-1.5 rounded-lg border", style.bg, style.border)}>
                                                    <RarityIcon className={cn("w-4 h-4 sm:w-5 sm:h-5", style.text)} />
                                                </div>
                                                <h3 className={cn("font-black text-sm sm:text-base tracking-wider uppercase drop-shadow-[0_0_8px_rgba(255,255,255,0.1)]", style.text)}>
                                                    {style.label}
                                                </h3>
                                            </div>
                                            <span className="text-[11px] sm:text-xs font-mono text-slate-400 bg-slate-900 px-3 py-1 rounded-full border border-slate-800">
                                                {prizes.length} 款品項 · 剩餘 <span className={cn("font-bold", style.text)}>{totalQtyInRarity}</span> 包
                                            </span>
                                        </div>

                                        {/* 該稀有度獎項列表 */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                                            {prizes.map(c => (
                                                <div 
                                                    key={c.id} 
                                                    className={cn(
                                                        "group/item relative flex flex-col items-center p-2.5 rounded-xl border transition-all duration-300 cursor-pointer",
                                                        "bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-cyan-400/60 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:-translate-y-1",
                                                        c.isSoldOut && "opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
                                                    )}
                                                    onClick={() => setPreviewCard(c)}
                                                >
                                                    {/* 卡片圖像/P+ 點數賞容器 */}
                                                    <div className={cn(
                                                        "relative w-full aspect-[2.5/4] mb-2 rounded-lg overflow-hidden border p-1 bg-slate-950 flex flex-col items-center justify-center shadow-md",
                                                        c.isSoldOut ? "border-slate-800" : style.border
                                                    )}>
                                                        <SafeImage src={c.imageUrl} alt={c.name} sizes="140px" fill className="object-contain p-0.5" />

                                                        {/* 已售罄水印印章 */}
                                                        {c.isSoldOut && (
                                                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[1px] flex items-center justify-center">
                                                                <span className="px-2 py-1 bg-rose-600/90 text-white font-black text-[10px] uppercase tracking-wider rounded border border-rose-400/50 shadow-lg">
                                                                    已完售
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 品項名稱 */}
                                                    <h4 className="w-full text-center text-xs font-bold text-slate-100 truncate mb-1.5 px-1 group-hover/item:text-cyan-300 transition-colors">
                                                        {c.name}
                                                    </h4>

                                                    {/* 剩餘數量膠囊 Badge */}
                                                    {!c.isSoldOut ? (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.15)] flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                                                            剩餘: {c.quantity} 包
                                                        </span>
                                                    ) : (
                                                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-950 border border-slate-800 text-slate-500">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md" onClick={() => setPreviewCard(null)}>
                    <div 
                        className="relative max-w-[min(92vw,440px)] w-full bg-[#080d1a]/95 border border-cyan-500/40 rounded-3xl p-5 sm:p-7 flex flex-col items-center justify-center gap-4 shadow-[0_0_60px_rgba(6,182,212,0.3)]" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 頂部動態流光邊框 */}
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400 bg-[length:200%_100%] animate-shimmer rounded-t-3xl" />

                        <div className="text-center w-full">
                            <span className={cn(
                                "text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border inline-block mb-2",
                                rarityStyles[previewCard.rarity as Rarity]?.badgeBg || "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                            )}>
                                {rarityStyles[previewCard.rarity as Rarity]?.label || previewCard.rarity}
                            </span>
                            <h2 className="text-lg sm:text-xl font-black text-white text-center px-2 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] font-headline">
                                {previewCard.name}
                            </h2>
                        </div>

                        <div className="w-[85%] sm:w-full max-w-[300px] my-1">
                            {previewCard.isPoints ? (
                                <div className={cn("w-full aspect-[2.5/4] rounded-2xl flex flex-col items-center justify-center p-6 border shadow-2xl relative overflow-hidden", pointPrizeStyles[previewCard.rarity as Rarity].bg, pointPrizeStyles[previewCard.rarity as Rarity].border, pointPrizeStyles[previewCard.rarity as Rarity].glow)}>
                                    <div className="absolute inset-0 opacity-10 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#fff_2px,#fff_4px)]" />
                                    <PPlusIcon className={cn("w-20 h-20 mb-3 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]", pointPrizeStyles[previewCard.rarity as Rarity].text)} />
                                    <p className="font-headline text-5xl font-black text-white tracking-tight">{previewCard.points}</p>
                                    <span className="text-sm font-bold text-cyan-200 mt-1">P+ 紅利點數獎勵</span>
                                    <Badge variant="outline" className="mt-5 border-cyan-400/30 text-[10px] font-black uppercase tracking-widest text-cyan-300">Bonus Reward</Badge>
                                </div>
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
                            className="rounded-full bg-slate-900 border border-slate-700 hover:bg-cyan-500/20 hover:border-cyan-400 text-white transition-all h-10 w-10 sm:h-12 sm:w-12 mt-1 shadow-lg" 
                            onClick={() => setPreviewCard(null)}
                        >
                            <X className="h-5 w-5 sm:h-6 sm:w-6" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
