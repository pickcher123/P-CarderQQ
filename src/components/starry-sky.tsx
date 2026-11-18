'use client';

import { useMemo } from 'react';

export function StarrySky() {
  // 基礎星點與進階亮星點綴（使用硬體加速並控制數量，維持流暢 60fps）
  const stars = useMemo(() => {
    return Array.from({ length: 65 }).map((_, i) => {
      const isBrightAccent = i % 9 === 0;
      const isMedium = i % 3 === 0;
      return {
        id: i,
        x: ((i * 17 + 13) % 97) + (i % 4) * 0.35,
        y: ((i * 23 + 19) % 95) + (i % 5) * 0.35,
        size: isBrightAccent ? 2.8 : isMedium ? 1.8 : 1.15,
        opacity: isBrightAccent ? 0.92 : 0.32 + (i % 5) * 0.13,
        delay: (i % 7) * 0.65,
        duration: 2.8 + (i % 4) * 1.1,
        color:
          i % 7 === 0
            ? 'rgba(253, 230, 138, 0.95)' // 香檳金亮星
            : i % 5 === 0
            ? 'rgba(125, 211, 252, 0.95)' // 冰藍亮星
            : 'rgba(255, 255, 255, 0.95)',
        isBrightAccent,
      };
    });
  }, []);

  // 特別亮眼的恆星（帶有四芒星芒光暈）
  const luminousStars = useMemo(() => {
    return [
      { id: 'ls-1', top: '14%', left: '16%', size: 18, color: '#FDE68A', glow: 'rgba(253, 230, 138, 0.55)', delay: '0s', duration: '4.2s' },
      { id: 'ls-2', top: '24%', left: '82%', size: 22, color: '#BAE6FD', glow: 'rgba(125, 211, 252, 0.55)', delay: '1.1s', duration: '5s' },
      { id: 'ls-3', top: '58%', left: '11%', size: 16, color: '#FFFFFF', glow: 'rgba(255, 255, 255, 0.5)', delay: '2.2s', duration: '4.6s' },
      { id: 'ls-4', top: '42%', left: '68%', size: 14, color: '#FDE68A', glow: 'rgba(251, 191, 36, 0.45)', delay: '0.7s', duration: '3.8s' },
      { id: 'ls-5', top: '76%', left: '84%', size: 20, color: '#FDE68A', glow: 'rgba(253, 230, 138, 0.5)', delay: '1.8s', duration: '4.8s' },
      { id: 'ls-6', top: '82%', left: '28%', size: 15, color: '#BAE6FD', glow: 'rgba(56, 189, 248, 0.45)', delay: '2.9s', duration: '5.4s' },
    ];
  }, []);

  // 遠方星系點綴（柔和漩渦／橢圓星系剪影，低透明度不搶前景視覺）
  const galaxies = useMemo(() => {
    return [
      {
        id: 'gal-1',
        top: '12%',
        left: '62%',
        width: 170,
        height: 76,
        rotate: '-18deg',
        coreColor: 'rgba(253, 230, 138, 0.42)',
        armColor: 'rgba(125, 211, 252, 0.16)',
        outerColor: 'rgba(99, 102, 241, 0.08)',
      },
      {
        id: 'gal-2',
        top: '66%',
        left: '14%',
        width: 145,
        height: 62,
        rotate: '24deg',
        coreColor: 'rgba(253, 230, 138, 0.36)',
        armColor: 'rgba(251, 191, 36, 0.14)',
        outerColor: 'rgba(56, 189, 248, 0.07)',
      },
      {
        id: 'gal-3',
        top: '36%',
        left: '34%',
        width: 110,
        height: 46,
        rotate: '-32deg',
        coreColor: 'rgba(186, 230, 253, 0.32)',
        armColor: 'rgba(165, 180, 252, 0.12)',
        outerColor: 'rgba(253, 230, 138, 0.05)',
      },
    ];
  }, []);

  const shootingStars = useMemo(() => {
    return [
      { id: 1, top: '15%', left: '75%', delay: '0s', duration: '7s' },
      { id: 2, top: '35%', left: '40%', delay: '4s', duration: '9s' },
      { id: 3, top: '62%', left: '85%', delay: '2.5s', duration: '11s' },
    ];
  }, []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0" style={{ transform: 'translateZ(0)' }}>
      {/* 深空星雲層 */}
      <div className="absolute top-0 left-1/4 w-[520px] h-[420px] bg-indigo-950/30 rounded-full blur-[110px] pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-[460px] h-[460px] bg-sky-950/25 rounded-full blur-[115px] pointer-events-none" />
      <div className="absolute bottom-0 left-1/3 w-[480px] h-[360px] bg-amber-950/15 rounded-full blur-[120px] pointer-events-none" />

      {/* 遠方星系點綴 */}
      {galaxies.map((gal) => (
        <div
          key={gal.id}
          className="absolute pointer-events-none"
          style={{
            top: gal.top,
            left: gal.left,
            width: `${gal.width}px`,
            height: `${gal.height}px`,
            transform: `rotate(${gal.rotate})`,
          }}
        >
          {/* 外圍星系盤面光暈 */}
          <div
            className="absolute inset-0 rounded-full blur-[10px]"
            style={{
              background: `radial-gradient(ellipse at center, ${gal.armColor} 0%, ${gal.outerColor} 55%, transparent 78%)`,
            }}
          />
          {/* 漩渦旋臂紋理 */}
          <div
            className="absolute inset-[18%] rounded-full blur-[3px] opacity-80"
            style={{
              background: `conic-gradient(from 30deg at 50% 50%, transparent 0deg, ${gal.armColor} 55deg, transparent 130deg, ${gal.armColor} 220deg, transparent 310deg)`,
            }}
          />
          {/* 明亮星系核心 */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-2 rounded-full blur-[2px]"
            style={{
              backgroundColor: gal.coreColor,
              boxShadow: `0 0 14px ${gal.coreColor}`,
            }}
          />
        </div>
      ))}

      {/* 閃爍星海 */}
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
            boxShadow: star.isBrightAccent
              ? `0 0 10px ${star.color}, 0 0 3px #ffffff`
              : star.size > 1.5
              ? `0 0 4px ${star.color}`
              : 'none',
            opacity: star.opacity,
            animationDuration: `${star.duration}s`,
            animationDelay: `${star.delay}s`,
            willChange: 'opacity',
          }}
        />
      ))}

      {/* 特別亮眼的恆星（四芒星芒 + 柔和光暈） */}
      {luminousStars.map((star) => (
        <div
          key={star.id}
          className="absolute -translate-x-1/2 -translate-y-1/2 animate-pulse pointer-events-none"
          style={{
            top: star.top,
            left: star.left,
            width: `${star.size}px`,
            height: `${star.size}px`,
            animationDuration: star.duration,
            animationDelay: star.delay,
            willChange: 'opacity',
          }}
        >
          {/* 外圈柔光暈 */}
          <div
            className="absolute inset-0 rounded-full blur-[4px] opacity-65"
            style={{ backgroundColor: star.glow }}
          />
          {/* 垂直星芒 */}
          <div
            className="absolute left-1/2 top-0 bottom-0 w-[1.5px] -translate-x-1/2 rounded-full"
            style={{
              background: `linear-gradient(to bottom, transparent, ${star.color}, transparent)`,
            }}
          />
          {/* 水平星芒 */}
          <div
            className="absolute top-1/2 left-0 right-0 h-[1.5px] -translate-y-1/2 rounded-full"
            style={{
              background: `linear-gradient(to right, transparent, ${star.color}, transparent)`,
            }}
          />
          {/* 恆星核心亮點 */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[3.5px] h-[3.5px] rounded-full bg-white"
            style={{
              boxShadow: `0 0 8px 1px ${star.color}`,
            }}
          />
        </div>
      ))}

      {/* 流星 */}
      {shootingStars.map((meteor) => (
        <div
          key={meteor.id}
          className="absolute w-[110px] h-[1.5px] bg-gradient-to-r from-transparent via-amber-100/85 to-transparent -rotate-45 animate-[meteor_linear_infinite]"
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
