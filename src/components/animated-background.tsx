'use client';

import { SafeImage } from '@/components/safe-image';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

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
    // 解決行動裝置因網址列隱藏造成的背景閃爍與跳動
    const stabilizeViewportHeight = () => {
      // 使用固定視窗高度並加上溢出空間，防止網址列伸縮時的抖動
      setContainerStyle({
        height: '120vh', 
        top: '-10vh',
        position: 'fixed',
        left: 0,
        width: '100%',
      });
    };

    stabilizeViewportHeight();
    window.addEventListener('resize', stabilizeViewportHeight);
    return () => window.removeEventListener('resize', stabilizeViewportHeight);
  }, []);

  return (
    <div 
      className="fixed inset-0 -z-50 overflow-hidden bg-background pointer-events-none"
      style={containerStyle}
    >
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
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />
      )}
      <div className="absolute inset-0 bg-black/40 z-[-1]" />
    </div>
  );
}
