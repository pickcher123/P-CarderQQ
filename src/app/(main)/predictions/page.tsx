'use client';

import React from 'react';
import Link from 'next/link';
import { PredictionSection } from '@/components/prediction-section';
import { ChevronLeft, Trophy, Sparkles, Flame, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function PredictionsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 pt-6 sm:pt-10">
      <div className="container mx-auto px-4 sm:px-6 max-w-5xl space-y-8">
        
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

          <div className="flex items-center gap-2 text-xs font-mono text-amber-400 bg-amber-500/10 px-3.5 py-1 rounded-full border border-amber-500/30">
            <Flame className="w-3.5 h-3.5" />
            <span>賽事先知 · 預測擂台</span>
          </div>
        </div>

        {/* 核心賽事預測組件 (包含個人勝率、獲得P點數、勝率排行榜、賽事下注) */}
        <PredictionSection 
          hideHeader={false} 
          showStatsAndLeaderboard={true}
        />

      </div>
    </div>
  );
}
