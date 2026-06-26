'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Exhibition {
    id: string;
    title: string;
    date: { seconds: number };
    description: string;
}

export function CardExhibitionCalendar() {
    const firestore = useFirestore();
    const q = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
    }, [firestore]);

    const { data: exhibitions, isLoading } = useCollection<Exhibition>(q);

    if (isLoading || !exhibitions || exhibitions.length === 0) return null;

    return (
        <section className="container py-12 md:py-20 text-white">
            <h2 className="text-3xl md:text-5xl font-black font-headline tracking-tight text-center mb-12">卡展行事曆</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exhibitions.map((exh) => (
                    <Card key={exh.id} className="bg-card/40 border-white/5 p-6 rounded-3xl hover:border-primary/50 transition-all">
                        <CardContent className="p-0 space-y-4">
                            <div className="flex items-center gap-2 text-primary font-bold">
                                <Calendar className="w-5 h-5" />
                                {format(new Date(exh.date.seconds * 1000), 'yyyy-MM-dd')}
                            </div>
                            <h3 className="text-2xl font-black">{exh.title}</h3>
                            <p className="text-muted-foreground line-clamp-3">{exh.description}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </section>
    );
}
