'use client';

import { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Flame, Crown, FastForward, Layers, Scissors, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface CloveSummoningAnimationProps {
  highestRarity: 'common' | 'rare' | 'legendary' | string;
  drawCount: number;
  poolName?: string;
  onAnimationComplete: () => void;
}

type Stage = 'idle' | 'tearing' | 'burst';

export function CloveSummoningAnimation({
  highestRarity,
  drawCount,
  poolName = '頂級卡包',
  onAnimationComplete,
}: CloveSummoningAnimationProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [hasTapped, setHasTapped] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0); // 0 to 100
  const touchStartXRef = useRef<number | null>(null);

  const isLegendary = highestRarity === 'legendary';
  const isRare = highestRarity === 'rare';

  // Dynamic Theme Colors & VFX styling based on Rarity Tier
  const tierConfig = useMemo(() => {
    if (isLegendary) {
      return {
        title: '✦ GOD PACK ✦',
        hint: '滑動或點擊撕開卡包',
        color: 'text-amber-300',
        borderColor: 'border-amber-400',
        glowColor: 'rgba(245, 158, 11, 0.85)',
        accentBg: 'from-amber-500/30 via-yellow-500/20 to-red-500/30',
        badgeBg: 'bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 text-slate-950',
        ambientGradient: 'radial-gradient(circle at center, rgba(245, 158, 11, 0.4) 0%, rgba(220, 38, 38, 0.25) 45%, transparent 75%)',
        particles: 30,
        icon: Crown,
      };
    }
    if (isRare) {
      return {
        title: '✦ SUPER RARE ✦',
        hint: '滑動或點擊撕開卡包',
        color: 'text-cyan-300',
        borderColor: 'border-cyan-400',
        glowColor: 'rgba(6, 182, 212, 0.75)',
        accentBg: 'from-cyan-500/30 via-blue-500/20 to-indigo-500/30',
        badgeBg: 'bg-gradient-to-r from-cyan-500 via-blue-500 to-indigo-500 text-white',
        ambientGradient: 'radial-gradient(circle at center, rgba(6, 182, 212, 0.3) 0%, rgba(59, 130, 246, 0.2) 50%, transparent 70%)',
        particles: 20,
        icon: Flame,
      };
    }
    return {
      title: '✦ BOOSTER PACK ✦',
      hint: '滑動或點擊撕開卡包',
      color: 'text-blue-300',
      borderColor: 'border-blue-400/50',
      glowColor: 'rgba(59, 130, 246, 0.5)',
      accentBg: 'from-blue-500/20 via-slate-500/10 to-transparent',
      badgeBg: 'bg-blue-600 text-white',
      ambientGradient: 'radial-gradient(circle at center, rgba(59, 130, 246, 0.2) 0%, transparent 65%)',
      particles: 14,
      icon: Sparkles,
    };
  }, [isLegendary, isRare]);

  // Trigger tearing sequence
  const executeOpen = () => {
    if (stage !== 'idle' || hasTapped) return;
    setHasTapped(true);
    setSwipeProgress(100);
    setStage('tearing');

    // Stage 1: Slicing physical top strip + laser cut
    setTimeout(() => {
      setStage('burst');
    }, 800);

    // Stage 2: Glow Explosion & Transition into reveal
    setTimeout(() => {
      onAnimationComplete();
    }, 1600);
  };

  // Touch / Swipe Event Listeners
  const handleTouchStart = (e: React.TouchEvent) => {
    if (stage !== 'idle') return;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (stage !== 'idle' || touchStartXRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartXRef.current;
    if (diff > 0) {
      const progress = Math.min(Math.max((diff / 150) * 100, 0), 100);
      setSwipeProgress(progress);
      if (progress >= 75) {
        executeOpen();
      }
    }
  };

  const handleTouchEnd = () => {
    if (stage !== 'idle') return;
    if (swipeProgress < 75) {
      setSwipeProgress(0);
    }
    touchStartXRef.current = null;
  };

  // Mouse Drag Support
  const handleMouseDown = (e: React.MouseEvent) => {
    if (stage !== 'idle') return;
    touchStartXRef.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (stage !== 'idle' || touchStartXRef.current === null) return;
    const diff = e.clientX - touchStartXRef.current;
    if (diff > 0) {
      const progress = Math.min(Math.max((diff / 150) * 100, 0), 100);
      setSwipeProgress(progress);
      if (progress >= 75) {
        executeOpen();
      }
    }
  };

  const handleMouseUp = () => {
    if (stage !== 'idle') return;
    if (swipeProgress < 75) {
      setSwipeProgress(0);
    }
    touchStartXRef.current = null;
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAnimationComplete();
  };

  const IconComponent = tierConfig.icon;

  return (
    <div 
      onClick={executeOpen}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-2xl flex flex-col items-center justify-between select-none overflow-hidden touch-none cursor-pointer py-4 sm:py-6"
    >
      {/* Dynamic Ambient Radial Light */}
      <div
        className="absolute inset-0 transition-opacity duration-1000 pointer-events-none"
        style={{ background: tierConfig.ambientGradient }}
      />

      {/* Cyberpunk Grid Floor */}
      <motion.div
        className="absolute inset-0 pointer-events-none flex items-center justify-center"
        animate={
          stage === 'burst' && isLegendary
            ? { x: [0, -12, 12, -8, 8, 0], y: [0, 10, -10, 8, -8, 0] }
            : stage === 'burst'
            ? { x: [0, -5, 5, -3, 3, 0], y: [0, 5, -5, 3, -3, 0] }
            : stage === 'tearing'
            ? { x: [0, -2, 2, -1, 1, 0], y: [0, 2, -2, 1, -1, 0] }
            : {}
        }
        transition={{ duration: stage === 'tearing' ? 0.3 : 0.45, ease: 'easeInOut' }}
      >
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:3rem_3rem] [mask-image:radial-gradient(ellipse_65%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-50" />
      </motion.div>

      {/* Top Header: Minimal Pool Info & Skip Button */}
      <div className="w-full max-w-4xl px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-900/80 border border-white/10 backdrop-blur-md">
          <Layers className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200 truncate max-w-[150px] sm:max-w-[220px]">
            {poolName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono font-black">
            {drawCount} 抽
          </span>
        </div>

        <Button
          onClick={handleSkip}
          variant="outline"
          size="sm"
          className="h-8 px-3.5 rounded-full bg-slate-900/80 hover:bg-white/20 border-white/20 text-white font-bold text-xs uppercase tracking-wider gap-1.5 shadow-lg active:scale-95 transition-all"
        >
          <FastForward className="w-3 h-3 fill-current text-amber-400" />
          <span>SKIP</span>
        </Button>
      </div>

      {/* Center Stage: Slim & Elongated Card Pack (縱長修長卡包) */}
      <div className="relative flex-1 flex flex-col items-center justify-center z-20 w-full max-w-sm px-4 min-h-0">
        
        {/* Magic Aura Ring Behind Pack */}
        <div className="relative w-64 h-80 sm:w-72 sm:h-96 flex items-center justify-center">
          
          {/* Rotating Geometric Ring */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: stage === 'burst' ? 2 : 12, ease: 'linear' }}
            className={cn(
              "absolute w-60 h-60 sm:w-72 sm:h-72 rounded-full border border-dashed opacity-40",
              tierConfig.borderColor
            )}
          />

          {/* Flash Flare on Burst */}
          <AnimatePresence>
            {stage === 'burst' && (
              <motion.div
                initial={{ scale: 0.1, opacity: 1 }}
                animate={{ scale: [1, 3.5, 6], opacity: [1, 0.9, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                className="absolute inset-0 rounded-full bg-gradient-to-r from-amber-400 via-white to-cyan-300 blur-3xl z-0"
              />
            )}
          </AnimatePresence>

          {/* Orbiting Particles */}
          {Array.from({ length: tierConfig.particles }).map((_, idx) => {
            const angle = (idx / tierConfig.particles) * Math.PI * 2;
            const distance = 85 + (idx % 3) * 25;
            return (
              <motion.div
                key={idx}
                className={cn(
                  "absolute rounded-full",
                  isLegendary
                    ? "w-2 h-2 bg-amber-300 shadow-[0_0_10px_#f59e0b]"
                    : "w-1.5 h-1.5 bg-cyan-300 shadow-[0_0_8px_#06b6d4]"
                )}
                animate={{
                  x: [
                    Math.cos(angle) * distance,
                    Math.cos(angle + Math.PI) * (distance * 0.4),
                    Math.cos(angle + Math.PI * 2) * distance,
                  ],
                  y: [
                    Math.sin(angle) * (distance * 1.2),
                    Math.sin(angle + Math.PI) * (distance * 0.5),
                    Math.sin(angle + Math.PI * 2) * (distance * 1.2),
                  ],
                  scale: stage === 'burst' ? [1, 2.5, 0] : [0.7, 1.3, 0.7],
                  opacity: [0.2, 0.9, 0.2],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 2.5 + (idx % 3) * 0.5,
                  ease: 'easeInOut',
                  delay: (idx % 4) * 0.2,
                }}
              />
            );
          })}

          {/* SLIM & ELONGATED CARD PACK (修長拉長比例：w-44 h-76 / w-48 h-84) */}
          <div className="relative z-10 w-44 h-72 sm:w-48 sm:h-80 flex flex-col items-center drop-shadow-[0_20px_40px_rgba(0,0,0,0.85)]">
            
            {/* 1. SEPARABLE TOP FOIL CAP (Rips off and flies) */}
            <motion.div
              initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
              animate={
                stage === 'idle'
                  ? { 
                      y: [0, -3, 0],
                      x: (swipeProgress / 100) * 35,
                      rotate: (swipeProgress / 100) * 10,
                    }
                  : stage === 'tearing'
                  ? {
                      x: [0, 50, 110],
                      y: [0, -25, -60],
                      rotate: [0, 20, 40],
                      opacity: [1, 0.9, 0],
                      filter: 'brightness(2)',
                    }
                  : { opacity: 0, y: -100, x: 120 }
              }
              transition={{
                duration: stage === 'idle' ? 2 : 0.75,
                repeat: stage === 'idle' ? Infinity : 0,
                ease: stage === 'tearing' ? 'easeOut' : 'easeInOut',
              }}
              className="relative w-full h-11 sm:h-12 rounded-t-xl bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-t-2 border-x-2 border-white/30 shadow-lg overflow-hidden flex flex-col justify-between p-2 z-20"
            >
              {/* Foil Shimmer */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none" />

              {/* Minimal Top Header */}
              <div className="flex items-center justify-between w-full px-0.5">
                <span className="text-[8px] font-bold tracking-wider text-slate-300 uppercase font-mono">
                  BOOSTER
                </span>
                <span className={cn("text-[7px] px-1.5 py-0.2 rounded font-black uppercase", tierConfig.badgeBg)}>
                  {drawCount}P
                </span>
              </div>

              {/* Clean Tear Strip */}
              <div className="relative flex items-center justify-between border-t border-dashed border-amber-400/70 pt-0.5">
                <div className="flex items-center gap-1">
                  <Scissors className="w-3 h-3 text-amber-300 rotate-90" />
                  <span className="text-[7px] font-bold tracking-widest text-amber-300 font-mono">
                    TEAR
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1 flex-1 ml-2 bg-slate-950/60 rounded-full overflow-hidden border border-amber-400/20">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-400 to-white transition-all duration-75" 
                    style={{ width: `${Math.max(swipeProgress, 10)}%` }}
                  />
                </div>
              </div>
            </motion.div>

            {/* 2. DYNAMIC LASER TEAR SLICE */}
            <AnimatePresence>
              {(stage === 'tearing' || swipeProgress > 30) && (
                <motion.div
                  initial={{ width: '0%', left: '0%', opacity: 1 }}
                  animate={{ width: `${Math.max(swipeProgress, 100)}%`, opacity: stage === 'tearing' ? [1, 1, 0] : 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: stage === 'tearing' ? 0.4 : 0.05, ease: 'easeOut' }}
                  className="absolute top-11 sm:top-12 z-30 h-1.5 bg-gradient-to-r from-yellow-300 via-white to-cyan-300 shadow-[0_0_20px_#ffffff] rounded-full pointer-events-none"
                />
              )}
            </AnimatePresence>

            {/* 3. INNER CARDS PEAKING */}
            <motion.div
              initial={{ y: 20, opacity: 0, scale: 0.85 }}
              animate={
                stage === 'tearing' || swipeProgress > 40
                  ? { y: [-10, -35], opacity: [0.6, 1], scale: [0.85, 0.95] }
                  : stage === 'burst'
                  ? { y: -50, scale: [0.95, 1.25, 0.2], opacity: [1, 1, 0] }
                  : { opacity: 0 }
              }
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="absolute top-4 w-36 h-60 sm:w-40 sm:h-68 rounded-lg bg-gradient-to-tr from-amber-500/30 via-white/20 to-cyan-500/30 border border-white/80 shadow-[0_0_25px_rgba(255,255,255,0.5)] backdrop-blur-md flex flex-col items-center justify-center z-10 pointer-events-none"
            >
              <Sparkles className="w-8 h-8 text-yellow-300 drop-shadow-[0_0_10px_#fde047] animate-pulse" />
            </motion.div>

            {/* 4. MAIN PACK BODY (Slim, Sleek & Clean Design) */}
            <motion.div
              animate={
                stage === 'idle'
                  ? { y: [0, 3, 0] }
                  : stage === 'tearing'
                  ? { 
                      y: [0, 6, 2],
                      scale: [1, 1.02, 1],
                      filter: ['brightness(1)', 'brightness(1.4)', 'brightness(1.8)'],
                    }
                  : { 
                      scale: [1, 1.5, 0],
                      opacity: [1, 0.8, 0],
                      filter: 'brightness(3)',
                    }
              }
              transition={{
                duration: stage === 'idle' ? 2 : 0.55,
                repeat: stage === 'idle' ? Infinity : 0,
                ease: 'easeInOut',
              }}
              className="relative w-full flex-1 rounded-b-xl bg-gradient-to-b from-slate-800 via-slate-900 to-black border-b-2 border-x-2 border-white/30 shadow-xl overflow-hidden flex flex-col items-center justify-between p-3 z-10 -mt-0.5 group-hover:border-cyan-400 transition-colors"
            >
              {/* Prismatic Sheen */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/15 to-transparent -translate-x-full animate-[shimmer_2.5s_infinite] pointer-events-none" />

              {/* Pack Center Clean Emblem */}
              <div className="relative flex flex-col items-center justify-center my-auto">
                <div className="relative">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 6, ease: 'linear' }}
                    className="w-14 h-14 rounded-full border border-dashed border-white/20 flex items-center justify-center"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <IconComponent className={cn("w-7 h-7 drop-shadow-[0_0_12px_currentColor]", tierConfig.color)} />
                  </div>
                </div>
                <h3 className="mt-3 font-headline text-base sm:text-lg font-black text-white tracking-widest italic drop-shadow-md">
                  P+ CARDER
                </h3>
              </div>

              {/* Pack Bottom Hologram Line */}
              <div className="w-full text-center shrink-0">
                <div className="h-1 w-full bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full mb-1" />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Minimal Action Cue (簡潔單行提示) */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-3 text-center space-y-2 w-full max-w-xs"
        >
          <div className={cn("text-sm sm:text-base font-headline font-black tracking-widest drop-shadow", tierConfig.color)}>
            {tierConfig.title}
          </div>

          {/* Interactive Slide/Tap Capsule */}
          <div className="relative overflow-hidden w-full px-4 py-2 rounded-full bg-slate-900/90 border border-cyan-400/50 shadow-[0_0_20px_rgba(6,182,212,0.3)] flex items-center justify-between text-cyan-200 text-xs font-bold active:scale-98 transition-all">
            {/* Live Drag Progress Fill */}
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500/40 to-amber-500/40 pointer-events-none transition-all duration-75"
              style={{ width: `${swipeProgress}%` }}
            />

            <div className="relative z-10 flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-amber-300 rotate-90" />
              <span className="tracking-wider">
                {stage === 'idle' ? tierConfig.hint : '⚡ 正在撕開...'}
              </span>
            </div>

            <ArrowRight className="relative z-10 w-3.5 h-3.5 text-cyan-300 animate-bounce" />
          </div>
        </motion.div>
      </div>

      {/* Bottom Subtitle Guide */}
      <div className="w-full text-center z-20 shrink-0 pb-1">
        <p className="text-[11px] text-slate-500 font-medium tracking-wide">
          向右滑動或點擊螢幕撕開
        </p>
      </div>
    </div>
  );
}
