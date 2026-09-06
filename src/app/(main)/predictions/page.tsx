'use client';

import React from 'react';
import { PredictionSection } from '@/components/prediction-section';

export default function PredictionsPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24 pt-4 sm:pt-6">
      <div className="container mx-auto px-4 sm:px-6 max-w-5xl space-y-6">
        {/* 核心賽事預測組件 (包含個人勝率、獲得P點數、勝率排行榜、賽事下注) */}
        <PredictionSection 
          hideHeader={false} 
          showStatsAndLeaderboard={true}
        />
      </div>
    </div>
  );
}
