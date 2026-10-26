'use client';
import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Header } from "@/components/layout/header";
import { Footer } from "@/components/layout/footer";
import { AnimatedBackground } from "@/components/animated-background";
import { useDoc, useFirestore, useMemoFirebase } from "@/firebase";
import { doc } from "firebase/firestore";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { NewsMarquee } from "@/components/news-marquee";
import { FloatingLineButton } from "@/components/floating-line-button";
import { InstallPWAButton } from "@/components/install-pwa-button";
import type { SystemConfig } from "@/types/system";
import { usePathname } from "next/navigation";
import { useFeatureFlags } from "@/hooks/use-feature-flags";
import { getEffectiveParticleEffect, ParticleMode } from "@/lib/daily-style";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { MaintenanceScreen } from "@/components/maintenance-screen";
import { ShieldAlert, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const firestore = useFirestore();
  const pathname = usePathname();
  const { isAdmin, isLoading: isAuthLoading } = useIsAdmin();
  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig, isLoading: isConfigLoading } = useDoc<SystemConfig>(systemConfigRef);
  const { isFeatureEnabled } = useFeatureFlags(systemConfig);
  
  const [activeParticleEffect, setActiveParticleEffect] = useState<ParticleMode>('gold_dust');

  // 計算並監聽 12:00 風格切換與全域事件
  useEffect(() => {
    const updateStyle = () => {
      const mode = getEffectiveParticleEffect(systemConfig);
      setActiveParticleEffect(mode);
    };

    updateStyle();

    // 每 30 秒自動檢查一次時間，當跨越 12:00 時無縫切換風格
    const timer = setInterval(updateStyle, 30000);

    const handleCustomChange = (e: Event) => {
      const ce = e as CustomEvent<{ mode: ParticleMode }>;
      if (ce.detail?.mode) {
        setActiveParticleEffect(ce.detail.mode);
      }
    };

    window.addEventListener('wallpaper-particle-changed', handleCustomChange);
    return () => {
      clearInterval(timer);
      window.removeEventListener('wallpaper-particle-changed', handleCustomChange);
    };
  }, [systemConfig]);

  const isMaintenanceActive = Boolean(systemConfig?.maintenance?.enabled);

  // 🚧 若啟用了全站維護模式，且造訪者不是管理員：全面攔截並僅顯示維護中全螢幕畫面
  if (isMaintenanceActive && !isAdmin && !isAuthLoading && !isConfigLoading) {
    return (
      <MaintenanceScreen 
        config={systemConfig?.maintenance} 
        defaultContactUrl={systemConfig?.supportLineUrl || systemConfig?.communityUrl}
      />
    );
  }

  const isMarqueeVisible = isFeatureEnabled('isMarqueeEnabled', true);
  const isOpenPackPage = pathname.startsWith('/draw/open');
  const isDrawing = pathname.startsWith('/draw');
  
  if (isOpenPackPage) {
    return (
      <div className="relative min-h-[100dvh] w-full overflow-hidden bg-slate-950">
        {isMaintenanceActive && isAdmin && (
          <div className="sticky top-0 z-50 bg-amber-500 text-slate-950 px-3 py-1 text-xs font-bold flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              全站維護中 (管理員預覽)
            </span>
            <Link href="/admin" className="underline hover:text-white">後台設定</Link>
          </div>
        )}
        <AnimatedBackground
          backgroundUrl={systemConfig?.backgroundUrl}
          backgroundOpacity={systemConfig?.backgroundOpacity}
          particleEffect={activeParticleEffect}
        />
        <main className="w-full h-full min-h-[100dvh]">
          {children}
        </main>
      </div>
    );
  }
  
  return (
    <div className="relative flex min-h-screen flex-col overflow-x-hidden max-w-full w-full">
      <AnimatedBackground
        backgroundUrl={systemConfig?.backgroundUrl}
        backgroundOpacity={systemConfig?.backgroundOpacity}
        particleEffect={activeParticleEffect}
      />
      <div className="relative z-10 flex min-h-screen flex-col w-full flex-1">
        {isMaintenanceActive && isAdmin && (
          <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 text-slate-950 px-3.5 py-1.5 text-xs font-black flex items-center justify-between shadow-lg border-b border-amber-600">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 fill-slate-950 text-amber-500 shrink-0" />
              <span>【管理員預覽】全站目前處於維護中狀態，一般訪客無法進入瀏覽網頁，僅管理員可訪問。</span>
            </div>
            <Link href="/admin" className="underline hover:text-white font-bold ml-3 shrink-0 flex items-center gap-1">
              <span>前往後台關閉維護</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        )}
        <Header systemConfig={systemConfig} />
        {isMarqueeVisible && <NewsMarquee isDrawing={isDrawing} />}
        <motion.main 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex-1 pb-36 sm:pb-40 md:pb-16 overflow-x-hidden max-w-full w-full"
        >
          {children}
        </motion.main>
        <InstallPWAButton />
        <FloatingLineButton systemConfig={systemConfig} />
        {pathname === '/' && <Footer />}
        <MobileBottomNav systemConfig={systemConfig} />
      </div>
    </div>
  );
}
