'use client';

import { BettingGameDialog } from '@/components/betting-game-dialog';
import { PrizeWheelDialog, ClaimWonPrizeDialog, type RedemptionItem, type WonPrizeClaim } from '@/components/prize-wheel-dialog';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/safe-image';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { CrossedCardsIcon, DiamondIcon, PPlusIcon } from '@/components/icons';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { 
    Sparkles, ShoppingBag, Truck,
    Settings, Target, ShieldCheck, 
    XCircle, Search, Flame, Eye,
    Percent, Coins, Award, X, Disc3, HelpCircle, Gift
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { SystemConfig } from '@/types/system';
import type { UserProfile } from '@/types/user-profile';
import { CardItem } from '@/components/card-item';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { RevolvingDoorThemeCarousel } from '@/components/revolving-door-theme-carousel';

interface BettingCategory {
    id: string;
    name: string;
    imageUrl: string;
    order?: number;
}

interface BettingItems {
    allCardIds: string[];
    soldCardIds: string[];
}

interface CardData {
    id: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
    isFeatured?: boolean;
    isSold?: boolean;
    sellPrice?: number;
    rarity?: string;
    category?: string;
    status?: string;
}

interface CategoryWithCount extends BettingCategory {
    itemCount: number;
    totalCount: number;
}

export default function BetLandingPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const { isAdmin, isSuperAdmin } = useIsAdmin();

    const [activeSection, setActiveSection] = useState<'cards' | 'prizes'>('cards');
    const [searchTerm, setSearchTerm] = useState('');
    const [prizeSearchTerm, setPrizeSearchTerm] = useState('');
    const [filterTab, setFilterTab] = useState<'all' | 'available' | 'featured'>('all');
    const [sortOption, setSortOption] = useState<'latest' | 'price-high' | 'price-low' | 'unsold'>('latest');
    const [previewCard, setPreviewCard] = useState<CardData | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const params = new URLSearchParams(window.location.search);
            if (params.get('tab') === 'prizes') {
                setActiveSection('prizes');
            }
        }
    }, []);

    const userProfileRef = useMemoFirebase(
        () => (firestore && user) ? doc(firestore, 'users', user.uid) : null,
        [firestore, user?.uid]
    );
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    const isUserAdmin = Boolean(isAdmin || isSuperAdmin || userProfile?.role?.toLowerCase() === 'admin' || userProfile?.isAdmin === true);

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

    const categoriesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'bettingCategories'), orderBy('order', 'asc'));
    }, [firestore]);
    const { data: categories, isLoading: isLoadingCategories } = useCollection<BettingCategory>(categoriesQuery);

    const bettingItemsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]);
    const { data: allBettingItems, isLoading: isLoadingBettingItems } = useCollection<BettingItems>(bettingItemsCollectionRef);

    const allCardsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]);
    const { data: allCards, isLoading: isLoadingCards } = useCollection<CardData>(allCardsCollectionRef);

    // 讀取兌換獎品 (同時支援 P+ 直購兌換 & 命運轉盤)
    const redemptionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'redemptionItems') : null, [firestore]);
    const { data: rawRedemptionItems, isLoading: isLoadingPrizes } = useCollection<RedemptionItem>(redemptionsQuery);

    // 讀取使用者尚未填寫收件資料的轉盤中獎獎品
    const unclaimedPrizesQuery = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return query(collection(firestore, 'users', user.uid, 'wonPrizes'), where('status', '==', 'unclaimed'));
    }, [firestore, user?.uid]);
    const { data: unclaimedPrizes } = useCollection<WonPrizeClaim>(unclaimedPrizesQuery);

    const redemptionItems = useMemo(() => {
        if (!rawRedemptionItems) return [];
        let list = rawRedemptionItems
            .filter(item => item.isActive !== false)
            .sort((a, b) => (a.order || 0) - (b.order || 0));
        if (prizeSearchTerm.trim()) {
            const kw = prizeSearchTerm.toLowerCase();
            list = list.filter(item =>
                item.name?.toLowerCase().includes(kw) ||
                item.description?.toLowerCase().includes(kw)
            );
        }
        return list;
    }, [rawRedemptionItems, prizeSearchTerm]);

    const totalActivePrizeCount = useMemo(() => {
        if (!rawRedemptionItems) return 0;
        return rawRedemptionItems.filter(item => item.isActive !== false).length;
    }, [rawRedemptionItems]);

    // 建立 Card Map 快速查詢
    const cardMap = useMemo(() => {
        const map = new Map<string, CardData>();
        if (allCards) {
            allCards.forEach(c => map.set(c.id, c));
        }
        return map;
    }, [allCards]);

    // Sold Card Set: 包含 betting-items 記錄以及 allCards 中真實已售出的卡片
    const soldCardIds = useMemo(() => {
        const set = new Set<string>();
        if (allBettingItems) {
            allBettingItems.forEach(item => {
                item.soldCardIds?.forEach(id => set.add(id));
            });
        }
        if (allCards) {
            allCards.forEach(c => {
                if (c.isSold || c.status === 'sold') {
                    set.add(c.id);
                }
            });
        }
        return set;
    }, [allBettingItems, allCards]);

    // 即時計算各分類的未售出卡片數量
    const categoriesWithCounts: CategoryWithCount[] = useMemo(() => {
        if (!categories) return [];
        const sortedCategories = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        
        return sortedCategories.map(category => {
            const item = allBettingItems?.find(bi => 
                bi.id === category.id || 
                decodeURIComponent(bi.id) === category.id || 
                bi.id === category.name ||
                decodeURIComponent(bi.id) === category.name
            );
            
            const allIds = item?.allCardIds || [];
            const availableCards = allIds.filter(id => {
                const card = cardMap.get(id);
                if (!card) return false;
                if (card.isSold || card.status === 'sold') return false;
                if (soldCardIds.has(id)) return false;
                return true;
            });

            return {
                ...category,
                itemCount: availableCards.length,
                totalCount: allIds.length,
            };
        });
    }, [categories, allBettingItems, cardMap, soldCardIds]);

    // Cards in betting pool
    const cardsInBetting = useMemo(() => {
        if (!allCards || !allBettingItems) return [];
        const cardIdsInBetting = new Set<string>();
        allBettingItems.forEach(item => {
            item.allCardIds?.forEach(id => cardIdsInBetting.add(id));
        });
        
        let baseCards = allCards.filter(card => cardIdsInBetting.has(card.id));
        
        if (filterTab === 'available') {
            baseCards = baseCards.filter(c => !soldCardIds.has(c.id) && !c.isSold && c.status !== 'sold');
        } else if (filterTab === 'featured') {
            baseCards = baseCards.filter(c => c.isFeatured);
        }

        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            baseCards = baseCards.filter(c => c.name?.toLowerCase().includes(term));
        }

        return baseCards.sort((a, b) => {
            if (sortOption === 'price-high') return (b.sellPrice || 0) - (a.sellPrice || 0);
            if (sortOption === 'price-low') return (a.sellPrice || 0) - (b.sellPrice || 0);
            if (sortOption === 'unsold') {
                const aSold = soldCardIds.has(a.id) || a.isSold || a.status === 'sold';
                const bSold = soldCardIds.has(b.id) || b.isSold || b.status === 'sold';
                if (aSold === bSold) return 0;
                return aSold ? 1 : -1;
            }
            return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        });
    }, [allCards, allBettingItems, searchTerm, sortOption, filterTab, soldCardIds]);

    const stats = useMemo(() => {
        let totalItems = 0;
        let availableItems = 0;

        if (allCards && allBettingItems) {
            const allPoolCardIds = new Set<string>();
            allBettingItems.forEach(item => {
                item.allCardIds?.forEach(id => allPoolCardIds.add(id));
            });

            allPoolCardIds.forEach(id => {
                const card = cardMap.get(id);
                if (card && !card.isSold && card.status !== 'sold' && !soldCardIds.has(id)) {
                    availableItems++;
                }
            });
            totalItems = allPoolCardIds.size;
        }

        return {
            totalCategories: categoriesWithCounts.length,
            totalItems,
            availableItems,
        };
    }, [allCards, allBettingItems, cardMap, soldCardIds, categoriesWithCounts]);

    const finalIsLoading = isLoadingCategories || isLoadingCards || isLoadingBettingItems;

    if (!finalIsLoading && systemConfig?.featureFlags?.isBettingEnabled === false) {
        return (
            <div className="container py-32 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in-up">
                <div className="p-10 rounded-3xl bg-destructive/10 border border-destructive/20 animate-pulse shadow-[0_0_50px_rgba(219,39,119,0.2)]">
                    <Settings className="w-20 h-20 text-destructive" />
                </div>
                <div className="space-y-3">
                    <h2 className="text-4xl font-black font-headline tracking-widest text-white italic">維護中</h2>
                    <p className="text-muted-foreground font-medium max-w-md mx-auto leading-relaxed">
                        拼卡系統目前正在進行演算法升級與獎池維護，為了保障公平性，暫時停止服務。
                    </p>
                </div>
                <Button asChild variant="outline" className="h-12 px-10 rounded-xl border-destructive/30 hover:bg-destructive/5 font-bold transition-all">
                    <Link href="/">返回榮耀大廳</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen relative overflow-hidden pb-24 text-white">
            {/* Ambient Background Lighting */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[450px] bg-gradient-to-b from-rose-500/15 via-amber-500/10 to-transparent blur-[140px] pointer-events-none -z-10" />
            <div className="absolute top-[600px] right-0 w-[600px] h-[600px] bg-rose-500/10 blur-[160px] pointer-events-none -z-10" />

            <div className="container px-3 sm:px-6 pt-3 sm:pt-7 pb-20 max-w-7xl mx-auto space-y-4 sm:space-y-6">

                {/* 🎯 頂部雙專區快速切換器：球員卡拼卡 vs 兌換獎品 (命運轉盤) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-2 sm:p-2.5 rounded-2xl bg-slate-950/90 border border-white/10 shadow-[0_10px_35px_rgba(0,0,0,0.65)] backdrop-blur-xl">
                    <div className="grid grid-cols-2 gap-1.5 sm:gap-2 flex-1 max-w-xl">
                        <button
                            type="button"
                            onClick={() => setActiveSection('cards')}
                            className={cn(
                                "h-11 sm:h-12 px-3 sm:px-5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer",
                                activeSection === 'cards'
                                    ? "bg-gradient-to-r from-rose-500 via-pink-500 to-rose-600 text-white shadow-[0_0_20px_rgba(244,63,94,0.4)] border border-rose-300/40"
                                    : "bg-white/[0.03] hover:bg-white/[0.07] text-slate-300 border border-transparent"
                            )}
                        >
                            <CrossedCardsIcon className="w-4 h-4 shrink-0" />
                            <span>球員卡拼卡</span>
                            <span className={cn(
                                "text-[10px] font-mono px-1.5 py-0.5 rounded-md",
                                activeSection === 'cards' ? "bg-black/25 text-rose-100" : "bg-white/10 text-slate-400"
                            )}>
                                {finalIsLoading ? '--' : stats.availableItems}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveSection('prizes')}
                            className={cn(
                                "relative h-11 sm:h-12 px-3 sm:px-5 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer",
                                activeSection === 'prizes'
                                    ? "bg-gradient-to-r from-amber-400 via-orange-400 to-rose-500 text-slate-950 shadow-[0_0_24px_rgba(245,158,11,0.45)] border border-yellow-200/70"
                                    : "bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 border border-amber-500/25"
                            )}
                        >
                            <Disc3 className={cn("w-4 h-4 shrink-0", activeSection === 'prizes' ? "text-slate-950 animate-spin" : "text-amber-400")} style={{ animationDuration: '6s' }} />
                            <span>兌換獎品 · 命運轉盤</span>
                            <span className={cn(
                                "text-[10px] font-mono px-1.5 py-0.5 rounded-md",
                                activeSection === 'prizes' ? "bg-black/20 text-slate-950 font-black" : "bg-amber-500/20 text-amber-300"
                            )}>
                                {isLoadingPrizes ? '--' : totalActivePrizeCount}
                            </span>
                        </button>
                    </div>

                    {/* 右側即時紅利 P+ 餘額提示 */}
                    {user && userProfile && (
                        <div className="flex items-center justify-between sm:justify-end gap-3 px-3 py-1.5 rounded-xl bg-slate-900/80 border border-white/5 text-xs">
                            <span className="text-slate-400 font-medium">可用資產：</span>
                            <div className="flex items-center gap-3 font-mono font-black">
                                <span className="flex items-center gap-1 text-amber-300">
                                    <PPlusIcon className="w-3.5 h-3.5 text-amber-400" />
                                    {(userProfile.bonusPoints ?? 0).toLocaleString()}
                                </span>
                                <span className="text-white/15">|</span>
                                <span className="flex items-center gap-1 text-cyan-300">
                                    <DiamondIcon className="w-3.5 h-3.5" />
                                    {(userProfile.points ?? 0).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* 🎉 待領取轉盤中獎獎品提醒列 */}
                {unclaimedPrizes && unclaimedPrizes.length > 0 && (
                    <div className="p-3.5 sm:p-4 rounded-2xl bg-gradient-to-r from-emerald-950/90 via-slate-900/95 to-amber-950/80 border border-emerald-400/50 shadow-[0_0_25px_rgba(16,185,129,0.2)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center shrink-0">
                                <Gift className="w-5 h-5 text-emerald-300 animate-bounce" />
                            </div>
                            <div>
                                <div className="text-xs sm:text-sm font-black text-emerald-200">
                                    🎉 您有 {unclaimedPrizes.length} 件命運轉盤中獎獎品尚未填寫收件資訊！
                                </div>
                                <div className="text-[11px] text-slate-300">
                                    點擊右側按鈕填寫收件門市或地址，立即為您免費寄出。
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {unclaimedPrizes.map((claim) => (
                                <ClaimWonPrizeDialog key={claim.id} claim={claim}>
                                    <Button size="sm" className="h-9 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer">
                                        <Truck className="w-3.5 h-3.5 mr-1.5" />
                                        領取「{claim.itemName}」
                                    </Button>
                                </ClaimWonPrizeDialog>
                            ))}
                        </div>
                    </div>
                )}

                {activeSection === 'cards' ? (
                    <>
                        {/* 🛡️ 拼卡 · 4 大核心介紹（手機版極致精巧、不佔高度） */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-4">
                            <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#180a14]/90 to-[#0e070d]/90 border border-rose-500/25 flex items-center gap-2 sm:gap-3 shadow-xs hover:border-rose-500/40 transition-all">
                                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                                    <Target className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-black text-white text-[11px] sm:text-sm tracking-tight leading-tight">自選目標卡</div>
                                    <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 leading-tight truncate">告別盲盒遺憾</div>
                                </div>
                            </div>

                            <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#180a14]/90 to-[#0e070d]/90 border border-rose-500/25 flex items-center gap-2 sm:gap-3 shadow-xs hover:border-rose-500/40 transition-all">
                                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                                    <Percent className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-black text-white text-[11px] sm:text-sm tracking-tight leading-tight">1/10 成本換卡</div>
                                    <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 leading-tight truncate">高期望值翻盤</div>
                                </div>
                            </div>

                            <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#180a14]/90 to-[#0e070d]/90 border border-rose-500/25 flex items-center gap-2 sm:gap-3 shadow-xs hover:border-rose-500/40 transition-all">
                                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center text-purple-400 shrink-0">
                                    <Coins className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-black text-white text-[11px] sm:text-sm tracking-tight leading-tight">支援轉點回收</div>
                                    <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 leading-tight truncate">P+ 點數皆可拼</div>
                                </div>
                            </div>

                            <div className="p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-gradient-to-b from-[#180a14]/90 to-[#0e070d]/90 border border-rose-500/25 flex items-center gap-2 sm:gap-3 shadow-xs hover:border-rose-500/40 transition-all">
                                <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
                                    <Award className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="font-black text-white text-[11px] sm:text-sm tracking-tight leading-tight">中獎即刻入庫</div>
                                    <div className="text-[9px] sm:text-[11px] text-slate-400 mt-0.5 leading-tight truncate">實體卡保證寄送</div>
                                </div>
                            </div>
                        </div>

                        {/* 3D 旋轉門主題呈現專區 */}
                        <div className="relative mt-1 sm:mt-2">
                            <RevolvingDoorThemeCarousel
                                categories={categoriesWithCounts}
                                isLoading={finalIsLoading}
                                baseHref="/bet"
                                headerAction={
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <button 
                                                type="button"
                                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-900/90 hover:bg-slate-800 text-rose-300 border border-rose-500/40 flex items-center justify-center transition-all shadow-[0_0_12px_rgba(244,63,94,0.25)] active:scale-95 cursor-pointer"
                                                title="拼卡機制說明"
                                            >
                                                <HelpCircle className="w-4 h-4 text-rose-400" />
                                            </button>
                                        </DialogTrigger>
                                        <DialogContent className="rounded-[2rem] bg-slate-950 border border-rose-500/30 text-white max-w-2xl backdrop-blur-2xl shadow-2xl">
                                            <DialogHeader>
                                                <DialogTitle className="text-xl md:text-2xl font-black text-rose-400 flex items-center gap-2 font-headline">
                                                    <Target className="w-6 h-6 text-rose-400" />
                                                    拼卡 · 玩法機制說明
                                                </DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 py-3 text-sm text-slate-300">
                                                <p className="text-xs text-rose-200/90 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl leading-relaxed">
                                                    💡 <strong>拼卡與命運轉盤玩法</strong>：挑選心儀的球員卡或實體獎品，每格僅需 1/10 成本挑戰 10% 命中率（最多可選 9 格達 90% 勝率），也可使用紅利 P+ 點數或鑽石直接兌換帶走！
                                                </p>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-rose-400 font-bold">
                                                            <Percent className="w-4 h-4" /> 1/10 幸運命中
                                                        </div>
                                                        <p className="text-xs text-slate-400">每次 1~10 號碼隨機搖號，命中直接帶走心儀卡片或實體獎品。</p>
                                                    </div>
                                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-purple-400 font-bold">
                                                            <Coins className="w-4 h-4" /> 雙幣自由參與
                                                        </div>
                                                        <p className="text-xs text-slate-400">支援鑽石 💎 或卡片轉點的 P+ 點數（比例 1:10）。</p>
                                                    </div>
                                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-amber-400 font-bold">
                                                            <Award className="w-4 h-4" /> 10% 成本博大獎
                                                        </div>
                                                        <p className="text-xs text-slate-400">單格只需價值的 1/10，以小博大無負擔。</p>
                                                    </div>
                                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                        <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                                            <ShieldCheck className="w-4 h-4" /> 即時入庫與免運寄出
                                                        </div>
                                                        <p className="text-xs text-slate-400">卡片中獎即刻存入卡庫，實體獎品中獎直接填單免費寄送到府。</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                }
                            />
                        </div>

                        {/* === 全部拼卡卡片區 === */}
                        <div className="space-y-6 pt-2">
                            <div className="relative rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-gradient-to-b from-[#180d1e]/95 via-[#0e0c16]/95 to-[#08070d] border border-rose-500/35 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden">
                                <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_#f43f5e]" />
                                
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                                    <div className="flex items-center justify-between sm:justify-start gap-3">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-rose-500/30 to-amber-500/20 border border-rose-400/50 flex items-center justify-center text-rose-200 shrink-0 shadow-sm">
                                                <Sparkles className="w-5 h-5 text-rose-300 fill-rose-400/50" />
                                            </div>
                                            <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-headline tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-rose-300 to-amber-300">
                                                焦點目標 · 挑選心儀神卡
                                            </h2>
                                        </div>

                                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-[11px] sm:text-xs font-black text-rose-200 font-mono shrink-0">
                                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                                            <span>{finalIsLoading ? "--" : (stats.availableItems + " 款在席")}</span>
                                        </span>
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                        <div className="grid grid-cols-3 p-1 rounded-xl bg-slate-950/90 border border-white/15 shadow-inner">
                                            <button
                                                type="button"
                                                onClick={() => setFilterTab('all')}
                                                className={cn(
                                                    "py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer text-center flex items-center justify-center gap-1",
                                                    filterTab === 'all' 
                                                        ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md border border-rose-300/40" 
                                                        : "text-slate-400 hover:text-white"
                                                )}
                                            >
                                                <span>全部</span>
                                                <span className="text-[10px] opacity-75 font-mono">({stats.totalItems})</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFilterTab('available')}
                                                className={cn(
                                                    "py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer text-center flex items-center justify-center gap-1",
                                                    filterTab === 'available' 
                                                        ? "bg-gradient-to-r from-rose-500 to-pink-600 text-white shadow-md border border-rose-300/40" 
                                                        : "text-slate-400 hover:text-white"
                                                )}
                                            >
                                                <span>未抽出</span>
                                                <span className="text-[10px] opacity-75 font-mono">({stats.availableItems})</span>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setFilterTab('featured')}
                                                className={cn(
                                                    "py-1.5 px-2 rounded-lg text-xs font-black transition-all cursor-pointer text-center flex items-center justify-center gap-1",
                                                    filterTab === 'featured' 
                                                        ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-md border border-yellow-200" 
                                                        : "text-slate-400 hover:text-white"
                                                )}
                                            >
                                                <Flame className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                                <span>HOT</span>
                                            </button>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <Select 
                                                value={sortOption} 
                                                onValueChange={(val) => setSortOption(val as any)}
                                            >
                                                <SelectTrigger className="h-9 bg-slate-950/90 border-rose-500/35 hover:border-rose-400/70 rounded-xl font-bold text-slate-200 text-xs w-[110px] sm:w-[125px] shadow-sm shrink-0 cursor-pointer">
                                                    <SelectValue placeholder="排序方式" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-slate-950 border border-rose-500/30 text-white rounded-xl shadow-2xl">
                                                    <SelectItem value="latest" className="font-bold cursor-pointer hover:bg-rose-500/20">推薦排序</SelectItem>
                                                    <SelectItem value="price-high" className="font-bold cursor-pointer hover:bg-rose-500/20">價值：高至低</SelectItem>
                                                    <SelectItem value="price-low" className="font-bold cursor-pointer hover:bg-rose-500/20">價值：低至高</SelectItem>
                                                    <SelectItem value="unsold" className="font-bold cursor-pointer hover:bg-rose-500/20">未抽出優先</SelectItem>
                                                </SelectContent>
                                            </Select>

                                            <div className="relative flex-1 sm:w-48">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-rose-400/80 pointer-events-none" />
                                                <Input 
                                                    placeholder="搜尋球員/卡名..." 
                                                    className="pl-8.5 pr-7 h-9 bg-slate-950/80 rounded-xl border-rose-500/30 hover:border-rose-400/50 text-xs text-white placeholder:text-slate-500 focus-visible:ring-rose-500 shadow-inner w-full" 
                                                    value={searchTerm} 
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                />
                                                {searchTerm && (
                                                    <button 
                                                        type="button"
                                                        onClick={() => setSearchTerm('')}
                                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                                                    >
                                                        <X className="w-3.5 h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Cards Grid */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
                                {finalIsLoading && Array.from({length: 12}).map((_, i) => (
                                    <div key={i} className="aspect-[2.5/4] rounded-2xl overflow-hidden">
                                        <Skeleton className="w-full h-full" />
                                    </div>
                                ))}

                                {!finalIsLoading && cardsInBetting.map((card) => {
                                    const isSold = soldCardIds.has(card.id) || card.isSold;
                                    const singleBetPrice = card.sellPrice ? Math.max(1, Math.round(card.sellPrice / 10)) : 0;

                                    return (
                                        <div 
                                            key={card.id} 
                                            className={cn(
                                                "group relative flex flex-col rounded-2xl overflow-hidden border border-rose-500/15 bg-gradient-to-b from-[#180a14]/80 via-[#0e070d]/90 to-slate-950 p-2.5 transition-all duration-300",
                                                "hover:border-rose-400/60 hover:shadow-[0_10px_25px_-5px_rgba(244,63,94,0.3)] hover:-translate-y-1.5",
                                                isSold && "opacity-60 grayscale-[40%]"
                                            )}
                                        >
                                            <div className="absolute top-3.5 left-3.5 right-3.5 flex items-center justify-between z-20 pointer-events-none">
                                                {card.isFeatured ? (
                                                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-black text-[9px] px-1.5 py-0.5 rounded-md shadow-md border-none animate-pulse">
                                                        HOT
                                                    </Badge>
                                                ) : <div />}

                                                <button 
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setPreviewCard(card);
                                                    }}
                                                    className="pointer-events-auto p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/80 hover:text-rose-400 hover:bg-black/80 transition-all cursor-pointer"
                                                    title="預覽卡片正面/背面"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                </button>
                                            </div>

                                            <BettingGameDialog card={card} categoryName="all" disabled={isSold}>
                                                <div className="relative aspect-[2.5/3.5] w-full rounded-xl overflow-hidden bg-black/50 border border-white/5 cursor-pointer">
                                                    <SafeImage 
                                                        src={card.imageUrl} 
                                                        alt={card.name} 
                                                        fill 
                                                        className="object-contain transition-transform duration-500 group-hover:scale-105" 
                                                        sizes="(max-width: 768px) 50vw, 20vw" 
                                                    />
                                                    
                                                    {isSold && (
                                                        <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center p-2 z-10">
                                                            <XCircle className="w-7 h-7 text-rose-500 mb-1" />
                                                            <span className="text-[10px] font-black text-white bg-destructive px-2 py-0.5 rounded shadow-lg uppercase tracking-wider">
                                                                已被抽出
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </BettingGameDialog>

                                            <div className="mt-2.5 flex flex-col flex-1 justify-between space-y-2">
                                                <div>
                                                    <h4 className="text-xs font-bold text-white truncate group-hover:text-rose-300 transition-colors" title={card.name}>
                                                        {card.name}
                                                    </h4>
                                                    
                                                    <div className="flex items-center justify-between text-[11px] mt-1">
                                                        <span className="text-slate-400">市值:</span>
                                                        <span className="font-bold text-amber-300 flex items-center gap-1 font-mono">
                                                            <DiamondIcon className="w-3.5 h-3.5" />
                                                            {card.sellPrice ? card.sellPrice.toLocaleString() : '---'}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="pt-1">
                                                    <BettingGameDialog card={card} categoryName="all" disabled={isSold}>
                                                        <Button 
                                                            disabled={isSold}
                                                            size="sm" 
                                                            className={cn(
                                                                "w-full h-8 text-xs font-black rounded-lg transition-all cursor-pointer",
                                                                isSold 
                                                                     ? "bg-white/5 text-slate-500 border border-white/5" 
                                                                     : "bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white shadow-[0_0_12px_rgba(244,63,94,0.3)]"
                                                            )}
                                                        >
                                                            {isSold ? '已售出' : (
                                                                <span className="flex items-center justify-center gap-1">
                                                                    拼卡 {singleBetPrice} <DiamondIcon className="w-3.5 h-3.5" />
                                                                </span>
                                                            )}
                                                        </Button>
                                                    </BettingGameDialog>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {!finalIsLoading && cardsInBetting.length === 0 && (
                                <div className="py-20 text-center flex flex-col items-center justify-center space-y-3 rounded-2xl bg-white/5 border border-white/10">
                                    <Search className="w-10 h-10 text-slate-500" />
                                    <p className="text-sm text-slate-400">目前沒有符合條件的拼卡項目</p>
                                    <Button variant="outline" size="sm" onClick={() => { setSearchTerm(''); setFilterTab('all'); }} className="rounded-xl border-white/10">
                                        重設搜尋條件
                                    </Button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* === 🎁 獎品兌換 & 命運轉盤專區 === */
                    <div className="space-y-5 animate-in fade-in duration-300">
                        {/* 獎品區控制標題橫幅 */}
                        <div className="relative rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-gradient-to-b from-[#1e150c]/95 via-[#130e17]/95 to-[#09070d] border border-amber-500/35 shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden">
                            <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b]" />

                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2.5 flex-wrap">
                                        <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-400/25 to-rose-500/25 border border-amber-400/50 flex items-center justify-center shrink-0">
                                            <Disc3 className="w-5 h-5 text-amber-300 animate-spin" style={{ animationDuration: '7s' }} />
                                        </div>
                                        <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-headline tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-300 to-rose-300">
                                            實體獎品 · 命運轉盤 & 紅利兌換
                                        </h2>
                                        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-400/40 text-xs font-mono font-black">
                                            {isLoadingPrizes ? '--' : `${totalActivePrizeCount} 項好禮`}
                                        </Badge>
                                    </div>
                                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-0.5">
                                        每項獎品皆支援 <span className="text-rose-300 font-bold">🎡 1/10 點數命運轉盤以小搏大</span>，或使用累積的 <span className="text-amber-300 font-bold">🛍️ P+ 點數全額直接兌換</span>，免運寄送到府！
                                    </p>
                                </div>

                                <div className="flex items-center gap-2.5">
                                    <div className="relative flex-1 sm:w-56">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-amber-400/80 pointer-events-none" />
                                        <Input
                                            placeholder="搜尋獎品名稱..."
                                            className="pl-8.5 pr-7 h-9 bg-slate-950/90 rounded-xl border-amber-500/35 hover:border-amber-400/60 text-xs text-white placeholder:text-slate-500"
                                            value={prizeSearchTerm}
                                            onChange={(e) => setPrizeSearchTerm(e.target.value)}
                                        />
                                        {prizeSearchTerm && (
                                            <button
                                                type="button"
                                                onClick={() => setPrizeSearchTerm('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white cursor-pointer"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>

                                    {isUserAdmin && (
                                        <Button asChild size="sm" variant="outline" className="h-9 rounded-xl border-amber-500/40 text-amber-300 hover:bg-amber-500/15 text-xs font-bold shrink-0">
                                            <Link href="/admin/rewards">管理獎品</Link>
                                        </Button>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* 獎品卡片網格 */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-5">
                            {isLoadingPrizes && Array.from({ length: 8 }).map((_, i) => (
                                <div key={i} className="aspect-[3/4.2] rounded-2xl overflow-hidden">
                                    <Skeleton className="w-full h-full" />
                                </div>
                            ))}

                            {!isLoadingPrizes && redemptionItems.map((item) => {
                                const wheelSlicePoints = Math.max(1, Math.round(item.points * 0.1));

                                return (
                                    <div
                                        key={item.id}
                                        className="group relative flex flex-col rounded-2xl overflow-hidden border border-amber-500/25 bg-gradient-to-b from-[#1b1312]/90 via-[#100b14]/95 to-slate-950 p-2.5 sm:p-3.5 transition-all duration-300 hover:border-amber-400/70 hover:shadow-[0_12px_30px_-5px_rgba(245,158,11,0.28)] hover:-translate-y-1"
                                    >
                                        {/* 獎品視覺圖 (點擊預設開啟命運轉盤) */}
                                        <PrizeWheelDialog item={item} defaultMode="wheel">
                                            <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-950 border border-white/10 cursor-pointer">
                                                <SafeImage
                                                    src={item.imageUrl}
                                                    alt={item.name}
                                                    fill
                                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                    sizes="(max-width: 768px) 50vw, 25vw"
                                                />
                                                <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/75 backdrop-blur-md border border-amber-400/40 text-[10px] font-black text-amber-300 flex items-center gap-1">
                                                    <Gift className="w-3 h-3 text-amber-400" />
                                                    免運好禮
                                                </div>
                                                <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-gradient-to-r from-rose-600/90 to-amber-500/90 backdrop-blur-md text-[10px] font-black text-white shadow-md flex items-center gap-1">
                                                    <Disc3 className="w-3 h-3" />
                                                    1/10 可轉盤
                                                </div>
                                            </div>
                                        </PrizeWheelDialog>

                                        {/* 獎品名稱與價格資訊 */}
                                        <div className="mt-3 flex flex-col flex-1 justify-between space-y-3">
                                            <div className="space-y-1">
                                                <h3 className="text-xs sm:text-sm font-black text-white truncate group-hover:text-amber-300 transition-colors" title={item.name}>
                                                    {item.name}
                                                </h3>
                                                {item.description && (
                                                    <p className="text-[11px] text-slate-400 line-clamp-1">
                                                        {item.description}
                                                    </p>
                                                )}

                                                <div className="pt-1.5 space-y-1">
                                                    <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20">
                                                        <span className="text-rose-200 font-bold">🎡 轉盤單格</span>
                                                        <span className="font-mono font-black text-rose-300 flex items-center gap-1">
                                                            <PPlusIcon className="w-3 h-3 text-amber-400" />
                                                            {wheelSlicePoints.toLocaleString()}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[11px] px-2 py-1 rounded-lg bg-white/[0.03] border border-white/5">
                                                        <span className="text-slate-400">🛍️ 直接兌換</span>
                                                        <span className="font-mono font-bold text-amber-300 flex items-center gap-1">
                                                            <PPlusIcon className="w-3 h-3 text-amber-400" />
                                                            {item.points.toLocaleString()}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 雙玩法按鈕：命運轉盤 + 直接兌換 */}
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-0.5">
                                                <PrizeWheelDialog item={item} defaultMode="wheel">
                                                    <Button
                                                        size="sm"
                                                        className="w-full h-8 sm:h-9 text-[11px] sm:text-xs font-black rounded-xl bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:brightness-110 text-white shadow-[0_0_14px_rgba(244,63,94,0.35)] cursor-pointer px-2"
                                                    >
                                                        <Disc3 className="w-3.5 h-3.5 mr-1 shrink-0" />
                                                        命運轉盤
                                                    </Button>
                                                </PrizeWheelDialog>

                                                <PrizeWheelDialog item={item} defaultMode="redeem">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        className="w-full h-8 sm:h-9 text-[11px] sm:text-xs font-black rounded-xl border-amber-500/45 bg-amber-500/10 hover:bg-amber-500/20 text-amber-200 hover:text-white cursor-pointer px-2"
                                                    >
                                                        <ShoppingBag className="w-3.5 h-3.5 mr-1 shrink-0 text-amber-400" />
                                                        直接兌換
                                                    </Button>
                                                </PrizeWheelDialog>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {!isLoadingPrizes && redemptionItems.length === 0 && (
                            <div className="py-20 px-4 text-center flex flex-col items-center justify-center space-y-3 rounded-2xl bg-white/5 border border-white/10">
                                <Gift className="w-11 h-11 text-amber-400/60" />
                                <p className="text-sm font-bold text-slate-200">
                                    {prizeSearchTerm ? '找不到符合關鍵字的獎品' : '目前尚無上架的實體兌換獎品'}
                                </p>
                                <p className="text-xs text-slate-400 max-w-md">
                                    {prizeSearchTerm
                                        ? '請嘗試其他關鍵字或清除搜尋條件。'
                                        : '精選週邊、卡盒與實體好禮補貨準備中，敬請期待！'}
                                </p>
                                {prizeSearchTerm ? (
                                    <Button variant="outline" size="sm" onClick={() => setPrizeSearchTerm('')} className="rounded-xl border-white/15">
                                        清除搜尋
                                    </Button>
                                ) : isUserAdmin ? (
                                    <Button asChild size="sm" className="rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black">
                                        <Link href="/admin/rewards">前往後台新增兌換獎品</Link>
                                    </Button>
                                ) : null}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* 3D Card Preview Dialog */}
            <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
                <DialogContent className="max-w-[min(95vw,420px)] bg-transparent border-none p-0 flex flex-col items-center gap-6 [&>button:last-child]:hidden">
                    <DialogTitle asChild>
                        <VisuallyHidden>卡片預覽</VisuallyHidden>
                    </DialogTitle>
                    {previewCard && (
                        <div className="w-full flex flex-col items-center gap-4 bg-slate-950/90 border border-cyan-500/30 p-6 rounded-[2rem] backdrop-blur-2xl shadow-2xl">
                            <div className="flex items-center justify-between w-full">
                                <h3 className="text-sm font-black text-white truncate max-w-[240px]">{previewCard.name}</h3>
                                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 text-white/60 hover:text-white" onClick={() => setPreviewCard(null)}>
                                    <X className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="w-full max-w-[280px]">
                                <CardItem 
                                    name={previewCard.name} 
                                    imageUrl={previewCard.imageUrl} 
                                    backImageUrl={previewCard.backImageUrl} 
                                    imageHint={previewCard.name} 
                                    rarity="legendary" 
                                    isFlippable={true}
                                />
                            </div>
                            <p className="text-[11px] text-cyan-400 font-bold uppercase tracking-wider animate-pulse">
                                點擊卡片可 3D 翻轉查看背面
                            </p>
                            <BettingGameDialog card={previewCard} categoryName="all" disabled={previewCard.isSold}>
                                <Button className="w-full h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black">
                                    立即進入此卡拼卡
                                </Button>
                            </BettingGameDialog>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
