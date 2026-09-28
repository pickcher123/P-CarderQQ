'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar, Megaphone } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { SafeImage } from '@/components/safe-image';
import { OFFICIAL_NEWS_LIST } from '@/lib/default-news';
import Link from 'next/link';

interface NewsItem {
    id: string;
    title: string;
    content: string;
    category: string;
    type: 'text' | 'image';
    imageUrl?: string;
    createdAt?: { seconds: number };
    isPinned?: boolean;
    isDeleted?: boolean;
}

export function NewsPopup() {
    const firestore = useFirestore();
    const { user } = useUser();
    const [isOpen, setIsOpen] = useState(false);
    const [latestNews, setLatestNews] = useState<NewsItem | null>(null);
    const [doNotShowAgain, setDoNotShowAgain] = useState(false);

    // 獲取最近 5 則消息
    const newsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'news'), orderBy('createdAt', 'desc'), limit(5));
    }, [firestore]);

    const { data: newsItems } = useCollection<NewsItem>(newsQuery);

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

    const targetNews = useMemo(() => {
        if (!effectiveNews || effectiveNews.length === 0) return null;
        const pinned = effectiveNews.find(n => n.isPinned);
        return pinned || effectiveNews[0];
    }, [effectiveNews]);

    useEffect(() => {
        if (!targetNews || !firestore) return;

        const checkPreference = async () => {
            const storageKey = `dismissed_news_${targetNews.id}`;
            const localDismissed = localStorage.getItem(storageKey);
            if (localDismissed) return;

            if (user) {
                try {
                    const prefRef = doc(firestore, 'users', user.uid, 'newsPreferences', targetNews.id);
                    const prefSnap = await getDoc(prefRef);
                    if (prefSnap.exists() && prefSnap.data().doNotShowAgain) {
                        return;
                    }
                } catch (e) {
                    console.error("Error checking news preferences:", e);
                }
            }

            setLatestNews(targetNews);
            setIsOpen(true);
        };

        checkPreference();
    }, [targetNews, firestore, user]);

    const handleClose = async () => {
        if (latestNews && doNotShowAgain) {
            const storageKey = `dismissed_news_${latestNews.id}`;
            localStorage.setItem(storageKey, 'true');

            if (user && firestore) {
                try {
                    const prefRef = doc(firestore, 'users', user.uid, 'newsPreferences', latestNews.id);
                    setDoc(prefRef, {
                        newsId: latestNews.id,
                        userId: user.uid,
                        doNotShowAgain: true,
                        preferenceSetAt: serverTimestamp(),
                    }, { merge: true });
                } catch (e) {
                    console.error("Error saving news preference:", e);
                }
            }
        }
        setIsOpen(false);
    };

    if (!latestNews) return null;

    const isImageMode = latestNews.type === 'image';

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className={cn(
            "p-0 bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/30 shadow-[0_0_60px_rgba(6,182,212,0.2)] overflow-hidden transition-all duration-300 rounded-3xl",
            "w-[94vw] sm:w-[90vw] md:w-[760px] max-w-[760px] max-h-[88vh] flex flex-col"
        )}>
            {/* 頂部橫幅圖 (若為圖片模式) */}
            {isImageMode && latestNews.imageUrl ? (
                <div className="relative w-full bg-black/90 overflow-hidden shrink-0 max-h-[200px] sm:max-h-[260px] flex items-center justify-center border-b border-cyan-500/20">
                    <SafeImage 
                        src={latestNews.imageUrl} 
                        alt={latestNews.title} 
                        className="w-full h-full object-cover sm:object-contain block max-h-[200px] sm:max-h-[260px]"
                        width={1200}
                        height={600}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />
                    
                    {/* 圖片左上角標籤 */}
                    <div className="absolute top-3.5 left-3.5 sm:top-4 sm:left-4 flex items-center gap-2 z-10">
                        {latestNews.isPinned && (
                            <Badge className="bg-cyan-500 text-slate-950 font-black text-[11px] h-6 px-2.5 shadow-md flex items-center gap-1 border-none">
                                <Megaphone className="w-3.5 h-3.5" /> 置頂快訊
                            </Badge>
                        )}
                        <Badge variant="secondary" className="bg-black/70 backdrop-blur-md border border-white/15 text-white text-[11px] h-6 px-2.5 font-bold">
                            {latestNews.category || '最新消息'}
                        </Badge>
                    </div>
                </div>
            ) : null}

            {/* 可滾動內容主體 */}
            <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-7 space-y-4 custom-scrollbar">
                {/* 頂部資訊列 (非圖片模式或是補充時間) */}
                {!isImageMode ? (
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            {latestNews.isPinned && (
                                <Badge className="bg-cyan-500 text-slate-950 font-black text-xs h-6 px-2.5 shadow-md flex items-center gap-1 border-none">
                                    <Megaphone className="w-3.5 h-3.5" /> 置頂重要
                                </Badge>
                            )}
                            <Badge variant="secondary" className="bg-white/10 text-cyan-300 border border-cyan-500/20 text-xs h-6 px-2.5 font-bold">
                                {latestNews.category || '最新消息'}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                            <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                            {latestNews.createdAt ? format(new Date(latestNews.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400 font-mono">
                        <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                        <span>發布日期：</span>
                        <span>{latestNews.createdAt ? format(new Date(latestNews.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}</span>
                    </div>
                )}
                
                {/* 消息完整標題 */}
                <DialogHeader className="p-0 text-left space-y-1">
                    <DialogTitle className="text-lg sm:text-2xl font-black font-body leading-snug text-white tracking-tight break-words text-left">
                        {latestNews.title}
                    </DialogTitle>
                    <DialogDescription className="sr-only">最新消息彈窗內容</DialogDescription>
                </DialogHeader>

                {/* 消息詳細內容 (支援富文本) */}
                {latestNews.content && (
                    <div className="pt-2">
                        <div 
                            className="text-slate-200 leading-relaxed text-xs sm:text-sm font-medium break-words space-y-3"
                            dangerouslySetInnerHTML={{ __html: latestNews.content || '' }}
                        />
                    </div>
                )}
            </div>

            {/* 固定底部操作區 (永遠可見且不跑版) */}
            <div className="shrink-0 p-4 sm:p-5 bg-slate-950/90 border-t border-white/10 backdrop-blur-md flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center space-x-2.5 cursor-pointer group select-none">
                        <Checkbox 
                            id="do-not-show-popup" 
                            checked={doNotShowAgain} 
                            onCheckedChange={(checked) => setDoNotShowAgain(!!checked)}
                            className="border-cyan-500/50 data-[state=checked]:bg-cyan-500 data-[state=checked]:text-slate-950 h-4 w-4 rounded"
                        />
                        <Label 
                            htmlFor="do-not-show-popup" 
                            className="text-xs sm:text-sm text-slate-400 cursor-pointer group-hover:text-cyan-300 transition-colors font-medium select-none"
                        >
                            不再顯示此消息
                        </Label>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="sm" 
                        asChild 
                        onClick={handleClose} 
                        className="h-8 px-2.5 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 font-bold"
                    >
                        <Link href="/changelog">
                            查看完整更新日誌 &rarr;
                        </Link>
                    </Button>
                </div>
                <Button 
                    onClick={handleClose}
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-black h-11 sm:h-12 text-sm sm:text-base rounded-xl sm:rounded-2xl shadow-[0_4px_20px_rgba(6,182,212,0.35)] transition-all hover:scale-[1.01] active:scale-[0.99] border-none"
                >
                    我知道了
                </Button>
            </div>
        </DialogContent>
        </Dialog>
    );
}
