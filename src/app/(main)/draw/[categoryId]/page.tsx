'use client';

import { useState, useMemo, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from "@/firebase";
import { collection, query, where, doc } from "firebase/firestore";
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Package, Sparkles, Disc3, Info, Search, XCircle, ChevronRight, Filter } from 'lucide-react';
import { PoolCard } from '@/components/pool-card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from '@/lib/utils';

interface CardPool {
  id: string;
  name: string;
  description: string;
  price?: number;
  price3Draws?: number;
  totalPacks?: number;
  remainingPacks?: number;
  categoryId?: string;
  order?: number;
}

interface DrawCategory {
    id: string;
    name: string;
    imageUrl: string;
    order?: number;
}

export default function DrawCategoryPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const params = useParams();
    const categoryId = params.categoryId as string;
    const { user } = useUser();
    const { data: userProfile } = useDoc<any>(useMemoFirebase(() => (user?.uid ? doc(firestore, 'users', user.uid) : null), [user?.uid, firestore]));
    
    const [searchTerm, setSearchTerm] = useState('');
    const [sortOption, setSortOption] = useState<'price-high' | 'price-low' | 'latest'>('latest');

    // 獲取當前分類詳細資訊
    const categoryRef = useMemoFirebase(() => firestore && categoryId ? doc(firestore, 'drawCategories', decodeURIComponent(categoryId)) : null, [firestore, categoryId]);
    const { data: categoryData, isLoading: isLoadingCategory } = useDoc<{name: string}>(categoryRef);

    // 獲取所有分類（用於下拉切換）
    const allCategoriesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'drawCategories') : null, [firestore]);
    const { data: allCategories } = useCollection<DrawCategory>(allCategoriesQuery);

    // 獲取該分類下的所有卡池
    const poolsQuery = useMemoFirebase(() => {
        if (!firestore || !categoryId) return null;
        return query(
            collection(firestore, 'cardPools'),
            where('categoryId', '==', decodeURIComponent(categoryId))
        );
    }, [firestore, categoryId]);

    const { data: rawPools, isLoading: isLoadingPools } = useCollection<CardPool>(poolsQuery);
    
    // 獲取卡片模板數據供卡池預覽使用
    const { data: allCards } = useCollection<{id: string, name: string, imageUrl: string, backImageUrl?: string}>(
        useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore])
    );

    const allCardsMap = useMemo(() => {
        if (!allCards) return new Map();
        return new Map(allCards.map(c => [c.id, c as any]));
    }, [allCards]);

    // 過濾與排序邏輯
    const filteredPools = useMemo(() => {
        if (!rawPools) return [];
        let pools = [...rawPools];
        
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            pools = pools.filter(p => p.name.toLowerCase().includes(term));
        }
        
        // Apply sorting
        if (sortOption === 'price-high') pools.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
        else if (sortOption === 'price-low') pools.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
        else pools.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        
        return pools;
    }, [rawPools, searchTerm, sortOption]);

    const isLoading = isLoadingPools || isLoadingCategory;

    return (
        <div className="container py-12 md:py-20 relative">
            {/* 背景裝飾光源 */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/5 blur-[120px] pointer-events-none" />

            {/* 右上角規則按鈕 */}
            <div className="absolute top-4 right-4 md:top-10 md:right-10 z-30">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9 w-9 md:w-auto px-0 md:px-4 rounded-full border-white/10 bg-white/5 backdrop-blur-md hover:bg-primary/10 hover:border-primary/30 text-white font-bold transition-all gap-2">
                            <Info className="h-4 w-4 text-primary" />
                            <span className="text-xs uppercase tracking-widest hidden md:inline">遊戲規則</span>
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="rounded-[2.5rem] bg-background/95 backdrop-blur-2xl border-primary/20 shadow-2xl">
                        <DialogHeader>
                            <DialogTitle className="text-2xl font-black font-headline text-primary italic tracking-tighter uppercase">抽卡規則說明</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-5 text-sm text-white/80 leading-relaxed py-2">
                            <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                                <p className="flex items-start gap-4">
                                    <span className="text-primary font-black font-code text-lg shrink-0">01.</span>
                                    <span>玩家消耗鑽石或 P 點從卡池中抽取獎品。</span>
                                </p>
                                <p className="flex items-start gap-4">
                                    <span className="text-primary font-black font-code text-lg shrink-0">02.</span>
                                    <span>中獎機率根據剩餘卡片與點數獎項即時計算。</span>
                                </p>
                                <p className="flex items-start gap-4">
                                    <span className="text-primary font-black font-code text-lg shrink-0">03.</span>
                                    <span>具備 120s 鎖定期保護，確保開獎過程不被干擾。</span>
                                </p>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* 置中標題區塊 */}
            <div className="text-center mb-8 md:mb-12 relative z-10 space-y-3">
                <div className="flex items-center justify-center animate-fade-in-up">
                    <h1 className="font-headline text-3xl sm:text-5xl md:text-6xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.35)]">
                        {isLoadingCategory ? <Skeleton className="h-12 w-48 mx-auto" /> : (categoryData?.name || decodeURIComponent(categoryId))}
                    </h1>
                </div>
            </div>

            {/* 過濾與功能列 */}
            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-950/90 to-slate-900/90 border border-slate-800/80 backdrop-blur-xl flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-8 sm:mb-10 shadow-lg animate-fade-in-up">
                {/* 返回按鈕 & 搜尋欄 */}
                <div className="flex items-center gap-2 flex-1">
                    <Button variant="ghost" size="sm" asChild className="hover:bg-white/5 font-bold text-slate-300 rounded-xl shrink-0 px-2.5">
                        <Link href="/draw"><ArrowLeft className="mr-1.5 h-4 w-4" /> 回分類</Link>
                    </Button>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            type="text"
                            placeholder="搜尋卡池名稱..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 pr-9 bg-slate-900/90 border-slate-700/80 rounded-xl text-xs sm:text-sm placeholder:text-slate-500 focus-visible:ring-amber-500/50"
                        />
                        {searchTerm && (
                            <button 
                                onClick={() => setSearchTerm('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                            >
                                <XCircle className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>

                {/* 排序與分類切換 */}
                <div className="flex items-center gap-2 sm:gap-3">
                    {/* 分類切換下拉 */}
                    {allCategories && allCategories.length > 0 && (
                        <div className="relative flex-1 sm:flex-initial">
                            <select
                                className="w-full sm:w-auto appearance-none bg-slate-900 text-xs font-bold text-slate-200 pl-3 pr-8 py-2 rounded-xl border border-slate-700/80 hover:border-amber-400/60 focus:border-amber-400 focus:outline-none transition-colors cursor-pointer"
                                value={decodeURIComponent(categoryId)}
                                onChange={(e) => router.push(`/draw/${encodeURIComponent(e.target.value)}`)}
                            >
                                {allCategories.map(cat => (
                                    <option key={cat.id} value={cat.id}>
                                        📁 {cat.name}
                                    </option>
                                ))}
                            </select>
                            <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                                ▼
                            </div>
                        </div>
                    )}

                    {/* 排序 */}
                    <div className="relative flex-1 sm:flex-initial">
                        <select
                            className="w-full sm:w-auto appearance-none bg-slate-900 text-xs font-bold text-slate-200 pl-3 pr-8 py-2 rounded-xl border border-slate-700/80 hover:border-amber-400/60 focus:border-amber-400 focus:outline-none transition-colors cursor-pointer"
                            value={sortOption}
                            onChange={(e) => setSortOption(e.target.value as any)}
                        >
                            <option value="latest">⚡ 最新上架</option>
                            <option value="price-high">💎 點數：由高至低</option>
                            <option value="price-low">🪙 點數：由低至高</option>
                        </select>
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-xs">
                            ▼
                        </div>
                    </div>
                </div>
            </div>

            {/* 卡池列表：調整為 1 行 2 個 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 max-w-7xl mx-auto">
                {isLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="aspect-[4/5] rounded-[2.5rem] overflow-hidden">
                            <Skeleton className="h-full w-full bg-indigo-900/20" />
                        </div>
                    ))
                ) : (
                    filteredPools.map(pool => (
                        <div key={pool.id} className="animate-fade-in-up">
                            <PoolCard pool={pool} allCardsMap={allCardsMap} userProfile={userProfile} />
                        </div>
                    ))
                )}
            </div>

            {/* 無資料顯示 */}
            {!isLoading && filteredPools.length === 0 && (
                <div className="py-32 text-center text-muted-foreground flex flex-col items-center gap-6 animate-fade-in-up">
                    <div className="p-8 rounded-full bg-muted/10 border border-dashed border-white/10">
                        <Package className="w-16 h-16 opacity-20" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-xl font-bold uppercase tracking-[0.2em] opacity-40">沒有符合搜尋條件的卡池</p>
                        <Button variant="link" onClick={() => setSearchTerm('')} className="text-primary font-bold">清除搜尋條件</Button>
                    </div>
                </div>
            )}

            <div className="text-center pt-20 pb-10 flex flex-col items-center opacity-20">
                <p className="text-[10px] md:text-[12px] text-muted-foreground font-headline uppercase tracking-[0.5em] origin-center scale-[0.2]">P+Carder Official Terminal • Link Stable • Secure Protocol</p>
            </div>
        </div>
    );
}
