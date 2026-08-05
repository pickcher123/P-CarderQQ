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
import { Gem, Loader2, Trophy, X, Dices, Users, Info, HelpCircle } from 'lucide-react';
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

const PrizeDisplayCard = ({ card, levelText, onPreview }: { card?: CardData, levelText: string, onPreview: (_card: CardData) => void }) => {
    if (!card) return (
        <div className="p-4 bg-slate-900/60 rounded-xl border border-dashed border-white/10 h-full flex flex-col items-center justify-center opacity-40 text-slate-400">
            <Trophy className="w-8 h-8 mb-2 text-amber-500/40"/>
            <p className="text-[10px] font-black uppercase tracking-widest">{levelText}</p>
        </div>
    );
    return (
        <div className="relative group/prize animate-fade-in-up cursor-zoom-in" onClick={() => onPreview(card)}>
            <div className="transition-all duration-500 hover:scale-105 hover:drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                <CardItem name={card.name} imageUrl={card.imageUrl} backImageUrl={card.backImageUrl} imageHint={card.name} isFlippable={false} />
            </div>
             <div className="mt-2 text-center">
                <p className="font-black text-[9px] uppercase text-amber-400/90 tracking-widest">{levelText}</p>
                <p className="font-bold text-[11px] truncate text-slate-200 group-hover/prize:text-amber-300 transition-colors">{card.name}</p>
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

    const handleSpotClick = (spot: number) => {
        if (isCompleted) return;
        setSelectedSpots(prev => {
            const next = new Set(prev);
            if (next.has(spot)) next.delete(spot);
            else next.add(spot);
            return next;
        });
    };

    const handleRandomPick = () => {
        const available = [];
        for (let i = 1; i <= luckBag.totalParticipants; i++) {
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
        const currency = luckBag.currency || 'p-point';
        try {
             await runTransaction(firestore, async (transaction) => {
                const totalCost = selectedSpots.size * (luckBag.price || 0);
                const userRef = doc(firestore, 'users', user.uid);
                const uSnap = await transaction.get(userRef);
                const userData = uSnap.data() as UserProfile;
                const walletBalance = currency === 'diamond' ? userData.points : userData.bonusPoints;
                
                if (walletBalance < totalCost) throw new Error("點數餘額不足");
                
                const purchasesRef = collection(firestore, 'luckBags', luckBag.id, 'luckBagPurchases');
                
                // Check if any spot is already taken
                for (const spot of selectedSpots) {
                    const spotRef = doc(purchasesRef, spot.toString());
                    const spotSnap = await transaction.get(spotRef);
                    if (spotSnap.exists()) {
                        throw new Error(`號碼 ${spot} 已經被選走了，請重新選擇`);
                    }
                }

                for (const spot of selectedSpots) {
                    transaction.set(doc(purchasesRef, spot.toString()), { 
                        userId: user.uid, 
                        username: userData.username,
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
                    details: `購買福袋格: ${luckBag.name}`, 
                    transactionDate: serverTimestamp() 
                });
            });
            if (forceRefetch) forceRefetch();
            toast({ title: '購買成功！' });
            setSelectedSpots(new Set());
            setIsConfirming(false);
        } catch (error: any) { 
            toast({ variant: 'destructive', title: '失敗', description: error.message }); 
        } finally { 
            setIsSubmitting(false); 
        }
    };
    
    const isCompleted = luckBag.status === '已開獎';
    const currency = luckBag.currency || 'p-point';
    const progress = (participantCount / (luckBag.totalParticipants || 1)) * 100;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 relative bg-slate-950 text-slate-100 rounded-3xl overflow-hidden border border-white/10 shadow-2xl my-4">
            {/* 左側獎項展示區 */}
            <div className="p-4 md:p-8 flex flex-col items-center border-b lg:border-b-0 lg:border-r border-white/10 bg-slate-900/40 backdrop-blur-xl">
                <div className="relative w-full aspect-[4/5] bg-slate-900/80 rounded-2xl p-4 md:p-6 border border-white/10 shadow-2xl flex flex-col">
                    <div className="relative flex-1 flex flex-col bg-slate-950/80 rounded-xl overflow-hidden p-4 md:p-6 border border-amber-500/20 shadow-inner">
                        <div className="mb-4 md:mb-6 pb-4 border-b border-white/10">
                            <h1 className="font-headline text-lg md:text-xl font-black text-white uppercase tracking-tight">{luckBag.name}</h1>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">每格單價:</span>
                                {currency === 'p-point' ? <PPlusIcon className="w-5 h-5" /> : <Gem className="w-5 h-5 text-cyan-400" />}
                                <p className="font-black text-2xl md:text-3xl text-amber-400 font-code leading-none drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">{(luckBag.price || 0).toLocaleString()}</p>
                            </div>
                        </div>
                        <div className="space-y-4 md:space-y-6 flex-1 flex flex-col justify-between">
                            <div className="grid grid-cols-3 gap-3 md:gap-4">
                                {luckBag.prizeCards.first && <PrizeDisplayCard card={luckBag.prizeCards.first} levelText="頭獎" onPreview={setPreviewCard} />}
                                {luckBag.prizeCards.second && <PrizeDisplayCard card={luckBag.prizeCards.second} levelText="貳獎" onPreview={setPreviewCard} />}
                                {luckBag.prizeCards.third && <PrizeDisplayCard card={luckBag.prizeCards.third} levelText="參獎" onPreview={setPreviewCard} />}
                                {[...luckBag.otherPrizesList, ...luckBag.otherPointsList.map(p => ({ ...p, isPoints: true }))].slice(0, 3).map((prize, index) => (
                                    'isPoints' in prize ? (
                                        <div key={prize.prizeId} className="flex flex-col items-center">
                                            <div className="p-4 bg-slate-900/80 rounded-xl border border-white/10 h-full flex flex-col items-center justify-center w-full aspect-[4/5] shadow-inner">
                                                <PPlusIcon className="w-12 h-12 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.4)]" />
                                            </div>
                                            <div className="mt-2 text-center">
                                                <p className="font-black text-[9px] uppercase text-amber-400/90 tracking-widest">{index + 4} 獎</p>
                                                <p className="font-bold text-[11px] truncate text-slate-200">{prize.points} 點數</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <PrizeDisplayCard 
                                            key={prize.prizeId} 
                                            card={prize} 
                                            levelText={`${index + 4} 獎`} 
                                            onPreview={setPreviewCard} 
                                        />
                                    )
                                ))}
                            </div>
                            
                            {/* 其他獎項按鈕 */}
                            {(luckBag.otherPrizesList && luckBag.otherPrizesList.length > 0 || luckBag.otherPointsList && luckBag.otherPointsList.length > 0) && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <div className="col-span-3 p-3 bg-slate-900/90 rounded-xl border border-white/10 flex items-center justify-center gap-3 cursor-pointer hover:border-amber-500/40 hover:bg-slate-800/80 transition-all mt-2 group">
                                            <Trophy className="w-5 h-5 text-amber-400 group-hover:scale-110 transition-transform" />
                                            <p className="text-xs font-black text-slate-200 group-hover:text-amber-300">查看完整獎項清單</p>
                                        </div>
                                    </DialogTrigger>
                                    <DialogContent className="max-w-md bg-slate-900 border-white/10 text-white rounded-3xl backdrop-blur-2xl">
                                        <DialogHeader>
                                            <DialogTitle className="text-xl font-black text-amber-400">完整獎項內容列表</DialogTitle>
                                        </DialogHeader>
                                        <ScrollArea className="max-h-[60vh] pr-2">
                                            <div className="space-y-2">
                                                {[...luckBag.otherPrizesList, ...luckBag.otherPointsList.map(p => ({ ...p, isPoints: true }))].slice(3).map((prize, index) => (
                                                    <div key={prize.prizeId} className="p-3 bg-slate-950 rounded-xl border border-white/10 flex items-center justify-between">
                                                        <span className="font-bold text-xs text-amber-400">{index + 7} 獎</span>
                                                        <span className="font-bold text-xs text-slate-200">{'isPoints' in prize ? `${prize.points} P+ 點數` : prize.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </ScrollArea>
                                    </DialogContent>
                                </Dialog>
                            )}
                            
                            <div className="p-3.5 bg-cyan-950/30 rounded-xl border border-cyan-500/20 flex items-start gap-3">
                                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                    <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">選號機制說明</p>
                                    <p className="text-[11px] font-bold text-slate-300 leading-relaxed">
                                        請選擇自由序號。募集完畢後系統將擇期安排公開直播並派獎。
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* 右側選號互動區 */}
            <div className="p-4 md:p-8 flex flex-col bg-slate-900/60 text-white backdrop-blur-2xl">
                {!isCompleted ? (
                    <>
                        <div className="mb-4 md:mb-6 flex flex-col gap-3 md:gap-4">
                            <div className="flex justify-between items-end">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">當前募集人次</p>
                                    <p className="text-xl md:text-2xl font-black font-code text-white">{participantCount} <span className="text-slate-500 text-sm font-normal">/ {luckBag.totalParticipants}</span></p>
                                </div>
                                <div className="flex gap-2">
                                    <Button variant="outline" size="sm" className="bg-slate-800/80 border-white/10 text-slate-200 hover:bg-slate-700 hover:text-white font-bold h-9 text-xs px-3.5 rounded-xl transition-all" onClick={() => setIsListOpen(true)}>
                                        <Users className="w-3.5 h-3.5 mr-1.5 text-cyan-400" /> 名單
                                    </Button>
                                    <Button variant="outline" size="sm" className="bg-slate-800/80 border-white/10 text-slate-200 hover:bg-amber-500 hover:text-slate-950 font-bold h-9 text-xs px-3.5 rounded-xl transition-all" onClick={() => setIsRandomPickOpen(true)}>
                                        <Dices className="w-3.5 h-3.5 mr-1.5 text-amber-400" /> 隨機
                                    </Button>
                                </div>
                            </div>
                            <div className="h-3 w-full bg-slate-950 rounded-full overflow-hidden border border-white/10 p-0.5">
                                <div className="h-full bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(245,158,11,0.5)]" style={{ width: `${progress}%` }} />
                            </div>
                        </div>

                        {/* 號碼棋盤格 */}
                        <ScrollArea className="flex-grow h-[300px] md:h-[380px] border border-white/10 bg-slate-950/80 rounded-2xl p-3 shadow-inner">
                            <div className="grid grid-cols-5 sm:grid-cols-8 gap-2 p-1">
                                {Array.from({ length: luckBag.totalParticipants || 0 }).map((_, i) => { 
                                    const spot = i + 1; 
                                    const taken = takenSpots.all.has(spot); 
                                    const isMine = takenSpots.mine.has(spot);
                                    const isSelected = selectedSpots.has(spot);
                                    return (
                                        <button 
                                            key={spot} 
                                            disabled={taken}
                                            onClick={() => handleSpotClick(spot)} 
                                            className={cn(
                                                "aspect-square rounded-xl flex items-center justify-center font-black text-xs md:text-sm transition-all border", 
                                                isMine ? "bg-cyan-950/60 text-cyan-300 border-cyan-500/40 cursor-not-allowed" :
                                                taken ? "bg-slate-900/60 text-slate-600 border-slate-900/40 cursor-not-allowed" : 
                                                isSelected ? "bg-gradient-to-br from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black border-amber-300 scale-110 shadow-[0_0_15px_rgba(245,158,11,0.6)] z-10" : 
                                                "bg-slate-900 border-white/10 text-slate-300 hover:border-amber-400/80 hover:text-amber-300 hover:bg-slate-800"
                                            )}
                                        >
                                            <span className="font-code">{spot}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </ScrollArea>

                        {luckBag.revealLottery ? (
                            <div className="mt-6 md:mt-8 pt-6 border-t border-white/10 flex flex-col items-center justify-center text-center">
                                <p className="text-lg md:text-xl font-black text-amber-400 uppercase tracking-widest animate-pulse">直播開獎作業中</p>
                                <p className="text-xs font-bold text-slate-400 mt-2">管理員正在進行即時抽獎派發，請稍候...</p>
                            </div>
                        ) : participantCount >= (luckBag.totalParticipants || 1) ? (
                            <div className="mt-6 md:mt-8 pt-6 border-t border-white/10 flex flex-col items-center justify-center text-center">
                                <p className="text-lg md:text-xl font-black text-emerald-400 uppercase tracking-widest">已全數額滿，等待直播派獎</p>
                                <p className="text-xs font-bold text-slate-400 mt-2">請留意社群官方直播時間，派發結果將同步登錄。</p>
                            </div>
                        ) : (
                            <>
                                <div className="mt-6 md:mt-8 pt-6 border-t border-white/10 flex flex-col sm:flex-row justify-between items-center sm:items-end gap-4">
                                    <div className="w-full sm:w-auto text-center sm:text-left">
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">應付總額 ({selectedSpots.size} 格)</p>
                                        <div className="flex items-center justify-center sm:justify-start gap-2 text-3xl md:text-4xl font-black font-code text-amber-400">
                                            {(selectedSpots.size * (luckBag.price || 0)).toLocaleString()}
                                            {currency === 'diamond' ? <Gem className="w-7 h-7 text-cyan-400" /> : <PPlusIcon className="w-7 h-7" />}
                                        </div>
                                    </div>
                                    <Button 
                                        className="w-full sm:w-auto h-14 rounded-2xl px-8 font-black bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 text-slate-950 hover:brightness-110 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all active:scale-95 text-base" 
                                        disabled={selectedSpots.size === 0 || isSubmitting} 
                                        onClick={() => setIsConfirming(true)}
                                    >
                                        {isSubmitting ? <Loader2 className="animate-spin text-slate-950" /> : '鎖定號碼並結帳'}
                                    </Button>
                                </div>
                            </>
                        )}
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center space-y-6 md:space-y-8 py-10">
                        <Trophy className="w-16 h-16 md:w-20 md:h-20 text-amber-400 animate-bounce" />
                        <div>
                            <h2 className="text-2xl md:text-3xl font-black uppercase tracking-widest italic text-amber-400">活動已順利開獎</h2>
                            <p className="text-xs text-slate-400 mt-1">恭喜以下獲獎幸運藏友！</p>
                        </div>
                        {luckBag.winners && (
                            <div className="w-full p-6 bg-slate-950/80 border border-amber-500/30 rounded-3xl space-y-2 shadow-2xl">
                                <span className="text-[10px] font-black uppercase text-amber-400/80 tracking-[0.3em]">頭獎中獎序號</span>
                                <p className="text-5xl md:text-6xl font-black font-code text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.4)]"># {luckBag.winners.first}</p>
                                <p className="text-xs font-bold text-cyan-400">得獎玩家：{purchases?.find(p => p.spotNumber === luckBag.winners?.first)?.username || '查驗中...'}</p>
                            </div>
                        )}
                        <Button variant="outline" className="rounded-xl border-white/20 bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold" onClick={() => setIsListOpen(true)}>
                            查看完整獲獎名單
                        </Button>
                    </div>
                )}
            </div>
            
            {/* 卡片預覽 Modal */}
            <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
                <DialogContent className="max-w-[min(95vw,420px)] bg-transparent border-none p-0 flex flex-col items-center justify-center gap-4 sm:gap-6 [&>button:last-child]:hidden">
                    <DialogTitle asChild>
                        <VisuallyHidden>卡片預覽</VisuallyHidden>
                    </DialogTitle>
                    {previewCard && (
                        <div className="w-full flex flex-col items-center gap-6 sm:gap-8 pt-4">
                            <h2 className="text-base sm:text-lg font-black text-white text-center px-4 drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">{previewCard.name}</h2>
                            <div className="w-[80%] sm:w-full max-w-[320px]">
                                <CardItem name={previewCard.name} imageUrl={previewCard.imageUrl} backImageUrl={previewCard.backImageUrl} imageHint={previewCard.name} rarity="legendary" isFlippable={true}/>
                            </div>
                        </div>
                    )}
                    <Button variant="ghost" size="icon" className="mt-2 sm:mt-4 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-white/10 h-10 w-10 sm:h-12 sm:w-12 text-white" onClick={() => setPreviewCard(null)}>
                        <X className="h-5 w-5 sm:h-6 sm:w-6" />
                    </Button>
                </DialogContent>
            </Dialog>

            {/* 隨機選號 Dialog */}
            <Dialog open={isRandomPickOpen} onOpenChange={setIsRandomPickOpen}>
                <DialogContent className="max-w-[min(95vw,360px)] rounded-3xl bg-slate-900 border-white/10 p-6 text-white backdrop-blur-2xl">
                    <DialogTitle className="font-headline font-black text-xl tracking-tight italic uppercase text-amber-400">電腦隨機號碼選取</DialogTitle>
                    <DialogHeader>
                        <DialogDescription className="text-slate-400 font-bold text-xs">輸入您想要隨機鎖定的格數數量。</DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="text-[10px] font-black uppercase text-slate-400 mb-2 block text-center">購買格數</Label>
                        <Input 
                            type="number" 
                            min={1} 
                            max={luckBag.totalParticipants} 
                            value={randomPickCount} 
                            onChange={(e) => setRandomPickCount(Number(e.target.value))} 
                            className="h-14 bg-slate-950 border-white/10 rounded-2xl font-code text-3xl font-black text-center text-amber-400 focus-visible:ring-amber-500"
                        />
                    </div>
                    <DialogFooter className="sm:flex-col gap-2">
                        <Button onClick={handleRandomPick} className="w-full h-12 font-black rounded-2xl bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg">確認隨機挑選</Button>
                        <Button variant="ghost" onClick={() => setIsRandomPickOpen(false)} className="w-full h-10 font-bold text-slate-400 hover:text-white">取消</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 參與名單/開獎名單 Dialog */}
            <Dialog open={isListOpen} onOpenChange={setIsListOpen}>
                <DialogContent className="max-w-4xl h-[85vh] sm:h-auto sm:max-h-[85vh] flex flex-col gap-0 p-0 overflow-hidden bg-slate-900 border-white/10 rounded-3xl text-white backdrop-blur-2xl">
                    <DialogHeader className="p-6 bg-slate-950/80 border-b border-white/10 shrink-0">
                        <DialogTitle className="font-headline font-black text-xl italic uppercase flex items-center gap-3 text-amber-400">
                            <Users className="w-6 h-6 text-amber-400" /> 福袋號碼與藏友公示名單
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 font-bold text-xs">即時公開公平透明：檢視所有號碼的目前佔用狀態。</DialogDescription>
                    </DialogHeader>
                    <div className="flex-1 overflow-y-auto p-6 bg-slate-950/50 overscroll-contain">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                            {Array.from({ length: luckBag.totalParticipants }).map((_, i) => {
                                const spotNum = i + 1;
                                const p = purchases?.find(x => x.spotNumber === spotNum);
                                const winner = luckBag.winners && (
                                    luckBag.winners.first === spotNum ? '頭獎' :
                                    luckBag.winners.second === spotNum ? '貳獎' :
                                    luckBag.winners.third === spotNum ? '參獎' :
                                    luckBag.winners.other?.some(o => o.spotNumber === spotNum) ? '普獎' : null
                                );

                                return (
                                    <div 
                                        key={spotNum} 
                                        className={cn(
                                            "flex flex-col p-3 rounded-2xl border transition-all group",
                                            winner ? "bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10" : 
                                            p ? "bg-slate-900/80 border-white/10" : "bg-slate-950/40 border-dashed border-white/5 opacity-50"
                                        )}
                                    >
                                        <div className="flex justify-between items-start mb-1">
                                            <span className={cn("font-code font-black text-base", winner ? "text-amber-400" : "text-slate-400")}>#{spotNum}</span>
                                            {winner && <Badge className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 border-none uppercase">{winner}</Badge>}
                                        </div>
                                        <div className="truncate">
                                            {p ? (
                                                <p className="font-bold text-xs text-slate-200 truncate">{p.username || '已購買'}</p>
                                            ) : (
                                                <p className="text-[10px] text-slate-500 font-medium italic">待選號</p>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                    <div className="p-4 border-t border-white/10 bg-slate-950/80 shrink-0">
                        <Button onClick={() => setIsListOpen(false)} className="w-full h-12 rounded-2xl font-black bg-slate-800 text-white hover:bg-slate-700">
                            關閉視窗
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 交易確認 Dialog */}
            <AlertDialog open={isConfirming} onOpenChange={setIsConfirming}>
                <AlertDialogContent className="max-w-[min(95vw,420px)] rounded-3xl bg-slate-900 border-white/10 text-white backdrop-blur-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black italic text-xl uppercase tracking-tight text-amber-400">福袋選號購買確認</AlertDialogTitle>
                        <AlertDialogDescription asChild>
                            <div className="text-slate-300 font-bold space-y-4 pt-2">
                                <p className="text-sm">確定要支付 <span className="text-amber-400 font-code font-black text-lg">{(selectedSpots.size * (luckBag.price || 0)).toLocaleString()}</span> {currency === 'diamond' ? '鑽石' : 'P+ 點數'} 鎖定所選的 <span className="text-white font-black">{selectedSpots.size}</span> 個號碼嗎？</p>
                                <div className="p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5 text-left text-xs leading-relaxed space-y-1">
                                    <p className="font-black text-amber-400 flex items-center gap-1.5"><HelpCircle className="w-4 h-4" /> 溫馨提醒：</p>
                                    <ul className="list-none pl-0 space-y-1 font-bold text-slate-300">
                                        <li>● 福袋屬隨機開獎類型，一經鎖定購買恕不受理取消或退還。</li>
                                        <li>● 募集滿額後將進行開獎，中獎卡片將自動登錄至您的「個人收藏庫」。</li>
                                    </ul>
                                </div>
                            </div>
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-3 mt-4">
                        <AlertDialogCancel className="h-12 rounded-xl font-bold bg-slate-800 border-none text-slate-300 hover:bg-slate-700 hover:text-white flex-1">取消</AlertDialogCancel>
                        <AlertDialogAction onClick={handlePurchase} disabled={isSubmitting} className="h-12 rounded-xl font-black bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-lg flex-1">確定購買</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}