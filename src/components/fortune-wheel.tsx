'use client';

import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface FortuneWheelProps {
  selectedNumbers: number[];
  wheelRotation: number;
  spinTransition: boolean;
  disabled?: boolean;
  onToggleNumber: (num: number) => void;
  idPrefix?: string;
  sizeClassName?: string;
}

/**
 * 精工機械腕錶風格 10 等分命運轉盤
 * 包含：拉絲香檳金外環刻度、立體徑向扇區、12 點鐘黃金鑽石指針與中央勝率核心
 */
export function FortuneWheel({
  selectedNumbers,
  wheelRotation,
  spinTransition,
  disabled = false,
  onToggleNumber,
  idPrefix = 'wheel',
  sizeClassName = 'w-[252px] h-[252px] sm:w-[288px] sm:h-[288px]',
}: FortuneWheelProps) {
  const winProbability = selectedNumbers.length * 10;

  // 10 格扇區幾何座標 (中心 160,160, 扇區外半徑 142, 內環 48, 數字半徑 104)
  const wheelSlices = useMemo(() => {
    const cx = 160;
    const cy = 160;
    const r = 142;
    const rText = 104;

    return Array.from({ length: 10 }, (_, idx) => {
      const num = idx + 1;
      const centerDeg = idx * 36 - 90;
      const startDeg = centerDeg - 18;
      const endDeg = centerDeg + 18;
      const startRad = (startDeg * Math.PI) / 180;
      const endRad = (endDeg * Math.PI) / 180;
      const centerRad = (centerDeg * Math.PI) / 180;

      const x1 = cx + r * Math.cos(startRad);
      const y1 = cy + r * Math.sin(startRad);
      const x2 = cx + r * Math.cos(endRad);
      const y2 = cy + r * Math.sin(endRad);

      const tx = cx + rText * Math.cos(centerRad);
      const ty = cy + rText * Math.sin(centerRad);

      const path = `M ${cx} ${cy} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r} ${r} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;

      return {
        num,
        idx,
        path,
        tx,
        ty,
        rotateDeg: idx * 36,
      };
    });
  }, []);

  // 60 格精密錶圈刻度
  const bezelTicks = useMemo(() => {
    return Array.from({ length: 60 }, (_, i) => {
      const deg = i * 6 - 90;
      const rad = (deg * Math.PI) / 180;
      const isMajor = i % 6 === 0;
      const rInner = isMajor ? 145.5 : 147.5;
      const rOuter = 152;
      return {
        i,
        isMajor,
        x1: 160 + rInner * Math.cos(rad),
        y1: 160 + rInner * Math.sin(rad),
        x2: 160 + rOuter * Math.cos(rad),
        y2: 160 + rOuter * Math.sin(rad),
      };
    });
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center select-none">
      {/* 12 點鐘精雕黃金鑽石指針 */}
      <div className="relative z-30 -mb-3.5 pointer-events-none drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]">
        <svg width="28" height="32" viewBox="0 0 28 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <linearGradient id={`${idPrefix}-pointer-gold`} x1="14" y1="0" x2="14" y2="30" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FEF3C7" />
              <stop offset="45%" stopColor="#F59E0B" />
              <stop offset="100%" stopColor="#B45309" />
            </linearGradient>
          </defs>
          <path
            d="M14 30L4.5 11.5C3.6 9.8 4.1 7.6 5.6 6.4L11.5 1.8C13 0.6 15 0.6 16.5 1.8L22.4 6.4C23.9 7.6 24.4 9.8 23.5 11.5L14 30Z"
            fill={`url(#${idPrefix}-pointer-gold)`}
            stroke="#FEF9C3"
            strokeWidth="1.2"
          />
          <polygon points="14,7.5 17.2,12 14,16.5 10.8,12" fill="#FFFBEB" fillOpacity="0.9" />
        </svg>
      </div>

      {/* 外環金屬錶圈 */}
      <div
        className={cn(
          'relative rounded-full p-[3px] bg-gradient-to-b from-amber-200/45 via-amber-500/25 to-slate-800/80 shadow-[0_18px_45px_rgba(0,0,0,0.75)] flex items-center justify-center',
          sizeClassName
        )}
      >
        <div className="relative w-full h-full rounded-full bg-[#060912] p-1.5 flex items-center justify-center border border-black/80">
          <svg
            viewBox="0 0 320 320"
            className="w-full h-full rounded-full overflow-visible"
            style={{
              transform: `rotate(${wheelRotation}deg)`,
              transition: spinTransition ? 'transform 5.6s cubic-bezier(0.08, 0.92, 0.16, 1)' : 'none',
            }}
          >
            <defs>
              {/* 選中扇區：玫紅鎏金徑向漸層 */}
              <radialGradient id={`${idPrefix}-slice-active`} cx="50%" cy="50%" r="65%">
                <stop offset="25%" stopColor="#BE123C" />
                <stop offset="72%" stopColor="#E11D48" />
                <stop offset="100%" stopColor="#F59E0B" />
              </radialGradient>
              {/* 未選中偶數扇區：深海曜石 */}
              <radialGradient id={`${idPrefix}-slice-odd`} cx="50%" cy="50%" r="68%">
                <stop offset="20%" stopColor="#0B101D" />
                <stop offset="100%" stopColor="#172136" />
              </radialGradient>
              {/* 未選中奇數扇區：午夜玄鐵 */}
              <radialGradient id={`${idPrefix}-slice-even`} cx="50%" cy="50%" r="68%">
                <stop offset="20%" stopColor="#070B14" />
                <stop offset="100%" stopColor="#111829" />
              </radialGradient>
              {/* 金屬細框漸層 */}
              <linearGradient id={`${idPrefix}-rim-gold`} x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#D97706" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#FDE68A" stopOpacity="0.55" />
              </linearGradient>
            </defs>

            {/* 外圍精密刻度環 */}
            <circle cx="160" cy="160" r="154" fill="#050811" stroke={`url(#${idPrefix}-rim-gold)`} strokeWidth="1.2" />
            {bezelTicks.map((t) => (
              <line
                key={t.i}
                x1={t.x1}
                y1={t.y1}
                x2={t.x2}
                y2={t.y2}
                stroke={t.isMajor ? '#FCD34D' : 'rgba(148,163,184,0.32)'}
                strokeWidth={t.isMajor ? '1.6' : '0.8'}
                strokeLinecap="round"
              />
            ))}

            {/* 10 等分扇區 */}
            {wheelSlices.map((slice) => {
              const isSelected = selectedNumbers.includes(slice.num);
              return (
                <g
                  key={slice.num}
                  onClick={() => !disabled && onToggleNumber(slice.num)}
                  className={cn(!disabled && 'cursor-pointer hover:brightness-110 transition-all')}
                >
                  <path
                    d={slice.path}
                    fill={
                      isSelected
                        ? `url(#${idPrefix}-slice-active)`
                        : slice.idx % 2 === 0
                        ? `url(#${idPrefix}-slice-odd)`
                        : `url(#${idPrefix}-slice-even)`
                    }
                    stroke={isSelected ? '#FDE68A' : 'rgba(255,255,255,0.12)'}
                    strokeWidth={isSelected ? 1.6 : 0.9}
                  />
                  <text
                    x={slice.tx}
                    y={slice.ty}
                    textAnchor="middle"
                    dominantBaseline="central"
                    transform={`rotate(${slice.rotateDeg}, ${slice.tx}, ${slice.ty})`}
                    fill={isSelected ? '#FFFFFF' : '#94A3B8'}
                    fontSize={isSelected ? '17.5' : '14.5'}
                    fontWeight="700"
                    fontFamily="monospace"
                  >
                    {slice.num}
                  </text>
                </g>
              );
            })}

            {/* 內環細金線裝飾圈 */}
            <circle cx="160" cy="160" r="142" fill="none" stroke={`url(#${idPrefix}-rim-gold)`} strokeWidth="1.2" />
            <circle cx="160" cy="160" r="64" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.9" />
          </svg>

          {/* 中央雙環金屬勝率核心 */}
          <div className="absolute inset-0 m-auto w-[84px] h-[84px] sm:w-[94px] sm:h-[94px] rounded-full p-[2px] bg-gradient-to-b from-amber-200/75 via-amber-500/40 to-amber-900/70 shadow-[0_6px_24px_rgba(0,0,0,0.9)] z-20 pointer-events-none">
            <div className="w-full h-full rounded-full bg-[radial-gradient(circle_at_35%_25%,#1b2438_0%,#090d18_70%,#04060c_100%)] flex flex-col items-center justify-center border border-black/60">
              <span className="text-[10px] text-slate-400 tracking-wider">勝率</span>
              <span className="text-lg sm:text-xl font-bold font-mono tabular-nums text-amber-200 leading-tight">
                {winProbability}%
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {selectedNumbers.length}/10 格
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
