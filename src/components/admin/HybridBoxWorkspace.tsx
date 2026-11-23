'use client';

import React, { useState } from 'react';
import { BlindBoxVisual } from '@/components/draw/BlindBoxVisual';
import {
  HYBRID_68_PRESET,
  HYBRID_TIER_META,
  type HybridPoolValuationResult,
} from '@/lib/hybrid-pool-preset';
import type { HybridTierCode } from '@/types/draw';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { SafeImage } from '@/components/safe-image';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { PlusCircle, Trash2, Crown, Gift, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface HybridBoxCardItem {
  id: string;
  name: string;
  imageUrl: string;
  sellPrice?: number;
  quantity: number;
  tierCode: HybridTierCode;
  unitCost: number;
  certNumber: string;
  buybackPoints?: number;
}

interface HybridBoxWorkspaceProps {
  valuation: HybridPoolValuationResult;
  cardsInPool: HybridBoxCardItem[];
  pointPrizes: Array<{
    prizeId: string;
    name?: string;
    points: number;
    unitCost?: number;
    quantity: number;
    tierCode?: 'C' | 'D';
    rarity?: string;
  }>;
  lastPrizeCard?: { id: string; name: string; imageUrl: string; sellPrice?: number } | null;
  lastPrizeCost: number;
  onOpenAddCardToBox: (tier: 'A' | 'SP' | 'B' | 'C' | 'D') => void;
  onOpenSelectLastPrize: () => void;
  onRemoveLastPrize: () => void;
  onLastPrizeCostChange: (cost: number) => void;
  onCardTierChange: (cardId: string, tier: HybridTierCode) => void;
  onCardCostChange: (cardId: string, cost: number) => void;
  onCardCertChange: (cardId: string, certNumber: string) => void;
  onRemoveCard: (cardId: string) => void;
  onUpdateStandardBoxPrize: (tier: 'C' | 'D', quantity: number, unitCost: number) => void;
  onQuickAddRandomPlayerToD?: (qty: number) => void;
}

const BOX_ORDER: Array<'A' | 'SP' | 'B' | 'C' | 'D'> = ['A', 'SP', 'B', 'C', 'D'];

export function HybridBoxWorkspace({
  valuation,
  cardsInPool,
  pointPrizes,
  lastPrizeCard,
  lastPrizeCost,
  onOpenAddCardToBox,
  onOpenSelectLastPrize,
  onRemoveLastPrize,
  onLastPrizeCostChange,
  onCardTierChange,
  onCardCostChange,
  onCardCertChange,
  onRemoveCard,
  onUpdateStandardBoxPrize,
  onQuickAddRandomPlayerToD,
}: HybridBoxWorkspaceProps) {
  const [randomAddQty, setRandomAddQty] = useState<number>(10);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-[3px] h-7 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700" />
          <div>
            <h3 className="text-lg font-black text-slate-900">五色卡包獎項與成本配置</h3>
            <p className="text-xs text-slate-500">
              直接將卡片加入指定顏色的卡包，系統會即時連動計算該卡包單價、小計與整池還元率
            </p>
          </div>
        </div>
      </div>

      {/* 五色盒子配置清單 */}
      <div className="grid grid-cols-1 gap-4">
        {BOX_ORDER.map((tierCode) => {
          const tierVal = valuation.tiers.find((t) => t.code === tierCode);
          const tierCfg = HYBRID_68_PRESET.tiers.find((t) => t.code === tierCode)!;
          const meta = HYBRID_TIER_META[tierCode];
          const boxCards = cardsInPool.filter((c) => c.tierCode === tierCode);
          const isStandardBox = tierCode === 'C' || tierCode === 'D';
          const standardPrize = isStandardBox
            ? pointPrizes.find(
                (p) =>
                  p.tierCode === tierCode ||
                  (tierCode === 'C' ? p.prizeId === 'hybrid_c_box' : p.prizeId === 'hybrid_d_box')
              )
            : undefined;

          const statusBadge =
            !tierVal || tierVal.status === 'empty'
              ? { text: '尚未配置', cls: 'bg-slate-100 text-slate-500 border-slate-200' }
              : tierVal.status === 'green'
                ? {
                    text: `🟢 偏差 ${tierVal.deviationPct >= 0 ? '+' : ''}${tierVal.deviationPct.toFixed(1)}%`,
                    cls: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                  }
                : tierVal.status === 'yellow'
                  ? {
                      text: `🟡 偏差 ${tierVal.deviationPct >= 0 ? '+' : ''}${tierVal.deviationPct.toFixed(1)}%`,
                      cls: 'bg-amber-50 text-amber-700 border-amber-200',
                    }
                  : {
                      text: `🔴 偏差 ${tierVal.deviationPct >= 0 ? '+' : ''}${tierVal.deviationPct.toFixed(1)}%`,
                      cls: 'bg-rose-50 text-rose-700 border-rose-200',
                    };

          return (
            <div
              key={tierCode}
              className={cn(
                'rounded-2xl border bg-white shadow-sm overflow-hidden transition-all',
                tierCode === 'SP'
                  ? 'border-amber-300/80 ring-1 ring-amber-300/30'
                  : 'border-slate-200'
              )}
            >
              {/* 盒子標頭列 */}
              <div
                className={cn(
                  'px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b',
                  tierCode === 'SP'
                    ? 'bg-[#0a0f1c] text-white border-amber-300/30'
                    : 'bg-slate-50/80 text-slate-900 border-slate-100'
                )}
              >
                <div className="flex items-center gap-3">
                  <BlindBoxVisual tier={tierCode} size="sm" className="shrink-0" />
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        className={cn(
                          'text-xs font-black border',
                          tierCode === 'D'
                            ? 'bg-slate-200 text-slate-900 border-slate-300'
                            : meta.badgeClass
                        )}
                      >
                        {tierCfg.name}
                      </Badge>
                      <Badge variant="outline" className={cn('text-[11px] font-mono tabular-nums', statusBadge.cls)}>
                        {statusBadge.text}
                      </Badge>
                    </div>
                    <div
                      className={cn(
                        'flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mt-1.5 font-mono tabular-nums',
                        tierCode === 'SP' ? 'text-slate-300' : 'text-slate-600'
                      )}
                    >
                      <span>
                        抽數：<strong className={tierCode === 'SP' ? 'text-[#FDE68A]' : 'text-slate-900'}>{tierVal?.qty ?? 0}</strong> / {tierCfg.target_qty} 抽
                      </span>
                      <span>
                        動態建議單價：<strong>NT${(tierVal?.targetUnitCost ?? tierCfg.target_unit_cost).toLocaleString()}</strong>
                      </span>
                      <span>
                        目前均價：<strong>{(tierVal?.qty ?? 0) > 0 ? `NT$${Math.round(tierVal?.avgCost ?? 0).toLocaleString()}` : '-'}</strong>
                      </span>
                      <span>
                        卡包小計：<strong className="text-amber-600">NT${(tierVal?.subtotal ?? 0).toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {tierCode === 'D' && onQuickAddRandomPlayerToD && (
                    <div className="flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 p-1 shadow-sm">
                      <Input
                        type="number"
                        min={1}
                        value={randomAddQty}
                        onChange={(e) => setRandomAddQty(Math.max(1, Number(e.target.value || 1)))}
                        className="h-7 w-14 text-xs font-mono font-bold text-center bg-white border-amber-200"
                        title="一次加入張數"
                      />
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onQuickAddRandomPlayerToD(Math.max(1, randomAddQty))}
                        className="h-7 px-2.5 rounded-lg hover:bg-amber-100 text-amber-900 font-black text-xs gap-1"
                      >
                        <PlusCircle className="w-3.5 h-3.5 text-amber-600" />
                        加入隨機球員 普/特 卡 (50💎)
                      </Button>
                    </div>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => onOpenAddCardToBox(tierCode)}
                    className={cn(
                      'h-9 px-3.5 rounded-xl font-black text-xs gap-1.5 shrink-0',
                      tierCode === 'SP'
                        ? 'bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02]'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    )}
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    加入卡片到{meta.boxName}
                  </Button>
                </div>
              </div>

              {/* 盒子內容區 */}
              <div className="p-4 space-y-3">
                {/* C 賞 / D 賞 標準化點數/回血盲盒設定列 */}
                {isStandardBox && (
                  <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        標準化{meta.boxName}數量與保底價值（免逐張拍照建檔）
                      </div>
                      <p className="text-[11px] text-slate-500">
                        此處設定的數量會直接計入總抽數與 COGS 成本計算，也可同時在下方額外加入實體卡。
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-600">抽數</span>
                        <Input
                          type="number"
                          min={0}
                          value={standardPrize?.quantity ?? 0}
                          onChange={(e) =>
                            onUpdateStandardBoxPrize(
                              tierCode,
                              Math.max(0, Number(e.target.value || 0)),
                              standardPrize?.unitCost ?? standardPrize?.points ?? tierCfg.target_unit_cost
                            )
                          }
                          className="h-8 w-20 text-xs font-mono text-center bg-white"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-600">單包成本/點數</span>
                        <Input
                          type="number"
                          min={0}
                          value={standardPrize?.unitCost ?? standardPrize?.points ?? tierCfg.target_unit_cost}
                          onChange={(e) =>
                            onUpdateStandardBoxPrize(
                              tierCode,
                              standardPrize?.quantity ?? 0,
                              Math.max(0, Number(e.target.value || 0))
                            )
                          }
                          className="h-8 w-24 text-xs font-mono text-right bg-white"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* D 賞 / C 賞已加入之標準化盲盒項目列（顯示張數並可直接刪減） */}
                {isStandardBox && standardPrize && standardPrize.quantity > 0 && (
                  <div className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-14 rounded-lg bg-[#0a0f1c] border border-amber-300/60 flex flex-col items-center justify-center shrink-0 text-[10px] font-black text-[#FDE68A]">
                        <span>P+</span>
                        <span className="text-[8px] text-slate-300">50💎</span>
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900">
                          {standardPrize.name || (tierCode === 'D' ? '隨機球員 普/特 卡' : 'C 賞回血盲盒')}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 font-mono tabular-nums">
                          <span>目前數量：<strong className="text-slate-900">{standardPrize.quantity} 張</strong></span>
                          <span>·</span>
                          <span>單張價值：{standardPrize.unitCost ?? standardPrize.points ?? 50} 💎</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onUpdateStandardBoxPrize(
                            tierCode,
                            Math.max(0, standardPrize.quantity - 1),
                            standardPrize.unitCost ?? standardPrize.points ?? tierCfg.target_unit_cost
                          )
                        }
                        className="h-8 px-2.5 rounded-lg font-mono font-black text-xs"
                      >
                        -1
                      </Button>
                      <Input
                        type="number"
                        min={0}
                        value={standardPrize.quantity}
                        onChange={(e) =>
                          onUpdateStandardBoxPrize(
                            tierCode,
                            Math.max(0, Number(e.target.value || 0)),
                            standardPrize.unitCost ?? standardPrize.points ?? tierCfg.target_unit_cost
                          )
                        }
                        className="h-8 w-16 text-xs font-mono text-center"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          onUpdateStandardBoxPrize(
                            tierCode,
                            standardPrize.quantity + 1,
                            standardPrize.unitCost ?? standardPrize.points ?? tierCfg.target_unit_cost
                          )
                        }
                        className="h-8 px-2.5 rounded-lg font-mono font-black text-xs"
                      >
                        +1
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() =>
                          onUpdateStandardBoxPrize(
                            tierCode,
                            0,
                            standardPrize.unitCost ?? standardPrize.points ?? tierCfg.target_unit_cost
                          )
                        }
                        title="全部移除"
                        className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* 該盒子內的實體卡片列表 */}
                {boxCards.length > 0 ? (
                  <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 overflow-hidden">
                    {boxCards.map((card) => (
                      <div
                        key={card.id}
                        className="p-3 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white hover:bg-slate-50/70"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative w-10 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0">
                            <SafeImage src={card.imageUrl} alt={card.name} fill className="object-cover" />
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-black text-slate-900 truncate">{card.name}</div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-mono">
                              <span>庫存：{card.quantity} 張</span>
                              {tierCode === 'SP' && (
                                <Badge className="bg-slate-900 text-[#FDE68A] border-amber-300/50 text-[10px]">
                                  80% 回收 {(card.buybackPoints ?? Math.round(card.unitCost * 0.8)).toLocaleString()} 點
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <Select
                            value={card.tierCode}
                            onValueChange={(val) => onCardTierChange(card.id, val as HybridTierCode)}
                          >
                            <SelectTrigger className="h-8 w-[120px] text-xs font-bold rounded-lg">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="A" className="text-xs font-bold">A 賞（金包）</SelectItem>
                              <SelectItem value="SP" className="text-xs font-bold">SP 賞（黑包）</SelectItem>
                              <SelectItem value="B" className="text-xs font-bold">B 賞（銀包）</SelectItem>
                              <SelectItem value="C" className="text-xs font-bold">C 賞（銅包）</SelectItem>
                              <SelectItem value="D" className="text-xs font-bold">D 賞（星光包）</SelectItem>
                            </SelectContent>
                          </Select>

                          <div className="flex items-center gap-1">
                            <span className="text-[11px] text-slate-500">成本</span>
                            <Input
                              type="number"
                              value={card.unitCost}
                              onChange={(e) => onCardCostChange(card.id, Number(e.target.value))}
                              className="h-8 w-24 text-xs font-mono text-right"
                            />
                          </div>

                          <Input
                            type="text"
                            placeholder="PSA/BGS 編號"
                            value={card.certNumber}
                            onChange={(e) => onCardCertChange(card.id, e.target.value)}
                            className="h-8 w-32 text-xs font-mono"
                          />

                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => onRemoveCard(card.id)}
                            className="h-8 w-8 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : !isStandardBox ? (
                  <div className="py-5 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
                    尚未加入任何卡片到此{meta.boxName}，點擊右上角「加入卡片到{meta.boxName}」即可配置。
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* 最後賞（Last One・明賞） */}
        <div className="rounded-2xl border border-amber-300/70 bg-gradient-to-r from-amber-50/60 via-white to-white p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <BlindBoxVisual tier="LAST" size="sm" className="shrink-0" />
            <div>
              <div className="flex items-center gap-2">
                <Badge className={HYBRID_TIER_META.LAST.badgeClass}>最後賞（Last One・明賞）</Badge>
                <span className="text-[11px] text-slate-500">不佔總抽數，買走最後一抽免費贈送（計入 COGS）</span>
              </div>
              {lastPrizeCard ? (
                <div className="flex items-center gap-2.5 mt-2">
                  <div className="relative w-8 h-11 rounded overflow-hidden border border-amber-300 shrink-0">
                    <SafeImage src={lastPrizeCard.imageUrl} alt={lastPrizeCard.name} fill className="object-cover" />
                  </div>
                  <span className="text-sm font-black text-slate-900">{lastPrizeCard.name}</span>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-1">尚未設定最後賞卡片</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-bold text-slate-600">成本 NT$</span>
              <Input
                type="number"
                value={lastPrizeCost}
                onChange={(e) => onLastPrizeCostChange(Math.max(0, Number(e.target.value || 0)))}
                className="h-9 w-28 text-xs font-mono text-right bg-white"
              />
            </div>
            <Button
              type="button"
              size="sm"
              onClick={onOpenSelectLastPrize}
              className="h-9 px-3.5 rounded-xl bg-slate-900 text-white font-black text-xs gap-1.5"
            >
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              {lastPrizeCard ? '更換最後賞' : '選擇最後賞'}
            </Button>
            {lastPrizeCard && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onRemoveLastPrize}
                className="h-9 w-9 text-slate-400 hover:text-rose-600"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
