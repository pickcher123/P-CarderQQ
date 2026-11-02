'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Gem, Flame, Sparkles, Trophy, Crown, ArrowRight } from 'lucide-react';
import { PPlusIcon, LuckyBagIcon } from '@/components/icons';
import { cn } from '@/lib/utils';
import { useAutoMatteImage } from '@/hooks/use-auto-matte-image';
import type { LuckBagWithCount } from '@/app/(main)/lucky-bags/page';

interface LuckyBagRedPacketCardProps {
  bag: LuckBagWithCount;
  isCenter?: boolean;
  priority?: boolean;
  onClick?: () => void;
  className?: string;
  variant?: 'carousel' | 'standard';
}

/**
 * 紅包袋 (Lucky Red Packet / Hongbao) 風格卡片
 * 特色：
 * 1. 傳統皇家朱砂紅/絳紅絲絨漸層
 * 2. 頂部圓弧燙金折蓋與金邊壓紋 (Folded Flap)
 * 3. 中央立體燙金「福」字吉祥封蠟金印 (Gold Embossed Seal)
 * 4. 金色如意雲紋與四角幾何燙金飾邊
 * 5. 頂級頭獎卡牌微露櫥窗與燙金標籤
 */
export function LuckyBagRedPacketCard({
  bag,
  isCenter = false,
  priority = false,
  onClick,
  className,
  variant = 'carousel',
}: LuckyBagRedPacketCardProps) {
  const isDone = bag.status === '已開獎';
  const currency = bag.currency || 'p-point';
  const progress = Math.min(100, Math.round((bag.participantCount / (bag.totalParticipants || 1)) * 100));
  const isNearFull = progress >= 80 && !isDone;
  const remainingSlots = Math.max(0, (bag.totalParticipants || 0) - (bag.participantCount || 0));

  // 自動對頭獎卡牌執行外圍黑邊消除與智慧去背
  const mattedImageUrl = useAutoMatteImage(bag.prizeCards?.first?.imageUrl, {
    darkThreshold: 65,
    trimInset: 2,
    feather: true,
  });

  if (variant === 'standard') {
    // 列表橫式/大版型紅包袋風格卡片
    return (
      <Link
        href={`/lucky-bags/${bag.id}`}
        className={cn(
          "group relative flex flex-col lg:flex-row p-4 sm:p-6 md:p-7 rounded-2xl sm:rounded-3xl border transition-all duration-500 cursor-pointer overflow-hidden select-none",
          "bg-gradient-to-b from-[#881337] via-[#4c0519] to-[#1e0208] backdrop-blur-xl",
          isDone
            ? "border-amber-900/40 opacity-80"
            : isNearFull
            ? "border-amber-400/80 shadow-[0_12px_40px_rgba(244,63,94,0.35)] hover:shadow-[0_0_40px_rgba(245,158,11,0.5)]"
            : "border-amber-500/40 hover:border-amber-400 shadow-[0_10px_35px_rgba(0,0,0,0.8)] hover:shadow-[0_0_35px_rgba(245,158,11,0.3)]",
          "hover:-translate-y-1.5",
          className
        )}
      >
        {/* 頂部紅包袋燙金弧線裝飾 (Gold Flap Edge) */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-600 via-yellow-300 to-amber-600 shadow-[0_2px_10px_rgba(250,204,21,0.5)] z-20" />

        {/* 紅包袋暗底如意暗紋背景 */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(245,158,11,0.18),transparent_70%)] pointer-events-none" />
        <div className="absolute -top-16 -right-16 w-64 h-64 bg-amber-500/10 rounded-full blur-[80px] pointer-events-none" />

        {/* 左側：大獎卡展示 + 紅包封印 */}
        <div className="relative w-full lg:flex-[1.2] flex flex-col sm:flex-row items-center sm:items-stretch gap-4 sm:gap-6 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-[#7f1d1d]/90 via-[#450a0a]/95 to-[#2a040b]/95 border border-amber-500/35 shadow-inner">
          {/* 狀態角標 */}
          <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 flex-wrap">
            <Badge
              className={cn(
                "text-[10px] sm:text-[11px] font-black px-2.5 py-0.5 rounded-full border shadow-sm font-mono flex items-center gap-1",
                isDone
                  ? "bg-slate-900/90 text-amber-200 border-amber-800"
                  : bag.revealLottery
                  ? "bg-rose-600 text-white border-yellow-300 animate-pulse"
                  : "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 border-0 font-black shadow-[0_0_12px_rgba(245,158,11,0.4)]"
              )}
            >
              {isDone ? (
                <span>已開獎</span>
              ) : bag.revealLottery ? (
                <>
                  <Flame className="w-3 h-3 fill-white" />
                  <span>開獎中</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3 fill-slate-950" />
                  <span>募集中</span>
                </>
              )}
            </Badge>

            {isNearFull && !isDone && (
              <Badge className="bg-gradient-to-r from-red-600 to-rose-600 text-yellow-200 border border-yellow-400/60 text-[10px] sm:text-[11px] font-black animate-pulse px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
                <Flame className="w-3 h-3 text-yellow-300" />
                <span>滿額衝刺 (剩 {remainingSlots} 格)</span>
              </Badge>
            )}
          </div>

          {/* 卡磚展台 (紅包袋金色視窗) */}
          <div
            className={cn(
              "relative w-36 sm:w-48 md:w-52 aspect-[2.5/3.6] shrink-0 rounded-2xl overflow-hidden border-2 border-amber-400/70 bg-gradient-to-b from-[#450a0a] to-black shadow-[0_12px_30px_rgba(0,0,0,0.9)] mt-6 sm:mt-0 transition-transform duration-500 group-hover:scale-105 mx-auto sm:mx-0 group/card",
              isDone && "opacity-60 grayscale-[30%]"
            )}
          >
            {bag.prizeCards?.first ? (
              <SafeImage
                src={mattedImageUrl || bag.prizeCards.first.imageUrl}
                alt={bag.prizeCards.first.name}
                fill
                className="object-contain p-0.5 transition-transform duration-500 group-hover:scale-105"
                priority={priority}
                sizes="(max-width: 640px) 180px, 240px"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-[#3f0713]/80">
                <div className="w-12 h-12 rounded-full border-2 border-amber-400/80 bg-amber-500/20 flex items-center justify-center mb-2 shadow-[0_0_15px_rgba(250,204,21,0.4)]">
                  <span className="font-serif font-black text-xl text-amber-300">福</span>
                </div>
                <span className="text-xs text-amber-200 font-bold">頂級頭獎</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent pointer-events-none" />
            <div className="absolute bottom-1.5 inset-x-1.5 text-center">
              <span className="text-[10px] font-bold text-amber-300 bg-black/90 px-2.5 py-0.5 rounded-md border border-amber-400/60 backdrop-blur-md shadow-md inline-flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-400" />
                頂級頭獎
              </span>
            </div>
          </div>

          {/* 福袋標題與資訊 */}
          <div className="w-full min-w-0 flex-1 flex flex-col justify-between text-center sm:text-left space-y-3 py-1">
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-1.5 text-amber-400 text-xs font-bold mb-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping" />
                <span>幸運紅包福袋</span>
              </div>
              <h3 className="text-base sm:text-xl font-black font-headline text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-snug drop-shadow-sm">
                {bag.name}
              </h3>
            </div>

            {/* 頭獎卡牌名稱 */}
            {bag.prizeCards?.first ? (
              <div className="w-full min-w-0 flex items-start sm:items-center gap-2.5 text-xs text-slate-200 bg-gradient-to-r from-amber-500/20 via-[#450a0a]/90 to-[#2a040b]/90 p-2.5 sm:p-3 rounded-xl border border-amber-400/40 shadow-inner text-left">
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.3)] mt-0.5 sm:mt-0">
                  <Trophy className="w-3.5 h-3.5 text-amber-300" />
                </div>
                <div className="min-w-0 flex-1">
                  <span className="text-[10px] font-black text-amber-400 tracking-wider block leading-none mb-1 flex items-center gap-1">
                    <Crown className="w-3 h-3 text-amber-400" />
                    頂級頭獎卡牌
                  </span>
                  <p className="text-xs sm:text-sm font-bold text-white group-hover:text-amber-200 transition-colors leading-snug break-words">
                    {bag.prizeCards.first.name}
                  </p>
                </div>
              </div>
            ) : null}

            {isDone && bag.winners?.first && (
              <div className="text-[11px] font-mono font-black text-amber-300 bg-amber-500/20 px-3 py-1 rounded-lg border border-amber-400/40 inline-flex items-center gap-1.5 w-fit mx-auto sm:mx-0 shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>頭獎幸運兒：#{bag.winners.first} 號位</span>
              </div>
            )}
          </div>
        </div>

        {/* 右側：參與進度與控制面板 */}
        <div className="w-full lg:flex-1 flex flex-col justify-start lg:justify-between p-2 sm:p-5 text-white mt-3 lg:mt-0 gap-3.5 sm:gap-5">
          <div className="space-y-3.5 sm:space-y-4">
            <div className="flex justify-between items-end border-b border-amber-500/20 pb-3 sm:pb-4">
              <div className="space-y-0.5 sm:space-y-1">
                <p className="text-[11px] font-bold text-amber-200/80">每格金額</p>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <p className="text-2xl sm:text-4xl font-black text-amber-300 font-headline tracking-tight drop-shadow-[0_0_10px_rgba(250,204,21,0.4)]">
                    {(bag.price || 0).toLocaleString()}
                  </p>
                  {currency === 'diamond' ? (
                    <Gem className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                  ) : (
                    <PPlusIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                  )}
                </div>
              </div>
              <div className="text-right space-y-0.5 sm:space-y-1">
                <p className="text-[11px] font-bold text-amber-200/80">認購名額</p>
                <p className="text-base sm:text-2xl font-black text-white font-headline">
                  <span className="text-amber-300">{bag.participantCount}</span>
                  <span className="text-amber-200/60 font-normal text-sm sm:text-base">
                    {' '}
                    / {bag.totalParticipants} 格
                  </span>
                </p>
              </div>
            </div>

            {/* 進度條 */}
            <div className="space-y-1.5 sm:space-y-2">
              <div className="flex justify-between items-center text-xs font-mono font-bold">
                <div className="flex items-center gap-1.5">
                  <span className="text-amber-200/80">募集進度</span>
                  <span className="text-[10px] text-amber-300/60 font-normal">
                    (剩 {remainingSlots} 格即開獎)
                  </span>
                </div>
                <span
                  className={cn(
                    "font-headline font-black text-sm",
                    isNearFull ? "text-yellow-300 animate-pulse" : "text-amber-300"
                  )}
                >
                  {progress}%
                </span>
              </div>
              <div className="w-full bg-[#2a040b] h-3 rounded-full overflow-hidden border border-amber-500/30 p-0.5 shadow-inner">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-1000 ease-out",
                    isDone
                      ? "bg-slate-700"
                      : isNearFull
                      ? "bg-gradient-to-r from-yellow-400 via-amber-400 to-rose-500 animate-pulse shadow-[0_0_12px_rgba(250,204,21,0.6)]"
                      : "bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                  )}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>

          <div className="pt-1 sm:pt-2 flex items-center justify-end">
            <div className="w-full flex items-center justify-center gap-2 font-black text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-5 sm:px-6 py-2.5 sm:py-3 rounded-xl shadow-[0_4px_20px_rgba(245,158,11,0.4)] group-hover:from-yellow-300 group-hover:to-amber-200 group-hover:shadow-[0_4px_25px_rgba(245,158,11,0.6)] group-hover:brightness-110 active:scale-[0.98] transition-all font-headline whitespace-nowrap border border-yellow-200">
              <span>{isDone ? '查看開獎結果' : '拆開紅包 · 立即選位'}</span>
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform shrink-0" />
            </div>
          </div>
        </div>
      </Link>
    );
  }

  // === 旋轉門專用直立「紅包袋」實體卡 (Revolving Door 3D Red Packet) ===
  return (
    <div
      onClick={onClick}
      className={cn(
        "relative w-full h-full rounded-[1.75rem] sm:rounded-[2rem] overflow-hidden flex flex-col justify-between select-none transition-all duration-300 cursor-pointer shadow-2xl",
        "bg-gradient-to-b from-[#991b1b] via-[#831843] to-[#2a040b]",
        isCenter
          ? "border-[2.5px] border-amber-300 shadow-[0_0_35px_rgba(245,158,11,0.6),inset_0_0_20px_rgba(250,204,21,0.2)]"
          : "border-2 border-amber-500/50 hover:border-amber-400/80 opacity-90 shadow-[0_15px_30px_rgba(0,0,0,0.8)]",
        className
      )}
    >
      {/* 1. 紅包袋完整翻折封蓋 (Complete Envelope Flap with Graceful Arc & Gold Trim) */}
      <div className="relative w-full shrink-0 z-20">
        {/* 頂部燙金滾邊橫線 */}
        <div className="absolute top-0 inset-x-0 h-[2.5px] bg-gradient-to-r from-amber-600 via-yellow-200 to-amber-600 z-30" />

        {/* 狀態角標 (左上方) */}
        <div className="absolute top-2.5 left-2.5 z-30">
          <Badge
            className={cn(
              "text-[9px] sm:text-[10px] font-black px-2 py-0.5 rounded-full border shadow font-mono flex items-center gap-1 leading-none",
              isDone
                ? "bg-slate-900/90 text-amber-200 border-amber-800"
                : bag.revealLottery
                ? "bg-rose-600 text-white border-yellow-300 animate-pulse"
                : "bg-amber-400 text-slate-950 border-yellow-200 font-black shadow-sm"
            )}
          >
            {isDone ? '已開獎' : bag.revealLottery ? '開獎中' : '募集中'}
          </Badge>
        </div>

        {/* 剩餘格數徽章 (右上方) */}
        <div className="absolute top-2.5 right-2.5 z-30">
          <div className="text-[9px] sm:text-[10px] font-mono font-black text-yellow-300 bg-black/60 px-2 py-0.5 rounded-full border border-amber-400/50 shadow-sm backdrop-blur-sm">
            剩 {remainingSlots} 格
          </div>
        </div>

        {/* 紅包袋封口完整倒三角弧形燙金折蓋 (Graceful Envelope Flap SVG) */}
        <div className="relative w-full h-[58px] sm:h-[66px]">
          <svg
            className="w-full h-full drop-shadow-[0_4px_10px_rgba(0,0,0,0.6)]"
            viewBox="0 0 300 72"
            preserveAspectRatio="none"
          >
            <defs>
              <linearGradient id="flapRedGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#dc2626" />
                <stop offset="45%" stopColor="#b91c1c" />
                <stop offset="100%" stopColor="#881337" />
              </linearGradient>
              <linearGradient id="goldFlapLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#d97706" />
                <stop offset="25%" stopColor="#fef08a" />
                <stop offset="50%" stopColor="#facc15" />
                <stop offset="75%" stopColor="#fef08a" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>
              {/* 底紋微粒圖樣 */}
              <pattern id="goldDots" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse">
                <circle cx="8" cy="8" r="0.8" fill="#fde047" opacity="0.3" />
              </pattern>
            </defs>

            {/* 倒三角弧形折蓋面 */}
            <path
              d="M 0,0 L 300,0 L 300,34 Q 235,38 185,54 Q 150,68 150,68 Q 150,68 115,54 Q 65,38 0,34 Z"
              fill="url(#flapRedGrad)"
            />

            {/* 燙金折蓋底紋 */}
            <path
              d="M 0,0 L 300,0 L 300,34 Q 235,38 185,54 Q 150,68 150,68 Q 150,68 115,54 Q 65,38 0,34 Z"
              fill="url(#goldDots)"
            />

            {/* 燙金滾邊主弧線 */}
            <path
              d="M 0,34 Q 65,38 115,54 Q 150,68 150,68 Q 150,68 185,54 Q 235,38 300,34"
              fill="none"
              stroke="url(#goldFlapLine)"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* 內層裝飾金邊虛線 */}
            <path
              d="M 10,29 Q 70,33 118,48 Q 150,61 150,61 Q 150,61 182,48 Q 230,33 290,29"
              fill="none"
              stroke="rgba(253, 224, 71, 0.45)"
              strokeWidth="1"
              strokeDasharray="3 3"
            />

            {/* 左右側吉祥燙金祥雲紋飾 */}
            <path
              d="M 24,18 Q 30,12 36,18 Q 42,24 36,30 Q 30,30 28,26"
              fill="none"
              stroke="rgba(253, 224, 71, 0.35)"
              strokeWidth="1"
            />
            <path
              d="M 276,18 Q 270,12 264,18 Q 258,24 264,30 Q 270,30 272,26"
              fill="none"
              stroke="rgba(253, 224, 71, 0.35)"
              strokeWidth="1"
            />
          </svg>

          {/* 中央完整的燙金立體封蠟金印 (Golden Wax Seal) - 緊扣弧形尖端 */}
          <div className="absolute -bottom-3.5 sm:-bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center justify-center">
            <div className="relative w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-tr from-amber-500 via-yellow-200 to-amber-400 p-[2px] shadow-[0_4px_14px_rgba(0,0,0,0.7),0_0_15px_rgba(245,158,11,0.5)]">
              <div className="w-full h-full rounded-full bg-gradient-to-b from-[#b91c1c] via-[#881337] to-[#450a0a] flex items-center justify-center border border-amber-300/80">
                <span className="font-serif font-black text-amber-200 text-sm sm:text-base drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] leading-none select-none">
                  福
                </span>
              </div>
              {/* 金印外圍金色流光光環 */}
              <div className="absolute -inset-0.5 rounded-full border border-yellow-200/40 animate-pulse pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* 2. 紅包袋袋身主體 (Envelope Body & Card Showcase) */}
      <div className="relative flex-1 flex flex-col items-center justify-between px-3 pt-5 pb-3 sm:px-4 sm:pt-6 sm:pb-3.5 z-10 min-h-0">
        
        {/* 背景祥雲/暗紋與環境漫射 */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_35%,rgba(250,204,21,0.12),transparent_70%)] pointer-events-none" />
        
        {/* 紅包袋名稱 */}
        <div className="w-full text-center shrink-0 pt-0.5">
          <h3 className="font-headline font-black text-sm sm:text-base text-amber-200 line-clamp-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] px-1">
            {bag.name}
          </h3>
        </div>

        {/* 頂級頭獎卡牌展示 (大幅放大展示、無任何外黑框、自動去背去除黑底，自然懸浮於紅包袋上) */}
        <div className="relative w-full flex-1 min-h-[195px] sm:min-h-[240px] my-1 flex items-center justify-center group/preview px-1 sm:px-2">
          {/* 與紅包背景融為一體的柔和金色環境光暈 */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(245,158,11,0.28),transparent_72%)] pointer-events-none" />
          
          {bag.prizeCards?.first ? (
            <div className="relative w-full h-full max-h-[270px] sm:max-h-[310px] flex items-center justify-center">
              <SafeImage
                src={mattedImageUrl || bag.prizeCards.first.imageUrl}
                alt=""
                fill
                className="object-contain drop-shadow-[0_14px_30px_rgba(0,0,0,0.85)] filter transition-transform duration-300 group-hover/preview:scale-105"
                sizes="(max-width: 640px) 280px, 340px"
                priority={priority}
              />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center">
              <div className="w-12 h-12 rounded-full border border-amber-400/60 bg-amber-500/20 flex items-center justify-center mb-1.5 shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                <Crown className="w-6 h-6 text-amber-300" />
              </div>
              <span className="text-xs text-amber-200 font-bold">頂級頭獎</span>
            </div>
          )}
        </div>

        {/* 3. 底部價格、進度與按鈕 (固定高度並保證完全顯示，絕不被裁切) */}
        <div className="w-full space-y-1.5 sm:space-y-2 mt-1.5 shrink-0">
          {/* 金額展示 */}
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1">
              <span className="text-[10px] sm:text-[11px] text-amber-200/90 font-bold">單格</span>
              <span className="text-base sm:text-xl font-black text-amber-300 font-headline leading-none">
                {(bag.price || 0).toLocaleString()}
              </span>
              {currency === 'diamond' ? (
                <Gem className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-cyan-400" />
              ) : (
                <PPlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-400" />
              )}
            </div>
            <div className="text-[10px] sm:text-[11px] font-mono font-bold text-yellow-300">
              {progress}%
            </div>
          </div>

          {/* 紅金進度條 */}
          <div className="w-full bg-[#2a040b] h-1.5 sm:h-2 rounded-full overflow-hidden border border-amber-400/40 p-0.2">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-700",
                isDone
                  ? "bg-slate-600"
                  : isNearFull
                  ? "bg-gradient-to-r from-yellow-400 via-amber-400 to-rose-500 animate-pulse"
                  : "bg-gradient-to-r from-amber-500 to-yellow-300"
              )}
              style={{ width: `${progress}%` }}
            />
          </div>

          {/* 拆開紅包按鈕 (實體黃金質感 CTA，100% 完整展示) */}
          <div
            className={cn(
              "w-full py-2 sm:py-2.5 px-2 rounded-xl font-headline font-black text-xs sm:text-[13px] text-center flex items-center justify-center gap-1.5 shadow-lg transition-all shrink-0",
              isCenter
                ? "bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 text-slate-950 border border-yellow-200 shadow-[0_2px_15px_rgba(245,158,11,0.5)] hover:scale-[1.02] active:scale-[0.98]"
                : "bg-amber-500/25 text-amber-200 border border-amber-400/40"
            )}
          >
            <span>{isDone ? '開獎結果' : isCenter ? '拆開紅包 · 進入選位' : '點擊檢視'}</span>
            <ArrowRight className="w-3.5 h-3.5 shrink-0" />
          </div>
        </div>
      </div>
    </div>
  );
}
