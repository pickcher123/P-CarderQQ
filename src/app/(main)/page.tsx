'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { ChevronRight, Trophy, Sparkles, Newspaper, Calendar, ShieldCheck, Zap, Target, Megaphone, Users2, Disc3, ArrowRight, Flame, Gift, Image as ImageIcon, FileText, Radio, ExternalLink } from 'lucide-react';
import { LuckyBagIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useUser, useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { SafeImage } from '@/components/safe-image';
import { HeroStageFloor } from '@/components/hero-stage-floor';
import { PLACEHOLDER_CARD_IMAGE } from '@/lib/placeholders';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from '@/components/ui/carousel';
import type { CardPool, CardItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { claimCommunityFreeDraw } from '@/lib/promo-draw-service';
import { useSystemConfig } from '@/components/providers/system-config-provider';
import { usePoolCardsMap } from '@/lib/pool-cards-cache';
import confetti from 'canvas-confetti';
import { OFFICIAL_NEWS_LIST } from '@/lib/default-news';
import { BeginnerGuideDialog } from '@/components/beginner-guide-dialog';

const NewsPopup = dynamic(() => import('@/components/news-popup').then(m => m.NewsPopup), { ssr: false });
const FloatingCardsBackground = dynamic(() => import('@/components/floating-cards-background').then(m => m.FloatingCardsBackground), { ssr: false });
const CardExhibitionCalendar = dynamic(() => import('@/components/card-exhibition-calendar').then(m => m.CardExhibitionCalendar), { ssr: false });
const PoolCard = dynamic(() => import('@/components/pool-card').then(m => m.PoolCard), { ssr: false });
const PromoRedeemModal = dynamic(() => import('@/components/events/PromoRedeemModal').then(m => m.PromoRedeemModal), { ssr: false });
const WhyChooseBentoGrid = dynamic(() => import('@/components/home/WhyChooseBentoGrid').then(m => m.WhyChooseBentoGrid), { ssr: false });

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

interface Partner {
    id: string;
    name: string;
    logoUrl: string;
    websiteUrl?: string;
    order: number;
}

export default function Home() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [selectedNews, setSelectedNews] = useState<NewsItem | null>(null);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isClaimingCommunity, setIsClaimingCommunity] = useState(false);
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

  const newsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'news'), orderBy('createdAt', 'desc'), limit(4));
  }, [firestore]);

  const poolsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'cardPools'), orderBy('createdAt', 'desc'), limit(4));
  }, [firestore]);

  const categoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'categories'), orderBy('order', 'asc'));
  }, [firestore]);

  const drawCategoriesQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'drawCategories');
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
  const { data: categories } = useCollection<{ id: string; name: string; imageUrl?: string; linkUrl?: string; order?: number }>(categoriesQuery);
  const { data: drawCategories } = useCollection<{ id: string; name: string }>(drawCategoriesQuery);

  const partnersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'partners'), orderBy('order', 'asc'));
  }, [firestore]);

  const { data: partners, isLoading: isLoadingPartners } = useCollection<Partner>(partnersQuery);

  const { systemConfig } = useSystemConfig();

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

  // 只按需載入首頁熱門推薦卡池實際用到的卡片，並與抽卡頁共享記憶體快取
  const allCardsMap = usePoolCardsMap(firestore, featuredPools) as unknown as Map<string, CardItem>;

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
          
          <div className="space-y-3.5 sm:space-y-4 animate-fade-in-up">
            <h1 className="font-brand text-4xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black tracking-tight leading-none relative select-none whitespace-nowrap inline-block mx-auto max-w-full">
                <span className="bg-clip-text text-transparent bg-gradient-to-b from-white via-slate-100 to-amber-200/90 drop-shadow-[0_4px_30px_rgba(245,158,11,0.35)] whitespace-nowrap inline-block">
                    P+CARDER
                </span>
                <span className="absolute inset-0 flex items-center justify-center text-amber-400/20 blur-[28px] sm:blur-[34px] pointer-events-none select-none whitespace-nowrap" aria-hidden="true">
                    P+CARDER
                </span>
            </h1>

            {/* 標題底部光學地平飾條 */}
            <div className="flex flex-nowrap items-center justify-center gap-2 sm:gap-3 my-2 sm:my-3 opacity-95 pointer-events-none w-full max-w-lg mx-auto px-2 sm:px-4 overflow-hidden">
              <div className="h-[1px] flex-1 max-w-[32px] sm:max-w-[72px] bg-gradient-to-r from-transparent via-amber-400/60 to-amber-300 shrink" />
              <div className="flex items-center gap-2 text-xs sm:text-sm font-bold tracking-[0.16em] text-amber-300 whitespace-nowrap shrink-0">
                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rotate-45 bg-amber-400 shrink-0" />
                <span className="whitespace-nowrap">頂級球員卡數位收藏平台</span>
                <span className="w-1 h-1 sm:w-1.5 sm:h-1.5 rotate-45 bg-amber-400 shrink-0" />
              </div>
              <div className="h-[1px] flex-1 max-w-[32px] sm:max-w-[72px] bg-gradient-to-l from-transparent via-amber-400/60 to-amber-300 shrink" />
            </div>
            
            <p className="text-sm sm:text-base md:text-lg text-slate-300 max-w-xl mx-auto font-medium tracking-wide leading-relaxed px-2">
              線上抽卡 <span className="text-slate-600 mx-1">·</span> 自選拼卡 <span className="text-slate-600 mx-1">·</span> 限量福袋 <span className="text-slate-600 mx-1">·</span> 實體入庫直寄
            </p>
          </div>
          
          {/* 快捷操作按鈕組 */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 animate-fade-in-up pt-3 sm:pt-5 max-w-xl mx-auto">
            <BeginnerGuideDialog triggerVariant="hero" buttonText="新手玩法指南" />
          </div>
          {/* 按鈕下方展台投影光暈 */}
          <div className="w-48 sm:w-80 h-3 mx-auto mt-2 bg-amber-400/25 blur-md rounded-full pointer-events-none" />
        </div>

        {/* 底部平滑過渡流光帶 */}
        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-background/90 to-transparent pointer-events-none z-[5]" />
      </section>

      {/* 首頁熱門推薦卡池 */}
      {featuredPools && featuredPools.length > 0 && (
        <section className="py-6 sm:py-10 container px-3 sm:px-4 max-w-7xl mx-auto">
          <div className="flex items-end justify-between gap-4 pb-4 mb-6 sm:mb-8 border-b border-slate-800/80">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0">
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-lg sm:text-2xl font-bold font-headline tracking-tight text-white">
                  熱門推薦卡池
                </h2>
                <p className="text-xs sm:text-sm text-slate-400">實體現貨即時開包 · 機率公開透明</p>
              </div>
            </div>

            <Button variant="ghost" asChild className="hover:bg-slate-800/80 h-9 px-3.5 rounded-xl font-bold text-amber-400 hover:text-amber-300 text-xs sm:text-sm shrink-0">
              <Link href="/draw" className="flex items-center gap-1 whitespace-nowrap">
                <span>查看全部</span>
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5 sm:gap-7 max-w-md sm:max-w-none mx-auto">
            {featuredPools.map((pool) => (
              <div key={pool.id} className="relative w-full pt-3.5 sm:pt-4">
                {(pool as any).isFeatured && (
                  <div className="absolute top-0.5 sm:top-1 left-4 sm:left-5 z-30 pointer-events-none">
                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black text-[10.5px] tracking-wider ring-2 ring-[#0a0f1c] shadow-[inset_0_1px_0_rgba(255,255,255,0.65),0_6px_16px_rgba(245,158,11,0.35)]">
                      <Sparkles className="w-3 h-3 fill-[#120d02] stroke-[#120d02]" />
                      <span>精選卡池</span>
                    </div>
                  </div>
                )}
                <PoolCard
                  pool={pool as any}
                  allCardsMap={allCardsMap}
                  userProfile={userProfile}
                  categoryName={drawCategories?.find(c => c.id === (pool as any).categoryId)?.name}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 為什麼選擇 P+Carder */}
      <WhyChooseBentoGrid 
        onCommunityJoin={handleCommunityJoin}
        isCommunityClaimed={isCommunityClaimed}
        isClaimingCommunity={isClaimingCommunity}
      />

      {/* 最新消息 */}
      <section className="relative py-10 sm:py-16 bg-[#060912]/80 border-y border-white/[0.06] overflow-hidden">
        <div className="container relative z-10 px-3 sm:px-4 max-w-6xl mx-auto">
            
            {/* 區塊標題列（暗黑曜石 × 香檳金視覺錨點） */}
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 mb-6 sm:mb-8 border-b border-white/[0.08]">
                <div className="flex items-start gap-3 min-w-0">
                    <div className="w-[3px] h-10 sm:h-11 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-xl sm:text-3xl font-black font-headline tracking-tight text-white leading-none">
                                最新消息
                            </h2>
                            <span className="text-[10px] font-mono font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded-full bg-amber-400/10 border border-amber-300/30 text-[#FDE68A]">
                                LATEST NEWS
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400">
                            活動公告 · 機台更新 · 限定企劃
                        </p>
                    </div>
                </div>

                <Button
                    variant="ghost"
                    asChild
                    className="self-start sm:self-auto h-9 px-4 rounded-full bg-white/[0.04] hover:bg-amber-400/[0.12] border border-white/[0.1] hover:border-amber-300/45 font-bold text-[#FDE68A] hover:text-amber-200 text-xs sm:text-sm shrink-0 transition-colors"
                >
                    <Link href="/news" className="flex items-center gap-1 whitespace-nowrap">
                        <span>查看全部消息</span>
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </Button>
            </div>
            
            {/* 卡片輪播 */}
            <Carousel 
                setApi={setNewsApi}
                opts={{ align: "start", loop: false }} 
                className="w-full relative"
            >
                <CarouselContent className="-ml-3 sm:-ml-4">
                    {isLoadingNews ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <CarouselItem key={i} className="pl-3 sm:pl-4 basis-[86%] xs:basis-[82%] sm:basis-1/2 lg:basis-1/3">
                                <div className="h-[320px] w-full rounded-2xl overflow-hidden bg-[#0a0f1c]/90 border border-white/[0.08] flex flex-col p-5 justify-between">
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
                            const hasCoverImage = item.type === 'image' && Boolean(item.imageUrl);
                            const cleanTitle = (item.title || '')
                              .replace(/^[\p{Extended_Pictographic}\uFE0F\u200D\s]+/gu, '')
                              .trim() || item.title;
                            const rawSnippet = item.content
                              ? item.content
                                  .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
                                  .replace(/<[^>]+>/g, ' ')
                                  .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]+/gu, '')
                                  .replace(/\s+/g, ' ')
                                  .trim()
                              : '';

                            return (
                                <CarouselItem key={item.id} className="pl-3 sm:pl-4 basis-[86%] xs:basis-[82%] sm:basis-1/2 lg:basis-1/3 flex flex-col">
                                    <div 
                                      onClick={() => setSelectedNews(item)}
                                      className="group block h-full cursor-pointer select-none text-left"
                                      role="button"
                                      tabIndex={0}
                                    >
                                        <div className={cn(
                                          "h-full overflow-hidden bg-[#0a0f1c]/95 border border-white/[0.08] hover:border-amber-400/40 transition-colors duration-200 rounded-2xl flex flex-col justify-between",
                                          !hasCoverImage && "border-t-2 border-t-amber-400/45"
                                        )}>
                                            
                                            {hasCoverImage ? (
                                              <>
                                                {/* 有封面圖：16:9 乾淨圖片區 */}
                                                <div className="aspect-[16/9] w-full relative overflow-hidden bg-slate-950 shrink-0">
                                                    <SafeImage 
                                                        src={item.imageUrl} 
                                                        alt={cleanTitle} 
                                                        width={600}
                                                        height={338}
                                                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1c] via-[#0a0f1c]/20 to-transparent pointer-events-none" />

                                                    {item.isPinned && (
                                                        <div className="absolute top-3 left-3 z-10">
                                                            <span className="bg-amber-400 text-slate-950 font-bold text-[11px] px-2 py-0.5 rounded">
                                                                置頂
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between gap-4">
                                                    <div className="space-y-2">
                                                        <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                                            <span className="text-amber-300/90">{item.category || '官方公告'}</span>
                                                            <span aria-hidden="true">·</span>
                                                            <span className="font-code">{item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}</span>
                                                        </div>

                                                        <h3 className="font-headline font-bold text-base sm:text-lg text-white group-hover:text-amber-200 transition-colors line-clamp-2 leading-snug text-left">
                                                            {cleanTitle}
                                                        </h3>

                                                        {rawSnippet ? (
                                                            <p className="text-xs sm:text-sm text-slate-400 line-clamp-2 leading-relaxed text-left">
                                                                {rawSnippet}
                                                            </p>
                                                        ) : (
                                                            <p className="text-xs sm:text-sm text-slate-500 line-clamp-1 leading-relaxed text-left">
                                                                點擊查看完整公告內容
                                                            </p>
                                                        )}
                                                    </div>

                                                    <div className="pt-3 border-t border-white/[0.06] flex items-center justify-end text-xs">
                                                        <span className="text-amber-300 group-hover:text-amber-200 font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                                            <span>閱讀全文</span>
                                                            <ChevronRight className="w-3.5 h-3.5" />
                                                        </span>
                                                    </div>
                                                </div>
                                              </>
                                            ) : (
                                              /* 無封面圖：純文字編輯式公告卡，不顯示空佔位圖框 */
                                              <div className="p-5 sm:p-6 flex-1 flex flex-col justify-between gap-5">
                                                  <div className="space-y-3">
                                                      <div className="flex items-center justify-between gap-2">
                                                          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                                                              <span className="text-amber-300/90">{item.category || '官方公告'}</span>
                                                              <span aria-hidden="true">·</span>
                                                              <span className="font-code">{item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}</span>
                                                          </div>
                                                          {item.isPinned && (
                                                              <span className="bg-amber-400/15 text-amber-300 border border-amber-400/30 font-semibold text-[10px] px-2 py-0.5 rounded">
                                                                  置頂
                                                              </span>
                                                          )}
                                                      </div>

                                                      <h3 className="font-headline font-bold text-base sm:text-lg text-white group-hover:text-amber-200 transition-colors line-clamp-2 leading-snug text-left">
                                                          {cleanTitle}
                                                      </h3>

                                                      <p className="text-xs sm:text-sm text-slate-400 line-clamp-6 leading-relaxed text-left">
                                                          {rawSnippet || '點擊查看完整公告內容'}
                                                      </p>
                                                  </div>

                                                  <div className="pt-3 border-t border-white/[0.06] flex items-center justify-end text-xs">
                                                      <span className="text-amber-300 group-hover:text-amber-200 font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                                          <span>閱讀全文</span>
                                                          <ChevronRight className="w-3.5 h-3.5" />
                                                      </span>
                                                  </div>
                                              </div>
                                            )}

                                        </div>
                                    </div>
                                </CarouselItem>
                            );
                        })
                    )}
                </CarouselContent>
                
                <CarouselPrevious className="hidden md:flex -left-4 h-9 w-9 bg-[#0a0f1c] border-white/[0.12] text-slate-200 hover:bg-amber-400 hover:text-slate-950 shadow-lg" />
                <CarouselNext className="hidden md:flex -right-4 h-9 w-9 bg-[#0a0f1c] border-white/[0.12] text-slate-200 hover:bg-amber-400 hover:text-slate-950 shadow-lg" />

                {/* 手機專用滑動指示圓點 (修正為 effectiveNews 同步數量) */}
                {effectiveNews.length > 1 && (
                    <div className="flex sm:hidden justify-center items-center gap-1.5 mt-5">
                        {effectiveNews.map((_, dotIdx) => (
                            <button
                                key={dotIdx}
                                type="button"
                                onClick={() => newsApi?.scrollTo(dotIdx)}
                                aria-label={`切換至消息 ${dotIdx + 1}`}
                                className={cn(
                                    "h-1.5 transition-all duration-300 rounded-full",
                                    newsCurrent === dotIdx 
                                        ? "w-6 bg-amber-400" 
                                        : "w-1.5 bg-slate-700/80 hover:bg-slate-600"
                                )}
                            />
                        ))}
                    </div>
                )}
            </Carousel>
        </div>
      </section>

      {/* 合作夥伴 */}
      <section className="container pb-12 sm:pb-20 px-3 sm:px-4 max-w-7xl mx-auto text-white">
        <div className="relative p-6 sm:p-10 rounded-3xl bg-slate-950/50 border border-slate-800/60 backdrop-blur-xl overflow-hidden">
          <div className="text-center mb-8 space-y-1.5">
            <h2 className="text-xl sm:text-3xl font-bold font-headline tracking-tight text-white">
              合作夥伴
            </h2>
            <p className="text-xs sm:text-sm text-slate-400">攜手知名卡牌品牌與專業藏家團隊</p>
          </div>
          
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6">
            {isLoadingPartners ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-56 rounded-2xl bg-slate-900/80 border border-slate-800" />
              ))
            ) : partners && partners.length > 0 ? (
              partners.map((partner) => {
                const rawUrl = (partner.websiteUrl || '').trim();
                const safeHref = rawUrl
                  ? (/^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`)
                  : '';
                const cardClassName = cn(
                  "w-48 sm:w-64 h-24 sm:h-28 flex flex-col items-center justify-center p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 hover:border-amber-300/55 shadow-xl transition-all duration-200 group relative overflow-hidden backdrop-blur-md",
                  safeHref && "cursor-pointer hover:-translate-y-0.5 hover:bg-white/[0.05]"
                );
                const inner = (
                  <>
                    <div className="w-full h-full relative flex items-center justify-center z-10">
                      <SafeImage
                        src={partner.logoUrl}
                        alt={partner.name}
                        className="object-contain max-h-full max-w-full drop-shadow-md group-hover:scale-105 transition-transform duration-300"
                        width={200}
                        height={90}
                      />
                    </div>
                    {safeHref && (
                      <span className="absolute top-2.5 right-2.5 z-20 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-full bg-amber-300/15 border border-amber-300/40 text-[#FDE68A]">
                        <ExternalLink className="w-3 h-3" />
                      </span>
                    )}
                  </>
                );

                return safeHref ? (
                  <a
                    key={partner.id}
                    href={safeHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    title={`前往 ${partner.name} 官方網站`}
                    className={cardClassName}
                  >
                    {inner}
                  </a>
                ) : (
                  <div key={partner.id} className={cardClassName}>
                    {inner}
                  </div>
                );
              })
            ) : (
              <div className="py-6 text-center text-xs text-slate-500">
                合作夥伴品牌陸續加入中
              </div>
            )}
          </div>
        </div>
      </section>

      {/* News Details Dialog (電腦版：左圖右文，手機版：上圖下文) */}
      <Dialog open={!!selectedNews} onOpenChange={(open) => !open && setSelectedNews(null)}>
        <DialogContent className={cn(
            "bg-[#0a0f1c] backdrop-blur-2xl border border-white/[0.1] border-t-2 border-t-amber-300/65 p-0 overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.88)] rounded-2xl sm:rounded-3xl w-[94vw] sm:w-[92vw] max-h-[88vh] flex flex-col",
            selectedNews?.type === 'image' && selectedNews?.imageUrl ? "md:max-w-5xl" : "sm:max-w-3xl"
        )}>
          <DialogHeader className="sr-only">
            <DialogTitle>{selectedNews?.title || '消息詳情'}</DialogTitle>
            <DialogDescription>{selectedNews?.category || '最新消息'}</DialogDescription>
          </DialogHeader>

          {/* 主體區：有圖片時電腦版採「左圖右文」雙欄佈局 */}
          <div className={cn(
            "flex-1 min-h-0 flex flex-col overflow-hidden",
            selectedNews?.type === 'image' && selectedNews?.imageUrl && "md:flex-row"
          )}>
            {/* 左側圖片區 (電腦版固定寬度完整展示，手機版在上方) */}
            {selectedNews?.type === 'image' && selectedNews?.imageUrl && (
              <div className="relative w-full md:w-[46%] lg:w-[48%] bg-[#060912] flex items-center justify-center overflow-hidden shrink-0 max-h-[220px] sm:max-h-[280px] md:max-h-none md:min-h-[420px] border-b md:border-b-0 md:border-r border-white/[0.08] p-3 sm:p-5">
                <SafeImage
                  src={selectedNews.imageUrl}
                  alt={selectedNews.title}
                  width={1200}
                  height={675}
                  className="object-contain w-full h-full max-h-[200px] sm:max-h-[250px] md:max-h-[62vh] rounded-xl"
                />
              </div>
            )}

            {/* 右側可滾動文字區 */}
            <div className="flex-1 overflow-y-auto min-h-0 p-5 sm:p-7 space-y-4 sm:space-y-5 text-white custom-scrollbar">
              {/* 標籤與時間 */}
              <div className="flex flex-wrap items-center justify-between gap-2.5 pb-3 border-b border-white/[0.08] pr-7">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className="bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black px-2.5 sm:px-3 py-0.5 sm:py-1 text-xs border-none shadow-sm">
                    {selectedNews?.category || '官方公告'}
                  </Badge>
                  {selectedNews?.isPinned && (
                    <Badge className="bg-amber-400/15 text-[#FDE68A] border border-amber-300/35 text-xs font-bold flex items-center gap-1">
                      <Megaphone className="h-3 w-3" /> 置頂快訊
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 text-xs font-mono tabular-nums">
                  <Calendar className="h-3.5 w-3.5 text-[#FDE68A]" />
                  <span>{selectedNews?.createdAt ? format(new Date(selectedNews.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '---'}</span>
                </div>
              </div>

              {/* 完整標題 */}
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-black font-headline leading-snug tracking-tight text-left text-white break-words">
                  {selectedNews?.title}
                </h2>
              </div>

              <Separator className="bg-white/[0.08]" />

              {/* 內文區域 */}
              {selectedNews?.content && (
                <div
                  className="prose prose-invert max-w-none text-slate-300 leading-relaxed text-xs sm:text-sm md:text-[15px] font-medium break-words space-y-3"
                  dangerouslySetInnerHTML={{ __html: selectedNews.content }}
                />
              )}
            </div>
          </div>

          {/* 底部固定操作列 */}
          <div className="shrink-0 p-4 sm:px-6 sm:py-4 bg-black/40 border-t border-white/[0.08] backdrop-blur-md flex flex-wrap items-center justify-between gap-3">
            <Button asChild variant="outline" size="sm" className="rounded-xl border-amber-300/35 bg-white/[0.03] text-[#FDE68A] hover:text-[#120d02] hover:bg-amber-300 text-xs font-bold transition-colors">
              <Link href="/changelog">
                查看完整歷史更新日誌 (Changelog) &rarr;
              </Link>
            </Button>
            <Button
              onClick={() => setSelectedNews(null)}
              className="bg-white/[0.06] hover:bg-white/[0.12] text-slate-100 text-xs sm:text-sm font-bold h-9 px-5 rounded-xl border border-white/[0.1] ml-auto"
            >
              關閉
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 🎁 開幕免費領券中心 / 兌換碼彈窗（點擊開啟時才動態載入） */}
      {isPromoModalOpen && (
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
      )}
    </div>
  );
}
