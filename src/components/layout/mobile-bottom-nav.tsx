
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  NavDrawIcon, 
  NavBetIcon, 
  NavLuckyBagIcon, 
  NavGroupBreakIcon, 
  NavCollectionIcon, 
  NavVipIcon 
} from "@/components/icons";
import { cn } from "@/lib/utils";
import { useState, useEffect } from 'react';
import type { SystemConfig } from '@/types/system';

/**
 * 行動版底部導覽項目配置
 */
const navLinks = [
  { 
    href: '/draw', 
    label: '抽卡', 
    icon: NavDrawIcon, 
    activeColor: "text-cyan-400 drop-shadow-[0_0_10px_rgba(34,211,238,0.7)]", 
    activeBg: "bg-cyan-500/15 border-cyan-400/30 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.25)]",
    dotColor: "bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.9)]" 
  },
  { 
    href: '/bet', 
    label: '拼卡', 
    icon: NavBetIcon, 
    activeColor: "text-rose-400 drop-shadow-[0_0_10px_rgba(251,113,133,0.7)]", 
    activeBg: "bg-rose-500/15 border-rose-400/30 text-rose-300 shadow-[0_0_12px_rgba(244,63,94,0.25)]",
    dotColor: "bg-rose-400 shadow-[0_0_8px_rgba(251,113,133,0.9)]" 
  },
  { 
    href: '/lucky-bags', 
    label: '福袋', 
    icon: NavLuckyBagIcon, 
    activeColor: "text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.7)]", 
    activeBg: "bg-amber-500/15 border-amber-400/30 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]",
    dotColor: "bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]" 
  },
  { 
    href: '/group-break', 
    label: '團拆', 
    icon: NavGroupBreakIcon, 
    activeColor: "text-emerald-400 drop-shadow-[0_0_10px_rgba(52,211,153,0.7)]", 
    activeBg: "bg-emerald-500/15 border-emerald-400/30 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.25)]",
    dotColor: "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" 
  },
  { 
    href: '/collection', 
    label: '收藏庫', 
    icon: NavCollectionIcon, 
    activeColor: "text-sky-300 drop-shadow-[0_0_10px_rgba(125,211,252,0.7)]", 
    activeBg: "bg-sky-500/15 border-sky-400/30 text-sky-200 shadow-[0_0_12px_rgba(14,165,233,0.25)]",
    dotColor: "bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.9)]" 
  },
  { 
    href: '/vip', 
    label: 'VIP', 
    icon: NavVipIcon, 
    activeColor: "text-amber-300 drop-shadow-[0_0_12px_rgba(253,224,71,0.9)]", 
    activeBg: "bg-gradient-to-b from-amber-500/20 to-yellow-500/10 border-amber-400/40 text-amber-200 shadow-[0_0_14px_rgba(251,191,36,0.35)]",
    dotColor: "bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_10px_rgba(251,191,36,1)]",
    isVip: true 
  },
];

export function MobileBottomNav({ systemConfig }: { systemConfig?: SystemConfig | null }) {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  if (!isMounted) {
    return null;
  }

  const visibleLinks = navLinks.filter(link => {
    if (link.href === '/draw' && systemConfig?.featureFlags?.isDrawEnabled === false) return false;
    if (link.href === '/bet' && systemConfig?.featureFlags?.isBettingEnabled === false) return false;
    if (link.href === '/lucky-bags' && systemConfig?.featureFlags?.isLuckyBagEnabled === false) return false;
    if (link.href === '/group-break' && systemConfig?.featureFlags?.isGroupBreakEnabled === false) return false;
    return true;
  });

  return (
    <div className="fixed bottom-3 sm:bottom-4 left-0 right-0 z-50 md:hidden pointer-events-none px-3 sm:px-4 flex justify-center pb-[max(env(safe-area-inset-bottom),0px)]">
      {/* 橢圓懸浮膠囊導覽欄 */}
      <div className="pointer-events-auto relative w-full max-w-[420px] rounded-full bg-slate-950/85 backdrop-blur-2xl border border-white/[0.14] shadow-[0_12px_36px_rgba(0,0,0,0.85),0_0_24px_rgba(34,211,238,0.06),inset_0_1px_1px_rgba(255,255,255,0.2)] p-1.5 overflow-hidden">
        
        {/* 頂部高光光澤線條 */}
        <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/40 to-transparent pointer-events-none" />
        
        <nav
          className="grid items-center justify-between gap-1 relative z-10"
          style={{ gridTemplateColumns: `repeat(${visibleLinks.length}, minmax(0, 1fr))` }}
        >
          {visibleLinks.map((link) => {
            const isActive = (link.href === '/' && pathname === '/') || (link.href !== '/' && pathname.startsWith(link.href!));
            const Icon = link.icon;

            return (
              <Link
                key={link.href}
                href={link.href!}
                id={`nav-${link.label}`}
                className={cn(
                  "relative flex flex-col items-center justify-center py-1.5 px-1 rounded-full transition-all duration-300 active:scale-95 group select-none min-h-[48px]",
                  isActive 
                    ? cn("border", link.activeBg) 
                    : "hover:bg-white/[0.04] text-slate-400 hover:text-slate-200 border border-transparent"
                )}
              >
                {/* 作用中狀態頂部微光指示線 / 亮點 */}
                {isActive && (
                  <div 
                    className={cn(
                      "absolute top-1 left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full transition-all duration-300",
                      link.dotColor
                    )} 
                  />
                )}

                {/* 圖示 */}
                <div className="relative flex items-center justify-center w-6 h-6 my-0.5">
                  <Icon className={cn(
                    "w-[21px] h-[21px] transition-all duration-300", 
                    isActive 
                      ? cn(link.activeColor, "scale-110") 
                      : "text-slate-400 group-hover:text-slate-200 group-hover:scale-105"
                  )} />
                  {link.isVip && isActive && (
                    <div className="absolute inset-0 rounded-full bg-amber-400/20 blur-sm pointer-events-none" />
                  )}
                </div>

                {/* 標籤文字 */}
                <span className={cn(
                  "text-[10px] tracking-tight transition-all duration-200 text-center leading-none whitespace-nowrap mt-0.5",
                  isActive 
                    ? "font-black text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" 
                    : "font-semibold text-slate-400 group-hover:text-slate-200"
                )}>
                  {link.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

