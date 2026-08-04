'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';

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

export function CardExhibitionCalendar({ hideHeader = false }: { hideHeader?: boolean }) {
    const firestore = useFirestore();

    const q = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
    }, [firestore]);

    const { data: exhibitions } = useCollection<Exhibition>(q);

    const exhibitionsByMonth = useMemo(() => {
        if (!exhibitions) return [];
        const groups: Record<string, Exhibition[]> = {};
        exhibitions.forEach(exh => {
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
                    <p className="text-xs sm:text-sm text-slate-400">左右滑動卡片查看最新全台卡片展覽與交流會</p>
                </div>
            )}
            
            <div className="max-w-4xl mx-auto space-y-8 px-1">
                {exhibitionsByMonth.length > 0 ? (
                    exhibitionsByMonth.map(([month, exhList]) => (
                        <div key={month} className="space-y-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-base sm:text-lg font-black text-cyan-400 tracking-widest uppercase flex items-center gap-2">
                                    <CalendarIcon className="w-4 h-4 text-cyan-400" />
                                    {month}
                                </h3>
                            </div>

                            {/* 網格區塊 (Mobile / Desktop 顯示所有展覽) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 px-1">
                                {exhList.map((exh) => {
                                    const startDate = new Date(exh.date.seconds * 1000);
                                    const endDate = exh.endDate ? new Date(exh.endDate.seconds * 1000) : null;
                                    const startStr = format(startDate, 'MM/dd');
                                    const endStr = endDate ? format(endDate, 'MM/dd') : null;

                                    return (
                                        <Card 
                                            key={exh.id} 
                                            className={cn(
                                                "w-full bg-slate-900/90 border-slate-800 p-4 rounded-2xl hover:border-slate-700 transition-all duration-200 group relative flex flex-col justify-between shadow-lg"
                                            )}
                                        >
                                            <CardContent className="p-0 space-y-3">
                                                {/* 日期標籤 (紅色圓角橫向顯示) */}
                                                <div className="flex items-center justify-between gap-2">
                                                    <div className="inline-flex items-center gap-1.5 bg-rose-500/15 border border-rose-500/40 px-3 py-1 rounded-full shrink-0 shadow-sm">
                                                        <span className="text-xs font-black text-rose-400 font-mono tracking-tight">{startStr}</span>
                                                        {endStr && endStr !== startStr && (
                                                            <>
                                                                <span className="text-xs text-rose-400/60 font-mono font-bold">-</span>
                                                                <span className="text-xs font-black text-rose-400 font-mono tracking-tight">{endStr}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <h4 className="font-bold text-white text-base leading-snug group-hover:text-cyan-300 transition-colors">
                                                        {exh.title}
                                                    </h4>

                                                    {(exh.location || exh.time) && (
                                                        <div className="space-y-1.5 py-0.5">
                                                            {exh.location && (
                                                                <div className="flex items-start gap-1.5 text-xs text-slate-300 font-medium">
                                                                    <MapPin className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                                                                    <span className="break-words">{exh.location}</span>
                                                                </div>
                                                            )}
                                                            {exh.time && (
                                                                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-medium">
                                                                    <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                                    <span>{exh.time}</span>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {exh.description && (
                                                        <p className="text-slate-400 text-xs leading-relaxed whitespace-pre-wrap break-words pt-1">
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
        </div>
    );
}

