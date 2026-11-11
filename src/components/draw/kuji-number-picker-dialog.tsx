'use client';

import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { CardPool, KujiTicketItem, Rarity } from '@/types/draw';
import { DiamondIcon, PPlusIcon } from '@/components/icons';
import {
  Sparkles,
  Trophy,
  CheckCircle2,
  XCircle,
  Shuffle,
  RotateCcw,
  Layers,
  Flame,
  HelpCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface KujiNumberPickerDialogProps {
  isOpen: boolean;
  onClose: () => void;
  cardPool: CardPool | null;
  userBalance?: number;
  onConfirmDraw: (selectedNumbers: number[], isTrial?: boolean) => void;
  isDrawing?: boolean;
  isTrialMode?: boolean;
  initialSelectedNumbers?: number[];
  onSelectNumbersOnly?: (selectedNumbers: number[]) => void;
  targetPickCount?: number;
}

export function KujiNumberPickerDialog({
  isOpen,
  onClose,
  cardPool,
  userBalance = 0,
  onConfirmDraw,
  isDrawing = false,
  isTrialMode = false,
  initialSelectedNumbers = [],
  onSelectNumbersOnly,
  targetPickCount,
}: KujiNumberPickerDialogProps) {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>(initialSelectedNumbers);

  // 取得現有籤表，如果尚未產生則自動即時預覽 1~80 號
  const tickets: KujiTicketItem[] = useMemo(() => {
    if (cardPool?.kujiTickets && cardPool.kujiTickets.length > 0) {
      return cardPool.kujiTickets;
    }
    // 若該卡池未初始化籤表，自動以 remainingPacks 或預設 80 張生成虛擬號碼牌
    const total = cardPool?.totalPacks || cardPool?.remainingPacks || 80;
    const remaining = cardPool?.remainingPacks || total;
    const list: KujiTicketItem[] = [];
    for (let i = 1; i <= total; i++) {
      list.push({
        number: i,
        isDrawn: i > remaining,
      });
    }
    return list;
  }, [cardPool]);

  // 統計未開出與已開出
  const availableTickets = useMemo(() => tickets.filter(t => !t.isDrawn), [tickets]);
  const availableNumbersSet = useMemo(() => new Set(availableTickets.map(t => t.number)), [availableTickets]);

  // Sync initialSelectedNumbers 或依 targetPickCount 自動預選抽數號碼（嚴格過濾已開出號碼）
  React.useEffect(() => {
    if (isOpen) {
      const validInitial = (initialSelectedNumbers || []).filter(num => availableNumbersSet.has(num));

      if (validInitial.length > 0) {
        setSelectedNumbers(validInitial);
      } else if (targetPickCount && targetPickCount > 0) {
        const poolOfAvailable = Array.from(availableNumbersSet);
        if (poolOfAvailable.length > 0) {
          const shuffled = [...poolOfAvailable];
          for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
          }
          const chosen = shuffled.slice(0, Math.min(targetPickCount, shuffled.length));
          setSelectedNumbers(chosen);
        } else {
          setSelectedNumbers([]);
        }
      } else {
        setSelectedNumbers([]);
      }
    }
  }, [isOpen, initialSelectedNumbers, targetPickCount, availableNumbersSet]);

  // 即時監聽 availableNumbersSet：若目前選取的號碼已被抽出，即刻自選取狀態中自動剔除
  React.useEffect(() => {
    setSelectedNumbers(prev => {
      const filtered = prev.filter(num => availableNumbersSet.has(num));
      return filtered.length === prev.length ? prev : filtered;
    });
  }, [availableNumbersSet]);

  const drawnTicketsCount = tickets.length - availableTickets.length;

  // 計算價格（嚴格僅以可用籤號計價）
  const validSelectedNumbers = useMemo(() => selectedNumbers.filter(n => availableNumbersSet.has(n)), [selectedNumbers, availableNumbersSet]);
  const isPPoint = cardPool?.currency === 'p-point';
  const pricePerDraw = cardPool?.price || 0;
  const count = validSelectedNumbers.length;
  const totalPrice = useMemo(() => {
    if (count === 3 && cardPool?.price3Draws) {
      return cardPool.price3Draws;
    }
    return pricePerDraw * count;
  }, [count, pricePerDraw, cardPool?.price3Draws]);

  const hasEnoughBalance = userBalance >= totalPrice;

  // 切換選中號碼
  const toggleSelectNumber = (num: number) => {
    if (isDrawing) return;
    const ticket = tickets.find(t => t.number === num);
    if (!ticket) return;

    // 若已開出抽出，嚴格禁止點選，並強制從選取列表中清除
    if (ticket.isDrawn || !availableNumbersSet.has(num)) {
      setSelectedNumbers(prev => prev.filter(n => n !== num));
      return;
    }

    // 若號碼已在選取列表中，允許取消選取
    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(prev => prev.filter(n => n !== num));
      return;
    }

    // 最多一次選 10 抽
    if (validSelectedNumbers.length >= 10) {
      return;
    }
    setSelectedNumbers(prev => [...prev.filter(n => availableNumbersSet.has(n)), num]);
  };

  // 隨機自選 N 號
  const handleRandomPick = (pickCount: number) => {
    if (isDrawing) return;
    const poolOfAvailable = Array.from(availableNumbersSet);
    if (poolOfAvailable.length === 0) return;

    // Fisher-Yates shuffle
    const shuffled = [...poolOfAvailable];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    const chosen = shuffled.slice(0, Math.min(pickCount, shuffled.length));
    setSelectedNumbers(chosen);
  };

  const handleClear = () => {
    if (isDrawing) return;
    setSelectedNumbers([]);
  };

  const handleConfirm = () => {
    if (validSelectedNumbers.length === 0 || isDrawing) return;
    onConfirmDraw(validSelectedNumbers);
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && !isDrawing && onClose()}>
      <DialogContent className="max-w-[min(94vw,680px)] max-h-[90vh] bg-slate-950/95 border border-cyan-500/30 text-white rounded-3xl p-4 sm:p-6 flex flex-col gap-4 shadow-[0_0_50px_rgba(6,182,212,0.15)] backdrop-blur-2xl overflow-hidden z-[150]">
        <DialogHeader className="space-y-1.5 text-left border-b border-white/10 pb-3 pr-12">
          <div className="flex items-start gap-2.5 sm:gap-3">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20 shrink-0 mt-0.5">
              <Flame className="w-4 h-4 sm:w-5 sm:h-5 fill-slate-950" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <DialogTitle className="text-base sm:text-lg md:text-xl font-black tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500">
                  一番賞番號選號盤
                </DialogTitle>
                <Badge variant="outline" className="border-amber-500/50 bg-amber-500/15 text-amber-300 text-[11px] font-mono font-bold px-2.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                  剩餘 {availableTickets.length} / {tickets.length} 籤
                </Badge>
              </div>
              <DialogDescription className="text-xs text-slate-400 mt-1 line-clamp-1 sm:line-clamp-none">
                挑選專屬幸運號碼，親手揭曉卡池大賞！
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* 系統選號工具列 */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-bold">系統選號：</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRandomPick(1)}
              disabled={isDrawing || availableTickets.length < 1}
              className="h-7 text-xs px-2.5 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 hover:text-cyan-400"
            >
              <Shuffle className="w-3 h-3 mr-1" />
              系統選號 1 抽
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRandomPick(3)}
              disabled={isDrawing || availableTickets.length < 3}
              className="h-7 text-xs px-2.5 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 hover:text-cyan-400"
            >
              <Layers className="w-3 h-3 mr-1" />
              系統選號 3 抽
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRandomPick(5)}
              disabled={isDrawing || availableTickets.length < 5}
              className="h-7 text-xs px-2.5 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 hover:text-cyan-400 hidden sm:inline-flex"
            >
              系統選號 5 抽
            </Button>
          </div>

          {selectedNumbers.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClear}
              disabled={isDrawing}
              className="h-7 text-xs px-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10"
            >
              <RotateCcw className="w-3 h-3 mr-1" />
              清空重選
            </Button>
          )}
        </div>

        {/* 號碼牌牆 Grid */}
        <ScrollArea className="h-[280px] sm:h-[340px] rounded-2xl bg-slate-900/60 border border-white/5 p-3">
          <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2 sm:gap-2.5">
            {tickets.map(ticket => {
              const isDrawn = !!ticket.isDrawn || !availableNumbersSet.has(ticket.number);
              const isSelected = !isDrawn && selectedNumbers.includes(ticket.number);

              return (
                <button
                  key={ticket.number}
                  disabled={isDrawn || isDrawing}
                  onClick={() => toggleSelectNumber(ticket.number)}
                  className={cn(
                    'relative aspect-square rounded-xl flex items-center justify-center p-1 transition-all duration-200 select-none group',
                    isDrawn
                      ? 'bg-slate-950/80 border border-white/5 text-slate-600 cursor-not-allowed opacity-30 pointer-events-none shadow-none'
                      : isSelected
                      ? 'bg-gradient-to-b from-amber-400 to-yellow-500 text-slate-950 font-black border-2 border-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.5)] scale-105 z-10 cursor-pointer'
                      : 'bg-gradient-to-b from-slate-800/80 to-slate-900/90 text-slate-200 border border-cyan-500/20 hover:border-cyan-400 hover:bg-cyan-950/40 hover:scale-105 shadow-sm cursor-pointer'
                  )}
                >
                  <span className={cn(
                    'text-xs sm:text-sm font-black font-mono tracking-tight text-center leading-none flex items-center justify-center',
                    isSelected ? 'text-slate-950' : isDrawn ? 'text-slate-600 line-through' : 'text-cyan-200 group-hover:text-cyan-100'
                  )}>
                    {ticket.number}
                  </span>

                  {isDrawn && (
                    <span className="text-[8px] font-bold text-slate-500 absolute bottom-0.5 left-1/2 -translate-x-1/2 leading-none whitespace-nowrap scale-90">
                      已開
                    </span>
                  )}

                  {isSelected && (
                    <CheckCircle2 className="w-3 h-3 text-slate-950 absolute top-1 right-1" />
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>

        {/* 底部確認與花費區塊 */}
        <div className="border-t border-white/10 pt-3 flex flex-col gap-3">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <span>已選號碼：</span>
              {validSelectedNumbers.length > 0 ? (
                <div className="flex flex-wrap gap-1 max-w-[280px]">
                  {validSelectedNumbers.map(n => (
                    <Badge key={n} variant="secondary" className="bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] px-1.5 py-0">
                      #{n}
                    </Badge>
                  ))}
                </div>
              ) : (
                <span className="text-slate-500 italic">尚未點選號碼 (請點選上方數字牌)</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 font-bold">
              <span className="text-slate-400">總計花費：</span>
              {isTrialMode ? (
                <div className="flex items-center gap-1 text-purple-300 font-black text-sm">
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>免費試手氣 (0 點)</span>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-amber-400 font-black text-sm">
                  {isPPoint ? <PPlusIcon className="w-3.5 h-3.5" /> : <DiamondIcon className="w-3.5 h-3.5" />}
                  <span>{totalPrice.toLocaleString()}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isDrawing}
              className="w-full sm:w-auto h-11 px-4 rounded-xl border-white/10 text-slate-300 hover:bg-white/5"
            >
              取消
            </Button>

            {isTrialMode ? (
              <div className="flex items-center gap-2 w-full sm:flex-1">
                {onSelectNumbersOnly && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (validSelectedNumbers.length === 0 || isDrawing) return;
                      onSelectNumbersOnly(validSelectedNumbers);
                      onClose();
                    }}
                    disabled={validSelectedNumbers.length === 0 || isDrawing}
                    className="flex-1 h-11 rounded-xl font-bold text-xs border-purple-500/40 bg-purple-950/40 text-purple-200 hover:bg-purple-900/60 transition-all"
                  >
                    ✅ 鎖定所選號碼
                  </Button>
                )}
                <Button
                  onClick={() => onConfirmDraw(validSelectedNumbers, true)}
                  disabled={validSelectedNumbers.length === 0 || isDrawing}
                  className={cn(
                    'flex-[2] h-11 rounded-xl font-black text-xs sm:text-sm tracking-wide shadow-xl flex items-center justify-center gap-2',
                    validSelectedNumbers.length > 0
                      ? 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-500 text-white hover:brightness-110 shadow-purple-500/25 cursor-pointer active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  )}
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  {validSelectedNumbers.length === 0
                    ? '請先點選號碼牌'
                    : `🎯 免費模擬開籤 (${validSelectedNumbers.length} 籤)`}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2 w-full sm:flex-1">
                {/* 直接確認開獎 */}
                <Button
                  onClick={handleConfirm}
                  disabled={validSelectedNumbers.length === 0 || !hasEnoughBalance || isDrawing}
                  className={cn(
                    'flex-1 h-11 rounded-xl font-black text-xs sm:text-sm tracking-wide shadow-xl flex items-center justify-center gap-1.5',
                    validSelectedNumbers.length > 0 && hasEnoughBalance
                      ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 hover:brightness-110 shadow-amber-500/25 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  {validSelectedNumbers.length === 0
                    ? '請先點選號碼'
                    : !hasEnoughBalance
                    ? '點數餘額不足'
                    : `確認開獎 (${validSelectedNumbers.length} 籤)`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
