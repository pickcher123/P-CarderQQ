'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/safe-image';
import { Button } from '@/components/ui/button';
import { Layers, Gem, Package, Disc3, Info, Sparkles, ChevronRight, Star, Trophy, Clock, Settings, Dices, Target, Search, X } from 'lucide-react';
import { useCollection, useRequest, useFirestore, useMemoFirebase, useDoc, useUser } from "@/firebase";
import { collection, query, orderBy, doc } from "firebase/firestore";
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';
import { PoolCard } from '@/components/pool-card';
import type { SystemConfig } from '@/types/system';
import { HallOfFameMarquee } from '@/components/hall-of-fame-marquee';
import { RevolvingDoorThemeCarousel } from '@/components/revolving-door-theme-carousel';

interface DrawCategory {
    id: string;
    name: string;
    imageUrl: string;
    order?: number;
    linkUrl?: string;
    isActive?: boolean;
}

interface CardPool {
    id: string;
    name: string;
    description: string;
    price?: number;
    price3Draws?: number;
    totalPacks?: number;
    remainingPacks?: number;
    hasProtection?: boolean;
    isFeatured?: boolean;
    isActive?: boolean;
    currency?: 'diamond' | 'p-point';
    cardRarities?: { [cardId: string]: any };
    cards?: { cardId: string; quantity: number }[];
    pointPrizes?: any[];
    lastPrizeCardId?: string;
    imageUrl?: string;
    startsAt?: { seconds: number; nanoseconds: number; };
    expiresAt?: { seconds: number; nanoseconds: number; };
    lockedBy?: string;
    lockedAt?: { seconds: number; nanoseconds: number; };
    categoryId?: string;
}

interface CategoryWithCount extends DrawCategory {
    poolCount: number;
}

export default function DrawPage() {
  const firestore = useFirestore();
  const { user } = useUser();
  const { data: userProfile } = useDoc<any>(useMemoFirebase(() => (user?.uid ? doc(firestore, 'users', user.uid) : null), [user?.uid, firestore]));
  const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryWithCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'drawCategories'), orderBy('order', 'asc'));
  }, [firestore]);

  const { data: categories, isLoading: isLoadingCategories } = useCollection<DrawCategory>(categoriesQuery);
  const { data: cardPools, isLoading: isLoadingPools } = useCollection<CardPool>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));
  
  const { data: allCards } = useRequest<{id: string, name: string, imageUrl: string, isSold?: boolean}[]>(useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]));

  const allCardsMap = useMemo(() => {
    if (!allCards) return new Map();
    return new Map(allCards.map(c => [c.id, c as any]));
  }, [allCards]);

  useEffect(() => {
      if (categories && cardPools) {
          const sortedCategories = [...categories].filter(c => c.isActive !== false).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
          
          const counts = sortedCategories.map(category => {
              const count = cardPools.filter(pool => pool.categoryId === category.id).length;
              return { ...category, poolCount: count };
          });
          setCategoriesWithCounts(counts);
          setIsLoading(false);
      }
  }, [categories, cardPools]);

  const [sortOption, setSortOption] = useState<'price-high' | 'price-low' | 'latest'>('latest');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');

  const allPools = useMemo(() => {
    if (!cardPools || cardPools.length === 0) return [];
    const now = Math.floor(Date.now() / 1000);
    const pools = cardPools.filter(p => 
        (p.remainingPacks ?? 0) > 0 && 
        (!p.expiresAt || p.expiresAt.seconds > now) &&
        (!p.startsAt || p.startsAt.seconds < now) &&
        (p.isActive !== false)
    );
    
    return pools.sort((a, b) => {
        if (sortOption === 'price-high') return (b.price ?? 0) - (a.price ?? 0);
        if (sortOption === 'price-low') return (a.price ?? 0) - (b.price ?? 0);
        return 0;
    });
  }, [cardPools, sortOption]);

  const displayPools = useMemo(() => {
    let list = allPools;
    if (selectedCategoryTab === 'featured') {
      list = list.filter(p => p.isFeatured);
    } else if (selectedCategoryTab !== 'all') {
      list = list.filter(p => p.categoryId === selectedCategoryTab);
    }
    if (searchKeyword.trim()) {
      const q = searchKeyword.toLowerCase();
      list = list.filter(p => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q));
    }
    return list;
  }, [allPools, selectedCategoryTab, searchKeyword]);

  const finalIsLoading = isLoadingCategories || isLoadingPools || isLoading;

  if (!finalIsLoading && systemConfig?.featureFlags?.isDrawEnabled === false) {
    return (
        <div className="container py-32 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in-up">
            <div className="p-10 rounded-full bg-primary/10 border border-primary/20 animate-pulse shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                <Settings className="w-20 h-20 text-primary" />
            </div>
            <div className="space-y-3">
                <h2 className="text-4xl font-black font-headline tracking-widest text-white italic">維護中</h2>
                <p className="text-muted-foreground font-medium max-w-md mx-auto leading-relaxed">
                    為了提供更流暢的開獎體驗，抽卡正在進行伺服器優化與系統升級，請稍後再試。
                </p>
            </div>
            <Button asChild variant="outline" className="h-12 px-10 rounded-xl border-primary/30 hover:bg-primary/5 font-bold transition-all">
                <Link href="/">返回榮耀大廳</Link>
            </Button>
        </div>
    );
  }

  return (
    <div className="container pt-3 sm:pt-6 md:pt-8 pb-36 sm:pb-40 md:pb-24 relative overflow-hidden px-3 sm:px-4 md:px-8 max-w-7xl mx-auto">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-gradient-to-b from-amber-500/10 via-cyan-500/5 to-transparent blur-[120px] pointer-events-none" />
        
        {/* === HERO SECTION: 頂級抽卡專區 === */}
        <div className="relative rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] p-3.5 sm:p-6 md:p-8 overflow-hidden border border-amber-500/25 bg-gradient-to-b from-[#19150d]/90 via-[#120f0a]/95 to-[#080604] shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl mb-5 sm:mb-8">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#f59e0b10_1px,transparent_1px),linear-gradient(to_bottom,#f59e0b10_1px,transparent_1px)] bg-[size:32px_32px] opacity-60 pointer-events-none" />
            
            {/* Top Glow Accent Bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#f59e0b]" />
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-6 md:gap-12">
                <div className="space-y-2 sm:space-y-3 text-center lg:text-left max-w-2xl">
                    <h1 className="font-headline text-2xl sm:text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-cyan-300 drop-shadow-[0_0_20px_rgba(245,158,11,0.4)] tracking-tight leading-none uppercase">
                        頂級抽卡專區
                    </h1>

                    <p className="text-xs sm:text-sm md:text-base text-slate-300 font-medium leading-normal">
                        精選稀有頂級球員卡池，透明機率機制，開出大獎直接入庫或折現。
                    </p>

                    {/* Rules Quick Dialog Button */}
                    <div className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-2">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="h-8 sm:h-10 px-4 sm:px-5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs sm:text-sm font-black shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all gap-1.5 group cursor-pointer">
                                    <Dices className="w-3.5 h-3.5 text-slate-950 group-hover:rotate-45 transition-transform" />
                                    <span>遊戲規則</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-[2rem] bg-slate-950 border border-amber-500/30 text-white max-w-2xl backdrop-blur-2xl shadow-2xl">
                                <DialogHeader>
                                    <DialogTitle className="text-xl md:text-2xl font-black text-amber-400 flex items-center gap-2 font-headline">
                                        <Target className="w-6 h-6 text-amber-400" />
                                        抽卡遊戲規則說明
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 text-xs md:text-sm text-slate-300 leading-relaxed py-2">
                                    <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-amber-500/20 space-y-3.5">
                                        <p className="flex items-start gap-3">
                                            <span className="text-amber-400 font-black font-mono text-base shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">01</span>
                                            <span className="text-xs sm:text-sm text-slate-200">玩家消耗點數或鑽石從主題卡池中抽取獎品。</span>
                                        </p>
                                        <p className="flex items-start gap-3">
                                            <span className="text-amber-400 font-black font-mono text-base shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">02</span>
                                            <span className="text-xs sm:text-sm text-slate-200">每個卡池包含一組特定的卡片和點數獎項，每個獎項都有不同的稀有度與大獎配置。</span>
                                        </p>
                                        <p className="flex items-start gap-3">
                                            <span className="text-amber-400 font-black font-mono text-base shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">03</span>
                                            <span className="text-xs sm:text-sm text-slate-200">每個稀有度與大賞的中獎機率都會在卡池資訊中明確標示，公開透明。</span>
                                        </p>
                                        <p className="flex items-start gap-3">
                                            <span className="text-amber-400 font-black font-mono text-base shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">04</span>
                                            <span className="text-xs sm:text-sm text-slate-200">抽出的卡片會即時存入您的「數位收藏庫」，可申請寄送到府或直接折現轉換紅利。</span>
                                        </p>
                                        <p className="flex items-start gap-3">
                                            <span className="text-amber-400 font-black font-mono text-base shrink-0 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">05</span>
                                            <span className="text-xs sm:text-sm text-slate-200">
                                                <span className="text-cyan-400 font-bold mr-1">公平開獎保護</span>：具備開獎防衝撞鎖定機制，保障全體玩家操作流暢度。
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* 開放中卡池 - 放在遊戲規則右邊 */}
                        <div className="h-8 sm:h-10 px-3 sm:px-4 rounded-lg sm:rounded-xl bg-[#0b1329]/90 border border-amber-500/35 flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.15)] backdrop-blur-sm">
                            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />
                            <span className="text-xs sm:text-sm text-slate-300 font-medium">開放中卡池</span>
                            <span className="font-headline font-black text-amber-400 text-sm sm:text-base px-1.5 py-0.5 bg-amber-400/10 rounded-md border border-amber-400/20 leading-none">
                                {finalIsLoading ? '--' : allPools.length}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* 傳奇大獎牆區塊 */}
        <div className="mb-4 sm:mb-6">
            <HallOfFameMarquee />
        </div>
        
        {/* 3D 旋轉門主題呈現專區 */}
        <div className="mb-8 sm:mb-12">
            <RevolvingDoorThemeCarousel
                categories={categoriesWithCounts}
                isLoading={finalIsLoading}
                baseHref="/draw"
            />
        </div>

        {/* 全部卡池專區 */}
        {!finalIsLoading && (
            <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
                {/* 頂部 Header & 控制列 (整合即時搜尋與排序) */}
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900/95 via-slate-950/95 to-slate-900/95 border border-slate-800/80 backdrop-blur-xl flex flex-col gap-3 shadow-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 text-amber-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base sm:text-lg font-black font-headline text-white tracking-widest">
                                        全部卡池機台
                                    </h2>
                                    <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                                        共 {displayPools.length} 款
                                    </span>
                                </div>
                                <p className="text-[11px] text-slate-400 hidden sm:block">即時連線機台 · 公平公正透明抽取 · 支援一番賞挑籤</p>
                            </div>
                        </div>

                        {/* 搜尋欄與排序器 */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {/* 搜尋卡池 */}
                            <div className="relative flex-1 sm:w-52">
                                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={searchKeyword}
                                    onChange={(e) => setSearchKeyword(e.target.value)}
                                    placeholder="搜尋卡池名稱..."
                                    className="w-full bg-slate-900/90 text-xs text-white pl-8 pr-7 py-1.5 rounded-xl border border-slate-800 focus:border-amber-400 focus:outline-none transition-colors placeholder:text-slate-500 shadow-inner"
                                />
                                {searchKeyword && (
                                    <button
                                        type="button"
                                        onClick={() => setSearchKeyword('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                )}
                            </div>

                            {/* 排序選擇器 */}
                            <div className="relative shrink-0">
                                <select 
                                    className="appearance-none bg-slate-900 text-xs font-bold text-slate-200 pl-3 pr-7 py-1.5 rounded-xl border border-slate-700/80 hover:border-amber-400/60 focus:border-amber-400 focus:outline-none transition-colors cursor-pointer shadow-sm"
                                    value={sortOption}
                                    onChange={(e) => setSortOption(e.target.value as any)}
                                >
                                    <option value="latest">⚡ 最新上架</option>
                                    <option value="price-high">💎 點數高至低</option>
                                    <option value="price-low">🪙 點數低至高</option>
                                </select>
                                <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                                    ▼
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 快速分類切換膠囊 (手機版支援平滑橫向滾動，電腦版整齊排列) */}
                    <div className="pt-2 border-t border-slate-800/70 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth">
                        <button
                            type="button"
                            onClick={() => setSelectedCategoryTab('all')}
                            className={cn(
                                "px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 border",
                                selectedCategoryTab === 'all'
                                    ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-[1.02]"
                                    : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700"
                            )}
                        >
                            全部卡池 ({allPools.length})
                        </button>

                        <button
                            type="button"
                            onClick={() => setSelectedCategoryTab('featured')}
                            className={cn(
                                "px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 border flex items-center gap-1",
                                selectedCategoryTab === 'featured'
                                    ? "bg-gradient-to-r from-amber-500 to-rose-500 text-slate-950 border-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)] scale-[1.02]"
                                    : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700"
                            )}
                        >
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>HOT 精選 ({allPools.filter(p => p.isFeatured).length})</span>
                        </button>

                        {categoriesWithCounts.map(cat => (
                            <button
                                key={cat.id}
                                type="button"
                                onClick={() => setSelectedCategoryTab(cat.id)}
                                className={cn(
                                    "px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap shrink-0 border",
                                    selectedCategoryTab === cat.id
                                        ? "bg-cyan-500 text-slate-950 border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.3)] scale-[1.02]"
                                        : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700"
                                )}
                            >
                                {cat.name} ({cat.poolCount})
                            </button>
                        ))}
                    </div>
                </div>

                {/* 卡池列表 (手機版 max-w-md 居中適配防拉扯，電腦版 2~3 欄優雅展示) */}
                {displayPools.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-7 max-w-md sm:max-w-none mx-auto">
                        {displayPools.map((pool) => (
                            <div key={pool.id} className="relative w-full">
                                {pool.isFeatured && (
                                    <div className="absolute -top-2.5 -left-2 z-20">
                                        <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-[0_4px_12px_rgba(245,158,11,0.4)] border border-amber-200/50 uppercase tracking-wider flex items-center gap-1">
                                            <Sparkles className="w-3 h-3 fill-slate-950" />
                                            <span>HOT 精選</span>
                                        </div>
                                    </div>
                                )}
                                <PoolCard pool={pool} allCardsMap={allCardsMap} userProfile={userProfile} />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="py-14 text-center bg-slate-950/40 rounded-3xl border border-dashed border-slate-800 p-8 space-y-3 max-w-lg mx-auto">
                        <Package className="w-10 h-10 text-slate-600 mx-auto animate-pulse" />
                        <h3 className="text-base font-bold text-slate-300">
                            {searchKeyword || selectedCategoryTab !== 'all' ? '未找到符合條件的卡池' : '目前暫無開放中的卡池'}
                        </h3>
                        <p className="text-xs text-slate-500">
                            {searchKeyword || selectedCategoryTab !== 'all' ? '您可以嘗試清除搜尋關鍵字或切換其他分類' : '新卡池正在籌備中，敬請期待最新公告！'}
                        </p>
                        {(searchKeyword || selectedCategoryTab !== 'all') && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    setSearchKeyword('');
                                    setSelectedCategoryTab('all');
                                }}
                                className="mt-2 text-xs rounded-xl border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                            >
                                重設篩選條件
                            </Button>
                        )}
                    </div>
                )}
            </div>
        )}

        <div className="mt-12 text-center flex flex-col items-center opacity-20">
            <p className="text-[10px] md:text-[12px] text-muted-foreground font-headline uppercase tracking-[0.5em] origin-center scale-[0.2]">P+Carder Official Terminal • Link Stable • Secure Protocol</p>
        </div>
    </div>
  );
}
