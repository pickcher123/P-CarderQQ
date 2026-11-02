'use client';

import { useMemo } from 'react';

export function StarrySky() {
  // 最佳化星星數量至 45 顆並使用 translateZ(0) 硬體加速，徹底避免 90 個 box-shadow 同時重繪導致的卡頓
  const stars = useMemo(() => {
    return Array.from({ length: 45 }).map((_, i) => ({
      id: i,
      x: ((i * 19 + 27) % 98) + (i % 3) * 0.4,
      y: ((i * 29 + 33) % 96) + (i % 4) * 0.4,
      size: (i % 6 === 0 ? 2.5 : i % 3 === 0 ? 1.8 : 1.2),
      opacity: 0.28 + (i % 5) * 0.14,
      delay: (i % 6) * 0.7,
      duration: 3 + (i % 4) * 1.2,
      color: i % 11 === 0 ? 'rgba(251, 191, 36, 0.9)' : i % 5 === 0 ? 'rgba(56, 189, 248, 0.9)' : 'rgba(255, 255, 255, 0.95)',
    }));
  }, []);

  const shootingStars = useMemo(() => {
    return [
      { id: 1, top: '15%', left: '75%', delay: '0s', duration: '7s' },
      { id: 2, top: '35%', left: '40%', delay: '4s', duration: '9s' },
    ];
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" style={{ transform: 'translateZ(0)' }}>
      {/* Deep Space Nebula Radial Layers */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[400px] bg-indigo-950/30 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[450px] h-[450px] bg-sky-950/25 rounded-full blur-[110px] pointer-events-none" />

      {/* Twinkling Starfield */}
      {stars.map((star) => (
        <div
          key={star.id}
          className="absolute rounded-full animate-pulse"
          style={{
            left: `${star.x}%`,
            top: `${star.y}%`,
            width: `${star.size}px`,
            height: `${star.size}px`,
            backgroundColor: star.color,
            boxShadow: star.size > 2 ? `0 0 6px ${star.color}` : `0 0 2px ${star.color}`,
            opacity: star.opacity,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
            willChange: 'opacity',
          }}
        />
      ))}

      {/* Cinematic Shooting Stars (流星) */}
      {shootingStars.map((meteor) => (
        <div
          key={meteor.id}
          className="absolute w-[100px] h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent -rotate-45 animate-[meteor_linear_infinite]"
          style={{
            top: meteor.top,
            left: meteor.left,
            animationDelay: meteor.delay,
            animationDuration: meteor.duration,
            willChange: 'transform',
          }}
        />
      ))}
    </div>
  );
}
