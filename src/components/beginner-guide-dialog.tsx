'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from "next/image";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
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
  ExternalLink, 
  ArrowRight,
  Search,
  ChevronDown,
  Hash,
  Cpu,
  Lock,
  FileCheck,
  Crown,
  Dices,
  Gem,
  Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export interface BeginnerGuideDialogProps {
  children?: React.ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  triggerClassName?: string;
  triggerVariant?: 'default' | 'hero' | 'minimal' | 'badge' | 'compact';
  buttonText?: string;
}

// 引入純淨獨立的導覽資料模組
export { 
  SIMPLIFIED_STEPS, 
  QUICK_FAQS, 
  GUIDE_STEPS, 
  CORE_PILLARS, 
  FAQ_LIST 
} from '@/data/guide-data';
import { 
  SIMPLIFIED_STEPS, 
  QUICK_FAQS 
} from '@/data/guide-data';

export function BeginnerGuideDialog({
  children,
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  triggerClassName,
  triggerVariant = 'default',
  buttonText = 'How To Play',
}: BeginnerGuideDialogProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const [activeTab, setActiveTab] = useState<'tutorial' | 'fairness'>('tutorial');
  const isControlled = controlledOpen !== undefined;
  const isOpen = isControlled ? controlledOpen : internalOpen;
  const setIsOpen = isControlled ? setControlledOpen! : setInternalOpen;
  const [expandedFaq, setExpandedFaq] = useState<number | null>(0);

  const renderTrigger = () => {
    if (children) return <DialogTrigger asChild>{children}</DialogTrigger>;

    if (triggerVariant === 'hero') {
      return (
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-12 sm:h-14 px-5 sm:px-6 rounded-2xl font-black text-sm sm:text-base border border-amber-400/40 bg-gradient-to-r from-slate-900/90 via-slate-950/95 to-slate-900/90 text-amber-300 hover:text-white hover:border-amber-400 hover:bg-slate-800 shadow-[0_4px_20px_rgba(0,0,0,0.5)] transition-all flex items-center justify-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]",
              triggerClassName
            )}
          >
            <HelpCircle className="w-5 h-5 text-amber-400" />
            <span>{buttonText}</span>
          </button>
        </DialogTrigger>
      );
    }

    if (triggerVariant === 'compact') {
      return (
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-400/30 text-[11px] font-bold transition-all cursor-pointer shadow-xs",
              triggerClassName
            )}
          >
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>{buttonText}</span>
          </button>
        </DialogTrigger>
      );
    }

    if (triggerVariant === 'badge') {
      return (
        <DialogTrigger asChild>
          <button
            type="button"
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-400/30 text-xs font-bold transition-all cursor-pointer",
              triggerClassName
            )}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{buttonText}</span>
          </button>
        </DialogTrigger>
      );
    }

    return (
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={cn(
            "rounded-xl border-amber-400/40 text-amber-300 hover:text-white hover:bg-amber-500/10 text-xs font-bold gap-1.5 cursor-pointer shadow-sm",
            triggerClassName
          )}
        >
          <HelpCircle className="w-3.5 h-3.5" />
          <span>{buttonText}</span>
        </Button>
      </DialogTrigger>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      {renderTrigger()}

      <DialogContent className="max-w-3xl w-[95vw] sm:w-[90vw] max-h-[90dvh] p-0 overflow-hidden bg-[#0a0f1c] border border-white/[0.1] border-t-amber-300/65 text-white rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.9)] backdrop-blur-2xl flex flex-col">
        {/* Modal Header */}
        <div className="relative p-4 sm:p-6 pb-3 bg-white/[0.02] border-b border-white/[0.08] shrink-0">
          <div className="absolute top-0 inset-x-0 h-[1.5px] bg-gradient-to-r from-transparent via-amber-300/70 to-transparent" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3">
              <div className="w-[3px] h-9 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 shrink-0" />
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-400/[0.12] border border-amber-300/35 text-[10px] font-black text-[#FDE68A] font-mono flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#FDE68A]" />
                    P+CARDER 新手玩法指南
                  </span>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">100% 現貨在庫 · 機率可驗證</span>
                </div>
                <DialogTitle className="text-lg sm:text-xl font-black font-headline tracking-wide text-white mt-1">
                  平台特色、一番賞、拼卡與買回制度
                </DialogTitle>
              </div>
            </div>

            {/* 雙分頁整合切換開關 */}
            <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/[0.08] self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('tutorial')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5",
                  activeTab === 'tutorial'
                    ? "bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>玩法與制度</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('fairness')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5",
                  activeTab === 'fairness'
                    ? "bg-amber-400/[0.15] text-[#FDE68A] border border-amber-300/40 font-black"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>機率公平驗證</span>
              </button>
            </div>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 custom-scrollbar">
          {activeTab === 'tutorial' ? (
            /* TAB 1: 平台特色與三大核心制度 */
            <div className="space-y-5 animate-in fade-in duration-200">
              {/* 1. 網站四大核心特色 */}
              <section className="space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-black text-[#FDE68A] tracking-wider">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>P+CARDER 平台核心特色</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      icon: ShieldCheck,
                      title: '100% 實體現貨 · 恆溫金庫保管',
                      desc: '先有實體庫存才上架，抽中即入數位收藏庫，隨時申請 7-11 超商、掛號郵寄或門市自取。',
                    },
                    {
                      icon: Layers,
                      title: '3D 扇形開包 · 自由瞇角體驗',
                      desc: '多抽展開立體扇形卡包堆與色階預告，大獎自動壓軸登場，開卡支援親手瞇開四個角落。',
                    },
                    {
                      icon: Heart,
                      title: '即時看盤 · 我的追蹤與尾盤提醒',
                      desc: '卡池剩餘張數與機率即時公開，追蹤喜愛的機台後，進入尾盤狙擊區將自動於頂部提醒。',
                    },
                    {
                      icon: Lock,
                      title: 'Provably Fair 密碼學防偽',
                      desc: '每一抽與每一局拼卡皆採公開雜湊演算法生成，交易紀錄內隨時可驗證開獎參數。',
                    },
                  ].map((feat) => {
                    const Icon = feat.icon;
                    return (
                      <div
                        key={feat.title}
                        className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08] flex items-start gap-3"
                      >
                        <div className="w-8 h-8 rounded-lg bg-amber-400/[0.1] border border-amber-300/30 flex items-center justify-center shrink-0 mt-0.5">
                          <Icon className="w-4 h-4 text-[#FDE68A]" />
                        </div>
                        <div className="min-w-0 space-y-0.5">
                          <h4 className="text-xs sm:text-sm font-black text-white">{feat.title}</h4>
                          <p className="text-[11px] text-slate-400 leading-relaxed">{feat.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* 2. GodPack 五色一番賞制度 */}
              <section className="p-4 rounded-2xl bg-white/[0.03] border border-amber-300/30 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#FDE68A] to-amber-400 text-[#120d02] flex items-center justify-center shrink-0">
                      <Crown className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white">GodPack 五色一番賞制度</h3>
                      <p className="text-[11px] text-slate-400">盲盒的刺激感 × 一番賞公開即時機率 × 抽完必得最後賞</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-400/15 text-[#FDE68A] border border-amber-300/40">
                    招牌主打玩法
                  </span>
                </div>

                {/* 五色卡包分級一覽 */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                  {[
                    { code: 'SP 賞', name: '黑金包', desc: '神秘隱藏', cls: 'bg-black/60 border-amber-300/55 text-[#FDE68A]' },
                    { code: 'A 賞', name: '金包', desc: '頂級大獎', cls: 'bg-amber-400/15 border-amber-300/50 text-[#FDE68A]' },
                    { code: 'B 賞', name: '銀包', desc: '精選好卡', cls: 'bg-slate-200/10 border-slate-300/35 text-slate-100' },
                    { code: 'C 賞', name: '銅包', desc: '9折買回', cls: 'bg-amber-800/25 border-amber-600/45 text-amber-200' },
                    { code: 'D 賞', name: '星光包', desc: '9折買回', cls: 'bg-white/[0.06] border-white/25 text-white' },
                    { code: 'LAST', name: '最後賞', desc: '包尾加贈', cls: 'bg-gradient-to-b from-amber-400/20 to-rose-500/15 border-amber-300/55 text-[#FDE68A]' },
                  ].map((tier) => (
                    <div key={tier.code} className={cn('p-2 rounded-xl border', tier.cls)}>
                      <div className="text-[10px] font-mono font-black leading-none">{tier.code}</div>
                      <div className="text-xs font-black mt-1">{tier.name}</div>
                      <div className="text-[9px] opacity-80 mt-0.5">{tier.desc}</div>
                    </div>
                  ))}
                </div>

                <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#FDE68A] shrink-0 mt-0.5" />
                    <span><strong className="text-white">盲盒刺激感 × 一番賞明池：</strong>保留盲盒撕包未知驚喜，五色卡包下方直接公開剩餘張數與即時機率，點擊色包即可查看該賞卡表。</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#FDE68A] shrink-0 mt-0.5" />
                    <span><strong className="text-white">自由挑號＋防衝撞鎖定：</strong>挑籤時享有 120 秒專屬鎖定保護，抽走最後一抽直接把「最後賞」帶回家。</span>
                  </li>
                </ul>
              </section>

              {/* 3. 自選拼卡制度 */}
              <section className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.1] space-y-2.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-rose-500/15 border border-rose-400/40 text-rose-300 flex items-center justify-center shrink-0">
                      <Dices className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white">自選拼卡制度（1/10 挑戰神卡）</h3>
                      <p className="text-[11px] text-slate-400">小額門檻自控勝率 · 最高可選 90% 命中率</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-300 border border-rose-400/35 tabular-nums">
                    每格 10% · 1~9 格任選
                  </span>
                </div>

                <ul className="space-y-1.5 text-xs text-slate-300 leading-relaxed">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span><strong className="text-white">門檻只要 1/10：</strong>挑選心儀的目標球星卡，系統將卡價分為 10 格（0～9 號），買 1 格即享 10% 中獎率。</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                    <span><strong className="text-white">勝率自己決定：</strong>想穩一點可一次包下 5～9 格（50%～90% 勝率），開獎即時驗證，中號直接入庫！</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                    <span><strong className="text-white">獎品兌換專區：</strong>也能使用紅利 P 幣或鑽石參與獎品兌換，中獎實體好禮直接免運寄送。</span>
                  </li>
                </ul>
              </section>

              {/* 4. 即時買回與會員回饋制度 */}
              <section className="p-4 rounded-2xl bg-white/[0.03] border border-white/[0.1] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-cyan-400/15 border border-cyan-300/35 text-cyan-300 flex items-center justify-center shrink-0">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm sm:text-base font-black text-white">即時買回與會員回饋制度</h3>
                      <p className="text-[11px] text-slate-400">收藏庫顯示即為實際買回鑽石 · 一鍵秒入帳免等待</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div className="p-3 rounded-xl bg-black/40 border border-amber-300/35 space-y-1">
                    <div className="text-[11px] font-black text-[#FDE68A]">GodPack 一番賞</div>
                    <div className="text-xs font-bold text-white leading-snug">
                      C / D 賞 <span className="text-[#FDE68A] tabular-nums">9 折</span>買回<br />
                      其他賞別 <span className="text-[#FDE68A] tabular-nums">8 折</span>買回
                    </div>
                    <p className="text-[10px] text-emerald-400 font-bold pt-0.5">
                      ＋ 額外加贈會員階級回饋 P 幣（最高 10%）
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-rose-400/30 space-y-1">
                    <div className="text-[11px] font-black text-rose-300">拼卡專區出卡</div>
                    <div className="text-xs font-bold text-white leading-snug">
                      一律享 <span className="text-[#FDE68A] tabular-nums">9 折</span>高價買回
                    </div>
                    <p className="text-[10px] text-slate-400 pt-0.5">
                      拼中神卡可選寄回實體，或 9 折秒換鑽石再戰
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-black/40 border border-white/[0.1] space-y-1">
                    <div className="text-[11px] font-black text-cyan-300">一般卡池與普特卡</div>
                    <div className="text-xs font-bold text-white leading-snug">
                      一般實體卡 <span className="text-[#FDE68A] tabular-nums">8 折</span>買回<br />
                      隨機普／特卡固定 <span className="text-cyan-300 tabular-nums">40 💎</span>
                    </div>
                    <p className="text-[10px] text-slate-400 pt-0.5">
                      無需私下議價轉賣，點選即可瞬間變現
                    </p>
                  </div>
                </div>
              </section>

              {/* 5. 極簡 4 步上手 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {SIMPLIFIED_STEPS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.step} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.07] space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-[#FDE68A] bg-amber-400/10 px-1.5 py-0.5 rounded">
                          STEP {s.step}
                        </span>
                        <Icon className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <div className="text-xs font-black text-white">{s.title}</div>
                      <p className="text-[10.5px] text-slate-400 leading-snug">{s.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* 精簡 FAQ */}
              <div className="space-y-2 pt-1">
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-300" />
                  新手常見重點問答
                </div>
                <div className="space-y-2">
                  {QUICK_FAQS.map((faq, idx) => (
                    <div key={idx} className="rounded-xl border border-white/[0.08] bg-white/[0.03] overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                        className="w-full p-3 text-left flex items-center justify-between text-xs sm:text-sm font-bold text-slate-200 cursor-pointer"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform shrink-0 ml-2", expandedFaq === idx && "rotate-180 text-[#FDE68A]")} />
                      </button>
                      {expandedFaq === idx && (
                        <div className="px-3 pb-3 text-xs text-slate-400 leading-relaxed border-t border-white/5 bg-black/30">
                          {faq.a}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* TAB 2: 機率公平驗證整合區塊 */
            <div className="space-y-5 animate-in fade-in duration-200">
              <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-900/90 to-slate-950 border border-cyan-500/30 space-y-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-5 h-5 text-cyan-400 animate-pulse" />
                  <h4 className="text-base sm:text-lg font-black text-white">密碼學可驗證公平演算法 (Provably Fair)</h4>
                </div>
                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  每抽均採用國際權威 SHA-256 加密演算法。開獎前系統即公開雜湊碼（Server Hash），開獎後公布原始明文種子與 Nonce，任何人皆可自主驗證，杜絕黑箱與調包。
                </p>
              </div>

              {/* 三步驗證架構圖 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1 text-center">
                  <Lock className="w-5 h-5 text-amber-400 mx-auto mb-1" />
                  <div className="text-xs font-black text-white">1. 開獎前預鎖</div>
                  <div className="text-[11px] text-slate-400">產生 Server Hash，任何人都無法在抽卡中途修改結果。</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 space-y-1 text-center">
                  <Cpu className="w-5 h-5 text-cyan-400 mx-auto mb-1 animate-pulse" />
                  <div className="text-xs font-black text-cyan-300">2. 用戶隨機介入</div>
                  <div className="text-[11px] text-slate-400">注入玩家專屬 Client Seed，杜絕平台單方面作弊。</div>
                </div>
                <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1 text-center">
                  <FileCheck className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                  <div className="text-xs font-black text-white">3. 公開透明複算</div>
                  <div className="text-[11px] text-slate-400">公式開源，帶入種子碼即可 100% 複算還原當局數字。</div>
                </div>
              </div>

              {/* 實體在席與現貨保證卡 */}
              <div className="p-4 rounded-2xl bg-black/40 border border-emerald-500/30 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
                  <div>
                    <div className="text-xs sm:text-sm font-black text-emerald-300">100% 現貨在庫 · 絕無先賣後買</div>
                    <div className="text-[11px] text-slate-400">所有上架卡池獎品均在席實體庫存，開出即綁定個人卡庫。</div>
                  </div>
                </div>
                <Button asChild size="sm" className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs shrink-0 rounded-xl">
                  <Link href="/fairness" onClick={() => setIsOpen(false)}>
                    前往線上驗證器 ➔
                  </Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="p-3.5 sm:p-4 bg-slate-950 border-t border-white/10 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 px-3 rounded-xl border-white/15 text-slate-300 hover:text-white text-xs font-bold"
            >
              <Link href="/guide" onClick={() => setIsOpen(false)}>
                <span>完整教學專頁</span>
                <ExternalLink className="w-3 h-3 ml-1" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 px-3 rounded-xl border-cyan-500/30 text-cyan-300 hover:text-white text-xs font-bold"
            >
              <Link href="/fairness" onClick={() => setIsOpen(false)}>
                <ShieldCheck className="w-3 h-3 mr-1 text-cyan-400" />
                <span>驗證計算機</span>
              </Link>
            </Button>
          </div>

          <Button
            type="button"
            onClick={() => setIsOpen(false)}
            className="h-8 px-5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs shadow-md cursor-pointer"
          >
            我瞭解了
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
