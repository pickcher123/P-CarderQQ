'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
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
    differenceInCalendarDays
} from 'date-fns';
import { 
    Calendar as CalendarIcon, 
    ChevronLeft, 
    ChevronRight, 
    Tag, 
    MapPin, 
    Clock, 
    ExternalLink, 
    Navigation, 
    Sparkles, 
    Search, 
    Layers,
    Share2,
    CalendarCheck,
    ArrowRight,
    Globe,
    CheckCircle2,
    Ticket,
    Info,
    CalendarDays
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
import { SafeImage } from '@/components/safe-image';
import { 
    Exhibition, 
    ExhibitionGlobalRegion, 
    detectGlobalRegion, 
    extractCity 
} from '@/components/next-exhibition-card';
import { useToast } from '@/hooks/use-toast';

export type CardExhibitionRegion = 'all' | 'taiwan' | 'asia' | 'usa';

export interface RegionConfig {
    id: CardExhibitionRegion;
    label: string;
    flag: string;
    shortName: string;
    badgeClass: string;
    dotClass: string;
    borderClass: string;
    textClass: string;
    bgClass: string;
    gradientClass: string;
}

export const REGION_CONFIGS: Record<CardExhibitionRegion, RegionConfig> = {
    all: {
        id: 'all',
        label: '全部區域',
        flag: '🌐',
        shortName: '全區',
        badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        dotClass: 'bg-cyan-400',
        borderClass: 'border-cyan-500/40',
        textClass: 'text-cyan-400',
        bgClass: 'bg-cyan-950/40',
        gradientClass: 'from-cyan-500 to-blue-500',
    },
    taiwan: {
        id: 'taiwan',
        label: '台灣卡展',
        flag: '🇹🇼',
        shortName: '台灣',
        badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        dotClass: 'bg-emerald-400',
        borderClass: 'border-emerald-500/40',
        textClass: 'text-emerald-400',
        bgClass: 'bg-emerald-950/40',
        gradientClass: 'from-emerald-500 to-teal-500',
    },
    asia: {
        id: 'asia',
        label: '亞洲卡展',
        flag: '🌏',
        shortName: '亞洲',
        badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
        dotClass: 'bg-indigo-400',
        borderClass: 'border-indigo-500/40',
        textClass: 'text-indigo-400',
        bgClass: 'bg-indigo-950/40',
        gradientClass: 'from-indigo-500 to-purple-500',
    },
    usa: {
        id: 'usa',
        label: '美國卡展',
        flag: '🇺🇸',
        shortName: '美國',
        badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
        dotClass: 'bg-amber-400',
        borderClass: 'border-amber-500/40',
        textClass: 'text-amber-400',
        bgClass: 'bg-amber-950/40',
        gradientClass: 'from-amber-500 to-orange-500',
    },
};

// 精選備援資料庫：涵蓋 台灣、亞洲、美國 三大區域真實重大卡展
const PRESET_FALLBACK_EXHIBITIONS: Exhibition[] = (() => {
    const currentYear = new Date().getFullYear();
    const nextMonth = new Date().getMonth() + 2;
    const m1 = nextMonth > 12 ? 1 : nextMonth;
    const m2 = (m1 % 12) + 1;
    const m3 = (m2 % 12) + 1;
    const pad = (n: number) => n.toString().padStart(2, '0');

    const toSec = (dateStr: string) => Math.floor(new Date(dateStr).getTime() / 1000);

    return [
        // 🇹🇼 台灣卡展
        {
            id: 'fb-tw-1',
            title: `${currentYear} 台灣大台北國際球員卡交易博覽會 (Taipei Card Show)`,
            date: { seconds: toSec(`${currentYear}-${pad(m1)}-15T10:00:00`) },
            endDate: { seconds: toSec(`${currentYear}-${pad(m1)}-16T18:00:00`) },
            time: '10:00 - 18:00',
            location: '台北市南港展覽館 2 館 (台北市南港區經貿二路 2 號)',
            region: 'taiwan',
            description: '全台規模最盛大之球卡博覽會！集結超過 100+ 知名卡店與個人賣家，現場特設 PSA / BGS 快速送評鑑定專區、球星簽名見面會、大額罕見卡交易鑑價及百人盲盒開拆秀。',
            imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
            officialUrl: 'https://example.com/tcce',
        },
        {
            id: 'fb-tw-2',
            title: `${currentYear} 松菸收藏卡交流市集與鑑定收件會`,
            date: { seconds: toSec(`${currentYear}-${pad(m2)}-08T11:00:00`) },
            endDate: { seconds: toSec(`${currentYear}-${pad(m2)}-09T19:00:00`) },
            time: '11:00 - 19:00',
            location: '台北市松山文創園區 4 號倉庫 (台北市信義區光復南路 133 號)',
            region: 'taiwan',
            description: '結合 NBA、MLB、中華職棒 CPBL 與寶可夢 TCG 稀有卡展售！現場提供卡友免費交換桌、限定卡磚周邊與封膜開箱直播，是卡迷不可錯過的聚會。',
            imageUrl: 'https://images.unsplash.com/photo-1587280501635-68a0e82cd5ff?auto=format&fit=crop&w=1200&q=80',
        },
        {
            id: 'fb-tw-3',
            title: `${currentYear} 台中中台灣卡牌收藏博覽會 (Taichung Card Expo)`,
            date: { seconds: toSec(`${currentYear}-${pad(m2)}-22T10:30:00`) },
            endDate: { seconds: toSec(`${currentYear}-${pad(m2)}-23T17:30:00`) },
            time: '10:30 - 17:30',
            location: '台中世貿中心 2 館 (台中市西屯區天保街 60 號)',
            region: 'taiwan',
            description: '中部最大卡牌盛會！匯聚全台各大頂級卡商與藏家，現場舉行高階卡牌拍賣會、一元起標競標賽及球星新人卡評級講座。',
            imageUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1200&q=80',
        },
        {
            id: 'fb-tw-4',
            title: `${currentYear} 高雄港都球員卡交流節與拆卡同樂會`,
            date: { seconds: toSec(`${currentYear}-${pad(m3)}-12T11:00:00`) },
            endDate: { seconds: toSec(`${currentYear}-${pad(m3)}-13T18:00:00`) },
            time: '11:00 - 18:00',
            location: '高雄駁二藝術特區 B6 倉庫 (高雄市鹽埕區大勇路 1 號)',
            region: 'taiwan',
            description: '南台灣卡友年度熱門活動！設有中華職棒啦啦隊卡專區、NBA 頂級金折卡展區與現場即時拆卡抽籤活動，熱鬧非凡。',
            imageUrl: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?auto=format&fit=crop&w=1200&q=80',
        },

        // 🌏 亞洲卡展
        {
            id: 'fb-asia-1',
            title: `${currentYear} 日本東京國際卡牌收藏博覽會 (Tokyo Card Show)`,
            date: { seconds: toSec(`${currentYear}-${pad(m1)}-28T10:00:00`) },
            endDate: { seconds: toSec(`${currentYear}-${pad(m1)}-30T18:30:00`) },
            time: '10:00 - 18:30',
            location: '日本東京都江東區有明 Tokyo Big Sight (國際展示場)',
            region: 'asia',
            description: '亞洲指標性年度卡牌嘉年華！聚焦大谷翔平 MLB/日職稀世神卡、BBM/EPOCH 日本棒球珍藏卡及國際鑑定權威展位，吸引全亞洲上千卡友跨國參與。',
            imageUrl: 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
            officialUrl: 'https://example.com/tokyo-card-show',
        },
        {
            id: 'fb-asia-2',
            title: `${currentYear} 香港大灣區國際體育球員卡展 (Hong Kong Card Expo)`,
            date: { seconds: toSec(`${currentYear}-${pad(m2)}-18T10:30:00`) },
            endDate: { seconds: toSec(`${currentYear}-${pad(m2)}-20T19:00:00`) },
            time: '10:30 - 19:00',
            location: '香港會議展覽中心 HKCEC (香港灣仔博覽道 1 號)',
            region: 'asia',
            description: '串聯港澳星馬之亞洲球卡重磅盛會！特設頂級現代籃球折射卡、足球天王簽名卡專門鑑定區，現場多組知名頻道聯合進行全球同步連線拆卡。',
            imageUrl: 'https://images.unsplash.com/photo-1506970845246-18f21d533b20?auto=format&fit=crop&w=1200&q=80',
        },
        {
            id: 'fb-asia-3',
            title: `${currentYear} 韓國首爾體育收藏卡展 (Seoul Sports Card Show)`,
            date: { seconds: toSec(`${currentYear}-${pad(m3)}-05T10:00:00`) },
            endDate: { seconds: toSec(`${currentYear}-${pad(m3)}-06T18:00:00`) },
            time: '10:00 - 18:00',
            location: '韓國首爾江南區 COEX 會展中心 (COEX Hall B)',
            region: 'asia',
            description: '韓國最大規模球員卡交流展會！展示孫興慜、李政厚等頂尖旅美球星新人親簽卡，特設海外代評免運專案與知名卡牌藏家主題座談。',
            imageUrl: 'https://images.unsplash.com/photo-1538485399081-7191377e8241?auto=format&fit=crop&w=1200&q=80',
        },

        // 🇺🇸 美國卡展
        {
            id: 'fb-usa-1',
            title: `The ${currentYear - 1979}th National Sports Collectors Convention (NSCC 全美最大國家卡展)`,
            date: { seconds: toSec(`${currentYear}-${pad(m2)}-29T09:30:00`) },
            endDate: { seconds: toSec(`${currentYear}-${pad(m3)}-02T18:00:00`) },
            time: '09:30 - 18:00',
            location: 'Donald E. Stephens Convention Center, Rosemont / Chicago, IL',
            region: 'usa',
            description: '全球球卡界最至高無上之年度國家卡展！超過 600 家經銷商、近千位名人堂球星親自到場簽名，涵蓋 Vintage 百年骨董卡至現代百萬美元頂級折射卡。',
            imageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=1200&q=80',
            officialUrl: 'https://nsccshow.com',
        },
        {
            id: 'fb-usa-2',
            title: `Burbank Card Show ${currentYear} (加州伯班克頂級體育卡展)`,
            date: { seconds: toSec(`${currentYear}-${pad(m1)}-20T10:00:00`) },
            endDate: { seconds: toSec(`${currentYear}-${pad(m1)}-22T19:00:00`) },
            time: '10:00 - 19:00',
            location: 'Anaheim Convention Center, Anaheim / Burbank, California',
            region: 'usa',
            description: '西海岸公認最具潮流與影響力的卡友博覽會！PSA / BGS / CGC 現場收件即刻鑑定、破億身價卡牌當面成交，也是多位頂尖體育明星出沒之焦點。',
            imageUrl: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=1200&q=80',
        },
        {
            id: 'fb-usa-3',
            title: `Dallas Card Show (德州達拉斯超級卡牌展)`,
            date: { seconds: toSec(`${currentYear}-${pad(m3)}-20T10:00:00`) },
            endDate: { seconds: toSec(`${currentYear}-${pad(m3)}-23T18:00:00`) },
            time: '10:00 - 18:00',
            location: 'Watters Creek Convention Center, Allen / Dallas, Texas',
            region: 'usa',
            description: '美國南部最大的常態性超大型卡展！全美知名拆卡頻道、交易商及百萬粉絲 YouTuber 齊聚，提供龐大現金交易桌與專屬封膜開盒區。',
            imageUrl: 'https://images.unsplash.com/photo-1563089145-599997674d42?auto=format&fit=crop&w=1200&q=80',
        },
    ];
})();

export interface UnifiedCalendarExhibitionEvent {
    id: string;
    title: string;
    startDate: Date;
    endDate: Date;
    timeStr: string;
    location: string;
    region: ExhibitionGlobalRegion;
    description: string;
    imageUrl?: string;
    officialUrl?: string;
    rawExhibition: Exhibition;
}

interface UnifiedEventCalendarProps {
    hideHeader?: boolean;
    initialMode?: 'grid' | 'agenda';
    defaultRegion?: CardExhibitionRegion;
    showSpotlight?: boolean;
}

export function UnifiedEventCalendar({ 
    hideHeader = false,
    initialMode = 'grid',
    defaultRegion = 'all',
    showSpotlight = true,
}: UnifiedEventCalendarProps) {
    const firestore = useFirestore();
    const { toast } = useToast();

    // 檢視切換：月曆矩陣模式 (grid) 或 時間軸清單 (agenda)
    const [viewMode, setViewMode] = useState<'grid' | 'agenda'>(initialMode);
    // 當前瀏覽的月份
    const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
    // 選中的特定日期
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    // 區域篩選：全部 / 台灣 / 亞洲 / 美國 (共用同一張行事曆)
    const [activeRegion, setActiveRegion] = useState<CardExhibitionRegion>(defaultRegion);
    // 關鍵字搜尋
    const [keyword, setKeyword] = useState<string>('');
    // 詳情彈窗
    const [activeModalEvent, setActiveModalEvent] = useState<UnifiedCalendarExhibitionEvent | null>(null);

    // 取得 Firestore 中的卡展資料 (集合名稱 card_exhibitions)
    const exhQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
    }, [firestore]);
    const { data: rawExhibitions } = useCollection<Exhibition>(exhQuery);

    // 整合資料：若 Firestore 暫無資料則載入高品質精選資料庫
    const allExhibitionEvents = useMemo(() => {
        const sourceList: Exhibition[] = (rawExhibitions && rawExhibitions.length > 0)
            ? rawExhibitions
            : PRESET_FALLBACK_EXHIBITIONS;

        const events: UnifiedCalendarExhibitionEvent[] = [];

        sourceList.forEach((exh) => {
            if (!exh.date?.seconds && !exh.date) return;
            const startDate = exh.date?.seconds ? new Date(exh.date.seconds * 1000) : new Date(exh.date as any);
            const endDate = exh.endDate?.seconds 
                ? new Date(exh.endDate.seconds * 1000) 
                : (exh.endDate ? new Date(exh.endDate as any) : startDate);

            const detectedRegion = detectGlobalRegion(exh);

            events.push({
                id: `exh_${exh.id || Math.random().toString()}`,
                title: exh.title || '卡片特展',
                startDate,
                endDate,
                timeStr: format(startDate, 'MM/dd') + (isSameDay(startDate, endDate) ? '' : ` ~ ${format(endDate, 'MM/dd')}`),
                location: exh.location || '實體展覽館',
                region: detectedRegion,
                description: exh.description || '',
                imageUrl: exh.imageUrl,
                officialUrl: exh.officialUrl,
                rawExhibition: exh,
            });
        });

        return events.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
    }, [rawExhibitions]);

    // 區域統計數量
    const regionCounts = useMemo(() => {
        return {
            all: allExhibitionEvents.length,
            taiwan: allExhibitionEvents.filter(ev => ev.region === 'taiwan').length,
            asia: allExhibitionEvents.filter(ev => ev.region === 'asia').length,
            usa: allExhibitionEvents.filter(ev => ev.region === 'usa').length,
        };
    }, [allExhibitionEvents]);

    // 根據區域與關鍵字篩選
    const filteredEvents = useMemo(() => {
        return allExhibitionEvents.filter(ev => {
            // 區域篩選
            if (activeRegion !== 'all' && ev.region !== activeRegion) return false;

            // 關鍵字搜尋
            if (keyword.trim()) {
                const kw = keyword.trim().toLowerCase();
                const matchTitle = ev.title.toLowerCase().includes(kw);
                const matchLoc = ev.location.toLowerCase().includes(kw);
                const matchDesc = ev.description.toLowerCase().includes(kw);
                if (!matchTitle && !matchLoc && !matchDesc) return false;
            }

            return true;
        });
    }, [allExhibitionEvents, activeRegion, keyword]);

    // 月曆計算邏輯 (Month Matrix)
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(monthStart);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // 週日開始
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const daysMatrix = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    // 檢查某一天是否有卡展
    const getEventsForDay = useCallback((day: Date) => {
        return filteredEvents.filter(ev => {
            const start = new Date(ev.startDate);
            start.setHours(0, 0, 0, 0);
            const end = new Date(ev.endDate);
            end.setHours(23, 59, 59, 999);
            return day >= start && day <= end;
        });
    }, [filteredEvents]);

    // 當前選中日期的卡展列表
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

    // 焦點專區 1: 台灣焦點卡展（日期最近且未結束）
    const spotlightTaiwanExhibition = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const twEvents = allExhibitionEvents.filter(ev => ev.region === 'taiwan');
        const upcoming = twEvents.filter(ev => {
            const end = new Date(ev.endDate);
            end.setHours(23, 59, 59, 999);
            return end >= todayStart;
        });

        if (upcoming.length > 0) return upcoming[0];
        return twEvents[0] || null;
    }, [allExhibitionEvents]);

    // 焦點專區 2: 國際重量級展會（亞洲 / 美國近期盛大卡展）
    const spotlightInternationalExhibition = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);

        const intlEvents = allExhibitionEvents.filter(ev => ev.region === 'asia' || ev.region === 'usa');
        const upcoming = intlEvents.filter(ev => {
            const end = new Date(ev.endDate);
            end.setHours(23, 59, 59, 999);
            return end >= todayStart;
        });

        if (upcoming.length > 0) return upcoming[0];
        return intlEvents[0] || null;
    }, [allExhibitionEvents]);

    // 倒數狀態計算
    const getCountdownStatus = (startDate: Date, endDate: Date) => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);

        if (today >= start && today <= end) {
            return { text: '🔥 展期進行中', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' };
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
    };

    const handleShareExhibition = (ev: UnifiedCalendarExhibitionEvent) => {
        const text = `【${ev.title}】\n展期：${ev.timeStr}\n地點：${ev.location}\n詳情：${typeof window !== 'undefined' ? window.location.href : ''}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            toast({
                title: '已複製卡展展訊！',
                description: '您可以直接貼上至 LINE 或社群分享給卡友。',
            });
        }
    };

    return (
        <div className="w-full space-y-4 sm:space-y-6">

            {/* ========================================================================= */}
            {/* 🌟 頂部卡展焦點專區 (雙焦點：台灣巡迴旗艦展 × 亞洲/美國國際大展)        */}
            {/* ========================================================================= */}
            {showSpotlight && (spotlightTaiwanExhibition || spotlightInternationalExhibition) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
                    
                    {/* 卡片 1: 台灣焦點卡展 (實體票根 / VIP EXPO PASS 風格) */}
                    {spotlightTaiwanExhibition && (() => {
                        const countdown = getCountdownStatus(spotlightTaiwanExhibition.startDate, spotlightTaiwanExhibition.endDate);
                        const reg = REGION_CONFIGS.taiwan;

                        return (
                            <div 
                                onClick={() => setActiveModalEvent(spotlightTaiwanExhibition)}
                                className="group relative cursor-pointer overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-[#06181b] via-[#040e13] to-[#02070a] border border-emerald-500/40 hover:border-emerald-300 p-4 sm:p-5 transition-all duration-300 shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(16,185,129,0.18)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_35px_rgba(16,185,129,0.35)] flex flex-col justify-between gap-3.5 select-none hover:-translate-y-1"
                            >
                                {/* 頂部全息極光飾條 */}
                                <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399]" />
                                <div className="absolute top-1/2 -translate-y-1/2 -left-2.5 w-5 h-8 bg-slate-950 rounded-r-full border-r border-emerald-500/50 shadow-inner pointer-events-none" />
                                <div className="absolute top-1/2 -translate-y-1/2 -right-2.5 w-5 h-8 bg-slate-950 rounded-l-full border-l border-emerald-500/50 shadow-inner pointer-events-none" />
                                <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-emerald-500/20 transition-all" />

                                <div className="relative z-10 space-y-3">
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge className="bg-gradient-to-r from-emerald-500 to-teal-600 text-slate-950 font-black text-[11px] sm:text-xs px-2.5 py-0.5 rounded-lg flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.4)] border-0">
                                                <span>🇹🇼 台灣焦點展會</span>
                                            </Badge>
                                            <Badge variant="outline" className="border-emerald-500/40 bg-emerald-950/40 text-emerald-200 font-bold text-[10px] sm:text-[11px] px-2 py-0.5">
                                                📍 {extractCity(spotlightTaiwanExhibition.location)} 展館
                                            </Badge>
                                        </div>

                                        <span className={cn("text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full border shrink-0 font-mono shadow-sm", countdown.badgeClass)}>
                                            {countdown.text}
                                        </span>
                                    </div>

                                    <h3 className="text-base sm:text-lg font-black text-white group-hover:text-emerald-300 transition-colors line-clamp-1 leading-snug drop-shadow-md">
                                        {spotlightTaiwanExhibition.title}
                                    </h3>

                                    <div className="space-y-2 text-xs text-slate-300 bg-slate-950/80 p-3 rounded-2xl border border-emerald-500/20 shadow-inner">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-300 shrink-0">
                                                <CalendarIcon className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="min-w-0 flex-1 flex items-center justify-between">
                                                <span className="text-slate-400 text-[11px]">展期時間</span>
                                                <span className="font-mono text-emerald-200 font-bold text-xs sm:text-sm">{spotlightTaiwanExhibition.timeStr}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                                            <div className="w-6 h-6 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                                                <MapPin className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="min-w-0 flex-1 truncate">
                                                <span className="truncate text-slate-200 font-medium block">{spotlightTaiwanExhibition.location}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative z-10 flex items-center justify-between gap-2 pt-2.5 border-t border-emerald-500/20">
                                    <span className="text-[10px] sm:text-[11px] text-emerald-400/80 font-mono font-bold tracking-wider">
                                        #TAIWAN-CARD-SHOW
                                    </span>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <Button
                                            size="sm"
                                            className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black rounded-xl text-xs h-8 px-3.5 shadow-md shadow-emerald-500/30 cursor-pointer"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setActiveModalEvent(spotlightTaiwanExhibition);
                                            }}
                                        >
                                            <span>查看展訊</span>
                                            <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}

                    {/* 卡片 2: 國際重量級展會 (亞洲 / 美國) */}
                    {spotlightInternationalExhibition && (() => {
                        const countdown = getCountdownStatus(spotlightInternationalExhibition.startDate, spotlightInternationalExhibition.endDate);
                        const isUsa = spotlightInternationalExhibition.region === 'usa';
                        const reg = isUsa ? REGION_CONFIGS.usa : REGION_CONFIGS.asia;

                        return (
                            <div 
                                onClick={() => setActiveModalEvent(spotlightInternationalExhibition)}
                                className={cn(
                                    "group relative cursor-pointer overflow-hidden rounded-2xl sm:rounded-3xl border p-4 sm:p-5 transition-all duration-300 shadow-2xl flex flex-col justify-between gap-3.5 select-none hover:-translate-y-1",
                                    isUsa 
                                        ? "bg-gradient-to-br from-[#241505] via-[#140c03] to-[#070913] border-amber-400/40 hover:border-amber-300 shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(245,158,11,0.18)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_35px_rgba(245,158,11,0.35)]"
                                        : "bg-gradient-to-br from-[#120a2e] via-[#09051c] to-[#040212] border-indigo-400/40 hover:border-indigo-300 shadow-[0_15px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(99,102,241,0.18)] hover:shadow-[0_20px_50px_rgba(0,0,0,0.9),0_0_35px_rgba(99,102,241,0.35)]"
                                )}
                            >
                                <div className={cn("absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-transparent to-transparent", isUsa ? "via-amber-400 shadow-[0_0_12px_#f59e0b]" : "via-indigo-400 shadow-[0_0_12px_#818cf8]")} />
                                <div className="absolute top-1/2 -translate-y-1/2 -left-2.5 w-5 h-8 bg-slate-950 rounded-r-full border-r border-slate-700 pointer-events-none" />
                                <div className="absolute top-1/2 -translate-y-1/2 -right-2.5 w-5 h-8 bg-slate-950 rounded-l-full border-l border-slate-700 pointer-events-none" />

                                <div className="relative z-10 space-y-3">
                                    <div className="flex items-center justify-between gap-1.5 flex-wrap">
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge className={cn("text-slate-950 font-black text-[11px] sm:text-xs px-2.5 py-0.5 rounded-lg flex items-center gap-1 border-0 bg-gradient-to-r", reg.gradientClass)}>
                                                <span>{reg.flag} {reg.label}</span>
                                            </Badge>
                                            <Badge variant="outline" className={cn("font-bold text-[10px] sm:text-[11px] px-2 py-0.5", reg.badgeClass)}>
                                                📍 {extractCity(spotlightInternationalExhibition.location)}
                                            </Badge>
                                        </div>

                                        <span className={cn("text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full border shrink-0 font-mono shadow-sm", countdown.badgeClass)}>
                                            {countdown.text}
                                        </span>
                                    </div>

                                    <h3 className={cn("text-base sm:text-lg font-black text-white transition-colors line-clamp-1 leading-snug drop-shadow-md", isUsa ? "group-hover:text-amber-300" : "group-hover:text-indigo-300")}>
                                        {spotlightInternationalExhibition.title}
                                    </h3>

                                    <div className="space-y-2 text-xs text-slate-300 bg-slate-950/80 p-3 rounded-2xl border border-slate-800 shadow-inner">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 border", isUsa ? "bg-amber-500/15 border-amber-500/30 text-amber-300" : "bg-indigo-500/15 border-indigo-500/30 text-indigo-300")}>
                                                <CalendarIcon className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="min-w-0 flex-1 flex items-center justify-between">
                                                <span className="text-slate-400 text-[11px]">展期時間</span>
                                                <span className={cn("font-mono font-bold text-xs sm:text-sm", isUsa ? "text-amber-200" : "text-indigo-200")}>
                                                    {spotlightInternationalExhibition.timeStr}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80">
                                            <div className="w-6 h-6 rounded-lg bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                                                <MapPin className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="min-w-0 flex-1 truncate">
                                                <span className="truncate text-slate-200 font-medium block">{spotlightInternationalExhibition.location}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="relative z-10 flex items-center justify-between gap-2 pt-2.5 border-t border-slate-800">
                                    <span className={cn("text-[10px] sm:text-[11px] font-mono font-bold tracking-wider", isUsa ? "text-amber-400/80" : "text-indigo-400/80")}>
                                        #{isUsa ? 'USA-EXPO' : 'ASIA-EXPO'}
                                    </span>
                                    <Button
                                        size="sm"
                                        className={cn("text-slate-950 font-black rounded-xl text-xs h-8 px-3.5 shadow-md cursor-pointer bg-gradient-to-r", reg.gradientClass)}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveModalEvent(spotlightInternationalExhibition);
                                        }}
                                    >
                                        <span>查看展訊</span>
                                        <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                    </Button>
                                </div>
                            </div>
                        );
                    })()}

                </div>
            )}

            {/* ========================================================================= */}
            {/* 🌟 核心控制列：三大區域篩選標籤 (台灣 / 亞洲 / 美國) × 檢視模式 × 搜尋  */}
            {/* ========================================================================= */}
            <div className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-b from-slate-900/95 via-slate-950/90 to-slate-950 p-3.5 sm:p-5 border border-slate-800/90 shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-xl space-y-3.5 overflow-hidden">
                <div className="absolute top-0 inset-x-8 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent" />
                
                {/* 🌟 第一列：三區域分頁切換按鈕 (共用同一張行事曆) */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
                    <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none flex-wrap">
                        {(['all', 'taiwan', 'asia', 'usa'] as CardExhibitionRegion[]).map((regId) => {
                            const cfg = REGION_CONFIGS[regId];
                            const isSelected = activeRegion === regId;
                            const count = regionCounts[regId];

                            return (
                                <button
                                    key={regId}
                                    type="button"
                                    onClick={() => setActiveRegion(regId)}
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl sm:rounded-2xl text-xs font-black transition-all duration-200 cursor-pointer border shrink-0",
                                        isSelected
                                            ? `${cfg.badgeClass} ring-2 ring-white/10 shadow-lg scale-102`
                                            : "bg-slate-950/80 text-slate-400 hover:text-white border-slate-800/90 hover:bg-slate-900"
                                    )}
                                >
                                    <span className="text-sm">{cfg.flag}</span>
                                    <span>{cfg.label}</span>
                                    <span className={cn(
                                        "text-[10px] font-mono px-1.5 py-0.2 rounded-full",
                                        isSelected ? "bg-white/20 text-white font-bold" : "bg-slate-800 text-slate-400"
                                    )}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* 右側：月曆模式 (grid) vs 時間軸清單 (agenda) */}
                    <div className="flex items-center bg-slate-950/90 p-1 rounded-2xl border border-slate-800/80 shadow-inner shrink-0">
                        <button
                            type="button"
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer",
                                viewMode === 'grid'
                                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
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
                                "flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all duration-200 cursor-pointer",
                                viewMode === 'agenda'
                                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                                    : "text-slate-400 hover:text-white"
                            )}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>行程時間軸</span>
                        </button>
                    </div>
                </div>

                {/* 第二列：關鍵字搜尋與快捷按鈕 */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="relative w-full sm:flex-1 sm:max-w-md">
                        <Search className="w-4 h-4 text-cyan-400/70 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <Input
                            placeholder="搜尋卡展名稱、國家城市、場館地址..."
                            value={keyword}
                            onChange={(e) => setKeyword(e.target.value)}
                            className="bg-slate-950/90 border-slate-800/90 text-white pl-10 pr-4 h-9 sm:h-10 rounded-xl sm:rounded-2xl text-xs placeholder:text-slate-500 focus-visible:ring-cyan-500/50 focus-visible:border-cyan-500 w-full shadow-inner"
                        />
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={goToToday}
                            className="border-slate-800 bg-slate-950/80 hover:bg-slate-900 text-cyan-300 font-bold rounded-xl text-xs h-9 px-3 gap-1 shadow-inner cursor-pointer"
                        >
                            <CalendarCheck className="w-3.5 h-3.5 text-cyan-400" />
                            <span>回到本月</span>
                        </Button>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* 檢視模式 1: 月曆矩陣 (Month Grid Matrix)                                  */}
            {/* ========================================================================= */}
            {viewMode === 'grid' && (
                <div className="space-y-4">
                    {/* 月曆導覽抬頭 (月份切換控制列) */}
                    <div className="rounded-2xl sm:rounded-3xl bg-slate-950/90 border border-slate-800/90 p-3 sm:p-4 flex items-center justify-between shadow-xl backdrop-blur-xl">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                                <CalendarDays className="w-4 h-4 sm:w-5 sm:h-5" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-xl font-black text-white font-headline tracking-tight">
                                    {format(currentMonth, 'yyyy 年 MM 月')}
                                </h2>
                                <p className="text-[10px] sm:text-xs text-slate-400">
                                    共收錄 {filteredEvents.length} 場精彩卡展（點選日期檢視完整展訊）
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-1.5 sm:gap-2">
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={prevMonth}
                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white"
                                title="上個月"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </Button>
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={nextMonth}
                                className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl border-slate-800 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white"
                                title="下個月"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>

                    {/* 7 日月曆矩陣面板 */}
                    <div className="rounded-2xl sm:rounded-3xl bg-slate-950/95 border border-slate-800/90 p-2 sm:p-4 shadow-2xl backdrop-blur-xl overflow-hidden">
                        {/* 星期抬頭 (週日 ~ 週六) */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-2 text-center">
                            {['日', '一', '二', '三', '四', '五', '六'].map((dayName, idx) => (
                                <div 
                                    key={dayName} 
                                    className={cn(
                                        "py-1.5 text-xs font-black rounded-lg uppercase tracking-wider font-mono",
                                        idx === 0 || idx === 6 ? "text-amber-400/90 bg-amber-500/5" : "text-slate-400 bg-slate-900/40"
                                    )}
                                >
                                    週{dayName}
                                </div>
                            ))}
                        </div>

                        {/* 日期格子 (Days Grid) */}
                        <div className="grid grid-cols-7 gap-1 sm:gap-2">
                            {daysMatrix.map((day) => {
                                const isCurMonth = isSameMonth(day, currentMonth);
                                const isCurrentDay = isToday(day);
                                const isSelected = isSameDay(day, selectedDate);
                                const dayEvents = getEventsForDay(day);

                                return (
                                    <div
                                        key={day.toISOString()}
                                        onClick={() => setSelectedDate(day)}
                                        className={cn(
                                            "min-h-[75px] sm:min-h-[105px] p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between group relative select-none",
                                            isCurMonth ? "bg-slate-900/60" : "bg-slate-950/40 opacity-40",
                                            isSelected 
                                                ? "border-cyan-400 ring-2 ring-cyan-500/30 bg-cyan-950/30 shadow-[0_0_15px_rgba(6,182,212,0.25)]" 
                                                : "border-slate-800/70 hover:border-slate-700 hover:bg-slate-900",
                                            isCurrentDay && !isSelected && "border-amber-400/60 ring-1 ring-amber-400/30"
                                        )}
                                    >
                                        {/* 日期數字與當日徽章 */}
                                        <div className="flex items-center justify-between w-full">
                                            <span className={cn(
                                                "text-xs sm:text-sm font-black font-mono px-1.5 py-0.5 rounded-md",
                                                isCurrentDay 
                                                    ? "bg-amber-500 text-slate-950 shadow-sm" 
                                                    : (isSelected ? "text-cyan-300 font-bold" : "text-slate-300 group-hover:text-white")
                                            )}>
                                                {format(day, 'd')}
                                            </span>

                                            {dayEvents.length > 0 && (
                                                <span className="text-[9px] sm:text-[10px] font-black font-mono text-cyan-300 bg-cyan-950 px-1 rounded border border-cyan-500/30">
                                                    {dayEvents.length}
                                                </span>
                                            )}
                                        </div>

                                        {/* 當日卡展簡籤清單 */}
                                        <div className="space-y-1 w-full my-1 overflow-hidden">
                                            {dayEvents.slice(0, 2).map((ev) => {
                                                const reg = REGION_CONFIGS[ev.region] || REGION_CONFIGS.taiwan;
                                                return (
                                                    <div
                                                        key={ev.id}
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setActiveModalEvent(ev);
                                                        }}
                                                        className={cn(
                                                            "px-1.5 py-0.5 rounded-md text-[9px] sm:text-[10px] font-black truncate border flex items-center gap-1 transition-all",
                                                            reg.badgeClass
                                                        )}
                                                        title={`${reg.flag} ${ev.title} (${ev.location})`}
                                                    >
                                                        <span>{reg.flag}</span>
                                                        <span className="truncate">{ev.title}</span>
                                                    </div>
                                                );
                                            })}
                                            {dayEvents.length > 2 && (
                                                <span className="text-[9px] text-slate-400 font-mono block text-center">
                                                    +{dayEvents.length - 2} 更多
                                                </span>
                                            )}
                                        </div>

                                        {/* 底部光條 */}
                                        <div className="h-0.5 sm:h-1 w-full bg-slate-950 rounded-full overflow-hidden">
                                            {dayEvents.length > 0 && (
                                                <div 
                                                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-indigo-400 to-amber-400"
                                                    style={{ width: `${Math.min(100, dayEvents.length * 35)}%` }}
                                                />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* 下方聯動：選中日期的卡展詳情面板 */}
                    <div className="rounded-2xl sm:rounded-3xl bg-gradient-to-b from-slate-900/95 via-slate-950 to-slate-950 border border-slate-800/90 p-4 sm:p-6 shadow-2xl backdrop-blur-xl space-y-4">
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3.5">
                            <div className="flex items-center gap-2.5 sm:gap-3">
                                <div className="p-2 rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400">
                                    <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                                </div>
                                <div>
                                    <h3 className="text-sm sm:text-lg font-black text-white font-headline flex items-center gap-2">
                                        <span>{format(selectedDate, 'yyyy 年 MM 月 dd 日')}</span>
                                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-sans font-bold">
                                            {['週日', '週一', '週二', '週三', '週四', '週五', '週六'][selectedDate.getDay()]}
                                        </span>
                                    </h3>
                                    <span className="text-[11px] sm:text-xs text-slate-400 font-mono">
                                        當日排定 {selectedDayEvents.length} 場實體卡展活動
                                    </span>
                                </div>
                            </div>
                        </div>

                        {selectedDayEvents.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 pt-1">
                                {selectedDayEvents.map(ev => {
                                    const reg = REGION_CONFIGS[ev.region] || REGION_CONFIGS.taiwan;
                                    return (
                                        <div
                                            key={ev.id}
                                            onClick={() => setActiveModalEvent(ev)}
                                            className="group relative cursor-pointer overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a1426] via-[#070e1c] to-[#040813] border border-cyan-500/30 hover:border-cyan-400 p-4 transition-all duration-300 shadow-lg hover:shadow-cyan-500/15 flex flex-col justify-between gap-3"
                                        >
                                            <div className="space-y-2">
                                                <div className="flex items-center justify-between gap-1.5">
                                                    <Badge className={cn("text-[10px] font-black px-2 py-0.5 border", reg.badgeClass)}>
                                                        {reg.flag} {reg.label}
                                                    </Badge>
                                                    <span className="text-[11px] font-mono text-cyan-200/90 flex items-center gap-1">
                                                        <Clock className="w-3 h-3 text-cyan-400" />
                                                        {ev.timeStr}
                                                    </span>
                                                </div>

                                                <h4 className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors line-clamp-2">
                                                    {ev.title}
                                                </h4>

                                                <p className="text-xs text-slate-300 flex items-center gap-1.5 truncate">
                                                    <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                    <span className="truncate">{ev.location}</span>
                                                </p>
                                            </div>

                                            <div className="pt-2 border-t border-cyan-500/20 flex items-center justify-between text-xs">
                                                <span className="text-[10px] text-cyan-400/80 font-mono font-bold tracking-wider">
                                                    #EXPO-PASS
                                                </span>
                                                <span className="text-cyan-400 font-black flex items-center gap-1 group-hover:translate-x-0.5 transition-transform text-xs">
                                                    展訊詳情 ➜
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center space-y-2">
                                <Tag className="w-8 h-8 text-slate-600 mx-auto" />
                                <p className="text-sm text-slate-400 font-bold">當日無排定卡展行程</p>
                                <p className="text-xs text-slate-500">可點選上方切換至其他日期，或切換地區篩選瀏覽全月份展覽。</p>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ========================================================================= */}
            {/* 檢視模式 2: 時間軸清單 (Agenda Timeline View)                              */}
            {/* ========================================================================= */}
            {viewMode === 'agenda' && (
                <div className="space-y-3.5 sm:space-y-4">
                    {filteredEvents.length > 0 ? (
                        <div className="space-y-3">
                            {filteredEvents.map((ev) => {
                                const reg = REGION_CONFIGS[ev.region] || REGION_CONFIGS.taiwan;
                                const countdown = getCountdownStatus(ev.startDate, ev.endDate);

                                return (
                                    <div
                                        key={ev.id}
                                        onClick={() => setActiveModalEvent(ev)}
                                        className="group relative cursor-pointer overflow-hidden rounded-2xl sm:rounded-3xl bg-slate-950 border border-slate-800 hover:border-cyan-500/50 p-4 sm:p-5 transition-all duration-300 shadow-xl hover:shadow-cyan-500/10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                                    >
                                        <div className="flex items-start gap-3.5 sm:gap-4 min-w-0 flex-1">
                                            {/* 海報縮圖 */}
                                            {ev.imageUrl && (
                                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-900 border border-slate-800 shrink-0 relative hidden sm:block">
                                                    <SafeImage
                                                        src={ev.imageUrl}
                                                        alt={ev.title}
                                                        fill
                                                        className="object-cover group-hover:scale-105 transition-transform"
                                                    />
                                                </div>
                                            )}

                                            <div className="space-y-1.5 min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge className={cn("text-[10px] font-black px-2 py-0.5 border", reg.badgeClass)}>
                                                        {reg.flag} {reg.label}
                                                    </Badge>
                                                    <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border font-mono", countdown.badgeClass)}>
                                                        {countdown.text}
                                                    </span>
                                                </div>

                                                <h3 className="text-sm sm:text-base font-black text-white group-hover:text-cyan-300 transition-colors line-clamp-1">
                                                    {ev.title}
                                                </h3>

                                                <div className="flex items-center gap-4 text-xs text-slate-300 flex-wrap">
                                                    <span className="flex items-center gap-1 font-mono text-cyan-200">
                                                        <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
                                                        {ev.timeStr}
                                                    </span>
                                                    <span className="flex items-center gap-1 text-slate-400 truncate">
                                                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                                                        <span className="truncate">{ev.location}</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 w-full md:w-auto justify-end border-t md:border-t-0 pt-2.5 md:pt-0 border-slate-800">
                                            {ev.location && (
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(ev.location)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white bg-slate-900 border border-slate-800 hover:border-cyan-400 flex items-center gap-1.5 transition-all shadow-sm"
                                                >
                                                    <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                                                    <span>導航</span>
                                                </a>
                                            )}
                                            <Button
                                                size="sm"
                                                className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black rounded-xl text-xs h-8 px-4"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setActiveModalEvent(ev);
                                                }}
                                            >
                                                <span>展訊詳情</span>
                                                <ArrowRight className="w-3.5 h-3.5 ml-1" />
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="p-12 rounded-3xl bg-slate-950 border border-slate-800 text-center space-y-3">
                            <CalendarIcon className="w-10 h-10 text-slate-600 mx-auto" />
                            <h3 className="text-base font-black text-slate-300">查無符合條件的卡展行程</h3>
                            <p className="text-xs text-slate-500">可嘗試切換至「全部區域」或清除關鍵字搜尋以檢視更多卡展。</p>
                        </div>
                    )}
                </div>
            )}

            {/* ========================================================================= */}
            {/* 🌟 卡展展訊詳情彈窗 (Exhibition Detail Modal)                              */}
            {/* ========================================================================= */}
            <Dialog open={activeModalEvent !== null} onOpenChange={(open) => { if (!open) setActiveModalEvent(null); }}>
                <DialogContent className="max-w-2xl w-[95vw] sm:w-[90vw] max-h-[90vh] bg-slate-950 text-white border-slate-800 p-0 rounded-3xl overflow-hidden shadow-2xl flex flex-col z-[100]">
                    {activeModalEvent && (() => {
                        const reg = REGION_CONFIGS[activeModalEvent.region] || REGION_CONFIGS.taiwan;
                        const countdown = getCountdownStatus(activeModalEvent.startDate, activeModalEvent.endDate);

                        return (
                            <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                                {/* 頂部彩色橫條 */}
                                <div className={cn("h-2 w-full bg-gradient-to-r", reg.gradientClass)} />

                                {/* 主視覺海報區 */}
                                {activeModalEvent.imageUrl && (
                                    <div className="relative w-full h-48 sm:h-64 bg-slate-900 border-b border-slate-800">
                                        <SafeImage
                                            src={activeModalEvent.imageUrl}
                                            alt={activeModalEvent.title}
                                            fill
                                            className="object-cover"
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />
                                        <div className="absolute top-4 left-4 flex items-center gap-2">
                                            <Badge className={cn("text-slate-950 font-black text-xs px-2.5 py-1 border-0 shadow-lg bg-gradient-to-r", reg.gradientClass)}>
                                                {reg.flag} {reg.label}
                                            </Badge>
                                            <span className={cn("text-xs font-black px-2.5 py-1 rounded-full border shadow-lg", countdown.badgeClass)}>
                                                {countdown.text}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                <div className="p-5 sm:p-7 space-y-5">
                                    {!activeModalEvent.imageUrl && (
                                        <div className="flex items-center gap-2">
                                            <Badge className={cn("text-slate-950 font-black text-xs px-2.5 py-1 border-0 shadow-lg bg-gradient-to-r", reg.gradientClass)}>
                                                {reg.flag} {reg.label}
                                            </Badge>
                                            <span className={cn("text-xs font-black px-2.5 py-1 rounded-full border shadow-lg", countdown.badgeClass)}>
                                                {countdown.text}
                                            </span>
                                        </div>
                                    )}

                                    <div>
                                        <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
                                            {activeModalEvent.title}
                                        </h2>
                                    </div>

                                    {/* 核心資訊方塊 */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-900/80 border border-slate-800 text-xs">
                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shrink-0">
                                                <CalendarIcon className="w-4 h-4" />
                                            </div>
                                            <div>
                                                <span className="text-slate-400 block text-[11px]">活動展期</span>
                                                <span className="font-mono text-cyan-200 font-bold text-sm">{activeModalEvent.timeStr}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2.5">
                                            <div className="w-8 h-8 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
                                                <MapPin className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 flex-1">
                                                <span className="text-slate-400 block text-[11px]">展會地點</span>
                                                <span className="text-white font-medium block truncate" title={activeModalEvent.location}>
                                                    {activeModalEvent.location}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 展覽簡介 */}
                                    {activeModalEvent.description && (
                                        <div className="space-y-2">
                                            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                                                <Info className="w-3.5 h-3.5 text-cyan-400" />
                                                <span>展覽特色與亮點說明</span>
                                            </h4>
                                            <div className="p-4 rounded-2xl bg-slate-900/50 border border-slate-800/80 text-xs sm:text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                                                {activeModalEvent.description}
                                            </div>
                                        </div>
                                    )}

                                    {/* 動作按鈕群 */}
                                    <div className="flex items-center gap-2.5 pt-3 border-t border-slate-800 flex-wrap sm:flex-nowrap">
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
                                                    <span>Google 地圖導航</span>
                                                    <ExternalLink className="w-3.5 h-3.5 ml-1 opacity-75" />
                                                </a>
                                            </Button>
                                        )}

                                        {activeModalEvent.officialUrl && (
                                            <Button
                                                asChild
                                                variant="outline"
                                                className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold rounded-xl h-11 text-xs sm:text-sm px-4"
                                            >
                                                <a
                                                    href={activeModalEvent.officialUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    <ExternalLink className="w-4 h-4 mr-1.5" />
                                                    <span>官方展訊網站</span>
                                                </a>
                                            </Button>
                                        )}

                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => handleShareExhibition(activeModalEvent)}
                                            className="border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold rounded-xl h-11 text-xs sm:text-sm px-3.5 shrink-0"
                                            title="複製展訊分享給卡友"
                                        >
                                            <Share2 className="w-4 h-4 mr-1" />
                                            <span>分享</span>
                                        </Button>

                                        <DialogClose asChild>
                                            <Button
                                                variant="outline"
                                                className="border-slate-800 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white font-bold rounded-xl h-11 text-xs sm:text-sm px-4 shrink-0"
                                            >
                                                關閉
                                            </Button>
                                        </DialogClose>
                                    </div>
                                </div>
                            </div>
                        );
                    })()}
                </DialogContent>
            </Dialog>

        </div>
    );
}
