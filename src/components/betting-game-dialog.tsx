'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, increment, runTransaction, arrayUnion } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { 
    AlertCircle, Sparkles, X, Play, CheckCircle2, 
    RotateCcw, Dices, Trophy, Wallet, ShieldCheck, 
    Award, Percent
} from 'lucide-react';
import { PPlusIcon, DiamondIcon } from '@/components/icons';
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

const ITEM_HEIGHT = 110; // 老虎機滾輪數字項目高度 (px)

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

    // 單注價格：卡片原價的 10%
    const diamondUnitPrice = useMemo(() => {
        if (!card?.sellPrice) return 10;
        return Math.max(1, Math.round(card.sellPrice * 0.1));
    }, [card?.sellPrice]);

    const unitPrice = useMemo(() => {
        return paymentCurrency === 'diamond' ? diamondUnitPrice : diamondUnitPrice * 10;
    }, [diamondUnitPrice, paymentCurrency]);

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
                toast({ variant: 'destructive', title: '等級權限不足', description: `本項目僅限「${card.minLevel}」以上會員挑戰。` });
                return;
            }
        }

        if (isInsufficientFunds) {
            toast({
                variant: 'destructive',
                title: '點數餘額不足',
                description: `需要 ${totalPrice.toLocaleString()} ${paymentCurrency === 'diamond' ? '鑽石 💎' : 'P+ 點'}，目前僅有 ${currentBalance.toLocaleString()}`
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
                if (walletBalance < totalPrice) throw new Error("錢包餘額不足，請先儲值或調整注數。");

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
                }

                transaction.update(cardRef, cardUpdates);

                return {
                    won: didWin,
                    spot: winningSpot
                };
            });

            // 構建老虎機滾輪帶動畫
            const totalRounds = 4;
            const strip: number[] = [];
            for (let r = 0; r < totalRounds; r++) {
                for (let n = 1; n <= 10; n++) {
                    strip.push(n);
                }
            }
            strip.push(transactionResult.spot);

            setWheelStrip(strip);
            const targetIndex = strip.length - 1;
            const targetOffset = -(targetIndex * ITEM_HEIGHT);

            requestAnimationFrame(() => {
                setSpinTranslateY(0);
                setTimeout(() => {
                    setSpinActive(true);
                    setSpinTranslateY(targetOffset);

                    setTimeout(() => {
                        setIsSpinning(false);
                        setSpinActive(false);
                        setFinalResult(transactionResult);

                        if (transactionResult.won) {
                            toast({
                                title: '🎉 恭喜中獎！',
                                description: `幸運號碼開出【${transactionResult.spot}】，您已成功奪得《${card.name}》！卡片已放入個人數位收藏庫。`,
                                variant: 'default',
                            });
                        } else {
                            toast({
                                title: '😅 差一點點！',
                                description: `開出幸運號碼【${transactionResult.spot}】，未命中您的投注 [${selectedNumbers.join(', ')}]，再接再厲！`,
                                variant: 'destructive',
                            });
                        }
                    }, 3200);
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

    const winProbability = selectedNumbers.length * 10;

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild disabled={disabled}>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-[96vw] lg:max-w-5xl p-0 overflow-hidden rounded-3xl bg-[#070b16]/98 backdrop-blur-2xl border border-cyan-500/30 shadow-[0_0_80px_rgba(6,182,212,0.25)] text-slate-100 max-h-[94vh] overflow-y-auto custom-scrollbar [&>button:last-child]:hidden">
                <VisuallyHidden>
                    <DialogTitle>1/10 命運拼卡競技場 - {card.name}</DialogTitle>
                </VisuallyHidden>

                <div className="relative w-full flex flex-col lg:flex-row">
                    {/* 右上角關閉按鈕 */}
                    <button 
                        onClick={() => handleDialogClose(false)} 
                        className="absolute top-4 right-4 z-40 p-2.5 text-slate-400 hover:text-white hover:bg-slate-800/80 rounded-full transition-all cursor-pointer border border-slate-700/50 bg-slate-900/80 backdrop-blur-md shadow-lg"
                        aria-label="關閉對話框"
                    >
                        <X className="w-5 h-5" />
                    </button>

                    {/* 左側：商品展示與獎勵卡牌 */}
                    <div className="w-full lg:w-5/12 p-6 lg:p-8 flex flex-col items-center justify-between relative bg-gradient-to-b from-slate-900/90 via-[#0a0f1e] to-[#050811] border-b lg:border-b-0 lg:border-r border-cyan-500/20">
                        {/* 氛圍背景光暈 */}
                        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-56 h-56 bg-cyan-500/15 blur-[100px] rounded-full pointer-events-none" />
                        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 w-48 h-48 bg-amber-500/10 blur-[80px] rounded-full pointer-events-none" />

                        {/* 頂部徽章 */}
                        <div className="w-full flex items-center justify-between mb-4 z-10">
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/90 border border-cyan-500/40 text-cyan-300 text-xs font-black tracking-widest uppercase shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-spin-slow" />
                                1/10 機率挑戰
                            </div>
                            {card.minLevel && (
                                <div className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 flex items-center gap-1">
                                    <Award className="w-3 h-3 text-amber-400" />
                                    {card.minLevel}+
                                </div>
                            )}
                        </div>

                        {/* 卡片主體展示 */}
                        <div className={cn(
                            "relative w-full max-w-[240px] sm:max-w-[265px] aspect-[2.5/3.6] rounded-2xl transition-all duration-500 p-1 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-950 border-2 border-cyan-500/50 shadow-[0_0_35px_rgba(6,182,212,0.25)] flex flex-col justify-between overflow-hidden group",
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
                                <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm rounded-2xl p-2 pointer-events-none">
                                    <div className="border-2 border-rose-500 bg-rose-950/90 px-5 py-2.5 rounded-xl transform -rotate-12 shadow-[0_0_25px_rgba(244,63,94,0.6)]">
                                        <span className="text-rose-200 font-black text-lg tracking-widest uppercase">
                                            已被玩家抽出
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* 卡片資訊與價格對比 */}
                        <div className="mt-5 text-center space-y-2 z-10 w-full">
                            <h2 className="text-base sm:text-lg font-black tracking-wide text-white line-clamp-1">{card.name}</h2>
                            <div className="flex items-center justify-center gap-3 text-xs bg-slate-900/80 border border-slate-800/90 rounded-xl py-2 px-3">
                                <div className="text-slate-400 flex items-center gap-1">
                                    卡片原值: <span className="text-slate-200 font-mono font-bold">{card.sellPrice ? card.sellPrice.toLocaleString() : '---'}</span>
                                    <DiamondIcon className="w-3.5 h-3.5" />
                                </div>
                                <div className="h-3 w-px bg-slate-700" />
                                <div className="text-cyan-300 font-bold flex items-center gap-1">
                                    單注僅: <span className="font-mono font-black text-cyan-400">{diamondUnitPrice.toLocaleString()}</span>
                                    <DiamondIcon className="w-3.5 h-3.5" />
                                </div>
                            </div>
                        </div>

                        {/* 底部保障標記 */}
                        <div className="mt-4 pt-3 border-t border-slate-800/80 w-full flex items-center justify-center gap-2 text-[11px] text-slate-400">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>100% 真實隨機驗證 · 中獎直接入庫可轉移</span>
                        </div>
                    </div>

                    {/* 右側：操作面板與老虎機轉盤區 */}
                    <div className="w-full lg:w-7/12 p-6 lg:p-8 flex flex-col justify-between relative space-y-5 bg-[#080d1a]">
                        
                        {/* 頂部：錢包餘額資訊列 */}
                        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-950/90 to-slate-900/90 border border-slate-800/90 flex items-center justify-between shadow-inner">
                            <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
                                <Wallet className="w-4 h-4 text-cyan-400" />
                                <span>我的錢包餘額</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs font-mono font-black">
                                <div className="flex items-center gap-1.5 text-cyan-300 bg-cyan-950/50 px-2.5 py-1 rounded-lg border border-cyan-500/20">
                                    <DiamondIcon className="w-3.5 h-3.5" />
                                    <span>{diamondBalance.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-amber-300 bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-500/20">
                                    <PPlusIcon className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{pplusBalance.toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        {/* STEP 01: 選擇支付幣別 */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="bg-cyan-500 text-slate-950 font-black px-2.5 py-0.5 text-[10px] rounded-md tracking-wider">
                                        STEP 1
                                    </span>
                                    <span className="text-cyan-300 font-bold text-sm">選擇支付幣別</span>
                                </div>
                                <span className="text-[11px] text-slate-400 flex items-center gap-1">1 <DiamondIcon className="w-3 h-3" /> = 10 P+ 點</span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-3">
                                <button 
                                    type="button"
                                    onClick={() => !isOutOfStock && !isSpinning && setPaymentCurrency('diamond')}
                                    disabled={isOutOfStock || isSpinning}
                                    className={cn(
                                        "relative flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 cursor-pointer text-left",
                                        paymentCurrency === 'diamond' 
                                            ? 'bg-cyan-950/60 border-cyan-400 text-cyan-100 shadow-[0_0_25px_rgba(6,182,212,0.25)] ring-1 ring-cyan-400/40' 
                                             : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200',
                                        (isOutOfStock || isSpinning) && 'opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={cn("p-2 rounded-xl border", paymentCurrency === 'diamond' ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-slate-800 border-slate-700 text-slate-400')}>
                                            <DiamondIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-black text-sm text-slate-100">鑽石支付</div>
                                            <div className="text-xs font-mono text-cyan-400 font-bold flex items-center gap-1">
                                                {diamondUnitPrice.toLocaleString()} <DiamondIcon className="w-3 h-3" /> / 注
                                            </div>
                                        </div>
                                    </div>
                                    {paymentCurrency === 'diamond' && <CheckCircle2 className="w-5 h-5 text-cyan-400 shrink-0" />}
                                </button>
                                
                                <button 
                                    type="button"
                                    onClick={() => !isOutOfStock && !isSpinning && setPaymentCurrency('pplus')}
                                    disabled={isOutOfStock || isSpinning}
                                    className={cn(
                                        "relative flex items-center justify-between p-3 rounded-2xl border transition-all duration-300 cursor-pointer text-left",
                                        paymentCurrency === 'pplus' 
                                            ? 'bg-amber-950/60 border-amber-400 text-amber-100 shadow-[0_0_25px_rgba(245,158,11,0.25)] ring-1 ring-amber-400/40' 
                                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800/80 hover:text-slate-200',
                                        (isOutOfStock || isSpinning) && 'opacity-50 cursor-not-allowed'
                                    )}
                                >
                                    <div className="flex items-center gap-2.5">
                                        <div className={cn("p-2 rounded-xl border", paymentCurrency === 'pplus' ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-slate-800 border-slate-700 text-slate-400')}>
                                            <PPlusIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <div className="font-black text-sm text-slate-100">P+ 點數</div>
                                            <div className="text-xs font-mono text-amber-400 font-bold">{(diamondUnitPrice * 10).toLocaleString()} P+ / 注</div>
                                        </div>
                                    </div>
                                    {paymentCurrency === 'pplus' && <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0" />}
                                </button>
                            </div>
                        </div>

                        {/* STEP 02: 挑選幸運號碼 & 快捷選號 */}
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                    <span className="bg-cyan-500 text-slate-950 font-black px-2.5 py-0.5 text-[10px] rounded-md tracking-wider">
                                        STEP 2
                                    </span>
                                    <span className="text-cyan-300 font-bold text-sm">挑選幸運號碼 (1~10)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-300 bg-slate-900/90 px-3 py-1 rounded-lg border border-slate-800 flex items-center gap-1.5">
                                        <span>已選 <strong className="text-cyan-400 font-mono text-sm">{selectedNumbers.length}</strong> 注</span>
                                        <span className="text-slate-600">|</span>
                                        <span className="flex items-center gap-1">
                                            <Percent className="w-3 h-3 text-emerald-400" />
                                            勝率 <strong className={cn("font-mono text-sm", winProbability >= 50 ? "text-amber-300" : "text-emerald-400")}>{winProbability}%</strong>
                                        </span>
                                    </span>
                                </div>
                            </div>

                            {/* 勝率進度條 */}
                            <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden border border-slate-800 p-0.5">
                                <div 
                                    className="h-full bg-gradient-to-r from-cyan-500 via-emerald-400 to-amber-400 rounded-full transition-all duration-300 shadow-[0_0_10px_rgba(34,211,238,0.5)]" 
                                    style={{ width: `${winProbability}%` }}
                                />
                            </div>

                            {/* 快捷按鈕 */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    type="button"
                                    onClick={() => handleQuickSelect('all')}
                                    disabled={isOutOfStock || isSpinning}
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg text-xs font-black transition-all flex items-center gap-1 border cursor-pointer",
                                        selectedNumbers.length === 10 
                                            ? "bg-amber-500 border-amber-400 text-slate-950 shadow-[0_0_15px_rgba(245,158,11,0.5)]" 
                                            : "bg-amber-500/15 hover:bg-amber-500/25 border-amber-500/30 text-amber-300"
                                    )}
                                >
                                    <Trophy className="w-3 h-3 text-amber-400" />
                                    100% 包牌必得
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickSelect('odd')}
                                    disabled={isOutOfStock || isSpinning}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                                >
                                    單數 (5注/50%)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickSelect('even')}
                                    disabled={isOutOfStock || isSpinning}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
                                >
                                    雙數 (5注/50%)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleQuickSelect('random')}
                                    disabled={isOutOfStock || isSpinning}
                                    className="px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                    <Dices className="w-3 h-3 text-cyan-400" />
                                    隨機 1 注
                                </button>
                                {selectedNumbers.length > 0 && (
                                    <button
                                        type="button"
                                        onClick={() => handleQuickSelect('clear')}
                                        disabled={isOutOfStock || isSpinning}
                                        className="px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-bold transition-colors ml-auto flex items-center gap-1 cursor-pointer"
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
                                                "relative aspect-[1.15/1] sm:aspect-square flex flex-col items-center justify-center rounded-2xl text-lg font-black font-mono transition-all duration-300 border cursor-pointer select-none",
                                                isOutOfStock || isSpinning 
                                                    ? 'bg-slate-900/40 border-slate-800 text-slate-600 cursor-not-allowed' 
                                                    : isSelected 
                                                    ? 'bg-gradient-to-b from-cyan-400 to-cyan-500 border-cyan-300 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.6)] scale-[1.03] z-10' 
                                                    : 'bg-slate-900/90 border-slate-800/90 text-slate-300 hover:bg-slate-800 hover:border-cyan-500/40 hover:text-white'
                                            )}
                                        >
                                            <span>{num}</span>
                                            {isSelected && (
                                                <span className="text-[9px] font-sans font-black -mt-0.5 tracking-tighter">已押注</span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* STEP 03: 命運轉盤與開獎視窗 */}
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="bg-amber-500 text-slate-950 font-black px-2.5 py-0.5 text-[10px] rounded-md tracking-wider">
                                        STEP 3
                                    </span>
                                    <span className="text-amber-300 font-bold text-sm">命運老虎機開獎</span>
                                </div>

                                <div className="flex items-center gap-1.5 text-xs">
                                    <span className="text-slate-400">總計扣除:</span>
                                    <span className={cn(
                                        "font-mono font-black text-base flex items-center gap-1",
                                        isInsufficientFunds ? "text-rose-400" : "text-amber-300"
                                    )}>
                                        {paymentCurrency === 'diamond' ? <DiamondIcon className="w-4 h-4" /> : <PPlusIcon className="w-4 h-4 text-amber-400" />}
                                        {totalPrice.toLocaleString()}
                                    </span>
                                </div>
                            </div>

                            {/* 老虎機視窗 */}
                            <div className="relative w-full h-[110px] bg-slate-950 rounded-2xl border-2 border-slate-800/90 shadow-[inset_0_5px_25px_rgba(0,0,0,0.9)] overflow-hidden flex items-center justify-center">
                                {/* 頂部反光與陰影 */}
                                <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black/80 pointer-events-none z-20" />

                                {/* 兩側金屬導軌 */}
                                <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-slate-900 via-slate-900/80 to-transparent border-r border-slate-800/80 z-20 flex items-center justify-center">
                                    <div className="w-1.5 h-12 bg-cyan-500/40 rounded-full" />
                                </div>
                                <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-slate-900 via-slate-900/80 to-transparent border-l border-slate-800/80 z-20 flex items-center justify-center">
                                    <div className="w-1.5 h-12 bg-cyan-500/40 rounded-full" />
                                </div>

                                {/* 中間指針雷射標線 */}
                                <div className="absolute left-8 right-8 top-1/2 -translate-y-1/2 h-[2px] bg-cyan-400 z-30 shadow-[0_0_15px_rgba(34,211,238,1)]" />
                                <div className="absolute left-4 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-l-[10px] border-l-cyan-400 z-30 drop-shadow-[0_0_8px_rgba(34,211,238,1)]" />
                                <div className="absolute right-4 top-1/2 -translate-y-1/2 w-0 h-0 border-t-[7px] border-t-transparent border-b-[7px] border-b-transparent border-r-[10px] border-r-cyan-400 z-30 drop-shadow-[0_0_8px_rgba(34,211,238,1)]" />

                                {/* 滾輪帶 */}
                                <div className="w-36 h-full bg-slate-900/90 relative z-10 flex flex-col items-center border-x-2 border-slate-800 overflow-hidden shadow-inner">
                                    <div 
                                        className="flex flex-col w-full text-white font-mono font-black"
                                        style={{
                                            transition: spinActive ? 'transform 3.2s cubic-bezier(0.1, 0.85, 0.25, 1)' : 'none',
                                            transform: `translateY(${spinTranslateY}px)`
                                        }}
                                    >
                                        {wheelStrip.length > 0 ? (
                                            wheelStrip.map((num, i) => (
                                                <div 
                                                    key={i} 
                                                    style={{ height: `${ITEM_HEIGHT}px` }} 
                                                    className="flex-shrink-0 flex items-center justify-center text-5xl font-black text-cyan-300 drop-shadow-[0_0_15px_rgba(6,182,212,0.9)]"
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

                            {/* 開獎結果提示 */}
                            {finalResult && (
                                <div className={cn(
                                    "p-4 rounded-2xl border flex items-center justify-between animate-in fade-in zoom-in-95",
                                    finalResult.won 
                                        ? "bg-emerald-950/60 border-emerald-500/50 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
                                        : "bg-rose-950/60 border-rose-500/50 text-rose-100"
                                )}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn("p-2.5 rounded-xl text-xl font-black font-mono", finalResult.won ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40" : "bg-rose-500/20 text-rose-300 border border-rose-500/40")}>
                                            {finalResult.spot}
                                        </div>
                                        <div>
                                            <div className="font-black text-sm flex items-center gap-1.5">
                                                {finalResult.won ? "🎉 恭喜中獎！卡片已入庫" : "😅 差一點點！號碼未命中"}
                                            </div>
                                            <div className="text-xs opacity-85">
                                                開出號碼 【{finalResult.spot}】，投注號碼 [{selectedNumbers.join(', ')}]
                                            </div>
                                        </div>
                                    </div>

                                    {finalResult.won ? (
                                        <Button asChild size="sm" className="rounded-xl bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs">
                                            <Link href="/collection">前往收藏庫</Link>
                                        </Button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => { setFinalResult(null); }}
                                            className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors cursor-pointer"
                                        >
                                            再拼一次
                                        </button>
                                    )}
                                </div>
                            )}

                            {/* 啟動下注按鈕 */}
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
                                                    ? 'bg-gradient-to-r from-cyan-500 via-blue-600 to-cyan-500 hover:brightness-110 text-slate-950 font-black shadow-[0_0_35px_rgba(6,182,212,0.4)] border border-cyan-300' 
                                                    : 'bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed'
                                            )}
                                        >
                                            {isSpinning ? (
                                                <><Sparkles className="w-5 h-5 animate-spin text-slate-950" /> 命運轉盤旋轉中...</>
                                            ) : isInsufficientFunds ? (
                                                <><AlertCircle className="w-5 h-5 text-rose-400" /> 點數餘額不足 (尚差 {(totalPrice - currentBalance).toLocaleString()} 點)</>
                                            ) : selectedNumbers.length === 0 ? (
                                                <><Dices className="w-5 h-5" /> 請先在上方挑選至少 1 個幸運號碼</>
                                            ) : (
                                                <><Play className="w-5 h-5 fill-current" /> 確認拼卡 · 啟動命運轉盤 ({selectedNumbers.length} 注 / {totalPrice.toLocaleString()} {paymentCurrency === 'diamond' ? '💎' : 'P+'})</>
                                            )}
                                        </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-3xl bg-slate-950 border-cyan-500/30 border-2 text-slate-100 max-w-md shadow-2xl">
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
                                                <span className="text-slate-400">中獎勝率：</span>
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
                                                    <ShieldCheck className="w-3.5 h-3.5" /> 遊戲規則提示：
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
                                                className="h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black border-none shadow-[0_0_20px_rgba(6,182,212,0.4)]"
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
