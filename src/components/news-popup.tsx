'use client';

import { useState, useEffect, useMemo } from 'react';
import { useCollection, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Calendar, Megaphone, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface NewsItem {
    id: string;
    title: string;
    content: string;
    category: string;
    type: 'text' | 'image';
    imageUrl?: string;
    createdAt?: { seconds: number };
    isPinned?: boolean;
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

    const targetNews = useMemo(() => {
        if (!newsItems || newsItems.length === 0) return null;
        const pinned = newsItems.find(n => n.isPinned);
        return pinned || newsItems[0];
    }, [newsItems]);

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
            "p-0 bg-card/95 backdrop-blur-xl border-primary/20 overflow-hidden shadow-2xl transition-all duration-300 rounded-3xl",
            isImageMode 
                ? "w-[92vw] md:w-[80vw] max-w-[450px] md:max-w-[900px]" 
                : "w-[92vw] md:w-[70vw] max-w-[400px] md:max-w-[750px]"
        )}>
            {isImageMode ? (
                <div className="relative w-full aspect-auto min-h-[150px] group">
                    {latestNews.imageUrl && (
                        <SafeImage 
                            src={latestNews.imageUrl} 
                            alt={latestNews.title} 
                            className="w-full h-auto object-contain block"
                            width={1200}
                            height={800}
                        />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent pointer-events-none" />
                    <div className="absolute top-4 left-4 flex gap-2">
                        {latestNews.isPinned && (
                            <Badge className="bg-primary text-[10px] md:text-xs h-6 px-3 shadow-[0_0_10px_rgba(6,182,212,0.5)] flex items-center gap-1 border-none">
                                <Megaphone className="w-3.5 h-3.5" />
                            </Badge>
                        )}
                        <Badge variant="secondary" className="bg-black/60 backdrop-blur-md border-white/10 text-[10px] md:text-xs h-6 px-3">{latestNews.category}</Badge>
                    </div>
                </div>
            ) : null}

            <div className="p-5 md:p-10 space-y-4 md:space-y-6">
                {!isImageMode && (
                    <div className="flex items-center justify-between">
                        <div className="flex gap-2">
                            {latestNews.isPinned && (
                                <Badge className="bg-primary text-[10px] md:text-xs h-6 px-3 shadow-[0_0_10px_rgba(6,182,212,0.5)] flex items-center gap-1 border-none">
                                    <Megaphone className="w-3.5 h-3.5" /> 重要
                                </Badge>
                            )}
                            <Badge variant="secondary" className="bg-black/60 backdrop-blur-md border-white/10 text-[10px] md:text-xs h-6 px-3">{latestNews.category}</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground font-code">
                            <Calendar className="h-4 w-4" />
                            {latestNews.createdAt ? format(new Date(latestNews.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}
                        </div>
                    </div>
                )}

                {isImageMode && (
                    <div className="flex items-center gap-2 text-[10px] md:text-xs text-muted-foreground font-code">
                        <Calendar className="h-3.5 w-3.5" />
                        {latestNews.createdAt ? format(new Date(latestNews.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}
                    </div>
                )}
                
                <DialogHeader>
                    <DialogTitle className="text-lg md:text-3xl font-black font-body leading-tight text-white text-left tracking-tight">
                        {latestNews.title}
                    </DialogTitle>
                    <DialogDescription className="sr-only">最新消息彈窗內容</DialogDescription>
                </DialogHeader>

                {!isImageMode && (
                    <div className="max-h-[35vh] md:max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                        <div 
                            className="text-white/80 leading-relaxed text-sm md:text-lg whitespace-pre-wrap font-body font-medium"
                            dangerouslySetInnerHTML={{ __html: latestNews.content || '' }}
                        />
                    </div>
                )}

                <div className="pt-4 md:pt-6 flex flex-col gap-3 md:gap-4 border-t border-white/10">
                    <div className="flex items-center space-x-3 cursor-pointer group">
                        <Checkbox 
                            id="do-not-show-popup" 
                            checked={doNotShowAgain} 
                            onCheckedChange={(checked) => setDoNotShowAgain(!!checked)}
                            className="border-primary/50 data-[state=checked]:bg-primary h-4 w-4 rounded-md"
                        />
                        <Label 
                            htmlFor="do-not-show-popup" 
                            className="text-xs md:text-sm text-muted-foreground cursor-pointer group-hover:text-primary transition-colors font-bold"
                        >
                            不再顯示此消息
                        </Label>
                    </div>
                    <Button 
                        onClick={handleClose}
                        className="w-full bg-primary text-primary-foreground font-black h-11 md:h-14 text-sm md:text-lg rounded-2xl shadow-[0_8px_20px_rgba(6,182,212,0.3)] transition-all hover:scale-[1.02] active:scale-[0.98] border-none"
                    >
                        我知道了
                    </Button>
                </div>
            </div>
            </DialogContent>
        </Dialog>
    );
}
