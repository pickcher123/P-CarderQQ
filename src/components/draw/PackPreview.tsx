'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Logo, PPlusIcon, DiamondIcon } from '@/components/icons';
import { ShieldCheck, Ban, Loader2, Zap, Sparkles, ArrowLeft, Info, Scale, ChevronRight, ExternalLink, FileText, Ticket, Check } from 'lucide-react';
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
    performTrialDraw,
    isUsingTicket = false,
    freeDrawTickets = 0
}: {
    cardPool: CardPool,
    initialDrawCount: number,
    isLevelMet: boolean,
    isLimitReachedForInitial: boolean,
    isLoadingStats: boolean,
    performDraw: (_count: number, _forceUseTicket?: boolean) => void,
    performTrialDraw?: (_count: number) => void,
    isUsingTicket?: boolean,
    freeDrawTickets?: number
}) {
    const [useTicketMode, setUseTicketMode] = useState<boolean>(isUsingTicket);

    const isPPoint = cardPool.currency === 'p-point';
    const cost = useTicketMode ? 0 : (initialDrawCount === 3 && cardPool.price3Draws ? cardPool.price3Draws : (cardPool.price || 0) * initialDrawCount);
    const isFreeDrawAllowed = !useTicketMode || cardPool.allowFreeDraw !== false;
    const hasEnoughTickets = !useTicketMode || freeDrawTickets >= 1;
    const canStart = isLevelMet && !isLimitReachedForInitial && !isLoadingStats && hasEnoughTickets && isFreeDrawAllowed;

    const canToggleTicket = cardPool.allowFreeDraw !== false && freeDrawTickets > 0 && initialDrawCount === 1;

    return (
        <div className="flex flex-col items-center justify-center min-h-[100dvh] p-3 sm:p-4 py-4 sm:py-8 relative select-none w-full max-w-md mx-auto">
            {/* Background ambient glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
                <div className="w-64 h-64 sm:w-72 sm:h-72 bg-amber-500/10 rounded-full blur-3xl animate-pulse" />
            </div>

            <div className="w-full space-y-3 sm:space-y-4 animate-fade-in-up my-auto">
                {/* Main Card Container */}
                <div className="relative p-4 sm:p-7 bg-slate-900/95 backdrop-blur-xl border-2 border-amber-500/30 rounded-3xl sm:rounded-[2.5rem] shadow-[0_20px_60px_rgba(0,0,0,0.85)] overflow-hidden space-y-3 sm:space-y-4">
                    {/* Header */}
                    <div className="text-center space-y-1.5 sm:space-y-2">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-950/80 border border-slate-800 shadow-inner">
                            <Logo className="scale-75 opacity-90" asStatic />
                        </div>
                        
                        <div className="space-y-0.5">
                            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-amber-400/80 flex items-center justify-center gap-1">
                                <Sparkles className="w-3 h-3 text-amber-400" />
                                {useTicketMode ? '🎟️ 活動免費兌換券開獎確認' : '拆卡抽賞確認'}
                            </p>
                            <h2 className="text-base sm:text-xl font-headline font-black text-white italic tracking-tight line-clamp-2 px-1">
                                {cardPool.name}
                            </h2>
                        </div>
                    </div>

                    {/* 🎟️ 免費券使用詢問與切換區塊 (如果卡池支援且用戶持有免費券) */}
                    {canToggleTicket && (
                        <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-2">
                            <div className="flex items-center justify-between px-1">
                                <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                                    <Ticket className="w-4 h-4 text-emerald-400" />
                                    <span>活動免費抽卡券餘額</span>
                                </span>
                                <span className="font-mono font-black text-emerald-300 text-xs sm:text-sm bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-500/30">
                                    {freeDrawTickets} 張可用
                                </span>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-900/90 rounded-xl border border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setUseTicketMode(true)}
                                    className={cn(
                                        "py-2 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer",
                                        useTicketMode 
                                            ? "bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 shadow-md" 
                                            : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    {useTicketMode && <Check className="w-3 h-3 stroke-[3]" />}
                                    <span>🎟️ 使用免費券 (0 點)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setUseTicketMode(false)}
                                    className={cn(
                                        "py-2 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1 cursor-pointer",
                                        !useTicketMode 
                                            ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-md" 
                                            : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    {!useTicketMode && <Check className="w-3 h-3 stroke-[3]" />}
                                    <span>{isPPoint ? '💎 P點扣點' : '💎 鑽石扣點'}</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 p-2.5 sm:p-3 bg-slate-950/90 rounded-2xl border border-slate-800/80 shadow-inner">
                        <div className="p-2 sm:p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-center space-y-0.5">
                            <span className="text-[9px] sm:text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">本次抽數</span>
                            <span className="text-base sm:text-lg font-black text-white font-code">{initialDrawCount} 包</span>
                        </div>
                        <div className="p-2 sm:p-3 bg-slate-900/80 rounded-xl border border-slate-800 text-center space-y-0.5">
                            <span className="text-[9px] sm:text-[10px] text-slate-400 font-extrabold block uppercase tracking-wider">花費金額</span>
                            <div className="flex items-center justify-center gap-1 text-base sm:text-lg font-black text-amber-400 font-code">
                                {useTicketMode ? (
                                    <span className="text-emerald-400 font-black text-xs sm:text-sm flex items-center gap-1">
                                        <Ticket className="w-3.5 h-3.5 text-amber-400" /> 0 點 (消耗 1 張券)
                                    </span>
                                ) : isPPoint ? (
                                    <><PPlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400 shrink-0" />{cost.toLocaleString()} P</>
                                ) : (
                                    <><DiamondIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400 shrink-0" /> {cost.toLocaleString()}</>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Level requirement if any */}
                    {cardPool.minLevel && cardPool.minLevel !== '新手收藏家' && (
                        <div className={cn(
                            "p-2 rounded-xl border flex items-center justify-center gap-1.5 font-black text-xs",
                            isLevelMet ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-400" : "bg-rose-950/40 border-rose-800/60 text-rose-400"
                        )}>
                            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                            <span>等級限制: {cardPool.minLevel}</span>
                        </div>
                    )}

                    {/* Terms Notice */}
                    <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl border border-slate-800 bg-slate-950/80 space-y-1.5">
                        <div className="flex items-center gap-1 text-amber-400">
                            <Info className="w-3.5 h-3.5 shrink-0" />
                            <p className="text-[11px] sm:text-xs font-black uppercase tracking-wider">購買條款告知</p>
                        </div>
                        <ul className="text-[10px] sm:text-[11px] text-slate-400 font-medium space-y-1 pl-1 leading-relaxed">
                            <li className="flex items-start gap-1">
                                <span className="text-amber-500/80">•</span>
                                <span>本站商品屬機率型抽選及數位機率內容。</span>
                            </li>
                            <li className="flex items-start gap-1">
                                <span className="text-amber-500/80">•</span>
                                <span>
                                    啟動開獎即視為您已閱讀並同意{' '}
                                    <Dialog>
                                        <DialogTrigger asChild>
                                            <button className="text-amber-400 hover:text-amber-300 font-bold underline decoration-amber-500/50 underline-offset-2 inline-flex items-center gap-0.5 cursor-pointer">
                                                《平台服務與拆卡條款》
                                            </button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-200">
                                            <DialogHeader>
                                                <DialogTitle className="text-base font-black text-amber-400 flex items-center gap-1.5">
                                                    <Scale className="w-4 h-4" /> 平台服務與拆卡條款
                                                </DialogTitle>
                                                <DialogDescription className="text-xs text-slate-400">
                                                    請於開獎前詳閱以下權益條款
                                                </DialogDescription>
                                            </DialogHeader>
                                            <ScrollArea className="max-h-[60vh] pr-2 mt-2">
                                                <div className="text-xs space-y-3 leading-relaxed text-slate-300">
                                                    <section className="space-y-1">
                                                        <h4 className="font-bold text-white">一、機率型商品說明</h4>
                                                        <p>本平台所提供之卡包拆卡與抽賞服務，皆屬於機率型商品。使用者於點擊開獎時即表示已知悉並同意抽中特定商品之機率，每次開獎結果皆由伺服器端密碼學安全隨機演算法即時運算產生，具有不可預測性。</p>
                                                    </section>
                                                    <section className="space-y-1">
                                                        <h4 className="font-bold text-white">二、無七日猶豫期聲明</h4>
                                                        <p>依據《消費者保護法》第十九條及《通訊交易解除權合理例外情事適用準則》，本服務一經啟動開獎程序，因涉及即時數位內容運算與庫存狀態即刻變更，一經交付或提供即不適用消費者保護法之七日鑑賞期（猶豫期）解除權，開獎後概不接受退貨、退款或更換。</p>
                                                    </section>
                                                    <section className="space-y-1">
                                                        <h4 className="font-bold text-white">三、防搶保護與伺服器結算</h4>
                                                        <p>為維護公平性，開獎過程中系統將鎖定該卡池防止其他使用者併行抽取。若因網路連線中斷或意外關閉視窗，伺服器仍會完整執行開獎並將獲得之卡片派發至您的背包，請至「我的背包/個人中心」查閱結果。</p>
                                                    </section>
                                                    <section className="space-y-1">
                                                        <h4 className="font-bold text-white">四、異常交易處置</h4>
                                                        <p>請避免於短時間內進行異常高頻交易或刷卡，以免被銀行風控系統凍結。如發現任何利用系統漏洞違規操作之行為，本平台有權暫停該帳戶服務。</p>
                                                    </section>
                                                </div>
                                            </ScrollArea>
                                            <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between">
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
                                "w-full h-12 sm:h-14 text-base sm:text-lg font-black rounded-2xl shadow-2xl transition-all border-b-4 active:translate-y-1 active:border-b-0 cursor-pointer",
                                canStart 
                                    ? useTicketMode
                                        ? "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 text-slate-950 border-emerald-800 hover:brightness-110 shadow-emerald-500/30"
                                        : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 border-amber-800 hover:brightness-110 shadow-amber-500/20" 
                                    : "bg-slate-800 text-slate-500 border-slate-950 cursor-not-allowed opacity-60"
                            )}
                            onClick={() => canStart && performDraw(initialDrawCount, useTicketMode)}
                            disabled={!canStart}
                        >
                            {isLoadingStats ? (
                                <><Loader2 className="animate-spin mr-2 h-5 w-5 sm:h-6 sm:w-6" /> 驗證中...</>
                            ) : isLimitReachedForInitial ? (
                                <><Ban className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-rose-400" /> 今日次數已用完</>
                            ) : !isLevelMet ? (
                                <><Ban className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-rose-400" /> 權限不足 ({cardPool.minLevel})</>
                            ) : useTicketMode && !isFreeDrawAllowed ? (
                                <><Ban className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-rose-400" /> 此卡池未開放免費券兌換</>
                            ) : useTicketMode && !hasEnoughTickets ? (
                                <><Ban className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-rose-400" /> 免費抽卡券不足</>
                            ) : useTicketMode ? (
                                <><Ticket className="mr-2 h-5 w-5 sm:h-6 sm:w-6 text-slate-950 fill-slate-950" /> 🎟️ 消耗免費券啟動開獎 (1抽)</>
                            ) : (
                                <><Zap className="mr-2 h-5 w-5 sm:h-6 sm:w-6 fill-slate-950" /> 啟動正式開獎 ({cost.toLocaleString()} {isPPoint ? 'P點' : '鑽'})</>
                            )}
                        </Button>

                        {performTrialDraw && (
                            <Button
                                size="lg"
                                variant="outline"
                                className="w-full h-10 sm:h-11 text-xs sm:text-sm font-black rounded-2xl border-purple-500/50 bg-purple-950/40 text-purple-200 hover:bg-purple-900/60 hover:border-purple-400 shadow-lg shadow-purple-950/40 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                                onClick={() => performTrialDraw(initialDrawCount)}
                            >
                                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-purple-300 animate-pulse" />
                                <span>🎲 免費試手氣（純模擬不扣點）</span>
                            </Button>
                        )}
                    </div>
                </div>

                {/* Return link */}
                <div className="text-center pt-0.5">
                    <Button asChild variant="ghost" className="text-slate-400 hover:text-white font-bold text-xs rounded-xl h-8">
                        <Link href="/draw">
                            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 取消並返回卡池列表
                        </Link>
                    </Button>
                </div>
            </div>
        </div>
    );
}
