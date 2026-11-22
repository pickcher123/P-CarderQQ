'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  headerAction?: React.ReactNode;
}

// 優先使用本地壓縮最佳化後的主題封面圖，加上 ?v=2 強制瀏覽器更新最新活潑插畫版
function getCategoryArtwork(categoryName: string = '', originalUrl?: string): string {
  const name = categoryName.toLowerCase();
  if (name.includes('籃球') || name.includes('nba') || name.includes('basketball')) {
    return '/images/themes/basketball.jpg?v=2';
  }
  if (name.includes('棒球') || name.includes('mlb') || name.includes('baseball')) {
    return '/images/themes/baseball.jpg?v=2';
  }
  if (name.includes('足球') || name.includes('fifa') || name.includes('soccer') || name.includes('football')) {
    return '/images/themes/soccer.jpg?v=2';
  }
  if (name.includes('寶可夢') || name.includes('pokemon') || name.includes('tcg') || name.includes('動漫')) {
    return '/images/themes/pokemon.jpg?v=2';
  }
  if (name.includes('其他') || name.includes('other') || name.includes('綜合')) {
    return '/images/themes/other.jpg?v=2';
  }
  if (originalUrl && originalUrl.trim().length > 0 && !originalUrl.includes('placeholder')) {
    return originalUrl;
  }
  return '/images/themes/other.jpg?v=2';
}

export function RevolvingDoorThemeCarousel({
  categories,
  isLoading = false,
  baseHref = '/draw',
  onSelectCategory,
  className,
  headerAction,
}: RevolvingDoorThemeCarouselProps) {
  const router = useRouter();
  const shouldReduceMotion = useReducedMotion();
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

  // 預載所有主題卡池圖片至瀏覽器快取，避免切換或首次開啟時等待
  useEffect(() => {
    if (typeof window === 'undefined' || categories.length === 0) return;
    categories.forEach((cat) => {
      const url = getCategoryArtwork(cat.name, cat.imageUrl);
      if (url && (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/'))) {
        const img = new window.Image();
        img.decoding = 'async';
        img.src = url;
      }
    });
  }, [categories]);

  // Subtle auto-rotation when user is not hovering or interacting
  useEffect(() => {
    if (isHovered || total <= 1 || shouldReduceMotion) return;
    const timer = setInterval(() => {
      handleNext();
    }, 5000);
    return () => clearInterval(timer);
  }, [isHovered, total, handleNext, shouldReduceMotion]);

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
    <div className={cn("relative select-none w-full max-w-5xl mx-auto pt-0 pb-2", className)}>
      {/* 標題區塊：黑金奢華質感 (Centered Clean Header with Optional Icon Action) */}
      <div className="relative flex items-center justify-center mb-2 sm:mb-3.5 px-3">
        <h2 className="text-xl sm:text-2xl font-black font-headline tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-400 drop-shadow-[0_2px_15px_rgba(245,158,11,0.35)] text-center">
          選擇主題卡池
        </h2>
        {headerAction && (
          <div className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 z-20">
            {headerAction}
          </div>
        )}
      </div>

      {/* 3D 旋轉門舞台視角區 */}
      <div
        className="relative w-full h-[320px] sm:h-[370px] md:h-[400px] flex items-center justify-center overflow-hidden perspective-[1100px] focus:outline-none"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* 3D 旋轉門底座：同心金曜光圈舞台 (Turntable Glow Floor) */}
        <div className="absolute bottom-4 sm:bottom-6 w-[280px] sm:w-[460px] md:w-[580px] h-[60px] sm:h-[85px] pointer-events-none flex items-center justify-center">
          {/* 外圈高亮軌道光圈 */}
          <div className="absolute inset-0 rounded-[100%] border border-amber-400/50 shadow-[0_0_35px_rgba(245,158,11,0.45)] transform rotate-x-[75deg]" />
          
          {/* 軌道星點亮點 */}
          <div className="absolute inset-0 rounded-[100%] border border-yellow-300/30 transform rotate-x-[75deg] flex items-center justify-between px-3">
            <span className="w-1.5 h-1.5 rounded-full bg-yellow-300 shadow-[0_0_8px_#fde047]" />
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_#22d3ee]" />
          </div>

          {/* 內圈旋轉光帶 */}
          <div className="absolute w-[80%] h-[80%] rounded-[100%] border border-amber-400/30 border-dashed transform rotate-x-[75deg]" />

          {/* 地面中心環境漫反射暈光 */}
          <div className="absolute w-[55%] h-[55%] rounded-[100%] bg-gradient-to-r from-cyan-500/15 via-amber-500/25 to-cyan-500/15 blur-xl transform rotate-x-[75deg]" />
        </div>

        {/* 左側旋轉切換箭頭 */}
        <button
          type="button"
          onClick={handlePrev}
          className="absolute left-2 sm:left-5 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#0a0f1c]/85 hover:bg-amber-400/15 border border-amber-300/35 hover:border-amber-300/75 text-[#FDE68A] flex items-center justify-center backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.65)] transition-[transform,background-color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 active:scale-[0.95]"
          aria-label="上一主題"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* 右側旋轉切換箭頭 */}
        <button
          type="button"
          onClick={handleNext}
          className="absolute right-2 sm:right-5 z-40 w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-[#0a0f1c]/85 hover:bg-amber-400/15 border border-amber-300/35 hover:border-amber-300/75 text-[#FDE68A] flex items-center justify-center backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.65)] transition-[transform,background-color,border-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] cursor-pointer [@media(hover:hover)_and_(pointer:fine)]:hover:scale-105 active:scale-[0.95]"
          aria-label="下一主題"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* 3D 旋轉門直立卡磚群 (Vertical 3D Cards) */}
        <div className="relative w-full h-full flex items-center justify-center transform-style-3d pointer-events-auto">
          {categories.map((category, index) => {
            const offset = getOffset(index);
            const isCenter = offset === 0;
            const absOffset = Math.abs(offset);
            const isHidden = absOffset > 2;

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
            } else {
              // 隱藏但保留掛載，切換時零延遲
              rotateY = offset > 0 ? -60 : 60;
              translateX = offset > 0 ? '110%' : '-110%';
              translateZ = -180;
              scale = 0.55;
              opacity = 0;
              zIndex = 0;
            }

            const artworkUrl = getCategoryArtwork(category.name, category.imageUrl);
            const count = category.poolCount ?? category.itemCount;

            return (
              <motion.div
                key={category.id || category.name}
                aria-hidden={isHidden}
                className={cn(
                  "absolute w-[170px] h-[226px] sm:w-[225px] sm:h-[300px] md:w-[255px] md:h-[340px] origin-center select-none",
                  isHidden ? "pointer-events-none" : "cursor-pointer"
                )}
                style={{
                  zIndex,
                }}
                animate={shouldReduceMotion ? {
                  scale: isCenter ? 1.05 : 0.82,
                  opacity,
                } : {
                  rotateY,
                  x: translateX,
                  z: translateZ,
                  scale,
                  opacity,
                }}
                transition={shouldReduceMotion ? {
                  duration: 0.15,
                  ease: [0.23, 1, 0.32, 1],
                } : {
                  type: 'spring',
                  duration: 0.45,
                  bounce: 0.15,
                }}
                onClick={() => handleCardClick(category, index)}
              >
                <div
                  className={cn(
                    "w-full h-full relative rounded-2xl sm:rounded-3xl overflow-hidden flex flex-col justify-between p-3.5 sm:p-4 transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group bg-[#0a0f1c]",
                    isCenter
                      ? "border-2 border-amber-300/85 shadow-[0_20px_50px_rgba(0,0,0,0.85),0_0_32px_rgba(253,230,138,0.28)]"
                      : "border border-white/[0.12] hover:border-amber-300/50 shadow-[0_14px_34px_rgba(0,0,0,0.75)]"
                  )}
                >
                  {/* 頂部香檳金微光細線 */}
                  {isCenter && (
                    <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-[#FDE68A] to-transparent z-20 pointer-events-none" />
                  )}

                  {/* 背景封面插畫：本地輕量靜態圖直接原圖秒開，不經 SafeImage 骨架屏閃爍 */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={artworkUrl}
                    alt={category.name}
                    loading="eager"
                    decoding="sync"
                    fetchPriority={absOffset <= 1 ? 'high' : 'auto'}
                    draggable={false}
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.includes('/images/themes/other.jpg')) {
                        target.src = '/images/themes/other.jpg?v=2';
                      }
                    }}
                    className={cn(
                      "absolute inset-0 w-full h-full object-cover transition-[transform,opacity] duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] pointer-events-none",
                      isCenter ? "scale-[1.03] opacity-95 [@media(hover:hover)_and_(pointer:fine)]:group-hover:scale-110" : "scale-100 opacity-65"
                    )}
                  />

                  {/* 底部暗黑曜石漸層托底（保持畫面中上段活潑明亮，底部文字高對比） */}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#070b14]/95 via-[#070b14]/25 to-black/25 pointer-events-none" />
                  
                  {/* 中心卡滑過時的全息流光掃過 */}
                  {isCenter && (
                    <div className="absolute -inset-full bg-gradient-to-tr from-transparent via-[#FDE68A]/15 to-transparent rotate-12 pointer-events-none -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out z-10" />
                  )}

                  {/* 頂部列：收藏館編號膠囊 + 開放數量徽章 */}
                  <div className="relative z-10 flex items-center justify-between gap-1.5 w-full">
                    <span className="text-[9px] sm:text-[10px] font-mono font-bold tracking-widest text-amber-200/80 bg-[#0a0f1c]/70 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/[0.12]">
                      0{index + 1}
                    </span>
                    <span className={cn(
                      "text-[10px] sm:text-xs font-mono font-bold tabular-nums px-2.5 py-0.5 rounded-full backdrop-blur-md border shadow-sm flex items-center gap-1",
                      (count ?? 0) > 0
                        ? "text-[#FDE68A] bg-[#0a0f1c]/80 border-amber-300/45"
                        : "text-slate-300 bg-[#0a0f1c]/75 border-white/[0.12]"
                    )}>
                      {(count ?? 0) > 0 && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                      {count !== undefined ? `${count} 款開放中` : '專區'}
                    </span>
                  </div>

                  {/* 底部卡牌名稱與「進入專區 >」香檳金主按鈕 */}
                  <div className="relative z-10 flex flex-col items-center justify-center text-center space-y-2 pb-0.5">
                    <h3 className="font-headline font-black text-xl sm:text-2xl md:text-[26px] text-white tracking-[0.14em] drop-shadow-[0_3px_14px_rgba(0,0,0,0.95)] leading-none">
                      {category.name}
                    </h3>

                    <div className={cn(
                      "text-xs sm:text-[13px] font-black tracking-wide flex items-center justify-center gap-1 transition-[transform,filter,background-color] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] rounded-full px-4 py-1.5",
                      isCenter
                        ? "bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] shadow-[0_6px_20px_rgba(245,158,11,0.4)] [@media(hover:hover)_and_(pointer:fine)]:group-hover:brightness-105"
                        : "bg-[#0a0f1c]/75 text-amber-200 border border-amber-300/35 group-hover:bg-amber-400/15"
                    )}>
                      <span>進入專區</span>
                      <ChevronRight className="w-3.5 h-3.5 [@media(hover:hover)_and_(pointer:fine)]:group-hover:translate-x-0.5 transition-transform duration-150" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 底部快速切換主題膠囊指示列 */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-1.5 sm:gap-2 mt-1 flex-wrap px-2">
          {categories.map((cat, idx) => {
            const active = idx === currentIndex;
            return (
              <button
                key={cat.id || cat.name}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-[11px] font-bold transition-[background-color,border-color,color,transform] duration-150 cursor-pointer border",
                  active
                    ? "bg-amber-400/[0.15] text-[#FDE68A] border-amber-300/50 scale-105"
                    : "bg-white/[0.03] text-slate-400 border-white/[0.08] hover:text-slate-200 hover:bg-white/[0.06]"
                )}
              >
                {cat.name}
              </button>
            );
          })}
        </div>
      )}

    </div>
  );
}
