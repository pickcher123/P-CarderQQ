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

    // 🚀 效能巨幅升級：在離屏 Canvas 預先快取粒子光斑精靈圖 (Pre-baked Offscreen Sprites)
    // 徹底消除每一影格重複調用 46 次 ctx.createRadialGradient 導致的 GPU 頻寬浪費與垃圾回收延遲
    const spriteCanvases = goldPalette.map((palette) => {
      const sprite = document.createElement('canvas');
      const sSize = 48;
      sprite.width = sSize;
      sprite.height = sSize;
      const sCtx = sprite.getContext('2d');
      if (sCtx) {
        const sCenter = sSize / 2;
        const sHalo = sSize / 2;
        const grad = sCtx.createRadialGradient(sCenter, sCenter, 2, sCenter, sCenter, sHalo);
        grad.addColorStop(0, palette.fill);
        grad.addColorStop(0.35, palette.glow);
        grad.addColorStop(1, 'rgba(212, 175, 55, 0)');
        sCtx.fillStyle = grad;
        sCtx.beginPath();
        sCtx.arc(sCenter, sCenter, sHalo, 0, Math.PI * 2);
        sCtx.fill();

        // 核心光點
        sCtx.fillStyle = palette.fill;
        sCtx.beginPath();
        sCtx.arc(sCenter, sCenter, 3.5, 0, Math.PI * 2);
        sCtx.fill();
      }
      return sprite;
    });

    const isMobile = window.innerWidth < 768;
    const effectiveCount = isMobile ? Math.min(particleCount, 22) : particleCount;

    const updateDimensions = () => {
      // 行動端限制 DPR 為 1~1.25，避免巨大像素緩衝區佔用手機 GPU
      const dpr = isMobile ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      sizeRef.current = { w, h, dpr };
    };

    updateDimensions();

    interface FastParticle {
      x: number;
      y: number;
      size: number;
      paletteIndex: number;
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

    const createParticle = (isInitial = false): FastParticle => {
      const { w, h } = sizeRef.current;
      const width = w || window.innerWidth;
      const height = h || window.innerHeight;

      const paletteIndex = Math.floor(Math.random() * goldPalette.length);
      const isSlightlyLarger = Math.random() < 0.16;
      const size = isSlightlyLarger ? 1.7 + Math.random() * 0.6 : 0.9 + Math.random() * 0.9;
      const baseAlpha = 0.24 + Math.random() * 0.35;

      return {
        x: Math.random() * width,
        y: isInitial ? Math.random() * height : height + Math.random() * 15,
        size,
        paletteIndex,
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

    let particles: FastParticle[] = Array.from({ length: effectiveCount }, () => createParticle(true));

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

        // 🚀 使用預快取精靈圖直接繪製，零額外 GC 物件分配
        ctx.globalAlpha = Math.min(p.alpha, 0.65);
        const renderSize = p.size * 3.6;
        ctx.drawImage(
          spriteCanvases[p.paletteIndex],
          p.x - renderSize / 2,
          p.y - renderSize / 2,
          renderSize,
          renderSize
        );
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
