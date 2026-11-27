'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, increment, runTransaction, arrayUnion } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
    AlertCircle, Sparkles, X, Play,
    RotateCcw, Dices, ShieldCheck, Library
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
import { FortuneWheel } from '@/components/fortune-wheel';
import { useToast } from '@/hooks/use-toast';
import { userLevels } from '@/components/member-level-crown';
import type { UserProfile } from '@/types/user-profile';
import type { LevelBenefit } from '@/types/system';
import Link from 'next/link';
import { createProvablyFairRound, sanitizeFirestorePayload, type ProvablyFairData } from '@/lib/provably-fair';

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
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([1]);
    const [paymentCurrency, setPaymentCurrency] = useState<'diamond' | 'pplus'>('diamond');
    const [isSpinning, setIsSpinning] = useState(false);
    const [spinTransition, setSpinTransition] = useState(false);
    const [wheelRotation, setWheelRotation] = useState(0);
    const [finalResult, setFinalResult] = useState<{ spot: number; won: boolean } | null>(null);
    const [currentRoundFairness, setCurrentRoundFairness] = useState<ProvablyFairData | null>(null);

    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const userProfileRef = useMemoFirebase(
        () => (firestore && user && isOpen) ? doc(firestore, 'users', user.uid) : null,
        [firestore, user, isOpen]
    );
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const isOutOfStock = Boolean(card?.isSold);

    const diamondBalance = userProfile?.points ?? 0;
    const pplusBalance = userProfile?.bonusPoints ?? 0;

    // 單格價格：卡片原價的 10%
    const diamondUnitPrice = useMemo(() => {
        if (!card?.sellPrice) return 10;
        return Math.max(1, Math.round(card.sellPrice * 0.1));
    }, [card?.sellPrice]);

    const pplusUnitPrice = useMemo(() => diamondUnitPrice * 10, [diamondUnitPrice]);

    const unitPrice = paymentCurrency === 'diamond' ? diamondUnitPrice : pplusUnitPrice;
    const totalPrice = selectedNumbers.length * unitPrice;
    const currentBalance = paymentCurrency === 'diamond' ? diamondBalance : pplusBalance;
    const isInsufficientFunds = currentBalance < totalPrice;
    const winProbability = selectedNumbers.length * 10;

    const numbers = useMemo(() => Array.from({ length: 10 }, (_, i) => i + 1), []);

    const toggleNumber = (num: number) => {
        if (isOutOfStock || isSpinning) return;
        setFinalResult(null);

        if (selectedNumbers.includes(num)) {
            setSelectedNumbers(selectedNumbers.filter(n => n !== num));
        } else {
            if (selectedNumbers.length >= 9) {
                toast({
                    title: '提示：最多可選 9 格 (90% 勝率)',
                    description: '為維持公平競技機制，單次轉盤最多選擇 9 個號碼。',
                });
                return;
            }
            setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
        }
    };

    const handleQuickSelect = (type: 'random' | 'odd' | 'even' | 'high8' | 'clear') => {
        if (isOutOfStock || isSpinning) return;
        setFinalResult(null);

        if (type === 'odd') {
            setSelectedNumbers([1, 3, 5, 7, 9]);
        } else if (type === 'even') {
            setSelectedNumbers([2, 4, 6, 8, 10]);
        } else if (type === 'high8') {
            const shuffled = [...numbers].sort(() => Math.random() - 0.5).slice(0, 8).sort((a, b) => a - b);
            setSelectedNumbers(shuffled);
        } else if (type === 'random') {
            const randomNum = Math.floor(Math.random() * 10) + 1;
            setSelectedNumbers([randomNum]);
        } else if (type === 'clear') {
            setSelectedNumbers([]);
        }
    };

    const handleSpinWheel = async () => {
        if (!user || !firestore || !card || selectedNumbers.length === 0 || isSpinning || isOutOfStock) return;

        if (userProfile && card.minLevel && card.minLevel !== '不限' && card.minLevel !== '新手收藏家') {
            const levelNames = userLevels.map(l => l.level);
            const userLvl = userProfile.userLevel || '新手收藏家';
            const userLvlIndex = levelNames.indexOf(userLvl);
            const reqLvlIndex = levelNames.indexOf(card.minLevel);
            if (userLvlIndex < reqLvlIndex) {
                toast({
                    variant: 'destructive',
                    title: '等級權限不足',
                    description: `本項目僅限「${card.minLevel}」以上會員挑戰，您目前的階級為「${userLvl}」。`,
                });
                return;
            }
        }

        if (isInsufficientFunds) {
            toast({
                variant: 'destructive',
                title: '點數餘額不足',
                description: `需要 ${totalPrice.toLocaleString()} ${paymentCurrency === 'diamond' ? '鑽石' : 'P+ 點'}，目前僅有 ${currentBalance.toLocaleString()}`,
            });
            return;
        }

        if (onSpinStart) onSpinStart();
        setIsSpinning(true);
        setSpinTransition(false);
        setFinalResult(null);

        try {
            const idToken = await user.getIdToken();
            const res = await fetch('/api/bet/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`,
                },
                body: JSON.stringify({
                    mode: 'spin',
                    cardId: card.id,
                    categoryName,
                    paymentCurrency,
                    selectedNumbers,
                }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok || !data.success) {
                throw new Error(data.error || '拼卡挑戰失敗，請稍後再試。');
            }
            const transactionResult = {
                won: Boolean(data.won),
                spot: Number(data.spot),
                fairness: data.fairness as ProvablyFairData,
            };

            const sliceCenterDeg = (transactionResult.spot - 1) * 36;
            const targetMod = (360 - sliceCenterDeg) % 360;
            const currentMod = ((wheelRotation % 360) + 360) % 360;
            const delta = (targetMod - currentMod + 360) % 360;
            const nextRotation = wheelRotation + 360 * 5 + delta;

            setSpinTransition(true);
            setWheelRotation(nextRotation);

            setTimeout(() => {
                setIsSpinning(false);
                setSpinTransition(false);
                setFinalResult({
                    spot: transactionResult.spot,
                    won: transactionResult.won,
                });
                setCurrentRoundFairness(transactionResult.fairness);

                if (transactionResult.won) {
                    toast({
                        title: '恭喜中獎！',
                        description: `命中 #${transactionResult.spot}，成功贏得「${card.name}」，已存入您的收藏庫。`,
                    });
                } else {
                    toast({
                        title: '未命中幸運格',
                        description: `指針停在 #${transactionResult.spot}，未命中 [${selectedNumbers.join(', ')}]。`,
                        variant: 'destructive',
                    });
                }
            }, 5700);
        } catch (e: any) {
            console.error('Betting error:', e);
            toast({
                title: '拼卡失敗',
                description: e.message || '系統連線異常，請稍後再試',
                variant: 'destructive',
            });
            setIsSpinning(false);
            setSpinTransition(false);
        }
    };

    const handleDialogClose = (open: boolean) => {
        if (isSpinning) return;
        if (!open) {
            setFinalResult(null);
            setCurrentRoundFairness(null);
            setSelectedNumbers([1]);
            setSpinTransition(false);
            if (onClose) onClose();
        }
        setIsOpen(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleDialogClose}>
            <DialogTrigger asChild disabled={disabled}>
                {children}
            </DialogTrigger>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto p-0 bg-[#0a0f1c] border border-white/[0.1] text-slate-100 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.85)] [&>button]:hidden">
                <VisuallyHidden>
                    <DialogTitle>球員卡命運轉盤拼卡 - {card.name}</DialogTitle>
                </VisuallyHidden>

                {/* 精簡頂部列：標題 + 餘額 + 關閉 */}
                <div className="sticky top-0 z-40 flex items-center justify-between gap-3 px-5 py-3.5 bg-[#0a0f1c]/95 backdrop-blur-xl border-b border-white/[0.08]">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="w-[3px] h-7 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 shrink-0" aria-hidden="true" />
                        <div className="min-w-0">
                            <h3 className="text-base sm:text-lg font-bold tracking-wide truncate flex items-center gap-1.5">
                                <span className="text-white">球員卡</span>
                                <span className="text-amber-400/70 font-normal">·</span>
                                <span className="text-[#FDE68A]">命運轉盤拼卡</span>
                            </h3>
                            <p className="text-[11px] text-slate-400 tracking-wide hidden sm:block">
                                每格 10% 中獎機率 · 抽中立即存入個人收藏庫
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                        <div className="hidden sm:flex items-center gap-2.5 text-xs font-mono font-semibold tabular-nums bg-black/35 border border-white/[0.08] rounded-lg px-3 py-1.5">
                            <span className="flex items-center gap-1 text-cyan-300">
                                <DiamondIcon className="w-3.5 h-3.5" />
                                {diamondBalance.toLocaleString()}
                            </span>
                            <span className="h-3 w-px bg-white/[0.12]" />
                            <span className="flex items-center gap-1 text-amber-300">
                                <PPlusIcon className="w-3.5 h-3.5 text-amber-400" />
                                {pplusBalance.toLocaleString()}
                            </span>
                        </div>

                        <button
                            type="button"
                            onClick={() => handleDialogClose(false)}
                            disabled={isSpinning}
                            className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                            aria-label="關閉對話框"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="flex flex-col lg:flex-row">
                    {/* 左欄：卡片展示與價格摘要 */}
                    <div className="w-full lg:w-[38%] p-5 sm:p-6 flex flex-col items-center justify-between bg-[#070b14] border-b lg:border-b-0 lg:border-r border-white/[0.08] gap-5">
                        <div className="w-full flex flex-col items-center space-y-4">
                            <div className={cn(
                                "relative w-full max-w-[200px] sm:max-w-[230px] aspect-[2.5/3.6] rounded-xl overflow-hidden border border-white/[0.12] bg-black/50 p-1",
                                isOutOfStock && "grayscale-[0.9] opacity-60"
                            )}>
                                <CardItem
                                    name={card.name}
                                    imageUrl={card.imageUrl}
                                    backImageUrl={card.backImageUrl}
                                    imageHint={card.imageHint || card.name}
                                    isFlippable={!isOutOfStock}
                                    rarity={(card.rarity as any) || 'legendary'}
                                />

                                {isOutOfStock && (
                                    <div className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/85 backdrop-blur-sm rounded-xl p-2 pointer-events-none">
                                        <span className="border border-rose-400/70 bg-rose-950/90 px-4 py-1.5 rounded-lg text-rose-200 font-bold text-sm tracking-widest">
                                            已被玩家抽出
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="text-center space-y-3 w-full">
                                <h2 className="text-base sm:text-lg font-bold text-white leading-snug line-clamp-2">
                                    {card.name}
                                </h2>

                                <div className="grid grid-cols-2 divide-x divide-white/[0.08] py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                                    <div className="px-2 text-center">
                                        <span className="text-[11px] text-slate-400 block">卡片原值</span>
                                        <span className="text-sm font-mono font-semibold text-slate-200 inline-flex items-center gap-1 mt-0.5 tabular-nums">
                                            <DiamondIcon className="w-3.5 h-3.5" />
                                            {card.sellPrice ? card.sellPrice.toLocaleString() : '---'}
                                        </span>
                                    </div>
                                    <div className="px-2 text-center">
                                        <span className="text-[11px] text-slate-400 block">單格挑戰</span>
                                        <span className="text-sm font-mono font-semibold text-amber-300 inline-flex items-center gap-1 mt-0.5 tabular-nums">
                                            <DiamondIcon className="w-3.5 h-3.5" />
                                            {diamondUnitPrice.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="pt-3 border-t border-white/[0.06] w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-500">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400/80 shrink-0" />
                            <span>Provably Fair 公平驗證 · 中獎直入收藏庫</span>
                        </div>
                    </div>

                    {/* 右欄：轉盤與簡潔操作區 */}
                    <div className="w-full lg:w-[62%] p-5 sm:p-6 space-y-4">
                        {/* 手機版餘額列 */}
                        <div className="flex sm:hidden items-center justify-between px-3 py-2 rounded-xl bg-white/[0.03] border border-white/[0.08] text-xs font-mono tabular-nums">
                            <span className="text-slate-400 font-sans">我的餘額</span>
                            <div className="flex items-center gap-3">
                                <span className="flex items-center gap-1 text-cyan-300 font-semibold">
                                    <DiamondIcon className="w-3.5 h-3.5" />
                                    {diamondBalance.toLocaleString()}
                                </span>
                                <span className="flex items-center gap-1 text-amber-300 font-semibold">
                                    <PPlusIcon className="w-3.5 h-3.5 text-amber-400" />
                                    {pplusBalance.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        {/* 圓形 10 等分命運轉盤 */}
                        <FortuneWheel
                            idPrefix="bet-wheel"
                            selectedNumbers={selectedNumbers}
                            wheelRotation={wheelRotation}
                            spinTransition={spinTransition}
                            disabled={isSpinning || isOutOfStock}
                            onToggleNumber={toggleNumber}
                        />

                        {/* 支付幣別 + 快捷選號 */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
                            {/* 幣別切換 */}
                            <div className="grid grid-cols-2 bg-black/40 p-1 rounded-lg border border-white/[0.08] shrink-0">
                                <button
                                    type="button"
                                    disabled={isSpinning || isOutOfStock}
                                    onClick={() => setPaymentCurrency('diamond')}
                                    className={cn(
                                        'px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap',
                                        paymentCurrency === 'diamond'
                                            ? 'bg-white/[0.12] text-cyan-200'
                                            : 'text-slate-400 hover:text-slate-200'
                                    )}
                                >
                                    <DiamondIcon className="w-3.5 h-3.5" />
                                    <span>{diamondUnitPrice}/格</span>
                                </button>
                                <button
                                    type="button"
                                    disabled={isSpinning || isOutOfStock}
                                    onClick={() => setPaymentCurrency('pplus')}
                                    className={cn(
                                        'px-2.5 py-1.5 rounded-md text-xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap',
                                        paymentCurrency === 'pplus'
                                            ? 'bg-white/[0.12] text-amber-200'
                                            : 'text-slate-400 hover:text-slate-200'
                                    )}
                                >
                                    <PPlusIcon className="w-3.5 h-3.5 text-amber-400" />
                                    <span>{pplusUnitPrice.toLocaleString()}/格</span>
                                </button>
                            </div>

                            {/* 快捷按鈕 */}
                            <div className="flex items-center gap-1.5 flex-wrap">
                                <button
                                    type="button"
                                    disabled={isSpinning || isOutOfStock}
                                    onClick={() => handleQuickSelect('random')}
                                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-slate-200 text-[11px] font-medium flex items-center gap-1 cursor-pointer"
                                >
                                    <Dices className="w-3 h-3 text-rose-300" /> 隨機
                                </button>
                                <button
                                    type="button"
                                    disabled={isSpinning || isOutOfStock}
                                    onClick={() => handleQuickSelect('odd')}
                                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-slate-300 text-[11px] font-medium cursor-pointer"
                                >
                                    單數
                                </button>
                                <button
                                    type="button"
                                    disabled={isSpinning || isOutOfStock}
                                    onClick={() => handleQuickSelect('even')}
                                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-slate-300 text-[11px] font-medium cursor-pointer"
                                >
                                    雙數
                                </button>
                                <button
                                    type="button"
                                    disabled={isSpinning || isOutOfStock}
                                    onClick={() => handleQuickSelect('high8')}
                                    className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-amber-300 text-[11px] font-medium cursor-pointer"
                                >
                                    8格 (80%)
                                </button>
                                {selectedNumbers.length > 0 && (
                                    <button
                                        type="button"
                                        disabled={isSpinning || isOutOfStock}
                                        onClick={() => handleQuickSelect('clear')}
                                        className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.09] border border-white/[0.08] text-slate-400 hover:text-white cursor-pointer"
                                        title="清空選號"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* 1~10 精簡單列號碼條 */}
                        <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                            {numbers.map(num => {
                                const isSelected = selectedNumbers.includes(num);
                                return (
                                    <button
                                        key={num}
                                        type="button"
                                        disabled={isSpinning || isOutOfStock}
                                        onClick={() => toggleNumber(num)}
                                        className={cn(
                                            'h-8 rounded-lg font-mono text-xs font-semibold border transition-colors cursor-pointer',
                                            isSelected
                                                ? 'bg-rose-500/25 border-amber-300/70 text-white'
                                                : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:border-white/[0.2] hover:text-white'
                                        )}
                                    >
                                        {num}
                                    </button>
                                );
                            })}
                        </div>

                        {/* 開獎結果提示 */}
                        {finalResult && (
                            <div className={cn(
                                'p-3.5 rounded-xl border space-y-2.5 animate-in fade-in zoom-in-95',
                                finalResult.won
                                    ? 'bg-emerald-950/40 border-emerald-400/40 text-emerald-100'
                                    : 'bg-rose-950/35 border-rose-500/30 text-rose-100'
                            )}>
                                <div className="flex items-center justify-between gap-3">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={cn(
                                            'w-10 h-10 rounded-lg flex items-center justify-center font-mono text-base font-bold border shrink-0',
                                            finalResult.won
                                                ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300'
                                                : 'bg-rose-500/20 border-rose-400/40 text-rose-300'
                                        )}>
                                            #{finalResult.spot}
                                        </div>
                                        <div className="min-w-0">
                                            <div className="font-semibold text-sm truncate">
                                                {finalResult.won ? `命中 #${finalResult.spot}，成功獲得卡片` : `指針停在 #${finalResult.spot}，差一點點`}
                                            </div>
                                            <div className="text-xs text-slate-400 font-mono">
                                                已選格數：[{selectedNumbers.join(', ')}]
                                            </div>
                                        </div>
                                    </div>
                                    {finalResult.won ? (
                                        <Button asChild size="sm" className="h-8 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs shrink-0">
                                            <Link href="/collection" className="flex items-center gap-1">
                                                <Library className="w-3.5 h-3.5" />
                                                前往收藏庫
                                            </Link>
                                        </Button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => { setFinalResult(null); setCurrentRoundFairness(null); }}
                                            className="px-3 py-1.5 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] text-xs font-medium text-white shrink-0 cursor-pointer"
                                        >
                                            再轉一次
                                        </button>
                                    )}
                                </div>

                                {currentRoundFairness && (
                                    <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between text-[11px] text-slate-400">
                                        <span className="font-mono truncate max-w-[220px]">Hash: {currentRoundFairness.serverHash.slice(0, 18)}...</span>
                                        <Link
                                            href={`/fairness?serverSeed=${encodeURIComponent(currentRoundFairness.serverSeed)}&serverHash=${encodeURIComponent(currentRoundFairness.serverHash)}&clientSeed=${encodeURIComponent(currentRoundFairness.clientSeed)}&nonce=${currentRoundFairness.nonce}&tab=bet&prob=10`}
                                            target="_blank"
                                            className="text-emerald-400 hover:underline font-medium shrink-0"
                                        >
                                            公平驗證 ↗
                                        </Link>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 啟動轉盤按鈕 */}
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <button
                                    type="button"
                                    disabled={isOutOfStock || selectedNumbers.length === 0 || isSpinning || isInsufficientFunds}
                                    className={cn(
                                        'w-full h-11 rounded-xl font-bold tracking-wide flex items-center justify-center gap-2 transition-all text-sm cursor-pointer select-none',
                                        isOutOfStock || isInsufficientFunds
                                            ? 'bg-rose-950/40 border border-rose-500/30 text-rose-300 cursor-not-allowed'
                                            : selectedNumbers.length > 0 && !isSpinning
                                            ? 'bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 text-white shadow-[0_4px_20px_rgba(244,63,94,0.3)]'
                                            : 'bg-white/[0.04] text-slate-500 border border-white/[0.08] cursor-not-allowed'
                                    )}
                                >
                                    {isOutOfStock ? (
                                        <><AlertCircle className="w-4 h-4" /> 此卡片已被玩家抽出</>
                                    ) : isSpinning ? (
                                        <><Sparkles className="w-4 h-4 animate-spin" /> 轉盤旋轉中...</>
                                    ) : isInsufficientFunds ? (
                                        <><AlertCircle className="w-4 h-4" /> 餘額不足 (需 {totalPrice.toLocaleString()} {paymentCurrency === 'pplus' ? 'P+' : '鑽石'})</>
                                    ) : selectedNumbers.length === 0 ? (
                                        <><Dices className="w-4 h-4" /> 請選擇至少 1 個幸運格</>
                                    ) : (
                                        <><Play className="w-4 h-4 fill-current" /> 啟動轉盤 · {selectedNumbers.length} 格 ({winProbability}%) · {totalPrice.toLocaleString()} {paymentCurrency === 'pplus' ? 'P+' : '鑽石'}</>
                                    )}
                                </button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-2xl bg-[#0a0f1c] border border-white/[0.12] text-slate-100 max-w-md shadow-2xl">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="font-bold text-white text-base">
                                        確認啟動命運轉盤
                                    </AlertDialogTitle>
                                </AlertDialogHeader>
                                <div className="p-4 rounded-xl border border-white/[0.08] bg-black/35 text-xs text-slate-300 space-y-2.5">
                                    <div className="flex justify-between border-b border-white/[0.06] pb-2">
                                        <span className="text-slate-400">目標球員卡</span>
                                        <span className="font-semibold text-white truncate max-w-[200px]">{card.name}</span>
                                    </div>
                                    <div className="flex justify-between border-b border-white/[0.06] pb-2">
                                        <span className="text-slate-400">選取號碼</span>
                                        <span className="font-mono font-semibold text-rose-300">[{selectedNumbers.join(', ')}] ({winProbability}%)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-slate-400">本次消耗</span>
                                        <span className="font-mono font-bold text-amber-300">
                                            {totalPrice.toLocaleString()} {paymentCurrency === 'pplus' ? '紅利 P+ 點' : '鑽石'}
                                        </span>
                                    </div>
                                </div>
                                <AlertDialogFooter className="gap-2">
                                    <AlertDialogCancel className="h-9 rounded-lg font-medium bg-white/[0.05] text-slate-300 border-white/[0.1] hover:bg-white/[0.1]">
                                        取消
                                    </AlertDialogCancel>
                                    <AlertDialogAction
                                        onClick={handleSpinWheel}
                                        className="h-9 rounded-lg bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 text-white font-semibold border-none"
                                    >
                                        確認轉動
                                    </AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
