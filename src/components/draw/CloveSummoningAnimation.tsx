'use client';

import React, { useState, useMemo, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Sparkles, Flame, Crown, FastForward, Layers, Scissors, Disc3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/safe-image';
import {
  type PeelCorner,
  PEEL_CORNER_LABELS,
  detectPeelCorner,
  computeCornerPeelPercent,
  getCornerPeelGeometry,
} from '@/lib/corner-peel';

export interface CloveSummoningAnimationProps {
  highestRarity: 'common' | 'rare' | 'legendary' | string;
  drawCount: number;
  poolName?: string;
  backgroundUrl?: string;
  onAnimationComplete: () => void;
  selectedNumbers?: number[];
}

type Stage = 'idle' | 'tearing' | 'burst';

export function CloveSummoningAnimation({
  highestRarity,
  drawCount,
  poolName = '典藏卡包',
  onAnimationComplete,
  selectedNumbers,
}: CloveSummoningAnimationProps) {
  const shouldReduceMotion = useReducedMotion();
  const [stage, setStage] = useState<Stage>('idle');
  const [hasTapped, setHasTapped] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0); // 0 to 100
  const [tearCorner, setTearCorner] = useState<PeelCorner>('tr');
  const [isDragging, setIsDragging] = useState(false);

  const packRef = useRef<HTMLDivElement | null>(null);
  const pointerStartRef = useRef<{
    x: number;
    y: number;
    time: number;
    width: number;
    height: number;
    corner: PeelCorner;
  } | null>(null);

  const isLegendary = highestRarity === 'legendary';
  const isRare = highestRarity === 'rare';

  const tierConfig = useMemo(() => {
    if (isLegendary) {
      return {
        title: 'GOD PACK',
        subtitle: '傳說大獎感應中',
        color: 'text-amber-200',
        packAccent: 'from-amber-300 via-yellow-200 to-amber-500',
        badgeBg: 'bg-amber-400/90 text-slate-950 font-black',
        ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(245, 158, 11, 0.25) 0%, rgba(180, 83, 9, 0.12) 40%, transparent 70%)',
        glowColor: 'rgba(251, 191, 36, 0.4)',
        icon: Crown,
      };
    }
    if (isRare) {
      return {
        title: 'SUPER RARE',
        subtitle: '稀有特卡感應中',
        color: 'text-sky-200',
        packAccent: 'from-sky-300 via-blue-200 to-indigo-400',
        badgeBg: 'bg-sky-400/90 text-slate-950 font-black',
        ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(56, 189, 248, 0.22) 0%, rgba(30, 64, 175, 0.1) 40%, transparent 70%)',
        glowColor: 'rgba(56, 189, 248, 0.35)',
        icon: Flame,
      };
    }
    return {
      title: 'COLLECTION PACK',
      subtitle: '正版球星收藏卡',
      color: 'text-slate-200',
      packAccent: 'from-slate-200 via-slate-100 to-slate-400',
      badgeBg: 'bg-slate-200 text-slate-900 font-black',
      ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(148, 163, 184, 0.18) 0%, rgba(30, 41, 59, 0.1) 40%, transparent 70%)',
      glowColor: 'rgba(255, 255, 255, 0.2)',
      icon: Sparkles,
    };
  }, [isLegendary, isRare]);

  // 依據所選角落觸發對角撕開動效
  const executeOpen = (chosenCorner?: PeelCorner) => {
    if (stage !== 'idle' || hasTapped) return;
    if (chosenCorner) {
      setTearCorner(chosenCorner);
    }
    setHasTapped(true);
    setIsDragging(false);
    setSwipeProgress(100);
    setStage('tearing');

    setTimeout(() => {
      setStage('burst');
    }, 280);

    setTimeout(() => {
      onAnimationComplete();
    }, 700);
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stage !== 'idle' || hasTapped) return;
    const rect = packRef.current?.getBoundingClientRect();
    const corner = rect ? detectPeelCorner(e.clientX, e.clientY, rect) : 'tr';
    setTearCorner(corner);
    setIsDragging(true);
    pointerStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      time: Date.now(),
      width: rect?.width || 260,
      height: rect?.height || 410,
      corner,
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
    const progress = computeCornerPeelPercent(start.corner, dx, dy, start.width, start.height);
    setSwipeProgress(progress);
    if (progress >= 58) {
      executeOpen(start.corner);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (stage !== 'idle' || !pointerStartRef.current) return;
    const start = pointerStartRef.current;
    const elapsed = Date.now() - start.time;
    const dist = Math.hypot(e.clientX - start.x, e.clientY - start.y);
    setIsDragging(false);
    pointerStartRef.current = null;

    // 輕觸任意角落或卡包本體，直接沿該角落順暢撕開
    if (elapsed < 280 && dist < 12) {
      executeOpen(start.corner);
      return;
    }

    if (swipeProgress >= 38) {
      executeOpen(start.corner);
    } else {
      setSwipeProgress(0);
    }
  };

  const handleCornerBadgeClick = (e: React.MouseEvent, corner: PeelCorner) => {
    e.stopPropagation();
    executeOpen(corner);
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAnimationComplete();
  };

  const IconComponent = tierConfig.icon;
  const effectivePeelPercent = stage === 'idle' ? swipeProgress * 0.65 : stage === 'tearing' ? 75 : 100;
  const packPeelGeo = getCornerPeelGeometry(tearCorner, effectivePeelPercent);

  // 內部卡片依所選撕開角落反向優雅浮出
  const cardEmergenceOffset = useMemo(() => {
    switch (tearCorner) {
      case 'tl':
        return { x: -16, y: -38, rotate: -4 };
      case 'tr':
        return { x: 16, y: -38, rotate: 4 };
      case 'bl':
        return { x: -16, y: 26, rotate: 4 };
      case 'br':
      default:
        return { x: 16, y: 26, rotate: -4 };
    }
  }, [tearCorner]);

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className="fixed inset-0 z-[120] flex flex-col items-center justify-between select-none overflow-hidden touch-none cursor-grab active:cursor-grabbing py-4 sm:py-6 transform-gpu"
    >
      {/* 1. 溫潤展示背景 */}
      <div className="absolute inset-0 -z-50 pointer-events-none">
        <SafeImage
          src="/draw_background.png"
          alt="Draw Background"
          fill
          className="object-cover"
          priority
        />
      </div>

      {/* 柔光暗場壓暗遮罩 */}
      <div className="absolute inset-0 bg-slate-950/80 -z-40 pointer-events-none" />

      {/* 柔和聚光燈環境光暈 */}
      <div
        className="absolute inset-0 pointer-events-none -z-30 opacity-70"
        style={{ background: tierConfig.ambientGradient }}
      />

      {/* 頂部極簡卡池資訊與跳過按鈕 */}
      <div
        className="w-full max-w-3xl px-4 flex items-center justify-between z-30 shrink-0"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <div className="flex flex-wrap items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/85 border border-white/10 shadow-sm">
          <Layers className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-xs font-semibold text-slate-200 truncate max-w-[150px] sm:max-w-[220px]">
            {poolName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold">
            {drawCount} 抽
          </span>
          {selectedNumbers && selectedNumbers.length > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 font-black">
              🎯 番號 {selectedNumbers.map((n) => '#' + n).join(', ')}
            </span>
          )}
        </div>

        <Button
          onClick={handleSkip}
          variant="ghost"
          size="sm"
          className="h-8 px-3.5 rounded-full bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-200 hover:text-white font-black text-xs tracking-wider gap-1.5 active:scale-[0.97] transition-[background-color,color,transform] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] shadow-md cursor-pointer"
        >
          <FastForward className="w-3.5 h-3.5 text-amber-300" />
          <span>⚡ 跳過動畫</span>
        </Button>
      </div>

      {/* 中心舞台：四角自由撕開實體鋁箔卡包 */}
      <div className="relative flex-1 flex flex-col items-center justify-center z-20 w-full max-w-lg px-4 min-h-0">
        <div className="relative w-[280px] h-[430px] sm:w-[320px] sm:h-[490px] flex items-center justify-center transform-gpu">
          {/* 卡包背後柔光 */}
          <div
            className="absolute w-[260px] h-[390px] sm:w-[300px] sm:h-[450px] rounded-3xl opacity-40 pointer-events-none transition-transform duration-300 will-change-transform transform-gpu"
            style={{
              background: tierConfig.glowColor,
              transform: stage === 'burst' ? 'scale(1.25)' : 'scale(1)',
              opacity: stage === 'burst' ? 0.7 : 0.35,
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
                    opacity: [0.3, 0.9, 0],
                  }}
                  transition={{
                    duration: 1.8,
                    repeat: Infinity,
                    ease: 'easeOut',
                    delay: i * 0.25,
                  }}
                />
              ))}
            </div>
          )}

          {/* 內部卡片隨所選角落浮現 */}
          <motion.div
            initial={{ y: 0, x: 0, opacity: 0, scale: 0.92 }}
            animate={
              stage === 'idle' && swipeProgress > 5
                ? {
                    opacity: Math.min(0.95, 0.25 + swipeProgress / 100),
                    scale: 0.94 + (swipeProgress / 100) * 0.04,
                    x: (cardEmergenceOffset.x * swipeProgress) / 140,
                    y: (cardEmergenceOffset.y * swipeProgress) / 140,
                  }
                : stage === 'tearing'
                ? {
                    x: cardEmergenceOffset.x * 0.6,
                    y: cardEmergenceOffset.y * 0.6,
                    rotate: cardEmergenceOffset.rotate * 0.5,
                    opacity: 0.95,
                    scale: 0.98,
                  }
                : stage === 'burst'
                ? {
                    x: 0,
                    y: -16,
                    rotate: 0,
                    scale: 1.06,
                    opacity: 1,
                  }
                : { opacity: 0.15, scale: 0.92 }
            }
            transition={{ duration: stage === 'idle' ? 0.1 : 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="absolute w-[196px] sm:w-[222px] aspect-[2.5/4] z-10 pointer-events-none flex items-center justify-center will-change-transform transform-gpu"
          >
            <div className="relative p-1.5 bg-slate-950/95 border-2 border-slate-700 rounded-2xl shadow-2xl overflow-hidden w-full h-full flex items-center justify-center">
              <div className="relative w-full h-full bg-slate-900 rounded-xl border border-cyan-500/35 flex flex-col items-center justify-center pointer-events-none select-none overflow-hidden p-3">
                <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/40 via-slate-900 to-slate-950" />
                <div className="relative flex flex-col items-center">
                  <Disc3 className="w-10 h-10 text-cyan-400 animate-spin-slow mb-2" />
                  <span className="font-headline text-sm font-black text-white tracking-widest drop-shadow-sm">
                    P+ CARDER
                  </span>
                  <span className="text-[8px] text-cyan-300/80 font-bold tracking-widest mt-1 uppercase">
                    PREMIUM COLLECTIBLES
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* 實體鋁箔卡包容器（支援四角任選一處撕開） */}
          <motion.div
            ref={packRef}
            animate={
              stage === 'idle'
                ? shouldReduceMotion
                  ? { y: 0 }
                  : { y: [0, -3, 0] }
                : stage === 'tearing'
                ? { scale: 1.01 }
                : { scale: 0.96, opacity: 0 }
            }
            transition={{
              duration: stage === 'idle' ? (shouldReduceMotion ? 0.1 : 2.6) : 0.32,
              repeat: stage === 'idle' && !shouldReduceMotion ? Infinity : 0,
              ease: 'easeInOut',
            }}
            style={{
              transform: isDragging && swipeProgress > 0 ? packPeelGeo.tiltTransform : undefined,
            }}
            className="relative z-20 w-[240px] h-[380px] sm:w-[270px] sm:h-[430px] drop-shadow-[0_25px_50px_rgba(0,0,0,0.85)] will-change-transform transform-gpu"
          >
            {/* 可對角撕開的鋁箔包裝主體 */}
            <div
              className={cn(
                'relative w-full h-full rounded-2xl bg-gradient-to-b from-slate-700 via-slate-900 to-slate-950 border border-white/25 shadow-2xl overflow-hidden flex flex-col justify-between p-4',
                isDragging
                  ? 'transition-none'
                  : 'transition-[clip-path,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                stage === 'burst' ? 'opacity-0' : 'opacity-100'
              )}
              style={{ clipPath: packPeelGeo.coverClipPath }}
            >
              {/* 鋁箔金屬細膩微反光 */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_3.5s_infinite] pointer-events-none" />

              {/* 四個角落的擬真撕口熱區與指引 */}
              {stage === 'idle' && swipeProgress === 0 && (
                <>
                  <button
                    type="button"
                    onClick={(e) => handleCornerBadgeClick(e, 'tl')}
                    className="absolute top-2 left-2 z-30 flex items-center gap-1 px-2 py-1 rounded-tl-lg rounded-br-lg bg-amber-400/15 hover:bg-amber-400/30 border-t-2 border-l-2 border-amber-300/80 text-[9px] font-black text-amber-200 transition-colors cursor-pointer"
                  >
                    <span>↖ 左上</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCornerBadgeClick(e, 'tr')}
                    className="absolute top-2 right-2 z-30 flex items-center gap-1 px-2 py-1 rounded-tr-lg rounded-bl-lg bg-amber-400/15 hover:bg-amber-400/30 border-t-2 border-r-2 border-amber-300/80 text-[9px] font-black text-amber-200 transition-colors cursor-pointer"
                  >
                    <span>右上 ↗</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCornerBadgeClick(e, 'bl')}
                    className="absolute bottom-2 left-2 z-30 flex items-center gap-1 px-2 py-1 rounded-bl-lg rounded-tr-lg bg-amber-400/15 hover:bg-amber-400/30 border-b-2 border-l-2 border-amber-300/80 text-[9px] font-black text-amber-200 transition-colors cursor-pointer"
                  >
                    <span>↙ 左下</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleCornerBadgeClick(e, 'br')}
                    className="absolute bottom-2 right-2 z-30 flex items-center gap-1 px-2 py-1 rounded-br-lg rounded-tl-lg bg-amber-400/15 hover:bg-amber-400/30 border-b-2 border-r-2 border-amber-300/80 text-[9px] font-black text-amber-200 transition-colors cursor-pointer"
                  >
                    <span>右下 ↘</span>
                  </button>
                </>
              )}

              {/* 頂部壓邊與資訊 */}
              <div className="w-full pt-7">
                <div className="flex items-center justify-between w-full px-1 pb-2 border-b border-dashed border-amber-300/35">
                  <span className="text-[9px] sm:text-[10px] font-bold tracking-wider text-slate-300 uppercase">
                    OFFICIAL PACK
                  </span>
                  <span className={cn('text-[9px] sm:text-[10px] px-2.5 py-0.5 rounded-full shadow-sm font-bold', tierConfig.badgeBg)}>
                    {drawCount} PACK
                  </span>
                </div>
              </div>

              {/* 卡包中央典雅盾牌燙金/燙銀徽章 */}
              <div className="relative flex flex-col items-center justify-center my-auto py-2">
                <div className="relative w-18 h-18 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-b from-white/15 to-white/5 border border-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner">
                  <div className="absolute inset-1 rounded-xl border border-white/15 pointer-events-none" />
                  <IconComponent className={cn('w-9 h-9 sm:w-10 sm:h-10 drop-shadow-lg', tierConfig.color)} />
                </div>

                <h3 className="mt-3.5 font-headline text-lg sm:text-xl font-black text-white tracking-widest drop-shadow-md">
                  P+ CARDER
                </h3>
                <p className="text-[9px] sm:text-[10px] text-slate-300 font-bold tracking-widest uppercase mt-1">
                  PREMIUM TRADING CARDS
                </p>
              </div>

              {/* 底部鋸齒壓邊封口 */}
              <div className="w-full text-center shrink-0 pb-6">
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-white/25 to-transparent mb-2" />
                <div className="flex justify-between overflow-hidden opacity-50 px-1">
                  {[...Array(28)].map((_, i) => (
                    <div key={i} className="w-1.5 h-1 border-b border-r border-slate-400 -rotate-45 shrink-0" />
                  ))}
                </div>
              </div>
            </div>

            {/* 鋁箔折角金屬反光層 */}
            {effectivePeelPercent > 0 && stage !== 'burst' && (
              <div
                className={cn(
                  'absolute inset-0 z-30 pointer-events-none drop-shadow-[0_10px_18px_rgba(0,0,0,0.85)]',
                  isDragging
                    ? 'transition-none'
                    : 'transition-[clip-path,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]'
                )}
                style={{
                  clipPath: packPeelGeo.flapClipPath,
                  background: packPeelGeo.flapGradient,
                }}
              />
            )}
          </motion.div>
        </div>

        {/* 底部互動指引 */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-4 text-center space-y-2 w-full max-w-sm"
        >
          <div className={cn('text-sm sm:text-base font-headline font-black tracking-widest drop-shadow-md', tierConfig.color)}>
            ✦ {tierConfig.title} ✦
          </div>

          <div className="relative overflow-hidden w-full px-5 py-3 rounded-2xl bg-slate-900/85 border border-white/20 backdrop-blur-md shadow-xl flex items-center justify-between text-slate-200 text-xs sm:text-sm font-bold">
            <div
              className="absolute inset-0 bg-amber-400/20 pointer-events-none origin-left transition-transform duration-100 will-change-transform"
              style={{ transform: `scaleX(${swipeProgress / 100})` }}
            />

            <div className="relative z-10 flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-amber-300" />
              <span className="font-semibold text-xs text-slate-100">
                {stage === 'idle'
                  ? swipeProgress > 0
                    ? `正從${PEEL_CORNER_LABELS[tearCorner]}角撕開卡包...`
                    : '任選四角往內滑動或輕觸開啟卡包'
                  : stage === 'tearing'
                  ? `已從${PEEL_CORNER_LABELS[tearCorner]}角撕開...`
                  : '✨ 揭曉卡片...'}
              </span>
            </div>

            <span className="relative z-10 text-[10px] font-mono font-bold text-amber-300">
              四角皆可開
            </span>
          </div>
        </motion.div>
      </div>

      {/* 底部極簡輔助文字 */}
      <div className="w-full text-center z-20 shrink-0 pb-1">
        <p className="text-[11px] text-slate-400/85 font-normal">
          可自由選擇左上、右上、左下、右下任一角落滑動或點選開包
        </p>
      </div>
    </div>
  );
}
