'use client';

import { useState, useEffect, useRef } from 'react';
import { Download, X, Smartphone, Sparkles, Share2, PlusSquare, ArrowUpRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => void;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function InstallPWAButton() {
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null);
  const [isAvailable, setIsAvailable] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);

  useEffect(() => {
    // 7 天內關閉過提示就不再打擾使用者
    try {
      const dismissedUntil = Number(localStorage.getItem('pwa-prompt-dismissed-until') || '0');
      if (dismissedUntil > Date.now()) {
        setIsVisible(false);
        return;
      }
    } catch {
      // ignore storage errors
    }

    // Detect standalone mode (already installed as PWA)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsVisible(false);
      return;
    }

    // Detect iOS devices
    const ua = window.navigator.userAgent.toLowerCase();
    const isIOSDevice = /iphone|ipad|ipod/.test(ua) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // If on iOS and not standalone, we can make it available to guide the user
    if (isIOSDevice) {
      setIsAvailable(true);
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      promptRef.current = e as BeforeInstallPromptEvent;
      setIsAvailable(true);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt as EventListener);
    };
  }, []);

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
      return;
    }

    const prompt = promptRef.current;
    if (!prompt) {
      // In case on desktop or browser without prompt, show tip
      return;
    }

    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsAvailable(false);
      setIsVisible(false);
    }
    promptRef.current = null;
  };

  const handleDismiss = () => {
    setIsVisible(false);
    try {
      localStorage.setItem('pwa-prompt-dismissed-until', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
    } catch {
      // ignore
    }
  };

  if (!isAvailable || !isVisible) return null;

  return (
    <>
      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.94 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "fixed z-[9999] flex items-center select-none",
              // Mobile: positioned neatly above mobile bottom nav
              "bottom-[calc(max(env(safe-area-inset-bottom),0px)+4.75rem)] left-3 sm:left-6 sm:bottom-6",
              "max-w-[calc(100vw-1.5rem)] sm:max-w-[360px]"
            )}
          >
            {/* Outer Luxury Card - 暗黑曜石 × 香檳金 */}
            <div className="relative group flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-[#0a0f1c]/95 backdrop-blur-2xl border border-white/[0.1] border-t-amber-300/65 shadow-[0_20px_50px_rgba(0,0,0,0.88)] hover:border-amber-300/45 transition-[border-color,box-shadow] duration-200 overflow-hidden">
              {/* 頂部香檳金微光細線 */}
              <div className="absolute inset-x-0 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300/75 to-transparent pointer-events-none" />
              <div className="absolute -top-10 left-6 w-28 h-16 bg-amber-400/10 blur-2xl pointer-events-none" />

              {/* 品牌實體 APP 圖示 */}
              <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-xl overflow-hidden border border-amber-300/40 bg-black/60 shadow-[0_4px_14px_rgba(0,0,0,0.6)] shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icon-192.png"
                  alt="P+CARDER APP"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Text Info */}
              <div className="min-w-0 flex-1 pr-0.5">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-black text-white tracking-tight leading-tight truncate">
                    P+CARDER
                  </h4>
                  <span className="text-[9px] font-black text-[#FDE68A] bg-amber-400/[0.12] border border-amber-300/35 px-1.5 py-0.5 rounded-full shrink-0 uppercase tracking-wider leading-none">
                    APP
                  </span>
                </div>
                <p className="text-[10.5px] sm:text-[11px] text-slate-400 font-medium truncate mt-0.5">
                  全螢幕極速開包 · 桌面即點即玩
                </p>
              </div>

              {/* Install Action Button */}
              <button
                type="button"
                onClick={handleInstallClick}
                className={cn(
                  "relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-black shrink-0",
                  "bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 hover:brightness-105",
                  "text-[#120d02] shadow-[0_4px_16px_rgba(245,158,11,0.3)]",
                  "active:scale-[0.96] transition-[transform,filter] duration-150 cursor-pointer"
                )}
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>安裝</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white p-1.5 rounded-full hover:bg-white/[0.08] active:scale-90 transition-colors shrink-0 cursor-pointer"
                aria-label="關閉提示"
                title="7 天內不再提示"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Installation Instructions Modal - 統一暗黑曜石 × 香檳金 */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-md bg-[#0a0f1c]/95 backdrop-blur-2xl text-white border border-white/[0.1] border-t-amber-300/65 shadow-[0_24px_64px_rgba(0,0,0,0.88)] rounded-2xl p-5 sm:p-6">
          <DialogHeader>
            <div className="mx-auto w-14 h-14 rounded-2xl overflow-hidden border border-amber-300/45 shadow-[0_8px_24px_rgba(0,0,0,0.65)] mb-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/icon-192.png" alt="P+CARDER" className="w-full h-full object-cover" />
            </div>
            <DialogTitle className="text-center text-lg font-black tracking-wide text-white">
              將 P+CARDER 加入主畫面
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-400 pt-1">
              只需 3 步驟即可安裝至手機桌面，享受全螢幕原生 APP 級開包體驗！
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 py-2 text-xs text-slate-200">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#FDE68A] to-amber-400 text-[#120d02] font-black text-xs tabular-nums">
                1
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white">點擊 Safari 底部的「分享」按鈕</p>
                <p className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-1">
                  即瀏覽器底部工具列的圖示 <Share2 className="h-3.5 w-3.5 text-[#FDE68A] inline" />
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#FDE68A] to-amber-400 text-[#120d02] font-black text-xs tabular-nums">
                2
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white">往下滑動並選擇「加入主畫面」</p>
                <p className="text-slate-400 text-[11px] mt-0.5 flex items-center gap-1">
                  點選 <PlusSquare className="h-3.5 w-3.5 text-[#FDE68A] inline" />「加入主畫面」選項
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/[0.08]">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-r from-[#FDE68A] to-amber-400 text-[#120d02] font-black text-xs tabular-nums">
                3
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-white">點擊右上角的「新增」</p>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  完成後即可在手機桌面找到 P+CARDER 圖示並即點即玩！
                </p>
              </div>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 hover:brightness-105 text-[#120d02] font-black text-xs active:scale-[0.98] transition-[transform,filter] cursor-pointer"
            >
              我知道了
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
