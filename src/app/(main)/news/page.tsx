'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Image from 'next/image';
import { SafeImage } from '@/components/safe-image';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc } from 'firebase/firestore';
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
  Layers,
  X,
  Radio,
  CheckCircle2,
  Megaphone,
  Share2
} from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import type { SystemConfig } from '@/types/system';

// 公版高品質收藏家/活動背景圖
const DEFAULT_NEWS_HERO_BG = 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?q=80&w=2000&auto=format&fit=crop';

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

  const systemConfigRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'systemConfig', 'main');
  }, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

  const newsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'news'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: newsItems, isLoading: isLoadingNews } = useCollection<NewsItem>(newsQuery);

  // 取得所有現有分類與統計數量
  const { categories, categoryCounts } = useMemo(() => {
    if (!newsItems) return { categories: ['ALL'], categoryCounts: { ALL: 0 } as Record<string, number> };
    const cats = new Set<string>();
    const counts: Record<string, number> = { ALL: newsItems.length };
    
    newsItems.forEach(n => {
      const cat = n.category?.trim() || '官方公告';
      cats.add(cat);
      counts[cat] = (counts[cat] || 0) + 1;
    });
    return { 
      categories: ['ALL', ...Array.from(cats)],
      categoryCounts: counts
    };
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
      const matchesCat = selectedCategory === 'ALL' || (item.category?.trim() || '官方公告') === selectedCategory;
      const matchesSearch = !searchTerm.trim() || 
        item.title?.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (item.content && item.content.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesCat && matchesSearch;
    }).sort((a, b) => {
      if (a.isPinned && !b.isPinned) return -1;
      if (!a.isPinned && b.isPinned) return 1;
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
  }, [newsItems, selectedCategory, searchTerm]);

  // 取得背景圖網址 (支援自訂或公版)
  const heroBackgroundUrl = systemConfig?.backgroundUrl || DEFAULT_NEWS_HERO_BG;

  return (
    <div className="min-h-screen bg-slate-950 pb-24 text-slate-100 selection:bg-amber-500/30 selection:text-amber-200">
      
      {/* 頂部 Hero Banner Header (公版精緻背景圖 + 完美置中標題) */}
      <section className="relative pt-6 pb-12 sm:pt-8 sm:pb-16 border-b border-slate-800/80 overflow-hidden">
        
        {/* 背景圖底圖層 */}
        <div className="absolute inset-0 z-0 overflow-hidden">
          <Image
            src={heroBackgroundUrl}
            alt="News Hero Background"
            fill
            priority
            className="object-cover object-center scale-105 filter brightness-[0.38] saturate-150 transform transition-transform duration-1000"
            referrerPolicy="no-referrer"
          />
          {/* 多層次漸層罩：頂部平滑融入導覽列，中心聚光燈，底部融入內容底色 */}
          <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/60 to-slate-950" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-slate-950/40 to-slate-950" />
          
          {/* 細緻網格紋理與環境光球 */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808008_1px,transparent_1px),linear-gradient(to_bottom,#80808008_1px,transparent_1px)] bg-[size:32px_32px] opacity-40 pointer-events-none" />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[350px] bg-amber-500/20 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute top-1/2 -left-20 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute top-1/2 -right-20 w-[300px] h-[300px] bg-purple-500/10 rounded-full blur-[120px] pointer-events-none" />
        </div>

        <div className="container px-4 max-w-6xl mx-auto relative z-10">
          
          {/* 上方功能導覽列：返回按鈕與狀態指示 */}
          <div className="flex items-center justify-between gap-4 mb-6 sm:mb-8">
            <Button 
              variant="ghost" 
              asChild 
              className="h-9 px-3.5 text-xs font-bold text-slate-300 hover:text-white bg-slate-900/60 hover:bg-slate-800/80 rounded-xl border border-slate-700/60 backdrop-blur-md transition-all shadow-sm"
            >
              <Link href="/">
                <ChevronLeft className="mr-1.5 h-4 w-4 text-amber-400" /> 返回首頁
              </Link>
            </Button>

            <div className="flex items-center gap-2 text-[11px] font-bold text-amber-400 bg-amber-500/10 px-3.5 py-1.5 rounded-full border border-amber-500/30 backdrop-blur-md shadow-[0_0_15px_rgba(245,158,11,0.15)]">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span className="hidden sm:inline">P+ CARDER · OFFICIAL BULLETIN</span>
              <span>即時官方快訊</span>
            </div>
          </div>

          {/* ★ 核心置中標題區塊（讓客戶一眼看清）★ */}
          <div className="text-center max-w-3xl mx-auto space-y-4 sm:space-y-5">
            
            {/* 置中標籤勳章 */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-400/40 backdrop-blur-md text-amber-300 text-xs sm:text-sm font-black tracking-widest uppercase shadow-[0_0_20px_rgba(245,158,11,0.2)]">
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
              <span>OFFICIAL ANNOUNCEMENTS & EVENTS</span>
              <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            </div>

            {/* 置中大標題 */}
            <div className="space-y-2">
              <h1 className="font-headline text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight text-white flex items-center justify-center gap-3">
                <span className="p-2 sm:p-3 rounded-2xl bg-gradient-to-br from-amber-400/20 to-amber-600/20 border border-amber-500/30 text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.3)] shrink-0">
                  <Megaphone className="h-6 w-6 sm:h-9 sm:w-9 text-amber-400" />
                </span>
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-200 drop-shadow-[0_0_30px_rgba(245,158,11,0.5)]">
                  最新消息中心
                </span>
              </h1>
              
              <p className="font-mono text-xs sm:text-sm tracking-[0.25em] text-amber-400/80 font-bold uppercase">
                P+ CARDER NEWS & UPDATES
              </p>
            </div>

            {/* 置中說明副標 */}
            <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto font-medium leading-relaxed drop-shadow-md">
              掌握官方最新活動盛典、機台更新、限定企劃與即時維護公告。
            </p>

            {/* ★ 置中搜尋欄位 ★ */}
            <div className="pt-2 max-w-md mx-auto relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-amber-400/80" />
              <Input
                type="text"
                placeholder="搜尋消息標題或活動關鍵字..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-11 pr-10 h-12 bg-slate-900/90 border-slate-700/80 rounded-2xl text-xs sm:text-sm text-slate-100 placeholder:text-slate-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/30 backdrop-blur-xl shadow-xl transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-white rounded-full bg-slate-800/80"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* ★ 置中分類標籤按鈕列 ★ */}
            <div className="pt-3 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
              {categories.map((cat) => {
                const count = categoryCounts[cat] || 0;
                const isSelected = selectedCategory === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setSelectedCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 border backdrop-blur-md shadow-sm cursor-pointer",
                      isSelected
                        ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 border-amber-300 font-black shadow-[0_0_20px_rgba(245,158,11,0.4)] scale-105"
                        : "bg-slate-900/80 text-slate-300 border-slate-700/70 hover:border-amber-400/50 hover:text-white hover:bg-slate-800/90"
                    )}
                  >
                    <span>{cat === 'ALL' ? '全部消息' : cat}</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-full font-mono font-bold",
                      isSelected ? "bg-slate-950/20 text-slate-950" : "bg-slate-800 text-slate-400"
                    )}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

          </div>
        </div>
      </section>

      {/* 消息列表網格區塊 */}
      <section className="container px-4 max-w-7xl mx-auto pt-10">
        
        {/* 結果統計與目前篩選狀態 */}
        <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-800/60">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Filter className="w-3.5 h-3.5 text-amber-400" />
            <span>目前顯示：</span>
            <span className="text-amber-300 font-black">
              {selectedCategory === 'ALL' ? '全部消息' : selectedCategory}
            </span>
            {searchTerm && (
              <span className="text-slate-400">（搜尋關鍵字：「{searchTerm}」）</span>
            )}
          </div>
          <div className="text-xs font-mono text-slate-400 font-bold">
            共 <span className="text-amber-400 font-black text-sm">{filteredNews.length}</span> 則消息
          </div>
        </div>

        {/* 卡片網格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isLoadingNews ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-900/80 border border-slate-800/80">
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
                  "h-full overflow-hidden bg-slate-900/90 border rounded-2xl transition-all duration-300 flex flex-col justify-between shadow-xl backdrop-blur-sm",
                  item.isPinned 
                    ? "border-amber-500/60 hover:border-amber-400 shadow-[0_4px_30px_rgba(245,158,11,0.2)] bg-gradient-to-b from-slate-900 via-slate-900/95 to-slate-950" 
                    : "border-slate-800 hover:border-amber-400/60 hover:shadow-[0_8px_30px_rgba(0,0,0,0.6)]",
                  "group-hover:-translate-y-1.5"
                )}>
                  
                  {/* 封面區域 */}
                  <div className="aspect-[16/9] relative overflow-hidden bg-slate-950">
                    {item.type === 'image' && item.imageUrl ? (
                      <SafeImage 
                        src={item.imageUrl} 
                        alt={item.title} 
                        fill 
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                      />
                    ) : (
                      <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-slate-950 to-slate-900 flex flex-col items-center justify-center p-6 text-center">
                        <Newspaper className="w-12 h-12 text-amber-500/30 mb-2 group-hover:scale-110 transition-transform" />
                        <span className="text-[11px] font-bold text-amber-400/60 tracking-wider">OFFICIAL ANNOUNCEMENT</span>
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
                      <span className="bg-black/80 backdrop-blur-md border border-white/10 text-slate-200 font-bold text-[10px] px-2.5 py-0.5 rounded-md">
                        {item.category || '官方公告'}
                      </span>
                    </div>

                    {/* 類型標註 */}
                    {item.type === 'image' && (
                      <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10 text-[10px] font-mono text-amber-300 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-amber-400" />
                        <span>圖文海報</span>
                      </div>
                    )}
                  </div>

                  {/* 內容區塊 */}
                  <div className="p-5 flex flex-col justify-between flex-1 space-y-4">
                    <div className="space-y-2">
                      <h3 className="font-headline text-base sm:text-lg font-black text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug">
                        {item.title}
                      </h3>
                      
                      {item.type === 'text' && item.content && (
                        <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 leading-relaxed font-normal">
                          {item.content.replace(/<[^>]+>/g, '')}
                        </p>
                      )}
                    </div>

                    {/* 底部時間與點擊引導 */}
                    <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-slate-400 font-mono text-[11px]">
                        <Clock className="h-3.5 w-3.5 text-amber-400/80" />
                        <span>{item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}</span>
                      </div>

                      <span className="text-amber-400 font-bold flex items-center gap-1 text-xs group-hover:translate-x-1 transition-transform">
                        <span>詳閱全文</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>

                </div>
              </div>
            ))
          )}

          {!isLoadingNews && filteredNews.length === 0 && (
            <div className="col-span-full py-20 text-center rounded-3xl bg-slate-900/50 border border-dashed border-slate-800 p-8 max-w-xl mx-auto">
              <Newspaper className="h-12 w-12 mx-auto mb-3 text-slate-600" />
              <h3 className="text-base font-black text-slate-300 mb-1">找不到相關消息</h3>
              <p className="text-xs text-slate-500 mb-4">請嘗試更換分類標籤或搜尋其他關鍵字</p>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => { setSelectedCategory('ALL'); setSearchTerm(''); }}
                className="rounded-xl border-slate-700 text-xs font-bold text-slate-300 hover:text-white"
              >
                重設所有篩選
              </Button>
            </div>
          )}
        </div>
      </section>

      {/* 消息詳細視窗 (Dialog) */}
      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className={cn(
            "bg-slate-950/98 backdrop-blur-2xl border-slate-800 p-0 overflow-hidden shadow-2xl rounded-3xl text-slate-100",
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
                                className="w-full h-auto object-contain max-h-[70vh] rounded-2xl shadow-2xl"
                                width={1200}
                                height={800}
                            />
                        )}
                    </div>
                    <div className="p-5 sm:p-6 bg-slate-900/95 flex flex-col md:flex-row md:items-center justify-between border-t border-slate-800 gap-3">
                        <div className="flex items-center gap-3">
                            <Badge className="bg-amber-500 text-slate-950 font-black px-2.5 py-1 text-xs border-none shadow-md">
                              {selectedNews.category || '官方公告'}
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
                <div className="p-6 sm:p-8 space-y-5 text-white">
                    <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-slate-800/80">
                        <div className="flex items-center gap-2.5">
                            <Badge className="bg-amber-500 text-slate-950 px-3 py-1 text-xs font-black border-none shadow-md">
                              {selectedNews?.category || '官方公告'}
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
                        <h2 className="text-xl sm:text-2xl lg:text-3xl font-black font-headline leading-tight tracking-tight text-white">
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

