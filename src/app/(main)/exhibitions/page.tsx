'use client';

import React from 'react';
import Link from 'next/link';
import { Settings, CalendarDays, Sparkles } from 'lucide-react';
import { useSystemConfig } from '@/components/providers/system-config-provider';
import { Button } from '@/components/ui/button';
import { UnifiedEventCalendar } from '@/components/calendar/unified-event-calendar';

export default function ExhibitionsPage() {
  const { systemConfig } = useSystemConfig();

  if (systemConfig?.featureFlags?.isExhibitionsEnabled === false) {
    return (
      <div className="container py-32 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-fade-in-up">
        <div className="p-8 rounded-full bg-[#0a0f1c]/90 border border-amber-300/30 shadow-[0_0_40px_rgba(251,191,36,0.12)]">
          <Settings className="w-16 h-16 text-[#FDE68A]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-3xl font-black font-headline tracking-widest text-white">維護中</h2>
          <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
            卡展行事曆目前暫停開放，我們正在進行展訊更新與優化，請稍後再試。
          </p>
        </div>
        <Button asChild variant="outline" className="h-11 px-8 rounded-xl border-amber-300/40 text-[#FDE68A] hover:bg-amber-400/15 font-bold">
          <Link href="/">返回大廳</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative overflow-x-hidden text-white pb-24 pt-2 sm:pt-6">
      <div className="container mx-auto px-3 sm:px-6 max-w-6xl space-y-6 pt-2 sm:pt-4">
        <div className="relative rounded-2xl bg-gradient-to-br from-[#17213a] via-[#11192e] to-[#0c1222] border border-amber-300/25 border-t-2 border-t-amber-300/75 px-5 py-5 sm:px-7 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden shadow-[0_18px_48px_rgba(0,0,0,0.5)]">
          {/* 溫暖香檳金與翡翠微光氛圍，提升整體明亮活潑感 */}
          <div className="absolute -top-14 left-12 w-80 h-32 bg-amber-300/20 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 right-8 w-72 h-32 bg-emerald-400/12 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-[#FDE68A]/25 via-amber-400/15 to-amber-500/5 border border-amber-300/45 flex items-center justify-center shrink-0 shadow-[0_0_24px_rgba(253,230,138,0.18)]">
              <CalendarDays className="w-6 h-6 sm:w-7 sm:h-7 text-[#FDE68A]" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-black font-headline tracking-wide flex items-center gap-1.5">
                  <span className="text-white">卡展</span>
                  <span className="text-[#FDE68A]">行事曆</span>
                </h1>
                <span className="inline-flex items-center gap-1 text-[10px] font-black px-2.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-300/40 text-[#FDE68A]">
                  <Sparkles className="w-3 h-3" />
                  <span>全球展訊雷達</span>
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                一鍵掌握台灣巡迴、亞洲與美國大型球卡展覽日程與出攤情報
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 flex-wrap self-start sm:self-auto shrink-0">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200 bg-white/[0.06] border border-white/[0.12] rounded-full px-3 py-1.5">
              <span>🇹🇼 台灣</span>
              <span className="text-white/25">·</span>
              <span>🌏 亞洲</span>
              <span className="text-white/25">·</span>
              <span>🇺🇸 美國</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-200 bg-emerald-500/15 border border-emerald-400/35 rounded-full px-3 py-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>即時同步</span>
            </div>
          </div>
        </div>
        <UnifiedEventCalendar hideHeader={true} />
      </div>
    </div>
  );
}

