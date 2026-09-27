'use client';

import { useEffect, useRef, useState } from 'react';

interface Particle {
  x: number;
  y: number;
  size: number;
  color: string;
  glowColor: string;
  alpha: number;
  baseAlpha: number;
  speedY: number;
  speedX: number;
  swaySpeed: number;
  swayDist: number;
  swayAngle: number;
  twinkleSpeed: number;
  twinkleAngle: number;
}

export interface GoldDustParticlesProps {
  className?: string;
  particleCount?: number;
  speedMultiplier?: number;
}

export function GoldDustParticles({
  className = '',
  particleCount = 46,
  speedMultiplier = 0.55,
}: GoldDustParticlesProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef<{ w: number; h: number; dpr: number }>({ w: 0, h: 0, dpr: 1 });
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;

    // 低飽和、極簡雅緻的香檳金調色盤（溫潤微光，絕不刺眼、不花俏）
    const goldPalette = [
      { fill: '#EAD7A6', glow: 'rgba(234, 215, 166, 0.28)' }, // 輕柔香檳金
      { fill: '#D4AF37', glow: 'rgba(212, 175, 55, 0.24)' },   // 典雅細金
      { fill: '#C5A059', glow: 'rgba(197, 160, 89, 0.18)' },  // 沉穩琥珀微金
      { fill: '#F5E6CA', glow: 'rgba(245, 230, 202, 0.3)' },  // 溫潤微暖白金
    ];

    const updateDimensions = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sizeRef.current = { w, h, dpr };
    };

    updateDimensions();

    const createParticle = (isInitial = false): Particle => {
      const { w, h } = sizeRef.current;
      const width = w || window.innerWidth;
      const height = h || window.innerHeight;

      const palette = goldPalette[Math.floor(Math.random() * goldPalette.length)];
      // 微米級細膩粒子：直徑 0.9px ~ 2.0px，微光雅緻不搶佔視覺焦點
      const isSlightlyLarger = Math.random() < 0.16;
      const size = isSlightlyLarger ? 1.7 + Math.random() * 0.6 : 0.9 + Math.random() * 0.9;
      // 柔和基準透明度，若隱若現
      const baseAlpha = 0.24 + Math.random() * 0.35;

      return {
        x: Math.random() * width,
        y: isInitial ? Math.random() * height : height + Math.random() * 15,
        size,
        color: palette.fill,
        glowColor: palette.glow,
        alpha: baseAlpha,
        baseAlpha,
        speedY: -(0.12 + Math.random() * 0.24) * speedMultiplier,
        speedX: (Math.random() - 0.5) * 0.12 * speedMultiplier,
        swaySpeed: 0.006 + Math.random() * 0.01,
        swayDist: 0.35 + Math.random() * 0.55,
        swayAngle: Math.random() * Math.PI * 2,
        twinkleSpeed: 0.01 + Math.random() * 0.016,
        twinkleAngle: Math.random() * Math.PI * 2,
      };
    };

    let particles: Particle[] = Array.from({ length: particleCount }, () => createParticle(true));

    const handleResize = () => {
      updateDimensions();
    };

    window.addEventListener('resize', handleResize);

    const render = () => {
      let { w, h, dpr } = sizeRef.current;
      if (w === 0 || h === 0) {
        updateDimensions();
        w = sizeRef.current.w;
        h = sizeRef.current.h;
        dpr = sizeRef.current.dpr;
      }
      if (w === 0 || h === 0) {
        animationFrameId = requestAnimationFrame(render);
        return;
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // 緩慢祥和向上微漂浮
        p.swayAngle += p.swaySpeed;
        p.twinkleAngle += p.twinkleSpeed;

        p.x += p.speedX + Math.sin(p.swayAngle) * p.swayDist * 0.15;
        p.y += p.speedY;

        // 平緩呼吸微光（微調透明度，無突兀閃爍）
        const twinkle = (Math.sin(p.twinkleAngle) + 1) / 2;
        p.alpha = p.baseAlpha * (0.6 + twinkle * 0.4);

        // 飄出畫面時重置到底部
        if (p.y < -15 || p.x < -15 || p.x > w + 15) {
          particles[i] = createParticle(false);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = Math.min(p.alpha, 0.65);

        // 細膩微光光暈
        const haloRadius = p.size * 1.8;
        const grad = ctx.createRadialGradient(
          p.x, p.y, p.size * 0.1,
          p.x, p.y, haloRadius
        );
        grad.addColorStop(0, p.color);
        grad.addColorStop(0.4, p.glowColor);
        grad.addColorStop(1, 'rgba(212, 175, 55, 0)');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, haloRadius, 0, Math.PI * 2);
        ctx.fill();

        // 粒子核心細微光點
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      }

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(animationFrameId);
      } else {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [mounted, particleCount, speedMultiplier]);

  return (
    <div className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}>
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none w-full h-full block"
      />
    </div>
  );
}
