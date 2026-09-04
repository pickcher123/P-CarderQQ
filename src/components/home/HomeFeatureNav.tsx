'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Package, 
  Trophy, 
  Calendar, 
  Gift, 
  Library, 
  Users2
} from 'lucide-react';
import { CrossedCardsIcon, LuckyBagIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import type { SystemConfig } from '@/types/system';
import { useFeatureFlags } from '@/hooks/use-feature-flags';

interface HomeFeatureNavProps {
  systemConfig?: SystemConfig | null;
  onOpenPromoModal: () => void;
}

export function HomeFeatureNav({ systemConfig, onOpenPromoModal }: HomeFeatureNavProps) {
  const { isFeatureEnabled } = useFeatureFlags(systemConfig);

  const allNavItems = [
    {
      id: 'draw',
      label: '抽卡專區',
      shortLabel: '抽卡',
      desc: '次世代數位撕卡',
      href: '/draw',
      icon: Package,
      badge: 'HOT',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      colorClass: 'text-cyan-400 group-hover:text-cyan-300',
      bgGlow: 'group-hover:bg-cyan-500/10 group-hover:border-cyan-500/40',
      iconBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      flag: 'isDrawEnabled'
    },
    {
      id: 'bet',
      label: '即時拼卡',
      shortLabel: '拼卡',
      desc: '選號公平對決',
      href: '/bet',
      icon: CrossedCardsIcon,
      badge: '對決',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      colorClass: 'text-rose-400 group-hover:text-rose-300',
      bgGlow: 'group-hover:bg-rose-500/10 group-hover:border-rose-500/40',
      iconBg: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
      flag: 'isBettingEnabled'
    },
    {
      id: 'lucky-bags',
      label: '幸運福袋',
      shortLabel: '福袋',
      desc: '高爆率必中大獎',
      href: '/lucky-bags',
      icon: LuckyBagIcon,
      badge: '必中',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      colorClass: 'text-amber-400 group-hover:text-amber-300',
      bgGlow: 'group-hover:bg-amber-500/10 group-hover:border-amber-500/40',
      iconBg: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
      flag: 'isLuckyBagEnabled'
    },
    {
      id: 'group-break',
      label: '直播團拆',
      shortLabel: '團拆',
      desc: '全網共拆頂盒',
      href: '/group-break',
      icon: Users2,
      badge: '直播',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      colorClass: 'text-emerald-400 group-hover:text-emerald-300',
      bgGlow: 'group-hover:bg-emerald-500/10 group-hover:border-emerald-500/40',
      iconBg: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
      flag: 'isGroupBreakEnabled'
    },
    {
      id: 'predictions',
      label: '賽事預測',
      shortLabel: '預測',
      desc: '迎戰勝率贏P+點',
      href: '/predictions',
      icon: Trophy,
      badge: '贏P+',
      badgeClass: 'bg-yellow-500/25 text-yellow-300 border-yellow-500/40 shadow-xs',
      colorClass: 'text-yellow-400 group-hover:text-yellow-300',
      bgGlow: 'group-hover:bg-yellow-500/10 group-hover:border-yellow-500/40',
      iconBg: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
      flag: 'isPredictionsEnabled'
    },
    {
      id: 'exhibitions',
      label: '卡展行事曆',
      shortLabel: '卡展',
      desc: '全台線下展訊',
      href: '/exhibitions',
      icon: Calendar,
      badge: '展訊',
      badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      colorClass: 'text-cyan-400 group-hover:text-cyan-300',
      bgGlow: 'group-hover:bg-cyan-500/10 group-hover:border-cyan-500/40',
      iconBg: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
      flag: 'isExhibitionsEnabled'
    },
    {
      id: 'free-tickets',
      label: '免費領券',
      shortLabel: '領券',
      desc: '輸入序號送抽卡',
      isAction: true,
      onClick: onOpenPromoModal,
      icon: Gift,
      badge: '送券',
      badgeClass: 'bg-pink-500/25 text-pink-300 border-pink-500/40 shadow-[0_0_8px_rgba(236,72,153,0.35)] animate-pulse',
      colorClass: 'text-pink-400 group-hover:text-pink-300',
      bgGlow: 'group-hover:bg-pink-500/10 group-hover:border-pink-500/40',
      iconBg: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
    },
    {
      id: 'collection',
      label: '個人收藏庫',
      shortLabel: '收藏',
      desc: '實體卡片全覽',
      href: '/collection',
      icon: Library,
      badge: '我的',
      badgeClass: 'bg-sky-500/20 text-sky-300 border-sky-500/30',
      colorClass: 'text-sky-300 group-hover:text-sky-200',
      bgGlow: 'group-hover:bg-sky-500/10 group-hover:border-sky-500/40',
      iconBg: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
    },
  ];

  // 即時過濾關閉的區域，透過 useFeatureFlags 的本地快取達成 0ms 無閃爍
  const visibleItems = allNavItems.filter(item => {
    if (item.flag && !isFeatureEnabled(item.flag)) {
      return false;
    }
    return true;
  });

  return (
    <section className="container px-3 sm:px-4 max-w-7xl mx-auto -mt-6 sm:-mt-8 mb-8 sm:mb-12 relative z-20">
      {/* 外層頂級微光懸浮導覽橫條 */}
      <div className="relative rounded-2xl sm:rounded-3xl bg-gradient-to-r from-slate-900/95 via-slate-950/95 to-slate-900/95 border border-white/10 backdrop-blur-2xl shadow-[0_12px_40px_rgba(0,0,0,0.7),0_0_30px_rgba(245,158,11,0.06)] p-2 sm:p-2.5 overflow-hidden ring-1 ring-white/5">
        
        {/* 背景氛圍流光 */}
        <div className="absolute top-0 left-1/4 w-72 h-16 bg-cyan-500/10 blur-3xl pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-72 h-16 bg-amber-500/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 inset-x-12 h-px bg-gradient-to-r from-transparent via-amber-400/25 to-transparent pointer-events-none" />

        {/* ========================================================================= */}
        {/* 電腦版主頁橫條 (md:grid)：一字排開，高質感互動反饋 */}
        {/* ========================================================================= */}
        <div 
          className="hidden md:grid gap-2 items-stretch"
          style={{ gridTemplateColumns: `repeat(${visibleItems.length}, minmax(0, 1fr))` }}
        >
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const cardBody = (
              <div
                className={cn(
                  "relative h-full flex flex-col items-center justify-center p-3 rounded-2xl border border-white/[0.06] bg-slate-900/65 transition-all duration-300 group cursor-pointer overflow-hidden select-none",
                  item.bgGlow,
                  "hover:scale-[1.03] active:scale-[0.98] shadow-sm hover:shadow-lg"
                )}
              >
                {/* 右上角特色標籤 */}
                {item.badge && (
                  <span className={cn(
                    "absolute top-2 right-2 text-[9px] font-black px-1.5 py-0.5 rounded-full border leading-none tracking-tight",
                    item.badgeClass
                  )}>
                    {item.badge}
                  </span>
                )}

                {/* 圖示容器 */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center border mb-2 transition-transform duration-300 group-hover:scale-110 shadow-xs",
                  item.iconBg
                )}>
                  <Icon className="w-5 h-5" />
                </div>

                {/* 標題與簡介 */}
                <div className="text-center space-y-0.5">
                  <h3 className={cn("text-xs font-black tracking-wide text-white transition-colors", item.colorClass)}>
                    {item.label}
                  </h3>
                  <p className="text-[10px] text-slate-400 group-hover:text-slate-300 transition-colors font-medium">
                    {item.desc}
                  </p>
                </div>
              </div>
            );

            if (item.isAction) {
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  type="button"
                  id={`home-nav-item-${item.id}`}
                  className="w-full text-left"
                >
                  {cardBody}
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href!}
                id={`home-nav-item-${item.id}`}
                className="w-full"
              >
                {cardBody}
              </Link>
            );
          })}
        </div>

        {/* ========================================================================= */}
        {/* 手機版主頁橫條 (md:hidden)：平滑橫向滑動卡片膠囊，文字圖示清晰不被擠壓 */}
        {/* ========================================================================= */}
        <div className="md:hidden flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth py-1 px-1 snap-x snap-mandatory">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const mobileCard = (
              <div
                className={cn(
                  "relative flex-shrink-0 snap-start flex items-center gap-2.5 py-2.5 px-3 rounded-xl border border-white/[0.08] bg-slate-900/80 active:scale-95 transition-all group min-w-[124px]",
                  item.bgGlow
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center border shrink-0",
                  item.iconBg
                )}>
                  <Icon className="w-4 h-4" />
                </div>

                <div className="flex flex-col text-left">
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-black text-white whitespace-nowrap">
                      {item.label}
                    </span>
                    {item.badge && (
                      <span className={cn(
                        "text-[8px] font-black px-1 py-0.2 rounded-full border leading-none shrink-0",
                        item.badgeClass
                      )}>
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 whitespace-nowrap">
                    {item.desc}
                  </span>
                </div>
              </div>
            );

            if (item.isAction) {
              return (
                <button
                  key={item.id}
                  onClick={item.onClick}
                  type="button"
                  id={`mobile-home-nav-item-${item.id}`}
                  className="shrink-0"
                >
                  {mobileCard}
                </button>
              );
            }

            return (
              <Link
                key={item.id}
                href={item.href!}
                id={`mobile-home-nav-item-${item.id}`}
                className="shrink-0"
              >
                {mobileCard}
              </Link>
            );
          })}
        </div>

      </div>
    </section>
  );
}
