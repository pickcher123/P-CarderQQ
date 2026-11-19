'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BlindBoxVisual } from './BlindBoxVisual';
import { CardItem } from '@/components/card-item';
import { RandomPlayerCard } from '@/components/random-player-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { HYBRID_TIER_META } from '@/lib/hybrid-pool-preset';
import type { HybridTierCode } from '@/types/draw';
import { Sparkles, PackageCheck, Coins, FastForward, CheckCircle2, Loader2, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BoxOpeningStageProps {
  prizes: any[];
  isTrialMode?: boolean;
  onCompleteAll: () => void;
  onRedeemSpBuyback?: (prize: any) => Promise<boolean>;
}

export function BoxOpeningStage({
  prizes,
  isTrialMode = false,
  onCompleteAll,
  onRedeemSpBuyback,
}: BoxOpeningStageProps) {
  const [openedIndices, setOpenedIndices] = useState<Set<number>>(() => new Set());
  const [openingIndex, setOpeningIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState<number>(0);
  const [redeemingIds, setRedeemingIds] = useState<Set<number>>(() => new Set());
  const [redeemedIds, setRedeemedIds] = useState<Set<number>>(() => new Set());

  const currentPrize = prizes[activeIndex];
  const currentTier: HybridTierCode =
    currentPrize?.tierCode ||
    (currentPrize?.type === 'last-prize'
      ? 'LAST'
      : currentPrize?.rarity === 'legendary'
        ? 'A'
        : currentPrize?.rarity === 'rare'
          ? 'B'
          : 'D');

  const tierMeta = HYBRID_TIER_META[currentTier] || HYBRID_TIER_META.D;
  const isCurrentOpened = openedIndices.has(activeIndex);
  const isCurrentOpening = openingIndex === activeIndex;
  const allOpened = prizes.length > 0 && openedIndices.size >= prizes.length;

  const handleOpenBox = (idx: number) => {
    if (openedIndices.has(idx) || openingIndex !== null) return;
    setOpeningIndex(idx);
    setTimeout(() => {
      setOpenedIndices((prev) => {
        const next = new Set(prev);
        next.add(idx);
        return next;
      });
      setOpeningIndex(null);
    }, 520);
  };

  const handleOpenAll = () => {
    const all = new Set<number>(prizes.map((_, idx) => idx));
    setOpenedIndices(all);
    setOpeningIndex(null);
  };

  const handleSpRedeem = async (idx: number, prize: any) => {
    if (!onRedeemSpBuyback || redeemingIds.has(idx) || redeemedIds.has(idx)) return;
    setRedeemingIds((prev) => new Set(prev).add(idx));
    try {
      const ok = await onRedeemSpBuyback(prize);
      if (ok) {
        setRedeemedIds((prev) => new Set(prev).add(idx));
      }
    } finally {
      setRedeemingIds((prev) => {
        const next = new Set(prev);
        next.delete(idx);
        return next;
      });
    }
  };

  if (!currentPrize) return null;

  const isPointOrRandom =
    currentPrize.type === 'points' ||
    Boolean(currentPrize.isPoints) ||
    Boolean(currentPrize.name?.includes('隨機球員'));

  const isSpPrize = currentTier === 'SP' && !isPointOrRandom;
  const buybackPoints = Number(
    currentPrize.buybackPoints || Math.round(Number(currentPrize.sellPrice || 0) * 0.8)
  );

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center gap-4 px-3 py-2 select-none z-20">
      {/* 頂部盒子進度列 */}
      <div className="w-full flex items-center justify-between gap-2 bg-[#0a0f1c]/85 backdrop-blur-xl border border-white/[0.1] rounded-2xl px-4 py-2.5 shadow-xl">
        <div className="flex items-center gap-2 min-w-0">
          <Badge className={cn('text-[11px] font-black border px-2.5 py-0.5', tierMeta.badgeClass)}>
            {tierMeta.label}
          </Badge>
          <span className="text-xs font-bold text-slate-300 tabular-nums">
            第 {activeIndex + 1} / {prizes.length} 盒
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!allOpened && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenAll}
              className="h-8 rounded-xl border-amber-300/40 bg-amber-400/10 text-[#FDE68A] hover:bg-amber-400/20 font-bold text-xs gap-1"
            >
              <FastForward className="w-3.5 h-3.5" />
              一鍵全開
            </Button>
          )}
          <Button
            size="sm"
            onClick={onCompleteAll}
            className="h-8 rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black text-xs gap-1 shadow-md"
          >
            {allOpened ? '查看結算總覽' : '略過並結算'}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 中央開盒舞台 */}
      <div className="relative w-full min-h-[340px] sm:min-h-[390px] rounded-2xl bg-[#0a0f1c]/90 backdrop-blur-2xl border border-white/[0.1] border-t-2 border-t-amber-300/65 shadow-[0_24px_64px_rgba(0,0,0,0.88)] flex flex-col items-center justify-center p-5 overflow-hidden">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-24 bg-amber-400/10 blur-2xl pointer-events-none" />

        <AnimatePresence mode="wait">
          {!isCurrentOpened ? (
            <motion.div
              key={`sealed-${activeIndex}`}
              initial={{ opacity: 0, scale: 0.9, y: 16 }}
              animate={
                isCurrentOpening
                  ? {
                      scale: [1, 1.08, 0.94, 1.15],
                      rotate: [0, -3, 3, -4, 0],
                      opacity: [1, 1, 1, 0],
                    }
                  : { opacity: 1, scale: 1, y: 0 }
              }
              exit={{ opacity: 0, scale: 1.15 }}
              transition={{ duration: isCurrentOpening ? 0.5 : 0.3 }}
              onClick={() => handleOpenBox(activeIndex)}
              className="flex flex-col items-center justify-center gap-4 cursor-pointer group"
            >
              <motion.div
                animate={!isCurrentOpening ? { y: [0, -6, 0] } : undefined}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <BlindBoxVisual
                  tier={currentTier}
                  size="lg"
                  isOpening={isCurrentOpening}
                  className="group-hover:scale-105 transition-transform"
                />
              </motion.div>

              <div className="text-center space-y-1.5">
                <p className="text-base sm:text-lg font-black text-white tracking-wide">
                  獲得【{tierMeta.label}】！
                </p>
                <p className="text-xs text-[#FDE68A] font-bold flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  點擊盲盒立即拆封揭曉卡片
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key={`opened-${activeIndex}`}
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', duration: 0.45, bounce: 0.25 }}
              className="w-full flex flex-col items-center gap-4"
            >
              <div className="w-[175px] sm:w-[205px] aspect-[2.5/4] rounded-xl overflow-hidden shadow-2xl border border-amber-300/45">
                {isPointOrRandom ? (
                  <RandomPlayerCard
                    rarity={currentPrize.rarity}
                    points={currentPrize.points}
                    title={currentPrize.name}
                    className="w-full h-full aspect-[2.5/4]"
                  />
                ) : (
                  <CardItem
                    name={currentPrize.name}
                    imageUrl={currentPrize.imageUrl}
                    backImageUrl={currentPrize.backImageUrl}
                    imageHint={currentPrize.name}
                    rarity={currentPrize.rarity}
                    serialNumber={currentPrize.serialNumber}
                    isFlippable={true}
                    priority
                    className="w-full h-full aspect-[2.5/4]"
                  />
                )}
              </div>

              <div className="text-center space-y-1 max-w-md">
                <h3 className="text-sm sm:text-base font-black text-white">{currentPrize.name}</h3>
                {currentPrize.certNumber && (
                  <p className="text-[11px] font-mono text-slate-400">
                    鑑定編號: {currentPrize.certNumber}
                  </p>
                )}
              </div>

              {/* SP 賞（黑盒）專屬雙選項：保留實體卡片 vs 立即點數回收 */}
              {isSpPrize && !isTrialMode && buybackPoints > 0 && (
                <div className="w-full max-w-md p-3 rounded-xl bg-white/[0.04] border border-amber-300/40 space-y-2.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#FDE68A]">SP 隱藏黑盒專屬保障</span>
                    <span className="font-mono text-slate-300 tabular-nums">
                      保底回收 {buybackPoints.toLocaleString()} 點
                    </span>
                  </div>

                  {redeemedIds.has(activeIndex) ? (
                    <div className="flex items-center justify-center gap-1.5 py-2 rounded-xl bg-emerald-500/15 border border-emerald-400/40 text-emerald-300 text-xs font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      已回收 {buybackPoints.toLocaleString()} 點數並入帳至錢包
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (activeIndex < prizes.length - 1) {
                            setActiveIndex(activeIndex + 1);
                          } else {
                            onCompleteAll();
                          }
                        }}
                        className="h-9 rounded-xl border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08] font-bold text-xs gap-1.5"
                      >
                        <PackageCheck className="w-3.5 h-3.5 text-emerald-400" />
                        保留實體卡片
                      </Button>
                      <Button
                        size="sm"
                        disabled={redeemingIds.has(activeIndex)}
                        onClick={() => handleSpRedeem(activeIndex, currentPrize)}
                        className="h-9 rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black text-xs gap-1.5"
                      >
                        {redeemingIds.has(activeIndex) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Coins className="w-3.5 h-3.5" />
                        )}
                        回收 {buybackPoints.toLocaleString()} 點
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 底部多抽盒子切換列 */}
      {prizes.length > 1 && (
        <div className="w-full flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {prizes.map((p, idx) => {
            const t: HybridTierCode =
              p.tierCode ||
              (p.type === 'last-prize'
                ? 'LAST'
                : p.rarity === 'legendary'
                  ? 'A'
                  : p.rarity === 'rare'
                    ? 'B'
                    : 'D');
            const opened = openedIndices.has(idx);
            const active = idx === activeIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={cn(
                  'shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-left',
                  active
                    ? 'bg-amber-400/15 border-amber-300/65 text-white'
                    : 'bg-[#0a0f1c]/75 border-white/[0.08] text-slate-400 hover:bg-white/[0.05]'
                )}
              >
                <BlindBoxVisual tier={t} size="xs" isOpened={opened} />
                <div className="text-[11px] leading-tight">
                  <div className="font-bold">{HYBRID_TIER_META[t].boxName}</div>
                  <div className="text-[10px] opacity-75">{opened ? '已拆封' : '待開啟'}</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
