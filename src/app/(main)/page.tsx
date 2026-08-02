'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Package, Users2, ChevronRight, Trophy, Sparkles, Newspaper, Calendar, ShieldCheck, Zap, Target, Crown, Gem, Megaphone, PackageCheck, CheckCircle2 } from 'lucide-react';
import { Logo, CrossedCardsIcon, LuckyBagIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import Image from 'next/image';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState, useCallback, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NewsPopup } from '@/components/news-popup';
import { SafeImage } from '@/components/safe-image';
import { FloatingCardsBackground } from '@/components/floating-cards-background';
import { CardExhibitionCalendar } from '@/components/card-exhibition-calendar';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { PredictionSection } from '@/components/prediction-section';

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
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const newsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'news'), orderBy('createdAt', 'desc'), limit(3));
  }, [firestore]);

  const { data: newsItems, isLoading: isLoadingNews } = useCollection<NewsItem>(newsQuery);

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

  // 實體數據動態連動：從 Firestore 撈取真實拆卡紀錄、會員數、卡牌庫存總值與運送單數據
  const drawnLogsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'drawnCardLogs') : null, [firestore]);
  const { data: drawnLogs } = useCollection<any>(drawnLogsQuery);

  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const { data: users } = useCollection<any>(usersQuery);

  const allCardsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]);
  const { data: allCards } = useCollection<any>(allCardsQuery);

  const shippingOrdersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'shippingOrders') : null, [firestore]);
  const { data: shippingOrders } = useCollection<any>(shippingOrdersQuery);

  // 計算並綜合基底與動態實體數據
  const platformStats = useMemo(() => {
    const basePacks = systemConfig?.statsBaseOpenedPacks ?? 128540;
    const realPacksCount = drawnLogs?.length ?? 0;
    const displayPacks = (basePacks + realPacksCount).toLocaleString() + '+';

    const baseValue = systemConfig?.statsBaseCardValue ?? 18900000;
    const realCardsValue = allCards?.reduce((sum, c) => sum + (Number(c.sellPrice || c.price) || 0), 0) ?? 0;
    const displayValue = '$' + (baseValue + realCardsValue).toLocaleString() + '+';

    let displayFulfillment = '100%';
    if (shippingOrders && shippingOrders.length > 0) {
      const fulfilled = shippingOrders.filter(o => o.status === 'completed' || o.status === 'shipped' || o.status === 'delivered').length;
      const rate = Math.min(100, Math.round((fulfilled / shippingOrders.length) * 100));
      displayFulfillment = `${rate}%`;
    }

    const baseUsers = systemConfig?.statsBaseUsers ?? 35200;
    const realUsersCount = users?.length ?? 0;
    const displayUsers = (baseUsers + realUsersCount).toLocaleString() + '+';

    return {
      packs: displayPacks,
      value: displayValue,
      fulfillment: displayFulfillment,
      users: displayUsers,
    };
  }, [drawnLogs, allCards, shippingOrders, users, systemConfig]);

  return (
    <div className="flex flex-col min-h-screen">
      <NewsPopup />
      
      {/* Hero Section */}
      <section className="relative min-h-[85vh] md:min-h-[95vh] flex items-center justify-center overflow-hidden py-4 md:py-8">
        {(systemConfig?.showFloatingBackground !== false) && <FloatingCardsBackground />}

        <div className="container relative z-10 text-center space-y-6 md:space-y-10 px-4">
          {systemConfig?.announcement && (
            <div className="max-w-3xl mx-auto mb-8 animate-bounce-slow">
              <div className="bg-primary/20 backdrop-blur-md border border-primary/30 rounded-2xl p-4 md:p-6 flex items-center gap-4 text-left shadow-[0_0_30px_rgba(6,182,212,0.2)]">
                <div className="p-3 bg-primary rounded-xl shrink-0">
                  <Megaphone className="w-6 h-6 text-black" />
                </div>
                <div>
                  <h3 className="text-primary font-black text-sm uppercase tracking-widest mb-1">系統公告</h3>
                  <p className="text-white font-bold text-sm md:text-base leading-relaxed">{systemConfig.announcement}</p>
                </div>
              </div>
            </div>
          )}
          
          <div className="space-y-3 md:space-y-4 animate-fade-in-up">
            <h1 className="font-headline text-5xl sm:text-7xl md:text-[12rem] font-black tracking-tighter leading-none relative">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-white/90 to-primary/40 drop-shadow-[0_0_25px_rgba(6,182,212,0.5)]">
                    P+CARDER
                </span>
                <span className="absolute inset-0 text-white blur-[20px] md:blur-[30px] opacity-30 pointer-events-none select-none">P+CARDER</span>
            </h1>
            <p className="text-lg md:text-3xl text-muted-foreground max-w-2xl mx-auto font-body font-bold tracking-widest leading-relaxed opacity-80 [image-rendering:pixelated] font-mono">
                頂級球員卡福袋平台<br />
                <span className="text-primary/80">打造屬於你的玩卡體驗</span>
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 md:gap-6 animate-fade-in-up pt-8 md:pt-12">
            <Button size="lg" asChild className="w-full sm:w-auto h-14 md:h-16 px-8 md:px-12 text-lg md:text-xl font-black rounded-2xl group shadow-[0_0_30px_rgba(6,182,212,0.4)] relative overflow-hidden transition-all hover:scale-105 active:scale-95 border-none">
              <Link href="/draw">
                <span className="relative z-10 flex items-center gap-3">
                    立即開啟卡包 <ChevronRight className="w-5 h-5 md:w-6 md:h-6 group-hover:translate-x-2 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-white/10 animate-shimmer pointer-events-none" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* 平台信任度數據看板 (Stats Bar) */}
      <section className="relative -mt-6 md:-mt-8 mb-8 md:mb-12 container px-4 z-20">
        <div className="max-w-6xl mx-auto rounded-3xl bg-slate-950/80 backdrop-blur-2xl border border-cyan-500/20 shadow-[0_0_50px_rgba(6,182,212,0.15)] p-6 md:p-8 relative overflow-hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute -top-24 -left-24 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-60 h-60 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

          {/* Header Indicator */}
          <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
            <div className="flex items-center gap-2.5 text-xs md:text-sm font-bold text-cyan-400 tracking-wider">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
              </span>
              P+CARDER 平台即時信任數據看板
            </div>
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
              <ShieldCheck className="w-4 h-4 text-emerald-400" /> 100% 隨機公正與實體出貨認證
            </div>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Metric 1 */}
            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-cyan-500/30 transition-all hover:bg-white/[0.04]">
              <div className="p-3 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 mb-3">
                <PackageCheck className="w-6 h-6 md:w-7 md:h-7" />
              </div>
              <div className="text-2xl md:text-3xl lg:text-4xl font-black font-code text-transparent bg-clip-text bg-gradient-to-r from-white via-cyan-100 to-cyan-400 tracking-tight">
                {platformStats.packs}
              </div>
              <div className="text-xs md:text-sm font-bold text-slate-200 mt-1.5">累計拆出卡片包數</div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-0.5">即時演算法公正配卡</div>
            </div>

            {/* Metric 2 */}
            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-amber-500/30 transition-all hover:bg-white/[0.04]">
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-3">
                <Trophy className="w-6 h-6 md:w-7 md:h-7" />
              </div>
              <div className="text-2xl md:text-3xl lg:text-4xl font-black font-code text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-amber-400 to-amber-500 tracking-tight">
                {platformStats.value}
              </div>
              <div className="text-xs md:text-sm font-bold text-slate-200 mt-1.5">開出卡片累積總市值</div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-0.5">卡市行情即時對照</div>
            </div>

            {/* Metric 3 */}
            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/30 transition-all hover:bg-white/[0.04]">
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mb-3">
                <CheckCircle2 className="w-6 h-6 md:w-7 md:h-7" />
              </div>
              <div className="text-2xl md:text-3xl lg:text-4xl font-black font-code text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 via-emerald-400 to-teal-400 tracking-tight">
                {platformStats.fulfillment}
              </div>
              <div className="text-xs md:text-sm font-bold text-slate-200 mt-1.5">實體卡片寄送妥善率</div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-0.5">全程錄影與多層防護</div>
            </div>

            {/* Metric 4 */}
            <div className="flex flex-col items-center text-center p-4 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-sky-500/30 transition-all hover:bg-white/[0.04]">
              <div className="p-3 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400 mb-3">
                <Users2 className="w-6 h-6 md:w-7 md:h-7" />
              </div>
              <div className="text-2xl md:text-3xl lg:text-4xl font-black font-code text-transparent bg-clip-text bg-gradient-to-r from-white via-sky-200 to-sky-400 tracking-tight">
                {platformStats.users}
              </div>
              <div className="text-xs md:text-sm font-bold text-slate-200 mt-1.5">活躍收藏卡友數</div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-0.5">全台卡迷優質首選</div>
            </div>
          </div>

          {/* Bottom Guarantees Bar */}
          <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-2 md:grid-cols-4 gap-3 text-center text-xs text-slate-300">
            <div className="flex items-center justify-center gap-2 font-semibold">
              <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
              <span>機率透明隨機抽查</span>
            </div>
            <div className="flex items-center justify-center gap-2 font-semibold">
              <PackageCheck className="w-4 h-4 text-amber-400 shrink-0" />
              <span>實體包裹雙向錄影</span>
            </div>
            <div className="flex items-center justify-center gap-2 font-semibold">
              <Zap className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>卡片一鍵快速轉點</span>
            </div>
            <div className="flex items-center justify-center gap-2 font-semibold">
              <Sparkles className="w-4 h-4 text-sky-400 shrink-0" />
              <span>特約實體合作卡店</span>
            </div>
          </div>
        </div>
      </section>

      {/* 賽事預測與卡展行事曆 */}
      <section className="py-12 md:py-16 container px-4 relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-7xl mx-auto">
          {/* 賽事預測 */}
          <div className="space-y-6">
            <div className="flex items-center justify-center animate-fade-in-up">
              <h2 className="font-headline text-3xl font-black tracking-widest text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                賽事預測
              </h2>
            </div>
            <PredictionSection />
          </div>

          {/* 卡展行事曆 */}
          <div className="space-y-6">
            <div className="flex items-center justify-center animate-fade-in-up">
                <h2 className="font-headline text-3xl font-black tracking-widest text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                    卡展行事曆
                </h2>
            </div>
            <Card className="bg-slate-950/60 backdrop-blur-md border-white/10 rounded-2xl p-6 h-full">
                <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                        <CardExhibitionCalendar hideHeader />
                    </ScrollArea>
                </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* 最新消息中心 */}
      <section className="relative py-12 md:py-16 bg-card/10 border-y border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] -mr-80 -mt-80 pointer-events-none" />
        <div className="container relative z-10 transition-transform duration-700">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 md:mb-10 gap-4">
                <div className="space-y-1 md:space-y-2">
                    <div className="inline-flex items-center gap-2 text-primary font-bold font-headline tracking-[0.4em] text-[10px] md:text-xs">
                        保持最新資訊
                    </div>
                    <h2 className="text-2xl md:text-5xl font-black font-headline flex items-center gap-3 md:gap-4 tracking-tight text-left text-white">
                        <Newspaper className="text-primary h-8 w-8 md:h-12 md:w-12" />
                        最新消息中心
                    </h2>
                </div>
                <Button variant="ghost" asChild className="hover:bg-primary/10 h-10 md:h-12 px-4 md:px-6 rounded-xl font-bold group w-fit text-white">
                    <Link href="/news" className="flex items-center gap-2 text-sm md:text-base">查看完整消息庫 <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform"/></Link>
                </Button>
            </div>
            
            <Carousel opts={{ align: "start", loop: true }} className="w-full">
                <CarouselContent>
                    {isLoadingNews ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <CarouselItem key={i} className="md:basis-1/2 lg:basis-1/3">
                                <div className="space-y-4">
                                    <Skeleton className="aspect-video w-full rounded-2xl" />
                                </div>
                            </CarouselItem>
                        ))
                    ) : (
                        newsItems?.map((item) => (
                            <CarouselItem key={item.id} className="md:basis-1/2 lg:basis-1/3">
                                <Link 
                                  href={`/news?id=${item.id}`}
                                  className="group block h-full animate-fade-in-up"
                                >
                                    <Card className="h-full overflow-hidden bg-card/40 border border-white/5 transition-all duration-500 hover:border-primary/50 hover:bg-card/60 hover:-translate-y-2 shadow-2xl rounded-3xl">
                                        <CardContent className="p-0 flex flex-col h-full text-white">
                                            <div className="aspect-video relative overflow-hidden">
                                                {item.type === 'image' ? (
                                                    <SafeImage 
                                                        src={item.imageUrl || 'https://picsum.photos/seed/news/800/450'} 
                                                        alt={item.title} 
                                                        width={800}
                                                        height={450}
                                                        className="object-cover transition-transform duration-700 group-hover:scale-110"
                                                    />
                                                ) : (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-background" />
                                                )}
                                                
                                                <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors duration-500" />

                                                <div className="absolute top-3 left-3 md:top-4 md:left-4 flex gap-2">
                                                    {item.isPinned && <Badge className="bg-primary font-black shadow-lg text-[10px] border-none">置頂</Badge>}
                                                    <Badge variant="secondary" className="bg-black/60 backdrop-blur-md border-white/10 font-bold text-[10px]">{item.category}</Badge>
                                                </div>

                                                <div className="absolute inset-0 flex items-center justify-center p-6 md:p-8 text-center">
                                                    <h3 className="font-bold text-lg md:text-2xl text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] line-clamp-2 leading-tight group-hover:text-primary transition-colors duration-500">
                                                        {item.title}
                                                    </h3>
                                                </div>

                                                <div className="absolute bottom-3 left-3 md:bottom-4 md:left-4 flex items-center gap-2 text-[9px] md:text-[10px] text-white/80 font-code font-bold bg-black/40 px-2 py-1 md:px-3 md:py-1.5 rounded-full backdrop-blur-sm border border-white/5">
                                                    <Calendar className="h-3 w-3 md:h-3.5 md:w-3.5 text-primary" />
                                                    {item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </CarouselItem>
                        ))
                    )}
                </CarouselContent>
                <CarouselPrevious className="flex -left-2 md:-left-12 h-8 w-8 md:h-10 md:w-10" />
                <CarouselNext className="flex -right-2 md:-right-12 h-8 w-8 md:h-10 md:w-10" />
            </Carousel>
        </div>
      </section>

      {/* 為什麼選擇我們 */}
      <section className="py-12 md:py-16 bg-card/5 border-y border-white/5 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[300px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="container relative z-10">
            <div className="text-center mb-8 md:mb-12 space-y-2 animate-fade-in-up">
                <div className="inline-flex items-center gap-2 text-primary font-bold font-headline tracking-[0.4em] text-[10px] md:text-xs uppercase">
                    我們的核心優勢
                </div>
                <h2 className="text-3xl md:text-5xl font-black font-headline tracking-tight text-white">為什麼選擇我們</h2>
                <div className="w-16 h-1 bg-primary mx-auto rounded-full shadow-[0_0_15px_rgba(6,182,212,0.6)]" />
            </div>

            <Carousel opts={{ align: "start", loop: true }} className="w-full">
                <CarouselContent>
                    {[
                        { 
                            title: '公開透明存證', 
                            desc: '每一張核心卡片皆經數位存證，確保來源真實、所有權明確，打造最讓人放心的收藏環境。', 
                            icon: ShieldCheck, 
                            color: 'text-primary',
                            bg: 'bg-primary/10'
                        },
                        { 
                            title: '公平機率披露', 
                            desc: '絕不隱藏真實資訊，所有卡池機率完全公開披露，讓每一次抽卡都憑實力與運氣，回歸遊玩初衷。', 
                            icon: Target, 
                            color: 'text-yellow-400',
                            bg: 'bg-yellow-400/10'
                        },
                        { 
                            title: '即時互動體驗', 
                            desc: '打破實體卡片的侷限，隨時隨地享受極具張力的數位開包效果，將收藏熱忱轉化為指尖的極致快感。', 
                            icon: Zap, 
                            color: 'text-pink-400',
                            bg: 'bg-pink-400/10'
                        },
                        { 
                            title: '專屬藏友社群', 
                            desc: '透過團拆與互動競技，與志同道合的藏友並肩遊玩，交流珍稀卡片，建立屬於你的球員卡核心交友圈。', 
                            icon: Users2, 
                            color: 'text-green-400',
                            bg: 'bg-green-400/10'
                        },
                    ].map((item, i) => (
                        <CarouselItem key={i} className="md:basis-1/2 lg:basis-1/4">
                            <div 
                                className="p-8 h-full rounded-3xl bg-card/40 border border-white/5 flex flex-col items-center text-center hover:border-primary/50 transition-all duration-300 hover:shadow-2xl hover:bg-card/60 hover:-translate-y-2"
                            >
                                <div className={cn("p-4 rounded-full mb-6", item.bg, item.color)}>
                                    <item.icon className="w-8 h-8" />
                                </div>
                                <h3 className="text-xl font-black mb-3">{item.title}</h3>
                                <p className="text-sm text-muted-foreground font-medium leading-relaxed">{item.desc}</p>
                            </div>
                        </CarouselItem>
                    ))}
                </CarouselContent>
                <CarouselPrevious className="flex -left-2 md:-left-12 h-8 w-8 md:h-10 md:w-10" />
                <CarouselNext className="flex -right-2 md:-right-12 h-8 w-8 md:h-10 md:w-10" />
            </Carousel>
        </div>
      </section>

      {/* 合作夥伴 Section */}
      <section className="container pb-8 md:pb-16 px-4 text-white">
        <div className="mb-8 md:mb-12">
            <div className="text-center mb-8 space-y-4">
                <div className="inline-flex items-center gap-2 text-primary font-bold font-headline tracking-[0.4em] text-[10px] md:text-xs uppercase">
                    合作夥伴
                </div>
                <h2 className="text-2xl md:text-4xl font-black font-headline tracking-tight text-white">我們的合作夥伴</h2>
            </div>
            
            <div className="flex flex-wrap justify-center items-center gap-4 md:gap-6">
                {isLoadingPartners ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-20 w-44 rounded-2xl bg-white/10" />
                    ))
                ) : (
                    partners?.map((partner) => (
                        <div 
                            key={partner.id} 
                            className="w-40 sm:w-48 h-20 flex items-center justify-center p-3 rounded-2xl bg-white/90 hover:bg-white border border-white/20 shadow-lg shadow-black/20 hover:shadow-2xl hover:scale-105 transition-all duration-300 group"
                        >
                            <div className="w-full h-full relative flex items-center justify-center mix-blend-multiply overflow-hidden">
                                <SafeImage 
                                    src={partner.logoUrl} 
                                    alt={partner.name} 
                                    className="object-contain max-h-full max-w-full group-hover:scale-105 transition-transform duration-300" 
                                    width={200} 
                                    height={100} 
                                />
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      </section>

      {/* Calendar Dialog */}
      <Dialog open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
        <DialogContent className="max-w-4xl bg-card border-white/10">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black text-white text-center">卡展行事曆</DialogTitle>
            <DialogDescription className="text-center text-muted-foreground">追蹤最新的卡片展覽與活動資訊</DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[70vh]">
            <CardExhibitionCalendar hideHeader />
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* News Details Dialog (Fallback for cards if URL change isn't needed) */}
      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className={cn(
            "bg-card/95 backdrop-blur-2xl border-white/10 p-0 overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]",
            selectedNews?.type === 'image' ? "max-w-4xl" : "max-w-2xl"
        )}>
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedNews?.title || '最新消息'}</DialogTitle>
            <DialogDescription>最新消息詳情</DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="max-h-[90vh]">
            {selectedNews?.type === 'image' ? (
                <div className="flex flex-col text-white">
                    <div className="relative w-full aspect-auto min-h-[250px] md:min-h-[300px]">
                        {selectedNews.imageUrl && (
                            <Image 
                                src={selectedNews.imageUrl} 
                                alt={selectedNews.title} 
                                width={800}
                                height={450}
                                className="w-full h-auto object-contain block"
                                onError={(e) => {
                                    (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/news-fallback/800/450';
                                }}
                            />
                        )}
                    </div>
                    <div className="p-6 md:p-8 bg-black/40 flex flex-col md:flex-row md:items-center justify-between border-t border-white/5 gap-4">
                        <div className="flex items-center gap-3 md:gap-4">
                            <Badge className="bg-primary font-black px-2 md:px-3 py-1 shadow-lg text-[10px] md:text-xs border-none">
                                {selectedNews.category}
                            </Badge>
                            <span className="text-[10px] md:text-xs text-muted-foreground font-code font-bold">
                                {selectedNews.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}
                            </span>
                        </div>
                        <h2 className="text-lg md:text-xl font-black truncate">{selectedNews.title}</h2>
                    </div>
                </div>
            ) : (
                <div className="p-6 md:p-10 space-y-6 md:space-y-8 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex flex-wrap items-center gap-3 md:gap-4">
                            <Badge className="bg-primary px-3 md:px-4 py-1 text-xs md:sm font-black shadow-lg border-none">
                                {selectedNews?.category}
                            </Badge>
                            <div className="flex items-center gap-2 text-muted-foreground text-[10px] md:text-sm font-code font-bold">
                            <Calendar className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
                            {selectedNews?.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}
                            </div>
                        </div>
                    </div>
                    <div className="space-y-4 md:space-y-6">
                        <h2 className="text-2xl md:text-5xl font-black font-body leading-tight tracking-tight text-left">{selectedNews?.title}</h2>
                        <Separator className="bg-white/10" />
                        <div 
                            className="prose prose-invert max-w-none text-white/80 leading-relaxed text-sm md:text-lg whitespace-pre-wrap font-body font-medium text-left"
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