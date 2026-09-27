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
    // Check if dismissed in this session
    try {
      const dismissed = sessionStorage.getItem('pwa-prompt-dismissed');
      if (dismissed === 'true') {
        setIsVisible(false);
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
      sessionStorage.setItem('pwa-prompt-dismissed', 'true');
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
            {/* Outer Luxury Card */}
            <div className="relative group flex items-center gap-3 p-2.5 sm:p-3 rounded-2xl bg-slate-950/92 backdrop-blur-xl border border-amber-500/35 shadow-[0_10px_35px_rgba(0,0,0,0.8),0_0_20px_rgba(245,158,11,0.15)] hover:border-amber-500/50 transition-all duration-300">
              {/* Golden Top Shimmer Edge */}
              <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-amber-400/60 to-transparent pointer-events-none rounded-t-2xl" />

              {/* App Icon Emblem */}
              <div className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 text-slate-950 font-black shadow-md shadow-amber-500/30 border border-amber-300/40 shrink-0">
                <span className="text-xs sm:text-sm font-black tracking-tighter">P+</span>
                <span className="absolute -top-1 -right-1 flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-300 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-400"></span>
                </span>
              </div>

              {/* Text Info */}
              <div className="min-w-0 flex-1 pr-1">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-black text-slate-100 tracking-tight leading-tight truncate">
                    安裝 P+CARDER
                  </h4>
                  <span className="text-[9px] font-bold text-amber-400/90 bg-amber-400/10 border border-amber-400/25 px-1 py-0.2 rounded-sm shrink-0 uppercase tracking-widest">
                    APP
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium truncate mt-0.5">
                  桌面即點即開 · 暢享極速玩卡
                </p>
              </div>

              {/* Install Action Button */}
              <button
                onClick={handleInstallClick}
                className={cn(
                  "relative flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black shrink-0",
                  "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 hover:from-amber-300 hover:to-amber-500",
                  "text-slate-950 shadow-md shadow-amber-500/25 hover:shadow-amber-500/45",
                  "active:scale-95 hover:scale-[1.02] transition-all duration-200 cursor-pointer"
                )}
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>安裝</span>
              </button>

              {/* Close Button */}
              <button
                onClick={handleDismiss}
                className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 active:scale-90 transition-colors ml-0.5 shrink-0 cursor-pointer"
                aria-label="關閉提示"
                title="關閉提示"
              >
                <X className="w-3.5 h-3.5 stroke-[2.2]" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* iOS Installation Instructions Modal */}
      <Dialog open={showIOSModal} onOpenChange={setShowIOSModal}>
        <DialogContent className="light bg-white text-slate-900 border-none shadow-2xl rounded-3xl sm:max-w-md p-6">
          <DialogHeader>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 mb-2">
              <Smartphone className="h-6 w-6" />
            </div>
            <DialogTitle className="text-center text-lg font-black tracking-tight text-slate-900">
              將 P+CARDER 加入主畫面
            </DialogTitle>
            <DialogDescription className="text-center text-xs text-slate-500 pt-1">
              只需 3 步驟即可將平台安裝至手機桌面，享受全螢幕原生 APP 級體驗！
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-xs text-slate-700">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                1
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-900">點擊 Safari 底部的「分享」按鈕</p>
                <p className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1">
                  即瀏覽器底部工具列的圖示 <Share2 className="h-3.5 w-3.5 text-blue-600 inline" />
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                2
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-900">往下滑動並選擇「加入主畫面」</p>
                <p className="text-slate-500 text-[11px] mt-0.5 flex items-center gap-1">
                  點選 <PlusSquare className="h-3.5 w-3.5 text-slate-700 inline" />「加入主畫面」選項
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-500 text-slate-950 font-black text-xs">
                3
              </div>
              <div className="flex-1">
                <p className="font-bold text-slate-900">點擊右上角的「新增」</p>
                <p className="text-slate-500 text-[11px] mt-0.5">
                  完成後即可在手機桌面找到 P+CARDER 圖示並即點即玩！
                </p>
              </div>
            </div>
          </div>

          <div className="pt-2">
            <button
              onClick={() => setShowIOSModal(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition-colors cursor-pointer"
            >
              我知道了
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
