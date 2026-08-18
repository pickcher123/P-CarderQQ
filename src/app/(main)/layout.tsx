'use client';
import { motion } from "motion/react";
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

export default function MainLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const firestore = useFirestore();
  const pathname = usePathname();
  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
  
  const isMarqueeVisible = systemConfig?.featureFlags?.isMarqueeEnabled !== false;
  const isOpenPackPage = pathname.startsWith('/draw/open');
  const isDrawing = pathname.startsWith('/draw');
  
  if (isOpenPackPage) {
    return (
      <div className="relative min-h-[100dvh] w-full overflow-hidden bg-slate-950">
        <AnimatedBackground backgroundUrl={systemConfig?.backgroundUrl} backgroundOpacity={systemConfig?.backgroundOpacity} />
        <main className="w-full h-full min-h-[100dvh]">
          {children}
        </main>
      </div>
    );
  }
  
  return (
    <div className="relative flex min-h-screen flex-col">
      <AnimatedBackground backgroundUrl={systemConfig?.backgroundUrl} backgroundOpacity={systemConfig?.backgroundOpacity} />
      <Header systemConfig={systemConfig} />
      {isMarqueeVisible && <NewsMarquee isDrawing={isDrawing} />}
      <motion.main 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="flex-1 pb-20 md:pb-0"
      >
        {children}
      </motion.main>
      <InstallPWAButton />
      <FloatingLineButton systemConfig={systemConfig} />
      {pathname === '/' && <Footer />}
      <MobileBottomNav systemConfig={systemConfig} />
    </div>
  );
}
