'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/safe-image';
import { Button } from '@/components/ui/button';
import { Layers, Gem, Package, Disc3, Info, Sparkles, ChevronRight, Star, Trophy, Clock, Settings, Dices, Target } from 'lucide-react';
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
    <div className="container py-4 sm:py-8 md:py-10 relative overflow-hidden px-3 sm:px-4 md:px-8 max-w-7xl mx-auto">
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

                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg sm:rounded-xl bg-white/5 border border-amber-500/20 text-[11px] text-slate-300">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            <span>即時開獎入庫</span>
                        </div>
                    </div>
                </div>

                {/* Live Stats Widget */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full lg:w-auto shrink-0">
                    <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0b1329] border border-amber-500/30 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(245,158,11,0.15)] min-w-[100px] sm:min-w-[130px]">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">開放中卡池</span>
                        <span className="text-xl sm:text-3xl font-black font-headline text-amber-400 mt-0.5 sm:mt-1">
                            {finalIsLoading ? '--' : allPools.length}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">熱門主題專區</span>
                    </div>

                    <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0b1329] border border-cyan-500/30 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(6,182,212,0.15)] min-w-[100px] sm:min-w-[130px]">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">卡池總類別</span>
                        <span className="text-xl sm:text-3xl font-black font-headline text-cyan-400 mt-0.5 sm:mt-1">
                            {finalIsLoading ? '--' : categoriesWithCounts.length}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">球星分類主題</span>
                    </div>
                </div>
            </div>
        </div>

        {/* 傳奇大獎牆區塊 */}
        <div className="mb-4 sm:mb-6">
            <HallOfFameMarquee />
        </div>
        
        {/* 選擇主題卡池 Header */}
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-10 sm:mb-14 max-w-7xl mx-auto">
             {finalIsLoading && Array.from({length: 4}).map((_, i) => (
                <div key={i} className="aspect-[4/3] sm:aspect-[16/10] rounded-2xl overflow-hidden">
                    <Skeleton className="w-full h-full" />
                </div>
             ))}
            {!finalIsLoading && categoriesWithCounts.map((category, index) => {
                const name = category.name || '';
                let theme = {
                    glow: 'hover:shadow-[0_8px_25px_rgba(168,85,247,0.25)]',
                    border: 'border-purple-500/30 hover:border-purple-400/80',
                    accentText: 'group-hover:text-purple-300',
                    gradient: 'from-purple-950/60 via-slate-950/40 to-transparent',
                    ringColor: 'from-purple-500/40 to-indigo-500/10',
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
                        href={category.linkUrl || `/draw/${encodeURIComponent(category.id)}`} 
                        target={category.linkUrl ? "_blank" : undefined}
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
                            <span className="text-[9px] sm:text-[10px] font-mono font-bold text-slate-300 bg-black/75 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/15 shrink-0 shadow-sm">
                                {category.poolCount} 款
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

        {/* 全部卡池專區 */}
        {!finalIsLoading && (
            <div className="space-y-4 sm:space-y-6 animate-fade-in-up">
                {/* 頂部 Header & 排序控制列 */}
                <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-950/90 to-slate-900/90 border border-slate-800/80 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-amber-500/20 border border-cyan-500/30 text-amber-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                            <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base sm:text-lg font-black font-headline text-white tracking-widest">
                                    全部卡池
                                </h2>
                                <span className="text-[10px] font-bold text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded-full border border-cyan-500/30">
                                    共 {allPools.length} 款
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 hidden sm:block">即時連線機台 · 公平公正透明抽取</p>
                        </div>
                    </div>

                    {/* 排序選擇器 */}
                    <div className="flex items-center justify-between sm:justify-end gap-2 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-800">
                         <span className="text-xs text-slate-400 font-medium">排序方式</span>
                         <div className="relative">
                             <select 
                                className="appearance-none bg-slate-900 text-xs font-bold text-slate-200 pl-3 pr-8 py-1.5 rounded-xl border border-slate-700/80 hover:border-amber-400/60 focus:border-amber-400 focus:outline-none transition-colors cursor-pointer shadow-sm"
                                value={sortOption}
                                onChange={(e) => setSortOption(e.target.value as any)}
                             >
                                 <option value="latest">⚡ 最新上架</option>
                                 <option value="price-high">💎 點數：由高至低</option>
                                 <option value="price-low">🪙 點數：由低至高</option>
                             </select>
                             <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                                 ▼
                             </div>
                         </div>
                    </div>
                </div>

                {/* 卡池列表 */}
                {allPools.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-7xl mx-auto">
                        {allPools.map((pool) => (
                            <div key={pool.id} className="relative">
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
                    <div className="py-16 text-center bg-slate-950/40 rounded-3xl border border-dashed border-slate-800 p-8 space-y-3">
                        <Package className="w-12 h-12 text-slate-600 mx-auto animate-pulse" />
                        <h3 className="text-base font-bold text-slate-300">目前暫無開放中的卡池</h3>
                        <p className="text-xs text-slate-500">新卡池正在籌備中，敬請期待最新公告！</p>
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
