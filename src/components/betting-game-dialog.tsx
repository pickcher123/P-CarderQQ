import { useState, useMemo } from 'react';
import { useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, increment, runTransaction, arrayUnion } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { Gem, AlertCircle, Sparkles, X, Play } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
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
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { CardItem } from '@/components/card-item';
import { useToast } from '@/hooks/use-toast';
import { userLevels } from '@/components/member-level-crown';
import type { UserProfile } from '@/types/user-profile';
import type { LevelBenefit } from '@/types/system';

interface CardData {
    id: string;
    name: string;
    category: string;
    rarity: string;
    imageUrl: string;
    backImageUrl?: string;
    imageHint: string;
    sellPrice?: number;
    isSold?: boolean;
    dailyLimit?: number;
    minLevel?: string;
    isFeatured?: boolean;
    lockedBy?: string;
    lockedAt?: any;
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

export function BettingGameDialog({ 
    card, 
    children, 
    categoryName, 
    onSpinStart, 
    onClose 
}: { 
    card: CardData; 
    children: React.ReactNode; 
    categoryName: string; 
    onSpinStart?: () => void; 
    onClose?: () => void; 
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
    const [paymentCurrency, setPaymentCurrency] = useState<'diamond' | 'pplus'>('diamond');
    const [isSpinning, setIsSpinning] = useState(false);
    const [spinActive, setSpinActive] = useState(false);
    const [finalResult, setFinalResult] = useState<{ spot: number; won: boolean } | null>(null);
    const [wheelStrip, setWheelStrip] = useState<number[]>([]);

    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const userProfileRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const isOutOfStock = Boolean(card?.isSold);

    const unitPrice = useMemo(() => {
        if (!card?.sellPrice) return 10;
        const diamondBase = Math.round(card.sellPrice * 0.1);
        return paymentCurrency === 'diamond' ? diamondBase : diamondBase * 10;
    }, [card, paymentCurrency]);

    const totalPrice = useMemo(() => selectedNumbers.length * unitPrice, [selectedNumbers, unitPrice]);

    const numbers = Array.from({ length: 10 }, (_, i) => i + 1);

    const toggleNumber = (num: number) => {
        if (isOutOfStock || isSpinning) return;
        setFinalResult(null);
        setWheelStrip([]);

        if (selectedNumbers.includes(num)) {
            setSelectedNumbers(selectedNumbers.filter(n => n !== num));
        } else {
            setSelectedNumbers([...selectedNumbers, num]);
        }
    };

    const handleSpin = async () => {
        if (!user || !firestore || !card || selectedNumbers.length === 0 || !categoryName || !userProfile || isSpinning || isOutOfStock) return;

        const levelNames = userLevels.map(l => l.level);
        if (levelNames.indexOf(userProfile.userLevel) < (card.minLevel ? levelNames.indexOf(card.minLevel) : 0)) {
            toast({ variant: 'destructive', title: '權限不足', description: `本項目僅限「${card.minLevel}」以上參與。` });
            return;
        }

        if (onSpinStart) onSpinStart();
        setIsSpinning(true);
        setSpinActive(false);

        try {
            const transactionResult = await runTransaction(firestore, async (transaction) => {
                const cardRef = doc(firestore, 'allCards', card.id);
                const cardSnap = await transaction.get(cardRef);
                const cardData = cardSnap.data();
                if (cardData?.isSold) throw new Error("此卡片已被抽出，請重新整理後再試。");

                if (cardData?.lockedBy && cardData.lockedBy !== user.uid && cardData.lockedAt && (Date.now() - cardData.lockedAt.toMillis() < 30000)) {
                    throw new Error("此卡片正在被其他人拼，請稍候再試。");
                }

                const cardUpdates: any = { lockedBy: user.uid, lockedAt: serverTimestamp() };

                const userRef = doc(firestore, 'users', user.uid);
                const uSnap = await transaction.get(userRef);
                const userData = uSnap.data() as UserProfile;
                const walletBalance = paymentCurrency === 'diamond' ? userData.points : userData.bonusPoints;
                if (walletBalance < totalPrice) throw new Error("點數不足");

                const winningSpot = Math.floor(Math.random() * 10) + 1;
                const didWin = selectedNumbers.includes(winningSpot);
                const walletField = paymentCurrency === 'diamond' ? 'points' : 'bonusPoints';
                const updateObj: any = { [walletField]: increment(-totalPrice) };
                if (paymentCurrency === 'diamond') {
                    updateObj.totalSpent = increment(totalPrice);
                    updateObj.userLevel = calculateLevel(userData.totalSpent + totalPrice);
                }
                transaction.update(userRef, updateObj);

                const winText = didWin ? 'true' : 'false';
                const detailString = `Bet on ${card.name}. Currency: ${paymentCurrency}. Spots: [${selectedNumbers.join(',')}]. Result: ${winningSpot}. Win: ${winText}`;

                transaction.set(doc(collection(firestore, 'transactions')), {
                    userId: user.uid,
                    targetId: card.id,
                    transactionType: 'Purchase',
                    section: 'betting',
                    currency: paymentCurrency,
                    amount: -totalPrice,
                    details: detailString,
                    transactionDate: serverTimestamp()
                });

                if (didWin) {
                    transaction.set(doc(collection(firestore, 'users', user.uid, 'userCards')), {
                        userId: user.uid,
                        cardId: card.id,
                        isFoil: true,
                        rarity: card.rarity || 'unknown',
                        category: card.category,
                        source: 'betting'
                    });
                    cardUpdates.isSold = true;
                    if (decodeURIComponent(categoryName) !== 'all') {
                        transaction.update(doc(firestore, 'betting-items', decodeURIComponent(categoryName)), { soldCardIds: arrayUnion(card.id) });
                    }
                }

                transaction.update(cardRef, cardUpdates);

                return { spot: winningSpot, won: didWin };
            });

            // Reel Strip setup
            const startNum = finalResult ? finalResult.spot : (selectedNumbers[selectedNumbers.length - 1] || 1);
            const newStrip = [startNum];
            let currentNum = startNum;

            for (let i = 0; i < 30; i++) {
                currentNum = (currentNum % 10) + 1;
                newStrip.push(currentNum);
            }
            while (currentNum !== transactionResult.spot) {
                currentNum = (currentNum % 10) + 1;
                newStrip.push(currentNum);
            }

            setWheelStrip(newStrip);

            setTimeout(() => {
                setSpinActive(true);
                setTimeout(() => {
                    setIsSpinning(false);
                    setFinalResult(transactionResult);
                    setWheelStrip([transactionResult.spot]);
                    setSpinActive(false);
                    toast({
                        title: transactionResult.won ? '🎉 恭喜中獎！' : '😅 差一點！幸運女神正在路上',
                        description: transactionResult.won 
                            ? `幸運號碼是 ${transactionResult.spot}，您已成功拿到該卡片！已加入您的個人收藏庫。` 
                            : `開出號碼是 ${transactionResult.spot}，請再接再厲！`,
                        variant: transactionResult.won ? 'default' : 'destructive',
                    });
                }, 3000);
            }, 50);

        } catch (e: any) {
            console.error(e);
            toast({ title: '操作失敗', description: e.message, variant: 'destructive' });
            setIsSpinning(false);
            setSpinActive(false);
        }
    };

    const handleDialogClose = (open: boolean) => {
        if (!open) {
            setFinalResult(null);
            setSelectedNumbers([]);
            setIsSpinning(false);
            setSpinActive(false);
            setWheelStrip([]);
            if (onClose) onClose();
        }
        setIsOpen(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-[95vw] lg:max-w-5xl p-0 overflow-hidden rounded-3xl bg-[#0b101e]/95 backdrop-blur-2xl border border-slate-700/50 shadow-[0_0_50px_rgba(2,132,199,0.15)] text-slate-100 max-h-[92vh] overflow-y-auto custom-scrollbar [&>button:last-child]:hidden">
                <VisuallyHidden>
                    <DialogTitle>電競科技風拼卡抽獎</DialogTitle>
                </VisuallyHidden>

                <div className="relative w-full flex flex-col lg:flex-row">
                    {/* 右上角關閉按鈕 */}
                    <button 
                        onClick={() => handleDialogClose(false)} 
                        className="absolute top-4 right-4 z-30 p-2 text-slate-400 hover:text-white hover:bg-slate-800/50 rounded-full transition-colors cursor-pointer"
                    >
                        <X className="w-6 h-6" />
                    </button>

                    {/* 左側：商品展示區 */}
                    <div className="w-full lg:w-1/2 p-6 lg:p-10 flex flex-col items-center justify-center relative bg-gradient-to-br from-[#111827] to-[#030712] border-b lg:border-b-0 lg:border-r border-slate-800/50 min-h-[380px]">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>

                        <div className={cn(
                            "relative w-full max-w-[260px] sm:max-w-[300px] aspect-[2.5/3.8] rounded-2xl transition-all duration-700 ease-in-out p-1 bg-gradient-to-b from-slate-700 to-slate-900 border-2 border-slate-600 shadow-2xl flex flex-col justify-between overflow-hidden",
                            isOutOfStock && "grayscale-[0.8] opacity-70 border-slate-800 bg-slate-900"
                        )}>
                            <CardItem 
                                name={card.name} 
                                imageUrl={card.imageUrl} 
                                backImageUrl={card.backImageUrl} 
                                imageHint={card.imageHint || card.name} 
                                isFlippable={!isOutOfStock} 
                                rarity={(card.rarity as any) || "legendary"} 
                            />

                            {isOutOfStock && (
                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/65 backdrop-blur-[2px] rounded-2xl p-2 pointer-events-none">
                                    <div className="border-4 border-rose-500/90 bg-rose-500/20 backdrop-blur-md px-3 sm:px-5 py-2.5 sm:py-3 rounded-xl transform -rotate-12 shadow-[0_0_30px_rgba(244,63,94,0.4)] flex items-center justify-center text-center max-w-[92%] border-dashed">
                                        <span className="text-rose-100 font-black text-lg sm:text-2xl md:text-3xl tracking-widest drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] italic whitespace-nowrap leading-none select-none">
                                            OUT OF STOCK
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 卡片標題與價格資訊 */}
                        <div className="mt-4 text-center space-y-1 z-10">
                            <h2 className="text-lg font-bold tracking-wide text-slate-200">{card.name}</h2>
                            <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                                參考價值：
                                <span className="text-cyan-400 font-mono font-bold flex items-center gap-1">
                                    <Gem className="w-3.5 h-3.5" />
                                    {card.sellPrice ? card.sellPrice.toLocaleString() : '---'}
                                </span>
                            </p>
                        </div>
                    </div>

                    {/* 右側：操作控制區 */}
                    <div className="w-full lg:w-1/2 p-6 lg:p-10 flex flex-col justify-between relative space-y-8">
                        
                        {/* STEP 01: 選擇支付幣別 */}
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="bg-cyan-500 text-slate-950 font-black px-3 py-1 text-xs rounded-sm tracking-widest transform skew-x-[-15deg] shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                                    <span className="transform skew-x-[15deg] block">STEP 01</span>
                                </span>
                                <span className="text-cyan-400 font-bold tracking-wide text-sm">選擇支付幣別</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    type="button"
                                    onClick={() => !isOutOfStock && !isSpinning && setPaymentCurrency('diamond')}
                                    disabled={isOutOfStock || isSpinning}
                                    className={cn(
                                        "relative flex items-center justify-center gap-2 py-3 rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer",
                                        paymentCurrency === 'diamond' 
                                            ? 'bg-[#0f172a] border-cyan-500 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                                            : 'bg-[#1e293b]/50 border-slate-700/50 hover:bg-[#1e293b]',
                                        (isOutOfStock || isSpinning) && 'opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    {paymentCurrency === 'diamond' && <div className="absolute top-0 w-1/2 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent"></div>}
                                    <Gem className={cn("w-5 h-5", paymentCurrency === 'diamond' ? 'text-cyan-400 fill-cyan-400/20' : 'text-slate-400')} />
                                    <span className={cn("font-bold text-sm", paymentCurrency === 'diamond' ? 'text-cyan-100' : 'text-slate-400')}>鑽石</span>
                                </button>
                                
                                <button 
                                    type="button"
                                    onClick={() => !isOutOfStock && !isSpinning && setPaymentCurrency('pplus')}
                                    disabled={isOutOfStock || isSpinning}
                                    className={cn(
                                        "relative flex items-center justify-center gap-2 py-3 rounded-xl border transition-all duration-300 overflow-hidden cursor-pointer",
                                        paymentCurrency === 'pplus' 
                                            ? 'bg-[#0f172a] border-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]' 
                                            : 'bg-[#1e293b]/50 border-slate-700/50 hover:bg-[#1e293b]',
                                        (isOutOfStock || isSpinning) && 'opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    {paymentCurrency === 'pplus' && <div className="absolute top-0 w-1/2 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent"></div>}
                                    <PPlusIcon className={cn("w-5 h-5", paymentCurrency === 'pplus' ? 'text-amber-400' : 'text-slate-400')} />
                                    <span className={cn("font-bold text-sm", paymentCurrency === 'pplus' ? 'text-amber-100' : 'text-slate-400')}>P+ 點數</span>
                                </button>
                            </div>
                        </div>

                        {/* STEP 02: 挑選幸運號碼 */}
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="bg-cyan-500 text-slate-950 font-black px-3 py-1 text-xs rounded-sm tracking-widest transform skew-x-[-15deg] shadow-[0_0_10px_rgba(6,182,212,0.5)]">
                                    <span className="transform skew-x-[15deg] block">STEP 02</span>
                                </span>
                                <span className="text-cyan-400 font-bold tracking-wide text-sm">挑選幸運號碼 (1/10 機率)</span>
                            </div>
                            
                            <div className="grid grid-cols-5 gap-2.5">
                                {numbers.map(num => {
                                    const isSelected = selectedNumbers.includes(num);
                                    return (
                                        <button
                                            type="button"
                                            key={num}
                                            onClick={() => toggleNumber(num)}
                                            disabled={isOutOfStock || isSpinning}
                                            className={cn(
                                                "relative aspect-square flex items-center justify-center rounded-xl text-lg font-black font-mono transition-all duration-300 border cursor-pointer",
                                                isOutOfStock || isSpinning 
                                                    ? 'bg-[#1e293b]/30 border-slate-800 text-slate-600 cursor-not-allowed' 
                                                    : isSelected 
                                                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.4)] scale-105'
                                                    : 'bg-[#1e293b]/50 border-slate-700/50 text-slate-400 hover:bg-slate-800 hover:border-slate-600 hover:text-slate-200'
                                            )}
                                        >
                                            {num}
                                            {isSelected && !isOutOfStock && <div className="absolute -top-1 -right-1 w-3 h-3 bg-cyan-400 rounded-full shadow-[0_0_5px_#22d3ee]"></div>}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* 價格資訊區塊 */}
                        <div className="flex justify-between items-end bg-[#0f172a]/80 p-4 rounded-2xl border border-slate-800">
                            <div>
                                <p className="text-slate-500 text-xs font-bold mb-1">單注價格</p>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xl font-black text-slate-200">{unitPrice.toLocaleString()}</span>
                                    {paymentCurrency === 'diamond' ? <Gem className="w-4 h-4 text-cyan-400" /> : <PPlusIcon className="w-4 h-4 text-amber-400" />}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-cyan-500 text-xs font-bold mb-1">下注總計 ({selectedNumbers.length} 注)</p>
                                <div className="flex items-center gap-1.5 justify-end">
                                    <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-300">
                                        {totalPrice.toLocaleString()}
                                    </span>
                                    {paymentCurrency === 'diamond' ? <Gem className="w-5 h-5 text-cyan-400 fill-cyan-400/20" /> : <PPlusIcon className="w-5 h-5 text-amber-400" />}
                                </div>
                            </div>
                        </div>

                        {/* STEP 03: 啟動命運轉輪 */}
                        <div>
                            <div className="flex items-center gap-3 mb-3">
                                <span className="bg-amber-500 text-slate-950 font-black px-3 py-1 text-xs rounded-sm tracking-widest transform skew-x-[-15deg] shadow-[0_0_10px_rgba(245,158,11,0.5)]">
                                    <span className="transform skew-x-[15deg] block">STEP 03</span>
                                </span>
                                <span className="text-amber-400 font-bold tracking-wide text-sm">啟動命運轉輪</span>
                            </div>
                            
                            <div className="relative w-full mb-4 pr-10 md:pr-14">
                                {/* 拉桿結構 */}
                                <div className="absolute right-0 md:right-1 top-1/2 -translate-y-1/2 w-12 h-32 z-0">
                                    <div className="absolute bottom-5 left-0 w-7 h-10 bg-gradient-to-r from-slate-800 to-slate-700 rounded-r-xl border-y-[2px] border-r-[2px] border-slate-600 shadow-[4px_0_10px_rgba(0,0,0,0.6)]"></div>
                                    <div className={cn(
                                        "absolute bottom-8 left-2 origin-[center_bottom] flex flex-col items-center transition-transform duration-[500ms] ease-in-out z-10",
                                        isSpinning ? 'rotate-[75deg] translate-y-2' : 'rotate-[15deg]'
                                    )}>
                                        <div className="w-8 h-8 bg-gradient-to-br from-rose-400 to-rose-700 rounded-full shadow-[inset_-2px_-2px_6px_rgba(0,0,0,0.6),_0_5px_10px_rgba(0,0,0,0.5)] relative z-20 border border-rose-800 flex-shrink-0">
                                            <div className="absolute top-1.5 left-1.5 w-2 h-2 bg-white/60 rounded-full blur-[1px]"></div>
                                        </div>
                                        <div className="w-2.5 h-16 bg-gradient-to-r from-slate-400 via-slate-200 to-slate-500 border-x border-slate-400 shadow-[inset_0_0_5px_rgba(0,0,0,0.3)] -mt-1 flex-shrink-0 rounded-full"></div>
                                    </div>
                                </div>

                                {/* 老虎機螢幕主體 */}
                                <div className="relative w-full h-32 bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl border-[3px] border-slate-700 shadow-[inset_0_10px_20px_rgba(0,0,0,0.8),_0_5px_15px_rgba(0,0,0,0.5)] overflow-hidden flex items-center justify-center z-10">
                                    <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-transparent to-black/80 pointer-events-none z-20"></div>
                                    
                                    <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-slate-800 to-slate-900 border-r border-slate-700 z-10 shadow-[2px_0_10px_rgba(0,0,0,0.5)] flex items-center justify-center">
                                        <div className="w-1 h-16 bg-slate-700 rounded-full shadow-inner"></div>
                                    </div>
                                    <div className="absolute right-0 top-0 bottom-0 w-6 bg-gradient-to-l from-slate-800 to-slate-900 border-l border-slate-700 z-10 shadow-[-2px_0_10px_rgba(0,0,0,0.5)] flex items-center justify-center">
                                        <div className="w-1 h-16 bg-slate-700 rounded-full shadow-inner"></div>
                                    </div>

                                    <div className="absolute left-5 right-5 top-1/2 -translate-y-1/2 h-[2px] bg-rose-500/80 z-30 shadow-[0_0_12px_rgba(244,63,94,1)]"></div>
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[12px] border-l-rose-500 z-30 drop-shadow-[0_0_5px_rgba(244,63,94,0.8)]"></div>
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[12px] border-r-rose-500 z-30 drop-shadow-[0_0_5px_rgba(244,63,94,0.8)]"></div>

                                    <div className="w-28 sm:w-32 h-full bg-gradient-to-r from-slate-400 via-slate-200 to-slate-400 shadow-[inset_0_0_15px_rgba(0,0,0,0.7)] relative z-0 flex flex-col items-center border-x-2 border-slate-500 overflow-hidden">
                                        <div 
                                            className="flex flex-col w-full text-slate-900 font-mono font-black"
                                            style={{
                                                transition: spinActive ? 'transform 3s cubic-bezier(0.1, 0.9, 0.2, 1)' : 'none',
                                                transform: spinActive ? 'translateY(calc(-100% + 8rem))' : 'translateY(0)'
                                            }}
                                        >
                                            {wheelStrip.length > 0 ? (
                                                wheelStrip.map((num, i) => (
                                                    <div key={i} className="h-32 flex-shrink-0 flex items-center justify-center text-6xl drop-shadow-md">
                                                        {num}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="h-32 flex-shrink-0 flex items-center justify-center text-6xl drop-shadow-md">
                                                    {isOutOfStock ? '-' : (selectedNumbers.length > 0 ? selectedNumbers[selectedNumbers.length - 1] : '-')}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 開獎結果顯示 */}
                            {finalResult && (
                                <div className="mb-4 p-4 rounded-xl bg-slate-900/90 border border-slate-700 flex flex-col items-center gap-2 text-center animate-in fade-in zoom-in-95">
                                    <p className="text-xs text-slate-400 font-bold">開獎結果號碼</p>
                                    <span className={cn(
                                        "text-5xl font-black font-mono tracking-widest",
                                        finalResult.won ? "text-amber-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]" : "text-rose-400"
                                    )}>
                                        {finalResult.spot}
                                    </span>
                                    <p className={cn("text-sm font-bold", finalResult.won ? "text-amber-300" : "text-slate-400")}>
                                        {finalResult.won ? "🎉 恭喜中獎！卡片已加入您的收藏庫！" : "😅 差一點點！號碼未命中，再接再厲！"}
                                    </p>
                                    <button 
                                        type="button"
                                        onClick={() => { setFinalResult(null); setSelectedNumbers([]); }}
                                        className="mt-1 px-4 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-xs font-bold hover:bg-slate-700 transition-colors"
                                    >
                                        再拼一次
                                    </button>
                                </div>
                            )}

                            {/* 啟動按鈕 */}
                            {isOutOfStock ? (
                                <button 
                                    type="button" 
                                    disabled 
                                    className="w-full py-3.5 rounded-xl font-bold tracking-widest flex items-center justify-center gap-2 bg-rose-950/40 border border-rose-900/50 text-rose-500/80 cursor-not-allowed text-sm"
                                >
                                    <AlertCircle className="w-5 h-5" />
                                    此品項已被抽出
                                </button>
                            ) : (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <button 
                                            type="button"
                                            disabled={selectedNumbers.length === 0 || isSpinning}
                                            className={cn(
                                                "w-full py-3.5 rounded-xl font-bold tracking-widest flex items-center justify-center gap-2 transition-all duration-300 relative overflow-hidden group text-sm cursor-pointer",
                                                selectedNumbers.length > 0 && !isSpinning 
                                                    ? 'bg-gradient-to-r from-cyan-600 to-blue-700 hover:from-cyan-500 hover:to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.4)] border border-cyan-400/50' 
                                                    : 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                                            )}
                                        >
                                            {selectedNumbers.length > 0 && !isSpinning && (
                                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]"></div>
                                            )}
                                            {isSpinning ? (
                                                <><Sparkles className="w-5 h-5 animate-spin text-cyan-400" />抽獎中...</>
                                            ) : (
                                                <><Play className={cn("w-5 h-5", selectedNumbers.length > 0 ? 'fill-current' : '')} />確認啟動 ({selectedNumbers.length} 注)</>
                                            )}
                                        </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-3xl bg-slate-950 border-slate-800 border-2 text-slate-100 max-w-md">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="font-headline font-black text-cyan-400 text-lg flex items-center gap-2">
                                                <Sparkles className="w-5 h-5" /> 系統下注確認
                                            </AlertDialogTitle>
                                        </AlertDialogHeader>
                                        <div className="p-4 rounded-xl border border-cyan-500/20 bg-cyan-950/20 text-xs text-slate-300 space-y-3">
                                            <div className="flex justify-between border-b border-slate-800 pb-2">
                                                <span className="text-slate-400">選擇號碼：</span>
                                                <span className="font-mono font-bold text-cyan-300">[{selectedNumbers.join(', ')}]</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-800 pb-2">
                                                <span className="text-slate-400">扣除金額：</span>
                                                <span className="font-mono font-bold text-amber-400">
                                                    {totalPrice.toLocaleString()} {paymentCurrency === 'diamond' ? '鑽石' : 'P+ 點數'}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-[11px] text-slate-400 pt-1">
                                                <p className="font-bold text-rose-400 flex items-center gap-1">
                                                    <AlertCircle className="w-3.5 h-3.5" /> 注意事項：
                                                </p>
                                                <p>1. 本功能屬機率型試手氣遊戲，按下確認後將立即扣除點數。</p>
                                                <p>2. 一經完成扣點即提供服務，不適用消費者保護法七日猶豫期。</p>
                                            </div>
                                        </div>
                                        <AlertDialogFooter className="gap-2">
                                            <AlertDialogCancel className="h-10 rounded-xl font-bold bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700">
                                                取消
                                            </AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={handleSpin} 
                                                className="h-10 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold border-none"
                                            >
                                                確認執行下注
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>
                </div>
                <style dangerouslySetInnerHTML={{__html: `@keyframes shimmer { 100% { transform: translateX(100%); } }`}} />
            </DialogContent>
        </Dialog>
    );
}
