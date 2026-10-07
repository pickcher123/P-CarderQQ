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
  HelpCircle
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
}: KujiNumberPickerDialogProps) {
  const [selectedNumbers, setSelectedNumbers] = useState<number[]>(initialSelectedNumbers);

  // Sync initialSelectedNumbers when dialog opens
  React.useEffect(() => {
    if (isOpen) {
      if (initialSelectedNumbers && initialSelectedNumbers.length > 0) {
        setSelectedNumbers(initialSelectedNumbers);
      }
    }
  }, [isOpen, initialSelectedNumbers]);

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
  const drawnTicketsCount = tickets.length - availableTickets.length;

  // 計算價格
  const isPPoint = cardPool?.currency === 'p-point';
  const pricePerDraw = cardPool?.price || 0;
  const count = selectedNumbers.length;
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
    if (!ticket || ticket.isDrawn) return;

    if (selectedNumbers.includes(num)) {
      setSelectedNumbers(prev => prev.filter(n => n !== num));
    } else {
      // 最多一次選 10 抽
      if (selectedNumbers.length >= 10) {
        return;
      }
      setSelectedNumbers(prev => [...prev, num]);
    }
  };

  // 隨機自選 N 號
  const handleRandomPick = (pickCount: number) => {
    if (isDrawing) return;
    const poolOfAvailable = availableTickets.map(t => t.number);
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
    if (selectedNumbers.length === 0 || isDrawing) return;
    onConfirmDraw(selectedNumbers);
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && !isDrawing && onClose()}>
      <DialogContent className="max-w-[min(94vw,680px)] max-h-[90vh] bg-slate-950/95 border border-cyan-500/30 text-white rounded-3xl p-4 sm:p-6 flex flex-col gap-4 shadow-[0_0_50px_rgba(6,182,212,0.15)] backdrop-blur-2xl overflow-hidden z-[150]">
        <DialogHeader className="space-y-1.5 text-left border-b border-white/10 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 shadow-lg shadow-amber-500/20">
                <Flame className="w-5 h-5 fill-slate-950" />
              </div>
              <div>
                <DialogTitle className={cn(
                  "text-lg sm:text-xl font-black tracking-wide text-transparent bg-clip-text",
                  isTrialMode 
                    ? "bg-gradient-to-r from-purple-300 via-fuchsia-300 to-indigo-300"
                    : "bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-500"
                )}>
                  {isTrialMode ? '一番賞番號選號盤 🧪 試抽模擬' : '一番賞番號選號盤'}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  {isTrialMode 
                    ? '自由挑選專屬幸運號碼，模擬測試該號碼開出的獎品（純模擬不扣點數）！'
                    : '挑選專屬幸運號碼，親手揭曉卡池大賞！'}
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-300 text-xs px-2.5 py-1">
                剩餘 {availableTickets.length} / {tickets.length} 籤
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* 快捷選號工具列 */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-bold">快速挑籤：</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRandomPick(1)}
              disabled={isDrawing || availableTickets.length < 1}
              className="h-7 text-xs px-2.5 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 hover:text-cyan-400"
            >
              <Shuffle className="w-3 h-3 mr-1" />
              自選 1 抽
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRandomPick(3)}
              disabled={isDrawing || availableTickets.length < 3}
              className="h-7 text-xs px-2.5 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 hover:text-cyan-400"
            >
              <Layers className="w-3 h-3 mr-1" />
              自選 3 抽
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleRandomPick(5)}
              disabled={isDrawing || availableTickets.length < 5}
              className="h-7 text-xs px-2.5 rounded-lg border-white/10 bg-white/5 hover:bg-white/10 hover:text-cyan-400 hidden sm:inline-flex"
            >
              自選 5 抽
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
              const isSelected = selectedNumbers.includes(ticket.number);
              const isDrawn = ticket.isDrawn;

              return (
                <button
                  key={ticket.number}
                  disabled={isDrawn || isDrawing}
                  onClick={() => toggleSelectNumber(ticket.number)}
                  className={cn(
                    'relative aspect-square rounded-xl flex flex-col items-center justify-center p-1 transition-all duration-200 select-none cursor-pointer group',
                    isDrawn
                      ? 'bg-slate-900/80 border border-white/5 text-slate-600 cursor-not-allowed opacity-40 line-through'
                      : isSelected
                      ? 'bg-gradient-to-b from-amber-400 to-yellow-500 text-slate-950 font-black border-2 border-amber-200 shadow-[0_0_15px_rgba(251,191,36,0.5)] scale-105 z-10'
                      : 'bg-gradient-to-b from-slate-800/80 to-slate-900/90 text-slate-200 border border-cyan-500/20 hover:border-cyan-400 hover:bg-cyan-950/40 hover:scale-105 shadow-sm'
                  )}
                >
                  <span className={cn(
                    'text-xs sm:text-sm font-black tracking-tight',
                    isSelected ? 'text-slate-950' : isDrawn ? 'text-slate-600' : 'text-cyan-200 group-hover:text-cyan-100'
                  )}>
                    {ticket.number}
                  </span>

                  {isDrawn && (
                    <span className="text-[9px] scale-75 text-slate-500 font-bold block -mt-1">
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
              {selectedNumbers.length > 0 ? (
                <div className="flex flex-wrap gap-1 max-w-[280px]">
                  {selectedNumbers.map(n => (
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
                      if (selectedNumbers.length === 0 || isDrawing) return;
                      onSelectNumbersOnly(selectedNumbers);
                      onClose();
                    }}
                    disabled={selectedNumbers.length === 0 || isDrawing}
                    className="flex-1 h-11 rounded-xl font-bold text-xs border-purple-500/40 bg-purple-950/40 text-purple-200 hover:bg-purple-900/60 transition-all"
                  >
                    ✅ 鎖定所選號碼
                  </Button>
                )}
                <Button
                  onClick={() => onConfirmDraw(selectedNumbers, true)}
                  disabled={selectedNumbers.length === 0 || isDrawing}
                  className={cn(
                    'flex-[2] h-11 rounded-xl font-black text-xs sm:text-sm tracking-wide shadow-xl flex items-center justify-center gap-2',
                    selectedNumbers.length > 0
                      ? 'bg-gradient-to-r from-purple-500 via-fuchsia-500 to-indigo-500 text-white hover:brightness-110 shadow-purple-500/25 cursor-pointer active:scale-95'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  )}
                >
                  <Sparkles className="w-4 h-4 text-amber-300" />
                  {selectedNumbers.length === 0
                    ? '請先點選號碼牌'
                    : `🎯 免費模擬開籤 (${selectedNumbers.length} 籤)`}
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 w-full sm:flex-1">
                {/* 免費試抽按鈕 */}
                <Button
                  variant="outline"
                  onClick={() => onConfirmDraw(selectedNumbers, true)}
                  disabled={selectedNumbers.length === 0 || isDrawing}
                  className={cn(
                    'h-11 px-3 rounded-xl font-bold text-xs border-purple-500/40 bg-purple-950/40 text-purple-300 hover:bg-purple-900/60 hover:text-purple-200 transition-all flex items-center justify-center gap-1 shrink-0',
                    selectedNumbers.length === 0 && 'opacity-40 cursor-not-allowed'
                  )}
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                  <span>試手氣模擬</span>
                </Button>

                {/* 挑完號碼先鎖定並確認 */}
                {onSelectNumbersOnly && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (selectedNumbers.length === 0 || isDrawing) return;
                      onSelectNumbersOnly(selectedNumbers);
                      onClose();
                    }}
                    disabled={selectedNumbers.length === 0 || isDrawing}
                    className="flex-1 h-11 rounded-xl font-bold text-xs border-amber-500/50 bg-amber-950/30 text-amber-300 hover:bg-amber-900/50 hover:text-amber-200 transition-all"
                  >
                    ✅ 鎖定號碼
                  </Button>
                )}

                {/* 直接確認開獎 */}
                <Button
                  onClick={handleConfirm}
                  disabled={selectedNumbers.length === 0 || !hasEnoughBalance || isDrawing}
                  className={cn(
                    'flex-[2] h-11 rounded-xl font-black text-xs sm:text-sm tracking-wide shadow-xl flex items-center justify-center gap-1.5',
                    selectedNumbers.length > 0 && hasEnoughBalance
                      ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 hover:brightness-110 shadow-amber-500/25 cursor-pointer'
                      : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                  )}
                >
                  <Sparkles className="w-4 h-4" />
                  {selectedNumbers.length === 0
                    ? '請先點選號碼'
                    : !hasEnoughBalance
                    ? '點數餘額不足'
                    : `確認開獎 (${selectedNumbers.length} 籤)`}
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
