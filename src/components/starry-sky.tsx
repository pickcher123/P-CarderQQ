'use client';

import { useMemo } from 'react';

export function StarrySky() {
  // Generate static random stars to avoid hydration mismatch
  const stars = useMemo(() => {
    return Array.from({ length: 90 }).map((_, i) => ({
      id: i,
      x: ((i * 17 + 31) % 100) + (i % 3) * 0.2,
      y: ((i * 23 + 47) % 100) + (i % 4) * 0.2,
      size: (i % 7 === 0 ? 3 : i % 3 === 0 ? 2 : 1.2),
      opacity: 0.25 + (i % 5) * 0.15,
      delay: (i % 6) * 0.7,
      duration: 2.5 + (i % 4) * 1.2,
      color: i % 11 === 0 ? 'rgba(251, 191, 36, 0.9)' : i % 5 === 0 ? 'rgba(56, 189, 248, 0.9)' : 'rgba(255, 255, 255, 0.95)',
    }));
  }, []);

  const shootingStars = useMemo(() => {
    return [
      { id: 1, top: '15%', left: '75%', delay: '0s', duration: '6s' },
      { id: 2, top: '35%', left: '40%', delay: '3.5s', duration: '8s' },
      { id: 3, top: '8%', left: '20%', delay: '7s', duration: '7s' },
    ];
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* Deep Space Nebula Radial Layers */}
      <div className="absolute top-0 left-1/4 w-[700px] h-[500px] bg-indigo-950/40 rounded-full blur-[140px]" />
      <div className="absolute top-1/3 right-1/4 w-[600px] h-[600px] bg-sky-950/30 rounded-full blur-[160px]" />
      <div className="absolute bottom-1/4 left-1/3 w-[500px] h-[500px] bg-purple-950/25 rounded-full blur-[150px]" />

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
            boxShadow: star.size > 2 ? `0 0 8px ${star.color}` : `0 0 3px ${star.color}`,
            opacity: star.opacity,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
          }}
        />
      ))}

      {/* Cinematic Shooting Stars (流星) */}
      {shootingStars.map((meteor) => (
        <div
          key={meteor.id}
          className="absolute w-[120px] h-[1.5px] bg-gradient-to-r from-transparent via-white/80 to-transparent -rotate-45 animate-[meteor_linear_infinite]"
          style={{
            top: meteor.top,
            left: meteor.left,
            animationDelay: meteor.delay,
            animationDuration: meteor.duration,
            boxShadow: '0 0 10px rgba(255,255,255,0.8)',
          }}
        />
      ))}
    </div>
  );
}
