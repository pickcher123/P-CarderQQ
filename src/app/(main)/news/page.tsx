'use client';

import { useState, useEffect, Suspense } from 'react';
import { SafeImage } from '@/components/safe-image';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Newspaper, Calendar, ChevronLeft, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';

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

function NewsPageContent() {
  const firestore = useFirestore();
  const searchParams = useSearchParams();
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);

  const newsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'news'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: newsItems, isLoading: isLoadingNews } = useCollection<NewsItem>(newsQuery);

  // 當網址帶有 id 參數時，自動開啟對應的消息詳細內容
  useEffect(() => {
    const targetId = searchParams.get('id');
    if (targetId && newsItems && newsItems.length > 0) {
      const item = newsItems.find(n => n.id === targetId);
      if (item) {
        setSelectedNews(item);
      }
    }
  }, [searchParams, newsItems]);

  return (
    <div className="container py-12">
      <div className="mb-12">
        <Button variant="ghost" asChild className="mb-4 -ml-4">
          <Link href="/">
            <ChevronLeft className="mr-2 h-4 w-4" /> 返回首頁
          </Link>
        </Button>
        <div className="flex items-center gap-3 mb-2">
          < Newspaper className="text-primary h-8 w-8" />
          <h1 className="text-3xl font-bold font-headline tracking-widest text-white">最新消息中心</h1>
        </div>
        <p className="text-muted-foreground">追蹤 P+Carder 的所有活動公告、遊戲更新與維護通知。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoadingNews ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-4">
              <Skeleton className="aspect-video w-full rounded-xl" />
            </div>
          ))
        ) : (
          newsItems?.map((item) => (
            <div 
              key={item.id} 
              onClick={() => setSelectedNews(item)}
              className="group block h-full cursor-pointer"
            >
              <Card className="h-full overflow-hidden bg-card/40 border-white/5 transition-all duration-300 hover:border-primary/50 hover:bg-card/60 hover:-translate-y-1 shadow-xl">
                <CardContent className="p-0 flex flex-col h-full text-white">
                  <div className="aspect-video relative overflow-hidden">
                    {item.type === 'image' ? (
                        <SafeImage 
                        src={item.imageUrl || 'https://picsum.photos/seed/news/800/450'} 
                        alt={item.title} 
                        fill 
                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                        />
                    ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-background" />
                    )}
                    
                    <div className="absolute inset-0 bg-black/40 group-hover:bg-black/20 transition-colors" />

                    <div className="absolute top-3 left-3 flex gap-2">
                        {item.isPinned && <Badge className="bg-primary font-bold shadow-lg border-none">置頂</Badge>}
                        <Badge variant="secondary" className="bg-black/60 backdrop-blur-md border-white/10 font-bold">{item.category}</Badge>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
                        <h3 className="font-bold text-xl text-white drop-shadow-lg line-clamp-2 leading-tight group-hover:text-primary transition-colors">
                            {item.title}
                        </h3>
                    </div>

                    <div className="absolute bottom-3 left-3 flex items-center gap-2 text-[10px] text-white/80 font-code font-bold bg-black/40 px-2 py-1 rounded-full backdrop-blur-sm border border-white/5">
                        <Calendar className="h-3.5 w-3.5 text-primary" />
                        {item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))
        )}
        {!isLoadingNews && newsItems?.length === 0 && (
          <div className="col-span-full py-20 text-center text-muted-foreground border border-dashed border-white/10 rounded-2xl bg-card/10">
            <Newspaper className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p className="font-bold uppercase tracking-widest">目前暫無任何消息</p>
          </div>
        )}
      </div>

      {/* News Details Dialog */}
      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className={cn(
            "bg-card/95 backdrop-blur-xl border-white/10 p-0 overflow-hidden shadow-2xl",
            selectedNews?.type === 'image' ? "max-w-4xl" : "max-w-2xl"
        )}>
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedNews?.title}</DialogTitle>
            <DialogDescription>最新消息詳情</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[90vh]">
            {selectedNews?.type === 'image' ? (
                <div className="flex flex-col text-white">
                    <div className="relative w-full aspect-auto min-h-[300px]">
                        {selectedNews.imageUrl && (
                            <SafeImage 
                                src={selectedNews.imageUrl} 
                                alt={selectedNews.title} 
                                className="w-full h-auto object-contain block"
                                width={1200}
                                height={800}
                            />
                        )}
                    </div>
                    <div className="p-6 md:p-8 bg-black/40 flex flex-col md:flex-row md:items-center justify-between border-t border-white/5 gap-4">
                        <div className="flex items-center gap-4">
                            <Badge className="bg-primary font-black px-3 py-1 shadow-lg border-none">{selectedNews.category}</Badge>
                            <span className="text-xs text-muted-foreground font-code font-bold">
                                {selectedNews.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}
                            </span>
                        </div>
                        <h2 className="text-lg md:text-xl font-black truncate">{selectedNews.title}</h2>
                    </div>
                </div>
            ) : (
                <div className="p-8 space-y-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-4">
                            <Badge className="bg-primary px-3 py-1 text-sm font-black shadow-lg border-none">{selectedNews?.category}</Badge>
                            <div className="flex items-center gap-2 text-muted-foreground text-sm font-code font-bold">
                            <Calendar className="h-4 w-4 text-primary" />
                            {selectedNews?.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-3xl md:text-4xl font-black font-body leading-tight tracking-tight">{selectedNews?.title}</h2>
                        <Separator className="bg-white/10" />
                        <div 
                            className="prose prose-invert max-w-none text-white/80 leading-relaxed text-lg whitespace-pre-wrap font-body font-medium"
                            dangerouslySetInnerHTML={{ __html: selectedNews?.content || '' }}
                        />
                    </div>
                </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function NewsPage() {
  return (
    <Suspense fallback={<div className="container py-32 text-center"><Loader2 className="animate-spin mx-auto h-12 w-12 text-primary" /></div>}>
      <NewsPageContent />
    </Suspense>
  );
}
