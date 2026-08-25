'use client';

import { SafeImage } from '@/components/safe-image';
import { useEffect, useState } from 'react';
import { StarrySky } from '@/components/starry-sky';

export function AnimatedBackground({ backgroundUrl, backgroundOpacity }: { backgroundUrl?: string | null, backgroundOpacity?: number }) {
  const opacity = backgroundOpacity ?? 1;
  const [containerStyle, setContainerStyle] = useState<React.CSSProperties>({
    height: '100dvh',
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100%',
  });

  useEffect(() => {
    // 解決行動裝置因網址列隱藏造成的背景閃爍與跳動，同時確保桌面端完整展示底座
    const stabilizeViewportHeight = () => {
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        // 行動端使用適度溢出防止網址列收合時白邊
        setContainerStyle({
          height: '112vh', 
          top: '-6vh',
          position: 'fixed',
          left: 0,
          width: '100%',
        });
      } else {
        // 桌面端維持 100vh 完美貼齊視窗，完整顯示底部科技地台
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
      className="fixed inset-0 -z-50 overflow-hidden bg-[#050811] pointer-events-none w-screen min-h-screen"
      style={containerStyle}
    >
      {/* 夢幻星空粒子與星雲基底 */}
      <StarrySky />

      {backgroundUrl ? (
        <SafeImage
          src={backgroundUrl}
          alt="App background"
          fill
          className="object-cover transition-opacity duration-1000"
          style={{ opacity }}
          priority
          sizes="100vw"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[#050811]/40 to-[#070b14]/80" />
      )}
      <div className="absolute inset-0 bg-black/20 z-[-1]" />
    </div>
  );
}
