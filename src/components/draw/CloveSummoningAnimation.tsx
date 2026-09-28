'use client';

import React, { useState, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Flame, Crown, FastForward, Layers, Scissors, ArrowRight, Disc3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { SafeImage } from '@/components/safe-image';

export interface CloveSummoningAnimationProps {
  highestRarity: 'common' | 'rare' | 'legendary' | string;
  drawCount: number;
  poolName?: string;
  backgroundUrl?: string;
  onAnimationComplete: () => void;
}

type Stage = 'idle' | 'tearing' | 'burst';

export function CloveSummoningAnimation({
  highestRarity,
  drawCount,
  poolName = '典藏卡包',
  backgroundUrl,
  onAnimationComplete,
}: CloveSummoningAnimationProps) {
  const [stage, setStage] = useState<Stage>('idle');
  const [hasTapped, setHasTapped] = useState(false);
  const [swipeProgress, setSwipeProgress] = useState(0); // 0 to 100
  const touchStartXRef = useRef<number | null>(null);

  const isLegendary = highestRarity === 'legendary';
  const isRare = highestRarity === 'rare';

  // 頂級質感主題配色（溫潤柔和、去除刺眼科技感）
  const tierConfig = useMemo(() => {
    if (isLegendary) {
      return {
        title: 'GOD PACK',
        subtitle: '傳說大獎感應中',
        color: 'text-amber-200',
        packAccent: 'from-amber-300 via-yellow-200 to-amber-500',
        badgeBg: 'bg-amber-400/90 text-slate-950 font-black',
        ambientGradient: 'radial-gradient(circle at 50% 45%, rgba(245, 158, 11, 0.25) 0%, rgba(180, 83, 9, 0.12) 40%, transparent 70%)',
        foilShine: 'from-transparent via-amber-200/25 to-transparent',
        sealTint: 'text-amber-400/80',
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
        foilShine: 'from-transparent via-sky-200/20 to-transparent',
        sealTint: 'text-sky-400/80',
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
      foilShine: 'from-transparent via-white/15 to-transparent',
      sealTint: 'text-slate-400/70',
      glowColor: 'rgba(255, 255, 255, 0.2)',
      icon: Sparkles,
    };
  }, [isLegendary, isRare]);

  // 觸發撕開動效（柔和、順暢推進）
  const executeOpen = () => {
    if (stage !== 'idle' || hasTapped) return;
    setHasTapped(true);
    setSwipeProgress(100);
    setStage('tearing');

    // 階段一：鋁箔封口自然撕裂掀開 (600ms)
    setTimeout(() => {
      setStage('burst');
    }, 600);

    // 階段二：內部卡片柔和升起，銜接進入開牌畫面 (1800ms)
    setTimeout(() => {
      onAnimationComplete();
    }, 1800);
  };

  // 觸控滑動支援
  const handleTouchStart = (e: React.TouchEvent) => {
    if (stage !== 'idle') return;
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (stage !== 'idle' || touchStartXRef.current === null) return;
    const currentX = e.touches[0].clientX;
    const diff = currentX - touchStartXRef.current;
    if (diff > 0) {
      const progress = Math.min(Math.max((diff / 120) * 100, 0), 100);
      setSwipeProgress(progress);
      if (progress >= 65) {
        executeOpen();
      }
    }
  };

  const handleTouchEnd = () => {
    if (stage !== 'idle') return;
    if (swipeProgress < 65) {
      setSwipeProgress(0);
    }
    touchStartXRef.current = null;
  };

  // 滑鼠拖曳支援
  const handleMouseDown = (e: React.MouseEvent) => {
    if (stage !== 'idle') return;
    touchStartXRef.current = e.clientX;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (stage !== 'idle' || touchStartXRef.current === null) return;
    const diff = e.clientX - touchStartXRef.current;
    if (diff > 0) {
      const progress = Math.min(Math.max((diff / 120) * 100, 0), 100);
      setSwipeProgress(progress);
      if (progress >= 65) {
        executeOpen();
      }
    }
  };

  const handleMouseUp = () => {
    if (stage !== 'idle') return;
    if (swipeProgress < 65) {
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
      className="fixed inset-0 z-[120] flex flex-col items-center justify-between select-none overflow-hidden touch-none cursor-pointer py-4 sm:py-6"
    >
      {/* 1. 溫潤展示背景 (去除生硬科技網格，呈現高級展示台質感) */}
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
      <div className="absolute inset-0 bg-slate-950/65 backdrop-blur-[3px] -z-40 pointer-events-none" />

      {/* 柔和聚光燈環境光暈 (柔美擴散) */}
      <div
        className="absolute inset-0 transition-opacity duration-1000 pointer-events-none -z-30"
        style={{ background: tierConfig.ambientGradient }}
      />

      {/* 頂部極簡卡池資訊與跳過按鈕 */}
      <div className="w-full max-w-3xl px-4 flex items-center justify-between z-30 shrink-0">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/70 border border-white/10 backdrop-blur-md shadow-sm">
          <Layers className="w-3.5 h-3.5 text-slate-300" />
          <span className="text-xs font-semibold text-slate-200 truncate max-w-[150px] sm:max-w-[220px]">
            {poolName}
          </span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/10 text-white font-mono font-bold">
            {drawCount} 抽
          </span>
        </div>

        <Button
          onClick={handleSkip}
          variant="ghost"
          size="sm"
          className="h-8 px-3.5 rounded-full bg-slate-900/60 hover:bg-white/15 border border-white/10 text-slate-200 hover:text-white font-semibold text-xs tracking-wider gap-1.5 backdrop-blur-md active:scale-95 transition-all"
        >
          <FastForward className="w-3 h-3 text-slate-300" />
          <span>跳過</span>
        </Button>
      </div>

      {/* 中心舞台：實體鋁箔卡包與撕包動效 */}
      <div className="relative flex-1 flex flex-col items-center justify-center z-20 w-full max-w-sm px-4 min-h-0">
        
        <div className="relative w-64 h-88 sm:w-72 sm:h-96 flex items-center justify-center">
          
          {/* 卡包背後柔美微光暈 (捨棄突兀刺眼的旋轉虛線圈圈，改為呼吸暖光) */}
          <div 
            className="absolute w-56 h-72 sm:w-64 sm:h-80 rounded-3xl blur-2xl opacity-40 pointer-events-none transition-all duration-700"
            style={{ 
              background: tierConfig.glowColor,
              transform: stage === 'burst' ? 'scale(1.4)' : 'scale(1)',
              opacity: stage === 'burst' ? 0.8 : 0.4 
            }}
          />

          {/* 溫潤金粉星塵飄散 (柔和緩慢升騰，非死板旋轉) */}
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            {[...Array(isLegendary ? 16 : 10)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute rounded-full pointer-events-none bg-white"
                style={{
                  width: (i % 3 === 0 ? 3 : 2) + 'px',
                  height: (i % 3 === 0 ? 3 : 2) + 'px',
                  left: `${20 + (i * 19) % 65}%`,
                  top: `${30 + (i * 23) % 55}%`,
                  boxShadow: `0 0 6px ${isLegendary ? '#fbbf24' : '#93c5fd'}`,
                  opacity: 0.6,
                }}
                animate={{
                  y: [0, -35 - (i % 4) * 8],
                  opacity: [0.2, 0.8, 0],
                  scale: [0.8, 1.2, 0.4],
                }}
                transition={{
                  duration: 2.2 + (i % 3) * 0.6,
                  repeat: Infinity,
                  ease: 'easeInOut',
                  delay: (i * 0.18),
                }}
              />
            ))}
          </div>

          {/* 實體鋁箔卡包容器 (AUTHENTIC FOIL BOOSTER PACK) */}
          <div className="relative z-10 w-44 h-74 sm:w-48 sm:h-82 flex flex-col items-center drop-shadow-[0_16px_35px_rgba(0,0,0,0.7)]">
            
            {/* 1. 卡包頂部封口：帶有真實鋸齒壓紋 (Crimped Seal Top) */}
            <motion.div
              initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
              animate={
                stage === 'idle'
                  ? { 
                      y: [0, -2, 0],
                      x: (swipeProgress / 100) * 18,
                      rotate: (swipeProgress / 100) * 4,
                    }
                  : stage === 'tearing'
                  ? {
                      x: [0, 45, 95],
                      y: [0, -18, -45],
                      rotate: [0, 14, 28],
                      opacity: [1, 0.85, 0],
                    }
                  : { opacity: 0, y: -60, x: 100 }
              }
              transition={{
                duration: stage === 'idle' ? 2.8 : 0.6,
                repeat: stage === 'idle' ? Infinity : 0,
                ease: [0.22, 1, 0.36, 1], // 優雅阻尼
              }}
              className="relative w-full h-11 sm:h-12 rounded-t-lg bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border-t border-x border-white/20 shadow-md overflow-hidden flex flex-col justify-between p-2 z-20"
            >
              {/* 頂部鋸齒紋路 (Zigzag Foil Edge) */}
              <div className="absolute top-0 inset-x-0 h-1 flex justify-between overflow-hidden opacity-50">
                {[...Array(24)].map((_, i) => (
                  <div key={i} className="w-1.5 h-1 border-t border-r border-slate-500/80 -rotate-45 shrink-0" />
                ))}
              </div>

              {/* 柔和鋁箔流光 */}
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/12 to-transparent -translate-x-full animate-[shimmer_3.5s_infinite] pointer-events-none" />

              {/* 頂部精簡資訊 */}
              <div className="flex items-center justify-between w-full px-1 pt-1">
                <span className="text-[8px] font-semibold tracking-wider text-slate-300 uppercase">
                  OFFICIAL PACK
                </span>
                <span className={cn("text-[8px] px-2 py-0.5 rounded-full shadow-2xs font-bold", tierConfig.badgeBg)}>
                  {drawCount} PACK
                </span>
              </div>

              {/* 典雅撕紙虛線引導 (Soft Perforation Line) */}
              <div className="relative flex items-center justify-between border-t border-dashed border-amber-300/40 pt-1 mt-0.5">
                <div className="flex items-center gap-1.5">
                  <Scissors className="w-2.5 h-2.5 text-amber-300/90" />
                  <span className="text-[7px] font-semibold tracking-widest text-amber-200/90">
                    PULL TO TEAR
                  </span>
                </div>
                {/* 輕量滑動指示進度 */}
                <div className="h-0.5 w-14 bg-white/15 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-amber-300 to-amber-100 transition-all duration-100 rounded-full" 
                    style={{ width: `${Math.max(swipeProgress, 12)}%` }}
                  />
                </div>
              </div>
            </motion.div>

            {/* 2. 內部卡片優雅升騰 (Stage 2: 柔順浮出，去除生硬感) */}
            <motion.div
              initial={{ y: 15, opacity: 0, scale: 0.9 }}
              animate={
                stage === 'tearing'
                  ? { y: [-5, -20], opacity: [0.4, 0.9], scale: [0.9, 0.95] }
                  : stage === 'burst'
                  ? { 
                      y: [-20, -50], 
                      scale: [0.95, 1.04], 
                      opacity: [0.9, 1],
                    }
                  : { opacity: 0 }
              }
              transition={{ duration: stage === 'burst' ? 0.75 : 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute top-2 w-[145px] aspect-[2.5/4] z-10 pointer-events-none flex items-center justify-center"
            >
              {/* 精緻深色卡背：呈現品牌高雅質感 */}
              <div className="relative p-1 bg-slate-950/95 border-2 border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden w-full aspect-[2.5/4] flex items-center justify-center">
                <div className="relative w-full h-full bg-slate-900 rounded-xl border border-cyan-500/30 flex flex-col items-center justify-center pointer-events-none select-none overflow-hidden p-2">
                  <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/30 via-slate-900 to-slate-950" />
                  
                  {/* 品牌卡背標誌 */}
                  <div className="relative flex flex-col items-center">
                    <Disc3 className="w-8 h-8 text-cyan-400/80 animate-spin-slow mb-1.5" />
                    <span className="font-headline text-[11px] font-black text-white tracking-widest drop-shadow-sm">
                      P+ CARDER
                    </span>
                    <span className="text-[7px] text-cyan-300/70 font-semibold tracking-wider mt-1">
                      COLLECTIBLES
                    </span>
                  </div>

                  {/* 柔和流光 */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2s_infinite] pointer-events-none" />
                </div>
              </div>
            </motion.div>

            {/* 3. 卡包本體 (REALISTIC METALLIC FOIL PACK BODY) */}
            <motion.div
              animate={
                stage === 'idle'
                  ? { y: [0, 2, 0] }
                  : stage === 'tearing'
                  ? { 
                      y: [0, 4, 1],
                      scale: [1, 1.01, 1],
                    }
                  : { 
                      scale: [1, 1.08, 0.95],
                      opacity: [1, 0.6, 0],
                      filter: 'brightness(1.5)',
                    }
              }
              transition={{
                duration: stage === 'idle' ? 2.8 : 0.5,
                repeat: stage === 'idle' ? Infinity : 0,
                ease: 'easeInOut',
              }}
              className="relative w-full flex-1 rounded-b-lg bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-b border-x border-white/20 shadow-xl overflow-hidden flex flex-col items-center justify-between p-3.5 z-10 -mt-0.5"
            >
              {/* 鋁箔金屬細膩微反光 (Soft Satin Sheen) */}
              <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/8 to-transparent -translate-x-full animate-[shimmer_3.5s_infinite] pointer-events-none" />

              {/* 橫向鋁箔壓痕 (Embossed Foil Details) */}
              <div className="absolute top-2 inset-x-3 h-px bg-white/10" />
              <div className="absolute bottom-6 inset-x-3 h-px bg-white/10" />

              {/* 卡包中央典雅盾牌燙金/燙銀徽章 (取代生硬的虛線旋轉圈圈) */}
              <div className="relative flex flex-col items-center justify-center my-auto">
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-b from-white/10 to-white/5 border border-white/15 backdrop-blur-xs flex items-center justify-center shadow-inner">
                  {/* 柔光環 */}
                  <div className="absolute inset-1 rounded-xl border border-white/10 pointer-events-none" />
                  <IconComponent className={cn("w-7 h-7 drop-shadow-md", tierConfig.color)} />
                </div>

                {/* 品牌名稱 */}
                <h3 className="mt-3 font-headline text-sm sm:text-base font-black text-white tracking-widest drop-shadow-sm">
                  P+ CARDER
                </h3>
                <p className="text-[8px] text-slate-400 font-medium tracking-widest uppercase mt-0.5">
                  PREMIUM TRADING CARDS
                </p>
              </div>

              {/* 底部鋸齒壓邊封口 (Bottom Crimp Edge) */}
              <div className="w-full text-center shrink-0">
                <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-white/25 to-transparent mb-1.5" />
                <div className="flex justify-between overflow-hidden opacity-40 px-1">
                  {[...Array(22)].map((_, i) => (
                    <div key={i} className="w-1.5 h-1 border-b border-r border-slate-500/80 -rotate-45 shrink-0" />
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* 底部互動指引膠囊 (Minimalist Frosted Pill - 溫潤磨砂質感，非生硬霓虹) */}
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="mt-4 text-center space-y-1.5 w-full max-w-xs"
        >
          {/* 卡包標題 */}
          <div className={cn("text-xs sm:text-sm font-headline font-black tracking-widest drop-shadow-sm", tierConfig.color)}>
            ✦ {tierConfig.title} ✦
          </div>

          {/* 磨砂互動膠囊按鈕 */}
          <div className="relative overflow-hidden w-full px-4 py-2.5 rounded-full bg-slate-900/75 border border-white/15 backdrop-blur-md shadow-md flex items-center justify-between text-slate-200 text-xs font-medium hover:border-white/30 transition-all">
            {/* 滑動填充反饋 */}
            <div 
              className="absolute inset-y-0 left-0 bg-white/15 pointer-events-none transition-all duration-100"
              style={{ width: `${swipeProgress}%` }}
            />

            <div className="relative z-10 flex items-center gap-2">
              <Scissors className="w-3.5 h-3.5 text-amber-300" />
              <span className="font-semibold text-xs text-slate-100">
                {stage === 'idle' ? '輕觸或滑動拆開卡包' : stage === 'tearing' ? '正在拆開...' : '✨ 揭曉卡片...'}
              </span>
            </div>

            <ArrowRight className="relative z-10 w-3.5 h-3.5 text-slate-400 animate-pulse" />
          </div>
        </motion.div>
      </div>

      {/* 底部極簡輔助文字 */}
      <div className="w-full text-center z-20 shrink-0 pb-1">
        <p className="text-[11px] text-slate-400/80 font-normal">
          點擊畫面或向右滑動拆開
        </p>
      </div>
    </div>
  );
}
