'use client';

import React from 'react';
import { CardExhibitionCalendar } from '@/components/card-exhibition-calendar';

export default function ExhibitionsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 pt-4 sm:pt-6">
      <div className="container mx-auto px-4 sm:px-6 max-w-7xl space-y-6">
        {/* 核心卡展行事曆組件（包含左側/頂部下一場卡展獨立凸顯，右側月份清單） */}
        <CardExhibitionCalendar 
          hideHeader={false} 
          showNextHighlight={true} 
        />
      </div>
    </div>
  );
}
