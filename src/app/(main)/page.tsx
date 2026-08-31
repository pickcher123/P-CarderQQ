'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronRight, Trophy, Sparkles, Newspaper, Calendar, ShieldCheck, Zap, Target, Megaphone, Users2, Disc3, ArrowRight, Flame, Gift } from 'lucide-react';
import { LuckyBagIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NewsPopup } from '@/components/news-popup';
import { SafeImage } from '@/components/safe-image';
import { FloatingCardsBackground } from '@/components/floating-cards-background';
import { PLACEHOLDER_CARD_IMAGE } from '@/lib/placeholders';
import { CardExhibitionCalendar } from '@/components/card-exhibition-calendar';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { PredictionSection } from '@/components/prediction-section';
import { HallOfFameMarquee } from '@/components/hall-of-fame-marquee';
import { PoolCard } from '@/components/pool-card';
import type { CardPool, CardItem } from '@/types';
import { PromoRedeemModal } from '@/components/events/PromoRedeemModal';
import { useToast } from '@/hooks/use-toast';

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

interface Partner {
    id: string;
    name: string;
    logoUrl: string;
    order: number;
}

export default function Home() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);

  const newsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'news'), orderBy('createdAt', 'desc'), limit(4));
  }, [firestore]);

  const poolsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'pools'), orderBy('createdAt', 'desc'), limit(4));
  }, [firestore]);

  const cardsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'cards');
  }, [firestore]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'categories'), orderBy('order', 'asc'));
  }, [firestore]);

  const { data: newsItems, isLoading: isLoadingNews } = useCollection<NewsItem>(newsQuery);
  const { data: featuredPools, isLoading: isLoadingPools } = useCollection<CardPool>(poolsQuery);
  const { data: cardsList } = useCollection<CardItem>(cardsQuery);
  const { data: categories } = useCollection<{ id: string; name: string; imageUrl?: string; linkUrl?: string; order?: number }>(categoriesQuery);

  const partnersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'partners'), orderBy('order', 'asc'));
  }, [firestore]);

  const { data: partners, isLoading: isLoadingPartners } = useCollection<Partner>(partnersQuery);

  const systemConfigRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return doc(firestore, 'systemConfig', 'main');
  }, [firestore]);
  const { data: systemConfig } = useDoc<any>(systemConfigRef);

  const allCardsMap = useMemo(() => {
    const map = new Map<string, CardItem>();
    if (cardsList) {
      cardsList.forEach(c => map.set(c.id, c));
    }
    return map;
  }, [cardsList]);

  return (
    <div className="flex flex-col min-h-screen">
      <NewsPopup />
      
      {/* 英雄區塊 (Hero Section) */}
      <section className="relative min-h-[80vh] md:min-h-[calc(100vh-4.5rem)] flex items-center justify-center overflow-hidden py-8 md:py-16">
        {(systemConfig?.showFloatingBackground !== false) && <FloatingCardsBackground />}

        {/* Ambient Top Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[250px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="container relative z-10 text-center space-y-5 md:space-y-8 px-4 max-w-5xl mx-auto my-auto">
          {systemConfig?.announcement && (
            <div className="max-w-2xl mx-auto mb-4 animate-fade-in-up">
              <div className="bg-gradient-to-r from-slate-900/95 via-slate-950/95 to-slate-900/95 backdrop-blur-xl border border-amber-500/30 rounded-2xl p-3.5 sm:p-4 flex items-center gap-3 text-left shadow-[0_4px_25px_rgba(245,158,11,0.15)] ring-1 ring-white/5">
                <div className="p-2.5 bg-gradient-to-br from-amber-400 to-amber-600 rounded-xl shrink-0 text-slate-950 shadow-md">
                  <Megaphone className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-slate-200 font-bold text-xs sm:text-sm leading-snug truncate">{systemConfig.announcement}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-3 sm:space-y-4 animate-fade-in-up">
            <h1 className="font-headline text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-tight leading-none relative">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-amber-200/90 drop-shadow-[0_4px_30px_rgba(245,158,11,0.3)]">
                    P+CARDER
                </span>
                <span className="absolute inset-0 text-amber-400/15 blur-[30px] pointer-events-none select-none">P+CARDER</span>
            </h1>
            
            <p className="text-sm sm:text-base md:text-xl text-slate-300 max-w-xl mx-auto font-medium tracking-wider leading-relaxed">
                頂級球員卡福袋平台 · 即時連線公平抽取<br />
                <span className="text-amber-400 font-bold drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]">打造屬於你的極致玩卡與收藏體驗</span>
            </p>
          </div>
          
          {/* 快捷操作按鈕組 */}
          <div className="flex items-center justify-center gap-3 sm:gap-4 animate-fade-in-up pt-4 sm:pt-6 max-w-lg mx-auto">
            <Button size="lg" asChild className="w-full sm:w-auto h-12 sm:h-14 px-8 text-base sm:text-lg font-black rounded-2xl group bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:shadow-[0_0_40px_rgba(245,158,11,0.6)] border border-amber-300/60 relative overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Link href="/draw" className="flex items-center justify-center gap-2.5">
                <Sparkles className="w-5 h-5 text-slate-950 fill-slate-950 animate-pulse" />
                <span className="tracking-wide">立即前往卡池</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </Link>
            </Button>
          </div>
        </div>

        {/* 底部平滑過渡流光帶 */}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-background/90 to-transparent pointer-events-none z-[5]" />
      </section>

      {/* 首頁熱門推薦卡池 */}
      {featuredPools && featuredPools.length > 0 && (
        <section className="py-4 sm:py-8 container px-3 sm:px-4 max-w-7xl mx-auto">
          <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-950/90 to-slate-900/90 border border-slate-800/80 backdrop-blur-xl flex items-center justify-between gap-3 mb-6 sm:mb-8 shadow-lg">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black font-headline tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-100 to-yellow-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                  熱門推薦卡池
                </h2>
                <p className="text-[11px] text-slate-400 hidden sm:block">頂級球員卡即時開包 · 公平公正透明</p>
              </div>
            </div>

            <Button variant="ghost" asChild className="hover:bg-slate-800 h-9 px-3.5 rounded-xl font-bold text-amber-400 hover:text-amber-300 text-xs">
              <Link href="/draw" className="flex items-center gap-1.5">
                <span>查看全部卡池</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
            {featuredPools.map((pool) => (
              <PoolCard key={pool.id} pool={pool} allCardsMap={allCardsMap} />
            ))}
          </div>
        </section>
      )}

      {/* 最新消息中心 */}
      <section className="relative py-10 sm:py-14 bg-gradient-to-b from-slate-950/60 via-slate-900/40 to-slate-950/60 border-y border-slate-800/80 overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="container relative z-10 px-3 sm:px-4 max-w-7xl mx-auto">
            
            {/* Header */}
            <div className="p-3 sm:p-4 rounded-2xl bg-gradient-to-r from-slate-900/90 via-slate-950/90 to-slate-900/90 border border-slate-800/80 backdrop-blur-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 shadow-lg">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <Newspaper className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-black font-headline tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-100 to-yellow-400 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                            最新消息中心
                        </h2>
                        <p className="text-[11px] text-slate-400 hidden sm:block">官方即時資訊 · 活動快訊與公告</p>
                    </div>
                </div>

                <Button variant="ghost" asChild className="hover:bg-slate-800 h-9 px-3.5 rounded-xl font-bold text-slate-300 hover:text-white self-end sm:self-auto text-xs">
                    <Link href="/news" className="flex items-center gap-1.5">
                        <span>查看完整消息庫</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                </Button>
            </div>
            
            <Carousel opts={{ align: "start", loop: true }} className="w-full">
                <CarouselContent className="-ml-3 sm:-ml-4">
                    {isLoadingNews ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <CarouselItem key={i} className="pl-3 sm:pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                                <div className="aspect-video w-full rounded-2xl overflow-hidden bg-slate-900">
                                    <Skeleton className="w-full h-full" />
                                </div>
                            </CarouselItem>
                        ))
                    ) : (
                        newsItems?.map((item) => (
                            <CarouselItem key={item.id} className="pl-3 sm:pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                                <Link 
                                  href={`/news?id=${item.id}`}
                                  className="group block h-full animate-fade-in-up"
                                >
                                    <div className="h-full overflow-hidden bg-slate-950/90 border border-slate-800/80 hover:border-amber-400/60 transition-all duration-300 rounded-2xl shadow-lg group-hover:-translate-y-1">
                                        <div className="aspect-video relative overflow-hidden">
                                            {item.type === 'image' ? (
                                                <SafeImage 
                                                    src={item.imageUrl || PLACEHOLDER_CARD_IMAGE} 
                                                    alt={item.title} 
                                                    width={800}
                                                    height={450}
                                                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                                                />
                                            ) : (
                                                <div className="absolute inset-0 bg-gradient-to-br from-amber-950/40 via-slate-950 to-slate-900" />
                                            )}
                                            
                                            <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent" />

                                            <div className="absolute top-2.5 left-2.5 flex gap-1.5">
                                                {item.isPinned && (
                                                  <span className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[9px] px-2 py-0.5 rounded-md shadow-md">
                                                    置頂
                                                  </span>
                                                )}
                                                <span className="bg-black/70 backdrop-blur-md border border-white/10 text-slate-300 font-bold text-[9px] px-2 py-0.5 rounded-md">
                                                  {item.category}
                                                </span>
                                            </div>

                                            <div className="absolute inset-x-3 bottom-8">
                                                <h3 className="font-bold text-sm sm:text-base text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)] line-clamp-2 leading-snug group-hover:text-amber-300 transition-colors">
                                                    {item.title}
                                                </h3>
                                            </div>

                                            <div className="absolute bottom-2.5 left-3 flex items-center gap-1.5 text-[9px] text-slate-400 font-mono">
                                                <Calendar className="h-3 w-3 text-amber-400" />
                                                <span>{item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </Link>
                            </CarouselItem>
                        ))
                    )}
                </CarouselContent>
                <CarouselPrevious className="hidden sm:flex -left-4 h-9 w-9 bg-slate-900 border-slate-700 text-slate-200 hover:bg-amber-500 hover:text-slate-950" />
                <CarouselNext className="hidden sm:flex -right-4 h-9 w-9 bg-slate-900 border-slate-700 text-slate-200 hover:bg-amber-500 hover:text-slate-950" />
            </Carousel>
        </div>
      </section>

      {/* 為什麼選擇我們 */}
      <section className="py-12 sm:py-18 container px-3 sm:px-4 max-w-7xl mx-auto relative">
        <div className="relative p-6 sm:p-10 rounded-3xl bg-slate-950/70 border border-slate-800/80 backdrop-blur-2xl overflow-hidden shadow-2xl">
          {/* 背景環境流光 */}
          <div className="absolute -top-24 -right-24 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

          <div className="text-center mb-10 sm:mb-12 space-y-3 relative z-10">
            <h2 className="text-2xl sm:text-4xl font-black font-headline tracking-tight text-white">
              為什麼選擇 <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-500">P+Carder</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 max-w-lg mx-auto font-medium">
              專為真實球卡愛好者打造的次世代數位開包與藏友社交平台
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 relative z-10">
            {[
              { 
                title: '公開透明存證', 
                desc: '每一張核心卡片皆經數位存證，確保來源真實、所有權明確，打造最讓人放心的收藏環境。', 
                icon: ShieldCheck, 
                color: 'text-amber-400',
                border: 'group-hover:border-amber-500/50',
                iconBg: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                glow: 'group-hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]'
              },
              { 
                title: '公平機率披露', 
                desc: '絕不隱藏真實資訊，所有卡池機率完全公開披露，讓每一次抽卡都憑實力與運氣，回歸遊玩初衷。', 
                icon: Target, 
                color: 'text-cyan-400',
                border: 'group-hover:border-cyan-500/50',
                iconBg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
                glow: 'group-hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]'
              },
              { 
                title: '即時互動體驗', 
                desc: '打破實體卡片的侷限，隨時隨地享受極具張力的數位開包效果，將收藏熱忱轉化為指尖的極致快感。', 
                icon: Zap, 
                color: 'text-pink-400',
                border: 'group-hover:border-pink-500/50',
                iconBg: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
                glow: 'group-hover:shadow-[0_0_30px_rgba(244,114,182,0.15)]'
              },
              { 
                title: '專屬藏友社群', 
                desc: '透過團拆與互動競技，與志同道合的藏友並肩遊玩，交流珍稀卡片，建立屬於你的球員卡核心交友圈。', 
                icon: Users2, 
                color: 'text-emerald-400',
                border: 'group-hover:border-emerald-500/50',
                iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                glow: 'group-hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]'
              },
            ].map((item, i) => (
              <div 
                key={i}
                className={cn(
                  "p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 flex flex-col justify-between transition-all duration-300 group shadow-lg hover:-translate-y-1 backdrop-blur-md",
                  item.border,
                  item.glow
                )}
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <div className={cn("p-3 rounded-xl border shadow-inner transition-transform duration-300 group-hover:scale-110", item.iconBg)}>
                      <item.icon className="w-5 h-5" />
                    </div>
                  </div>
                  <h3 className="text-base sm:text-lg font-black text-white mb-2.5 group-hover:text-amber-300 transition-colors font-headline tracking-wide">
                    {item.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 leading-relaxed font-medium">
                    {item.desc}
                  </p>
                </div>

                <div className="pt-4 mt-4 border-t border-slate-800/50 flex items-center gap-1.5 text-[10px] font-mono text-slate-400 group-hover:text-slate-200 transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80 animate-pulse" />
                  <span>核心保障機制</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 合作夥伴 */}
      <section className="container pb-12 sm:pb-20 px-3 sm:px-4 max-w-7xl mx-auto text-white">
        <div className="relative p-6 sm:p-10 rounded-3xl bg-slate-950/50 border border-slate-800/60 backdrop-blur-xl overflow-hidden">
          <div className="text-center mb-8 space-y-2">
            <h2 className="text-xl sm:text-3xl font-black font-headline tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-100 to-yellow-400 drop-shadow-[0_0_15px_rgba(245,158,11,0.25)]">
              我們的合作夥伴
            </h2>
            <p className="text-xs text-slate-400 font-medium">與頂級卡牌品牌與知名同好團隊攜手合作</p>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6">
            {isLoadingPartners ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-56 rounded-2xl bg-slate-900/80 border border-slate-800" />
              ))
            ) : partners && partners.length > 0 ? (
              partners.map((partner) => (
                <div 
                  key={partner.id} 
                  className="w-48 sm:w-64 h-24 sm:h-28 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-amber-400/50 shadow-xl hover:shadow-[0_8px_30px_rgba(245,158,11,0.15)] transition-all duration-300 group relative overflow-hidden backdrop-blur-md"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="w-full h-full relative flex items-center justify-center z-10">
                    <SafeImage 
                      src={partner.logoUrl} 
                      alt={partner.name} 
                      className="object-contain max-h-full max-w-full drop-shadow-md group-hover:scale-108 transition-transform duration-300 filter group-hover:brightness-110" 
                      width={200} 
                      height={90} 
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="py-6 text-center text-xs text-slate-500 font-mono">
                夥伴品牌陸續入駐中...
              </div>
            )}
          </div>
        </div>
      </section>

      {/* News Details Dialog */}
      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className={cn(
            "bg-slate-950/95 backdrop-blur-2xl border-slate-800 p-0 overflow-hidden shadow-2xl",
            selectedNews?.type === 'image' ? "max-w-4xl" : "max-w-2xl"
        )}>
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedNews?.title}</DialogTitle>
            <DialogDescription>{selectedNews?.category}</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[85vh]">
            {selectedNews?.type === 'image' ? (
                <div className="flex flex-col text-white">
                    <div className="relative aspect-video w-full bg-black/80 flex items-center justify-center overflow-hidden">
                        {selectedNews.imageUrl && (
                            <SafeImage 
                                src={selectedNews.imageUrl} 
                                alt={selectedNews.title} 
                                width={1200}
                                height={675}
                                className="object-contain w-full h-full max-h-[70vh]"
                            />
                        )}
                    </div>
                    <div className="p-5 sm:p-6 bg-slate-900/90 flex flex-col md:flex-row md:items-center justify-between border-t border-slate-800 gap-4">
                        <div className="flex items-center gap-3">
                            <Badge className="bg-amber-500 text-slate-950 font-black px-2.5 py-0.5 text-xs border-none">
                                {selectedNews.category}
                            </Badge>
                            <span className="text-xs text-slate-400 font-mono">
                                {selectedNews.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}
                            </span>
                        </div>
                        <h2 className="text-base sm:text-lg font-black truncate">{selectedNews.title}</h2>
                    </div>
                </div>
            ) : (
                <div className="p-6 md:p-8 space-y-5 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge className="bg-amber-500 text-slate-950 px-3 py-1 text-xs font-black border-none">
                                {selectedNews?.category}
                            </Badge>
                            <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                              <Calendar className="h-3.5 w-3.5 text-amber-400" />
                              {selectedNews?.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4">
                        <h2 className="text-xl sm:text-3xl font-black leading-tight text-left text-white">{selectedNews?.title}</h2>
                        <Separator className="bg-slate-800" />
                        <div 
                            className="prose prose-invert max-w-none text-slate-300 leading-relaxed text-sm md:text-base whitespace-pre-wrap font-medium text-left"
                            dangerouslySetInnerHTML={{ __html: selectedNews?.content || '' }}
                        />
                    </div>
                </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* 🎁 開幕免費領券中心 / 兌換碼彈窗 */}
      <PromoRedeemModal
        open={isPromoModalOpen}
        onOpenChange={setIsPromoModalOpen}
        onApplyReward={(targetEvent, freePlays) => {
          toast({
            title: '🎉 兌換成功！',
            description: `已成功兌換 ${freePlays} 次免費試玩機會！`,
          });
        }}
      />
    </div>
  );
}
