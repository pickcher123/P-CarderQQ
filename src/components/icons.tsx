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
    <span className="font-headline text-xl sm:text-2xl font-bold text-primary tracking-tighter">
      P+Carder
    </span>
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
