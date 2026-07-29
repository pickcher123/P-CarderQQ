'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useAuth, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Clock, Target, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PredictionSection() {
    const db = useFirestore();
    const auth = useAuth();
    const eventsCollection = useMemoFirebase(() => collection(db, 'predictionEvents'), [db]);
    const { data: events, isLoading } = useCollection(eventsCollection);
    const predictionsCollection = useMemoFirebase(() => collection(db, 'userPredictions'), [db]);

    const [predictions, setPredictions] = useState<Record<string, string>>({});

    const handlePredict = async (eventId: string, option: string) => {
        if (!auth.currentUser) return;
        
        try {
            await addDoc(predictionsCollection, {
                userId: auth.currentUser.uid,
                eventId,
                option,
                timestamp: serverTimestamp()
            });
            
            setPredictions(prev => ({ ...prev, [eventId]: option }));
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <section className="py-12 md:py-16 container px-4 relative">
            <div className="flex items-center justify-center animate-fade-in-up mb-12">
                <h2 className="font-headline text-3xl sm:text-4xl font-black tracking-widest text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                    賽事預測
                </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
                {isLoading ? (
                    <p className="text-white text-center">載入中...</p>
                ) : events && events.length > 0 ? events.map((event: any) => (
                    <Card key={event.id} className="bg-slate-950/60 backdrop-blur-md border-white/10 rounded-2xl p-6 hover:border-primary/50 transition-all">
                        <CardContent className="p-0 space-y-6">
                            <div className="flex justify-between items-center">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-amber-400" />
                                    {event.matchName}
                                </h3>
                                <Badge variant="outline" className="text-xs text-slate-400 border-slate-700">
                                    <Clock className="w-3 h-3 mr-1" /> {event.startTime}
                                </Badge>
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm text-slate-300 font-bold flex items-center gap-2">
                                    <Target className="w-4 h-4 text-primary" />
                                    {event.question}
                                </p>
                                <div className="grid grid-cols-2 gap-3">
                                    {event.options.map((option: string) => (
                                        <Button
                                            key={option}
                                            variant={predictions[event.id] === option ? 'default' : 'outline'}
                                            className={cn("rounded-xl transition-all", predictions[event.id] === option && "bg-primary")}
                                            onClick={() => handlePredict(event.id, option)}
                                        >
                                            {option}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="text-xs text-slate-500 text-center">
                                預測成功可獲得 <span className="text-amber-400 font-bold">{event.reward} P+ 積分</span>
                            </div>
                        </CardContent>
                    </Card>
                )) : (
                    <p className="text-slate-400 text-center w-full">目前沒有賽事預測活動</p>
                )}
            </div>
        </section>
    );
}
