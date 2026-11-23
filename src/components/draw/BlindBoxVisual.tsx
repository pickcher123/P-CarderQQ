'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import type { HybridTierCode } from '@/types/draw';
import { Sparkles, Crown, Lock } from 'lucide-react';

interface BlindBoxVisualProps {
  tier: HybridTierCode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  isOpened?: boolean;
  isOpening?: boolean;
  className?: string;
}

const PACK_THEMES: Record<
  HybridTierCode,
  {
    code: string;
    label: string;
    sublabel: string;
    bodyGrad: string;
    border: string;
    sealGrad: string;
    glow: string;
    text: string;
  }
> = {
  A: {
    code: 'A',
    label: 'A 賞',
    sublabel: 'GOLD PACK',
    bodyGrad: 'from-[#161209] via-[#0e0b06] to-[#07090f]',
    border: 'border-[#FDE68A]/75',
    sealGrad: 'from-amber-200/70 via-amber-400/70 to-amber-600/70',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.28)]',
    text: 'text-[#FDE68A]',
  },
  SP: {
    code: 'SP',
    label: 'SP',
    sublabel: 'GOD PACK',
    bodyGrad: 'from-[#0d0f1a] via-[#07080f] to-[#030408]',
    border: 'border-amber-300/70',
    sealGrad: 'from-purple-400/60 via-amber-300/70 to-amber-500/60',
    glow: 'shadow-[0_0_24px_rgba(168,85,247,0.28)]',
    text: 'text-[#FDE68A]',
  },
  B: {
    code: 'B',
    label: 'B 賞',
    sublabel: 'SILVER PACK',
    bodyGrad: 'from-[#161d2c] via-[#0e1420] to-[#080c15]',
    border: 'border-slate-300/75',
    sealGrad: 'from-white/60 via-slate-300/60 to-slate-500/60',
    glow: 'shadow-[0_0_18px_rgba(226,232,240,0.24)]',
    text: 'text-slate-100',
  },
  C: {
    code: 'C',
    label: 'C 賞',
    sublabel: 'BRONZE PACK',
    bodyGrad: 'from-[#17100b] via-[#100b08] to-[#080605]',
    border: 'border-amber-600/75',
    sealGrad: 'from-amber-400/55 via-amber-600/60 to-amber-800/60',
    glow: 'shadow-[0_0_16px_rgba(217,119,6,0.24)]',
    text: 'text-amber-200',
  },
  D: {
    code: 'D',
    label: 'D 賞',
    sublabel: 'STAR PACK',
    bodyGrad: 'from-[#141926] via-[#0d111b] to-[#080b12]',
    border: 'border-white/75',
    sealGrad: 'from-white/75 via-slate-200/70 to-slate-400/60',
    glow: 'shadow-[0_0_14px_rgba(255,255,255,0.2)]',
    text: 'text-white',
  },
  LAST: {
    code: 'LAST',
    label: 'LAST',
    sublabel: 'LAST ONE',
    bodyGrad: 'from-[#1a1109] via-[#100b10] to-[#07070c]',
    border: 'border-amber-300/85',
    sealGrad: 'from-[#FDE68A]/80 via-amber-400/80 to-rose-500/70',
    glow: 'shadow-[0_0_24px_rgba(245,158,11,0.35)]',
    text: 'text-[#FDE68A]',
  },
};

const SIZE_CLASSES: Record<NonNullable<BlindBoxVisualProps['size']>, string> = {
  xs: 'w-7 h-9',
  sm: 'w-12 h-16',
  md: 'w-20 h-28',
  lg: 'w-32 h-44 sm:w-36 sm:h-52',
};

export function BlindBoxVisual({
  tier,
  size = 'md',
  className,
}: BlindBoxVisualProps) {
  const theme = PACK_THEMES[tier] || PACK_THEMES.D;
  const isXs = size === 'xs';
  const isCompact = size === 'xs' || size === 'sm';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center select-none shrink-0',
        SIZE_CLASSES[size],
        className
      )}
    >
      {/* 五色卡包極簡暗黑鋁箔外觀 */}
      <div
        className={cn(
          'relative w-full h-full rounded-lg border bg-gradient-to-b overflow-hidden flex flex-col items-center justify-between',
          !isXs && 'rounded-xl',
          theme.bodyGrad,
          theme.border,
          theme.glow
        )}
      >
        {/* 頂部細金屬封條 */}
        <div className={cn('w-full h-[12%] bg-gradient-to-r opacity-90 border-b border-black/25 shrink-0', theme.sealGrad)} />

        {/* 中央卡包徽記（單行不換行、置中對齊） */}
        <div className="relative z-10 flex flex-col items-center justify-center my-auto px-1">
          {isXs ? (
            <span className={cn('font-black leading-none whitespace-nowrap tracking-tight text-[11px]', theme.text)}>
              {theme.code}
            </span>
          ) : (
            <div
              className={cn(
                'flex flex-col items-center justify-center rounded-lg border border-white/15 bg-black/35 whitespace-nowrap',
                isCompact ? 'px-1.5 py-0.5' : 'px-2.5 py-1.5'
              )}
            >
              {tier === 'SP' ? (
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Lock className={cn(isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5', 'text-[#FDE68A] shrink-0')} />
                  <span className={cn('font-black tracking-wider leading-none', isCompact ? 'text-[10px]' : 'text-xs', theme.text)}>
                    SP
                  </span>
                </div>
              ) : tier === 'LAST' ? (
                <div className="flex items-center gap-1 whitespace-nowrap">
                  <Crown className={cn(isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5', 'text-[#FDE68A] shrink-0')} />
                  <span className={cn('font-black tracking-wider leading-none', isCompact ? 'text-[9px]' : 'text-[11px]', theme.text)}>
                    LAST
                  </span>
                </div>
              ) : (
                <span
                  className={cn(
                    'font-black tracking-tight leading-none whitespace-nowrap',
                    isCompact ? 'text-[10px]' : 'text-sm',
                    theme.text
                  )}
                >
                  {theme.label}
                </span>
              )}
              {!isCompact && (
                <span className="text-[7px] font-bold tracking-[0.14em] text-white/75 mt-1 whitespace-nowrap">
                  {theme.sublabel}
                </span>
              )}
            </div>
          )}
        </div>

        {/* 底部細金屬封條 */}
        <div className={cn('w-full h-[10%] bg-gradient-to-r opacity-80 border-t border-black/25 shrink-0', theme.sealGrad)} />

        {tier === 'SP' && !isCompact && (
          <Sparkles className="absolute top-3 right-1.5 w-3 h-3 text-amber-300/75 animate-pulse" />
        )}
      </div>
    </div>
  );
}
