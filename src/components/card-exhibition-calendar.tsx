'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Exhibition {
    id: string;
    title: string;
    date: { seconds: number };
    description: string;
}

export function CardExhibitionCalendar({ hideHeader = false }: { hideHeader?: boolean }) {
    const firestore = useFirestore();
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());

    const q = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
    }, [firestore]);

    const { data: exhibitions } = useCollection<Exhibition>(q);

    const days = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
        return eachDayOfInterval({ start, end });
    }, [currentMonth]);

    const exhibitionsByDate = useMemo(() => {
        if (!exhibitions) return {};
        return exhibitions.reduce((acc, exh) => {
            const dateStr = format(new Date(exh.date.seconds * 1000), 'yyyy-MM-dd');
            if (!acc[dateStr]) acc[dateStr] = [];
            acc[dateStr].push(exh);
            return acc;
        }, {} as Record<string, Exhibition[]>);
    }, [exhibitions]);

    const selectedExhibitions = useMemo(() => {
        return exhibitionsByDate[format(selectedDate, 'yyyy-MM-dd')] || [];
    }, [exhibitionsByDate, selectedDate]);

    return (
        <div className={cn("text-white space-y-6", !hideHeader && "container py-8")}>
            {!hideHeader && <h2 className="text-3xl md:text-5xl font-black font-headline tracking-tight text-center">卡展行事曆</h2>}
            
            <div className="bg-card/20 p-4 rounded-3xl border border-white/10 max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <Button variant="ghost" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft /></Button>
                    <h3 className="text-xl font-bold">{format(currentMonth, 'yyyy年 MM月')}</h3>
                    <Button variant="ghost" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight /></Button>
                </div>

                <div className="grid grid-cols-7 gap-1 text-center text-xs font-bold text-muted-foreground mb-2">
                    {['一', '二', '三', '四', '五', '六', '日'].map(day => <div key={day}>{day}</div>)}
                </div>

                <div className="grid grid-cols-7 gap-1">
                    {days.map((day, idx) => {
                        const dateStr = format(day, 'yyyy-MM-dd');
                        const hasExhibition = exhibitionsByDate[dateStr];
                        const isSelected = isSameDay(day, selectedDate);
                        
                        return (
                            <button
                                key={idx}
                                onClick={() => setSelectedDate(day)}
                                className={cn(
                                    "h-16 md:h-24 p-1 border rounded-lg transition-all text-left flex flex-col items-start gap-1",
                                    !isSameMonth(day, currentMonth) ? "opacity-30" : "opacity-100",
                                    isSelected ? "border-primary bg-primary/10" : "border-white/5 bg-black/20 hover:bg-white/5"
                                )}
                            >
                                <span className={cn("text-xs font-bold", isSelected ? "text-primary" : "text-white")}>{format(day, 'd')}</span>
                                {hasExhibition && (
                                    <div className="w-full h-1 bg-primary rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="max-w-3xl mx-auto space-y-4">
                <h3 className="text-lg font-bold">
                    {format(selectedDate, 'yyyy年MM月dd日')} 的活動
                </h3>
                {selectedExhibitions.length > 0 ? (
                    selectedExhibitions.map((exh) => (
                        <Card key={exh.id} className="bg-card/40 border-white/5 p-4 rounded-2xl">
                            <CardContent className="p-0 space-y-1">
                                <h4 className="font-black text-primary">{exh.title}</h4>
                                <p className="text-muted-foreground text-sm">{exh.description}</p>
                            </CardContent>
                        </Card>
                    ))
                ) : (
                    <p className="text-muted-foreground text-sm">當日無卡展活動。</p>
                )}
            </div>
        </div>
    );
}
