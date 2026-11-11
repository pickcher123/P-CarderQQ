'use client';
import Image from "next/image";

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { 
  Sparkles, 
  HelpCircle, 
  ShieldCheck, 
  Package, 
  Layers, 
  Truck, 
  RefreshCw, 
  Coins, 
  CheckCircle2, 
  ArrowRight,
  Search,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Gift,
  AlertTriangle,
  Lock,
  Wallet,
  Clock,
  Award,
  Zap,
  Check,
  ExternalLink,
  MessageCircle,
  FileText
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { PPlusIcon, DiamondIcon } from '@/components/icons';
import { GUIDE_STEPS, CORE_PILLARS, FAQ_LIST } from '@/data/guide-data';

const FAQ_TAG_THEMES: Record<string, { badge: string; border: string; glow: string; text: string }> = {
  '點數體系': { badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30', border: 'border-amber-500/40', glow: 'from-amber-500/20', text: 'text-amber-300' },
  '卡片處理': { badge: 'bg-rose-500/15 text-rose-300 border-rose-500/30', border: 'border-rose-500/40', glow: 'from-rose-500/20', text: 'text-rose-300' },
  '出貨與運費': { badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', border: 'border-emerald-500/40', glow: 'from-emerald-500/20', text: 'text-emerald-300' },
  '資金保障': { badge: 'bg-blue-500/15 text-blue-300 border-blue-500/30', border: 'border-blue-500/40', glow: 'from-blue-500/20', text: 'text-blue-300' },
  '斷線保護': { badge: 'bg-purple-500/15 text-purple-300 border-purple-500/30', border: 'border-purple-500/40', glow: 'from-purple-500/20', text: 'text-purple-300' },
  '新客須知': { badge: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30', border: 'border-yellow-500/40', glow: 'from-yellow-500/20', text: 'text-yellow-300' },
  '公平保證': { badge: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30', border: 'border-cyan-500/40', glow: 'from-cyan-500/20', text: 'text-cyan-300' },
};

export default function BeginnerGuidePage() {
  const [faqSearch, setFaqSearch] = useState('');
  const [activeFaqCategory, setActiveFaqCategory] = useState<string>('all');
  const faqCarouselRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeFaqIndex, setActiveFaqIndex] = useState(0);

  const filteredFaqs = (FAQ_LIST || []).filter(item => {
    const matchesSearch = !faqSearch.trim() || 
      item.q.toLowerCase().includes(faqSearch.toLowerCase()) || 
      item.a.toLowerCase().includes(faqSearch.toLowerCase()) ||
      item.tag.toLowerCase().includes(faqSearch.toLowerCase());
    
    const matchesCategory = activeFaqCategory === 'all' || item.tag === activeFaqCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', '點數體系', '卡片處理', '出貨與運費', '資金保障', '斷線保護', '新客須知', '公平保證'];

  const checkFaqScroll = () => {
    if (!faqCarouselRef.current) return;
    const { scrollLeft, scrollWidth, clientWidth } = faqCarouselRef.current;
    setCanScrollLeft(scrollLeft > 10);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);

    const cardWidth = 340;
    const index = Math.round(scrollLeft / cardWidth);
    setActiveFaqIndex(Math.min(Math.max(0, index), Math.max(0, filteredFaqs.length - 1)));
  };

  useEffect(() => {
    checkFaqScroll();
    const el = faqCarouselRef.current;
    if (!el) return;
    el.addEventListener('scroll', checkFaqScroll, { passive: true });
    return () => el.removeEventListener('scroll', checkFaqScroll);
  }, [filteredFaqs]);

  const scrollFaq = (direction: 'left' | 'right') => {
    if (!faqCarouselRef.current) return;
    const scrollAmount = faqCarouselRef.current.clientWidth * 0.85;
    faqCarouselRef.current.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    });
  };

  const scrollToFaqIndex = (idx: number) => {
    if (!faqCarouselRef.current) return;
    const cards = faqCarouselRef.current.children;
    if (cards[idx]) {
      (cards[idx] as HTMLElement).scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }
  };

  const handleCategorySelect = (cat: string) => {
    setActiveFaqCategory(cat);
    setActiveFaqIndex(0);
    if (faqCarouselRef.current) {
      faqCarouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 pb-28 pt-4 sm:pt-8 relative overflow-hidden">
      {/* 頂部賽博氛圍光暈 */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[400px] bg-gradient-to-b from-amber-500/10 via-cyan-500/5 to-transparent blur-[140px] pointer-events-none" />

      <div className="container max-w-6xl mx-auto px-4 sm:px-6 relative z-10 space-y-10 sm:space-y-16">
        
        {/* ================= HERO BANNER ================= */}
        <div className="text-center space-y-4 pt-4 sm:pt-8 max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-gradient-to-r from-amber-500/15 via-yellow-500/10 to-amber-500/15 border border-amber-400/40 text-amber-300 text-xs font-black shadow-[0_0_20px_rgba(245,158,11,0.2)]">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 animate-pulse" />
            <span>P+CARDER 官方一頁式新手全攻略 & FAQ</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-6xl font-black font-headline tracking-tight text-transparent bg-clip-text bg-gradient-to-b from-white via-slate-100 to-amber-200 drop-shadow-[0_4px_30px_rgba(245,158,11,0.3)]">
            第一次玩？看這裡就懂！
          </h1>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            不用加入任何群組即可自主掌握全站規則。我們將以最直白的實際流程，為您解答
            <span className="text-amber-400 font-bold mx-1">「實體卡 vs 點數獎項」</span>、
            <span className="text-cyan-400 font-bold mx-1">「收藏庫防潮存證」</span>以及
            <span className="text-rose-400 font-bold mx-1">「寄送與轉點折現雙軌制」</span>。
          </p>

          {/* 快速捷徑列 */}
          <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
            <a 
              href="#flow-example" 
              className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 hover:border-amber-400/40 text-xs font-bold text-slate-300 hover:text-amber-300 transition-all"
            >
              🚀 6 步完整流程範例
            </a>
            <a 
              href="#core-questions" 
              className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 hover:border-cyan-400/40 text-xs font-bold text-slate-300 hover:text-cyan-300 transition-all"
            >
              💎 實體卡與收藏庫解密
            </a>
            <a 
              href="#fairness-section" 
              className="px-3.5 py-1.5 rounded-xl bg-emerald-950/40 border border-emerald-500/40 hover:border-emerald-400 text-xs font-bold text-emerald-300 hover:text-emerald-200 transition-all"
            >
              🛡️ 公開公平驗證演算法
            </a>
            <a 
              href="#faq-section" 
              className="px-3.5 py-1.5 rounded-xl bg-slate-900/90 border border-white/10 hover:border-rose-400/40 text-xs font-bold text-slate-300 hover:text-rose-300 transition-all"
            >
              ❓ 必看 FAQ（點數、運費、斷線）
            </a>
          </div>
        </div>

                {/* ================= 視覺化新手四步圖解指南 ================= */}
        <section className="rounded-3xl overflow-hidden border border-amber-500/35 bg-gradient-to-b from-[#181120] to-slate-950 shadow-[0_15px_40px_rgba(0,0,0,0.8)] relative group">
          <div className="relative w-full aspect-[16/9] max-h-[460px] bg-slate-900">
            <Image 
              src="/assets/images/beginner-tutorial-guide.jpg"
              alt="P+Carder 新手全景玩法圖解指南"
              fill
              sizes="(max-width: 1200px) 100vw, 1200px"
              className="object-contain object-center"
              priority
            />
          </div>
          <div className="p-4 sm:p-5 bg-slate-950/90 border-t border-white/10 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-xs sm:text-sm font-black text-amber-300">
                核心閉環：1. 挑選福袋卡包 ➔ 2. 存入個人數位收藏庫 ➔ 3. 專業防潮保護 ➔ 4. 實體保險包裝宅配到府
              </span>
            </div>
            <span className="text-xs text-slate-400 font-mono hidden sm:inline">100% 實體現貨在庫 · 恆溫防潮呵護</span>
          </div>
        </section>

        {/* ================= SECTION 1: 完整流程範例 ================= */}
        <section id="flow-example" className="scroll-mt-20 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-black tracking-wider uppercase text-amber-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Walkthrough Example
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-headline text-white mt-1">
                從零開始：實際開箱完整流程
              </h2>
            </div>
            <p className="text-xs text-slate-400 max-w-sm sm:text-right">
              註冊 ➔ 了解點數 ➔ 挑選卡池 ➔ 開獎 ➔ 收藏庫 ➔ 寄送或折現
            </p>
          </div>

          {/* 6 大步驟卡片 */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {(GUIDE_STEPS || []).map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.step}
                  className="relative rounded-3xl p-5 bg-gradient-to-b from-[#111726]/90 via-[#0a0f1d]/90 to-[#070b14] border border-white/10 hover:border-amber-400/40 shadow-lg hover:shadow-[0_8px_30px_rgba(245,158,11,0.15)] transition-all group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-black font-mono px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30">
                        STEP {step.step}
                      </span>
                      <span className="text-xs font-bold text-slate-400">{step.tag}</span>
                    </div>

                    <div className="flex items-center gap-3 mb-3">
                      <div className={cn("w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center text-slate-950 shadow-md shrink-0", step.color)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <h3 className="text-base sm:text-lg font-black text-white group-hover:text-amber-200 transition-colors">
                        {step.title}
                      </h3>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                      {step.desc}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>STATUS: READY</span>
                    <span className="text-amber-400/80 group-hover:translate-x-1 transition-transform">➔</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 流程總結提示框 */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-cyan-950/40 border border-amber-400/30 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center shrink-0 font-black shadow-md">
                ✦
              </div>
              <div className="text-xs sm:text-sm">
                <span className="text-amber-300 font-black block">卡友至上原則：不喜歡的卡片絕對不浪費！</span>
                <span className="text-slate-300">每一張抽出的卡片皆有保底折現值，不想寄送可瞬間轉換為 P+ 點數繼續抽。</span>
              </div>
            </div>

            <Button asChild className="h-10 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md shrink-0">
              <Link href="/draw">
                <span>前往卡池親自體驗</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </Button>
          </div>
        </section>

        {/* ================= SECTION 2: 三大核心重點直接解答 ================= */}
        <section id="core-questions" className="scroll-mt-20 space-y-6">
          <div className="border-b border-white/10 pb-4">
            <div className="flex items-center gap-2 text-xs font-black tracking-wider uppercase text-cyan-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-cyan-400" />
              Core Mechanics Explained
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-headline text-white mt-1">
              三大新客最常問的核心概念
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {CORE_PILLARS.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className={cn(
                    "p-6 rounded-3xl bg-gradient-to-b border flex flex-col justify-between space-y-4 shadow-xl relative overflow-hidden",
                    item.bg,
                    item.border
                  )}
                >
                  {/* 背景微光 */}
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

                  <div className="relative z-10 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={cn("p-2.5 rounded-xl bg-white/10 border border-white/10 shrink-0", item.accent)}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <span className={cn("text-[10px] font-black uppercase font-mono px-2 py-0.5 rounded-full bg-white/10 border border-white/10 inline-block mb-1", item.accent)}>
                          {item.badge}
                        </span>
                        <h3 className="text-lg font-black text-white">{item.title}</h3>
                      </div>
                    </div>

                    <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-1">
                      {item.content}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/10 flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>100% TRANSPARENT</span>
                    <CheckCircle2 className={cn("w-4 h-4", item.accent)} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ================= SECTION 2.5: 公開驗證演算法專區 ================= */}
        <section id="fairness-section" className="scroll-mt-20 space-y-6">
          <div className="border-b border-white/10 pb-4">
            <div className="flex items-center gap-2 text-xs font-black tracking-wider uppercase text-emerald-400 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Cryptographic Fairness Standard
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-headline text-white mt-1">
              如何確保公平？認識「公開驗證演算法 (Provably Fair)」
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              平台完全杜絕後台偷改機率或內定中獎！透過國際標準 SHA-256 與 HMAC 加密，任何人都可以在開獎後親自驗算。
            </p>
          </div>

          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-emerald-950/40 via-slate-900/90 to-slate-950 border border-emerald-500/30 relative overflow-hidden space-y-6">
            <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 relative z-10">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div className="font-bold text-white text-sm">抽前預先封存 (Commitment)</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  每局開始前，系統先產生隨機種子並用 SHA-256 雜湊鎖定公開。開獎後種子必須與雜湊 100% 一致，絕不可能事後偷換。
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <div className="font-bold text-white text-sm">玩家種子共同決定 (Entropy)</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  運算公式混入您自訂的 Client Seed。在伺服器不知道您種子的情況下，平台在數學上完全無法預測或操控勝負！
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <div className="font-bold text-white text-sm">公開公式隨時核驗 (Verification)</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  抽完後原始種子完全解密。您可以隨時在我們的「線上驗證器」或貼到 Python/Node.js 終端機重現開獎判定。
                </p>
              </div>
            </div>

            <div className="pt-2 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 relative z-10">
              <div className="text-xs text-slate-300">
                想深入了解數學公式、體驗在線計算機，或複製開源離線驗證代碼？
              </div>
              <Button
                asChild
                className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black text-xs px-5 py-2.5 shadow-lg shadow-emerald-950/50 gap-2 shrink-0"
              >
                <Link href="/fairness">
                  <ShieldCheck className="w-4 h-4" />
                  <span>進入公開公平驗證中心 (Live Verifier)</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        {/* ================= SECTION 3: 必看 FAQ 問答集 ================= */}
        {/* ================= SECTION 3: 必看 FAQ 左右滑動字卡 ================= */}
        <section id="faq-section" className="scroll-mt-20 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-black tracking-wider uppercase text-rose-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
                Frequently Asked Questions · 左右滑動字卡
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-headline text-white mt-1">
                常見問題與保證承諾
              </h2>
            </div>

            {/* 左右切換控制按鈕與當前題號 */}
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-mono font-bold text-slate-400 px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10">
                {filteredFaqs.length > 0 ? `第 ${Math.min(activeFaqIndex + 1, filteredFaqs.length)} / ${filteredFaqs.length} 題` : '0 則問題'}
              </span>
              <button
                type="button"
                onClick={() => scrollFaq('left')}
                disabled={!canScrollLeft}
                aria-label="前一個問題"
                className={cn(
                  "p-2 rounded-xl border transition-all duration-200 cursor-pointer",
                  canScrollLeft
                    ? "bg-slate-900 text-white border-white/20 hover:border-amber-400 hover:bg-slate-800 active:scale-95 shadow-md shadow-amber-400/10"
                    : "bg-slate-950/60 text-slate-600 border-white/5 cursor-not-allowed opacity-50"
                )}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => scrollFaq('right')}
                disabled={!canScrollRight}
                aria-label="下一個問題"
                className={cn(
                  "p-2 rounded-xl border transition-all duration-200 cursor-pointer",
                  canScrollRight
                    ? "bg-slate-900 text-white border-white/20 hover:border-amber-400 hover:bg-slate-800 active:scale-95 shadow-md shadow-amber-400/10"
                    : "bg-slate-950/60 text-slate-600 border-white/5 cursor-not-allowed opacity-50"
                )}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 搜尋與標籤列 */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={faqSearch}
                onChange={(e) => {
                  setFaqSearch(e.target.value);
                  setActiveFaqIndex(0);
                  if (faqCarouselRef.current) {
                    faqCarouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                  }
                }}
                placeholder="搜尋點數、運費、寄送、退款..."
                className="w-full h-10 pl-9 pr-4 text-xs sm:text-sm rounded-xl bg-slate-900/90 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-colors shadow-inner"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => handleCategorySelect(cat)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                    activeFaqCategory === cat
                      ? "bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20"
                      : "bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 border border-white/5"
                  )}
                >
                  {cat === 'all' ? '全部問題' : cat}
                </button>
              ))}
            </div>
          </div>

          {/* 左右滑動卡片軌道 */}
          {filteredFaqs.length === 0 ? (
            <div className="p-8 text-center bg-slate-900/60 rounded-3xl border border-white/10 text-slate-400 text-sm">
              找不到相關問題，請嘗試搜尋其他關鍵字或點選分類切換。
            </div>
          ) : (
            <div className="relative">
              {/* 橫向滑動卡片容器 */}
              <div
                ref={faqCarouselRef}
                className="flex gap-4 overflow-x-auto snap-x snap-mandatory pt-2 pb-4 px-1 scrollbar-none touch-pan-x scroll-smooth"
              >
                {filteredFaqs.map((faq, idx) => {
                  const theme = FAQ_TAG_THEMES[faq.tag] || {
                    badge: 'bg-white/10 text-slate-300 border-white/10',
                    border: 'border-white/15',
                    glow: 'from-white/10',
                    text: 'text-slate-300'
                  };
                  return (
                    <div
                      key={idx}
                      className={cn(
                        "w-[85vw] max-w-[340px] sm:w-[370px] md:w-[390px] shrink-0 snap-start",
                        "h-[390px] sm:h-[410px] flex flex-col justify-between",
                        "rounded-2xl sm:rounded-3xl border p-5 sm:p-6 select-none",
                        "bg-gradient-to-b from-slate-900/95 via-[#0b111e]/95 to-slate-950/95",
                        "transition-all duration-300 hover:scale-[1.01] shadow-[0_12px_35px_rgba(0,0,0,0.6)] relative overflow-hidden group",
                        theme.border
                      )}
                    >
                      {/* 頂部賽博發光裝飾條 */}
                      <div className={cn("absolute top-0 inset-x-0 h-1 bg-gradient-to-r transparent", theme.glow, "to-transparent")} />

                      {/* 卡片頂部標籤與編號 */}
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn("px-2.5 py-0.5 rounded-full text-[11px] font-bold border", theme.badge)}>
                            {faq.tag}
                          </span>
                          <span className="font-mono text-xs font-black text-slate-400 bg-white/5 px-2 py-0.5 rounded-md border border-white/5">
                            Q{idx + 1}
                          </span>
                        </div>

                        {/* 問題標題 */}
                        <h3 className="text-base sm:text-lg font-black text-white mt-3 leading-snug line-clamp-2 group-hover:text-amber-300 transition-colors">
                          {faq.q}
                        </h3>
                      </div>

                      {/* 卡片回答內容 (內置細緻滾動容器，確保長內容完整閱覽且不溢出) */}
                      <div className="flex-1 min-h-0 my-3 p-3.5 sm:p-4 rounded-xl bg-slate-950/80 border border-white/5 text-xs sm:text-sm text-slate-300 leading-relaxed overflow-y-auto scrollbar-thin">
                        <p className="whitespace-pre-line leading-relaxed">{faq.a}</p>
                      </div>

                      {/* 卡片底部提示欄 */}
                      <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                        <span className="flex items-center gap-1 text-amber-400/90 font-medium">
                          <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                          官方答疑認證
                        </span>
                        <span className="text-slate-500 font-mono text-[10px]">
                          P+ CARDER FAQ
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 手機版左右滑動提示與下方點點導覽 */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 px-1">
                <p className="text-[11px] text-slate-500 flex items-center gap-1 sm:hidden">
                  <span>👈</span>
                  <span>可直接向左向右滑動字卡切換</span>
                  <span>👉</span>
                </p>

                {/* 底部小圓點導覽 */}
                <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
                  {filteredFaqs.map((_, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => scrollToFaqIndex(idx)}
                      aria-label={`跳至第 ${idx + 1} 個問題`}
                      className={cn(
                        "h-2 rounded-full transition-all duration-300 cursor-pointer",
                        activeFaqIndex === idx
                          ? "w-6 bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.8)]"
                          : "w-2 bg-white/20 hover:bg-white/40"
                      )}
                    />
                  ))}
                </div>

                <div className="hidden sm:flex items-center gap-1 text-[11px] text-slate-500">
                  <span>共 {filteredFaqs.length} 則常見問題字卡，點選箭頭或左右滑動即可閱覽</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ================= BOTTOM CTA BANNER ================= */}
        <section className="p-6 sm:p-10 rounded-3xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-[#120a1c] border border-amber-500/30 text-center space-y-4 shadow-[0_20px_50px_rgba(0,0,0,0.8)] relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#f59e0b]" />
          
          <div className="max-w-2xl mx-auto space-y-2">
            <h3 className="text-xl sm:text-3xl font-black font-headline text-white">
              準備好開啟您的第一包正版球員卡了嗎？
            </h3>
            <p className="text-xs sm:text-sm text-slate-300">
              全站卡池均具備開獎防衝撞保護，支援一番賞自由挑籤號碼，立即展開收藏之旅！
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button asChild size="lg" className="h-12 px-7 rounded-2xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/20 hover:brightness-110 active:scale-95 transition-all">
              <Link href="/draw">
                <Sparkles className="w-4 h-4 mr-2 fill-slate-950" />
                立即前往卡池大廳
              </Link>
            </Button>

            <Button asChild variant="outline" size="lg" className="h-12 px-6 rounded-2xl border-white/20 bg-slate-900/80 text-white hover:bg-white/10 font-bold transition-all">
              <Link href="/collection">
                <Layers className="w-4 h-4 mr-2 text-cyan-400" />
                預先參觀我的收藏庫
              </Link>
            </Button>
          </div>
        </section>

      </div>
    </div>
  );
}
