'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BlindBoxVisual } from './BlindBoxVisual';
import { CardItem } from '@/components/card-item';
import { RandomPlayerCard } from '@/components/random-player-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SafeImage } from '@/components/safe-image';
import { HYBRID_TIER_META } from '@/lib/hybrid-pool-preset';
import type { HybridTierCode } from '@/types/draw';
import {
  Sparkles,
  PackageCheck,
  Coins,
  FastForward,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Gift,
  Scissors,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type StagePhase = 'gift' | 'box' | 'pack' | 'revealed';

interface BoxOpeningStageProps {
  prizes: any[];
  poolImageUrl?: string;
  poolName?: string;
  isTrialMode?: boolean;
  startRevealed?: boolean;
  onCompleteAll: () => void;
  onRedeemSpBuyback?: (prize: any) => Promise<boolean>;
}

export function BoxOpeningStage({
  prizes,
  poolImageUrl,
  poolName,
  isTrialMode = false,
  startRevealed = false,
  onCompleteAll,
  onRedeemSpBuyback,
}: BoxOpeningStageProps) {
  const [giftOpened, setGiftOpened] = useState(startRevealed);
  const [isUnwrappingGift, setIsUnwrappingGift] = useState(false);
  const [phaseByIndex, setPhaseByIndex] = useState<Record<number, StagePhase>>(() => {
    if (!startRevealed) return {};
    const init: Record<number, StagePhase> = {};
    prizes.forEach((_, idx) => {
      init[idx] = 'revealed';
    });
    return init;
  });
  const [animatingPhase, setAnimatingPhase] = useState<'box' | 'pack' | null>(null);
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
  const currentPhase: StagePhase = !giftOpened ? 'gift' : phaseByIndex[activeIndex] || 'box';

  const revealedCount = prizes.filter((_, idx) => phaseByIndex[idx] === 'revealed').length;
  const allRevealed = prizes.length > 0 && revealedCount >= prizes.length;

  const handleUnwrapGift = () => {
    if (isUnwrappingGift || giftOpened) return;
    setIsUnwrappingGift(true);
    setTimeout(() => {
      setGiftOpened(true);
      setIsUnwrappingGift(false);
    }, 520);
  };

  const handleOpenBoxToPack = (idx: number) => {
    if (animatingPhase) return;
    setAnimatingPhase('box');
    setTimeout(() => {
      setPhaseByIndex((prev) => ({ ...prev, [idx]: 'pack' }));
      setAnimatingPhase(null);
    }, 480);
  };

  const handleTearPackToReveal = (idx: number) => {
    if (animatingPhase) return;
    setAnimatingPhase('pack');
    setTimeout(() => {
      setPhaseByIndex((prev) => ({ ...prev, [idx]: 'revealed' }));
      setAnimatingPhase(null);
    }, 460);
  };

  const handleOpenAll = () => {
    setGiftOpened(true);
    const all: Record<number, StagePhase> = {};
    prizes.forEach((_, idx) => {
      all[idx] = 'revealed';
    });
    setPhaseByIndex(all);
    setAnimatingPhase(null);
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
  const resolvedPackImage = poolImageUrl || '/images/card_pool_bg.jpg';

  return (
    <div className="w-full max-w-3xl mx-auto flex flex-col items-center justify-center gap-4 px-3 py-2 select-none z-20">
      {/* 頂部步驟進度與跳過列 */}
      <div className="w-full flex items-center justify-between gap-2 bg-[#0a0f1c]/85 backdrop-blur-xl border border-white/[0.1] rounded-2xl px-4 py-2.5 shadow-xl">
        <div className="flex items-center gap-2 min-w-0">
          {giftOpened ? (
            <Badge className={cn('text-[11px] font-black border px-2.5 py-0.5', tierMeta.badgeClass)}>
              {tierMeta.label}
            </Badge>
          ) : (
            <Badge className="bg-amber-400/15 text-[#FDE68A] border-amber-300/45 text-[11px] font-black">
              黑盒一番賞禮盒
            </Badge>
          )}
          <span className="text-xs font-bold text-slate-300 tabular-nums">
            {!giftOpened ? '步驟 1/3 拆禮物' : `第 ${activeIndex + 1} / ${prizes.length} 盒`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {!allRevealed && (
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
            {allRevealed ? '獎項確認總覽' : '略過並結算'}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 中央互動開獎舞台 */}
      <div className="relative w-full min-h-[370px] sm:min-h-[420px] rounded-2xl bg-[#0a0f1c]/90 backdrop-blur-2xl border border-white/[0.1] border-t-2 border-t-amber-300/65 shadow-[0_24px_64px_rgba(0,0,0,0.88)] flex flex-col items-center justify-center p-5 overflow-hidden">
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-64 h-24 bg-amber-400/10 blur-2xl pointer-events-none" />

        <AnimatePresence mode="wait">
          {/* 步驟一：開禮物畫面 */}
          {currentPhase === 'gift' && (
            <motion.div
              key="gift-stage"
              initial={{ opacity: 0, scale: 0.88, y: 16 }}
              animate={
                isUnwrappingGift
                  ? { scale: [1, 1.12, 0.9, 1.25], rotate: [0, -5, 5, 0], opacity: [1, 1, 0] }
                  : { opacity: 1, scale: 1, y: 0 }
              }
              exit={{ opacity: 0, scale: 1.2 }}
              transition={{ duration: isUnwrappingGift ? 0.5 : 0.35 }}
              onClick={handleUnwrapGift}
              className="flex flex-col items-center justify-center gap-5 cursor-pointer group"
            >
              <motion.div
                animate={!isUnwrappingGift ? { y: [0, -8, 0] } : undefined}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="relative w-36 h-36 sm:w-44 sm:h-44 rounded-3xl bg-gradient-to-br from-[#1a1f33] via-[#0d121f] to-black border-2 border-amber-300/65 shadow-[0_0_50px_rgba(251,191,36,0.3)] flex items-center justify-center group-hover:scale-105 transition-transform"
              >
                <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-4 bg-gradient-to-r from-[#FDE68A] via-amber-400 to-[#FDE68A] opacity-85" />
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-4 bg-gradient-to-b from-[#FDE68A] via-amber-400 to-[#FDE68A] opacity-85" />
                <div className="relative z-10 w-16 h-16 rounded-2xl bg-[#0a0f1c] border border-amber-300/80 flex items-center justify-center shadow-2xl">
                  <Gift className="w-9 h-9 text-[#FDE68A]" />
                </div>
              </motion.div>

              <div className="text-center space-y-1.5">
                <p className="text-lg sm:text-xl font-black text-white tracking-wide">
                  {poolName || '黑盒一番賞'} 神秘禮盒已送達
                </p>
                <p className="text-xs text-[#FDE68A] font-bold flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  點擊禮物盒拆封，揭曉您抽中的盲盒顏色！
                </p>
              </div>
            </motion.div>
          )}

          {/* 步驟二：禮物打開 -> 出現對應顏色的盲盒 */}
          {currentPhase === 'box' && (
            <motion.div
              key={`box-${activeIndex}`}
              initial={{ opacity: 0, scale: 0.75, y: 24 }}
              animate={
                animatingPhase === 'box'
                  ? { scale: [1, 1.1, 0.92, 1.18], rotate: [0, -4, 4, 0], opacity: [1, 1, 0] }
                  : { opacity: 1, scale: 1, y: 0 }
              }
              exit={{ opacity: 0, scale: 1.15 }}
              transition={{ duration: animatingPhase === 'box' ? 0.45 : 0.35 }}
              onClick={() => handleOpenBoxToPack(activeIndex)}
              className="flex flex-col items-center justify-center gap-4 cursor-pointer group"
            >
              <motion.div
                animate={animatingPhase !== 'box' ? { y: [0, -6, 0] } : undefined}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
              >
                <BlindBoxVisual
                  tier={currentTier}
                  size="lg"
                  isOpening={animatingPhase === 'box'}
                  className="group-hover:scale-105 transition-transform"
                />
              </motion.div>

              <div className="text-center space-y-1.5">
                <p className="text-base sm:text-lg font-black text-white tracking-wide">
                  獲得【{tierMeta.label}】！
                </p>
                <p className="text-xs text-[#FDE68A] font-bold flex items-center justify-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                  點擊盲盒開啟盒蓋，取出專屬卡包
                </p>
              </div>
            </motion.div>
          )}

          {/* 步驟三：盲盒打開 -> 跑出卡包 -> 撕開卡包 */}
          {currentPhase === 'pack' && (
            <motion.div
              key={`pack-${activeIndex}`}
              initial={{ opacity: 0, y: 40, scale: 0.8 }}
              animate={
                animatingPhase === 'pack'
                  ? { scale: [1, 1.08, 1.2], opacity: [1, 1, 0] }
                  : { opacity: 1, y: 0, scale: 1 }
              }
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ type: 'spring', duration: 0.45, bounce: 0.2 }}
              onClick={() => handleTearPackToReveal(activeIndex)}
              className="flex flex-col items-center justify-center gap-4 cursor-pointer group"
            >
              <div className="relative w-[170px] sm:w-[195px] aspect-[2.5/3.8] rounded-2xl overflow-hidden border-2 border-amber-300/75 shadow-[0_0_45px_rgba(251,191,36,0.35)] bg-slate-900 group-hover:scale-[1.03] transition-transform">
                <SafeImage src={resolvedPackImage} alt="卡包包裝" fill className="object-cover" />
                {/* 頂部撕開虛線條 */}
                <div className="absolute inset-x-0 top-6 border-t-2 border-dashed border-[#FDE68A]/90 flex items-center justify-center">
                  <span className="-mt-3 px-2 py-0.5 rounded-full bg-[#0a0f1c]/90 border border-amber-300/60 text-[10px] font-black text-[#FDE68A] flex items-center gap-1">
                    <Scissors className="w-3 h-3" /> 點擊沿線撕開
                  </span>
                </div>
                <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/90 to-transparent text-center">
                  <Badge className={cn('text-[10px] font-black border', tierMeta.badgeClass)}>
                    {tierMeta.label} 專屬卡包
                  </Badge>
                </div>
              </div>

              <p className="text-xs text-[#FDE68A] font-bold flex items-center justify-center gap-1.5">
                <Scissors className="w-3.5 h-3.5 animate-pulse" />
                點擊或滑動撕開卡包，揭曉最終大獎！
              </p>
            </motion.div>
          )}

          {/* 步驟四：卡包撕開 -> 獎項確認 */}
          {currentPhase === 'revealed' && (
            <motion.div
              key={`revealed-${activeIndex}`}
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

      {/* 底部多抽盒子切換列（禮物打開後顯示） */}
      {giftOpened && prizes.length > 1 && (
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
            const phase = phaseByIndex[idx] || 'box';
            const active = idx === activeIndex;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveIndex(idx)}
                className={cn(
                  'shrink-0 flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all text-left cursor-pointer',
                  active
                    ? 'bg-amber-400/15 border-amber-300/65 text-white'
                    : 'bg-[#0a0f1c]/75 border-white/[0.08] text-slate-400 hover:bg-white/[0.05]'
                )}
              >
                <BlindBoxVisual tier={t} size="xs" isOpened={phase !== 'box'} />
                <div className="text-[11px] leading-tight">
                  <div className="font-bold">{HYBRID_TIER_META[t].boxName}</div>
                  <div className="text-[10px] opacity-75">
                    {phase === 'revealed' ? '已確認' : phase === 'pack' ? '待撕包' : '待開盒'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
