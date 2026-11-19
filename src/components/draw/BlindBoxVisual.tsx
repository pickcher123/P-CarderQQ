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

const BOX_THEMES: Record<
  HybridTierCode,
  {
    label: string;
    sublabel: string;
    lidGrad: string;
    bodyGrad: string;
    border: string;
    ribbon: string;
    glow: string;
    text: string;
  }
> = {
  A: {
    label: 'A 賞',
    sublabel: 'GOLD BOX',
    lidGrad: 'from-[#FEF3C7] via-[#F59E0B] to-[#B45309]',
    bodyGrad: 'from-[#D97706] via-[#92400E] to-[#451A03]',
    border: 'border-amber-300/80',
    ribbon: 'bg-gradient-to-b from-[#FFFBEB] to-[#FDE68A]',
    glow: 'shadow-[0_0_32px_rgba(251,191,36,0.45)]',
    text: 'text-[#120d02]',
  },
  SP: {
    label: 'SP',
    sublabel: 'HIDDEN VAULT',
    lidGrad: 'from-[#1E293B] via-[#0F172A] to-[#020617]',
    bodyGrad: 'from-[#0F172A] via-[#090D16] to-[#000000]',
    border: 'border-amber-300/70',
    ribbon: 'bg-gradient-to-b from-[#FDE68A] via-amber-400 to-amber-600',
    glow: 'shadow-[0_0_36px_rgba(253,230,138,0.35)]',
    text: 'text-[#FDE68A]',
  },
  B: {
    label: 'B 賞',
    sublabel: 'SILVER BOX',
    lidGrad: 'from-[#F8FAFC] via-[#CBD5E1] to-[#64748B]',
    bodyGrad: 'from-[#94A3B8] via-[#475569] to-[#1E293B]',
    border: 'border-slate-200/75',
    ribbon: 'bg-gradient-to-b from-white to-slate-300',
    glow: 'shadow-[0_0_24px_rgba(203,213,225,0.35)]',
    text: 'text-slate-950',
  },
  C: {
    label: 'C 賞',
    sublabel: 'BRONZE BOX',
    lidGrad: 'from-[#FDE68A] via-[#D97706] to-[#78350F]',
    bodyGrad: 'from-[#B45309] via-[#78350F] to-[#451A03]',
    border: 'border-amber-600/70',
    ribbon: 'bg-gradient-to-b from-amber-200 to-amber-500',
    glow: 'shadow-[0_0_18px_rgba(217,119,6,0.3)]',
    text: 'text-amber-50',
  },
  D: {
    label: 'D 賞',
    sublabel: 'WHITE BOX',
    lidGrad: 'from-white via-slate-100 to-slate-300',
    bodyGrad: 'from-slate-200 via-slate-300 to-slate-400',
    border: 'border-white/80',
    ribbon: 'bg-gradient-to-b from-slate-700 to-slate-900',
    glow: 'shadow-[0_0_14px_rgba(255,255,255,0.2)]',
    text: 'text-slate-900',
  },
  LAST: {
    label: 'LAST',
    sublabel: 'LAST ONE',
    lidGrad: 'from-[#FDE68A] via-amber-400 to-rose-500',
    bodyGrad: 'from-[#451A03] via-[#1E1B4B] to-[#0a0f1c]',
    border: 'border-amber-300/90',
    ribbon: 'bg-gradient-to-b from-[#FEF3C7] to-amber-400',
    glow: 'shadow-[0_0_36px_rgba(245,158,11,0.55)]',
    text: 'text-[#FDE68A]',
  },
};

const SIZE_CLASSES: Record<NonNullable<BlindBoxVisualProps['size']>, string> = {
  xs: 'w-10 h-10',
  sm: 'w-16 h-16',
  md: 'w-24 h-24',
  lg: 'w-36 h-36 sm:w-44 sm:h-44',
};

export function BlindBoxVisual({
  tier,
  size = 'md',
  isOpened = false,
  isOpening = false,
  className,
}: BlindBoxVisualProps) {
  const theme = BOX_THEMES[tier] || BOX_THEMES.D;
  const isCompact = size === 'xs' || size === 'sm';

  return (
    <div
      className={cn(
        'relative flex items-center justify-center select-none',
        SIZE_CLASSES[size],
        className
      )}
    >
      {/* 底層氛圍光暈 */}
      <div
        className={cn(
          'absolute inset-1 rounded-2xl transition-all duration-300',
          theme.glow,
          isOpening && 'scale-125 opacity-100'
        )}
      />

      {/* 盒子本體 */}
      <div className="relative w-full h-full flex flex-col items-center justify-end p-[8%]">
        {/* 上蓋 */}
        <div
          className={cn(
            'relative z-20 w-[94%] h-[28%] rounded-t-lg border bg-gradient-to-br transition-transform duration-500 ease-[cubic-bezier(0.23,1,0.32,1)]',
            theme.lidGrad,
            theme.border,
            isOpened && '-translate-y-4 -rotate-6 opacity-80',
            isOpening && '-translate-y-6 -rotate-12'
          )}
        >
          {/* 頂部光澤高光 */}
          <div className="absolute inset-x-1 top-0.5 h-1 rounded-full bg-white/40 blur-[0.5px]" />
          {/* 垂直緞帶 */}
          <div className={cn('absolute inset-y-0 left-1/2 -translate-x-1/2 w-[16%] opacity-90', theme.ribbon)} />
        </div>

        {/* 箱身 */}
        <div
          className={cn(
            'relative z-10 w-[86%] h-[62%] rounded-b-xl border-x border-b bg-gradient-to-b overflow-hidden flex flex-col items-center justify-center',
            theme.bodyGrad,
            theme.border
          )}
        >
          {/* 垂直緞帶 */}
          <div className={cn('absolute inset-y-0 left-1/2 -translate-x-1/2 w-[17%] opacity-30', theme.ribbon)} />

          {/* 中央封印徽章 */}
          <div
            className={cn(
              'relative z-20 flex flex-col items-center justify-center rounded-lg border border-white/25 backdrop-blur-sm px-1.5 py-0.5',
              tier === 'SP' ? 'bg-black/80 border-amber-300/60' : 'bg-black/25'
            )}
          >
            {tier === 'SP' ? (
              <div className="flex items-center gap-0.5">
                <Lock className={cn(isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5', 'text-[#FDE68A]')} />
                <span className={cn('font-black tracking-wider', isCompact ? 'text-[9px]' : 'text-xs', theme.text)}>
                  SP
                </span>
              </div>
            ) : tier === 'LAST' ? (
              <div className="flex items-center gap-0.5">
                <Crown className={cn(isCompact ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5', 'text-[#FDE68A]')} />
                <span className={cn('font-black tracking-wider', isCompact ? 'text-[8px]' : 'text-[11px]', theme.text)}>
                  LAST
                </span>
              </div>
            ) : (
              <span
                className={cn(
                  'font-black tracking-tight leading-none',
                  isCompact ? 'text-[10px]' : 'text-sm',
                  tier === 'C' ? 'text-[#FDE68A]' : 'text-white drop-shadow'
                )}
              >
                {theme.label}
              </span>
            )}
            {!isCompact && (
              <span className="text-[8px] font-bold tracking-[0.14em] text-white/75 mt-0.5">
                {theme.sublabel}
              </span>
            )}
          </div>

          {/* SP 黑盒專屬星芒點綴 */}
          {tier === 'SP' && !isCompact && (
            <Sparkles className="absolute top-1.5 right-1.5 w-3 h-3 text-amber-300/70 animate-pulse" />
          )}
        </div>
      </div>
    </div>
  );
}
