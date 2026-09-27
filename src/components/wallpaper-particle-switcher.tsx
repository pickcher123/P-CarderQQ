'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Sparkles, Compass, EyeOff, SlidersHorizontal, ShieldCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useFirestore } from '@/firebase';
import { useIsAdmin } from '@/hooks/use-is-admin';
import { doc, updateDoc } from 'firebase/firestore';
import type { SystemConfig } from '@/types/system';
import { getEffectiveParticleEffect, getNextSwitchTime, ParticleMode } from '@/lib/daily-style';

interface WallpaperParticleSwitcherProps {
  initialMode?: ParticleMode;
  systemConfig?: SystemConfig;
  className?: string;
  showInFrontEnd?: boolean;
}

export function WallpaperParticleSwitcher({
  initialMode = 'gold_dust',
  systemConfig,
  className = '',
  showInFrontEnd = true,
}: WallpaperParticleSwitcherProps) {
  const { isAdmin, isLoading } = useIsAdmin();
  const firestore = useFirestore();
  const [currentMode, setCurrentMode] = useState<ParticleMode>(initialMode);
  const [nextSwitchInfo, setNextSwitchInfo] = useState<string>('');

  const isAutoRotation = systemConfig?.dailyStyleRotation !== false;

  // 定時計算下次 12:00 切換時間
  useEffect(() => {
    const updateCountdown = () => {
      const info = getNextSwitchTime(systemConfig?.dailyRotationType || 'every_12_hours');
      setNextSwitchInfo(info.displayText);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 60000);
    return () => clearInterval(interval);
  }, [systemConfig?.dailyRotationType]);

  // 讀取本地偏好設定或系統即時設定
  useEffect(() => {
    if (isAutoRotation) {
      const effective = getEffectiveParticleEffect(systemConfig);
      setCurrentMode(effective);
    } else if (initialMode && initialMode !== 'none') {
      setCurrentMode(initialMode);
    } else {
      const local = localStorage.getItem('p_carder_wallpaper_particle') as ParticleMode;
      if (local && (local === 'gold_dust' || local === 'stars' || local === 'none')) {
        setCurrentMode(local);
      } else if (initialMode) {
        setCurrentMode(initialMode);
      }
    }

    const handleExternalChange = (e: Event) => {
      const ce = e as CustomEvent<{ mode: ParticleMode }>;
      if (ce.detail?.mode) {
        setCurrentMode(ce.detail.mode);
      }
    };

    window.addEventListener('wallpaper-particle-changed', handleExternalChange);
    return () => window.removeEventListener('wallpaper-particle-changed', handleExternalChange);
  }, [initialMode, isAutoRotation, systemConfig]);

  // 權限防護：非管理員絕對不渲染任何前台設定鈕
  if (isLoading || !isAdmin || !showInFrontEnd) {
    return null;
  }

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();

    // 順序切換：璀璨金粒 -> 夢幻星空 -> 關閉 -> 璀璨金粒
    const nextMode: ParticleMode =
      currentMode === 'gold_dust'
        ? 'stars'
        : currentMode === 'stars'
        ? 'none'
        : 'gold_dust';

    setCurrentMode(nextMode);
    localStorage.setItem('p_carder_wallpaper_particle', nextMode);

    // 發送全域自訂事件通知 AnimatedBackground 即時切換
    window.dispatchEvent(
      new CustomEvent('wallpaper-particle-changed', {
        detail: { mode: nextMode },
      })
    );

    // 同步更新全站設定至 systemConfig
    if (firestore) {
      try {
        const configRef = doc(firestore, 'systemConfig', 'main');
        updateDoc(configRef, {
          wallpaperParticleEffect: nextMode,
        }).catch(() => {});
      } catch (err) {}
    }
  };

  return (
    <div className={cn("inline-flex items-center gap-1.5 select-none bg-slate-950/80 p-1 rounded-2xl border border-slate-700/60 shadow-2xl backdrop-blur-md", className)}>
      {/* 管理員專用身分徽章標識 */}
      <div className="flex items-center gap-1 px-2 py-1 text-[10px] font-black text-rose-300 bg-rose-950/70 border border-rose-500/40 rounded-xl">
        <ShieldCheck className="w-3 h-3 text-rose-400" />
        <span>管理員專用</span>
      </div>

      {/* 1. 後台管理快捷按鈕 */}
      <Link
        href="/admin/materials"
        title="前往後台視覺與桌布管理設定"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800/90 transition-all duration-200"
      >
        <SlidersHorizontal className="w-3 h-3 text-indigo-400" />
        <span>後台管理</span>
      </Link>

      {/* 2. 桌布顆粒切換按鈕 */}
      <button
        type="button"
        onClick={handleToggle}
        title={`點擊切換全站桌布顆粒風格 (目前: ${currentMode === 'gold_dust' ? '璀璨金粒' : currentMode === 'stars' ? '夢幻星空' : '已關閉'})`}
        className={cn(
          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all duration-300 select-none border",
          currentMode === 'gold_dust'
            ? "bg-amber-950/70 border-amber-500/50 text-amber-300 hover:bg-amber-900/80 shadow-amber-500/10"
            : currentMode === 'stars'
            ? "bg-indigo-950/70 border-indigo-500/50 text-indigo-300 hover:bg-indigo-900/80 shadow-indigo-500/10"
            : "bg-slate-900/80 border-slate-700/70 text-slate-400 hover:bg-slate-800"
        )}
      >
        {currentMode === 'gold_dust' ? (
          <>
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span className="tracking-wide">桌布：金粒</span>
          </>
        ) : currentMode === 'stars' ? (
          <>
            <Compass className="w-3 h-3 text-cyan-400" />
            <span className="tracking-wide">桌布：星空</span>
          </>
        ) : (
          <>
            <EyeOff className="w-3 h-3 text-slate-400" />
            <span className="tracking-wide">桌布：關閉</span>
          </>
        )}
      </button>

      {/* 3. 每日12點換風格狀態提示 (微型) */}
      {isAutoRotation && (
        <span
          title={`每天 12 點自動換風格已啟動。下次更替：${nextSwitchInfo}`}
          className="hidden lg:flex items-center gap-1 px-2 py-0.5 text-[9px] text-amber-400/90 font-medium bg-amber-500/10 rounded-lg border border-amber-500/20"
        >
          <Clock className="w-2.5 h-2.5" />
          <span>每日12點自動輪播中</span>
        </span>
      )}
    </div>
  );
}
export type { ParticleMode };

