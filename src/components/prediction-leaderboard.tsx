'use client';

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Trophy,
  Crown,
  Medal,
  TrendingUp,
  Percent,
  Sparkles,
  User as UserIcon,
  Flame,
  Award,
  Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';

export interface UserStats {
  userId: string;
  userName: string;
  userAvatar?: string;
  userLevel?: string;
  totalPredictions: number;
  settledCount: number;
  winsCount: number;
  lossesCount: number;
  totalPointsEarned: number;
  winRate: number;
  activeCount: number;
}

interface PredictionLeaderboardProps {
  userStatsList: UserStats[];
  currentUserId?: string | null;
  className?: string;
}

export function PredictionLeaderboard({
  userStatsList,
  currentUserId,
  className,
}: PredictionLeaderboardProps) {
  const [sortTab, setSortTab] = useState<'winRate' | 'points' | 'wins'>('winRate');

  // 排序榜單
  const rankedUsers = useMemo(() => {
    const list = [...userStatsList];
    if (sortTab === 'winRate') {
      return list.sort((a, b) => {
        // 先比勝率，勝率相同時比結算場次，再比累積點數
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        if (b.settledCount !== a.settledCount) return b.settledCount - a.settledCount;
        return b.totalPointsEarned - a.totalPointsEarned;
      });
    } else if (sortTab === 'points') {
      return list.sort((a, b) => {
        if (b.totalPointsEarned !== a.totalPointsEarned) return b.totalPointsEarned - a.totalPointsEarned;
        return b.winRate - a.winRate;
      });
    } else {
      return list.sort((a, b) => {
        if (b.winsCount !== a.winsCount) return b.winsCount - a.winsCount;
        return b.winRate - a.winRate;
      });
    }
  }, [userStatsList, sortTab]);

  const top3 = rankedUsers.slice(0, 3);
  const myRankIndex = rankedUsers.findIndex(u => u.userId === currentUserId);
  const myStats = myRankIndex !== -1 ? rankedUsers[myRankIndex] : null;

  return (
    <div className={cn("space-y-5", className)}>
      {/* 榜單分類切換 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-lg text-white font-headline flex items-center gap-1.5">
              <span>預測勝率排行榜</span>
              <Sparkles className="w-4 h-4 text-amber-400" />
            </h3>
            <p className="text-xs text-slate-400">全服神準先知榜 · 贏得榮譽與海量 P+ 點數</p>
          </div>
        </div>

        {/* 排序標籤切換 */}
        <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-slate-800">
          <button
            type="button"
            onClick={() => setSortTab('winRate')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1",
              sortTab === 'winRate'
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Percent className="w-3.5 h-3.5" />
            <span>勝率榜</span>
          </button>
          <button
            type="button"
            onClick={() => setSortTab('points')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1",
              sortTab === 'points'
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            <PPlusIcon className="w-3.5 h-3.5" />
            <span>P點榜</span>
          </button>
          <button
            type="button"
            onClick={() => setSortTab('wins')}
            className={cn(
              "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1",
              sortTab === 'wins'
                ? "bg-amber-500 text-slate-950 shadow-md"
                : "text-slate-400 hover:text-white"
            )}
          >
            <Award className="w-3.5 h-3.5" />
            <span>勝場榜</span>
          </button>
        </div>
      </div>

      {/* 前三名 Podium 頒獎台展示 (當至少有 1 人時) */}
      {top3.length > 0 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-2">
          {/* 第二名 */}
          <div className="flex flex-col items-center justify-end">
            {top3[1] ? (
              <div className="w-full bg-gradient-to-b from-slate-800/80 to-slate-900/90 border border-slate-700/80 rounded-2xl p-3 sm:p-4 text-center space-y-2 relative shadow-lg">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-slate-300 text-slate-950 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-0.5 border border-white">
                  <span>🥈 NO.2</span>
                </div>
                <div className="pt-2 flex justify-center">
                  <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-slate-300 shadow-md">
                    <AvatarImage src={top3[1].userAvatar} />
                    <AvatarFallback className="bg-slate-800 text-slate-300 font-bold text-xs">
                      {top3[1].userName.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-xs text-white truncate max-w-full">{top3[1].userName}</p>
                  <p className="text-[11px] font-black text-slate-300 font-mono">
                    {sortTab === 'points' ? `+${top3[1].totalPointsEarned} P+` : `${top3[1].winRate.toFixed(1)}%`}
                  </p>
                  <p className="text-[10px] text-slate-400">{top3[1].winsCount}勝 / {top3[1].settledCount}場</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-24 rounded-2xl border border-dashed border-slate-800 flex items-center justify-center text-slate-600 text-xs font-bold">
                虛位以待
              </div>
            )}
          </div>

          {/* 第一名 (冠軍突出) */}
          <div className="flex flex-col items-center justify-end -mt-3">
            {top3[0] ? (
              <div className="w-full bg-gradient-to-b from-amber-500/20 via-slate-900/95 to-slate-950 border-2 border-amber-400/80 rounded-2xl p-3.5 sm:p-5 text-center space-y-2 relative shadow-[0_0_25px_rgba(245,158,11,0.25)]">
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 text-[10px] sm:text-xs font-black px-2.5 py-0.5 rounded-full shadow-lg flex items-center gap-1 border border-yellow-200 animate-pulse">
                  <Crown className="w-3.5 h-3.5 text-amber-900" />
                  <span>NO.1 冠軍</span>
                </div>
                <div className="pt-2 flex justify-center">
                  <Avatar className="w-12 h-12 sm:w-14 sm:h-14 border-2 border-amber-400 ring-2 ring-amber-400/30 shadow-lg">
                    <AvatarImage src={top3[0].userAvatar} />
                    <AvatarFallback className="bg-amber-950 text-amber-300 font-bold text-sm">
                      {top3[0].userName.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="space-y-0.5">
                  <p className="font-black text-xs sm:text-sm text-amber-200 truncate max-w-full">{top3[0].userName}</p>
                  <div className="inline-flex items-center gap-1 text-xs sm:text-sm font-black text-amber-400 font-mono">
                    <Flame className="w-3.5 h-3.5 text-amber-400" />
                    <span>{sortTab === 'points' ? `+${top3[0].totalPointsEarned} P+` : `${top3[0].winRate.toFixed(1)}%`}</span>
                  </div>
                  <p className="text-[10px] text-amber-300/80">{top3[0].winsCount}勝 / {top3[0].settledCount}場</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-28 rounded-2xl border border-dashed border-slate-800 flex items-center justify-center text-slate-600 text-xs font-bold">
                虛位以待
              </div>
            )}
          </div>

          {/* 第三名 */}
          <div className="flex flex-col items-center justify-end">
            {top3[2] ? (
              <div className="w-full bg-gradient-to-b from-amber-900/20 to-slate-900/90 border border-amber-700/60 rounded-2xl p-3 sm:p-4 text-center space-y-2 relative shadow-lg">
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-700 text-amber-100 text-[10px] sm:text-xs font-black px-2 py-0.5 rounded-full shadow-md flex items-center gap-0.5 border border-amber-600">
                  <span>🥉 NO.3</span>
                </div>
                <div className="pt-2 flex justify-center">
                  <Avatar className="w-10 h-10 sm:w-12 sm:h-12 border-2 border-amber-600/80 shadow-md">
                    <AvatarImage src={top3[2].userAvatar} />
                    <AvatarFallback className="bg-amber-950 text-amber-400 font-bold text-xs">
                      {top3[2].userName.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                <div className="space-y-0.5">
                  <p className="font-bold text-xs text-white truncate max-w-full">{top3[2].userName}</p>
                  <p className="text-[11px] font-black text-amber-400 font-mono">
                    {sortTab === 'points' ? `+${top3[2].totalPointsEarned} P+` : `${top3[2].winRate.toFixed(1)}%`}
                  </p>
                  <p className="text-[10px] text-slate-400">{top3[2].winsCount}勝 / {top3[2].settledCount}場</p>
                </div>
              </div>
            ) : (
              <div className="w-full h-24 rounded-2xl border border-dashed border-slate-800 flex items-center justify-center text-slate-600 text-xs font-bold">
                虛位以待
              </div>
            )}
          </div>
        </div>
      )}

      {/* 完整榜單列表 */}
      <div className="rounded-2xl bg-slate-900/80 border border-slate-800/90 overflow-hidden shadow-xl">
        <div className="divide-y divide-slate-800/80 max-h-[420px] overflow-y-auto">
          {rankedUsers.length > 0 ? (
            rankedUsers.map((user, index) => {
              const rank = index + 1;
              const isMe = user.userId === currentUserId;

              return (
                <div
                  key={user.userId}
                  className={cn(
                    "flex items-center justify-between p-3 sm:p-3.5 transition-colors text-xs sm:text-sm",
                    isMe ? "bg-amber-500/10 hover:bg-amber-500/15 border-l-4 border-l-amber-400" : "hover:bg-slate-800/50"
                  )}
                >
                  {/* 左側：名次與頭像名稱 */}
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    {/* 名次 */}
                    <div className="w-6 sm:w-7 text-center shrink-0">
                      {rank === 1 ? (
                        <span className="text-sm sm:text-base font-black text-amber-400">🥇</span>
                      ) : rank === 2 ? (
                        <span className="text-sm sm:text-base font-black text-slate-300">🥈</span>
                      ) : rank === 3 ? (
                        <span className="text-sm sm:text-base font-black text-amber-600">🥉</span>
                      ) : (
                        <span className="font-mono font-black text-slate-400 text-xs sm:text-sm">#{rank}</span>
                      )}
                    </div>

                    {/* 頭像 */}
                    <Avatar className="w-8 h-8 rounded-full border border-slate-700 shrink-0">
                      <AvatarImage src={user.userAvatar} />
                      <AvatarFallback className="bg-slate-800 text-slate-300 font-bold text-xs">
                        {user.userName.slice(0, 1)}
                      </AvatarFallback>
                    </Avatar>

                    {/* 名稱與標籤 */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={cn("font-bold truncate text-white", isMe && "text-amber-300 font-black")}>
                          {user.userName}
                        </span>
                        {isMe && (
                          <Badge className="bg-amber-500 text-slate-950 text-[9px] font-black px-1.5 py-0 h-4 border-none">
                            我
                          </Badge>
                        )}
                        {user.userLevel && (
                          <Badge variant="outline" className="text-[9px] border-slate-700 text-slate-400 px-1 py-0 h-4">
                            {user.userLevel}
                          </Badge>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400 block font-mono">
                        {user.winsCount} 勝 {user.lossesCount} 負 · 共結算 {user.settledCount} 場
                      </span>
                    </div>
                  </div>

                  {/* 右側：勝率與累積 P+ 點數 */}
                  <div className="text-right pl-2 shrink-0 space-y-0.5">
                    <div className="font-mono font-black text-white text-xs sm:text-sm flex items-center justify-end gap-1">
                      {sortTab === 'points' ? (
                        <span className="text-amber-400">+{user.totalPointsEarned} P+</span>
                      ) : (
                        <span className="text-emerald-400">{user.winRate.toFixed(1)}%</span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono flex items-center justify-end gap-0.5">
                      {sortTab === 'points' ? (
                        <span>勝率 {user.winRate.toFixed(1)}%</span>
                      ) : (
                        <>
                          <span>已得</span>
                          <span className="text-amber-400 font-bold">+{user.totalPointsEarned}</span>
                          <PPlusIcon className="w-2.5 h-2.5 inline text-amber-400" />
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs">
              目前暫無賽事結算紀錄，預測結算後將即時展示排行榜！
            </div>
          )}
        </div>

        {/* 底部：當前登入者排名快速條 */}
        {currentUserId && myStats && (
          <div className="bg-slate-950 p-3 border-t border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-500 text-slate-950 font-black text-[10px]">我的排名</Badge>
              <span className="font-bold text-white">第 #{myRankIndex + 1} 名</span>
            </div>
            <div className="flex items-center gap-3 font-mono font-bold">
              <span className="text-emerald-400">勝率 {myStats.winRate.toFixed(1)}%</span>
              <span className="text-amber-400">+{myStats.totalPointsEarned} P+</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
