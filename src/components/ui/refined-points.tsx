'use client';

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { DiamondIcon, PPlusIcon } from '@/components/icons';

export type CurrencyType = 'diamond' | 'pplus' | 'points' | 'neutral';
export type RefinedSize = 'xs' | 'sm' | 'base' | 'lg' | 'xl' | '2xl' | '3xl';

export interface RefinedPointsProps {
  value: number | string | null | undefined;
  currency?: CurrencyType;
  size?: RefinedSize;
  showIcon?: boolean;
  iconPosition?: 'left' | 'right';
  iconClassName?: string;
  prefix?: string;
  suffix?: string;
  animate?: boolean;
  className?: string;
  digitsClassName?: string;
  variant?: 'luxury' | 'cyber' | 'solid' | 'glow';
  compact?: boolean;
}

const SIZE_CONFIGS: Record<RefinedSize, {
  container: string;
  digits: string;
  icon: string;
  comma: string;
  suffix: string;
}> = {
  xs: {
    container: 'text-xs',
    digits: 'text-[11px] leading-none',
    icon: 'w-3 h-3',
    comma: 'text-[9px] mx-[0.5px]',
    suffix: 'text-[10px] ml-0.5',
  },
  sm: {
    container: 'text-sm',
    digits: 'text-xs sm:text-[13px] leading-none',
    icon: 'w-3.5 h-3.5',
    comma: 'text-[10px] mx-[0.5px]',
    suffix: 'text-[11px] ml-1',
  },
  base: {
    container: 'text-base',
    digits: 'text-sm sm:text-base leading-none',
    icon: 'w-4 h-4',
    comma: 'text-xs mx-[0.75px]',
    suffix: 'text-xs ml-1',
  },
  lg: {
    container: 'text-lg sm:text-xl',
    digits: 'text-base sm:text-lg leading-none',
    icon: 'w-4 h-4 sm:w-5 sm:h-5',
    comma: 'text-sm mx-[1px]',
    suffix: 'text-xs sm:text-sm ml-1',
  },
  xl: {
    container: 'text-xl sm:text-2xl',
    digits: 'text-lg sm:text-2xl leading-none',
    icon: 'w-5 h-5 sm:w-6 sm:h-6',
    comma: 'text-base mx-[1px]',
    suffix: 'text-xs sm:text-sm ml-1.5',
  },
  '2xl': {
    container: 'text-2xl sm:text-3xl',
    digits: 'text-2xl sm:text-3xl leading-none tracking-tight',
    icon: 'w-6 h-6 sm:w-7 sm:h-7',
    comma: 'text-lg mx-[1.5px]',
    suffix: 'text-sm sm:text-base ml-1.5',
  },
  '3xl': {
    container: 'text-3xl sm:text-4xl lg:text-5xl',
    digits: 'text-3xl sm:text-4xl lg:text-5xl leading-none tracking-tight',
    icon: 'w-7 h-7 sm:w-9 sm:h-9',
    comma: 'text-xl sm:text-2xl mx-[2px]',
    suffix: 'text-base sm:text-lg ml-2',
  },
};

/**
 * 精緻點數與數值渲染組件 (Refined Points & Numeric Figures)
 * 解決預設 Monospace 數字粗糙、逗號沾黏、字距過寬問題
 * 採用 Outfit / Rajdhani 幾何等寬數字 (tabular-nums)，支援微光漸層與精雕逗號
 */
export function RefinedPoints({
  value,
  currency = 'diamond',
  size = 'base',
  showIcon = false,
  iconPosition = 'left',
  iconClassName,
  prefix,
  suffix,
  animate = false,
  className,
  digitsClassName,
  variant = 'luxury',
  compact = false,
}: RefinedPointsProps) {
  const numericTarget = typeof value === 'number' ? value : Number(value) || 0;
  const [displayValue, setDisplayValue] = useState<number>(numericTarget);
  const prevValueRef = useRef<number>(numericTarget);
  const animFrameRef = useRef<number | null>(null);

  // 數值變更時的流暢微滾動過渡
  useEffect(() => {
    if (!animate) {
      setDisplayValue(numericTarget);
      prevValueRef.current = numericTarget;
      return;
    }

    const startVal = prevValueRef.current;
    const endVal = numericTarget;
    if (startVal === endVal) return;

    const startTime = performance.now();
    const duration = Math.min(600, Math.max(250, Math.abs(endVal - startVal) > 1000 ? 500 : 300));

    const step = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(startVal + (endVal - startVal) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        animFrameRef.current = requestAnimationFrame(step);
      } else {
        setDisplayValue(endVal);
        prevValueRef.current = endVal;
      }
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [numericTarget, animate]);

  const sizeCfg = SIZE_CONFIGS[size] || SIZE_CONFIGS.base;

  // 格式化數字與分割千分位逗號
  const formattedSegments = useMemo(() => {
    if (value === null || value === undefined) return ['0'];
    
    // 如果需要精簡縮寫 (如 1.5M, 250K)
    if (compact && Math.abs(displayValue) >= 1000000) {
      return [(displayValue / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'];
    }
    if (compact && Math.abs(displayValue) >= 100000) {
      return [(displayValue / 1000).toFixed(0) + 'K'];
    }

    const absStr = Math.abs(displayValue).toString();
    // 依每 3 位數字拆分
    const parts: string[] = [];
    let remainder = absStr.length % 3;
    if (remainder > 0) {
      parts.push(absStr.substring(0, remainder));
    }
    for (let i = remainder; i < absStr.length; i += 3) {
      parts.push(absStr.substring(i, i + 3));
    }
    return parts.length ? parts : ['0'];
  }, [displayValue, value, compact]);

  // 奢華漸層與外觀變體
  const variantStyles = useMemo(() => {
    if (variant === 'luxury') {
      if (currency === 'diamond') {
        return 'text-diamond-luxury font-black';
      }
      if (currency === 'pplus') {
        return 'text-amber-luxury font-black';
      }
      return 'bg-gradient-to-b from-white via-slate-100 to-slate-300 bg-clip-text text-transparent font-black drop-shadow-sm';
    }

    if (variant === 'glow') {
      if (currency === 'diamond') {
        return 'text-cyan-200 drop-shadow-[0_0_8px_rgba(6,182,212,0.65)] font-black';
      }
      if (currency === 'pplus') {
        return 'text-amber-300 drop-shadow-[0_0_8px_rgba(245,158,11,0.65)] font-black';
      }
      return 'text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.4)] font-bold';
    }

    if (variant === 'cyber') {
      if (currency === 'diamond') return 'text-cyan-300 font-extrabold tracking-wider';
      if (currency === 'pplus') return 'text-amber-400 font-extrabold tracking-wider';
      return 'text-emerald-400 font-bold';
    }

    // solid
    if (currency === 'diamond') return 'text-cyan-400 font-bold';
    if (currency === 'pplus') return 'text-amber-400 font-bold';
    return 'text-slate-100 font-bold';
  }, [variant, currency]);

  // 渲染專屬圖標
  const renderIcon = () => {
    if (!showIcon) return null;
    if (currency === 'diamond') {
      return (
        <DiamondIcon 
          className={cn(
            sizeCfg.icon, 
            'inline-block shrink-0 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)] transition-transform',
            iconClassName
          )} 
        />
      );
    }
    if (currency === 'pplus') {
      return (
        <PPlusIcon 
          className={cn(
            sizeCfg.icon, 
            'inline-block shrink-0 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)] transition-transform',
            iconClassName
          )} 
        />
      );
    }
    return null;
  };

  const isNegative = displayValue < 0;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-numbers tabular-nums select-none tracking-tight',
        sizeCfg.container,
        className
      )}
    >
      {showIcon && iconPosition === 'left' && renderIcon()}

      <span className={cn('inline-flex items-baseline', variantStyles, digitsClassName)}>
        {prefix && <span className="mr-0.5 opacity-80 font-bold">{prefix}</span>}
        {isNegative && <span className="mr-0.5 text-rose-400 font-black">-</span>}

        {/* 逐段印出數字與精雕細琢的半透明微型逗號 */}
        {formattedSegments.map((segment, idx) => (
          <React.Fragment key={idx}>
            {idx > 0 && (
              <span
                className={cn(
                  'font-sans font-medium text-current opacity-40 select-none align-baseline pointer-events-none',
                  sizeCfg.comma
                )}
              >
                ,
              </span>
            )}
            <span className={cn('tracking-tight font-extrabold', sizeCfg.digits)}>
              {segment}
            </span>
          </React.Fragment>
        ))}
      </span>

      {suffix && (
        <span className={cn('text-slate-400 font-semibold', sizeCfg.suffix)}>
          {suffix}
        </span>
      )}

      {showIcon && iconPosition === 'right' && renderIcon()}
    </span>
  );
}

export default RefinedPoints;
