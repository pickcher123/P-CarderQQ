'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFirestore, useCollection, useAuth, useMemoFirebase } from '@/firebase';
import { collection, serverTimestamp, doc, setDoc, getDoc } from 'firebase/firestore';
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
    TrendingUp,
    ListFilter,
    Medal,
    Swords,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';
import { PredictionLeaderboard, type UserStats } from '@/components/prediction-leaderboard';
import { PersonalPredictionStats } from '@/components/personal-prediction-stats';

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

interface PredictionSectionProps {
    hideHeader?: boolean;
    showStatsAndLeaderboard?: boolean;
    defaultTab?: 'events' | 'leaderboard';
    onLoginClick?: () => void;
}

export function PredictionSection({
    hideHeader = false,
    showStatsAndLeaderboard = true,
    defaultTab = 'events',
    onLoginClick,
}: PredictionSectionProps) {
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
    const [activeTab, setActiveTab] = useState<'events' | 'leaderboard'>(defaultTab);
    const [eventStatusFilter, setEventStatusFilter] = useState<'all' | 'open' | 'closed' | 'finished'>('all');

    // 計算所有玩家的勝率與累積 P+ 點數榜單
    const userStatsList = useMemo(() => {
        if (!allPredictions || !events) return [];
        
        const eventMap: Record<string, any> = {};
        events.forEach((ev: any) => {
            eventMap[ev.id] = ev;
        });

        const statsMap: Record<string, UserStats> = {};

        allPredictions.forEach((pred) => {
            if (!pred.userId || pred.confirmed === false) return;
            const uid = pred.userId;
            if (!statsMap[uid]) {
                statsMap[uid] = {
                    userId: uid,
                    userName: pred.userName || '匿名玩家',
                    userAvatar: pred.userAvatar,
                    userLevel: pred.userLevel,
                    totalPredictions: 0,
                    settledCount: 0,
                    winsCount: 0,
                    lossesCount: 0,
                    totalPointsEarned: 0,
                    winRate: 0,
                    activeCount: 0,
                };
            }

            if (pred.userName && statsMap[uid].userName === '匿名玩家') {
                statsMap[uid].userName = pred.userName;
            }
            if (pred.userAvatar && !statsMap[uid].userAvatar) {
                statsMap[uid].userAvatar = pred.userAvatar;
            }
            if (pred.userLevel && !statsMap[uid].userLevel) {
                statsMap[uid].userLevel = pred.userLevel;
            }

            statsMap[uid].totalPredictions += 1;

            const event = eventMap[pred.eventId];
            if (event) {
                const isFinished = event.status === 'finished';
                if (isFinished) {
                    statsMap[uid].settledCount += 1;
                    const winList = getWinningOptions(event);
                    if (winList.includes(pred.option)) {
                        statsMap[uid].winsCount += 1;
                        statsMap[uid].totalPointsEarned += (Number(event.reward) || 100);
                    } else {
                        statsMap[uid].lossesCount += 1;
                    }
                } else {
                    statsMap[uid].activeCount += 1;
                }
            }
        });

        return Object.values(statsMap).map(st => ({
            ...st,
            winRate: st.settledCount > 0 ? (st.winsCount / st.settledCount) * 100 : 0
        }));
    }, [allPredictions, events]);

    // 當前登入使用者的個人戰績
    const currentUserStats = useMemo(() => {
        if (!auth.currentUser) return null;
        const found = userStatsList.find(u => u.userId === auth.currentUser?.uid);
        if (found) return found;

        return {
            userId: auth.currentUser.uid,
            userName: auth.currentUser.displayName || auth.currentUser.email?.split('@')[0] || '玩家',
            userAvatar: auth.currentUser.photoURL || undefined,
            totalPredictions: 0,
            settledCount: 0,
            winsCount: 0,
            lossesCount: 0,
            totalPointsEarned: 0,
            winRate: 0,
            activeCount: 0,
        };
    }, [userStatsList, auth.currentUser]);

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

    // 賽事狀態過濾
    const filteredEvents = useMemo(() => {
        if (!events) return [];
        return events.filter((event: any) => {
            const isEnded = new Date() > new Date(event.bettingEndTime);
            const isFinished = event.status === 'finished';
            const isClosed = event.status === 'closed' || (isEnded && !isFinished);
            const isOpen = !isFinished && !isClosed;

            if (eventStatusFilter === 'open') return isOpen;
            if (eventStatusFilter === 'closed') return isClosed;
            if (eventStatusFilter === 'finished') return isFinished;
            return true;
        });
    }, [events, eventStatusFilter]);

    return (
        <div className="space-y-7 w-full">
            {/* 優化後的精緻圖像化標頭 */}
            {!hideHeader && (
                <div className="space-y-3 text-left">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-mono font-bold uppercase tracking-wider">
                            <Flame className="w-3.5 h-3.5 text-amber-400" />
                            PREDICTIONS & SPORTS ORACLE
                        </span>
                        <span className="text-xs text-slate-500 font-mono hidden sm:inline-block">
                            · 全服先知勝率擂台
                        </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-800/80 pb-5">
                        <div>
                            <h2 className="text-2xl sm:text-4xl font-black font-headline tracking-tight text-white flex items-center gap-2.5">
                                <span>賽事先知 · 預測擂台</span>
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                                競猜即時熱門球賽與球星數據 · 猜對即享高額 P+ 點數並晉升先知勝率榮譽榜
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-900/80 px-3.5 py-2 rounded-2xl border border-slate-800 shrink-0">
                            <Swords className="w-4 h-4 text-amber-400" />
                            <span>共 <strong className="text-amber-400 font-black text-sm">{events?.length || 0}</strong> 場競猜賽事</span>
                        </div>
                    </div>
                </div>
            )}

            {/* 個人預測勝率與獲得 P 點儀表板 */}
            {showStatsAndLeaderboard && (
                <PersonalPredictionStats
                    userStats={currentUserStats}
                    isLoggedIn={!!auth.currentUser}
                    onLoginClick={onLoginClick}
                />
            )}

            {/* 視圖切換標籤：賽事競猜 / 勝率排行榜 */}
            {showStatsAndLeaderboard && (
                <div className="flex items-center justify-center">
                    <div className="inline-flex p-1.5 rounded-2xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl shadow-xl gap-1">
                        <button
                            type="button"
                            onClick={() => setActiveTab('events')}
                            className={cn(
                                "px-5 sm:px-8 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer",
                                activeTab === 'events'
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20"
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <Target className="w-4 h-4" />
                            <span>火熱競猜賽事 ({events?.length || 0})</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setActiveTab('leaderboard')}
                            className={cn(
                                "px-5 sm:px-8 py-2.5 rounded-xl font-black text-xs sm:text-sm transition-all flex items-center gap-2 cursor-pointer",
                                activeTab === 'leaderboard'
                                    ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-lg shadow-amber-500/20"
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <Trophy className="w-4 h-4" />
                            <span>預測勝率排行榜</span>
                        </button>
                    </div>
                </div>
            )}

            {/* 頁籤內容 A：預測勝率排行榜 */}
            {showStatsAndLeaderboard && activeTab === 'leaderboard' && (
                <div className="max-w-4xl mx-auto">
                    <PredictionLeaderboard
                        userStatsList={userStatsList}
                        currentUserId={auth.currentUser?.uid}
                    />
                </div>
            )}

            {/* 頁籤內容 B：賽事列表 */}
            {(activeTab === 'events' || !showStatsAndLeaderboard) && (
                <div className="space-y-4 max-w-4xl mx-auto">
                    {/* 賽事狀態篩選列 */}
                    <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-900/70 p-2.5 sm:p-3 rounded-2xl border border-slate-800/80">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black text-slate-400 flex items-center gap-1.5">
                                <ListFilter className="w-3.5 h-3.5 text-amber-400" />
                                狀態過濾：
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    type="button"
                                    onClick={() => setEventStatusFilter('all')}
                                    className={cn(
                                        "px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer",
                                        eventStatusFilter === 'all' ? "bg-amber-500 text-slate-950 shadow-sm" : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800"
                                    )}
                                >
                                    全部 ({events?.length || 0})
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEventStatusFilter('open')}
                                    className={cn(
                                        "px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer",
                                        eventStatusFilter === 'open' ? "bg-emerald-500 text-slate-950 shadow-sm" : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800"
                                    )}
                                >
                                    開放中
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEventStatusFilter('closed')}
                                    className={cn(
                                        "px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer",
                                        eventStatusFilter === 'closed' ? "bg-slate-700 text-white shadow-sm" : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800"
                                    )}
                                >
                                    待開獎
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEventStatusFilter('finished')}
                                    className={cn(
                                        "px-3 py-1 rounded-xl text-xs font-black transition-all cursor-pointer",
                                        eventStatusFilter === 'finished' ? "bg-amber-500 text-slate-950 shadow-sm" : "bg-slate-950/60 text-slate-400 hover:text-white border border-slate-800"
                                    )}
                                >
                                    已結算
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* 賽事列表網格 */}
                    <div className="grid grid-cols-1 gap-4">
                        {isLoading ? (
                            <div className="p-12 text-center text-slate-400 text-sm bg-slate-900/40 rounded-3xl border border-slate-800">
                                <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                <span>載入賽事競猜項目中...</span>
                            </div>
                        ) : filteredEvents && filteredEvents.length > 0 ? (
                            filteredEvents.map((event: any) => {
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
                                    <Card key={event.id} className="bg-slate-950/90 backdrop-blur-2xl border-slate-800/90 rounded-3xl p-5 sm:p-6 hover:border-amber-500/40 transition-all shadow-xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/5 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/10 transition-all" />

                                        <CardContent className="p-0 space-y-4 relative z-10">
                                            {/* 頂部：賽事名稱、獎勵與狀態標籤 */}
                                            <div className="flex justify-between items-start flex-wrap gap-2 border-b border-slate-800/80 pb-3">
                                                <div className="space-y-1">
                                                    <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-black">
                                                        <Trophy className="w-3.5 h-3.5 text-amber-400" />
                                                        <span>命中獎勵 +{event.reward || 100} P+</span>
                                                    </div>
                                                    <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                                                        <span>{event.matchName}</span>
                                                    </h3>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    {isFinished ? (
                                                        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-black px-3 py-1 shadow-sm">
                                                            🏆 已結算
                                                        </Badge>
                                                    ) : isClosed ? (
                                                        <Badge variant="outline" className="text-xs font-bold border-red-500/40 bg-red-500/10 text-red-300 px-3 py-1">
                                                            <Clock className="w-3 h-3 mr-1 text-red-400" />
                                                            已截止下注
                                                        </Badge>
                                                    ) : (
                                                        <Badge variant="outline" className="text-xs font-bold border-emerald-500/40 bg-emerald-500/10 text-emerald-300 px-3 py-1">
                                                            <Clock className="w-3 h-3 mr-1 text-emerald-400" />
                                                            開放競猜中 · 截止: {event.bettingEndTime ? event.bettingEndTime.replace('T', ' ') : ''}
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 題目與獲勝答案 */}
                                            <div className="space-y-3">
                                                <div className="flex items-center gap-2 text-sm sm:text-base text-slate-100 font-black">
                                                    <Target className="w-4 h-4 text-amber-400 shrink-0" />
                                                    <span>{event.question}</span>
                                                </div>

                                                {winningList.length > 0 && (
                                                    <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-200 text-xs sm:text-sm font-bold flex items-center gap-2 shadow-inner">
                                                        <Sparkles className="w-4 h-4 text-amber-400 shrink-0 animate-pulse" />
                                                        <span>獲勝答案：<strong className="text-white font-black">{winningList.join(' / ')}</strong></span>
                                                    </div>
                                                )}

                                                {/* 圖像化選項按鈕組（附帶動態比例視覺條） */}
                                                <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
                                                    {event.options?.map((option: string) => {
                                                        const isSelected = userChoice === option;
                                                        const isWinnerOpt = winningList.includes(option);
                                                        const countForOpt = eventPreds.filter(p => p.option === option).length;
                                                        const percentForOpt = totalBettors > 0 ? Math.round((countForOpt / totalBettors) * 100) : 0;

                                                        return (
                                                            <button
                                                                key={option}
                                                                type="button"
                                                                disabled={isClosed || isConfirmed}
                                                                onClick={() => handlePredict(event.id, option)}
                                                                className={cn(
                                                                    "rounded-2xl transition-all relative font-bold min-h-[64px] p-3 text-xs sm:text-sm flex flex-col justify-between border text-left overflow-hidden cursor-pointer",
                                                                    isSelected 
                                                                        ? "bg-slate-900 border-amber-400 ring-2 ring-amber-400/50 shadow-lg shadow-amber-500/20" 
                                                                        : "bg-slate-900/90 border-slate-800 hover:border-slate-700 hover:bg-slate-850",
                                                                    isWinnerOpt && "border-amber-400 bg-amber-500/15"
                                                                )}
                                                            >
                                                                {/* 背景視覺能量長條 (Visual Percentage Bar) */}
                                                                <div 
                                                                    className={cn(
                                                                        "absolute top-0 bottom-0 left-0 transition-all duration-500 opacity-20 pointer-events-none",
                                                                        isSelected ? "bg-amber-400" : isWinnerOpt ? "bg-amber-300" : "bg-cyan-400"
                                                                    )}
                                                                    style={{ width: `${percentForOpt}%` }}
                                                                />

                                                                {/* 選項文字與選取狀態 */}
                                                                <div className="flex items-center justify-between gap-1 relative z-10 w-full">
                                                                    <div className="flex items-center gap-1.5 min-w-0">
                                                                        {isWinnerOpt && <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                                                                        <span className={cn("text-xs sm:text-sm font-black truncate", isSelected ? "text-amber-300" : "text-white")}>
                                                                            {option}
                                                                        </span>
                                                                    </div>
                                                                    {isSelected && isConfirmed && (
                                                                        <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                                                                    )}
                                                                </div>

                                                                {/* 底部數據與微進度條 */}
                                                                <div className="flex items-center justify-between text-[11px] font-mono relative z-10 w-full pt-1.5">
                                                                    <span className="text-slate-400">{countForOpt} 人支持</span>
                                                                    <span className={cn("font-black", isSelected ? "text-amber-400" : "text-slate-300")}>
                                                                        {percentForOpt}%
                                                                    </span>
                                                                </div>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                            
                                            {/* 未確認時的下注按鈕 */}
                                            {userChoice && !isConfirmed && !isClosed && (
                                                <Button 
                                                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-sm h-12 rounded-2xl shadow-lg shadow-amber-500/20 cursor-pointer" 
                                                    onClick={() => handleConfirm(event)}
                                                    disabled={isSubmitting}
                                                >
                                                    {isSubmitting ? '提交中...' : `確認下注「${userChoice}」(只能單選，下好離手)`}
                                                </Button>
                                            )}

                                            {/* 已確認時的提示 */}
                                            {isConfirmed && (
                                                <div className={cn(
                                                    "p-3.5 rounded-2xl text-center text-xs font-bold flex items-center justify-center gap-2",
                                                    isFinished 
                                                        ? userWon ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-black shadow-inner" : "bg-slate-900 text-slate-400 border border-slate-800"
                                                        : "bg-amber-500/15 text-amber-300 border border-amber-500/30"
                                                )}>
                                                    {isFinished ? (
                                                        userWon ? (
                                                            <>
                                                                <Trophy className="w-4 h-4 text-emerald-400 shrink-0 animate-bounce" />
                                                                <span>恭喜猜中！你預測「{userChoice}」勝出，已派發 +{event.reward || 100} P+ 點數！</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <AlertCircle className="w-4 h-4 text-slate-500 shrink-0" />
                                                                <span>你預測「{userChoice}」，本場獲勝者為「{winningList.join(' / ')}」，下次再接再厲！</span>
                                                            </>
                                                        )
                                                    ) : (
                                                        <>
                                                            <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                                                            <span>已成功預測「{userChoice}」，等待開獎結果派發 P+ 點數</span>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {/* 底部：公開玩家清單按鈕 */}
                                            <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <Users className="w-3.5 h-3.5 text-slate-500" />
                                                    已有 <strong className="text-white font-mono">{totalBettors}</strong> 位玩家參與競猜
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenPlayerList(event)}
                                                    className="text-amber-400 hover:text-amber-300 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                                                >
                                                    <span>查看預測名單</span>
                                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })
                        ) : (
                            <div className="p-12 text-center text-slate-400 text-sm bg-slate-900/40 rounded-3xl border border-slate-800">
                                目前暫無符合篩選條件的競猜賽事
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* 玩家名單彈窗 (Player List Modal) */}
            <Dialog open={!!selectedEventForModal} onOpenChange={(open) => !open && setSelectedEventForModal(null)}>
                <DialogContent className="bg-slate-950/98 backdrop-blur-2xl border-amber-500/30 text-white rounded-3xl p-5 sm:p-7 max-w-lg w-[92vw] mx-auto shadow-2xl focus:outline-none">
                    {selectedEventForModal && (() => {
                        const eventPreds = predictionsByEvent[selectedEventForModal.id] || [];
                        const filteredPreds = eventPreds.filter((p) => {
                            if (filterOption !== 'all' && p.option !== filterOption) return false;
                            if (searchKeyword.trim()) {
                                const kw = searchKeyword.trim().toLowerCase();
                                const nameMatch = p.userName?.toLowerCase().includes(kw);
                                if (!nameMatch) return false;
                            }
                            return true;
                        });

                        return (
                            <div className="space-y-4">
                                <DialogHeader className="space-y-2 text-left border-b border-slate-800 pb-3.5">
                                    <div className="flex items-center gap-2">
                                        <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-black">
                                            公開下注名單
                                        </Badge>
                                        <span className="text-xs text-slate-400 font-mono">共 {eventPreds.length} 筆</span>
                                    </div>
                                    <DialogTitle className="text-base sm:text-lg font-black text-white font-headline leading-snug">
                                        {selectedEventForModal.matchName}
                                    </DialogTitle>
                                </DialogHeader>

                                {/* 篩選選項 */}
                                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                                    <button
                                        type="button"
                                        onClick={() => setFilterOption('all')}
                                        className={cn(
                                            "px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer",
                                            filterOption === 'all' ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 border border-slate-800"
                                        )}
                                    >
                                        全部 ({eventPreds.length})
                                    </button>
                                    {selectedEventForModal.options?.map((opt: string) => {
                                        const count = eventPreds.filter(p => p.option === opt).length;
                                        return (
                                            <button
                                                key={opt}
                                                type="button"
                                                onClick={() => setFilterOption(opt)}
                                                className={cn(
                                                    "px-3 py-1 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer",
                                                    filterOption === opt ? "bg-amber-500 text-slate-950" : "bg-slate-900 text-slate-400 border border-slate-800"
                                                )}
                                            >
                                                {opt} ({count})
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* 搜尋框 */}
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                                    <Input
                                        placeholder="搜尋玩家暱稱..."
                                        value={searchKeyword}
                                        onChange={(e) => setSearchKeyword(e.target.value)}
                                        className="h-9 pl-9 pr-3 rounded-xl bg-slate-900/90 border-slate-800 text-xs text-white placeholder:text-slate-500"
                                    />
                                </div>

                                {/* 名單列表 */}
                                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                                    {filteredPreds.length > 0 ? (
                                        filteredPreds.map((p, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/80 text-xs">
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    {p.userAvatar ? (
                                                        <img src={p.userAvatar} alt="" className="w-7 h-7 rounded-full object-cover border border-slate-700" />
                                                    ) : (
                                                        <div className="w-7 h-7 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                                                            <User className="w-3.5 h-3.5" />
                                                        </div>
                                                    )}
                                                    <span className="font-bold text-white truncate max-w-[120px] sm:max-w-xs">{p.userName}</span>
                                                </div>
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <Badge className="bg-amber-500/15 border-amber-500/30 text-amber-300 text-[10px] font-black">
                                                        {p.option}
                                                    </Badge>
                                                    <span className="text-[10px] font-mono text-slate-500">
                                                        {formatPredictionTime(p.timestamp || p.createdAt)}
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className="py-8 text-center text-slate-500 text-xs">
                                            尚無玩家預測紀錄
                                        </div>
                                    )}
                                </div>

                                <DialogClose asChild>
                                    <Button variant="outline" className="w-full h-10 rounded-xl border-slate-700 bg-slate-900 text-slate-300 text-xs font-bold mt-2">
                                        關閉
                                    </Button>
                                </DialogClose>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>
        </div>
    );
}
