'use client';

import { useMemo } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, useReducedMotion } from 'framer-motion';

interface CelebrationVFXProps {
  type: 'none' | 'rare' | 'legendary';
}

export function CelebrationVFX({ type }: CelebrationVFXProps) {
  const shouldReduceMotion = useReducedMotion();
  const isNone = type === 'none';
  const isLegendary = type === 'legendary';
  const colorClass = isLegendary ? 'text-amber-300' : 'text-cyan-400';
  const starCount = isLegendary ? 22 : 12;

  // Memoize particle bursts (GPU-friendly count)
  const stars = useMemo(() => {
    if (isNone) return [];
    return Array.from({ length: starCount }).map((_, i) => ({
      id: i,
      rotation: i * (360 / starCount) + (Math.random() * 12 - 6),
      translation: 80 + Math.random() * (isLegendary ? 380 : 220),
      delay: Math.random() * 0.35,
      size: isLegendary ? (i % 3 === 0 ? "w-5 h-5 sm:w-6 sm:h-6" : "w-3.5 h-3.5 sm:w-4 sm:h-4") : "w-3 h-3 sm:w-3.5 sm:h-3.5",
    }));
  }, [starCount, isLegendary, isNone]);

  // Floating ambient embers
  const embers = useMemo(() => {
    if (!isLegendary) return [];
    return Array.from({ length: 12 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      size: 4 + Math.random() * 4,
      duration: 2.0 + Math.random() * 1.5,
      delay: Math.random() * 1.0,
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
        transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
        className={cn(
          "absolute inset-0 z-10 transition-opacity duration-300",
          isLegendary 
            ? "shadow-[inset_0_0_140px_rgba(0,0,0,0.9),inset_0_0_80px_rgba(245,158,11,0.5)] bg-amber-950/20" 
            : "shadow-[inset_0_0_80px_rgba(6,182,212,0.3)] bg-cyan-950/15"
        )}
      />

      {/* 3. 360 度旋轉傳奇天光射線 (Volumetric God Rays for Legendary) */}
      {isLegendary && (
        <motion.div
          initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.9 }}
          animate={shouldReduceMotion ? { opacity: 0.35, scale: 1 } : { opacity: 0.5, scale: 1, rotate: 360 }}
          transition={shouldReduceMotion ? {
            opacity: { duration: 0.25 },
          } : {
            opacity: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
            scale: { duration: 0.5, ease: [0.23, 1, 0.32, 1] },
            rotate: { duration: 24, ease: "linear", repeat: Infinity },
          }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[160vw] h-[160vw] max-w-[1400px] max-h-[1400px] pointer-events-none z-10 will-change-transform"
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
        initial={{ scale: shouldReduceMotion ? 1 : 0.9, opacity: 0.7 }}
        animate={shouldReduceMotion ? { scale: 1, opacity: 0.55 } : { 
          scale: isLegendary ? [0.85, 1.35, 1.05] : [0.9, 1.1, 1],
          opacity: isLegendary ? [0.85, 0.5, 0.7] : [0.75, 0.4, 0.5] 
        }}
        transition={shouldReduceMotion ? { duration: 0.25 } : { duration: 1.5, repeat: Infinity, repeatType: "reverse", ease: "easeInOut" }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[550px] rounded-full pointer-events-none z-15 will-change-transform"
        style={{ 
          background: isLegendary 
            ? 'radial-gradient(circle, rgba(245,158,11,0.65) 0%, rgba(251,191,36,0.3) 40%, transparent 75%)' 
            : 'radial-gradient(circle, rgba(6,182,212,0.45) 0%, transparent 70%)'
        }} 
      />

      {/* 6. 四面擴散流星金星炸裂粒子 (Star Bursts) */}
      {!shouldReduceMotion && stars.map((star) => (
        <div 
          key={star.id} 
          className={cn("absolute animate-firework z-30 pointer-events-none will-change-transform transform-gpu", colorClass)}
          style={{ 
            left: '50%', 
            top: '50%',
            transform: `rotate(${star.rotation}deg) translate(${star.translation}px)`,
            animationDelay: `${star.delay}s`,
            opacity: 0
          }}
        >
          <Star className={cn(star.size, "fill-current opacity-90")} />
        </div>
      ))}

      {/* 7. 傳奇專屬：向上飄散的金粉火花 (Floating Golden Embers) */}
      {isLegendary && !shouldReduceMotion && embers.map((ember) => (
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
          className="absolute rounded-full bg-gradient-to-t from-amber-400 to-yellow-200 z-20 pointer-events-none will-change-transform transform-gpu"
          style={{
            width: ember.size,
            height: ember.size,
          }}
        />
      ))}
    </div>
  );
}
