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
import { Badge } from '@/components/ui/badge';
import {
  ShieldCheck,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  ArrowRight,
  Sliders,
  CheckCircle2,
  Lock,
  UserCheck,
  Hash
} from 'lucide-react';
import { ProvablyFairData, getOrDeriveProvablyFairForTx } from '@/lib/provably-fair';

interface TransactionFairnessModalProps {
  transaction: {
    id?: string;
    details?: string;
    section?: string;
    transactionDate?: any;
    provablyFair?: ProvablyFairData;
    amount?: number;
  };
  trigger?: React.ReactNode;
}

export function TransactionFairnessModal({
  transaction,
  trigger,
}: TransactionFairnessModalProps) {
  const [open, setOpen] = useState(false);
  const [fairData, setFairData] = useState<ProvablyFairData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);

  const handleOpenChange = async (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen && !fairData) {
      setIsLoading(true);
      try {
        const data = await getOrDeriveProvablyFairForTx(transaction);
        setFairData(data);
      } catch (err) {
        console.error('Failed to load fairness data:', err);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleCopy = (key: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleCopyAll = () => {
    if (!fairData) return;
    const allText = `【P+Carder Provably Fair 開獎核驗參數】\n` +
      `交易內容: ${transaction.details || '開獎紀錄'}\n` +
      `Server Seed: ${fairData.serverSeed}\n` +
      `Server Hash: ${fairData.serverHash}\n` +
      `Client Seed: ${fairData.clientSeed}\n` +
      `Nonce: ${fairData.nonce}\n` +
      `驗證網址: https://pcarder.com/fairness?serverSeed=${fairData.serverSeed}&serverHash=${fairData.serverHash}&clientSeed=${fairData.clientSeed}&nonce=${fairData.nonce}`;
    navigator.clipboard.writeText(allText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const isPackDraw = fairData?.outcomeType === 'pack' || (!fairData?.outcomeType && transaction.section === 'draw') || (transaction.details && (transaction.details.includes('卡池') || transaction.details.includes('連抽') || transaction.details.includes('抽卡')));

  const verifyUrl = fairData
    ? isPackDraw
      ? `/fairness?serverSeed=${encodeURIComponent(fairData.serverSeed)}&serverHash=${encodeURIComponent(fairData.serverHash)}&clientSeed=${encodeURIComponent(fairData.clientSeed)}&nonce=${fairData.nonce}&tab=pack&cardName=${encodeURIComponent(fairData.cardName || '')}`
      : `/fairness?serverSeed=${encodeURIComponent(fairData.serverSeed)}&serverHash=${encodeURIComponent(fairData.serverHash)}&clientSeed=${encodeURIComponent(fairData.clientSeed)}&nonce=${fairData.nonce}&tab=${fairData.outcomeType === 'draw' ? 'draw' : 'bet'}&prob=10`
    : '/fairness';

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ? (
          trigger
        ) : (
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 text-[10px] font-bold transition-all shadow-sm cursor-pointer whitespace-nowrap"
          >
            <ShieldCheck className="w-3 h-3 text-emerald-400" />
            <span>開獎參數</span>
          </button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-xl bg-[#090d16] border border-emerald-500/30 text-white shadow-2xl p-5 sm:p-6 overflow-hidden">
        {/* 背景發光 */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

        <DialogHeader className="pb-3 border-b border-white/10">
          <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold tracking-wider uppercase mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400 animate-pulse" />
            Provably Fair Verification Data
          </div>
          <DialogTitle className="text-lg sm:text-xl font-black text-white flex items-center justify-between">
            <span>本筆交易密碼學開獎明細</span>
            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
              100% 密碼學防偽
            </Badge>
          </DialogTitle>
          <p className="text-xs text-slate-400 mt-1 line-clamp-1">
            {transaction.details || '開獎紀錄明細'}
          </p>
        </DialogHeader>

        {isLoading || !fairData ? (
          <div className="py-8 text-center text-xs text-slate-400 animate-pulse">
            載入密碼學驗證資料中...
          </div>
        ) : (
          <div className="space-y-4 my-2 text-xs">
            {/* 🎯 機率落點與中獎等級摘要卡片 */}
            {fairData.luckyPercent !== undefined && (
              <div className="p-3 rounded-xl bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-slate-900 border border-amber-500/30 flex items-center justify-between gap-3 shadow-md">
                <div className="space-y-1">
                  <div className="text-[11px] text-amber-300/90 font-bold flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-amber-400" />
                    <span>密碼學運算落點：{fairData.luckyPercent}%</span>
                  </div>
                  {fairData.cardName && (
                    <div className="text-xs font-black text-white line-clamp-1">
                      命中卡牌：【{fairData.cardName}】
                    </div>
                  )}
                </div>
                {fairData.matchedTier && (
                  <Badge className={`${fairData.matchedTier.badgeBg} text-[10px] font-black shrink-0 px-2.5 py-1`}>
                    {fairData.matchedTier.name}
                  </Badge>
                )}
              </div>
            )}

            {/* 提示文案 */}
            <div className="p-3 rounded-xl bg-slate-900/80 border border-emerald-500/20 text-[11px] text-slate-300 flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>
                每筆開獎參數皆經 SHA-256 承諾封存。您可以單獨複製各欄位，或點選下方按鈕直接<strong>帶入線上驗證器</strong>自動校驗勝負與落點等級！
              </span>
            </div>


            {/* 四大參數卡片 */}
            <div className="space-y-2.5 font-mono">
              {/* 1. Server Seed */}
              <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1 font-sans font-bold">
                    <Lock className="w-3 h-3 text-emerald-400" />
                    伺服器原始種子 (Server Seed - 抽後公開)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('serverSeed', fairData.serverSeed)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-slate-300 transition-colors"
                  >
                    {copiedKey === 'serverSeed' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedKey === 'serverSeed' ? '已複製' : '複製'}</span>
                  </button>
                </div>
                <div className="text-[11px] text-emerald-400 break-all select-all font-mono bg-slate-950/80 p-1.5 rounded">
                  {fairData.serverSeed}
                </div>
              </div>

              {/* 2. Server Hash */}
              <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 space-y-1">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-1 font-sans font-bold">
                    <Hash className="w-3 h-3 text-cyan-400" />
                    伺服器雜湊承諾 (Server Hash / SHA-256)
                  </span>
                  <button
                    type="button"
                    onClick={() => handleCopy('serverHash', fairData.serverHash)}
                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-slate-300 transition-colors"
                  >
                    {copiedKey === 'serverHash' ? (
                      <Check className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                    <span>{copiedKey === 'serverHash' ? '已複製' : '複製'}</span>
                  </button>
                </div>
                <div className="text-[11px] text-slate-200 break-all select-all font-mono bg-slate-950/80 p-1.5 rounded">
                  {fairData.serverHash}
                </div>
              </div>

              {/* 3. Client Seed & Nonce */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1 font-sans font-bold">
                      <UserCheck className="w-3 h-3 text-cyan-400" />
                      客戶端種子 (Client Seed)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('clientSeed', fairData.clientSeed)}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-slate-300 transition-colors"
                    >
                      {copiedKey === 'clientSeed' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedKey === 'clientSeed' ? '已複製' : '複製'}</span>
                    </button>
                  </div>
                  <div className="text-[11px] text-cyan-300 break-all select-all font-mono bg-slate-950/80 p-1.5 rounded truncate">
                    {fairData.clientSeed}
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-black/60 border border-white/10 space-y-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400 flex items-center gap-1 font-sans font-bold">
                      <Hash className="w-3 h-3 text-amber-400" />
                      局數序號 (Nonce)
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy('nonce', String(fairData.nonce))}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[10px] text-slate-300 transition-colors"
                    >
                      {copiedKey === 'nonce' ? (
                        <Check className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                      <span>{copiedKey === 'nonce' ? '已複製' : '複製'}</span>
                    </button>
                  </div>
                  <div className="text-[11px] text-amber-300 break-all select-all font-mono bg-slate-950/80 p-1.5 rounded">
                    {fairData.nonce}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 底部操作控制 */}
        <div className="pt-3 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleCopyAll}
            disabled={!fairData}
            className="w-full sm:w-auto h-8 border-white/15 text-slate-300 hover:text-white text-xs gap-1.5"
          >
            {copiedAll ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copiedAll ? '已複製全部參數' : '一鍵複製全部參數'}</span>
          </Button>

          <Button
            asChild
            size="sm"
            className="w-full sm:w-auto h-8 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs gap-1.5 shadow-lg shadow-emerald-950/40"
          >
            <Link href={verifyUrl} onClick={() => setOpen(false)}>
              <Sliders className="w-3.5 h-3.5" />
              <span>一鍵帶入線上驗證器</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
