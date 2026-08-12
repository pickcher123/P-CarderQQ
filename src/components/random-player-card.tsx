'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Sparkles, RefreshCw } from 'lucide-react';

interface RandomPlayerCardProps {
  rarity?: 'common' | 'rare' | 'legendary' | string;
  count?: number;
  className?: string;
  onClick?: () => void;
  showBuybackHint?: boolean;
  points?: number;
  title?: string;
}

export function RandomPlayerCard({
  rarity = 'common',
  count = 1,
  className,
  onClick,
  showBuybackHint = true,
  points,
  title
}: RandomPlayerCardProps) {
  const isSpecial = rarity === 'rare' || rarity === 'legendary';
  const titleText = title || '隨機球員 普/特 卡';

  return (
    <div
      onClick={onClick}
      className={cn(
        "relative w-full aspect-[2.5/3.5] rounded-2xl overflow-hidden flex flex-col justify-between p-2.5 sm:p-3 select-none cursor-pointer transition-all duration-300 hover:scale-[1.03] group shadow-2xl border-2",
        isSpecial
          ? "bg-gradient-to-br from-amber-950/90 via-slate-900 to-amber-900/70 border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.3)]"
          : "bg-gradient-to-br from-slate-900 via-slate-950 to-blue-950/80 border-cyan-500/50 shadow-[0_0_20px_rgba(6,182,212,0.25)]",
        className
      )}
    >
      {/* Background ambient glow effect */}
      <div
        className={cn(
          "absolute -inset-10 rounded-full blur-2xl opacity-25 group-hover:opacity-40 transition-opacity pointer-events-none",
          isSpecial ? "bg-amber-500" : "bg-cyan-500"
        )}
      />

      {/* Grid line texture overlay */}
      <div className="absolute inset-0 bg-[repeating-linear-gradient(0deg,transparent,transparent_2px,#fff_2px,#fff_4px)] opacity-5 pointer-events-none" />

      {/* Card Header: Category & PPlus logo */}
      <div className="relative z-10 flex items-center justify-between w-full">
        <Badge
          variant="outline"
          className={cn(
            "text-[9px] sm:text-[10px] font-black italic tracking-widest px-2 py-0.5 border-none rounded-md",
            isSpecial ? "bg-amber-500/20 text-amber-400" : "bg-cyan-500/20 text-cyan-400"
          )}
        >
          {isSpecial ? '特卡' : '普/特卡'}
        </Badge>
        <div className="flex items-center gap-1">
          <PPlusIcon className={cn("w-4 h-4 sm:w-5 sm:h-5", isSpecial ? "text-amber-400" : "text-cyan-400")} />
        </div>
      </div>

      {/* Card Center: Main Icon & Title */}
      <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center px-1 py-1">
        <div className="relative mb-1.5 flex flex-col items-center justify-center">
          <div
            className={cn(
              "absolute inset-0 blur-lg opacity-60",
              isSpecial ? "bg-amber-500" : "bg-cyan-400"
            )}
          />
          <PPlusIcon className={cn("w-10 h-10 sm:w-12 sm:h-12 relative z-10 drop-shadow-[0_0_12px_rgba(34,211,238,0.7)]", isSpecial ? "text-amber-300" : "text-cyan-300")} />
        </div>
        <h3
          className={cn(
            "font-headline font-black text-xs sm:text-sm md:text-base tracking-tight drop-shadow-md leading-snug",
            isSpecial
              ? "bg-gradient-to-r from-amber-200 via-amber-400 to-yellow-100 bg-clip-text text-transparent"
              : "bg-gradient-to-r from-cyan-100 via-white to-sky-300 bg-clip-text text-transparent"
          )}
        >
          {titleText}
        </h3>
        <span className="text-[9px] sm:text-[10px] text-cyan-300/80 font-bold uppercase tracking-widest mt-0.5">
          {points ? `${points} P+ 點數` : '隨機球員卡'}
        </span>
      </div>

      {/* Card Footer: Buy Back value indicator */}
      <div className="relative z-10 flex items-center justify-between w-full pt-1 border-t border-white/10">
        {showBuybackHint && (
          <div className="flex items-center gap-1 text-[9px] sm:text-[10px] font-black text-amber-400/90">
            <RefreshCw className="w-3 h-3" />
            <span>{points ? `可獲 ${points}P` : '可兌換 300P'}</span>
          </div>
        )}
        <span className="text-[8px] text-slate-500 font-code tracking-widest uppercase ml-auto">
          P+ 隨機賞
        </span>
      </div>

      {/* Stack Count Badge (if count > 1) */}
      {count > 1 && (
        <div className="absolute top-2 right-2 z-20">
          <Badge className="bg-gradient-to-r from-amber-500 to-yellow-600 text-slate-950 font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.6)] border-2 border-white/20 animate-pulse">
            x{count}
          </Badge>
        </div>
      )}
    </div>
  );
}
