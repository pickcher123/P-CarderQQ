'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  History, 
  Building2, 
  ShieldCheck, 
  ChevronRight, 
  ChevronLeft,
  Sparkles, 
  Heart, 
  Scale, 
  Truck, 
  Award, 
  MessageCircle, 
  Mail, 
  ExternalLink,
  CheckCircle2,
  Zap,
  Copy,
  Check,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from '@/components/ui/scroll-area';
import { SafeImage } from '@/components/safe-image';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { useDoc, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { SystemConfig } from '@/types/system';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function AboutPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

  const fallbackOriginImage = PlaceHolderImages.find(img => img.id === 'about-origin');
  const originImageUrl = systemConfig?.aboutOriginImageUrl || fallbackOriginImage?.imageUrl || '';

  const [activeTab, setActiveTab] = useState(0);
  const [isCopiedLine, setIsCopiedLine] = useState(false);
  const [isCopiedEmail, setIsCopiedEmail] = useState(false);

  // Swipe / Drag handling
  const touchStartX = useRef<number | null>(null);
  const touchDeltaX = useRef<number>(0);
  const isDragging = useRef<boolean>(false);

  const copyToClipboard = (text: string, type: 'line' | 'email') => {
    navigator.clipboard.writeText(text);
    if (type === 'line') {
      setIsCopiedLine(true);
      setTimeout(() => setIsCopiedLine(false), 2000);
      toast({ title: '已複製 LINE ID', description: text });
    } else {
      setIsCopiedEmail(true);
      setTimeout(() => setIsCopiedEmail(false), 2000);
      toast({ title: '已複製客服信箱', description: text });
    }
  };

  const cards = [
    {
      id: 'origin',
      tag: '01 品牌起源',
      title: '那一聲清脆的撕裂，是藏家心中最純粹的悸動',
      icon: Heart,
      accentColor: 'text-rose-400',
      badgeBg: 'bg-rose-500/15 border-rose-500/30 text-rose-300',
    },
    {
      id: 'features',
      tag: '02 核心特色',
      title: '4 大核心優勢 · 打造極致玩卡信任體系',
      icon: ShieldCheck,
      accentColor: 'text-cyan-400',
      badgeBg: 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300',
    },
    {
      id: 'vision',
      tag: '03 品牌願景',
      title: '讓收藏回歸熱愛，讓每一抽都充滿真實價值',
      icon: Sparkles,
      accentColor: 'text-amber-400',
      badgeBg: 'bg-amber-500/15 border-amber-500/30 text-amber-300',
    },
    {
      id: 'company',
      tag: '04 營運與客服',
      title: '云希國際合法立案 · 官方專屬客服即時服務',
      icon: Building2,
      accentColor: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300',
    },
    {
      id: 'terms',
      tag: '05 權益保障',
      title: '消保透明承諾 · 藏家消費與實體寄送權益',
      icon: Scale,
      accentColor: 'text-purple-400',
      badgeBg: 'bg-purple-500/15 border-purple-500/30 text-purple-300',
    },
  ];

  const coreFeatures = [
    {
      icon: ShieldCheck,
      title: "絕對公平與機率公開",
      desc: "堅持所有卡池與賞項機率100%公開透明，讓每一次抽卡都經得起驗證。",
      color: "text-cyan-400 bg-cyan-500/10 border-cyan-500/30"
    },
    {
      icon: Award,
      title: "正版品質保證",
      desc: "嚴選全球官方授權球員卡與珍稀評級卡，每一張皆為值得典藏的資產。",
      color: "text-amber-400 bg-amber-500/10 border-amber-500/30"
    },
    {
      icon: Truck,
      title: "實體寄送與靈活轉換",
      desc: "抽中即可選擇申請安全實體包裹寄送到府，或靈活 Buy Back 換取 P 點。",
      color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30"
    },
    {
      icon: Zap,
      title: "多元多元玩法體驗",
      desc: "包含即時單抽、直播團拆 (Group Break)、幸運福袋與拼卡競技殿堂。",
      color: "text-purple-400 bg-purple-500/10 border-purple-500/30"
    }
  ];

  const totalCards = cards.length;

  const handleNext = useCallback(() => {
    setActiveTab((prev) => (prev + 1) % totalCards);
  }, [totalCards]);

  const handlePrev = useCallback(() => {
    setActiveTab((prev) => (prev - 1 + totalCards) % totalCards);
  }, [totalCards]);

  // Touch Swipe handlers
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchDeltaX.current = 0;
    isDragging.current = true;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!touchStartX.current) return;
    touchDeltaX.current = e.touches[0].clientX - touchStartX.current;
  };

  const onTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;
    if (touchDeltaX.current < -40) {
      handleNext();
    } else if (touchDeltaX.current > 40) {
      handlePrev();
    }
    touchStartX.current = null;
    touchDeltaX.current = 0;
  };

  return (
    <div className="container max-w-5xl py-6 md:py-10 space-y-6 relative overflow-hidden select-none">
      {/* 背景光暈效果 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/10 blur-[130px] pointer-events-none rounded-full" />
      <div className="absolute top-[40%] right-[-10%] w-[400px] h-[250px] bg-amber-500/10 blur-[120px] pointer-events-none rounded-full" />

      {/* 頂部 Hero 簡短標題 */}
      <div className="text-center space-y-2 relative z-10 max-w-2xl mx-auto">
        <h1 className="font-headline text-2xl sm:text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-[0_0_20px_rgba(6,182,212,0.35)]">
          關於 <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-amber-300">P+CARDER</span>
        </h1>
        <p className="text-slate-300 text-xs sm:text-sm font-medium">
          熱愛球員卡的藏家榮耀殿堂 · 點選或左右滑動瀏覽字卡
        </p>
      </div>

      {/* 橫向切換藥丸標籤列 (Tab Navigation Pills) */}
      <div className="relative z-10 flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-1 px-1 justify-start sm:justify-center">
        {cards.map((card, idx) => {
          const isActive = idx === activeTab;
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer",
                isActive
                  ? "bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-300 border-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.3)] scale-105"
                  : "bg-slate-900/80 text-slate-400 hover:text-slate-200 border-slate-800 hover:border-slate-700"
              )}
            >
              <Icon className={cn("w-3.5 h-3.5", isActive ? card.accentColor : "text-slate-400")} />
              <span>{card.tag}</span>
            </button>
          );
        })}
      </div>

      {/* 字卡輪播容器 (Horizontal Slide Cards Container) */}
      <div 
        className="relative z-10 min-h-[380px] sm:min-h-[420px] md:min-h-[450px] flex items-center justify-center"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* 左側橫移按鈕 */}
        <button
          type="button"
          onClick={handlePrev}
          className="absolute -left-2 sm:-left-4 z-30 p-2 sm:p-2.5 rounded-full bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-cyan-400 hover:text-white transition-all shadow-xl hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-md"
          aria-label="上一個字卡"
        >
          <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* 右側橫移按鈕 */}
        <button
          type="button"
          onClick={handleNext}
          className="absolute -right-2 sm:-right-4 z-30 p-2 sm:p-2.5 rounded-full bg-slate-950/80 hover:bg-slate-900 border border-slate-800 text-cyan-400 hover:text-white transition-all shadow-xl hover:scale-110 active:scale-95 cursor-pointer backdrop-blur-md"
          aria-label="下一個字卡"
        >
          <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
        </button>

        {/* 動畫切換內容卡片 */}
        <div className="w-full max-w-4xl px-2 sm:px-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: 25 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -25 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="w-full rounded-3xl bg-gradient-to-b from-slate-900/90 via-slate-950/95 to-black border border-cyan-500/25 p-5 sm:p-7 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl relative overflow-hidden"
            >
              {/* 卡片頂部光條飾邊 */}
              <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400/80 to-transparent shadow-[0_0_12px_#22d3ee]" />

              {/* 卡片頂部編號與標題欄 */}
              <div className="flex flex-wrap items-center justify-between gap-2 pb-4 border-b border-white/10 mb-4">
                <div className="flex items-center gap-2">
                  <span className={cn("text-xs font-mono font-bold px-2.5 py-0.5 rounded-full border shadow-sm", cards[activeTab].badgeBg)}>
                    {cards[activeTab].tag}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    {activeTab + 1} / {totalCards}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <span>左右橫移字卡</span>
                  <div className="flex gap-1">
                    <ChevronLeft className="w-3.5 h-3.5 text-cyan-400" />
                    <ChevronRight className="w-3.5 h-3.5 text-cyan-400" />
                  </div>
                </div>
              </div>

              {/* 字卡 1：品牌起源 */}
              {activeTab === 0 && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
                  <div className="md:col-span-7 space-y-3">
                    <h2 className="text-xl sm:text-2xl font-black font-headline text-white leading-snug">
                      那一聲清脆的撕裂，是藏家心中最純粹的悸動
                    </h2>
                    <div className="space-y-2.5 text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                      <p>
                        還記得小時候，手裡緊握著累積已久的零用錢，屏息凝神撕開卡包的那一秒嗎？那一瞬間的期待與驚喜，是每一位球卡收藏家心中最難忘的熱血回憶。
                      </p>
                      <p>
                        隨著時代演進，收藏形式不斷創新，但那份「期待感與珍藏價值」不該改變。P+CARDER 的誕生，正是為了在數位時代中將實體球卡體驗結合極致流暢的線上樂趣，讓每位卡友都能安心典藏屬於自己的夢幻卡款。
                      </p>
                    </div>
                  </div>
                  <div className="md:col-span-5 flex justify-center">
                    <div className="relative aspect-[16/10] sm:aspect-[4/3] w-full rounded-2xl overflow-hidden border border-white/15 shadow-xl bg-slate-900 group">
                      {originImageUrl && (
                        <SafeImage 
                          src={originImageUrl} 
                          alt="P+CARDER Origin" 
                          fill
                          className="object-cover transition-transform duration-700 group-hover:scale-105"
                          priority
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-70" />
                      <div className="absolute bottom-2.5 left-2.5 right-2.5 p-2 rounded-xl bg-slate-950/80 backdrop-blur-md border border-white/10 text-[11px] text-slate-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="font-bold text-white truncate">正版實品卡片嚴選認證</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* 字卡 2：核心特色 */}
              {activeTab === 1 && (
                <div className="space-y-4">
                  <h2 className="text-xl sm:text-2xl font-black font-headline text-white">
                    4 大核心特色 · 全台唯一數位收藏標準
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {coreFeatures.map((feat, idx) => (
                      <div 
                        key={idx}
                        className="p-3.5 rounded-2xl bg-slate-900/60 backdrop-blur-md border border-white/5 space-y-1.5 hover:border-cyan-500/30 transition-all duration-300 group"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`p-2 rounded-xl border ${feat.color} shrink-0`}>
                            <feat.icon className="w-4 h-4" />
                          </div>
                          <h3 className="font-bold text-white text-sm">{feat.title}</h3>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed pl-1">{feat.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 字卡 3：品牌願景 */}
              {activeTab === 2 && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <h2 className="text-xl sm:text-2xl font-black font-headline text-primary flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-amber-400" />
                      我們的品牌願景
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      P+CARDER 致力於構建一個「玩家優先、安全信任」的數位卡牌生態系。我們不單單提供抽卡體驗，更致力於打造讓全台球卡收藏家自豪的交換與展覽平台。
                    </p>
                  </div>

                  <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-transparent border border-cyan-500/30 space-y-1.5">
                    <p className="text-cyan-300 font-bold text-base sm:text-lg italic">
                      「讓收藏回歸熱愛，讓每一抽都充滿真實價值。」
                    </p>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      這是我們對所有卡友的承諾。無論您是資深評級卡藏家，或是剛踏入球卡領域的新人玩家，P+CARDER 隨時歡迎您的加入！
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-between items-center pt-2">
                    <p className="text-xs text-slate-400 italic">
                      感謝您支持 P+CARDER，與我們一起開啟卡牌收藏新時代。
                    </p>
                    <Button variant="outline" size="sm" asChild className="rounded-xl border-cyan-500/30 hover:bg-cyan-500/10 text-cyan-300 text-xs">
                      <Link href="/changelog">
                        <History className="mr-1.5 h-3.5 w-3.5" /> 查看系統進化日誌
                      </Link>
                    </Button>
                  </div>
                </div>
              )}

              {/* 字卡 4：營運與客服 */}
              {activeTab === 3 && (
                <div className="space-y-4">
                  <h2 className="text-xl sm:text-2xl font-black font-headline text-white flex items-center gap-2">
                    <Building2 className="text-emerald-400 h-5 w-5" />
                    營運公司與官方客服管道
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* 公司主體 */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2.5">
                      <div className="flex justify-between items-center text-xs pb-1.5 border-b border-white/5">
                        <span className="text-slate-400">營運公司</span>
                        <span className="font-bold text-white">云希國際股份有限公司</span>
                      </div>
                      <div className="flex justify-between items-center text-xs pb-1.5 border-b border-white/5">
                        <span className="text-slate-400">統一編號</span>
                        <span className="font-mono text-cyan-400 font-black">90301251</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">立案狀態</span>
                        <span className="text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3.5 h-3.5" /> 經濟部合法立案
                        </span>
                      </div>
                    </div>

                    {/* 客服管道 */}
                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/10 space-y-2.5">
                      <div className="flex justify-between items-center text-xs pb-1.5 border-b border-white/5">
                        <span className="text-slate-400">官方 LINE@</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono font-bold text-emerald-400">@288qqsyq</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('@288qqsyq', 'line')}
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                            title="複製"
                          >
                            {isCopiedLine ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                          <a
                            href="https://line.me/R/ti/p/@288qqsyq"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
                          >
                            加入
                          </a>
                        </div>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-slate-400">客服信箱</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-slate-200 text-[11px] truncate max-w-[140px]">pickcher1234@gmail.com</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard('pickcher1234@gmail.com', 'email')}
                            className="p-1 rounded bg-slate-800 text-slate-300 hover:text-white"
                            title="複製"
                          >
                            {isCopiedEmail ? <Check className="w-3 h-3 text-cyan-400" /> : <Copy className="w-3 h-3" />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 bg-emerald-950/30 rounded-xl border border-emerald-500/20 flex items-center justify-between text-xs text-slate-300">
                    <span>任何疑問或實體卡配送進度？隨時透過 LINE 聯繫客服。</span>
                    <Button size="sm" asChild className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-8">
                      <a href="https://line.me/R/ti/p/@288qqsyq" target="_blank" rel="noopener noreferrer">
                        聯繫 LINE
                      </a>
                    </Button>
                  </div>
                </div>
              )}

              {/* 字卡 5：權益保障與條款 */}
              {activeTab === 4 && (
                <div className="space-y-4">
                  <h2 className="text-xl sm:text-2xl font-black font-headline text-white flex items-center gap-2">
                    <ShieldCheck className="text-purple-400 h-5 w-5" />
                    藏家權益保障與消費規範
                  </h2>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1 text-xs">
                      <span className="font-bold text-amber-400">【數位內容退換說明】</span>
                      <p className="text-slate-400 leading-relaxed">
                        依據消保法第19條合理例外情事，本平台提供之數位線上抽卡與遊戲服務一經執行即完成，不適用七日鑑賞期無條件解約。
                      </p>
                    </div>

                    <div className="p-3.5 rounded-2xl bg-white/5 border border-white/5 space-y-1 text-xs">
                      <span className="font-bold text-cyan-400">【實體商品瑕疵處理】</span>
                      <p className="text-slate-400 leading-relaxed">
                        兌換寄送之實體卡若有重大瑕疵，請於收到包裹7日內保留完整開箱錄影，並透過官方 LINE@ 聯繫團隊辦理換貨或補償。
                      </p>
                    </div>
                  </div>

                  <div className="pt-1">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full rounded-2xl border-purple-500/30 hover:bg-purple-500/10 text-slate-200 text-xs font-bold flex items-center justify-center group h-10">
                          <FileText className="h-4 w-4 mr-2 text-purple-400" /> 查看完整服務與隱私規範 <ChevronRight className="h-3.5 w-3.5 ml-1 group-hover:translate-x-1 transition-transform" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-3xl bg-slate-950/95 backdrop-blur-3xl border-white/15 rounded-3xl text-slate-200">
                        <DialogHeader>
                          <DialogTitle className="text-xl sm:text-2xl font-black font-headline text-primary flex items-center gap-2.5">
                            <Scale className="h-6 w-6 text-primary" /> P+CARDER 服務條款與使用者規範
                          </DialogTitle>
                          <DialogDescription className="text-slate-400 text-xs">
                            請詳細閱讀以下平台服務規範，以保障您的會員權益。
                          </DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="h-[60vh] pr-4 mt-2">
                          <div className="space-y-6 text-xs sm:text-sm text-slate-300 leading-relaxed pb-6">
                            <section className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                              <h4 className="font-bold text-white text-base flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-primary" /> 1. 數位內容與線上抽卡服務
                              </h4>
                              <p className="text-slate-400">
                                本平台提供之線上抽卡、賞項兌換及拼卡競技等服務，屬於「非以有形媒介提供之數位內容」或「一經提供即為完成之線上服務」。依據《消費者保護法》第19條及《通訊交易解除權合理例外情事適用準則》第2條第5款規定，點數一經扣除並完成遊戲，服務即告完成，不適用七日鑑賞期無條件退貨。
                              </p>
                            </section>

                            <section className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                              <h4 className="font-bold text-white text-base flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-400" /> 2. 實體卡片商品與品質定義
                              </h4>
                              <p className="text-slate-400">
                                平台所發放之實體卡片均為官方正版授權商品或珍稀評級卡。卡片市場價格隨時間與行情波動，品質定義如下：
                              </p>
                              <ul className="list-disc list-inside ml-2 space-y-1 text-slate-400">
                                <li><strong className="text-white">重大瑕疵：</strong> 卡面嚴重破裂、大面積缺角、明顯摺痕。</li>
                                <li><strong className="text-white">非瑕疵範圍：</strong> 製程微小刮痕 (Surface Scratches)、印刷輕微偏位 (Centering)、正版評級卡盒微痕。</li>
                              </ul>
                            </section>

                            <section className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                              <h4 className="font-bold text-white text-base flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-amber-400" /> 3. 售後服務與開箱憑證
                              </h4>
                              <p className="text-slate-400">
                                若收到之實體商品有重大瑕疵或寄錯狀況，請於收到包裹後「7日內」聯繫官方 LINE@ 客服，並附上完整未剪輯之開箱錄影影片作為憑證。經團隊核實後，將安排換貨或點數補助。
                              </p>
                            </section>

                            <section className="space-y-2 bg-white/5 p-4 rounded-2xl border border-white/5">
                              <h4 className="font-bold text-white text-base flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-purple-400" /> 4. 點數管理與帳號安全
                              </h4>
                              <p className="text-slate-400">
                                平台點數 (P點) 僅限於本平台內部抽賞與購買使用，不可私下轉讓或要求兌換等值現金。若發現利用系統漏洞、惡意刷點或不正當軟體操作，本平台有權終止服務並回收相關異常資產。
                              </p>
                            </section>

                            <p className="pt-2 text-primary font-bold italic text-center text-xs">
                              條款版本：2026年08月05日 最新修訂
                            </p>
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* 底部指示器與提示 */}
      <div className="flex flex-col items-center justify-center gap-2 text-center pt-1">
        {/* 圓點指示器 */}
        <div className="flex items-center gap-1.5">
          {cards.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setActiveTab(idx)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                idx === activeTab
                  ? "w-6 bg-cyan-400 shadow-[0_0_8px_#22d3ee]"
                  : "w-1.5 bg-slate-700 hover:bg-slate-500"
              )}
              aria-label={`切換至第 ${idx + 1} 個字卡`}
            />
          ))}
        </div>

        <p className="text-[11px] text-cyan-400/80 font-medium tracking-widest flex items-center gap-1.5">
          <span>&lt;</span>
          <span>左右橫移字卡 · 無需長距離向下滑動</span>
          <span>&gt;</span>
        </p>
      </div>
    </div>
  );
}
