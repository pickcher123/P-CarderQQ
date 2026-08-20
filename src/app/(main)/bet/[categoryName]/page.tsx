'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useUser } from '@/firebase';
import { collection, doc, serverTimestamp, increment, runTransaction, arrayUnion } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
    ArrowLeft, Search, Loader2, Info, Sparkles, XCircle, 
    X, ShieldCheck, Eye, ShoppingCart, Target, Flame, Dices, 
    Percent, Coins, Award, Layers, Package
} from 'lucide-react';
import { PPlusIcon, DiamondIcon } from '@/components/icons';
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

function DirectPurchaseDialog({ card, children, categoryName }: { card: CardData; children: React.ReactNode; categoryName: string }) {
    const { user } = useUser();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentCurrency, setPaymentCurrency] = useState<'diamond' | 'p-point'>('diamond');
    const firestore = useFirestore();
    const userProfileRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const diamondPrice = card.sellPrice || 0;
    const pPointPrice = diamondPrice * 10;

    const handlePurchase = async () => {
        if (!user || !card.sellPrice || !firestore || !userProfile) return;
        const levelNames = userLevels.map(l => l.level);
        if (levelNames.indexOf(userProfile.userLevel) < (card.minLevel ? levelNames.indexOf(card.minLevel) : 0)) {
            toast({ variant: 'destructive', title: '權限不足', description: `僅限「${card.minLevel}」以上購買。` });
            return;
        }
        setIsProcessing(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const cardRef = doc(firestore, 'allCards', card.id);
                const cardSnap = await transaction.get(cardRef);
                const cardData = cardSnap.data();
                if (cardData?.isSold) throw new Error("此卡片已被購買，請重新整理後再試。");
                
                if (cardData?.lockedBy && cardData.lockedBy !== user.uid && cardData.lockedAt && (Date.now() - cardData.lockedAt.toMillis() < 30000)) {
                    throw new Error("此卡片正在被其他人挑戰中，請稍候再試。");
                }

                const userRef = doc(firestore, 'users', user.uid);
                const uSnap = await transaction.get(userRef);
                const userData = uSnap.data() as UserProfile;
                const finalPrice = paymentCurrency === 'diamond' ? diamondPrice : pPointPrice;
                const walletBalance = paymentCurrency === 'diamond' ? (userData.points || 0) : (userData.bonusPoints || 0);
                if (walletBalance < finalPrice) throw new Error("點數餘額不足");

                const walletField = paymentCurrency === 'diamond' ? 'points' : 'bonusPoints';
                const updates: any = { [walletField]: increment(-finalPrice) };
                if (paymentCurrency === 'diamond') { 
                    updates.totalSpent = increment(finalPrice); 
                    updates.userLevel = calculateLevel((userData.totalSpent || 0) + finalPrice); 
                }
                transaction.update(userRef, updates);
                transaction.set(doc(collection(firestore, 'users', user.uid, 'userCards')), { 
                    userId: user.uid, 
                    cardId: card.id, 
                    isFoil: false, 
                    rarity: card.rarity || 'unknown', 
                    category: card.category || 'betting', 
                    source: 'direct-buy',
                    acquiredAt: serverTimestamp()
                });
                transaction.update(doc(firestore, 'allCards', card.id), { isSold: true });
                if (decodeURIComponent(categoryName) !== 'all') {
                    const catDocRef = doc(firestore, 'betting-items', decodeURIComponent(categoryName));
                    transaction.update(catDocRef, { soldCardIds: arrayUnion(card.id) });
                }
                transaction.set(doc(collection(firestore, 'transactions')), { 
                    userId: user.uid, 
                    targetId: card.id, 
                    transactionType: 'Purchase', 
                    section: 'betting-direct', 
                    currency: paymentCurrency, 
                    amount: -finalPrice, 
                    details: `【直接購買】${card.name}`, 
                    transactionDate: serverTimestamp() 
                });
            });
            toast({ title: '🎉 購買成功！', description: `《${card.name}》已成功存入您的數位收藏庫。` });
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: '購買失敗', description: e.message });
        } finally { 
            setIsProcessing(false); 
        }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
            <AlertDialogContent className="max-w-[min(95vw,460px)] rounded-[2rem] bg-slate-950 border border-white/10 text-white shadow-2xl p-6 backdrop-blur-2xl">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-center font-black text-xl font-headline text-cyan-400 flex items-center justify-center gap-2">
                        <ShoppingCart className="w-5 h-5" />
                        直接購買確認
                    </AlertDialogTitle>
                </AlertDialogHeader>
                <div className="flex flex-col items-center py-3 space-y-5">
                    <div className="w-32 aspect-[2.5/3.5] relative rounded-xl overflow-hidden bg-black/60 border border-white/10 p-1 shadow-md">
                        <Image src={card.imageUrl} alt={card.name} fill className="object-contain" sizes="128px" referrerPolicy="no-referrer" />
                    </div>
                    <p className="text-sm font-bold text-center text-slate-200 px-4 truncate w-full">{card.name}</p>

                    <div className="w-full space-y-3">
                        <p className="text-[11px] font-black uppercase text-slate-400 text-center tracking-widest">選擇支付幣別</p>
                        <RadioGroup value={paymentCurrency} onValueChange={(v: any) => setPaymentCurrency(v)} className="w-full grid grid-cols-2 gap-3">
                            <div 
                                onClick={() => setPaymentCurrency('diamond')} 
                                className={cn(
                                    "p-3.5 border rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center", 
                                    paymentCurrency === 'diamond' 
                                        ? 'border-cyan-400 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                                        : 'border-white/10 bg-white/5 opacity-60 hover:opacity-100'
                                )}
                            >
                                <DiamondIcon className="w-6 h-6 mb-1"/>
                                <span className="text-xs font-bold text-slate-200">鑽石支付</span>
                                <p className="text-sm font-black font-mono mt-1 text-cyan-300 flex items-center justify-center gap-1">
                                    {diamondPrice.toLocaleString()} <DiamondIcon className="w-3.5 h-3.5" />
                                </p>
                            </div>
                            <div 
                                onClick={() => setPaymentCurrency('p-point')} 
                                className={cn(
                                    "p-3.5 border rounded-2xl text-center cursor-pointer transition-all flex flex-col items-center", 
                                    paymentCurrency === 'p-point' 
                                        ? 'border-purple-400 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.2)]' 
                                        : 'border-white/10 bg-white/5 opacity-60 hover:opacity-100'
                                )}
                            >
                                <PPlusIcon className="w-6 h-6 mb-1 text-purple-400"/>
                                <span className="text-xs font-bold text-slate-200">P+ 點數</span>
                                <p className="text-sm font-black font-mono mt-1 text-purple-300">{pPointPrice.toLocaleString()} P+</p>
                            </div>
                        </RadioGroup>
                    </div>
                </div>
                <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel className="h-10 rounded-xl font-bold bg-white/5 border-white/10 text-white hover:bg-white/10">取消</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={handlePurchase} 
                        disabled={isProcessing} 
                        className="h-10 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black"
                    >
                        {isProcessing ? '購買中...' : '確認直購'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function BettingCategoryPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const params = useParams();
    const categoryName = params.categoryName as string;
    const decodedCategory = decodeURIComponent(categoryName || '');
    
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTab, setFilterTab] = useState<'all' | 'available' | 'featured'>('all');
    const [sortOption, setSortOption] = useState<'latest' | 'price-high' | 'price-low' | 'unsold'>('latest');
    const [previewCard, setPreviewCard] = useState<CardData | null>(null);
    
    const categoriesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'bettingCategories') : null, [firestore]);
    const { data: categories } = useCollection<BettingCategory>(categoriesQuery);
    
    const currentCategoryInfo = useMemo(() => {
        if (!categories) return null;
        return categories.find(c => c.id === decodedCategory || c.name === decodedCategory);
    }, [categories, decodedCategory]);

    const bettingItemsRef = useMemoFirebase(() => (firestore && categoryName) ? doc(firestore, 'betting-items', decodedCategory) : null, [firestore, categoryName, decodedCategory]);
    const { data: bettingItems } = useDoc<BettingItems>(bettingItemsRef);
    
    const allCardsCollectionRef = useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]);
    const { data: allCards, isLoading: isLoadingCards } = useCollection<CardData>(allCardsCollectionRef);
    
    const soldCardIds = useMemo(() => new Set(bettingItems?.soldCardIds || []), [bettingItems]);

    const filteredCards = useMemo(() => {
        if (!allCards || !bettingItems?.allCardIds) return [];
        const cardIdSet = new Set(bettingItems.allCardIds);
        let baseCards = allCards.filter(c => cardIdSet.has(c.id));
        
        // Tab Filtering
        if (filterTab === 'available') {
            baseCards = baseCards.filter(c => !soldCardIds.has(c.id) && !c.isSold);
        } else if (filterTab === 'featured') {
            baseCards = baseCards.filter(c => c.isFeatured);
        }

        // Search
        if (searchTerm.trim()) {
            baseCards = baseCards.filter(c => c.name?.toLowerCase().includes(searchTerm.toLowerCase()));
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
    }, [allCards, bettingItems, searchTerm, sortOption, filterTab, soldCardIds]);

    const totalPoolCount = bettingItems?.allCardIds?.length || 0;
    const soldCount = bettingItems?.soldCardIds?.length || 0;
    const availableCount = Math.max(0, totalPoolCount - soldCount);
    const progressPercent = totalPoolCount > 0 ? Math.round((soldCount / totalPoolCount) * 100) : 0;

    return (
        <div className="min-h-screen relative overflow-hidden pb-24 text-white">
            {/* Ambient Background Lighting */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[400px] bg-gradient-to-b from-cyan-500/15 via-purple-500/10 to-transparent blur-[140px] pointer-events-none -z-10" />

            <div className="container px-4 md:px-8 py-6 md:py-10 max-w-7xl mx-auto space-y-8">
                
                {/* Top Nav & Breadcrumbs */}
                <div className="flex items-center justify-between">
                    <Link 
                        href="/bet" 
                        className="inline-flex items-center gap-2 text-xs md:text-sm font-bold text-slate-300 hover:text-cyan-400 transition-colors px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:border-cyan-500/40 shadow-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        返回拼卡大廳
                    </Link>

                    {/* Rules Dialog */}
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-9 px-4 rounded-xl border-white/10 bg-white/5 backdrop-blur-md hover:bg-cyan-500/10 hover:border-cyan-500/40 text-white font-bold transition-all gap-2 cursor-pointer shadow-sm">
                                <Info className="h-4 w-4 text-cyan-400" />
                                <span className="text-xs tracking-wider">卡池規則說明</span>
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-[2rem] bg-slate-950 border border-cyan-500/30 text-white max-w-2xl backdrop-blur-2xl shadow-2xl">
                            <DialogHeader>
                                <DialogTitle className="text-xl md:text-2xl font-black text-cyan-400 flex items-center gap-2 font-headline">
                                    <Target className="w-6 h-6 text-cyan-400" />
                                    拼卡規則與機制
                                </DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-3 text-sm text-slate-300">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                        <div className="flex items-center gap-2 text-cyan-400 font-bold">
                                            <Percent className="w-4 h-4" /> 1/10 命中率
                                        </div>
                                        <p className="text-xs text-slate-400">每次拼卡將自 1~10 號碼中隨機搖出 1 個幸運數字，若匹配中獎號即直接獲得該張卡片。</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                        <div className="flex items-center gap-2 text-purple-400 font-bold">
                                            <Coins className="w-4 h-4" /> 雙幣自由支付
                                        </div>
                                        <p className="text-xs text-slate-400">支援鑽石 💎 與紅利點數 P+，比例固定為 1 : 10。</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                        <div className="flex items-center gap-2 text-amber-400 font-bold">
                                            <Award className="w-4 h-4" /> 10% 成本博大獎
                                        </div>
                                        <p className="text-xs text-slate-400">單次拼卡費用僅需卡片標價的 10%，享受極致高期望值搏擊樂趣。</p>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                        <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                            <ShieldCheck className="w-4 h-4" /> 實時防搶機制
                                        </div>
                                        <p className="text-xs text-slate-400">正在拼卡的卡片享有防搶保護，中獎立即撥入帳號收藏庫。</p>
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Category Hero Banner */}
                <div className="relative rounded-3xl p-6 md:p-8 overflow-hidden border border-cyan-500/20 bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-[#060913] shadow-2xl backdrop-blur-xl">
                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d410_1px,transparent_1px),linear-gradient(to_bottom,#06b6d410_1px,transparent_1px)] bg-[size:28px_28px] opacity-40 pointer-events-none" />
                    
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="space-y-3 text-center md:text-left">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30">
                                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-300">
                                    THEME POOL
                                </span>
                            </div>

                            <h1 className="font-headline text-2xl sm:text-4xl md:text-5xl font-black text-white tracking-tight">
                                {currentCategoryInfo?.name || decodedCategory}
                            </h1>
                            <p className="text-xs sm:text-sm text-slate-300">
                                專屬卡池精選卡片 • 每張卡片均支援 1/10 幸運拉霸與直接收藏
                            </p>
                        </div>

                        {/* Pool Dashboard Stats */}
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="flex-1 md:flex-none p-4 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[110px]">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">總卡量</span>
                                <p className="text-xl sm:text-2xl font-black font-headline text-white mt-0.5">{totalPoolCount}</p>
                            </div>
                            <div className="flex-1 md:flex-none p-4 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-center min-w-[110px]">
                                <span className="text-[10px] font-bold text-cyan-400 uppercase">剩餘可拼</span>
                                <p className="text-xl sm:text-2xl font-black font-headline text-cyan-300 mt-0.5">{availableCount}</p>
                            </div>
                            <div className="flex-1 md:flex-none p-4 rounded-2xl bg-white/5 border border-white/10 text-center min-w-[110px]">
                                <span className="text-[10px] font-bold text-slate-400 uppercase">已抽出</span>
                                <p className="text-xl sm:text-2xl font-black font-headline text-destructive mt-0.5">{soldCount}</p>
                            </div>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-6 pt-4 border-t border-white/10">
                        <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                            <span>卡池抽出進度</span>
                            <span className="font-mono text-cyan-400 font-bold">{progressPercent}%</span>
                        </div>
                        <div className="w-full h-2.5 rounded-full bg-white/10 overflow-hidden">
                            <div 
                                className="h-full bg-gradient-to-r from-cyan-500 via-sky-400 to-primary rounded-full transition-all duration-500 shadow-[0_0_12px_#06b6d4]" 
                                style={{ width: `${progressPercent}%` }} 
                            />
                        </div>
                    </div>
                </div>

                {/* Filter and Cards Section */}
                <div className="space-y-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-4">
                        <div className="flex items-center gap-2">
                            <Layers className="w-5 h-5 text-cyan-400" />
                            <h2 className="text-lg font-black font-headline text-white tracking-wide">
                                卡池清單 ({filteredCards.length})
                            </h2>
                        </div>

                        {/* Controls */}
                        <div className="flex flex-wrap items-center gap-3">
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

                            <div className="relative w-full sm:w-52">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                <Input 
                                    placeholder="搜尋卡片..." 
                                    className="pl-8 h-9 bg-white/5 rounded-xl border-white/10 text-xs text-white placeholder:text-slate-500" 
                                    value={searchTerm} 
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cards Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 md:gap-5">
                        {isLoadingCards ? Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="aspect-[2.5/4] rounded-2xl overflow-hidden">
                                <Skeleton className="w-full h-full" />
                            </div>
                        )) : 
                        filteredCards.map((card) => {
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
                                    <BettingGameDialog card={card} categoryName={categoryName} disabled={isSold}>
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
                                                <span className="font-bold text-amber-400 flex items-center gap-1 font-mono">
                                                    <DiamondIcon className="w-3 h-3 text-amber-400" />
                                                    {card.sellPrice ? card.sellPrice.toLocaleString() : '---'}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action Buttons: 拼卡 + 直購 */}
                                        <div className="space-y-1.5 pt-1">
                                            <BettingGameDialog card={card} categoryName={categoryName} disabled={isSold}>
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

                                            {!isSold && (
                                                <DirectPurchaseDialog card={card} categoryName={categoryName}>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="w-full h-7 text-[10px] font-bold rounded-lg border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer flex items-center justify-center"
                                                    >
                                                        <ShoppingCart className="w-3 h-3 mr-1 text-slate-400" />
                                                        <span>直購 {card.sellPrice ? card.sellPrice.toLocaleString() : ''}</span>
                                                        {card.sellPrice ? <DiamondIcon className="w-3 h-3 ml-1" /> : null}
                                                    </Button>
                                                </DirectPurchaseDialog>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {!isLoadingCards && filteredCards.length === 0 && (
                        <div className="py-20 text-center flex flex-col items-center justify-center space-y-3 rounded-2xl bg-white/5 border border-white/10">
                            <Search className="w-10 h-10 text-slate-500" />
                            <p className="text-sm text-slate-400">此分類目前沒有符合條件的卡片</p>
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
                            <BettingGameDialog card={previewCard} categoryName={categoryName} disabled={previewCard.isSold}>
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
