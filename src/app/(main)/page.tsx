'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronRight, Trophy, Sparkles, Newspaper, Calendar, ShieldCheck, Zap, Target, Megaphone, Users2, Disc3, ArrowRight, Flame, Gift, Image as ImageIcon, FileText } from 'lucide-react';
import { LuckyBagIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useAuth, useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { NewsPopup } from '@/components/news-popup';
import { SafeImage } from '@/components/safe-image';
import { FloatingCardsBackground } from '@/components/floating-cards-background';
import { HeroStageFloor } from '@/components/hero-stage-floor';
import { PLACEHOLDER_CARD_IMAGE } from '@/lib/placeholders';
import { CardExhibitionCalendar } from '@/components/card-exhibition-calendar';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import { PredictionSection } from '@/components/prediction-section';
import { PoolCard } from '@/components/pool-card';
import type { CardPool, CardItem } from '@/types';
import { PromoRedeemModal } from '@/components/events/PromoRedeemModal';
import { BonusDoubleHeroPill } from '@/components/events/bonus-double-banner';
import { useToast } from '@/hooks/use-toast';
import { claimCommunityFreeDraw } from '@/lib/promo-draw-service';
import confetti from 'canvas-confetti';
import { OFFICIAL_NEWS_LIST } from '@/lib/default-news';

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
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isClaimingCommunity, setIsClaimingCommunity] = useState(false);
  const [whyChooseApi, setWhyChooseApi] = useState<CarouselApi>();
  const [whyChooseCurrent, setWhyChooseCurrent] = useState(0);
  const [newsApi, setNewsApi] = useState<CarouselApi>();
  const [newsCurrent, setNewsCurrent] = useState(0);

  useEffect(() => {
    if (!newsApi) return;
    setNewsCurrent(newsApi.selectedScrollSnap());
    const onSelect = () => {
      setNewsCurrent(newsApi.selectedScrollSnap());
    };
    newsApi.on('select', onSelect);
    return () => {
      newsApi.off('select', onSelect);
    };
  }, [newsApi]);

  useEffect(() => {
    if (!whyChooseApi) return;
    setWhyChooseCurrent(whyChooseApi.selectedScrollSnap());
    const onSelect = () => {
      setWhyChooseCurrent(whyChooseApi.selectedScrollSnap());
    };
    whyChooseApi.on('select', onSelect);
    return () => {
      whyChooseApi.off('select', onSelect);
    };
  }, [whyChooseApi]);

  const newsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'news'), orderBy('createdAt', 'desc'), limit(4));
  }, [firestore]);

  const poolsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'cardPools'), orderBy('createdAt', 'desc'), limit(4));
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
    }).slice(0, 10);
  }, [newsItems]);

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

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userProfile } = useDoc<any>(userDocRef);

  const isCommunityClaimed = Boolean(
    userProfile?.claimedCommunityTicket || 
    userProfile?.claimedPromoCodes?.includes('COMMUNITY_JOIN')
  );

  const handleCommunityJoin = async () => {
    const targetUrl = systemConfig?.communityUrl || 'https://line.me/ti/g2/';

    if (!user || !firestore) {
      toast({
        title: '歡迎加入官方社群！',
        description: '登入會員後點擊加入官方社群，即可自動領取「免費抽卡券 1 張」！'
      });
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (isCommunityClaimed) {
      toast({
        title: '歡迎前往官方社群！',
        description: '您已領取過專屬免費抽卡券，每位會員限領 1 次，快來社群與卡友交流戰績！'
      });
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (isClaimingCommunity) return;
    setIsClaimingCommunity(true);

    try {
      const res = await claimCommunityFreeDraw(firestore, user.uid, '官方社群');
      if (res.success && !res.alreadyClaimed) {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 }
        });
        toast({
          title: '🎉 成功領取免費抽卡券！',
          description: '已為您的帳號存入 1 張免費抽卡券！即將開啟官方社群，快與卡友們一同交流！'
        });
      } else if (res.alreadyClaimed) {
        toast({
          title: '歡迎前往官方社群！',
          description: '您已領取過專屬免費抽卡券，歡迎在官方社群與各路卡友交流心得！'
        });
      }
    } catch (err: any) {
      console.error('Error claiming community reward:', err);
    } finally {
      setIsClaimingCommunity(false);
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }
  };

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
      <section className="relative min-h-[82vh] md:min-h-[calc(100vh-4.5rem)] flex items-center justify-center overflow-hidden py-8 md:py-16">
        {(systemConfig?.showFloatingBackground !== false) && <FloatingCardsBackground />}

        {/* 立體賽博光學展台底座與透視地坪材質 (Cyber-Luxe Stage Floor Material) */}
        <HeroStageFloor />

        {/* Ambient Top Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[350px] bg-amber-500/10 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/3 w-[400px] h-[250px] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="container relative z-10 text-center space-y-5 md:space-y-7 px-4 max-w-5xl mx-auto my-auto">
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
            <h1 className="font-headline text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black tracking-tight leading-none relative select-none whitespace-nowrap inline-block mx-auto max-w-full">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-amber-200/90 drop-shadow-[0_4px_30px_rgba(245,158,11,0.35)] whitespace-nowrap inline-block">
                    P+CARDER
                </span>
                <span className="absolute inset-0 flex items-center justify-center text-amber-400/20 blur-[28px] sm:blur-[34px] pointer-events-none select-none whitespace-nowrap" aria-hidden="true">
                    P+CARDER
                </span>
            </h1>

            {/* 標題底部光學地平飾條 (Title Horizon Light Accent & Badge) */}
            <div className="flex flex-nowrap items-center justify-center gap-1.5 sm:gap-3 my-2 sm:my-3 opacity-90 pointer-events-none w-full max-w-lg mx-auto px-2 sm:px-4 overflow-hidden">
              <div className="h-[1px] flex-1 max-w-[24px] sm:max-w-[60px] md:max-w-[90px] bg-gradient-to-r from-transparent via-amber-400/60 to-amber-300 shrink" />
              <div className="flex items-center gap-1.5 sm:gap-2 text-[8px] sm:text-[10px] md:text-xs font-black tracking-wider sm:tracking-[0.2em] md:tracking-[0.25em] text-amber-300/90 uppercase whitespace-nowrap shrink-0">
                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rotate-45 bg-amber-400 shadow-[0_0_8px_#fbbf24] shrink-0" />
                <span className="whitespace-nowrap">OFFICIAL TRADING CARDS & VAULT</span>
                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rotate-45 bg-amber-400 shadow-[0_0_8px_#fbbf24] shrink-0" />
              </div>
              <div className="h-[1px] flex-1 max-w-[24px] sm:max-w-[60px] md:max-w-[90px] bg-gradient-to-l from-transparent via-amber-400/60 to-amber-300 shrink" />
            </div>
            
            <p className="text-sm sm:text-base md:text-xl text-slate-300 max-w-xl mx-auto font-medium tracking-wider leading-relaxed px-2">
                頂級球員卡福袋平台 · 即時連線公平抽取<br />
                <span className="text-amber-400 font-bold drop-shadow-[0_0_12px_rgba(245,158,11,0.4)]">打造屬於你的極致玩卡與收藏體驗</span>
            </p>

            {/* 🔥 首頁首屏第一眼活動膠囊 */}
            <div className="pt-2 sm:pt-3">
              <BonusDoubleHeroPill onOpenDetail={() => setIsPromoModalOpen(true)} />
            </div>
          </div>
          
          {/* 快捷操作按鈕組 */}
          <div className="flex flex-col items-center justify-center animate-fade-in-up pt-4 sm:pt-6 max-w-lg mx-auto">
            <Button size="lg" asChild className="w-full sm:w-auto h-12 sm:h-14 px-8 text-base sm:text-lg font-black rounded-2xl group bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-500 text-slate-950 shadow-[0_0_35px_rgba(245,158,11,0.45)] hover:shadow-[0_0_50px_rgba(245,158,11,0.7)] border border-amber-300/70 relative overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Link href="/draw" className="flex items-center justify-center gap-2.5">
                <Sparkles className="w-5 h-5 text-slate-950 fill-slate-950" />
                <span className="tracking-wide">立即前往卡池</span>
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1.5 transition-transform" />
              </Link>
            </Button>
            {/* 按鈕下方展台投影光暈 */}
            <div className="w-44 sm:w-60 h-3 mt-2 bg-amber-400/25 blur-md rounded-full pointer-events-none" />
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
                <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
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

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-6 sm:gap-8">
            {featuredPools.map((pool) => (
              <div key={pool.id} className="relative w-full">
                {pool.isFeatured && (
                  <div className="absolute -top-2.5 -left-2 z-20">
                    <div className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-[10px] px-2.5 py-0.5 rounded-full shadow-[0_4px_12px_rgba(245,158,11,0.4)] border border-amber-200/50 uppercase tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3 h-3 fill-slate-950" />
                      <span>HOT 精選</span>
                    </div>
                  </div>
                )}
                <PoolCard pool={pool} allCardsMap={allCardsMap} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 最新消息中心 */}
      <section className="relative py-8 sm:py-16 bg-gradient-to-b from-slate-950/80 via-slate-900/50 to-slate-950/80 border-y border-slate-800/80 overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="container relative z-10 px-3 sm:px-4 max-w-7xl mx-auto">
            
            {/* Header - 手機版與桌面版完美平衡的美化標題列 */}
            <div className="relative p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-900/95 via-slate-950/95 to-slate-900/95 border border-slate-800/90 backdrop-blur-2xl mb-6 sm:mb-8 shadow-[0_12px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/5 overflow-hidden">
                <div className="absolute -top-16 left-1/3 w-64 h-32 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
                
                <div className="relative z-10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
                        <div className="p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-amber-600/5 border border-amber-400/30 text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.2)] shrink-0 flex items-center justify-center">
                            <Newspaper className="w-4 h-4 sm:w-6 sm:h-6 text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                        </div>
                        <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-base sm:text-2xl md:text-3xl font-black font-headline tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-100 to-yellow-400 drop-shadow-[0_2px_15px_rgba(245,158,11,0.3)] truncate">
                                    最新消息中心
                                </h2>
                                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[10px] sm:text-[11px] font-bold shadow-sm shrink-0">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                    即時快訊
                                </span>
                            </div>
                            <p className="text-[11px] sm:text-xs md:text-sm text-slate-400 font-medium truncate mt-0.5">
                                官方即時資訊 · 掌握第一手活動快訊與公告
                            </p>
                        </div>
                    </div>

                    <Button variant="ghost" asChild className="h-8 sm:h-10 px-3 sm:px-4 rounded-xl font-bold text-amber-300 hover:text-amber-200 border border-amber-500/25 hover:border-amber-400/50 bg-slate-900/80 hover:bg-slate-800 shadow-md text-xs transition-all duration-300 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)] shrink-0">
                        <Link href="/news" className="flex items-center gap-1 sm:gap-2">
                            <span className="hidden sm:inline">完整消息庫</span>
                            <span className="sm:hidden">全部消息</span>
                            <ChevronRight className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </Link>
                    </Button>
                </div>
            </div>
            
            {/* 卡片輪播 - 手機版露出下張卡片邊緣 (basis-[86%] xs:basis-[82%])，支援手勢滑動與點擊開啟詳情 */}
            <Carousel 
                setApi={setNewsApi}
                opts={{ align: "start", loop: false }} 
                className="w-full relative"
            >
                <CarouselContent className="-ml-3 sm:-ml-4">
                    {isLoadingNews ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <CarouselItem key={i} className="pl-3 sm:pl-4 basis-[86%] xs:basis-[82%] sm:basis-1/2 lg:basis-1/3">
                                <div className="aspect-[4/3] sm:aspect-[16/11] w-full rounded-2xl overflow-hidden bg-slate-900/90 border border-slate-800 flex flex-col p-4 justify-between">
                                    <Skeleton className="w-full h-36 rounded-xl" />
                                    <div className="space-y-2 mt-4">
                                        <Skeleton className="w-3/4 h-4 rounded" />
                                        <Skeleton className="w-1/2 h-3 rounded" />
                                    </div>
                                </div>
                            </CarouselItem>
                        ))
                    ) : (
                        effectiveNews.map((item) => {
                            const snippet = item.content ? item.content.replace(/<[^>]+>/g, '').trim() : '';

                            return (
                                <CarouselItem key={item.id} className="pl-3 sm:pl-4 basis-[86%] xs:basis-[82%] sm:basis-1/2 lg:basis-1/3 flex flex-col">
                                    <div 
                                      onClick={() => setSelectedNews(item)}
                                      className="group block h-full cursor-pointer select-none text-left"
                                      role="button"
                                      tabIndex={0}
                                    >
                                        <div className="h-full overflow-hidden bg-gradient-to-b from-slate-900/95 via-slate-950/95 to-slate-950 border border-slate-800/80 hover:border-amber-400/70 transition-all duration-300 rounded-2xl shadow-xl hover:shadow-[0_12px_36px_rgba(245,158,11,0.18)] group-hover:-translate-y-1.5 flex flex-col justify-between">
                                            
                                            {/* 上半部：精美封面與浮動標籤 */}
                                            <div className="aspect-[16/9] w-full relative overflow-hidden bg-slate-950 shrink-0">
                                                {item.type === 'image' && item.imageUrl ? (
                                                    <>
                                                        <SafeImage 
                                                            src={item.imageUrl} 
                                                            alt={item.title} 
                                                            width={600}
                                                            height={338}
                                                            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-108"
                                                        />
                                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent pointer-events-none" />
                                                    </>
                                                ) : (
                                                    <div className="absolute inset-0 bg-gradient-to-br from-amber-950/30 via-slate-900 to-slate-950 flex flex-col items-center justify-center p-4 overflow-hidden">
                                                        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:16px_16px] opacity-60" />
                                                        <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 mb-2 shadow-[0_0_20px_rgba(245,158,11,0.15)] group-hover:scale-110 transition-transform duration-300 z-10">
                                                            <Newspaper className="w-6 h-6" />
                                                        </div>
                                                        <span className="text-[10px] font-mono font-bold text-amber-400/70 tracking-widest uppercase z-10">
                                                            P+ CARDER NEWS
                                                        </span>
                                                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />
                                                    </div>
                                                )}

                                                {/* 頂部左側徽章 */}
                                                <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 z-10">
                                                    {item.isPinned && (
                                                      <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded shadow-[0_0_10px_rgba(245,158,11,0.5)] flex items-center gap-1">
                                                        <span>★ 置頂</span>
                                                      </span>
                                                    )}
                                                    <span className="bg-black/75 backdrop-blur-md border border-white/10 text-amber-300 font-bold text-[10px] px-2 py-0.5 rounded shadow-sm">
                                                      {item.category || '官方公告'}
                                                    </span>
                                                </div>

                                                {/* 頂部右側類型徽章 */}
                                                <div className="absolute top-2.5 right-2.5 z-10">
                                                    <span className="bg-black/70 backdrop-blur-md border border-white/10 text-[10px] text-slate-300 px-2 py-0.5 rounded font-mono flex items-center gap-1">
                                                        {item.type === 'image' ? (
                                                            <>
                                                                <ImageIcon className="w-3 h-3 text-amber-400" />
                                                                <span>圖文</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <FileText className="w-3 h-3 text-cyan-400" />
                                                                <span>公告</span>
                                                            </>
                                                        )}
                                                    </span>
                                                </div>
                                            </div>

                                            {/* 下半部：層次分明的標題、內文摘要與底部時標 */}
                                            <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-3">
                                                <div className="space-y-1.5">
                                                    <h3 className="font-headline font-black text-sm sm:text-base text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug text-left">
                                                        {item.title}
                                                    </h3>
                                                    {snippet ? (
                                                        <p className="text-[11px] sm:text-xs text-slate-400/90 line-clamp-2 leading-relaxed text-left font-normal">
                                                            {snippet}
                                                        </p>
                                                    ) : (
                                                        <p className="text-[11px] sm:text-xs text-slate-500/80 line-clamp-1 leading-relaxed text-left font-normal">
                                                            點擊查看完整官方消息與最新動態...
                                                        </p>
                                                    )}
                                                </div>

                                                {/* 底部時間與詳閱箭頭 */}
                                                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-400">
                                                        <Calendar className="h-3 w-3 text-amber-400/80" />
                                                        <span>{item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}</span>
                                                    </div>
                                                    <span className="text-amber-400 group-hover:text-amber-300 font-bold text-xs flex items-center gap-0.5 group-hover:translate-x-1 transition-transform">
                                                        <span>詳閱內容</span>
                                                        <ChevronRight className="w-3.5 h-3.5" />
                                                    </span>
                                                </div>
                                            </div>

                                        </div>
                                    </div>
                                </CarouselItem>
                            );
                        })
                    )}
                </CarouselContent>
                
                {/* 電腦與平板左右導覽箭頭 */}
                <CarouselPrevious className="hidden md:flex -left-4 h-9 w-9 bg-slate-900 border-slate-700 text-slate-200 hover:bg-amber-500 hover:text-slate-950 shadow-lg" />
                <CarouselNext className="hidden md:flex -right-4 h-9 w-9 bg-slate-900 border-slate-700 text-slate-200 hover:bg-amber-500 hover:text-slate-950 shadow-lg" />

                {/* 手機專用滑動指示圓點 (Dots) */}
                {newsItems && newsItems.length > 1 && (
                    <div className="flex sm:hidden justify-center items-center gap-1.5 mt-5">
                        {newsItems.map((_, dotIdx) => (
                            <button
                                key={dotIdx}
                                type="button"
                                onClick={() => newsApi?.scrollTo(dotIdx)}
                                aria-label={`切換至消息 ${dotIdx + 1}`}
                                className={cn(
                                    "h-1.5 transition-all duration-300 rounded-full",
                                    newsCurrent === dotIdx 
                                        ? "w-6 bg-gradient-to-r from-amber-400 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]" 
                                        : "w-1.5 bg-slate-700/80 hover:bg-slate-600"
                                )}
                            />
                        ))}
                    </div>
                )}
            </Carousel>
        </div>
      </section>

      {/* 為什麼選擇我們 */}
      <section className="py-14 sm:py-24 container px-3 sm:px-4 max-w-7xl mx-auto relative">
        <div className="relative p-6 sm:p-12 lg:p-14 rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-slate-950/90 border border-slate-800/90 backdrop-blur-2xl overflow-hidden shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)] ring-1 ring-white/5">
          {/* 精緻背景環境流光與科技微網格 */}
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff04_1px,transparent_1px),linear-gradient(to_bottom,#ffffff04_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none opacity-60" />

          {/* 區塊標題區 - 已移除多餘的英文副標 */}
          <div className="text-center mb-12 sm:mb-16 space-y-3.5 relative z-10">
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black font-headline tracking-tight text-white drop-shadow-sm">
              為什麼選擇 <span className="bg-clip-text text-transparent bg-gradient-to-r from-amber-300 via-amber-400 to-yellow-400 drop-shadow-[0_0_25px_rgba(245,158,11,0.4)]">P+Carder</span>
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mx-auto font-medium leading-relaxed">
              專為真實球卡愛好者打造的次世代數位開包與藏友社交平台 · 公開、真實、極致快感
            </p>
          </div>

          {/* 4 大核心特色卡片 - 手機支援手勢左右滑動，平板與電腦無縫響應 */}
          <Carousel 
            setApi={setWhyChooseApi}
            opts={{ align: "start", loop: false }} 
            className="w-full relative z-10"
          >
            <CarouselContent className="-ml-3 sm:-ml-4 lg:-ml-6">
              {[
                { 
                  num: '01',
                  badge: '100% 實體存證',
                  title: '公開透明存證', 
                  desc: '每一張核心卡片皆經數位存證與實物封裝比對，確保來源真實、所有權清晰，打造最值得信賴的收藏環境。', 
                  icon: ShieldCheck, 
                  theme: 'amber',
                  gradient: 'from-amber-500/20 via-amber-500/5 to-transparent',
                  border: 'hover:border-amber-400/60 hover:shadow-[0_12px_40px_rgba(245,158,11,0.2)]',
                  iconWrap: 'bg-amber-500/15 text-amber-400 border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.25)]',
                  tagClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
                  featurePills: ['實卡封裝檢驗', '真實防偽機制'],
                },
                { 
                  num: '02',
                  badge: '全公開演算法',
                  title: '公平機率披露', 
                  desc: '絕不隱藏任何數據，所有卡池機率與剩餘大獎數量即時完全公開披露，杜絕黑箱，讓每次抽取都憑實力與運氣。', 
                  icon: Target, 
                  theme: 'cyan',
                  gradient: 'from-cyan-500/20 via-cyan-500/5 to-transparent',
                  border: 'hover:border-cyan-400/60 hover:shadow-[0_12px_40px_rgba(6,182,212,0.2)]',
                  iconWrap: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.25)]',
                  tagClass: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
                  featurePills: ['即時大獎存量', '數學概率公示'],
                },
                { 
                  num: '03',
                  badge: '60FPS 撕卡特效',
                  title: '極致開包張力', 
                  desc: '打破實體卡片空間限制，隨時隨地享受極具張力的次世代全息開包特效，將收藏熱忱轉化為指尖的極致快感。', 
                  icon: Zap, 
                  theme: 'fuchsia',
                  gradient: 'from-fuchsia-500/20 via-fuchsia-500/5 to-transparent',
                  border: 'hover:border-fuchsia-400/60 hover:shadow-[0_12px_40px_rgba(217,70,239,0.2)]',
                  iconWrap: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30 shadow-[0_0_20px_rgba(217,70,239,0.25)]',
                  tagClass: 'bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30',
                  featurePills: ['全息動態光效', '即抽即存即寄'],
                },
                { 
                  num: '04',
                  badge: '🎁 送免費抽卡券',
                  title: '專屬藏友社群', 
                  desc: '集結頂級球員卡愛好者！現在點擊加入官方社群，即可免費領取抽卡券 1 張，與廣大卡友交流珍稀卡片與心得。', 
                  icon: Users2, 
                  theme: 'emerald',
                  gradient: 'from-emerald-500/20 via-emerald-500/5 to-transparent',
                  border: 'hover:border-emerald-400/60 hover:shadow-[0_12px_40px_rgba(16,185,129,0.2)]',
                  iconWrap: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.25)]',
                  tagClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse',
                  featurePills: ['加入領抽卡券', '專屬藏友交流'],
                  isCommunity: true,
                },
              ].map((item, i) => (
                <CarouselItem 
                  key={i} 
                  className="pl-3 sm:pl-4 lg:pl-6 basis-[86%] xs:basis-[80%] sm:basis-1/2 lg:basis-1/4 flex flex-col"
                >
                  <div 
                    className={cn(
                      "relative p-6 sm:p-7 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/95 border border-slate-800/90 flex flex-col justify-between transition-all duration-500 group shadow-lg hover:-translate-y-1.5 backdrop-blur-xl overflow-hidden w-full h-full",
                      item.border
                    )}
                  >
                    {/* 卡片頂部漸層微光 */}
                    <div className={cn("absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-60 group-hover:opacity-100 transition-opacity", item.gradient)} />
                    <div className={cn("absolute -top-16 -right-16 w-32 h-32 rounded-full blur-2xl opacity-0 group-hover:opacity-40 transition-opacity pointer-events-none", item.gradient)} />

                    <div>
                      {/* 頂部標號與徽章 */}
                      <div className="flex items-center justify-between gap-2 mb-6">
                        <div className={cn("p-3 rounded-xl border transition-all duration-300 group-hover:scale-110", item.iconWrap)}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        
                        <div className="flex flex-col items-end">
                          <span className="text-[11px] font-mono font-bold tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">
                            {item.num}
                          </span>
                          <span className={cn("mt-1 px-2 py-0.5 rounded text-[10px] font-bold border", item.tagClass)}>
                            {item.badge}
                          </span>
                        </div>
                      </div>

                      {/* 標題與簡介 - 已刪除多餘的英文副標 */}
                      <div className="space-y-2.5 mb-5">
                        <h3 className="text-lg sm:text-xl font-black text-white group-hover:text-amber-300 transition-colors font-headline tracking-wide">
                          {item.title}
                        </h3>
                        <p className="text-xs sm:text-sm text-slate-300/80 leading-relaxed font-normal">
                          {item.desc}
                        </p>
                      </div>
                    </div>

                    <div>
                      {/* 底部功能亮點膠囊標籤 */}
                      <div className="pt-4 mt-2 border-t border-slate-800/80 flex flex-wrap items-center gap-1.5">
                        {item.featurePills.map((pill, pIndex) => (
                          <span 
                            key={pIndex} 
                            className="px-2 py-0.5 rounded-md bg-slate-950/80 border border-slate-800 text-[11px] text-slate-400 group-hover:text-slate-200 group-hover:border-slate-700 transition-colors font-medium flex items-center gap-1"
                          >
                            <span className="w-1 h-1 rounded-full bg-amber-400/80" />
                            {pill}
                          </span>
                        ))}
                      </div>

                      {/* 社群專屬加入領取按鈕 */}
                      {item.isCommunity && (
                        <Button
                          type="button"
                          onClick={handleCommunityJoin}
                          disabled={isClaimingCommunity}
                          className={cn(
                            "mt-4 w-full py-2.5 h-auto rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer",
                            isCommunityClaimed
                              ? "bg-slate-800/90 hover:bg-slate-700 text-slate-300 border border-slate-700/80 font-bold"
                              : "bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] active:scale-95"
                          )}
                        >
                          <Gift className={cn("w-3.5 h-3.5", isCommunityClaimed ? "text-emerald-400" : "text-slate-950")} />
                          <span>
                            {isClaimingCommunity 
                              ? '連線中...' 
                              : isCommunityClaimed 
                                ? '已領取專屬券 · 前往社群' 
                                : '加入官方社群 · 領免費抽卡券'}
                          </span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>

            {/* 平板模式下的左右導航按鈕 (電腦版 4 張並排無須滑動，手機版透過手指手勢滑動) */}
            <CarouselPrevious className="hidden sm:flex lg:hidden -left-4 h-9 w-9 bg-slate-900 border-slate-700 text-slate-200 hover:bg-amber-500 hover:text-slate-950" />
            <CarouselNext className="hidden sm:flex lg:hidden -right-4 h-9 w-9 bg-slate-900 border-slate-700 text-slate-200 hover:bg-amber-500 hover:text-slate-950" />

            {/* 手機專用滑動進度指示圓點 */}
            <div className="flex sm:hidden justify-center items-center gap-2 mt-6">
              {Array.from({ length: 4 }).map((_, dotIdx) => (
                <button
                  key={dotIdx}
                  type="button"
                  onClick={() => whyChooseApi?.scrollTo(dotIdx)}
                  aria-label={`切換至特色 ${dotIdx + 1}`}
                  className={cn(
                    "h-1.5 transition-all duration-300 rounded-full",
                    whyChooseCurrent === dotIdx 
                      ? "w-6 bg-gradient-to-r from-amber-400 to-yellow-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]" 
                      : "w-1.5 bg-slate-700/80 hover:bg-slate-600"
                  )}
                />
              ))}
            </div>
          </Carousel>
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
            "bg-slate-950/98 backdrop-blur-2xl border border-slate-800 p-0 overflow-hidden shadow-2xl rounded-2xl sm:rounded-3xl w-[94vw] sm:w-[90vw] md:w-full max-h-[88vh] flex flex-col",
            selectedNews?.type === 'image' ? "sm:max-w-4xl" : "sm:max-w-3xl"
        )}>
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedNews?.title || '消息詳情'}</DialogTitle>
            <DialogDescription>{selectedNews?.category || '最新消息'}</DialogDescription>
          </DialogHeader>

          {/* 圖片橫幅 (若為圖片模式) */}
          {selectedNews?.type === 'image' && selectedNews?.imageUrl && (
            <div className="relative w-full bg-black/95 flex items-center justify-center overflow-hidden shrink-0 max-h-[220px] sm:max-h-[320px] border-b border-slate-800/80">
              <SafeImage 
                src={selectedNews.imageUrl} 
                alt={selectedNews.title} 
                width={1200}
                height={675}
                className="object-cover sm:object-contain w-full h-full max-h-[220px] sm:max-h-[320px]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent pointer-events-none" />
            </div>
          )}

          {/* 滾動內容區域 */}
          <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-8 space-y-4 sm:space-y-6 text-white custom-scrollbar">
            {/* 標籤與時間 */}
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-amber-500 text-slate-950 font-black px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs border-none shadow-sm">
                  {selectedNews?.category || '官方公告'}
                </Badge>
                {selectedNews?.isPinned && (
                  <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-bold flex items-center gap-1">
                    <Megaphone className="h-3 w-3" /> 置頂快訊
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono">
                <Calendar className="h-3.5 w-3.5 text-amber-400" />
                <span>{selectedNews?.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}</span>
              </div>
            </div>

            {/* 完整標題 (絕不 truncate) */}
            <div>
              <h2 className="text-lg sm:text-2xl md:text-3xl font-black font-headline leading-snug tracking-tight text-left text-white break-words">
                {selectedNews?.title}
              </h2>
            </div>

            <Separator className="bg-slate-800" />

            {/* 內文區域 */}
            {selectedNews?.content && (
              <div 
                className="prose prose-invert max-w-none text-slate-300 leading-relaxed text-xs sm:text-sm md:text-base font-medium break-words space-y-3"
                dangerouslySetInnerHTML={{ __html: selectedNews.content }}
              />
            )}
          </div>

          {/* 底部固定操作列 */}
          <div className="shrink-0 p-4 sm:p-5 bg-slate-900/90 border-t border-slate-800/90 backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="outline" size="sm" className="rounded-xl border-amber-500/40 text-amber-300 hover:text-white hover:bg-amber-500/20 text-xs font-bold">
              <Link href="/changelog">
                查看完整歷史更新日誌 (Changelog) &rarr;
              </Link>
            </Button>
            <Button 
              onClick={() => setSelectedNews(null)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-bold h-9 px-5 rounded-xl border border-slate-700 ml-auto"
            >
              關閉
            </Button>
          </div>
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
