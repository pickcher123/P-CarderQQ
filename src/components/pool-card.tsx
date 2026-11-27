'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase, useDoc } from "@/firebase";
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Trophy, Clock, Zap, Star, Diamond, Layers, X, Package, Sparkles, Eye, ChevronLeft, ChevronRight, Gift, Ticket, Target, Lock, Unlock, Flame, AlertCircle, ShieldAlert, Heart, HelpCircle, ShieldCheck, TrendingUp, RefreshCw, Truck, ArrowRight } from 'lucide-react';
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
import { BlindBoxVisual } from '@/components/draw/BlindBoxVisual';
import { HYBRID_TIER_META } from '@/lib/hybrid-pool-preset';
import type { HybridTierCode } from '@/types/draw';
import { useAutoMatteImage } from '@/hooks/use-auto-matte-image';
import { BeginnerGuideDialog } from '@/components/beginner-guide-dialog';
import { PurchasePointsDialog } from '@/components/purchase-points-dialog';
import { useToast } from '@/hooks/use-toast';
import { useFavoritePools } from '@/hooks/use-favorite-pools';

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

interface CardData { id: string; name: string; imageUrl: string; backImageUrl?: string; imageHint: string; isSold?: boolean; category?: string; }
interface CardPool { id: string; name: string; description: string; price?: number; price3Draws?: number; price10Draws?: number; totalPacks?: number; remainingPacks?: number; hasProtection?: boolean; isFeatured?: boolean; currency?: 'diamond' | 'p-point'; cardRarities?: { [cardId: string]: Rarity }; cards?: { cardId: string; quantity: number }[]; pointPrizes?: { prizeId: string; points: number; quantity: number; rarity: Rarity; name?: string; tierCode?: 'C' | 'D' }[]; lastPrizeCardId?: string; imageUrl?: string; startsAt?: { seconds: number; nanoseconds: number; }; expiresAt?: { seconds: number; nanoseconds: number; }; pointMultiplier?: number; pointMultiplierExpiresAt?: { seconds: number; nanoseconds: number; }; lockedBy?: string; lockedAt?: { seconds: number; nanoseconds: number; }; categoryId?: string; dailyLimit?: number; minLevel?: string; isAdult?: boolean; allowFreeDraw?: boolean; isEventPool?: boolean; exclusiveTicketOnly?: boolean; eventTicketName?: string; eventRules?: string; eventMaxDrawsPerUser?: number; isBlindBoxMode?: boolean; isHybridBlindSpMode?: boolean; spRevealed?: boolean; snipeAlertThreshold?: number; cardTiers?: Record<string, HybridTierCode>; cardCosts?: Record<string, number>; cardCertNumbers?: Record<string, string>; spBuybackPoints?: Record<string, number>; }
const LOCK_DURATION = 120;

export function PoolCard({ pool, allCardsMap, userProfile, categoryName }: { pool: CardPool, allCardsMap: Map<string, CardData>, userProfile: any, categoryName?: string }) {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const router = useRouter();
    const { toast } = useToast();
    const [isPurchaseDialogOpen, setIsPurchaseDialogOpen] = useState(false);
    const { isFavorite, toggleFavorite } = useFavoritePools(userProfile?.favoritePoolIds);
    const isPoolTracked = isFavorite(pool.id);

    // 主題分類識別（籃球 / 棒球 / 足球 / 寶可夢 / 其他）
    const poolCategoryBadge = useMemo(() => {
        type CatKey = 'basketball' | 'baseball' | 'soccer' | 'pokemon' | 'other';
        const matchKey = (raw?: string | null): CatKey | null => {
            if (!raw) return null;
            const s = raw.toLowerCase();
            if (/籃球|nba|basketball|wnba|hoops/.test(s)) return 'basketball';
            if (/棒球|mlb|baseball|bowman|topps|cpbl|npb/.test(s)) return 'baseball';
            if (/足球|soccer|football|fifa|uefa|premier league|laliga|world cup/.test(s)) return 'soccer';
            if (/寶可夢|pokemon|pokémon|ptcg|tcg|皮卡丘|遊戲王|航海王|one piece|yugioh/.test(s)) return 'pokemon';
            if (/其他|綜合|精選|收藏|other|misc|娛樂|動漫/.test(s)) return 'other';
            return null;
        };

        let key: CatKey | null = matchKey(categoryName) ?? matchKey(pool.categoryId) ?? matchKey(pool.name);

        // 若分類名稱/ID/卡池名未命中，從卡池內卡片的 category 或卡名多數決自動推斷
        if (!key && Array.isArray(pool.cards) && pool.cards.length > 0) {
            const counts: Record<CatKey, number> = { basketball: 0, baseball: 0, soccer: 0, pokemon: 0, other: 0 };
            for (const c of pool.cards) {
                const card = allCardsMap.get(c.cardId);
                if (!card) continue;
                const k = matchKey(card.category) ?? matchKey(card.name);
                if (k && k !== 'other') {
                    counts[k] += Math.max(1, c.quantity || 1);
                }
            }
            const best = (Object.entries(counts) as [CatKey, number][])
                .filter(([k]) => k !== 'other')
                .sort((a, b) => b[1] - a[1])[0];
            if (best && best[1] > 0) {
                key = best[0];
            }
        }

        const resolvedKey: CatKey = key ?? 'other';
        const customLabel = categoryName?.trim();

        switch (resolvedKey) {
            case 'basketball':
                return {
                    icon: '🏀',
                    label: '籃球卡池',
                    badgeClass: 'border-orange-400/45 text-orange-200 shadow-[0_0_10px_rgba(251,146,60,0.18)]',
                };
            case 'baseball':
                return {
                    icon: '⚾',
                    label: '棒球卡池',
                    badgeClass: 'border-rose-400/45 text-rose-200 shadow-[0_0_10px_rgba(251,113,133,0.18)]',
                };
            case 'soccer':
                return {
                    icon: '⚽',
                    label: '足球卡池',
                    badgeClass: 'border-emerald-400/45 text-emerald-200 shadow-[0_0_10px_rgba(52,211,153,0.18)]',
                };
            case 'pokemon':
                return {
                    icon: '⚡',
                    label: '寶可夢',
                    badgeClass: 'border-yellow-300/50 text-yellow-200 shadow-[0_0_10px_rgba(253,224,71,0.2)]',
                };
            default:
                return {
                    icon: '✨',
                    label: customLabel && customLabel !== '其他' ? customLabel : '其他精選',
                    badgeClass: 'border-amber-300/40 text-amber-200 shadow-[0_0_10px_rgba(253,230,138,0.16)]',
                };
        }
    }, [categoryName, pool.categoryId, pool.name, pool.cards, allCardsMap]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [previewCard, setPreviewCard] = useState<any | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [isInventoryOpen, setIsInventoryOpen] = useState(false);
    const [inventoryFilterRarity, setInventoryFilterRarity] = useState<Rarity | 'all'>('all');
    const [inventoryFilterTier, setInventoryFilterTier] = useState<'all' | 'A' | 'SP' | 'B' | 'C' | 'D'>('all');

    // 點擊卡池上的特定賞別（金包／黑包／銀包／銅包／星光包）開啟清冊時，保留全部獎項展示並平滑捲動至該賞位置
    useEffect(() => {
        if (!isInventoryOpen || !pool.isHybridBlindSpMode || inventoryFilterTier === 'all') return;
        const timer = setTimeout(() => {
            const targetEl = document.getElementById(`pool-${pool.id}-tier-${inventoryFilterTier}`);
            if (targetEl) {
                targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }, 80);
        return () => clearTimeout(timer);
    }, [isInventoryOpen, pool.isHybridBlindSpMode, pool.id, inventoryFilterTier]);
    const [isHybridBoardOpen, setIsHybridBoardOpen] = useState(false);
    const [isGodPackRulesOpen, setIsGodPackRulesOpen] = useState(false);
    const [hybridBoardLogs, setHybridBoardLogs] = useState<any[]>([]);
    const [isLoadingBoardLogs, setIsLoadingBoardLogs] = useState(false);
    const [isAgeVerifiedModalOpen, setIsAgeVerifiedModalOpen] = useState(false);
    const [isFreeTicketConfirmOpen, setIsFreeTicketConfirmOpen] = useState(false);

    // 任一卡池彈窗開啟時鎖定底層捲動，確保手機版彈窗始終精準置中於當前可視螢幕
    const hasPortalModalOpen = isFreeTicketConfirmOpen || isGodPackRulesOpen || isHybridBoardOpen || isInventoryOpen || Boolean(previewCard);
    useEffect(() => {
        if (!hasPortalModalOpen || typeof document === 'undefined') return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.body.style.overflow = prevOverflow;
        };
    }, [hasPortalModalOpen]);
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
        // 當卡池處於開獎保護鎖定中時，每秒即時刷新倒數並於期滿後自動解鎖；否則僅於有過期時間時每 5 秒刷新
        const hasLock = Boolean(pool.hasProtection !== false && pool.lockedAt && pool.lockedBy);
        const hasExpiry = Boolean(pool.expiresAt || pool.pointMultiplierExpiresAt);
        if (!hasLock && !hasExpiry) return;
        setCurrentTime(new Date());
        const timer = setInterval(() => setCurrentTime(new Date()), hasLock ? 1000 : 5000);
        return () => clearInterval(timer);
    }, [pool.hasProtection, pool.lockedAt, pool.lockedBy, pool.expiresAt, pool.pointMultiplierExpiresAt]);

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

    // 安全數值解析：若資料庫曾被舊版序列化寫入異常物件（如 { operand }），自動由實際剩餘卡片與點數賞重算，永不崩潰
    const safeRemainingPacks = useMemo(() => {
        if (typeof pool.remainingPacks === 'number' && Number.isFinite(pool.remainingPacks)) {
            return Math.max(0, pool.remainingPacks);
        }
        const cardsSum = (pool.cards || []).reduce((sum, c) => sum + Math.max(0, Number(c?.quantity || 0)), 0);
        const pointsSum = (pool.pointPrizes || []).reduce((sum, p) => sum + Math.max(0, Number(p?.quantity || 0)), 0);
        return cardsSum + pointsSum;
    }, [pool.remainingPacks, pool.cards, pool.pointPrizes]);

    const safeTotalPacks = useMemo(() => {
        if (typeof pool.totalPacks === 'number' && Number.isFinite(pool.totalPacks) && pool.totalPacks > 0) {
            return pool.totalPacks;
        }
        return Math.max(1, safeRemainingPacks);
    }, [pool.totalPacks, safeRemainingPacks]);

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

        const isSoldOut = safeRemainingPacks <= 0;
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

        if (pool.hasProtection !== false && pool.lockedAt && pool.lockedBy) {
            const lockTime = parseSafeDate(pool.lockedAt);
            if (lockTime) {
                const rawDiff = Math.floor((currentTime.getTime() - lockTime.getTime()) / 1000);
                if (rawDiff < LOCK_DURATION) {
                    const remaining = Math.min(LOCK_DURATION, Math.max(1, LOCK_DURATION - Math.max(0, rawDiff)));
                    return {
                        status: pool.lockedBy === user?.uid ? 'locked-by-me' : 'locked',
                        disabled: pool.lockedBy !== user?.uid,
                        message: `${remaining}秒`,
                        remainingSeconds: remaining,
                    };
                }
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
    const remainingPacks = safeRemainingPacks;
    const totalPacks = safeTotalPacks;
    const remainingPercent = Math.max(0, Math.min(100, Math.round((remainingPacks / totalPacks) * 100)));
    const isLastChance = remainingPacks > 0 && remainingPercent <= 20;

    // 🎯 明池盲開 ＋ 隱藏 SP 模式即時統計
    const hybridStats = useMemo(() => {
        const counts: Record<'A' | 'SP' | 'B' | 'C' | 'D', number> = { A: 0, SP: 0, B: 0, C: 0, D: 0 };
        if (pool.isHybridBlindSpMode && remainingPacks > 0) {
            pool.cards?.forEach((c) => {
                if (!c?.cardId || c.quantity <= 0) return;
                const cardData = allCardsMap.get(c.cardId);
                if (cardData?.isSold) return;
                const tier = pool.cardTiers?.[c.cardId] || (pool.cardRarities?.[c.cardId] === 'legendary' ? 'A' : pool.cardRarities?.[c.cardId] === 'rare' ? 'B' : 'C');
                if (tier in counts) counts[tier as keyof typeof counts] += c.quantity;
            });
            pool.pointPrizes?.forEach((p) => {
                if (!p || p.quantity <= 0) return;
                const tier = p.tierCode || (p.rarity === 'rare' ? 'C' : 'D');
                if (tier in counts) counts[tier as keyof typeof counts] += p.quantity;
            });
        }
        const topSum = counts.A + counts.SP + counts.B;
        const doubleHitRatePct = remainingPacks > 0 ? (topSum / remainingPacks) * 100 : 0;
        const snipeThreshold = pool.snipeAlertThreshold ?? 15;
        const isSnipeAlert = Boolean(
            pool.isHybridBlindSpMode &&
            remainingPacks > 0 &&
            remainingPacks <= snipeThreshold &&
            (counts.A + counts.SP) > 0
        );
        return { counts, doubleHitRatePct, isSnipeAlert };
    }, [pool, allCardsMap, remainingPacks]);

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
                if (pool.isHybridBlindSpMode && !pool.spRevealed && pool.cardTiers?.[c.cardId] === 'SP') {
                    addedCardIds.add(c.cardId);
                    continue;
                }

                const data = allCardsMap.get(c.cardId);
                if (data) {
                    const rarity = pool.cardRarities?.[c.cardId] || (data as any).rarity || 'common';
                    const cardVal = pool.cardCosts?.[c.cardId] ?? (data as any).sellPrice ?? (data as any).estimatedValue ?? (data as any).price ?? (data as any).points ?? (data as any).value ?? 0;
                    
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
                if (pool.isHybridBlindSpMode && !pool.spRevealed && pool.cardTiers?.[id] === 'SP') {
                    addedCardIds.add(id);
                    return;
                }
                const data = allCardsMap.get(id);
                const qty = pool.cards?.filter(c => c.cardId === id).reduce((acc, c) => acc + (c.quantity || 0), 0) || 0;
                if (data) {
                    const cardVal = pool.cardCosts?.[id] ?? (data as any).sellPrice ?? (data as any).estimatedValue ?? (data as any).price ?? (data as any).points ?? (data as any).value ?? 0;
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
            // 最貴的卡片永遠優先顯示（依卡片價值由高到低排序）
            const valA = Number(a.cardVal) || 0;
            const valB = Number(b.cardVal) || 0;
            if (valB !== valA) {
                return valB - valA;
            }
            // 同價位時有庫存優先
            const aHasStock = (a.quantity || 0) > 0 ? 1 : 0;
            const bHasStock = (b.quantity || 0) > 0 ? 1 : 0;
            if (bHasStock !== aHasStock) {
                return bHasStock - aHasStock;
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
                        type: 'card',
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
                    type: 'points',
                    tierCode: p.tierCode,
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

    const [isReleasingLock, setIsReleasingLock] = useState(false);

    const handleReleaseMyLock = async () => {
        if (!firestore || !user || pool.lockedBy !== user.uid || isReleasingLock) return;
        setIsReleasingLock(true);
        try {
            await updateDoc(doc(firestore, 'cardPools', pool.id), {
                lockedBy: null,
                lockedAt: null,
            });
            toast({
                title: '已解除開獎保護',
                description: '其他玩家現在可以立即抽取此卡池。',
            });
        } catch (err) {
            console.warn('Release pool lock failed:', err);
        } finally {
            setIsReleasingLock(false);
        }
    };

    const handleDraw = (draws: number) => {
        if (poolStatus.disabled) {
            toast({
                variant: 'destructive',
                title: poolStatus.status === 'locked' ? '開獎保護中' : '目前無法抽卡',
                description: poolStatus.status === 'locked'
                    ? `其他玩家正在開獎保護中（剩餘 ${poolStatus.message}），請稍候再試。`
                    : (poolStatus.message || '此卡池目前暫停抽取。'),
            });
            return;
        }
        if (draws === 1 && pool.allowFreeDraw !== false && effectiveTickets > 0) {
            setIsFreeTicketConfirmOpen(true);
            return;
        }
        // 鑽石餘額不足時直接開啟儲值彈窗，保持流暢體驗不斷流
        const isPPoint = pool.currency === 'p-point';
        const baseCost = (pool.price || 0) * draws;
        const requiredPrice = draws === 1
            ? (pool.price || 0)
            : draws === 3
                ? (pool.price3Draws || baseCost)
                : draws === 10
                    ? (pool.price10Draws || baseCost)
                    : baseCost;

        if (user && !isPPoint && requiredPrice > 0) {
            const currentDiamonds = userProfile?.points ?? 0;
            if (currentDiamonds < requiredPrice) {
                const shortfall = requiredPrice - currentDiamonds;
                toast({
                    title: '鑽石餘額不足',
                    description: `本次 ${draws} 抽需要 ${requiredPrice.toLocaleString()} 💎，尚缺 ${shortfall.toLocaleString()} 💎，已為您開啟快速儲值！`,
                });
                setIsPurchaseDialogOpen(true);
                return;
            }
        }
        executeDraw(draws, false);
    };

    const handleDrawWithTicket = () => {
        if (poolStatus.disabled) {
            toast({
                variant: 'destructive',
                title: poolStatus.status === 'locked' ? '開獎保護中' : '目前無法抽卡',
                description: poolStatus.status === 'locked'
                    ? `其他玩家正在開獎保護中（剩餘 ${poolStatus.message}），請稍候再試。`
                    : (poolStatus.message || '此卡池目前暫停抽取。'),
            });
            return;
        }
        if (effectiveTickets <= 0) {
            setIsPromoModalOpen(true);
            return;
        }
        setIsFreeTicketConfirmOpen(true);
    };

    return (
        <div className="relative font-sans text-slate-100">
            <PurchasePointsDialog
                open={isPurchaseDialogOpen}
                onOpenChange={setIsPurchaseDialogOpen}
            />
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

            {/* 🎟️ 免費抽卡券使用確認視窗 (透過 Portal 掛載至 body，確保手機版永遠置中於當前螢幕) */}
            {isFreeTicketConfirmOpen && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 h-[100dvh] w-screen z-[100] flex items-center justify-center p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] bg-black/80 backdrop-blur-md animate-in fade-in-0 duration-200"
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
                </div>,
                document.body
            )}
            
            <div className={cn(
                "relative w-full flex flex-col justify-between transition-[transform,border-color,box-shadow] duration-300 group hover:-translate-y-1 select-none overflow-hidden bg-[#0a0f1c]",
                "shadow-[0_20px_52px_rgba(0,0,0,0.85),0_0_24px_rgba(253,230,138,0.12)] hover:shadow-[0_26px_60px_rgba(0,0,0,0.92),0_0_32px_rgba(253,230,138,0.22)] rounded-2xl sm:rounded-3xl border border-amber-300/35 hover:border-amber-300/70"
            )}>
                {/* ================= 1. 頂部精品光線邊條與標題列 ================= */}
                <div className="relative w-full shrink-0 z-20 pointer-events-none">
                    {/* 頂部香檳金光線邊條 */}
                    <div className="w-full h-[2px] bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />

                    {/* 頂部曜石玻璃列（左上角運動／主題圖示圓章＋置中卡池模式印記＋右上角追蹤愛心） */}
                    <div className={cn(
                        "relative w-full px-3.5 sm:px-4 py-2.5 bg-gradient-to-b from-white/[0.05] via-[#0d1322]/90 to-[#0a0f1c] grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-white/[0.08]",
                        isLastChance && "from-amber-400/[0.14] via-[#131726]/95 to-[#0a0f1c] border-amber-300/25"
                    )}>
                        {/* 左上角：純圖示主題圓章（籃球／棒球／足球／寶可夢／其他，不留文字） */}
                        <div className="relative z-10 justify-self-start flex items-center">
                            <div
                                className={cn(
                                    "w-6 h-6 rounded-full bg-[#0a0f1c]/95 border flex items-center justify-center",
                                    poolCategoryBadge.badgeClass
                                )}
                                title={poolCategoryBadge.label}
                                aria-label={poolCategoryBadge.label}
                            >
                                <span className="text-xs leading-none" aria-hidden="true">{poolCategoryBadge.icon}</span>
                            </div>
                        </div>

                        <div className="relative z-10 justify-self-center text-center whitespace-nowrap">
                            <span className="text-[9.5px] sm:text-[10px] font-black text-[#FDE68A] tracking-[0.22em] uppercase font-mono drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]">
                                {pool.isHybridBlindSpMode
                                    ? '✦ GODPACK 一番賞 ✦'
                                    : pool.isBlindBoxMode
                                    ? '✦ 神秘盲盒模式 ✦'
                                    : '✦ P+ CARDER OFFICIAL PACK ✦'}
                            </span>
                        </div>

                        <div className="relative z-10 justify-self-end flex items-center gap-1.5 pointer-events-auto">
                            {pool.isHybridBlindSpMode && (
                                <button
                                    type="button"
                                    title="God Pack 一番賞 玩法說明"
                                    aria-label="God Pack 一番賞 玩法說明"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsGodPackRulesOpen(true);
                                    }}
                                    className="w-6 h-6 rounded-full flex items-center justify-center border bg-[#0a0f1c]/95 hover:bg-amber-400/15 border-amber-300/30 hover:border-amber-300/70 text-[#FDE68A]/85 hover:text-[#FDE68A] transition-[background-color,border-color,color,transform] duration-150 active:scale-95 cursor-pointer"
                                >
                                    <HelpCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                            <button
                                type="button"
                                title={isPoolTracked ? '已追蹤此卡池（點擊取消）' : '追蹤此卡池'}
                                aria-label={isPoolTracked ? '取消追蹤此卡池' : '追蹤此卡池'}
                                onClick={(e) => {
                                    e.stopPropagation();
                                    const added = toggleFavorite(pool.id);
                                    toast({
                                        title: added ? '❤️ 已加入我的追蹤' : '已取消追蹤',
                                        description: added
                                            ? `「${pool.name}」進入尾盤時將於列表頂部提醒您！`
                                            : `已從我的追蹤移除「${pool.name}」`,
                                    });
                                }}
                                className={cn(
                                    "w-6 h-6 rounded-full flex items-center justify-center border transition-[background-color,border-color,color,transform] duration-150 active:scale-95 cursor-pointer",
                                    isPoolTracked
                                        ? "bg-rose-500/25 border-rose-400/60 text-rose-300 shadow-[0_0_10px_rgba(244,63,94,0.35)]"
                                        : "bg-[#0a0f1c]/95 hover:bg-rose-500/15 border-white/15 hover:border-rose-400/45 text-slate-300 hover:text-rose-200"
                                )}
                            >
                                <Heart className={cn("w-3 h-3", isPoolTracked ? "fill-rose-400 text-rose-400" : "text-slate-300")} />
                            </button>
                        </div>

                        {/* 頂部密封條下緣柔和微折線 */}
                        <div className="absolute bottom-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
                    </div>
                </div>

                {/* ================= 2. 卡包袋身主體 (BOOSTER PACK MAIN BODY) ================= */}
                <div className={cn(
                    "relative w-full bg-[#0a0f1c] p-3 sm:p-5 flex flex-col justify-between transition-[border-color,box-shadow] duration-300 overflow-hidden",
                    isLastChance && "shadow-[inset_0_0_28px_rgba(245,158,11,0.12)]"
                )}>
                    {/* 卡包左右兩側溫潤柔和高光 (Soft Metallic Cushion Highlights) */}
                    <div className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-r from-white/10 via-amber-300/15 to-transparent pointer-events-none z-10" />
                    <div className="absolute inset-y-0 right-0 w-1.5 bg-gradient-to-l from-white/10 via-amber-300/15 to-transparent pointer-events-none z-10" />

                    {/* 鋁箔斜向反光流光 (Holographic Foil Sheen on Hover) */}
                    <div className="absolute -inset-full bg-gradient-to-tr from-transparent via-white/10 to-transparent rotate-12 pointer-events-none -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out z-10" />

                    {/* 🌟 卡包一體化背景系統 (深黑曜石拉絲鋁箔、菱形光柵折射、卡片專屬聚光台與卡包立體摺痕) */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
                        {/* 1. 底層：深黑曜石拉絲金屬鋁箔基底 (Obsidian Brushed Foil Base) */}
                        <div className="absolute inset-0 bg-gradient-to-b from-[#0a0f1c] via-[#0d1424] to-[#070a12]" />

                        {/* 2. 實體卡包斜向拉絲金屬微紋理 (Sleek Diagonal Brushed Foil Micro-Pattern) */}
                        <div 
                            className="absolute inset-0 opacity-[0.45] group-hover:opacity-[0.65] transition-opacity duration-700"
                            style={{
                                backgroundImage: `repeating-linear-gradient(135deg, rgba(253, 230, 138, 0.03) 0px, rgba(253, 230, 138, 0.03) 1px, transparent 1px, transparent 12px)`
                            }}
                        />

                        {/* 3. 卡包中央大獎卡專屬展台聚光光錐 (Center Spotlight Flare) */}
                        <div 
                            className={cn(
                                "absolute top-[18%] left-1/2 -translate-x-1/2 w-[280px] sm:w-[320px] h-[280px] rounded-full blur-2xl pointer-events-none transition-opacity duration-700",
                                isLastChance 
                                    ? "bg-[radial-gradient(circle,rgba(244,63,94,0.3)_0%,rgba(245,158,11,0.25)_40%,transparent_70%)] animate-pulse" 
                                    : "bg-[radial-gradient(circle,rgba(245,158,11,0.22)_0%,rgba(251,191,36,0.12)_35%,rgba(6,182,212,0.06)_55%,transparent_72%)]"
                            )} 
                        />

                        {/* 3.5. 🌟 背景 P+Carder 典藏卡包立體文字 LOGO 浮水印 (使用者指定紅圈位置：中下段橫跨卡片腰部，精緻縮小) */}
                        <div className="absolute top-[45%] -translate-y-1/2 inset-x-0 flex flex-col items-center justify-center pointer-events-none select-none z-[1] opacity-[0.20] group-hover:opacity-[0.30] transition-opacity duration-700">
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
                        "absolute top-0 left-0 w-full h-[2px] z-10 transition-opacity duration-500",
                        isLastChance 
                            ? "bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500 animate-pulse" 
                            : "bg-gradient-to-r from-transparent via-amber-400/70 to-transparent"
                    )}></div>

                {/* 內部核心內容 (提升至 z-10 確保文字與互動按鈕清晰) */}
                <div className="relative z-10 flex flex-col justify-between flex-1 w-full">
                {/* 📌 卡池標題與完整即時狀態 (讓客人第一時間清楚掌握卡池目前狀態) */}
                <div className="mb-2.5 sm:mb-3 text-center">
                    {/* 頂部關鍵狀態指示徽章（精簡瘦身：尾盤提示改整合至下方抽數列，避免重複擠壓） */}
                    <div className="flex items-center justify-center gap-1.5 mb-1.5 empty:mb-0 flex-wrap px-1">
                        {/* 1. 核心營運與保護鎖定狀態 */}
                        {poolStatus.status === 'sold-out' ? (
                            <Badge className="bg-rose-950/90 text-rose-300 border border-rose-500/50 font-black text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                <span>已全數售罄</span>
                            </Badge>
                        ) : poolStatus.status === 'locked' ? (
                            <Badge className="bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border-0 font-black text-[10px] sm:text-[11px] px-3 py-0.5 rounded-full shadow-[0_4px_14px_rgba(253,230,138,0.3)] flex items-center gap-1.5 tabular-nums">
                                <Lock className="w-3 h-3 text-[#120d02]" />
                                <span>有人抽卡中 · 剩餘 {poolStatus.message}</span>
                            </Badge>
                        ) : poolStatus.status === 'locked-by-me' ? (
                            <Badge className="bg-emerald-950/90 text-emerald-300 border border-emerald-400/50 font-black text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 tabular-nums">
                                <Unlock className="w-3 h-3 text-emerald-400" />
                                <span>您保護中 · 剩餘 {poolStatus.message}</span>
                            </Badge>
                        ) : poolStatus.status === 'not-started' ? (
                            <Badge className="bg-white/[0.06] text-slate-200 border border-white/[0.15] font-bold text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full shadow-sm flex items-center gap-1.5 tabular-nums">
                                <Clock className="w-3 h-3 text-[#FDE68A]" />
                                <span>{poolStatus.message}</span>
                            </Badge>
                        ) : poolStatus.status === 'expired' ? (
                            <Badge className="bg-white/[0.04] text-slate-400 border border-white/[0.1] font-bold text-[10px] sm:text-[11px] px-2.5 py-0.5 rounded-full">
                                <span>卡池已結束</span>
                            </Badge>
                        ) : null}

                        {/* 2. 頭獎在席即時狀況（盲盒與 GodPack 一番賞不透露個別卡片是否已開出） */}
                        {pool.isHybridBlindSpMode ? null : pool.isBlindBoxMode ? (
                            <Badge className="bg-amber-400/15 text-[#FDE68A] border border-amber-300/40 font-bold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1">
                                <Sparkles className="w-3 h-3 text-[#FDE68A]" />
                                <span>神秘盲盒</span>
                            </Badge>
                        ) : legendaryRemainingCount > 0 ? (
                            <Badge className="bg-amber-400/15 text-[#FDE68A] border border-amber-300/40 font-bold text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 tabular-nums">
                                <Trophy className="w-3 h-3 text-[#FDE68A]" />
                                <span>頭獎在席 (剩 {legendaryRemainingCount})</span>
                            </Badge>
                        ) : (pool.remainingPacks ?? 0) > 0 ? (
                            <Badge className="bg-white/[0.04] text-slate-400 border border-white/[0.1] text-[10px] px-2.5 py-0.5 rounded-full">
                                <span>頭獎已開出</span>
                            </Badge>
                        ) : null}

                        {/* 3. 點數加倍活動 */}
                        {isMultiplierActive && (
                            <Badge className="bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border-0 font-black text-[10px] px-2.5 py-0.5 rounded-full flex items-center gap-1 tabular-nums">
                                <Zap className="w-3 h-3 fill-[#120d02]" />
                                <span>點數 {pool.pointMultiplier} 倍加碼</span>
                            </Badge>
                        )}

                        {/* 4. 年齡/活動規則標籤 */}
                        {Boolean(pool.isAdult) && (
                            <span className="bg-rose-950/80 text-rose-300 border border-rose-500/40 font-bold text-[10px] px-2 py-0.5 rounded-full">
                                18+
                            </span>
                        )}
                        {Boolean(pool.isEventPool) && (
                            <span className="bg-amber-400/12 text-[#FDE68A] border border-amber-300/35 font-bold text-[10px] px-2 py-0.5 rounded-full">
                                活動限定
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
                                    <span className="absolute top-[26%] left-[22%] w-1.5 h-1.5 rounded-full bg-amber-300 blur-[0.6px] opacity-75" />
                                    <span className="absolute top-[44%] right-[18%] w-1 h-1 rounded-full bg-yellow-200 blur-[0.4px] opacity-60" />
                                    <span className="absolute bottom-[20%] left-[26%] w-1.5 h-1.5 rounded-full bg-amber-400/60 blur-[0.6px] opacity-70" />
                                    <span className="absolute top-[62%] right-[24%] w-1 h-1 rounded-full bg-amber-300 blur-[0.5px] opacity-65" />
                                </div>

                                {/* 🔒 其他玩家抽卡中：高辨識度半透明遮罩＋靜態倒數進度條（不閃爍，且不影響點擊查看卡表） */}
                                {poolStatus.status === 'locked' && (
                                    <div className="absolute inset-0 z-[25] pointer-events-none bg-[#0a0f1c]/45 backdrop-blur-[1.5px] flex items-center justify-center px-4">
                                        <div className="w-full max-w-[215px] rounded-2xl bg-[#0a0f1c]/95 border border-amber-300/55 shadow-[0_14px_36px_rgba(0,0,0,0.85)] px-3.5 py-2.5 text-center space-y-1.5">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                                                <Lock className="w-3.5 h-3.5 text-[#FDE68A] shrink-0" />
                                                <span className="text-xs font-black text-white tracking-wide">其他玩家抽卡中</span>
                                            </div>
                                            <p className="text-[11px] font-bold text-slate-300 tabular-nums">
                                                保護倒數 <span className="text-[#FDE68A] font-mono font-black">{poolStatus.message}</span> 後開放
                                            </p>
                                            <div className="w-full h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 transition-[width] duration-700 ease-linear"
                                                    style={{
                                                        width: `${Math.max(2, Math.min(100, (((poolStatus as any).remainingSeconds || 0) / LOCK_DURATION) * 100))}%`,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* 柔和懸浮投影（微降卡位，讓實體鑑定卡更沉穩居中） */}
                                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-36 sm:w-44 pointer-events-none z-10 flex items-center justify-center">
                                    <div className="w-28 sm:w-36 h-2.5 rounded-[100%] bg-black/75 blur-[5px] animate-card-shadow" />
                                    <div className="absolute w-20 sm:w-28 h-2 rounded-[100%] bg-amber-300/15 blur-[6px] animate-card-shadow" />
                                </div>

                                {/* 🎴 主卡牌本體 (純淨懸浮展示，位置微往下沉穩平衡) */}
                                <div className="absolute inset-x-0 top-6 bottom-1.5 sm:top-7 sm:bottom-2 flex flex-col items-center justify-end z-20 pointer-events-none">
                                    <div className="relative w-full h-full max-h-[190px] xs:max-h-[215px] sm:max-h-[245px] flex items-end justify-center animate-card-levitate transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:group-hover/card:scale-[1.04] [@media(hover:hover)_and_(pointer:fine)]:group-hover/card:-translate-y-1.5">
                                        {/* 主實體卡片 */}
                                        <div className="relative w-full h-full flex items-end justify-center">
                                            <div className="relative w-full h-full max-w-[168px] max-h-[234px] flex items-end justify-center overflow-visible">
                                                <SafeImage 
                                                    src={mattedFeaturedPrizeImage || featuredPrize.imageUrl} 
                                                    alt={featuredPrize.name} 
                                                    sizes="(max-width: 640px) 260px, 320px" 
                                                    fill 
                                                    className="object-contain object-bottom drop-shadow-[0_10px_20px_rgba(0,0,0,0.45)] drop-shadow-[0_0_12px_rgba(245,158,11,0.25)] relative z-10" 
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                {/* 左上角：僅在展示最後賞時顯示最後賞角標（愛心追蹤已移至頂部封口右上角） */}
                                {featuredPrize.isLastPrize && (
                                    <div className="absolute top-2 left-2 z-40 flex items-center">
                                        <span className="bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black text-[9px] px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider flex items-center gap-0.5">
                                            <Star className="w-2.5 h-2.5 fill-[#120d02]" />
                                            <span>最後賞</span>
                                        </span>
                                    </div>
                                )}

                                {/* 右上角：GodPack 一番賞進入尾盤時顯示「尾盤狙擊／搶包衝刺」徽章；非一番賞池顯示「查看卡表」按鈕 */}
                                {pool.isHybridBlindSpMode ? (
                                    (hybridStats.isSnipeAlert || isLastChance) && (
                                        <div className="absolute top-2.5 right-2.5 z-40 pointer-events-none">
                                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gradient-to-r from-[#FDE68A] via-amber-300 to-rose-400 text-[#120d02] font-black text-[10px] tracking-wide shadow-[0_4px_14px_rgba(244,63,94,0.35)] ring-1 ring-white/25">
                                                <Flame className="w-3 h-3 fill-[#120d02]" />
                                                <span>{hybridStats.isSnipeAlert ? '尾盤狙擊' : '搶包衝刺'}</span>
                                            </span>
                                        </div>
                                    )
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setInventoryFilterRarity('all');
                                            setIsInventoryOpen(true);
                                        }}
                                        className="absolute top-2 right-2 z-40 flex items-center gap-1 px-2.5 py-1 rounded-full bg-black/70 hover:bg-amber-400/20 border border-white/15 hover:border-amber-300/50 text-[10px] font-bold text-slate-200 hover:text-[#FDE68A] backdrop-blur-md transition-colors cursor-pointer"
                                    >
                                        <Eye className="w-3 h-3 text-amber-300" />
                                        <span>查看卡表</span>
                                    </button>
                                )}

                                {/* 左右切換大賞卡箭頭 (當有多張展示卡時顯示，z-40 確保不被完售遮罩擋住) */}
                                {topPrizesPreview.length > 1 && (
                                    <>
                                        <button
                                            type="button"
                                            aria-label="上一張展示卡"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedPrizeIndex((prev) => (prev - 1 + topPrizesPreview.length) % topPrizesPreview.length);
                                            }}
                                            className="absolute left-2 top-1/2 -translate-y-1/2 z-40 w-8 h-8 rounded-full bg-[#0a0f1c]/85 hover:bg-amber-400/20 border border-amber-300/35 hover:border-amber-300/75 text-[#FDE68A] flex items-center justify-center backdrop-blur-md shadow-lg transition-[transform,background-color,border-color] cursor-pointer active:scale-95"
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        <button
                                            type="button"
                                            aria-label="下一張展示卡"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedPrizeIndex((prev) => (prev + 1) % topPrizesPreview.length);
                                            }}
                                            className="absolute right-2 top-1/2 -translate-y-1/2 z-40 w-8 h-8 rounded-full bg-[#0a0f1c]/85 hover:bg-amber-400/20 border border-amber-300/35 hover:border-amber-300/75 text-[#FDE68A] flex items-center justify-center backdrop-blur-md shadow-lg transition-[transform,background-color,border-color] cursor-pointer active:scale-95"
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </>
                                )}

                                {/* 完售遮罩 (盲盒與 GodPack 一番賞不顯示個別卡片已抽出狀態，只看卡包剩餘數量) */}
                                {!pool.isBlindBoxMode && !pool.isHybridBlindSpMode && featuredPrize.quantity <= 0 && !featuredPrize.isPoolCover && (
                                    <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px] flex items-center justify-center z-30 pointer-events-none">
                                        <span className="px-3.5 py-1.5 rounded-xl bg-[#0a0f1c]/90 border border-rose-400/60 text-rose-300 font-black text-xs tracking-wider shadow-[0_8px_24px_rgba(0,0,0,0.75)]">
                                            已抽出
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* 展台下方：僅保留極簡切換指示點 */}
                            {topPrizesPreview.length > 1 && (
                                <div className="w-full mt-2 flex items-center justify-center gap-1.5">
                                    {topPrizesPreview.slice(0, 6).map((_, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            aria-label={`檢視第 ${idx + 1} 張卡片`}
                                            onClick={() => setSelectedPrizeIndex(idx)}
                                            className={cn(
                                                "h-1.5 rounded-full transition-all cursor-pointer",
                                                selectedPrizeIndex === idx
                                                    ? "w-4 bg-[#FDE68A]"
                                                    : "w-1.5 bg-white/20 hover:bg-white/40"
                                            )}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })()}

                        {/* 📊 賞別微統計與剩餘進度條（支援 Blez 盲盒 / 明池盲開＋隱藏 SP 透明儀表板 / 一般模式） */}
                        {pool.isHybridBlindSpMode ? (
                            <div className="mb-2.5 bg-white/[0.03] backdrop-blur-xl rounded-xl border border-amber-300/35 p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] space-y-2">
                                <div className="flex items-center justify-between gap-2 text-[11px]">
                                    <span className="font-black text-[#FDE68A] flex items-center gap-1.5">
                                        <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                                        翻倍大獎率 <span className="font-mono tabular-nums">{hybridStats.doubleHitRatePct.toFixed(1)}%</span>
                                    </span>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            setIsHybridBoardOpen(true);
                                            setIsLoadingBoardLogs(true);
                                            try {
                                                const res = await fetch(`/api/pools/${pool.id}`);
                                                if (res.ok) {
                                                    const json = await res.json();
                                                    setHybridBoardLogs(Array.isArray(json.drawLogs) ? json.drawLogs : []);
                                                }
                                            } catch {
                                                // ignore
                                            } finally {
                                                setIsLoadingBoardLogs(false);
                                            }
                                        }}
                                        className="text-[10px] font-bold text-[#FDE68A] hover:text-amber-200 flex items-center gap-1 cursor-pointer"
                                    >
                                        <Eye className="w-3 h-3 text-amber-300" />
                                        看盤明細
                                    </button>
                                </div>
                                <div className="grid grid-cols-5 gap-1 text-center font-mono text-[10px]">
                                    {(['A', 'SP', 'B', 'C', 'D'] as const).map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => {
                                                setInventoryFilterTier(t);
                                                setIsInventoryOpen(true);
                                            }}
                                            title={`點擊查看 ${HYBRID_TIER_META[t].label} 卡表`}
                                            className={cn(
                                                'rounded-lg py-1 px-0.5 border cursor-pointer transition-[transform,border-color,background-color] duration-150 active:scale-[0.96]',
                                                t === 'A'
                                                    ? 'bg-amber-400/15 hover:bg-amber-400/25 border-amber-300/45 hover:border-amber-300/80 text-[#FDE68A]'
                                                    : t === 'SP'
                                                      ? 'bg-black/60 hover:bg-black/80 border-amber-300/60 hover:border-amber-300 text-[#FDE68A]'
                                                      : t === 'B'
                                                        ? 'bg-slate-200/10 hover:bg-slate-200/20 border-slate-300/35 hover:border-slate-200/70 text-slate-100'
                                                        : t === 'C'
                                                          ? 'bg-amber-800/25 hover:bg-amber-800/40 border-amber-600/40 hover:border-amber-500/75 text-amber-200'
                                                          : 'bg-white/[0.04] hover:bg-white/[0.1] border-white/15 hover:border-white/35 text-slate-300'
                                            )}
                                        >
                                            <div className="font-black leading-none">{HYBRID_TIER_META[t].boxName}</div>
                                            <div className="font-black text-xs tabular-nums mt-0.5">{hybridStats.counts[t]}</div>
                                        </button>
                                    ))}
                                </div>
                                <div className="pt-2 border-t border-white/[0.06] space-y-1.5">
                                    <div className="flex justify-between items-center text-[10px] font-mono gap-2">
                                        <span className="text-slate-400 font-semibold">剩餘總抽數</span>
                                        <span className="font-black text-[#FDE68A] tabular-nums shrink-0">
                                            {remainingPacks} <span className="text-slate-500 font-semibold">/ {totalPacks} 抽</span>
                                        </span>
                                    </div>
                                    <div className="relative h-1.5 w-full rounded-full overflow-hidden bg-black/60 border border-white/[0.08]">
                                        <div
                                            className={cn(
                                                "h-full rounded-full transition-[width] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]",
                                                (hybridStats.isSnipeAlert || isLastChance)
                                                    ? "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.45)]"
                                                    : "bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-500 shadow-[0_0_8px_rgba(253,230,138,0.4)]"
                                            )}
                                            style={{ width: `${Math.max(remainingPacks > 0 ? 4 : 0, Math.min(100, remainingPercent))}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        ) : pool.isBlindBoxMode ? (
                            <div className="mb-2.5 bg-white/[0.03] backdrop-blur-xl rounded-xl border border-amber-300/25 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 text-xs font-bold text-[#FDE68A]">
                                        <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                        <span>盲盒神秘池</span>
                                    </div>
                                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                                        不公開即時機率與大獎開出狀態
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setInventoryFilterRarity('all');
                                        setIsInventoryOpen(true);
                                    }}
                                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.05] hover:bg-amber-400/15 border border-white/[0.1] hover:border-amber-300/45 text-[11px] font-bold text-slate-200 hover:text-[#FDE68A] transition-colors shrink-0 cursor-pointer flex items-center gap-1"
                                >
                                    <Eye className="w-3 h-3 text-amber-300" />
                                    <span>主打陣容</span>
                                </button>
                            </div>
                        ) : (
                        <div className="mb-2.5 bg-white/[0.03] backdrop-blur-xl rounded-xl border border-white/[0.08] p-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
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
                                                "flex items-center justify-center gap-1.5 py-1.5 px-1 rounded-lg border text-xs transition-[transform,border-color,background-color,opacity] duration-150 cursor-pointer group/rarity active:scale-[0.97] select-none relative overflow-hidden",
                                                isSoldOut
                                                    ? "bg-black/35 border-white/[0.05] text-slate-500 opacity-65 hover:opacity-100 hover:border-white/15"
                                                    : r === 'legendary' 
                                                    ? "bg-amber-400/[0.12] border-amber-300/45 text-[#FDE68A] font-black shadow-[0_0_12px_rgba(251,191,36,0.12)] hover:border-amber-300/75 hover:bg-amber-400/20" 
                                                    : r === 'rare' 
                                                    ? "bg-purple-400/[0.1] border-purple-400/35 text-purple-200 font-bold hover:border-purple-300/60 hover:bg-purple-400/15" 
                                                    : "bg-white/[0.05] border-white/[0.14] text-slate-200 font-bold hover:border-white/30 hover:bg-white/[0.09]"
                                            )}
                                        >
                                            <RarityIcon className={cn(
                                                "w-3 h-3 shrink-0 group-hover/rarity:scale-110 transition-transform",
                                                r === 'common' && "text-slate-300"
                                            )} />
                                            <span className="text-[10px] font-black">{rarityStyles[r].label.replace('賞', '')}</span>
                                            <span className="font-black text-xs tabular-nums">{detail.count}</span>
                                        </button>
                                    );
                                })}
                            </div>

                    {/* 剩餘進度條 (香檳金流光風格) */}
                    <div className="mt-2.5 pt-2 border-t border-white/[0.06]">
                        <div className="flex justify-between items-center text-[10px] mb-1.5 font-mono">
                            <span className={cn("font-bold flex items-center gap-1.5", isLastChance ? "text-rose-300" : "text-slate-300")}>
                                <span className={cn("w-1.5 h-1.5 rounded-full", isLastChance ? "bg-rose-500 animate-ping" : "bg-[#FDE68A] animate-pulse")} />
                                {isLastChance ? '搶包倒數中' : '剩餘包數'}
                            </span>
                            <div className="flex items-center gap-1 tabular-nums">
                                <span className={cn("font-black", isLastChance ? "text-rose-300" : "text-[#FDE68A]")}>
                                    {remainingPacks}
                                </span>
                                <span className="text-slate-500">/ {pool.totalPacks}</span>
                                <span className={cn(
                                    "font-black ml-1 px-1.5 py-0.5 rounded-md text-[9px]", 
                                    isLastChance 
                                        ? "bg-rose-500/20 text-rose-300 border border-rose-400/40" 
                                        : "bg-amber-400/10 text-[#FDE68A] border border-amber-300/30"
                                )}>
                                    {remainingPercent}%
                                </span>
                            </div>
                        </div>
                        <div className="h-2 w-full rounded-full overflow-hidden bg-black/60 border border-white/[0.08] p-[1px]">
                            <div 
                                className={cn(
                                    "h-full w-full rounded-full origin-left transition-transform duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] will-change-transform",
                                    isLastChance 
                                        ? "bg-gradient-to-r from-amber-400 via-rose-500 to-red-500 animate-pulse" 
                                        : "bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-500 shadow-[0_0_8px_rgba(251,191,36,0.45)]"
                                )}
                                style={{ transform: `scaleX(${Math.max(0, Math.min(100, remainingPercent)) / 100})` }}
                            />
                        </div>
                    </div>
                </div>
                        )}

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

                {/* 📢 卡池即時狀態說明提示條 (當卡池處於保護、售罄、尚未開放等狀態時，清晰告知客人，文字穩定不閃爍) */}
                {(poolStatus.disabled || poolStatus.status === 'locked-by-me') && poolStatus.message && (
                    <div className={cn(
                        "relative overflow-hidden mb-2 px-3 py-2 rounded-xl border text-xs font-bold text-center flex items-center justify-center gap-1.5 shadow-sm transition-[background-color,border-color,color] duration-200 tabular-nums",
                        poolStatus.status === 'sold-out' 
                            ? "bg-rose-950/70 border-rose-500/40 text-rose-300"
                            : poolStatus.status === 'locked'
                            ? "bg-[#0a0f1c]/95 border-amber-300/45 text-amber-100"
                            : poolStatus.status === 'locked-by-me'
                            ? "bg-emerald-950/70 border-emerald-500/40 text-emerald-300"
                            : poolStatus.status === 'not-started'
                            ? "bg-sky-950/70 border-sky-500/40 text-sky-300"
                            : "bg-slate-900/80 border-slate-800 text-slate-300"
                    )}>
                        {poolStatus.status === 'sold-out' ? (
                            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                        ) : poolStatus.status === 'locked' ? (
                            <Lock className="w-3.5 h-3.5 text-[#FDE68A] shrink-0" />
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
                                ? `其他玩家抽卡保護中 · 剩餘 ${poolStatus.message} 後開放`
                                : poolStatus.status === 'locked-by-me'
                                ? `您正在開獎保護中（剩餘 ${poolStatus.message}）`
                                : poolStatus.message}
                        </span>
                        {poolStatus.status === 'locked-by-me' && (
                            <button
                                type="button"
                                onClick={handleReleaseMyLock}
                                disabled={isReleasingLock}
                                className="ml-1 px-2 py-0.5 rounded-full bg-emerald-400/15 hover:bg-emerald-400/25 border border-emerald-400/40 text-[10px] font-black text-emerald-200 transition-colors disabled:opacity-50 shrink-0"
                            >
                                {isReleasingLock ? '解除中...' : '提前解除'}
                            </button>
                        )}
                        {poolStatus.status === 'locked' && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-white/[0.06]">
                                <div
                                    className="h-full bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 transition-[width] duration-700 ease-linear"
                                    style={{
                                        width: `${Math.max(2, Math.min(100, (((poolStatus as any).remainingSeconds || 0) / LOCK_DURATION) * 100))}%`,
                                    }}
                                />
                            </div>
                        )}
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
                                        "relative h-auto min-h-[52px] sm:min-h-[56px] py-2 px-1.5 flex flex-col items-center justify-center rounded-xl transition-[transform,border-color,background-color,opacity] duration-150 active:scale-[0.97] overflow-hidden border group cursor-pointer select-none",
                                        isHighlighted
                                            ? opt.isAllIn
                                                ? "bg-gradient-to-br from-[#FDE68A] via-amber-400 to-rose-400 text-[#120d02] border-amber-200/80 shadow-[0_6px_22px_rgba(244,63,94,0.28)] hover:brightness-105"
                                                : "bg-gradient-to-br from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border-amber-200/80 shadow-[0_6px_22px_rgba(251,191,36,0.28)] hover:brightness-105"
                                            : "bg-white/[0.04] hover:bg-white/[0.08] border-white/[0.12] hover:border-amber-300/45 text-white shadow-sm"
                                    )}
                                    onClick={() => handleDraw(drawCount)}
                                >
                                    {/* 按鈕頂部微高光 */}
                                    <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

                                    {/* 優惠/全包極簡角標 */}
                                    {opt.isAllIn ? (
                                        <span className="absolute top-0 right-0 bg-[#120d02]/90 text-[#FDE68A] font-black text-[8px] px-1.5 py-0.5 rounded-bl-lg leading-none z-10 border-l border-b border-amber-300/30">
                                            全包
                                        </span>
                                    ) : savings > 0 ? (
                                        <span className={cn(
                                            "absolute top-0 right-0 font-black text-[8px] px-1.5 py-0.5 rounded-bl-lg leading-none z-10",
                                            isHighlighted
                                                ? "bg-[#120d02]/85 text-[#FDE68A]"
                                                : "bg-gradient-to-r from-[#FDE68A] to-amber-400 text-[#120d02]"
                                        )}>
                                            省{savings >= 10000 ? `${(savings / 1000).toFixed(0)}k` : savings}
                                        </span>
                                    ) : null}

                                    {/* 抽數名稱 */}
                                    <span className={cn(
                                        "font-black text-xs sm:text-sm tracking-tight leading-tight",
                                        isHighlighted 
                                            ? "text-[#120d02]" 
                                            : "text-slate-100 group-hover:text-[#FDE68A] transition-colors"
                                    )}>
                                        {label}
                                    </span>
                                    
                                    {/* 價格標示 */}
                                    <span className={cn(
                                        "flex items-center justify-center font-mono font-black text-xs sm:text-sm tracking-tight mt-0.5 leading-none tabular-nums",
                                        isHighlighted ? "text-[#120d02]" : "text-amber-200"
                                    )}>
                                        <span>{price.toLocaleString()}</span>
                                        {isPPoint ? (
                                            <PPlusIcon className={cn("w-3.5 h-3.5 ml-0.5 shrink-0", isHighlighted ? "text-[#120d02]" : "text-amber-300")} />
                                        ) : (
                                            <DiamondIcon className={cn("w-3.5 h-3.5 ml-0.5 shrink-0", isHighlighted ? "text-[#120d02]" : "text-cyan-300")} />
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

                {/* ================= 3. 底部資訊列（無鋸齒平順收邊） ================= */}
                <div className="relative w-full shrink-0 z-20 pointer-events-none mt-auto">
                    <div className={cn(
                        "relative w-full min-h-[34px] px-3.5 py-2 bg-black/45 border-t border-white/[0.08] flex flex-wrap items-center justify-center gap-1.5",
                        isLastChance && "border-amber-300/25 bg-amber-950/25"
                    )}>
                        {/* 1. 限定階級 */}
                        {pool.minLevel && pool.minLevel !== '新手收藏家' && (
                            <span className="relative z-10 bg-white/[0.05] text-[#FDE68A] border border-amber-300/35 font-bold text-[10px] px-2.5 py-0.5 rounded-full whitespace-nowrap">
                                {pool.minLevel}限定
                            </span>
                        )}

                        {/* 3. 每日限抽 */}
                        {Number(pool.dailyLimit) > 0 && (
                            <span className="relative z-10 bg-white/[0.05] text-slate-200 border border-white/[0.12] font-mono font-bold text-[10px] px-2.5 py-0.5 rounded-full tabular-nums whitespace-nowrap">
                                每日限 {pool.dailyLimit} 抽
                            </span>
                        )}

                        {/* 4. 下架日期 */}
                        {pool.expiresAt && (() => {
                            try {
                                const secs = typeof (pool.expiresAt as any).seconds === 'number'
                                    ? (pool.expiresAt as any).seconds
                                    : (typeof (pool.expiresAt as any).toMillis === 'function'
                                        ? Math.floor((pool.expiresAt as any).toMillis() / 1000)
                                        : null);
                                if (!secs) return null;
                                const expDate = new Date(secs * 1000);
                                if (isNaN(expDate.getTime())) return null;
                                return (
                                    <span className="relative z-10 inline-flex items-center gap-1 bg-white/[0.04] text-slate-300 border border-white/[0.1] font-mono font-bold text-[10px] px-2.5 py-0.5 rounded-full tabular-nums whitespace-nowrap">
                                        <Clock className="w-2.5 h-2.5 text-[#FDE68A]" />
                                        {format(expDate, 'M/d')} 下架
                                    </span>
                                );
                            } catch {
                                return null;
                            }
                        })()}
                    </div>
                </div>
            </div>
            
            {/* ❓ God Pack 一番賞 玩法說明彈窗（圖像化升級版） */}
            {isGodPackRulesOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 h-[100dvh] w-screen z-[100] bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in fade-in duration-150"
                    onClick={() => setIsGodPackRulesOpen(false)}
                >
                    <div
                        role="dialog"
                        aria-modal="true"
                        aria-label="God Pack 一番賞 玩法說明"
                        className="relative w-full max-w-xl rounded-2xl bg-[#0a0f1c] border border-amber-300/40 shadow-[0_24px_64px_rgba(0,0,0,0.92)] overflow-hidden text-slate-100"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* 頂部香檳金光條與微光 */}
                        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-amber-300/80 to-transparent" />
                        <div className="pointer-events-none absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-24 rounded-full bg-amber-400/10 blur-2xl" />

                        {/* Header */}
                        <div className="relative flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-white/[0.08]">
                            <div className="flex items-center gap-2.5">
                                <span className="w-[3px] h-8 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 shrink-0" />
                                <div>
                                    <h3 className="text-sm sm:text-base font-black text-white flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4 text-[#FDE68A]" />
                                        <span>God Pack 一番賞 玩法說明</span>
                                    </h3>
                                    <p className="text-[11px] text-slate-400">五色卡包公開看盤 · 即時機率 · 專屬防搶保護</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsGodPackRulesOpen(false)}
                                className="w-8 h-8 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.08] text-slate-300 hover:text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
                                aria-label="關閉玩法說明"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-4 sm:p-5 space-y-3.5 max-h-[74dvh] overflow-y-auto text-xs text-slate-300 leading-relaxed">
                            {/* 快速流程視覺條 */}
                            <div className="grid grid-cols-[1fr_auto_1fr_auto_1fr] items-center gap-1 sm:gap-2 p-2.5 rounded-xl bg-black/40 border border-white/[0.08]">
                                <div className="flex flex-col items-center text-center gap-1">
                                    <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-300/30 flex items-center justify-center text-[#FDE68A]">
                                        <Eye className="w-4 h-4" />
                                    </div>
                                    <span className="text-[10px] sm:text-[11px] font-black text-white">1. 公開看盤</span>
                                    <span className="text-[9px] text-slate-400">剩餘大獎透明</span>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-amber-300/50 shrink-0" />
                                <div className="flex flex-col items-center text-center gap-1">
                                    <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-300/30 flex items-center justify-center text-[#FDE68A]">
                                        <Lock className="w-4 h-4" />
                                    </div>
                                    <span className="text-[10px] sm:text-[11px] font-black text-white">2. 鎖池開包</span>
                                    <span className="text-[9px] text-slate-400 tabular-nums">120s 防插隊</span>
                                </div>
                                <ArrowRight className="w-3.5 h-3.5 text-amber-300/50 shrink-0" />
                                <div className="flex flex-col items-center text-center gap-1">
                                    <div className="w-8 h-8 rounded-lg bg-amber-400/10 border border-amber-300/30 flex items-center justify-center text-[#FDE68A]">
                                        <Gift className="w-4 h-4" />
                                    </div>
                                    <span className="text-[10px] sm:text-[11px] font-black text-white">3. 出貨 / 轉點</span>
                                    <span className="text-[9px] text-slate-400">入庫自由切換</span>
                                </div>
                            </div>

                            {/* 1. 五色卡包賞別圖鑑（迷你卡包外袋視覺化） */}
                            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-3">
                                <div className="flex items-center justify-between">
                                    <p className="font-black text-[#FDE68A] text-xs flex items-center gap-1.5">
                                        <Package className="w-3.5 h-3.5" />
                                        <span>五色卡包賞別圖鑑</span>
                                    </p>
                                    <span className="text-[10px] text-slate-400">依外袋色澤揭曉驚喜層級</span>
                                </div>

                                <div className="grid grid-cols-5 gap-1.5 sm:gap-2">
                                    {[
                                        {
                                            name: '金包',
                                            tier: 'A賞頭獎',
                                            packClass: 'bg-gradient-to-b from-[#FDE68A]/30 via-amber-400/18 to-amber-900/35 border-amber-300/65 text-[#FDE68A] shadow-[0_6px_16px_rgba(245,158,11,0.18)]',
                                            notchClass: 'bg-amber-300/50',
                                            Icon: Trophy,
                                        },
                                        {
                                            name: '黑包',
                                            tier: 'SP驚喜',
                                            packClass: 'bg-gradient-to-b from-slate-800/90 via-black to-slate-950 border-amber-300/65 text-[#FDE68A] shadow-[0_6px_16px_rgba(0,0,0,0.65)]',
                                            notchClass: 'bg-amber-300/60',
                                            Icon: Sparkles,
                                        },
                                        {
                                            name: '銀包',
                                            tier: 'B賞大獎',
                                            packClass: 'bg-gradient-to-b from-slate-200/20 via-slate-400/12 to-slate-800/40 border-slate-300/45 text-slate-100',
                                            notchClass: 'bg-slate-300/45',
                                            Icon: Star,
                                        },
                                        {
                                            name: '銅包',
                                            tier: 'C賞精選',
                                            packClass: 'bg-gradient-to-b from-amber-700/35 via-amber-900/25 to-stone-950/60 border-amber-600/50 text-amber-200',
                                            notchClass: 'bg-amber-500/45',
                                            Icon: Layers,
                                        },
                                        {
                                            name: '星光包',
                                            tier: 'D賞常駐',
                                            packClass: 'bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-black/50 border-white/15 text-slate-300',
                                            notchClass: 'bg-white/25',
                                            Icon: Zap,
                                        },
                                    ].map((pack) => {
                                        const PackIcon = pack.Icon;
                                        return (
                                            <div
                                                key={pack.name}
                                                className={cn(
                                                    'relative rounded-xl border pt-2 pb-2 px-1 flex flex-col items-center text-center overflow-hidden',
                                                    pack.packClass
                                                )}
                                            >
                                                {/* 模擬卡包頂部封口線 */}
                                                <div className={cn('w-7 h-[2px] rounded-full mb-2 opacity-80', pack.notchClass)} />
                                                <div className="w-7 h-7 rounded-lg bg-black/35 border border-white/10 flex items-center justify-center mb-1.5">
                                                    <PackIcon className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="text-[11px] font-black leading-tight">{pack.name}</span>
                                                <span className="text-[9px] font-medium opacity-80 mt-0.5 leading-tight">{pack.tier}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* 2 & 3. 雙欄視覺資訊卡：翻倍大獎率 ＋ 120秒鎖池 */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {/* 卡片 2：即時看盤與翻倍大獎率 */}
                                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between gap-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-black text-white flex items-center gap-1.5">
                                            <TrendingUp className="w-3.5 h-3.5 text-[#FDE68A]" />
                                            <span>翻倍大獎率機制</span>
                                        </p>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-amber-400/15 border border-amber-300/35 text-[#FDE68A]">
                                            尾盤更甜
                                        </span>
                                    </div>

                                    {/* 迷你機率上升階梯圖 */}
                                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] flex items-end justify-between gap-2 h-[74px]">
                                        <div className="flex-1 flex flex-col items-center gap-1">
                                            <span className="text-[9px] text-slate-400 tabular-nums">100抽</span>
                                            <div className="w-full h-3 rounded-t bg-white/15" />
                                        </div>
                                        <div className="flex-1 flex flex-col items-center gap-1">
                                            <span className="text-[9px] text-amber-200/80 tabular-nums">50抽</span>
                                            <div className="w-full h-6 rounded-t bg-amber-300/40" />
                                        </div>
                                        <div className="flex-1 flex flex-col items-center gap-1">
                                            <span className="text-[9px] font-black text-[#FDE68A] tabular-nums">20抽 ↑</span>
                                            <div className="w-full h-10 rounded-t bg-gradient-to-t from-amber-500/70 to-[#FDE68A] shadow-[0_0_12px_rgba(245,158,11,0.35)]" />
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-slate-400 leading-snug">
                                        點擊「看盤明細」即時掌握剩餘獎項；大獎留在盤中越久，後續每一抽機率越高！
                                    </p>
                                </div>

                                {/* 卡片 3：120 秒專屬鎖池保護 */}
                                <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex flex-col justify-between gap-2.5">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="font-black text-white flex items-center gap-1.5">
                                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                            <span>120 秒專屬鎖池</span>
                                        </p>
                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/15 border border-emerald-400/35 text-emerald-300">
                                            自動防護
                                        </span>
                                    </div>

                                    {/* 迷你倒數保護條視覺 */}
                                    <div className="p-2.5 rounded-lg bg-black/40 border border-white/[0.06] flex flex-col justify-center gap-2 h-[74px]">
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="inline-flex items-center gap-1 text-[#FDE68A] font-bold">
                                                <Lock className="w-3 h-3" />
                                                專屬保護中
                                            </span>
                                            <span className="font-mono font-black text-white tabular-nums">120s</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-white/[0.08] overflow-hidden">
                                            <div className="h-full w-4/5 rounded-full bg-gradient-to-r from-[#FDE68A] via-amber-300 to-emerald-400" />
                                        </div>
                                        <div className="flex items-center justify-between text-[9px] text-slate-400">
                                            <span>✓ 杜絕尾盤插隊</span>
                                            <span>✓ 可提前一鍵解鎖</span>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-slate-400 leading-snug">
                                        開抽即啟動專屬倒數，安心連抽或思考是否全包，提早抽完也能手動解鎖。
                                    </p>
                                </div>
                            </div>

                            {/* 4. 尾盤全包 ＋ 雙軌自由處理（圖像化分流） */}
                            <div className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2.5">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <p className="font-black text-white flex items-center gap-1.5">
                                        <Flame className="w-3.5 h-3.5 text-rose-400" />
                                        <span>尾盤「全包」與入庫雙選擇</span>
                                    </p>
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-gradient-to-r from-amber-400/20 to-rose-500/20 border border-amber-300/35 text-[#FDE68A]">
                                        一次帶走剩餘獎項＋最後賞
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/40 border border-white/[0.08]">
                                        <div className="w-9 h-9 rounded-lg bg-amber-400/10 border border-amber-300/30 flex items-center justify-center text-[#FDE68A] shrink-0">
                                            <Truck className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-white">申請實體出貨</p>
                                            <p className="text-[10px] text-slate-400 leading-snug">存入收藏庫，隨時寄送 7-11／郵寄到府</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-black/40 border border-white/[0.08]">
                                        <div className="w-9 h-9 rounded-lg bg-cyan-400/10 border border-cyan-300/30 flex items-center justify-center text-cyan-300 shrink-0">
                                            <RefreshCw className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-[11px] font-black text-white">一鍵轉點續抽</p>
                                            <p className="text-[10px] text-slate-400 leading-snug">即時換算鑽石與紅利 P+，無縫開下一包</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-4 sm:px-5 py-3.5 bg-black/40 border-t border-white/[0.08] flex items-center justify-between gap-3">
                            <span className="text-[10px] text-slate-400 hidden sm:inline">所有實體卡皆為現貨入庫 · 開包結果公開可驗證</span>
                            <Button
                                type="button"
                                onClick={() => setIsGodPackRulesOpen(false)}
                                className="h-9 px-6 rounded-xl font-black text-xs bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] hover:brightness-105 ml-auto"
                            >
                                我了解了，開始抽卡
                            </Button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* 📊 GodPack 一番賞：即時看盤數據分析與抽卡機率彈窗 */}
            {isHybridBoardOpen && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed inset-0 h-[100dvh] w-screen z-[105] bg-black/90 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-fade-in"
                    onClick={() => setIsHybridBoardOpen(false)}
                >
                    <div
                        className="relative max-w-3xl w-full bg-[#0a0f1c] border border-white/[0.1] border-t-2 border-t-amber-300/65 rounded-2xl p-4 sm:p-6 max-h-[85dvh] overflow-y-auto shadow-[0_24px_64px_rgba(0,0,0,0.9)] text-slate-100 space-y-5"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
                            <div className="flex items-center gap-2.5">
                                <div className="w-[3px] h-7 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700" />
                                <div>
                                    <h2 className="text-base sm:text-lg font-black text-white">
                                        {pool.name} · 即時看盤數據分析
                                    </h2>
                                    <p className="text-[11px] text-slate-400">
                                        即時依剩餘抽數動態重算各色卡包抽中機率與公開開獎紀錄
                                    </p>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setIsHybridBoardOpen(false)}
                                className="rounded-full text-slate-400 hover:text-white hover:bg-white/10 h-8 w-8"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>

                        {/* 4 個核心即時分析指標 */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
                                <div className="text-[11px] text-slate-400">剩餘抽數</div>
                                <div className="text-base font-black text-white font-mono tabular-nums mt-0.5">
                                    {remainingPacks} <span className="text-xs text-slate-400 font-normal">/ {totalPacks}</span>
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/[0.03] border border-amber-300/35 p-3">
                                <div className="text-[11px] text-slate-400">翻倍大獎率 (A+SP+B)</div>
                                <div className="text-base font-black text-[#FDE68A] font-mono tabular-nums mt-0.5">
                                    {hybridStats.doubleHitRatePct.toFixed(2)}%
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
                                <div className="text-[11px] text-slate-400">頂級大獎率 (A+SP)</div>
                                <div className="text-base font-black text-emerald-400 font-mono tabular-nums mt-0.5">
                                    {remainingPacks > 0
                                        ? (((hybridStats.counts.A + hybridStats.counts.SP) / remainingPacks) * 100).toFixed(2)
                                        : '0.00'}
                                    %
                                </div>
                            </div>
                            <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
                                <div className="text-[11px] text-slate-400">包尾全包成本</div>
                                <div className="text-base font-black text-cyan-300 font-mono tabular-nums mt-0.5">
                                    {(remainingPacks * (pool.price || 0)).toLocaleString()}{' '}
                                    <span className="text-[11px]">{pool.currency === 'p-point' ? 'P' : '💎'}</span>
                                </div>
                            </div>
                        </div>

                        {/* 五色卡包即時抽中機率分佈 */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between text-xs font-black text-white">
                                <span>五色卡包即時機率分佈</span>
                                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                                    有效剩餘總包數：{remainingPacks} 包
                                </span>
                            </div>
                            <div className="space-y-2">
                                {(['A', 'SP', 'B', 'C', 'D'] as const).map((t) => {
                                    const meta = HYBRID_TIER_META[t];
                                    const count = hybridStats.counts[t];
                                    const prob = remainingPacks > 0 ? (count / remainingPacks) * 100 : 0;
                                    return (
                                        <div
                                            key={t}
                                            className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3 space-y-2"
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2.5">
                                                    <BlindBoxVisual tier={t} size="xs" />
                                                    <div>
                                                        <div className="text-xs font-black text-white">{meta.label}</div>
                                                        <div className="text-[10px] text-slate-400">
                                                            {t === 'A' || t === 'B'
                                                                ? '明池盲開（抽中後從該賞別隨機開出其一）'
                                                                : t === 'SP'
                                                                ? '隱藏黑包（抽中可實體寄送或 80% 點數回收）'
                                                                : t === 'C'
                                                                ? '標準化回血卡包'
                                                                : '標準化保底卡包'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right font-mono tabular-nums shrink-0">
                                                    <div className="text-sm font-black text-[#FDE68A]">{prob.toFixed(2)}%</div>
                                                    <div className="text-[10px] text-slate-400">剩餘 {count} 包</div>
                                                </div>
                                            </div>
                                            <div className="h-1.5 w-full rounded-full bg-black/50 overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-[#FDE68A] to-amber-400 transition-all duration-500"
                                                    style={{ width: `${Math.min(100, prob)}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 公開開獎紀錄（防作弊證明） */}
                        <div className="space-y-2">
                            <div className="text-xs font-black text-white">公開開獎紀錄（最近 20 筆）</div>
                            <div className="rounded-xl border border-white/[0.08] bg-black/40 max-h-52 overflow-y-auto divide-y divide-white/[0.06]">
                                {isLoadingBoardLogs ? (
                                    <div className="p-4 text-center text-xs text-slate-400">載入紀錄中...</div>
                                ) : hybridBoardLogs.length === 0 ? (
                                    <div className="p-4 text-center text-xs text-slate-500">目前尚無開獎紀錄，快來搶頭香！</div>
                                ) : (
                                    hybridBoardLogs.slice(0, 20).map((log: any) => (
                                        <div key={log.id} className="px-3 py-2 flex items-center justify-between gap-2 text-xs">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-300 tabular-nums">
                                                    #{log.pullNumber}
                                                </span>
                                                <span className="font-mono text-slate-300">{log.maskedUsername}</span>
                                                <Badge className="text-[10px] bg-amber-400/15 text-[#FDE68A] border-amber-300/35">
                                                    {HYBRID_TIER_META[log.tierCode as HybridTierCode]?.label || log.tierCode}
                                                </Badge>
                                            </div>
                                            <span className="text-[11px] text-slate-300 truncate max-w-[180px]">
                                                {log.prizeName}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {isInventoryOpen && typeof document !== 'undefined' && createPortal(
                <div className="fixed inset-0 h-[100dvh] w-screen z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-2 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] animate-in fade-in-0 duration-200" onClick={() => setIsInventoryOpen(false)}>
                    <div 
                        className="relative max-w-4xl w-full bg-[#080d1a]/95 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl sm:rounded-3xl p-3.5 sm:p-6 max-h-[85dvh] sm:max-h-[88dvh] overflow-y-auto shadow-[0_0_80px_rgba(6,182,212,0.35)] group/modal" 
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

                        {/* 賞別快速切換標籤列（GodPack 一番賞直接完整展示全部卡包，點選卡池上的各賞自動捲動定位） */}
                        {pool.isHybridBlindSpMode ? (
                            <div className="flex items-center justify-between gap-2 pb-2 mb-3">
                                <span className="px-3 py-1 rounded-full text-xs font-black bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border border-amber-300 shadow-sm">
                                    全部卡包完整一覽
                                </span>
                                <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                                    共 {allPrizesInPool.length} 款品項 · 剩餘 <span className="text-[#FDE68A] font-bold">{remainingPacks}</span> 包
                                </span>
                            </div>
                        ) : (
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
                                        {!pool.isBlindBoxMode && (
                                            <span className={cn("text-[10px] px-1.5 py-0.2 rounded-full font-mono ml-0.5", isSelected ? "bg-black/50 text-white" : "bg-slate-950 text-slate-400")}>
                                                {totalInRarity}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                        )}

                        {/* 內容區域 - 直接展示卡片與獎項名冊 */}
                        <div className="space-y-4 sm:space-y-5">
                            {/* 最後賞 特殊區塊 (在全部或傳說賞時展示) */}
                            {lastPrizeCard && (inventoryFilterRarity === 'all' || inventoryFilterRarity === 'legendary') && (
                                <div 
                                    className="relative overflow-hidden border-2 p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-amber-500/15 via-purple-500/10 to-slate-950 border-amber-400/60 shadow-[0_0_25px_rgba(245,158,11,0.2)] flex flex-col sm:flex-row items-center gap-3 sm:gap-5 cursor-pointer hover:scale-[1.01] transition-[transform,border-color,box-shadow] group/last"
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

                            {/* 各稀有度群組（GodPack 一番賞永遠完整展示全部五色卡包，點選各賞自動平滑捲動至對應區塊） */}
                            {pool.isHybridBlindSpMode ? (
                                (['A', 'SP', 'B', 'C', 'D'] as const).map((tierCode) => {
                                    const prizes = allPrizesInPool.filter((x: any) => {
                                        if (x.type === 'points' || x.isPoints) {
                                            const pTier = x.tierCode || (x.rarity === 'rare' ? 'C' : 'D');
                                            return pTier === tierCode;
                                        }
                                        const cTier = pool.cardTiers?.[x.id] || (x.rarity === 'legendary' ? 'A' : x.rarity === 'rare' ? 'B' : 'C');
                                        return cTier === tierCode;
                                    });
                                    if (prizes.length === 0) return null;
                                    const meta = HYBRID_TIER_META[tierCode];
                                    const totalQtyInTier = prizes.reduce((sum, p) => sum + (p.quantity || 0), 0);
                                    const isFocusedTier = inventoryFilterTier === tierCode;

                                    return (
                                        <div
                                            key={tierCode}
                                            id={`pool-${pool.id}-tier-${tierCode}`}
                                            className={cn(
                                                "space-y-2 scroll-mt-3 rounded-2xl transition-colors",
                                                isFocusedTier && "p-2.5 -mx-2.5 bg-amber-400/[0.05] ring-1 ring-amber-300/35"
                                            )}
                                        >
                                            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <BlindBoxVisual tier={tierCode} size="xs" />
                                                    <h3 className="font-black text-xs sm:text-sm tracking-wider text-[#FDE68A]">
                                                        {meta.label}
                                                    </h3>
                                                </div>
                                                <span className="text-[10px] sm:text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-0.5 rounded-full border border-slate-800">
                                                    {prizes.length} 款品項 · 剩餘 <span className="font-bold text-[#FDE68A]">{totalQtyInTier}</span> 包
                                                </span>
                                            </div>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                                {prizes.map((c: any) => {
                                                    const isMaskedSp = Boolean(!pool.spRevealed && tierCode === 'SP' && c.type !== 'points');
                                                    const spBuyback = pool.spBuybackPoints?.[c.id] ?? Math.round(Number(pool.cardCosts?.[c.id] ?? c.sellPrice ?? 0) * 0.8);

                                                    if (isMaskedSp) {
                                                        return (
                                                            <div
                                                                key={`hidden-sp-${c.id}`}
                                                                className="relative flex flex-col items-center p-2 rounded-xl border border-amber-300/55 bg-[#0a0f1c] shadow-[0_0_20px_rgba(253,230,138,0.12)]"
                                                            >
                                                                <div className="w-full aspect-[2.5/3.5] mb-1.5 rounded-lg bg-black/50 border border-amber-300/35 flex flex-col items-center justify-center p-2">
                                                                    <BlindBoxVisual tier="SP" size="md" />
                                                                </div>
                                                                <p className="text-[11px] font-black text-[#FDE68A] text-center">神秘隱藏黑包（SP 賞）</p>
                                                                <p className="text-[10px] font-mono text-slate-300 tabular-nums mt-0.5">
                                                                    保底回收 {spBuyback.toLocaleString()} 點
                                                                </p>
                                                            </div>
                                                        );
                                                    }

                                                    return (
                                                        <div
                                                            key={c.id}
                                                            className="group/item relative flex flex-col items-center p-2 rounded-xl border transition-[transform,border-color,background-color] duration-300 cursor-pointer bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-amber-300/50 hover:-translate-y-0.5"
                                                            onClick={() => setPreviewCard(c)}
                                                        >
                                                            <div className="relative w-full aspect-[2.5/3.5] mb-1.5 rounded-lg overflow-hidden border border-white/15 bg-slate-900 flex flex-col items-center justify-center">
                                                                {c.type === 'points' ? (
                                                                    <RandomPlayerCard
                                                                        rarity={c.rarity}
                                                                        points={c.points}
                                                                        title={c.name}
                                                                        showBuybackHint={false}
                                                                        className="!w-auto h-full aspect-[3/5] mx-auto !rounded-lg"
                                                                    />
                                                                ) : (
                                                                    <SafeImage src={c.imageUrl} alt={c.name} sizes="160px" fill className="object-contain p-0.5" />
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] font-bold text-slate-100 truncate w-full text-center">{c.name}</p>
                                                            {c.type === 'points' && (
                                                                <span className="text-[10px] font-mono text-[#FDE68A] mt-0.5">
                                                                    剩餘: {c.quantity} 包
                                                                </span>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })
                            ) : (
                            (inventoryFilterRarity === 'all' ? RARITIES : RARITIES.filter(r => r === inventoryFilterRarity)).map(r => { 
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
                                                {pool.isBlindBoxMode ? (
                                                    <>{prizes.length} 款品項 · <span className="text-[#FDE68A] font-bold">盲盒保密中</span></>
                                                ) : (
                                                    <>{prizes.length} 款品項 · 剩餘 <span className={cn("font-bold", style.text)}>{totalQtyInRarity}</span> 包</>
                                                )}
                                            </span>
                                        </div>

                                        {/* 該稀有度獎項列表 */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                            {prizes.map(c => {
                                                const hideSoldOut = Boolean(pool.isBlindBoxMode);
                                                const showSoldOut = !hideSoldOut && c.isSoldOut;
                                                const prizeTier = pool.isHybridBlindSpMode ? pool.cardTiers?.[c.id] : undefined;
                                                const isMaskedSp = Boolean(pool.isHybridBlindSpMode && !pool.spRevealed && prizeTier === 'SP');
                                                const spBuyback = pool.spBuybackPoints?.[c.id] ?? Math.round(Number(pool.cardCosts?.[c.id] ?? c.sellPrice ?? 0) * 0.8);

                                                if (isMaskedSp) {
                                                    return (
                                                        <div
                                                            key={`hidden-sp-${c.id}`}
                                                            className="relative flex flex-col items-center p-2 rounded-xl border border-amber-300/55 bg-[#0a0f1c] shadow-[0_0_20px_rgba(253,230,138,0.12)]"
                                                        >
                                                            <div className="w-full aspect-[2.5/3.5] mb-1.5 rounded-lg bg-black/50 border border-amber-300/35 flex flex-col items-center justify-center p-2">
                                                                <BlindBoxVisual tier="SP" size="md" />
                                                            </div>
                                                            <p className="text-[11px] font-black text-[#FDE68A] text-center">神秘隱藏黑包（SP 賞）</p>
                                                            <p className="text-[10px] font-mono text-slate-300 tabular-nums mt-0.5">
                                                                保底回收 {spBuyback.toLocaleString()} 點
                                                            </p>
                                                        </div>
                                                    );
                                                }

                                                return (
                                                <div 
                                                    key={c.id} 
                                                    className={cn(
                                                        "group/item relative flex flex-col items-center p-2 rounded-xl border transition-[transform,border-color,opacity,background-color] duration-300 cursor-pointer",
                                                        "bg-slate-900/80 hover:bg-slate-900 border-slate-800 hover:border-amber-300/50 hover:-translate-y-0.5",
                                                        showSoldOut && "opacity-50 grayscale hover:grayscale-0 hover:opacity-100"
                                                    )}
                                                    onClick={() => setPreviewCard(c)}
                                                >
                                                    {/* 卡片圖像/P+ 點數賞容器 */}
                                                    <div className={cn(
                                                        "relative w-full aspect-[2.5/3.5] mb-1.5 rounded-lg overflow-hidden border p-0.5 bg-gradient-to-b from-slate-700/80 via-slate-800/80 to-slate-900/90 shadow-[inset_0_1px_2px_rgba(255,255,255,0.2)] flex flex-col items-center justify-center",
                                                        showSoldOut ? "border-slate-800" : style.border
                                                    )}>
                                                        {c.isPoints ? (
                                                            <RandomPlayerCard 
                                                                rarity={c.rarity} 
                                                                points={c.points} 
                                                                title={c.name}
                                                                showBuybackHint={false}
                                                                className="!w-auto h-full aspect-[3/5] mx-auto rounded-md"
                                                            />
                                                        ) : (
                                                            <SafeImage src={c.imageUrl} alt={c.name} sizes="140px" fill className="object-contain rounded-md p-0.5 relative z-10 drop-shadow-[0_4px_10px_rgba(0,0,0,0.3)]" />
                                                        )}

                                                        {/* 已售罄水印印章 */}
                                                        {showSoldOut && (
                                                            <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[1px] flex items-center justify-center z-10">
                                                                <span className="px-2 py-1 bg-rose-600/90 text-white font-black text-[10px] uppercase tracking-wider rounded border border-rose-400/50 shadow-lg">
                                                                    已完售
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* 剩餘數量膠囊 Badge */}
                                                    {hideSoldOut ? (
                                                        <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/15 border border-amber-300/35 text-[#FDE68A]">
                                                            盲盒陣容
                                                        </span>
                                                    ) : !c.isSoldOut ? (
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
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* 卡片大圖預覽對話框 (典藏級高透壓克力微光展台，Portal 置中於當前螢幕最上層) */}
            {!!previewCard && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 h-[100dvh] w-screen z-[110] flex items-center justify-center p-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] bg-black/85 backdrop-blur-xl animate-in fade-in-0 duration-200 select-none" 
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
                        <div className="w-full max-w-[220px] sm:max-w-[240px] aspect-[2.5/3.5] my-1 drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)]">
                            {previewCard.isPoints ? (
                                <RandomPlayerCard 
                                    rarity={previewCard.rarity} 
                                    points={previewCard.points} 
                                    title={previewCard.name}
                                    showBuybackHint={false}
                                    className="w-full h-full aspect-[2.5/3.5] rounded-xl"
                                />
                            ) : (
                                <CardItem 
                                    name={previewCard.name} 
                                    imageUrl={previewCard.imageUrl} 
                                    backImageUrl={previewCard.backImageUrl} 
                                    imageHint={previewCard.name} 
                                    rarity={previewCard.rarity} 
                                    isFlippable={true}
                                    className="w-full h-full aspect-[2.5/3.5]"
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
                </div>,
                document.body
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
