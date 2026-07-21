'use client';

import { useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import Image from 'next/image';

interface Exhibition {
    id: string;
    title: string;
    date: { seconds: number };
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
        <div className={cn("text-white space-y-6", !hideHeader && "container py-8")}>
            {!hideHeader && <h2 className="text-3xl md:text-5xl font-black font-headline tracking-tight text-center">卡展行事曆</h2>}
            
            <div className="max-w-3xl mx-auto space-y-8">
                {exhibitionsByMonth.length > 0 ? (
                    exhibitionsByMonth.map(([month, exhList]) => (
                        <div key={month} className="space-y-4">
                            <h3 className="text-xl font-black text-primary tracking-widest uppercase">{month}</h3>
                            <div className="space-y-3">
                                {exhList.map((exh) => {
                                    const date = new Date(exh.date.seconds * 1000);
                                    return (
                                        <Card key={exh.id} className="bg-card/40 border-white/5 p-4 rounded-2xl">
                                            <CardContent className="p-0 flex items-start gap-4">
                                                {exh.imageUrl && (
                                                    <div className="relative w-24 h-24 shrink-0 rounded-xl overflow-hidden">
                                                        <Image src={exh.imageUrl} alt={exh.title} fill className="object-cover" referrerPolicy="no-referrer" />
                                                    </div>
                                                )}
                                                <div className="flex flex-col items-center justify-center bg-primary/10 p-3 rounded-xl min-w-[4rem]">
                                                    <span className="text-sm font-bold text-primary">{format(date, 'MM月')}</span>
                                                    <span className="text-xl font-black text-white">{format(date, 'dd日')}</span>
                                                </div>
                                                <div className="space-y-1">
                                                    <h4 className="font-black text-white text-lg">{exh.title}</h4>
                                                    <p className="text-muted-foreground text-sm">{exh.description}</p>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                ) : (
                    <p className="text-muted-foreground text-center py-10">目前無卡展活動。</p>
                )}
            </div>
        </div>
    );
}
