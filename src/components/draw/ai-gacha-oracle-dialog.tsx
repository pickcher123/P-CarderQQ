'use client';

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Compass, Flame, Shuffle, ArrowRight, RotateCw, Check, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import confetti from 'canvas-confetti';

interface AIGachaOracleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  poolName?: string;
  availableTickets?: number[];
  onApplyNumbers?: (numbers: number[]) => void;
  defaultPickCount?: number;
}

interface OracleResult {
  fortuneTitle: string;
  luckLevel: string;
  luckScore: number;
  luckyNumbers: number[];
  luckyReason: string;
  luckyDirection: string;
  luckyColor: string;
  oracleQuote: string;
  geminiPowered?: boolean;
}

const ZODIAC_LIST = [
  '白羊座 ♈', '金牛座 ♉', '雙子座 ♊', '巨蟹座 ♋',
  '獅子座 ♌', '處女座 ♍', '天秤座 ♎', '天蠍座 ♏',
  '射手座 ♐', '摩羯座 ♑', '水瓶座 ♒', '雙魚座 ♓',
  '龍年祥瑞 🐉', '虎嘯風生 🐅', '大吉大利 🍀'
];

export function AIGachaOracleDialog({
  isOpen,
  onClose,
  poolName = '頂級球員卡池',
  availableTickets = [],
  onApplyNumbers,
  defaultPickCount = 1,
}: AIGachaOracleDialogProps) {
  const [selectedZodiac, setSelectedZodiac] = useState('大吉大利 🍀');
  const [pickCount, setPickCount] = useState(defaultPickCount);
  const [isLoading, setIsLoading] = useState(false);
  const [oracleResult, setOracleResult] = useState<OracleResult | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [applied, setApplied] = useState(false);

  const handleDivination = React.useCallback(async () => {
    setIsLoading(true);
    setIsSpinning(true);
    setApplied(false);

    try {
      const res = await fetch('/api/ai/gacha-oracle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          poolName,
          availableTickets,
          userZodiac: selectedZodiac,
          pickCount,
        }),
      });

      const data: OracleResult = await res.json();
      
      // 給予 600ms 的羅盤旋轉儀式感
      setTimeout(() => {
        setOracleResult(data);
        setIsSpinning(false);
        setIsLoading(false);

        // 如果是大吉好卦，噴灑微型金色彩帶
        if (data.luckScore >= 95) {
          try {
            confetti({
              particleCount: 40,
              spread: 60,
              origin: { y: 0.6 },
              colors: ['#f59e0b', '#fbbf24', '#38bdf8', '#c084fc'],
            });
          } catch {
            // ignore
          }
        }
      }, 700);
    } catch (err) {
      console.error('Divination failed:', err);
      setIsSpinning(false);
      setIsLoading(false);
    }
  }, [poolName, availableTickets, selectedZodiac, pickCount]);

  // 當彈窗開啟且尚未有結果時，自動先起一卦
  useEffect(() => {
    if (isOpen && !oracleResult) {
      handleDivination();
    }
  }, [isOpen, oracleResult, handleDivination]);



  const handleApply = () => {
    if (oracleResult?.luckyNumbers && onApplyNumbers) {
      onApplyNumbers(oracleResult.luckyNumbers);
      setApplied(true);
      setTimeout(() => {
        onClose();
      }, 500);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-[min(94vw,480px)] bg-slate-950/95 backdrop-blur-2xl border border-amber-500/30 text-white rounded-[28px] p-5 sm:p-6 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.9),0_0_50px_rgba(245,158,11,0.15)] overflow-hidden z-[200]">
        
        {/* 頂部柔和微光暈染 */}
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-64 h-36 bg-gradient-to-b from-amber-500/20 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-4">
          
          {/* 標頭：八卦玄學羅盤 Logo */}
          <div className="flex flex-col items-center text-center gap-1.5 w-full">
            <div className="relative flex items-center justify-center">
              <div className={cn(
                "w-12 h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-orange-500 to-yellow-300 p-0.5 shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-transform duration-700",
                isSpinning && "rotate-[720deg]"
              )}>
                <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center">
                  <Compass className={cn("w-6 h-6 text-amber-400 transition-all", isSpinning && "animate-spin")} />
                </div>
              </div>
              <span className="absolute -bottom-1 -right-1 px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 font-black text-[8px] tracking-wider uppercase">
                AI ORACLE
              </span>
            </div>

            <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-white flex items-center gap-1.5 mt-1">
              <span>AI 抽卡玄學運勢</span>
              <span className="text-amber-400 font-serif">·</span>
              <span className="text-amber-300">一番賞挑號羅盤</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              連結天干地支與即時卡池氣場，為您推演今日大賞靈驗號碼
            </DialogDescription>
          </div>

          {/* 儀式選擇區：星座屬性與挑籤抽數 */}
          <div className="flex items-center justify-between w-full bg-slate-900/80 border border-white/10 rounded-2xl p-2 px-3 gap-2 text-xs">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-slate-400 font-bold shrink-0 text-[11px]">命格：</span>
              <select
                value={selectedZodiac}
                onChange={e => setSelectedZodiac(e.target.value)}
                className="bg-transparent text-amber-300 font-black focus:outline-none cursor-pointer truncate text-xs"
              >
                {ZODIAC_LIST.map(z => (
                  <option key={z} value={z} className="bg-slate-900 text-white">
                    {z}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <span className="text-slate-400 font-bold text-[11px]">卜籤數：</span>
              {[1, 3].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setPickCount(cnt)}
                  className={cn(
                    "px-2 py-0.5 rounded-lg text-xs font-bold transition-all",
                    pickCount === cnt 
                      ? "bg-amber-500 text-slate-950 shadow-sm"
                      : "bg-white/5 text-slate-400 hover:text-white"
                  )}
                >
                  {cnt} 籤
                </button>
              ))}
            </div>
          </div>

          {/* 卜卦結果卡面 */}
          {oracleResult ? (
            <div className="w-full bg-gradient-to-b from-slate-900/90 to-slate-950/95 border border-amber-500/25 rounded-2xl p-4 flex flex-col gap-3 shadow-inner relative overflow-hidden">
              
              {/* 背景玄學水印符號 */}
              <div className="absolute right-2 -bottom-4 text-7xl font-serif text-white/[0.03] select-none pointer-events-none">
                乾
              </div>

              {/* 頂部：卦象稱號與運勢等級 */}
              <div className="flex items-center justify-between gap-2 border-b border-white/[0.08] pb-2.5">
                <span className="font-headline font-black text-sm text-amber-300 tracking-tight">
                  {oracleResult.fortuneTitle}
                </span>
                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black text-[10px] px-2 py-0.5 shadow-sm">
                  {oracleResult.luckLevel} ({oracleResult.luckScore}分)
                </Badge>
              </div>

              {/* 核心大獎靈驗號碼展示 */}
              <div className="flex flex-col items-center justify-center py-2 gap-1.5">
                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                  <span className="text-[10px] text-amber-200/90 font-bold uppercase tracking-wider flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-400" />
                    AI 推薦靈驗籤號
                  </span>
                  {availableTickets.length > 0 && (
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold">
                      嚴格精選自剩餘 {availableTickets.length} 籤
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-center gap-2.5 flex-wrap my-1">
                  {oracleResult.luckyNumbers.map(num => (
                    <div 
                      key={num}
                      className="relative px-3.5 py-1.5 rounded-xl bg-gradient-to-b from-amber-500/20 to-orange-500/10 border-2 border-amber-400/80 text-amber-300 font-black font-numbers text-xl sm:text-2xl shadow-[0_0_20px_rgba(245,158,11,0.3)] animate-pulse flex items-center gap-1"
                    >
                      <span className="text-xs font-sans text-amber-400/70">#</span>
                      {String(num).padStart(2, '0')}
                      <span className="text-[8px] font-sans px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 font-bold ml-1 border border-emerald-500/30">可抽</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* 算命仙解卦短評 */}
              <div className="bg-slate-950/60 rounded-xl p-2.5 border border-white/5 text-xs text-slate-300 leading-relaxed font-sans">
                <p className="text-slate-300">
                  <span className="text-amber-400 font-black mr-1">【玄學解讀】</span>
                  {oracleResult.luckyReason}
                </p>
              </div>

              {/* 開運方位與開箱咒語 */}
              <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                  <span className="text-slate-400 block text-[9px] font-bold">吉時開盒方位</span>
                  <span className="text-cyan-300 font-bold mt-0.5 block truncate">
                    🧭 {oracleResult.luckyDirection}
                  </span>
                </div>
                <div className="bg-white/5 rounded-xl p-2 border border-white/5">
                  <span className="text-slate-400 block text-[9px] font-bold">開運守護色</span>
                  <span className="text-amber-300 font-bold mt-0.5 block truncate">
                    🎨 {oracleResult.luckyColor}
                  </span>
                </div>
              </div>

              {/* 錦囊咒語 */}
              <div className="text-center pt-1">
                <p className="text-[11px] text-amber-300/90 font-serif italic">
                  ❝ {oracleResult.oracleQuote} ❞
                </p>
              </div>
            </div>
          ) : (
            <div className="w-full h-44 rounded-2xl bg-slate-900/60 border border-white/10 flex flex-col items-center justify-center gap-2">
              <RotateCw className="w-6 h-6 text-amber-400 animate-spin" />
              <span className="text-xs text-slate-400 font-bold animate-pulse">正在調動天干地支與卡池氣場...</span>
            </div>
          )}

          {/* 底部按鈕區 */}
          <div className="flex items-center gap-2 w-full pt-1">
            <Button
              type="button"
              variant="outline"
              onClick={handleDivination}
              disabled={isLoading}
              className="flex-1 h-10 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all"
            >
              <RotateCw className={cn("w-3.5 h-3.5 mr-1.5", isLoading && "animate-spin")} />
              重新求卦
            </Button>

            {onApplyNumbers && oracleResult?.luckyNumbers && (
              <Button
                type="button"
                onClick={handleApply}
                disabled={isLoading || applied}
                className="flex-[1.5] h-10 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs font-black shadow-[0_0_20px_rgba(245,158,11,0.35)] transition-all cursor-pointer"
              >
                {applied ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-1 text-emerald-800" />
                    已帶入號碼！
                  </>
                ) : (
                  <>
                    <Flame className="w-4 h-4 mr-1 fill-slate-950" />
                    一鍵鎖定幸運籤號
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
