'use client';

import { useState, useMemo } from 'react';
import { Trophy, Clock, ShieldCheck, Sparkles, ExternalLink } from 'lucide-react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MarqueeContainer } from './ui/marquee-container';
import { useAnnouncementData } from '@/hooks/use-announcement-data';
import { PPlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { PLACEHOLDER_CARD_IMAGE } from '@/lib/placeholders';

interface Announcement {
    id: string;
    username: string;
    action?: string;
    prize: string;
    prizeImageUrl?: string;
    rarity: 'legendary' | 'rare' | 'common';
    timestamp: any;
    section?: string;
    poolName?: string;
}

// 備用示範資料（當資料庫無傳奇數據時，提供清晰且多元的中獎喜報）
const MOCK_LEGENDARY_ANNOUNCEMENTS: Announcement[] = [
    {
        id: 'mock-1',
        username: '卡牌達人阿豪',
        prize: '2003-04 Upper Deck Exquisite LeBron James Rookie Auto',
        prizeImageUrl: 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=600&auto=format&fit=crop',
        rarity: 'legendary',
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 120 },
        poolName: 'NBA 殿堂巨星爆率池'
    },
    {
        id: 'mock-2',
        username: '歐皇大魔王',
        prize: '1999 Pokémon Base Set Shadowless Charizard #4',
        prizeImageUrl: 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?q=80&w=600&auto=format&fit=crop',
        rarity: 'legendary',
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 480 },
        poolName: '寶可夢初代經典特別賞'
    },
    {
        id: 'mock-3',
        username: 'P+歐王',
        prize: '2018 Shohei Ohtani Bowman Chrome Auto RC PSA 10',
        prizeImageUrl: 'https://images.unsplash.com/photo-1562077772-3bd90403f7f0?q=80&w=600&auto=format&fit=crop',
        rarity: 'legendary',
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 1200 },
        poolName: 'MLB 傳奇球星卡池'
    },
    {
        id: 'mock-4',
        username: '幸運星小莉',
        prize: '海賊王 蒙其·D·魯夫 限制連載紀念金卡 1/1',
        prizeImageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop',
        rarity: 'legendary',
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 2400 },
        poolName: '日漫限定一賞'
    },
    {
        id: 'mock-5',
        username: '收藏家K哥',
        prize: '2000 Playoff Contenders Tom Brady Rookie Auto',
        prizeImageUrl: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?q=80&w=600&auto=format&fit=crop',
        rarity: 'legendary',
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 3600 },
        poolName: 'NFL 跨時代傳奇賞'
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

interface HallOfFameMarqueeProps {
    showTicker?: boolean;
    className?: string;
}

/**
 * 抽卡頁面極簡傳奇大獎牆（Simple & Clear Streamlined Marquee）
 * 消除厚重卡片，採用輕盈的一列走馬燈膠囊，一目了然誰抽中了什麼大獎
 */
export function HallOfFameMarquee({ className }: HallOfFameMarqueeProps = {}) {
    const [selectedItem, setSelectedItem] = useState<Announcement | null>(null);

    const { data: realAnnouncements } = useAnnouncementData<Announcement>(50, (data) => 
        data.filter(a => a.rarity === 'legendary' && (a.section === 'draw' || !a.section)).slice(0, 20)
    );

    // 智慧去重並補足資料，避免單一玩家/單一獎項連續刷屏造成視覺混亂
    const displayList = useMemo(() => {
        if (realAnnouncements && realAnnouncements.length > 0) {
            const uniqueList: Announcement[] = [];
            const seen = new Set<string>();

            for (const item of realAnnouncements) {
                const key = `${item.username}__${item.prize}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    uniqueList.push(item);
                } else if (uniqueList.length < 3) {
                    uniqueList.push(item);
                }
            }

            if (uniqueList.length < 4) {
                return [...uniqueList, ...MOCK_LEGENDARY_ANNOUNCEMENTS.slice(0, 5 - uniqueList.length)];
            }
            return uniqueList;
        }
        return MOCK_LEGENDARY_ANNOUNCEMENTS;
    }, [realAnnouncements]);

    const MarqueeItem = ({ item }: { item: Announcement }) => {
        const timeText = formatTimeAgo(item.timestamp);
        const isPointPrize = item.prize.includes('P+') || item.prize.includes('點數') || item.prize.includes('鑽石');

        return (
            <div 
                onClick={() => setSelectedItem(item)}
                title="點擊查看得獎詳情"
                className="flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 mx-1.5 rounded-xl bg-gradient-to-b from-white/[0.06] to-white/[0.02] hover:from-amber-500/15 hover:to-amber-950/25 border border-white/[0.1] hover:border-amber-400/45 shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all duration-200 cursor-pointer shrink-0 select-none group"
            >
                {/* 金邊縮圖 / 點數圖標 */}
                <div className="w-6 h-6 rounded-lg overflow-hidden bg-amber-500/15 ring-1 ring-amber-300/35 flex items-center justify-center shrink-0">
                    {isPointPrize ? (
                        <PPlusIcon className="w-3.5 h-3.5 text-amber-300" />
                    ) : item.prizeImageUrl ? (
                        <div className="relative w-full h-full">
                            <Image 
                                src={item.prizeImageUrl} 
                                alt={item.prize} 
                                fill 
                                className="object-cover" 
                                referrerPolicy="no-referrer" 
                                sizes="24px"
                            />
                        </div>
                    ) : (
                        <Trophy className="w-3.5 h-3.5 text-amber-300" />
                    )}
                </div>

                {/* 玩家名稱 */}
                <span className="text-xs font-bold text-amber-300 group-hover:text-amber-200 transition-colors shrink-0">
                    {item.username}
                </span>

                <span className="text-[11px] text-slate-400 shrink-0">喜獲</span>

                {/* 獎品名稱 */}
                <span className="text-xs font-semibold text-white max-w-[150px] sm:max-w-[240px] truncate">
                    {item.prize}
                </span>

                {/* 時間戳 */}
                <span className="text-[10px] text-slate-400 font-mono pl-2 border-l border-white/[0.12] shrink-0">
                    {timeText}
                </span>
            </div>
        );
    };

    return (
        <div className={cn("relative z-10", className)}>
            {/* 奢華黑金廣播跑馬燈外框 */}
            <div className="relative flex items-center bg-gradient-to-r from-[#090d18] via-[#11172a] to-[#090d18] border border-amber-400/25 rounded-2xl py-2 px-2.5 sm:px-3 shadow-[0_10px_30px_rgba(0,0,0,0.65)] overflow-hidden">
                <div className="absolute top-0 inset-x-12 h-px bg-gradient-to-r from-transparent via-amber-300/45 to-transparent pointer-events-none" />

                {/* 左側金箔錨點徽章 */}
                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 rounded-xl text-slate-950 text-xs font-bold shrink-0 shadow-[0_2px_12px_rgba(245,158,11,0.3)] select-none">
                    <Trophy className="w-3.5 h-3.5 text-slate-950" />
                    <span className="tracking-wide">傳奇大獎</span>
                </div>

                {/* 跑馬燈內容區 */}
                <div className="relative flex-1 overflow-hidden flex items-center ml-2 sm:ml-2.5">
                    <div className="absolute inset-y-0 left-0 w-6 sm:w-10 bg-gradient-to-r from-[#0b101d] to-transparent z-10 pointer-events-none" />
                    <div className="absolute inset-y-0 right-0 w-6 sm:w-10 bg-gradient-to-l from-[#0b101d] to-transparent z-10 pointer-events-none" />

                    <MarqueeContainer speed="normal">
                        {displayList.map((item, index) => (
                            <MarqueeItem key={`${item.id}-${index}`} item={item} />
                        ))}
                    </MarqueeContainer>
                </div>
            </div>

            {/* 點擊膠囊彈出的大獎詳情 Modal */}
            <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
                <DialogContent className="bg-slate-950/95 backdrop-blur-2xl border-amber-500/40 text-white rounded-3xl p-5 sm:p-6 max-w-md w-11/12 mx-auto shadow-[0_0_50px_rgba(245,158,11,0.25)]">
                    <DialogHeader className="space-y-2 text-left border-b border-amber-500/20 pb-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-black w-fit">
                            <Trophy className="w-3.5 h-3.5 text-amber-400" /> 傳奇大獎喜報
                        </div>
                        <DialogTitle className="text-base sm:text-lg font-black text-amber-200 leading-snug">
                            {selectedItem?.prize}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs font-mono flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            全服傳奇認證 · {selectedItem && formatTimeAgo(selectedItem.timestamp)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 pt-2">
                        {/* 展覽大圖（完整直立顯示卡片，不裁切不遮擋） */}
                        <div className="relative w-full h-[290px] sm:h-[330px] rounded-2xl overflow-hidden border border-amber-300/35 bg-[#060912] shadow-inner flex items-center justify-center p-3">
                            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(251,191,36,0.12),transparent_70%)] pointer-events-none" />
                            {selectedItem?.prize && (selectedItem.prize.includes('P+') || selectedItem.prize.includes('點數') || selectedItem.prize.includes('鑽石')) && (!selectedItem.prizeImageUrl || selectedItem.prizeImageUrl.includes('picsum') || selectedItem.prizeImageUrl.includes('placeholder')) ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-950/60 via-slate-950 to-indigo-950/60 p-6 text-center rounded-xl">
                                    <div className="p-3 rounded-full bg-amber-500/20 border-2 border-amber-400/60 mb-2 shadow-[0_0_20px_rgba(245,158,11,0.5)]">
                                        <PPlusIcon className="w-12 h-12 text-amber-300" />
                                    </div>
                                    <span className="text-lg font-black text-amber-300 font-mono">{selectedItem.prize}</span>
                                    <span className="text-xs text-amber-200/70 mt-0.5">點數大獎</span>
                                </div>
                            ) : (
                                <div className="relative w-full h-full">
                                    <Image 
                                        src={selectedItem?.prizeImageUrl || PLACEHOLDER_CARD_IMAGE} 
                                        alt={selectedItem?.prize || 'Legendary Card'} 
                                        fill 
                                        referrerPolicy="no-referrer"
                                        className="object-contain drop-shadow-[0_12px_28px_rgba(0,0,0,0.85)]" 
                                    />
                                </div>
                            )}
                        </div>

                        {/* 幸運玩家與爆卡出處資訊列（移至卡片下方不遮擋卡面） */}
                        <div className="space-y-2">
                            <div className="bg-white/[0.04] border border-white/[0.1] px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs">
                                <span className="text-slate-400 font-bold">幸運玩家：</span>
                                <span className="text-white font-black text-sm">{selectedItem?.username}</span>
                            </div>
                            {selectedItem?.poolName && (
                                <div className="bg-amber-400/10 border border-amber-300/25 px-3.5 py-2.5 rounded-xl flex items-center justify-between text-xs">
                                    <span className="text-amber-200/80 font-bold">爆卡出處卡池：</span>
                                    <span className="text-[#FDE68A] font-black">{selectedItem.poolName}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}

export default HallOfFameMarquee;
