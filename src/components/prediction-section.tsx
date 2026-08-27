'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useAuth, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc, setDoc, getDoc, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';
import {
    Trophy,
    Clock,
    Target,
    CheckCircle2,
    Sparkles,
    AlertCircle,
    Users,
    Search,
    User,
    ArrowUpRight,
    Flame,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';

export interface UserPredictionRecord {
    id?: string;
    userId: string;
    userName?: string;
    userAvatar?: string;
    userLevel?: string;
    eventId: string;
    matchName?: string;
    option: string;
    confirmed: boolean;
    timestamp?: any;
    createdAt?: string;
}

function getWinningOptions(event: any): string[] {
    if (Array.isArray(event.winningOptions) && event.winningOptions.length > 0) {
        return event.winningOptions.filter(Boolean);
    }
    if (typeof event.winningOption === 'string' && event.winningOption.trim()) {
        return event.winningOption.split(/[,，、]/).map((s: string) => s.trim()).filter(Boolean);
    }
    return [];
}

function formatPredictionTime(val: any): string {
    if (!val) return '';
    try {
        let date: Date;
        if (val.seconds) {
            date = new Date(val.seconds * 1000);
        } else if (typeof val === 'string' || typeof val === 'number') {
            date = new Date(val);
        } else if (val.toDate && typeof val.toDate === 'function') {
            date = val.toDate();
        } else {
            return '';
        }
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        return `${m}/${d} ${hh}:${mm}`;
    } catch {
        return '';
    }
}

export function PredictionSection() {
    const db = useFirestore();
    const auth = useAuth();
    
    // 取得所有賽事
    const eventsCollection = useMemoFirebase(() => collection(db, 'predictionEvents'), [db]);
    const { data: events, isLoading } = useCollection(eventsCollection);

    // 取得所有玩家公開預測名單
    const predictionsCollection = useMemoFirebase(() => collection(db, 'userPredictions'), [db]);
    const { data: allPredictions } = useCollection<UserPredictionRecord>(predictionsCollection);

    const [myPredictions, setMyPredictions] = useState<Record<string, { option: string, confirmed: boolean }>>({});
    const [selectedEventForModal, setSelectedEventForModal] = useState<any | null>(null);
    const [filterOption, setFilterOption] = useState<string>('all');
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 依 eventId 分組預測名單
    const predictionsByEvent = useMemo(() => {
        const map: Record<string, UserPredictionRecord[]> = {};
        if (!allPredictions) return map;
        allPredictions.forEach((pred) => {
            if (pred.eventId && pred.confirmed !== false) {
                if (!map[pred.eventId]) {
                    map[pred.eventId] = [];
                }
                map[pred.eventId].push(pred);
            }
        });
        return map;
    }, [allPredictions]);

    // 載入當前使用者的下注記錄
    useEffect(() => {
        if (!auth.currentUser || !allPredictions) return;
        const currentUid = auth.currentUser.uid;
        const userPreds: Record<string, { option: string, confirmed: boolean }> = {};
        allPredictions.forEach((pred) => {
            if (pred.userId === currentUid && pred.eventId && pred.option) {
                userPreds[pred.eventId] = { option: pred.option, confirmed: !!pred.confirmed };
            }
        });
        setMyPredictions(prev => ({ ...prev, ...userPreds }));
    }, [auth.currentUser, allPredictions]);

    const handlePredict = (eventId: string, option: string) => {
        if (!auth.currentUser || myPredictions[eventId]?.confirmed) return;
        setMyPredictions(prev => ({ ...prev, [eventId]: { option, confirmed: false } }));
    };

    const handleConfirm = async (event: any) => {
        if (!auth.currentUser || !myPredictions[event.id] || isSubmitting) return;
        
        setIsSubmitting(true);
        try {
            // 嘗試取得使用者最新資料
            let userName = auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || '玩家';
            let userAvatar = auth.currentUser.photoURL || '';
            let userLevel = '';

            try {
                const userDocSnap = await getDoc(doc(db, 'users', auth.currentUser.uid));
                if (userDocSnap.exists()) {
                    const userData = userDocSnap.data();
                    if (userData.username) userName = userData.username;
                    if (userData.avatarUrl) userAvatar = userData.avatarUrl;
                    if (userData.userLevel) userLevel = userData.userLevel;
                }
            } catch (err) {
                console.warn("無法取得使用者檔案資料:", err);
            }

            const selectedOption = myPredictions[event.id].option;
            const predictionRef = doc(db, 'userPredictions', `${auth.currentUser.uid}_${event.id}`);
            
            await setDoc(predictionRef, {
                userId: auth.currentUser.uid,
                userName,
                userAvatar,
                userLevel,
                eventId: event.id,
                matchName: event.matchName || '',
                option: selectedOption,
                confirmed: true,
                timestamp: serverTimestamp(),
                createdAt: new Date().toISOString()
            });
            
            setMyPredictions(prev => ({ ...prev, [event.id]: { ...prev[event.id], confirmed: true } }));
        } catch (error) {
            console.error("提交預測失敗:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 點擊開啟某賽事的玩家名單彈窗
    const handleOpenPlayerList = (event: any) => {
        setSelectedEventForModal(event);
        setFilterOption('all');
        setSearchKeyword('');
    };

    return (
        <div className="grid grid-cols-1 gap-6">
            {isLoading ? (
                <div className="p-8 text-center text-slate-400 text-sm">載入賽事預測中...</div>
            ) : events && events.length > 0 ? events.map((event: any) => {
                const isEnded = new Date() > new Date(event.bettingEndTime);
                const isFinished = event.status === 'finished';
                const isClosed = event.status === 'closed' || isEnded || isFinished;
                const isConfirmed = myPredictions[event.id]?.confirmed;
                const userChoice = myPredictions[event.id]?.option;
                const winningList = getWinningOptions(event);
                const userWon = isFinished && userChoice && winningList.includes(userChoice);

                const eventPreds = predictionsByEvent[event.id] || [];
                const totalBettors = eventPreds.length;

                return (
                    <Card key={event.id} className="bg-slate-950/70 backdrop-blur-xl border-slate-800/80 rounded-2xl p-4 sm:p-5 hover:border-slate-700 transition-all shadow-xl relative overflow-hidden group">
                        {/* 頂部裝飾光暈 */}
                        <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 rounded-full blur-2xl pointer-events-none" />

                        <CardContent className="p-0 space-y-4 relative z-10">
                            {/* 頂部：賽事名稱與狀態 */}
                            <div className="flex justify-between items-center flex-wrap gap-2">
                                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                                    <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 shrink-0" />
                                    <span>{event.matchName}</span>
                                </h3>
                                <div className="flex items-center gap-1.5">
                                    {isFinished ? (
                                        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] sm:text-xs font-bold px-2 py-0.5 shadow-sm">
                                            🏆 已結算
                                        </Badge>
                                    ) : (
                                        <Badge variant="outline" className={cn("text-[10px] sm:text-xs font-bold border-slate-800 bg-slate-900/80", isClosed ? "text-red-400 border-red-500/30" : "text-slate-300")}>
                                            <Clock className="w-3 h-3 mr-1 text-slate-400" />
                                            {isClosed ? "已截止下注" : `截止: ${event.bettingEndTime ? event.bettingEndTime.replace('T', ' ') : ''}`}
                                        </Badge>
                                    )}
                                </div>
                            </div>

                            {/* 題目與獲勝答案 */}
                            <div className="space-y-2.5">
                                <p className="text-xs sm:text-sm text-slate-200 font-bold flex items-center gap-1.5">
                                    <Target className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-400 shrink-0" />
                                    {event.question}
                                </p>

                                {winningList.length > 0 && (
                                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold flex items-center gap-2 shadow-inner">
                                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 animate-pulse" />
                                        <span>獲勝答案：<strong className="text-amber-200 font-black">{winningList.join(' / ')}</strong></span>
                                    </div>
                                )}

                                {/* 選項按鈕組 */}
                                <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                                    {event.options?.map((option: string) => {
                                        const isSelected = userChoice === option;
                                        const isWinnerOpt = winningList.includes(option);
                                        const countForOpt = eventPreds.filter(p => p.option === option).length;
                                        const percentForOpt = totalBettors > 0 ? Math.round((countForOpt / totalBettors) * 100) : 0;

                                        return (
                                            <Button
                                                key={option}
                                                variant={isSelected ? 'default' : 'outline'}
                                                className={cn(
                                                    "rounded-xl transition-all relative font-bold min-h-[54px] h-auto py-2 px-3 text-xs sm:text-sm flex flex-col items-center justify-center gap-1 border-slate-800 bg-slate-900/90 hover:bg-slate-800 text-white whitespace-normal",
                                                    isSelected && "bg-orange-600 hover:bg-orange-500 text-white border-orange-500 shadow-lg shadow-orange-600/30 ring-2 ring-orange-400/40",
                                                    isWinnerOpt && "border-amber-400 bg-amber-500/20 text-amber-200 hover:bg-amber-500/30 shadow-amber-500/10"
                                                )}
                                                onClick={() => handlePredict(event.id, option)}
                                                disabled={isClosed || isConfirmed}
                                            >
                                                <div className="flex items-center justify-center gap-1 max-w-full leading-snug text-center">
                                                    {isWinnerOpt && <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                                    <span className="font-black text-slate-100 text-xs sm:text-sm leading-snug tracking-tight text-center break-words line-clamp-2">
                                                        {option}
                                                    </span>
                                                    {isSelected && isConfirmed && (
                                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-1" />
                                                    )}
                                                </div>
                                                <span className="text-[11px] text-slate-400 font-mono font-medium leading-none block">
                                                    {countForOpt} 人 ({percentForOpt}%)
                                                </span>
                                            </Button>
                                        );
                                    })}
                                </div>
                            </div>
                            
                            {/* 未確認時的下注按鈕 */}
                            {userChoice && !isConfirmed && !isClosed && (
                                <Button 
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm h-11 rounded-xl shadow-lg shadow-emerald-600/20" 
                                    onClick={() => handleConfirm(event)}
                                    disabled={isSubmitting}
                                >
                                    {isSubmitting ? '提交中...' : `確認下注「${userChoice}」(只能單選，下好離手)`}
                                </Button>
                            )}

                            {/* 已確認時的提示 */}
                            {isConfirmed && (
                                <div className={cn(
                                    "p-3 rounded-xl text-center text-xs font-bold flex items-center justify-center gap-1.5",
                                    isFinished 
                                        ? userWon ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30" : "bg-slate-900 text-slate-400 border border-slate-800"
                                        : "bg-blue-500/15 text-blue-300 border border-blue-500/30"
                                )}>
                                    {isFinished ? (
                                        userWon ? (
                                            <>
                                                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                                                <span>恭喜預測成功！你選擇的「{userChoice}」勝出，獲得 <strong className="text-amber-400 font-black">+{event.reward} P+ 積分</strong>！</span>
                                            </>
                                        ) : (
                                            <>
                                                <AlertCircle className="w-4 h-4 text-slate-400 shrink-0" />
                                                <span>你選擇了「{userChoice}」，本次未獲勝，下次繼續加油！</span>
                                            </>
                                        )
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                            <span>你已下注：<strong className="text-white font-black">「{userChoice}」</strong> (開獎後發放獎勵)</span>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* 底部功能列：玩家名單按鈕 + 獎勵說明 */}
                            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-800/80 text-xs">
                                <div className="text-slate-400 flex items-center gap-1">
                                    <span>獎勵</span>
                                    <span className="text-amber-400 font-black font-mono">+{event.reward || 0} P+</span>
                                </div>

                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleOpenPlayerList(event)}
                                    className="h-8 px-2.5 rounded-lg text-xs font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 border border-cyan-500/20 flex items-center gap-1.5 transition-colors"
                                >
                                    <Users className="w-3.5 h-3.5" />
                                    <span>預測名單 ({totalBettors} 人)</span>
                                    <ArrowUpRight className="w-3 h-3 opacity-70" />
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                );
            }) : (
                <p className="text-slate-400 text-center w-full py-8 text-sm">目前沒有賽事預測活動</p>
            )}

            {/* 公開玩家預測名單彈窗 (Public Player Predictions Dialog) */}
            <Dialog open={!!selectedEventForModal} onOpenChange={(open) => !open && setSelectedEventForModal(null)}>
                <DialogContent className="bg-slate-950/95 backdrop-blur-2xl border-slate-800 text-white rounded-3xl p-5 sm:p-6 max-w-lg w-[94vw] mx-auto shadow-[0_0_60px_rgba(0,0,0,0.8)] focus:outline-none max-h-[85vh] flex flex-col">
                    {selectedEventForModal && (() => {
                        const event = selectedEventForModal;
                        const eventPreds = predictionsByEvent[event.id] || [];
                        const winningList = getWinningOptions(event);
                        const isFinished = event.status === 'finished';

                        // 篩選與搜尋名單
                        const filteredPreds = eventPreds.filter((p) => {
                            const matchOption = filterOption === 'all' || p.option === filterOption;
                            const matchKeyword = !searchKeyword.trim() || 
                                (p.userName && p.userName.toLowerCase().includes(searchKeyword.toLowerCase())) ||
                                (p.userId && p.userId.toLowerCase().includes(searchKeyword.toLowerCase()));
                            return matchOption && matchKeyword;
                        });

                        return (
                            <div className="space-y-4 flex-1 flex flex-col min-h-0">
                                <DialogHeader className="space-y-2 text-left border-b border-slate-800 pb-3 shrink-0">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs font-bold">
                                            <Users className="w-3.5 h-3.5" />
                                            <span>玩家公開預測名單</span>
                                        </div>
                                        <span className="text-xs text-slate-400 font-mono">
                                            共 {eventPreds.length} 位玩家預測
                                        </span>
                                    </div>
                                    <DialogTitle className="text-base sm:text-lg font-black text-white leading-snug">
                                        {event.matchName}
                                    </DialogTitle>
                                    <p className="text-xs text-slate-400 font-medium line-clamp-1">
                                        {event.question}
                                    </p>
                                </DialogHeader>

                                {/* 選項分佈速覽 Chips */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 no-scrollbar">
                                    <button
                                        type="button"
                                        onClick={() => setFilterOption('all')}
                                        className={cn(
                                            "px-3 py-1 rounded-full text-xs font-bold border transition-all whitespace-nowrap",
                                            filterOption === 'all'
                                                ? "bg-white text-slate-950 border-white shadow-sm"
                                                : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                                        )}
                                    >
                                        全部 ({eventPreds.length})
                                    </button>
                                    {event.options?.map((opt: string) => {
                                        const count = eventPreds.filter(p => p.option === opt).length;
                                        const isWinner = winningList.includes(opt);
                                        return (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setFilterOption(opt)}
                                                className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-bold border transition-all flex items-center gap-1 whitespace-nowrap",
                                                    filterOption === opt
                                                        ? "bg-orange-500 text-white border-orange-400 shadow-sm"
                                                        : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white",
                                                    isWinner && filterOption !== opt && "border-amber-500/40 text-amber-300"
                                                )}
                                            >
                                                {isWinner && <Trophy className="w-3 h-3 text-amber-400" />}
                                                <span>{opt}</span>
                                                <span className="font-mono opacity-80">({count})</span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* 搜尋框 */}
                                <div className="relative shrink-0">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input
                                        placeholder="搜尋玩家名稱..."
                                        value={searchKeyword}
                                        onChange={(e) => setSearchKeyword(e.target.value)}
                                        className="h-9 pl-9 pr-3 rounded-xl bg-slate-900 border-slate-800 text-xs text-white placeholder:text-slate-500 font-medium"
                                    />
                                    {searchKeyword && (
                                        <button 
                                            type="button" 
                                            onClick={() => setSearchKeyword('')}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                {/* 玩家預測列表 */}
                                <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-[220px] max-h-[360px]">
                                    {filteredPreds.length > 0 ? (
                                        filteredPreds.map((pred, index) => {
                                            const isWinner = isFinished && winningList.includes(pred.option);
                                            const isMe = auth.currentUser?.uid === pred.userId;
                                            const timeStr = formatPredictionTime(pred.timestamp || pred.createdAt);

                                            return (
                                                <div 
                                                    key={pred.id || `${pred.userId}_${index}`}
                                                    className={cn(
                                                        "p-3 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-3 transition-colors",
                                                        isMe && "border-orange-500/50 bg-orange-950/20",
                                                        isWinner && "border-amber-500/40 bg-amber-950/15"
                                                    )}
                                                >
                                                    {/* 玩家資訊 */}
                                                    <div className="flex items-center gap-2.5 min-w-0">
                                                        <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center overflow-hidden shrink-0 text-slate-300">
                                                            {pred.userAvatar ? (
                                                                <img src={pred.userAvatar} alt="" className="w-full h-full object-cover" />
                                                            ) : (
                                                                <User className="w-4 h-4 text-slate-400" />
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 space-y-0.5">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="text-xs font-bold text-white truncate">
                                                                    {pred.userName || `玩家 ${pred.userId.slice(0, 5)}...`}
                                                                </span>
                                                                {isMe && (
                                                                    <Badge className="bg-orange-500 text-white text-[9px] font-black h-4 px-1 border-none">
                                                                        你
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {timeStr && (
                                                                <span className="text-[10px] text-slate-500 font-mono block">
                                                                    {timeStr} 下注
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* 預測選項與中獎狀態 */}
                                                    <div className="flex items-center gap-2 shrink-0">
                                                        <Badge 
                                                            className={cn(
                                                                "font-bold text-xs px-2.5 py-1 rounded-xl border-none shadow-sm",
                                                                isWinner 
                                                                    ? "bg-amber-500 text-slate-950 font-black" 
                                                                    : "bg-slate-800 text-slate-200"
                                                            )}
                                                        >
                                                            {isWinner && <Trophy className="w-3 h-3 mr-1 inline-block" />}
                                                            {pred.option}
                                                        </Badge>

                                                        {isFinished && (
                                                            isWinner ? (
                                                                <span className="text-[10px] font-bold text-emerald-400 flex items-center gap-0.5">
                                                                    <Sparkles className="w-3 h-3" />
                                                                    中獎
                                                                </span>
                                                            ) : (
                                                                <span className="text-[10px] text-slate-500 font-medium">
                                                                    未中
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="py-12 text-center text-slate-400 text-xs space-y-1">
                                            <p className="font-bold">尚無符合條件的預測紀錄</p>
                                            <p className="text-[11px] text-slate-500">
                                                {searchKeyword ? "請嘗試更換搜尋關鍵字" : "快成為第一個下注的玩家吧！"}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <div className="pt-2 border-t border-slate-800/80 shrink-0">
                                    <DialogClose asChild>
                                        <Button variant="outline" className="w-full h-10 rounded-xl bg-slate-900 border-slate-800 hover:bg-slate-800 text-white font-bold text-xs">
                                            關閉名單
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

