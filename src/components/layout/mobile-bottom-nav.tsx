
'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, Library, Users2, Crown } from 'lucide-react';
import { CrossedCardsIcon, LuckyBagIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useState, useEffect } from 'react';
import type { SystemConfig } from '@/types/system';

/**
 * 行動版底部導覽順序：抽卡 → 拚卡 → 福袋 → 團拆 → 收藏 → VIP
 */
const navLinks = [
  { href: '/draw', label: '抽卡', icon: Package, color: "text-primary" },
  { href: '/bet', label: '拼卡', icon: CrossedCardsIcon, color: "text-destructive" },
  { href: '/lucky-bags', label: '福袋', icon: LuckyBagIcon, color: "text-accent" },
  { href: '/group-break', label: '團拆', icon: Users2, color: "text-green-400" },
  { href: '/collection', label: '收藏', icon: Library, color: "text-primary/70" },
  { href: '/vip', label: 'VIP', icon: Crown, color: "text-accent", isVip: true },
];

export function MobileBottomNav({ systemConfig }: { systemConfig: SystemConfig | null }) {
  const pathname = usePathname();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  
  if (!isMounted) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border/40 bg-background/95 backdrop-blur-sm md:hidden">
      <nav
        className="container grid h-16 items-center justify-between px-1"
        style={{ gridTemplateColumns: `repeat(${navLinks.length}, minmax(0, 1fr))` }}
      >
        {navLinks.map((link) => {
          const isActive = (link.href === '/' && pathname === '/') || (link.href !== '/' && pathname.startsWith(link.href!));
          const Icon = link.icon;

          return (
            <Link
              key={link.href}
              href={link.href!}
              className={cn(
                "flex flex-col items-center justify-center gap-1 text-[10px] font-bold transition-all duration-300 active:scale-95",
                isActive ? "text-foreground" : "text-muted-foreground opacity-70"
              )}
            >
              <Icon className={cn(
                "h-5 w-5 transition-all duration-300", 
                isActive ? cn(link.color, "scale-110") : "text-muted-foreground",
                link.isVip && isActive && "fill-accent/10 drop-shadow-[0_0_5px_rgba(234,179,8,0.4)]"
              )} />
              
              {/* 高亮細線 indicator */}
              {isActive && (
                <div className={cn(
                    "absolute -top-[1px] left-1/2 -translate-x-1/2 w-4 h-[2px] rounded-full transition-all duration-300",
                    link.isVip ? "bg-gradient-to-r from-amber-300 to-accent shadow-[0_0_8px_rgba(234,179,8,0.5)]" : "bg-current"
                )} />
              )}

              <span className={cn(
                "truncate w-full text-center transition-all duration-300",
                isActive && "font-black"
              )}>
                {link.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
