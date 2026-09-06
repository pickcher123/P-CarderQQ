'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ChevronRight, Trophy, Sparkles, Newspaper, Calendar, ShieldCheck, Zap, Target, Megaphone, Users2, Disc3, ArrowRight, Flame, Gift } from 'lucide-react';
import { LuckyBagIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useAuth, useCollection, useDoc, useFirestore, useMemoFirebase } from '@/firebase';
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
import { claimCommunityFreeDraw } from '@/lib/promo-draw-service';
import confetti from 'canvas-confetti';

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
      <section className="relative py-12 sm:py-16 bg-gradient-to-b from-slate-950/80 via-slate-900/50 to-slate-950/80 border-y border-slate-800/80 overflow-hidden">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-amber-500/5 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-amber-500/5 rounded-full blur-[120px] pointer-events-none" />
        <div className="container relative z-10 px-3 sm:px-4 max-w-7xl mx-auto">
            
            {/* Header - 旗艦級美化標題橫幅 */}
            <div className="relative p-4 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900/95 via-slate-950/95 to-slate-900/95 border border-slate-800/90 backdrop-blur-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 shadow-[0_12px_40px_rgba(0,0,0,0.6)] ring-1 ring-white/5 overflow-hidden">
                <div className="absolute -top-16 left-1/3 w-64 h-32 bg-amber-500/10 blur-3xl rounded-full pointer-events-none" />
                
                <div className="flex items-center gap-3.5 sm:gap-4 relative z-10">
                    <div className="p-3 sm:p-3.5 rounded-2xl bg-gradient-to-br from-amber-400/20 via-amber-500/10 to-amber-600/5 border border-amber-400/30 text-amber-300 shadow-[0_0_20px_rgba(245,158,11,0.2)] flex items-center justify-center">
                        <Newspaper className="w-5 h-5 sm:w-6 sm:h-6 text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2.5 mb-1">
                            <h2 className="text-xl sm:text-2xl md:text-3xl font-black font-headline tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-amber-100 to-yellow-400 drop-shadow-[0_2px_15px_rgba(245,158,11,0.3)]">
                                最新消息中心
                            </h2>
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold shadow-sm">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                即時快訊
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-400 font-medium">
                            官方即時資訊 · 掌握第一手活動快訊、重磅卡池與公告
                        </p>
                    </div>
                </div>

                <Button variant="ghost" asChild className="relative z-10 hover:bg-slate-800/90 h-10 px-4 rounded-xl font-bold text-amber-300 hover:text-amber-200 border border-amber-500/25 hover:border-amber-400/50 bg-slate-900/70 shadow-md self-start sm:self-auto text-xs transition-all duration-300 hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                    <Link href="/news" className="flex items-center gap-2">
                        <span>查看完整消息庫</span>
                        <ChevronRight className="h-4 w-4" />
                    </Link>
                </Button>
            </div>
            
            <Carousel opts={{ align: "start", loop: true }} className="w-full">
                <CarouselContent className="-ml-3 sm:-ml-4">
                    {isLoadingNews ? (
                        Array.from({ length: 3 }).map((_, i) => (
                            <CarouselItem key={i} className="pl-3 sm:pl-4 basis-full sm:basis-1/2 lg:basis-1/3">
                                <div className="aspect-[16/10] sm:aspect-video w-full rounded-2xl overflow-hidden bg-slate-900/90 border border-slate-800">
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
                                    <div className="h-full overflow-hidden bg-slate-950/90 border border-slate-800/80 hover:border-amber-400/70 transition-all duration-300 rounded-2xl shadow-xl hover:shadow-[0_8px_30px_rgba(245,158,11,0.18)] group-hover:-translate-y-1 relative">
                                        <div className="aspect-[16/10] sm:aspect-video relative overflow-hidden flex flex-col justify-between p-3.5 sm:p-4">
                                            
                                            {/* 背景圖層 */}
                                            {item.type === 'image' && item.imageUrl ? (
                                                <>
                                                    <SafeImage 
                                                        src={item.imageUrl} 
                                                        alt={item.title} 
                                                        width={800}
                                                        height={450}
                                                        className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-108 brightness-[0.45] saturate-125"
                                                    />
                                                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-slate-950/70 pointer-events-none" />
                                                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-slate-950/80 pointer-events-none" />
                                                </>
                                            ) : (
                                                <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                                    {/* 精美科技暗黑卡牌背景底色 */}
                                                    <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/40" />
                                                    
                                                    {/* 幾何微紋網格 */}
                                                    <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff06_1px,transparent_1px),linear-gradient(to_bottom,#ffffff06_1px,transparent_1px)] bg-[size:20px_20px] opacity-70" />
                                                    
                                                    {/* 中心金色聚光燈 */}
                                                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-500/15 via-slate-900/30 to-slate-950" />
                                                    
                                                    {/* 裝飾性背景圖標光暈 */}
                                                    <Newspaper className="w-28 h-28 text-amber-500/5 absolute -right-4 -bottom-4 group-hover:scale-110 group-hover:text-amber-500/10 transition-all duration-500" />
                                                    <Sparkles className="w-16 h-16 text-amber-400/10 absolute -top-3 -left-3 group-hover:rotate-12 transition-all duration-500" />
                                                </div>
                                            )}

                                            {/* 頂部標籤列 */}
                                            <div className="relative z-10 flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    {item.isPinned && (
                                                      <span className="bg-gradient-to-r from-amber-400 via-yellow-400 to-amber-500 text-slate-950 font-black text-[10px] px-2 py-0.5 rounded-md shadow-[0_0_12px_rgba(245,158,11,0.4)] flex items-center gap-1">
                                                        <span>★ 置頂</span>
                                                      </span>
                                                    )}
                                                    <span className="bg-slate-900/90 backdrop-blur-md border border-slate-700/80 text-amber-300 font-bold text-[10px] px-2.5 py-0.5 rounded-md shadow-sm">
                                                      {item.category || '官方公告'}
                                                    </span>
                                                </div>

                                                <span className="text-[10px] text-slate-400 font-medium bg-black/40 backdrop-blur-sm px-2 py-0.5 rounded border border-white/5">
                                                  最新快報
                                                </span>
                                            </div>

                                            {/* ★ 核心居中標題與視覺區塊 ★ */}
                                            <div className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-3 py-2">
                                                <h3 className="font-headline font-black text-sm sm:text-base text-white text-center leading-snug group-hover:text-amber-300 transition-colors drop-shadow-[0_2px_12px_rgba(0,0,0,0.9)] max-w-full line-clamp-2">
                                                    {item.title}
                                                </h3>
                                                <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-amber-400/70 to-transparent mt-2 group-hover:w-16 group-hover:via-amber-300 transition-all duration-300" />
                                            </div>

                                            {/* 底部時間與詳閱指引 */}
                                            <div className="relative z-10 flex items-center justify-between pt-2 border-t border-white/5 text-[10px] text-slate-400">
                                                <div className="flex items-center gap-1.5 font-mono text-slate-400">
                                                    <Calendar className="h-3 w-3 text-amber-400/90" />
                                                    <span>{item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd') : '---'}</span>
                                                </div>

                                                <span className="text-amber-400/90 group-hover:text-amber-300 font-bold flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform">
                                                    <span>詳閱</span>
                                                    <ChevronRight className="w-3 h-3" />
                                                </span>
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

          {/* 4 大核心特色卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6 relative z-10">
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
              <div 
                key={i}
                className={cn(
                  "relative p-6 sm:p-7 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950/95 border border-slate-800/90 flex flex-col justify-between transition-all duration-500 group shadow-lg hover:-translate-y-1.5 backdrop-blur-xl overflow-hidden",
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
                      className="mt-4 w-full py-2.5 h-auto rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-emerald-600 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.35)] hover:shadow-[0_0_25px_rgba(16,185,129,0.5)] transition-all active:scale-95 cursor-pointer"
                    >
                      <Gift className="w-3.5 h-3.5 text-slate-950" />
                      <span>{isClaimingCommunity ? '領取中...' : '加入官方社群 · 領免費抽卡券'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  )}
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
