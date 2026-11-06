'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Hash, UserCheck, Lock, ExternalLink, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface ProvablyFairDialogProps {
  trigger?: React.ReactNode;
  variant?: 'badge' | 'button' | 'link';
}

export function ProvablyFairDialog({ trigger, variant = 'badge' }: ProvablyFairDialogProps) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : variant === 'button' ? (
          <Button
            variant="outline"
            size="sm"
            className="border-emerald-500/40 text-emerald-400 bg-emerald-950/20 hover:bg-emerald-950/40 hover:text-emerald-300 text-xs gap-1.5 shadow-sm"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            公平驗證
          </Button>
        ) : variant === 'link' ? (
          <button
            type="button"
            className="text-emerald-400/90 hover:text-emerald-300 underline underline-offset-4 text-xs inline-flex items-center gap-1 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            查看公平驗證演算法
          </button>
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 transition-all shadow-sm cursor-pointer"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-400 animate-pulse" />
            <span>Provably Fair 公開可驗證</span>
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl bg-[#090d16] border border-emerald-500/30 text-white shadow-2xl p-6 overflow-hidden">
        {/* 背景發光 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <DialogHeader className="pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-1">
            <ShieldCheck className="w-4 h-4" />
            Cryptographic Provably Fair System
          </div>
          <DialogTitle className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-emerald-200 to-emerald-400 flex items-center justify-between">
            <span>公開驗證演算法：100% 拒絕暗箱操作</span>
          </DialogTitle>
          <p className="text-xs text-slate-400 mt-1">
            我們採用國際加密頂級標準的 Provably Fair（可驗證公平）架構，抽獎與拼卡結果由「伺服器雜湊承諾」與「玩家自訂種子」共同計算，任何人皆無法在事前預知或事後竄改！
          </p>
        </DialogHeader>

        <div className="space-y-4 my-2 text-xs">
          {/* 3 步驟圖解 */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1.5 relative group hover:border-emerald-500/30 transition-all">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">
                1
              </div>
              <div className="font-bold text-slate-200 flex items-center gap-1">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                開獎前雜湊封存
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                平台在遊戲前先生成種子，並以 SHA-256 雜湊公開承諾。這保證了開獎後絕無法偷偷調換種子。
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1.5 relative group hover:border-cyan-500/30 transition-all">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-xs">
                2
              </div>
              <div className="font-bold text-slate-200 flex items-center gap-1">
                <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                玩家種子注入
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                抽卡與拼卡結果混入玩家自訂的 Client Seed。在伺服器不知道您種子的情況下，完全無法控制輸贏。
              </p>
            </div>

            <div className="p-3 rounded-xl bg-slate-900/80 border border-white/5 space-y-1.5 relative group hover:border-amber-500/30 transition-all">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-xs">
                3
              </div>
              <div className="font-bold text-slate-200 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-amber-400" />
                抽後完全解鎖查核
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed">
                結果揭曉後公開原始 Server Seed。您可在平台驗證器或使用任何第 3 方 Python/JS 腳本反查。
              </p>
            </div>
          </div>

          {/* 核心公式 */}
          <div className="p-3 rounded-xl bg-black/60 border border-emerald-500/20 font-mono text-[11px] text-slate-300 space-y-1">
            <div className="text-emerald-400 font-semibold flex items-center gap-1 text-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              開獎判定數學公式（100% 開源無可更動）
            </div>
            <div className="text-slate-400 text-[11px]">
              <span className="text-emerald-300">HMAC-SHA256</span>(ServerSeed, <span className="text-cyan-300">ClientSeed</span> + &quot;:&quot; + <span className="text-amber-300">Nonce</span>)
            </div>
            <div className="text-[10px] text-slate-500">
              * 取前 8 位十六進制轉為整數，除以 10000 判定是否小於 1000（即 10.00% 拼卡勝率）。
            </div>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-[11px] text-slate-400">
            想親自用自己的抽卡紀錄驗證，或取得開源離線驗證腳本？
          </div>
          <Button
            asChild
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs gap-1.5 shadow-lg shadow-emerald-900/30"
            onClick={() => setOpen(false)}
          >
            <Link href="/fairness">
              前往公平驗證專頁與即時驗證器
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
