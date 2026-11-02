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

    // 🌟 3D 陀螺儀微傾斜與雷射流光 (Holo Foil) - 透過純 DOM 與 CSS 變數處理，零 React 重繪
    const handleCardMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -12; // 最大傾斜 12 度
        const rotateY = ((x - centerX) / centerX) * 12;
        const mousePercentX = Math.round((x / rect.width) * 100);
        const mousePercentY = Math.round((y / rect.height) * 100);

        el.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`;
        el.style.setProperty('--sheen-x', `${mousePercentX}%`);
        el.style.setProperty('--sheen-y', `${mousePercentY}%`);
        el.style.setProperty('--sheen-opacity', '0.9');
    };

    const handleCardMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
        const el = e.currentTarget;
        el.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
        el.style.setProperty('--sheen-opacity', '0');
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
        // 僅當卡池有倒數過期或加倍過期時才啟動秒級更新，避免無謂的全域重繪
        const hasExpiry = Boolean(pool.expiresAt || pool.pointMultiplierExpiresAt);
        if (!hasExpiry) return;
        const timer = setInterval(() => setCurrentTime(new Date()), 5000);
        return () => clearInterval(timer);
    }, [pool.expiresAt, pool.pointMultiplierExpiresAt]);

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
        const parseSafeDate = (val: any): Date | null => {
            if (!val) return null;
            try {
                if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
                if (typeof val?.toDate === 'function') {
                    const d = val.toDate();
                    return isNaN(d.getTime()) ? null : d;
                }
                if (typeof val?.seconds === 'number') {
                    const d = new Date(val.seconds * 1000);
                    return isNaN(d.getTime()) ? null : d;
                }
                if (typeof val === 'string' || typeof val === 'number') {
                    const d = new Date(val);
                    return isNaN(d.getTime()) ? null : d;
                }
            } catch {
                return null;
            }
            return null;
        };

        const isSoldOut = (pool.remainingPacks ?? 0) <= 0;
        if (isSoldOut) return { status: 'sold-out', disabled: true, message: '已全數售罄' };

        const expiresAtDate = parseSafeDate(pool.expiresAt);
        if (expiresAtDate && currentTime > expiresAtDate) {
            return { status: 'expired', disabled: true, message: '已結束' };
        }

        const startsAtDate = parseSafeDate(pool.startsAt);
        if (startsAtDate && currentTime < startsAtDate) {
            try {
                return { status: 'not-started', disabled: true, message: format(startsAtDate, "MM-dd HH:mm") + ' 開放' };
            } catch {
                return { status: 'not-started', disabled: true, message: '即將開放' };
            }
        }

        if (pool.hasProtection !== false && pool.lockedAt) {
            const lockTime = parseSafeDate(pool.lockedAt) || new Date();
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
                "relative w-full flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1 select-none",
                "shadow-[0_18px_45px_rgba(0,0,0,0.85),0_0_25px_rgba(245,158,11,0.2)] hover:shadow-[0_24px_55px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.35)] rounded-2xl sm:rounded-3xl border border-amber-400/40 hover:border-amber-400/75"
            )}>
                {/* ================= 1. 卡包頂部熱壓封口 (TOP SOFT CRIMPED FOIL SEAL) ================= */}
                <div className="relative w-full shrink-0 z-20 pointer-events-none rounded-t-2xl sm:rounded-t-3xl overflow-hidden">
                    {/* 頂部柔和微波熱壓切邊 (Soft Scalloped / Wavy Foil Crimp) */}
                    <div className="w-full h-2 overflow-hidden flex items-center justify-between opacity-80 pointer-events-none bg-slate-950">
                        <svg className="w-full h-2 block text-slate-900" viewBox="0 0 400 6" preserveAspectRatio="none">
                            <path 
                                d="M0,6 Q5,1 10,6 Q15,1 20,6 Q25,1 30,6 Q35,1 40,6 Q45,1 50,6 Q55,1 60,6 Q65,1 70,6 Q75,1 80,6 Q85,1 90,6 Q95,1 100,6 Q105,1 110,6 Q115,1 120,6 Q125,1 130,6 Q135,1 140,6 Q145,1 150,6 Q155,1 160,6 Q165,1 170,6 Q175,1 180,6 Q185,1 190,6 Q195,1 200,6 Q205,1 210,6 Q215,1 220,6 Q225,1 230,6 Q235,1 240,6 Q245,1 250,6 Q255,1 260,6 Q265,1 270,6 Q275,1 280,6 Q285,1 290,6 Q295,1 300,6 Q305,1 310,6 Q315,1 320,6 Q325,1 330,6 Q335,1 340,6 Q345,1 350,6 Q355,1 360,6 Q365,1 370,6 Q375,1 380,6 Q385,1 390,6 Q395,1 400,6 Z" 
                                fill="currentColor" 
                                stroke="#f59e0b" 
                                strokeWidth="0.8" 
                                strokeOpacity="0.6"
                            />
                        </svg>
                    </div>

                    {/* 頂部鋁箔熱壓密封板身 (圓潤柔和倒角與金曜漸層) */}
                    <div className={cn(
                        "relative w-full px-3.5 py-2.5 bg-gradient-to-b from-[#1a1c26] via-[#10131d] to-[#0a0c14] border-x border-t border-amber-400/40 flex items-center justify-between",
                        isLastChance && "border-amber-400/60 bg-gradient-to-b from-amber-950/70 via-[#10131d] to-[#0a0c14]"
                    )}>
                        {/* 垂直細密柔和熱壓封口紋理 */}
                        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(245,158,11,0.06)_0px,rgba(245,158,11,0.06)_1px,transparent_1px,transparent_5px)] pointer-events-none opacity-70" />

                        {/* 左側微型柔和撕口提示 */}
                        <div className="relative z-10 flex items-center gap-1 text-[8px] font-bold text-amber-300/80 tracking-wider">
                            <span className="w-1 h-1 rounded-full bg-amber-400/70" />
                            <span className="hidden sm:inline">PULL</span>
                        </div>

                        {/* 中央柔和圓角歐規吊掛槽 (Soft Pill Slot) */}
                        <div className="relative z-10 flex items-center justify-center">
                            <div className="w-14 sm:w-16 h-2.5 rounded-full bg-slate-950/90 border border-white/20 shadow-[inset_0_1px_2px_rgba(0,0,0,0.8),0_0_8px_rgba(245,158,11,0.15)] flex items-center justify-center">
                                <div className="w-2.5 h-1 rounded-t-full border-t border-white/20 bg-black/50 -mt-0.5" />
                            </div>
                        </div>

                        {/* 右側微型柔和撕口提示 */}
                        <div className="relative z-10 flex items-center gap-1 text-[8px] font-bold text-amber-300/80 tracking-wider">
                            <span className="hidden sm:inline">OPEN</span>
                            <span className="w-1 h-1 rounded-full bg-amber-400/70" />
                        </div>

                        {/* 頂部密封條下緣柔和微折線 */}
                        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
                    </div>
                </div>

                {/* ================= 2. 卡包袋身主體 (BOOSTER PACK MAIN BODY) ================= */}
                <div className={cn(
                    "relative w-full bg-[#0a0c10]/95 backdrop-blur-2xl border-x border-amber-400/25 p-3 sm:p-5 flex flex-col justify-between transition-all duration-300 overflow-hidden shadow-xl",
                    isLastChance 
                        ? "border-amber-500/70 shadow-[0_0_35px_rgba(245,158,11,0.3)]" 
                        : "hover:border-amber-400/50"
                )}>
                    {/* 卡包左右兩側溫潤柔和高光 (Soft Metallic Cushion Highlights) */}
                    <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-white/10 via-amber-300/15 to-transparent pointer-events-none z-10" />
                    <div className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-l from-white/10 via-amber-300/15 to-transparent pointer-events-none z-10" />

                    {/* 鋁箔斜向反光流光 (Holographic Foil Sheen on Hover) */}
                    <div className="absolute -inset-full bg-gradient-to-tr from-transparent via-white/10 to-transparent rotate-12 pointer-events-none -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out z-10" />

                    {/* 🌟 卡包一體化背景系統 (深黑曜石拉絲鋁箔、菱形光柵折射、卡片專屬聚光台與卡包立體摺痕) */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                        {/* 1. 底層：深黑曜石拉絲金屬鋁箔基底 (Obsidian Brushed Foil Base) */}
                        <div className="absolute inset-0 bg-gradient-to-b from-[#080a10] via-[#0d121c] to-[#07090f]" />

                        {/* 2. 實體卡包微菱格鋁箔折射紋理 (Prism Diamond Foil Micro-Pattern) */}
                        <div 
                            className="absolute inset-0 opacity-[0.14] group-hover:opacity-[0.22] transition-opacity duration-700"
                            style={{
                                backgroundImage: `
                                    linear-gradient(45deg, rgba(245, 158, 11, 0.25) 25%, transparent 25%),
                                    linear-gradient(-45deg, rgba(245, 158, 11, 0.25) 25%, transparent 25%),
                                    linear-gradient(45deg, transparent 75%, rgba(245, 158, 11, 0.25) 75%),
                                    linear-gradient(-45deg, transparent 75%, rgba(245, 158, 11, 0.25) 75%)
                                `,
                                backgroundSize: '16px 16px',
                                backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0px'
                            }}
                        />

                        {/* 3. 卡包中央大獎卡專屬展台聚光光錐 (Center Spotlight Flare) */}
                        <div 
                            className={cn(
                                "absolute top-[18%] left-1/2 -translate-x-1/2 w-[280px] sm:w-[320px] h-[280px] rounded-full blur-2xl pointer-events-none transition-all duration-700",
                                isLastChance 
                                    ? "bg-[radial-gradient(circle,rgba(244,63,94,0.3)_0%,rgba(245,158,11,0.25)_40%,transparent_70%)] animate-pulse" 
                                    : "bg-[radial-gradient(circle,rgba(245,158,11,0.22)_0%,rgba(251,191,36,0.12)_35%,rgba(6,182,212,0.06)_55%,transparent_72%)]"
                            )} 
                        />

                        {/* 3.5. 🌟 背景 P+Carder 典藏卡包立體文字 LOGO 浮水印 (使用者指定紅圈位置：中下段橫跨卡片腰部，精緻縮小) */}
                        <div className="absolute top-[45%] -translate-y-1/2 inset-x-0 flex flex-col items-center justify-center pointer-events-none select-none z-[1] opacity-[0.20] group-hover:opacity-[0.30] transition-all duration-700">
                            <span className="font-headline font-black text-xl xs:text-2xl sm:text-[28px] tracking-[0.2em] text-transparent bg-clip-text bg-gradient-to-b from-amber-100 via-amber-300 to-amber-600 drop-shadow-[0_2px_10px_rgba(245,158,11,0.5)] italic">
                                P+CARDER
                            </span>
                            <span className="font-mono text-[6.5px] sm:text-[7.5px] font-black tracking-[0.35em] text-amber-200/90 uppercase -mt-0.5">
                                AUTHENTIC TRADING CARDS
                            </span>
                        </div>

                        {/* 4. 卡包幾何防偽線條與金屬折角飾線 (Booster Pack Prismatic Geometric Lines) */}
                        <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-30 group-hover:opacity-45 transition-opacity duration-500" xmlns="http://www.w3.org/2000/svg">
                            <defs>
                                <linearGradient id="foilGoldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                                    <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.8" />
                                    <stop offset="50%" stopColor="#fde047" stopOpacity="1" />
                                    <stop offset="100%" stopColor="#d97706" stopOpacity="0.5" />
                                </linearGradient>
                            </defs>
                            {/* 左上方幾何折角紋路 */}
                            <path d="M 0 45 L 35 45 L 55 25 L 90 25" stroke="url(#foilGoldGradient)" strokeWidth="0.8" fill="none" />
                            {/* 右上方幾何折角紋路 */}
                            <path d="M 380 45 L 345 45 L 325 25 L 290 25" stroke="url(#foilGoldGradient)" strokeWidth="0.8" fill="none" />
                            {/* 中央展台兩側防偽輔助線 */}
                            <line x1="20" y1="180" x2="60" y2="180" stroke="url(#foilGoldGradient)" strokeWidth="0.6" strokeDasharray="2 3" />
                            <line x1="340" y1="180" x2="380" y2="180" stroke="url(#foilGoldGradient)" strokeWidth="0.6" strokeDasharray="2 3" />
                            {/* 幾何微光飾點 */}
                            <circle cx="55" cy="25" r="1.5" fill="#fde047" />
                            <circle cx="325" cy="25" r="1.5" fill="#fde047" />
                        </svg>

                        {/* 5. 頂部熱壓封口交界陰影 (Top Seam Shadow: 營造真實卡包接縫立體感) */}
                        <div className="absolute top-0 inset-x-0 h-4 bg-gradient-to-b from-black/80 to-transparent pointer-events-none" />

                        {/* 6. 底部熱壓封口交界陰影 (Bottom Seam Shadow) */}
                        <div className="absolute bottom-0 inset-x-0 h-4 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

                        {/* 7. 卡包典藏金粉火花 (Floating Gold Stardust) */}
                        <div className="absolute inset-0 pointer-events-none overflow-hidden">
                            <span className="absolute bottom-12 left-[15%] w-1.2 h-1.2 rounded-full bg-amber-300 blur-[0.3px] animate-particle-1" />
                            <span className="absolute bottom-20 right-[18%] w-1 h-1 rounded-full bg-yellow-200 blur-[0.2px] animate-particle-2" />
                            <span className="absolute top-24 left-[30%] w-1 h-1 rounded-full bg-amber-400 blur-[0.3px] animate-particle-3" />
                        </div>

                        {/* 8. 柔和微暗角，確保中央卡片與文字高對比度 */}
                        <div className="absolute inset-0 bg-radial-gradient from-transparent via-black/25 to-black/60 pointer-events-none" />
                    </div>

                    {/* 頂部微光裝飾線 (衝刺時轉為燃燒金紅流光) */}
                    <div className={cn(
                        "absolute top-0 left-0 w-full h-[2px] z-10 transition-all duration-500",
                        isLastChance 
                            ? "bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" 
                            : "bg-gradient-to-r from-transparent via-amber-400/70 to-transparent"
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
                                    willChange: 'transform',
                                    transition: 'transform 0.15s ease-out',
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
                                
                                {/* 實體卡面雷射彩虹折射層 (純 CSS 變數動態流光，零重繪) */}
                                <div 
                                    className="absolute inset-0 pointer-events-none transition-opacity duration-200 z-20 mix-blend-color-dodge opacity-[var(--sheen-opacity,0)] group-hover/card:opacity-90"
                                    style={{
                                        background: 'radial-gradient(circle at var(--sheen-x,50%) var(--sheen-y,50%), rgba(255,255,255,0.75) 0%, rgba(255,215,0,0.45) 25%, rgba(168,85,247,0.35) 50%, rgba(34,211,238,0.25) 75%, transparent 100%)',
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

                        {/* 📊 賞別微統計與剩餘進度條（黑金卡包金屬質感，點擊傳說/稀有/普通即可查看該賞別剩下什麼卡） */}
                        <div className="mb-2 bg-gradient-to-b from-slate-950/95 via-black/95 to-slate-950/95 backdrop-blur-xl rounded-xl border border-amber-500/30 p-2 sm:p-2.5 shadow-[inset_0_1px_1px_rgba(255,255,255,0.08),0_4px_20px_rgba(0,0,0,0.6)]">
                            {/* 3 欄可點擊賞別數據 (傳說金 / 稀有紫 / 普通銀) */}
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
                                                "flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg border text-xs transition-all cursor-pointer group/rarity active:scale-95 select-none relative overflow-hidden",
                                                isSoldOut
                                                    ? "bg-slate-950/60 border-slate-900 text-slate-600 opacity-60 hover:opacity-100 hover:border-slate-700"
                                                    : r === 'legendary' 
                                                    ? "bg-gradient-to-b from-amber-500/20 via-amber-950/35 to-black/80 border-amber-400/60 text-amber-300 font-black shadow-[0_0_12px_rgba(245,158,11,0.2)] hover:border-amber-300 hover:bg-amber-500/30 hover:scale-[1.02]" 
                                                    : r === 'rare' 
                                                    ? "bg-gradient-to-b from-purple-500/20 via-purple-950/35 to-black/80 border-purple-400/50 text-purple-200 font-bold shadow-[0_0_12px_rgba(168,85,247,0.18)] hover:border-purple-300 hover:bg-purple-500/30 hover:scale-[1.02]" 
                                                    : "bg-gradient-to-b from-slate-700/20 via-slate-900/40 to-black/80 border-slate-600/60 text-slate-200 font-bold hover:border-slate-400 hover:bg-slate-800/40 hover:scale-[1.02]"
                                            )}
                                        >
                                            <RarityIcon className={cn(
                                                "w-3 h-3 shrink-0 group-hover/rarity:scale-110 transition-transform",
                                                r === 'common' && "text-slate-300"
                                            )} />
                                            <span className="text-[10px] font-black">{rarityStyles[r].label.replace('賞', '')}</span>
                                            <span className="font-black text-xs">{detail.count}</span>
                                        </button>
                                    );
                                })}
                            </div>

                    {/* 剩餘進度條 (香檳金卡包流光風格) */}
                    <div className="mt-2 pt-2 border-t border-amber-500/15">
                        <div className="flex justify-between items-center text-[10px] mb-1.5 font-mono">
                            <span className={cn("font-bold flex items-center gap-1", isLastChance ? "text-amber-400" : "text-amber-200/90")}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", isLastChance ? "bg-rose-500 animate-ping" : "bg-amber-400 animate-pulse")} />
                                {isLastChance ? '🔥 搶包中' : '剩餘包數'}
                            </span>
                            <div className="flex items-center gap-1">
                                <span className={cn("font-black", isLastChance ? "text-amber-300" : "text-amber-100")}>
                                    {pool.remainingPacks}
                                </span>
                                <span className="text-slate-500">/{pool.totalPacks}</span>
                                <span className={cn(
                                    "font-black ml-1 px-1.5 py-0.2 rounded text-[9px]", 
                                    isLastChance 
                                        ? "bg-rose-950/80 text-rose-300 border border-rose-500/40" 
                                        : "bg-amber-950/80 text-amber-300 border border-amber-500/40 shadow-sm"
                                )}>
                                    {remainingPercent}%
                                </span>
                            </div>
                        </div>
                        <div className="h-2 w-full rounded-full overflow-hidden bg-black/95 border border-amber-500/25 p-[0.5px]">
                            <div 
                                className={cn(
                                    "h-full rounded-full transition-all duration-500 shadow-sm",
                                    isLastChance 
                                        ? "bg-gradient-to-r from-amber-400 via-rose-500 to-red-600 animate-pulse" 
                                        : "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
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
                                        "relative h-auto min-h-[48px] sm:min-h-[52px] py-1.5 px-1 flex flex-col items-center justify-center rounded-xl transition-all active:scale-95 overflow-hidden border group cursor-pointer shadow-md select-none",
                                        isHighlighted
                                            ? opt.isAllIn
                                                ? "bg-gradient-to-b from-amber-500/35 via-amber-950/60 to-slate-950 border-2 border-amber-400 hover:border-yellow-300 shadow-[0_0_20px_rgba(245,158,11,0.4)] hover:brightness-110"
                                                : "bg-gradient-to-b from-amber-500/25 via-amber-950/40 to-slate-950 border-2 border-amber-400 hover:border-amber-300 shadow-[0_0_18px_rgba(245,158,11,0.35)] hover:brightness-110"
                                            : "bg-gradient-to-b from-slate-900/90 via-slate-950 to-black border border-amber-500/35 hover:border-amber-400/70 hover:bg-slate-900/90 shadow-sm"
                                    )}
                                    onClick={() => handleDraw(drawCount)}
                                >
                                    {/* 按鈕頂部金屬倒角高光線 */}
                                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-300/40 to-transparent pointer-events-none" />

                                    {/* 優惠/全包極簡角標 (緊湊嵌合右上角，金屬黑金倒角) */}
                                    {opt.isAllIn ? (
                                        <span className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 font-black text-[8px] px-1.5 py-0.5 rounded-bl-md leading-none z-10 shadow-sm animate-pulse">
                                            全包
                                        </span>
                                    ) : savings > 0 ? (
                                        <span className="absolute top-0 right-0 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 font-black text-[8px] px-1.5 py-0.5 rounded-bl-md leading-none z-10 shadow-sm">
                                            省{savings >= 10000 ? `${(savings / 1000).toFixed(0)}k` : savings}
                                        </span>
                                    ) : null}

                                    {/* 抽數名稱 */}
                                    <span className={cn(
                                        "font-black text-xs sm:text-sm tracking-tight leading-tight",
                                        isHighlighted 
                                            ? "text-amber-200 drop-shadow-[0_1px_4px_rgba(245,158,11,0.4)]" 
                                            : "text-slate-100 group-hover:text-amber-100 transition-colors"
                                    )}>
                                        {label}
                                    </span>
                                    
                                    {/* 價格標示 */}
                                    <span className="flex items-center justify-center text-white font-mono font-black text-xs sm:text-sm tracking-tight mt-0.5 leading-none">
                                        <span className={cn(isHighlighted && "text-amber-100")}>{price.toLocaleString()}</span>
                                        {isPPoint ? (
                                            <PPlusIcon className="w-3.5 h-3.5 ml-0.5 shrink-0 text-amber-400" />
                                        ) : (
                                            <DiamondIcon className="w-3.5 h-3.5 ml-0.5 shrink-0 text-amber-300" />
                                        )}
                                    </span>
                                </Button>
                            )
                        })}
                    </div>
                    </div>
                )}
                </div>
                </div>

                {/* ================= 3. 卡包底部熱壓封口 (BOTTOM SOFT CRIMPED FOIL SEAL) ================= */}
                <div className="relative w-full shrink-0 z-20 pointer-events-none mt-auto rounded-b-2xl sm:rounded-b-3xl overflow-hidden">
                    {/* 底部熱壓密封板身 (圓潤柔和倒角) */}
                    <div className={cn(
                        "relative w-full px-3.5 py-1.5 bg-gradient-to-t from-slate-800/90 via-slate-850/95 to-slate-900 border-x border-b border-amber-400/30 flex items-center justify-between",
                        isLastChance && "border-amber-400/50 bg-gradient-to-t from-amber-950/60 via-slate-850 to-slate-900"
                    )}>
                        {/* 頂緣金屬熱壓摺線 */}
                        <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />

                        {/* 垂直細密柔和熱壓封口紋理 */}
                        <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(255,255,255,0.04)_0px,rgba(255,255,255,0.04)_1px,transparent_1px,transparent_5px)] pointer-events-none opacity-50" />

                        {/* 左側微型條碼 (Micro Barcode Lines) */}
                        <div className="relative z-10 flex items-center gap-[1.5px] opacity-50">
                            <span className="w-[1px] h-2.5 bg-slate-300" />
                            <span className="w-[2px] h-2.5 bg-slate-300" />
                            <span className="w-[1px] h-2.5 bg-slate-300" />
                            <span className="w-[2.5px] h-2.5 bg-slate-300" />
                            <span className="w-[1px] h-2.5 bg-slate-300" />
                            <span className="w-[1.5px] h-2.5 bg-slate-300" />
                            <span className="w-[1px] h-2.5 bg-slate-300" />
                        </div>

                        {/* 中央卡包正版官方認證印記 (Authentic Booster Stamp) */}
                        <div className="relative z-10 text-center">
                            <span className="text-[7.5px] sm:text-[8px] font-bold text-amber-300/80 tracking-[0.25em] uppercase font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
                                ✦ P+ CARDER OFFICIAL PACK ✦
                            </span>
                        </div>

                        {/* 右側防偽標識 */}
                        <div className="relative z-10 font-mono text-[7px] text-slate-400/80 font-bold tracking-wider">
                            VERIFIED
                        </div>
                    </div>

                    {/* 底部柔和微波熱壓切邊 (Soft Scalloped Wavy Foil Edge) */}
                    <div className="w-full h-2 overflow-hidden flex items-center justify-between opacity-60 pointer-events-none bg-slate-950/80 -mt-px">
                        <svg className="w-full h-2 block text-slate-800" viewBox="0 0 400 6" preserveAspectRatio="none">
                            <path 
                                d="M0,0 Q5,5 10,0 Q15,5 20,0 Q25,5 30,0 Q35,5 40,0 Q45,5 50,0 Q55,5 60,0 Q65,5 70,0 Q75,5 80,0 Q85,5 90,0 Q95,5 100,0 Q105,5 110,0 Q115,5 120,0 Q125,5 130,0 Q135,5 140,0 Q145,5 150,0 Q155,5 160,0 Q165,5 170,0 Q175,5 180,0 Q185,5 190,0 Q195,5 200,0 Q205,5 210,0 Q215,5 220,0 Q225,5 230,0 Q235,5 240,0 Q245,5 250,0 Q255,5 260,0 Q265,5 270,0 Q275,5 280,0 Q285,5 290,0 Q295,5 300,0 Q305,5 310,0 Q315,5 320,0 Q325,5 330,0 Q335,5 340,0 Q345,5 350,0 Q355,5 360,0 Q365,5 370,0 Q375,5 380,0 Q385,5 390,0 Q395,5 400,0 Z" 
                                fill="currentColor" 
                                stroke="#f59e0b" 
                                strokeWidth="0.6" 
                                strokeOpacity="0.4"
                            />
                        </svg>
                    </div>
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
