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
    Percent, Coins, Dices, Award, X, SlidersHorizontal
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
    const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryWithCount[]>([]);
    const [isLoadingCounts, setIsLoadingCounts] = useState(true);
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
    const { data: allBettingItems } = useCollection<BettingItems>(bettingItemsCollectionRef);

    const allCardsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]);
    const { data: allCards, isLoading: isLoadingCards } = useCollection<CardData>(allCardsCollectionRef);

    // Sold Card Set
    const soldCardIds = useMemo(() => {
        const set = new Set<string>();
        if (allBettingItems) {
            allBettingItems.forEach(item => {
                item.soldCardIds?.forEach(id => set.add(id));
            });
        }
        return set;
    }, [allBettingItems]);

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
            baseCards = baseCards.filter(c => !soldCardIds.has(c.id) && !c.isSold);
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
                const aSold = soldCardIds.has(a.id) || a.isSold;
                const bSold = soldCardIds.has(b.id) || b.isSold;
                if (aSold === bSold) return 0;
                return aSold ? 1 : -1;
            }
            return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        });
    }, [allCards, allBettingItems, searchTerm, sortOption, filterTab, soldCardIds]);

    // Summary Statistics
    const stats = useMemo(() => {
        let totalItems = 0;
        let availableItems = 0;
        categoriesWithCounts.forEach(c => {
            availableItems += c.itemCount;
            totalItems += c.totalCount;
        });
        return {
            totalCategories: categoriesWithCounts.length,
            totalItems,
            availableItems,
        };
    }, [categoriesWithCounts]);

    useEffect(() => {
        const fetchItemCounts = async () => {
            if (!categories || !firestore) return;

            setIsLoadingCounts(true);
            try {
                const sortedCategories = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                const counts = await Promise.all(
                    sortedCategories.map(async (category) => {
                        const itemDocRef = doc(firestore, 'betting-items', category.id);
                        const itemDocSnap = await getDoc(itemDocRef);
                        let count = 0;
                        let total = 0;
                        if (itemDocSnap.exists()) {
                            const data = itemDocSnap.data() as BettingItems;
                            total = data.allCardIds?.length || 0;
                            const availableCount = total - (data.soldCardIds?.length || 0);
                            count = Math.max(0, availableCount);
                        }
                        return {
                            ...category,
                            itemCount: count,
                            totalCount: total,
                        };
                    })
                );
                setCategoriesWithCounts(counts);
            } catch (error) {
                console.error("Error fetching item counts: ", error);
            } finally {
                setIsLoadingCounts(false);
            }
        };

        if (!isLoadingCategories && categories) {
            fetchItemCounts();
        }
    }, [categories, firestore, isLoadingCategories]);

    const finalIsLoading = isLoadingCategories || isLoadingCounts || isLoadingCards;

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
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[450px] bg-gradient-to-b from-cyan-500/15 via-rose-500/10 to-transparent blur-[140px] pointer-events-none -z-10" />
            <div className="absolute top-[600px] right-0 w-[600px] h-[600px] bg-purple-500/10 blur-[160px] pointer-events-none -z-10" />

            <div className="container px-3 sm:px-6 py-3 sm:py-8 max-w-7xl mx-auto space-y-5 sm:space-y-10">
                
                {/* === HERO SECTION: 頂級賽博拼卡殿堂 === */}
                <div className="relative rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] p-3.5 sm:p-6 md:p-8 overflow-hidden border border-cyan-500/20 bg-gradient-to-b from-slate-900/90 via-[#0a0f1d]/95 to-[#050811] shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                    {/* Background Grid Pattern */}
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d410_1px,transparent_1px),linear-gradient(to_bottom,#06b6d410_1px,transparent_1px)] bg-[size:32px_32px] opacity-60 pointer-events-none" />
                    
                    {/* Top Glow Accent Bar */}
                    <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee]" />
                    
                    <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-6 md:gap-12">
                        <div className="space-y-2 sm:space-y-3 text-center lg:text-left max-w-2xl">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/40 backdrop-blur-md shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                <Sparkles className="w-3 h-3 text-cyan-400 animate-pulse" />
                                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] text-cyan-300">
                                    1/10 幸運拼卡
                                </span>
                            </div>

                            <h1 className="font-headline text-2xl sm:text-4xl md:text-6xl font-black text-white tracking-tight leading-none uppercase">
                                幸運拼卡
                            </h1>

                            <p className="text-xs sm:text-sm md:text-base text-slate-300 font-medium leading-normal">
                                10% 機率一擊入魂，支援鑽石與 P+ 雙幣參與。
                            </p>

                            {/* Rules Quick Dialog Button */}
                            <div className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-2">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button className="h-8 sm:h-10 px-4 sm:px-5 rounded-lg sm:rounded-xl bg-gradient-to-r from-cyan-500 to-cyan-400 hover:from-cyan-400 hover:to-cyan-300 text-slate-950 text-xs sm:text-sm font-black shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all gap-1.5 group cursor-pointer">
                                            <Dices className="w-3.5 h-3.5 text-slate-950 group-hover:rotate-45 transition-transform" />
                                            <span>玩法說明</span>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-[2rem] bg-slate-950 border border-cyan-500/30 text-white max-w-2xl backdrop-blur-2xl shadow-2xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl md:text-2xl font-black text-cyan-400 flex items-center gap-2 font-headline">
                                                <Target className="w-6 h-6 text-cyan-400" />
                                                拼卡機制
                                            </DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4 py-3 text-sm text-slate-300">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                    <div className="flex items-center gap-2 text-cyan-400 font-bold">
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
                        <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full lg:w-auto shrink-0">
                            <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0b1329] border border-cyan-500/30 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(6,182,212,0.15)]">
                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">主題卡池</span>
                                <span className="text-xl sm:text-3xl font-black font-headline text-cyan-400 mt-0.5 sm:mt-1">
                                    {finalIsLoading ? '--' : stats.totalCategories}
                                </span>
                                <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">專屬主題池</span>
                            </div>

                            <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0b1329] border border-primary/30 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(244,63,94,0.15)]">
                                <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">剩餘可拼</span>
                                <span className="text-xl sm:text-3xl font-black font-headline text-primary mt-0.5 sm:mt-1">
                                    {finalIsLoading ? '--' : stats.availableItems}
                                </span>
                                <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">球員卡</span>
                            </div>

                            <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-[#0b1329] border border-amber-500/30 flex flex-col items-center justify-center text-center shadow-lg col-span-2">
                                <div className="flex items-center gap-1.5">
                                    <Gem className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                                    <span className="text-[11px] sm:text-xs font-bold text-amber-300">單注卡價 10% • 隨機公平</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* === 主題卡池分類專區 === */}
                <div className="space-y-4 sm:space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-destructive/15 border border-destructive/30 shadow-[0_0_15px_rgba(244,63,94,0.3)]">
                                <CrossedCardsIcon className="w-5 h-5 text-destructive" />
                            </div>
                            <div>
                                <h2 className="text-lg md:text-2xl font-black text-white tracking-wide font-headline flex items-center gap-2">
                                    選擇主題卡池
                                </h2>
                                <p className="text-xs text-slate-400">點擊進入各專屬卡池查看即時卡片與挑戰拼卡</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        {finalIsLoading && Array.from({length: 4}).map((_, i) => (
                            <div key={i} className="aspect-[16/10] rounded-2xl overflow-hidden">
                                <Skeleton className="w-full h-full" />
                            </div>
                        ))}

                        {!finalIsLoading && categoriesWithCounts.map((category, index) => (
                            <Link 
                                href={`/bet/${encodeURIComponent(category.id)}`} 
                                key={category.id} 
                                className={cn(
                                    "group relative aspect-[16/10] rounded-2xl overflow-hidden block border border-white/10 transition-all duration-500",
                                    "hover:border-cyan-400/80 hover:shadow-[0_0_40px_rgba(6,182,212,0.3)] hover:-translate-y-1.5",
                                    "bg-slate-900"
                                )}
                            >
                                <SafeImage
                                    src={category.imageUrl}
                                    alt={category.name}
                                    fill
                                    className="object-cover transition-all duration-700 group-hover:scale-110 opacity-70 group-hover:opacity-90"
                                    priority={index < 4}
                                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                                />
                                
                                {/* Gradient Overlay */}
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent group-hover:from-slate-950/90 transition-all" />

                                {/* Top Badges */}
                                <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-10">
                                    <Badge className="bg-slate-900/90 backdrop-blur-md text-cyan-400 border border-cyan-400/40 text-[10px] font-black px-2.5 py-0.5 shadow-md">
                                        剩餘 {category.itemCount} 張
                                    </Badge>
                                    <div className="w-7 h-7 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center group-hover:bg-cyan-400 group-hover:text-slate-950 transition-all shadow-md">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </div>

                                {/* Bottom Info */}
                                <div className="absolute bottom-0 inset-x-0 p-4 z-10">
                                    <h3 className="font-headline text-lg sm:text-2xl font-black text-white tracking-tight group-hover:text-cyan-300 transition-colors drop-shadow-md truncate">
                                        {category.name}
                                    </h3>
                                    <div className="flex items-center justify-between mt-1 text-[11px] text-slate-300">
                                        <span>總卡量 {category.totalCount} 張</span>
                                        <span className="text-cyan-400 font-bold group-hover:underline">進入卡池 →</span>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>

                {/* === 全部拼卡獎品區 (過濾 + 頂級卡磚) === */}
                <div className="space-y-6 pt-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                        <div>
                            <h2 className="text-lg md:text-2xl font-black text-white tracking-wide font-headline flex items-center gap-2">
                                <Package className="w-6 h-6 text-primary" />
                                全部拼卡卡池
                                <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 font-normal">
                                    {cardsInBetting.length} 張
                                </span>
                            </h2>
                            <p className="text-xs text-slate-400 mt-0.5">直接點擊卡片即可快速開啟 1/10 機率拼卡拉霸機</p>
                        </div>

                        {/* Filters & Search */}
                        <div className="flex flex-wrap items-center gap-3">
                            {/* Tab Filters */}
                            <div className="flex items-center p-1 rounded-xl bg-white/5 border border-white/10">
                                <button
                                    onClick={() => setFilterTab('all')}
                                    className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                        filterTab === 'all' ? "bg-cyan-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    全部
                                </button>
                                <button
                                    onClick={() => setFilterTab('available')}
                                    className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                        filterTab === 'available' ? "bg-cyan-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
                                    )}
                                >
                                    未抽出
                                </button>
                                <button
                                    onClick={() => setFilterTab('featured')}
                                    className={cn(
                                        "px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer",
                                        filterTab === 'featured' ? "bg-cyan-500 text-slate-950 shadow-sm" : "text-slate-400 hover:text-white"
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
                                    className="pl-8 h-9 bg-white/5 rounded-xl border-white/10 text-xs text-white placeholder:text-slate-500 focus-visible:ring-cyan-500" 
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
                                        "group relative flex flex-col rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-b from-slate-900/90 to-slate-950 p-2.5 transition-all duration-300",
                                        "hover:border-cyan-400/60 hover:shadow-[0_10px_25px_-5px_rgba(6,182,212,0.3)] hover:-translate-y-1.5",
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
                                            className="pointer-events-auto p-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white/80 hover:text-cyan-400 hover:bg-black/80 transition-all cursor-pointer"
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
                                            <h4 className="text-xs font-bold text-white truncate group-hover:text-cyan-300 transition-colors" title={card.name}>
                                                {card.name}
                                            </h4>
                                            
                                            <div className="flex items-center justify-between text-[11px] mt-1">
                                                <span className="text-slate-400">市值:</span>
                                                <span className="font-bold text-cyan-400 flex items-center gap-1 font-mono">
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
                                                            : "bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
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
