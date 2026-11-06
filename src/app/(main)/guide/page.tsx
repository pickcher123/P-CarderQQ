'use client';
import Image from "next/image";

import React, { useState } from 'react';
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

export default function BeginnerGuidePage() {
  const [faqSearch, setFaqSearch] = useState('');
  const [activeFaqCategory, setActiveFaqCategory] = useState<string>('all');
  const [expandedFaqs, setExpandedFaqs] = useState<Set<number>>(new Set([0, 1, 2]));

  const toggleFaq = (idx: number) => {
    setExpandedFaqs(prev => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const expandAll = () => {
    setExpandedFaqs(new Set((FAQ_LIST || []).map((_, i) => i)));
  };

  const collapseAll = () => {
    setExpandedFaqs(new Set());
  };

  const filteredFaqs = (FAQ_LIST || []).filter(item => {
    const matchesSearch = !faqSearch.trim() || 
      item.q.toLowerCase().includes(faqSearch.toLowerCase()) || 
      item.a.toLowerCase().includes(faqSearch.toLowerCase()) ||
      item.tag.toLowerCase().includes(faqSearch.toLowerCase());
    
    const matchesCategory = activeFaqCategory === 'all' || item.tag === activeFaqCategory;
    return matchesSearch && matchesCategory;
  });

  const categories = ['all', '點數體系', '卡片處理', '出貨與運費', '資金保障', '斷線保護', '新客須知', '公平保證'];

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
        <section id="faq-section" className="scroll-mt-20 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-black tracking-wider uppercase text-rose-400 font-mono">
                <span className="w-2 h-2 rounded-full bg-rose-400" />
                Frequently Asked Questions
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-headline text-white mt-1">
                常見問題與保證承諾
              </h2>
            </div>

            {/* 搜尋與全部展開/收合控制 */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={expandAll}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 transition-colors"
              >
                全部展開
              </button>
              <button
                type="button"
                onClick={collapseAll}
                className="text-xs text-slate-400 hover:text-white px-2.5 py-1 rounded-lg bg-slate-900 border border-white/10 transition-colors"
              >
                全部收合
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
                onChange={(e) => setFaqSearch(e.target.value)}
                placeholder="搜尋點數、運費、寄送、退款..."
                className="w-full h-10 pl-9 pr-4 text-xs sm:text-sm rounded-xl bg-slate-900/90 border border-white/15 text-white placeholder:text-slate-500 focus:outline-none focus:border-amber-400 transition-colors shadow-inner"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1 sm:pb-0 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveFaqCategory(cat)}
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

          {/* FAQ 列表手風琴 */}
          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <div className="p-8 text-center bg-slate-900/60 rounded-3xl border border-white/10 text-slate-400 text-sm">
                找不到相關問題，請嘗試搜尋其他關鍵字或點選分類切換。
              </div>
            ) : (
              filteredFaqs.map((faq, idx) => {
                const isExpanded = expandedFaqs.has(idx);
                return (
                  <div
                    key={idx}
                    className={cn(
                      "rounded-2xl border transition-all overflow-hidden",
                      isExpanded
                        ? "bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 border-amber-500/40 shadow-lg"
                        : "bg-slate-900/50 border-white/10 hover:border-white/20"
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => toggleFaq(idx)}
                      className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 cursor-pointer select-none"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={cn(
                          "w-6 h-6 rounded-lg font-mono text-xs font-black flex items-center justify-center shrink-0 transition-colors",
                          isExpanded
                            ? "bg-amber-400 text-slate-950"
                            : "bg-white/10 text-slate-300"
                        )}>
                          Q
                        </span>
                        <span className="text-sm sm:text-base font-bold text-white">
                          {faq.q}
                        </span>
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-white/5 text-amber-300/80 border border-white/5 hidden md:inline shrink-0">
                          {faq.tag}
                        </span>
                      </div>
                      <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform shrink-0", isExpanded && "rotate-180 text-amber-400")} />
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-300 leading-relaxed border-t border-white/5 bg-black/25">
                        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-white/5 text-slate-200">
                          <p className="whitespace-pre-line leading-relaxed">{faq.a}</p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
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
