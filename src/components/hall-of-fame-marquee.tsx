'use client';

import { useState, useMemo } from 'react';
import { Crown, Sparkles, Flame, Trophy, Clock, User, ShieldCheck } from 'lucide-react';
import Image from 'next/image';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { MarqueeContainer } from './ui/marquee-container';
import { useAnnouncementData } from '@/hooks/use-announcement-data';

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

        return (
            <div 
                onClick={() => setSelectedItem(item)}
                className="flex-shrink-0 mx-3 md:mx-6 group py-2 my-1 cursor-pointer select-none"
            >
                {/* 奢華黃金外框與卡片體 */}
                <div className="relative flex items-center p-[2px] rounded-2xl bg-gradient-to-b from-amber-200 via-amber-500/80 to-amber-700/90 shadow-[0_0_20px_rgba(234,179,8,0.25)] transition-all duration-500 group-hover:scale-105 group-hover:shadow-[0_0_35px_rgba(234,179,8,0.5)] group-hover:from-white group-hover:via-amber-300 group-hover:to-amber-500">
                    
                    {/* 卡片本體容器 */}
                    <div className="relative flex items-center gap-3 md:gap-4 bg-slate-950/95 backdrop-blur-md px-3 py-2.5 md:px-4 md:py-3 rounded-[14px] overflow-hidden w-[260px] md:w-[320px]">
                        
                        {/* 背景流光極致掃過特效 */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent" />
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-1000 pointer-events-none -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/15 to-transparent" />

                        {/* 卡片封面圖 */}
                        <div className="relative w-16 h-22 md:w-20 md:h-28 rounded-xl overflow-hidden border border-amber-400/40 shrink-0 shadow-md group-hover:border-amber-300 transition-colors">
                            <Image 
                                src={item.prizeImageUrl || 'https://picsum.photos/seed/legendary/200/300'} 
                                alt={item.prize}
                                fill
                                referrerPolicy="no-referrer"
                                className="object-cover transition-transform duration-700 group-hover:scale-110"
                                sizes="80px"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-60" />
                            
                            {/* 皇冠與稀有標章 */}
                            <div className="absolute top-1 right-1 p-1 rounded-full bg-amber-500/90 text-slate-950 shadow-lg animate-pulse">
                                <Crown className="w-2.5 h-2.5 md:w-3 md:h-3" />
                            </div>
                        </div>

                        {/* 卡片詳細內容 */}
                        <div className="flex-1 min-w-0 space-y-1 md:space-y-1.5">
                            <div className="flex items-center justify-between gap-1">
                                <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-[9px] md:text-[10px] h-4 px-1.5 uppercase tracking-wider border-none shadow-sm flex items-center gap-0.5 shrink-0">
                                    <Trophy className="w-2.5 h-2.5" /> LEGENDARY
                                </Badge>
                                <span className="text-[10px] text-amber-300/80 font-mono font-medium truncate flex items-center gap-1">
                                    <Clock className="w-2.5 h-2.5 text-amber-400 shrink-0" />
                                    {timeText}
                                </span>
                            </div>

                            <h3 className="text-xs md:text-sm font-black text-slate-100 group-hover:text-amber-300 transition-colors line-clamp-2 leading-tight tracking-tight">
                                {item.prize}
                            </h3>

                            <div className="flex items-center gap-1.5 pt-0.5 border-t border-amber-500/15">
                                <div className="w-4 h-4 rounded-full bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0">
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
        <section className="py-3 md:py-6 relative overflow-hidden">
            {/* 標題與裝飾 Header */}
            <div className="container max-w-6xl mx-auto mb-3 md:mb-5 px-4 relative z-10">
                <div className="flex flex-col items-center text-center space-y-1.5">
                    
                    {/* 頂部極致金光 Header */}
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold tracking-widest uppercase mb-1 shadow-[0_0_15px_rgba(234,179,8,0.15)]">
                        <Flame className="w-3.5 h-3.5 text-amber-400 animate-bounce" /> 殿堂級神卡喜訊 · 全服注目
                    </div>

                    <div className="flex items-center justify-center gap-3 md:gap-4">
                        <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-amber-400 animate-pulse" />
                        <h2 className="text-2xl md:text-4xl font-black font-headline tracking-[0.25em] italic uppercase relative group">
                            <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-100 via-amber-300 to-yellow-500 drop-shadow-[0_0_20px_rgba(234,179,8,0.6)]">
                                傳奇大獎牆
                            </span>
                        </h2>
                        <Sparkles className="w-5 h-5 md:w-6 md:h-6 text-amber-400 animate-pulse" />
                    </div>

                    <p className="text-xs text-amber-200/60 font-medium tracking-wide">
                        懸停可暫停賞析 · 點擊卡片查看大獎詳情
                    </p>

                    {/* 金光流光底線 */}
                    <div className="w-24 md:w-36 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent rounded-full shadow-[0_0_12px_rgba(234,179,8,0.8)] mt-1" />
                </div>
            </div>

            {/* 跑馬燈卡片流 */}
            <div className="relative flex items-center group/marquee">
                {/* 兩側亮暗漸變暗影 */}
                <div className="absolute inset-y-0 left-0 w-16 md:w-44 bg-gradient-to-r from-background via-background/60 to-transparent z-20 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-16 md:w-44 bg-gradient-to-l from-background via-background/60 to-transparent z-20 pointer-events-none" />

                <MarqueeContainer speed="normal">
                    {displayList.map((item, index) => (
                        <MarqueeItem key={`${item.id}-${index}`} item={item} />
                    ))}
                </MarqueeContainer>
            </div>

            {/* 點擊卡片彈出的傳奇大獎 Modal */}
            <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
                <DialogContent className="bg-slate-950 border-amber-500/40 text-white rounded-[2rem] p-6 max-w-md w-11/12 mx-auto shadow-[0_0_60px_rgba(234,179,8,0.3)]">
                    <DialogHeader className="space-y-2 text-left border-b border-amber-500/20 pb-4">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs font-black w-fit">
                            <Crown className="w-3.5 h-3.5 text-amber-400" /> LEGENDARY HALL OF FAME
                        </div>
                        <DialogTitle className="text-xl sm:text-2xl font-black text-amber-200 leading-snug">
                            {selectedItem?.prize}
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs font-mono flex items-center gap-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                            全服傳奇認證 · {selectedItem && formatTimeAgo(selectedItem.timestamp)}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 pt-2">
                        {/* 展覽大圖 */}
                        <div className="relative w-full aspect-[3/4] rounded-2xl overflow-hidden border-2 border-amber-400/50 bg-slate-900 shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                            <Image 
                                src={selectedItem?.prizeImageUrl || 'https://picsum.photos/seed/legendary/400/600'} 
                                alt={selectedItem?.prize || 'Legendary Card'} 
                                fill 
                                referrerPolicy="no-referrer"
                                className="object-cover" 
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />
                            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-xs font-bold text-amber-300 bg-slate-950/80 backdrop-blur-md p-2.5 rounded-xl border border-amber-500/30">
                                <span>幸運收藏家：</span>
                                <span className="text-white font-black text-sm">{selectedItem?.username}</span>
                            </div>
                        </div>

                        {/* 出處說明 */}
                        {selectedItem?.poolName && (
                            <div className="bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-center justify-between text-xs">
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

