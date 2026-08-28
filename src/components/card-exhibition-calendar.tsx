'use client';

import React, { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { format, differenceInCalendarDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogClose,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
    Calendar as CalendarIcon,
    Clock,
    MapPin,
    ExternalLink,
    Sparkles,
    Info,
    Search,
    Navigation,
    LayoutGrid,
    ListFilter,
    Flame,
    ChevronRight,
    Compass,
    Ticket,
} from 'lucide-react';
import { NextExhibitionCard, extractCity, getCityTheme, type Exhibition } from '@/components/next-exhibition-card';

const REGIONS = [
    { label: '全部地區', value: 'ALL' },
    { label: '北部', value: 'NORTH', cities: ['台北', '新北', '基隆', '桃園', '新竹', '宜蘭'] },
    { label: '中部', value: 'CENTRAL', cities: ['台中', '彰化', '南投', '苗栗', '雲林'] },
    { label: '南部', value: 'SOUTH', cities: ['台南', '高雄', '屏東', '嘉義'] },
    { label: '東部/離島', value: 'EAST_ISLAND', cities: ['花蓮', '台東', '澎湖', '金門', '馬祖'] },
];

const getFormattedFullDate = (date: Date) => {
    const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const day = days[date.getDay()];
    return `${y}年${m}月${d}日 (${day})`;
};

interface CardExhibitionCalendarProps {
    hideHeader?: boolean;
    showNextHighlight?: boolean;
}

export function CardExhibitionCalendar({ 
    hideHeader = false,
    showNextHighlight = false,
}: CardExhibitionCalendarProps) {
    const firestore = useFirestore();
    const [selectedExh, setSelectedExh] = useState<Exhibition | null>(null);
    const [selectedRegion, setSelectedRegion] = useState<string>('ALL');
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

    const q = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
    }, [firestore]);

    const { data: exhibitions, isLoading } = useCollection<Exhibition>(q);

    // 取得所有未結束的活動
    const upcomingExhibitions = useMemo(() => {
        if (!exhibitions) return [];
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const todaySeconds = Math.floor(startOfToday.getTime() / 1000);

        return exhibitions.filter(exh => {
            const effectiveEndSeconds = exh.endDate?.seconds 
                ? exh.endDate.seconds + 86399 
                : (exh.date?.seconds ? exh.date.seconds + 86399 : 0);
            return effectiveEndSeconds >= todaySeconds;
        }).sort((a, b) => (a.date?.seconds || 0) - (b.date?.seconds || 0));
    }, [exhibitions]);

    // 第一筆即為「下一場即將登場卡展」
    const nextExhibition = upcomingExhibitions.length > 0 ? upcomingExhibitions[0] : null;

    // 篩選地區與關鍵字
    const filteredExhibitions = useMemo(() => {
        return upcomingExhibitions.filter(exh => {
            // 地區篩選
            if (selectedRegion !== 'ALL') {
                const regionConfig = REGIONS.find(r => r.value === selectedRegion);
                if (regionConfig && regionConfig.cities) {
                    const loc = exh.location || '';
                    const matchCity = regionConfig.cities.some(city => loc.includes(city));
                    if (!matchCity) return false;
                }
            }

            // 關鍵字搜尋
            if (searchKeyword.trim()) {
                const kw = searchKeyword.trim().toLowerCase();
                const matchTitle = exh.title?.toLowerCase().includes(kw);
                const matchLoc = exh.location?.toLowerCase().includes(kw);
                const matchDesc = exh.description?.toLowerCase().includes(kw);
                if (!matchTitle && !matchLoc && !matchDesc) return false;
            }

            return true;
        });
    }, [upcomingExhibitions, selectedRegion, searchKeyword]);

    // 依月份分組
    const exhibitionsByMonth = useMemo(() => {
        const groups: Record<string, Exhibition[]> = {};
        filteredExhibitions.forEach(exh => {
            const date = new Date(exh.date.seconds * 1000);
            const monthKey = format(date, 'yyyy年MM月');
            if (!groups[monthKey]) groups[monthKey] = [];
            groups[monthKey].push(exh);
        });
        return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
    }, [filteredExhibitions]);

    return (
        <div className={cn("text-white space-y-6 w-full", !hideHeader && "py-2 sm:py-4")}>
            
            {/* 優化後的精緻圖像化標頭 */}
            {!hideHeader && (
                <div className="space-y-3">
                    <div className="flex items-center gap-2">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold uppercase tracking-wider">
                            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                            CARD EXPO & EVENTS CALENDAR
                        </span>
                        <span className="text-xs text-slate-500 font-mono hidden sm:inline-block">
                            · 全台卡友實體展覽速報
                        </span>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-800/80 pb-5">
                        <div>
                            <h2 className="text-2xl sm:text-4xl font-black font-headline tracking-tight text-white flex items-center gap-2.5">
                                <span>全台卡展 · 展訊行事曆</span>
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1.5 leading-relaxed">
                                彙整全台球員卡特展、卡友市集與交流盛會 · 支援即時地圖導航與展期倒數
                            </p>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 font-mono bg-slate-900/80 px-3.5 py-2 rounded-2xl border border-slate-800 shrink-0">
                            <Ticket className="w-4 h-4 text-cyan-400" />
                            <span>近期共 <strong className="text-cyan-400 font-black text-sm">{upcomingExhibitions.length}</strong> 場卡展</span>
                        </div>
                    </div>
                </div>
            )}
            
            {/* 主內容區 */}
            <div className={cn(
                "w-full",
                showNextHighlight ? "grid grid-cols-1 lg:grid-cols-12 gap-6 items-start" : "w-full"
            )}>
                {/* 側邊：下一場卡展精選卡 */}
                {showNextHighlight && (
                    <div className="lg:col-span-4 xl:col-span-4 space-y-3 lg:sticky lg:top-24">
                        <div className="flex items-center justify-between px-1">
                            <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                <Flame className="w-3.5 h-3.5 text-rose-400" />
                                焦點熱門展覽
                            </span>
                        </div>
                        <NextExhibitionCard 
                            exhibition={nextExhibition} 
                            onSelect={(exh) => setSelectedExh(exh)} 
                        />
                    </div>
                )}

                {/* 主列表區 */}
                <div className={cn("space-y-4", showNextHighlight ? "lg:col-span-8 xl:col-span-8" : "w-full")}>
                    
                    {/* 工具列：地區篩選 Pills & 關鍵字搜尋 */}
                    <div className="bg-slate-900/90 border border-slate-800/90 rounded-2xl p-3 sm:p-4 space-y-3 backdrop-blur-xl shadow-lg">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            
                            {/* 地區切換按鈕 */}
                            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                                {REGIONS.map((reg) => (
                                    <button
                                        key={reg.value}
                                        type="button"
                                        onClick={() => setSelectedRegion(reg.value)}
                                        className={cn(
                                            "px-3.5 py-1.5 rounded-xl text-xs font-black transition-all shrink-0 cursor-pointer",
                                            selectedRegion === reg.value
                                                ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/20"
                                                : "bg-slate-950/70 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/90"
                                        )}
                                    >
                                        {reg.label}
                                    </button>
                                ))}
                            </div>

                            {/* 視圖切換 (清單 / 網格) */}
                            <div className="flex items-center gap-1 self-end sm:self-auto shrink-0 bg-slate-950/80 p-1 rounded-xl border border-slate-800">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('list')}
                                    title="簡約列表模式"
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1",
                                        viewMode === 'list'
                                            ? "bg-cyan-500 text-slate-950 font-black shadow-sm"
                                            : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    <ListFilter className="w-3.5 h-3.5" />
                                    <span>列表</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('grid')}
                                    title="卡片網格模式"
                                    className={cn(
                                        "px-2.5 py-1 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1",
                                        viewMode === 'grid'
                                            ? "bg-cyan-500 text-slate-950 font-black shadow-sm"
                                            : "text-slate-400 hover:text-slate-200"
                                    )}
                                >
                                    <LayoutGrid className="w-3.5 h-3.5" />
                                    <span>網格</span>
                                </button>
                            </div>
                        </div>

                        {/* 搜尋列 */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <Input
                                type="text"
                                placeholder="搜尋展覽名稱、展覽館或城市地址..."
                                value={searchKeyword}
                                onChange={(e) => setSearchKeyword(e.target.value)}
                                className="h-9.5 pl-9.5 pr-3 rounded-xl bg-slate-950/80 border-slate-800 text-xs text-white placeholder:text-slate-500 focus-visible:ring-cyan-500/40"
                            />
                            {searchKeyword && (
                                <button
                                    type="button"
                                    onClick={() => setSearchKeyword('')}
                                    className="text-[11px] text-slate-400 hover:text-white absolute right-3 top-1/2 -translate-y-1/2 px-2 py-0.5 rounded bg-slate-800"
                                >
                                    清除
                                </button>
                            )}
                        </div>
                    </div>

                    {/* 活動分月份清單 */}
                    {isLoading ? (
                        <div className="py-16 text-center text-slate-500 space-y-2">
                            <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto" />
                            <p className="text-xs font-bold">載入全台卡展日程中...</p>
                        </div>
                    ) : exhibitionsByMonth.length > 0 ? (
                        <div className="space-y-6">
                            {exhibitionsByMonth.map(([month, exhList]) => (
                                <div key={month} className="space-y-3">
                                    
                                    {/* 月份標頭 (更圖像化的月份標記) */}
                                    <div className="flex items-center gap-2.5 px-1">
                                        <div className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)] shrink-0" />
                                        <h3 className="text-base font-black text-white font-mono tracking-wider">
                                            {month}
                                        </h3>
                                        <span className="text-xs font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                                            {exhList.length} 場活動
                                        </span>
                                    </div>

                                    {/* 簡潔列表模式 (List Mode) - 視覺票券化 */}
                                    {viewMode === 'list' ? (
                                        <div className="space-y-2.5">
                                            {exhList.map((exh) => {
                                                const startDate = new Date(exh.date.seconds * 1000);
                                                const endDate = exh.endDate ? new Date(exh.endDate.seconds * 1000) : null;
                                                const isSameDay = !endDate || format(startDate, 'yyyyMMdd') === format(endDate, 'yyyyMMdd');
                                                const dayOfMonth = format(startDate, 'dd');
                                                const endDayOfMonth = endDate ? format(endDate, 'dd') : null;
                                                const daysOfWeek = ['日', '一', '二', '三', '四', '五', '六'];
                                                const dayName = daysOfWeek[startDate.getDay()];
                                                const city = extractCity(exh.location);
                                                const cityTheme = getCityTheme(city);
                                                const isNext = nextExhibition?.id === exh.id;

                                                const today = new Date();
                                                today.setHours(0, 0, 0, 0);
                                                const startMidnight = new Date(startDate);
                                                startMidnight.setHours(0, 0, 0, 0);
                                                const daysUntil = differenceInCalendarDays(startMidnight, today);

                                                return (
                                                    <div
                                                        key={exh.id}
                                                        onClick={() => setSelectedExh(exh)}
                                                        className={cn(
                                                            "group relative p-3 sm:p-4 rounded-2xl bg-slate-900/70 hover:bg-slate-900 border transition-all duration-200 cursor-pointer flex items-center justify-between gap-3 sm:gap-4 shadow-md",
                                                            isNext 
                                                                ? "border-cyan-500/50 bg-gradient-to-r from-cyan-950/30 via-slate-900/80 to-slate-900" 
                                                                : "border-slate-800/80 hover:border-slate-700"
                                                        )}
                                                    >
                                                        {/* 左側：精美日曆票券方塊 */}
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <div className={cn(
                                                                "w-13 sm:w-15 h-13 sm:h-15 rounded-2xl flex flex-col items-center justify-center font-mono border text-center transition-all shadow-inner shrink-0",
                                                                isNext 
                                                                    ? "bg-gradient-to-b from-cyan-500/20 to-cyan-950/40 border-cyan-500/50 text-cyan-300 shadow-[0_0_10px_rgba(6,182,212,0.15)]" 
                                                                    : "bg-slate-950 border-slate-800 text-slate-300 group-hover:border-slate-700"
                                                            )}>
                                                                <span className="text-[10px] font-black opacity-80 uppercase leading-none">
                                                                    週{dayName}
                                                                </span>
                                                                <span className="text-base sm:text-xl font-black text-white leading-tight mt-0.5">
                                                                    {isSameDay ? dayOfMonth : `${dayOfMonth}-${endDayOfMonth}`}
                                                                </span>
                                                            </div>
                                                        </div>

                                                        {/* 中間：標題與地點/時間 (去蕪存菁，簡潔有力) */}
                                                        <div className="flex-1 min-w-0 space-y-1.5">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black border shrink-0", cityTheme.badge)}>
                                                                    {city}
                                                                </span>
                                                                {isNext && (
                                                                    <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-black shrink-0 flex items-center gap-1">
                                                                        <Flame className="w-3 h-3 text-amber-400" />
                                                                        下一場
                                                                    </span>
                                                                )}
                                                                <h4 className="font-black text-sm sm:text-base text-white group-hover:text-cyan-300 transition-colors truncate">
                                                                    {exh.title}
                                                                </h4>
                                                            </div>

                                                            <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                                                                {exh.location && (
                                                                    <span className="flex items-center gap-1.5 truncate max-w-[220px] sm:max-w-sm text-slate-300">
                                                                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                                        <span className="truncate">{exh.location}</span>
                                                                    </span>
                                                                )}
                                                                {exh.time && (
                                                                    <span className="hidden sm:flex items-center gap-1.5 text-slate-400">
                                                                        <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                                        <span>{exh.time}</span>
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 右側：倒數狀態與箭頭 */}
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {daysUntil >= 0 && daysUntil <= 7 && (
                                                                <span className="hidden md:inline-flex items-center gap-1 text-xs font-mono text-amber-300 bg-amber-500/15 px-2.5 py-1 rounded-full border border-amber-500/30 font-black">
                                                                    <Flame className="w-3 h-3 text-amber-400" />
                                                                    {daysUntil === 0 ? '今天開展' : daysUntil === 1 ? '明天開展' : `${daysUntil}天後`}
                                                                </span>
                                                            )}
                                                            <div className="w-8 h-8 rounded-xl bg-slate-950 group-hover:bg-cyan-500 text-slate-400 group-hover:text-slate-950 border border-slate-800 group-hover:border-cyan-400 flex items-center justify-center transition-all shadow-sm">
                                                                <ChevronRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        /* 網格模式 (Grid Mode) - 具象視覺卡 */
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                            {exhList.map((exh) => {
                                                const startDate = new Date(exh.date.seconds * 1000);
                                                const endDate = exh.endDate ? new Date(exh.endDate.seconds * 1000) : null;
                                                const isSameDay = !endDate || format(startDate, 'yyyyMMdd') === format(endDate, 'yyyyMMdd');
                                                const startStr = format(startDate, 'MM/dd');
                                                const endStr = endDate ? format(endDate, 'MM/dd') : null;
                                                const city = extractCity(exh.location);
                                                const cityTheme = getCityTheme(city);
                                                const isNext = nextExhibition?.id === exh.id;

                                                return (
                                                    <div
                                                        key={exh.id}
                                                        onClick={() => setSelectedExh(exh)}
                                                        className={cn(
                                                            "group p-4 rounded-3xl bg-slate-900/70 hover:bg-slate-900 border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 relative overflow-hidden shadow-lg",
                                                            isNext 
                                                                ? "border-cyan-500/50 bg-gradient-to-br from-cyan-950/30 to-slate-900" 
                                                                : "border-slate-800/80 hover:border-slate-700"
                                                        )}
                                                    >
                                                        <div className="space-y-2.5">
                                                            <div className="flex items-center justify-between gap-2">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span className="px-2.5 py-0.5 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-mono font-black">
                                                                        {isSameDay ? startStr : `${startStr} - ${endStr}`}
                                                                    </span>
                                                                    <span className={cn("px-2 py-0.5 rounded-lg text-[10px] font-black border", cityTheme.badge)}>
                                                                        {city}
                                                                    </span>
                                                                </div>
                                                                <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-300 group-hover:translate-x-0.5 transition-transform" />
                                                            </div>

                                                            <h4 className="font-black text-sm sm:text-base text-white group-hover:text-cyan-300 transition-colors line-clamp-2 leading-snug">
                                                                {exh.title}
                                                            </h4>
                                                        </div>

                                                        {(exh.location || exh.time) && (
                                                            <div className="pt-2.5 border-t border-slate-800/80 space-y-1.5 text-xs text-slate-400">
                                                                {exh.location && (
                                                                    <div className="flex items-center gap-1.5 truncate text-slate-300">
                                                                        <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                                        <span className="truncate">{exh.location}</span>
                                                                    </div>
                                                                )}
                                                                {exh.time && (
                                                                    <div className="flex items-center gap-1.5 text-slate-400">
                                                                        <Clock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                                        <span>{exh.time}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 bg-slate-900/40 rounded-3xl border border-slate-800/80 space-y-2">
                            <CalendarIcon className="w-8 h-8 text-slate-600 mx-auto" />
                            <p className="text-slate-400 font-bold text-sm">找不到符合條件的卡展活動</p>
                            <p className="text-xs text-slate-500">建議嘗試切換「全部地區」或清除搜尋關鍵字</p>
                            {(selectedRegion !== 'ALL' || searchKeyword) && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        setSelectedRegion('ALL');
                                        setSearchKeyword('');
                                    }}
                                    className="mt-2 text-xs border-slate-700 bg-slate-900 rounded-xl"
                                >
                                    重置篩選
                                </Button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* 清爽版活動詳情彈窗 */}
            <Dialog open={!!selectedExh} onOpenChange={(open) => !open && setSelectedExh(null)}>
                <DialogContent className="bg-slate-950/98 backdrop-blur-2xl border-cyan-500/30 text-white rounded-3xl p-5 sm:p-7 max-w-lg w-[92vw] mx-auto shadow-2xl focus:outline-none">
                    {selectedExh && (() => {
                        const startDate = new Date(selectedExh.date.seconds * 1000);
                        const endDate = selectedExh.endDate ? new Date(selectedExh.endDate.seconds * 1000) : null;
                        const fullStartStr = getFormattedFullDate(startDate);
                        const fullEndStr = endDate ? getFormattedFullDate(endDate) : null;
                        const isSameDay = !endDate || fullStartStr === fullEndStr;
                        const city = extractCity(selectedExh.location);
                        const cityTheme = getCityTheme(city);
                        const mapSearchUrl = selectedExh.location 
                            ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedExh.location)}`
                            : null;

                        return (
                            <div className="space-y-4">
                                <DialogHeader className="space-y-2 text-left border-b border-slate-800 pb-3.5">
                                    <div className="flex items-center gap-2">
                                        <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-black border", cityTheme.badge)}>
                                            {city}
                                        </span>
                                        <span className="text-xs font-mono text-slate-400">卡展活動詳情</span>
                                    </div>
                                    <DialogTitle className="text-lg sm:text-xl font-black text-white font-headline leading-snug">
                                        {selectedExh.title}
                                    </DialogTitle>
                                </DialogHeader>

                                {/* 活動海報 (若無則呈現城市卡牌視覺) */}
                                <div className="relative w-full h-44 sm:h-52 rounded-2xl overflow-hidden border border-slate-800 bg-slate-900 shadow-inner">
                                    {selectedExh.imageUrl ? (
                                        <img 
                                            src={selectedExh.imageUrl} 
                                            alt={selectedExh.title}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className={cn("w-full h-full bg-gradient-to-br flex flex-col items-center justify-center p-4", cityTheme.bg)}>
                                            <Compass className="w-12 h-12 text-white/30 mb-2" />
                                            <span className="text-xs font-black tracking-widest text-white/80 uppercase">CARD COLLECTOR EXPO</span>
                                            <span className="text-lg font-black text-white mt-1">{city}卡牌特展</span>
                                        </div>
                                    )}
                                </div>

                                {/* 重要資訊區塊 */}
                                <div className="space-y-2 text-xs sm:text-sm">
                                    {/* 日期 */}
                                    <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                                        <CalendarIcon className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                                        <div className="space-y-0.5">
                                            <span className="text-[11px] font-bold text-slate-400 block">日期日程</span>
                                            <div className="text-white font-bold">
                                                {isSameDay ? fullStartStr : `${fullStartStr} 至 ${fullEndStr}`}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 開放時間 */}
                                    {selectedExh.time && (
                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                                            <Clock className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                            <div className="space-y-0.5">
                                                <span className="text-[11px] font-bold text-slate-400 block">開放時間</span>
                                                <div className="text-white font-bold">{selectedExh.time}</div>
                                            </div>
                                        </div>
                                    )}

                                    {/* 展覽地點 */}
                                    {selectedExh.location && (
                                        <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-900/80 border border-slate-800">
                                            <MapPin className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                                            <div className="space-y-0.5 flex-1 min-w-0">
                                                <span className="text-[11px] font-bold text-slate-400 block">展覽地點</span>
                                                <div className="text-white font-bold break-words">{selectedExh.location}</div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 內容說明 */}
                                {selectedExh.description && (
                                    <div className="space-y-1.5 p-3.5 rounded-2xl bg-slate-900/40 border border-slate-800">
                                        <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1">
                                            <Info className="w-3.5 h-3.5 text-cyan-400" />
                                            活動說明
                                        </span>
                                        <div className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap break-words max-h-36 overflow-y-auto pr-1">
                                            {selectedExh.description}
                                        </div>
                                    </div>
                                )}

                                {/* 底部操作按鈕 */}
                                <div className="flex items-center gap-2 pt-2">
                                    {mapSearchUrl && (
                                        <Button
                                            asChild
                                            className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black rounded-xl h-11 text-xs sm:text-sm shadow-lg shadow-cyan-500/20"
                                        >
                                            <a href={mapSearchUrl} target="_blank" rel="noopener noreferrer">
                                                <Navigation className="w-4 h-4 mr-1.5" />
                                                Google 地圖導航
                                                <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-75" />
                                            </a>
                                        </Button>
                                    )}
                                    <DialogClose asChild>
                                        <Button
                                            variant="outline"
                                            className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold rounded-xl h-11 text-xs sm:text-sm px-5"
                                        >
                                            關閉
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
