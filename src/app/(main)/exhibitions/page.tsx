'use client';

import React from 'react';
import { UnifiedEventCalendar } from '@/components/calendar/unified-event-calendar';

export default function ExhibitionsPage() {
  return (
    <div className="min-h-screen relative overflow-x-hidden text-white pb-24 pt-2 sm:pt-6">
      <div className="container mx-auto px-3 sm:px-6 max-w-6xl space-y-6 pt-2 sm:pt-4">
        <div className="relative rounded-2xl bg-gradient-to-r from-[#0d1322] via-[#0a0f1c] to-[#0d1322] border border-white/[0.08] border-t-2 border-t-amber-300/60 px-5 py-5 sm:px-7 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 overflow-hidden">
          <div className="absolute -top-10 left-1/4 w-72 h-24 bg-amber-400/10 blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-center gap-3.5">
            <span className="w-[3px] h-10 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-wide flex items-center gap-1.5">
                <span className="text-white">卡展</span>
                <span className="text-[#FDE68A]">行事曆</span>
              </h1>
              <p className="text-xs sm:text-sm text-slate-400">
                台灣巡迴、亞洲與美國大型卡牌展覽日程總覽
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-2 text-xs text-slate-300 bg-black/35 border border-white/[0.08] rounded-lg px-3.5 py-2 self-start sm:self-auto shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="font-medium tracking-wide">台 · 亞 · 美 展訊即時同步</span>
          </div>
        </div>
        <UnifiedEventCalendar hideHeader={true} />
      </div>
    </div>
  );
}

