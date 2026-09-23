'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import {
  Medal,
  Trophy,
  Crown,
  Sparkles,
  Zap,
  Lock,
  CheckCircle2,
  ChevronRight,
  Search,
  Filter,
  SlidersHorizontal,
  Flame,
  Star,
  ExternalLink,
  Target,
  Award,
  Layers,
  ArrowUpRight,
  Pin,
  BookmarkCheck,
  Eye,
  X
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface InteractiveAchievement {
  id: string;
  title: string;
  category: string;
  icon: React.ElementType;
  unlocked: boolean;
  condition: string;
  current: number;
  target: number;
  unit: string;
  points: number; // AP (成就積分)
  rarity: AchievementRarity;
  flavorText: string;
  actionLink?: string;
  actionText?: string;
}

interface InteractiveAchievementWallProps {
  achievements: InteractiveAchievement[];
  username?: string;
}

const RARITY_STYLES: Record<AchievementRarity, {
  label: string;
  border: string;
  glow: string;
  accentBg: string;
  text: string;
  badgeBg: string;
  badgeText: string;
}> = {
  common: {
    label: '普通',
    border: 'border-slate-600/50',
    glow: 'rgba(148, 163, 184, 0.3)',
    accentBg: 'bg-slate-500/10',
    text: 'text-slate-300',
    badgeBg: 'bg-slate-800 text-slate-300 border-slate-700',
    badgeText: 'text-slate-400'
  },
  rare: {
    label: '稀有',
    border: 'border-sky-500/50',
    glow: 'rgba(56, 189, 248, 0.4)',
    accentBg: 'bg-sky-500/10',
    text: 'text-sky-300',
    badgeBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    badgeText: 'text-sky-400'
  },
  epic: {
    label: '史詩',
    border: 'border-purple-500/60',
    glow: 'rgba(168, 85, 247, 0.5)',
    accentBg: 'bg-purple-500/15',
    text: 'text-purple-300',
    badgeBg: 'bg-purple-500/20 text-purple-200 border-purple-500/40',
    badgeText: 'text-purple-400'
  },
  legendary: {
    label: '傳奇',
    border: 'border-amber-400/80',
    glow: 'rgba(251, 191, 36, 0.6)',
    accentBg: 'bg-amber-500/20',
    text: 'text-amber-300',
    badgeBg: 'bg-gradient-to-r from-amber-500/25 to-yellow-500/25 text-amber-200 border-amber-400/50',
    badgeText: 'text-amber-400'
  }
};

export function InteractiveAchievementWall({
  achievements,
  username = '收藏家'
}: InteractiveAchievementWallProps) {
  // 檢視與篩選狀態
  const [selectedCategory, setSelectedCategory] = useState<string>('全部');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unlocked' | 'near' | 'locked'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewLayout, setViewLayout] = useState<'grid' | 'detailed'>('grid');

  // 目前開啟詳情彈窗的成就
  const [inspectedAchievement, setInspectedAchievement] = useState<InteractiveAchievement | null>(null);

  // 個人代表勳章展示槽 (Showcase Badges - 最多釘選 3 個)
  const [showcaseIds, setShowcaseIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('honor_showcase_badges');
        if (saved) return JSON.parse(saved);
      } catch (e) {
        // fallback
      }
    }
    // 預設選取前 3 個已解鎖的成就
    return achievements.filter(a => a.unlocked).slice(0, 3).map(a => a.id);
  });

  const toggleShowcase = (id: string) => {
    setShowcaseIds(prev => {
      let next: string[];
      if (prev.includes(id)) {
        next = prev.filter(x => x !== id);
      } else {
        if (prev.length >= 3) {
          next = [prev[1], prev[2], id];
        } else {
          next = [...prev, id];
        }
      }
      if (typeof window !== 'undefined') {
        localStorage.setItem('honor_showcase_badges', JSON.stringify(next));
      }
      return next;
    });
  };

  // 全站分類清單
  const categories = useMemo(() => {
    const set = new Set<string>();
    achievements.forEach(a => set.add(a.category));
    return ['全部', ...Array.from(set)];
  }, [achievements]);

  // 成就進度計算
  const totalCount = achievements.length;
  const unlockedCount = useMemo(() => achievements.filter(a => a.unlocked).length, [achievements]);
  const progressPercent = Math.round((unlockedCount / (totalCount || 1)) * 100);

  // 累計 AP (成就積分)
  const totalPossibleAP = useMemo(() => achievements.reduce((acc, a) => acc + (a.points || 10), 0), [achievements]);
  const userCurrentAP = useMemo(() => {
    return achievements
      .filter(a => a.unlocked)
      .reduce((acc, a) => acc + (a.points || 10), 0);
  }, [achievements]);

  // 成就殿堂稱號判定
  const honorRank = useMemo(() => {
    if (userCurrentAP >= 600) return { title: '萬神殿傳奇', color: 'text-amber-300', glow: 'shadow-[0_0_15px_rgba(251,191,36,0.6)]' };
    if (userCurrentAP >= 350) return { title: '殿堂宗師', color: 'text-purple-300', glow: 'shadow-[0_0_15px_rgba(168,85,247,0.5)]' };
    if (userCurrentAP >= 180) return { title: '璀璨先鋒', color: 'text-sky-300', glow: 'shadow-[0_0_15px_rgba(56,189,248,0.4)]' };
    if (userCurrentAP >= 50) return { title: '白銀探索者', color: 'text-slate-200', glow: 'shadow-[0_0_15px_rgba(148,163,184,0.3)]' };
    return { title: '初心者', color: 'text-slate-400', glow: '' };
  }, [userCurrentAP]);

  // 離解鎖最接近的 1~2 個成就 (即將達成 / 衝刺焦點)
  const nearAchievements = useMemo(() => {
    return achievements
      .filter(a => !a.unlocked && a.target > 0)
      .map(a => {
        const ratio = Math.min(0.99, a.current / a.target);
        return { ...a, ratio };
      })
      .sort((a, b) => b.ratio - a.ratio)
      .slice(0, 2);
  }, [achievements]);

  // 過濾邏輯
  const filteredAchievements = useMemo(() => {
    return achievements.filter(item => {
      // 分類過濾
      if (selectedCategory !== '全部' && item.category !== selectedCategory) {
        return false;
      }
      // 狀態過濾
      if (statusFilter === 'unlocked' && !item.unlocked) return false;
      if (statusFilter === 'locked' && item.unlocked) return false;
      if (statusFilter === 'near') {
        const ratio = item.target > 0 ? (item.current / item.target) : 0;
        if (item.unlocked || ratio < 0.3) return false;
      }
      // 搜尋過濾
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchTitle = item.title.toLowerCase().includes(query);
        const matchCond = item.condition.toLowerCase().includes(query);
        const matchCat = item.category.toLowerCase().includes(query);
        if (!matchTitle && !matchCond && !matchCat) return false;
      }
      return true;
    });
  }, [achievements, selectedCategory, statusFilter, searchQuery]);

  // 觸發慶祝紙花
  const handleInspect = (item: InteractiveAchievement) => {
    setInspectedAchievement(item);
    if (item.unlocked) {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.6 }
      });
    }
  };

  return (
    <div className="space-y-6 select-none">
      {/* 🌟 1. 成就殿堂科技儀表板 (Scoreboard & Honor Badges Showcase) */}
      <div className="relative rounded-3xl p-5 sm:p-7 bg-gradient-to-br from-[#0c1222] via-[#090d18] to-[#05070e] border border-cyan-500/30 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl overflow-hidden">
        {/* 背景微網格光暈 */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d40a_1px,transparent_1px),linear-gradient(to_bottom,#06b6d40a_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none" />
        <div className="absolute -top-24 -right-24 w-80 h-80 rounded-full bg-cyan-500/10 blur-[100px] pointer-events-none" />

        <div className="relative z-10 space-y-6">
          {/* 上半部：解鎖進度與 AP 總積分 */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5 pb-5 border-b border-white/10">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black px-2.5 py-0.5 text-[10px] uppercase tracking-wider shadow-md">
                  HALL OF ACHIEVEMENTS
                </Badge>
                <span className="text-xs font-mono text-cyan-300/80">
                  榮譽成就殿堂總覽
                </span>
              </div>
              <h3 className="text-xl sm:text-2xl font-black font-headline text-white flex items-center gap-2">
                <span>成就評位：</span>
                <span className={cn("text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-100 to-amber-400 drop-shadow-sm", honorRank.color)}>
                  {honorRank.title}
                </span>
                <span className="text-xs font-mono font-normal text-slate-400">
                  ({userCurrentAP} / {totalPossibleAP} AP)
                </span>
              </h3>
            </div>

            {/* 進度總攬膠囊 */}
            <div className="flex items-center gap-4 bg-slate-950/70 p-3 sm:p-4 rounded-2xl border border-white/5 shrink-0">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 flex items-center justify-center">
                {/* 圓形進度 */}
                <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                  <path
                    className="text-slate-800"
                    strokeWidth="3.5"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                  <path
                    className="text-cyan-400 transition-all duration-700 ease-out"
                    strokeDasharray={`${progressPercent}, 100`}
                    strokeWidth="3.5"
                    strokeLinecap="round"
                    stroke="currentColor"
                    fill="none"
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xs sm:text-sm font-black font-mono text-white">
                    {progressPercent}%
                  </span>
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-xs text-slate-300 font-bold">
                  <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  <span>解鎖進度：</span>
                  <span className="text-cyan-300 font-mono font-black">{unlockedCount}</span>
                  <span className="text-slate-500 font-mono">/ {totalCount} 項</span>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <Star className="w-3.5 h-3.5 text-yellow-400" />
                  <span>成就積分 (AP)：</span>
                  <span className="text-yellow-300 font-mono font-black">+{userCurrentAP}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 下半部：代表勳章展示櫃 (Showcase) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BookmarkCheck className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-slate-300">
                  個人榮譽徽章展位（最多展示 3 枚代表勳章）
                </span>
              </div>
              <span className="text-[11px] text-slate-400 font-mono">
                點擊卡片可切換釘選
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[0, 1, 2].map((slotIdx) => {
                const badgeId = showcaseIds[slotIdx];
                const badge = achievements.find(a => a.id === badgeId);

                if (!badge) {
                  return (
                    <div
                      key={`empty-slot-${slotIdx}`}
                      className="p-3 rounded-2xl border-2 border-dashed border-slate-800 bg-slate-950/40 flex items-center justify-center gap-2 text-slate-600 text-xs font-bold"
                    >
                      <Pin className="w-3.5 h-3.5 opacity-50" />
                      <span>未展示勳章（點擊卡片釘選）</span>
                    </div>
                  );
                }

                const BadgeIcon = badge.icon;
                const rarityStyle = RARITY_STYLES[badge.rarity];

                return (
                  <motion.div
                    key={badge.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => handleInspect(badge)}
                    className={cn(
                      "p-3 rounded-2xl border bg-gradient-to-r from-slate-900 to-slate-950 flex items-center gap-3 cursor-pointer group transition-all duration-300 relative overflow-hidden",
                      rarityStyle.border
                    )}
                    style={{ boxShadow: `0 0 15px ${rarityStyle.glow}` }}
                  >
                    <div className={cn("p-2.5 rounded-xl border shrink-0", rarityStyle.border, rarityStyle.accentBg)}>
                      <BadgeIcon className={cn("w-5 h-5", rarityStyle.text)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-xs font-black text-white truncate">
                          {badge.title}
                        </h4>
                        <Badge className={cn("text-[9px] px-1.5 py-0 h-4 font-mono font-bold", rarityStyle.badgeBg)}>
                          +{badge.points} AP
                        </Badge>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {badge.condition}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleShowcase(badge.id);
                      }}
                      className="text-amber-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                      title="取消展示"
                    >
                      <Pin className="w-3.5 h-3.5 fill-amber-400" />
                    </button>
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ⚡ 即將達成 / 衝刺焦點 (Near Achievements Radar) */}
          {nearAchievements.length > 0 && (
            <div className="p-3.5 sm:p-4 rounded-2xl bg-cyan-950/20 border border-cyan-500/30 flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                  <Flame className="w-4 h-4" />
                </div>
                <div>
                  <span className="text-[10px] font-mono font-bold text-cyan-300 tracking-wider uppercase block">
                    SPRINT RADAR · 衝刺焦點
                  </span>
                  <span className="text-xs font-bold text-white">
                    你距離解鎖「{nearAchievements[0].title}」僅差 {(nearAchievements[0].target - nearAchievements[0].current).toLocaleString()} {nearAchievements[0].unit}！
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 self-stretch md:self-auto shrink-0">
                <div className="w-32 bg-slate-900 h-2 rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-cyan-400 transition-all duration-500"
                    style={{ width: `${Math.round(nearAchievements[0].ratio * 100)}%` }}
                  />
                </div>
                <span className="text-xs font-mono font-bold text-cyan-300">
                  {Math.round(nearAchievements[0].ratio * 100)}%
                </span>
                {nearAchievements[0].actionLink && (
                  <Link
                    href={nearAchievements[0].actionLink}
                    className="text-[11px] font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 shadow-sm"
                  >
                    <span>{nearAchievements[0].actionText || '前往衝刺'}</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 🔍 2. 互動式篩選控制工具列 */}
      <div className="space-y-3 bg-slate-950/70 p-3 sm:p-4 rounded-2xl border border-white/10">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* 搜尋欄 */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜尋成就名稱、條件或分類..."
              className="pl-9 h-9 text-xs bg-slate-900 border-slate-800 text-white placeholder:text-slate-500 rounded-xl focus:border-cyan-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 狀態快捷鈕與佈局切換 */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800">
              {[
                { key: 'all', label: '全部' },
                { key: 'unlocked', label: `已解鎖 (${unlockedCount})` },
                { key: 'near', label: '即將達成' },
                { key: 'locked', label: `未達成 (${totalCount - unlockedCount})` },
              ].map(tab => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setStatusFilter(tab.key as any)}
                  className={cn(
                    "px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer",
                    statusFilter === tab.key
                      ? "bg-cyan-500 text-slate-950 shadow-sm"
                      : "text-slate-400 hover:text-white"
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 佈局切換：勳章牆 (Grid) vs 明細進度表 (Detailed) */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setViewLayout('grid')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  viewLayout === 'grid'
                    ? "bg-slate-800 text-cyan-400 shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
                title="全像勳章牆"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewLayout('detailed')}
                className={cn(
                  "p-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer",
                  viewLayout === 'detailed'
                    ? "bg-slate-800 text-cyan-400 shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
                title="詳細進度清單"
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* 分類標籤滑動條 */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none pt-1">
          <span className="text-[11px] text-slate-500 font-bold shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" /> 分類：
          </span>
          {categories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-2.5 py-1 text-[11px] font-bold rounded-lg border transition-all shrink-0 cursor-pointer",
                selectedCategory === cat
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-[0_0_10px_rgba(6,182,212,0.2)]"
                  : "bg-slate-900/60 hover:bg-slate-800 text-slate-400 border-slate-800"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 🎴 3. 成就展示清單 (兩種佈局視圖切換) */}
      {filteredAchievements.length === 0 ? (
        <div className="py-16 text-center space-y-3 bg-slate-950/40 rounded-3xl border border-white/5">
          <Target className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-sm text-slate-400 font-bold">
            找不到符合條件的榮譽成就
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setSelectedCategory('全部');
              setStatusFilter('all');
              setSearchQuery('');
            }}
            className="text-xs border-slate-700 text-slate-300"
          >
            重設篩選條件
          </Button>
        </div>
      ) : viewLayout === 'grid' ? (
        /* 視圖 A: 全像立體立體勳章牆 (Grid) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4">
          {filteredAchievements.map((item) => {
            const Icon = item.icon;
            const rarityStyle = RARITY_STYLES[item.rarity];
            const isShowcased = showcaseIds.includes(item.id);
            const ratio = item.target > 0 ? Math.min(1, item.current / item.target) : (item.unlocked ? 1 : 0);

            return (
              <motion.div
                key={item.id}
                whileHover={{ y: -5, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleInspect(item)}
                className={cn(
                  "relative flex flex-col items-center p-4 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer overflow-hidden group select-none",
                  item.unlocked
                    ? cn(
                        "bg-gradient-to-b from-[#13192a]/95 via-[#0c101d]/95 to-[#080b14]/95 hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(6,182,212,0.3)]",
                        rarityStyle.border
                      )
                    : "bg-slate-950/70 border-white/5 opacity-60 grayscale hover:opacity-90 hover:grayscale-0 hover:border-white/20"
                )}
                style={{
                  boxShadow: item.unlocked ? `0 4px 20px ${rarityStyle.glow}` : undefined
                }}
              >
                {/* 釘選代表標記 */}
                {isShowcased && (
                  <div className="absolute top-2 right-2 text-amber-400">
                    <Pin className="w-3.5 h-3.5 fill-amber-400" />
                  </div>
                )}

                {/* 稀有度角標 */}
                <div className="absolute top-2 left-2">
                  <span className={cn("text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-full", rarityStyle.badgeBg)}>
                    {rarityStyle.label}
                  </span>
                </div>

                {/* 3D 浮雕徽章大圓盤 */}
                <div className={cn(
                  "w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center my-2 sm:my-3 transition-transform duration-300 group-hover:scale-110 border relative shadow-lg",
                  item.unlocked
                    ? cn(rarityStyle.border, rarityStyle.accentBg)
                    : "border-slate-800 bg-slate-900 text-slate-500"
                )}>
                  {item.unlocked ? (
                    <>
                      <Icon className={cn("w-7 h-7 sm:w-8 sm:h-8", rarityStyle.text)} />
                      <div className="absolute -bottom-1 -right-1">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 bg-slate-950 rounded-full" />
                      </div>
                    </>
                  ) : (
                    <>
                      <Lock className="w-6 h-6 text-slate-500 group-hover:text-slate-300 transition-colors" />
                      <div className="absolute -bottom-1 -right-1">
                        <span className="text-[9px] font-mono font-bold bg-slate-950 text-slate-400 px-1 rounded-full border border-slate-800">
                          {Math.round(ratio * 100)}%
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* 標題與簡述 */}
                <h4 className={cn(
                  "font-black text-xs sm:text-sm text-center line-clamp-1 mb-1 tracking-wide",
                  item.unlocked ? "text-white group-hover:text-cyan-300 transition-colors" : "text-slate-400"
                )}>
                  {item.title}
                </h4>

                <p className={cn(
                  "text-[10px] text-center line-clamp-2 mb-2 leading-relaxed min-h-[28px]",
                  item.unlocked ? "text-slate-400" : "text-slate-500"
                )}>
                  {item.condition}
                </p>

                {/* 底部進度條 (未達成時可見) */}
                {!item.unlocked && item.target > 0 && (
                  <div className="w-full space-y-1 my-1">
                    <div className="flex items-center justify-between text-[9px] font-mono text-slate-500">
                      <span>{item.current.toLocaleString()}</span>
                      <span>{item.target.toLocaleString()} {item.unit}</span>
                    </div>
                    <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cyan-500/80 transition-all duration-300"
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* 底部積分與分類膠囊 */}
                <div className="w-full pt-2 mt-auto border-t border-white/5 flex items-center justify-between text-[9px] font-mono">
                  <span className="text-slate-500">
                    {item.category}
                  </span>
                  <span className={cn("font-bold", item.unlocked ? rarityStyle.text : "text-slate-500")}>
                    +{item.points} AP
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* 視圖 B: 詳細進度列表 (Detailed Layout) */
        <div className="space-y-2.5">
          {filteredAchievements.map((item) => {
            const Icon = item.icon;
            const rarityStyle = RARITY_STYLES[item.rarity];
            const isShowcased = showcaseIds.includes(item.id);
            const ratio = item.target > 0 ? Math.min(1, item.current / item.target) : (item.unlocked ? 1 : 0);

            return (
              <motion.div
                key={item.id}
                whileHover={{ x: 4 }}
                onClick={() => handleInspect(item)}
                className={cn(
                  "p-3 sm:p-4 rounded-2xl border transition-all duration-300 cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group",
                  item.unlocked
                    ? cn("bg-gradient-to-r from-slate-900/90 to-slate-950/90 hover:border-cyan-400", rarityStyle.border)
                    : "bg-slate-950/60 border-white/5 opacity-60 grayscale hover:opacity-90 hover:grayscale-0 hover:border-white/20"
                )}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border",
                    item.unlocked ? cn(rarityStyle.border, rarityStyle.accentBg) : "border-slate-800 bg-slate-900"
                  )}>
                    {item.unlocked ? (
                      <Icon className={cn("w-6 h-6", rarityStyle.text)} />
                    ) : (
                      <Lock className="w-5 h-5 text-slate-500" />
                    )}
                  </div>

                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-black text-white group-hover:text-cyan-300 transition-colors truncate">
                        {item.title}
                      </h4>
                      <Badge className={cn("text-[9px] px-1.5 py-0 font-mono font-bold", rarityStyle.badgeBg)}>
                        {rarityStyle.label}
                      </Badge>
                      <Badge variant="outline" className="border-slate-800 text-slate-400 text-[9px] px-1.5 py-0 font-mono">
                        {item.category}
                      </Badge>
                      {isShowcased && (
                        <span className="text-[10px] text-amber-400 flex items-center gap-0.5">
                          <Pin className="w-3 h-3 fill-amber-400" /> 展示中
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 truncate">
                      {item.condition}
                    </p>
                  </div>
                </div>

                {/* 右側：進度數據與動作 */}
                <div className="flex items-center gap-4 sm:gap-6 justify-between sm:justify-end shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
                  <div className="w-36 space-y-1">
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-slate-400">
                        {item.current.toLocaleString()} / {item.target.toLocaleString()} {item.unit}
                      </span>
                      <span className={cn("font-bold", item.unlocked ? "text-emerald-400" : "text-cyan-300")}>
                        {Math.round(ratio * 100)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-300",
                          item.unlocked ? "bg-emerald-400" : "bg-gradient-to-r from-amber-400 to-cyan-400"
                        )}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-mono font-bold px-2 py-0.5 rounded-lg border", rarityStyle.border, rarityStyle.accentBg, rarityStyle.text)}>
                      +{item.points} AP
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* 🔮 4. 高科技全息成就檢視彈窗 (Achievement Inspector Modal) */}
      <Dialog open={!!inspectedAchievement} onOpenChange={(open) => !open && setInspectedAchievement(null)}>
        <DialogContent className="max-w-md bg-gradient-to-b from-[#0e1628] via-[#090e1a] to-[#05070d] border border-cyan-500/40 text-slate-100 p-0 overflow-hidden shadow-2xl rounded-3xl">
          {inspectedAchievement && (() => {
            const Icon = inspectedAchievement.icon;
            const rarityStyle = RARITY_STYLES[inspectedAchievement.rarity];
            const isShowcased = showcaseIds.includes(inspectedAchievement.id);
            const ratio = inspectedAchievement.target > 0 
              ? Math.min(1, inspectedAchievement.current / inspectedAchievement.target) 
              : (inspectedAchievement.unlocked ? 1 : 0);

            return (
              <div className="space-y-6">
                {/* 頂部全息背景光暈 */}
                <div 
                  className="h-32 relative flex items-center justify-center overflow-hidden border-b border-white/10"
                  style={{
                    background: `radial-gradient(circle at center, ${rarityStyle.glow} 0%, transparent 70%)`
                  }}
                >
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff0a_1px,transparent_1px),linear-gradient(to_bottom,#ffffff0a_1px,transparent_1px)] bg-[size:16px_16px]" />
                  
                  {/* 立體浮雕發光大徽章 */}
                  <motion.div
                    initial={{ scale: 0.8, rotateY: 0 }}
                    animate={{ scale: 1, rotateY: 360 }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className={cn(
                      "w-20 h-20 rounded-2xl flex items-center justify-center border-2 relative z-10 shadow-2xl backdrop-blur-xl",
                      inspectedAchievement.unlocked
                        ? cn(rarityStyle.border, rarityStyle.accentBg)
                        : "border-slate-800 bg-slate-900"
                    )}
                    style={{
                      boxShadow: `0 0 35px ${rarityStyle.glow}`
                    }}
                  >
                    {inspectedAchievement.unlocked ? (
                      <Icon className={cn("w-10 h-10", rarityStyle.text)} />
                    ) : (
                      <Lock className="w-8 h-8 text-slate-500" />
                    )}
                  </motion.div>
                </div>

                {/* 彈窗內容本體 */}
                <div className="px-6 pb-6 space-y-5">
                  <div className="text-center space-y-1.5">
                    <div className="flex items-center justify-center gap-2">
                      <Badge className={cn("text-[10px] font-mono font-bold px-2 py-0.5", rarityStyle.badgeBg)}>
                        {rarityStyle.label}成就
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-mono border-slate-700 text-slate-300">
                        {inspectedAchievement.category}
                      </Badge>
                      <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-mono font-bold">
                        +{inspectedAchievement.points} AP
                      </Badge>
                    </div>

                    <h3 className="text-xl font-black font-headline text-white tracking-wide">
                      {inspectedAchievement.title}
                    </h3>

                    <p className="text-xs text-slate-400 font-medium">
                      解鎖條件：{inspectedAchievement.condition}
                    </p>
                  </div>

                  {/* 背景故事刻銘 (Flavor Text) */}
                  <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 text-center">
                    <p className="text-xs text-slate-300 italic leading-relaxed">
                      「{inspectedAchievement.flavorText}」
                    </p>
                  </div>

                  {/* 即時進度條 */}
                  <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">當前進度</span>
                      <span className="text-white font-bold">
                        {inspectedAchievement.current.toLocaleString()} / {inspectedAchievement.target.toLocaleString()} {inspectedAchievement.unit}
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={cn(
                          "h-full transition-all duration-500",
                          inspectedAchievement.unlocked
                            ? "bg-emerald-400"
                            : "bg-gradient-to-r from-amber-400 to-cyan-400"
                        )}
                        style={{ width: `${Math.round(ratio * 100)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 font-mono">
                      <span>達成率：{Math.round(ratio * 100)}%</span>
                      {inspectedAchievement.unlocked ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 已榮譽解鎖
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold">
                          尚需 {(inspectedAchievement.target - inspectedAchievement.current).toLocaleString()} {inspectedAchievement.unit}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 彈窗底部操作按鈕 */}
                  <div className="flex items-center gap-2 pt-2">
                    {inspectedAchievement.unlocked ? (
                      <Button
                        type="button"
                        onClick={() => toggleShowcase(inspectedAchievement.id)}
                        className={cn(
                          "flex-1 h-10 rounded-xl font-bold text-xs cursor-pointer flex items-center justify-center gap-2 transition-all",
                          isShowcased
                            ? "bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500/30"
                            : "bg-slate-800 text-white hover:bg-slate-700 border border-slate-700"
                        )}
                      >
                        <Pin className={cn("w-3.5 h-3.5", isShowcased ? "fill-amber-400" : "")} />
                        <span>{isShowcased ? '取消個人展示' : '釘選至個人代表徽章'}</span>
                      </Button>
                    ) : (
                      inspectedAchievement.actionLink && (
                        <Button
                          asChild
                          className="flex-1 h-10 rounded-xl font-bold text-xs bg-cyan-400 hover:bg-cyan-300 text-slate-950 cursor-pointer shadow-lg shadow-cyan-400/20"
                        >
                          <Link href={inspectedAchievement.actionLink}>
                            <span>{inspectedAchievement.actionText || '立即前往挑戰'}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 ml-1" />
                          </Link>
                        </Button>
                      )
                    )}

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setInspectedAchievement(null)}
                      className="h-10 px-4 rounded-xl text-slate-400 hover:text-white cursor-pointer"
                    >
                      關閉
                    </Button>
                  </div>
                </div>
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
