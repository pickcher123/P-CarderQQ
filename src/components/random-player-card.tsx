'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck } from 'lucide-react';

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
}: RandomPlayerCardProps) {
  const isSpecial = rarity === 'rare' || rarity === 'legendary';
  const displayTitle = isSpecial ? '隨機球員 特卡' : '隨機球員 普/特 卡';

  return (
    <div
      onClick={onClick}
      className={cn(
        'relative w-full aspect-[2.5/4] rounded-xl overflow-hidden select-none cursor-pointer transition-transform duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] [@media(hover:hover)_and_(pointer:fine)]:hover:scale-[1.02] group shadow-2xl bg-[#0a0f1c]',
        className
      )}
    >
      {/* 1. PSA 鑑定殼實體底圖（讓玩家在咪卡邊緣時先看到鑑定殼與紅框標籤，充滿期待感） */}
      <img
        src="/images/psa-slab-frame.jpg"
        alt="PSA Slab"
        className="absolute inset-0 w-full h-full object-fill pointer-events-none select-none"
      />

      {/* 2. 覆蓋上方 PSA 標籤文字，改為 P+Carder 專屬編號與資訊 */}
      <div className="absolute top-[5.6%] left-[7.6%] right-[7.6%] h-[12.8%] bg-[#f7f7f7] rounded-[2px] px-2 py-1 flex flex-col justify-between pointer-events-none select-none overflow-hidden shadow-inner">
        <div className="flex items-start justify-between gap-1 leading-none text-[#111827] font-mono">
          <div className="min-w-0">
            <div className="text-[7px] sm:text-[8px] font-black tracking-tight truncate">
              2026 P+CARDER SERIES
            </div>
            <div className="text-[7px] sm:text-[8px] font-bold tracking-tight truncate mt-0.5">
              {isSpecial ? 'SPECIAL EDITION' : 'MYSTERY PLAYER'}
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[7px] sm:text-[8px] font-black">#PC-001</div>
            <div className="text-[7px] sm:text-[8px] font-black mt-0.5">
              {isSpecial ? 'GEM MT 10' : 'MINT 9'}
            </div>
          </div>
        </div>

        <div className="flex items-end justify-between gap-1 leading-none">
          {/* 迷你條碼 */}
          <div className="flex items-end gap-[1px] h-2.5 opacity-85">
            <span className="w-[1px] h-full bg-black" />
            <span className="w-[2px] h-full bg-black" />
            <span className="w-[1px] h-full bg-black" />
            <span className="w-[1.5px] h-full bg-black" />
            <span className="w-[1px] h-full bg-black" />
            <span className="w-[2px] h-full bg-black" />
            <span className="w-[1px] h-full bg-black" />
            <span className="w-[1px] h-full bg-black" />
            <span className="w-[2px] h-full bg-black" />
            <span className="w-[1px] h-full bg-black" />
          </div>

          {/* 中央 PSA 認證標記 */}
          <span className="px-1.5 py-[1px] rounded-[2px] bg-slate-300/90 text-[#1d4ed8] font-black text-[7px] sm:text-[8px] tracking-wider shadow-xs">
            PSA
          </span>

          {/* P+Carder 專屬編號 */}
          <span className="text-[7px] sm:text-[8px] font-mono font-black text-[#111827] tracking-tight tabular-nums">
            PC2026888
          </span>
        </div>
      </div>

      {/* 3. 中間卡窗：替換為「隨機球員 普/特 卡」暗黑曜石 × 香檳金卡面 */}
      <div
        className={cn(
          'absolute top-[25.2%] left-[11.2%] right-[11.2%] bottom-[6.8%] rounded-md overflow-hidden flex flex-col justify-between p-2.5 sm:p-3 border shadow-inner',
          isSpecial
            ? 'bg-gradient-to-br from-[#1a1406] via-[#0a0f1c] to-[#140f04] border-amber-300/55'
            : 'bg-gradient-to-br from-[#0e1526] via-[#0a0f1c] to-[#060912] border-amber-300/35'
        )}
      >
        {/* 柔和香檳金背景光暈 */}
        <div
          className={cn(
            'absolute -inset-8 rounded-full blur-2xl opacity-25 group-hover:opacity-40 transition-opacity pointer-events-none',
            isSpecial ? 'bg-amber-400' : 'bg-amber-300/60'
          )}
        />

        {/* 卡面頂部標籤 */}
        <div className="relative z-10 flex items-center justify-between w-full">
          <span
            className={cn(
              'text-[8px] sm:text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded border',
              isSpecial
                ? 'bg-amber-400/20 text-[#FDE68A] border-amber-300/45'
                : 'bg-white/[0.06] text-[#FDE68A] border-white/15'
            )}
          >
            {isSpecial ? '特卡' : '普/特卡'}
          </span>
          <PPlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#FDE68A]" />
        </div>

        {/* 中央主視覺與標題 */}
        <div className="relative z-10 my-auto flex flex-col items-center justify-center text-center px-1">
          <div className="relative mb-1.5 flex items-center justify-center">
            <div className="absolute inset-0 blur-lg opacity-50 bg-amber-400" />
            <PPlusIcon className="w-8 h-8 sm:w-10 sm:h-10 relative z-10 text-[#FDE68A] drop-shadow-[0_0_10px_rgba(253,230,138,0.5)]" />
          </div>
          <h3 className="font-headline font-black text-[11px] sm:text-xs md:text-sm tracking-tight leading-snug text-[#FDE68A] drop-shadow">
            {displayTitle}
          </h3>
          <span className="text-[8px] sm:text-[9px] text-slate-400 font-bold tracking-widest mt-0.5 uppercase">
            球員限定盲卡
          </span>
        </div>

        {/* 卡面底部認證 */}
        <div className="relative z-10 flex items-center justify-between w-full pt-1 border-t border-white/[0.08] text-[8px]">
          <span className="font-bold text-slate-400 flex items-center gap-0.5">
            <ShieldCheck className="w-2.5 h-2.5 text-amber-300" />
            <span>正版認證</span>
          </span>
          <span className="text-[7px] text-amber-200/75 font-mono tracking-widest uppercase">
            P+ CARDER
          </span>
        </div>
      </div>

      {/* Stack Count Badge (if count > 1) */}
      {count > 1 && (
        <div className="absolute top-2 right-2 z-20">
          <Badge className="bg-gradient-to-r from-[#FDE68A] to-amber-400 text-[#120d02] font-black text-xs sm:text-sm px-2.5 py-0.5 rounded-full shadow-lg border border-amber-200/70">
            x{count}
          </Badge>
        </div>
      )}
    </div>
  );
}
