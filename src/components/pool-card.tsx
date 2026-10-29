'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Zap, Star, Diamond, Layers, X, Package, Sparkles, Eye, ChevronRight, Gift, Ticket, Target, Lock, Unlock, Flame, AlertCircle, ShieldAlert } from 'lucide-react';
import { PPlusIcon, DiamondIcon } from '@/components/icons';
import { SafeImage } from '@/components/safe-image';
import { format } from 'date-fns';
import { CardItem } from '@/components/card-item';
import { RandomPlayerCard } from '@/components/random-player-card';
import { userLevels } from '@/components/member-level-crown';
import { VerifyAgeModal } from '@/components/verify-age-modal';
import { PromoRedeemModal } from '@/components/events/PromoRedeemModal';
import { getEffectiveTicketCount, syncLocalPromoClaimsToFirestore } from '@/lib/promo-draw-service';
import { KujiNumberPickerDialog } from '@/components/draw/kuji-number-picker-dialog';
import { useAutoMatteImage } from '@/hooks/use-auto-matte-image';

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
interface CardPool { id: string; name: string; description: string; price?: number; price3Draws?: number; price10Draws?: number; totalPacks?: number; remainingPacks?: number; hasProtection?: boolean; isFeatured?: boolean; currency?: 'diamond' | 'p-point'; cardRarities?: { [cardId: string]: Rarity }; cards?: { cardId: string; quantity: number }[]; pointPrizes?: { prizeId: string; points: number; quantity: number; rarity: Rarity; name?: string }[]; lastPrizeCardId?: string; imageUrl?: string; startsAt?: { seconds: number; nanoseconds: number; }; expiresAt?: { seconds: number; nanoseconds: number; }; pointMultiplier?: number; pointMultiplierExpiresAt?: { seconds: number; nanoseconds: number; }; lockedBy?: string; lockedAt?: { seconds: number; nanoseconds: number; }; categoryId?: string; dailyLimit?: number; minLevel?: string; isAdult?: boolean; allowFreeDraw?: boolean; isEventPool?: boolean; exclusiveTicketOnly?: boolean; eventTicketName?: string; eventRules?: string; eventMaxDrawsPerUser?: number; }
const LOCK_DURATION = 120;

export function PoolCard({ pool, allCardsMap, userProfile }: { pool: CardPool, allCardsMap: Map<string, CardData>, userProfile: any }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [previewCard, setPreviewCard] = useState<any | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [inventoryFilterRarity, setInventoryFilterRarity] = useState<Rarity | 'all'>('all');
    const [isAgeVerifiedModalOpen, setIsAgeVerifiedModalOpen] = useState(false);
    const [isFreeTicketConfirmOpen, setIsFreeTicketConfirmOpen] = useState(false);
    const [pendingDraws, setPendingDraws] = useState<number>(0);
    const [isUsingTicketForPending, setIsUsingTicketForPending] = useState(false);
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [localTicketRefresh, setLocalTicketRefresh] = useState(0);
    const [selectedPrizeIndex, setSelectedPrizeIndex] = useState(0);
    const [isPickNumberOpen, setIsPickNumberOpen] = useState(false);

    // 🌟 3D 陀螺儀微傾斜與雷射流光 (Holo Foil) 互動狀態
    const [cardTilt, setCardTilt] = useState<{ x: number; y: number; active: boolean; mouseX: number; mouseY: number }>({
        x: 0,
        y: 0,
        active: false,
        mouseX: 50,
        mouseY: 50,
    });

    const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -12; // 最大傾斜 12 度
        const rotateY = ((x - centerX) / centerX) * 12;
        const mousePercentX = Math.round((x / rect.width) * 100);
        const mousePercentY = Math.round((y / rect.height) * 100);
        setCardTilt({ x: rotateX, y: rotateY, active: true, mouseX: mousePercentX, mouseY: mousePercentY });
    };

    const handleCardMouseLeave = () => {
        setCardTilt({ x: 0, y: 0, active: false, mouseX: 50, mouseY: 50 });
    };

    const effectiveTickets = useMemo(() => {
        return getEffectiveTicketCount(userProfile);
    }, [userProfile, localTicketRefresh]);

    useEffect(() => {
        if (user?.uid && firestore) {
            syncLocalPromoClaimsToFirestore(firestore, user.uid).then(added => {
                if (added > 0) setLocalTicketRefresh(prev => prev + 1);
            });
        }
    }, [user?.uid, firestore]);

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

    // 🎯 頭獎雷達與即將售罄衝刺狀態計算
    const legendaryRemainingCount = rarityDetails.legendary.count;
    const remainingPacks = pool.remainingPacks ?? 0;
    const totalPacks = pool.totalPacks ?? 1;
    const remainingPercent = Math.max(0, Math.min(100, Math.round((remainingPacks / totalPacks) * 100)));
    const isLastChance = remainingPacks > 0 && remainingPercent <= 20;

    // 🎯 動態抽卡選項：剩餘不足 10 包時不顯示 10 抽，並自動提供全包/包尾選項
    const drawOptions = useMemo(() => {
        if (remainingPacks <= 0) {
            return [{ count: 1, label: '1 抽', isAllIn: false, isMax: false }];
        }
        if (remainingPacks >= 10) {
            return [
                { count: 1, label: '1 抽', isAllIn: false, isMax: false },
                { count: 3, label: '3 抽', isAllIn: false, isMax: false },
                { count: 10, label: '10 抽', isAllIn: false, isMax: true },
            ];
        }
        if (remainingPacks > 3) {
            // 例如：剩餘 5 包 => [1 抽, 3 抽, 5 抽(全包)]
            return [
                { count: 1, label: '1 抽', isAllIn: false, isMax: false },
                { count: 3, label: '3 抽', isAllIn: false, isMax: false },
                { count: remainingPacks, label: `${remainingPacks} 抽`, isAllIn: true, isMax: true },
            ];
        }
        if (remainingPacks === 3) {
            return [
                { count: 1, label: '1 抽', isAllIn: false, isMax: false },
                { count: 3, label: '3 抽', isAllIn: true, isMax: true },
            ];
        }
        if (remainingPacks === 2) {
            return [
                { count: 1, label: '1 抽', isAllIn: false, isMax: false },
                { count: 2, label: '2 抽', isAllIn: true, isMax: true },
            ];
        }
        // 剩餘 1 包
        return [
            { count: 1, label: '1 抽', isAllIn: true, isMax: true },
        ];
    }, [remainingPacks]);

    const lastPrizeCard = pool.lastPrizeCardId ? allCardsMap.get(pool.lastPrizeCardId) : null;
    
    const topPrizesPreview = useMemo(() => {
        const availableCards: any[] = [];
        const addedCardIds = new Set<string>();

        if (pool.cards && pool.cards.length > 0) {
            for (const c of pool.cards) {
                if (!c.cardId) continue;
                if (addedCardIds.has(c.cardId)) continue;

                const data = allCardsMap.get(c.cardId);
                if (data) {
                    const rarity = pool.cardRarities?.[c.cardId] || (data as any).rarity || 'common';
                    const cardVal = (data as any).sellPrice ?? (data as any).estimatedValue ?? (data as any).price ?? (data as any).points ?? (data as any).value ?? 0;
                    
                    availableCards.push({
                        ...data,
                        type: 'card',
                        rarity,
                        quantity: c.quantity ?? 0,
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
                if (data) {
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

        // 最後賞限定卡片也納入大獎陣容候選
        if (pool.lastPrizeCardId && !addedCardIds.has(pool.lastPrizeCardId)) {
            const lpData = allCardsMap.get(pool.lastPrizeCardId);
            if (lpData) {
                const cardVal = (lpData as any).sellPrice ?? (lpData as any).estimatedValue ?? (lpData as any).price ?? (lpData as any).points ?? (lpData as any).value ?? 0;
                availableCards.push({
                    ...lpData,
                    type: 'card',
                    rarity: 'legendary',
                    quantity: 1,
                    isLastPrize: true,
                    cardVal: Number(cardVal) || 0,
                });
                addedCardIds.add(pool.lastPrizeCardId);
            }
        }

        const rarityOrder: Record<string, number> = { legendary: 3, rare: 2, common: 1 };

        availableCards.sort((a, b) => {
            // 剩餘庫存 > 0 優先展示
            const aHasStock = (a.quantity || 0) > 0 ? 1 : 0;
            const bHasStock = (b.quantity || 0) > 0 ? 1 : 0;
            if (bHasStock !== aHasStock) {
                return bHasStock - aHasStock;
            }
            // 估值最高優先 (前兩張有價值的卡)
            const valA = Number(a.cardVal) || 0;
            const valB = Number(b.cardVal) || 0;
            if (valB !== valA) {
                return valB - valA;
            }
            // 稀有度最高優先
            const rA = rarityOrder[a.rarity] || 0;
            const rB = rarityOrder[b.rarity] || 0;
            if (rB !== rA) {
                return rB - rA;
            }
            return (a.name || '').localeCompare(b.name || '');
        });

        // 萬一卡片資料尚未加載或未綁定卡片，使用卡池封面圖作為頂級大獎展示，確保圖片永遠能吸引點擊
        if (availableCards.length === 0 && pool.imageUrl) {
            availableCards.push({
                id: pool.id || 'cover-prize',
                name: pool.name || '卡池大獎',
                imageUrl: pool.imageUrl,
                rarity: 'legendary',
                quantity: pool.remainingPacks ?? 1,
                cardVal: pool.price ?? 0,
                isPoolCover: true,
            });
        }

        return availableCards;
    }, [pool, allCardsMap]);

    const currentFeaturedPrize = topPrizesPreview[selectedPrizeIndex] || topPrizesPreview[0];
    const mattedFeaturedPrizeImage = useAutoMatteImage(currentFeaturedPrize?.imageUrl, {
        darkThreshold: 45,
        trimInset: 2,
        feather: true,
    });

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

    const executeDraw = (draws: number, useTicket: boolean = false) => {
        setIsFreeTicketConfirmOpen(false);
        const targetDraws = useTicket ? 1 : draws;
        const ticketQuery = useTicket ? '&useTicket=true' : '';

        if (useTicket && user?.uid && firestore) {
            syncLocalPromoClaimsToFirestore(firestore, user.uid);
        }

        if (pool.isAdult) {
            setPendingDraws(targetDraws);
            setIsUsingTicketForPending(useTicket);
            setIsAgeVerifiedModalOpen(true);
        } else {
            setIsDrawing(true);
            setTimeout(() => {
                router.push(`/draw/open?poolId=${pool.id}&draws=${targetDraws}${ticketQuery}`);
            }, 400);
        }
    };

    const handleDraw = (draws: number) => {
        if (draws === 1 && pool.allowFreeDraw !== false && effectiveTickets > 0) {
            setIsFreeTicketConfirmOpen(true);
            return;
        }
        executeDraw(draws, false);
    };

    const handleDrawWithTicket = () => {
        if (effectiveTickets <= 0) {
            setIsPromoModalOpen(true);
            return;
        }
        setIsFreeTicketConfirmOpen(true);
    };

    const handleTrialDraw = () => {
        setIsDrawing(true);
        setTimeout(() => {
            router.push(`/draw/open?poolId=${pool.id}&draws=1&trial=true`);
        }, 300);
    };

    return (
        <div className="relative font-sans text-slate-100">
            <PromoRedeemModal 
                open={isPromoModalOpen} 
                onOpenChange={setIsPromoModalOpen} 
            />
            
            <VerifyAgeModal 
                isOpen={isAgeVerifiedModalOpen}
                onClose={() => setIsAgeVerifiedModalOpen(false)}
                onConfirm={() => {
                    setIsAgeVerifiedModalOpen(false);
                    const ticketQuery = isUsingTicketForPending ? '&useTicket=true' : '';
                    router.push(`/draw/open?poolId=${pool.id}&draws=${pendingDraws}${ticketQuery}`);
                }}
            />

            {/* 🎟️ 免費抽卡券使用確認視窗 (先詢問客戶是否要使用免費券，並顯示持有的免費券張數) */}
            {isFreeTicketConfirmOpen && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200"
                    onClick={() => setIsFreeTicketConfirmOpen(false)}
                >
                    <div 
                        className="relative max-w-md w-full bg-[#0b101d]/95 border-2 border-emerald-500/50 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(16,185,129,0.25)] text-center space-y-4"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 頂部動態邊框 */}
                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-emerald-400 via-amber-400 to-cyan-400 rounded-t-3xl" />

                        {/* 標題與圖示 */}
                        <div className="space-y-1.5 pt-1">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-400/50 mx-auto flex items-center justify-center text-2xl shadow-inner">
                                🎟️
                            </div>
                            <h3 className="text-lg sm:text-xl font-black text-white font-headline">
                                是否使用活動免費抽卡券？
                            </h3>
                            <p className="text-xs text-slate-300">
                                卡池：<span className="font-bold text-amber-300">{pool.name}</span>
                            </p>
                        </div>

                        {/* 客戶持有票券資訊卡 */}
                        <div className="p-3.5 rounded-2xl bg-emerald-950/70 border border-emerald-500/40 shadow-inner flex items-center justify-between">
                            <div className="flex items-center gap-2 text-left">
                                <Ticket className="w-6 h-6 text-emerald-400 shrink-0" />
                                <div>
                                    <div className="text-[11px] font-bold text-slate-300">您目前持有的免費券</div>
                                    <div className="text-[10px] text-emerald-400/80">每次開獎消耗 1 張 (1抽)</div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="font-mono font-black text-2xl text-emerald-300">
                                    {effectiveTickets}
                                </span>
                                <span className="text-xs font-bold text-slate-400 ml-1">張</span>
                            </div>
                        </div>

                        {/* 說明文字 */}
                        <p className="text-[11px] sm:text-xs text-slate-400 leading-relaxed px-1">
                            使用免費券開獎 <span className="text-emerald-300 font-bold">完全不消耗任何點數/鑽石</span>。您也可以選擇保留免費券，改用帳戶內的點數/鑽石進行抽卡。
                        </p>

                        {/* 操作按鈕組 */}
                        <div className="space-y-2 pt-1">
                            <Button
                                onClick={() => executeDraw(1, true)}
                                className="w-full h-11 sm:h-12 text-xs sm:text-sm font-black rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                <Ticket className="w-4 h-4 fill-slate-950" />
                                <span>使用 1 張免費券開獎 (0 點)</span>
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => executeDraw(1, false)}
                                className="w-full h-10 sm:h-11 text-xs font-black rounded-xl border-slate-700 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                                {pool.currency === 'p-point' ? (
                                    <PPlusIcon className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                ) : (
                                    <DiamondIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                )}
                                <span>保留免費券，以 {pool.price?.toLocaleString()} {pool.currency === 'p-point' ? 'P點' : '鑽石'} 抽卡</span>
                            </Button>

                            <Button
                                variant="ghost"
                                onClick={() => setIsFreeTicketConfirmOpen(false)}
                                className="w-full h-8 text-[11px] font-bold text-slate-400 hover:text-white rounded-lg"
                            >
                                取消
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            
            <div className={cn(
                "relative w-full bg-[#0a0c10]/95 backdrop-blur-2xl border rounded-2xl sm:rounded-3xl shadow-2xl hover:shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.3)] overflow-hidden p-3 sm:p-5 flex flex-col justify-between transition-all duration-300 group hover:-translate-y-0.5",
                isLastChance 
                    ? "border-amber-500/80 shadow-[0_0_35px_rgba(245,158,11,0.35)] ring-1 ring-amber-400/50" 
                    : "border-amber-500/30 hover:border-amber-400/60 ring-1 ring-amber-400/10"
            )}>
                {/* 🌟 頂級曜石黑鈦金屬與科技動態背景系統 (動態電路、全像掃描光、呼吸光暈與浮游金粒) */}
                <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-2xl sm:rounded-3xl z-0">
                    {/* 底層：曜石黑鈦金屬與母板底圖 */}
                    <SafeImage 
                        src="/images/card_pool_bg.jpg" 
                        alt="card-pool-bg" 
                        fill 
                        sizes="(max-width: 640px) 100vw, 420px" 
                        className="object-cover opacity-75 scale-100 transition-transform duration-700 group-hover:scale-105" 
                    />

                    {/* 微米級科技細線網格 (Cyber Matrix Grid) */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(245,158,11,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(245,158,11,0.06)_1px,transparent_1px)] bg-[size:32px_32px] opacity-60" />

                    {/* 動態呼吸光球 1：頂部暖金/琥珀聚光暈 */}
                    <div className={cn(
                        "absolute -top-16 left-1/4 w-72 h-72 rounded-full blur-3xl pointer-events-none transition-all duration-1000",
                        isLastChance 
                            ? "bg-gradient-to-br from-rose-500/25 via-amber-500/30 to-transparent animate-pulse" 
                            : "bg-gradient-to-br from-amber-400/20 via-yellow-500/15 to-transparent animate-orb-1"
                    )} />

                    {/* 動態呼吸光球 2：右下方微霓虹科技青藍冷光 */}
                    <div className="absolute -bottom-16 -right-12 w-64 h-64 rounded-full bg-gradient-to-tl from-cyan-500/15 via-blue-500/10 to-transparent blur-3xl pointer-events-none animate-orb-2" />

                    {/* 科技動態線路光束 SVG (Circuit Traces with dynamic pulse) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-40" xmlns="http://www.w3.org/2000/svg">
                        <defs>
                            <linearGradient id="cyberTraceGold" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                                <stop offset="50%" stopColor="#fef08a" stopOpacity="1" />
                                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.6" />
                            </linearGradient>
                        </defs>
                        <path 
                            d="M 10 30 L 70 30 L 90 50 L 160 50" 
                            stroke="url(#cyberTraceGold)" 
                            strokeWidth="1.2" 
                            fill="none" 
                            className="animate-circuit-dash" 
                        />
                        <path 
                            d="M 280 20 L 320 60 L 320 140" 
                            stroke="url(#cyberTraceGold)" 
                            strokeWidth="1" 
                            fill="none" 
                            className="animate-circuit-dash" 
                            style={{ animationDelay: '3s' }}
                        />
                        <circle cx="160" cy="50" r="2.5" fill="#fde047" className="animate-pulse" />
                        <circle cx="320" cy="140" r="2" fill="#22d3ee" className="animate-pulse" />
                    </svg>

                    {/* 全像雷射掃描掃光線 (Holographic Laser Sweep) */}
                    <div className="absolute inset-x-0 h-16 pointer-events-none animate-cyber-scan bg-gradient-to-b from-transparent via-amber-400/10 to-transparent blur-[1px]" />

                    {/* 懸浮金燦動態粒子 (Floating Stardust Particles) */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <span className="absolute bottom-10 left-[18%] w-1.5 h-1.5 rounded-full bg-amber-300 blur-[0.4px] animate-particle-1" />
                        <span className="absolute bottom-16 right-[22%] w-1.2 h-1.2 rounded-full bg-cyan-300 blur-[0.4px] animate-particle-2" />
                        <span className="absolute bottom-6 left-[62%] w-1 h-1 rounded-full bg-yellow-200 blur-[0.3px] animate-particle-3" />
                        <span className="absolute top-28 left-[35%] w-1 h-1 rounded-full bg-amber-400 blur-[0.5px] animate-particle-2" />
                    </div>

                    {/* 微光暗角與深邃光影融合遮罩 (確保前景文字、卡牌與按鈕 100% 銳利清晰) */}
                    <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/75" />
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,158,11,0.18),transparent_70%)]" />
                </div>

                {/* 頂部微光裝飾線 (衝刺時轉為燃燒金紅流光) */}
                <div className={cn(
                    "absolute top-0 left-0 w-full h-[2.5px] z-10 transition-all duration-500",
                    isLastChance 
                        ? "bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" 
                        : "bg-gradient-to-r from-transparent via-amber-400/80 to-transparent"
                )}></div>

                {/* 內部核心內容 (提升至 z-10 確保文字與互動按鈕清晰) */}
                <div className="relative z-10 flex flex-col justify-between flex-1 w-full">
                {/* 📌 卡池標題與完整即時狀態 (讓客人第一時間清楚掌握卡池目前狀態) */}
                <div className="mb-2 sm:mb-2.5 text-center">
                    {/* 頂部即時狀態指示徽章群 */}
                    <div className="flex items-center justify-center gap-1.5 mb-1.5 flex-wrap">
                        {/* 1. 核心營運與保護鎖定狀態 */}
                        {poolStatus.status === 'sold-out' ? (
                            <Badge className="bg-rose-950/90 text-rose-300 border border-rose-500/60 font-black text-[10px] sm:text-[11px] px-2.5 py-0.5 shadow-sm flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>已全數售罄</span>
                            </Badge>
                        ) : poolStatus.status === 'locked' ? (
                            <Badge className="bg-amber-950/90 text-amber-300 border border-amber-500/60 font-black text-[10px] sm:text-[11px] px-2.5 py-0.5 shadow-sm flex items-center gap-1 animate-pulse">
                                <Lock className="w-3 h-3 text-amber-400" />
                                <span>挑號保護中 ({poolStatus.message})</span>
                            </Badge>
                        ) : poolStatus.status === 'locked-by-me' ? (
                            <Badge className="bg-emerald-950/90 text-emerald-300 border border-emerald-500/60 font-black text-[10px] sm:text-[11px] px-2.5 py-0.5 shadow-sm flex items-center gap-1">
                                <Unlock className="w-3 h-3 text-emerald-400" />
                                <span>您保留中 ({poolStatus.message})</span>
                            </Badge>
                        ) : poolStatus.status === 'not-started' ? (
                            <Badge className="bg-sky-950/90 text-sky-300 border border-sky-500/60 font-black text-[10px] sm:text-[11px] px-2.5 py-0.5 shadow-sm flex items-center gap-1">
                                <Clock className="w-3 h-3 text-sky-400" />
                                <span>{poolStatus.message}</span>
                            </Badge>
                        ) : poolStatus.status === 'expired' ? (
                            <Badge className="bg-slate-900/90 text-slate-400 border border-slate-700 font-bold text-[10px] sm:text-[11px] px-2.5 py-0.5">
                                <span>卡池已結束</span>
                            </Badge>
                        ) : isLastChance ? (
                            <Badge className="bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 border-0 font-black text-[10px] sm:text-[11px] px-2.5 py-0.5 shadow-sm flex items-center gap-1 animate-pulse">
                                <Flame className="w-3 h-3 fill-slate-950" />
                                <span>🔥 搶包衝刺 (剩 {remainingPacks} 包)</span>
                            </Badge>
                        ) : (
                            <Badge className="bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 font-bold text-[10px] sm:text-[11px] px-2.5 py-0.5 flex items-center gap-1">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                <span>現正開放中</span>
                            </Badge>
                        )}

                        {/* 2. 頭獎在席即時狀況 */}
                        {legendaryRemainingCount > 0 ? (
                            <Badge className="bg-amber-950/80 text-amber-300 border border-amber-500/40 font-bold text-[10px] px-2 py-0.5 flex items-center gap-1">
                                <Trophy className="w-3 h-3 text-amber-400" />
                                <span>頭獎在席 (剩 {legendaryRemainingCount})</span>
                            </Badge>
                        ) : (pool.remainingPacks ?? 0) > 0 ? (
                            <Badge className="bg-slate-900/80 text-slate-400 border border-slate-800 text-[10px] px-2 py-0.5">
                                <span>頭獎已開出</span>
                            </Badge>
                        ) : null}

                        {/* 3. 點數加倍活動 */}
                        {isMultiplierActive && (
                            <Badge className="bg-amber-500 text-slate-950 border-0 font-black text-[10px] px-2 py-0.5 flex items-center gap-1 shadow-[0_0_8px_rgba(245,158,11,0.5)]">
                                <Zap className="w-3 h-3 fill-slate-950" />
                                <span>點數 {pool.pointMultiplier} 倍加碼</span>
                            </Badge>
                        )}

                        {/* 4. 年齡/活動/等級規則標籤 */}
                        {pool.isAdult && (
                            <span className="bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold text-[9px] px-1.5 py-0.2 rounded-full">
                                18+
                            </span>
                        )}
                        {pool.isEventPool && (
                            <span className="bg-purple-950/80 text-purple-300 border border-purple-500/40 font-bold text-[9px] px-1.5 py-0.2 rounded-full">
                                活動限定
                            </span>
                        )}
                        {pool.minLevel && pool.minLevel !== '新手收藏家' && (
                            <span className="bg-blue-950/80 text-blue-300 border border-blue-500/40 font-bold text-[9px] px-1.5 py-0.2 rounded-full">
                                {pool.minLevel}限定
                            </span>
                        )}
                        {pool.dailyLimit && (
                            <span className="bg-slate-900/80 text-slate-300 border border-slate-700 font-mono text-[9px] px-1.5 py-0.2 rounded-full">
                                每日限{pool.dailyLimit}抽
                            </span>
                        )}
                    </div>

                    {/* 卡池名稱 (清晰居中，移除冗贅說明段落) */}
                    <h2 className="text-base sm:text-lg md:text-xl font-black text-white tracking-tight break-words leading-tight px-1 text-center drop-shadow-md">
                        {pool.name}
                    </h2>
                </div>

                {/* 🏆 主卡面展示區 (消除中介框盒，背景四向羽化無縫溶入卡池機台) */}
                {(() => {
                    const featuredPrize = topPrizesPreview[selectedPrizeIndex] || topPrizesPreview[0];
                    if (!featuredPrize) return null;

                    return (
                        <div className="mb-2.5 w-full flex flex-col items-center">
                            {/* 🔴 獎品大圖：整合式科技黑曜金屬展台 (背景與卡池 100% 相同無縫貫穿，徹底消除異物隔閡感) */}
                            <div 
                                onClick={() => setPreviewCard(featuredPrize)}
                                onMouseMove={handleCardMouseMove}
                                onMouseLeave={handleCardMouseLeave}
                                style={{
                                    transform: cardTilt.active 
                                        ? `perspective(700px) rotateX(${cardTilt.x}deg) rotateY(${cardTilt.y}deg) scale3d(1.02, 1.02, 1.02)` 
                                        : 'perspective(700px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
                                    transition: cardTilt.active ? 'transform 0.1s ease-out' : 'transform 0.4s ease-out',
                                }}
                                className="group/card relative w-full h-[220px] xs:h-[250px] sm:h-[285px] rounded-t-2xl overflow-hidden cursor-pointer flex items-center justify-center select-none"
                            >
                                {/* 🌟 聚光燈錐與大氣微光層 (直接透出卡池本體的黑鈦碳纖與金色電路，零背景區隔) */}
                                <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                                    {/* 頂部傾瀉的暖金高質聚光燈光錐 */}
                                    <div 
                                        className="absolute inset-0 pointer-events-none"
                                        style={{
                                            background: 'conic-gradient(from 180deg at 50% -5%, transparent 155deg, rgba(245,158,11,0.15) 172deg, rgba(254,240,138,0.28) 180deg, rgba(245,158,11,0.15) 188deg, transparent 205deg)',
                                        }}
                                    />
                                    {/* 頂部柔和暖金光暈 */}
                                    <div className="absolute -top-10 left-1/2 -translate-x-1/2 w-56 h-24 bg-amber-400/20 rounded-full blur-2xl pointer-events-none" />
                                    {/* 中央展台環境柔光 */}
                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_65%,rgba(245,158,11,0.14)_0%,transparent_65%)] pointer-events-none" />
                                    {/* 底部柔和光影微暗過渡 (消除深死黑覆蓋，避免卡牌下半部發黑) */}
                                    <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
                                </div>
                                
                                {/* 實體卡面雷射彩虹折射層 */}
                                <div 
                                    className={cn(
                                        "absolute inset-0 pointer-events-none transition-opacity duration-200 z-20 mix-blend-color-dodge",
                                        cardTilt.active ? "opacity-90" : "opacity-0 group-hover/card:opacity-40"
                                    )}
                                    style={{
                                        background: `radial-gradient(circle at ${cardTilt.mouseX}% ${cardTilt.mouseY}%, rgba(255,255,255,0.75) 0%, rgba(255,215,0,0.45) 25%, rgba(168,85,247,0.35) 50%, rgba(34,211,238,0.25) 75%, transparent 100%)`,
                                    }}
                                />

                                {/* 前景大氣懸浮金塵光斑 (立體光束景深粒子) */}
                                <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
                                    <span className="absolute top-[26%] left-[22%] w-1.5 h-1.5 rounded-full bg-amber-300 blur-[0.6px] opacity-75 animate-pulse" />
                                    <span className="absolute top-[44%] right-[18%] w-1 h-1 rounded-full bg-yellow-200 blur-[0.4px] opacity-60" />
                                    <span className="absolute bottom-[20%] left-[26%] w-1.5 h-1.5 rounded-full bg-amber-400/60 blur-[0.6px] opacity-70" />
                                    <span className="absolute top-[62%] right-[24%] w-1 h-1 rounded-full bg-amber-300 blur-[0.5px] opacity-65 animate-pulse" style={{ animationDelay: '1.2s' }} />
                                </div>

                                {/* 🌟 次世代黑曜金屬展台 (沉穩接地，搭載反重力磁浮環與立體投影層) */}
                                <div className="absolute bottom-0 sm:-bottom-0.5 left-1/2 -translate-x-1/2 w-56 sm:w-72 flex flex-col items-center pointer-events-none z-5">
                                    {/* 檯面頂部橢圓拋光黑曜石鏡面 (承接光束與卡片倒影) */}
                                    <div className="relative w-full h-7 sm:h-8 rounded-[100%] bg-gradient-to-b from-slate-900 via-[#0d1117] to-black border-2 border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.3),inset_0_1px_3px_rgba(255,255,255,0.3)] flex items-center justify-center">
                                        {/* 檯面內圈金色微線路環 */}
                                        <div className="w-[88%] h-[72%] rounded-[100%] border border-amber-400/40 bg-gradient-to-b from-black/85 to-slate-950/95 shadow-[inset_0_0_10px_rgba(245,158,11,0.25)] flex items-center justify-center">
                                            {/* 科技反重力磁浮光環發射源 (藍金交織微光陣列) */}
                                            <div className="w-[70%] h-[60%] rounded-[100%] border border-cyan-400/45 bg-cyan-950/30 shadow-[0_0_12px_rgba(6,182,212,0.4)] animate-energy-ring" />
                                        </div>
                                    </div>

                                    {/* 展台斜切黑鈦金屬厚度底座 */}
                                    <div className="w-[94%] h-4.5 sm:h-5 -mt-3 sm:-mt-3.5 bg-gradient-to-b from-slate-900 via-[#080a0e] to-black border-x border-b border-amber-500/45 rounded-b-2xl shadow-[0_12px_24px_rgba(0,0,0,0.95)] flex flex-col items-center justify-between p-0.5">
                                        {/* 機台燙金銘線 */}
                                        <div className="w-20 sm:w-32 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/90 to-transparent mt-0.5" />
                                        {/* 機台科技散熱微隙孔 */}
                                        <div className="flex items-center gap-1.5 mb-0.5 opacity-75">
                                            <span className="w-1 h-1 rounded-full bg-cyan-400/70 shadow-[0_0_4px_#22d3ee]" />
                                            <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shadow-[0_0_6px_#fde047]" />
                                            <span className="w-1 h-1 rounded-full bg-cyan-400/70 shadow-[0_0_4px_#22d3ee]" />
                                        </div>
                                    </div>

                                    {/* 底座向下投射之立體黑曜陰影與金色漫射光 */}
                                    <div className="relative -mt-1.5 w-56 sm:w-72 flex items-center justify-center">
                                        <div className="w-full h-2.5 bg-black/95 rounded-[100%] blur-[3px]" />
                                        <div className="absolute w-[85%] h-2 bg-amber-400/30 rounded-[100%] blur-[5px]" />
                                    </div>
                                </div>

                                {/* ⚡ 反重力磁浮光柱與動態呼吸投影區 (完美連接展台與懸浮卡牌) */}
                                <div className="absolute bottom-2.5 sm:bottom-3 left-1/2 -translate-x-1/2 w-44 sm:w-52 pointer-events-none z-10 flex flex-col items-center">
                                    {/* 垂直向上托舉的能量光錐束 */}
                                    <div 
                                        className="w-20 sm:w-24 h-8 -mb-1.5 bg-gradient-to-t from-cyan-400/30 via-amber-400/20 to-transparent animate-levitate-beam blur-[2px]"
                                        style={{
                                            clipPath: 'polygon(15% 100%, 85% 100%, 100% 0%, 0% 0%)'
                                        }}
                                    />

                                    {/* 懸浮動態呼吸陰影 (隨卡片懸浮起伏呼吸，呈現真實高低落差深度感) */}
                                    <div className="relative w-full flex items-center justify-center">
                                        <div className="w-28 sm:w-36 h-2.5 rounded-[100%] bg-black/85 blur-[3px] animate-card-shadow" />
                                        <div className="absolute w-18 sm:w-24 h-1.5 rounded-[100%] bg-black/95 blur-[1px] animate-card-shadow" />
                                        <div className="absolute w-24 sm:w-30 h-1.5 rounded-[100%] bg-cyan-500/15 blur-[4px] animate-card-shadow" />
                                    </div>
                                </div>

                                {/* 🎴 主卡牌本體 (反重力浮空懸浮，與底座保持自然空間間隙，自帶平滑呼吸起伏動態) */}
                                <div className="absolute inset-x-0 top-1 bottom-5 sm:bottom-6 flex flex-col items-center justify-end z-20 pointer-events-none">
                                    <div className="relative w-full h-full max-h-[170px] xs:max-h-[195px] sm:max-h-[225px] flex items-end justify-center animate-card-levitate transition-all duration-300 group-hover/card:scale-[1.04] group-hover/card:-translate-y-1.5">
                                        {/* 主實體卡片 */}
                                        <div className="relative w-full h-full flex items-end justify-center">
                                            <div className="relative w-full h-full max-w-[158px] max-h-[216px] flex items-end justify-center overflow-visible">
                                                <SafeImage 
                                                    src={mattedFeaturedPrizeImage || featuredPrize.imageUrl} 
                                                    alt={featuredPrize.name} 
                                                    sizes="(max-width: 640px) 260px, 320px" 
                                                    fill 
                                                    className="object-contain object-bottom drop-shadow-[0_10px_20px_rgba(0,0,0,0.45)] drop-shadow-[0_0_12px_rgba(245,158,11,0.25)] relative z-10" 
                                                />
                                            </div>
                                        </div>

                                        {/* 晶亮展台檯面之微鏡面倒影 (懸空倒影，去背透明無黑框) */}
                                        <div className="absolute -bottom-8 w-full h-6 overflow-hidden pointer-events-none opacity-20 blur-[1px] select-none [mask-image:linear-gradient(to_bottom,rgba(0,0,0,0.7),transparent)]">
                                            <div className="relative w-full h-full scale-y-[-1] flex items-start justify-center">
                                                <SafeImage 
                                                    src={mattedFeaturedPrizeImage || featuredPrize.imageUrl} 
                                                    alt="" 
                                                    sizes="240px" 
                                                    fill 
                                                    className="object-contain object-top" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 卡片角標 */}
                                <div className="absolute top-1.5 left-1.5 z-30">
                                    <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[9px] px-1.5 py-0.2 rounded shadow uppercase tracking-wider flex items-center gap-0.5">
                                        <Star className="w-2.5 h-2.5 fill-slate-950" />
                                        <span>{featuredPrize.isLastPrize ? '最後賞' : 'TOP'}</span>
                                    </span>
                                </div>

                                {/* 完售遮罩 */}
                                {featuredPrize.quantity <= 0 && !featuredPrize.isPoolCover && (
                                    <div className="absolute inset-0 bg-black/75 backdrop-blur-[2px] flex items-center justify-center z-30">
                                        <span className="bg-rose-600 text-white font-black text-xs px-2.5 py-1 rounded-lg border border-rose-400 shadow-lg">
                                            已抽出
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })()}

                        {/* 📊 賞別微統計與剩餘進度條（點擊傳說/稀有/普通即可查看該賞別剩下什麼卡） */}
                        <div className="mb-2 bg-gradient-to-b from-slate-950/90 via-black/90 to-slate-950/90 backdrop-blur-xl rounded-xl border border-amber-500/20 p-2 sm:p-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.5)]">
                            {/* 3 欄可點擊賞別數據 */}
                            <div className="grid grid-cols-3 gap-1.5 text-center font-mono">
                                {RARITIES.map((r) => {
                                    const detail = rarityDetails[r];
                                    const RarityIcon = rarityStyles[r].icon;
                                    const isSoldOut = detail.count <= 0;

                                    return (
                                        <button 
                                            key={r}
                                            type="button"
                                            onClick={() => {
                                                setInventoryFilterRarity(r);
                                                setIsInventoryOpen(true);
                                            }}
                                            title={`點擊查看${rarityStyles[r].label}剩餘卡牌`}
                                            className={cn(
                                                "flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg border text-xs transition-all cursor-pointer group/rarity active:scale-95 select-none",
                                                isSoldOut
                                                    ? "bg-slate-950/60 border-slate-900 text-slate-600 opacity-60 hover:opacity-100 hover:border-slate-700"
                                                    : r === 'legendary' 
                                                    ? "bg-amber-500/[0.12] border-amber-500/40 text-amber-300 font-black shadow-[0_0_10px_rgba(245,158,11,0.15)] hover:border-amber-400 hover:bg-amber-500/20 hover:scale-[1.02]" 
                                                    : r === 'rare' 
                                                    ? "bg-purple-500/[0.12] border-purple-500/40 text-purple-300 font-bold hover:border-purple-400 hover:bg-purple-500/20 hover:scale-[1.02]" 
                                                    : "bg-cyan-500/[0.12] border-cyan-500/40 text-cyan-300 font-bold hover:border-cyan-400 hover:bg-cyan-500/20 hover:scale-[1.02]"
                                            )}
                                        >
                                            <RarityIcon className="w-3 h-3 shrink-0 group-hover/rarity:scale-110 transition-transform" />
                                            <span className="text-[10px] font-black">{rarityStyles[r].label.replace('賞', '')}</span>
                                            <span className="font-black text-xs">{detail.count}</span>
                                        </button>
                                    );
                                })}
                            </div>

                    {/* 剩餘進度條 */}
                    <div className="mt-2 pt-2 border-t border-amber-500/10">
                        <div className="flex justify-between items-center text-[10px] mb-1.5 font-mono">
                            <span className={cn("font-bold flex items-center gap-1", isLastChance ? "text-amber-400" : "text-slate-300")}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", isLastChance ? "bg-rose-500 animate-ping" : "bg-cyan-400")} />
                                {isLastChance ? '🔥 搶包中' : '剩餘包數'}
                            </span>
                            <div className="flex items-center gap-1">
                                <span className={cn("font-black", isLastChance ? "text-amber-300" : "text-white")}>
                                    {pool.remainingPacks}
                                </span>
                                <span className="text-slate-500">/{pool.totalPacks}</span>
                                <span className={cn("font-black ml-1 px-1 py-0.2 rounded text-[9px]", isLastChance ? "bg-rose-950/80 text-rose-300 border border-rose-500/30" : "bg-cyan-950/80 text-cyan-300 border border-cyan-500/30")}>
                                    {remainingPercent}%
                                </span>
                            </div>
                        </div>
                        <div className="h-2 w-full rounded-full overflow-hidden bg-black/90 border border-slate-800/90 p-[0.5px]">
                            <div 
                                className={cn(
                                    "h-full rounded-full transition-all duration-500 shadow-sm",
                                    isLastChance 
                                        ? "bg-gradient-to-r from-amber-400 via-rose-500 to-red-600 animate-pulse" 
                                        : "bg-gradient-to-r from-amber-400 via-cyan-400 to-blue-500"
                                )}
                                style={{ width: `${remainingPercent}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* 免費抽卡券提示（僅在持有免費券時優雅提示，0張時完全不佔空間） */}
                {pool.allowFreeDraw !== false && effectiveTickets > 0 && (
                    <div className="mb-2 p-1.5 rounded-lg bg-emerald-950/60 border border-emerald-500/40 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5 text-emerald-300 font-bold text-[11px]">
                            <Ticket className="w-3.5 h-3.5" />
                            <span>持有免費券 {effectiveTickets} 張</span>
                        </div>
                        <Button
                            size="sm"
                            onClick={handleDrawWithTicket}
                            disabled={poolStatus.disabled || isDrawing}
                            className="h-6 px-2.5 rounded bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-[11px] cursor-pointer"
                        >
                            直接使用
                        </Button>
                    </div>
                )}

                {/* 📢 卡池即時狀態說明提示條 (當卡池處於保護、售罄、尚未開放等狀態時，清晰告知客人) */}
                {poolStatus.disabled && poolStatus.message && (
                    <div className={cn(
                        "mb-2 p-2 rounded-xl border text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-sm transition-all",
                        poolStatus.status === 'sold-out' 
                            ? "bg-rose-950/70 border-rose-500/40 text-rose-300"
                            : poolStatus.status === 'locked'
                            ? "bg-amber-950/70 border-amber-500/50 text-amber-300 animate-pulse"
                            : poolStatus.status === 'locked-by-me'
                            ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-300"
                            : poolStatus.status === 'not-started'
                            ? "bg-sky-950/70 border-sky-500/40 text-sky-300"
                            : "bg-slate-900/80 border-slate-800 text-slate-300"
                    )}>
                        {poolStatus.status === 'sold-out' ? (
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : poolStatus.status === 'locked' ? (
                            <Lock className="w-4 h-4 text-amber-400 shrink-0" />
                        ) : poolStatus.status === 'locked-by-me' ? (
                            <Unlock className="w-4 h-4 text-emerald-400 shrink-0" />
                        ) : poolStatus.status === 'not-started' ? (
                            <Clock className="w-4 h-4 text-sky-400 shrink-0" />
                        ) : (
                            <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span>
                            {poolStatus.status === 'sold-out' 
                                ? '本卡池已全數售罄，敬請期待下一輪補貨！' 
                                : poolStatus.status === 'locked'
                                ? `其他玩家正在挑號抽卡中（保護倒數 ${poolStatus.message}）`
                                : poolStatus.status === 'locked-by-me'
                                ? `您正在保留挑號中（倒數 ${poolStatus.message}）`
                                : poolStatus.message}
                        </span>
                    </div>
                )}

                {/* 抽卡操作按鈕列 */}
                {pool.exclusiveTicketOnly ? (
                    <div className="space-y-1.5 relative">
                        {isDrawing && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
                                <div className="flex space-x-1.5">
                                    <div className="w-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                    <div className="w-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                            </div>
                        )}

                        {(() => {
                            const eventTickets = userProfile?.eventPoolTickets?.[pool.id] || 0;
                            return (
                                <div className="grid grid-cols-2 gap-2">
                                    <Button
                                        disabled={poolStatus.disabled || isDrawing || eventTickets < 1}
                                        onClick={() => router.push(`/draw/open?poolId=${pool.id}&draws=1&useEventTicket=true`)}
                                        className={cn(
                                            "h-10 rounded-xl font-black text-xs shadow flex items-center justify-center gap-1.5",
                                            eventTickets >= 1
                                                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950"
                                                : "bg-slate-900 text-slate-500 border border-slate-800"
                                        )}
                                    >
                                        <Ticket className="w-3.5 h-3.5" />
                                        <span>單抽 (1張)</span>
                                    </Button>

                                    <Button
                                        disabled={poolStatus.disabled || isDrawing || eventTickets < 3}
                                        onClick={() => router.push(`/draw/open?poolId=${pool.id}&draws=3&useEventTicket=true`)}
                                        className={cn(
                                            "h-10 rounded-xl font-black text-xs shadow flex items-center justify-center gap-1.5",
                                            eventTickets >= 3
                                                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
                                                : "bg-slate-900 text-slate-500 border border-slate-800"
                                        )}
                                    >
                                        <Sparkles className="w-3.5 h-3.5" />
                                        <span>三連抽 (3張)</span>
                                    </Button>
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <div className="space-y-1.5 sm:space-y-2 mt-1">
                        {/* 抽卡按鈕列 (1抽 / 3抽 / 5抽 / 10抽 / 全包，點擊後直接進入挑籤視窗) */}
                        <div className={cn(
                            "grid gap-1.5 sm:gap-2 relative",
                            drawOptions.length === 1 ? "grid-cols-1" :
                            drawOptions.length === 2 ? "grid-cols-2" : "grid-cols-3"
                        )}>
                        {isDrawing && (
                            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
                                <div className="flex space-x-1.5">
                                    <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
                                    <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                    <div className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
                                </div>
                            </div>
                        )}

                        {drawOptions.map((opt) => {
                            const drawCount = opt.count;
                            const canDraw = !poolStatus.disabled && remainingPacks >= drawCount;
                            const baseCost = (pool.price || 0) * drawCount;
                            const price = drawCount === 1 ? (pool.price || 0) 
                                        : drawCount === 3 ? (pool.price3Draws || baseCost) 
                                        : drawCount === 10 ? (pool.price10Draws || baseCost)
                                        : baseCost;
                            const savings = baseCost - price;
                            const label = opt.label;
                            const isPPoint = pool.currency === 'p-point';
                            const isHighlighted = opt.isMax;
                            
                            return (
                                <Button 
                                    key={drawCount}
                                    disabled={!canDraw || isDrawing}
                                    className={cn(
                                        "relative h-auto min-h-[46px] sm:min-h-[50px] py-1.5 px-1 flex flex-col items-center justify-center rounded-xl transition-all active:scale-95 overflow-hidden border group cursor-pointer shadow-sm select-none",
                                        isHighlighted
                                            ? opt.isAllIn
                                                ? "bg-gradient-to-b from-amber-950/60 via-slate-950 to-slate-950 border-amber-500/80 hover:border-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                                : "bg-gradient-to-b from-cyan-950/50 via-slate-950 to-slate-950 border-cyan-500/70 hover:border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                            : "bg-slate-950/80 border-slate-800 hover:border-amber-500/40 hover:bg-slate-900"
                                    )}
                                    onClick={() => handleDraw(drawCount)}
                                >
                                    {/* 優惠/全包極簡角標 (緊湊嵌合右上角，平滑倒角不破壞按鈕輪廓) */}
                                    {opt.isAllIn ? (
                                        <span className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 font-black text-[8px] px-1.5 py-0.5 rounded-bl-md leading-none z-10 shadow-sm animate-pulse">
                                            全包
                                        </span>
                                    ) : savings > 0 ? (
                                        <span className="absolute top-0 right-0 bg-amber-400 text-slate-950 font-black text-[8px] px-1.5 py-0.5 rounded-bl-md leading-none z-10 shadow-sm">
                                            省{savings >= 10000 ? `${(savings / 1000).toFixed(0)}k` : savings}
                                        </span>
                                    ) : null}

                                    {/* 抽數名稱 */}
                                    <span className={cn(
                                        "font-black text-xs sm:text-sm tracking-tight leading-tight",
                                        isHighlighted 
                                            ? opt.isAllIn ? "text-amber-200" : "text-cyan-200" 
                                            : "text-slate-100 group-hover:text-white"
                                    )}>
                                        {label}
                                    </span>
                                    
                                    {/* 價格標示 */}
                                    <span className="flex items-center justify-center text-white font-mono font-black text-xs sm:text-sm tracking-tight mt-0.5 leading-none">
                                        <span>{price.toLocaleString()}</span>
                                        {isPPoint ? (
                                            <PPlusIcon className="w-3.5 h-3.5 ml-0.5 shrink-0 text-amber-400" />
                                        ) : (
                                            <DiamondIcon className={cn("w-3.5 h-3.5 ml-0.5 shrink-0", isHighlighted ? (opt.isAllIn ? "text-amber-300" : "text-cyan-300") : "text-cyan-400")} />
                                        )}
                                    </span>
                                </Button>
                            )
                        })}
                    </div>
                    </div>
                )}

                {/* 模擬試抽（極簡微型次要按鈕） */}
                <Button 
                    variant="ghost" 
                    className="w-full mt-1.5 h-6 sm:h-7 text-[10px] sm:text-[11px] font-medium text-slate-400 hover:text-amber-300 hover:bg-slate-900/60 flex items-center justify-center gap-1 transition-all cursor-pointer"
                    onClick={handleTrialDraw}
                    disabled={isDrawing}
                >
                    <Sparkles className="w-3 h-3 text-cyan-400/80" />
                    <span>模擬試抽</span>
                </Button>
                </div>
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
                        <div className="flex justify-between items-center mb-3 pb-2.5 border-b border-slate-800">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400">
                                    <Package className="w-5 h-5" />
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <h2 className="text-base sm:text-lg font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-200 to-fuchsia-300 tracking-wider font-headline">
                                        卡池剩餘卡片清冊
                                    </h2>
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

                        {/* 賞別快速切換標籤列 */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-3 no-scrollbar">
                            <button
                                type="button"
                                onClick={() => setInventoryFilterRarity('all')}
                                className={cn(
                                    "px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer whitespace-nowrap border",
                                    inventoryFilterRarity === 'all'
                                        ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 border-amber-300 shadow-md shadow-amber-500/20"
                                        : "bg-slate-900/80 text-slate-400 hover:text-white border-slate-800"
                                )}
                            >
                                全部賞別
                            </button>
                            {RARITIES.map(r => {
                                const style = rarityStyles[r];
                                const RarityIcon = style.icon;
                                const isSelected = inventoryFilterRarity === r;
                                const totalInRarity = rarityDetails[r]?.count || 0;

                                return (
                                    <button
                                        key={r}
                                        type="button"
                                        onClick={() => setInventoryFilterRarity(r)}
                                        className={cn(
                                            "px-3 py-1 rounded-full text-xs font-black transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 border",
                                            isSelected
                                                ? cn(style.bg, style.border, style.text, "shadow-md ring-1 ring-white/20")
                                                : "bg-slate-900/80 text-slate-400 hover:text-white border-slate-800"
                                        )}
                                    >
                                        <RarityIcon className="w-3 h-3" />
                                        <span>{style.label}</span>
                                        <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full font-mono ml-0.5", isSelected ? "bg-black/50 text-white" : "bg-slate-950 text-slate-400")}>
                                            {totalInRarity}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {/* 內容區域 - 直接展示卡片與獎項名冊 */}
                        <div className="space-y-4 sm:space-y-5">
                            {/* 最後賞 特殊區塊 (在全部或傳說賞時展示) */}
                            {lastPrizeCard && (inventoryFilterRarity === 'all' || inventoryFilterRarity === 'legendary') && (
                                <div 
                                    className="relative overflow-hidden border-2 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-slate-950 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.2)] flex flex-col sm:flex-row items-center gap-3 sm:gap-5 cursor-pointer hover:scale-[1.01] transition-all group/last"
                                    onClick={() => setPreviewCard({ ...lastPrizeCard, rarity: 'legendary' })}
                                >
                                    <div className="relative z-10 w-20 sm:w-24 aspect-[2.5/3.5] rounded-xl overflow-hidden border-2 border-amber-400/60 p-0.5 bg-gradient-to-b from-slate-700/80 via-slate-800/80 to-slate-900/90 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] shrink-0 shadow-lg group-hover/last:border-amber-300 mt-1 sm:mt-0">
                                        <SafeImage src={lastPrizeCard.imageUrl} alt="lp" sizes="120px" fill className="object-contain p-0.5 rounded-lg relative z-10 drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]" />
                                    </div>
                                    <div className="text-center sm:text-left flex-1">
                                        <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider block mb-1">【最後賞】抽完最後一包即刻獲得</span>
                                        <p className="text-[11px] text-slate-300 leading-relaxed max-w-lg">
                                            本卡池最終限定大獎！清空此卡池剩餘存量時，將自動作為最終獎勵發放至您的收藏庫中。
                                        </p>
                                        <span className="inline-flex items-center gap-1 text-[10px] text-cyan-300 font-bold mt-1.5 hover:underline">
                                            <Eye className="w-3 h-3" /> 點擊放大查看卡牌詳細資訊
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* 各稀有度群組 (根據 inventoryFilterRarity 過濾) */}
                            {(inventoryFilterRarity === 'all' ? RARITIES : RARITIES.filter(r => r === inventoryFilterRarity)).map(r => { 
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
                                                        "relative w-full aspect-[2.5/3.5] mb-1.5 rounded-lg overflow-hidden border p-0.5 bg-gradient-to-b from-slate-700/80 via-slate-800/80 to-slate-900/90 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] flex flex-col items-center justify-center",
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
                                                            <SafeImage src={c.imageUrl} alt={c.name} sizes="140px" fill className="object-contain rounded-md p-0.5 relative z-10 drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]" />
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

                                                    {/* 剩餘數量膠囊 Badge */}
                                                    {!c.isSoldOut ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-cyan-950/80 border border-cyan-400/40 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.15)] flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
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

            {/* 卡片大圖預覽對話框 (典藏級高透壓克力微光展台) */}
            {!!previewCard && (
                <div 
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-xl animate-in fade-in-0 duration-200 select-none" 
                    onClick={() => setPreviewCard(null)}
                >
                    <div 
                        className="relative max-w-[min(92vw,360px)] w-full bg-gradient-to-b from-slate-900/95 via-[#0c1220]/95 to-slate-950/95 border border-white/20 rounded-[28px] p-5 sm:p-6 flex flex-col items-center justify-center gap-3.5 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9),0_0_50px_rgba(255,255,255,0.06)] overflow-hidden" 
                        onClick={e => e.stopPropagation()}
                    >
                        {/* 頂部柔和微光環境暈染 (消除生硬線條) */}
                        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-32 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

                        {/* 右上角優雅懸浮關閉鈕 */}
                        <button 
                            type="button"
                            className="absolute top-3.5 right-3.5 w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all cursor-pointer z-20" 
                            onClick={() => setPreviewCard(null)}
                            aria-label="關閉預覽"
                        >
                            <X className="h-4 w-4" />
                        </button>

                        {/* 頂部卡片資訊區：稀有度徽章與完整卡名 */}
                        <div className="text-center w-full px-6 flex flex-col items-center gap-1.5 pt-1">
                            <div className="flex items-center gap-2 flex-wrap justify-center">
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border shadow-sm",
                                    rarityStyles[previewCard.rarity as Rarity]?.badgeBg || "bg-slate-900 text-slate-300 border-white/10"
                                )}>
                                    {rarityStyles[previewCard.rarity as Rarity]?.label || previewCard.rarity}
                                </span>
                                {previewCard.quantity !== undefined && (
                                    <span className="text-[10px] font-bold text-slate-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-mono">
                                        庫存 {previewCard.quantity} 包
                                    </span>
                                )}
                            </div>
                            <h3 className="font-headline font-black text-sm sm:text-base text-white tracking-tight text-center leading-snug line-clamp-2 mt-0.5">
                                {previewCard.name}
                            </h3>
                        </div>

                        {/* 卡片主體展示區：支援 3D 翻轉與高解析放大 */}
                        <div className="w-full max-w-[220px] sm:max-w-[240px] my-1 drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)]">
                            {previewCard.isPoints ? (
                                <RandomPlayerCard 
                                    rarity={previewCard.rarity} 
                                    points={previewCard.points} 
                                    title={previewCard.name}
                                    showBuybackHint={false} 
                                />
                            ) : (
                                <CardItem 
                                    name={previewCard.name} 
                                    imageUrl={previewCard.imageUrl} 
                                    backImageUrl={previewCard.backImageUrl} 
                                    imageHint={previewCard.name} 
                                    rarity={previewCard.rarity} 
                                    isFlippable={true}
                                />
                            )}
                        </div>

                        {/* 底部互動導引標籤 */}
                        {!previewCard.isPoints && (
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-slate-300 shadow-sm">
                                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                                <span>點擊卡片可 3D 翻面觀看背卡</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 一番賞自選號碼挑籤彈窗 (挑完號碼後再進入抽卡) */}
            <KujiNumberPickerDialog
                isOpen={isPickNumberOpen}
                onClose={() => {
                    setIsPickNumberOpen(false);
                }}
                cardPool={pool as any}
                userBalance={
                    userProfile 
                        ? (pool.currency === 'p-point' ? (userProfile.bonusPoints || 0) : (userProfile.points || 0))
                        : 0
                }
                isDrawing={isDrawing}
                initialSelectedNumbers={[]}
                onSelectNumbersOnly={(chosenNumbers) => {
                    setIsPickNumberOpen(false);
                    const numbersParam = chosenNumbers.join(',');
                    router.push(`/draw/open?poolId=${pool.id}&numbers=${numbersParam}&draws=${chosenNumbers.length}`);
                }}
                onConfirmDraw={(chosenNumbers, asTrial) => {
                    setIsPickNumberOpen(false);
                    const numbersParam = chosenNumbers.join(',');
                    if (asTrial) {
                        router.push(`/draw/open?poolId=${pool.id}&numbers=${numbersParam}&draws=${chosenNumbers.length}&trial=true`);
                    } else {
                        router.push(`/draw/open?poolId=${pool.id}&numbers=${numbersParam}&draws=${chosenNumbers.length}`);
                    }
                }}
            />
        </div>
    );
}
