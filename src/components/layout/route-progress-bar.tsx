'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';

/**
 * 頂部極細路由切換進度條：點擊站內連結瞬間給予 0ms 視覺回饋，切換完成後平滑收尾
 */
export function RouteProgressBar() {
  const pathname = usePathname();
  const [progress, setProgress] = useState(0);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  // 當路徑完成切換時，將進度推至 100% 並淡出
  useEffect(() => {
    clearTimers();
    if (visible) {
      setProgress(100);
      hideTimerRef.current = setTimeout(() => {
        setVisible(false);
        setProgress(0);
      }, 220);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // 監聽全站內部連結點擊，立即啟動進度條
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const target = e.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href || !href.startsWith('/') || href.startsWith('//') || anchor.target === '_blank') {
        return;
      }

      const nextPath = href.split('?')[0].split('#')[0];
      if (nextPath === pathname) return;

      clearTimers();
      setVisible(true);
      setProgress(24);

      timerRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 88) return prev;
          const step = prev < 55 ? 10 : 4;
          return Math.min(88, prev + step);
        });
      }, 120);
    };

    document.addEventListener('click', handleClick, true);
    return () => {
      document.removeEventListener('click', handleClick, true);
      clearTimers();
    };
  }, [pathname]);

  if (!visible && progress === 0) return null;

  return (
    <div
      aria-hidden="true"
      className="fixed top-0 left-0 right-0 z-[100] h-[2px] pointer-events-none overflow-hidden"
    >
      <div
        className="h-full bg-gradient-to-r from-amber-300 via-cyan-300 to-amber-300 transition-[width,opacity] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          opacity: progress === 100 ? 0 : 1,
        }}
      />
    </div>
  );
}
