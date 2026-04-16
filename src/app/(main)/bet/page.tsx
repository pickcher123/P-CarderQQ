'use client';

import { BettingGameDialog } from '@/components/betting-game-dialog';
import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/safe-image';
import { useCollection, useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, query, getDocs, orderBy, doc, getDoc, runTransaction, increment, serverTimestamp, where } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { CrossedCardsIcon, PPlusIcon } from '@/components/icons';
import { Info, Sparkles, Gem, HelpCircle, Gift, ShoppingBag, Loader2, Truck, Check, Package, Settings, ChevronRight, Swords, Target, RefreshCw, ShieldCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { UserProfile } from '@/types/user-profile';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
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
    imageUrl: string;
    isFeatured?: boolean;
    isSold?: boolean;
}

interface CategoryWithCount extends BettingCategory {
    itemCount: number;
}

export default function BetLandingPage() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [categoriesWithCounts, setCategoriesWithCounts] = useState<CategoryWithCount[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

    const categoriesQuery = useMemoFirebase(() => {
        if(!firestore) return null;
        return query(collection(firestore, 'bettingCategories'), orderBy('order', 'asc'));
    }, [firestore]);

    const { data: categories, isLoading: isLoadingCategories } = useCollection<BettingCategory>(categoriesQuery);

    const bettingItemsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]);
    const { data: allBettingItems } = useCollection<BettingItems>(bettingItemsCollectionRef);

    const allCardsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]);
    const { data: allCards } = useCollection<CardData>(allCardsCollectionRef);

    const cardsInBetting = useMemo(() => {
        if (!allCards || !allBettingItems) return [];
        const cardIdsInBetting = new Set<string>();
        allBettingItems.forEach(item => {
            item.allCardIds?.forEach(id => cardIdsInBetting.add(id));
        });
        return allCards.filter(card => cardIdsInBetting.has(card.id));
    }, [allCards, allBettingItems]);

    useEffect(() => {
        const fetchItemCounts = async () => {
            if (!categories || !firestore) return;

            setIsLoading(true);
            try {
                const sortedCategories = [...categories].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
                const counts = await Promise.all(
                    sortedCategories.map(async (category) => {
                        const itemDocRef = doc(firestore, 'betting-items', category.id);
                        const itemDocSnap = await getDoc(itemDocRef);
                        let count = 0;
                        if(itemDocSnap.exists()){
                            const data = itemDocSnap.data() as BettingItems;
                            const availableCount = (data.allCardIds?.length || 0) - (data.soldCardIds?.length || 0);
                            count = availableCount;
                        }
                        return {
                            ...category,
                            itemCount: count
                        };
                    })
                );
                setCategoriesWithCounts(counts);
            } catch (error) {
                console.error("Error fetching item counts: ", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (!isLoadingCategories && categories) {
            fetchItemCounts();
        }
    }, [categories, firestore, isLoadingCategories]);

    const finalIsLoading = isLoadingCategories || isLoading;

    if (!finalIsLoading && systemConfig?.featureFlags?.isBettingEnabled === false) {
        return (
            <div className="container py-32 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in-up">
                <div className="p-10 rounded-full bg-destructive/10 border border-destructive/20 animate-pulse shadow-[0_0_50px_rgba(219,39,119,0.2)]">
                    <Settings className="w-20 h-20 text-destructive" />
                </div>
                <div className="space-y-3">
                    <h2 className="text-4xl font-black font-headline tracking-widest text-white italic">專區維護中</h2>
                    <p className="text-muted-foreground font-medium max-w-md mx-auto leading-relaxed">
                        拼卡專區目前正在進行機率演算法優化與系統升級，為了確保公平性，暫時停止服務。
                    </p>
                </div>
                <Button asChild variant="outline" className="h-12 px-10 rounded-xl border-destructive/30 hover:bg-destructive/5 font-bold transition-all">
                    <Link href="/">返回榮耀大廳</Link>
                </Button>
            </div>
        )
    }

    const cardOpacity = systemConfig?.cardOpacity ?? 0.85;

    return (
        <div className="container py-8 md:py-16 relative overflow-hidden px-4 md:px-8">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-destructive/5 blur-[120px] pointer-events-none" />

            <div className="text-center mb-6 md:mb-8 relative z-10 space-y-4">
                <div className="flex justify-center">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-[10px] md:text-sm font-bold tracking-[0.2em] uppercase animate-fade-in-up">
                        <Swords className="w-3 h-3 md:w-4 md:h-4 text-accent animate-pulse" /> ONE SPIN, ONE DESTINY
                    </div>
                </div>
                
            </div>

            {/* 直觀遊戲規則區塊 - 手機版四宮格美化版 */}
            <div className="max-w-6xl mx-auto mb-12 md:mb-16 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-6">
                    {[
                        { title: '1/10 命中率', desc: '每注固定 10% 機率直接帶走卡片', icon: Target, color: 'text-primary', bg: 'bg-primary/10' },
                        { title: '雙幣別支付', desc: '支援使用鑽石或紅利 P+ 參與', icon: RefreshCw, color: 'text-accent', bg: 'bg-accent/10' },
                        { title: '1:10 價值比', desc: '鑽石與 P+ 點比例固定 1:10', icon: Gem, color: 'text-destructive', bg: 'bg-destructive/10' },
                        { title: '資產即時發放', desc: '中獎後卡片立即存入數位收藏庫', icon: ShieldCheck, color: 'text-green-400', bg: 'bg-green-400/10' },
                    ].map((item, idx) => (
                        <div key={idx} className="relative p-4 md:p-8 rounded-2xl md:rounded-[2rem] bg-card/40 backdrop-blur-xl border border-white/10 flex flex-col items-center text-center group hover:border-white/20 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1">
                            <div className={cn("p-3 md:p-4 rounded-xl md:rounded-2xl mb-3 md:mb-6 transition-transform duration-500 group-hover:scale-110 shadow-inner", item.bg, item.color)}>
                                <item.icon className="w-6 h-6 md:w-10 md:h-10" />
                            </div>
                            <h4 className="text-xs md:text-xl font-black text-white mb-1 md:mb-3 tracking-tight font-headline">{item.title}</h4>
                            <p className="text-[10px] md:text-sm text-muted-foreground font-medium leading-relaxed line-clamp-2">{item.desc}</p>
                            <div className={cn("absolute inset-0 rounded-2xl md:rounded-[2rem] opacity-0 group-hover:opacity-10 transition-opacity bg-gradient-to-br", item.bg)} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="mb-6 md:mb-10 flex items-center justify-between animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <h2 className="flex items-center text-base md:text-xl font-bold font-headline text-white tracking-widest uppercase">
                    <CrossedCardsIcon className="w-4 h-4 md:w-6 md:h-6 mr-3 text-destructive animate-pulse" />
                    選擇主題
                </h2>
                <div className="h-px flex-1 mx-4 md:mx-6 bg-gradient-to-r from-destructive/30 to-transparent hidden md:block" />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-7xl mx-auto mb-20">
                 {finalIsLoading && Array.from({length: 4}).map((_, i) => (
                    <div key={i} className="aspect-[16/9] rounded-[1.5rem] md:rounded-[3rem] overflow-hidden">
                        <Skeleton className="w-full h-full" />
                    </div>
                ))}
                {!finalIsLoading && categoriesWithCounts.map((category, index) => (
                    <Link 
                        href={`/bet/${encodeURIComponent(category.id)}`} 
                        key={category.id} 
                        className={cn(
                            "group relative aspect-[16/9] rounded-[1.5rem] md:rounded-[3rem] overflow-hidden block border border-white/10 transition-all duration-500",
                            "hover:border-destructive/50 hover:shadow-[0_0_50px_rgba(219,39,119,0.3)] hover:-translate-y-2",
                            "animate-fade-in-up"
                        )}
                        style={{ backgroundColor: `hsl(var(--card) / ${cardOpacity})` }}
                    >
                        <SafeImage
                            src={category.imageUrl}
                            alt={category.name}
                            fill
                            className="object-cover transition-all duration-1000 group-hover:scale-110 opacity-60 grayscale-[30%] group-hover:grayscale-0"
                            priority={index < 4}
                            sizes="(max-width: 768px) 50vw, 50vw"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/20 to-transparent group-hover:via-destructive/5 transition-all duration-500" />
                        
                        <div className="absolute top-3 right-3 md:top-6 md:right-6 flex gap-1 md:gap-2 opacity-10 group-hover:opacity-30 transition-opacity">
                            <div className="w-3 h-3 md:w-6 md:h-6 rounded-full bg-destructive" />
                            <div className="w-3 h-3 md:w-6 md:h-6 rounded-full bg-slate-800" />
                        </div>

                        <div className="absolute inset-0 flex flex-col items-center justify-center p-4 md:p-12 text-center">
                            <div className="transform transition-transform duration-500 group-hover:translate-y-[-5px] w-full px-2">
                                <h3 className="font-headline text-lg lg:text-3xl xl:text-5xl font-black text-white tracking-tighter drop-shadow-[0_2px_15px_rgba(0,0,0,0.8)] group-hover:text-destructive transition-colors truncate">
                                    {category.name}
                                </h3>
                            </div>
                        </div>
                    </Link>
                ))}
            </div>

            {/* 全部卡片展示區 - 優化版 */}
            <div className="mb-4 md:mb-6 flex items-center justify-end animate-fade-in-up">
                <div className="h-px flex-1 mr-4 md:mr-6 bg-gradient-to-l from-primary/30 to-transparent hidden md:block" />
                <h2 className="flex items-center text-sm md:text-lg font-bold font-headline text-white tracking-widest uppercase">
                    全部卡片
                    <Package className="w-3 h-3 md:w-5 md:h-5 ml-3 text-primary animate-pulse" />
                </h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 max-w-7xl mx-auto">
                {!allBettingItems && Array.from({length: 6}).map((_, i) => <Skeleton key={i} className="aspect-[2.5/4] rounded-[1.5rem]" />)}
                {cardsInBetting?.slice(0, 12).map((card) => (
                    <BettingGameDialog key={card.id} card={{...card, category: 'all'}} categoryName={encodeURIComponent('all')}>
                        <div className="relative aspect-[2.5/4] rounded-[1.5rem] overflow-hidden border border-white/10 bg-slate-900 cursor-pointer hover:border-primary transition-all">
                            <SafeImage src={card.imageUrl} alt={card.name} fill className="object-cover" sizes="(max-width: 768px) 50vw, 16vw" />
                        </div>
                    </BettingGameDialog>
                ))}
            </div>

            <div className="mt-20 text-center flex flex-col items-center opacity-20">
                <p className="text-[10px] md:text-[12px] text-muted-foreground font-headline uppercase tracking-[0.5em] origin-center scale-[0.2]">P+Carder Official Security Protocol • Verified Asset</p>
            </div>
        </div>
    )
}
