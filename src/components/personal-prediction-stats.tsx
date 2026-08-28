'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Target,
  Trophy,
  Flame,
  Percent,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  TrendingUp,
  LogIn,
  Award,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';
import { type UserStats } from './prediction-leaderboard';

interface PersonalPredictionStatsProps {
  userStats: UserStats | null;
  isLoggedIn: boolean;
  onLoginClick?: () => void;
  className?: string;
}

export function PersonalPredictionStats({
  userStats,
  isLoggedIn,
  onLoginClick,
  className,
}: PersonalPredictionStatsProps) {
  if (!isLoggedIn) {
    return (
      <div className={cn("rounded-3xl p-1 bg-gradient-to-r from-amber-500/30 via-orange-500/20 to-yellow-500/30 shadow-xl", className)}>
        <div className="rounded-[22px] bg-slate-950/95 backdrop-blur-2xl p-5 sm:p-6 border border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 text-left">
            <div className="p-3 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shrink-0 shadow-inner">
              <Trophy className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h4 className="text-base sm:text-lg font-black text-white flex items-center gap-1.5">
                <span>登入查看個人預測勝率與 P+ 收益</span>
                <Sparkles className="w-4 h-4 text-amber-400" />
              </h4>
              <p className="text-xs text-slate-400">
                參與賽事比分與球星表現競猜，猜中即可獲得高額 P+ 點數並登上勝率榮譽榜！
              </p>
            </div>
          </div>

          <Button
            type="button"
            onClick={onLoginClick}
            className="w-full sm:w-auto h-11 px-6 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs sm:text-sm gap-2 shadow-lg shadow-amber-500/20 shrink-0"
          >
            <LogIn className="w-4 h-4" />
            <span>立即登入參與預測</span>
          </Button>
        </div>
      </div>
    );
  }

  const winRate = userStats?.winRate ?? 0;
  const pointsEarned = userStats?.totalPointsEarned ?? 0;
  const wins = userStats?.winsCount ?? 0;
  const settled = userStats?.settledCount ?? 0;
  const losses = userStats?.lossesCount ?? 0;
  const active = userStats?.activeCount ?? 0;

  return (
    <div className={cn("rounded-3xl p-1 bg-gradient-to-r from-amber-500/40 via-orange-500/20 to-yellow-500/40 shadow-[0_10px_35px_rgba(245,158,11,0.15)]", className)}>
      <div className="rounded-[22px] bg-slate-950/95 backdrop-blur-2xl p-5 sm:p-6 border border-amber-500/25 space-y-5">
        
        {/* 頂部標題與個人稱號 */}
        <div className="flex items-center justify-between flex-wrap gap-2 border-b border-slate-800/80 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400 shadow-sm">
              <Target className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg text-white font-headline">
                  我的預測戰績
                </h3>
                <Badge className="bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono text-[10px] font-black">
                  {userStats?.userName || '個人紀錄'}
                </Badge>
              </div>
              <p className="text-xs text-slate-400">即時同步全服預測結算數據</p>
            </div>
          </div>

          <div className="inline-flex items-center gap-1 text-xs font-black text-amber-400 bg-amber-500/10 border border-amber-500/30 px-3 py-1 rounded-full">
            <Sparkles className="w-3.5 h-3.5" />
            <span>先知等級：{winRate >= 80 ? '👑 神準先知' : winRate >= 60 ? '🔥 預測大師' : winRate >= 40 ? '⚡ 賽事常客' : '🌱 預測新星'}</span>
          </div>
        </div>

        {/* 4 個核心數據統計卡片 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* 1. 個人勝率 */}
          <div className="bg-slate-900/90 rounded-2xl p-3.5 sm:p-4 border border-slate-800/90 space-y-1 relative overflow-hidden group hover:border-amber-500/40 transition-colors">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span>預測勝率</span>
              <Percent className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-400 font-mono flex items-baseline gap-1">
              <span>{settled > 0 ? winRate.toFixed(1) : '--'}</span>
              <span className="text-xs text-amber-400/80 font-bold">{settled > 0 ? '%' : ''}</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              {settled > 0 ? `${wins} 勝 / ${losses} 負` : '尚無結算場次'}
            </div>
          </div>

          {/* 2. 累積獲得 P+ 點數 */}
          <div className="bg-slate-900/90 rounded-2xl p-3.5 sm:p-4 border border-slate-800/90 space-y-1 relative overflow-hidden group hover:border-amber-500/40 transition-colors">
            <div className="absolute top-0 right-0 w-16 h-16 bg-amber-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span>已獲得 P點</span>
              <PPlusIcon className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-amber-300 font-mono flex items-center gap-1">
              <span>+{pointsEarned.toLocaleString()}</span>
              <PPlusIcon className="w-4 h-4" />
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              精準命中獎勵
            </div>
          </div>

          {/* 3. 猜中場次 */}
          <div className="bg-slate-900/90 rounded-2xl p-3.5 sm:p-4 border border-slate-800/90 space-y-1 relative overflow-hidden group hover:border-emerald-500/40 transition-colors">
            <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span>猜對場次</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
              {wins} <span className="text-xs text-slate-400 font-sans font-normal">場</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              總結算 {settled} 場
            </div>
          </div>

          {/* 4. 進行中預測 */}
          <div className="bg-slate-900/90 rounded-2xl p-3.5 sm:p-4 border border-slate-800/90 space-y-1 relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
            <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-500/10 rounded-full blur-xl pointer-events-none" />
            <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
              <span>進行中賽事</span>
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">
              {active} <span className="text-xs text-slate-400 font-sans font-normal">場</span>
            </div>
            <div className="text-[10px] text-slate-400 font-mono">
              等待賽事開獎
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
