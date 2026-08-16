'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/safe-image';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, orderBy, doc, getDoc } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { 
    Sparkles, Gem, Settings, ChevronRight, Swords, Target, 
    RefreshCcw, ShieldCheck, Search, Flame, ArrowRight, Dices, X, Package, Trophy
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { BettingGameDialog } from '@/components/betting-game-dialog';
import type { SystemConfig } from '@/types/system';

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
    category?: string;
    rarity?: string;
    imageUrl: string;
    backImageUrl?: string;
    imageHint?: string;
    sellPrice?: number;
    isFeatured?: boolean;
    isSold?: boolean;
    minLevel?: string;
}

interface CategoryWithCount extends BettingCategory {
    totalCount: number;
    availableCount: number;
    soldCount: number;
}

export default function BetLandingPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryWithCount[]>([]);
    const [isLoadingCounts, setIsLoadingCounts] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'sold'>('all');
    const [sortOption, setSortOption] = useState<'latest' | 'price-high' | 'price-low'>('latest');

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

    // 建立已售出 ID 集合
    const soldCardIdsSet = useMemo(() => {
        const set = new Set<string>();
        allBettingItems?.forEach(item => {
            item.soldCardIds?.forEach(id => set.add(id));
        });
        return set;
    }, [allBettingItems]);

    const cardsInBetting = useMemo(() => {
        if (!allCards || !allBettingItems) return [];
        const cardIdsInBetting = new Set<string>();
        allBettingItems.forEach(item => {
            item.allCardIds?.forEach(id => cardIdsInBetting.add(id));
        });
        
        let baseCards = allCards.filter(card => cardIdsInBetting.has(card.id));
        
        // 狀態過濾
        if (statusFilter === 'available') {
            baseCards = baseCards.filter(c => !soldCardIdsSet.has(c.id) && !c.isSold);
        } else if (statusFilter === 'sold') {
            baseCards = baseCards.filter(c => soldCardIdsSet.has(c.id) || c.isSold);
        }

        // 搜尋過濾
        if (searchTerm.trim()) {
            baseCards = baseCards.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        // 排序
        return baseCards.sort((a, b) => {
            if (sortOption === 'price-high') return (b.sellPrice || 0) - (a.sellPrice || 0);
            if (sortOption === 'price-low') return (a.sellPrice || 0) - (b.sellPrice || 0);
            return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        });
    }, [allCards, allBettingItems, searchTerm, statusFilter, sortOption, soldCardIdsSet]);

    useEffect(() => {
        const fetchItemCounts = async () => {
            if (!firestore || !categories || categories.length === 0) {
                setIsLoadingCounts(false);
                return;
            }

            setIsLoadingCounts(true);
            try {
                const sortedCategories = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                const counts = await Promise.all(
                    sortedCategories.map(async (category) => {
                        const itemDocRef = doc(firestore, 'betting-items', category.id);
                        const itemDocSnap = await getDoc(itemDocRef);
                        let totalCount = 0;
                        let soldCount = 0;
                        if (itemDocSnap.exists()) {
                            const data = itemDocSnap.data() as BettingItems;
                            totalCount = data.allCardIds?.length || 0;
                            soldCount = data.soldCardIds?.length || 0;
                        }
                        return {
                            ...category,
                            totalCount,
                            soldCount,
                            availableCount: Math.max(0, totalCount - soldCount),
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

        if (!isLoadingCategories) {
            fetchItemCounts();
        }
    }, [categories, firestore, isLoadingCategories]);

    const finalIsLoading = isLoadingCategories || isLoadingCounts || isLoadingCards || isLoadingBettingItems;

    if (!finalIsLoading && systemConfig?.featureFlags?.isBettingEnabled === false) {
        return (
            <div className="min-h-[70vh] flex flex-col items-center justify-center text-center p-6 space-y-6">
                <div className="p-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 animate-pulse shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                    <Settings className="w-20 h-20 text-cyan-400" />
                </div>
                <div className="space-y-3">
                    <h2 className="text-4xl font-black font-headline tracking-widest text-white italic">拼卡專區維護中</h2>
                    <p className="text-slate-400 font-medium max-w-md mx-auto leading-relaxed">
                        拼卡系統目前正在進行演算法優化與系統升級，為了確保公平性與最佳體驗，暫時停止服務。
                    </p>
                </div>
                <Button asChild variant="outline" className="h-12 px-10 rounded-2xl border-cyan-500/30 hover:bg-cyan-950/40 text-cyan-300 font-bold transition-all">
                    <Link href="/">返回首頁大廳</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 pb-24">
            {/* 英雄標題區塊 */}
            <div className="relative overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-cyan-950/25 via-[#070b14]/90 to-[#070b14] pt-8 pb-12 md:pt-14 md:pb-16">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-500/15 via-transparent to-transparent pointer-events-none" />

                <div className="container px-4 md:px-8 relative z-10">
                    <div className="text-center max-w-3xl mx-auto space-y-4">
                        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-black tracking-widest uppercase shadow-[0_0_20px_rgba(6,182,212,0.2)]">
                            <Sparkles className="w-3.5 h-3.5 animate-spin-slow" />
                            1/10 幸運拼卡競技場
                        </div>

                        <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-headline tracking-tight text-white">
                            拼卡專區
                        </h1>

                        <p className="text-xs sm:text-sm md:text-base text-slate-400 max-w-xl mx-auto leading-relaxed">
                            挑選您心儀的稀有卡牌，以 10% 成本試手氣或直接包牌帶走，即開即得！
                        </p>
                    </div>

                    {/* 四大特色卡片 */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 max-w-5xl mx-auto mt-8 sm:mt-12">
                        {[
                            {
                                id: 1,
                                title: '1/10 命中率',
                                description: '每注固定 10% 機率直接帶走卡片',
                                icon: Target,
                                glowColor: 'rgba(34, 211, 238, 1)',
                                bgGradient: 'from-cyan-900/20 to-transparent',
                                iconColor: 'text-cyan-400',
                            },
                            {
                                id: 2,
                                title: '雙幣別下注',
                                description: '支援使用鑽石或紅利 P+ 參與',
                                icon: RefreshCcw,
                                glowColor: 'rgba(168, 85, 247, 1)',
                                bgGradient: 'from-purple-900/20 to-transparent',
                                iconColor: 'text-purple-400',
                            },
                            {
                                id: 3,
                                title: '1:10 價值比',
                                description: '鑽石與 P+ 點比例固定 1:10',
                                icon: Gem,
                                glowColor: 'rgba(251, 191, 36, 1)',
                                bgGradient: 'from-amber-900/20 to-transparent',
                                iconColor: 'text-amber-400',
                            },
                            {
                                id: 4,
                                title: '資產即時發放',
                                description: '中獎後卡片立即存入數位收藏庫',
                                icon: ShieldCheck,
                                glowColor: 'rgba(16, 185, 129, 1)',
                                bgGradient: 'from-emerald-900/20 to-transparent',
                                iconColor: 'text-emerald-400',
                            }
                        ].map((item) => {
                            const IconComponent = item.icon;
                            return (
                                <div 
                                    key={item.id}
                                    className="group relative rounded-2xl p-[1.5px] overflow-hidden cursor-pointer hover:-translate-y-1.5 transition-transform duration-500 hover:shadow-[0_10px_30px_-10px_var(--glow)]"
                                    style={{ '--glow': item.glowColor } as React.CSSProperties}
                                >
                                    <div 
                                        className="absolute inset-[-100%] opacity-0 group-hover:opacity-100 transition-opacity duration-300 animate-[spin_3s_linear_infinite]"
                                        style={{ background: `conic-gradient(from 0deg, transparent 0 270deg, var(--glow) 360deg)` }}
                                    />
                                    <div className="absolute inset-0 bg-slate-800/40 group-hover:bg-transparent transition-colors duration-300 rounded-2xl" />

                                    <div className={cn(
                                        "relative h-full bg-[#0a0f1c]/95 backdrop-blur-xl rounded-[15px] p-4 sm:p-5 flex flex-col items-center text-center z-10 bg-gradient-to-b",
                                        item.bgGradient
                                    )}>
                                        <div className="relative mb-3 mt-1 sm:mb-4 sm:mt-2">
                                            <div className="absolute inset-0 bg-[var(--glow)] blur-lg opacity-20 group-hover:opacity-50 group-hover:animate-pulse transition-opacity duration-300 rounded-full" />
                                            <IconComponent className={cn("w-7 h-7 sm:w-8 sm:h-8 relative z-10", item.iconColor, "drop-shadow-[0_0_8px_var(--glow)]")} />
                                        </div>
                                        <h3 className="text-slate-100 font-bold text-xs sm:text-sm md:text-base tracking-wide mb-1 z-10 font-headline">
                                            {item.title}
                                        </h3>
                                        <p className="text-slate-400 text-[11px] sm:text-xs leading-relaxed font-light z-10">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* 主題分類區塊 */}
            <div className="container px-4 md:px-8 mt-12 md:mt-16">
                <div className="flex items-center justify-between mb-6 md:mb-8">
                    <div>
                        <div className="flex items-center gap-2 text-cyan-400 text-xs font-black tracking-widest uppercase mb-1">
                            <Flame className="w-4 h-4" />
                            CHOOSE THEME
                        </div>
                        <h2 className="text-xl md:text-3xl font-black font-headline text-white tracking-tight">
                            選擇主題卡池
                        </h2>
                    </div>
                    <div className="text-xs text-slate-400">
                        共 <strong className="text-cyan-400 font-mono">{categoriesWithCounts.length}</strong> 個主題專區
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
                    {finalIsLoading && Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-[16/10] rounded-3xl bg-slate-900/80 border border-slate-800" />
                    ))}
                    {!finalIsLoading && categoriesWithCounts.map((category, index) => (
                        <Link 
                            href={`/bet/${encodeURIComponent(category.id)}`} 
                            key={category.id} 
                            className="group relative aspect-[16/10] rounded-3xl overflow-hidden block border border-slate-800 bg-slate-900/60 hover:border-cyan-500/60 hover:shadow-[0_0_35px_rgba(6,182,212,0.25)] hover:-translate-y-1.5 transition-all duration-500"
                        >
                            <SafeImage
                                src={category.imageUrl}
                                alt={category.name}
                                fill
                                className="object-cover transition-all duration-700 group-hover:scale-105 opacity-60 grayscale-[20%] group-hover:grayscale-0"
                                priority={index < 4}
                                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                            />
                            
                            {/* 漸層遮罩 */}
                            <div className="absolute inset-0 bg-gradient-to-t from-[#070b14] via-[#070b14]/50 to-transparent group-hover:via-cyan-950/20 transition-all duration-500" />

                            {/* 剩餘卡片統計標籤 */}
                            <div className="absolute top-3.5 left-3.5 z-10">
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-950/80 backdrop-blur-md border border-cyan-500/30 text-cyan-300 text-[11px] font-bold shadow-lg">
                                    <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                                    待挑戰 {category.availableCount} 張
                                </span>
                            </div>

                            {/* 進入箭頭 */}
                            <div className="absolute top-3.5 right-3.5 z-10 w-8 h-8 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 group-hover:border-cyan-400 group-hover:bg-cyan-500 text-slate-400 group-hover:text-slate-950 flex items-center justify-center transition-all duration-300 shadow-lg">
                                <ChevronRight className="w-4 h-4" />
                            </div>

                            {/* 分類名稱 */}
                            <div className="absolute inset-x-0 bottom-0 p-5 flex flex-col justify-end">
                                <h3 className="font-headline text-lg sm:text-xl font-black text-white tracking-tight group-hover:text-cyan-300 transition-colors drop-shadow-md truncate">
                                    {category.name}
                                </h3>
                                <div className="flex items-center justify-between text-xs text-slate-400 mt-1">
                                    <span>總卡量 {category.totalCount} 張</span>
                                    <span className="text-cyan-400 font-bold group-hover:translate-x-1 transition-transform flex items-center gap-1">
                                        立即進入 <ArrowRight className="w-3 h-3" />
                                    </span>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            {/* 全部卡片展示與快速下注區塊 */}
            <div className="container px-4 md:px-8 mt-16 md:mt-20">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
                    <div>
                        <div className="flex items-center gap-2 text-cyan-400 text-xs font-black tracking-widest uppercase mb-1">
                            <Package className="w-4 h-4" />
                            ALL CARDS POOL
                        </div>
                        <h2 className="text-xl md:text-2xl font-black font-headline text-white tracking-tight">
                            全部卡片展示 ({cardsInBetting.length})
                        </h2>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        {/* 搜尋框 */}
                        <div className="relative w-full sm:w-64">
                            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="搜尋卡片名稱..." 
                                className="pl-9 h-10 bg-slate-950/60 rounded-xl border-slate-800 text-xs text-slate-200" 
                                value={searchTerm} 
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* 狀態過濾 */}
                        <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs w-full sm:w-auto justify-center">
                            <button
                                onClick={() => setStatusFilter('all')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg font-bold transition-colors",
                                    statusFilter === 'all' ? "bg-slate-800 text-white" : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                全部
                            </button>
                            <button
                                onClick={() => setStatusFilter('available')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg font-bold transition-colors",
                                    statusFilter === 'available' ? "bg-cyan-950/80 text-cyan-300 border border-cyan-500/30" : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                待挑戰
                            </button>
                            <button
                                onClick={() => setStatusFilter('sold')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg font-bold transition-colors",
                                    statusFilter === 'sold' ? "bg-rose-950/80 text-rose-300 border border-rose-500/30" : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                已抽出
                            </button>
                        </div>

                        {/* 排序 */}
                        <Select value={sortOption} onValueChange={(val) => setSortOption(val as any)}>
                            <SelectTrigger className="h-10 bg-slate-950/80 border-slate-800 rounded-xl font-bold text-slate-200 text-xs w-[120px]">
                                <SelectValue placeholder="排序方式" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200 rounded-xl">
                                <SelectItem value="latest" className="font-bold cursor-pointer">推薦熱門</SelectItem>
                                <SelectItem value="price-high" className="font-bold cursor-pointer">價格：高至低</SelectItem>
                                <SelectItem value="price-low" className="font-bold cursor-pointer">價格：低至高</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                    {finalIsLoading && Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-[2.5/4] rounded-2xl bg-slate-900/80 border border-slate-800" />
                    ))}
                    {!finalIsLoading && cardsInBetting.map((card) => {
                        const isSold = soldCardIdsSet.has(card.id) || card.isSold;
                        const singleSpotPrice = Math.max(1, Math.round((card.sellPrice || 0) * 0.1));
                        
                        return (
                            <BettingGameDialog 
                                key={card.id} 
                                card={{ ...card, category: card.category || 'all' }} 
                                categoryName={encodeURIComponent(card.category || 'all')} 
                                disabled={isSold}
                            >
                                <div className={cn(
                                    "relative aspect-[2.5/4] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/90 cursor-pointer hover:border-cyan-500/60 hover:shadow-[0_0_25px_rgba(6,182,212,0.2)] transition-all duration-300 group p-1.5 flex flex-col justify-between",
                                    isSold && "opacity-50 grayscale cursor-not-allowed hover:border-slate-800"
                                )}>
                                    <div className="relative w-full aspect-[2.5/3.5] rounded-xl overflow-hidden bg-slate-950 mb-1.5">
                                        <SafeImage 
                                            src={card.imageUrl} 
                                            alt={card.name} 
                                            fill 
                                            className="object-contain p-1 group-hover:scale-105 transition-transform duration-500" 
                                            sizes="(max-width: 768px) 50vw, 16vw" 
                                        />

                                        {/* 單注價格 */}
                                        {!isSold && (
                                            <div className="absolute top-1.5 left-1.5 bg-slate-950/85 backdrop-blur-md text-[9px] font-black tracking-widest text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/30 pointer-events-none z-20 flex items-center gap-1">
                                                <Gem className="w-2.5 h-2.5 text-cyan-400" />
                                                <span>{singleSpotPrice}</span>
                                            </div>
                                        )}

                                        {/* 已售出標籤 */}
                                        {isSold && (
                                            <div className="absolute inset-0 flex items-center justify-center p-2 z-10 bg-slate-950/70 backdrop-blur-[1px]">
                                                <span className="text-[10px] font-black text-rose-200 bg-rose-950/90 border border-rose-500/80 px-2.5 py-1 rounded-md rotate-[-12deg] shadow-lg uppercase tracking-wider">
                                                    已被抽出
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 卡片標題與底部按鈕 */}
                                    <div className="px-1 text-center">
                                        <p className="text-[11px] font-bold text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                                            {card.name}
                                        </p>
                                        <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400">
                                            <span>原價 {card.sellPrice?.toLocaleString()}💎</span>
                                            <span className={cn("font-bold", isSold ? "text-slate-500" : "text-cyan-400")}>
                                                {isSold ? '已抽完' : '去拼卡 →'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </BettingGameDialog>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
