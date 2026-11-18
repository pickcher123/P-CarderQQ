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
import { PromoRedeemModal } from '@/components/events/PromoRedeemModal';
import { getEffectiveTicketCount } from '@/lib/promo-draw-service';
import { BeginnerGuideDialog } from '@/components/beginner-guide-dialog';
import { ProvablyFairDialog } from '@/components/provably-fair-dialog';

export function PackPreview({
    cardPool,
    initialDrawCount,
    isLevelMet,
    isLimitReachedForInitial,
    isLoadingStats,
    performDraw,
    performTrialDraw,
    isUsingTicket = false,
    isUsingEventTicket = false,
    eventPoolTickets = 0,
    freeDrawTickets = 0,
    onOpenPickNumber,
    selectedNumbers
}: {
    cardPool: CardPool,
    initialDrawCount: number,
    isLevelMet: boolean,
    isLimitReachedForInitial: boolean,
    isLoadingStats: boolean,
    performDraw: (_count: number, _forceUseTicket?: boolean, _forceUseEventTicket?: boolean, _selectedNumbers?: number[]) => void,
    performTrialDraw?: (_count: number, _selectedNumbers?: number[]) => void,
    isUsingTicket?: boolean,
    isUsingEventTicket?: boolean,
    eventPoolTickets?: number,
    freeDrawTickets?: number,
    onOpenPickNumber?: () => void,
    selectedNumbers?: number[]
}) {
    const [useTicketMode, setUseTicketMode] = useState<boolean>(isUsingTicket);
    const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
    const [localRefresh, setLocalRefresh] = useState(0);

    const isEventExclusive = !!(cardPool.isEventPool && cardPool.exclusiveTicketOnly);
    const isEventMode = isUsingEventTicket || isEventExclusive;

    const remainingPacks = cardPool.remainingPacks ?? 0;
    const requestedCount = (selectedNumbers && selectedNumbers.length > 0) ? selectedNumbers.length : initialDrawCount;
    // 如果剩餘包數小於請求抽數 (例如剩餘5包但URL帶了draws=10)，自動調整為剩餘全部包數 (全包)
    const countToDraw = (remainingPacks > 0 && remainingPacks < requestedCount) ? remainingPacks : requestedCount;
    const isAutoAdjusted = remainingPacks > 0 && remainingPacks < requestedCount;
    const effectiveTickets = Math.max(freeDrawTickets, getEffectiveTicketCount());
    const actualDrawCount = isEventMode ? countToDraw : (useTicketMode ? 1 : countToDraw);

    const isSoldOut = remainingPacks <= 0;
    const isOverPacks = remainingPacks > 0 && actualDrawCount > remainingPacks;

    const isPPoint = cardPool.currency === 'p-point';
    const cost = (isEventMode || useTicketMode) ? 0 : (actualDrawCount === 3 && cardPool.price3Draws ? cardPool.price3Draws : (cardPool.price || 0) * actualDrawCount);
    const isFreeDrawAllowed = isEventMode ? true : (!useTicketMode || cardPool.allowFreeDraw !== false);
    const hasEnoughTickets = isEventMode 
        ? eventPoolTickets >= actualDrawCount 
        : (!useTicketMode || effectiveTickets >= 1);
    const canStart = !isSoldOut && !isOverPacks && isLevelMet && !isLimitReachedForInitial && !isLoadingStats && hasEnoughTickets && isFreeDrawAllowed;

    const canToggleTicket = !isEventMode && cardPool.allowFreeDraw !== false;

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[420px] mx-auto py-3 sm:py-4 px-3 select-none relative my-auto">
            {/* Background ambient glow */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none -z-10">
                <div className="w-64 h-64 bg-amber-400/10 rounded-full blur-3xl" />
            </div>

            <div className="w-full space-y-3 animate-fade-in-up my-auto">
                {/* Main Card Container */}
                <div className="relative p-4 sm:p-5 bg-[#0a0f1c]/95 backdrop-blur-2xl border border-white/[0.1] border-t-2 border-t-amber-300/65 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.88)] overflow-hidden space-y-3.5">
                    {/* Top Glow */}
                    <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-56 h-20 bg-amber-400/10 blur-2xl pointer-events-none" />

                    {/* Header */}
                    <div className="relative z-10 text-center space-y-1.5">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.08]">
                            <Logo className="scale-70 opacity-95" asStatic />
                            <span className="h-3 w-px bg-white/15" />
                            <span className="text-[10px] font-bold tracking-widest text-[#FDE68A] uppercase">開獎確認</span>
                        </div>
                        
                        <h2 className="text-lg sm:text-xl font-headline font-bold text-white tracking-wide line-clamp-1 px-1">
                            {cardPool.name}
                        </h2>
                    </div>

                    {/* 活動限定專屬券專用指示區塊 */}
                    {isEventMode ? (
                        <div className="relative z-10 p-3 rounded-xl bg-white/[0.03] border border-amber-300/30 text-left space-y-1.5">
                            <div className="flex items-center justify-between flex-wrap gap-1.5">
                                <span className="text-xs font-bold text-[#FDE68A] flex items-center gap-1.5">
                                    <Ticket className="w-3.5 h-3.5 text-amber-300" />
                                    <span>【{cardPool.eventTicketName || '專屬活動抽卡券'}】</span>
                                </span>
                                <span className={cn(
                                    "font-mono font-bold text-[11px] px-2.5 py-0.5 rounded-full border tabular-nums",
                                    eventPoolTickets >= actualDrawCount
                                        ? "bg-amber-400/15 border-amber-300/40 text-[#FDE68A]"
                                        : "bg-rose-500/15 border-rose-400/40 text-rose-300"
                                )}>
                                    持有 {eventPoolTickets} 張（需 {actualDrawCount} 張）
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 leading-snug">
                                此為專屬限定活動卡池，僅限使用管理員審核派發之專屬抽卡券。
                            </p>
                            {cardPool.eventRules && (
                                <p className="text-[11px] text-slate-300 leading-snug pt-1.5 border-t border-white/[0.08]">
                                    <span className="font-bold text-amber-300">活動規則：</span>{cardPool.eventRules}
                                </p>
                            )}
                        </div>
                    ) : canToggleTicket ? (
                        /* 🎟️ 免費券使用詢問與切換區塊 */
                        <div className="relative z-10 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08] space-y-2.5">
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                                    <Ticket className="w-3.5 h-3.5 text-amber-300" />
                                    <span>活動免費抽卡券</span>
                                </span>
                                <div className="flex items-center gap-1.5">
                                    <span className={cn(
                                        "font-mono font-bold text-[11px] px-2.5 py-0.5 rounded-full border tabular-nums",
                                        effectiveTickets > 0
                                            ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/35"
                                            : "bg-white/[0.04] text-slate-400 border-white/[0.08]"
                                    )}>
                                        {effectiveTickets} 張可用
                                    </span>
                                    {effectiveTickets === 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setIsPromoModalOpen(true)}
                                            className="text-[11px] font-bold text-[#FDE68A] hover:text-amber-200 underline underline-offset-2 cursor-pointer"
                                        >
                                            去領券
                                        </button>
                                    )}
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-1.5 p-1 bg-black/40 rounded-xl border border-white/[0.08]">
                                <button
                                    type="button"
                                    onClick={() => setUseTicketMode(true)}
                                    className={cn(
                                        "py-2 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border",
                                        useTicketMode 
                                            ? "bg-emerald-400/15 text-emerald-300 border-emerald-400/45 shadow-sm" 
                                            : "text-slate-400 hover:text-slate-200 border-transparent"
                                    )}
                                >
                                    {useTicketMode && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                                    <Ticket className="w-3.5 h-3.5 shrink-0" />
                                    <span>免費券 (0 點)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setUseTicketMode(false)}
                                    className={cn(
                                        "py-2 px-2 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer border",
                                        !useTicketMode 
                                            ? "bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border-amber-200/70 shadow-sm" 
                                            : "text-slate-400 hover:text-slate-200 border-transparent"
                                    )}
                                >
                                    {!useTicketMode && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                    {isPPoint ? (
                                        <span className="inline-flex items-center gap-1">
                                            <PPlusIcon className={cn("w-3.5 h-3.5", !useTicketMode ? "text-[#120d02]" : "text-amber-300")} />
                                            <span>P點扣點</span>
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1">
                                            <DiamondIcon className={cn("w-3.5 h-3.5", !useTicketMode ? "text-[#120d02]" : "text-cyan-300")} />
                                            <span>鑽石扣點</span>
                                        </span>
                                    )}
                                </button>
                            </div>
                        </div>
                    ) : null}

                    {/* Stats Grid */}
                    <div className="relative z-10 grid grid-cols-2 gap-2.5">
                        <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.08] text-center space-y-1">
                            <span className="text-[11px] text-slate-400 font-medium block">本次抽數</span>
                            <div className="flex items-center justify-center gap-1.5">
                                <span className="text-base sm:text-lg font-black text-white font-code tabular-nums">{actualDrawCount} 包</span>
                                {isAutoAdjusted && (
                                    <span className="text-[10px] bg-amber-400/15 text-[#FDE68A] border border-amber-300/35 px-1.5 py-0.5 rounded-full font-bold">
                                        全包
                                    </span>
                                )}
                            </div>
                        </div>
                        <div className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.08] text-center space-y-1">
                            <span className="text-[11px] text-slate-400 font-medium block">花費金額</span>
                            <div className="flex items-center justify-center gap-1.5 text-base sm:text-lg font-black text-[#FDE68A] font-code tabular-nums">
                                {isEventMode ? (
                                    <span className="text-[#FDE68A] font-bold text-xs flex items-center gap-1">
                                        <Ticket className="w-3.5 h-3.5 text-amber-300" /> 0 點 ({actualDrawCount}張券)
                                    </span>
                                ) : useTicketMode ? (
                                    <span className="text-emerald-300 font-bold text-xs flex items-center gap-1">
                                        <Ticket className="w-3.5 h-3.5 text-emerald-400" /> 0 點 (1張券)
                                    </span>
                                ) : isPPoint ? (
                                    <><PPlusIcon className="w-4 h-4 text-amber-300 shrink-0" /><span>{cost.toLocaleString()} P</span></>
                                ) : (
                                    <><DiamondIcon className="w-4 h-4 text-cyan-300 shrink-0" /><span className="text-white">{cost.toLocaleString()}</span></>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Level requirement if any */}
                    {cardPool.minLevel && cardPool.minLevel !== '新手收藏家' && (
                        <div className={cn(
                            "p-1.5 rounded-lg border flex items-center justify-center gap-1.5 font-black text-[11px]",
                            isLevelMet ? "bg-emerald-950/40 border-emerald-800/60 text-emerald-400" : "bg-rose-950/40 border-rose-800/60 text-rose-400"
                        )}>
                            <ShieldCheck className="w-3 h-3 shrink-0" />
                            <span>等級限制: {cardPool.minLevel}</span>
                        </div>
                    )}

                    {/* Terms Notice - 精簡俐落單排條款說明，保留彈窗完整條款 */}
                    <div className="relative z-10 p-3 rounded-xl border border-white/[0.08] bg-white/[0.025] space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                            <span className="text-amber-300 font-bold flex items-center gap-1.5">
                                <Info className="w-3.5 h-3.5 shrink-0" /> 購買條款告知
                            </span>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <button className="text-[#FDE68A] hover:text-amber-200 font-semibold underline decoration-amber-300/40 underline-offset-2 inline-flex items-center gap-0.5 cursor-pointer text-[11px]">
                                        《平台服務與拆卡條款》
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="max-w-md bg-[#0a0f1c] border-white/[0.1] border-t-2 border-t-amber-300/65 text-slate-200 rounded-2xl">
                                    <DialogHeader>
                                        <DialogTitle className="text-base font-bold text-[#FDE68A] flex items-center gap-1.5">
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
                                    <div className="mt-3 pt-3 border-t border-white/[0.08] flex items-center justify-between">
                                        <Link 
                                            href="/about" 
                                            target="_blank" 
                                            className="text-[#FDE68A] hover:text-amber-200 font-bold text-xs flex items-center gap-1 transition-colors"
                                        >
                                            <FileText className="w-3.5 h-3.5" /> 前往「關於我們」查看完整條款頁面 <ChevronRight className="w-3 h-3" />
                                        </Link>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                            本商品屬數位機率型抽選內容，啟動開獎即視為您已閱讀並同意條款。
                        </p>
                    </div>

                    {/* 🎯 已選一番賞號碼展示卡片 */}
                    {selectedNumbers && selectedNumbers.length > 0 && (
                        <div className="relative z-10 p-3 rounded-xl bg-amber-400/[0.08] border border-amber-300/40 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-[#FDE68A] font-black text-xs shrink-0">
                                    #
                                </div>
                                <div className="min-w-0">
                                    <div className="text-[10px] text-[#FDE68A] font-bold tracking-wider">已鎖定自選號碼</div>
                                    <div className="flex flex-wrap gap-1 mt-1 max-h-12 overflow-y-auto">
                                        {selectedNumbers.map(n => (
                                            <span key={n} className="bg-gradient-to-r from-[#FDE68A] to-amber-400 text-[#120d02] font-black text-[11px] px-1.5 py-0.5 rounded tabular-nums">
                                                #{n}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                            {onOpenPickNumber && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={onOpenPickNumber}
                                    className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-amber-300/40 text-[#FDE68A] hover:bg-amber-400/15 cursor-pointer shrink-0"
                                >
                                    更換號碼
                                </Button>
                            )}
                        </div>
                    )}

                    {/* CTA Action Buttons */}
                    <div className="relative z-10 space-y-2 pt-0.5">
                        {!isEventMode && useTicketMode && !hasEnoughTickets && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setIsPromoModalOpen(true)}
                                className="w-full h-10 text-xs font-bold rounded-xl border-emerald-400/45 bg-emerald-400/10 text-emerald-300 hover:bg-emerald-400/20 flex items-center justify-center gap-1.5 cursor-pointer"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                <span>點此免費領取 1 抽活動券</span>
                            </Button>
                        )}

                        {/* 🎯 一番賞自選號碼模式（未選號時點擊開啟挑籤，亦可一鍵隨機直接開獎） */}
                        {onOpenPickNumber && !isEventMode && (!selectedNumbers || selectedNumbers.length === 0) ? (
                            <div className="space-y-1.5">
                                <Button
                                    size="lg"
                                    className="w-full h-12 text-sm sm:text-base font-black rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 hover:from-[#FEF08A] hover:to-amber-300 text-[#120d02] shadow-[0_8px_28px_rgba(251,191,36,0.28)] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98]"
                                    onClick={onOpenPickNumber}
                                    disabled={!isLevelMet || isLoadingStats || isSoldOut || isOverPacks}
                                >
                                    <span>自選號碼開獎</span>
                                </Button>

                                <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="w-full h-7 text-[11px] text-slate-400 hover:text-[#FDE68A] font-semibold hover:bg-white/[0.04] rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                    onClick={() => {
                                        if (canStart) {
                                            performDraw(actualDrawCount, !isEventMode && useTicketMode, isEventMode, undefined);
                                        }
                                    }}
                                    disabled={!canStart}
                                >
                                    <span>或直接開獎 (由系統隨機出籤)</span>
                                </Button>
                            </div>
                        ) : (
                            <Button
                                size="lg"
                                className={cn(
                                    "w-full h-12 text-sm sm:text-base font-black rounded-xl transition-all active:scale-[0.98] cursor-pointer tabular-nums",
                                    canStart 
                                        ? isEventMode
                                            ? "bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] shadow-[0_8px_28px_rgba(251,191,36,0.28)] hover:brightness-105"
                                            : useTicketMode
                                                ? "bg-gradient-to-r from-emerald-400 to-teal-400 text-[#051b14] shadow-[0_8px_24px_rgba(16,185,129,0.25)] hover:brightness-105"
                                                : "bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] shadow-[0_8px_28px_rgba(251,191,36,0.28)] hover:brightness-105" 
                                        : "bg-white/[0.06] text-slate-500 border border-white/[0.08] cursor-not-allowed"
                                )}
                                onClick={() => {
                                    if (!isEventMode && useTicketMode && !hasEnoughTickets) {
                                        setIsPromoModalOpen(true);
                                        return;
                                    }
                                    if (canStart) {
                                        performDraw(actualDrawCount, !isEventMode && useTicketMode, isEventMode, selectedNumbers);
                                    }
                                }}
                                disabled={!canStart && (isEventMode ? true : (!useTicketMode || hasEnoughTickets))}
                            >
                                {isLoadingStats ? (
                                    <><Loader2 className="animate-spin mr-2 h-4 w-4" /> 驗證中...</>
                                ) : isSoldOut ? (
                                    <><Ban className="mr-2 h-4 w-4 text-rose-400" /> 此卡池已售罄</>
                                ) : isOverPacks ? (
                                    <><Ban className="mr-2 h-4 w-4 text-rose-400" /> 庫存不足 (剩餘 {remainingPacks} 包)</>
                                ) : isLimitReachedForInitial ? (
                                    <><Ban className="mr-2 h-4 w-4 text-rose-400" /> 今日次數已用完</>
                                ) : !isLevelMet ? (
                                    <><Ban className="mr-2 h-4 w-4 text-rose-400" /> 權限不足 ({cardPool.minLevel})</>
                                ) : isEventMode && !hasEnoughTickets ? (
                                    <><Ban className="mr-2 h-4 w-4 text-rose-400" /> 專屬券不足 (持有 {eventPoolTickets} 張 / 需 {actualDrawCount} 張)</>
                                ) : isEventMode ? (
                                    <><Ticket className="mr-2 h-4 w-4 text-[#120d02]" /> 消耗專屬券啟動開獎 ({actualDrawCount} 抽)</>
                                ) : useTicketMode && !isFreeDrawAllowed ? (
                                    <><Ban className="mr-2 h-4 w-4 text-rose-400" /> 此卡池未開放免費券兌換</>
                                ) : useTicketMode && !hasEnoughTickets ? (
                                    <><Ticket className="mr-2 h-4 w-4 text-amber-300" /> 尚未領取免費券（點此領取）</>
                                ) : useTicketMode ? (
                                    <><Ticket className="mr-2 h-4 w-4 text-[#051b14]" /> 消耗免費券啟動開獎 (1抽)</>
                                ) : selectedNumbers && selectedNumbers.length > 0 ? (
                                    <><Zap className="mr-2 h-4 w-4 fill-[#120d02]" /> 啟動自選開獎 ({selectedNumbers.map(n => '#' + n).join(', ')})</>
                                ) : (
                                    <><Zap className="mr-2 h-4 w-4 fill-[#120d02]" /> 啟動正式開獎 ({cost.toLocaleString()} {isPPoint ? 'P點' : '鑽'})</>
                                )}
                            </Button>
                        )}
                    </div>
                </div>

                {/* 第一次玩教學 & 公平驗證 & 取消 */}
                <div className="flex flex-wrap items-center justify-center gap-2 pt-0.5">
                    <BeginnerGuideDialog
                        triggerVariant="compact"
                        buttonText="新手開獎須知"
                        triggerClassName="h-8 text-[11px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] hover:border-amber-300/35 text-amber-200 rounded-xl"
                    />
                    <ProvablyFairDialog
                        variant="button"
                        trigger={
                            <button
                                type="button"
                                className="h-8 px-3 rounded-xl border border-white/[0.08] hover:border-emerald-400/40 text-emerald-300 bg-white/[0.04] hover:bg-emerald-400/10 text-[11px] font-semibold inline-flex items-center gap-1.5 transition-all cursor-pointer"
                            >
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                                <span>公平驗證</span>
                            </button>
                        }
                    />
                    <Button asChild variant="ghost" className="h-8 px-3 text-slate-400 hover:text-white bg-white/[0.03] hover:bg-white/[0.08] border border-white/[0.08] font-semibold text-[11px] rounded-xl">
                        <Link href="/draw">
                            <ArrowLeft className="w-3.5 h-3.5 mr-1" /> 取消
                        </Link>
                    </Button>
                </div>
            </div>

            {/* 活動兌換券領取彈窗 */}
            <PromoRedeemModal 
                open={isPromoModalOpen} 
                onOpenChange={(open) => {
                    setIsPromoModalOpen(open);
                    if (!open) {
                        setLocalRefresh(prev => prev + 1);
                    }
                }} 
            />
        </div>
    );
}
