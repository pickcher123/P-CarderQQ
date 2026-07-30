'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Gem, Trophy, Clock, Zap, Star, Diamond, Layers, X } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { SafeImage } from '@/components/safe-image';
import { format } from 'date-fns';
import { CardItem } from '@/components/card-item';
import { userLevels } from '@/components/member-level-crown';
import { VerifyAgeModal } from '@/components/verify-age-modal';

// (Re-adding interfaces and constants as in the file)
const RARITIES = ['legendary', 'rare', 'common'] as const;
type Rarity = typeof RARITIES[number];
const rarityStyles: Record<Rarity, { text: string, bg: string, border: string, shadow: string, label: string, icon: any }> = {
  legendary: { text: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/40', shadow: 'shadow-accent/20', label: 'LEGENDARY', icon: Star },
  rare: { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/40', shadow: 'shadow-primary/20', label: 'RARE', icon: Diamond },
  common: { text: 'text-slate-900', bg: 'bg-slate-300', border: 'border-black', shadow: 'shadow-slate-300/5', label: 'COMMON', icon: Layers },
};
const pointPrizeStyles: Record<Rarity, { text: string, bg: string, border: string }> = {
  legendary: { text: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/30' },
  rare: { text: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
  common: { text: 'text-slate-400', bg: 'bg-white/5', border: 'border-white/10' },
};
interface CardData { id: string; name: string; imageUrl: string; backImageUrl?: string; imageHint: string; isSold?: boolean; }
interface PointPrize { prizeId: string; points: number; quantity: number; rarity: Rarity; }
interface CardPool { id: string; name: string; description: string; price?: number; price3Draws?: number; price10Draws?: number; totalPacks?: number; remainingPacks?: number; hasProtection?: boolean; isFeatured?: boolean; currency?: 'diamond' | 'p-point'; cardRarities?: { [cardId: string]: Rarity }; cards?: { cardId: string; quantity: number }[]; pointPrizes?: PointPrize[]; lastPrizeCardId?: string; imageUrl?: string; startsAt?: { seconds: number; nanoseconds: number; }; expiresAt?: { seconds: number; nanoseconds: number; }; lockedBy?: string; lockedAt?: { seconds: number; nanoseconds: number; }; categoryId?: string; dailyLimit?: number; minLevel?: string; isAdult?: boolean; }
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
                    if (data && qty > 0 && !data.isSold && !addedCardIds.has(id)) { result.push({ ...data, type: 'card', rarity }); addedCardIds.add(id); }
                });
            }
            if (pool.pointPrizes) {
                pool.pointPrizes.filter(p => p.rarity === rarity && p.quantity > 0).forEach(p => {
                    if (result.length >= 4) return;
                    result.push({ id: p.prizeId, name: `${p.points} P+`, isPoints: true, points: p.points, rarity: p.rarity, type: 'points' });
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
        if (pool.pointPrizes) {
            pool.pointPrizes.forEach(p => {
                list.push({
                    id: p.prizeId,
                    name: `${p.points} P+`,
                    rarity: p.rarity,
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
                            <span className="text-white font-mono text-xl font-bold">{rarityProbabilities[r].toFixed(1)}%</span>
                        </div>
                    ))}
                </div>

                <div onClick={() => setIsInventoryOpen(true)} className="mb-8 bg-slate-800/30 rounded-2xl border border-slate-700/50 p-5 cursor-pointer hover:border-cyan-500/50 transition-all">
                    <h3 className="flex items-center text-slate-200 font-bold mb-4">
                        <Trophy className="w-5 h-5 text-amber-400 mr-2" />
                        剩餘大獎
                    </h3>
                    <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                        {topPrizesPreview.map(item => (
                            <div key={item.id} className="shrink-0 w-28 h-32 rounded-xl bg-gradient-to-br from-slate-700 to-slate-800 border border-slate-600 flex flex-col items-center justify-center">
                                {item.isPoints ? (
                                    <div className="flex flex-col items-center">
                                        <PPlusIcon className="w-10 h-10 text-cyan-400 mb-1" />
                                        <span className="text-slate-100 font-bold text-sm">{item.points}</span>
                                    </div>
                                ) : (
                                    <div className="relative w-20 h-20">
                                        <SafeImage src={item.imageUrl} alt={item.name} fill className="object-contain" />
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                <div className="flex justify-between items-center mb-6">
                    <div className="bg-slate-800 px-4 py-2 rounded-full border border-slate-700 flex items-center shadow-inner">
                        <span className="text-slate-400 text-sm mr-2">已抽</span>
                        <span className="text-cyan-400 font-mono font-bold text-lg">{todayDrawCount}</span>
                    </div>
                    <div className="flex items-center text-rose-400/90 text-sm bg-rose-500/10 px-4 py-2 rounded-full border border-rose-500/20">
                        <Clock className="w-4 h-4 mr-1.5" />
                        下架: <span className="font-mono ml-1">{pool.expiresAt ? format(new Date(pool.expiresAt.seconds * 1000), "MM-dd HH:mm") : '--'}</span>
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
                        const label = drawCount === 1 ? '1 抽' : `${drawCount} 連抽`;
                        
                        return (
                            <Button 
                                key={drawCount}
                                disabled={!canDraw || isDrawing}
                                className={cn("h-auto py-4 flex flex-col items-center justify-center rounded-xl transition-all active:scale-95",
                                    drawCount === 10 ? "bg-gradient-to-b from-blue-600 to-indigo-800 border-2 border-cyan-400/50" : "bg-slate-800 border border-slate-600"
                                )}
                                onClick={() => handleDraw(drawCount)}
                            >
                                <span className="text-white font-bold">{label}</span>
                                <span className="flex items-center text-cyan-100 font-mono font-bold text-lg">
                                    {price.toLocaleString()} <Gem className="w-4 h-4 ml-1" />
                                </span>
                            </Button>
                        )
                    })}
                </div>
            </div>
            
            {isInventoryOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 backdrop-blur-sm p-4" onClick={() => setIsInventoryOpen(false)}>
                    <div className="max-w-4xl w-full bg-slate-950 backdrop-blur-3xl border border-slate-800 rounded-[2.5rem] p-6 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-6 pb-6 border-b border-white/10">
                            <h2 className="text-xl font-black text-primary uppercase italic">卡池完整清冊</h2>
                            <Button variant="ghost" size="icon" onClick={() => setIsInventoryOpen(false)}><X className="text-white" /></Button>
                        </div>
                        <div className="space-y-8">
                            {lastPrizeCard && (
                                <div className="border-2 p-6 rounded-[2.5rem] bg-accent/10 border-accent/40 flex flex-col sm:flex-row items-center gap-6 cursor-zoom-in transition-all hover:bg-accent/20" onClick={() => setPreviewCard({ ...lastPrizeCard, rarity: 'legendary' })}>
                                    <div className="relative w-32 aspect-[2.5/4] rounded-2xl overflow-hidden border-2 border-white/20 p-1">
                                        <SafeImage src={lastPrizeCard.imageUrl} alt="lp" sizes="120px" fill className="object-contain" />
                                    </div>
                                    <div className="text-center sm:text-left flex-1">
                                        <p className="text-lg font-black text-accent uppercase">最後賞：{lastPrizeCard.name}</p>
                                        <p className="text-sm text-white/60">最後一抽可得此 Legendary 資產。</p>
                                        <p className="text-[10px] text-accent font-bold mt-2 animate-pulse uppercase">點擊預覽卡片</p>
                                    </div>
                                </div>
                            )}
                            {RARITIES.map(r => { 
                                const prizes = allPrizesInPool.filter(x => x.rarity === r); 
                                if (prizes.length === 0) return null; 
                                return (
                                    <div key={r} className="space-y-4">
                                        <div className="flex items-center gap-3 border-l-4 pl-4 py-1" style={{ borderColor: rarityStyles[r].text }}>
                                            <h5 className={cn("font-black text-lg uppercase", rarityStyles[r].text)}>{rarityStyles[r].label}</h5>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            {prizes.map(c => (
                                                <div key={c.id} className="text-center cursor-zoom-in" onClick={() => setPreviewCard(c)}>
                                                    <div className={cn("relative aspect-[2.5/4] mb-2 rounded-xl border border-white/10 overflow-hidden p-1", c.isSoldOut && "grayscale opacity-40")}>
                                                        {c.isPoints ? (
                                                            <div className={cn("w-full h-full flex flex-col items-center justify-center rounded-lg", pointPrizeStyles[c.rarity as Rarity].bg)}>
                                                                <PPlusIcon className={cn("w-12 h-12 mb-2", pointPrizeStyles[c.rarity as Rarity].text)} />
                                                                <p className="font-headline text-lg font-black text-white">{c.points}</p>
                                                            </div>
                                                        ) : (
                                                            <SafeImage src={c.imageUrl} alt={c.name} sizes="120px" fill className="object-contain" />
                                                        )}
                                                        {c.isSoldOut && (
                                                            <div className="absolute inset-0 flex items-center justify-center">
                                                                <Badge variant="secondary" className="text-[8px] font-black uppercase">已售罄</Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                    {!c.isSoldOut && (
                                                        <Badge variant="outline" className="h-5 px-2 text-[8px] border-primary/20 text-primary">剩餘: {c.quantity} 包</Badge>
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

            {!!previewCard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setPreviewCard(null)}>
                    <div className="max-w-[min(95vw,420px)] w-full flex flex-col items-center justify-center gap-4 sm:gap-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-base sm:text-lg font-black text-white text-center px-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{previewCard.name}</h2>
                        <div className="w-[80%] sm:w-full max-w-[320px]">
                            {previewCard.isPoints ? (
                                <div className={cn("w-full aspect-[2.5/4] rounded-3xl flex flex-col items-center justify-center p-4 border shadow-2xl", pointPrizeStyles[previewCard.rarity as Rarity].bg, pointPrizeStyles[previewCard.rarity as Rarity].border)}>
                                    <PPlusIcon className={cn("w-20 h-20 mb-4", pointPrizeStyles[previewCard.rarity as Rarity].text)} />
                                    <p className="font-headline text-5xl font-black text-white">{previewCard.points}</p>
                                    <Badge variant="outline" className="mt-6 border-white/20 text-[10px] font-black uppercase tracking-widest text-white/40">Bonus Reward</Badge>
                                </div>
                            ) : (
                                <CardItem name={previewCard.name} imageUrl={previewCard.imageUrl} backImageUrl={previewCard.backImageUrl} imageHint={previewCard.name} rarity={previewCard.rarity} isFlippable={true}/>
                            )}
                        </div>
                        {!previewCard.isPoints && <p className="text-[9px] text-primary font-bold uppercase animate-pulse">點擊翻轉</p>}
                        <Button variant="ghost" size="icon" className="mt-2 sm:mt-4 rounded-full bg-black/80 h-10 w-10 sm:h-12 sm:w-12 text-white" onClick={() => setPreviewCard(null)}>
                            <X className="h-5 w-5 sm:h-6 sm:w-6" />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
