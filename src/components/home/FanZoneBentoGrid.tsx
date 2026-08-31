'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useAuth, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { format, differenceInCalendarDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Trophy, 
  Calendar as CalendarIcon, 
  Gift, 
  Sparkles, 
  Flame, 
  ArrowRight, 
  MapPin, 
  Clock, 
  Ticket, 
  Users, 
  Swords, 
  CheckCircle2, 
  Share2, 
  ChevronRight, 
  ExternalLink,
  Zap,
  Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/types/user-profile';
import { extractCity, getCityTheme, Exhibition } from '@/components/next-exhibition-card';
import { PromoRedeemModal } from '@/components/events/PromoRedeemModal';
import { CardExhibitionCalendar } from '@/components/card-exhibition-calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export function FanZoneBentoGrid() {
  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [quickPromoCode, setQuickPromoCode] = useState('');

  // 1. 取得用戶個人資料 (包含免費券餘額)
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  // 2. 取得最近的卡展活動
  const exhibitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'exhibitions'), orderBy('date', 'asc'));
  }, [firestore]);
  const { data: exhibitions } = useCollection<Exhibition>(exhibitionsQuery);

  // 計算下一場卡展
  const nextExhibition = useMemo(() => {
    if (!exhibitions || exhibitions.length === 0) return null;
    const now = new Date();
    // 優先找尚未結束的展覽
    const upcoming = exhibitions.find(e => {
      if (!e.date?.seconds) return false;
      const exDate = new Date(e.date.seconds * 1000);
      const exEndDate = e.endDate?.seconds ? new Date(e.endDate.seconds * 1000) : exDate;
      exEndDate.setHours(23, 59, 59, 999);
      return exEndDate >= now;
    });
    return upcoming || exhibitions[0];
  }, [exhibitions]);

  const daysRemaining = useMemo(() => {
    if (!nextExhibition?.date?.seconds) return null;
    const now = new Date();
    const exDate = new Date(nextExhibition.date.seconds * 1000);
    return differenceInCalendarDays(exDate, now);
  }, [nextExhibition]);

  // 3. 取得熱門賽事預測
  const predictionEventsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'predictionEvents'), limit(5));
  }, [firestore]);
  const { data: predictionEvents } = useCollection<any>(predictionEventsQuery);

  // 挑選最推薦的焦點賽事
  const featuredMatch = useMemo(() => {
    if (!predictionEvents || predictionEvents.length === 0) return null;
    // 優先挑選開放中 (open) 的賽事
    const openMatches = predictionEvents.filter(e => e.status === 'open' || !e.status);
    return openMatches[0] || predictionEvents[0];
  }, [predictionEvents]);

  const freeTicketsCount = userProfile?.freeDrawTickets ?? 0;

  return (
    <section className="py-8 sm:py-12 container px-3 sm:px-4 max-w-7xl mx-auto relative">
      {/* 區塊頂部標題列 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900/95 via-slate-950/95 to-slate-900/95 border border-slate-800/80 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sm:mb-8 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 via-purple-500/20 to-cyan-500/20 border border-white/10 text-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.25)]">
            <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black text-amber-400 uppercase tracking-widest bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                FAN ZONE HUB
              </span>
              <span className="text-[10px] text-slate-400 font-bold hidden sm:inline-block">· 玩家動態與福利中心</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black font-headline tracking-wide text-white flex items-center gap-2 mt-0.5">
              <span>卡友動態特區</span>
              <span className="text-xs font-normal text-slate-400 font-sans hidden sm:inline">
                （賽事競猜 × 展訊雷達 × 免費抽卡）
              </span>
            </h2>
          </div>
        </div>

        {/* 快速動態指標膠囊 */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 免費券快捷領取入口 */}
          <button
            onClick={() => setIsPromoModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-pink-500/15 via-purple-500/15 to-indigo-500/15 border border-pink-500/30 hover:border-pink-400/60 text-pink-300 hover:text-white transition-all text-xs font-bold shadow-xs hover:scale-105 active:scale-95 group cursor-pointer"
          >
            <Ticket className="w-3.5 h-3.5 text-pink-400 group-hover:rotate-12 transition-transform" />
            <span>免費抽卡券：</span>
            <span className="font-mono font-black text-amber-300 bg-black/40 px-1.5 py-0.2 rounded">
              {freeTicketsCount} 張
            </span>
            <span className="text-[10px] bg-pink-500 text-white px-1.5 py-0.2 rounded-full font-black animate-pulse">
              領券 ➜
            </span>
          </button>

          {/* 下一場卡展倒數小標籤 */}
          {nextExhibition && (
            <button
              onClick={() => setIsCalendarModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:border-cyan-400/60 text-cyan-300 hover:text-white transition-all text-xs font-bold cursor-pointer"
            >
              <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>卡展：</span>
              <span className="text-white font-mono font-black">
                {daysRemaining !== null && daysRemaining <= 0 ? '進行中' : `${daysRemaining}天後`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Bento Grid 主體佈局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        
        {/* ========================================================================= */}
        {/* 卡片 1 (左側佔 7 欄): 🎯 賽事先知 · 預測擂台 */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="h-full rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95 border border-slate-800 hover:border-amber-500/40 backdrop-blur-xl shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            {/* 背景動態微光 */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-amber-500/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-amber-500/15 transition-all" />
            
            <div className="relative z-10 space-y-4">
              {/* 頂部標籤與入口連結 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2.5 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.25)]">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-black text-amber-400/90 uppercase tracking-wider block">
                      SPORTS PREDICTIONS & ORACLE
                    </span>
                    <h3 className="text-lg sm:text-xl font-black font-headline text-white flex items-center gap-2">
                      <span>賽事先知 · 預測擂台</span>
                    </h3>
                  </div>
                </div>

                <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-xs px-2.5 py-1 font-bold flex items-center gap-1 shadow-xs">
                  <Flame className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
                  <span>勝率榜 · 贏海量 P+</span>
                </Badge>
              </div>

              {/* 焦點賽事卡片預覽 */}
              {featuredMatch ? (
                <div className="p-4 sm:p-5 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-slate-700/80 transition-all space-y-3.5">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 text-slate-400">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono font-bold text-[10px]">
                        {featuredMatch.category || '熱門焦點'}
                      </span>
                      <span className="font-bold text-slate-300">{featuredMatch.title}</span>
                    </div>
                    <span className="text-[11px] text-amber-400/90 font-mono font-bold flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {featuredMatch.time || '即將截止'}
                    </span>
                  </div>

                  {/* 雙方對決視覺模擬 */}
                  <div className="grid grid-cols-11 items-center gap-2 py-1">
                    {/* 隊伍 A / 選項 1 */}
                    <div className="col-span-5 p-3 rounded-xl bg-slate-950/80 border border-amber-500/20 text-center space-y-1 hover:border-amber-400/50 transition-all">
                      <div className="text-xs sm:text-sm font-black text-white truncate">
                        {featuredMatch.optionA || featuredMatch.options?.[0] || '主隊 / 選項 A'}
                      </div>
                      <div className="text-[10px] text-amber-400 font-mono font-bold">
                        {featuredMatch.oddsA ? `賠率 ${featuredMatch.oddsA}` : '先知熱門'}
                      </div>
                    </div>

                    {/* VS 徽章 */}
                    <div className="col-span-1 flex items-center justify-center">
                      <div className="w-6 h-6 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-[10px] font-black text-amber-400 shadow-sm">
                        VS
                      </div>
                    </div>

                    {/* 隊伍 B / 選項 2 */}
                    <div className="col-span-5 p-3 rounded-xl bg-slate-950/80 border border-cyan-500/20 text-center space-y-1 hover:border-cyan-400/50 transition-all">
                      <div className="text-xs sm:text-sm font-black text-white truncate">
                        {featuredMatch.optionB || featuredMatch.options?.[1] || '客隊 / 選項 B'}
                      </div>
                      <div className="text-[10px] text-cyan-400 font-mono font-bold">
                        {featuredMatch.oddsB ? `賠率 ${featuredMatch.oddsB}` : '逆襲挑戰'}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>已有熱門卡迷參與下注競猜</span>
                    </span>
                    <span className="text-emerald-400 font-mono font-bold">
                      猜中自動派發 P+ 點數
                    </span>
                  </div>
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-2">
                  <p className="text-xs text-slate-300 font-bold">目前無即時開放賽事，敬請鎖定下一輪精采對決！</p>
                  <p className="text-[11px] text-slate-500">預測猜中即可獲得大量 P+ 點數並累積神準榜名次。</p>
                </div>
              )}
            </div>

            {/* 底部導覽跳轉 */}
            <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between relative z-10">
              <span className="text-xs text-slate-400 font-medium">
                挑戰全服勝率神準榜 · 個人預測戰績
              </span>
              <Button asChild size="sm" className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-xs shadow-md">
                <Link href="/predictions" className="flex items-center gap-1">
                  <span>進入預測擂台</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 右側佔 5 欄: 分為上下兩張精美卡片 (卡展雷達 + 免費領券中心) */}
        {/* ========================================================================= */}
        <div className="lg:col-span-5 flex flex-col gap-5 sm:gap-6">
          
          {/* ----------------------------------------------------------------------- */}
          {/* 右上卡片: 📅 卡展行事曆 · 展訊雷達 */}
          {/* ----------------------------------------------------------------------- */}
          <div className="rounded-3xl p-5 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95 border border-slate-800 hover:border-cyan-500/40 backdrop-blur-xl shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-60 h-60 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/15 transition-all" />
            
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-[0_0_12px_rgba(6,182,212,0.2)]">
                    <CalendarIcon className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-cyan-400/90 uppercase tracking-wider block">
                      EXPO RADAR
                    </span>
                    <h3 className="text-base font-black text-white flex items-center gap-1.5">
                      <span>全台卡展 · 展訊雷達</span>
                    </h3>
                  </div>
                </div>

                {nextExhibition && (
                  <Badge className="bg-cyan-500/15 text-cyan-300 border-cyan-500/30 text-[11px] font-mono font-bold px-2 py-0.5">
                    {daysRemaining !== null && daysRemaining <= 0 ? '✨ 展出中' : `⏳ 倒數 ${daysRemaining} 天`}
                  </Badge>
                )}
              </div>

              {/* 下一場卡展概要 */}
              {nextExhibition ? (
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs sm:text-sm font-black text-white truncate group-hover:text-cyan-300 transition-colors">
                      {nextExhibition.title}
                    </h4>
                    <span className="shrink-0 px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                      {extractCity(nextExhibition.location)}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300 font-medium">
                    <span className="flex items-center gap-1 text-slate-300">
                      <Clock className="w-3 h-3 text-cyan-400" />
                      {nextExhibition.date?.seconds 
                        ? format(new Date(nextExhibition.date.seconds * 1000), 'yyyy/MM/dd') 
                        : '展期詳見行事曆'}
                    </span>
                    {nextExhibition.location && (
                      <span className="flex items-center gap-1 text-slate-300 truncate max-w-[170px]">
                        <MapPin className="w-3 h-3 text-rose-400 shrink-0" />
                        <span className="truncate">{nextExhibition.location}</span>
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 text-center">
                  <p className="text-xs text-slate-300">點擊查看本月份全台卡展行事曆</p>
                </div>
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between relative z-10 text-xs">
              <button 
                onClick={() => setIsCalendarModalOpen(true)}
                className="text-cyan-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>速覽完整月曆</span>
                <ChevronRight className="w-3 h-3" />
              </button>
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs text-slate-300 hover:text-white hover:bg-slate-800 px-2 rounded-lg">
                <Link href="/exhibitions" className="flex items-center gap-1">
                  <span>卡展專頁</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </Button>
            </div>
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* 右下卡片: 🎟️ 活動福利 · 免費領券中心 */}
          {/* ----------------------------------------------------------------------- */}
          <div className="rounded-3xl p-5 bg-gradient-to-br from-slate-950/95 via-purple-950/30 to-slate-950/95 border border-slate-800 hover:border-pink-500/40 backdrop-blur-xl shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-60 h-60 bg-pink-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-pink-500/15 transition-all" />
            
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.2)]">
                    <Gift className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-pink-400/90 uppercase tracking-wider block">
                      REWARDS & FREE TICKETS
                    </span>
                    <h3 className="text-base font-black text-white flex items-center gap-1.5">
                      <span>活動福利 · 免費領券</span>
                    </h3>
                  </div>
                </div>

                <Badge className="bg-pink-500/15 text-pink-300 border-pink-500/30 text-[11px] font-bold px-2 py-0.5">
                  🎟️ 零門檻抽卡
                </Badge>
              </div>

              {/* 玩家持券狀態 & 新手專屬標籤 */}
              <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/80 flex items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] text-slate-400 font-bold block">目前免費券餘額</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-r from-pink-300 via-purple-200 to-amber-300">
                      {freeTicketsCount}
                    </span>
                    <span className="text-xs font-bold text-slate-400">張（可抽卡池）</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={() => setIsPromoModalOpen(true)}
                  className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl h-8 px-3 shadow-md group-hover:scale-105 transition-all"
                >
                  <Gift className="w-3.5 h-3.5 mr-1 animate-bounce" />
                  <span>領券 / 兌換</span>
                </Button>
              </div>

              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                包含新手見面禮、社群好友邀請禮與官方現場活動代碼，獲得免費券即可在卡池免扣鑽石開獎！
              </p>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between relative z-10 text-xs">
              <span className="text-slate-400 font-medium">邀請好友再贈雙方好禮</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsPromoModalOpen(true)}
                className="h-7 text-xs text-pink-400 hover:text-pink-300 hover:bg-slate-800 px-2 rounded-lg font-bold"
              >
                <span>立即領取 ➜</span>
              </Button>
            </div>
          </div>

        </div>

      </div>

      {/* 整合兌換與邀請彈窗 */}
      <PromoRedeemModal
        open={isPromoModalOpen}
        onOpenChange={setIsPromoModalOpen}
        onApplyReward={(tickets) => {
          toast({
            title: '🎉 兌換成功！',
            description: `已成功獲得 ${tickets} 張免費抽卡券，快去卡池試試手氣吧！`,
          });
        }}
      />

      {/* 整合快速月曆彈窗 */}
      <Dialog open={isCalendarModalOpen} onOpenChange={setIsCalendarModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-slate-950 text-white border-slate-800 p-6 rounded-3xl">
          <DialogHeader className="border-b border-slate-800 pb-3">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-cyan-400">
              <CalendarIcon className="w-5 h-5" />
              <span>全台卡展 · 展訊行事曆速覽</span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <CardExhibitionCalendar hideHeader={true} showNextHighlight={true} />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
