'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useFirestore, useMemoFirebase, useUser, useDoc } from '@/firebase';
import { collection, doc, serverTimestamp, increment, runTransaction, writeBatch } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import {
    AlertCircle, Sparkles, X, Play, CheckCircle2,
    RotateCcw, Dices, Trophy, Wallet, ShieldCheck,
    Gift, ShoppingBag, Truck, Loader2, Percent, Disc3
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
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { VisuallyHidden } from '@/components/ui/visually-hidden';
import { SafeImage } from '@/components/safe-image';
import { useToast } from '@/hooks/use-toast';
import type { UserProfile } from '@/types/user-profile';
import type { LevelBenefit } from '@/types/system';
import { RefinedPoints } from '@/components/ui/refined-points';
import Link from 'next/link';
import { createProvablyFairRound, type ProvablyFairData } from '@/lib/provably-fair';

export interface RedemptionItem {
    id: string;
    name: string;
    description: string;
    points: number;
    imageUrl: string;
    isActive: boolean;
    order?: number;
}

export interface WonPrizeClaim {
    id: string;
    userId: string;
    itemId: string;
    itemName: string;
    itemImageUrl: string;
    pointsValue: number;
    winningSpot: number;
    selectedNumbers: number[];
    status: 'unclaimed' | 'claimed';
    wonAt?: any;
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

export function PrizeWheelDialog({
    item,
    defaultMode = 'wheel',
    children,
}: {
    item: RedemptionItem;
    defaultMode?: 'wheel' | 'redeem';
    children: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const [mode, setMode] = useState<'wheel' | 'redeem'>(defaultMode);
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([1]);
    const [paymentCurrency, setPaymentCurrency] = useState<'pplus' | 'diamond'>('pplus');
    const [isSpinning, setIsSpinning] = useState(false);
    const [spinTransition, setSpinTransition] = useState(false);
    const [wheelRotation, setWheelRotation] = useState(0);
    const [finalResult, setFinalResult] = useState<{ spot: number; won: boolean; claimId?: string } | null>(null);
    const [currentRoundFairness, setCurrentRoundFairness] = useState<ProvablyFairData | null>(null);

    // 收件資料表單 (用於直接兌換 & 轉盤中獎領取)
    const [realName, setRealName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [isSubmittingClaim, setIsSubmittingClaim] = useState(false);
    const [hasClaimedCurrentWin, setHasClaimedCurrentWin] = useState(false);

    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const userProfileRef = useMemoFirebase(
        () => (firestore && user && isOpen) ? doc(firestore, 'users', user.uid) : null,
        [firestore, user, isOpen]
    );
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    useEffect(() => {
        if (isOpen) {
            setMode(defaultMode);
        }
    }, [isOpen, defaultMode]);

    useEffect(() => {
        if (userProfile) {
            setRealName(prev => prev || userProfile.realName || userProfile.username || '');
            setPhone(prev => prev || userProfile.phone || '');
            setAddress(prev => prev || userProfile.address || '');
        }
    }, [userProfile]);

    const diamondBalance = userProfile?.points ?? 0;
    const pplusBalance = userProfile?.bonusPoints ?? 0;

    // 單格價格：獎品 P+ 原價的 10%；若用鑽石支付則依 1 鑽 = 10 P+ 換算
    const pplusUnitPrice = useMemo(() => {
        if (!item?.points) return 100;
        return Math.max(1, Math.round(item.points * 0.1));
    }, [item?.points]);

    const diamondUnitPrice = useMemo(() => {
        return Math.max(1, Math.ceil(pplusUnitPrice / 10));
    }, [pplusUnitPrice]);

    const unitPrice = paymentCurrency === 'pplus' ? pplusUnitPrice : diamondUnitPrice;
    const totalPrice = selectedNumbers.length * unitPrice;
    const currentBalance = paymentCurrency === 'pplus' ? pplusBalance : diamondBalance;
    const isInsufficientFunds = currentBalance < totalPrice;
    const winProbability = selectedNumbers.length * 10;

    const numbers = useMemo(() => Array.from({ length: 10 }, (_, i) => i + 1), []);

    const toggleNumber = (num: number) => {
        if (isSpinning) return;
        setFinalResult(null);
        setHasClaimedCurrentWin(false);

        if (selectedNumbers.includes(num)) {
            setSelectedNumbers(selectedNumbers.filter(n => n !== num));
        } else {
            if (selectedNumbers.length >= 9) {
                toast({
                    title: '提示：最多可選 9 格 (90% 勝率)',
                    description: '若想 100% 必得獎品，請切換至上方「直接兌換」模式！',
                });
                return;
            }
            setSelectedNumbers([...selectedNumbers, num].sort((a, b) => a - b));
        }
    };

    const handleQuickSelect = (type: 'random' | 'odd' | 'even' | 'high8' | 'clear') => {
        if (isSpinning) return;
        setFinalResult(null);
        setHasClaimedCurrentWin(false);

        if (type === 'random') {
            const r = Math.floor(Math.random() * 10) + 1;
            setSelectedNumbers([r]);
        } else if (type === 'odd') {
            setSelectedNumbers([1, 3, 5, 7, 9]);
        } else if (type === 'even') {
            setSelectedNumbers([2, 4, 6, 8, 10]);
        } else if (type === 'high8') {
            setSelectedNumbers([1, 2, 3, 4, 5, 6, 7, 8]);
        } else if (type === 'clear') {
            setSelectedNumbers([]);
        }
    };

    // 啟動命運轉盤抽獎
    const handleSpinWheel = async () => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: '請先登入', description: '登入會員後即可參與命運轉盤與兌換獎品！' });
            return;
        }
        if (selectedNumbers.length === 0 || isSpinning) return;

        if (isInsufficientFunds) {
            toast({
                variant: 'destructive',
                title: '餘額不足',
                description: `需要 ${totalPrice.toLocaleString()} ${paymentCurrency === 'pplus' ? 'P+ 點' : '鑽石'}，目前餘額不足。`,
            });
            return;
        }

        setIsSpinning(true);
        setFinalResult(null);
        setHasClaimedCurrentWin(false);

        try {
            const txRes = await runTransaction(firestore, async (transaction) => {
                const userRef = doc(firestore, 'users', user.uid);
                const uSnap = await transaction.get(userRef);
                if (!uSnap.exists()) throw new Error('找不到會員資料');

                const userData = uSnap.data() as UserProfile;
                const walletBalance = paymentCurrency === 'pplus' ? (userData.bonusPoints || 0) : (userData.points || 0);
                if (walletBalance < totalPrice) {
                    throw new Error('錢包餘額不足，請調整格數或補充點數。');
                }

                // 隨機開出 1 ~ 10 號扇區
                const winningSpot = Math.floor(Math.random() * 10) + 1;
                const didWin = selectedNumbers.includes(winningSpot);

                // 扣點
                const walletField = paymentCurrency === 'pplus' ? 'bonusPoints' : 'points';
                const updateObj: Record<string, any> = { [walletField]: increment(-totalPrice) };
                if (paymentCurrency === 'diamond') {
                    updateObj.totalSpent = increment(totalPrice);
                    updateObj.userLevel = calculateLevel((userData.totalSpent || 0) + totalPrice);
                }
                transaction.update(userRef, updateObj);

                // 密碼學公平驗證參數
                const pfData = await createProvablyFairRound({
                    clientSeed: `${user.uid.substring(0, 8)}_${Date.now()}`,
                    outcomeType: 'bet',
                });
                const fullFairness: ProvablyFairData = {
                    ...pfData,
                    winningSpot,
                    isWin: didWin,
                    luckyNumber: (winningSpot - 1) * 1000 + 500,
                    luckyPercent: Number((((winningSpot - 1) * 10) + 5).toFixed(2)),
                };

                const winText = didWin ? '中獎' : '未中獎';
                const detailString = `【獎品拼卡】${item.name} (${paymentCurrency === 'pplus' ? 'P+' : '鑽石'}) 下注:[${selectedNumbers.join(',')}] 開出:[${winningSpot}] 結果:${winText}`;

                transaction.set(doc(collection(firestore, 'transactions')), {
                    userId: user.uid,
                    targetId: item.id,
                    transactionType: 'Purchase',
                    section: 'betting',
                    currency: paymentCurrency === 'pplus' ? 'p-point' : 'diamond',
                    amount: -totalPrice,
                    details: detailString,
                    provablyFair: fullFairness,
                    transactionDate: serverTimestamp(),
                });

                let claimId: string | undefined;
                if (didWin) {
                    const claimRef = doc(collection(firestore, 'users', user.uid, 'wonPrizes'));
                    claimId = claimRef.id;
                    transaction.set(claimRef, {
                        userId: user.uid,
                        itemId: item.id,
                        itemName: item.name,
                        itemImageUrl: item.imageUrl || '',
                        pointsValue: item.points,
                        winningSpot,
                        selectedNumbers,
                        status: 'unclaimed',
                        wonAt: serverTimestamp(),
                    });
                }

                return {
                    won: didWin,
                    spot: winningSpot,
                    claimId,
                    fairness: fullFairness,
                };
            });

            // 計算圓盤精準旋轉角度：使 winningSpot 扇區中心對準正上方 12 點鐘指針
            const sliceCenterDeg = (txRes.spot - 1) * 36;
            const targetMod = (360 - sliceCenterDeg) % 360;
            const currentMod = ((wheelRotation % 360) + 360) % 360;
            const delta = (targetMod - currentMod + 360) % 360;
            const nextRotation = wheelRotation + 360 * 6 + delta;

            setSpinTransition(true);
            setWheelRotation(nextRotation);

            setTimeout(() => {
                setIsSpinning(false);
                setSpinTransition(false);
                setFinalResult({
                    spot: txRes.spot,
                    won: txRes.won,
                    claimId: txRes.claimId,
                });
                setCurrentRoundFairness(txRes.fairness);

                if (txRes.won) {
                    toast({
                        title: '🎉 命運轉盤大中獎！',
                        description: `恭喜命中 #${txRes.spot}，成功贏得「${item.name}」！請填寫收件資訊安排寄出。`,
                    });
                }
            }, 3900);
        } catch (err: any) {
            setIsSpinning(false);
            setSpinTransition(false);
            toast({
                variant: 'destructive',
                title: '啟動失敗',
                description: err?.message || '系統忙碌中，請稍後再試。',
            });
        }
    };

    // 轉盤中獎後填寫收件地址領取
    const handleClaimWonPrize = async () => {
        if (!user || !firestore || !finalResult?.claimId) return;
        if (!realName.trim() || !phone.trim() || !address.trim()) {
            toast({ variant: 'destructive', title: '請填寫完整收件資訊', description: '請輸入真實姓名、電話與 7-11 門市或地址。' });
            return;
        }
        setIsSubmittingClaim(true);
        try {
            const batch = writeBatch(firestore);
            const orderRef = doc(collection(firestore, 'shippingOrders'));
            batch.set(orderRef, {
                userId: user.uid,
                name: realName.trim(),
                phone: phone.trim(),
                address: address.trim(),
                cardCount: 1,
                cardIds: [],
                redemptionItem: `${item.name} (命運轉盤中獎)`,
                status: 'pending',
                shippingMethod: '7-11',
                createdAt: serverTimestamp(),
                fee: 0,
            });
            const claimRef = doc(firestore, 'users', user.uid, 'wonPrizes', finalResult.claimId);
            batch.update(claimRef, {
                status: 'claimed',
                shippingOrderId: orderRef.id,
                claimedAt: serverTimestamp(),
            });
            await batch.commit();

            setHasClaimedCurrentWin(true);
            toast({
                title: '📦 出貨申請已送出！',
                description: `「${item.name}」已建立免運出貨單，可至會員中心查詢進度。`,
            });
        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: '提交失敗',
                description: err?.message || '請稍後重試。',
            });
        } finally {
            setIsSubmittingClaim(false);
        }
    };

    // 全額 P+ 點數直接兌換
    const handleDirectRedeem = async () => {
        if (!user || !firestore) {
            toast({ variant: 'destructive', title: '請先登入', description: '請先登入會員後再進行獎品兌換。' });
            return;
        }
        if (!realName.trim() || !phone.trim() || !address.trim()) {
            toast({ variant: 'destructive', title: '資料不完整', description: '請填寫完整收件人姓名、電話與收件門市/地址。' });
            return;
        }
        if (pplusBalance < item.points) {
            toast({ variant: 'destructive', title: '紅利 P+ 不足', description: '您的紅利 P+ 點數餘額不足，也可切換至「命運轉盤」用 1/10 點數試手氣！' });
            return;
        }

        setIsSubmittingClaim(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const uRef = doc(firestore, 'users', user.uid);
                const uSnap = await transaction.get(uRef);
                if (!uSnap.exists()) throw new Error('找不到會員資料');
                const userData = uSnap.data() as UserProfile;
                if ((userData.bonusPoints || 0) < item.points) {
                    throw new Error('紅利 P+ 點數不足');
                }

                transaction.update(uRef, { bonusPoints: increment(-item.points) });
                transaction.set(doc(collection(firestore, 'transactions')), {
                    userId: user.uid,
                    targetId: item.id,
                    transactionType: 'Purchase',
                    section: 'betting',
                    currency: 'p-point',
                    amount: -item.points,
                    details: `紅利兌換: ${item.name}`,
                    transactionDate: serverTimestamp(),
                });
                transaction.set(doc(collection(firestore, 'shippingOrders')), {
                    userId: user.uid,
                    name: realName.trim(),
                    phone: phone.trim(),
                    address: address.trim(),
                    cardCount: 1,
                    cardIds: [],
                    redemptionItem: item.name,
                    status: 'pending',
                    shippingMethod: '7-11',
                    createdAt: serverTimestamp(),
                    fee: 0,
                });
            });

            toast({
                title: '🎁 兌換成功！',
                description: `已成功兌換「${item.name}」，我們將盡快為您安排寄出！`,
            });
            setIsOpen(false);
        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: '兌換失敗',
                description: err?.message || '系統發生錯誤，請稍後再試。',
            });
        } finally {
            setIsSubmittingClaim(false);
        }
    };

    // 預先計算 10 格圓形轉盤 SVG 座標 (半徑 148, 中心 160,160)
    const wheelSlices = useMemo(() => {
        const cx = 160;
        const cy = 160;
        const r = 148;
        const rText = 104;

        return Array.from({ length: 10 }, (_, idx) => {
            const num = idx + 1;
            const centerDeg = idx * 36 - 90;
            const startDeg = centerDeg - 18;
            const endDeg = centerDeg + 18;
            const startRad = (startDeg * Math.PI) / 180;
            const endRad = (endDeg * Math.PI) / 180;
            const centerRad = (centerDeg * Math.PI) / 180;

            const x1 = cx + r * Math.cos(startRad);
            const y1 = cy + r * Math.sin(startRad);
            const x2 = cx + r * Math.cos(endRad);
            const y2 = cy + r * Math.sin(endRad);

            const tx = cx + rText * Math.cos(centerRad);
            const ty = cy + rText * Math.sin(centerRad);

            const path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

            return {
                num,
                idx,
                path,
                tx,
                ty,
                rotateDeg: idx * 36,
            };
        });
    }, []);

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (isSpinning) return;
                setIsOpen(open);
                if (!open) {
                    setFinalResult(null);
                    setCurrentRoundFairness(null);
                    setHasClaimedCurrentWin(false);
                }
            }}
        >
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] overflow-y-auto p-0 bg-[#090612] border border-amber-500/35 text-slate-100 rounded-3xl shadow-[0_0_80px_rgba(245,158,11,0.22)] [&>button]:hidden">
                <VisuallyHidden>
                    <DialogTitle>{item.name} - 獎品命運轉盤與紅利兌換</DialogTitle>
                </VisuallyHidden>

                {/* 頂部狀態列 */}
                <div className="sticky top-0 z-40 flex items-center justify-between px-5 py-3.5 bg-[#090612]/95 backdrop-blur-xl border-b border-amber-500/20">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500/25 to-rose-500/25 border border-amber-400/40 flex items-center justify-center">
                            <Disc3 className="w-4 h-4 text-amber-300 animate-spin" style={{ animationDuration: '8s' }} />
                        </div>
                        <div>
                            <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
                                實體獎品 · 命運轉盤 & 兌換館
                            </h3>
                            <p className="text-[11px] text-slate-400 hidden sm:block">
                                可用 1/10 點數挑戰命運轉盤，或使用 P+ 點數 100% 直接兌換免運寄出
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => !isSpinning && setIsOpen(false)}
                        disabled={isSpinning}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors cursor-pointer disabled:opacity-40"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex flex-col lg:flex-row">
                    {/* 左側：獎品精緻展示卡 */}
                    <div className="w-full lg:w-5/12 p-5 sm:p-7 flex flex-col items-center justify-between bg-gradient-to-b from-[#1a1019]/90 via-[#0e0812] to-[#07050a] border-b lg:border-b-0 lg:border-r border-amber-500/20 relative overflow-hidden">
                        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-56 h-56 bg-amber-500/15 blur-[90px] rounded-full pointer-events-none" />

                        <div className="w-full flex flex-col items-center space-y-4 relative z-10">
                            <div className="relative w-full max-w-[230px] sm:max-w-[260px] aspect-square rounded-2xl overflow-hidden border-2 border-amber-400/40 bg-slate-950/90 shadow-[0_0_35px_rgba(245,158,11,0.2)]">
                                <SafeImage
                                    src={item.imageUrl}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                    sizes="280px"
                                />
                                <div className="absolute top-2.5 left-2.5 px-2.5 py-0.5 rounded-full bg-black/75 backdrop-blur-md border border-amber-400/40 text-[10px] font-black text-amber-300 flex items-center gap-1">
                                    <Gift className="w-3 h-3 text-amber-400" />
                                    實體獎品免運
                                </div>
                            </div>

                            <div className="text-center space-y-2 w-full">
                                <h2 className="text-lg sm:text-xl font-black text-white leading-snug">
                                    {item.name}
                                </h2>
                                {item.description && (
                                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-3 px-2">
                                        {item.description}
                                    </p>
                                )}

                                <div className="grid grid-cols-2 gap-2 pt-2">
                                    <div className="p-2.5 rounded-xl bg-slate-900/90 border border-amber-500/25 text-center">
                                        <span className="text-[10px] text-slate-400 block">直購兌換價</span>
                                        <span className="text-sm font-mono font-black text-amber-300 flex items-center justify-center gap-1 mt-0.5">
                                            <PPlusIcon className="w-3.5 h-3.5 text-amber-400" />
                                            {item.points.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="p-2.5 rounded-xl bg-rose-950/30 border border-rose-500/30 text-center">
                                        <span className="text-[10px] text-rose-300 block">轉盤單格挑戰</span>
                                        <span className="text-sm font-mono font-black text-rose-300 flex items-center justify-center gap-1 mt-0.5">
                                            <PPlusIcon className="w-3.5 h-3.5 text-amber-400" />
                                            {pplusUnitPrice.toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-white/10 w-full flex items-center justify-center gap-2 text-[11px] text-slate-400 relative z-10">
                            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                            <span>Provably Fair 公平驗證 · 實體寄送到府</span>
                        </div>
                    </div>

                    {/* 右側：雙模式互動區 (命運轉盤 / 直接兌換) */}
                    <div className="w-full lg:w-7/12 p-5 sm:p-7 space-y-5 bg-[#0c0814]">
                        {/* 錢包餘額列 */}
                        <div className="p-3 rounded-2xl bg-slate-900/90 border border-white/10 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-slate-300 font-bold">
                                <Wallet className="w-4 h-4 text-amber-400" />
                                <span>我的餘額</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-mono font-black">
                                <div className="flex items-center gap-1.5 text-amber-300 bg-amber-950/50 px-2.5 py-1 rounded-lg border border-amber-500/25">
                                    <PPlusIcon className="w-3.5 h-3.5 shrink-0" />
                                    <RefinedPoints value={pplusBalance} currency="pplus" size="xs" variant="luxury" />
                                </div>
                                <div className="flex items-center gap-1.5 text-cyan-300 bg-cyan-950/50 px-2.5 py-1 rounded-lg border border-cyan-500/25">
                                    <DiamondIcon className="w-3.5 h-3.5 shrink-0" />
                                    <RefinedPoints value={diamondBalance} currency="diamond" size="xs" variant="luxury" />
                                </div>
                            </div>
                        </div>

                        {/* 模式切換器 */}
                        <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-950 border border-white/10">
                            <button
                                type="button"
                                disabled={isSpinning}
                                onClick={() => setMode('wheel')}
                                className={cn(
                                    "py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                                    mode === 'wheel'
                                        ? "bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 text-white shadow-[0_0_20px_rgba(244,63,94,0.35)]"
                                        : "text-slate-400 hover:text-white"
                                )}
                            >
                                <Disc3 className="w-4 h-4" />
                                <span>🎡 命運轉盤拼獎品</span>
                            </button>
                            <button
                                type="button"
                                disabled={isSpinning}
                                onClick={() => setMode('redeem')}
                                className={cn(
                                    "py-2.5 px-3 rounded-xl text-xs sm:text-sm font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                                    mode === 'redeem'
                                        ? "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.35)]"
                                        : "text-slate-400 hover:text-white"
                                )}
                            >
                                <ShoppingBag className="w-4 h-4" />
                                <span>🛍️ P+ 全額直接兌換</span>
                            </button>
                        </div>

                        {mode === 'wheel' ? (
                            <div className="space-y-4">
                                {/* 圓形 10 等分命運轉盤 */}
                                <div className="relative flex flex-col items-center justify-center py-2">
                                    {/* 頂部 12 點鐘黃金指針 */}
                                    <div className="relative z-30 -mb-3 flex flex-col items-center pointer-events-none">
                                        <div className="w-4 h-4 rounded-full bg-amber-300 border-2 border-white shadow-[0_0_12px_#fbbf24]" />
                                        <div className="w-0 h-0 border-l-[11px] border-l-transparent border-r-[11px] border-r-transparent border-t-[20px] border-t-amber-400 -mt-1 drop-shadow-[0_4px_10px_rgba(251,191,36,0.95)]" />
                                    </div>

                                    {/* 轉盤外框光環 */}
                                    <div className="relative w-[260px] h-[260px] sm:w-[296px] sm:h-[296px] rounded-full p-2 bg-gradient-to-b from-amber-400/40 via-rose-500/30 to-slate-900 border-2 border-amber-400/50 shadow-[0_0_45px_rgba(244,63,94,0.25),inset_0_0_25px_rgba(0,0,0,0.9)] flex items-center justify-center">
                                        <svg
                                            viewBox="0 0 320 320"
                                            className="w-full h-full rounded-full overflow-visible select-none"
                                            style={{
                                                transform: `rotate(${wheelRotation}deg)`,
                                                transition: spinTransition ? 'transform 3.8s cubic-bezier(0.12, 0.88, 0.2, 1)' : 'none',
                                            }}
                                        >
                                            <defs>
                                                <linearGradient id="prizeSliceActive" x1="0%" y1="0%" x2="100%" y2="100%">
                                                    <stop offset="0%" stopColor="#f43f5e" />
                                                    <stop offset="55%" stopColor="#ec4899" />
                                                    <stop offset="100%" stopColor="#f59e0b" />
                                                </linearGradient>
                                                <linearGradient id="prizeSliceOdd" x1="0%" y1="0%" x2="100%" y2="100%">
                                                    <stop offset="0%" stopColor="#131b2e" />
                                                    <stop offset="100%" stopColor="#0b101d" />
                                                </linearGradient>
                                                <linearGradient id="prizeSliceEven" x1="0%" y1="0%" x2="100%" y2="100%">
                                                    <stop offset="0%" stopColor="#1b1326" />
                                                    <stop offset="100%" stopColor="#100b18" />
                                                </linearGradient>
                                            </defs>

                                            {wheelSlices.map((slice) => {
                                                const isSelected = selectedNumbers.includes(slice.num);
                                                return (
                                                    <g
                                                        key={slice.num}
                                                        onClick={() => toggleNumber(slice.num)}
                                                        className={cn(!isSpinning && "cursor-pointer hover:brightness-110 transition-all")}
                                                    >
                                                        <path
                                                            d={slice.path}
                                                            fill={
                                                                isSelected
                                                                    ? 'url(#prizeSliceActive)'
                                                                    : slice.idx % 2 === 0
                                                                    ? 'url(#prizeSliceOdd)'
                                                                    : 'url(#prizeSliceEven)'
                                                            }
                                                            stroke={isSelected ? '#fde68a' : 'rgba(255,255,255,0.12)'}
                                                            strokeWidth={isSelected ? 2 : 1}
                                                        />
                                                        <text
                                                            x={slice.tx}
                                                            y={slice.ty}
                                                            textAnchor="middle"
                                                            dominantBaseline="central"
                                                            transform={`rotate(${slice.rotateDeg}, ${slice.tx}, ${slice.ty})`}
                                                            fill={isSelected ? '#ffffff' : '#94a3b8'}
                                                            fontSize={isSelected ? '18' : '15'}
                                                            fontWeight="900"
                                                            fontFamily="monospace"
                                                        >
                                                            {slice.num}
                                                        </text>
                                                    </g>
                                                );
                                            })}

                                            {/* 外圈裝飾珠 */}
                                            {Array.from({ length: 20 }, (_, i) => {
                                                const deg = i * 18;
                                                const rad = (deg * Math.PI) / 180;
                                                const bx = 160 + 153 * Math.cos(rad);
                                                const by = 160 + 153 * Math.sin(rad);
                                                return (
                                                    <circle
                                                        key={i}
                                                        cx={bx}
                                                        cy={by}
                                                        r={i % 2 === 0 ? 2.5 : 1.8}
                                                        fill={i % 2 === 0 ? '#fbbf24' : '#f43f5e'}
                                                    />
                                                );
                                            })}
                                        </svg>

                                        {/* 轉盤正中央勝率核心 */}
                                        <div className="absolute inset-0 m-auto w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-b from-slate-900 via-[#120b1d] to-black border-2 border-amber-400/70 shadow-[0_0_25px_rgba(0,0,0,0.95)] flex flex-col items-center justify-center z-20 pointer-events-none">
                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">中獎勝率</span>
                                            <span className="text-lg sm:text-xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-rose-300 leading-none mt-0.5">
                                                {winProbability}%
                                            </span>
                                            <span className="text-[9px] text-amber-400/90 font-mono mt-0.5">
                                                {selectedNumbers.length}/10 格
                                            </span>
                                        </div>
                                    </div>

                                    <p className="text-[11px] text-slate-400 mt-2">
                                        👆 可直接點擊轉盤扇區或下方號碼選擇幸運格（每格 10% 機率）
                                    </p>
                                </div>

                                {/* 支付幣別切換 */}
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        disabled={isSpinning}
                                        onClick={() => setPaymentCurrency('pplus')}
                                        className={cn(
                                            "p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer",
                                            paymentCurrency === 'pplus'
                                                ? "bg-amber-950/50 border-amber-400 text-amber-100 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                                                : "bg-slate-900/60 border-white/10 text-slate-400 hover:text-white"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <PPlusIcon className="w-4 h-4 text-amber-400 shrink-0" />
                                            <div>
                                                <div className="text-xs font-black">紅利 P+ 支付</div>
                                                <div className="text-[10px] font-mono text-amber-300">{pplusUnitPrice.toLocaleString()} P+ / 格</div>
                                            </div>
                                        </div>
                                        {paymentCurrency === 'pplus' && <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />}
                                    </button>

                                    <button
                                        type="button"
                                        disabled={isSpinning}
                                        onClick={() => setPaymentCurrency('diamond')}
                                        className={cn(
                                            "p-2.5 rounded-xl border text-left flex items-center justify-between transition-all cursor-pointer",
                                            paymentCurrency === 'diamond'
                                                ? "bg-cyan-950/50 border-cyan-400 text-cyan-100 shadow-[0_0_15px_rgba(6,182,212,0.2)]"
                                                : "bg-slate-900/60 border-white/10 text-slate-400 hover:text-white"
                                        )}
                                    >
                                        <div className="flex items-center gap-2">
                                            <DiamondIcon className="w-4 h-4 shrink-0" />
                                            <div>
                                                <div className="text-xs font-black">鑽石支付</div>
                                                <div className="text-[10px] font-mono text-cyan-300">{diamondUnitPrice.toLocaleString()} 💎 / 格</div>
                                            </div>
                                        </div>
                                        {paymentCurrency === 'diamond' && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />}
                                    </button>
                                </div>

                                {/* 快捷選號與 1~10 格按鈕 */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <button
                                            type="button"
                                            disabled={isSpinning}
                                            onClick={() => handleQuickSelect('random')}
                                            className="px-2.5 py-1 rounded-lg bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                        >
                                            <Dices className="w-3 h-3" /> 隨機 1 格 (10%)
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isSpinning}
                                            onClick={() => handleQuickSelect('odd')}
                                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 text-[11px] font-bold cursor-pointer"
                                        >
                                            單數 (50%)
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isSpinning}
                                            onClick={() => handleQuickSelect('even')}
                                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-white/10 text-slate-300 text-[11px] font-bold cursor-pointer"
                                        >
                                            雙數 (50%)
                                        </button>
                                        <button
                                            type="button"
                                            disabled={isSpinning}
                                            onClick={() => handleQuickSelect('high8')}
                                            className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-[11px] font-bold cursor-pointer"
                                        >
                                            8 格高勝率 (80%)
                                        </button>
                                        {selectedNumbers.length > 0 && (
                                            <button
                                                type="button"
                                                disabled={isSpinning}
                                                onClick={() => handleQuickSelect('clear')}
                                                className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 text-[11px] font-bold ml-auto flex items-center gap-1 cursor-pointer"
                                            >
                                                <RotateCcw className="w-3 h-3" /> 清空
                                            </button>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-5 gap-1.5">
                                        {numbers.map(num => {
                                            const isSelected = selectedNumbers.includes(num);
                                            return (
                                                <button
                                                    key={num}
                                                    type="button"
                                                    disabled={isSpinning}
                                                    onClick={() => toggleNumber(num)}
                                                    className={cn(
                                                        "h-9 rounded-xl font-mono text-xs sm:text-sm font-black border transition-all cursor-pointer",
                                                        isSelected
                                                            ? "bg-gradient-to-r from-rose-500 to-amber-500 border-amber-200 text-white shadow-[0_0_12px_rgba(244,63,94,0.5)]"
                                                            : "bg-slate-900/80 border-white/10 text-slate-400 hover:border-rose-400/50 hover:text-white"
                                                    )}
                                                >
                                                    #{num}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                {/* 開獎結果與中獎收件表單 */}
                                {finalResult && (
                                    <div className={cn(
                                        "p-4 rounded-2xl border space-y-3 animate-in fade-in zoom-in-95",
                                        finalResult.won
                                            ? "bg-emerald-950/60 border-emerald-400/50 text-emerald-100 shadow-[0_0_30px_rgba(16,185,129,0.2)]"
                                            : "bg-rose-950/50 border-rose-500/40 text-rose-100"
                                    )}>
                                        <div className="flex items-center justify-between gap-3">
                                            <div className="flex items-center gap-3">
                                                <div className={cn(
                                                    "w-11 h-11 rounded-xl flex items-center justify-center font-mono text-xl font-black border",
                                                    finalResult.won
                                                        ? "bg-emerald-500/25 border-emerald-400 text-emerald-300"
                                                        : "bg-rose-500/20 border-rose-400/50 text-rose-300"
                                                )}>
                                                    #{finalResult.spot}
                                                </div>
                                                <div>
                                                    <div className="font-black text-sm">
                                                        {finalResult.won ? `🎉 恭喜命中 #${finalResult.spot}！成功獲得「${item.name}」` : `😅 指針停在 #${finalResult.spot}，差一點點！`}
                                                    </div>
                                                    <div className="text-xs opacity-80">
                                                        您的幸運號碼：[{selectedNumbers.join(', ')}]
                                                    </div>
                                                </div>
                                            </div>
                                            {!finalResult.won && (
                                                <button
                                                    type="button"
                                                    onClick={() => { setFinalResult(null); setCurrentRoundFairness(null); }}
                                                    className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-bold text-white shrink-0 cursor-pointer"
                                                >
                                                    再轉一次
                                                </button>
                                            )}
                                        </div>

                                        {/* 中獎後立即填寫收件表單 */}
                                        {finalResult.won && (
                                            hasClaimedCurrentWin ? (
                                                <div className="p-3 rounded-xl bg-emerald-900/40 border border-emerald-400/30 flex items-center justify-between">
                                                    <span className="text-xs font-bold text-emerald-200">✅ 已成功建立免運出貨訂單！</span>
                                                    <Button asChild size="sm" className="h-8 rounded-lg bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs">
                                                        <Link href="/profile">查看出貨進度</Link>
                                                    </Button>
                                                </div>
                                            ) : (
                                                <div className="p-3.5 rounded-xl bg-slate-950/85 border border-emerald-400/30 space-y-3">
                                                    <div className="flex items-center gap-1.5 text-xs font-black text-amber-300">
                                                        <Truck className="w-4 h-4 text-amber-400" />
                                                        <span>請填寫收件資訊（免運費寄出，若稍後填寫亦可於專區上方領取）</span>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                                        <Input
                                                            value={realName}
                                                            onChange={e => setRealName(e.target.value)}
                                                            placeholder="收件人真實姓名"
                                                            className="h-9 bg-slate-900 border-white/15 text-xs text-white"
                                                        />
                                                        <Input
                                                            value={phone}
                                                            onChange={e => setPhone(e.target.value)}
                                                            placeholder="聯絡手機 (09xx...)"
                                                            className="h-9 bg-slate-900 border-white/15 text-xs text-white"
                                                        />
                                                    </div>
                                                    <Input
                                                        value={address}
                                                        onChange={e => setAddress(e.target.value)}
                                                        placeholder="請輸入 7-11 店名/店號 或 完整收件地址"
                                                        className="h-9 bg-slate-900 border-white/15 text-xs text-white"
                                                    />
                                                    <Button
                                                        type="button"
                                                        onClick={handleClaimWonPrize}
                                                        disabled={isSubmittingClaim}
                                                        className="w-full h-10 rounded-xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:brightness-110 text-slate-950 font-black text-xs cursor-pointer"
                                                    >
                                                        {isSubmittingClaim ? <Loader2 className="w-4 h-4 animate-spin" /> : '確認收件資訊 · 立即免費寄出獎品'}
                                                    </Button>
                                                </div>
                                            )
                                        )}

                                        {currentRoundFairness && (
                                            <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
                                                <span className="font-mono truncate max-w-[220px]">Hash: {currentRoundFairness.serverHash.slice(0, 18)}...</span>
                                                <Link
                                                    href={`/fairness?serverSeed=${encodeURIComponent(currentRoundFairness.serverSeed)}&serverHash=${encodeURIComponent(currentRoundFairness.serverHash)}&clientSeed=${encodeURIComponent(currentRoundFairness.clientSeed)}&nonce=${currentRoundFairness.nonce}&tab=bet&prob=10`}
                                                    target="_blank"
                                                    className="text-emerald-400 hover:underline font-bold shrink-0"
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
                                            disabled={selectedNumbers.length === 0 || isSpinning || isInsufficientFunds}
                                            className={cn(
                                                "w-full py-3.5 rounded-2xl font-black tracking-wider flex items-center justify-center gap-2 transition-all text-sm cursor-pointer select-none",
                                                isInsufficientFunds
                                                    ? "bg-rose-950/60 border border-rose-500/40 text-rose-300 cursor-not-allowed"
                                                    : selectedNumbers.length > 0 && !isSpinning
                                                    ? "bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:brightness-110 text-white shadow-[0_0_30px_rgba(244,63,94,0.5)] border border-amber-200/60"
                                                    : "bg-slate-900 text-slate-500 border border-slate-800 cursor-not-allowed"
                                            )}
                                        >
                                            {isSpinning ? (
                                                <><Sparkles className="w-5 h-5 animate-spin" /> 命運轉盤高速旋轉中...</>
                                            ) : isInsufficientFunds ? (
                                                <><AlertCircle className="w-5 h-5" /> 點數餘額不足 (共需 {totalPrice.toLocaleString()} {paymentCurrency === 'pplus' ? 'P+' : '💎'})</>
                                            ) : selectedNumbers.length === 0 ? (
                                                <><Dices className="w-5 h-5" /> 請至少選擇 1 個轉盤幸運號碼</>
                                            ) : (
                                                <><Play className="w-4 h-4 fill-current" /> 啟動命運轉盤 ({selectedNumbers.length} 格 {winProbability}% 勝率 · {totalPrice.toLocaleString()} {paymentCurrency === 'pplus' ? 'P+' : '💎'})</>
                                            )}
                                        </button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-3xl bg-slate-950 border-2 border-amber-500/35 text-slate-100 max-w-md shadow-2xl">
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="font-headline font-black text-amber-400 text-lg flex items-center gap-2">
                                                <Disc3 className="w-5 h-5 text-amber-400" /> 啟動獎品命運轉盤確認
                                            </AlertDialogTitle>
                                        </AlertDialogHeader>
                                        <div className="p-4 rounded-2xl border border-amber-500/20 bg-amber-950/15 text-xs text-slate-300 space-y-2.5">
                                            <div className="flex justify-between border-b border-white/10 pb-2">
                                                <span className="text-slate-400">目標獎品：</span>
                                                <span className="font-bold text-white truncate max-w-[200px]">{item.name}</span>
                                            </div>
                                            <div className="flex justify-between border-b border-white/10 pb-2">
                                                <span className="text-slate-400">選取扇區：</span>
                                                <span className="font-mono font-black text-rose-300">[{selectedNumbers.join(', ')}] ({winProbability}% 勝率)</span>
                                            </div>
                                            <div className="flex justify-between pb-1">
                                                <span className="text-slate-400">本次消耗：</span>
                                                <span className="font-mono font-black text-amber-300">
                                                    {totalPrice.toLocaleString()} {paymentCurrency === 'pplus' ? '紅利 P+ 點' : '鑽石 💎'}
                                                </span>
                                            </div>
                                        </div>
                                        <AlertDialogFooter className="gap-2">
                                            <AlertDialogCancel className="h-10 rounded-xl font-bold bg-slate-900 text-slate-300 border-slate-800 hover:bg-slate-800">
                                                取消
                                            </AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleSpinWheel}
                                                className="h-10 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 hover:brightness-110 text-white font-black border-none"
                                            >
                                                確認轉動轉盤！
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ) : (
                            /* 直接兌換模式 */
                            <div className="space-y-4 py-2">
                                <div className="p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-950 border border-amber-500/30 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                                            <Trophy className="w-4 h-4 text-amber-400" />
                                            100% 保證獲得實體獎品（免運費）
                                        </span>
                                        <span className="font-mono text-base font-black text-amber-300 flex items-center gap-1">
                                            <PPlusIcon className="w-4 h-4 text-amber-400" />
                                            {item.points.toLocaleString()} P+
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400 leading-relaxed">
                                        使用累積的紅利 P+ 點數直接兌換「{item.name}」，確認後立即建立出貨單並由專人免費寄出。
                                    </p>
                                </div>

                                <div className="space-y-3 p-4 sm:p-5 rounded-2xl bg-slate-900/70 border border-white/10">
                                    <h4 className="font-black text-xs sm:text-sm flex items-center gap-2 text-amber-300">
                                        <Truck className="w-4 h-4 text-amber-400" />
                                        填寫收件資訊
                                    </h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <Input
                                            value={realName}
                                            onChange={e => setRealName(e.target.value)}
                                            placeholder="收件人真實姓名"
                                            className="bg-slate-950 border-white/15 h-10 text-xs sm:text-sm text-white"
                                        />
                                        <Input
                                            value={phone}
                                            onChange={e => setPhone(e.target.value)}
                                            placeholder="聯絡電話 (09xx...)"
                                            className="bg-slate-950 border-white/15 h-10 text-xs sm:text-sm text-white"
                                        />
                                    </div>
                                    <Input
                                        value={address}
                                        onChange={e => setAddress(e.target.value)}
                                        placeholder="請輸入 7-11 門市名稱/店號 或 收件地址"
                                        className="bg-slate-950 border-white/15 h-10 text-xs sm:text-sm text-white"
                                    />

                                    <Button
                                        type="button"
                                        onClick={handleDirectRedeem}
                                        disabled={isSubmittingClaim || pplusBalance < item.points}
                                        className="w-full h-12 rounded-xl font-black text-sm bg-gradient-to-r from-amber-400 to-yellow-500 hover:brightness-110 text-slate-950 shadow-[0_0_25px_rgba(245,158,11,0.3)] cursor-pointer"
                                    >
                                        {isSubmittingClaim ? (
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                        ) : pplusBalance < item.points ? (
                                            `紅利 P+ 不足 (尚差 ${(item.points - pplusBalance).toLocaleString()} P+)`
                                        ) : (
                                            `確認花費 ${item.points.toLocaleString()} P+ 直接兌換`
                                        )}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export function ClaimWonPrizeDialog({
    claim,
    children,
}: {
    claim: WonPrizeClaim;
    children: React.ReactNode;
}) {
    const [isOpen, setIsOpen] = useState(false);
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const userProfileRef = useMemoFirebase(
        () => (firestore && user && isOpen) ? doc(firestore, 'users', user.uid) : null,
        [firestore, user, isOpen]
    );
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const [realName, setRealName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (userProfile) {
            setRealName(prev => prev || userProfile.realName || userProfile.username || '');
            setPhone(prev => prev || userProfile.phone || '');
            setAddress(prev => prev || userProfile.address || '');
        }
    }, [userProfile]);

    const handleClaim = async () => {
        if (!user || !firestore) return;
        if (!realName.trim() || !phone.trim() || !address.trim()) {
            toast({ variant: 'destructive', title: '請填寫完整收件資訊' });
            return;
        }
        setIsSubmitting(true);
        try {
            const batch = writeBatch(firestore);
            const orderRef = doc(collection(firestore, 'shippingOrders'));
            batch.set(orderRef, {
                userId: user.uid,
                name: realName.trim(),
                phone: phone.trim(),
                address: address.trim(),
                cardCount: 1,
                cardIds: [],
                redemptionItem: `${claim.itemName} (命運轉盤中獎)`,
                status: 'pending',
                shippingMethod: '7-11',
                createdAt: serverTimestamp(),
                fee: 0,
            });
            batch.update(doc(firestore, 'users', user.uid, 'wonPrizes', claim.id), {
                status: 'claimed',
                shippingOrderId: orderRef.id,
                claimedAt: serverTimestamp(),
            });
            await batch.commit();
            toast({ title: '📦 領取成功！', description: `「${claim.itemName}」已送出免運出貨申請！` });
            setIsOpen(false);
        } catch (err: any) {
            toast({ variant: 'destructive', title: '提交失敗', description: err?.message });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-md rounded-3xl bg-slate-950 border border-amber-500/40 text-white p-6 space-y-4">
                <DialogTitle className="text-lg font-black text-amber-300 flex items-center gap-2">
                    <Gift className="w-5 h-5 text-amber-400" />
                    領取轉盤中獎獎品
                </DialogTitle>
                <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/10">
                    <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-slate-900">
                        <SafeImage src={claim.itemImageUrl} alt={claim.itemName} fill className="object-cover" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-black text-sm text-white truncate">{claim.itemName}</p>
                        <p className="text-xs text-emerald-400 font-bold mt-0.5">🎉 命運轉盤 #{claim.winningSpot} 中獎（免運寄送）</p>
                    </div>
                </div>
                <div className="space-y-2.5">
                    <Input value={realName} onChange={e => setRealName(e.target.value)} placeholder="收件人真實姓名" className="bg-slate-900 border-white/15 h-10 text-xs" />
                    <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="聯絡手機 (09xx...)" className="bg-slate-900 border-white/15 h-10 text-xs" />
                    <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="7-11 門市名稱/店號 或 收件地址" className="bg-slate-900 border-white/15 h-10 text-xs" />
                </div>
                <Button onClick={handleClaim} disabled={isSubmitting} className="w-full h-11 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black">
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : '確認送出免運出貨單'}
                </Button>
            </DialogContent>
        </Dialog>
    );
}
