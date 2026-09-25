'use client';

import React, { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useFirestore, useCollection, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, orderBy, getDoc, doc } from 'firebase/firestore';
import { 
    format, 
    startOfMonth, 
    endOfMonth, 
    startOfWeek, 
    endOfWeek, 
    eachDayOfInterval, 
    isSameMonth, 
    isSameDay, 
    addMonths, 
    subMonths,
    isToday,
    differenceInCalendarDays,
    parseISO
} from 'date-fns';
import { 
    Calendar as CalendarIcon, 
    ChevronLeft, 
    ChevronRight, 
    Trophy, 
    Tag, 
    MapPin, 
    Clock, 
    ExternalLink, 
    Navigation, 
    Sparkles, 
    Filter, 
    Search, 
    CheckCircle2, 
    Flame, 
    Layers,
    SlidersHorizontal,
    Share2,
    Info,
    CalendarCheck,
    ArrowRight,
    Coins
} from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { Exhibition, extractCity } from '@/components/next-exhibition-card';
import { resolveMatchTeamsAndLogos } from '@/lib/sports-team-logos';
import { PredictionSection } from '@/components/prediction-section';

export type UnifiedEventType = 'exhibition' | 'prediction_basketball' | 'prediction_baseball' | 'prediction_soccer' | 'prediction_other';

export interface UnifiedCalendarEvent {
    id: string;
    type: UnifiedEventType;
    title: string;
    startDate: Date;
    endDate?: Date;
    timeStr?: string;
    location?: string;
    categoryLabel: string;
    statusBadge?: string;
    isHot?: boolean;
    rawExhibition?: Exhibition;
    rawPrediction?: any;
}

// 預設卡展資料（當 Firestore 暫時為空或載入中時提供即時豐富預覽）
const FALLBACK_EXHIBITIONS: Partial<Exhibition>[] = [
    {
        id: 'fb-exh-1',
        title: '2026 台北春季國際球員卡博覽會 (TCCE)',
        location: '台北市信義區松壽路 12 號 (信義威秀展演廳)',
        date: { seconds: Math.floor(new Date().getTime() / 1000) + 86400 * 2 },
        endDate: { seconds: Math.floor(new Date().getTime() / 1000) + 86400 * 4 },
        description: '全台年度首檔球員卡大展！集結全台超過 50 家頂級卡店與專門鑑定所，現場設立 PSA / BGS 專屬收件處，以及百位資深卡友大型交流拆盒專區。',
        officialUrl: 'https://example.com/tcce2026',
    },
    {
        id: 'fb-exh-2',
        title: '台中卡友交流交易市集 (TCG & Sports Cards)',
        location: '台中市西區台灣大道二段 (金典綠園道 6F)',
        date: { seconds: Math.floor(new Date().getTime() / 1000) + 86400 * 9 },
        endDate: { seconds: Math.floor(new Date().getTime() / 1000) + 86400 * 10 },
        description: '中部最大型卡友自發交流市集！提供免費寄賣桌與鑑定估價服務，憑 P+ 會員資格可領取限量紀念卡套與特展抽卡券。',
    },
    {
        id: 'fb-exh-3',
        title: '高雄巨蛋球星親筆簽名卡特展暨球卡同好會',
        location: '高雄市左營區博愛二路 757 號 (巨蛋體育館東側迴廊)',
        date: { seconds: Math.floor(new Date().getTime() / 1000) + 86400 * 16 },
        endDate: { seconds: Math.floor(new Date().getTime() / 1000) + 86400 * 17 },
        description: '南台灣年度重頭戲！現場展出破千萬等級喬丹、Kobe、大谷翔平珍稀簽名卡，並舉辦現場盲盒開箱團拆直播派對。',
    }
];

// 預設賽事預測資料（確保日曆隨時有賽事可看）
const FALLBACK_PREDICTIONS = [
    {
        id: 'fb-pred-1',
        matchName: '金州勇士 vs 洛杉磯湖人',
        category: 'NBA',
        targetDate: new Date(Date.now() + 86400 * 1000 * 1).toISOString(),
        options: [
            { text: '金州勇士 勝', odds: 1.85 },
            { text: '洛杉磯湖人 勝', odds: 1.95 }
        ],
        status: 'open',
        poolPoints: 125000,
        hot: true,
    },
    {
        id: 'fb-pred-2',
        matchName: '洛杉磯道奇 vs 紐約洋基',
        category: 'MLB',
        targetDate: new Date(Date.now() + 86400 * 1000 * 3).toISOString(),
        options: [
            { text: '洛杉磯道奇 勝', odds: 1.72 },
            { text: '紐約洋基 勝', odds: 2.10 }
        ],
        status: 'open',
        poolPoints: 98000,
        hot: true,
    },
    {
        id: 'fb-pred-3',
        matchName: '波士頓塞爾提克 vs 密爾瓦基公鹿',
        category: 'NBA',
        targetDate: new Date(Date.now() + 86400 * 1000 * 6).toISOString(),
        options: [
            { text: '波士頓塞爾提克 勝', odds: 1.80 },
            { text: '密爾瓦基公鹿 勝', odds: 2.05 }
        ],
        status: 'open',
        poolPoints: 85000,
    },
    {
        id: 'fb-pred-4',
        matchName: '皇家馬德里 vs 巴塞隆納 (經典德比)',
        category: 'SOCCER',
        targetDate: new Date(Date.now() + 86400 * 1000 * 12).toISOString(),
        options: [
            { text: '皇家馬德里 勝', odds: 2.10 },
            { text: '和局', odds: 3.40 },
            { text: '巴塞隆納 勝', odds: 2.65 }
        ],
        status: 'open',
        poolPoints: 160000,
        hot: true,
    }
];

interface UnifiedEventCalendarProps {
    hideHeader?: boolean;
    initialMode?: 'grid' | 'agenda';
    defaultCategory?: string;
    showSpotlight?: boolean;
}

export function UnifiedEventCalendar({ 
    hideHeader = false,
    initialMode = 'grid',
    defaultCategory = 'ALL',
    showSpotlight = true,
}: UnifiedEventCalendarProps) {
    const firestore = useFirestore();
    const { user } = useUser();

    // 檢視切換：月曆矩陣模式 (grid) 或 時間軸清單 (agenda)
    const [viewMode, setViewMode] = useState<'grid' | 'agenda'>(initialMode);
    // 當前瀏覽的月份
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    // 選中的特定日期（點擊日曆格子時高亮並展開當日行程）
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    // 分類篩選
    const [filterCategory, setFilterCategory] = useState<string>(defaultCategory.toUpperCase());
    // 關鍵字搜尋
    const [keyword, setKeyword] = useState<string>('');
    // 詳情彈窗
    const [activeModalEvent, setActiveModalEvent] = useState<UnifiedCalendarEvent | null>(null);
    // 賽事預測全功能跳窗（點擊競猜後彈出）
    const [isPredictionModalOpen, setIsPredictionModalOpen] = useState(false);

    const handleOpenPredictionModal = useCallback((_ev?: UnifiedCalendarEvent) => {
        setActiveModalEvent(null);
        setIsPredictionModalOpen(true);
    }, []);

    // 1. 取得 Firestore 中的卡展資料 (支援 card_exhibitions 與 exhibitions 集合)
    const exhQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
    }, [firestore]);
    const { data: rawExhibitions } = useCollection<Exhibition>(exhQuery);

    // 2. 取得 Firestore 中的賽事預測資料
    const predQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'predictionEvents'));
    }, [firestore]);
    const { data: rawPredictions } = useCollection<any>(predQuery);

    // 3. 雙軌資料統一整合成 UnifiedCalendarEvent[]
    const allUnifiedEvents = useMemo(() => {
        const events: UnifiedCalendarEvent[] = [];

        // 處理卡展
        const exList = (rawExhibitions && rawExhibitions.length > 0) ? rawExhibitions : FALLBACK_EXHIBITIONS;
        exList.forEach((exh: any) => {
            if (!exh.date?.seconds && !exh.date) return;
            const startDate = exh.date?.seconds ? new Date(exh.date.seconds * 1000) : new Date(exh.date);
            const endDate = exh.endDate?.seconds ? new Date(exh.endDate.seconds * 1000) : (exh.endDate ? new Date(exh.endDate) : startDate);
            
            events.push({
                id: `exh_${exh.id || Math.random()}`,
                type: 'exhibition',
                title: exh.title || '卡片特展',
                startDate,
                endDate,
                timeStr: format(startDate, 'MM/dd') + (isSameDay(startDate, endDate) ? '' : ` ~ ${format(endDate, 'MM/dd')}`),
                location: exh.location || '台灣境內展館',
                categoryLabel: '卡片展覽',
                statusBadge: '卡展盛事',
                isHot: true,
                rawExhibition: exh,
            });
        });

        // 處理賽事預測
        const predList = (rawPredictions && rawPredictions.length > 0) ? rawPredictions : FALLBACK_PREDICTIONS;
        predList.forEach((pred: any) => {
            let eventDate: Date;
            if (pred.targetDate) {
                eventDate = new Date(pred.targetDate);
            } else if (pred.date?.seconds) {
                eventDate = new Date(pred.date.seconds * 1000);
            } else if (pred.createdAt?.seconds) {
                eventDate = new Date(pred.createdAt.seconds * 1000);
            } else {
                eventDate = new Date();
            }

            const cat = (pred.category || 'NBA').toUpperCase();
            let eventType: UnifiedEventType = 'prediction_other';
            let catLabel = '體育賽事';
            if (cat.includes('NBA') || cat.includes('BASKETBALL') || cat.includes('籃球') || cat.includes('PLG') || cat.includes('TPBL')) {
                eventType = 'prediction_basketball';
                catLabel = '籃球預測';
            } else if (cat.includes('MLB') || cat.includes('BASEBALL') || cat.includes('棒球') || cat.includes('中職') || cat.includes('CPBL')) {
                eventType = 'prediction_baseball';
                catLabel = '棒球預測';
            } else if (cat.includes('SOCCER') || cat.includes('FOOTBALL') || cat.includes('足球') || cat.includes('英超')) {
                eventType = 'prediction_soccer';
                catLabel = '足球預測';
            }

            events.push({
                id: `pred_${pred.id || Math.random()}`,
                type: eventType,
                title: pred.matchName || `${pred.teamA || '主隊'} vs ${pred.teamB || '客隊'}`,
                startDate: eventDate,
                endDate: eventDate,
                timeStr: format(eventDate, 'HH:mm'),
                location: pred.location || '體育競技場',
                categoryLabel: catLabel,
                statusBadge: pred.status === 'closed' ? '即將開賽' : (pred.status === 'finished' ? '已結束' : '開放競猜中'),
                isHot: Boolean(pred.hot || (pred.poolPoints && pred.poolPoints > 50000)),
                rawPrediction: pred,
            });
        });

        // 依日期排序
        return events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    }, [rawExhibitions, rawPredictions]);

    // 4. 根據分類與關鍵字篩選
    const filteredEvents = useMemo(() => {
        return allUnifiedEvents.filter(ev => {
            // 分類篩選
            if (filterCategory === 'EXHIBITION' && ev.type !== 'exhibition') return false;
            if (filterCategory === 'BASKETBALL' && ev.type !== 'prediction_basketball') return false;
            if (filterCategory === 'BASEBALL' && ev.type !== 'prediction_baseball') return false;
            if (filterCategory === 'SOCCER' && ev.type !== 'prediction_soccer') return false;
            if (filterCategory === 'HOT' && !ev.isHot) return false;

            // 關鍵字搜尋
            if (keyword.trim()) {
                const kw = keyword.trim().toLowerCase();
                const matchTitle = ev.title.toLowerCase().includes(kw);
                const matchLoc = ev.location ? ev.location.toLowerCase().includes(kw) : false;
                const matchCat = ev.categoryLabel.toLowerCase().includes(kw);
                if (!matchTitle && !matchLoc && !matchCat) return false;
            }

            return true;
        });
    }, [allUnifiedEvents, filterCategory, keyword]);

    // 月曆計算邏輯 (Month Matrix)
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 週日開始
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const daysMatrix = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // 檢查某一天是否有特定事件
    const getEventsForDay = useCallback((day: Date) => {
        return filteredEvents.filter(ev => {
            if (ev.type === 'exhibition') {
                // 卡展可能跨多天
                const start = new Date(ev.startDate);
                start.setHours(0, 0, 0, 0);
                const end = ev.endDate ? new Date(ev.endDate) : new Date(ev.startDate);
                end.setHours(23, 59, 59, 999);
                return day >= start && day <= end;
            } else {
                return isSameDay(day, ev.startDate);
            }
        });
    }, [filteredEvents]);

    // 當前選中日期的所有事件
    const selectedDayEvents = useMemo(() => {
        return getEventsForDay(selectedDate);
    }, [selectedDate, getEventsForDay]);

    // 切換月份
    const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
    const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
    const goToToday = () => {
        const today = new Date();
        setCurrentMonth(today);
        setSelectedDate(today);
    };

    // 取得最近一場卡展（優先挑選尚未結束且日期最近的卡展）
    const nearestExhibition = useMemo(() => {
        const exhibitions = allUnifiedEvents.filter(ev => ev.type === 'exhibition');
        if (exhibitions.length === 0) return null;
        
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const upcoming = exhibitions.filter(ev => {
            const end = ev.endDate ? new Date(ev.endDate) : new Date(ev.startDate);
            end.setHours(23, 59, 59, 999);
            return end >= todayStart;
        });

        if (upcoming.length > 0) {
            return upcoming.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
        }
        return exhibitions[exhibitions.length - 1];
    }, [allUnifiedEvents]);

    // 取得最近一場預測賽事（優先挑選即將開賽或開放競猜中的賽事）
    const nearestPrediction = useMemo(() => {
        const predictions = allUnifiedEvents.filter(ev => ev.type !== 'exhibition');
        if (predictions.length === 0) return null;

        const now = new Date();
        const upcoming = predictions.filter(ev => {
            const raw = ev.rawPrediction;
            if (raw && (raw.status === 'finished' || raw.status === 'closed_settled')) return false;
            return ev.startDate.getTime() >= (now.getTime() - 2 * 60 * 60 * 1000);
        });

        if (upcoming.length > 0) {
            return upcoming.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())[0];
        }
        return predictions[0];
    }, [allUnifiedEvents]);

    // 最近卡展倒數狀態計算
    const exhCountdown = useMemo(() => {
        if (!nearestExhibition) return null;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(nearestExhibition.startDate);
        start.setHours(0, 0, 0, 0);
        const end = nearestExhibition.endDate ? new Date(nearestExhibition.endDate) : new Date(nearestExhibition.startDate);
        end.setHours(23, 59, 59, 999);

        if (today >= start && today <= end) {
            return { text: '🔥 展期進行中', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' };
        }
        const days = differenceInCalendarDays(start, today);
        if (days === 0) {
            return { text: '⚡ 今日開展', badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' };
        } else if (days === 1) {
            return { text: '⏳ 明日開展', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' };
        } else if (days > 1) {
            return { text: `⏳ 倒數 ${days} 天`, badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' };
        } else {
            return { text: '已圓滿閉幕', badgeClass: 'bg-slate-700/50 text-slate-400 border-slate-700' };
        }
    }, [nearestExhibition]);

    // 最近預測賽事倒數狀態計算
    const predMatchCountdown = useMemo(() => {
        if (!nearestPrediction) return null;
        const now = new Date();
        const diffMs = nearestPrediction.startDate.getTime() - now.getTime();
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

        if (diffMs <= 0) {
            return { text: '⚡ 賽事進行中', badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' };
        } else if (diffHours <= 24) {
            return { text: `⏰ 約 ${Math.max(1, diffHours)} 小時後開賽`, badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold' };
        } else {
            return { text: `📅 倒數 ${diffDays} 天開打`, badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' };
        }
    }, [nearestPrediction]);

    const formatMatchDate = (date: Date) => {
        const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        const hh = String(date.getHours()).padStart(2, '0');
        const mm = String(date.getMinutes()).padStart(2, '0');
        const day = days[date.getDay()];
        return `${m}/${d} (${day}) ${hh}:${mm}`;
    };

    return (
        <div className="w-full space-y-6">
            
            {/* 標題與介紹區塊：乾淨只留 "卡展/賽事行事曆" */}
            {!hideHeader && (
                <div className="text-center space-y-2 pb-2 pt-1 relative">
                    <h1 className="text-2xl sm:text-4xl font-black font-headline tracking-tight text-white">
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-sky-300 to-amber-400">
                            卡展/賽事行事曆
                        </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-slate-400 max-w-xl mx-auto">
                        全台卡展巡迴展訊與熱門賽事對決行程 · 點擊賽事即可跳窗參與競猜預測
                    </p>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 上面區域：最近一場卡展的資訊 × 最近一場預測賽事的資訊 */}
            {/* ========================================================================= */}
            {showSpotlight && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* 卡片 1: 最近一場卡展資訊 */}
                    {nearestExhibition ? (
                        <div 
                            onClick={() => setActiveModalEvent(nearestExhibition)}
                            className="group relative cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-br from-cyan-950/40 via-slate-900/95 to-slate-950 border border-cyan-500/30 hover:border-cyan-400/80 p-4 sm:p-5 transition-all duration-300 shadow-xl shadow-cyan-950/30 hover:shadow-cyan-500/10 flex flex-col justify-between gap-3.5"
                        >
                            {/* 背景霓虹光暈 */}
                            <div className="absolute top-0 right-0 w-44 h-44 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/20 transition-all" />

                            <div className="relative z-10 space-y-3">
                                {/* 頂部標籤列 */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <Badge className="bg-cyan-500/20 border-cyan-500/40 text-cyan-300 text-xs font-black px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                                            <Tag className="w-3.5 h-3.5" />
                                            最近一場卡展
                                        </Badge>
                                        <Badge variant="outline" className="border-slate-700 bg-slate-900/80 text-slate-300 text-[11px] px-2 py-0.5">
                                            {extractCity(nearestExhibition.location)}
                                        </Badge>
                                    </div>

                                    {exhCountdown && (
                                        <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0", exhCountdown.badgeClass)}>
                                            {exhCountdown.text}
                                        </span>
                                    )}
                                </div>

                                {/* 卡展標題 */}
                                <h3 className="text-base sm:text-lg font-black text-white group-hover:text-cyan-300 transition-colors line-clamp-1 leading-snug">
                                    {nearestExhibition.title}
                                </h3>

                                {/* 重點資訊列表 */}
                                <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
                                    <div className="flex items-center gap-2">
                                        <CalendarIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                        <span className="font-mono text-cyan-200 font-semibold">{nearestExhibition.timeStr}</span>
                                    </div>
                                    {nearestExhibition.location && (
                                        <div className="flex items-center gap-2 truncate">
                                            <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                            <span className="truncate text-slate-300">{nearestExhibition.location}</span>
                                        </div>
                                    )}
                                    {nearestExhibition.rawExhibition?.description && (
                                        <p className="text-[11px] text-slate-400 line-clamp-1 pt-0.5">
                                            {nearestExhibition.rawExhibition.description}
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* 底部動作列 */}
                            <div className="relative z-10 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                                <span className="text-[11px] text-slate-400 font-medium">點擊卡片瀏覽特展內容</span>
                                <div className="flex items-center gap-2">
                                    {nearestExhibition.location && (
                                        <a
                                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(nearestExhibition.location)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            onClick={(e) => e.stopPropagation()}
                                            className="px-2.5 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-700/80 hover:border-slate-600 flex items-center gap-1 transition-all"
                                        >
                                            <Navigation className="w-3 h-3 text-cyan-400" />
                                            <span>導航</span>
                                        </a>
                                    )}
                                    <Button
                                        size="sm"
                                        className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs h-8 px-3 shadow-md shadow-cyan-500/20"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveModalEvent(nearestExhibition);
                                        }}
                                    >
                                        <span>查看展訊</span>
                                        <ArrowRight className="w-3 h-3 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-1.5 flex flex-col items-center justify-center">
                            <Tag className="w-6 h-6 text-slate-600" />
                            <p className="text-xs text-slate-400 font-bold">目前無即將舉行的卡展</p>
                        </div>
                    )}

                    {/* 卡片 2: 最近一場預測賽事資訊 */}
                    {nearestPrediction ? (
                        <div 
                            onClick={() => setActiveModalEvent(nearestPrediction)}
                            className="group relative cursor-pointer overflow-hidden rounded-3xl bg-gradient-to-br from-amber-950/40 via-slate-900/95 to-slate-950 border border-amber-500/30 hover:border-amber-400/80 p-4 sm:p-5 transition-all duration-300 shadow-xl shadow-amber-950/30 hover:shadow-amber-500/10 flex flex-col justify-between gap-3.5"
                        >
                            {/* 背景霓虹光暈 */}
                            <div className="absolute top-0 right-0 w-44 h-44 bg-amber-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-amber-500/20 transition-all" />

                            <div className="relative z-10 space-y-3">
                                {/* 頂部標籤列 */}
                                <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <Badge className="bg-amber-500/20 border-amber-500/40 text-amber-300 text-xs font-black px-2.5 py-0.5 rounded-lg flex items-center gap-1">
                                            <Trophy className="w-3.5 h-3.5" />
                                            最近一場預測賽事
                                        </Badge>
                                        <Badge variant="outline" className="border-slate-700 bg-slate-900/80 text-amber-200 text-[11px] px-2 py-0.5 font-bold">
                                            {nearestPrediction.categoryLabel}
                                        </Badge>
                                    </div>

                                    {predMatchCountdown && (
                                        <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full border shrink-0", predMatchCountdown.badgeClass)}>
                                            {predMatchCountdown.text}
                                        </span>
                                    )}
                                </div>

                                {/* 賽事標題 */}
                                <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors line-clamp-1 leading-snug">
                                    {nearestPrediction.title}
                                </h3>

                                {/* 重點資訊列表 */}
                                <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/70 p-3 rounded-2xl border border-slate-800/80">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                            <span className="font-mono text-amber-200 font-semibold">
                                                {formatMatchDate(nearestPrediction.startDate)}
                                            </span>
                                        </div>
                                        {nearestPrediction.rawPrediction?.poolPoints && (
                                            <div className="flex items-center gap-1 text-[11px] text-amber-300 font-bold shrink-0">
                                                <Coins className="w-3 h-3 text-amber-400" />
                                                <span>{(nearestPrediction.rawPrediction.poolPoints).toLocaleString()} P+ 獎池</span>
                                            </div>
                                        )}
                                    </div>
                                    {nearestPrediction.rawPrediction?.options && nearestPrediction.rawPrediction.options.length > 0 && (
                                        <div className="flex items-center gap-2 pt-0.5">
                                            <span className="text-[11px] text-slate-400 shrink-0">熱門競猜：</span>
                                            <div className="flex items-center gap-1.5 truncate">
                                                {nearestPrediction.rawPrediction.options.map((opt: any, idx: number) => (
                                                    <span key={idx} className="text-[11px] bg-slate-900 px-2 py-0.5 rounded-md text-slate-300 border border-slate-800">
                                                        {opt.text} <span className="text-amber-400 font-mono font-bold">x{opt.odds}</span>
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 底部動作列 */}
                            <div className="relative z-10 flex items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
                                <span className="text-[11px] text-slate-400 font-medium">競猜瓜分海量點數獎池</span>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold rounded-xl text-xs h-8 px-3"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveModalEvent(nearestPrediction);
                                        }}
                                    >
                                        <span>對決情報</span>
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs h-8 px-3 shadow-md shadow-amber-500/20 cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenPredictionModal(nearestPrediction);
                                        }}
                                    >
                                        <span>前往競猜</span>
                                        <ArrowRight className="w-3 h-3 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-1.5 flex flex-col items-center justify-center">
                            <Trophy className="w-6 h-6 text-slate-600" />
                            <p className="text-xs text-slate-400 font-bold">目前無即將進行的賽事預測</p>
                        </div>
                    )}
                </div>
            )}

            {/* 控制列：模式切換、搜尋、篩選按鈕群 */}
            <div className="bg-slate-900/90 p-3 sm:p-4 rounded-3xl border border-slate-800/90 shadow-xl backdrop-blur-xl space-y-3.5">
                
                {/* 第一列：檢視模式 + 關鍵字搜尋 */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* 月曆網格 vs 時間軸切換 */}
                    <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800 shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                                viewMode === 'grid'
                                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20"
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <CalendarIcon className="w-3.5 h-3.5" />
                            <span>月曆網格</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('agenda')}
                            className={cn(
                                "flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer",
                                viewMode === 'agenda'
                                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20"
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>行程時間軸</span>
                        </button>
                    </div>

                    {/* 搜尋框 */}
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <Input
                            placeholder="搜尋卡展名稱、NBA/MLB球隊、場館城市..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white pl-10 pr-4 h-10 rounded-2xl text-xs placeholder:text-slate-500 focus-visible:ring-cyan-500"
                        />
                    </div>

                    {/* 回到今天捷徑與賽事競猜快速按鈕 */}
                    <div className="flex items-center gap-2 shrink-0">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={goToToday}
                            className="border-slate-700/80 bg-slate-950 hover:bg-slate-800 text-cyan-400 font-bold rounded-xl h-10 px-3 text-xs shrink-0 cursor-pointer"
                        >
                            <CalendarCheck className="w-3.5 h-3.5 mr-1" />
                            回到今天
                        </Button>
                        <Button
                            size="sm"
                            onClick={() => handleOpenPredictionModal()}
                            className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl h-10 px-3.5 text-xs shadow-md shadow-amber-500/20 cursor-pointer flex items-center gap-1.5 shrink-0"
                        >
                            <Trophy className="w-3.5 h-3.5" />
                            <span>賽事競猜</span>
                        </Button>
                    </div>
                </div>

                {/* 第二列：快速分類徽章按鈕 */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
                    {[
                        { id: 'ALL', label: '🌟 全部精彩', color: 'border-slate-700 text-slate-300' },
                        { id: 'HOT', label: '🔥 熱門焦點', color: 'border-rose-500/40 text-rose-300' },
                        { id: 'EXHIBITION', label: '🏷️ 卡片展覽', color: 'border-cyan-500/40 text-cyan-300' },
                        { id: 'BASKETBALL', label: '🏀 籃球賽事', color: 'border-amber-500/40 text-amber-300' },
                        { id: 'BASEBALL', label: '⚾ 棒球賽事', color: 'border-emerald-500/40 text-emerald-300' },
                        { id: 'SOCCER', label: '⚽ 足球賽事', color: 'border-indigo-500/40 text-indigo-300' },
                    ].map(item => (
                        <button
                            key={item.id}
                            onClick={() => setFilterCategory(item.id)}
                            className={cn(
                                "px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer border text-xs flex items-center gap-1",
                                filterCategory === item.id
                                    ? "bg-slate-800 border-cyan-400 text-cyan-300 shadow-sm"
                                    : `bg-slate-950/70 hover:bg-slate-800/80 ${item.color}`
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 視圖 A：月曆網格矩陣 (Month Grid Matrix) */}
            {/* ========================================================================= */}
            {viewMode === 'grid' && (
                <div className="space-y-5">
                    {/* 月曆主卡片 */}
                    <div className="rounded-3xl bg-slate-900/90 border border-slate-800/90 p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
                        
                        {/* 月份導覽列 */}
                        <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
                            <div className="flex items-center gap-3">
                                <h2 className="text-xl sm:text-2xl font-black text-white font-headline">
                                    {format(currentMonth, 'yyyy 年 M 月')}
                                </h2>
                                <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30 text-[11px] font-mono">
                                    {filteredEvents.length} 項排定活動
                                </Badge>
                            </div>

                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={prevMonth}
                                    className="w-9 h-9 rounded-xl border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </Button>
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={nextMonth}
                                    className="w-9 h-9 rounded-xl border-slate-800 bg-slate-950 hover:bg-slate-800 text-slate-300"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>

                        {/* 星期標頭 */}
                        <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center text-xs font-bold text-slate-400 uppercase tracking-wider">
                            {['日', '一', '二', '三', '四', '五', '六'].map((day, idx) => (
                                <div key={day} className={cn("py-1", (idx === 0 || idx === 6) && "text-rose-400/90")}>
                                    週{day}
                                </div>
                            ))}
                        </div>

                        {/* 日期網格 */}
                        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                            {daysMatrix.map((dayItem, index) => {
                                const isCurrentMonth = isSameMonth(dayItem, currentMonth);
                                const isTodayDate = isToday(dayItem);
                                const isSelected = isSameDay(dayItem, selectedDate);
                                const dayEvents = getEventsForDay(dayItem);

                                return (
                                    <div
                                        key={index}
                                        onClick={() => setSelectedDate(dayItem)}
                                        className={cn(
                                            "min-h-[85px] sm:min-h-[110px] p-1.5 sm:p-2 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group relative overflow-hidden",
                                            isCurrentMonth ? "bg-slate-950/60" : "bg-slate-950/20 opacity-40",
                                            isSelected 
                                                ? "border-cyan-400 ring-2 ring-cyan-500/30 bg-cyan-950/20 shadow-lg" 
                                                : "border-slate-800/80 hover:border-slate-700 hover:bg-slate-900/60",
                                            isTodayDate && !isSelected && "border-amber-500/60 bg-amber-950/10"
                                        )}
                                    >
                                        {/* 日期數字與當日徽章 */}
                                        <div className="flex items-center justify-between">
                                            <span className={cn(
                                                "text-xs sm:text-sm font-black w-6 h-6 rounded-lg flex items-center justify-center",
                                                isTodayDate ? "bg-amber-500 text-slate-950 font-black shadow-sm" : (isSelected ? "bg-cyan-500 text-slate-950" : "text-slate-300")
                                            )}>
                                                {format(dayItem, 'd')}
                                            </span>

                                            {dayEvents.length > 0 && (
                                                <span className="text-[10px] font-bold text-slate-400 font-mono">
                                                    {dayEvents.length}
                                                </span>
                                            )}
                                        </div>

                                        {/* 格子內迷你活動標籤列表 (最多顯示 2 筆，其他以 +N 表示) */}
                                        <div className="space-y-1 my-1 overflow-hidden">
                                            {dayEvents.slice(0, 2).map((ev) => {
                                                const isExh = ev.type === 'exhibition';
                                                return (
                                                    <div
                                                        key={ev.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveModalEvent(ev);
                                                        }}
                                                        className={cn(
                                                            "text-[9px] sm:text-[10px] px-1.5 py-0.5 rounded truncate font-bold flex items-center gap-1 transition-transform hover:scale-[1.02]",
                                                            isExh 
                                                                ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30" 
                                                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                                        )}
                                                        title={ev.title}
                                                    >
                                                        {isExh ? <Tag className="w-2.5 h-2.5 shrink-0" /> : <Trophy className="w-2.5 h-2.5 shrink-0" />}
                                                        <span className="truncate">{ev.title}</span>
                                                    </div>
                                                );
                                            })}

                                            {dayEvents.length > 2 && (
                                                <div className="text-[9px] text-slate-400 font-bold text-center">
                                                    +{dayEvents.length - 2} 更多
                                                </div>
                                            )}
                                        </div>

                                        {/* 底部微型進度裝飾 */}
                                        <div className="h-0.5 w-full bg-slate-800/40 rounded-full overflow-hidden">
                                            {dayEvents.length > 0 && (
                                                <div 
                                                    className={cn(
                                                        "h-full rounded-full",
                                                        dayEvents.some(e => e.type === 'exhibition') ? "bg-cyan-400" : "bg-amber-400"
                                                    )} 
                                                    style={{ width: `${Math.min(100, dayEvents.length * 35)}%` }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 下方聯動選中日期行程詳情 (Selected Date Detail Panel) */}
                    <div className="rounded-3xl bg-slate-900/90 border border-slate-800 p-5 sm:p-6 shadow-xl backdrop-blur-xl space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400">
                                    <Clock className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-base sm:text-lg font-black text-white">
                                        {format(selectedDate, 'yyyy 年 MM 月 dd 日')} ({['週日', '週一', '週二', '週三', '週四', '週五', '週六'][selectedDate.getDay()]}) 行程活動
                                    </h3>
                                    <span className="text-xs text-slate-400">
                                        當日排定 {selectedDayEvents.length} 場精彩活動 (卡展 / 賽事預測)
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* 活動卡片清單 */}
                        {selectedDayEvents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                {selectedDayEvents.map(ev => (
                                    <div
                                        key={ev.id}
                                        onClick={() => setActiveModalEvent(ev)}
                                        className={cn(
                                            "p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between group",
                                            ev.type === 'exhibition'
                                                ? "bg-slate-950/80 border-cyan-500/30 hover:border-cyan-400 hover:shadow-cyan-500/10"
                                                : "bg-slate-950/80 border-amber-500/30 hover:border-amber-400 hover:shadow-amber-500/10",
                                            "hover:shadow-lg"
                                        )}
                                    >
                                        <div className="space-y-2">
                                            <div className="flex items-center justify-between gap-2">
                                                <Badge className={cn(
                                                    "text-[10px] font-black px-2 py-0.5",
                                                    ev.type === 'exhibition'
                                                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                                )}>
                                                    {ev.categoryLabel}
                                                </Badge>

                                                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                                                    <Clock className="w-3 h-3" />
                                                    {ev.timeStr}
                                                </span>
                                            </div>

                                            <h4 className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors line-clamp-2">
                                                {ev.title}
                                            </h4>

                                            {ev.location && (
                                                <p className="text-xs text-slate-400 flex items-center gap-1 truncate">
                                                    <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                                                    <span className="truncate">{ev.location}</span>
                                                </p>
                                            )}
                                        </div>

                                        <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                            <span className="text-[11px] text-slate-500">點擊查看詳情</span>
                                            {ev.type === 'exhibition' ? (
                                                <span className="text-cyan-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                                                    展訊詳情 ➜
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    className="text-amber-400 hover:text-amber-300 font-black flex items-center gap-1 group-hover:translate-x-0.5 transition-transform cursor-pointer"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleOpenPredictionModal(ev);
                                                    }}
                                                >
                                                    前往競猜 ➜
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-8 rounded-2xl bg-slate-950/50 border border-slate-800/60 text-center space-y-2">
                                <CalendarIcon className="w-8 h-8 text-slate-600 mx-auto" />
                                <p className="text-xs sm:text-sm text-slate-400 font-bold">該日期暫無排定的公開活動或賽事</p>
                                <p className="text-[11px] text-slate-500">歡迎點擊其他有彩色標籤的日期，或直接查看下方「行程時間軸」。</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 視圖 B：行程時間軸清單 (Agenda Timeline View) */}
            {/* ========================================================================= */}
            {viewMode === 'agenda' && (
                <div className="space-y-4">
                    {filteredEvents.length > 0 ? (
                        filteredEvents.map((ev) => {
                            const isExh = ev.type === 'exhibition';
                            return (
                                <div
                                    key={ev.id}
                                    onClick={() => setActiveModalEvent(ev)}
                                    className={cn(
                                        "p-4 sm:p-5 rounded-3xl border transition-all cursor-pointer relative overflow-hidden backdrop-blur-xl group flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4",
                                        isExh
                                            ? "bg-slate-900/90 border-slate-800 hover:border-cyan-500/50 hover:shadow-cyan-500/10 shadow-lg"
                                            : "bg-slate-900/90 border-slate-800 hover:border-amber-500/50 hover:shadow-amber-500/10 shadow-lg"
                                    )}
                                >
                                    {/* 左側日期標籤 */}
                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className={cn(
                                            "w-14 h-14 rounded-2xl flex flex-col items-center justify-center text-center p-1 border",
                                            isExh
                                                ? "bg-cyan-500/10 border-cyan-500/30 text-cyan-400"
                                                : "bg-amber-500/10 border-amber-500/30 text-amber-400"
                                        )}>
                                            <span className="text-[10px] font-bold uppercase">
                                                {format(ev.startDate, 'MMM')}
                                            </span>
                                            <span className="text-lg font-black leading-none">
                                                {format(ev.startDate, 'd')}
                                            </span>
                                        </div>

                                        <div>
                                            <div className="flex items-center gap-2">
                                                <Badge className={cn(
                                                    "text-[10px] font-black px-2 py-0.5",
                                                    isExh
                                                        ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                                )}>
                                                    {ev.categoryLabel}
                                                </Badge>
                                                <span className="text-xs text-slate-400 font-mono">
                                                    {ev.timeStr}
                                                </span>
                                            </div>
                                            <h3 className="text-sm sm:text-base font-black text-white mt-1 group-hover:text-cyan-300 transition-colors">
                                                {ev.title}
                                            </h3>
                                        </div>
                                    </div>

                                    {/* 右側地點與操作按鈕 */}
                                    <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto border-t sm:border-t-0 pt-3 sm:pt-0 border-slate-800">
                                        {ev.location && (
                                            <div className="text-xs text-slate-400 flex items-center gap-1 truncate max-w-[200px]">
                                                <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                <span className="truncate">{ev.location}</span>
                                            </div>
                                        )}

                                        <Button
                                            size="sm"
                                            className={cn(
                                                "font-black rounded-xl text-xs h-9 px-4 shrink-0 shadow-md cursor-pointer",
                                                isExh
                                                    ? "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                                                    : "bg-amber-500 hover:bg-amber-400 text-slate-950"
                                            )}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (isExh) {
                                                    setActiveModalEvent(ev);
                                                } else {
                                                    handleOpenPredictionModal(ev);
                                                }
                                            }}
                                        >
                                            {isExh ? '查看展訊' : '前往競猜'}
                                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-12 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-3">
                            <Search className="w-10 h-10 text-slate-600 mx-auto" />
                            <p className="text-sm text-slate-300 font-bold">沒有找到符合條件的活動或賽事</p>
                            <p className="text-xs text-slate-500">嘗試清除搜尋條件或選擇「全部精彩」分類。</p>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* 活動詳細彈窗 (Detail Modal) */}
            {/* ========================================================================= */}
            <Dialog open={Boolean(activeModalEvent)} onOpenChange={(open) => !open && setActiveModalEvent(null)}>
                <DialogContent className="max-w-lg bg-slate-950 text-white border-slate-800 p-0 rounded-3xl overflow-hidden shadow-2xl">
                    {activeModalEvent && (
                        <div>
                            {/* 頂部彩色條 */}
                            <div className={cn(
                                "h-2 w-full",
                                activeModalEvent.type === 'exhibition'
                                    ? "bg-gradient-to-r from-cyan-500 to-blue-500"
                                    : "bg-gradient-to-r from-amber-500 to-yellow-500"
                            )} />

                            <div className="p-6 space-y-4">
                                <DialogHeader className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Badge className={cn(
                                            "text-xs font-black px-2.5 py-1",
                                            activeModalEvent.type === 'exhibition'
                                                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40"
                                                : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                                        )}>
                                            {activeModalEvent.categoryLabel}
                                        </Badge>

                                        <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            {format(activeModalEvent.startDate, 'yyyy/MM/dd')}
                                        </span>
                                    </div>

                                    <DialogTitle className="text-lg sm:text-xl font-black text-white text-left leading-snug">
                                        {activeModalEvent.title}
                                    </DialogTitle>
                                </DialogHeader>

                                {/* 地點與時間資訊 */}
                                <div className="space-y-2.5 p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs">
                                    {activeModalEvent.location && (
                                        <div className="flex items-start gap-2 text-slate-300">
                                            <MapPin className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                            <div>
                                                <span className="text-slate-400 block font-semibold text-[11px]">活動場館地點</span>
                                                <span>{activeModalEvent.location}</span>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-start gap-2 text-slate-300">
                                        <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="text-slate-400 block font-semibold text-[11px]">活動排程</span>
                                            <span>{activeModalEvent.timeStr}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* 若為卡展，呈現說明與地圖導航按鈕 */}
                                {activeModalEvent.type === 'exhibition' && (
                                    <div className="space-y-3">
                                        {activeModalEvent.rawExhibition?.description && (
                                            <div className="space-y-1 p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800/80">
                                                <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                                                    <Info className="w-3.5 h-3.5 text-cyan-400" />
                                                    特展說明
                                                </span>
                                                <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                    {activeModalEvent.rawExhibition.description}
                                                </p>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 pt-2">
                                            {activeModalEvent.location && (
                                                <Button
                                                    asChild
                                                    className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black rounded-xl h-11 text-xs sm:text-sm shadow-lg shadow-cyan-500/20"
                                                >
                                                    <a 
                                                        href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(activeModalEvent.location)}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                    >
                                                        <Navigation className="w-4 h-4 mr-1.5" />
                                                        Google 地圖導航
                                                        <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-75" />
                                                    </a>
                                                </Button>
                                            )}
                                            <DialogClose asChild>
                                                <Button
                                                    variant="outline"
                                                    className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold rounded-xl h-11 text-xs sm:text-sm px-4 shrink-0"
                                                >
                                                    關閉
                                                </Button>
                                            </DialogClose>
                                        </div>
                                    </div>
                                )}

                                {/* 若為賽事預測，引導前往預測競猜擂台 */}
                                {activeModalEvent.type !== 'exhibition' && (
                                    <div className="space-y-3">
                                        <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 space-y-1">
                                            <p className="font-bold flex items-center gap-1">
                                                <Trophy className="w-3.5 h-3.5" />
                                                即時賽事預測競技
                                            </p>
                                            <p className="text-[11px] text-slate-300">
                                                預測猜中即可瓜分龐大 P+ 點數獎池，並累積神準榜名次！
                                            </p>
                                        </div>

                                        <div className="flex items-center gap-2 pt-2">
                                            <Button
                                                className="flex-1 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl h-11 text-xs sm:text-sm shadow-lg shadow-amber-500/20 cursor-pointer"
                                                onClick={() => {
                                                    handleOpenPredictionModal(activeModalEvent);
                                                }}
                                            >
                                                <Trophy className="w-4 h-4 mr-1.5" />
                                                前往賽事預測擂台下注
                                                <ArrowRight className="w-4 h-4 ml-1" />
                                            </Button>
                                            <DialogClose asChild>
                                                <Button
                                                    variant="outline"
                                                    className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold rounded-xl h-11 text-xs sm:text-sm px-4 shrink-0"
                                                >
                                                    關閉
                                                </Button>
                                            </DialogClose>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* ========================================================================= */}
            {/* 賽事預測全功能跳窗（點擊競猜之後跳窗出現現在原有的賽事預測資訊） */}
            {/* ========================================================================= */}
            <Dialog open={isPredictionModalOpen} onOpenChange={setIsPredictionModalOpen}>
                <DialogContent className="max-w-5xl w-[95vw] sm:w-[90vw] max-h-[90vh] bg-slate-950 text-white border-slate-800 p-0 rounded-3xl overflow-hidden shadow-2xl flex flex-col z-[100]">
                    {/* 頂部色彩橫條 */}
                    <div className="h-1.5 w-full bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 shrink-0" />
                    
                    {/* 彈窗標題列 */}
                    <div className="bg-gradient-to-r from-amber-950/80 via-slate-900 to-slate-950 px-5 sm:px-6 py-4 border-b border-slate-800/80 flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 rounded-2xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-md shadow-amber-500/20">
                                <Trophy className="w-5 h-5" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h3 className="text-base sm:text-lg font-black text-white">
                                        體育賽事即時競猜
                                    </h3>
                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-[10px] font-black">
                                        即時競猜
                                    </Badge>
                                </div>
                                <p className="text-xs text-slate-400">
                                    即時對決盤口 · 智慧賠率試算 · 累積神準榜名次
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 彈窗內容：完整的賽事預測資訊 (PredictionSection) */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-thin scrollbar-thumb-slate-800">
                        <PredictionSection 
                            hideHeader={true} 
                            showStatsAndLeaderboard={true}
                        />
                    </div>
                </DialogContent>
            </Dialog>

        </div>
    );
}
