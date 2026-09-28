'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Megaphone, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { OFFICIAL_NEWS_LIST } from '@/lib/default-news';

interface NewsItem {
    id: string;
    title: string;
    category: string;
    isPinned?: boolean;
    isMarquee?: boolean;
    isDeleted?: boolean;
}

interface NewsMarqueeProps {
    isDrawing?: boolean;
}

export function NewsMarquee({ isDrawing }: NewsMarqueeProps) {
    const firestore = useFirestore();

    // 抓取最近的消息，前端過濾
    const newsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'news'),
            orderBy('createdAt', 'desc'),
            limit(30)
        );
    }, [firestore]);

    const { data: newsItems, isLoading } = useCollection<NewsItem>(newsQuery);

    const effectiveNews = useMemo(() => {
        const rawItems = newsItems || [];
        const customItems = rawItems.filter(n => !n.isDeleted);
        const existingIds = new Set(rawItems.map(n => n.id));
        const remainingOfficial = OFFICIAL_NEWS_LIST.filter(n => !existingIds.has(n.id));
        const all = [...customItems, ...remainingOfficial];
        return all.sort((a, b) => {
            const aPinned = Boolean(a.isPinned);
            const bPinned = Boolean(b.isPinned);
            if (aPinned !== bPinned) return aPinned ? -1 : 1;
            return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
        });
    }, [newsItems]);

    // 取得最新一則標記為跑馬燈的消息 (優先取置頂跑馬燈消息)
    const latestMarqueeItem = useMemo(() => {
        if (!effectiveNews || effectiveNews.length === 0) return null;
        return effectiveNews.find(n => n.isMarquee && n.isPinned) || 
               effectiveNews.find(n => n.isMarquee) || 
               effectiveNews[0];
    }, [effectiveNews]);

    if (isLoading || !latestMarqueeItem) {
        return null;
    }

    return (
        <div className={cn(
            "backdrop-blur-md border-b border-white/5 h-8 md:h-9 overflow-hidden relative shadow-sm transition-colors duration-500 w-full",
            isDrawing ? "bg-black/10" : "bg-black/10"
        )}>
            <div className="container mx-auto px-3 sm:px-6 md:px-8 flex items-center justify-between h-full overflow-hidden">
                <div className="flex items-center flex-1 overflow-hidden">
                    {/* 品牌標籤 */}
                    <div className="pr-3 z-20 flex items-center shrink-0">
                        <span className="text-[7px] md:text-[10px] font-black text-primary uppercase tracking-[0.2em] italic whitespace-nowrap drop-shadow-[0_0_8px_rgba(6,182,212,0.4)] animate-pulse-slow">
                            NEWS
                        </span>
                    </div>

                    {/* 固定內容區塊 */}
                    <Link 
                        href={`/news?id=${latestMarqueeItem.id}`} 
                        className="flex items-center gap-2 md:gap-3 text-[9px] md:text-sm text-muted-foreground transition-all group overflow-hidden h-full px-2 md:px-3 animate-pulse-slowest"
                    >
                    <div className="flex items-center gap-2 md:gap-3">
                        {/* 置頂消息動態脈衝燈 */}
                        {latestMarqueeItem.isPinned ? (
                            <div className="flex items-center justify-center shrink-0">
                                <span className="flex h-2 w-2 relative">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                </span>
                            </div>
                        ) : (
                            <Megaphone className="w-3 h-3 md:w-3.5 md:h-3.5 opacity-30 shrink-0 transition-opacity" />
                        )}
                        
                        {/* 分類標籤：玻璃擬態風格 */}
                        <span className="bg-white/5 border border-white/10 text-[7px] md:text-[9px] font-bold px-1.5 md:px-2 py-0.5 rounded text-white/50 uppercase tracking-tighter shrink-0 transition-all">
                            {latestMarqueeItem.category}
                        </span>
                        
                        {/* 消息標題 */}
                        <span className="font-bold text-foreground/80 transition-colors truncate tracking-wide">
                            {latestMarqueeItem.title}
                        </span>
                        
                        {/* 引導圖示：點擊提示 */}
                        <div className="flex items-center gap-1 transition-all">
                            <span className="text-[8px] font-black uppercase tracking-widest text-primary/60 hidden md:inline">Detail</span>
                            <ChevronRight className="w-3 h-3 text-primary transition-transform" />
                        </div>
                    </div>
                </Link>
            </div>
        </div>
    </div>
  );
}
