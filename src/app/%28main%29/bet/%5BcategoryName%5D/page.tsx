'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { collection, doc, serverTimestamp, increment, runTransaction, arrayUnion } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
    Gem, ArrowLeft, Search, Info, Disc3, Sparkles, XCircle, X, 
    ShieldCheck, Flame, Dices, Package, CheckCircle2, RotateCcw, ExternalLink
} from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { useParams, useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { BettingGameDialog } from '@/components/betting-game-dialog';
import { CardItem } from '@/components/card-item';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import type { UserProfile } from '@/types/user-profile';
import type { LevelBenefit } from '@/types/system';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Link from 'next/link';
import { userLevels } from '@/components/member-level-crown';
import { SafeImage } from '@/components/safe-image';

interface CardData {
    id: string;
    name: string;
    category?: string;
    rarity?: string;
    imageUrl: string;
    backImageUrl?: string;
    imageHint?: string;
    sellPrice?: number;
    isSold?: boolean;
    dailyLimit?: number;
    minLevel?: string;
    isFeatured?: boolean;
    lockedBy?: string;
    lockedAt?: any;
}

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

const DEFAULT_LEVELS = [
    { level: '新手收藏家', threshold: 0 },
    { level: '進階收藏家', threshold: 15000 },
    { level: '資深收藏家', threshold: 50000 },
    { level: '卡牌大師', threshold: 100000 },
    { level: '殿堂級玩家', threshold: 500000 },
    { level: '傳奇收藏家', threshold: 1000000 },
    { level: 'P+卡神', threshold: 2000000 },
];

function calculateLevel(totalSpent: number, benefits?: LevelBenefit[]): string {
    const levels = benefits && benefits.length > 0 ? benefits : DEFAULT_LEVELS;
    const validLevelNames = DEFAULT_LEVELS.map(l => l.level);
    const sorted = [...levels]
        .filter(l => validLevelNames.includes(l.level))
        .sort((a, b) => b.threshold - a.threshold);
    const matched = sorted.find(l => totalSpent >= l.threshold);
    return matched ? matched.level : DEFAULT_LEVELS[0].level;
}

export default function BetCategoryPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const params = useParams();
    const rawCategoryName = params?.categoryName as string;
    const categoryName = decodeURIComponent(rawCategoryName || '');

    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'sold'>('all');
    const [sortOption, setSortOption] = useState<'latest' | 'price-high' | 'price-low'>('latest');
    const [previewCard, setPreviewCard] = useState<CardData | null>(null);

    const categoriesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'bettingCategories') : null, [firestore]);
    const { data: categories } = useCollection<BettingCategory>(categoriesQuery);

    const currentCategory = useMemo(() => {
        return categories?.find(c => c.id === categoryName || c.name === categoryName);
    }, [categories, categoryName]);

    const bettingItemsRef = useMemoFirebase(() => (firestore && categoryName) ? doc(firestore, 'betting-items', categoryName) : null, [firestore, categoryName]);
    const { data: bettingItems, isLoading: isLoadingBettingItems } = useDoc<BettingItems>(bettingItemsRef);

    const allCardsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]);
    const { data: allCards, isLoading: isLoadingCards } = useCollection<CardData>(allCardsCollectionRef);

    const soldCardIds = useMemo(() => new Set(bettingItems?.soldCardIds || []), [bettingItems]);

    const filteredCards = useMemo(() => {
        if (!allCards || !bettingItems?.allCardIds) return [];
        const cardIdSet = new Set(bettingItems.allCardIds);
        let baseCards = allCards.filter(c => cardIdSet.has(c.id));

        // 狀態過濾
        if (statusFilter === 'available') {
            baseCards = baseCards.filter(c => !soldCardIds.has(c.id) && !c.isSold);
        } else if (statusFilter === 'sold') {
            baseCards = baseCards.filter(c => soldCardIds.has(c.id) || c.isSold);
        }

        // 搜尋
        if (searchTerm.trim()) {
            baseCards = baseCards.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }

        // 排序
        return baseCards.sort((a, b) => {
            if (sortOption === 'price-high') return (b.sellPrice || 0) - (a.sellPrice || 0);
            if (sortOption === 'price-low') return (a.sellPrice || 0) - (b.sellPrice || 0);
            return (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0);
        });
    }, [allCards, bettingItems, searchTerm, statusFilter, sortOption, soldCardIds]);

    const totalCardsCount = bettingItems?.allCardIds?.length || 0;
    const soldCardsCount = bettingItems?.soldCardIds?.length || 0;
    const availableCardsCount = Math.max(0, totalCardsCount - soldCardsCount);

    const isLoading = isLoadingCards || isLoadingBettingItems;

    return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 pb-24">
            {/* 頂部導航與標題橫幅 */}
            <div className="relative overflow-hidden border-b border-slate-800/80 bg-gradient-to-b from-cyan-950/20 via-[#070b14]/90 to-[#070b14] pt-6 pb-8 md:pt-10 md:pb-12">
                <div className="container px-4 md:px-8 relative z-10">
                    <div className="flex items-center justify-between gap-4 mb-6">
                        <Link 
                            href="/bet" 
                            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 hover:text-cyan-300 hover:border-cyan-500/40 text-xs font-bold transition-all shadow-md"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            返回主題列表
                        </Link>

                        {/* 遊戲規則彈窗按鈕 */}
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl border-cyan-500/30 bg-cyan-950/30 hover:bg-cyan-900/40 text-cyan-300 text-xs font-bold gap-2">
                                    <Info className="h-3.5 w-3.5 text-cyan-400" />
                                    <span>拼卡規則</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-3xl bg-slate-950 border-slate-800 border-2 text-slate-100 max-w-lg">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-black font-headline text-cyan-400 flex items-center gap-2">
                                        <Sparkles className="w-5 h-5 text-cyan-400" /> 拼卡遊戲規則
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-3 text-xs text-slate-300 leading-relaxed py-2">
                                    <div className="p-3.5 rounded-2xl bg-cyan-950/20 border border-cyan-500/20 space-y-1.5">
                                        <p className="font-bold text-cyan-300 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" /> 1/10 命中機制
                                        </p>
                                        <p className="text-slate-400 pl-3">
                                            系統每局隨機開出 1~10 號碼，只要您的選號包含開出號碼，即可 100% 贏得該卡牌！
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/20 space-y-1.5">
                                        <p className="font-bold text-purple-300 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-purple-400" /> 雙幣別自由切換
                                        </p>
                                        <p className="text-slate-400 pl-3">
                                            每注成本為卡片原價的 10%。支援以「鑽石 💎」或「紅利 P+ 點數 (1:10)」進行支付。
                                        </p>
                                    </div>
                                    <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-1.5">
                                        <p className="font-bold text-emerald-300 flex items-center gap-1.5">
                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> 即時資產發放
                                        </p>
                                        <p className="text-slate-400 pl-3">
                                            中獎後，卡片將直接存入您的個人收藏庫，並同步扣除卡池剩餘存量。
                                        </p>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>
                    </div>

                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                        <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 text-cyan-400 text-xs font-black tracking-widest uppercase">
                                <Flame className="w-4 h-4" />
                                THEME POOL
                            </div>
                            <h1 className="text-2xl sm:text-4xl md:text-5xl font-black font-headline tracking-tight text-white">
                                {currentCategory?.name || categoryName}
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-400">
                                專屬主題卡池，挑選號碼啟動轉盤即時開獎！
                            </p>
                        </div>

                        {/* 卡池統計資訊卡 */}
                        <div className="flex items-center gap-3 bg-slate-900/80 backdrop-blur-md p-3 rounded-2xl border border-slate-800">
                            <div className="text-center px-3 border-r border-slate-800">
                                <div className="text-[10px] text-slate-400 font-bold">總卡量</div>
                                <div className="text-base font-black text-white font-mono">{totalCardsCount}</div>
                            </div>
                            <div className="text-center px-3 border-r border-slate-800">
                                <div className="text-[10px] text-cyan-400 font-bold">待挑戰</div>
                                <div className="text-base font-black text-cyan-300 font-mono">{availableCardsCount}</div>
                            </div>
                            <div className="text-center px-3">
                                <div className="text-[10px] text-rose-400 font-bold">已售出</div>
                                <div className="text-base font-black text-rose-400 font-mono">{soldCardsCount}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 卡片清單與控制列 */}
            <div className="container px-4 md:px-8 mt-8">
                {/* 搜尋與篩選列 */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-6 bg-slate-900/50 p-4 rounded-2xl border border-slate-800/80 backdrop-blur-sm">
                    <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Package className="w-4 h-4 text-cyan-400" />
                        <span>共 <strong className="text-white font-mono">{filteredCards.length}</strong> 張卡片</span>
                    </div>

                    <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
                        {/* 搜尋 */}
                        <div className="relative w-full sm:w-60">
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

                {/* 卡片網格 */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4">
                    {isLoading ? Array.from({ length: 6 }).map((_, i) => (
                        <Skeleton key={i} className="aspect-[2.5/4] rounded-2xl bg-slate-900/80 border border-slate-800" />
                    )) : 
                    filteredCards.map((card) => {
                        const isSold = soldCardIds.has(card.id) || card.isSold;
                        const singleSpotPrice = Math.max(1, Math.round((card.sellPrice || 0) * 0.1));

                        return (
                            <div 
                                key={card.id} 
                                className={cn(
                                    "relative aspect-[2.5/4] rounded-2xl overflow-hidden border border-slate-800 bg-slate-900/90 transition-all duration-300 group p-1.5 flex flex-col justify-between hover:border-cyan-500/60 hover:shadow-[0_0_25px_rgba(6,182,212,0.2)]",
                                    isSold && "opacity-50 grayscale hover:border-slate-800"
                                )}
                            >
                                {/* 熱門標籤 */}
                                {card.isFeatured && !isSold && (
                                    <div className="absolute top-2 right-2 z-20">
                                        <span className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                                            HOT
                                        </span>
                                    </div>
                                )}

                                {/* 卡片圖案區域 */}
                                <div className="relative w-full aspect-[2.5/3.5] rounded-xl overflow-hidden bg-slate-950 mb-1.5">
                                    <SafeImage 
                                        src={card.imageUrl} 
                                        alt={card.name} 
                                        fill 
                                        className="object-contain p-1 group-hover:scale-105 transition-transform duration-500" 
                                        sizes="(max-width: 768px) 50vw, 20vw" 
                                    />

                                    {/* 單注價格 */}
                                    {!isSold && (
                                        <div className="absolute top-1.5 left-1.5 bg-slate-950/85 backdrop-blur-md text-[9px] font-black tracking-widest text-cyan-300 px-2 py-0.5 rounded-md border border-cyan-500/30 pointer-events-none z-20 flex items-center gap-1">
                                            <Gem className="w-2.5 h-2.5 text-cyan-400" />
                                            <span>{singleSpotPrice}</span>
                                        </div>
                                    )}

                                    {/* 已售出覆蓋 */}
                                    {isSold && (
                                        <div className="absolute inset-0 flex items-center justify-center p-2 z-10 bg-slate-950/70 backdrop-blur-[1px]">
                                            <span className="text-[10px] font-black text-rose-200 bg-rose-950/90 border border-rose-500/80 px-2.5 py-1 rounded-md rotate-[-12deg] shadow-lg uppercase tracking-wider">
                                                已被抽出
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* 卡片資訊與按鈕 */}
                                <div className="px-1 text-center space-y-1.5">
                                    <div>
                                        <p className="text-[11px] font-bold text-slate-200 truncate group-hover:text-cyan-300 transition-colors">
                                            {card.name}
                                        </p>
                                        <p className="text-[10px] text-slate-400">
                                            原價 {card.sellPrice?.toLocaleString()} 💎
                                        </p>
                                    </div>

                                    <BettingGameDialog card={card} categoryName={categoryName} disabled={isSold}>
                                        <button 
                                            type="button" 
                                            disabled={isSold}
                                            className={cn(
                                                "w-full py-1.5 rounded-xl font-black text-[11px] tracking-wider transition-all duration-300 flex items-center justify-center gap-1 cursor-pointer",
                                                isSold 
                                                    ? "bg-slate-950 text-slate-500 border border-slate-800/80 cursor-not-allowed" 
                                                    : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-md"
                                            )}
                                        >
                                            {isSold ? '已抽完' : <><Dices className="w-3 h-3" /> 立即拼卡</>}
                                        </button>
                                    </BettingGameDialog>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 3D 翻轉卡片預覽 Dialog */}
            <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
                <DialogContent className="max-w-[min(95vw,420px)] bg-transparent border-none p-0 flex flex-col items-center gap-6 [&>button:last-child]:hidden">
                    <DialogTitle asChild>
                        <VisuallyHidden>卡片預覽</VisuallyHidden>
                    </DialogTitle>
                    {previewCard && (
                        <div className="w-full flex flex-col items-center gap-4">
                            <h2 className="text-sm font-black text-white text-center px-6">{previewCard.name}</h2>
                            <div className="w-full max-w-[280px] relative">
                                <CardItem 
                                    name={previewCard.name} 
                                    imageUrl={previewCard.imageUrl} 
                                    backImageUrl={previewCard.backImageUrl} 
                                    imageHint={previewCard.name} 
                                    rarity="legendary" 
                                    isFlippable={true}
                                />
                            </div>
                            <p className="text-[10px] text-cyan-400 font-bold uppercase animate-pulse">點擊可 3D 翻轉檢視背面</p>
                        </div>
                    )}
                    <Button variant="ghost" size="icon" className="rounded-full bg-black/60 h-10 w-10 text-white" onClick={() => setPreviewCard(null)}>
                        <X className="h-5 w-5" />
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}
