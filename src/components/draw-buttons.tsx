import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Sparkles, Ticket, Flame } from 'lucide-react';
import { DiamondIcon, PPlusIcon } from '@/components/icons';

import { CardPool } from '@/types/draw';

interface DrawButtonsProps {
    isLoadingStats: boolean;
    isLimitReachedForSingle: boolean;
    canDraw3: boolean;
    canDraw10: boolean;
    cardPool: CardPool | null;
    performDraw: (_count: number, _forceUseTicket?: boolean, _forceUseEventTicket?: boolean) => void;
    performTrialDraw?: (_count: number) => void;
    isTrialMode?: boolean;
    freeDrawTickets?: number;
    eventPoolTickets?: number;
    onOpenPickNumber?: (_targetCount?: number) => void;
}

export function DrawButtons({
    isLoadingStats,
    isLimitReachedForSingle,
    canDraw3,
    canDraw10,
    cardPool,
    performDraw,
    performTrialDraw,
    isTrialMode = false,
    freeDrawTickets = 0,
    eventPoolTickets = 0,
    onOpenPickNumber
}: DrawButtonsProps) {
    const isPPoint = cardPool?.currency === 'p-point';

    if (isLimitReachedForSingle && !isTrialMode) {
        return (
            <Button disabled className="w-full h-12 sm:h-14 text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl bg-slate-800 text-slate-500 border border-slate-700 opacity-50 italic">
                今日次數已用完
            </Button>
        );
    }

    // 限定活動卡池專屬券模式
    if (cardPool?.exclusiveTicketOnly && !isTrialMode) {
        return (
            <div className="flex flex-col gap-1.5 w-full">
                <div className="flex gap-1.5 w-full">
                    <Button
                        className={cn(
                            "flex-1 h-12 sm:h-14 text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl transition-all shadow-xl flex flex-col items-center justify-center px-1 py-1 cursor-pointer",
                            eventPoolTickets >= 1
                                ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white hover:brightness-110"
                                : "bg-slate-900 text-slate-500 border border-slate-800 opacity-50 cursor-not-allowed"
                        )}
                        disabled={eventPoolTickets < 1 || (cardPool?.remainingPacks ?? 0) < 1}
                        onClick={() => performDraw(1, false, true)}
                    >
                        <span className="flex items-center gap-1 font-black">
                            <Ticket className="w-3.5 h-3.5 text-amber-300" />
                            <span>再抽 1 次</span>
                        </span>
                        <span className="text-[10px] opacity-80">消耗 1 張專屬券</span>
                    </Button>

                    <Button
                        className={cn(
                            "flex-1 h-12 sm:h-14 text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl transition-all shadow-xl flex flex-col items-center justify-center px-1 py-1 cursor-pointer",
                            eventPoolTickets >= 3
                                ? "bg-gradient-to-r from-purple-700 to-indigo-700 text-white hover:brightness-110"
                                : "bg-slate-900 text-slate-500 border border-slate-800 opacity-50 cursor-not-allowed"
                        )}
                        disabled={eventPoolTickets < 3 || (cardPool?.remainingPacks ?? 0) < 3}
                        onClick={() => performDraw(3, false, true)}
                    >
                        <span className="flex items-center gap-1 font-black">
                            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                            <span>三連抽</span>
                        </span>
                        <span className="text-[10px] opacity-80">消耗 3 張專屬券</span>
                    </Button>
                </div>
                <div className="text-center text-[10px] text-purple-300 font-bold py-0.5">
                    持有【{cardPool?.eventTicketName || '專屬活動券'}】: {eventPoolTickets} 張
                </div>
            </div>
        );
    }

    // 點擊 1抽、3抽、多抽 時：若支援選籤則開啟選籤盤並帶入抽數，否則直接執行抽卡
    const handleButtonClick = (count: number) => {
        if (onOpenPickNumber) {
            onOpenPickNumber(count);
            return;
        }
        if (isTrialMode && performTrialDraw) {
            performTrialDraw(count);
        } else {
            performDraw(count);
        }
    };

    const CurrencyIcon = ({ className = "w-2.5 h-2.5 mr-0.5" }: { className?: string }) => {
        if (isTrialMode) return <Sparkles className={cn(className, "text-purple-300")} />;
        if (isPPoint) return <PPlusIcon className={cn(className, "text-amber-400 shrink-0")} />;
        return <DiamondIcon className={cn(className, "text-cyan-400 shrink-0")} />;
    };

    return (
        <div className="flex flex-col gap-1.5 w-full">
            {/* 🎟️ 免費抽卡券專用再抽一次按鈕 (如果有免費券且卡池支援) */}
            {!isTrialMode && (cardPool?.allowFreeDraw !== false) && freeDrawTickets > 0 && (
                <Button 
                    className="w-full h-10 sm:h-11 text-xs font-black rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 shadow-lg shadow-emerald-500/25 hover:brightness-110 flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-emerald-400/40 active:scale-95"
                    onClick={() => performDraw(1, true)}
                >
                    <Ticket className="w-4 h-4 fill-slate-950" />
                    <span>🎟️ 使用免費券再抽 1 次 (持有 {freeDrawTickets} 張)</span>
                </Button>
            )}

            {/* 抽卡按鈕列 (根據卡池剩餘包數自動調整選項，避免剩餘不足10包時出現10抽) */}
            {(() => {
                const remainingPacks = cardPool?.remainingPacks ?? 0;
                const basePrice = cardPool?.price || 0;
                const p3 = cardPool?.price3Draws || basePrice * 3;
                const p10 = (cardPool as any)?.price10Draws || basePrice * 10;

                let configs: Array<{
                    count: number;
                    label: string;
                    isAllIn: boolean;
                    price: number;
                    canDraw: boolean;
                    isThird: boolean;
                }> = [];

                if (isTrialMode) {
                    configs = [
                        { count: 1, label: '試 1抽', isAllIn: false, price: 0, canDraw: true, isThird: false },
                        { count: 3, label: '試 3連', isAllIn: false, price: 0, canDraw: true, isThird: false },
                        { count: 10, label: '試 10連', isAllIn: false, price: 0, canDraw: true, isThird: true },
                    ];
                } else if (remainingPacks <= 1) {
                    configs = [
                        { count: 1, label: remainingPacks === 1 ? '1 抽 (最後1包)' : '1 抽', isAllIn: remainingPacks === 1, price: basePrice, canDraw: remainingPacks >= 1, isThird: false },
                    ];
                } else if (remainingPacks === 2) {
                    configs = [
                        { count: 1, label: '1 抽', isAllIn: false, price: basePrice, canDraw: remainingPacks >= 1, isThird: false },
                        { count: 2, label: '2 連抽 (全包)', isAllIn: true, price: basePrice * 2, canDraw: remainingPacks >= 2, isThird: true },
                    ];
                } else if (remainingPacks === 3) {
                    configs = [
                        { count: 1, label: '1 抽', isAllIn: false, price: basePrice, canDraw: remainingPacks >= 1, isThird: false },
                        { count: 3, label: '3 連抽 (全包)', isAllIn: true, price: p3, canDraw: remainingPacks >= 3 && canDraw3, isThird: true },
                    ];
                } else if (remainingPacks < 10) {
                    // 例如：剩餘 5 包 => [1 抽, 3 連抽, 5 連抽 (全包)]
                    configs = [
                        { count: 1, label: '1 抽', isAllIn: false, price: basePrice, canDraw: remainingPacks >= 1, isThird: false },
                        { count: 3, label: '3 連抽', isAllIn: false, price: p3, canDraw: remainingPacks >= 3 && canDraw3, isThird: false },
                        { count: remainingPacks, label: `${remainingPacks} 連抽 (全包)`, isAllIn: true, price: basePrice * remainingPacks, canDraw: remainingPacks >= remainingPacks, isThird: true },
                    ];
                } else {
                    // 剩餘 >= 10 包
                    configs = [
                        { count: 1, label: '1 抽', isAllIn: false, price: basePrice, canDraw: remainingPacks >= 1, isThird: false },
                        { count: 3, label: '3 連抽', isAllIn: false, price: p3, canDraw: remainingPacks >= 3 && canDraw3, isThird: false },
                        { count: 10, label: '10 連抽', isAllIn: false, price: p10, canDraw: remainingPacks >= 10 && canDraw10, isThird: true },
                    ];
                }

                return (
                    <div className="flex gap-2 w-full">
                        {configs.map((cfg) => {
                            const isDisabled = !isTrialMode && (isLoadingStats || !cfg.canDraw);
                            const isHighlighted = !isDisabled && (cfg.isThird || cfg.isAllIn);
                            return (
                                <Button
                                    key={cfg.count}
                                    className={cn(
                                        "flex-1 h-12 sm:h-13 text-xs sm:text-sm font-bold border transition-all rounded-xl flex flex-col items-center justify-center gap-0.5 px-1.5 py-1.5 cursor-pointer active:scale-[0.97]",
                                        isTrialMode
                                            ? cfg.isThird
                                                ? "bg-gradient-to-br from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border-amber-200/80 font-black"
                                                : "bg-white/[0.05] hover:bg-white/[0.09] text-white border-white/[0.12] hover:border-amber-300/45"
                                            : isDisabled
                                                ? "bg-white/[0.02] text-slate-500 border-white/[0.06] opacity-60 cursor-not-allowed"
                                                : isHighlighted
                                                    ? cfg.isAllIn
                                                        ? "bg-gradient-to-br from-[#FDE68A] via-amber-400 to-rose-400 text-[#120d02] border-amber-200/80 font-black shadow-[0_6px_20px_rgba(244,63,94,0.25)] hover:brightness-105"
                                                        : "bg-gradient-to-br from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border-amber-200/80 font-black shadow-[0_6px_20px_rgba(251,191,36,0.25)] hover:brightness-105"
                                                    : "bg-white/[0.04] hover:bg-white/[0.09] text-white border-white/[0.12] hover:border-amber-300/45"
                                    )}
                                    onClick={() => handleButtonClick(cfg.count)}
                                    disabled={isDisabled}
                                >
                                    {(!isTrialMode && !cfg.canDraw && !isLoadingStats) ? (
                                        <span className="text-[10px] text-rose-400">
                                            {remainingPacks < cfg.count ? '剩餘不足' : '額度不足'}
                                        </span>
                                    ) : (
                                        <>
                                            <span className={cn(
                                                "text-[11px] sm:text-xs whitespace-nowrap leading-tight",
                                                isHighlighted ? "text-[#120d02] font-black" : "text-slate-200 font-bold"
                                            )}>
                                                {cfg.label}
                                            </span>
                                            <span className={cn(
                                                "text-[11px] sm:text-xs flex items-center font-mono font-black tabular-nums leading-tight",
                                                isHighlighted ? "text-[#120d02]" : "text-[#FDE68A]"
                                            )}>
                                                {isTrialMode ? (
                                                    '免費'
                                                ) : (
                                                    <>
                                                        {isPPoint ? (
                                                            <PPlusIcon className={cn("w-3 h-3 mr-0.5 shrink-0", isHighlighted ? "text-[#120d02]" : "text-amber-300")} />
                                                        ) : (
                                                            <DiamondIcon className={cn("w-3 h-3 mr-0.5 shrink-0", isHighlighted ? "text-[#120d02]" : "text-cyan-300")} />
                                                        )}
                                                        {cfg.price.toLocaleString()}
                                                    </>
                                                )}
                                            </span>
                                        </>
                                    )}
                                </Button>
                            );
                        })}
                    </div>
                );
            })()}

            {isTrialMode && (
                <Button 
                    className="w-full h-9 sm:h-10 text-xs font-black rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] shadow-[0_6px_20px_rgba(251,191,36,0.25)] hover:brightness-105 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    onClick={() => performDraw(1)}
                >
                    <Sparkles className="w-3.5 h-3.5 fill-[#120d02]" />
                    <span>轉為正式開獎 (扣 {isPPoint ? 'P點' : '鑽石'} 派發真卡)</span>
                </Button>
            )}
        </div>
    );
}

