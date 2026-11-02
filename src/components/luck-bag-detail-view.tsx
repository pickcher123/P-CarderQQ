'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc, collection, serverTimestamp, increment, runTransaction } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { 
    AlertDialog, 
    AlertDialogAction, 
    AlertDialogCancel, 
    AlertDialogContent, 
    AlertDialogDescription, 
    AlertDialogFooter, 
    AlertDialogHeader, 
    AlertDialogTitle, 
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { 
    Gem, Loader2, Trophy, X, Dices, Users, Info, HelpCircle, 
    Sparkles, ShieldCheck, Flame, CheckCircle2, Award, Zap, RotateCcw
} from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { CardItem } from '@/components/card-item';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import type { LuckBagWithCount, CardData } from '@/app/(main)/lucky-bags/page';
import type { UserProfile } from '@/types/user-profile';
import type { LevelBenefit } from '@/types/system';

interface LuckBagPurchase {
  id: string;
  userId: string;
  username?: string;
  luckBagId: string;
  spotNumber: number;
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
    const sorted = [...levels].sort((a, b) => b.threshold - a.threshold);
    const matched = sorted.find(l => totalSpent >= l.threshold);
    return matched ? matched.level : DEFAULT_LEVELS[0].level;
}

const PrizeDisplayCard = ({ 
    card, 
    levelText, 
    tier = 'first',
    onPreview 
}: { 
    card?: CardData, 
    levelText: string, 
    tier?: 'first' | 'second' | 'third' | 'other',
    onPreview: (_card: CardData) => void 
}) => {
    const tierStyles = {
        first: {
            border: 'border-amber-300/80 hover:border-yellow-200',
            bg: 'bg-gradient-to-b from-amber-500/25 via-[#1a1408] to-black',
            badgeBg: 'bg-gradient-to-r from-yellow-300 via-amber-400 to-yellow-500 text-stone-950 font-black shadow-[0_0_15px_rgba(245,158,11,0.6)]',
            icon: '👑',
            glow: 'hover:shadow-[0_0_25px_rgba(245,158,11,0.5)]',
            textColor: 'text-amber-300',
        },
        second: {
            border: 'border-amber-200/50 hover:border-yellow-100',
            bg: 'bg-gradient-to-b from-amber-200/15 via-[#161107] to-black',
            badgeBg: 'bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 text-stone-950 font-black shadow-[0_0_12px_rgba(253,224,71,0.4)]',
            icon: '🥈',
            glow: 'hover:shadow-[0_0_20px_rgba(253,224,71,0.3)]',
            textColor: 'text-yellow-100',
        },
        third: {
            border: 'border-amber-600/50 hover:border-amber-500',
            bg: 'bg-gradient-to-b from-amber-700/20 via-[#161107] to-black',
            badgeBg: 'bg-gradient-to-r from-amber-600 to-amber-500 text-white font-black shadow-[0_0_10px_rgba(217,119,6,0.3)]',
            icon: '🥉',
            glow: 'hover:shadow-[0_0_15px_rgba(217,119,6,0.3)]',
            textColor: 'text-amber-200',
        },
        other: {
            border: 'border-amber-500/25 hover:border-amber-400/50',
            bg: 'bg-[#141008]',
            badgeBg: 'bg-[#241c09] text-amber-200 font-bold border border-amber-500/30',
            icon: '✨',
            glow: 'hover:shadow-[0_0_15px_rgba(245,158,11,0.2)]',
            textColor: 'text-amber-200/90',
        }
    }[tier];

    if (!card) {
        return (
            <div className="p-4 bg-[#181308]/60 rounded-2xl border border-dashed border-amber-500/20 h-full flex flex-col items-center justify-center opacity-50 text-amber-300/50 min-h-[160px]">
                <Trophy className="w-8 h-8 mb-2 text-amber-400/40"/>
                <p className="text-[11px] font-black uppercase tracking-wider">{levelText}</p>
                <p className="text-[10px] text-amber-300/40 mt-1">即將公開</p>
            </div>
        );
    }

    return (
        <div 
            className={cn(
                "relative group/prize rounded-2xl p-2 sm:p-3 border transition-all duration-300 flex flex-col cursor-zoom-in overflow-hidden",
                tierStyles.border,
                tierStyles.bg,
                tierStyles.glow
            )}
            onClick={() => onPreview(card)}
        >
            {/* Header Badge */}
            <div className="flex items-center justify-between gap-1 mb-2">
                <span className={cn("px-2 py-0.5 rounded-md text-[10px] sm:text-[11px] tracking-wide inline-flex items-center gap-1", tierStyles.badgeBg)}>
                    <span>{tierStyles.icon}</span>
                    <span>{levelText}</span>
                </span>
            </div>

            {/* Card Visual Frame */}
            <div className="relative w-full aspect-[4/5] rounded-xl overflow-hidden bg-slate-950/60 transition-transform duration-300 group-hover/prize:scale-[1.02] flex items-center justify-center">
                <CardItem 
                    name={card.name} 
                    imageUrl={card.imageUrl} 
                    backImageUrl={card.backImageUrl} 
                    imageHint={card.name} 
                    isFlippable={false} 
                />
            </div>
        </div>
    );
}; 

export function LuckBagDetailView({ luckBag }: { luckBag: LuckBagWithCount }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const [selectedSpots, setSelectedSpots] = useState<Set<number>>(new Set());
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isConfirming, setIsConfirming] = useState(false);
    const [previewCard, setPreviewCard] = useState<CardData | null>(null);
    
    // 隨機選號狀態
    const [isRandomPickOpen, setIsRandomPickOpen] = useState(false);
    const [randomPickCount, setRandomPickCount] = useState(1);
    
    // 參與名單狀態
    const [isListOpen, setIsListOpen] = useState(false);

    const purchasesQuery = useMemoFirebase(() => 
        (firestore && luckBag.id) ? collection(firestore, 'luckBags', luckBag.id, 'luckBagPurchases') : null, 
        [firestore, luckBag.id]
    );
    const { data: purchases, forceRefetch } = useCollection<LuckBagPurchase>(purchasesQuery);
    
    const { takenSpots, participantCount } = useMemo(() => {
        const spotSet = new Set<number>();
        const mineSet = new Set<number>();
        purchases?.forEach(p => { 
            spotSet.add(p.spotNumber); 
            if (p.userId === user?.uid) mineSet.add(p.spotNumber); 
        });
        return { takenSpots: { all: spotSet, mine: mineSet }, participantCount: spotSet.size };
    }, [purchases, user]);

    const isCompleted = luckBag.status === '已開獎';
    const currency = luckBag.currency || 'p-point';
    const totalParticipants = luckBag.totalParticipants || 1;
    const remainingSpotsCount = Math.max(0, totalParticipants - participantCount);
    const progress = Math.min(100, Math.round((participantCount / totalParticipants) * 100));

    const handleSpotClick = (spot: number) => {
        if (isCompleted || takenSpots.all.has(spot)) return;
        setSelectedSpots(prev => {
            const next = new Set(prev);
            if (next.has(spot)) next.delete(spot);
            else next.add(spot);
            return next;
        });
    };

    const handleClearSelection = () => {
        setSelectedSpots(new Set());
    };

    const handleQuickPickBatch = (count: number) => {
        const available: number[] = [];
        for (let i = 1; i <= totalParticipants; i++) {
            if (!takenSpots.all.has(i) && !selectedSpots.has(i)) {
                available.push(i);
            }
        }

        if (available.length === 0) {
            toast({ variant: 'destructive', title: '名額已滿', description: '目前無可用格數供選擇。' });
            return;
        }

        const pickCount = Math.min(count, available.length);
        const shuffled = [...available].sort(() => 0.5 - Math.random());
        const picked = shuffled.slice(0, pickCount);
        
        setSelectedSpots(prev => {
            const next = new Set(prev);
            picked.forEach(s => next.add(s));
            return next;
        });
        toast({ title: `已隨機追加 ${pickCount} 個號碼` });
    };

    const handleRandomPick = () => {
        const available: number[] = [];
        for (let i = 1; i <= totalParticipants; i++) {
            if (!takenSpots.all.has(i) && !selectedSpots.has(i)) {
                available.push(i);
            }
        }

        if (available.length < randomPickCount) {
            toast({ variant: 'destructive', title: '名額不足', description: `剩餘可用位置僅剩 ${available.length} 個。` });
            return;
        }

        const shuffled = [...available].sort(() => 0.5 - Math.random());
        const picked = shuffled.slice(0, randomPickCount);
        
        setSelectedSpots(prev => {
            const next = new Set(prev);
            picked.forEach(s => next.add(s));
            return next;
        });
        setIsRandomPickOpen(false);
        toast({ title: `已隨機選取 ${randomPickCount} 個號碼` });
    };

    const handlePurchase = async () => {
        if (!user || !firestore || selectedSpots.size === 0) return;
        setIsSubmitting(true);
        try {
             await runTransaction(firestore, async (transaction) => {
                const totalCost = selectedSpots.size * (luckBag.price || 0);
                const userRef = doc(firestore, 'users', user.uid);
                const uSnap = await transaction.get(userRef);
                const userData = uSnap.data() as UserProfile;
                const walletBalance = currency === 'diamond' ? userData.points : userData.bonusPoints;
                
                if (walletBalance < totalCost) throw new Error(currency === 'diamond' ? "鑽石餘額不足" : "紅利 P+ 點數餘額不足");
                
                const purchasesRef = collection(firestore, 'luckBags', luckBag.id, 'luckBagPurchases');
                
                // Check if any spot is already taken
                for (const spot of selectedSpots) {
                    const spotRef = doc(purchasesRef, spot.toString());
                    const spotSnap = await transaction.get(spotRef);
                    if (spotSnap.exists()) {
                        throw new Error(`號碼 ${spot} 已經被其他玩家搶先選走了，請重新選擇`);
                    }
                }

                for (const spot of selectedSpots) {
                    transaction.set(doc(purchasesRef, spot.toString()), { 
                        userId: user.uid, 
                        username: userData.username || '神秘藏友',
                        luckBagId: luckBag.id, 
                        spotNumber: spot, 
                        purchasedAt: serverTimestamp()
                    });
                }
                
                const walletField = currency === 'diamond' ? 'points' : 'bonusPoints';
                const updates: any = { [walletField]: increment(-totalCost) };
                if (currency === 'diamond') { 
                    updates.totalSpent = increment(totalCost); 
                    updates.userLevel = calculateLevel(userData.totalSpent + totalCost); 
                }
                transaction.update(userRef, updates);
                transaction.set(doc(collection(firestore, 'transactions')), { 
                    userId: user.uid, 
                    transactionType: 'Purchase', 
                    section: 'lucky-bag', 
                    currency, 
                    amount: -totalCost, 
                    details: `購買福袋格: ${luckBag.name} (共 ${selectedSpots.size} 格)`, 
                    transactionDate: serverTimestamp() 
                });
            });
            if (forceRefetch) forceRefetch();
            toast({ title: '🎉 購買成功！', description: `已成功鎖定 ${selectedSpots.size} 個號碼。` });
            setSelectedSpots(new Set());
            setIsConfirming(false);
        } catch (error: any) { 
            toast({ variant: 'destructive', title: '選號失敗', description: error.message }); 
        } finally { 
            setIsSubmitting(false); 
        }
    };

    return (
        <div className="relative w-full rounded-2xl sm:rounded-3xl overflow-hidden bg-gradient-to-b from-[#181308]/98 via-[#0f0c07]/98 to-[#080604]/98 border border-amber-400/40 shadow-[0_20px_60px_rgba(0,0,0,0.9),0_0_35px_rgba(245,158,11,0.15)] backdrop-blur-2xl">
            {/* Top Atmospheric Glow Bar (流光金頂) */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-amber-300 to-transparent shadow-[0_0_20px_#f59e0b] z-20" />

            <div className="grid grid-cols-1 lg:grid-cols-12 min-h-[680px]">
                {/* 左側：獎項卡牌展台 (Prizes Showcase - 喜慶金箔質感) */}
                <div className="lg:col-span-5 p-4 sm:p-6 lg:p-7 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-amber-500/25 bg-[#141009]/95 backdrop-blur-xl">
                    <div className="space-y-5">
                        {/* Header Title & Status */}
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center gap-2">
                                {isCompleted ? (
                                    <Badge className="bg-amber-900/30 text-amber-200 border border-amber-600/40 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm">
                                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                        活動已順利開獎
                                    </Badge>
                                ) : participantCount >= totalParticipants ? (
                                    <Badge className="bg-yellow-500/20 text-yellow-300 border border-yellow-400/50 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(234,179,8,0.25)]">
                                        <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
                                        已額滿 · 待系統公開派獎
                                    </Badge>
                                ) : (
                                    <Badge className="bg-amber-500/20 text-amber-300 border border-amber-400/50 px-2.5 py-1 rounded-full text-xs font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                                        <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                                        金喜募集中
                                    </Badge>
                                )}

                                <div className="text-[11px] font-bold text-amber-200/80 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/25">
                                    總席位：{totalParticipants} 格
                                </div>
                            </div>

                            <h1 className="font-headline text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 drop-shadow-[0_2px_12px_rgba(245,158,11,0.3)] leading-tight">
                                {luckBag.name}
                            </h1>

                            {/* Price Plate */}
                            <div className="inline-flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-[#0e0b06] border border-amber-400/40 shadow-inner">
                                <span className="text-xs font-bold text-amber-300/70 uppercase tracking-wider pl-1">
                                    每格單價
                                </span>
                                <div className="flex items-center gap-1.5 text-amber-300 font-code font-black text-2xl sm:text-3xl leading-none">
                                    {currency === 'diamond' ? (
                                        <Gem className="w-6 h-6 text-yellow-300 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]" />
                                    ) : (
                                        <PPlusIcon className="w-6 h-6 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                                    )}
                                    <span>{(luckBag.price || 0).toLocaleString()}</span>
                                    <span className="text-xs text-amber-300/70 font-bold ml-1">
                                        {currency === 'diamond' ? '鑽石' : 'P+ 點'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Top Prizes Showcase Gallery */}
                        <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Award className="w-4 h-4 text-amber-400" />
                                    <h3 className="text-xs sm:text-sm font-black text-amber-200 tracking-wider uppercase">
                                        重點大獎卡牌鑑賞
                                    </h3>
                                </div>
                                <span className="text-[10px] text-amber-300/60 font-bold">
                                    機率透明 · 100% 包含
                                </span>
                            </div>

                            {/* Top 3 Prize Cards Grid */}
                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                <PrizeDisplayCard 
                                    card={luckBag.prizeCards.first} 
                                    levelText="頭獎" 
                                    tier="first" 
                                    onPreview={setPreviewCard} 
                                />
                                <PrizeDisplayCard 
                                    card={luckBag.prizeCards.second} 
                                    levelText="貳獎" 
                                    tier="second" 
                                    onPreview={setPreviewCard} 
                                />
                                <PrizeDisplayCard 
                                    card={luckBag.prizeCards.third} 
                                    levelText="參獎" 
                                    tier="third" 
                                    onPreview={setPreviewCard} 
                                />
                            </div>

                            {/* Other Prizes / Points Section */}
                            {(luckBag.otherPrizesList?.length > 0 || luckBag.otherPointsList?.length > 0) && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <button className="w-full p-2.5 sm:p-3 bg-[#100d07] hover:bg-[#181308] rounded-xl border border-amber-500/30 hover:border-amber-400/60 flex items-center justify-between gap-2 cursor-pointer transition-all group shadow-sm">
                                            <div className="flex items-center gap-2">
                                                <Trophy className="w-4 h-4 text-amber-400 group-hover:scale-110 transition-transform" />
                                                <span className="text-xs font-bold text-amber-200 group-hover:text-yellow-200">
                                                    查看完整獎項名冊（含普獎/點數回饋）
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                                                共 {(luckBag.otherPrizesList?.length || 0) + (luckBag.otherPointsList?.length || 0) + 3} 個獎項
                                            </span>
                                        </button>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md bg-[#161108] border border-amber-500/40 text-amber-100 rounded-3xl backdrop-blur-2xl shadow-2xl p-6">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl font-black text-amber-300 flex items-center gap-2">
                                                <Trophy className="w-5 h-5 text-amber-400" />
                                                完整獎項內容名冊
                                            </DialogTitle>
                                            <DialogDescription className="text-amber-200/60 text-xs font-bold">
                                                本活動所有號碼皆對應公平抽獎獎項。
                                            </DialogDescription>
                                        </DialogHeader>
                                        <ScrollArea className="max-h-[55vh] pr-2 mt-3">
                                            <div className="space-y-2">
                                                {luckBag.prizeCards.first && (
                                                    <div className="p-3 bg-amber-500/15 rounded-xl border border-amber-400/50 flex items-center justify-between">
                                                        <span className="font-black text-xs text-amber-300 flex items-center gap-1">👑 頭獎</span>
                                                        <span className="font-bold text-xs text-white truncate max-w-[200px]">{luckBag.prizeCards.first.name}</span>
                                                    </div>
                                                )}
                                                {luckBag.prizeCards.second && (
                                                    <div className="p-3 bg-amber-200/10 rounded-xl border border-amber-300/30 flex items-center justify-between">
                                                        <span className="font-black text-xs text-yellow-200 flex items-center gap-1">🥈 貳獎</span>
                                                        <span className="font-bold text-xs text-white truncate max-w-[200px]">{luckBag.prizeCards.second.name}</span>
                                                    </div>
                                                )}
                                                {luckBag.prizeCards.third && (
                                                    <div className="p-3 bg-amber-700/15 rounded-xl border border-amber-600/35 flex items-center justify-between">
                                                        <span className="font-black text-xs text-amber-200 flex items-center gap-1">🥉 參獎</span>
                                                        <span className="font-bold text-xs text-white truncate max-w-[200px]">{luckBag.prizeCards.third.name}</span>
                                                    </div>
                                                )}
                                                {luckBag.otherPrizesList?.map((prize, idx) => (
                                                    <div key={prize.prizeId} className="p-2.5 bg-[#120f0a] rounded-xl border border-amber-500/20 flex items-center justify-between">
                                                        <span className="font-bold text-xs text-amber-400/80">{idx + 4} 獎</span>
                                                        <span className="font-bold text-xs text-amber-100 truncate max-w-[200px]">{prize.name}</span>
                                                    </div>
                                                ))}
                                                {luckBag.otherPointsList?.map((pointPrize, idx) => (
                                                    <div key={pointPrize.prizeId} className="p-2.5 bg-[#120f0a] rounded-xl border border-amber-500/20 flex items-center justify-between">
                                                        <span className="font-bold text-xs text-amber-400/80">點數回饋獎</span>
                                                        <span className="font-bold text-xs text-yellow-300">{pointPrize.points} P+ 點數</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>

                    {/* Trust Guarantee Note */}
                    <div className="mt-6 p-3.5 bg-[#161108]/90 rounded-2xl border border-amber-500/30 flex items-start gap-3 shadow-inner">
                        <ShieldCheck className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                            <p className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                                系統公正選號與派獎保證
                            </p>
                            <p className="text-[11px] font-bold text-amber-200/80 leading-relaxed">
                                自由挑選幸運序號，募集額滿後系統即時公開隨機配對，卡片直接安全入庫。
                            </p>
                        </div>
                    </div>
                </div>

                {/* 右側：序號選位與下單互動區 (Interactive Grid & Order Console - 燙金喜慶風格) */}
                <div className="lg:col-span-7 p-4 sm:p-6 lg:p-7 flex flex-col justify-between bg-[#0b0905]/95 backdrop-blur-2xl">
                    {!isCompleted ? (
                        <>
                            <div className="space-y-4">
                                {/* Header Stats & Progress */}
                                <div className="space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-[11px] font-black text-amber-300/70 uppercase tracking-wider">
                                                募集進度
                                            </p>
                                            <div className="flex items-baseline gap-2 mt-0.5">
                                                <span className="text-2xl sm:text-3xl font-black font-code text-yellow-100">
                                                    {participantCount}
                                                </span>
                                                <span className="text-amber-200/50 text-sm font-bold">
                                                    / {totalParticipants} 格
                                                </span>
                                                <span className="text-xs font-bold text-amber-400 ml-1">
                                                    ({progress}%)
                                                </span>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center gap-2">
                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="bg-[#181308] border-amber-500/30 text-amber-200 hover:bg-amber-500/20 hover:text-yellow-200 font-bold h-9 text-xs px-3 rounded-xl transition-all shadow-sm cursor-pointer"
                                                onClick={() => setIsListOpen(true)}
                                            >
                                                <Users className="w-3.5 h-3.5 mr-1 text-amber-400" /> 名單
                                            </Button>

                                            <Button 
                                                variant="outline" 
                                                size="sm" 
                                                className="bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 hover:from-yellow-300 hover:to-amber-300 text-stone-950 font-black h-9 text-xs px-3 rounded-xl transition-all shadow-[0_0_12px_rgba(245,158,11,0.35)] border border-yellow-200 cursor-pointer"
                                                onClick={() => setIsRandomPickOpen(true)}
                                            >
                                                <Dices className="w-3.5 h-3.5 mr-1 text-stone-950" /> 隨機選號
                                            </Button>

                                            {selectedSpots.size > 0 && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="h-9 px-2 text-xs text-amber-400/80 hover:text-amber-200 hover:bg-amber-500/10 font-bold rounded-xl cursor-pointer"
                                                    onClick={handleClearSelection}
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> 清空
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    <div className="h-3 w-full bg-[#181308] rounded-full overflow-hidden border border-amber-500/30 p-0.5 relative">
                                        <div 
                                            className="h-full bg-gradient-to-r from-amber-600 via-amber-400 to-yellow-300 rounded-full transition-all duration-700 shadow-[0_0_12px_rgba(245,158,11,0.6)]" 
                                            style={{ width: `${progress}%` }} 
                                        />
                                    </div>

                                    {/* Quick Pick Shortcuts */}
                                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                                        <span className="text-[11px] font-bold text-amber-300/70 mr-1">快捷加選:</span>
                                        {[1, 3, 5, 10].map(n => (
                                            <button
                                                key={n}
                                                type="button"
                                                disabled={remainingSpotsCount < n}
                                                onClick={() => handleQuickPickBatch(n)}
                                                className="px-2.5 py-1 rounded-lg bg-[#181308] hover:bg-amber-500/20 border border-amber-500/30 hover:border-amber-400 text-[11px] font-bold text-amber-200 hover:text-yellow-200 transition-all disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
                                            >
                                                +{n} 格
                                            </button>
                                        ))}
                                        {remainingSpotsCount > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => handleQuickPickBatch(remainingSpotsCount)}
                                                className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-yellow-400/20 to-amber-400/30 hover:bg-amber-500/35 border border-amber-400/60 text-[11px] font-black text-yellow-300 transition-all ml-auto cursor-pointer shadow-sm"
                                            >
                                                ⚡ 包下剩餘 ({remainingSpotsCount}格)
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Status Legend */}
                                <div className="flex items-center gap-3 text-[10px] font-bold text-amber-300/70 px-1">
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded-md bg-[#181308] border border-amber-500/30" />
                                        <span>可選擇</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded-md bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 border border-yellow-200" />
                                        <span className="text-amber-400">已選中</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded-md bg-[#2a200a] border border-amber-400" />
                                        <span className="text-amber-300">我的號碼</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <div className="w-3 h-3 rounded-md bg-[#100e08]/60 border border-stone-800/40 opacity-50" />
                                        <span className="text-stone-500">已售出</span>
                                    </div>
                                </div>

                                {/* 號碼棋盤格 (Grid Board) */}
                                <div className="border border-amber-500/30 bg-[#0e0b06]/95 rounded-2xl p-3 shadow-inner max-h-[360px] overflow-y-auto">
                                    <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-7 xl:grid-cols-8 gap-2 p-1">
                                        {Array.from({ length: totalParticipants }).map((_, i) => { 
                                             const spot = i + 1; 
                                            const taken = takenSpots.all.has(spot); 
                                            const isMine = takenSpots.mine.has(spot);
                                            const isSelected = selectedSpots.has(spot);

                                            return (
                                                <button 
                                                    key={spot} 
                                                    type="button"
                                                    disabled={taken}
                                                    onClick={() => handleSpotClick(spot)} 
                                                    className={cn(
                                                        "relative aspect-square rounded-xl flex flex-col items-center justify-center font-black transition-all duration-200 border cursor-pointer select-none", 
                                                        isMine ? "bg-gradient-to-b from-[#2e220a] to-[#1c1507] text-amber-300 border-amber-400/80 shadow-[0_0_12px_rgba(245,158,11,0.3)] cursor-not-allowed" :
                                                        taken ? "bg-[#100d08]/50 text-stone-600 border-stone-800/30 cursor-not-allowed opacity-40" : 
                                                        isSelected ? "bg-gradient-to-br from-yellow-300 via-amber-400 to-yellow-500 text-stone-950 font-black border-yellow-200 scale-105 shadow-[0_0_20px_rgba(245,158,11,0.7)] z-10" : 
                                                        "bg-[#181308] border-amber-500/25 text-amber-100 hover:border-amber-400 hover:text-yellow-200 hover:bg-amber-500/20 active:scale-95"
                                                    )}
                                                >
                                                    <span className="font-code text-xs sm:text-sm">{spot}</span>
                                                    {isMine && (
                                                        <span className="text-[8px] font-black text-amber-400 leading-none mt-0.5">我的</span>
                                                    )}
                                                    {isSelected && (
                                                        <CheckCircle2 className="w-3 h-3 text-stone-950 absolute top-1 right-1" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* 結帳與操作面板 */}
                            <div className="mt-6 pt-5 border-t border-amber-500/20 space-y-4">
                                {luckBag.revealLottery ? (
                                    <div className="py-4 text-center space-y-1 bg-amber-500/10 rounded-2xl border border-amber-500/30">
                                        <p className="text-base sm:text-lg font-black text-amber-400 uppercase tracking-widest animate-pulse">
                                            ✨ 直播開獎作業中
                                        </p>
                                        <p className="text-xs font-bold text-amber-200/80">
                                            管理員正在進行即時抽獎派發，稍候將同步更新獲獎名單。
                                        </p>
                                    </div>
                                ) : participantCount >= totalParticipants ? (
                                    <div className="py-4 text-center space-y-1 bg-yellow-500/10 rounded-2xl border border-yellow-500/30">
                                        <p className="text-base sm:text-lg font-black text-yellow-400 uppercase tracking-widest">
                                            🎉 已全數額滿 · 等待派獎
                                        </p>
                                        <p className="text-xs font-bold text-amber-200/80">
                                            所有席位已售罄，系統將擇期安排公開抽獎並派發入庫。
                                        </p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                        <div className="w-full sm:w-auto text-center sm:text-left">
                                            <div className="flex items-center justify-center sm:justify-start gap-2">
                                                <span className="text-xs font-bold text-amber-300/70 uppercase tracking-wider">
                                                    已選 {selectedSpots.size} 格
                                                </span>
                                                {selectedSpots.size > 0 && (
                                                    <span className="text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                                                        即時試算
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-center sm:justify-start gap-2 text-2xl sm:text-3xl font-black font-code text-amber-300 mt-1">
                                                {(selectedSpots.size * (luckBag.price || 0)).toLocaleString()}
                                                {currency === 'diamond' ? (
                                                    <Gem className="w-6 h-6 text-yellow-300" />
                                                ) : (
                                                    <PPlusIcon className="w-6 h-6" />
                                                )}
                                                <span className="text-xs text-amber-300/70 font-bold">
                                                    {currency === 'diamond' ? '鑽石' : '點'}
                                                </span>
                                            </div>
                                        </div>

                                        <Button 
                                            className="w-full sm:w-auto h-13 sm:h-14 rounded-2xl px-8 font-black bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-stone-950 hover:from-yellow-300 hover:to-amber-300 shadow-[0_0_25px_rgba(245,158,11,0.5)] transition-all active:scale-95 text-base cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border border-yellow-200" 
                                            disabled={selectedSpots.size === 0 || isSubmitting} 
                                            onClick={() => setIsConfirming(true)}
                                        >
                                            {isSubmitting ? (
                                                <div className="flex items-center gap-2">
                                                    <Loader2 className="w-5 h-5 animate-spin text-stone-950" />
                                                    <span>正在處理訂單...</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Zap className="w-5 h-5 fill-stone-950" />
                                                    <span>鎖定號碼並結帳 ({selectedSpots.size}格)</span>
                                                </div>
                                            )}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        /* 已開獎狀態 */
                        <div className="flex flex-col items-center justify-center h-full text-center space-y-6 py-10">
                            <div className="p-4 rounded-full bg-amber-500/15 border border-amber-500/40 shadow-[0_0_30px_rgba(245,158,11,0.3)]">
                                <Trophy className="w-16 h-16 text-amber-400 animate-bounce" />
                            </div>
                            <div className="space-y-1">
                                <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-amber-400 font-headline">
                                    活動已圓滿開獎
                                </h2>
                                <p className="text-xs sm:text-sm text-slate-400 font-bold">
                                    恭喜所有獲獎藏友！卡片已全數登記並同步發放至收藏庫。
                                </p>
                            </div>
                            {luckBag.winners && (
                                <div className="w-full max-w-md p-6 bg-slate-950/80 border border-amber-500/30 rounded-3xl space-y-2 shadow-2xl">
                                    <span className="text-[11px] font-black uppercase text-amber-400/90 tracking-[0.25em]">
                                        👑 頭獎得主號碼
                                    </span>
                                    <p className="text-5xl sm:text-6xl font-black font-code text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.5)]">
                                        # {luckBag.winners.first}
                                    </p>
                                    <p className="text-xs font-bold text-cyan-300 pt-1">
                                        得獎玩家：{purchases?.find(p => p.spotNumber === luckBag.winners?.first)?.username || '查驗中...'}
                                    </p>
                                </div>
                            )}
                            <Button 
                                variant="outline" 
                                className="rounded-xl border-white/20 bg-slate-900 text-slate-200 hover:bg-slate-800 font-bold px-6 h-11" 
                                onClick={() => setIsListOpen(true)}
                            >
                                查看完整獲獎公示名冊
                            </Button>
                        </div>
                    )}
                </div>
            </div>
            
            {/* 卡片大圖預覽 Modal (典藏級卡磚預覽) */}
            <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
                <DialogContent className="max-w-[min(92vw,360px)] bg-[#141008]/98 backdrop-blur-2xl border border-amber-500/30 rounded-[28px] p-5 flex flex-col items-center justify-center gap-3.5 [&>button:last-child]:hidden shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden">
                    <DialogTitle asChild>
                        <VisuallyHidden>卡片大圖鑑賞</VisuallyHidden>
                    </DialogTitle>
                    {previewCard && (
                        <div className="w-full flex flex-col items-center gap-3">
                            <div className="text-center w-full px-2">
                                <span className="text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/15 text-amber-300 inline-block mb-1">
                                    福袋大賞品項
                                </span>
                                <h3 className="font-headline font-black text-sm sm:text-base text-yellow-100 tracking-tight text-center leading-snug line-clamp-2">
                                    {previewCard.name}
                                </h3>
                            </div>
                            <div className="w-full max-w-[240px] aspect-[2.5/3.5] drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)]">
                                <CardItem 
                                    name={previewCard.name} 
                                    imageUrl={previewCard.imageUrl} 
                                    backImageUrl={previewCard.backImageUrl} 
                                    imageHint={previewCard.name} 
                                    rarity="legendary" 
                                    isFlippable={true}
                                />
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#1c160b] border border-amber-500/30 text-[11px] font-semibold text-amber-200">
                                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                                <span>點擊卡片可 3D 翻面觀看背卡</span>
                            </div>
                        </div>
                    )}
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 h-9 w-9 text-amber-200 hover:text-yellow-200 transition-all cursor-pointer" 
                        onClick={() => setPreviewCard(null)}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </DialogContent>
            </Dialog>

            {/* 隨機選號 Dialog */}
            <Dialog open={isRandomPickOpen} onOpenChange={setIsRandomPickOpen}>
                <DialogContent className="max-w-[min(95vw,360px)] rounded-3xl bg-[#141008] border border-amber-500/40 p-6 text-white backdrop-blur-2xl shadow-2xl">
                    <DialogTitle className="font-headline font-black text-xl tracking-tight uppercase text-amber-300 flex items-center gap-2">
                        <Dices className="w-5 h-5 text-amber-400" />
                        電腦隨機號碼選取
                    </DialogTitle>
                    <DialogHeader>
                        <DialogDescription className="text-amber-200/70 font-bold text-xs">
                            輸入您想要由系統隨機為您鎖定的格數數量。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="text-[10px] font-black uppercase text-amber-300/80 mb-2 block text-center">
                            購買格數（剩餘可用 {remainingSpotsCount} 格）
                        </Label>
                        <Input 
                            type="number" 
                            min={1} 
                            max={remainingSpotsCount || 1} 
                            value={randomPickCount} 
                            onChange={(e) => setRandomPickCount(Number(e.target.value))} 
                            className="h-14 bg-[#1e170c] border-amber-500/30 rounded-2xl font-code text-3xl font-black text-center text-amber-300 focus-visible:ring-amber-500"
                        />
                    </div>
                    <DialogFooter className="sm:flex-col gap-2">
                        <Button 
                            onClick={handleRandomPick} 
                            className="w-full h-12 font-black rounded-2xl bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-stone-950 hover:from-yellow-300 hover:to-amber-300 shadow-lg cursor-pointer border border-yellow-200"
                        >
                            確認隨機挑選
                        </Button>
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsRandomPickOpen(false)} 
                            className="w-full h-10 font-bold text-amber-300/70 hover:text-amber-200 cursor-pointer"
                        >
                            取消
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 參與名單/開獎公示 Dialog */}
            <Dialog open={isListOpen} onOpenChange={setIsListOpen}>
                <DialogContent className="max-w-4xl h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden bg-[#141008] border border-amber-500/40 rounded-3xl text-white backdrop-blur-2xl shadow-2xl">
                    <DialogHeader className="p-6 bg-[#1a140b] border-b border-amber-500/25 shrink-0">
                        <DialogTitle className="font-headline font-black text-xl uppercase flex items-center gap-3 text-amber-300">
                            <Users className="w-6 h-6 text-amber-400" /> 
                            福袋號碼與藏友公示名單
                        </DialogTitle>
                        <DialogDescription className="text-amber-200/70 font-bold text-xs">
                            即時公開透明：檢視本福袋所有序號的參與狀態。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 bg-[#0f0c07]/90 overscroll-contain">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {Array.from({ length: totalParticipants }).map((_, i) => {
                                const spotNum = i + 1;
                                const p = purchases?.find(x => x.spotNumber === spotNum);
                                const isMySpot = p?.userId === user?.uid;
                                const winner = luckBag.winners && (
                                    luckBag.winners.first === spotNum ? '頭獎' :
                                    luckBag.winners.second === spotNum ? '貳獎' :
                                    luckBag.winners.third === spotNum ? '參獎' : null
                                );

                                return (
                                    <div 
                                        key={spotNum} 
                                        className={cn(
                                            "flex flex-col p-3 rounded-2xl border transition-all",
                                            winner ? "bg-amber-500/20 border-amber-400 shadow-lg shadow-amber-500/20" : 
                                            isMySpot ? "bg-gradient-to-b from-[#2e220a] to-[#1c1507] border-amber-400/80 text-amber-300" :
                                            p ? "bg-[#181308] border-amber-500/20" : "bg-[#100d08]/50 border-dashed border-amber-500/10 opacity-50"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={cn("font-code font-black text-base", winner ? "text-yellow-300" : isMySpot ? "text-amber-300" : "text-amber-200/70")}>
                                                #{spotNum}
                                            </span>
                                            {winner && (
                                                <Badge className="bg-gradient-to-r from-yellow-400 to-amber-500 text-stone-950 font-black text-[9px] px-1.5 border-none uppercase shadow-sm">
                                                    👑 {winner}
                                                </Badge>
                                            )}
                                            {!winner && isMySpot && (
                                                <Badge className="bg-amber-500/25 text-amber-300 border border-amber-400/40 font-bold text-[9px] px-1.5">
                                                    我的
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="truncate">
                                            {p ? (
                                                <p className="font-bold text-xs text-amber-100 truncate">{p.username || '神秘藏友'}</p>
                                            ) : (
                                                <p className="text-[10px] text-amber-300/40 font-medium italic">待選號</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="p-4 border-t border-amber-500/25 bg-[#181308] shrink-0">
                        <Button onClick={() => setIsListOpen(false)} className="w-full h-12 rounded-2xl font-black bg-[#241c0c] border border-amber-500/30 text-amber-200 hover:bg-amber-500/20 hover:text-yellow-200 cursor-pointer">
                            關閉名單
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 交易確認 Dialog */}
            <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
                <AlertDialogContent className="max-w-[min(95vw,420px)] rounded-3xl bg-[#141008] border border-amber-500/40 text-white backdrop-blur-2xl shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black text-xl uppercase tracking-tight text-amber-300 flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-amber-400" />
                            福袋選號購買確認
                        </AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="text-amber-100/90 font-bold space-y-4 pt-2">
                                <p className="text-sm leading-relaxed">
                                    確定要支付 <span className="text-amber-300 font-code font-black text-xl">{(selectedSpots.size * (luckBag.price || 0)).toLocaleString()}</span> {currency === 'diamond' ? '鑽石 💎' : 'P+ 點數'} 鎖定所選的 <span className="text-white font-black">{selectedSpots.size}</span> 個序號嗎？
                                </p>
                                
                                <div className="p-2.5 bg-[#1a140b] rounded-xl border border-amber-500/30 text-xs font-code text-amber-200 flex flex-wrap gap-1.5">
                                    <span className="font-sans font-bold text-amber-300/70">已選序號：</span>
                                    {Array.from(selectedSpots).sort((a,b) => a-b).map(num => (
                                        <span key={num} className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-black">
                                            #{num}
                                        </span>
                                    ))}
                                </div>

                                <div className="p-3.5 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-left text-xs leading-relaxed space-y-1">
                                    <p className="font-black text-amber-300 flex items-center gap-1.5">
                                        <HelpCircle className="w-4 h-4 text-amber-400" /> 溫馨提醒：
                                    </p>
                                    <ul className="list-none pl-0 space-y-1 font-bold text-amber-200/80">
                                        <li>● 福袋屬募集制公平抽獎，一旦結帳鎖定恕無法退貨或取消。</li>
                                        <li>● 募集全滿後系統自動派獎，中獎卡片會直接登記在個人收藏庫。</li>
                                    </ul>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 mt-4">
                        <AlertDialogCancel className="h-12 rounded-xl font-bold bg-[#1e170c] border border-amber-500/30 text-amber-200 hover:bg-amber-500/20 hover:text-white flex-1 cursor-pointer">
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={handlePurchase} 
                            disabled={isSubmitting} 
                            className="h-12 rounded-xl font-black bg-gradient-to-r from-yellow-400 via-amber-400 to-yellow-500 text-stone-950 hover:from-yellow-300 hover:to-amber-300 shadow-lg flex-1 cursor-pointer border border-yellow-200"
                        >
                            確定購買
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
