'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LuckyBagRedPacketCard } from '@/components/lucky-bag-red-packet-card';
import type { LuckBagWithCount } from '@/app/(main)/lucky-bags/page';

interface RevolvingDoorLuckyBagCarouselProps {
  bags: LuckBagWithCount[];
  isLoading?: boolean;
  onSelectBag?: (bag: LuckBagWithCount) => void;
  onActiveIndexChange?: (index: number) => void;
  className?: string;
}

export function RevolvingDoorLuckyBagCarousel({
  bags,
  isLoading = false,
  onSelectBag,
  onActiveIndexChange,
  className,
}: RevolvingDoorLuckyBagCarouselProps) {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // 觸控與拖曳處理
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  const total = bags.length;

  // 使用 ref 保存 onActiveIndexChange，避免依賴引發無窮循環或額外重繪
  const onActiveIndexChangeRef = useRef(onActiveIndexChange);
  useEffect(() => {
    onActiveIndexChangeRef.current = onActiveIndexChange;
  }, [onActiveIndexChange]);

  // 當總數變更導致當前索引超出範圍時，自動校正
  useEffect(() => {
    if (total > 0 && currentIndex >= total) {
      setCurrentIndex(0);
    }
  }, [total, currentIndex]);

  // 在組件渲染完成後的 Effect 中安全通知父組件當前選中索引，避免 React "Cannot update a component while rendering a different component" 警告
  useEffect(() => {
    if (total > 0) {
      const safeIndex = Math.min(Math.max(0, currentIndex), total - 1);
      onActiveIndexChangeRef.current?.(safeIndex);
    }
  }, [currentIndex, total]);

  const handleNext = useCallback(() => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev + 1) % total);
  }, [total]);

  const handlePrev = useCallback(() => {
    if (total === 0) return;
    setCurrentIndex((prev) => (prev - 1 + total) % total);
  }, [total]);

  // 使用者未懸停時自動緩慢旋轉展示 (每 6 秒)
  useEffect(() => {
    if (isHovered || total <= 1) return;
    const timer = setInterval(() => {
      handleNext();
    }, 6000);
    return () => clearInterval(timer);
  }, [isHovered, total, handleNext]);

  // 鍵盤左右鍵導航
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      handlePrev();
    } else if (e.key === 'ArrowRight') {
      handleNext();
    }
  };

  // 手機滑動手勢 - 靈敏度優化 (從 35px 降至 22px，大幅提升輕拂時的順暢度)
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
    if (touchDeltaX.current < -22) {
      handleNext();
    } else if (touchDeltaX.current > 22) {
      handlePrev();
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  if (isLoading) {
    return (
      <div className="w-full max-w-4xl mx-auto py-8">
        <div className="h-[380px] sm:h-[460px] w-full flex items-center justify-center">
          <div className="w-[210px] h-[330px] sm:w-[250px] sm:h-[390px] rounded-[2rem] bg-gradient-to-b from-rose-950/60 to-black border-2 border-amber-500/30 animate-pulse flex flex-col items-center justify-center p-4">
            <div className="w-12 h-12 rounded-full border-2 border-amber-400/40 bg-amber-500/20 mb-4" />
            <div className="h-4 w-32 bg-amber-500/20 rounded mb-2" />
            <div className="h-32 w-28 bg-black/60 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (bags.length === 0) {
    return null;
  }

  // 計算 3D 旋轉門左右翼環形位移差
  const getOffset = (index: number) => {
    let diff = (index - currentIndex) % total;
    if (diff > total / 2) diff -= total;
    if (diff < -total / 2) diff += total;
    return diff;
  };

  const handleBagClick = (bag: LuckBagWithCount, index: number) => {
    const offset = getOffset(index);
    if (offset !== 0) {
      // 點擊兩翼紅包袋：旋轉至正中央
      setCurrentIndex(index);
      return;
    }

    // 點擊正中央紅包袋：進入福袋
    if (onSelectBag) {
      onSelectBag(bag);
      return;
    }

    router.push(`/lucky-bags/${bag.id}`);
  };

  return (
    <div className={cn("relative select-none w-full max-w-5xl mx-auto py-3", className)}>
      {/* 3D 旋轉門紅包袋舞台視角區 */}
      <div
        className="relative w-full h-[510px] sm:h-[560px] md:h-[590px] flex items-center justify-center overflow-hidden perspective-[1200px] focus:outline-none touch-pan-y"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {/* 3D 旋轉舞台底座：金色吉祥光環轉盤 (Golden Turntable Floor) */}
        <div className="absolute bottom-4 sm:bottom-6 w-[320px] sm:w-[540px] md:w-[700px] h-[80px] sm:h-[115px] pointer-events-none flex items-center justify-center">
          {/* 外圈高亮燙金同心光圈 */}
          <div className="absolute inset-0 rounded-[100%] border border-amber-400/60 shadow-[0_0_40px_rgba(245,158,11,0.5)] transform rotate-x-[75deg]" />

          {/* 軌道金色星點 */}
          <div className="absolute inset-0 rounded-[100%] border border-yellow-300/40 transform rotate-x-[75deg] flex items-center justify-between px-4">
            <span className="w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_10px_#fde047]" />
            <span className="w-2 h-2 rounded-full bg-yellow-300 shadow-[0_0_10px_#fde047]" />
          </div>

          {/* 內圈吉祥紅金虛線光環 */}
          <div className="absolute w-[82%] h-[82%] rounded-[100%] border border-amber-500/35 border-dashed transform rotate-x-[75deg]" />

          {/* 地面中心環境漫反射暈光 (朱砂紅與金色交織) */}
          <div className="absolute w-[60%] h-[60%] rounded-[100%] bg-gradient-to-r from-rose-600/30 via-amber-500/35 to-rose-600/30 blur-2xl transform rotate-x-[75deg]" />
        </div>

        {/* 左側旋轉切換箭頭 (僅多於 1 個時顯示) */}
        {total > 1 && (
          <button
            type="button"
            onClick={handlePrev}
            className="absolute left-2 sm:left-6 z-40 p-2 sm:p-3 text-amber-300 hover:text-yellow-200 transition-all cursor-pointer hover:scale-125 active:scale-95 drop-shadow-[0_0_14px_rgba(245,158,11,0.9)]"
            aria-label="上一個紅包福袋"
          >
            <ChevronLeft className="w-8 h-8 sm:w-10 sm:h-10" />
          </button>
        )}

        {/* 右側旋轉切換箭頭 (僅多於 1 個時顯示) */}
        {total > 1 && (
          <button
            type="button"
            onClick={handleNext}
            className="absolute right-2 sm:right-6 z-40 p-2 sm:p-3 text-amber-300 hover:text-yellow-200 transition-all cursor-pointer hover:scale-125 active:scale-95 drop-shadow-[0_0_14px_rgba(245,158,11,0.9)]"
            aria-label="下一個紅包福袋"
          >
            <ChevronRight className="w-8 h-8 sm:w-10 sm:h-10" />
          </button>
        )}

        {/* 3D 旋轉門直立「紅包袋」群 (Vertical 3D Red Packets) */}
        <div className="relative w-full h-full flex items-center justify-center transform-style-3d pointer-events-auto">
          {bags.map((bag, index) => {
            const offset = getOffset(index);
            const isCenter = offset === 0;
            const absOffset = Math.abs(offset);

            // 只呈現視野前後兩翼
            if (absOffset > 2) return null;

            // 計算 3D 旋轉門視角數值 (Red Packet Dimensions)
            let rotateY = 0;
            let translateX = '0%';
            let translateZ = 0;
            let scale = 1;
            let opacity = 1;
            let zIndex = 20;

            if (offset === 0) {
              // 正中心展示位：正視玩家，帶金光外描邊
              rotateY = 0;
              translateX = '0%';
              translateZ = 70;
              scale = 1.05;
              opacity = 1;
              zIndex = 30;
            } else if (offset === 1) {
              // 右翼一號位
              rotateY = -28;
              translateX = '58%';
              translateZ = -45;
              scale = 0.82;
              opacity = 0.78;
              zIndex = 20;
            } else if (offset === -1) {
              // 左翼一號位
              rotateY = 28;
              translateX = '-58%';
              translateZ = -45;
              scale = 0.82;
              opacity = 0.78;
              zIndex = 20;
            } else if (offset === 2) {
              // 遠右翼二號位
              rotateY = -48;
              translateX = '102%';
              translateZ = -135;
              scale = 0.66;
              opacity = 0.35;
              zIndex = 10;
            } else if (offset === -2) {
              // 遠左翼二號位
              rotateY = 48;
              translateX = '-102%';
              translateZ = -135;
              scale = 0.66;
              opacity = 0.35;
              zIndex = 10;
            }

            return (
              <motion.div
                key={bag.id}
                className="absolute w-[245px] h-[445px] sm:w-[285px] sm:h-[490px] md:w-[305px] md:h-[515px] origin-center cursor-pointer select-none"
                style={{
                  zIndex,
                  willChange: 'transform, opacity',
                  transform: 'translateZ(0)',
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
                  stiffness: 300,
                  damping: 26,
                  mass: 0.8,
                }}
                onClick={() => handleBagClick(bag, index)}
              >
                <LuckyBagRedPacketCard
                  bag={bag}
                  isCenter={isCenter}
                  priority={isCenter}
                  variant="carousel"
                />
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 底部分頁指示圓點 (Dots) */}
      {total > 1 && (
        <div className="flex items-center justify-center gap-2 mt-2">
          {bags.map((bag, idx) => (
            <button
              key={bag.id}
              onClick={() => setCurrentIndex(idx)}
              className={cn(
                "h-2 rounded-full transition-all duration-300 cursor-pointer",
                idx === currentIndex
                  ? "w-8 bg-gradient-to-r from-amber-400 to-yellow-300 shadow-[0_0_10px_rgba(250,204,21,0.8)]"
                  : "w-2 bg-slate-700 hover:bg-slate-500"
              )}
              aria-label={`切換至第 ${idx + 1} 個紅包福袋`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
