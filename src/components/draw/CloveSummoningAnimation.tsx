'use client';

import React, { useState, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Flame, Crown, FastForward, Layers, Scissors, Disc3, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/safe-image';

import type { HybridTierCode } from '@/types/draw';

export interface CloveSummoningAnimationProps {
  highestRarity: 'common' | 'rare' | 'legendary' | string;
  drawCount: number;
  poolName?: string;
  backgroundUrl?: string;
  onAnimationComplete: () => void;
  selectedNumbers?: number[];
  hybridTier?: HybridTierCode;
}

type Stage = 'idle' | 'tearing' | 'burst';

export function CloveSummoningAnimation({
  highestRarity,
  drawCount,
  poolName = '典藏卡包',
  onAnimationComplete,
  selectedNumbers,
  hybridTier,
}: CloveSummoningAnimationProps) {
  const shouldReduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>('idle');
  const [hasOpened, setHasOpened] = useState(false);
  const [tearProgress, setTearProgress] = useState(0); // 0 to 100
  const [tearDirection, setTearDirection] = useState<'ltr' | 'rtl'>('ltr');
  const [isDragging, setIsDragging] = useState(false);

  const packRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    width: number;
  } | null>(null);

  const isLegendary = highestRarity === 'legendary';
  const isRare = highestRarity === 'rare';

  const tierConfig = useMemo(() => {
    if (hybridTier) {
      const hybridStyles: Record<
        HybridTierCode,
        {
          title: string;
          color: string;
          badgeBg: string;
          ambientGradient: string;
          glowColor: string;
          topBg: string;
          bodyBg: string;
          borderColor: string;
          titleText: string;
          subText: string;
          isLight?: boolean;
        }
      > = {
        A: {
          title: 'A 賞・金包 (GOLD PACK)',
          color: 'text-[#FDE68A]',
          badgeBg: 'bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black',
          ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(251, 191, 36, 0.24) 0%, rgba(180, 83, 9, 0.08) 44%, transparent 72%)',
          glowColor: 'rgba(251, 191, 36, 0.55)',
          topBg: 'from-[#1c170b] via-[#120e07] to-[#0a0f1c]',
          bodyBg: 'from-[#161209] via-[#0d0b07] to-[#07090f]',
          borderColor: 'border-[#FDE68A]/70',
          titleText: 'text-[#FDE68A]',
          subText: 'text-amber-200/70',
        },
        SP: {
          title: 'SP 賞・黑包 (GOD PACK)',
          color: 'text-[#FDE68A]',
          badgeBg: 'bg-[#0a0f1c] text-[#FDE68A] border border-amber-300/75 font-black',
          ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(168, 85, 247, 0.22) 0%, rgba(253, 230, 138, 0.14) 44%, transparent 74%)',
          glowColor: 'rgba(168, 85, 247, 0.5)',
          topBg: 'from-[#10121e] via-[#090b12] to-[#05060b]',
          bodyBg: 'from-[#0a0c16] via-[#06070d] to-[#020306]',
          borderColor: 'border-amber-300/65',
          titleText: 'text-white',
          subText: 'text-purple-200/70',
        },
        B: {
          title: 'B 賞・銀包 (SILVER PACK)',
          color: 'text-slate-200',
          badgeBg: 'bg-slate-200 text-slate-950 font-black',
          ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(226, 232, 240, 0.2) 0%, rgba(100, 116, 139, 0.08) 44%, transparent 72%)',
          glowColor: 'rgba(226, 232, 240, 0.45)',
          topBg: 'from-[#1a2232] via-[#121826] to-[#0b101b]',
          bodyBg: 'from-[#151c2b] via-[#0d1320] to-[#080c15]',
          borderColor: 'border-slate-300/70',
          titleText: 'text-slate-100',
          subText: 'text-slate-300/70',
        },
        C: {
          title: 'C 賞・銅包 (BRONZE PACK)',
          color: 'text-amber-300',
          badgeBg: 'bg-amber-800/80 text-amber-100 border border-amber-500/50 font-black',
          ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(217, 119, 6, 0.2) 0%, rgba(120, 53, 15, 0.08) 44%, transparent 72%)',
          glowColor: 'rgba(217, 119, 6, 0.45)',
          topBg: 'from-[#1c130d] via-[#130d09] to-[#0b0908]',
          bodyBg: 'from-[#17100b] via-[#100b08] to-[#080605]',
          borderColor: 'border-amber-600/70',
          titleText: 'text-amber-100',
          subText: 'text-amber-300/65',
        },
        D: {
          title: 'D 賞・白包 (WHITE PACK)',
          color: 'text-white',
          badgeBg: 'bg-white text-slate-900 border border-slate-200 font-black',
          ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(248, 250, 252, 0.18) 0%, rgba(148, 163, 184, 0.08) 44%, transparent 72%)',
          glowColor: 'rgba(248, 250, 252, 0.38)',
          topBg: 'from-[#181d2a] via-[#111622] to-[#0b0f18]',
          bodyBg: 'from-[#131824] via-[#0d111b] to-[#080b12]',
          borderColor: 'border-white/75',
          titleText: 'text-white',
          subText: 'text-slate-300/75',
        },
        LAST: {
          title: '最後賞・王者冠包 (LAST ONE)',
          color: 'text-[#FDE68A]',
          badgeBg: 'bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black',
          ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(251, 191, 36, 0.26) 0%, rgba(244, 63, 94, 0.1) 44%, transparent 74%)',
          glowColor: 'rgba(251, 191, 36, 0.6)',
          topBg: 'from-[#1e150b] via-[#140e08] to-[#0b090d]',
          bodyBg: 'from-[#181109] via-[#0e0b0e] to-[#07070c]',
          borderColor: 'border-amber-300/80',
          titleText: 'text-[#FDE68A]',
          subText: 'text-amber-200/75',
        },
      };
      const hs = hybridStyles[hybridTier];
      return {
        ...hs,
        icon: hybridTier === 'A' || hybridTier === 'SP' || hybridTier === 'LAST' ? Crown : Sparkles,
      };
    }

    if (isLegendary) {
      return {
        title: 'GOD PACK',
        color: 'text-[#FDE68A]',
        badgeBg: 'bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black',
        ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(251, 191, 36, 0.22) 0%, rgba(180, 83, 9, 0.1) 42%, transparent 70%)',
        glowColor: 'rgba(251, 191, 36, 0.38)',
        topBg: 'from-[#171e30] via-[#0e1424] to-[#0a0f1c]',
        bodyBg: 'from-[#0d1424] via-[#0a0f1c] to-[#060912]',
        borderColor: 'border-amber-300/45',
        titleText: 'text-white',
        subText: 'text-amber-200/70',
        icon: Crown,
      };
    }
    if (isRare) {
      return {
        title: 'SUPER RARE',
        color: 'text-amber-200',
        badgeBg: 'bg-amber-400/20 text-[#FDE68A] border border-amber-300/45 font-bold',
        ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(251, 191, 36, 0.16) 0%, rgba(56, 189, 248, 0.08) 45%, transparent 72%)',
        glowColor: 'rgba(251, 191, 36, 0.26)',
        topBg: 'from-[#171e30] via-[#0e1424] to-[#0a0f1c]',
        bodyBg: 'from-[#0d1424] via-[#0a0f1c] to-[#060912]',
        borderColor: 'border-amber-300/45',
        titleText: 'text-white',
        subText: 'text-amber-200/70',
        icon: Flame,
      };
    }
    return {
      title: 'COLLECTION PACK',
      color: 'text-amber-100',
      badgeBg: 'bg-white/[0.1] text-[#FDE68A] border border-amber-300/30 font-bold',
      ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(253, 230, 138, 0.12) 0%, rgba(15, 23, 42, 0.1) 45%, transparent 72%)',
      glowColor: 'rgba(253, 230, 138, 0.18)',
      topBg: 'from-[#171e30] via-[#0e1424] to-[#0a0f1c]',
      bodyBg: 'from-[#0d1424] via-[#0a0f1c] to-[#060912]',
      borderColor: 'border-amber-300/45',
      titleText: 'text-white',
      subText: 'text-amber-200/70',
      icon: Sparkles,
    };
  }, [isLegendary, isRare, hybridTier]);

  const executeRipOpen = (dir: 'ltr' | 'rtl' = 'ltr') => {
    if (stage !== 'idle' || hasOpened) return;
    setTearDirection(dir);
    setHasOpened(true);
    setIsDragging(false);
    setTearProgress(100);
    setStage('tearing');

    setTimeout(() => {
      setStage('burst');
    }, 320);

    setTimeout(() => {
      onAnimationComplete();
    }, 760);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stage !== 'idle' || hasOpened) return;
    const rect = packRef.current?.getBoundingClientRect();
    setIsDragging(true);
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
      width: rect?.width || 270,
    };
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // ignore synthetic events
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stage !== 'idle' || !isDragging || !pointerStartRef.current) return;
    const start = pointerStartRef.current;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    const dir: 'ltr' | 'rtl' = dx >= 0 ? 'ltr' : 'rtl';
    setTearDirection(dir);

    // Horizontal tear distance (or combined diagonal swipe)
    const tearDist = Math.max(Math.abs(dx), Math.hypot(dx, dy) * 0.75);
    const progress = Math.min(100, Math.max(0, (tearDist / (start.width * 0.58)) * 100));
    setSwipeValue(progress, dir);
  };

  const setSwipeValue = (progress: number, dir: 'ltr' | 'rtl') => {
    setTearProgress(progress);
    if (progress >= 60) {
      executeRipOpen(dir);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stage !== 'idle' || !pointerStartRef.current) return;
    const start = pointerStartRef.current;
    const elapsed = Date.now() - start.time;
    const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    const dir: 'ltr' | 'rtl' = e.clientX - start.x >= 0 ? 'ltr' : 'rtl';
    setIsDragging(false);
    pointerStartRef.current = null;

    // Quick tap or click -> rip open cleanly
    if (elapsed < 280 && dist < 12) {
      executeRipOpen('ltr');
      return;
    }

    if (tearProgress >= 36) {
      executeRipOpen(dir);
    } else {
      setTearProgress(0);
    }
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAnimationComplete();
  };

  const IconComponent = tierConfig.icon;
  const effectiveTear = stage === 'idle' ? tearProgress : 100;
  const ripRatio = effectiveTear / 100;

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="fixed inset-0 z-[120] flex flex-col items-center justify-between select-none overflow-hidden touch-none cursor-grab active:cursor-grabbing py-4 sm:py-6 transform-gpu"
    >
      {/* 1. 背景 */}
      <div className="absolute inset-0 -z-50 pointer-events-none">
        <SafeImage
          src="/draw_background.png"
          alt="Draw Background"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* 暗場壓暗遮罩 */}
      <div className="absolute inset-0 bg-[#060912]/82 -z-40 pointer-events-none" />

      {/* 聚光燈環境光暈 */}
      <div
        className="absolute inset-0 pointer-events-none -z-30 opacity-80"
        style={{ background: tierConfig.ambientGradient }}
      />

      {/* 精緻進場轉場：開獎確認後的光束掃過與同色能量衝擊波 */}
      {!shouldReduceMotion && (
        <>
          <motion.div
            initial={{ scale: 0.35, opacity: 0.9 }}
            animate={{ scale: 2.3, opacity: 0 }}
            transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full border-2 pointer-events-none z-10"
            style={{ borderColor: tierConfig.glowColor, boxShadow: `0 0 60px ${tierConfig.glowColor}` }}
          />
          <motion.div
            initial={{ x: '-120%', opacity: 0.7 }}
            animate={{ x: '160%', opacity: 0 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            className="fixed inset-y-0 w-40 bg-gradient-to-r from-transparent via-white/25 to-transparent -skew-x-12 pointer-events-none z-30"
          />
        </>
      )}

      {/* 頂部卡池資訊與跳過按鈕 */}
      <div
        className="w-full max-w-3xl px-4 flex items-center justify-between z-30 shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#0a0f1c]/90 border border-white/[0.1] backdrop-blur-md shadow-sm">
          <Layers className="w-3.5 h-3.5 text-amber-300" />
          <span className="text-xs font-semibold text-white truncate max-w-[150px] sm:max-w-[220px]">
            {poolName}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/[0.08] text-[#FDE68A] font-mono font-bold tabular-nums">
            {drawCount} 抽
          </span>
          {selectedNumbers && selectedNumbers.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/15 text-[#FDE68A] border border-amber-300/35 font-bold tabular-nums">
              番號 {selectedNumbers.map((n) => '#' + n).join(', ')}
            </span>
          )}
        </div>

        <Button
          onClick={handleSkip}
          variant="ghost"
          size="sm"
          className="h-8 px-3.5 rounded-full bg-[#0a0f1c]/90 hover:bg-amber-400/15 border border-amber-300/35 text-[#FDE68A] hover:text-amber-200 font-bold text-xs tracking-wider gap-1.5 active:scale-[0.97] transition-all shadow-md cursor-pointer"
        >
          <FastForward className="w-3.5 h-3.5 text-amber-300" />
          <span>跳過動畫</span>
        </Button>
      </div>

      {/* 中心舞台：實體鋁箔卡包（橫向撕開頂部封口） */}
      <div className="relative flex-1 flex flex-col items-center justify-center z-20 w-full max-w-lg px-4 min-h-0">
        <div className="relative w-[260px] h-[400px] sm:w-[290px] sm:h-[445px] flex items-center justify-center transform-gpu">
          {/* 卡包背後香檳金柔光 */}
          <div
            className="absolute w-[250px] h-[380px] sm:w-[280px] sm:h-[420px] rounded-3xl pointer-events-none transition-all duration-300 will-change-transform transform-gpu blur-2xl"
            style={{
              background: tierConfig.glowColor,
              transform: stage === 'burst' ? 'scale(1.3)' : `scale(${1 + ripRatio * 0.12})`,
              opacity: stage === 'burst' ? 0.75 : 0.35 + ripRatio * 0.25,
            }}
          />

          {/* 輕量金粉飄散 */}
          {!shouldReduceMotion && (
            <div className="absolute inset-0 pointer-events-none overflow-visible">
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute rounded-full pointer-events-none bg-amber-200 will-change-transform transform-gpu"
                  style={{
                    width: '3px',
                    height: '3px',
                    left: `${20 + i * 12}%`,
                    top: `${25 + ((i * 15) % 50)}%`,
                    opacity: 0.7,
                  }}
                  animate={{
                    y: [0, -35],
                    opacity: [0.25, 0.85, 0],
                  }}
                  transition={{
                    duration: 1.9,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay: i * 0.25,
                  }}
                />
              ))}
            </div>
          )}

          {/* 內部卡片：隨著卡包頂部撕開往上抽出 */}
          <motion.div
            initial={{ y: 12, opacity: 0, scale: 0.92 }}
            animate={
              stage === 'idle'
                ? {
                    y: 12 - ripRatio * 34,
                    opacity: 0.15 + ripRatio * 0.75,
                    scale: 0.92 + ripRatio * 0.04,
                  }
                : stage === 'tearing'
                ? {
                    y: -52,
                    opacity: 1,
                    scale: 0.99,
                  }
                : {
                    y: -26,
                    opacity: 1,
                    scale: 1.07,
                  }
            }
            transition={{ duration: stage === 'idle' ? 0.08 : 0.34, ease: [0.16, 1, 0.3, 1] }}
            className="absolute w-[200px] sm:w-[224px] aspect-[2.5/4] z-10 pointer-events-none flex items-center justify-center will-change-transform transform-gpu"
          >
            <div className="relative p-1.5 bg-[#0a0f1c] border-2 border-amber-300/50 rounded-2xl shadow-[0_0_40px_rgba(251,191,36,0.25)] overflow-hidden w-full h-full flex items-center justify-center">
              <div className="relative w-full h-full bg-[#0d1424] rounded-xl border border-amber-300/30 flex flex-col items-center justify-center pointer-events-none select-none overflow-hidden p-3">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(251,191,36,0.14),transparent_70%)]" />
                <div className="relative flex flex-col items-center">
                  <Disc3 className="w-10 h-10 text-[#FDE68A] animate-spin-slow mb-2" />
                  <span className="font-headline text-sm font-black text-[#FDE68A] tracking-widest drop-shadow-sm">
                    P+ CARDER
                  </span>
                  <span className="text-[8px] text-amber-200/75 font-bold tracking-widest mt-1 uppercase">
                    PREMIUM COLLECTIBLES
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 實體鋁箔卡包主體（頂部撕口封條 + 下半部卡包袋身） */}
          <motion.div
            ref={packRef}
            initial={shouldReduceMotion ? { opacity: 0 } : { y: -70, scale: 0.7, opacity: 0, rotate: -4 }}
            animate={
              stage === 'idle'
                ? shouldReduceMotion
                  ? { y: 0, scale: 1, opacity: 1, rotate: 0 }
                  : { y: [0, -4, 0], scale: 1, opacity: 1, rotate: 0 }
                : stage === 'tearing'
                ? { y: 18, scale: 0.99, opacity: 1, rotate: 0 }
                : { y: 95, scale: 0.92, opacity: 0, rotate: 0 }
            }
            transition={{
              y: {
                duration: stage === 'idle' ? (shouldReduceMotion ? 0.1 : 2.6) : 0.34,
                repeat: stage === 'idle' && !shouldReduceMotion ? Infinity : 0,
                ease: 'easeInOut',
              },
              scale: { type: 'spring', duration: 0.55, bounce: 0.24 },
              opacity: { duration: 0.35 },
              rotate: { type: 'spring', duration: 0.55, bounce: 0.2 },
            }}
            className="relative z-20 w-[240px] h-[380px] sm:w-[270px] sm:h-[425px] flex flex-col drop-shadow-[0_28px_55px_rgba(0,0,0,0.88)] will-change-transform transform-gpu"
          >
            {/* 1️⃣ 卡包頂部可撕封條 (Top Tear Strip) */}
            <motion.div
              animate={
                stage === 'idle'
                  ? {
                      x: tearDirection === 'ltr' ? ripRatio * 26 : -ripRatio * 26,
                      y: -ripRatio * 14,
                      rotate: tearDirection === 'ltr' ? ripRatio * 8 : -ripRatio * 8,
                      opacity: 1 - ripRatio * 0.25,
                    }
                  : {
                      x: tearDirection === 'ltr' ? 140 : -140,
                      y: -85,
                      rotate: tearDirection === 'ltr' ? 24 : -24,
                      opacity: 0,
                    }
              }
              transition={{ duration: stage === 'idle' ? 0.06 : 0.36, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                'relative w-full h-[58px] sm:h-[64px] shrink-0 rounded-t-2xl bg-gradient-to-b border-x border-t overflow-hidden flex flex-col justify-between px-4 py-2 shadow-lg',
                tierConfig.topBg,
                tierConfig.borderColor
              )}
            >
              {/* 垂直熱壓壓紋 */}
              <div className="absolute inset-0 bg-[repeating-linear-gradient(90deg,rgba(253,230,138,0.06)_0px,rgba(253,230,138,0.06)_1px,transparent_1px,transparent_6px)] pointer-events-none" />

              {/* 頂部歐規吊孔 + PULL 指示 */}
              <div className="relative z-10 flex items-center justify-between">
                <span className={cn('text-[9px] font-mono font-bold tracking-widest uppercase flex items-center gap-1', (tierConfig as any).isLight ? 'text-slate-700' : 'text-amber-300/85')}>
                  <Scissors className="w-3 h-3" />
                  <span>TEAR</span>
                </span>
                <div className="w-12 h-2 rounded-full bg-black/75 border border-white/15" />
                <span className={cn('text-[9px] font-mono font-bold tracking-widest uppercase flex items-center gap-0.5', (tierConfig as any).isLight ? 'text-slate-700' : 'text-amber-300/85')}>
                  <span>OPEN</span>
                  <ChevronsRight className="w-3 h-3" />
                </span>
              </div>

              {/* 撕開提示字樣 */}
              <div className="relative z-10 flex items-center justify-center gap-1.5 pb-0.5">
                <span className={cn('text-[10px] font-bold tracking-wider', (tierConfig as any).isLight ? 'text-slate-900' : 'text-[#FDE68A]')}>
                  ← 滑動此處撕開卡包 →
                </span>
              </div>
            </motion.div>

            {/* ⚡ 撕開線光縫 (Tear Line Glow Slit) */}
            <div className="relative w-full h-[3px] shrink-0 z-30 flex items-center">
              <div className="w-full border-t border-dashed border-amber-300/60" />
              <div
                className="absolute inset-y-0 left-0 right-0 bg-gradient-to-r from-[#FDE68A] via-amber-200 to-amber-400 shadow-[0_0_16px_rgba(253,230,138,0.9)] transition-opacity duration-150"
                style={{
                  opacity: stage === 'idle' ? ripRatio : 1,
                  transform: `scaleX(${stage === 'idle' ? Math.max(0.05, ripRatio) : 1})`,
                  transformOrigin: tearDirection === 'ltr' ? 'left' : 'right',
                }}
              />
            </div>

            {/* 2️⃣ 卡包主袋身 (Main Booster Body) */}
            <div className={cn(
              'relative w-full flex-1 rounded-b-2xl bg-gradient-to-b border-x border-b overflow-hidden flex flex-col justify-between p-4 shadow-2xl',
              tierConfig.bodyBg,
              tierConfig.borderColor
            )}>
              {/* 斜向拉絲金屬微紋理 */}
              <div
                className="absolute inset-0 opacity-45 pointer-events-none"
                style={{
                  backgroundImage: `repeating-linear-gradient(135deg, rgba(253, 230, 138, 0.03) 0px, rgba(253, 230, 138, 0.03) 1px, transparent 1px, transparent 12px)`,
                }}
              />
              {/* 鋁箔反光流光 */}
              <div className="absolute -inset-full bg-gradient-to-tr from-transparent via-white/[0.08] to-transparent rotate-12 pointer-events-none" />

              {/* 頂部資訊列 */}
              <div className="relative z-10 flex items-center justify-between w-full px-1 pb-2.5 border-b border-white/[0.12]">
                <span className={cn('text-[9px] sm:text-[10px] font-bold tracking-widest uppercase', (tierConfig as any).isLight ? 'text-slate-700' : 'text-slate-200')}>
                  OFFICIAL PACK
                </span>
                <span className={cn('text-[9px] sm:text-[10px] px-2.5 py-0.5 rounded-full shadow-sm tabular-nums', tierConfig.badgeBg)}>
                  {drawCount} PACK
                </span>
              </div>

              {/* 卡包中央典雅燙金徽章 */}
              <div className="relative z-10 flex flex-col items-center justify-center my-auto py-2">
                <div className={cn('relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl border backdrop-blur-xs flex items-center justify-center shadow-inner', (tierConfig as any).isLight ? 'bg-slate-900 border-slate-700' : 'bg-white/[0.08] border-amber-300/40')}>
                  <div className="absolute inset-1.5 rounded-xl border border-white/10 pointer-events-none" />
                  <IconComponent className={cn('w-9 h-9 sm:w-10 sm:h-10 drop-shadow-lg', (tierConfig as any).isLight ? 'text-[#FDE68A]' : tierConfig.color)} />
                </div>

                <h3 className={cn('mt-3.5 font-headline text-lg sm:text-xl font-black tracking-widest drop-shadow-md', tierConfig.titleText)}>
                  P+ CARDER
                </h3>
                <p className={cn('text-[9px] sm:text-[10px] font-bold tracking-widest uppercase mt-1', tierConfig.subText)}>
                  PREMIUM TRADING CARDS
                </p>
              </div>

              {/* 底部鋸齒壓邊封口 */}
              <div className="relative z-10 w-full text-center shrink-0 pt-2">
                <div className="h-px w-full bg-gradient-to-r from-transparent via-amber-300/35 to-transparent mb-2.5" />
                <div className="flex justify-between overflow-hidden opacity-45 px-1">
                  {[...Array(26)].map((_, i) => (
                    <div key={i} className="w-1.5 h-1 border-b border-r border-amber-300/70 -rotate-45 shrink-0" />
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* 底部互動指引 */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.12 }}
          className="mt-3 text-center space-y-2 w-full max-w-sm"
        >
          <div className={cn('text-sm sm:text-base font-headline font-black tracking-widest drop-shadow-md', tierConfig.color)}>
            ✦ {tierConfig.title} ✦
          </div>

          <div className="relative overflow-hidden w-full px-4 py-3 rounded-2xl bg-[#0a0f1c]/90 border border-white/[0.1] backdrop-blur-md shadow-xl flex items-center justify-between text-slate-200 text-xs font-bold">
            <div
              className="absolute inset-0 bg-gradient-to-r from-amber-400/20 to-[#FDE68A]/25 pointer-events-none transition-transform duration-75 will-change-transform"
              style={{
                transform: `scaleX(${tearProgress / 100})`,
                transformOrigin: tearDirection === 'ltr' ? 'left' : 'right',
              }}
            />

            <div className="relative z-10 flex items-center gap-2">
              <Scissors className="w-4 h-4 text-[#FDE68A] shrink-0" />
              <span className="font-semibold text-xs text-slate-100">
                {stage === 'idle'
                  ? tearProgress > 0
                    ? '繼續滑動撕開卡包封口...'
                    : '左右滑動撕開卡包，或輕觸直接開包'
                  : stage === 'tearing'
                  ? '正在撕開卡包...'
                  : '卡片即將登場...'}
              </span>
            </div>

            <span className="relative z-10 text-[11px] font-mono font-bold text-[#FDE68A] tabular-nums shrink-0">
              {tearProgress > 0 ? `${Math.round(tearProgress)}%` : '滑動 / 點擊'}
            </span>
          </div>
        </motion.div>
      </div>

      {/* 底部極簡輔助文字 */}
      <div className="w-full text-center z-20 shrink-0 pb-1">
        <p className="text-[11px] text-slate-400 font-normal">
          撕開卡包後，下一步可自由瞇開卡片四個角落
        </p>
      </div>
    </div>
  );
}
