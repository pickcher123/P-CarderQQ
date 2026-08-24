'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    Calendar as CalendarIcon,
    Clock,
    MapPin,
    ExternalLink,
    ArrowUpRight,
    Sparkles,
    Info,
    X,
} from 'lucide-react';

interface Exhibition {
    id: string;
    title: string;
    date: { seconds: number };
    endDate?: { seconds: number };
    time?: string;
    location?: string;
    description: string;
    imageUrl?: string;
}

const getFormattedFullDate = (date: Date) => {
    const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const day = days[date.getDay()];
    return `${y}年${m}月${d}日 (${day})`;
};

export function CardExhibitionCalendar({ hideHeader = false }: { hideHeader?: boolean }) {
    const firestore = useFirestore();
    const [selectedExh, setSelectedExh] = useState<Exhibition | null>(null);

    const q = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
    }, [firestore]);

    const { data: exhibitions } = useCollection<Exhibition>(q);

    const exhibitionsByMonth = useMemo(() => {
        if (!exhibitions) return [];
        
        // 取得今日開始時間（當天 00:00:00）的 timestamp
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todaySeconds = Math.floor(startOfToday.getTime() / 1000);

        const groups: Record<string, Exhibition[]> = {};
        exhibitions.forEach(exh => {
            // 如果有結束日期則以結束日期的當日 23:59:59 為準；否則以開始日期的 23:59:59 為準
            const effectiveEndSeconds = exh.endDate?.seconds 
                ? exh.endDate.seconds + 86399 
                : (exh.date.seconds ? exh.date.seconds + 86399 : 0);

            // 過濾掉已經結束的活動 (小於今日開始時間者隱藏)
            if (effectiveEndSeconds < todaySeconds) {
                return;
            }

            const date = new Date(exh.date.seconds * 1000);
            const monthKey = format(date, 'yyyy年MM月');
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push(exh);
        });
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [exhibitions]);

    return (
        <div className={cn("text-white space-y-6 w-full overflow-hidden", !hideHeader && "container py-8")}>
            {!hideHeader && (
                <div className="text-center space-y-2">
                    <h2 className="text-3xl md:text-5xl font-black font-headline tracking-tight">卡展行事曆</h2>
                    <p className="text-xs sm:text-sm text-slate-400">點擊卡片查看展覽詳細資訊與地圖導航</p>
                </div>
            )}
            
            <div className={cn("space-y-6 px-1", !hideHeader ? "max-w-4xl mx-auto" : "w-full")}>
                {exhibitionsByMonth.length > 0 ? (
                    exhibitionsByMonth.map(([month, exhList]) => (
                        <div key={month} className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base sm:text-lg font-black text-cyan-400 tracking-widest uppercase flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4 text-cyan-400" />
                                    {month}
                                </h3>
                                <span className="text-[10px] text-slate-400 font-mono">
                                    共 {exhList.length} 場活動
                                </span>
                            </div>

                            {/* 網格區塊 (Mobile / Desktop 顯示所有展覽) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 px-1">
                                {exhList.map((exh) => {
                                    const startDate = new Date(exh.date.seconds * 1000);
                                    const endDate = exh.endDate ? new Date(exh.endDate.seconds * 1000) : null;
                                    const startStr = format(startDate, 'MM/dd');
                                    const endStr = endDate ? format(endDate, 'MM/dd') : null;

                                    return (
                                        <Card 
                                            key={exh.id} 
                                            onClick={() => setSelectedExh(exh)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' || e.key === ' ') {
                                                    e.preventDefault();
                                                    setSelectedExh(exh);
                                                }
                                            }}
                                            className={cn(
                                                "w-full bg-slate-900/90 border-slate-800 p-4 rounded-2xl transition-all duration-300 ease-out group relative flex flex-col justify-between shadow-lg cursor-pointer overflow-hidden",
                                                "hover:scale-[1.025] hover:-translate-y-0.5 hover:border-cyan-500/50 hover:bg-slate-900 hover:shadow-[0_12px_30px_rgba(6,182,212,0.15)] active:scale-[0.98]"
                                            )}
                                        >
                                            {/* 背景光暈效果 */}
                                            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/15 transition-all duration-300 pointer-events-none" />

                                            <CardContent className="p-0 space-y-3 relative z-10">
                                                {/* 日期標籤 + 查看詳情提示 */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="inline-flex items-center gap-1.5 bg-rose-500/15 border border-rose-500/40 px-3 py-1 rounded-full shrink-0 shadow-sm group-hover:border-rose-400/60 group-hover:bg-rose-500/20 transition-all">
                                                        <span className="text-xs font-black text-rose-400 font-mono tracking-tight">{startStr}</span>
                                                        {endStr && endStr !== startStr && (
                                                            <>
                                                                <span className="text-xs text-rose-400/60 font-mono font-bold">-</span>
                                                                <span className="text-xs font-black text-rose-400 font-mono tracking-tight">{endStr}</span>
                                                            </>
                                                        )}
                                                    </div>

                                                    <span className="text-[11px] font-medium text-cyan-400/80 group-hover:text-cyan-300 flex items-center gap-0.5 transition-colors">
                                                        <span>詳情</span>
                                                        <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                                    </span>
                                                </div>

                                                <div className="space-y-2">
                                                    <h4 className="font-bold text-white text-base leading-snug group-hover:text-cyan-300 transition-colors line-clamp-2">
                                                        {exh.title}
                                                    </h4>

                                                    {(exh.location || exh.time) && (
                                                        <div className="space-y-1.5 py-0.5">
                                                            {exh.location && (
                                                                <div className="flex items-start gap-1.5 text-xs text-slate-300 font-medium">
                                                                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5 group-hover:text-cyan-300 transition-colors" />
                                                                    <span className="break-words line-clamp-1">{exh.location}</span>
                                                                </div>
                                                            )}
                                                            {exh.time && (
                                                                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                                                                    <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0 group-hover:text-cyan-300 transition-colors" />
                                                                    <span>{exh.time}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {exh.description && (
                                                        <p className="text-slate-400 text-xs leading-relaxed line-clamp-2 pt-0.5">
                                                            {exh.description}
                                                        </p>
                                                    )}
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="text-center py-12 bg-slate-900/30 rounded-2xl border border-slate-800">
                        <CalendarIcon className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                        <p className="text-slate-400 font-medium text-sm">目前無卡展活動。</p>
                    </div>
                )}
            </div>

            {/* 簡約活動詳情彈窗 (Minimalist Exhibition Details Dialog) */}
            <Dialog open={!!selectedExh} onOpenChange={(open) => !open && setSelectedExh(null)}>
                <DialogContent className="bg-slate-950/95 backdrop-blur-2xl border-cyan-500/30 text-white rounded-3xl p-5 sm:p-7 max-w-lg w-[92vw] mx-auto shadow-[0_0_60px_rgba(6,182,212,0.2)] focus:outline-none">
                    {selectedExh && (() => {
                        const startDate = new Date(selectedExh.date.seconds * 1000);
                        const endDate = selectedExh.endDate ? new Date(selectedExh.endDate.seconds * 1000) : null;
                        const fullStartStr = getFormattedFullDate(startDate);
                        const fullEndStr = endDate ? getFormattedFullDate(endDate) : null;
                        const isSameDay = !endDate || fullStartStr === fullEndStr;
                        const mapSearchUrl = selectedExh.location 
                            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedExh.location)}`
                            : null;

                        return (
                            <div className="space-y-5">
                                <DialogHeader className="space-y-2.5 text-left border-b border-slate-800/80 pb-4">
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 text-xs font-bold w-fit">
                                        <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                                        <span>卡展活動詳情</span>
                                    </div>
                                    <DialogTitle className="text-lg sm:text-2xl font-black text-white font-headline leading-snug tracking-wide">
                                        {selectedExh.title}
                                    </DialogTitle>
                                </DialogHeader>

                                {/* 若有活動海報 / 圖片 */}
                                {selectedExh.imageUrl && (
                                    <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner">
                                        <img 
                                            src={selectedExh.imageUrl} 
                                            alt={selectedExh.title}
                                            className="w-full h-full object-cover"
                                        />
                                    </div>
                                )}

                                {/* 活動主要資訊清單 */}
                                <div className="space-y-2.5">
                                    {/* 日期區塊 */}
                                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
                                        <div className="p-2 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 shrink-0 mt-0.5">
                                            <CalendarIcon className="w-4 h-4" />
                                        </div>
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <span className="text-[11px] font-bold text-slate-400">活動日期</span>
                                            <div className="text-sm font-bold text-white break-words">
                                                {isSameDay ? (
                                                    <span>{fullStartStr}</span>
                                                ) : (
                                                    <span>{fullStartStr} 至 {fullEndStr}</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 時間區塊 (若有) */}
                                    {selectedExh.time && (
                                        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
                                            <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shrink-0 mt-0.5">
                                                <Clock className="w-4 h-4" />
                                            </div>
                                            <div className="space-y-0.5 flex-1 min-w-0">
                                                <span className="text-[11px] font-bold text-slate-400">開放時間</span>
                                                <div className="text-sm font-bold text-white break-words">
                                                    {selectedExh.time}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 地點區塊與導航 (若有) */}
                                    {selectedExh.location && (
                                        <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-slate-900/70 border border-slate-800/80">
                                            <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0 mt-0.5">
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <div className="space-y-1.5 flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-[11px] font-bold text-slate-400">活動地點</span>
                                                    {mapSearchUrl && (
                                                        <a
                                                            href={mapSearchUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:underline transition-colors"
                                                        >
                                                            <span>開啟 Google 地圖</span>
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                                <div className="text-sm font-bold text-white break-words">
                                                    {selectedExh.location}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 活動內容說明 (若有) */}
                                {selectedExh.description && (
                                    <div className="space-y-2 p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
                                            <Info className="w-3.5 h-3.5 text-cyan-400" />
                                            <span>活動說明</span>
                                        </div>
                                        <div className="text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap break-words max-h-48 overflow-y-auto pr-1">
                                            {selectedExh.description}
                                        </div>
                                    </div>
                                )}

                                {/* 底部操作按鈕 */}
                                <div className="flex items-center gap-2.5 pt-2">
                                    {mapSearchUrl && (
                                        <Button
                                            asChild
                                            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-xl h-11 shadow-lg shadow-cyan-500/20 text-xs sm:text-sm transition-all"
                                        >
                                            <a href={mapSearchUrl} target="_blank" rel="noopener noreferrer">
                                                <MapPin className="w-4 h-4 mr-1.5" />
                                                導航至活動地點
                                                <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-70" />
                                            </a>
                                        </Button>
                                    )}
                                    <DialogClose asChild>
                                        <Button
                                            variant="outline"
                                            className={cn(
                                                "border-slate-700 bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-xl h-11 text-xs sm:text-sm px-5",
                                                !mapSearchUrl && "w-full"
                                            )}
                                        >
                                            關閉
                                        </Button>
                                    </DialogClose>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}


