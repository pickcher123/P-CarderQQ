'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
    Megaphone, 
    Sparkles, 
    Trophy, 
    ChevronLeft, 
    ChevronRight, 
    Pause, 
    Play, 
    Copy, 
    ArrowRight, 
    Flame, 
    Radio, 
    Gift, 
    ExternalLink,
    Clock,
    CheckCircle2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where, Timestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

export type TickerCategory = 'all' | 'campaign' | 'winning';

export interface TickerItem {
    id: string;
    type: 'campaign' | 'winning';
    tag: string;
    title: string;
    description: string;
    timestampText?: string;
    promoCode?: string;
    actionType?: 'copy_code' | 'open_link' | 'view_prize';
    actionText?: string;
    actionUrl?: string;
    prizeData?: {
        prize: string;
        username: string;
        poolName?: string;
        prizeImageUrl?: string;
    };
    isHot?: boolean;
}

// 內建常規精選活動標語（保證隨時都有最豐富精彩的活動資訊）
const DEFAULT_CAMPAIGN_ITEMS: TickerItem[] = [
    {
        id: 'promo-open2024',
        type: 'campaign',
        tag: '限時首抽',
        title: '新玩家專屬福利 · 免費首抽狂歡',
        description: '慶祝改版盛典！輸入專屬代碼【OPEN2024】立即存入免費抽卡券，免運保真包郵寄送！',
        promoCode: 'OPEN2024',
        actionType: 'copy_code',
        actionText: '複製代碼',
        isHot: true
    },
    {
        id: 'promo-community',
        type: 'campaign',
        tag: '社群好禮',
        title: '加入官方 LINE 社群 · 獨家加贈免費抽卡券',
        description: '每位會員限領一次！加入社群與全台卡友即時交流爆卡戰報，最新卡池動態搶先看！',
        actionType: 'open_link',
        actionText: '前往社群',
        actionUrl: 'https://line.me/ti/g2/',
        isHot: true
    },
    {
        id: 'promo-rateup',
        type: 'campaign',
        tag: '爆率加倍',
        title: '殿堂級巨星卡池 · 傳奇金卡掉落機率 200% UP',
        description: '全服歐氣狂飆！NBA 與頂級日漫卡池限時加碼高階鑑定卡，智能保底機制全面運作！',
        isHot: true
    },
    {
        id: 'promo-checkin',
        type: 'campaign',
        tag: '每日簽到',
        title: '天天打卡領紅利 · 累積 P+ 點數換頂級卡盒',
        description: '每日簽到免費獲得高額紅利點數，連續簽到滿 7 日更享專屬商城限定神秘兌換好禮！'
    },
    {
        id: 'promo-authenticity',
        type: 'campaign',
        tag: '正品承諾',
        title: '全館卡牌 PSA / BGS 原裝密封 · 雙向公證安心保證',
        description: '所有中獎卡片皆經防偽封存並享防潮高規包裝，免運直寄府上，讓您收藏最安心！'
    }
];

// 備用真實感最新中獎新聞
const MOCK_WINNING_ITEMS: TickerItem[] = [
    {
        id: 'win-mock-1',
        type: 'winning',
        tag: '傳奇出金',
        title: '卡牌達人阿豪 斬獲傳奇大獎！',
        description: '在【NBA 殿堂巨星爆率池】一發入魂抽出「2003-04 LeBron James Rookie Auto」！',
        timestampText: '剛才',
        prizeData: {
            prize: '2003-04 LeBron James Rookie Auto',
            username: '卡牌達人阿豪',
            poolName: 'NBA 殿堂巨星爆率池'
        },
        isHot: true
    },
    {
        id: 'win-mock-2',
        type: 'winning',
        tag: '初代經典',
        title: '歐皇大魔王 喜提殿堂級神卡！',
        description: '在【寶可夢初代特別賞】幸運引爆「1999 Base Set 噴火龍 1st Edition PSA 10」！',
        timestampText: '5分鐘前',
        prizeData: {
            prize: '1999 Base Set 噴火龍 1st Edition PSA 10',
            username: '歐皇大魔王',
            poolName: '寶可夢初代經典特別賞'
        }
    },
    {
        id: 'win-mock-3',
        type: 'winning',
        tag: '歐氣爆棚',
        title: 'P+歐王 連抽引爆全場！',
        description: '在【MLB 傳奇球星卡池】精準命中「大谷翔平 Bowman Chrome Auto RC PSA 10」！',
        timestampText: '12分鐘前',
        prizeData: {
            prize: '大谷翔平 Bowman Chrome Auto RC PSA 10',
            username: 'P+歐王',
            poolName: 'MLB 傳奇球星卡池'
        },
        isHot: true
    },
    {
        id: 'win-mock-4',
        type: 'winning',
        tag: '日漫一賞',
        title: '幸運星小莉 奪下絕版限定金卡！',
        description: '在【日漫限定一賞】斬獲「海賊王 蒙其·D·魯夫 連載紀念金卡 1/1」！',
        timestampText: '28分鐘前',
        prizeData: {
            prize: '海賊王 蒙其·D·魯夫 連載紀念金卡 1/1',
            username: '幸運星小莉',
            poolName: '日漫限定一賞'
        }
    }
];

function formatTimeAgo(timestamp: any): string {
    if (!timestamp) return '剛剛';
    let seconds = 0;
    if (typeof timestamp.seconds === 'number') {
        seconds = timestamp.seconds;
    } else if (timestamp instanceof Date) {
        seconds = Math.floor(timestamp.getTime() / 1000);
    } else if (typeof timestamp === 'number') {
        seconds = Math.floor(timestamp / 1000);
    } else {
        return '剛剛';
    }

    const now = Math.floor(Date.now() / 1000);
    const diff = Math.max(0, now - seconds);

    if (diff < 60) return '剛才';
    if (diff < 3600) return `${Math.floor(diff / 60)} 分鐘前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)} 小時前`;
    return `${Math.floor(diff / 86400)} 天前`;
}

interface DynamicNewsTickerProps {
    onSelectPrize?: (prizeData: NonNullable<TickerItem['prizeData']>) => void;
    className?: string;
}

export function DynamicNewsTicker({ onSelectPrize, className }: DynamicNewsTickerProps) {
    const firestore = useFirestore();
    const { toast } = useToast();

    const [activeFilter, setActiveFilter] = useState<TickerCategory>('all');
    const [currentIndex, setCurrentIndex] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    // 1. 監聽 Firestore 中 announcements 集合（即時中獎資料與後台官方發布公告）
    const announcementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'announcements'),
            orderBy('timestamp', 'desc'),
            limit(20)
        );
    }, [firestore]);

    const { data: rawAnnouncements } = useCollection<any>(announcementsQuery);

    // 2. 監聽後台發布的官方公告（帶有 title 與 content）
    const adminNoticesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'announcements'),
            where('isActive', '==', true),
            limit(10)
        );
    }, [firestore]);

    const { data: rawAdminNotices } = useCollection<any>(adminNoticesQuery);

    // 整合所有動態公告與中獎新聞
    const allItems = useMemo<TickerItem[]>(() => {
        const campaignList: TickerItem[] = [...DEFAULT_CAMPAIGN_ITEMS];
        const winningList: TickerItem[] = [];

        // 若有後台自訂公告，轉換為活動標語
        if (rawAdminNotices && rawAdminNotices.length > 0) {
            rawAdminNotices.forEach((notice: any) => {
                if (notice.title && notice.content && !notice.prize) {
                    campaignList.unshift({
                        id: `admin-${notice.id}`,
                        type: 'campaign',
                        tag: notice.tag || '官方特報',
                        title: notice.title,
                        description: notice.content,
                        isHot: true
                    });
                }
            });
        }

        // 轉換真實中獎紀錄
        if (rawAnnouncements && rawAnnouncements.length > 0) {
            rawAnnouncements.forEach((item: any) => {
                if (item.prize && item.username) {
                    const timeText = formatTimeAgo(item.timestamp || item.createdAt);
                    winningList.push({
                        id: `real-win-${item.id}`,
                        type: 'winning',
                        tag: item.rarity === 'legendary' ? '傳奇出金' : '熱門中獎',
                        title: `${item.username} 喜獲傳奇大獎！`,
                        description: item.poolName 
                            ? `在【${item.poolName}】幸運抽中「${item.prize}」！`
                            : `成功斬獲高人氣大獎「${item.prize}」！`,
                        timestampText: timeText,
                        prizeData: {
                            prize: item.prize,
                            username: item.username,
                            poolName: item.poolName,
                            prizeImageUrl: item.prizeImageUrl
                        },
                        isHot: item.rarity === 'legendary'
                    });
                }
            });
        }

        // 如果資料庫中獎新聞不足，補上精選真實案例
        if (winningList.length < 3) {
            winningList.push(...MOCK_WINNING_ITEMS);
        }

        // 依交錯順序編排，讓新聞與標語動態融合
        const mixed: TickerItem[] = [];
        const maxLen = Math.max(campaignList.length, winningList.length);
        for (let i = 0; i < maxLen; i++) {
            if (i < campaignList.length) mixed.push(campaignList[i]);
            if (i < winningList.length) mixed.push(winningList[i]);
        }

        return mixed;
    }, [rawAnnouncements, rawAdminNotices]);

    // 根據標籤過濾項目
    const filteredItems = useMemo(() => {
        if (activeFilter === 'all') return allItems;
        return allItems.filter(item => item.type === activeFilter);
    }, [allItems, activeFilter]);

    // 當過濾改變時重設索引
    useEffect(() => {
        setCurrentIndex(0);
    }, [activeFilter]);

    // 自動定時輪播（4.8 秒切換）
    useEffect(() => {
        if (isPaused || filteredItems.length <= 1) return;

        const timer = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % filteredItems.length);
        }, 4800);

        return () => clearInterval(timer);
    }, [isPaused, filteredItems.length]);

    const currentItem = filteredItems[currentIndex] || filteredItems[0] || DEFAULT_CAMPAIGN_ITEMS[0];

    const handlePrev = () => {
        setCurrentIndex((prev) => (prev - 1 + filteredItems.length) % filteredItems.length);
    };

    const handleNext = () => {
        setCurrentIndex((prev) => (prev + 1) % filteredItems.length);
    };

    // 複製活動代碼
    const handleCopyPromoCode = (code: string) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(code);
            setCopiedCode(code);
            setTimeout(() => setCopiedCode(null), 2500);

            confetti({
                particleCount: 35,
                spread: 50,
                origin: { y: 0.7 }
            });

            toast({
                title: `🎉 已複製活動序號：${code}`,
                description: '請前往「領券中心」或卡池結帳直接輸入，立即領取專屬福利！',
            });
        }
    };

    // 點擊動作處理
    const handleItemAction = (item: TickerItem) => {
        if (item.actionType === 'copy_code' && item.promoCode) {
            handleCopyPromoCode(item.promoCode);
        } else if (item.actionType === 'open_link' && item.actionUrl) {
            window.open(item.actionUrl, '_blank', 'noopener,noreferrer');
        } else if (item.type === 'winning' && item.prizeData && onSelectPrize) {
            onSelectPrize(item.prizeData);
        }
    };

    return (
        <div className={cn("w-full max-w-6xl mx-auto px-2 sm:px-4 mb-2 sm:mb-3", className)}>
            {/* 主外框：微奢黑金琉璃質感 */}
            <div 
                onMouseEnter={() => setIsPaused(true)}
                onMouseLeave={() => setIsPaused(false)}
                className={cn(
                    "relative rounded-2xl border transition-all duration-300 overflow-hidden shadow-lg",
                    "bg-gradient-to-r from-slate-950 via-[#0d1424] to-slate-950",
                    "border-amber-500/25 hover:border-amber-500/40",
                    "shadow-[0_4px_25px_rgba(0,0,0,0.6),0_0_15px_rgba(245,158,11,0.06)]"
                )}
            >
                {/* 頂部極細光條裝飾 */}
                <div className="absolute top-0 left-0 right-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />

                <div className="p-2 sm:p-2.5 flex flex-col md:flex-row items-center justify-between gap-2 sm:gap-3">
                    
                    {/* 左側：LIVE 動態徽章 + 分類切換按鈕 */}
                    <div className="flex items-center justify-between w-full md:w-auto gap-1.5 sm:gap-2 shrink-0">
                        {/* 即時廣播 LIVE 閃爍標籤 */}
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-gradient-to-r from-amber-500/20 via-amber-500/10 to-amber-900/30 border border-amber-400/40 text-amber-300 shadow-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
                            </span>
                            <Radio className="w-3 h-3 text-amber-400 animate-pulse hidden xs:block" />
                            <span className="text-[11px] font-black tracking-wider font-headline uppercase text-amber-300">
                                LIVE 廣播
                            </span>
                        </div>

                        {/* 分類快速過濾 Tab */}
                        <div className="flex items-center bg-slate-900/80 p-0.5 rounded-lg border border-slate-800">
                            <button
                                type="button"
                                onClick={() => setActiveFilter('all')}
                                className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold transition-all",
                                    activeFilter === 'all'
                                        ? "bg-amber-500 text-slate-950 shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                全部
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter('campaign')}
                                className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1",
                                    activeFilter === 'campaign'
                                        ? "bg-amber-500 text-slate-950 shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <Flame className="w-2.5 h-2.5 text-amber-500" />
                                活動特報
                            </button>
                            <button
                                type="button"
                                onClick={() => setActiveFilter('winning')}
                                className={cn(
                                    "px-2 py-0.5 rounded-md text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1",
                                    activeFilter === 'winning'
                                        ? "bg-amber-500 text-slate-950 shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <Trophy className="w-2.5 h-2.5 text-yellow-400" />
                                中獎喜報
                            </button>
                        </div>
                    </div>

                    {/* 中間：動態輪播內容區塊 (具備上下滑入/淡出動畫) */}
                    <div className="flex-1 min-w-0 w-full overflow-hidden relative h-10 sm:h-9 flex items-center px-1">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={currentItem.id}
                                initial={{ opacity: 0, y: 12 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -12 }}
                                transition={{ duration: 0.35, ease: 'easeOut' }}
                                className="w-full flex items-center justify-between gap-2"
                            >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    {/* 類型小標籤 */}
                                    <Badge 
                                        className={cn(
                                            "shrink-0 text-[10px] font-black px-1.5 py-0.5 rounded-md border-none flex items-center gap-1",
                                            currentItem.type === 'winning' 
                                                ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950" 
                                                : "bg-gradient-to-r from-teal-500 to-emerald-500 text-slate-950"
                                        )}
                                    >
                                        {currentItem.type === 'winning' ? <Trophy className="w-2.5 h-2.5" /> : <Sparkles className="w-2.5 h-2.5" />}
                                        {currentItem.tag}
                                    </Badge>

                                    {/* 公告標題與摘要（點擊中獎項目可互動） */}
                                    <div 
                                        onClick={() => handleItemAction(currentItem)}
                                        className={cn(
                                            "flex items-baseline gap-1.5 sm:gap-2 min-w-0 cursor-pointer group/title",
                                        )}
                                    >
                                        <span className="text-xs sm:text-sm font-black text-slate-100 group-hover/title:text-amber-300 transition-colors shrink-0">
                                            {currentItem.title}
                                        </span>
                                        <span className="text-[11px] sm:text-xs text-slate-400 truncate hidden xs:inline">
                                            {currentItem.description}
                                        </span>
                                        {currentItem.timestampText && (
                                            <span className="text-[10px] text-amber-400/80 font-mono shrink-0 flex items-center gap-0.5">
                                                <Clock className="w-2.5 h-2.5" />
                                                {currentItem.timestampText}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* 右側動作按鈕 (例如快速複製代碼、前往領券等) */}
                                <div className="shrink-0 flex items-center gap-1.5">
                                    {currentItem.promoCode && (
                                        <Button
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleCopyPromoCode(currentItem.promoCode!);
                                            }}
                                            className="h-7 px-2 sm:px-2.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/40 text-[10px] sm:text-xs font-bold gap-1 shadow-sm transition-all"
                                        >
                                            {copiedCode === currentItem.promoCode ? (
                                                <>
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                                    <span className="text-emerald-300 font-black">已複製</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Copy className="w-3 h-3 text-amber-400" />
                                                    <span>{currentItem.actionText || '複製代碼'}</span>
                                                </>
                                            )}
                                        </Button>
                                    )}

                                    {currentItem.actionType === 'open_link' && (
                                        <Button
                                            size="sm"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                window.open(currentItem.actionUrl || 'https://line.me/ti/g2/', '_blank', 'noopener,noreferrer');
                                            }}
                                            className="h-7 px-2 sm:px-2.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 text-[10px] sm:text-xs font-bold gap-1 shadow-sm transition-all"
                                        >
                                            <ExternalLink className="w-3 h-3 text-emerald-400" />
                                            <span>{currentItem.actionText || '前往連結'}</span>
                                        </Button>
                                    )}
                                </div>
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* 右側：輪播導航控制鍵 (上一個、暫停、下一個、頁碼) */}
                    <div className="flex items-center justify-between w-full md:w-auto gap-1 sm:gap-2 shrink-0 border-t md:border-t-0 border-slate-800/80 pt-1 md:pt-0">
                        {/* 索引指示 (例如 1 / 8) */}
                        <div className="text-[10px] sm:text-xs font-mono text-slate-400 flex items-center gap-1 pl-1">
                            <span className="text-amber-400 font-bold">{currentIndex + 1}</span>
                            <span className="opacity-40">/</span>
                            <span>{filteredItems.length}</span>
                        </div>

                        <div className="flex items-center gap-0.5 sm:gap-1 bg-slate-900/90 rounded-lg p-0.5 border border-slate-800">
                            {/* 上一則 */}
                            <button
                                type="button"
                                onClick={handlePrev}
                                title="上一則公告"
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                            >
                                <ChevronLeft className="w-3.5 h-3.5" />
                            </button>

                            {/* 暫停 / 播放 */}
                            <button
                                type="button"
                                onClick={() => setIsPaused(!isPaused)}
                                title={isPaused ? "繼續播放" : "暫停播放"}
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                            >
                                {isPaused ? <Play className="w-3 h-3 text-emerald-400" /> : <Pause className="w-3 h-3" />}
                            </button>

                            {/* 下一則 */}
                            <button
                                type="button"
                                onClick={handleNext}
                                title="下一則公告"
                                className="w-6 h-6 rounded flex items-center justify-center text-slate-400 hover:text-amber-300 hover:bg-slate-800 transition-colors"
                            >
                                <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
