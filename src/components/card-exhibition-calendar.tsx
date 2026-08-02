'use client';

import { useMemo, useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Calendar as CalendarIcon, MapPin, Clock, Info, ChevronRight, Sparkles } from 'lucide-react';
import Image from 'next/image';

interface Exhibition {
    id: string;
    title: string;
    date: { seconds: number };
    endDate?: { seconds: number };
    description: string;
    imageUrl?: string;
    location?: string;
}

export function CardExhibitionCalendar({ hideHeader = false }: { hideHeader?: boolean }) {
    const firestore = useFirestore();
    const [selectedExhibition, setSelectedExhibition] = useState<Exhibition | null>(null);

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
                                <span className="text-[11px] text-slate-400 flex items-center gap-1 sm:hidden">
                                    👈 左右滑動
                                </span>
                            </div>

                            {/* 橫向滑動區塊 (Mobile / Desktop 支援左右滑動與點擊細項) */}
                            <div className="flex gap-3 overflow-x-auto pb-3 pt-1 px-1 scrollbar-thin scrollbar-thumb-cyan-500/20 snap-x snap-mandatory -mx-1 sm:mx-0">
                                {exhList.map((exh) => {
                                    const startDate = new Date(exh.date.seconds * 1000);
                                    const endDate = exh.endDate ? new Date(exh.endDate.seconds * 1000) : null;
                                    return (
                                        <Card 
                                            key={exh.id} 
                                            onClick={() => setSelectedExhibition(exh)}
                                            className={cn(
                                                "shrink-0 w-[280px] sm:w-[320px] snap-start bg-slate-900/90 border-slate-800 hover:border-cyan-500/50 p-4 rounded-2xl cursor-pointer hover:bg-slate-800/80 transition-all duration-200 group relative flex flex-col justify-between shadow-lg"
                                            )}
                                        >
                                            <CardContent className="p-0 space-y-3">
                                                <div className="flex items-start justify-between gap-2">
                                                    <div className="flex flex-col items-center justify-center bg-cyan-500/10 border border-cyan-500/20 px-3 py-1.5 rounded-xl shrink-0">
                                                        <span className="text-xs font-black text-cyan-400 font-mono">{format(startDate, 'MM/dd')}</span>
                                                        {endDate && (
                                                            <>
                                                                <span className="text-[9px] text-slate-500 line-clamp-1">-</span>
                                                                <span className="text-xs font-black text-cyan-400 font-mono">{format(endDate, 'MM/dd')}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 border border-cyan-800 px-2 py-0.5 rounded-full flex items-center gap-1 group-hover:bg-cyan-500 group-hover:text-black transition-colors">
                                                        細項資訊 <ChevronRight className="w-3 h-3" />
                                                    </span>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <h4 className="font-bold text-white text-base leading-snug group-hover:text-cyan-300 transition-colors line-clamp-2">
                                                        {exh.title}
                                                    </h4>
                                                    <p className="text-slate-400 text-xs leading-relaxed line-clamp-3 break-words">
                                                        {exh.description || '點擊查看完整展覽地點與詳細活動規範。'}
                                                    </p>
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

            {/* 卡展詳細資訊 Pop-up Modal */}
            <Dialog open={!!selectedExhibition} onOpenChange={(open) => !open && setSelectedExhibition(null)}>
                <DialogContent className="bg-slate-950 border-cyan-500/30 text-white rounded-[2rem] p-6 max-w-lg w-11/12 mx-auto shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                    <DialogHeader className="space-y-2 text-left border-b border-slate-800 pb-4">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-bold w-fit">
                            <Sparkles className="w-3.5 h-3.5" /> 全台特選卡展活動
                        </div>
                        <DialogTitle className="text-xl sm:text-2xl font-black text-white leading-snug">
                            {selectedExhibition?.title}
                        </DialogTitle>
                        <DialogDescription className="text-cyan-400 text-xs font-mono font-bold flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {selectedExhibition && format(new Date(selectedExhibition.date.seconds * 1000), 'yyyy/MM/dd')}
                            {selectedExhibition?.endDate && ` ~ ${format(new Date(selectedExhibition.endDate.seconds * 1000), 'yyyy/MM/dd')}`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {selectedExhibition?.imageUrl && (
                            <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                                <Image 
                                    src={selectedExhibition.imageUrl} 
                                    alt={selectedExhibition.title} 
                                    fill 
                                    className="object-cover" 
                                />
                            </div>
                        )}

                        <div className="space-y-2 bg-slate-900/80 p-4 rounded-xl border border-slate-800/80">
                            <div className="flex items-start gap-2 text-xs text-slate-300">
                                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <span className="font-bold text-white block">活動詳細內容：</span>
                                    <p className="text-slate-300 text-xs leading-relaxed whitespace-pre-wrap break-words">
                                        {selectedExhibition?.description || '暫無額外備註說明。'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

