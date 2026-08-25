'use client';

import { useMemo } from 'react';
import { Star, Sparkles, Flame, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface CelebrationVFXProps {
  type: 'none' | 'rare' | 'legendary';
}

export function CelebrationVFX({ type }: CelebrationVFXProps) {
  const isNone = type === 'none';
  const isLegendary = type === 'legendary';
  const colorClass = isLegendary ? 'text-amber-400' : 'text-cyan-400';
  const glowColor = isLegendary ? 'rgba(245,158,11,0.5)' : 'rgba(6,182,212,0.3)';
  const starCount = isLegendary ? 50 : 32;

  // Memoize particle bursts
  const stars = useMemo(() => {
    if (isNone) return [];
    return Array.from({ length: starCount }).map((_, i) => ({
      id: i,
      rotation: i * (360 / starCount),
      translation: 80 + Math.random() * (isLegendary ? 500 : 300),
      delay: Math.random() * 0.7,
      size: isLegendary ? "w-6 h-6 md:w-8 md:h-8" : "w-4 h-4 md:w-6 md:h-6",
    }));
  }, [starCount, isLegendary, isNone]);

  if (isNone) return null;

  return (
    <div className="absolute inset-0 pointer-events-none z-[100] overflow-hidden">
      {/* Background Flash Burst */}
      <div
        className={cn(
          "absolute inset-0 transition-opacity duration-1000",
          isLegendary ? "bg-amber-500/15" : "bg-cyan-500/10"
        )}
      />

      {/* Radial Burst Ripple */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full animate-glow-burst" 
        style={{ background: `radial-gradient(circle, ${glowColor} 0%, transparent 70%)` }} 
      />

      {/* Legendary Tier Banner Text */}
      {isLegendary && (
        <motion.div
          initial={{ scale: 0.5, opacity: 0, y: -50 }}
          animate={{ scale: [0.5, 1.2, 1], opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'backOut' }}
          className="absolute top-20 inset-x-0 flex flex-col items-center justify-center z-40"
        >
          <div className="px-6 py-2 rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 text-slate-950 font-black text-sm md:text-base font-headline uppercase tracking-[0.3em] shadow-[0_0_40px_rgba(245,158,11,0.8)] border border-yellow-200 flex items-center gap-2 animate-pulse">
            <Crown className="w-5 h-5 fill-slate-950" />
            <span>LEGENDARY REVEAL</span>
            <Crown className="w-5 h-5 fill-slate-950" />
          </div>
        </motion.div>
      )}

      {/* Bursting Star & Sparkle Particles */}
      {stars.map((star) => (
        <div 
          key={star.id} 
          className={cn("absolute animate-firework", colorClass)}
          style={{ 
            left: '50%', 
            top: '50%',
            transform: `rotate(${star.rotation}deg) translate(${star.translation}px)`,
            animationDelay: `${star.delay}s`,
            opacity: 0
          }}
        >
          <Star className={cn(star.size, "fill-current drop-shadow-[0_0_10px_currentColor]")} />
        </div>
      ))}
    </div>
  );
}
