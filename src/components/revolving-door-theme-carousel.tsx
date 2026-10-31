'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SafeImage } from '@/components/safe-image';
import { cn } from '@/lib/utils';

export interface ThemeCategoryItem {
  id: string;
  name: string;
  imageUrl?: string;
  linkUrl?: string;
  poolCount?: number;
  itemCount?: number;
  order?: number;
  [key: string]: any;
}

interface RevolvingDoorThemeCarouselProps {
  categories: ThemeCategoryItem[];
  isLoading?: boolean;
  baseHref?: string; // e.g. '/draw' or '/bet'
  onSelectCategory?: (category: ThemeCategoryItem) => void;
  className?: string;
}

// Fallback high-impact sports visuals matching target design
function getCategoryArtwork(categoryName: string = '', originalUrl?: string): string {
  if (originalUrl && originalUrl.trim().length > 0 && !originalUrl.includes('placeholder')) {
    return originalUrl;
  }
  const name = categoryName.toLowerCase();
  if (name.includes('籃球') || name.includes('nba') || name.includes('basketball')) {
    return 'https://images.unsplash.com/photo-1546519638-68e109498ffc?q=80&w=800&auto=format&fit=crop';
  }
  if (name.includes('棒球') || name.includes('mlb') || name.includes('baseball')) {
    return 'https://images.unsplash.com/photo-1508344928928-7165b67de128?q=80&w=800&auto=format&fit=crop';
  }
  if (name.includes('足球') || name.includes('fifa') || name.includes('soccer') || name.includes('football')) {
    return 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?q=80&w=800&auto=format&fit=crop';
  }
  if (name.includes('寶可夢') || name.includes('pokemon') || name.includes('tcg') || name.includes('動漫')) {
    return 'https://images.unsplash.com/photo-1613771404784-3a5686aa2be3?q=80&w=800&auto=format&fit=crop';
  }
  return 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=800&auto=format&fit=crop';
}

export function RevolvingDoorThemeCarousel({
  categories,
  isLoading = false,
  baseHref = '/draw',
  onSelectCategory,
  className,
}: RevolvingDoorThemeCarouselProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Drag / Touch handling
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  const total = categories.length;

  const handleNext = useCallback(() => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = useCallback(() => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // Subtle auto-rotation when user is not hovering or interacting
  useEffect(() => {
    if (isHovered || total <= 1) return;
    const timer = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(timer);
  }, [isHovered, total, handleNext]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    }
  };

  // Touch handlers for mobile swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    isDragging.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const onTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (touchDeltaX.current < -35) {
      handleNext();
    } else if (touchDeltaX.current > 35) {
      handlePrev();
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-6">
        <div className="flex flex-col items-center justify-center space-y-2 mb-6">
          <div className="h-6 w-36 bg-slate-800/80 rounded-md animate-pulse" />
          <div className="h-4 w-24 bg-slate-800/50 rounded-md animate-pulse" />
        </div>
        <div className="h-[320px] sm:h-[380px] w-full flex items-center justify-center">
          <div className="w-[210px] h-[310px] rounded-2xl bg-slate-900/80 border border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  // Calculate circular offset for 3D revolving door wings
  const getOffset = (index: number) => {
    let diff = (index - currentIndex) % total;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  };

  const handleCardClick = (category: ThemeCategoryItem, index: number) => {
    const offset = getOffset(index);
    if (offset !== 0) {
      // Rotate side card into center
      setCurrentIndex(index);
      return;
    }

    // Center card clicked -> Enter category
    if (onSelectCategory) {
      onSelectCategory(category);
      return;
    }

    if (category.linkUrl) {
      window.open(category.linkUrl, '_blank');
      return;
    }

    // In /bet route, navigate to /bet/[categoryName]
    // In /draw route, navigate to /draw/[categoryId]
    const param = baseHref.includes('/bet') 
      ? (category.name || category.id)
      : (category.id || category.name);
    
    router.push(`${baseHref}/${encodeURIComponent(param)}`);
  };

  return (
    <div className={cn("relative select-none w-full max-w-5xl mx-auto py-2", className)}>
      {/* 標題區塊：與設計圖完全一致 (Centered Clean Header) */}
      <div className="text-center mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-black text-white font-headline tracking-wider drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          選擇主題卡池
        </h2>
        <p className="text-xs sm:text-sm text-slate-400 mt-1 font-medium tracking-wide">
          共 {total} 個專區
        </p>
      </div>

      {/* 3D 旋轉門舞台視角區 */}
      <div
        className="relative w-full h-[340px] sm:h-[400px] md:h-[430px] flex items-center justify-center overflow-hidden perspective-[1100px] focus:outline-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* 3D 旋轉門底座：同心霓虹青光光圈舞台 (Turntable Glow Floor) */}
        <div className="absolute bottom-6 sm:bottom-8 w-[280px] sm:w-[480px] md:w-[620px] h-[65px] sm:h-[95px] pointer-events-none flex items-center justify-center">
          {/* 外圈高亮軌道光圈 */}
          <div className="absolute inset-0 rounded-[100%] border border-cyan-400/50 shadow-[0_0_35px_rgba(6,182,212,0.45)] transform rotate-x-[75deg]" />
          
          {/* 軌道星點亮點 */}
          <div className="absolute inset-0 rounded-[100%] border border-cyan-300/30 transform rotate-x-[75deg] flex items-center justify-between px-3">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
          </div>

          {/* 內圈旋轉光帶 */}
          <div className="absolute w-[80%] h-[80%] rounded-[100%] border border-cyan-400/25 border-dashed transform rotate-x-[75deg]" />

          {/* 地面中心環境漫反射暈光 */}
          <div className="absolute w-[55%] h-[55%] rounded-[100%] bg-cyan-500/20 blur-xl transform rotate-x-[75deg]" />
        </div>

        {/* 左側旋轉切換箭頭 */}
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-2 sm:left-6 z-40 p-2 sm:p-3 text-cyan-400 hover:text-white transition-all cursor-pointer hover:scale-125 active:scale-95 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]"
          aria-label="上一主題"
        >
          <ChevronLeft className="w-7 h-7 sm:w-9 sm:h-9" />
        </button>

        {/* 右側旋轉切換箭頭 */}
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-2 sm:right-6 z-40 p-2 sm:p-3 text-cyan-400 hover:text-white transition-all cursor-pointer hover:scale-125 active:scale-95 drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]"
          aria-label="下一主題"
        >
          <ChevronRight className="w-7 h-7 sm:w-9 sm:h-9" />
        </button>

        {/* 3D 旋轉門直立卡磚群 (Vertical 3D Cards) */}
        <div className="relative w-full h-full flex items-center justify-center transform-style-3d pointer-events-auto">
          {categories.map((category, index) => {
            const offset = getOffset(index);
            const isCenter = offset === 0;
            const absOffset = Math.abs(offset);

            // 只呈現視野前後兩翼
            if (absOffset > 2) return null;

            // 計算 3D 旋轉門視角變換數值 (Portrait Dimensions)
            let rotateY = 0;
            let translateX = '0%';
            let translateZ = 0;
            let scale = 1;
            let opacity = 1;
            let zIndex = 20;

            if (offset === 0) {
              // 正中心展示位：正視玩家，帶霓虹青光描邊
              rotateY = 0;
              translateX = '0%';
              translateZ = 60;
              scale = 1.05;
              opacity = 1;
              zIndex = 30;
            } else if (offset === 1) {
              // 右翼一號位
              rotateY = -28;
              translateX = '55%';
              translateZ = -45;
              scale = 0.82;
              opacity = 0.78;
              zIndex = 20;
            } else if (offset === -1) {
              // 左翼一號位
              rotateY = 28;
              translateX = '-55%';
              translateZ = -45;
              scale = 0.82;
              opacity = 0.78;
              zIndex = 20;
            } else if (offset === 2) {
              // 遠右翼二號位
              rotateY = -48;
              translateX = '98%';
              translateZ = -130;
              scale = 0.68;
              opacity = 0.35;
              zIndex = 10;
            } else if (offset === -2) {
              // 遠左翼二號位
              rotateY = 48;
              translateX = '-98%';
              translateZ = -130;
              scale = 0.68;
              opacity = 0.35;
              zIndex = 10;
            }

            const artworkUrl = getCategoryArtwork(category.name, category.imageUrl);
            const count = category.poolCount ?? category.itemCount;

            return (
              <motion.div
                key={category.id || category.name}
                className="absolute w-[180px] h-[270px] sm:w-[225px] sm:h-[335px] md:w-[245px] md:h-[365px] origin-center cursor-pointer select-none"
                style={{
                  zIndex,
                }}
                animate={{
                  rotateY,
                  x: translateX,
                  z: translateZ,
                  scale,
                  opacity,
                }}
                transition={{
                  type: 'spring',
                  stiffness: 260,
                  damping: 25,
                }}
                onClick={() => handleCardClick(category, index)}
              >
                <div
                  className={cn(
                    "w-full h-full relative rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col justify-between p-3.5 sm:p-5 transition-all duration-300 group bg-slate-950",
                    isCenter
                      ? "border-2 border-cyan-400 shadow-[0_0_35px_rgba(6,182,212,0.65),inset_0_0_20px_rgba(6,182,212,0.2)]"
                      : "border border-cyan-500/30 hover:border-cyan-400/60 shadow-xl"
                  )}
                >
                  {/* 背景封面運動員圖 (High Impact Sports Background) */}
                  <SafeImage
                    src={artworkUrl}
                    alt={category.name}
                    fill
                    className={cn(
                      "object-cover transition-transform duration-700 pointer-events-none",
                      isCenter ? "scale-105 opacity-85 group-hover:scale-110" : "scale-100 opacity-60"
                    )}
                    sizes="(max-width: 768px) 250px, 350px"
                    priority={isCenter}
                  />

                  {/* 賽博暗黑漸層遮罩 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/35 to-black/30 pointer-events-none" />
                  
                  {/* 中心卡額外青藍氛圍聚光 */}
                  {isCenter && (
                    <div className="absolute inset-0 bg-gradient-to-tr from-cyan-950/40 via-transparent to-cyan-500/10 pointer-events-none" />
                  )}

                  {/* 右上角數量徽章 (與 Mockup 一致：黑底玻璃 1款 / 2款) */}
                  <div className="relative z-10 flex items-center justify-end w-full">
                    <span className="text-[11px] sm:text-xs font-mono font-bold text-white bg-black/65 backdrop-blur-md px-2.5 py-0.5 rounded-full border border-white/20 shadow-md">
                      {count !== undefined ? `${count}款` : '專區'}
                    </span>
                  </div>

                  {/* 底部卡牌名稱與「進入專區 >」 */}
                  <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-1">
                    <h3 className="font-headline font-black text-xl sm:text-2xl md:text-3xl text-white tracking-widest drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">
                      {category.name}
                    </h3>

                    <div className="text-xs sm:text-sm text-cyan-300 font-bold tracking-wide flex items-center justify-center gap-1 group-hover:text-cyan-200 transition-colors drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]">
                      <span>進入專區</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 底部提示文字：與 Mockup 完全一致 (< 左右撥動 ── 旋轉門 >) */}
      <div className="text-center mt-1 flex items-center justify-center">
        <p className="text-xs sm:text-sm text-cyan-300/85 font-medium tracking-widest flex items-center gap-2 drop-shadow-[0_0_10px_rgba(6,182,212,0.6)]">
          <span>&lt;</span>
          <span>左右撥動 ── 旋轉門</span>
          <span>&gt;</span>
        </p>
      </div>
    </div>
  );
}
