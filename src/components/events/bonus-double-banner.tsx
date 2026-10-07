'use client';

import { useState, useEffect, useMemo } from 'react';
import { Sparkles, Flame, Clock, Gift, ArrowRight, Wallet, Layers, ChevronRight, X } from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SystemConfig } from '@/types/system';
import { DEFAULT_BONUS_EVENT, isBonusEventActive, getBonusMultiplier, type BonusEventConfig } from '@/lib/bonus-event';

interface BonusDoubleBannerProps {
  onOpenPromoModal?: () => void;
  onOpenPurchaseModal?: () => void;
  className?: string;
}

export function BonusDoubleBanner({
  onOpenPromoModal,
  onOpenPurchaseModal,
  className
}: BonusDoubleBannerProps) {
  const firestore = useFirestore();
  const systemConfigRef = useMemoFirebase(() => (firestore ? doc(firestore, 'systemConfig', 'main') : null), [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

  const eventConfig: BonusEventConfig = useMemo(() => {
    return {
      ...DEFAULT_BONUS_EVENT,
      ...(systemConfig?.bonusEvent || {}),
    };
  }, [systemConfig]);

  // 確保活動預設啟動，絕不因非同步載入而白屏或隱藏
  const isActive = eventConfig.isActive !== false;
  const multiplier = eventConfig.multiplier || 2;
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [timeLeft, setTimeLeft] = useState<{ days: number; hours: number; minutes: number; seconds: number }>({
    days: 14,
    hours: 12,
    minutes: 30,
    seconds: 0
  });

  useEffect(() => {
    if (!eventConfig.endDate) return;

    const calculateTime = () => {
      try {
        const end = new Date(`${eventConfig.endDate}T23:59:59`).getTime();
        const now = new Date().getTime();
        const diff = Math.max(0, end - now);

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);

        setTimeLeft({ days, hours, minutes, seconds });
      } catch (e) {
        // fallback
      }
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, [eventConfig.endDate]);

  if (!isActive) return null;

  return (
    <>
      {/* 🌟 紅利加倍盛典 炫彩旗艦大橫幅 */}
      <div 
        className={cn(
          "relative overflow-hidden rounded-2xl sm:rounded-3xl border-2 border-amber-500/60 bg-gradient-to-r from-[#1a0e02] via-[#241403] to-[#120901] p-4 sm:p-5 shadow-[0_10px_40px_rgba(245,158,11,0.28)] ring-1 ring-amber-400/40 transition-all duration-300 hover:border-amber-400 group cursor-pointer block w-full",
          className
        )}
        onClick={() => setIsDetailOpen(true)}
      >
        {/* 背景炫光動態光斑 */}
        <div className="absolute top-0 right-1/4 w-80 h-32 bg-amber-500/20 blur-3xl pointer-events-none rounded-full" />
        <div className="absolute bottom-0 left-1/3 w-60 h-28 bg-rose-500/15 blur-2xl pointer-events-none rounded-full" />
        
        {/* 頂部霓虹光線 */}
        <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#fbbf24]" />

        <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* 左側：活動大標與加倍倍率徽章 */}
          <div className="flex items-center gap-3.5 sm:gap-4 w-full md:w-auto">
            {/* 炫光火熱 2X 徽章 */}
            <div className="relative shrink-0 flex items-center justify-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-amber-400 via-orange-500 to-red-600 p-[2px] shadow-[0_0_25px_rgba(245,158,11,0.6)] group-hover:scale-105 transition-transform">
                <div className="w-full h-full rounded-[14px] bg-slate-950 flex flex-col items-center justify-center">
                  <Flame className="w-4 h-4 text-amber-400 fill-amber-400" />
                  <span className="font-headline font-black text-sm sm:text-base text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-yellow-200 tracking-tighter">
                    {multiplier}X
                  </span>
                </div>
              </div>
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-400 shadow-sm"></span>
              </span>
            </div>

            {/* 文字標題與渠道小標籤 */}
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-headline font-black text-base sm:text-lg text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 tracking-wide flex items-center gap-1.5 drop-shadow-[0_2px_10px_rgba(245,158,11,0.4)]">
                  <span>{eventConfig.title}</span>
                </h3>
                <Badge className="bg-gradient-to-r from-amber-500 to-rose-600 text-slate-950 font-black text-[10px] px-2 py-0 border-0 shadow-sm animate-pulse">
                  狂歡進行中
                </Badge>
              </div>
              <p className="text-xs text-amber-200/90 font-medium leading-relaxed mt-0.5 line-clamp-1">
                {eventConfig.subtitle}
              </p>

              {/* 四大加倍標籤列 */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-950/80 border border-amber-500/50 text-[10px] font-black text-amber-300 shadow-sm">
                  <Gift className="w-3 h-3 text-amber-400" /> 簽到 {multiplier}X
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-950/80 border border-amber-500/50 text-[10px] font-black text-amber-300 shadow-sm">
                  <Wallet className="w-3 h-3 text-orange-400" /> 儲值送點 {multiplier}X
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-amber-950/80 border border-amber-500/50 text-[10px] font-black text-amber-300 shadow-sm">
                  <Layers className="w-3 h-3 text-yellow-400" /> 卡片轉點 {multiplier}X
                </span>
              </div>
            </div>
          </div>

          {/* 右側：倒數計時與操作 CTA */}
          <div className="flex items-center justify-between md:justify-end gap-3 w-full md:w-auto pt-2 md:pt-0 border-t md:border-t-0 border-amber-500/30">
            {/* 倒數時鐘 */}
            <div className="flex items-center gap-1.5 text-xs text-amber-300 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="text-slate-400 text-[11px]">倒數:</span>
              <span className="font-bold bg-amber-950/90 border border-amber-500/50 px-2 py-0.5 rounded-md text-amber-300 shadow-inner">
                {timeLeft.days}天 {String(timeLeft.hours).padStart(2, '0')}:{String(timeLeft.minutes).padStart(2, '0')}:{String(timeLeft.seconds).padStart(2, '0')}
              </span>
            </div>

            <Button 
              size="sm" 
              className="h-8 sm:h-9 px-3.5 text-xs font-black rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.5)] border border-amber-300 shrink-0 group/btn"
              onClick={(e) => {
                e.stopPropagation();
                setIsDetailOpen(true);
              }}
            >
              <span>加倍特權攻略</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1 group-hover/btn:translate-x-1 transition-transform" />
            </Button>
          </div>
        </div>
      </div>

      {/* 🌟 紅利加倍活動攻略彈窗 (BonusDoubleModal) */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-md w-full bg-[#0a0703]/98 border border-amber-500/50 rounded-3xl p-5 sm:p-6 shadow-[0_0_60px_rgba(245,158,11,0.3)] text-slate-200">
          <DialogHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 p-0.5 shadow-[0_0_25px_rgba(245,158,11,0.6)] flex items-center justify-center">
              <div className="w-full h-full rounded-[14px] bg-slate-950 flex items-center justify-center">
                <Flame className="w-6 h-6 text-amber-400 fill-amber-400" />
              </div>
            </div>
            <DialogTitle className="text-lg sm:text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-300 font-headline">
              {eventConfig.title}
            </DialogTitle>
            <DialogDescription className="text-xs text-amber-200/80 leading-relaxed">
              全站紅利狂歡限時開啟！活動期間內下列各項操作均享高達 <strong className="text-amber-300 font-bold font-mono">{multiplier} 倍</strong> 點數狂飆！
            </DialogDescription>
          </DialogHeader>

          {/* 三大狂歡特權卡片清單 */}
          <div className="space-y-3 my-3">
            {/* 1. 每日簽到雙倍 */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  <Gift className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <span>每日打卡簽到</span>
                    <Badge className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0 h-4">{multiplier}X 加倍</Badge>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    平時簽到領 10 點，活動期間狂送 <strong className="text-amber-300">{10 * multiplier} 點</strong>！
                  </p>
                </div>
              </div>
              {onOpenPromoModal && (
                <Button 
                  size="sm" 
                  onClick={() => {
                    setIsDetailOpen(false);
                    onOpenPromoModal();
                  }}
                  className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shrink-0"
                >
                  去簽到
                </Button>
              )}
            </div>

            {/* 2. 儲值贈送雙倍 */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-orange-500/20 text-orange-300 border border-orange-500/30 shrink-0">
                  <Wallet className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <span>線上儲值贈點</span>
                    <Badge className="bg-orange-500 text-slate-950 font-black text-[9px] px-1.5 py-0 h-4">{multiplier}X 雙倍贈</Badge>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    購買指定額度儲值方案，額外紅利贈點直接加倍翻倍！
                  </p>
                </div>
              </div>
              {onOpenPurchaseModal && (
                <Button 
                  size="sm" 
                  onClick={() => {
                    setIsDetailOpen(false);
                    onOpenPurchaseModal();
                  }}
                  className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-orange-500 hover:bg-orange-400 text-slate-950 shrink-0"
                >
                  儲值加碼
                </Button>
              )}
            </div>

            {/* 3. 卡片轉點熔煉雙倍 */}
            <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-amber-500/30 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 shrink-0">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-black text-white flex items-center gap-1.5">
                    <span>舊卡回收熔煉</span>
                    <Badge className="bg-amber-500 text-slate-950 font-black text-[9px] px-1.5 py-0 h-4">{multiplier}X 飆速換</Badge>
                  </h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    收藏庫卡片批量變現熔煉，獲得的紅利 P+ 點數一律享雙倍！
                  </p>
                </div>
              </div>
              <Button 
                size="sm" 
                asChild
                className="h-7 px-2.5 text-[11px] font-bold rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 shrink-0 border border-amber-500/30"
              >
                <a href="/collection">
                  去收藏庫
                </a>
              </Button>
            </div>
          </div>

          <div className="pt-2 border-t border-amber-500/20 text-center text-[10px] text-slate-500">
            活動期間點數均即時自動發放至您的帳戶 · 云希國際保有活動最終解釋權
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * 🌟 首頁 Hero 專用「首屏第一眼可見」紅利 2X 加倍徽章橫條
 */
export function BonusDoubleHeroPill({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const firestore = useFirestore();
  const systemConfigRef = useMemoFirebase(() => (firestore ? doc(firestore, 'systemConfig', 'main') : null), [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

  const eventConfig: BonusEventConfig = useMemo(() => {
    return {
      ...DEFAULT_BONUS_EVENT,
      ...(systemConfig?.bonusEvent || {}),
    };
  }, [systemConfig]);

  if (eventConfig.isActive === false) return null;
  const multiplier = eventConfig.multiplier || 2;

  return (
    <div 
      onClick={onOpenDetail}
      className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-gradient-to-r from-amber-500/20 via-orange-500/25 to-amber-500/20 border border-amber-400/50 backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.35)] cursor-pointer group hover:scale-105 transition-all mx-auto select-none"
    >
      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-red-600 text-slate-950 font-black text-[10px] shadow-sm animate-pulse">
        {multiplier}X
      </span>
      <span className="text-xs sm:text-sm font-black text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]">
        🔥 全站紅利加倍盛典狂飆中！簽到、儲值、回收一律 {multiplier} 倍
      </span>
      <span className="text-[10px] text-amber-200/90 font-bold hidden sm:inline flex items-center">
        查看特權 <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
      </span>
    </div>
  );
}

/**
 * 🌟 全站頂部 Header 下方的即時廣播活動條
 */
export function BonusDoubleTicker({ onOpenDetail }: { onOpenDetail?: () => void }) {
  const firestore = useFirestore();
  const systemConfigRef = useMemoFirebase(() => (firestore ? doc(firestore, 'systemConfig', 'main') : null), [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

  const eventConfig: BonusEventConfig = useMemo(() => {
    return {
      ...DEFAULT_BONUS_EVENT,
      ...(systemConfig?.bonusEvent || {}),
    };
  }, [systemConfig]);

  if (eventConfig.isActive === false) return null;
  const multiplier = eventConfig.multiplier || 2;

  return (
    <div 
      onClick={onOpenDetail}
      className="w-full bg-gradient-to-r from-amber-950/90 via-orange-950/90 to-amber-950/90 border-b border-amber-500/40 py-1.5 px-3 flex items-center justify-between text-xs text-amber-200 cursor-pointer hover:bg-amber-900/60 transition-colors shadow-sm relative z-30"
    >
      <div className="container max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="px-1.5 py-0.2 rounded bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 font-black text-[9px] shrink-0 animate-pulse">
            🔥 {multiplier}X 加倍
          </span>
          <p className="truncate font-medium text-[11px] sm:text-xs text-amber-200">
            <strong>【限時狂歡】</strong> 全站紅利加倍開啟！每日簽到送 {10 * multiplier} 點、儲值贈點翻倍、卡片轉點享雙倍 P+ 點數！
          </p>
        </div>
        <span className="text-[11px] font-black text-amber-400 hover:text-amber-300 underline shrink-0 whitespace-nowrap hidden sm:inline">
          點擊查看活動特權 &gt;
        </span>
      </div>
    </div>
  );
}
