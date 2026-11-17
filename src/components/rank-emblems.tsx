'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface RankEmblemProps {
  className?: string;
}

/**
 * 1. 新手收藏家 (NOVICE COLLECTOR) — 鍛鋼盾徽
 */
export function RankNoviceEmblem({ className }: RankEmblemProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id="rank-novice-outer" x1="8" y1="5" x2="32" y2="35" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E2E8F0" />
          <stop offset="50%" stopColor="#94A3B8" />
          <stop offset="100%" stopColor="#475569" />
        </linearGradient>
        <linearGradient id="rank-novice-inner" x1="20" y1="8" x2="20" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#0F172A" />
        </linearGradient>
      </defs>
      {/* 外盾輪廓 */}
      <path
        d="M20 4.5L32.5 9.2V19.6C32.5 27.1 27.1 32.8 20 35.5C12.9 32.8 7.5 27.1 7.5 19.6V9.2L20 4.5Z"
        fill="url(#rank-novice-outer)"
      />
      {/* 內凹盾面 */}
      <path
        d="M20 7.2L30 11V19.5C30 25.6 25.7 30.3 20 32.6C14.3 30.3 10 25.6 10 19.5V11L20 7.2Z"
        fill="url(#rank-novice-inner)"
      />
      {/* 左右立體斜切面 */}
      <path d="M20 7.2V32.6C14.3 30.3 10 25.6 10 19.5V11L20 7.2Z" fill="#FFFFFF" fillOpacity="0.06" />
      {/* 中央簡約卡徽菱形 */}
      <path d="M20 12.5L24.5 19.5L20 26.5L15.5 19.5L20 12.5Z" fill="#CBD5E1" fillOpacity="0.9" />
      <path d="M20 12.5L24.5 19.5L20 26.5V12.5Z" fill="#64748B" fillOpacity="0.55" />
      <path
        d="M20 4.5L32.5 9.2V19.6C32.5 27.1 27.1 32.8 20 35.5C12.9 32.8 7.5 27.1 7.5 19.6V9.2L20 4.5Z"
        stroke="#F1F5F9"
        strokeOpacity="0.45"
        strokeWidth="0.9"
      />
    </svg>
  );
}

/**
 * 2. 進階收藏家 (ADEPT COLLECTOR) — 鉑銀星芒勳章
 */
export function RankAdeptEmblem({ className }: RankEmblemProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id="rank-adept-ring" x1="6" y1="6" x2="34" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F8FAFC" />
          <stop offset="45%" stopColor="#CBD5E1" />
          <stop offset="100%" stopColor="#64748B" />
        </linearGradient>
        <linearGradient id="rank-adept-core" x1="20" y1="9" x2="20" y2="31" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#94A3B8" />
        </linearGradient>
      </defs>
      {/* 八角鉑銀底座 */}
      <polygon
        points="20,4 29,7.8 34,15.5 34,24.5 29,32.2 20,36 11,32.2 6,24.5 6,15.5 11,7.8"
        fill="#0F172A"
        stroke="url(#rank-adept-ring)"
        strokeWidth="2"
      />
      {/* 內圈細刻環 */}
      <circle cx="20" cy="20" r="10.5" stroke="#E2E8F0" strokeOpacity="0.25" strokeWidth="0.9" />
      {/* 破曉四芒主星 */}
      <path
        d="M20 7.5L22.8 17.2L32.5 20L22.8 22.8L20 32.5L17.2 22.8L7.5 20L17.2 17.2L20 7.5Z"
        fill="url(#rank-adept-core)"
      />
      {/* 刻面陰影 */}
      <path d="M20 7.5L22.8 17.2L20 20V7.5Z" fill="#FFFFFF" />
      <path d="M20 20L32.5 20L22.8 22.8L20 20Z" fill="#64748B" fillOpacity="0.6" />
      <path d="M20 20L20 32.5L17.2 22.8L20 20Z" fill="#475569" fillOpacity="0.65" />
      {/* 四角副星點 */}
      <circle cx="12.5" cy="12.5" r="1.1" fill="#E2E8F0" fillOpacity="0.7" />
      <circle cx="27.5" cy="12.5" r="1.1" fill="#E2E8F0" fillOpacity="0.7" />
      <circle cx="12.5" cy="27.5" r="1.1" fill="#E2E8F0" fillOpacity="0.7" />
      <circle cx="27.5" cy="27.5" r="1.1" fill="#E2E8F0" fillOpacity="0.7" />
    </svg>
  );
}

/**
 * 3. 資深收藏家 (VETERAN COLLECTOR) — 鎏金桂冠紋章
 */
export function RankVeteranEmblem({ className }: RankEmblemProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id="rank-vet-gold" x1="8" y1="6" x2="32" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF3C7" />
          <stop offset="45%" stopColor="#F59E0B" />
          <stop offset="100%" stopColor="#92400E" />
        </linearGradient>
        <linearGradient id="rank-vet-ribbon" x1="14" y1="24" x2="26" y2="36" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FBBF24" />
          <stop offset="100%" stopColor="#78350F" />
        </linearGradient>
      </defs>
      {/* 雙側榮譽綬帶 */}
      <path d="M14.5 24.5L11.5 35.5L17.5 32.5L20 35.5L22.5 32.5L28.5 35.5L25.5 24.5H14.5Z" fill="url(#rank-vet-ribbon)" />
      {/* 雙翼桂冠弧線 */}
      <path d="M9 22C6.5 18 7 12.5 10.5 9.5" stroke="#FBBF24" strokeOpacity="0.65" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M31 22C33.5 18 33 12.5 29.5 9.5" stroke="#FBBF24" strokeOpacity="0.65" strokeWidth="1.4" strokeLinecap="round" />
      {/* 主圓金章 */}
      <circle cx="20" cy="17.5" r="10.5" fill="url(#rank-vet-gold)" />
      <circle cx="20" cy="17.5" r="7.8" fill="#1C1206" stroke="#FDE68A" strokeOpacity="0.6" strokeWidth="0.9" />
      {/* 中心三階梯菱鑽 */}
      <path d="M20 11.8L24.8 17.5L20 23.2L15.2 17.5L20 11.8Z" fill="url(#rank-vet-gold)" />
      <path d="M20 11.8L24.8 17.5L20 23.2V11.8Z" fill="#78350F" fillOpacity="0.45" />
    </svg>
  );
}

/**
 * 4. 卡牌大師 (CARD MASTER) — 帝王金鑽稜鏡
 */
export function RankMasterEmblem({ className }: RankEmblemProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id="rank-master-top" x1="12" y1="7" x2="28" y2="16" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FEF9C3" />
          <stop offset="100%" stopColor="#FACC15" />
        </linearGradient>
        <linearGradient id="rank-master-left" x1="6" y1="15" x2="20" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDE047" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
        <linearGradient id="rank-master-right" x1="20" y1="15" x2="34" y2="33" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#854D0E" />
        </linearGradient>
      </defs>
      {/* 外圍精工六角框 */}
      <polygon
        points="20,3.5 34.5,11.5 34.5,28.5 20,36.5 5.5,28.5 5.5,11.5"
        fill="#140E03"
        fillOpacity="0.7"
        stroke="#FACC15"
        strokeOpacity="0.35"
        strokeWidth="1"
      />
      {/* 寶石檯面與冠部 */}
      <polygon points="12.5,9.5 27.5,9.5 33,16 7,16" fill="url(#rank-master-top)" />
      <polygon points="12.5,9.5 27.5,9.5 24,16 16,16" fill="#FEF9C3" />
      {/* 寶石底部刻面 */}
      <polygon points="7,16 16,16 20,32.5" fill="url(#rank-master-left)" />
      <polygon points="16,16 24,16 20,32.5" fill="#FACC15" />
      <polygon points="24,16 33,16 20,32.5" fill="url(#rank-master-right)" />
      {/* 銳利高光線 */}
      <path d="M12.5 9.5H27.5L33 16L20 32.5L7 16L12.5 9.5Z" stroke="#FEF08A" strokeWidth="1" strokeLinejoin="round" />
      <line x1="7" y1="16" x2="33" y2="16" stroke="#FEF9C3" strokeOpacity="0.75" strokeWidth="0.8" />
      <line x1="16" y1="16" x2="20" y2="32.5" stroke="#FEF9C3" strokeOpacity="0.55" strokeWidth="0.8" />
      <line x1="24" y1="16" x2="20" y2="32.5" stroke="#FEF9C3" strokeOpacity="0.55" strokeWidth="0.8" />
      <circle cx="13.5" cy="11.5" r="1.2" fill="#FFFFFF" />
    </svg>
  );
}

/**
 * 5. 殿堂級玩家 (HALL OF FAME) — 熾紅紅寶石聖盃
 */
export function RankHallOfFameEmblem({ className }: RankEmblemProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id="rank-hof-cup" x1="11" y1="7" x2="29" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFE4E6" />
          <stop offset="40%" stopColor="#FB7185" />
          <stop offset="100%" stopColor="#9F1239" />
        </linearGradient>
        <linearGradient id="rank-hof-base" x1="13" y1="28" x2="27" y2="35" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FDA4AF" />
          <stop offset="100%" stopColor="#881337" />
        </linearGradient>
      </defs>
      {/* 雙側勝利羽翼耳柄 */}
      <path
        d="M12 10H8C6.6 10 5.5 11.1 5.5 12.5V14.5C5.5 17.5 7.8 20 11 20.3"
        stroke="#FB7185"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M28 10H32C33.4 10 34.5 11.1 34.5 12.5V14.5C34.5 17.5 32.2 20 29 20.3"
        stroke="#FB7185"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      {/* 獎盃主體 */}
      <path
        d="M11.5 7.5H28.5V16.5C28.5 21.4 24.7 25.2 20 25.2C15.3 25.2 11.5 21.4 11.5 16.5V7.5Z"
        fill="url(#rank-hof-cup)"
      />
      {/* 左側受光面 */}
      <path
        d="M11.5 7.5H20V25.2C15.3 25.2 11.5 21.4 11.5 16.5V7.5Z"
        fill="#FFFFFF"
        fillOpacity="0.16"
      />
      {/* 盃身紅寶石菱印 */}
      <polygon points="20,11.5 23.2,15.5 20,19.5 16.8,15.5" fill="#4C0519" stroke="#FFE4E6" strokeWidth="0.9" />
      {/* 盃柱與底座 */}
      <rect x="18" y="25" width="4" height="5" fill="#E11D48" />
      <path d="M13 30H27L28.5 34H11.5L13 30Z" fill="url(#rank-hof-base)" />
      <path d="M11.5 7.5H28.5" stroke="#FFF1F2" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * 6. 傳奇收藏家 (LEGENDARY COLLECTOR) — 星穹紫晶星環徽
 */
export function RankLegendaryEmblem({ className }: RankEmblemProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id="rank-leg-star" x1="10" y1="6" x2="30" y2="34" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FAF5FF" />
          <stop offset="45%" stopColor="#C084FC" />
          <stop offset="100%" stopColor="#6B21A8" />
        </linearGradient>
        <linearGradient id="rank-leg-orbit" x1="5" y1="12" x2="35" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#E9D5FF" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#A855F7" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#F3E8FF" stopOpacity="0.9" />
        </linearGradient>
      </defs>
      {/* 外層虛空星軌環 */}
      <circle cx="20" cy="20" r="14.5" stroke="#A855F7" strokeOpacity="0.3" strokeWidth="0.9" strokeDasharray="2.5 2.5" />
      {/* 傾斜星環 */}
      <ellipse
        cx="20"
        cy="20"
        rx="16"
        ry="5.5"
        transform="rotate(-24 20 20)"
        stroke="url(#rank-leg-orbit)"
        strokeWidth="1.3"
      />
      {/* 永恆八芒主星 */}
      <path
        d="M20 5.5L22.7 15.8L33 18.5L22.7 21.2L20 31.5L17.3 21.2L7 18.5L17.3 15.8L20 5.5Z"
        fill="url(#rank-leg-star)"
      />
      {/* 立體刻面 */}
      <path d="M20 5.5L22.7 15.8L20 18.5V5.5Z" fill="#FFFFFF" fillOpacity="0.7" />
      <path d="M20 18.5L33 18.5L22.7 21.2L20 18.5Z" fill="#581C87" fillOpacity="0.55" />
      <path d="M20 18.5V31.5L17.3 21.2L20 18.5Z" fill="#3B0764" fillOpacity="0.6" />
      {/* 伴星光點 */}
      <path d="M30.5 8.5L31.3 10.7L33.5 11.5L31.3 12.3L30.5 14.5L29.7 12.3L27.5 11.5L29.7 10.7L30.5 8.5Z" fill="#F3E8FF" />
      <circle cx="9.5" cy="29.5" r="1.3" fill="#D8B4FE" />
    </svg>
  );
}

/**
 * 7. P+卡神 (GOD OF CARDS) — 蒼穹晶鑽皇冠
 */
export function RankGodEmblem({ className }: RankEmblemProps) {
  return (
    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={cn('shrink-0', className)}>
      <defs>
        <linearGradient id="rank-god-crown" x1="6" y1="8" x2="34" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ECFEFF" />
          <stop offset="45%" stopColor="#22D3EE" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id="rank-god-jewel" x1="20" y1="15" x2="20" y2="25" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="50%" stopColor="#67E8F9" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      {/* 皇冠主體五鋒輪廓 */}
      <path
        d="M6.5 28.5L4.5 14L13 19.5L20 8L27 19.5L35.5 14L33.5 28.5H6.5Z"
        fill="url(#rank-god-crown)"
      />
      {/* 右側立體明暗切面 */}
      <path
        d="M20 8L27 19.5L35.5 14L33.5 28.5H20V8Z"
        fill="#083344"
        fillOpacity="0.28"
      />
      {/* 皇冠底座金框帶 */}
      <rect x="6.5" y="29.5" width="27" height="3.8" rx="1.6" fill="url(#rank-god-crown)" />
      <rect x="6.5" y="29.5" width="27" height="1.2" rx="0.6" fill="#ECFEFF" fillOpacity="0.7" />
      {/* 冠頂三顆晶鑽寶石球 */}
      <circle cx="20" cy="6.2" r="2" fill="#ECFEFF" />
      <circle cx="4.5" cy="12" r="1.5" fill="#A5F3FC" />
      <circle cx="35.5" cy="12" r="1.5" fill="#A5F3FC" />
      {/* 中央鑲嵌神鑽 */}
      <polygon points="20,15.2 23.6,20.2 20,25.2 16.4,20.2" fill="url(#rank-god-jewel)" stroke="#ECFEFF" strokeWidth="0.9" />
      {/* 兩側副晶 */}
      <polygon points="11.5,21 13.3,23.2 11.5,25.4 9.7,23.2" fill="#CFFAFE" fillOpacity="0.9" />
      <polygon points="28.5,21 30.3,23.2 28.5,25.4 26.7,23.2" fill="#CFFAFE" fillOpacity="0.9" />
      {/* 整體描邊 */}
      <path
        d="M6.5 28.5L4.5 14L13 19.5L20 8L27 19.5L35.5 14L33.5 28.5H6.5Z"
        stroke="#CFFAFE"
        strokeOpacity="0.6"
        strokeWidth="0.9"
        strokeLinejoin="round"
      />
    </svg>
  );
}
