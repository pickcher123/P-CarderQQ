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
  FileCheck
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

      <DialogContent className="max-w-3xl w-[95vw] sm:w-[90vw] max-h-[90vh] p-0 overflow-hidden bg-slate-950 border border-amber-500/35 text-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.9)] backdrop-blur-2xl flex flex-col">
        {/* Modal Header */}
        <div className="relative p-5 sm:p-6 pb-3 bg-gradient-to-b from-[#18101e] via-slate-950 to-slate-950 border-b border-white/10 shrink-0">
          <div className="absolute top-0 inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_12px_#f59e0b]" />

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-[11px] font-black text-amber-300 font-mono flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  新手指南 & 公平保證
                </span>
                <span className="text-xs text-slate-400 hidden sm:inline">100% 現貨在庫 · 機率可驗證</span>
              </div>
              <DialogTitle className="text-xl sm:text-2xl font-black font-headline tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-400 mt-1">
                P+Carder 核心教學與公開驗證
              </DialogTitle>
            </div>

            {/* 雙分頁整合切換開關 */}
            <div className="flex items-center bg-slate-900/90 p-1 rounded-xl border border-white/10 self-start sm:self-auto shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('tutorial')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === 'tutorial'
                    ? "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <HelpCircle className="w-3.5 h-3.5" />
                <span>新手速成教學</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('fairness')}
                className={cn(
                  "px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                  activeTab === 'fairness'
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black shadow-sm"
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 custom-scrollbar">
          {activeTab === 'tutorial' ? (
            /* TAB 1: 新手速成教學 */
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* 中文流程圖解 */}
              <div className="rounded-2xl sm:rounded-3xl overflow-hidden border border-amber-500/35 bg-gradient-to-b from-[#181120] to-slate-950 shadow-[0_10px_30px_rgba(0,0,0,0.8)] relative group">
                <div className="relative w-full aspect-[16/9] max-h-[300px] bg-slate-900">
                  <Image 
                    src="/assets/images/beginner-tutorial-guide.jpg"
                    alt="P+Carder 新手全景玩法圖解指南"
                    fill
                    sizes="(max-width: 768px) 100vw, 800px"
                    className="object-contain object-center"
                    priority
                  />
                </div>
                <div className="p-3 bg-slate-950/90 border-t border-white/10 flex items-center justify-between text-xs text-amber-300 font-bold">
                  <span>極簡 4 步：1. 挑選開盒 ➔ 2. 數位存庫 ➔ 3. 現貨保護 ➔ 4. 安全宅配</span>
                  <span className="text-[11px] text-slate-400 font-normal hidden sm:inline">先有庫存才上架</span>
                </div>
              </div>

              {/* 4 步簡化清單 */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {SIMPLIFIED_STEPS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div key={s.step} className="p-3 rounded-2xl bg-slate-900/80 border border-white/10 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                          STEP {s.step}
                        </span>
                        <Icon className="w-4 h-4 text-slate-400" />
                      </div>
                      <div className="text-xs sm:text-sm font-black text-white">{s.title}</div>
                      <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{s.desc}</p>
                    </div>
                  );
                })}
              </div>

              {/* 精簡 FAQ */}
              <div className="space-y-2.5 pt-2">
                <div className="text-xs font-black text-white flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  新手常見重點問答
                </div>
                <div className="space-y-2">
                  {QUICK_FAQS.map((faq, idx) => (
                    <div key={idx} className="rounded-xl border border-white/10 bg-slate-900/60 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setExpandedFaq(expandedFaq === idx ? null : idx)}
                        className="w-full p-3 text-left flex items-center justify-between text-xs sm:text-sm font-bold text-slate-200"
                      >
                        <span>{faq.q}</span>
                        <ChevronDown className={cn("w-4 h-4 text-slate-400 transition-transform", expandedFaq === idx && "rotate-180 text-amber-400")} />
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
