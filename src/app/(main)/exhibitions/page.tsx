'use client';

import React from 'react';
import { UnifiedEventCalendar } from '@/components/calendar/unified-event-calendar';

export default function ExhibitionsPage() {
  return (
    <div className="min-h-screen relative overflow-x-hidden bg-[#060912] text-white pb-24 pt-2 sm:pt-6">
      <div className="container mx-auto px-3 sm:px-6 max-w-6xl space-y-6 pt-2 sm:pt-4">
        <div className="space-y-1.5 border-b border-white/[0.08] pb-4">
          <h1 className="text-2xl sm:text-3xl font-bold font-headline tracking-tight text-white">
            卡展行事曆
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            台灣巡迴、亞洲與美國大型卡牌展覽日程總覽
          </p>
        </div>
        <UnifiedEventCalendar hideHeader={true} />
      </div>
    </div>
  );
}

