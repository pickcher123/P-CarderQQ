'use client';

import { useMemo } from 'react';
import { Star, Sparkles, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CelebrationVFXProps {
  type: 'none' | 'rare' | 'legendary';
}

export function CelebrationVFX({ type }: CelebrationVFXProps) {
  const isNone = type === 'none';
  const isLegendary = type === 'legendary';
  const colorClass = isLegendary ? 'text-amber-300' : 'text-cyan-400';
  const starCount = isLegendary ? 56 : 28;

  // Memoize particle bursts
  const stars = useMemo(() => {
    if (isNone) return [];
    return Array.from({ length: starCount }).map((_, i) => ({
      id: i,
      rotation: i * (360 / starCount) + (Math.random() * 15 - 7.5),
      translation: 90 + Math.random() * (isLegendary ? 520 : 280),
      delay: Math.random() * 0.5,
      size: isLegendary ? (i % 3 === 0 ? "w-6 h-6 sm:w-8 sm:h-8" : "w-4 h-4 sm:w-5 sm:h-5") : "w-3 h-3 sm:w-4 sm:h-4",
    }));
  }, [starCount, isLegendary, isNone]);

  // Floating ambient embers
  const embers = useMemo(() => {
    if (!isLegendary) return [];
    return Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 4 + Math.random() * 6,
      duration: 2.5 + Math.random() * 2,
      delay: Math.random() * 1.5,
    }));
  }, [isLegendary]);

  if (isNone) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
      {/* 1. 震撼瞬間金白強光全螢幕閃光 (Instant Full-Screen Flash) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, isLegendary ? 0.95 : 0.6, 0] }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className={cn(
          "absolute inset-0 z-50",
          isLegendary ? "bg-gradient-to-b from-amber-100 via-yellow-200 to-amber-400/40" : "bg-cyan-100/70"
        )}
      />

      {/* 2. 全螢幕暗角聚光與黃金光暈氛圍 (Cinematic Vignette) */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
        className={cn(
          "absolute inset-0 z-10 transition-all",
          isLegendary 
            ? "shadow-[inset_0_0_140px_rgba(0,0,0,0.9),inset_0_0_80px_rgba(245,158,11,0.5)] bg-amber-950/20" 
            : "shadow-[inset_0_0_80px_rgba(6,182,212,0.3)] bg-cyan-950/15"
        )}
      />

      {/* 3. 360 度旋轉傳奇天光射線 (Volumetric God Rays for Legendary) */}
      {isLegendary && (
        <motion.div
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 0.5, scale: 1, rotate: 360 }}
          transition={{
            opacity: { duration: 0.8 },
            scale: { duration: 0.8, ease: "easeOut" },
            rotate: { duration: 24, ease: "linear", repeat: Infinity },
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160vw] h-[160vw] max-w-[1400px] max-h-[1400px] pointer-events-none z-10"
          style={{
            background: `conic-gradient(
              from 0deg,
              transparent 0deg,
              rgba(251, 191, 36, 0.4) 15deg,
              transparent 30deg,
              transparent 45deg,
              rgba(245, 158, 11, 0.35) 60deg,
              transparent 75deg,
              transparent 90deg,
              rgba(251, 191, 36, 0.4) 105deg,
              transparent 120deg,
              transparent 135deg,
              rgba(245, 158, 11, 0.35) 150deg,
              transparent 165deg,
              transparent 180deg,
              rgba(251, 191, 36, 0.4) 195deg,
              transparent 210deg,
              transparent 225deg,
              rgba(245, 158, 11, 0.35) 240deg,
              transparent 255deg,
              transparent 270deg,
              rgba(251, 191, 36, 0.4) 285deg,
              transparent 300deg,
              transparent 315deg,
              rgba(245, 158, 11, 0.35) 330deg,
              transparent 345deg,
              transparent 360deg
            )`
          }}
        />
      )}

      {/* 4. 核心同心圓衝擊波光波 (Expanding Radial Shockwave Aura) */}
      <motion.div 
        initial={{ scale: 0.2, opacity: 1 }}
        animate={{ 
          scale: isLegendary ? [0.4, 1.4, 1.1] : [0.3, 1.1, 1],
          opacity: isLegendary ? [0.9, 0.5, 0.7] : [0.8, 0.4, 0.5] 
        }}
        transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full pointer-events-none z-15"
        style={{ 
          background: isLegendary 
            ? 'radial-gradient(circle, rgba(245,158,11,0.65) 0%, rgba(251,191,36,0.3) 40%, transparent 75%)' 
            : 'radial-gradient(circle, rgba(6,182,212,0.45) 0%, transparent 70%)'
        }} 
      />

      {/* 5. 傳奇專屬：全螢幕震撼橫幅 (Legendary Impact Banner) */}
      {isLegendary && (
        <motion.div
          initial={{ scale: 2.2, opacity: 0, y: -70, filter: 'blur(20px)' }}
          animate={{ scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ 
            type: "spring",
            stiffness: 280,
            damping: 18,
            mass: 0.9,
            delay: 0.05
          }}
          className="absolute top-12 sm:top-14 inset-x-0 flex flex-col items-center justify-center z-40 px-3 pointer-events-none"
        >
          <div className="relative group">
            {/* 炫彩外發光脈衝 */}
            <div className="absolute -inset-1.5 rounded-full bg-gradient-to-r from-amber-500 via-yellow-300 to-amber-600 blur-xl opacity-90 animate-pulse" />
            
            {/* 黑金尊爵勳章膠囊 */}
            <div className="relative px-5 sm:px-8 py-2 sm:py-2.5 rounded-full bg-gradient-to-r from-[#171105] via-[#2d2105] to-[#171105] border-2 border-yellow-300 text-yellow-100 font-headline font-black uppercase tracking-[0.25em] shadow-[0_0_50px_rgba(245,158,11,0.9),0_0_20px_rgba(253,224,71,0.8)] flex items-center gap-2.5 sm:gap-3.5">
              <Crown className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300 fill-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,1)] animate-bounce" />
              
              <div className="flex flex-col items-center leading-none">
                <span className="text-xs sm:text-base font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-100 via-amber-200 to-yellow-300 tracking-[0.3em] drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)]">
                  ✦ 傳奇大獎現世 ✦
                </span>
                <span className="text-[9px] sm:text-[10px] text-amber-400/90 font-bold tracking-[0.25em] mt-0.5">
                  LEGENDARY CARD REVEAL
                </span>
              </div>
              
              <Sparkles className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-300 fill-yellow-300 drop-shadow-[0_0_12px_rgba(253,224,71,1)] animate-spin-slow" />
            </div>
          </div>
        </motion.div>
      )}

      {/* 6. 四面擴散流星金星炸裂粒子 (Star Bursts) */}
      {stars.map((star) => (
        <div 
          key={star.id} 
          className={cn("absolute animate-firework z-30", colorClass)}
          style={{ 
            left: '50%', 
            top: '50%',
            transform: `rotate(${star.rotation}deg) translate(${star.translation}px)`,
            animationDelay: `${star.delay}s`,
            opacity: 0
          }}
        >
          <Star className={cn(star.size, "fill-current drop-shadow-[0_0_14px_currentColor]")} />
        </div>
      ))}

      {/* 7. 傳奇專屬：向上飄散的金粉火花 (Floating Golden Embers) */}
      {isLegendary && embers.map((ember) => (
        <motion.div
          key={ember.id}
          initial={{ 
            x: `${ember.left}vw`, 
            y: '105vh', 
            opacity: 0, 
            scale: 0.5 
          }}
          animate={{ 
            y: '-10vh', 
            opacity: [0, 0.9, 0.8, 0],
            scale: [0.5, 1.2, 0.8] 
          }}
          transition={{ 
            duration: ember.duration, 
            delay: ember.delay,
            repeat: Infinity,
            ease: "easeOut"
          }}
          className="absolute rounded-full bg-gradient-to-t from-amber-400 to-yellow-200 shadow-[0_0_12px_rgba(251,191,36,0.9)] z-20 pointer-events-none"
          style={{
            width: ember.size,
            height: ember.size,
          }}
        />
      ))}
    </div>
  );
}
