'use client';

import { useState, useMemo } from 'react';
import { Crown, Sparkles, Trophy, Clock, User, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MarqueeContainer } from './ui/marquee-container';
import { useAnnouncementData } from '@/hooks/use-announcement-data';
import { PPlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

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

// 備用示範資料（當資料庫無傳奇數據時，提供絕美黑金視覺呈現）
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
        prize: '1999 Pokémon Base Set Shadowless 1st Edition Charizard #4',
        prizeImageUrl: 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?q=80&w=600&auto=format&fit=crop',
        rarity: 'legendary',
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 600 },
        poolName: '寶可夢初代經典特別賞'
    },
    {
        id: 'mock-3',
        username: 'P+歐王',
        prize: '2018 Shohei Ohtani Bowman Chrome Auto RC PSA 10',
        prizeImageUrl: 'https://images.unsplash.com/photo-1562077772-3bd90403f7f0?q=80&w=600&auto=format&fit=crop',
        rarity: 'legendary',
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 1800 },
        poolName: 'MLB 傳奇球星卡池'
    },
    {
        id: 'mock-4',
        username: '收藏家K哥',
        prize: '2000 Playoff Contenders Tom Brady Rookie Auto',
        prizeImageUrl: 'https://images.unsplash.com/photo-1566577739112-5180d4bf9390?q=80&w=600&auto=format&fit=crop',
        rarity: 'legendary',
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 3600 },
        poolName: 'NFL 跨時代傳奇賞'
    },
    {
        id: 'mock-5',
        username: '幸運星小莉',
        prize: '海賊王 蒙其·D·魯夫 限制連載紀念金卡 1/1',
        prizeImageUrl: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?q=80&w=600&auto=format&fit=crop',
        rarity: 'legendary',
        timestamp: { seconds: Math.floor(Date.now() / 1000) - 7200 },
        poolName: '日漫限定一賞'
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

export function HallOfFameMarquee() {
    const [selectedItem, setSelectedItem] = useState<Announcement | null>(null);

    const { data: realAnnouncements } = useAnnouncementData<Announcement>(50, (data) => 
        data.filter(a => a.rarity === 'legendary' && (a.section === 'draw' || !a.section)).slice(0, 15)
    );

    // 整合實時資料與展示預設資料，確保隨時都是澎湃滿溢的傳奇氣勢
    const displayList = useMemo(() => {
        if (realAnnouncements && realAnnouncements.length > 0) {
            if (realAnnouncements.length < 5) {
                return [...realAnnouncements, ...MOCK_LEGENDARY_ANNOUNCEMENTS.slice(0, 5 - realAnnouncements.length)];
            }
            return realAnnouncements;
        }
        return MOCK_LEGENDARY_ANNOUNCEMENTS;
    }, [realAnnouncements]);

    const MarqueeItem = ({ item }: { item: Announcement }) => {
        const timeText = formatTimeAgo(item.timestamp);
        const isPointPrize = item.prize.includes('P+') || item.prize.includes('點數') || item.prize.includes('鑽石');

        return (
            <div 
                onClick={() => setSelectedItem(item)}
                className="flex-shrink-0 mx-2.5 sm:mx-4 group py-2 cursor-pointer select-none"
            >
                {/* 傳奇大獎牆精緻外框 */}
                <div className={cn(
                    "relative flex items-center p-[1px] rounded-2xl transition-all duration-300",
                    "bg-gradient-to-b from-amber-400/40 via-amber-600/20 to-slate-800/60",
                    "shadow-[0_4px_16px_rgba(0,0,0,0.6),0_0_10px_rgba(245,158,11,0.08)]",
                    "group-hover:shadow-[0_6px_20px_rgba(0,0,0,0.8),0_0_16px_rgba(245,158,11,0.25)]",
                    "group-hover:from-amber-400/70 group-hover:via-amber-500/40 group-hover:to-amber-700/50"
                )}>
                    {/* 卡片本體容器 */}
                    <div className="relative flex items-center gap-3 sm:gap-3.5 bg-slate-950/95 backdrop-blur-xl px-3 py-2.5 sm:px-3.5 sm:py-3 rounded-[15px] overflow-hidden w-[270px] sm:w-[310px]">
                        
                        {/* 頂部極光掃光流光效果 */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-amber-500/10 via-transparent to-transparent pointer-events-none" />
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-700 pointer-events-none -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                        {/* 獎項微縮封面 */}
                        <div className="relative w-14 h-20 sm:w-16 sm:h-22 rounded-xl overflow-hidden border border-amber-400/40 bg-slate-900 shrink-0 shadow-md group-hover:border-amber-400 transition-colors flex items-center justify-center">
                            {isPointPrize && (!item.prizeImageUrl || item.prizeImageUrl.includes('picsum') || item.prizeImageUrl.includes('placeholder')) ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-950 via-slate-950 to-indigo-950 p-2 text-center">
                                    <div className="p-1.5 rounded-full bg-amber-500/20 border border-amber-400/60 mb-1">
                                        <PPlusIcon className="w-6 h-6 text-amber-300" />
                                    </div>
                                    <span className="text-[9px] font-black text-amber-300 font-mono tracking-tight leading-none">P+ 點數大獎</span>
                                </div>
                            ) : (
                                <>
                                    <Image 
                                        src={item.prizeImageUrl || 'https://picsum.photos/seed/legendary/200/300'} 
                                        alt={item.prize}
                                        fill
                                        referrerPolicy="no-referrer"
                                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                                        sizes="70px"
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                                </>
                            )}
                        </div>

                        {/* 卡片詳細內容 */}
                        <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                            {/* 上列：稀有標籤 + 時間 */}
                            <div className="flex items-center justify-between gap-1 mb-1">
                                <Badge className="bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 text-slate-950 font-black text-[9px] h-4 px-1.5 uppercase tracking-wider border-none shadow-sm flex items-center gap-0.5 shrink-0">
                                    <Trophy className="w-2.5 h-2.5" /> 傳奇大獎
                                </Badge>
                                <span className="text-[10px] text-amber-200/70 font-mono flex items-center gap-1 shrink-0">
                                    <Clock className="w-2.5 h-2.5 text-amber-400" />
                                    {timeText}
                                </span>
                            </div>

                            {/* 中間：獎項名稱 */}
                            <h3 className="text-xs sm:text-sm font-black text-slate-100 group-hover:text-amber-300 transition-colors line-clamp-1 leading-snug tracking-tight my-0.5">
                                {item.prize}
                            </h3>

                            {/* 下列：幸運歐皇得主 */}
                            <div className="flex items-center gap-1.5 pt-1 mt-0.5 border-t border-amber-500/15">
                                <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400/40 flex items-center justify-center shrink-0">
                                    <User className="w-2.5 h-2.5 text-amber-300" />
                                </div>
                                <span className="text-[11px] text-slate-300 truncate font-semibold">
                                    歐皇: <span className="text-amber-400 font-bold">{item.username}</span>
                                </span>
                            </div>
                        </div>

                    </div>
                </div>
            </div>
        );
    };

    return (
        <section className="py-2 sm:py-4 relative overflow-hidden">
            {/* 標題與裝飾 Header */}
            <div className="container max-w-6xl mx-auto mb-2 px-4 relative z-10">
                <div className="flex items-center justify-center gap-2 text-center">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <h2 className="text-sm sm:text-base font-black font-headline tracking-widest uppercase bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-300 to-yellow-400">
                        傳奇大獎牆
                    </h2>
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                </div>
            </div>

            {/* 跑馬燈卡片流（兩側柔和暗部漸層） */}
            <div className="relative flex items-center group/marquee">
                <div className="absolute inset-y-0 left-0 w-12 sm:w-32 bg-gradient-to-r from-background/90 via-background/40 to-transparent z-20 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-12 sm:w-32 bg-gradient-to-l from-background/90 via-background/40 to-transparent z-20 pointer-events-none" />

                <MarqueeContainer speed="normal">
                    {displayList.map((item, index) => (
                        <MarqueeItem key={`${item.id}-${index}`} item={item} />
                    ))}
                </MarqueeContainer>
            </div>

            {/* 點擊卡片彈出的傳奇大獎 Modal */}
            <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
                <DialogContent className="bg-slate-950/95 backdrop-blur-2xl border-amber-500/40 text-white rounded-3xl p-5 sm:p-6 max-w-md w-11/12 mx-auto shadow-[0_0_60px_rgba(245,158,11,0.25)]">
                    <DialogHeader className="space-y-2 text-left border-b border-amber-500/20 pb-3">
                        <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-black w-fit">
                            <Crown className="w-3.5 h-3.5 text-amber-400" /> 傳奇名人堂認證
                        </div>
                        <DialogTitle className="text-lg sm:text-xl font-black text-amber-200 leading-snug">
                            {selectedItem?.prize}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs font-mono flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            全服傳奇認證 · {selectedItem && formatTimeAgo(selectedItem.timestamp)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* 展覽大圖 */}
                        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border-2 border-amber-400/50 bg-slate-900 shadow-[0_0_30px_rgba(245,158,11,0.2)] flex items-center justify-center">
                            {selectedItem?.prize && (selectedItem.prize.includes('P+') || selectedItem.prize.includes('點數') || selectedItem.prize.includes('鑽石')) && (!selectedItem.prizeImageUrl || selectedItem.prizeImageUrl.includes('picsum') || selectedItem.prizeImageUrl.includes('placeholder')) ? (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-amber-950 via-slate-950 to-indigo-950 p-6 text-center">
                                    <div className="p-4 rounded-full bg-amber-500/20 border-2 border-amber-400/60 mb-3 shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                                        <PPlusIcon className="w-16 h-16 text-amber-300" />
                                    </div>
                                    <span className="text-xl font-black text-amber-300 font-mono tracking-wide">{selectedItem.prize}</span>
                                    <span className="text-xs text-amber-200/70 mt-1">頂級點數大獎</span>
                                </div>
                            ) : (
                                <>
                                    <Image 
                                        src={selectedItem?.prizeImageUrl || 'https://picsum.photos/seed/legendary/400/600'} 
                                        alt={selectedItem?.prize || 'Legendary Card'} 
                                        fill 
                                        referrerPolicy="no-referrer"
                                        className="object-cover" 
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                                </>
                            )}
                            <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center justify-between text-xs font-bold text-amber-300 bg-slate-950/85 backdrop-blur-md px-3 py-2 rounded-xl border border-amber-500/30">
                                <span>幸運歐皇：</span>
                                <span className="text-white font-black text-sm">{selectedItem?.username}</span>
                            </div>
                        </div>

                        {/* 出處說明 */}
                        {selectedItem?.poolName && (
                            <div className="bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl flex items-center justify-between text-xs">
                                <span className="text-amber-200/80">爆卡出處卡池：</span>
                                <span className="text-amber-300 font-bold">{selectedItem.poolName}</span>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </section>
    );
}
