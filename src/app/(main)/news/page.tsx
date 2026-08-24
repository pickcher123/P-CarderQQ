'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { SafeImage } from '@/components/safe-image';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy } from 'firebase/firestore';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { 
  Newspaper, 
  Calendar, 
  ChevronLeft, 
  Loader2, 
  Sparkles, 
  Pin, 
  Search, 
  Filter, 
  ArrowRight,
  Clock,
  Layers
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const newsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'news'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: newsItems, isLoading: isLoadingNews } = useCollection<NewsItem>(newsQuery);

  // 取得所有現有分類
  const categories = useMemo(() => {
    if (!newsItems) return ['ALL'];
    const cats = new Set<string>();
    newsItems.forEach(n => {
      if (n.category) cats.add(n.category);
    });
    return ['ALL', ...Array.from(cats)];
  }, [newsItems]);

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

  // 篩選與排序邏輯 (置頂優先，接著是時間)
  const filteredNews = useMemo(() => {
    if (!newsItems) return [];
    return newsItems.filter(item => {
      const matchesCat = selectedCategory === 'ALL' || item.category === selectedCategory;
      const matchesSearch = !searchTerm.trim() || 
        item.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.content && item.content.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCat && matchesSearch;
    }).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
  }, [newsItems, selectedCategory, searchTerm]);

  return (
    <div className="min-h-screen bg-slate-950 pb-20">
      
      {/* 頂部 Hero Banner Header */}
      <section className="relative pt-8 pb-10 sm:py-14 border-b border-slate-800/80 bg-gradient-to-b from-slate-900/60 via-slate-950/80 to-slate-950 overflow-hidden">
        <div className="absolute top-0 right-1/4 w-[450px] h-[450px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/2 left-10 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="container px-4 max-w-7xl mx-auto relative z-10">
          <Button variant="ghost" asChild className="mb-6 h-9 px-3 text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-900/90 rounded-xl border border-slate-800/60">
            <Link href="/">
              <ChevronLeft className="mr-1.5 h-3.5 w-3.5 text-amber-400" /> 返回首頁
            </Link>
          </Button>

          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <h1 className="font-headline text-3xl sm:text-5xl font-black tracking-tight text-white flex items-center gap-3">
                <span className="p-2.5 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 border border-amber-500/30 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                  <Newspaper className="h-6 w-6 sm:h-8 sm:w-8" />
                </span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 drop-shadow-[0_0_20px_rgba(245,158,11,0.35)]">
                  最新消息中心
                </span>
              </h1>

              <p className="text-sm sm:text-base text-slate-400 max-w-xl font-medium">
                追蹤 P+CARDER 官方活動、機台更新、特別企劃與維護公告。
              </p>
            </div>

            {/* 搜尋框 */}
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                type="text"
                placeholder="搜尋消息標題或內容..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 bg-slate-900/90 border-slate-800 rounded-xl text-xs sm:text-sm text-slate-200 focus:border-amber-400/60 focus:ring-1 focus:ring-amber-400/50"
              />
            </div>
          </div>

          {/* 分類篩選標籤 */}
          <div className="flex items-center gap-2 overflow-x-auto pt-6 pb-2 no-scrollbar">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1 shrink-0 mr-1">
              <Filter className="w-3.5 h-3.5" /> 分類：
            </span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 border",
                  selectedCategory === cat
                    ? "bg-amber-500 text-slate-950 border-amber-400 font-black shadow-[0_0_15px_rgba(245,158,11,0.3)]"
                    : "bg-slate-900/80 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white"
                )}
              >
                {cat === 'ALL' ? '全部消息' : cat}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* 消息列表網格 */}
      <section className="container px-4 max-w-7xl mx-auto pt-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {isLoadingNews ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-900/80">
                <Skeleton className="w-full h-full" />
              </div>
            ))
          ) : (
            filteredNews.map((item) => (
              <div 
                key={item.id} 
                onClick={() => setSelectedNews(item)}
                className="group relative block h-full cursor-pointer select-none"
              >
                <div className={cn(
                  "h-full overflow-hidden bg-slate-950/90 border rounded-2xl transition-all duration-300 flex flex-col justify-between shadow-xl",
                  item.isPinned 
                    ? "border-amber-500/40 hover:border-amber-400 shadow-[0_4px_25px_rgba(245,158,11,0.15)]" 
                    : "border-slate-800/80 hover:border-amber-400/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.5)]",
                  "group-hover:-translate-y-1"
                )}>
                  
                  {/* 封面區域 */}
                  <div className="aspect-video relative overflow-hidden bg-slate-900">
                    {item.type === 'image' && item.imageUrl ? (
                      <SafeImage 
                        src={item.imageUrl} 
                        alt={item.title} 
                        fill 
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-slate-950 to-slate-900 flex items-center justify-center p-6 text-center">
                        <Newspaper className="w-12 h-12 text-amber-500/20" />
                      </div>
                    )}
                    
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                    {/* 頂部標籤 */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5 z-10">
                      {item.isPinned && (
                        <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-md shadow-lg flex items-center gap-1">
                          <Pin className="w-3 h-3 fill-slate-950" />
                          <span>置頂</span>
                        </span>
                      )}
                      <span className="bg-black/75 backdrop-blur-md border border-white/10 text-slate-200 font-bold text-[10px] px-2 py-0.5 rounded-md">
                        {item.category || '官方公告'}
                      </span>
                    </div>

                    {/* 圖片類型角標 */}
                    {item.type === 'image' && (
                      <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[10px] font-mono text-slate-300 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-amber-400" />
                        <span>圖文</span>
                      </div>
                    )}
                  </div>

                  {/* 內容區塊 */}
                  <div className="p-4 sm:p-5 flex flex-col justify-between flex-1 space-y-3">
                    <div className="space-y-2">
                      <h3 className="font-headline text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h3>
                      
                      {item.type === 'text' && item.content && (
                        <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 leading-relaxed">
                          {item.content.replace(/<[^>]+>/g, '')}
                        </p>
                      )}
                    </div>

                    {/* 底部時間與箭頭 */}
                    <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                        <Clock className="h-3.5 w-3.5 text-amber-400" />
                        <span>{item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}</span>
                      </div>

                      <span className="text-amber-400 font-bold flex items-center gap-1 text-xs group-hover:translate-x-1 transition-transform">
                        <span>閱讀全文</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                </div>
              </div>
            ))
          )}

          {!isLoadingNews && filteredNews.length === 0 && (
            <div className="col-span-full py-20 text-center rounded-2xl bg-slate-950/80 border border-dashed border-slate-800 p-8">
              <Newspaper className="h-12 w-12 mx-auto mb-3 text-slate-600" />
              <h3 className="text-base font-bold text-slate-300 mb-1">找不到相關消息</h3>
              <p className="text-xs text-slate-500">請嘗試更換分類標籤或搜尋其他關鍵字</p>
            </div>
          )}
        </div>
      </section>

      {/* 消息詳細視窗 (Dialog) */}
      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className={cn(
            "bg-slate-950/95 backdrop-blur-2xl border-slate-800 p-0 overflow-hidden shadow-2xl rounded-2xl",
            selectedNews?.type === 'image' ? "max-w-4xl" : "max-w-2xl"
        )}>
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedNews?.title}</DialogTitle>
            <DialogDescription>最新消息詳情</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[85vh]">
            {selectedNews?.type === 'image' ? (
                <div className="flex flex-col text-white">
                    <div className="relative w-full aspect-auto min-h-[260px] bg-black/90 flex items-center justify-center p-2 sm:p-4">
                        {selectedNews.imageUrl && (
                            <SafeImage 
                                src={selectedNews.imageUrl} 
                                alt={selectedNews.title} 
                                className="w-full h-auto object-contain max-h-[70vh] rounded-xl"
                                width={1200}
                                height={800}
                            />
                        )}
                    </div>
                    <div className="p-4 sm:p-6 bg-slate-900/95 flex flex-col md:flex-row md:items-center justify-between border-t border-slate-800 gap-3">
                        <div className="flex items-center gap-3">
                            <Badge className="bg-amber-500 text-slate-950 font-black px-2.5 py-0.5 text-xs border-none shadow-md">
                              {selectedNews.category}
                            </Badge>
                            <span className="text-xs text-slate-400 font-mono flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5 text-amber-400" />
                              {selectedNews.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}
                            </span>
                        </div>
                        <h2 className="text-base sm:text-lg font-black truncate">{selectedNews.title}</h2>
                    </div>
                </div>
            ) : (
                <div className="p-5 sm:p-8 space-y-5 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                            <Badge className="bg-amber-500 text-slate-950 px-3 py-1 text-xs font-black border-none shadow-md">
                              {selectedNews?.category}
                            </Badge>
                            {selectedNews?.isPinned && (
                              <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold">
                                置頂消息
                              </Badge>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                            <Calendar className="h-3.5 w-3.5 text-amber-400" />
                            {selectedNews?.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}
                        </div>
                    </div>
                    
                    <div className="space-y-4">
                        <h2 className="text-xl sm:text-3xl font-black font-headline leading-tight tracking-tight text-white">
                          {selectedNews?.title}
                        </h2>
                        <Separator className="bg-slate-800" />
                        <div 
                            className="prose prose-invert max-w-none text-slate-300 leading-relaxed text-sm sm:text-base whitespace-pre-wrap font-medium"
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
    <Suspense fallback={<div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-amber-400" /></div>}>
      <NewsPageContent />
    </Suspense>
  );
}
