'use client';

import React from 'react';
import { format, differenceInCalendarDays } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Sparkles,
  Flame,
  ArrowRight,
  Navigation,
  Tag,
  Compass,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface Exhibition {
  id: string;
  title: string;
  date: { seconds: number };
  endDate?: { seconds: number };
  time?: string;
  location?: string;
  description: string;
  imageUrl?: string;
}

export const extractCity = (location?: string): string => {
  if (!location) return '全台';
  const cities = ['台北', '新北', '基隆', '桃園', '新竹', '苗栗', '台中', '彰化', '南投', '雲林', '嘉義', '台南', '高雄', '屏東', '宜蘭', '花蓮', '台東', '澎湖', '金門'];
  for (const city of cities) {
    if (location.includes(city)) return city;
  }
  return '實體活動';
};

// 城市專屬色彩主題 (提升視覺圖像化)
export const getCityTheme = (city: string) => {
  if (city.includes('台北') || city.includes('新北') || city.includes('基隆')) {
    return { bg: 'from-blue-600/30 to-indigo-900/40', border: 'border-blue-500/30', text: 'text-blue-400', badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30' };
  }
  if (city.includes('桃園') || city.includes('新竹') || city.includes('苗栗')) {
    return { bg: 'from-cyan-600/30 to-teal-900/40', border: 'border-cyan-500/30', text: 'text-cyan-400', badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30' };
  }
  if (city.includes('台中') || city.includes('彰化') || city.includes('南投')) {
    return { bg: 'from-amber-600/30 to-orange-900/40', border: 'border-amber-500/30', text: 'text-amber-400', badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30' };
  }
  if (city.includes('台南') || city.includes('高雄') || city.includes('屏東')) {
    return { bg: 'from-emerald-600/30 to-green-900/40', border: 'border-emerald-500/30', text: 'text-emerald-400', badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' };
  }
  return { bg: 'from-purple-600/30 to-slate-900/40', border: 'border-purple-500/30', text: 'text-purple-400', badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30' };
};

const getFormattedFullDate = (date: Date) => {
  const days = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const day = days[date.getDay()];
  return `${m}月${d}日 (${day})`;
};

interface NextExhibitionCardProps {
  exhibition: Exhibition | null;
  onSelect?: (exh: Exhibition) => void;
  className?: string;
}

export function NextExhibitionCard({
  exhibition,
  onSelect,
  className,
}: NextExhibitionCardProps) {
  if (!exhibition) {
    return (
      <div className={cn("p-6 rounded-3xl bg-slate-900/60 border border-slate-800 text-center space-y-2", className)}>
        <CalendarIcon className="w-8 h-8 text-slate-600 mx-auto" />
        <p className="text-slate-400 font-bold text-sm">目前暫無即將舉行的卡展</p>
        <p className="text-xs text-slate-500">新卡展資訊將即時在此更新</p>
      </div>
    );
  }

  const startDate = new Date(exhibition.date.seconds * 1000);
  const endDate = exhibition.endDate ? new Date(exhibition.endDate.seconds * 1000) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const startMidnight = new Date(startDate);
  startMidnight.setHours(0, 0, 0, 0);

  const endMidnight = endDate ? new Date(endDate) : new Date(startDate);
  endMidnight.setHours(23, 59, 59, 999);

  const isHappeningNow = today >= startMidnight && today <= endMidnight;
  const daysUntil = differenceInCalendarDays(startMidnight, today);

  const fullStartStr = getFormattedFullDate(startDate);
  const fullEndStr = endDate ? getFormattedFullDate(endDate) : null;
  const isSameDay = !endDate || fullStartStr === fullEndStr;
  const city = extractCity(exhibition.location);
  const cityTheme = getCityTheme(city);

  const mapSearchUrl = exhibition.location
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(exhibition.location)}`
    : null;

  return (
    <div 
      className={cn(
        "relative group overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-950 to-slate-950 border border-cyan-500/40 p-5 sm:p-6 transition-all duration-300 hover:border-cyan-400/70 shadow-2xl shadow-cyan-950/40",
        className
      )}
    >
      {/* 視覺光暈 */}
      <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none group-hover:bg-cyan-500/15 transition-colors" />

      <div className="flex flex-col h-full justify-between gap-4 relative z-10">
        
        {/* 頂部標籤條 */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-xs font-black shadow-[0_0_10px_rgba(6,182,212,0.2)]">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>下一場焦點卡展</span>
          </div>

          {isHappeningNow ? (
            <span className="inline-flex items-center gap-1 text-xs font-black text-rose-300 bg-rose-500/20 border border-rose-500/40 px-3 py-1 rounded-full animate-pulse">
              <Flame className="w-3.5 h-3.5 text-rose-400" />
              現正開展中
            </span>
          ) : daysUntil === 0 ? (
            <span className="text-xs font-black text-amber-300 bg-amber-500/25 border border-amber-500/50 px-3 py-1 rounded-full">
              ⚡ 今天開展
            </span>
          ) : daysUntil === 1 ? (
            <span className="text-xs font-black text-amber-300 bg-amber-500/20 border border-amber-500/40 px-3 py-1 rounded-full font-mono">
              明天開展 · 倒數 1 天
            </span>
          ) : (
            <span className="text-xs font-bold text-cyan-300 bg-cyan-500/15 border border-cyan-500/30 px-3 py-1 rounded-full font-mono">
              倒數 <strong className="font-black text-white text-sm">{daysUntil}</strong> 天
            </span>
          )}
        </div>

        {/* 圖像化區塊：海報或城市主題視覺 */}
        <div 
          onClick={() => onSelect?.(exhibition)}
          className="relative w-full h-40 sm:h-44 rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer group-hover:border-cyan-500/40 transition-all shadow-inner"
        >
          {exhibition.imageUrl ? (
            <img 
              src={exhibition.imageUrl} 
              alt={exhibition.title} 
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            />
          ) : (
            <div className={cn("w-full h-full bg-gradient-to-br flex flex-col items-center justify-center p-4 relative overflow-hidden", cityTheme.bg)}>
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-white/10 via-transparent to-black/40" />
              <Compass className="w-10 h-10 text-white/30 mb-2" />
              <span className="text-xs font-black tracking-widest text-white/80 uppercase">CARD COLLECTOR EXPO</span>
              <span className="text-xl font-black text-white mt-1">{city}卡牌特展</span>
            </div>
          )}

          {/* 浮動城市徽章 */}
          <div className="absolute top-2.5 left-2.5 px-2.5 py-1 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-700/80 text-xs font-black text-cyan-300 flex items-center gap-1 shadow-lg">
            <MapPin className="w-3 h-3 text-cyan-400" />
            <span>{city}</span>
          </div>
        </div>

        {/* 主標題與關鍵資訊 */}
        <div className="space-y-2.5">
          <h3 
            onClick={() => onSelect?.(exhibition)}
            className="text-lg sm:text-xl font-black text-white group-hover:text-cyan-300 transition-colors cursor-pointer leading-snug line-clamp-2"
          >
            {exhibition.title}
          </h3>

          <div className="grid grid-cols-1 gap-2 text-xs text-slate-300 pt-1">
            <div className="flex items-center gap-2 text-slate-200">
              <CalendarIcon className="w-4 h-4 text-rose-400 shrink-0" />
              <span className="font-bold">
                {isSameDay ? fullStartStr : `${fullStartStr} - ${fullEndStr}`}
              </span>
            </div>

            {exhibition.time && (
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{exhibition.time}</span>
              </div>
            )}

            {exhibition.location && (
              <div className="flex items-center gap-2 text-slate-400">
                <MapPin className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">{exhibition.location}</span>
              </div>
            )}
          </div>
        </div>

        {/* 底部按鈕 */}
        <div className="flex items-center gap-2 pt-2">
          {mapSearchUrl && (
            <Button
              type="button"
              asChild
              variant="outline"
              size="sm"
              className="h-10 px-4 rounded-xl bg-slate-900 border-slate-700 hover:bg-slate-800 text-slate-200 hover:text-white text-xs gap-1.5 font-bold"
            >
              <a href={mapSearchUrl} target="_blank" rel="noopener noreferrer">
                <Navigation className="w-3.5 h-3.5 text-cyan-400" />
                <span>導航</span>
              </a>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            onClick={() => onSelect?.(exhibition)}
            className="flex-1 h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-black text-xs sm:text-sm gap-1.5 transition-all shadow-lg shadow-cyan-500/20"
          >
            <span>查看展訊詳情</span>
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

      </div>
    </div>
  );
}
