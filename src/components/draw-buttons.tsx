import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Loader2, Gem } from 'lucide-react';

import { CardPool } from '@/types/draw';

interface DrawButtonsProps {
    isLoadingStats: boolean;
    isLimitReachedForSingle: boolean;
    canDraw3: boolean;
    canDraw10: boolean;
    cardPool: CardPool | null;
    performDraw: (count: number) => void;
}

export function DrawButtons({
    isLoadingStats,
    isLimitReachedForSingle,
    canDraw3,
    canDraw10,
    cardPool,
    performDraw
}: DrawButtonsProps) {
    if (isLimitReachedForSingle) {
        return (
            <Button disabled className="w-full h-14 text-sm font-black rounded-2xl bg-slate-800 text-slate-500 border border-slate-700 opacity-50 italic">
                今日次數已用完
            </Button>
        );
    }

    return (
        <div className="flex gap-1.5 w-full">
            <Button 
                className={cn(
                    "flex-1 h-14 text-sm font-black border-2 transition-all shadow-xl rounded-2xl flex items-center justify-center gap-1 px-1",
                    isLoadingStats ? "bg-slate-900 text-slate-500 border-slate-800 opacity-50" : "bg-slate-950 text-slate-200 border border-slate-800 hover:border-slate-600 hover:bg-slate-900"
                )}
                onClick={() => performDraw(1)} 
                disabled={isLoadingStats || (cardPool?.remainingPacks ?? 0) < 1}
            >
                {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : 
                    <>
                        <span className="text-[9px] opacity-70">1抽</span>
                        <span className="text-xs flex items-center font-headline"><Gem className="w-3 h-3 mr-0.5 text-sky-400"/>{cardPool?.price}</span>
                    </>
                }
            </Button>
            <Button 
                className={cn(
                    "flex-1 h-14 text-sm font-black rounded-2xl transition-all shadow-xl flex items-center justify-center gap-1 px-1",
                    (isLoadingStats || !canDraw3) ? "bg-slate-900 text-slate-500 border border-slate-800 opacity-50" : "bg-indigo-950 text-indigo-100 border border-indigo-800 hover:bg-indigo-900 hover:border-indigo-700"
                )}
                onClick={() => performDraw(3)} 
                disabled={isLoadingStats || (cardPool?.remainingPacks ?? 0) < 3 || !canDraw3}
            >
                {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : !canDraw3 ? '額度不足' : 
                    <>
                        <span className="text-[9px] opacity-90">3 連抽</span>
                        <span className="text-xs flex items-center font-headline"><Gem className="w-3 h-3 mr-0.5"/>{cardPool?.price3Draws}</span>
                    </>
                }
            </Button>
            <Button 
                className={cn(
                    "flex-1 h-14 text-sm font-black rounded-2xl transition-all shadow-xl flex items-center justify-center gap-1 px-1",
                    (isLoadingStats || !canDraw10) ? "bg-slate-900 text-slate-500 border border-slate-800 opacity-50" : "bg-amber-950 text-amber-100 border border-amber-800 hover:bg-amber-900 hover:border-amber-700"
                )}
                onClick={() => performDraw(10)} 
                disabled={isLoadingStats || (cardPool?.remainingPacks ?? 0) < 10 || !canDraw10}
            >
                {isLoadingStats ? <Loader2 className="h-5 w-5 animate-spin" /> : !canDraw10 ? '額度不足' : 
                    <>
                        <span className="text-[9px] opacity-90">10 連抽</span>
                        <span className="text-xs flex items-center font-headline"><Gem className="w-3 h-3 mr-0.5"/>{cardPool?.price10Draws || (cardPool?.price || 0) * 10}</span>
                    </>
                }
            </Button>
        </div>
    );
}
