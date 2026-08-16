'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, increment, runTransaction, arrayUnion } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { 
    Gem, AlertCircle, Sparkles, X, Play, CheckCircle2, 
    RotateCcw, Dices, Layers, Trophy, Wallet, ArrowRight, ShieldCheck 
} from 'lucide-react';
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
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { CardItem } from '@/components/card-item';
import { useToast } from '@/hooks/use-toast';
import { userLevels } from '@/components/member-level-crown';
import type { UserProfile } from '@/types/user-profile';
import type { LevelBenefit } from '@/types/system';
import Link from 'next/link';

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

const ITEM_HEIGHT = 120; // 每個老虎機滾輪數字項目的精確高度 (px)

export function BettingGameDialog({ 
    card, 
    children, 
    categoryName, 
    onSpinStart, 
    onClose,
    disabled = false
}: { 
    card: CardData; 
    children: React.ReactNode; 
    categoryName: string; 
    onSpinStart?: () => void; 
    onClose?: () => void; 
    disabled?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
    const [paymentCurrency, setPaymentCurrency] = useState<'diamond' | 'pplus'>('diamond');
    const [isSpinning, setIsSpinning] = useState(false);
    const [spinActive, setSpinActive] = useState(false);
    const [finalResult, setFinalResult] = useState<{ spot: number; won: boolean } | null>(null);
    const [wheelStrip, setWheelStrip] = useState<number[]>([]);
    const [spinTranslateY, setSpinTranslateY] = useState(0);

    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const userProfileRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const isOutOfStock = Boolean(card?.isSold);

    const diamondBalance = userProfile?.points ?? 0;
    const pplusBalance = userProfile?.bonusPoints ?? 0;

    const unitPrice = useMemo(() => {
        if (!card?.sellPrice) return 10;
        const diamondBase = Math.max(1, Math.round(card.sellPrice * 0.1));
        return paymentCurrency === 'diamond' ? diamondBase : diamondBase * 10;
    }, [card, paymentCurrency]);

    const totalPrice = useMemo(() => selectedNumbers.length * unitPrice, [selectedNumbers, unitPrice]);

    const currentBalance = paymentCurrency === 'diamond' ? diamondBalance : pplusBalance;
    const isInsufficientFunds = currentBalance < totalPrice;

    const numbers = useMemo(() => Array.from({ length: 10 }, (_, i) => i + 1), []);

    const toggleNumber = (num: number) => {
        if (isOutOfStock || isSpinning) return;
        setFinalResult(null);
        setWheelStrip([]);

        if (selectedNumbers.includes(num)) {
            setSelectedNumbers(selectedNumbers.filter(n => n !== num));
        } else {
            setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
        }
    };

    // 快捷選號
    const handleQuickSelect = (type: 'all' | 'odd' | 'even' | 'random' | 'clear') => {
        if (isOutOfStock || isSpinning) return;
        setFinalResult(null);
        setWheelStrip([]);

        if (type === 'all') {
            setSelectedNumbers([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        } else if (type === 'odd') {
            setSelectedNumbers([1, 3, 5, 7, 9]);
        } else if (type === 'even') {
            setSelectedNumbers([2, 4, 6, 8, 10]);
        } else if (type === 'random') {
            const randomNum = Math.floor(Math.random() * 10) + 1;
            setSelectedNumbers([randomNum]);
        } else if (type === 'clear') {
            setSelectedNumbers([]);
        }
    };

    const handleSpin = async () => {
        if (!user || !firestore || !card || selectedNumbers.length === 0 || isSpinning || isOutOfStock) return;

        if (userProfile && card.minLevel) {
            const levelNames = userLevels.map(l => l.level);
            if (levelNames.indexOf(userProfile.userLevel) < levelNames.indexOf(card.minLevel)) {
                toast({ variant: 'destructive', title: '權限不足', description: `本項目僅限「${card.minLevel}」以上等級參與。` });
                return;
            }
        }

        if (isInsufficientFunds) {
            toast({
                variant: 'destructive',
                title: '點數餘額不足',
                description: `需要 ${totalPrice.toLocaleString()} ${paymentCurrency === 'diamond' ? '鑽石' : 'P+ 點'}，目前僅有 ${currentBalance.toLocaleString()}`
            });
            return;
        }

        if (onSpinStart) onSpinStart();
        setIsSpinning(true);
        setSpinActive(false);
        setFinalResult(null);

        try {
            const transactionResult = await runTransaction(firestore, async (transaction) => {
                const cardRef = doc(firestore, 'allCards', card.id);
                const cardSnap = await transaction.get(cardRef);
                const cardData = cardSnap.data();

                if (!cardSnap.exists() || cardData?.isSold) {
                    throw new Error("此卡片已被其他玩家抽出或已下架！");
                }

                if (cardData?.lockedBy && cardData.lockedBy !== user.uid && cardData.lockedAt) {
                    const lockedTime = typeof cardData.lockedAt.toMillis === 'function' ? cardData.lockedAt.toMillis() : 0;
                    if (Date.now() - lockedTime < 25000) {
                        throw new Error("此卡片正在被其他玩家挑戰中，請稍候 30 秒再試。");
                    }
                }

                const userRef = doc(firestore, 'users', user.uid);
                const uSnap = await transaction.get(userRef);
                if (!uSnap.exists()) throw new Error("找不到使用者資料");
                
                const userData = uSnap.data() as UserProfile;
                const walletBalance = paymentCurrency === 'diamond' ? (userData.points || 0) : (userData.bonusPoints || 0);
                if (walletBalance < totalPrice) throw new Error("錢包點數不足，請先儲值或調整下注數。");

                // 隨機開獎 1 ~ 10
                const winningSpot = Math.floor(Math.random() * 10) + 1;
                const didWin = selectedNumbers.includes(winningSpot);

                // 扣款
                const walletField = paymentCurrency === 'diamond' ? 'points' : 'bonusPoints';
                const updateObj: any = { [walletField]: increment(-totalPrice) };
                if (paymentCurrency === 'diamond') {
                    updateObj.totalSpent = increment(totalPrice);
                    updateObj.userLevel = calculateLevel((userData.totalSpent || 0) + totalPrice);
                }
                transaction.update(userRef, updateObj);

                // 寫入交易紀錄
                const winText = didWin ? '中獎' : '未中獎';
                const detailString = `【拼卡】${card.name} (${paymentCurrency === 'diamond' ? '鑽石' : 'P+'}) 下注:[${selectedNumbers.join(',')}] 開出:[${winningSpot}] 結果:${winText}`;

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

                const cardUpdates: any = {
                    lockedBy: null,
                    lockedAt: null
                };

                if (didWin) {
                    // 發放卡片到收藏庫
                    transaction.set(doc(collection(firestore, 'users', user.uid, 'userCards')), {
                        userId: user.uid,
                        cardId: card.id,
                        isFoil: true,
                        rarity: card.rarity || 'unknown',
                        category: card.category || 'betting',
                        source: 'betting',
                        acquiredAt: serverTimestamp()
                    });

                    // 標記卡片售出
                    cardUpdates.isSold = true;

                    // 更新主題分類中的 soldCardIds
                    const targetCategory = card.category || decodeURIComponent(categoryName);
                    if (targetCategory && targetCategory !== 'all') {
                        const bettingCatRef = doc(firestore, 'betting-items', targetCategory);
                        transaction.update(bettingCatRef, { soldCardIds: arrayUnion(card.id) });
                    }
                    if (categoryName && decodeURIComponent(categoryName) !== 'all' && decodeURIComponent(categoryName) !== targetCategory) {
                        const extraCatRef = doc(firestore, 'betting-items', decodeURIComponent(categoryName));
                        transaction.update(extraCatRef, { soldCardIds: arrayUnion(card.id) });
                    }
                }

                transaction.update(cardRef, cardUpdates);

                return { spot: winningSpot, won: didWin };
            });

            // 建立滾輪序列：起始號碼 -> 轉動數圈 -> 目標號碼
            const startNum = finalResult ? finalResult.spot : (selectedNumbers[0] || 1);
            const strip: number[] = [startNum];
            let cur = startNum;

            // 轉 28 次產生隨機滾動感
            for (let i = 0; i < 28; i++) {
                cur = (cur % 10) + 1;
                strip.push(cur);
            }
            // 轉到最終中獎號碼
            while (cur !== transactionResult.spot) {
                cur = (cur % 10) + 1;
                strip.push(cur);
            }

            setWheelStrip(strip);
            
            // 計算滾動距離：最終停在最後一個數字置中
            const targetIndex = strip.length - 1;
            const distance = targetIndex * ITEM_HEIGHT;

            // 短暫等待 DOM 渲染 strip 後啟動 CSS Transition
            requestAnimationFrame(() => {
                setTimeout(() => {
                    setSpinTranslateY(-distance);
                    setSpinActive(true);

                    // 3 秒後結算開獎
                    setTimeout(() => {
                        setIsSpinning(false);
                        setFinalResult(transactionResult);
                        setSpinActive(false);

                        if (transactionResult.won) {
                            toast({
                                title: '🎉 恭喜中獎！',
                                description: `幸運號碼開出【${transactionResult.spot}】，您已成功獲得《${card.name}》！卡片已放入您的數位收藏庫。`,
                                variant: 'default',
                            });
                        } else {
                            toast({
                                title: '😅 差一點點！',
                                description: `開出號碼是【${transactionResult.spot}】，未命中您的投注 [${selectedNumbers.join(', ')}]，再接再厲！`,
                                variant: 'destructive',
                            });
                        }
                    }, 3000);
                }, 50);
            });

        } catch (e: any) {
            console.error('Betting error:', e);
            toast({ title: '拼卡失敗', description: e.message || '系統連線異常，請稍後再試', variant: 'destructive' });
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
            setSpinTranslateY(0);
            if (onClose) onClose();
        }
        setIsOpen(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild disabled={disabled}>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-[96vw] lg:max-w-5xl p-0 overflow-hidden rounded-3xl bg-[#080d1a]/95 backdrop-blur-2xl border border-cyan-500/20 shadow-[0_0_60px_rgba(6,182,212,0.2)] text-slate-100 max-h-[94vh] overflow-y-auto custom-scrollbar [&>button:last-child]:hidden">
                <VisuallyHidden>
                    <DialogTitle>1/10 幸運拼卡競技場 - {card.name}</DialogTitle>
                </VisuallyHidden>

                <div className="relative w-full flex flex-col lg:flex-row">
                    {/* 右上角關閉按鈕 */}
                    <button 
                        onClick={() => handleDialogClose(false)} 
                        className="absolute top-4 right-4 z-40 p-2.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-full transition-colors cursor-pointer border border-slate-700/50 bg-slate-900/60 backdrop-blur-md"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* 左側：商品展示區 */}
                    <div className="w-full lg:w-5/12 p-6 lg:p-8 flex flex-col items-center justify-between relative bg-gradient-to-b from-slate-900/90 via-[#0a0f1d] to-[#060a14] border-b lg:border-b-0 lg:border-r border-slate-800/80">
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-cyan-500/10 blur-[90px] rounded-full pointer-events-none" />

                        {/* 頂部標籤 */}
                        <div className="w-full flex items-center justify-between mb-4 z-10">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/80 border border-cyan-500/30 text-cyan-300 text-xs font-black tracking-widest uppercase">
                                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
                                1/10 命中挑戰
                            </span>
                            {card.minLevel && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300">
                                    {card.minLevel}+
                                </span>
                            )}
                        </div>

                        {/* 卡片主體 */}
                        <div className={cn(
                            "relative w-full max-w-[240px] sm:max-w-[270px] aspect-[2.5/3.6] rounded-2xl transition-all duration-500 p-1 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 border-2 border-cyan-500/40 shadow-[0_0_30px_rgba(6,182,212,0.15)] flex flex-col justify-between overflow-hidden",
                            isOutOfStock && "grayscale-[0.9] opacity-60 border-slate-800"
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
                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm rounded-2xl p-2 pointer-events-none">
                                    <div className="border-2 border-rose-500 bg-rose-950/90 px-4 py-2 rounded-xl transform -rotate-12 shadow-[0_0_20px_rgba(244,63,94,0.5)]">
                                        <span className="text-rose-200 font-black text-xl tracking-widest uppercase">
                                            已被抽出
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 卡片資訊 */}
                        <div className="mt-4 text-center space-y-1.5 z-10 w-full">
                            <h2 className="text-base sm:text-lg font-black tracking-wide text-white line-clamp-1">{card.name}</h2>
                            <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
                                <span>參考原價：</span>
                                <span className="text-cyan-300 font-mono font-black flex items-center gap-1">
                                    <Gem className="w-3.5 h-3.5 text-cyan-400" />
                                    {card.sellPrice ? card.sellPrice.toLocaleString() : '---'} 💎
                                </span>
                            </div>
                        </div>

                        {/* 底部保障標記 */}
                        <div className="mt-4 pt-3 border-t border-slate-800/60 w-full flex items-center justify-center gap-2 text-[11px] text-slate-400">
                            <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            <span>100% 真實機率 · 中獎卡片即刻入庫</span>
                        </div>
                    </div>

                    {/* 右側：操作控制與轉輪區 */}
                    <div className="w-full lg:w-7/12 p-6 lg:p-8 flex flex-col justify-between relative space-y-6">
                        
                        {/* 頂部：錢包餘額資訊列 */}
                        <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
                                <Wallet className="w-4 h-4 text-cyan-400" />
                                <span>我的錢包餘額</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-mono font-black">
                                <div className="flex items-center gap-1.5 text-cyan-300">
                                    <Gem className="w-3.5 h-3.5 text-cyan-400" />
                                    <span>{diamondBalance.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-amber-300">
                                    <PPlusIcon className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{pplusBalance.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* STEP 01: 選擇支付幣別 */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="bg-cyan-500 text-slate-950 font-black px-2.5 py-0.5 text-[11px] rounded-md tracking-wider">
                                        STEP 1
                                    </span>
                                    <span className="text-cyan-300 font-bold text-sm">選擇支付幣別</span>
                                </div>
                                <span className="text-[11px] text-slate-400">1 鑽石 = 10 P+ 點</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    type="button"
                                    onClick={() => !isOutOfStock && !isSpinning && setPaymentCurrency('diamond')}
                                    disabled={isOutOfStock || isSpinning}
                                    className={cn(
                                        "relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer",
                                        paymentCurrency === 'diamond' 
                                            ? 'bg-cyan-950/50 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.25)]' 
                                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200',
                                        (isOutOfStock || isSpinning) && 'opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={cn("p-2 rounded-xl border", paymentCurrency === 'diamond' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400')}>
                                            <Gem className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-black text-sm">鑽石支付</div>
                                            <div className="text-[11px] font-mono text-cyan-400 font-bold">{unitPrice.toLocaleString()} 💎 / 注</div>
                                        </div>
                                    </div>
                                    {paymentCurrency === 'diamond' && <CheckCircle2 className="w-5 h-5 text-cyan-400" />}
                                </button>
                                
                                <button 
                                    type="button"
                                    onClick={() => !isOutOfStock && !isSpinning && setPaymentCurrency('pplus')}
                                    disabled={isOutOfStock || isSpinning}
                                    className={cn(
                                        "relative flex items-center justify-between p-3.5 rounded-2xl border transition-all duration-300 cursor-pointer",
                                        paymentCurrency === 'pplus' 
                                            ? 'bg-amber-950/50 border-amber-400 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.25)]' 
                                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200',
                                        (isOutOfStock || isSpinning) && 'opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={cn("p-2 rounded-xl border", paymentCurrency === 'pplus' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400')}>
                                            <PPlusIcon className="w-5 h-5" />
                                        </div>
                                        <div className="text-left">
                                            <div className="font-black text-sm">P+ 點數</div>
                                            <div className="text-[11px] font-mono text-amber-400 font-bold">{(unitPrice * 10).toLocaleString()} P+ / 注</div>
                                        </div>
                                    </div>
                                    {paymentCurrency === 'pplus' && <CheckCircle2 className="w-5 h-5 text-amber-400" />}
                                </button>
                            </div>
                        </div>

                        {/* STEP 02: 挑選號碼 & 快捷選號 */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="bg-cyan-500 text-slate-950 font-black px-2.5 py-0.5 text-[11px] rounded-md tracking-wider">
                                        STEP 2
                                    </span>
                                    <span className="text-cyan-300 font-bold text-sm">挑選幸運號碼 (1~10)</span>
                                </div>
                                <span className="text-xs font-bold text-slate-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                                    已選 <strong className="text-cyan-400 font-mono text-sm">{selectedNumbers.length}</strong> 注 
                                    <span className="text-slate-500 mx-1">|</span>
                                    勝率 <strong className="text-emerald-400 font-mono text-sm">{selectedNumbers.length * 10}%</strong>
                                </span>
                            </div>

                            {/* 快捷按鈕 */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => handleQuickSelect('all')}
                                    disabled={isOutOfStock || isSpinning}
                                    className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-black transition-colors flex items-center gap-1"
                                >
                                    <Trophy className="w-3 h-3 text-amber-400" />
                                    包牌 100% 得手
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickSelect('odd')}
                                    disabled={isOutOfStock || isSpinning}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-colors"
                                >
                                    單號 (5注)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickSelect('even')}
                                    disabled={isOutOfStock || isSpinning}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-colors"
                                >
                                    雙號 (5注)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickSelect('random')}
                                    disabled={isOutOfStock || isSpinning}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-colors flex items-center gap-1"
                                >
                                    <Dices className="w-3 h-3 text-cyan-400" />
                                    隨機 1 注
                                </button>
                                {selectedNumbers.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handleQuickSelect('clear')}
                                        disabled={isOutOfStock || isSpinning}
                                        className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition-colors ml-auto flex items-center gap-1"
                                    >
                                        <RotateCcw className="w-3 h-3" />
                                        清空
                                    </button>
                                )}
                            </div>
                            
                            {/* 1 ~ 10 號碼按鈕矩陣 */}
                            <div className="grid grid-cols-5 gap-2 sm:gap-2.5">
                                {numbers.map(num => {
                                    const isSelected = selectedNumbers.includes(num);
                                    return (
                                        <button
                                            type="button"
                                            key={num}
                                            onClick={() => toggleNumber(num)}
                                            disabled={isOutOfStock || isSpinning}
                                            className={cn(
                                                "relative aspect-[1.1/1] sm:aspect-square flex flex-col items-center justify-center rounded-2xl text-lg font-black font-mono transition-all duration-300 border cursor-pointer select-none",
                                                isOutOfStock || isSpinning 
                                                    ? 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed' 
                                                    : isSelected 
                                                    ? 'bg-cyan-500 border-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.6)] scale-[1.03] z-10'
                                                    : 'bg-slate-900/80 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700 hover:text-white'
                                            )}
                                        >
                                            <span>{num}</span>
                                            {isSelected && (
                                                <span className="text-[9px] font-sans font-bold -mt-0.5 tracking-tighter">已押注</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* STEP 03: 命運轉輪 & 下注啟動區 */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="bg-amber-500 text-slate-950 font-black px-2.5 py-0.5 text-[11px] rounded-md tracking-wider">
                                        STEP 3
                                    </span>
                                    <span className="text-amber-300 font-bold text-sm">命運老虎機開獎</span>
                                </div>

                                <div className="flex items-center gap-2 text-xs">
                                    <span className="text-slate-400">總計扣除：</span>
                                    <span className={cn(
                                        "font-mono font-black text-base flex items-center gap-1",
                                        isInsufficientFunds ? "text-rose-400" : "text-amber-300"
                                    )}>
                                        {paymentCurrency === 'diamond' ? <Gem className="w-4 h-4 text-cyan-400" /> : <PPlusIcon className="w-4 h-4 text-amber-400" />}
                                        {totalPrice.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* 老虎機視窗 */}
                            <div className="relative w-full h-[120px] bg-slate-950 rounded-2xl border-2 border-slate-800 shadow-[inset_0_5px_20px_rgba(0,0,0,0.8)] overflow-hidden flex items-center justify-center">
                                {/* 頂部反光與陰影 */}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-transparent to-black/70 pointer-events-none z-20" />

                                {/* 兩側金屬裝飾條 */}
                                <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-slate-900 to-transparent border-r border-slate-800/80 z-20 flex items-center justify-center">
                                    <div className="w-1.5 h-12 bg-slate-800 rounded-full" />
                                </div>
                                <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-slate-900 to-transparent border-l border-slate-800/80 z-20 flex items-center justify-center">
                                    <div className="w-1.5 h-12 bg-slate-800 rounded-full" />
                                </div>

                                {/* 中間指針標線 */}
                                <div className="absolute left-6 right-6 top-1/2 -translate-y-1/2 h-[2px] bg-rose-500/80 z-30 shadow-[0_0_12px_rgba(244,63,94,1)]" />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-l-[12px] border-l-rose-500 z-30 drop-shadow-[0_0_8px_rgba(244,63,94,0.9)]" />
                                <div className="absolute right-3 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[8px] border-t-transparent border-b-[8px] border-b-transparent border-r-[12px] border-r-rose-500 z-30 drop-shadow-[0_0_8px_rgba(244,63,94,0.9)]" />

                                {/* 滾輪帶 */}
                                <div className="w-36 h-full bg-slate-900 relative z-10 flex flex-col items-center border-x-2 border-slate-800 overflow-hidden shadow-inner">
                                    <div 
                                        className="flex flex-col w-full text-white font-mono font-black"
                                        style={{
                                            transition: spinActive ? 'transform 3s cubic-bezier(0.12, 0.8, 0.2, 1)' : 'none',
                                            transform: `translateY(${spinTranslateY}px)`
                                        }}
                                    >
                                        {wheelStrip.length > 0 ? (
                                            wheelStrip.map((num, i) => (
                                                <div 
                                                    key={i} 
                                                    style={{ height: `${ITEM_HEIGHT}px` }} 
                                                    className="flex-shrink-0 flex items-center justify-center text-6xl font-black text-cyan-300 drop-shadow-[0_0_15px_rgba(6,182,212,0.8)]"
                                                >
                                                    {num}
                                                </div>
                                            ))
                                        ) : (
                                            <div 
                                                style={{ height: `${ITEM_HEIGHT}px` }} 
                                                className="flex-shrink-0 flex items-center justify-center text-5xl text-slate-500 font-bold"
                                            >
                                                {isOutOfStock ? '-' : (selectedNumbers.length > 0 ? selectedNumbers[0] : '?')}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 開獎結果彈出提示 */}
                            {finalResult && (
                                <div className={cn(
                                    "p-4 rounded-2xl border flex items-center justify-between animate-in fade-in zoom-in-95",
                                    finalResult.won 
                                        ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-200" 
                                        : "bg-rose-950/40 border-rose-500/40 text-rose-200"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2.5 rounded-xl text-xl font-black font-mono", finalResult.won ? "bg-emerald-500/20 text-emerald-300" : "bg-rose-500/20 text-rose-300")}>
                                            {finalResult.spot}
                                        </div>
                                        <div>
                                            <div className="font-black text-sm">
                                                {finalResult.won ? "🎉 恭喜中獎！卡片已存入收藏庫" : "😅 差一點點！號碼未命中"}
                                            </div>
                                            <div className="text-xs opacity-80">
                                                開出號碼為 【{finalResult.spot}】，投注號碼 [{selectedNumbers.join(', ')}]
                                            </div>
                                        </div>
                                    </div>

                                    {finalResult.won ? (
                                        <Button asChild size="sm" className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs">
                                            <Link href="/cabinet">前往收藏庫</Link>
                                        </Button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => { setFinalResult(null); }}
                                            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
                                        >
                                            再拼一次
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* 啟動按鈕 */}
                            {isOutOfStock ? (
                                <button 
                                    type="button" 
                                    disabled 
                                    className="w-full py-4 rounded-2xl font-black tracking-widest flex items-center justify-center gap-2 bg-slate-900 border border-slate-800 text-slate-500 cursor-not-allowed text-sm"
                                >
                                    <AlertCircle className="w-5 h-5" />
                                    此品項已被其他玩家抽出
                                </button>
                            ) : (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <button 
                                            type="button"
                                            disabled={selectedNumbers.length === 0 || isSpinning || isInsufficientFunds}
                                            className={cn(
                                                "w-full py-4 rounded-2xl font-black tracking-widest flex items-center justify-center gap-2 transition-all duration-300 relative overflow-hidden group text-sm cursor-pointer select-none",
                                                isInsufficientFunds 
                                                    ? 'bg-rose-950/60 border border-rose-500/40 text-rose-300 cursor-not-allowed'
                                                    : selectedNumbers.length > 0 && !isSpinning 
                                                    ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 hover:brightness-110 text-slate-950 font-black shadow-[0_0_30px_rgba(6,182,212,0.4)] border border-cyan-300' 
                                                    : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                                            )}
                                        >
                                            {isSpinning ? (
                                                <><Sparkles className="w-5 h-5 animate-spin text-slate-950" /> 命運轉盤旋轉中...</>
                                            ) : isInsufficientFunds ? (
                                                <><AlertCircle className="w-5 h-5 text-rose-400" /> 點數餘額不足 (差 {(totalPrice - currentBalance).toLocaleString()} 點)</>
                                            ) : selectedNumbers.length === 0 ? (
                                                <><Dices className="w-5 h-5" /> 請先在上方挑選至少 1 個幸運號碼</>
                                            ) : (
                                                <><Play className="w-5 h-5 fill-current" /> 確認拼卡 · 啟動命運轉盤 ({selectedNumbers.length} 注 / {totalPrice.toLocaleString()} {paymentCurrency === 'diamond' ? '💎' : 'P+'})</>
                                            )}
                                        </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-3xl bg-slate-950 border-slate-800 border-2 text-slate-100 max-w-md">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="font-headline font-black text-cyan-400 text-lg flex items-center gap-2">
                                                <Sparkles className="w-5 h-5 text-cyan-400" /> 拼卡下注確認
                                            </AlertDialogTitle>
                                        </AlertDialogHeader>
                                        <div className="p-4 rounded-2xl border border-cyan-500/20 bg-cyan-950/20 text-xs text-slate-300 space-y-3">
                                            <div className="flex justify-between border-b border-slate-800/80 pb-2">
                                                <span className="text-slate-400">挑戰卡片：</span>
                                                <span className="font-bold text-white truncate max-w-[200px]">{card.name}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-800/80 pb-2">
                                                <span className="text-slate-400">選擇號碼：</span>
                                                <span className="font-mono font-black text-cyan-300">[{selectedNumbers.join(', ')}] ({selectedNumbers.length} 注)</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-800/80 pb-2">
                                                <span className="text-slate-400">中獎機率：</span>
                                                <span className="font-mono font-black text-emerald-400">{selectedNumbers.length * 10}%</span>
                                            </div>
                                            <div className="flex justify-between border-b border-slate-800/80 pb-2">
                                                <span className="text-slate-400">扣除金額：</span>
                                                <span className="font-mono font-black text-amber-400">
                                                    {totalPrice.toLocaleString()} {paymentCurrency === 'diamond' ? '鑽石 💎' : 'P+ 點數'}
                                                </span>
                                            </div>
                                            <div className="space-y-1 text-[11px] text-slate-400 pt-1">
                                                <p className="font-bold text-cyan-400 flex items-center gap-1">
                                                    <ShieldCheck className="w-3.5 h-3.5" /> 遊戲規則說明：
                                                </p>
                                                <p>1. 本系統隨機開出 1~10 號碼，命中即 100% 獲得該卡片並放入個人收藏庫。</p>
                                                <p>2. 按下確認後將立即扣除錢包點數並執行轉盤開獎。</p>
                                            </div>
                                        </div>
                                        <AlertDialogFooter className="gap-2">
                                            <AlertDialogCancel className="h-11 rounded-xl font-bold bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800">
                                                再想想
                                            </AlertDialogCancel>
                                            <AlertDialogAction 
                                                onClick={handleSpin} 
                                                className="h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black border-none"
                                            >
                                                確認下注並開獎
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
