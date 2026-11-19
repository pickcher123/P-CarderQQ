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

interface MobileNavItem {
  id: string;
  href?: string;
  label: string;
  icon: any;
  activeColor: string;
  activeBg: string;
  dotColor: string;
  flag?: string;
  isAction?: boolean;
  action?: () => void;
  badge?: string;
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
  const allNavItems: MobileNavItem[] = [
    { 
      id: 'draw',
      href: '/draw', 
      label: '抽卡', 
      icon: NavDrawIcon, 
      activeColor: "text-cyan-400", 
      activeBg: "bg-white/[0.08] border-white/10 text-white",
      dotColor: "bg-cyan-400",
      flag: 'isDrawEnabled'
    },
    { 
      id: 'bet',
      href: '/bet', 
      label: '拼卡', 
      icon: NavBetIcon, 
      activeColor: "text-rose-400", 
      activeBg: "bg-white/[0.08] border-white/10 text-white",
      dotColor: "bg-rose-400",
      flag: 'isBettingEnabled'
    },
    { 
      id: 'lucky-bags',
      href: '/lucky-bags', 
      label: '福袋', 
      icon: NavLuckyBagIcon, 
      activeColor: "text-amber-400", 
      activeBg: "bg-white/[0.08] border-white/10 text-white",
      dotColor: "bg-amber-400",
      flag: 'isLuckyBagEnabled'
    },
    { 
      id: 'group-break',
      href: '/group-break', 
      label: '團拆', 
      icon: NavGroupBreakIcon, 
      activeColor: "text-emerald-400", 
      activeBg: "bg-white/[0.08] border-white/10 text-white",
      dotColor: "bg-emerald-400",
      flag: 'isGroupBreakEnabled'
    },
    { 
      id: 'calendar',
      href: '/exhibitions', 
      label: '行事曆', 
      icon: Calendar, 
      activeColor: "text-cyan-400", 
      activeBg: "bg-white/[0.08] border-white/10 text-white",
      dotColor: "bg-cyan-400",
      flag: 'isExhibitionsEnabled'
    },
    { 
      id: 'collection',
      href: '/collection', 
      label: '收藏庫', 
      icon: NavCollectionIcon, 
      activeColor: "text-sky-300", 
      activeBg: "bg-white/[0.08] border-white/10 text-white",
      dotColor: "bg-sky-400" 
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
        {/* 懸浮導覽膠囊 - 暗黑曜石 × 香檳金 */}
        <div className={cn(
          "pointer-events-auto relative w-full rounded-full transition-[max-width] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)]",
          count <= 4 ? "max-w-[340px]" : count <= 5 ? "max-w-[400px]" : count === 6 ? "max-w-[450px]" : "max-w-[98vw]"
        )}>
          {/* 外框暗黑曜石細邊框與深層陰影（移除底部藍色發光條） */}
          <div className="relative p-[1px] rounded-full overflow-hidden bg-gradient-to-b from-amber-300/35 via-white/[0.1] to-white/[0.06] shadow-[0_14px_36px_rgba(0,0,0,0.92)]">
            {/* 內部完全純黑不透光曜石底色 */}
            <div className="relative w-full rounded-full bg-[#0a0f1c]/95 backdrop-blur-2xl p-1 sm:p-1.5 overflow-hidden">
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
                      {/* 圖示與角標 */}
                      <div className="relative flex items-center justify-center w-5 h-5 sm:w-6 sm:h-6 my-0.5">
                        <Icon className={cn(
                          "w-[18px] h-[18px] sm:w-[20px] sm:h-[20px] transition-[transform,color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)]", 
                          isActive 
                            ? cn(link.activeColor, "scale-105") 
                            : "text-slate-400 group-hover:text-slate-200"
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
                        "text-[10px] tracking-tight transition-colors duration-150 text-center leading-none whitespace-nowrap mt-0.5",
                        isActive 
                          ? "font-bold text-white" 
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
                          "relative flex flex-col items-center justify-center py-1 px-1 rounded-full transition-[transform,background-color,color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] group select-none min-h-[46px]",
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
                        "relative flex flex-col items-center justify-center py-1 px-1 rounded-full transition-[transform,background-color,color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] group select-none min-h-[46px]",
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
