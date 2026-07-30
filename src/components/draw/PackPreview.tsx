import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons';
import { Gem, ShieldCheck, AlertCircle, Ban, PlayCircle, Loader2, Zap, Sparkles, ArrowLeft, CheckCircle2, Info } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { CardPool } from '@/types/draw';
import Link from 'next/link';

export function PackPreview({
    cardPool,
    initialDrawCount,
    isLevelMet,
    isLimitReachedForInitial,
    isLoadingStats,
    performDraw
}: {
    cardPool: CardPool,
    initialDrawCount: number,
    isLevelMet: boolean,
    isLimitReachedForInitial: boolean,
    isLoadingStats: boolean,
    performDraw: (count: number) => void
}) {
    const cost = initialDrawCount === 3 && cardPool.price3Draws ? cardPool.price3Draws : (cardPool.price || 0) * initialDrawCount;
    const canStart = isLevelMet && !isLimitReachedForInitial && !isLoadingStats;

    return (
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-60px)] p-4 py-8 relative select-none w-full max-w-md mx-auto">
            {/* Background ambient glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
                <div className="w-72 h-72 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
            </div>

            <div className="w-full space-y-4 animate-fade-in-up my-auto">
                {/* Main Card Container */}
                <div className="relative p-6 sm:p-7 bg-slate-900/95 backdrop-blur-xl border-2 border-amber-500/30 rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden space-y-5">
                    {/* Header */}
                    <div className="text-center space-y-3">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-950/80 border border-slate-800 shadow-inner">
                            <Logo className="scale-75 opacity-90" asStatic />
                        </div>
                        
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-amber-400/80 flex items-center justify-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                拆卡抽賞確認
                            </p>
                            <h2 className="text-lg sm:text-xl font-headline font-black text-white italic tracking-tight line-clamp-2 px-2">
                                {cardPool.name}
                            </h2>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/90 rounded-2xl border border-slate-800/80 shadow-inner">
                        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-center space-y-0.5">
                            <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">本次抽數</span>
                            <span className="text-lg font-black text-white font-code">{initialDrawCount} 包</span>
                        </div>
                        <div className="p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-center space-y-0.5">
                            <span className="text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">花費金額</span>
                            <div className="flex items-center justify-center gap-1.5 text-lg font-black text-amber-400 font-code">
                                {cardPool.currency === 'p-point' ? (
                                    <><PPlusIcon className="w-4 h-4 text-sky-400 shrink-0" />{cost.toLocaleString()}</>
                                ) : (
                                    <><Gem className="w-4 h-4 text-sky-400 shrink-0" /> {cost.toLocaleString()}</>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Level requirement if any */}
                    {cardPool.minLevel && cardPool.minLevel !== '新手收藏家' && (
                        <div className={cn(
                            "p-2.5 rounded-xl border flex items-center justify-center gap-2 font-black text-xs",
                            isLevelMet ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-400" : "bg-rose-950/40 border-rose-800/60 text-rose-400"
                        )}>
                            <ShieldCheck className="w-4 h-4 shrink-0" />
                            <span>等級限制: {cardPool.minLevel}</span>
                        </div>
                    )}

                    {/* Terms Notice */}
                    <div className="p-3.5 rounded-2xl border border-slate-800 bg-slate-950/80 space-y-2">
                        <div className="flex items-center gap-1.5 text-amber-400">
                            <Info className="w-4 h-4 shrink-0" />
                            <p className="text-xs font-black uppercase tracking-wider">購買條款告知</p>
                        </div>
                        <ul className="text-[11px] text-slate-400 font-medium space-y-1 pl-1 leading-relaxed">
                            <li className="flex items-start gap-1.5">
                                <span className="text-amber-500/80">•</span>
                                <span>本站商品屬機率型抽選及數位機率內容。</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="text-amber-500/80">•</span>
                                <span>本服務一經啟動即完成交付，依《消保法》不適用鑑賞期。</span>
                            </li>
                            <li className="flex items-start gap-1.5">
                                <span className="text-amber-500/80">•</span>
                                <span>點擊啟動開獎即視為完全同意購買與交易規則。</span>
                            </li>
                        </ul>
                    </div>

                    {/* CTA Action Button */}
                    <Button
                        size="lg"
                        className={cn(
                            "w-full h-14 text-lg sm:text-xl font-black rounded-2xl shadow-2xl transition-all border-b-4 active:translate-y-1 active:border-b-0",
                            canStart 
                                ? "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 border-amber-800 hover:brightness-110 shadow-amber-500/20" 
                                : "bg-slate-800 text-slate-500 border-slate-950 cursor-not-allowed opacity-60"
                        )}
                        onClick={() => canStart && performDraw(initialDrawCount)}
                        disabled={!canStart}
                    >
                        {isLoadingStats ? (
                            <><Loader2 className="animate-spin mr-2 h-6 w-6" /> 驗證紀錄中...</>
                        ) : isLimitReachedForInitial ? (
                            <><Ban className="mr-2 h-6 w-6 text-rose-400" /> 今日次數已用完</>
                        ) : !isLevelMet ? (
                            <><Ban className="mr-2 h-6 w-6 text-rose-400" /> 權限不足 ({cardPool.minLevel})</>
                        ) : (
                            <><Zap className="mr-2 h-6 w-6 fill-slate-950" /> 啟動開獎</>
                        )}
                    </Button>
                </div>

                {/* Return link */}
                <div className="text-center pt-1">
                    <Button asChild variant="ghost" className="text-slate-400 hover:text-white font-bold text-xs rounded-xl">
                        <Link href="/draw">
                            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 取消並返回卡池列表
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}

