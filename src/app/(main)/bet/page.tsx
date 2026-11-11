'use client';

import { BettingGameDialog } from '@/components/betting-game-dialog';
import { BeginnerGuideDialog } from '@/components/beginner-guide-dialog';
import { ProvablyFairDialog } from '@/components/provably-fair-dialog';
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
    Percent, Coins, Dices, Award, X, SlidersHorizontal, Disc3, HelpCircle
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

            <div className="container px-3 sm:px-6 pt-3 sm:pt-9 pb-20 max-w-7xl mx-auto space-y-4 sm:space-y-8">
                
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

                {/* 3D 旋轉門主題呈現專區（右上角配有精緻的玩法說明與公平驗證） */}
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
                                    title="拼卡回血機制說明"
                                >
                                    <HelpCircle className="w-4 h-4 text-rose-400" />
                                </button>
                            </DialogTrigger>
                            <DialogContent className="rounded-[2rem] bg-slate-950 border border-rose-500/30 text-white max-w-2xl backdrop-blur-2xl shadow-2xl">
                                <DialogHeader>
                                    <DialogTitle className="text-xl md:text-2xl font-black text-rose-400 flex items-center gap-2 font-headline">
                                        <Target className="w-6 h-6 text-rose-400" />
                                        拼卡 · 回血救援機制
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-3 text-sm text-slate-300">
                                    <p className="text-xs text-rose-200/90 bg-rose-500/10 border border-rose-500/20 p-3 rounded-xl leading-relaxed">
                                        💡 <strong>空門救贖核心理念</strong>：玩家在轉蛋或卡盒中若未抽中理想球星，可至此挑選真正喜愛的卡片，僅需 1/10 成本以小搏大；也可使用卡片轉點後的紅利 P+ 點數或鑽石進行直購兌換！
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                            <div className="flex items-center gap-2 text-rose-400 font-bold">
                                                <Percent className="w-4 h-4" /> 1/10 幸運命中
                                            </div>
                                            <p className="text-xs text-slate-400">每次 1~10 號碼隨機搖號，命中直接帶走心儀卡片。</p>
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
                                            <p className="text-xs text-slate-400">單次只需卡片價值的 1/10，以小博大無負擔。</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                            <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                                <ShieldCheck className="w-4 h-4" /> 即時入庫保證
                                            </div>
                                            <p className="text-xs text-slate-400">中獎即刻存入個人卡庫，隨時可申請實體出貨到府。</p>
                                        </div>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                        }
                    />
                </div>

                {/* === 全部拼卡獎品區 (過濾 + 頂級卡磚) === */}
                <div className="space-y-6 pt-2">
                    {/* 焦點拼卡獎品控制中樞 */}
                    <div className="relative rounded-2xl sm:rounded-3xl p-4 sm:p-6 bg-gradient-to-b from-[#180d1e]/95 via-[#0e0c16]/95 to-[#08070d] border border-rose-500/35 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden">
                        {/* 頂部全息激光流光條 */}
                        <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-rose-500 to-transparent shadow-[0_0_12px_#f43f5e]" />
                        
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                            {/* 左側：精簡標題與卡數 */}
                            <div className="flex items-center justify-between sm:justify-start gap-3">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-rose-500/30 to-amber-500/20 border border-rose-400/50 flex items-center justify-center text-rose-200 shrink-0 shadow-sm">
                                        <Sparkles className="w-5 h-5 text-rose-300 fill-rose-400/50" />
                                    </div>
                                    <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-headline tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-rose-300 to-amber-300">
                                        焦點回血 · 挑選心儀神卡
                                    </h2>
                                </div>

                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-400/40 text-[11px] sm:text-xs font-black text-rose-200 font-mono shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-ping" />
                                    <span>{finalIsLoading ? "--" : (stats.availableItems + " 款在席")}</span>
                                </span>
                            </div>

                            {/* 右側：篩選分頁、排序與搜尋 (高度整合、不溢出) */}
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                                {/* 分頁篩選 */}
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

                                {/* 下拉排序 + 搜尋欄並排 */}
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
