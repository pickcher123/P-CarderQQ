'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc } from 'firebase/firestore';
import { format, differenceInCalendarDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Calendar as CalendarIcon, 
  Sparkles, 
  ArrowRight, 
  MapPin, 
  Clock, 
  Ticket, 
  ChevronRight, 
  ExternalLink,
  Globe,
  Flame,
  CalendarCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/types/user-profile';
import { extractCity, Exhibition, detectGlobalRegion } from '@/components/next-exhibition-card';
import { PromoRedeemModal } from '@/components/events/PromoRedeemModal';
import { UnifiedEventCalendar } from '@/components/calendar/unified-event-calendar';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

export function FanZoneBentoGrid() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const [isCalendarModalOpen, setIsCalendarModalOpen] = useState(false);
  const [activeRegionTab, setActiveRegionTab] = useState<'all' | 'taiwan' | 'asia' | 'usa'>('all');

  // 1. 取得用戶個人資料 (包含免費券餘額)
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<UserProfile>(userDocRef);

  // 2. 取得最近的卡展活動
  const exhibitionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
  }, [firestore]);
  const { data: exhibitions } = useCollection<Exhibition>(exhibitionsQuery);

  // 計算下一場卡展
  const nextExhibition = useMemo(() => {
    if (!exhibitions || exhibitions.length === 0) return null;
    const now = new Date();
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

  // 各大洲卡展分組
  const regionalExhibitions = useMemo(() => {
    if (!exhibitions) return { taiwan: [], asia: [], usa: [] };
    const taiwan: Exhibition[] = [];
    const asia: Exhibition[] = [];
    const usa: Exhibition[] = [];

    exhibitions.forEach(exh => {
      const reg = exh.region || detectGlobalRegion(exh.title, exh.location);
      if (reg === 'taiwan') taiwan.push(exh);
      else if (reg === 'asia') asia.push(exh);
      else if (reg === 'usa') usa.push(exh);
      else taiwan.push(exh);
    });

    return { taiwan, asia, usa };
  }, [exhibitions]);

  const displayedExhibitions = useMemo(() => {
    if (activeRegionTab === 'all') return (exhibitions || []).slice(0, 3);
    return regionalExhibitions[activeRegionTab].slice(0, 3);
  }, [activeRegionTab, exhibitions, regionalExhibitions]);

  const freeTicketsCount = userProfile?.freeDrawTickets ?? 0;

  return (
    <section className="py-8 sm:py-12 container px-3 sm:px-4 max-w-7xl mx-auto relative">
      {/* 區塊頂部標題列 */}
      <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900/95 via-slate-950/95 to-slate-900/95 border border-slate-800/80 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 sm:mb-8 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-amber-500/20 border border-white/10 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.25)]">
            <CalendarIcon className="w-5 h-5 text-cyan-400 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-black text-cyan-400 uppercase tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded-md border border-cyan-500/20">
                EXPO & FAN HUB
              </span>
              <span className="text-[10px] text-slate-400 font-bold hidden sm:inline-block">· 全球卡展情報與福利中心</span>
            </div>
            <h2 className="text-lg sm:text-xl font-black font-headline tracking-wide text-white flex items-center gap-2 mt-0.5">
              <span>卡展行事曆特區</span>
              <span className="text-xs font-normal text-slate-400 font-sans hidden sm:inline">
                （台灣 · 亞洲 · 美國 共用同一張行事曆 × 簽到領券）
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
              簽到/領券 ➜
            </span>
          </button>

          {/* 下一場卡展倒數小標籤 */}
          {nextExhibition && (
            <button
              onClick={() => setIsCalendarModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 hover:border-cyan-400/60 text-cyan-300 hover:text-white transition-all text-xs font-bold cursor-pointer"
            >
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>最近卡展：</span>
              <span className="text-white font-mono font-black">
                {daysRemaining !== null && daysRemaining <= 0 ? '展出中' : `${daysRemaining}天後`}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Bento Grid 主體佈局 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-stretch">
        
        {/* ========================================================================= */}
        {/* 卡片 1 (左側佔 7 欄): 🌐 世界卡展行事曆 · 三大洲展訊雷達 */}
        {/* ========================================================================= */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="h-full rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-slate-950/95 via-slate-900/90 to-slate-950/95 border border-slate-800 hover:border-cyan-500/40 backdrop-blur-xl shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            {/* 背景動態微光 */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none group-hover:bg-cyan-500/15 transition-all" />
            
            <div className="relative z-10 space-y-4">
              {/* 頂部標籤與三大洲切換 */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <div className="p-2.5 rounded-2xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.25)]">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-black text-cyan-400/90 uppercase tracking-wider block">
                      WORLD EXPO RADAR
                    </span>
                    <h3 className="text-lg sm:text-xl font-black font-headline flex items-center gap-2">
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-sky-300 to-amber-300">
                        卡展行事曆 · 三大洲情報
                      </span>
                    </h3>
                  </div>
                </div>

                {/* 區域即時切換 */}
                <div className="flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
                  <button
                    onClick={() => setActiveRegionTab('all')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                      activeRegionTab === 'all' ? "bg-cyan-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                    )}
                  >
                    全部
                  </button>
                  <button
                    onClick={() => setActiveRegionTab('taiwan')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                      activeRegionTab === 'taiwan' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                    )}
                  >
                    🇹🇼 台灣
                  </button>
                  <button
                    onClick={() => setActiveRegionTab('asia')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                      activeRegionTab === 'asia' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                    )}
                  >
                    🌏 亞洲
                  </button>
                  <button
                    onClick={() => setActiveRegionTab('usa')}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-xs font-bold transition-all",
                      activeRegionTab === 'usa' ? "bg-amber-600 text-white shadow-xs" : "text-slate-400 hover:text-white"
                    )}
                  >
                    🇺🇸 美國
                  </button>
                </div>
              </div>

              {/* 卡展清單精選推薦 */}
              <div className="space-y-2.5">
                {displayedExhibitions.length > 0 ? (
                  displayedExhibitions.map((exh, idx) => {
                    const reg = exh.region || detectGlobalRegion(exh.title, exh.location);
                    const flagBadge = reg === 'taiwan' ? '🇹🇼 台灣' : reg === 'asia' ? '🌏 亞洲' : '🇺🇸 美國';
                    const badgeColor = reg === 'taiwan' ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' :
                      reg === 'asia' ? 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30' :
                      'bg-amber-500/15 text-amber-300 border-amber-500/30';
                    const dateStr = exh.date?.seconds 
                      ? format(new Date(exh.date.seconds * 1000), 'yyyy/MM/dd') 
                      : '即將開展';

                    return (
                      <div 
                        key={exh.id || idx}
                        className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800/90 hover:border-cyan-500/40 transition-all flex items-center justify-between gap-3 group/item cursor-pointer"
                        onClick={() => setIsCalendarModalOpen(true)}
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded border", badgeColor)}>
                              {flagBadge}
                            </span>
                            <span className="text-xs sm:text-sm font-black text-white truncate group-hover/item:text-cyan-300 transition-colors">
                              {exh.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-medium">
                            <span className="flex items-center gap-1 font-mono text-cyan-400">
                              <Clock className="w-3 h-3" />
                              {dateStr}
                            </span>
                            {exh.location && (
                              <span className="flex items-center gap-1 text-slate-400 truncate max-w-[200px]">
                                <MapPin className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="truncate">{exh.location}</span>
                              </span>
                            )}
                          </div>
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-500 group-hover/item:text-cyan-400 group-hover/item:translate-x-0.5 transition-all shrink-0" />
                      </div>
                    );
                  })
                ) : (
                  <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 text-center space-y-1">
                    <p className="text-xs text-slate-300 font-bold">該區域暫無排程卡展，歡迎鎖定後續公佈！</p>
                    <p className="text-[11px] text-slate-500">台灣、亞洲、美國三大區域共用同一張行事曆隨時更新。</p>
                  </div>
                )}
              </div>
            </div>

            {/* 底部導覽跳轉 */}
            <div className="pt-4 mt-4 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 relative z-10">
              <span className="text-xs text-slate-400 font-medium">
                同一張行事曆涵蓋台北、東京、首爾、芝加哥 NSCC 等全球重點展會
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  onClick={() => setIsCalendarModalOpen(true)}
                  variant="outline" 
                  size="sm" 
                  className="border-cyan-500/30 bg-slate-900/80 hover:bg-slate-800 text-cyan-300 font-bold rounded-xl text-xs h-8 cursor-pointer"
                >
                  <CalendarIcon className="w-3.5 h-3.5 mr-1 text-cyan-400" />
                  <span>速覽月曆</span>
                </Button>
                <Button asChild size="sm" className="bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black rounded-xl text-xs h-8 shadow-md">
                  <Link href="/exhibitions" className="flex items-center gap-1">
                    <span>進入卡展行事曆</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </Button>
              </div>
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono font-bold text-cyan-400/90 uppercase tracking-wider block">
                        EXPO RADAR
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30">
                        全球同曆
                      </span>
                    </div>
                    <h3 className="text-base font-black flex items-center gap-1.5">
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-200 via-sky-300 to-blue-400">
                        最新焦點展覽
                      </span>
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
                  <p className="text-xs text-slate-300">點擊查看全球卡展行事曆</p>
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
          {/* 右下卡片: 🎟️ 活動福利 · 簽到/領券中心 */}
          {/* ----------------------------------------------------------------------- */}
          <div className="rounded-3xl p-5 bg-gradient-to-br from-slate-950/95 via-purple-950/30 to-slate-950/95 border border-slate-800 hover:border-pink-500/40 backdrop-blur-xl shadow-xl transition-all duration-300 relative overflow-hidden flex flex-col justify-between group">
            <div className="absolute top-0 right-0 w-60 h-60 bg-pink-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-pink-500/15 transition-all" />
            
            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-pink-500/15 border border-pink-500/30 text-pink-400 shadow-[0_0_12px_rgba(236,72,153,0.2)]">
                    <CalendarCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold text-pink-400/90 uppercase tracking-wider block">
                      CHECK-IN & REWARDS
                    </span>
                    <h3 className="text-base font-black text-white flex items-center gap-1.5">
                      <span>活動福利 · 簽到/領券</span>
                    </h3>
                  </div>
                </div>

                <Badge className="bg-pink-500/15 text-pink-300 border-pink-500/30 text-[11px] font-bold px-2 py-0.5">
                  🎟️ 每日簽到送紅利
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
                  className="bg-gradient-to-r from-pink-600 via-purple-600 to-indigo-600 hover:from-pink-500 hover:to-indigo-500 text-white text-xs font-black rounded-xl h-8 px-3 shadow-md group-hover:scale-105 transition-all cursor-pointer"
                >
                  <CalendarCheck className="w-3.5 h-3.5 mr-1" />
                  <span>簽到 / 領券</span>
                </Button>
              </div>

              <p className="text-[11px] text-slate-400 font-medium leading-relaxed">
                每日登入簽到領 P+ 紅利點數，搭配新手見面禮與官方代碼，免費券即可在卡池免扣鑽石開獎！
              </p>
            </div>

            <div className="pt-3 mt-3 border-t border-slate-800/80 flex items-center justify-between relative z-10 text-xs">
              <span className="text-slate-400 font-medium">邀請好友再贈雙方好禮</span>
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setIsPromoModalOpen(true)}
                className="h-7 text-xs text-pink-400 hover:text-pink-300 hover:bg-slate-800 px-2 rounded-lg font-bold cursor-pointer"
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

      {/* 整合卡展行事曆彈窗 */}
      <Dialog open={isCalendarModalOpen} onOpenChange={setIsCalendarModalOpen}>
        <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto bg-slate-950 text-white border-slate-800 p-4 sm:p-6 rounded-3xl">
          <DialogHeader className="border-b border-slate-800 pb-3">
            <DialogTitle className="text-lg font-black flex items-center gap-2 text-cyan-400">
              <CalendarIcon className="w-5 h-5 text-cyan-400" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-sky-300 to-amber-400">
                卡展行事曆（台灣 · 亞洲 · 美國 同曆速覽）
              </span>
            </DialogTitle>
          </DialogHeader>
          <div className="mt-4">
            <UnifiedEventCalendar hideHeader={true} initialMode="grid" />
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
