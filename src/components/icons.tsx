'use client';

import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';

export function Logo({
  className,
  isLoading,
  asStatic = false,
}: {
  className?: string;
  isLoading?: boolean;
  asStatic?: boolean;
}) {
  if (isLoading) {
    return <Skeleton className={cn('h-8 w-32', className)} />;
  }

  const content = (
    <div className="flex items-center group cursor-pointer select-none">
      {/* 品牌純文字 LOGO */}
      <span className="font-headline font-black text-lg sm:text-2xl tracking-tighter text-cyan-400 drop-shadow-[0_0_12px_rgba(34,211,238,0.4)] group-hover:drop-shadow-[0_0_18px_rgba(34,211,238,0.7)] transition-all">
        P+CARDER
      </span>
    </div>
  );

  if (asStatic) {
    return (
      <div className={cn('flex items-center space-x-2', className)}>
        {content}
      </div>
    );
  }

  return (
    <Link href="/" className={cn('flex items-center space-x-2', className)}>
      {content}
    </Link>
  );
}

/**
 * 鑽石專屬圖示 (全站統一晶鑽符號)：立體切割、青藍色彩晶漸層與高光刻面
 */
export function DiamondIcon({ className, size }: { className?: string; size?: number | string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block shrink-0 align-middle drop-shadow-[0_0_6px_rgba(34,211,238,0.6)]", className || "w-4 h-4 text-cyan-400")}
    >
      <defs>
        <linearGradient id="diamond-top-gradient" x1="6" y1="3.5" x2="18" y2="8.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#F0F9FF" />
          <stop offset="100%" stopColor="#7DD3FC" />
        </linearGradient>
        <linearGradient id="diamond-facet-left" x1="2" y1="8.5" x2="10" y2="8.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
        <linearGradient id="diamond-facet-right" x1="14" y1="8.5" x2="22" y2="8.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#BAE6FD" />
          <stop offset="100%" stopColor="#38BDF8" />
        </linearGradient>
        <linearGradient id="diamond-bottom-center" x1="10" y1="8.5" x2="14" y2="20.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0284C7" />
          <stop offset="100%" stopColor="#0369A1" />
        </linearGradient>
        <linearGradient id="diamond-bottom-left" x1="2" y1="8.5" x2="12" y2="20.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0EA5E9" />
          <stop offset="100%" stopColor="#0284C7" />
        </linearGradient>
        <linearGradient id="diamond-bottom-right" x1="22" y1="8.5" x2="12" y2="20.5" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38BDF8" />
          <stop offset="100%" stopColor="#0EA5E9" />
        </linearGradient>
      </defs>
      
      {/* 頂部檯面 (Table) */}
      <polygon points="6,3.5 18,3.5 14,8.5 10,8.5" fill="url(#diamond-top-gradient)" />
      
      {/* 頂部左冠部刻面 (Left Crown) */}
      <polygon points="6,3.5 10,8.5 2,8.5" fill="url(#diamond-facet-left)" />
      
      {/* 頂部中冠部刻面 (Center Crown) */}
      <polygon points="10,8.5 14,8.5 12,3.5" fill="#BAE6FD" opacity="0.95" />
      
      {/* 頂部右冠部刻面 (Right Crown) */}
      <polygon points="18,3.5 22,8.5 14,8.5" fill="url(#diamond-facet-right)" />
      
      {/* 底部左亭部 (Left Pavilion) */}
      <polygon points="2,8.5 10,8.5 12,20.5" fill="url(#diamond-bottom-left)" />
      
      {/* 底部中亭部 (Center Pavilion) */}
      <polygon points="10,8.5 14,8.5 12,20.5" fill="url(#diamond-bottom-center)" />
      
      {/* 底部右亭部 (Right Pavilion) */}
      <polygon points="14,8.5 22,8.5 12,20.5" fill="url(#diamond-bottom-right)" />
      
      {/* 輪廓刻面細線 (Crisp highlight facets) */}
      <polygon 
        points="6,3.5 18,3.5 22,8.5 12,20.5 2,8.5" 
        stroke="#F0F9FF" 
        strokeWidth="1.2" 
        strokeLinecap="round" 
        strokeLinejoin="round" 
      />
      <line x1="2" y1="8.5" x2="22" y2="8.5" stroke="#E0F2FE" strokeWidth="0.8" opacity="0.8" />
      <line x1="6" y1="3.5" x2="10" y2="8.5" stroke="#E0F2FE" strokeWidth="0.8" opacity="0.8" />
      <line x1="18" y1="3.5" x2="14" y2="8.5" stroke="#E0F2FE" strokeWidth="0.8" opacity="0.8" />
      <line x1="10" y1="8.5" x2="12" y2="20.5" stroke="#E0F2FE" strokeWidth="0.8" opacity="0.8" />
      <line x1="14" y1="8.5" x2="12" y2="20.5" stroke="#E0F2FE" strokeWidth="0.8" opacity="0.8" />
      
      {/* 頂部高光耀斑 (Glint highlight) */}
      <circle cx="6.5" cy="4.5" r="1.1" fill="#FFFFFF" opacity="0.95" />
    </svg>
  );
}

export const GemIcon = DiamondIcon;

/**
 * P+ 點數專屬符號：金色加粗 P 與右上角 +
 */
export function PPlusIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      className={cn("text-accent drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]", className)}
    >
      <path 
        d="M6 4H12C15.3137 4 18 6.68629 18 10C18 13.3137 15.3137 16 12 16H6V4Z" 
        stroke="currentColor" 
        strokeWidth="3.5" 
        strokeLinecap="round" 
        strokeLinejoin="round"
      />
      <path 
        d="M6 16V20" 
        stroke="currentColor" 
        strokeWidth="3.5" 
        strokeLinecap="round"
      />
      <g transform="translate(16, 16)">
        <path d="M0 4H8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
        <path d="M4 0V8" stroke="currentColor" strokeWidth="3" strokeLinecap="round"/>
      </g>
    </svg>
  );
}

/**
 * 拼卡專區圖示：兩張卡片交叉 (Crossed Cards)
 */
export function CrossedCardsIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect x="3" y="6" width="10" height="14" rx="2" transform="rotate(-15 8 13)" />
      <rect x="11" y="4" width="10" height="14" rx="2" transform="rotate(15 16 11)" />
      <path d="M12 8v8" opacity="0.3" />
      <path d="M8 12h8" opacity="0.3" />
    </svg>
  );
}

/**
 * 福袋專區圖示：束口寶物袋
 */
export function LuckyBagIcon({ className }: { className?: string }) {
  return (
    <svg 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <path d="M5 11c0-1.5 1-3 3-3h8c2 0 3 1.5 3 3v7c0 2-1.5 3-3 3H8c-1.5 0-3-1-3-3v-7z" />
      <path d="M8 8c0-2 1-4 4-4s4 2 4 4" />
      <path d="M9 5c0-1 1-2 3-2s3 1 3 2" opacity="0.5" />
      <path d="M5 11h14" />
      <circle cx="12" cy="11" r="1.5" fill="currentColor" />
      <path d="m12 14 .5 1.5 1.5.5-1.5.5-.5 1.5-.5-1.5-1.5-.5 1.5-.5.5-1.5z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/**
 * 手機版專用導覽圖示：抽卡 (等角 3D 卡盒)
 */
export function NavDrawIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M12 3L20 7.5V16.5L12 21L4 16.5V7.5L12 3Z" />
      <path d="M12 12L20 7.5" />
      <path d="M12 12V21" />
      <path d="M12 12L4 7.5" />
      <path d="M8 5.5L16 10" opacity="0.5" />
    </svg>
  );
}

/**
 * 手機版專用導覽圖示：拼卡 (對決卡牌)
 */
export function NavBetIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="3" y="6" width="10" height="14" rx="2" transform="rotate(-12 8 13)" />
      <rect x="11" y="4" width="10" height="14" rx="2" transform="rotate(12 16 11)" />
      <circle cx="8" cy="13" r="1.5" fill="currentColor" opacity="0.8" />
      <circle cx="16" cy="11" r="1.5" fill="currentColor" opacity="0.8" />
    </svg>
  );
}

/**
 * 手機版專用導覽圖示：福袋 (束口袋與幸運結)
 */
export function NavLuckyBagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M6 10C6 8.5 7.5 7.5 9 7.5H15C16.5 7.5 18 8.5 18 10L18.5 17.5C18.5 19.4 17 21 15 21H9C7 21 5.5 19.4 5.5 17.5L6 10Z" />
      <path d="M9 7.5C9 5.5 10.5 3.5 12 3.5C13.5 3.5 15 5.5 15 7.5" />
      <path d="M6 10.5H18" />
      <circle cx="12" cy="10.5" r="1.2" fill="currentColor" />
      <path d="M12 14V17.5" opacity="0.7" />
      <path d="M10 15.8H14" opacity="0.7" />
    </svg>
  );
}

/**
 * 手機版專用導覽圖示：團拆 (雙人/多人標誌)
 */
export function NavGroupBreakIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M15.5 20.5V18.5C15.5 17 14.5 15.5 13 15.5H6C4.5 15.5 3.5 17 3.5 18.5V20.5" />
      <circle cx="9.5" cy="8.5" r="3.5" />
      <path d="M18.5 15.5C19.8 15.8 20.5 17 20.5 18.5V20.5" />
      <path d="M15.5 6.5C16.8 6.8 17.5 7.8 17.5 9C17.5 10.2 16.8 11.2 15.5 11.5" />
    </svg>
  );
}

/**
 * 手機版專用導覽圖示：收藏庫 (三張立體卡夾/卡冊)
 */
export function NavCollectionIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="4" y="5" width="4.5" height="15" rx="1.5" />
      <rect x="10" y="5" width="4.5" height="15" rx="1.5" />
      <path d="M16.5 6.5L19.5 5.5L20.5 19.5L17.5 20.5" />
      <path d="M6.25 9.5H6.26" strokeWidth="2.5" />
      <path d="M12.25 9.5H12.26" strokeWidth="2.5" />
    </svg>
  );
}

/**
 * 手機版專用導覽圖示：VIP 王冠
 */
export function NavVipIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3.5 17.5L5 7L9.5 11.5L12 5.5L14.5 11.5L19 7L20.5 17.5H3.5Z" />
      <path d="M3.5 17.5H20.5V19.5C20.5 20.3 19.8 21 19 21H5C4.2 21 3.5 20.3 3.5 19.5V17.5Z" />
      <circle cx="5" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="12" cy="5.5" r="1" fill="currentColor" stroke="none" />
      <circle cx="19" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}
