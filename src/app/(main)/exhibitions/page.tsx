'use client';

import React from 'react';
import Link from 'next/link';
import { CardExhibitionCalendar } from '@/components/card-exhibition-calendar';
import { ChevronLeft, Calendar as CalendarIcon, Sparkles, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function ExhibitionsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 pt-6 sm:pt-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl space-y-8">
        
        {/* 頂部導覽列與麵包屑 */}
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white hover:bg-slate-900 rounded-xl gap-1 text-xs sm:text-sm font-bold"
          >
            <Link href="/">
              <ChevronLeft className="w-4 h-4" />
              <span>返回首頁</span>
            </Link>
          </Button>

          <div className="flex items-center gap-2 text-xs font-mono text-cyan-400 bg-cyan-500/10 px-3.5 py-1 rounded-full border border-cyan-500/30">
            <Sparkles className="w-3.5 h-3.5" />
            <span>全台卡展 · 展訊行事曆</span>
          </div>
        </div>

        {/* 核心卡展行事曆組件（包含左側/頂部下一場卡展獨立凸顯，右側月份清單） */}
        <CardExhibitionCalendar 
          hideHeader={false} 
          showNextHighlight={true} 
        />

      </div>
    </div>
  );
}
