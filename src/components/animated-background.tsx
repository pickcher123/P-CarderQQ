'use client';

import { SafeImage } from '@/components/safe-image';
import { useEffect, useState } from 'react';
import { StarrySky } from '@/components/starry-sky';
import { GoldDustParticles } from '@/components/gold-dust-particles';
import type { ParticleMode } from '@/components/wallpaper-particle-switcher';

export function AnimatedBackground({
  backgroundUrl,
  backgroundOpacity,
  particleEffect = 'gold_dust',
}: {
  backgroundUrl?: string | null;
  backgroundOpacity?: number;
  particleEffect?: ParticleMode;
}) {
  const opacity = backgroundOpacity ?? 1;
  const [activeMode, setActiveMode] = useState<ParticleMode>('gold_dust');

  const [containerStyle, setContainerStyle] = useState<React.CSSProperties>({
    height: '100dvh',
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
  });

  // 監聽本地設定與自訂切換事件
  useEffect(() => {
    // 若後台或全站傳入指定特效且非 none，以系統設定為優先
    if (particleEffect && particleEffect !== 'none') {
      setActiveMode(particleEffect);
      try {
        localStorage.setItem('p_carder_wallpaper_particle', particleEffect);
      } catch (e) {}
    } else {
      const saved = localStorage.getItem('p_carder_wallpaper_particle') as ParticleMode;
      if (saved && (saved === 'gold_dust' || saved === 'stars' || saved === 'none')) {
        setActiveMode(saved);
      } else {
        setActiveMode(particleEffect || 'gold_dust');
      }
    }

    const handleParticleChange = (e: Event) => {
      const customEvent = e as CustomEvent<{ mode: ParticleMode }>;
      if (customEvent.detail?.mode) {
        setActiveMode(customEvent.detail.mode);
      }
    };

    window.addEventListener('wallpaper-particle-changed', handleParticleChange);
    return () => {
      window.removeEventListener('wallpaper-particle-changed', handleParticleChange);
    };
  }, [particleEffect]);

  useEffect(() => {
    // 解決行動裝置因網址列隱藏造成的背景閃爍與跳動，同時確保桌面端完整展示底座
    const stabilizeViewportHeight = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        setContainerStyle({
          height: '112vh',
          top: '-6vh',
          position: 'fixed',
          left: 0,
          width: '100%',
        });
      } else {
        setContainerStyle({
          height: '100vh',
          top: 0,
          position: 'fixed',
          left: 0,
          width: '100%',
        });
      }
    };

    stabilizeViewportHeight();
    window.addEventListener('resize', stabilizeViewportHeight);
    return () => window.removeEventListener('resize', stabilizeViewportHeight);
  }, []);

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden bg-[#050811] pointer-events-none w-screen min-h-screen"
      style={containerStyle}
    >
      {/* 1. 深空星雲底色光芒 */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050811] via-[#070b16] to-[#04060c] pointer-events-none" />

      {/* 2. 桌布背景圖片 (若有設定) */}
      {backgroundUrl && (
        <SafeImage
          src={backgroundUrl}
          alt="App background"
          fill
          className="object-cover transition-opacity duration-1000 z-[1]"
          style={{ opacity }}
          priority
          sizes="100vw"
        />
      )}

      {/* 3. 背景深邃漸層覆蓋層，確保前景卡片與文字清晰度 */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050811]/45 via-transparent to-[#050811]/75 z-[2] pointer-events-none" />

      {/* 4. 簡約優雅金粉流動層（單層、顆粒極細微小、悠然漂浮，溫潤不刺眼、不花俏） */}
      {activeMode === 'gold_dust' && (
        <GoldDustParticles
          particleCount={46}
          speedMultiplier={0.55}
          className="z-[2] opacity-85"
        />
      )}

      {activeMode === 'stars' && (
        <div className="z-[2] absolute inset-0">
          <StarrySky />
        </div>
      )}
    </div>
  );
}
