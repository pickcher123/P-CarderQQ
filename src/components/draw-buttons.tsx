import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Gem, Sparkles } from 'lucide-react';

import { CardPool } from '@/types/draw';

interface DrawButtonsProps {
    isLoadingStats: boolean;
    isLimitReachedForSingle: boolean;
    canDraw3: boolean;
    canDraw10: boolean;
    cardPool: CardPool | null;
    performDraw: (_count: number) => void;
    performTrialDraw?: (_count: number) => void;
    isTrialMode?: boolean;
}

export function DrawButtons({
    isLoadingStats,
    isLimitReachedForSingle,
    canDraw3,
    canDraw10,
    cardPool,
    performDraw,
    performTrialDraw,
    isTrialMode = false
}: DrawButtonsProps) {
    if (isLimitReachedForSingle && !isTrialMode) {
        return (
            <Button disabled className="w-full h-12 sm:h-14 text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl bg-slate-800 text-slate-500 border border-slate-700 opacity-50 italic">
                今日次數已用完
            </Button>
        );
    }

    // In trial mode, primary buttons trigger performTrialDraw to prevent accidental point deduction
    const handleButtonClick = (count: number) => {
        if (isTrialMode && performTrialDraw) {
            performTrialDraw(count);
        } else {
            performDraw(count);
        }
    };

    return (
        <div className="flex flex-col gap-1.5 w-full">
            <div className="flex gap-1.5 w-full">
                <Button 
                    className={cn(
                        "flex-1 h-12 sm:h-14 text-xs sm:text-sm font-black border-2 transition-all shadow-xl rounded-xl sm:rounded-2xl flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 px-1 py-1",
                        isTrialMode 
                            ? "bg-purple-950 text-purple-100 border-purple-600 hover:bg-purple-900" 
                            : isLoadingStats ? "bg-slate-900 text-slate-500 border-slate-800 opacity-50" : "bg-slate-950 text-slate-200 border border-slate-800 hover:border-slate-600 hover:bg-slate-900"
                    )}
                    onClick={() => handleButtonClick(1)} 
                    disabled={!isTrialMode && (isLoadingStats || (cardPool?.remainingPacks ?? 0) < 1)}
                >
                    {isLoadingStats && !isTrialMode ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : 
                        <>
                            <span className="text-[10px] sm:text-xs opacity-90 whitespace-nowrap">{isTrialMode ? '試 1抽' : '1抽'}</span>
                            <span className="text-[11px] sm:text-xs flex items-center font-headline truncate font-bold">
                                {isTrialMode ? <Sparkles className="w-2.5 h-2.5 mr-0.5 text-purple-300"/> : <Gem className="w-2.5 h-2.5 mr-0.5 text-sky-400"/>}
                                {isTrialMode ? '免費' : cardPool?.price}
                            </span>
                        </>
                    }
                </Button>
                <Button 
                    className={cn(
                        "flex-1 h-12 sm:h-14 text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl transition-all shadow-xl flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 px-1 py-1",
                        isTrialMode 
                            ? "bg-purple-900 text-purple-100 border-purple-500 hover:bg-purple-800" 
                            : (isLoadingStats || !canDraw3) ? "bg-slate-900 text-slate-500 border border-slate-800 opacity-50" : "bg-indigo-950 text-indigo-100 border border-indigo-800 hover:bg-indigo-900 hover:border-indigo-700"
                    )}
                    onClick={() => handleButtonClick(3)} 
                    disabled={!isTrialMode && (isLoadingStats || (cardPool?.remainingPacks ?? 0) < 3 || !canDraw3)}
                >
                    {isLoadingStats && !isTrialMode ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : (!isTrialMode && !canDraw3) ? <span className="text-[10px] text-rose-400">額度不足</span> : 
                        <>
                            <span className="text-[10px] sm:text-xs opacity-90 whitespace-nowrap">{isTrialMode ? '試 3連' : '3 連抽'}</span>
                            <span className="text-[11px] sm:text-xs flex items-center font-headline truncate font-bold">
                                {isTrialMode ? <Sparkles className="w-2.5 h-2.5 mr-0.5 text-purple-300"/> : <Gem className="w-2.5 h-2.5 mr-0.5"/>}
                                {isTrialMode ? '免費' : cardPool?.price3Draws}
                            </span>
                        </>
                    }
                </Button>
                <Button 
                    className={cn(
                        "flex-1 h-12 sm:h-14 text-xs sm:text-sm font-black rounded-xl sm:rounded-2xl transition-all shadow-xl flex flex-col sm:flex-row items-center justify-center gap-0.5 sm:gap-1 px-1 py-1",
                        isTrialMode 
                            ? "bg-fuchsia-950 text-fuchsia-100 border-fuchsia-500 hover:bg-fuchsia-900" 
                            : (isLoadingStats || !canDraw10) ? "bg-slate-900 text-slate-500 border border-slate-800 opacity-50" : "bg-amber-950 text-amber-100 border border-amber-800 hover:bg-amber-900 hover:border-amber-700"
                    )}
                    onClick={() => handleButtonClick(10)} 
                    disabled={!isTrialMode && (isLoadingStats || (cardPool?.remainingPacks ?? 0) < 10 || !canDraw10)}
                >
                    {isLoadingStats && !isTrialMode ? <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" /> : (!isTrialMode && !canDraw10) ? <span className="text-[10px] text-rose-400">額度不足</span> : 
                        <>
                            <span className="text-[10px] sm:text-xs opacity-90 whitespace-nowrap">{isTrialMode ? '試 10連' : '10 連抽'}</span>
                            <span className="text-[11px] sm:text-xs flex items-center font-headline truncate font-bold">
                                {isTrialMode ? <Sparkles className="w-2.5 h-2.5 mr-0.5 text-purple-300"/> : <Gem className="w-2.5 h-2.5 mr-0.5"/>}
                                {isTrialMode ? '免費' : ((cardPool as any)?.price10Draws || (cardPool?.price || 0) * 10)}
                            </span>
                        </>
                    }
                </Button>
            </div>

            {isTrialMode ? (
                <Button 
                    className="w-full h-9 sm:h-10 text-xs font-black rounded-xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 border-b-2 border-amber-800 shadow-[0_0_15px_rgba(245,158,11,0.4)] hover:brightness-110 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                    onClick={() => performDraw(1)}
                >
                    <Sparkles className="w-3.5 h-3.5 fill-slate-950" />
                    <span>⚡ 轉為正式開獎 (扣點派發真卡)</span>
                </Button>
            ) : (
                performTrialDraw && (
                    <Button 
                        variant="outline"
                        className="w-full h-8 sm:h-9 text-xs font-bold rounded-xl border-purple-500/40 bg-purple-950/30 text-purple-300 hover:bg-purple-900/50 hover:border-purple-400 flex items-center justify-center gap-1 transition-all cursor-pointer"
                        onClick={() => performTrialDraw(1)}
                    >
                        <Sparkles className="w-3 h-3 text-purple-400" />
                        <span>免費試手氣 🎲 (純模擬不扣點)</span>
                    </Button>
                )
            )}
        </div>
    );
}
