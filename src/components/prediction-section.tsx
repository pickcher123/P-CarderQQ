'use client';

import { useState, useEffect } from 'react';
import { useFirestore, useCollection, useAuth, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc, setDoc, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Clock, Target, CheckCircle2, Sparkles, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

function getWinningOptions(event: any): string[] {
    if (Array.isArray(event.winningOptions) && event.winningOptions.length > 0) {
        return event.winningOptions.filter(Boolean);
    }
    if (typeof event.winningOption === 'string' && event.winningOption.trim()) {
        return event.winningOption.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean);
    }
    return [];
}

export function PredictionSection() {
    const db = useFirestore();
    const auth = useAuth();
    const eventsCollection = useMemoFirebase(() => collection(db, 'predictionEvents'), [db]);
    const { data: events, isLoading } = useCollection(eventsCollection);

    const [predictions, setPredictions] = useState<Record<string, { option: string, confirmed: boolean }>>({});

    // 載入當前使用者的已確認下注記錄
    useEffect(() => {
        if (!auth.currentUser) return;
        const fetchUserPredictions = async () => {
            try {
                const q = query(collection(db, 'userPredictions'), where('userId', '==', auth.currentUser?.uid));
                const snap = await getDocs(q);
                const userPreds: Record<string, { option: string, confirmed: boolean }> = {};
                snap.forEach(d => {
                    const data = d.data();
                    if (data.eventId && data.option) {
                        userPreds[data.eventId] = { option: data.option, confirmed: !!data.confirmed };
                    }
                });
                setPredictions(prev => ({ ...userPreds, ...prev }));
            } catch (e) {
                console.error("載入使用者預測紀錄失敗:", e);
            }
        };
        fetchUserPredictions();
    }, [db, auth.currentUser]);

    const handlePredict = (eventId: string, option: string) => {
        if (!auth.currentUser || predictions[eventId]?.confirmed) return;
        setPredictions(prev => ({ ...prev, [eventId]: { option, confirmed: false } }));
    };

    const handleConfirm = async (eventId: string) => {
        if (!auth.currentUser || !predictions[eventId]) return;
        
        try {
            const predictionRef = doc(db, 'userPredictions', `${auth.currentUser.uid}_${eventId}`);
            await setDoc(predictionRef, {
                userId: auth.currentUser.uid,
                eventId,
                option: predictions[eventId].option,
                confirmed: true,
                timestamp: serverTimestamp()
            });
            
            setPredictions(prev => ({ ...prev, [eventId]: { ...prev[eventId], confirmed: true } }));
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="grid grid-cols-1 gap-6">
            {isLoading ? (
                <p className="text-white text-center">載入中...</p>
            ) : events && events.length > 0 ? events.map((event: any) => {
                const isEnded = new Date() > new Date(event.bettingEndTime);
                const isFinished = event.status === 'finished';
                const isClosed = event.status === 'closed' || isEnded || isFinished;
                const isConfirmed = predictions[event.id]?.confirmed;
                const userChoice = predictions[event.id]?.option;
                const winningList = getWinningOptions(event);
                const userWon = isFinished && userChoice && winningList.includes(userChoice);

                return (
                    <Card key={event.id} className="bg-slate-950/60 backdrop-blur-md border-white/10 rounded-2xl p-6 hover:border-primary/50 transition-all">
                        <CardContent className="p-0 space-y-6">
                            <div className="flex justify-between items-center flex-wrap gap-2">
                                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-amber-400" />
                                    {event.matchName}
                                </h3>
                                <div className="flex items-center gap-2">
                                    {isFinished ? (
                                        <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-xs">
                                            🏆 已開獎結算
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className={cn("text-xs border-slate-700", isClosed ? "text-red-400" : "text-slate-400")}>
                                            <Clock className="w-3 h-3 mr-1" /> {isClosed ? "已截止" : `截止: ${event.bettingEndTime}`}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            <div className="space-y-3">
                                <p className="text-sm text-slate-300 font-bold flex items-center gap-2">
                                    <Target className="w-4 h-4 text-primary" />
                                    {event.question}
                                </p>

                                {winningList.length > 0 && (
                                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                                        <span>獲勝答案：<strong className="text-amber-200">{winningList.join(' / ')}</strong></span>
                                    </div>
                                )}

                                <div className="grid grid-cols-2 gap-3">
                                    {event.options?.map((option: string) => {
                                        const isSelected = userChoice === option;
                                        const isWinnerOpt = winningList.includes(option);

                                        return (
                                            <Button
                                                key={option}
                                                variant={isSelected ? 'default' : 'outline'}
                                                className={cn(
                                                    "rounded-xl transition-all relative font-bold h-12 text-sm",
                                                    isSelected && "bg-primary text-white border-primary shadow-md",
                                                    isWinnerOpt && "border-amber-400/80 bg-amber-500/15 text-amber-200 hover:bg-amber-500/20 shadow-amber-500/10"
                                                )}
                                                onClick={() => handlePredict(event.id, option)}
                                                disabled={isClosed || isConfirmed}
                                            >
                                                {isWinnerOpt && <Trophy className="w-4 h-4 text-amber-400 mr-1.5 shrink-0" />}
                                                {option}
                                                {isSelected && isConfirmed && (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 ml-1.5 shrink-0" />
                                                )}
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {userChoice && !isConfirmed && !isClosed && (
                                <Button className="w-full bg-green-600 hover:bg-green-700 font-black text-sm h-11" onClick={() => handleConfirm(event.id)}>
                                    確認下注「{userChoice}」(只能單選，下好離手)
                                </Button>
                            )}

                            {isConfirmed && (
                                <div className={cn(
                                    "p-3 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1.5",
                                    isFinished 
                                        ? userWon ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-800/80 text-slate-400 border border-slate-700"
                                        : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                                )}>
                                    {isFinished ? (
                                        userWon ? (
                                            <>
                                                <Sparkles className="w-4 h-4 text-emerald-400" />
                                                恭喜預測成功！你選擇的「{userChoice}」是獲勝答案，獲得 <span className="text-amber-400 font-black">{event.reward} P+ 積分</span>！
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle className="w-4 h-4 text-slate-400" />
                                                你選擇了「{userChoice}」，這次未獲得獎勵，下次繼續加油！
                                            </>
                                        )
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                                            已下注：<span className="text-white font-black">「{userChoice}」</span> (開獎後發放獎勵)
                                        </>
                                    )}
                                </div>
                            )}

                            {!isConfirmed && (
                                <div className="text-xs text-slate-500 text-center">
                                    玩家只能單選 1 個選項。預測成功可獲得 <span className="text-amber-400 font-bold">{event.reward} P+ 積分</span>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )
            }) : (
                <p className="text-slate-400 text-center w-full">目前沒有賽事預測活動</p>
            )}
        </div>
    );
}
