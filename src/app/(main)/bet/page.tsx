'use client';

import { BettingGameDialog } from '@/components/betting-game-dialog';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/safe-image';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { CrossedCardsIcon, DiamondIcon } from '@/components/icons';
import { 
    Sparkles, ShoppingBag, Truck, Check, Package, 
    Settings, ChevronRight, Swords, Target, RefreshCcw, ShieldCheck, 
    XCircle, Search, Flame, Eye, Zap, Layers, Trophy, ArrowRight, 
    Percent, Coins, Dices, Award, X, SlidersHorizontal, Disc3
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
import { CardItem } from '@/components/card-item';
import { VisuallyHidden } from '@/components/ui/visually-hidden';

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
}

interface CategoryWithCount extends BettingCategory {
    itemCount: number;
    totalCount: number;
}

export default function BetLandingPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTab, setFilterTab] = useState<'all' | 'available' | 'featured'>('all');
    const [sortOption, setSortOption] = useState<'latest' | 'price-high' | 'price-low' | 'unsold'>('latest');
    const [previewCard, setPreviewCard] = useState<CardData | null>(null);

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
            // 計算真正存在於 allCards 且未售出的卡片
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
        
        // Tab Filtering
        if (filterTab === 'available') {
            baseCards = baseCards.filter(c => !soldCardIds.has(c.id) && !c.isSold && c.status !== 'sold');
        } else if (filterTab === 'featured') {
            baseCards = baseCards.filter(c => c.isFeatured);
        }

        // Search Keyword
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            baseCards = baseCards.filter(c => c.name?.toLowerCase().includes(term));
        }

        // Sorting
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

    // Summary Statistics: 真實未售出的卡片數量，若被抽光則精準顯示 0
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
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[450px] bg-gradient-to-b from-rose-500/15 via-pink-500/10 to-transparent blur-[140px] pointer-events-none -z-10" />
            <div className="absolute top-[600px] right-0 w-[600px] h-[600px] bg-rose-500/10 blur-[160px] pointer-events-none -z-10" />

            <div className="container px-3 sm:px-6 py-3 sm:py-8 max-w-7xl mx-auto space-y-5 sm:space-y-10">
                
                {/* === HERO SECTION: 頂級賽博拼卡殿堂 === */}
                <div className="relative rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] p-3.5 sm:p-6 md:p-8 overflow-hidden border border-rose-500/25 bg-gradient-to-b from-[#180a14]/90 via-[#0f070e]/95 to-[#080408] shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#f43f5e10_1px,transparent_1px),linear-gradient(to_bottom,#f43f5e10_1px,transparent_1px)] bg-[size:32px_32px] opacity-60 pointer-events-none" />
                    
                    {/* Top Glow Accent Bar */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-rose-400 to-transparent shadow-[0_0_15px_#fb7185]" />
                    
                    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-6 md:gap-12">
                        <div className="space-y-2 sm:space-y-3 text-center lg:text-left max-w-2xl">
                            <h1 className="font-headline text-2xl sm:text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-rose-400 via-pink-200 to-amber-300 drop-shadow-[0_0_20px_rgba(244,63,94,0.4)] tracking-tight leading-none uppercase">
                                幸運拼卡
                            </h1>

                            <p className="text-xs sm:text-sm md:text-base text-slate-300 font-medium leading-normal">
                                10% 機率一擊入魂，支援鑽石與 P+ 雙幣參與。
                            </p>

                            {/* Rules Quick Dialog Button */}
                            <div className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-2">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button className="h-8 sm:h-10 px-4 sm:px-5 rounded-lg sm:rounded-xl bg-gradient-to-r from-rose-500 to-pink-500 hover:from-rose-400 hover:to-pink-400 text-white text-xs sm:text-sm font-black shadow-[0_0_20px_rgba(244,63,94,0.3)] transition-all gap-1.5 group cursor-pointer">
                                            <Dices className="w-3.5 h-3.5 text-white group-hover:rotate-45 transition-transform" />
                                            <span>玩法說明</span>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-[2rem] bg-slate-950 border border-rose-500/30 text-white max-w-2xl backdrop-blur-2xl shadow-2xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl md:text-2xl font-black text-rose-400 flex items-center gap-2 font-headline">
                                                <Target className="w-6 h-6 text-rose-400" />
                                                拼卡機制
                                            </DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4 py-3 text-sm text-slate-300">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                    <div className="flex items-center gap-2 text-rose-400 font-bold">
                                                        <Percent className="w-4 h-4" /> 1/10 命中率
                                                    </div>
                                                    <p className="text-xs text-slate-400">每次 1~10 隨機搖號，命中直接帶走卡片。</p>
                                                </div>
                                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                    <div className="flex items-center gap-2 text-purple-400 font-bold">
                                                        <Coins className="w-4 h-4" /> 雙幣參與
                                                    </div>
                                                    <p className="text-xs text-slate-400">支援鑽石 💎 或 P+ 點數（鑽石與 P+ 1:10）。</p>
                                                </div>
                                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                    <div className="flex items-center gap-2 text-amber-400 font-bold">
                                                        <Award className="w-4 h-4" /> 10% 成本
                                                    </div>
                                                    <p className="text-xs text-slate-400">單次只需卡片價值的 1/10 低成本博大獎。</p>
                                                </div>
                                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                    <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                                        <ShieldCheck className="w-4 h-4" /> 即時入庫
                                                    </div>
                                                    <p className="text-xs text-slate-400">中獎即刻存入個人卡庫，隨時申請實體出貨。</p>
                                                </div>
                                            </div>
                                        </div>
                                    </DialogContent>
                                </Dialog>

                                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>即時防搶保護</span>
                                </div>
                            </div>
                        </div>

                        {/* Live Pool Quick Stats Widget */}
                        <div className="flex flex-col gap-2 sm:gap-2.5 w-full lg:w-auto shrink-0 items-center">
                            <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#1a0c16] border border-pink-500/30 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(244,63,94,0.15)] w-full min-w-[140px] sm:min-w-[170px]">
                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">剩餘可拼</span>
                                <span className="text-2xl sm:text-4xl font-black font-headline text-pink-300 mt-0.5 sm:mt-1">
                                    {finalIsLoading ? '--' : stats.availableItems}
                                </span>
                                <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">球員卡</span>
                            </div>

                            <div className="p-2 sm:p-2.5 rounded-xl sm:rounded-2xl bg-[#1a0c16] border border-amber-500/30 flex items-center justify-center text-center shadow-lg w-full">
                                <div className="flex items-center gap-1.5">
                                    <DiamondIcon className="w-3.5 h-3.5 text-amber-400" />
                                    <span className="text-[11px] sm:text-xs font-bold text-amber-300">單注卡價 10% • 隨機公平</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* === 主題卡池分類專區 === */}
                <div className="mb-3 sm:mb-5 flex items-center justify-between animate-fade-in-up px-0.5 sm:px-1">
                    <div className="flex items-center gap-2 sm:gap-2.5">
                        <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                            <Disc3 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin-slow" />
                        </div>
                        <div>
                            <h2 className="text-sm sm:text-lg font-black font-headline tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-100 to-yellow-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)] flex items-center gap-2">
                                <span>選擇主題卡池</span>
                            </h2>
                        </div>
                    </div>
                    <div className="h-px flex-1 mx-3 sm:mx-6 bg-gradient-to-r from-amber-500/30 via-slate-700/40 to-transparent hidden sm:block" />
                    <div className="text-[11px] sm:text-xs text-slate-400 font-medium flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        <span>共 {categoriesWithCounts.length} 個專區</span>
                    </div>
                </div>

                {/* 主題卡片網格 */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-8 sm:mb-12 max-w-7xl mx-auto">
                    {finalIsLoading && Array.from({length: 4}).map((_, i) => (
                        <div key={i} className="aspect-[4/3] sm:aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden">
                            <Skeleton className="w-full h-full" />
                        </div>
                    ))}

                    {!finalIsLoading && categoriesWithCounts.map((category, index) => {
                        const name = category.name || '';
                        let theme = {
                            glow: 'hover:shadow-[0_8px_25px_rgba(244,63,94,0.25)]',
                            border: 'border-rose-500/30 hover:border-rose-400/80',
                            accentText: 'group-hover:text-rose-300',
                            gradient: 'from-rose-950/60 via-slate-950/40 to-transparent',
                            ringColor: 'from-rose-500/40 to-pink-500/10',
                        };

                        if (name.includes('籃球') || name.toLowerCase().includes('nba')) {
                            theme = {
                                glow: 'hover:shadow-[0_8px_25px_rgba(249,115,22,0.25)]',
                                border: 'border-orange-500/30 hover:border-orange-400/80',
                                accentText: 'group-hover:text-orange-400',
                                gradient: 'from-orange-950/60 via-slate-950/40 to-transparent',
                                ringColor: 'from-orange-500/40 to-amber-500/10',
                            };
                        } else if (name.includes('足球') || name.toLowerCase().includes('fifa')) {
                            theme = {
                                glow: 'hover:shadow-[0_8px_25px_rgba(16,185,129,0.25)]',
                                border: 'border-emerald-500/30 hover:border-emerald-400/80',
                                accentText: 'group-hover:text-emerald-400',
                                gradient: 'from-emerald-950/60 via-slate-950/40 to-transparent',
                                ringColor: 'from-emerald-500/40 to-teal-500/10',
                            };
                        } else if (name.includes('棒球') || name.toLowerCase().includes('mlb')) {
                            theme = {
                                glow: 'hover:shadow-[0_8px_25px_rgba(59,130,246,0.25)]',
                                border: 'border-blue-500/30 hover:border-blue-400/80',
                                accentText: 'group-hover:text-cyan-300',
                                gradient: 'from-blue-950/60 via-slate-950/40 to-transparent',
                                ringColor: 'from-blue-500/40 to-cyan-500/10',
                            };
                        } else if (name.includes('寶可夢') || name.toLowerCase().includes('pokemon') || name.toLowerCase().includes('ptcg')) {
                            theme = {
                                glow: 'hover:shadow-[0_8px_25px_rgba(234,179,8,0.25)]',
                                border: 'border-yellow-500/30 hover:border-yellow-400/80',
                                accentText: 'group-hover:text-yellow-300',
                                gradient: 'from-yellow-950/60 via-slate-950/40 to-transparent',
                                ringColor: 'from-yellow-500/40 to-amber-500/10',
                            };
                        }

                        return (
                            <Link 
                                href={`/bet/${encodeURIComponent(category.id)}`} 
                                key={category.id} 
                                className={cn(
                                    "group relative aspect-[4/3] sm:aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden block border transition-all duration-300",
                                    "bg-slate-950/90 backdrop-blur-md cursor-pointer select-none active:scale-[0.98]",
                                    theme.glow,
                                    theme.border,
                                    "animate-fade-in-up"
                                )}
                            >
                                {/* 背景封面圖片 */}
                                <SafeImage
                                    src={category.imageUrl}
                                    alt={category.name}
                                    fill
                                    className="object-cover transition-transform duration-500 group-hover:scale-105 opacity-60 group-hover:opacity-85"
                                    priority={index < 4}
                                    sizes="(max-width: 768px) 50vw, 25vw"
                                />
                                
                                {/* 雙層高質感漸層遮罩 */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/20 group-hover:via-slate-950/40 transition-colors duration-300" />
                                <div className={cn("absolute inset-0 bg-gradient-to-tr opacity-20 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none", theme.gradient)} />

                                {/* 頂部標籤列 (顯示卡池數量) */}
                                <div className="absolute top-2 sm:top-2.5 inset-x-2 sm:inset-x-2.5 flex items-center justify-end z-10">
                                    <span className={cn(
                                        "text-[9px] sm:text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border shrink-0 shadow-sm backdrop-blur-md",
                                        category.itemCount === 0 
                                            ? "text-rose-400 bg-rose-950/80 border-rose-500/30" 
                                            : "text-slate-300 bg-black/75 border-white/15"
                                    )}>
                                        {category.itemCount === 0 ? '已抽完' : `${category.itemCount} 款`}
                                    </span>
                                </div>

                                {/* 底部主題名稱與指引 */}
                                <div className="absolute inset-0 flex flex-col justify-end p-2.5 sm:p-3.5 z-10">
                                    <div className="transform transition-transform duration-300 group-hover:-translate-y-0.5">
                                        <h3 className={cn(
                                            "font-headline text-sm sm:text-base md:text-xl font-black text-white tracking-tight drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] transition-colors duration-300 line-clamp-1",
                                            theme.accentText
                                        )}>
                                            {category.name}
                                        </h3>
                                        
                                        <div className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold text-slate-300 opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-300 mt-0.5">
                                            <span>進入專區</span>
                                            <ChevronRight className="w-3 h-3 group-hover:translate-x-1 transition-transform text-amber-400" />
                                        </div>
                                    </div>
                                </div>

                                {/* 底部邊框微流光 */}
                                <div className={cn("absolute bottom-0 inset-x-0 h-[2px] bg-gradient-to-r opacity-50 group-hover:opacity-100 transition-opacity", theme.ringColor)} />
                            </Link>
                        );
                    })}
                </div>

                {/* === 全部拼卡獎品區 (過濾 + 頂級卡磚) === */}
                <div className="space-y-6 pt-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                        <div>
                            <h2 className="text-lg md:text-2xl font-black text-white tracking-wide font-headline flex items-center gap-2">
                                <Sparkles className="w-5 h-5 text-rose-400" />
                                焦點拼卡獎品
                            </h2>
                            <p className="text-xs text-slate-400 mt-1">
                                挑選心儀卡牌 · 1/10 命運機率挑戰入庫
                            </p>
                        </div>

                        {/* Filters & Search */}
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Tab Filters */}
                            <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10">
                                <button
                                    onClick={() => setFilterTab('all')}
                                    className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                        filterTab === 'all' ? "bg-rose-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    全部
                                </button>
                                <button
                                    onClick={() => setFilterTab('available')}
                                    className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                        filterTab === 'available' ? "bg-rose-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    未抽出
                                </button>
                                <button
                                    onClick={() => setFilterTab('featured')}
                                    className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                        filterTab === 'featured' ? "bg-rose-500 text-white shadow-sm" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    🔥 HOT
                                </button>
                            </div>

                            {/* Sort Select */}
                            <Select 
                                value={sortOption} 
                                onValueChange={(val) => setSortOption(val as any)}
                            >
                                <SelectTrigger className="h-9 bg-white/5 border-white/10 rounded-xl font-bold text-white text-xs w-[130px]">
                                    <SelectValue placeholder="排序方式" />
                                </SelectTrigger>
                                <SelectContent className="bg-slate-900 border-white/10 text-white rounded-xl">
                                    <SelectItem value="latest" className="font-bold cursor-pointer">推薦排序</SelectItem>
                                    <SelectItem value="price-high" className="font-bold cursor-pointer">價值：高至低</SelectItem>
                                    <SelectItem value="price-low" className="font-bold cursor-pointer">價值：低至高</SelectItem>
                                    <SelectItem value="unsold" className="font-bold cursor-pointer">未抽出優先</SelectItem>
                                </SelectContent>
                            </Select>

                            {/* Search Input */}
                            <div className="relative w-full sm:w-56">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input 
                                    placeholder="搜尋球員/卡名..." 
                                    className="pl-8 h-9 bg-white/5 rounded-xl border-white/10 text-xs text-white placeholder:text-slate-500 focus-visible:ring-rose-500" 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
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
                                    {/* Top Badges & Actions */}
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

                                    {/* Card Visual View */}
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

                                    {/* Card Meta */}
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

                                        {/* Action Button: 拼卡 */}
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
