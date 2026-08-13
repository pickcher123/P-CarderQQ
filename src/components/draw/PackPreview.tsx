import { Button } from '@/components/ui/button';
import { Logo } from '@/components/icons';
import { Gem, ShieldCheck, Ban, Loader2, Zap, Sparkles, ArrowLeft, Info, Scale, ChevronRight, ExternalLink, FileText } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { CardPool } from '@/types/draw';
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

export function PackPreview({
    cardPool,
    initialDrawCount,
    isLevelMet,
    isLimitReachedForInitial,
    isLoadingStats,
    performDraw,
    performTrialDraw
}: {
    cardPool: CardPool,
    initialDrawCount: number,
    isLevelMet: boolean,
    isLimitReachedForInitial: boolean,
    isLoadingStats: boolean,
    performDraw: (_count: number) => void,
    performTrialDraw?: (_count: number) => void
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
                                <span>
                                    點擊啟動開獎即視為完全同意購買與
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <button 
                                                type="button" 
                                                className="text-amber-400 font-bold underline underline-offset-2 hover:text-amber-300 transition-colors mx-1 cursor-pointer inline-flex items-center gap-0.5"
                                            >
                                                交易規則 <ExternalLink className="w-3 h-3 inline" />
                                            </button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-2xl bg-slate-950/95 backdrop-blur-2xl border-amber-500/30 text-white rounded-[2rem] p-6 shadow-2xl">
                                            <DialogHeader className="space-y-2">
                                                <DialogTitle className="text-xl font-black text-amber-400 flex items-center gap-2">
                                                    <Scale className="w-5 h-5 text-amber-400" /> P+CARDER 購買與交易規則
                                                </DialogTitle>
                                                <DialogDescription className="text-slate-400 text-xs">
                                                    請詳細閱讀以下交易條款與消費須知以保障您的權益。
                                                </DialogDescription>
                                            </DialogHeader>
                                            <ScrollArea className="h-[55vh] pr-3 mt-4">
                                                <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
                                                    <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1 text-amber-200">
                                                        <p className="font-bold text-amber-400 flex items-center gap-1.5">
                                                            <Info className="w-4 h-4 shrink-0" /> 重要聲明
                                                        </p>
                                                        <p>本平台商品屬機率型抽選及數位機率內容，一經點擊「啟動開獎」扣除資產即視為服務完成交付。</p>
                                                    </div>

                                                    <section className="space-y-1.5 border-b border-slate-800 pb-3">
                                                        <h4 className="font-black text-white text-sm flex items-center gap-2 text-amber-400">
                                                            一、消費者保護法適用說明（不適用鑑賞期）
                                                        </h4>
                                                        <p>依據《消費者保護法》第19條第1項但書及《通訊交易解除權合理例外情事適用準則》第2條第5款，本站提供之服務屬於「非以有形媒介提供之數位內容或一經提供即為完成之線上服務」。玩家於點擊啟動抽選扣點後，即代表商品交付完成，不適用7日無條件退貨與鑑賞期規定。</p>
                                                    </section>

                                                    <section className="space-y-1.5 border-b border-slate-800 pb-3">
                                                        <h4 className="font-black text-white text-sm flex items-center gap-2 text-amber-400">
                                                            二、數位機率與抽選透明度
                                                        </h4>
                                                        <p>卡池內所有卡片稀有度及中獎機率均由系統演算法隨機抽出，過程公開透明且均勻隨機。各卡池之配卡數量與剩餘包數皆實時呈現於平台。</p>
                                                    </section>

                                                    <section className="space-y-1.5 border-b border-slate-800 pb-3">
                                                        <h4 className="font-black text-white text-sm flex items-center gap-2 text-amber-400">
                                                            三、卡片實體寄送與出貨規範
                                                        </h4>
                                                        <ul className="list-disc pl-4 space-y-1">
                                                            <li>抽中之卡片將暫存於您的「我的收藏」倉庫中。</li>
                                                            <li>申請實體出貨時，請務必填寫正確收件資訊。平台寄送包裹皆會錄影存證。</li>
                                                            <li>為保障雙方權益，收到實體包裹請務必【全程錄影開箱】，如無開箱影片恕不接受商品重大瑕疵之換貨申請。</li>
                                                        </ul>
                                                    </section>

                                                    <section className="space-y-1.5 border-b border-slate-800 pb-3">
                                                        <h4 className="font-black text-white text-sm flex items-center gap-2 text-amber-400">
                                                            四、快速轉點與資產轉換說明
                                                        </h4>
                                                        <p>玩家可於「我的收藏」選擇將庫存卡片進行資產轉點（轉換為鑽石或紅利點數）。轉點動作一旦確認後具有不可逆性，卡片將被立即銷毀，無法恢復，請謹慎操作。</p>
                                                    </section>

                                                    <section className="space-y-1.5">
                                                        <h4 className="font-black text-white text-sm flex items-center gap-2 text-amber-400">
                                                            五、風控與帳戶安全規範
                                                        </h4>
                                                        <p>請避免於短時間內進行異常高頻交易或刷卡，以免被銀行風控系統凍結。如發現任何利用系統漏洞違規操作之行為，本平台有權暫停該帳戶服務。</p>
                                                    </section>
                                                </div>
                                            </ScrollArea>
                                            <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                                                <Link 
                                                    href="/about" 
                                                    target="_blank" 
                                                    className="text-amber-400 hover:text-amber-300 font-bold text-xs flex items-center gap-1 transition-colors"
                                                >
                                                    <FileText className="w-3.5 h-3.5" /> 前往「關於我們」查看完整條款頁面 <ChevronRight className="w-3 h-3" />
                                                </Link>
                                            </div>
                                        </DialogContent>
                                    </Dialog>。
                                </span>
                            </li>
                        </ul>
                    </div>

                    {/* CTA Action Buttons */}
                    <div className="space-y-2">
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
                                <><Zap className="mr-2 h-6 w-6 fill-slate-950" /> 啟動正式開獎 ({cost.toLocaleString()} 點)</>
                            )}
                        </Button>

                        {performTrialDraw && (
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full h-11 text-xs sm:text-sm font-black rounded-2xl border-purple-500/50 bg-purple-950/40 text-purple-200 hover:bg-purple-900/60 hover:border-purple-400 shadow-lg shadow-purple-950/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                onClick={() => performTrialDraw(initialDrawCount)}
                            >
                                <Sparkles className="w-4 h-4 text-purple-300 animate-pulse" />
                                <span>🎲 免費試手氣（純模擬體驗，完全不扣點）</span>
                            </Button>
                        )}
                    </div>
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

