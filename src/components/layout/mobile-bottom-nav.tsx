'use client';

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  NavDrawIcon, 
  NavBetIcon, 
  NavLuckyBagIcon, 
  NavGroupBreakIcon, 
  NavCollectionIcon 
} from "@/components/icons";
import { Trophy, Calendar, Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SystemConfig } from '@/types/system';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { PromoRedeemModal } from '@/components/events/PromoRedeemModal';
import { useToast } from '@/hooks/use-toast';

interface MobileBottomNavProps {
  systemConfig?: SystemConfig | null;
}

export function MobileBottomNav({ systemConfig }: MobileBottomNavProps) {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);
  const [isPromoModalOpen, setIsPromoModalOpen] = useState(false);
  const { toast } = useToast();
  const { isFeatureEnabled } = useFeatureFlags(systemConfig);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  if (!isMounted) {
    return null;
  }

  // 行動版所有可選區域導覽項目
  const allNavItems = [
    { 
      id: 'draw',
      href: '/draw', 
      label: '抽卡', 
      icon: NavDrawIcon, 
      activeColor: "text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.7)]", 
      activeBg: "bg-cyan-500/15 border-cyan-400/30 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]",
      dotColor: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]",
      flag: 'isDrawEnabled'
    },
    { 
      id: 'bet',
      href: '/bet', 
      label: '拼卡', 
      icon: NavBetIcon, 
      activeColor: "text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.7)]", 
      activeBg: "bg-rose-500/15 border-rose-400/30 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.25)]",
      dotColor: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]",
      flag: 'isBettingEnabled'
    },
    { 
      id: 'lucky-bags',
      href: '/lucky-bags', 
      label: '福袋', 
      icon: NavLuckyBagIcon, 
      activeColor: "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]", 
      activeBg: "bg-amber-500/15 border-amber-400/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]",
      dotColor: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]",
      flag: 'isLuckyBagEnabled'
    },
    { 
      id: 'group-break',
      href: '/group-break', 
      label: '團拆', 
      icon: NavGroupBreakIcon, 
      activeColor: "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]", 
      activeBg: "bg-emerald-500/15 border-emerald-400/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]",
      dotColor: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]",
      flag: 'isGroupBreakEnabled'
    },
    { 
      id: 'predictions',
      href: '/predictions', 
      label: '預測', 
      icon: Trophy, 
      activeColor: "text-yellow-400 drop-shadow-[0_0_10px_rgba(250,204,21,0.7)]", 
      activeBg: "bg-yellow-500/15 border-yellow-400/30 text-yellow-300 shadow-[0_0_12px_rgba(234,179,8,0.25)]",
      dotColor: "bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.9)]",
      flag: 'isPredictionsEnabled'
    },
    { 
      id: 'exhibitions',
      href: '/exhibitions', 
      label: '卡展', 
      icon: Calendar, 
      activeColor: "text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.7)]", 
      activeBg: "bg-cyan-500/15 border-cyan-400/30 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]",
      dotColor: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]",
      flag: 'isExhibitionsEnabled'
    },
    { 
      id: 'collection',
      href: '/collection', 
      label: '收藏庫', 
      icon: NavCollectionIcon, 
      activeColor: "text-sky-300 drop-shadow-[0_0_10px_rgba(125,211,252,0.7)]", 
      activeBg: "bg-sky-500/15 border-sky-400/30 text-sky-200 shadow-[0_0_12px_rgba(14,165,233,0.25)]",
      dotColor: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" 
    },
  ];

  // 根據管理員後台開放區域多寡動態過濾項目（利用本地快取保證重新整理時 0ms 響應，絕不閃爍）
  const visibleLinks = allNavItems.filter(link => {
    if (link.flag && !isFeatureEnabled(link.flag)) {
      return false;
    }
    return true;
  });

  const count = visibleLinks.length;
  // 當項目多於 6 個時，啟用水平平滑滾動，否則等寬均分排列
  const isScrollable = count >= 7;

  return (
    <>
      <div className="fixed bottom-2.5 sm:bottom-4 left-0 right-0 z-50 md:hidden pointer-events-none px-2 sm:px-3 flex justify-center pb-[max(env(safe-area-inset-bottom),0px)]">
        {/* 懸浮導覽膠囊 - 尺寸隨開放項目數量自動動態調適 */}
        <div className={cn(
          "pointer-events-auto relative w-full rounded-full bg-slate-950/90 backdrop-blur-2xl border border-white/[0.14] shadow-[0_12px_36px_rgba(0,0,0,0.9),0_0_24px_rgba(34,211,238,0.06),inset_0_1px_1px_rgba(255,255,255,0.2)] p-1 sm:p-1.5 overflow-hidden transition-all duration-300",
          count <= 4 ? "max-w-[340px]" : count <= 5 ? "max-w-[400px]" : count === 6 ? "max-w-[450px]" : "max-w-[98vw]"
        )}>
          
          {/* 頂部微光流線 */}
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none" />
          
          <nav
            className={cn(
              "items-center relative z-10",
              isScrollable 
                ? "flex overflow-x-auto no-scrollbar scroll-smooth gap-0.5 px-0.5 justify-start snap-x"
                : "grid justify-between gap-0.5"
            )}
            style={!isScrollable ? { gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` } : undefined}
          >
            {visibleLinks.map((link) => {
              const isAction = link.isAction;
              const isActive = !isAction && (
                (link.href === '/' && pathname === '/') || 
                (link.href !== '/' && pathname.startsWith(link.href!))
              );
              const Icon = link.icon;

              const innerContent = (
                <>
                  {/* 作用中狀態頂部微光指示線 */}
                  {isActive && (
                    <div 
                      className={cn(
                        "absolute top-1 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full transition-all duration-300",
                        link.dotColor
                      )} 
                    />
                  )}

                  {/* 圖示與角標 */}
                  <div className="relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 my-0.5">
                    <Icon className={cn(
                      "w-[18px] h-[18px] sm:w-[20px] sm:h-[20px] transition-all duration-300", 
                      isActive 
                        ? cn(link.activeColor, "scale-110") 
                        : "text-slate-400 group-hover:text-slate-200 group-hover:scale-105"
                    )} />

                    {/* 角標 (例如領券的「送」) */}
                    {link.badge && (
                      <span className="absolute -top-1.5 -right-2 bg-pink-500 text-white font-black text-[8px] leading-none px-1 py-0.5 rounded-full shadow-[0_0_6px_rgba(236,72,153,0.8)] animate-pulse">
                        {link.badge}
                      </span>
                    )}
                  </div>

                  {/* 標籤文字：禁止折行，保證排版簡潔 */}
                  <span className={cn(
                    "text-[10px] tracking-tight transition-all duration-200 text-center leading-none whitespace-nowrap mt-0.5",
                    isActive 
                      ? "font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" 
                      : "font-medium text-slate-400 group-hover:text-slate-200"
                  )}>
                    {link.label}
                  </span>
                </>
              );

              if (isAction) {
                return (
                  <button
                    key={link.id}
                    type="button"
                    onClick={() => setIsPromoModalOpen(true)}
                    id={`mobile-nav-${link.id}`}
                    className={cn(
                      "relative flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 group select-none min-h-[46px]",
                      isScrollable ? "flex-1 min-w-[48px] snap-center" : "",
                      "hover:bg-white/[0.04] text-slate-400 hover:text-pink-300 border border-transparent"
                    )}
                  >
                    {innerContent}
                  </button>
                );
              }

              return (
                <Link
                  key={link.id}
                  href={link.href!}
                  id={`mobile-nav-${link.id}`}
                  className={cn(
                    "relative flex flex-col items-center justify-center py-1 px-1 rounded-full transition-all duration-200 active:scale-95 group select-none min-h-[46px]",
                    isScrollable ? "flex-1 min-w-[48px] snap-center" : "",
                    isActive 
                      ? cn("border", link.activeBg) 
                      : "hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 border border-transparent"
                  )}
                >
                  {innerContent}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      {/* 🎁 手機版底部導覽列點擊領券時開啟的兌換彈窗 */}
      <PromoRedeemModal
        open={isPromoModalOpen}
        onOpenChange={setIsPromoModalOpen}
        onApplyReward={(targetEvent, freePlays) => {
          toast({
            title: '🎉 兌換成功！',
            description: `已成功兌換 ${freePlays} 次免費試玩機會！`,
          });
        }}
      />
    </>
  );
}
