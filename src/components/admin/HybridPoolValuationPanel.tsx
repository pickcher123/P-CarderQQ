'use client';

import React, { useState, useMemo } from 'react';
import {
  HYBRID_68_PRESET,
  HYBRID_TIER_META,
  suggestNicePrice,
  suggestNicePulls,
  autoBalancePool,
  type HybridPoolValuationResult,
} from '@/lib/hybrid-pool-preset';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import {
  Calculator,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  TrendingUp,
  Wand2,
  Lock,
} from 'lucide-react';

interface HybridPoolValuationPanelProps {
  valuation: HybridPoolValuationResult;
  pricePerPull: number;
  totalPulls: number;
  heroPullQty: number;
  heroTotalCost: number;
  cCost: number;
  dCost: number;
  forceConfirmRedHealth: boolean;
  onForceConfirmChange: (checked: boolean) => void;
  onApply68Preset: () => void;
  onAutoBalanceApply: (params: {
    pricePerPull: number;
    totalPulls: number;
    cCost: number;
    dCost: number;
    qtyC: number;
    qtyD: number;
  }) => void;
}

export function HybridPoolValuationPanel({
  valuation,
  pricePerPull,
  totalPulls,
  heroPullQty,
  heroTotalCost,
  cCost: initialCCost,
  dCost: initialDCost,
  forceConfirmRedHealth,
  onForceConfirmChange,
  onApply68Preset,
  onAutoBalanceApply,
}: HybridPoolValuationPanelProps) {
  const [lockMode, setLockMode] = useState<'lock_pulls' | 'lock_price'>('lock_pulls');
  const [targetPayoutPct, setTargetPayoutPct] = useState<number>(68.0);
  const [draftCCost, setDraftCCost] = useState<number>(initialCCost || 1800);
  const [draftDCost, setDraftDCost] = useState<number>(initialDCost || 450);
  const [draftPulls, setDraftPulls] = useState<number>(totalPulls || 100);
  const [draftPrice, setDraftPrice] = useState<number>(pricePerPull || 2099);

  const autoBalanceInput = useMemo(
    () => ({
      heroPullQty,
      heroTotalCost,
      cCost: Math.max(1, draftCCost),
      dCost: Math.max(1, draftDCost),
      targetPayoutRatio: Math.max(0.1, Math.min(0.95, targetPayoutPct / 100)),
      defaultCRatio: 0.13,
    }),
    [heroPullQty, heroTotalCost, draftCCost, draftDCost, targetPayoutPct]
  );

  const previewBalance = useMemo(() => {
    const activePrice = lockMode === 'lock_pulls' ? draftPrice : draftPrice;
    const activePulls = lockMode === 'lock_pulls' ? draftPulls : draftPulls;
    return autoBalancePool(autoBalanceInput, activePrice, activePulls);
  }, [autoBalanceInput, lockMode, draftPrice, draftPulls]);

  const handleSuggestByLockMode = () => {
    if (lockMode === 'lock_pulls') {
      const nicePrice = suggestNicePrice(autoBalanceInput, draftPulls);
      setDraftPrice(nicePrice);
    } else {
      const nicePulls = suggestNicePulls(autoBalanceInput, draftPrice);
      setDraftPulls(nicePulls);
    }
  };

  const handleOneClickAutoBalance = () => {
    const res = autoBalancePool(autoBalanceInput, draftPrice, draftPulls);
    onAutoBalanceApply({
      pricePerPull: res.pricePerPull,
      totalPulls: res.totalPulls,
      cCost: Math.max(1, draftCCost),
      dCost: Math.max(1, draftDCost),
      qtyC: res.qtyC,
      qtyD: res.qtyD,
    });
  };

  const healthBadge =
    valuation.healthStatus === 'green'
      ? {
          icon: CheckCircle2,
          label: '🟢 綠燈（正常）',
          boxClass: 'bg-emerald-500/10 border-emerald-400/40 text-emerald-200',
        }
      : valuation.healthStatus === 'yellow'
        ? {
            icon: AlertTriangle,
            label: '🟡 黃燈（微幅偏差）',
            boxClass: 'bg-amber-400/10 border-amber-300/45 text-amber-200',
          }
        : {
            icon: ShieldAlert,
            label: '🔴 紅燈（嚴重警示）',
            boxClass: 'bg-rose-500/15 border-rose-400/50 text-rose-200',
          };

  const HealthIcon = healthBadge.icon;

  return (
    <div className="rounded-2xl bg-[#0a0f1c] border border-white/[0.1] border-t-2 border-t-amber-300/65 p-5 shadow-[0_24px_64px_rgba(0,0,0,0.65)] text-slate-100 space-y-5">
      {/* 標題與一鍵套用範本 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-[3px] h-8 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700" />
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#FDE68A]" />
              大獎驅動自動配平引擎 & 即時財務儀表板
            </h3>
            <p className="text-xs text-slate-400">
              基準：{HYBRID_68_PRESET.preset_name}（目標還元率 68.0% / 毛利率 32.0%）
            </p>
          </div>
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => {
            setDraftPrice(HYBRID_68_PRESET.price_per_pull);
            setDraftPulls(HYBRID_68_PRESET.total_pulls);
            setDraftCCost(1800);
            setDraftDCost(450);
            setTargetPayoutPct(68.0);
            onApply68Preset();
          }}
          className="h-9 rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black text-xs gap-1.5 shadow-md hover:brightness-105 shrink-0"
        >
          <Sparkles className="w-3.5 h-3.5" />
          套用 68% 黃金範本
        </Button>
      </div>

      {/* 3 步驟大獎驅動自動配平精靈 */}
      <div className="rounded-2xl bg-white/[0.03] border border-amber-300/30 p-4 space-y-4">
        {/* Step 1 摘要 */}
        <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-white/[0.08]">
          <div className="flex items-center gap-2 text-xs">
            <Badge className="bg-amber-400/20 text-[#FDE68A] border-amber-300/40 font-black">Step 1</Badge>
            <span className="font-bold text-white">已上傳核心大獎（A + SP + B + 最後賞）</span>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono tabular-nums">
            <span className="text-slate-300">
              佔用抽數 <strong className="text-[#FDE68A]">{heroPullQty}</strong> 抽
            </span>
            <span className="text-slate-300">
              大獎總成本 <strong className="text-[#FDE68A]">NT${heroTotalCost.toLocaleString()}</strong>
            </span>
          </div>
        </div>

        {/* Step 2 二選一鎖定與反推 */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs">
              <Badge className="bg-amber-400/20 text-[#FDE68A] border-amber-300/40 font-black">Step 2</Badge>
              <span className="font-bold text-white">選擇鎖定目標並反推漂亮尾數</span>
            </div>
            <div className="inline-flex rounded-xl bg-black/50 p-1 border border-white/[0.08]">
              <button
                type="button"
                onClick={() => setLockMode('lock_pulls')}
                className={cn(
                  'px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1',
                  lockMode === 'lock_pulls'
                    ? 'bg-gradient-to-r from-[#FDE68A] to-amber-400 text-[#120d02]'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <Lock className="w-3 h-3" />
                模式 A：鎖定總抽數
              </button>
              <button
                type="button"
                onClick={() => setLockMode('lock_price')}
                className={cn(
                  'px-3 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1',
                  lockMode === 'lock_price'
                    ? 'bg-gradient-to-r from-[#FDE68A] to-amber-400 text-[#120d02]'
                    : 'text-slate-400 hover:text-white'
                )}
              >
                <Lock className="w-3 h-3" />
                模式 B：鎖定單抽價
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400">目標還元率 (%)</Label>
              <Input
                type="number"
                step="0.5"
                value={targetPayoutPct}
                onChange={(e) => setTargetPayoutPct(Number(e.target.value || 68))}
                className="h-9 bg-black/50 border-white/15 text-white font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400">C 賞銅盒單價</Label>
              <Input
                type="number"
                value={draftCCost}
                onChange={(e) => setDraftCCost(Math.max(1, Number(e.target.value || 0)))}
                className="h-9 bg-black/50 border-white/15 text-white font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400">D 賞白盒單價</Label>
              <Input
                type="number"
                value={draftDCost}
                onChange={(e) => setDraftDCost(Math.max(1, Number(e.target.value || 0)))}
                className="h-9 bg-black/50 border-white/15 text-white font-mono text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400">
                總抽數 {lockMode === 'lock_pulls' && '(已鎖定)'}
              </Label>
              <Input
                type="number"
                value={draftPulls}
                onChange={(e) => setDraftPulls(Math.max(heroPullQty + 1, Number(e.target.value || 100)))}
                className={cn(
                  'h-9 bg-black/50 text-white font-mono text-xs',
                  lockMode === 'lock_pulls' ? 'border-amber-300/60' : 'border-white/15'
                )}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[11px] text-slate-400">
                單抽價 NT$ {lockMode === 'lock_price' && '(已鎖定)'}
              </Label>
              <Input
                type="number"
                value={draftPrice}
                onChange={(e) => setDraftPrice(Math.max(1, Number(e.target.value || 2099)))}
                className={cn(
                  'h-9 bg-black/50 text-white font-mono text-xs',
                  lockMode === 'lock_price' ? 'border-amber-300/60' : 'border-white/15'
                )}
              />
            </div>
          </div>

          {/* Step 3 一鍵自動配平 */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <div className="text-xs text-slate-300 font-mono tabular-nums">
              試算結果：C 賞銅盒 <strong className="text-amber-300">{previewBalance.qtyC} 抽</strong> ＋ D 賞白盒{' '}
              <strong className="text-white">{previewBalance.qtyD} 抽</strong> → 還元率{' '}
              <strong className="text-emerald-400">{previewBalance.actualPayoutPct}%</strong>（毛利 NT$
              {previewBalance.actualGrossProfit.toLocaleString()}）
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleSuggestByLockMode}
                className="h-9 rounded-xl border-amber-300/45 bg-amber-400/10 text-[#FDE68A] hover:bg-amber-400/20 font-bold text-xs"
              >
                {lockMode === 'lock_pulls' ? '反推 99 結尾單抽價' : '反推 10 倍數總抽數'}
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleOneClickAutoBalance}
                className="h-9 rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black text-xs gap-1.5"
              >
                <Wand2 className="w-3.5 h-3.5" />
                一鍵自動配平 C/D 賞
              </Button>
            </div>
          </div>

          {previewBalance.warning && (
            <div className="rounded-xl bg-rose-500/15 border border-rose-400/45 px-3 py-2 text-xs text-rose-200 font-bold">
              ⚠️ {previewBalance.warning}
            </div>
          )}
        </div>
      </div>

      {/* 紅綠燈總覽橫幅 */}
      <div className={cn('rounded-xl border p-3.5 flex flex-col gap-2.5', healthBadge.boxClass)}>
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 font-black text-sm">
            <HealthIcon className="w-4 h-4 shrink-0" />
            <span>{healthBadge.label}</span>
          </div>
          <span className="text-xs font-mono tabular-nums opacity-90">
            偏差 {valuation.payoutVariancePp >= 0 ? '+' : ''}
            {valuation.payoutVariancePp.toFixed(1)} pp（
            {valuation.cogsVarianceNtd >= 0 ? '+' : ''}
            NT${valuation.cogsVarianceNtd.toLocaleString()}）
          </span>
        </div>
        <p className="text-xs leading-relaxed opacity-95">{valuation.healthMessage}</p>

        {valuation.requiresForceConfirm && (
          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            <Checkbox
              id="force-confirm-red-health"
              checked={forceConfirmRedHealth}
              onCheckedChange={(v) => onForceConfirmChange(Boolean(v))}
              className="border-rose-300 data-[state=checked]:bg-rose-500"
            />
            <Label
              htmlFor="force-confirm-red-health"
              className="text-xs font-bold text-rose-200 cursor-pointer"
            >
              我已知悉風險並強制上架：允許此紅燈卡池發布
            </Label>
          </div>
        )}
      </div>

      {/* 核心財務指標卡 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
          <div className="text-[11px] text-slate-400">滿池總營收</div>
          <div className="text-sm font-black text-white font-mono tabular-nums mt-0.5">
            NT${valuation.totalRevenue.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
          <div className="text-[11px] text-slate-400">實際總成本 COGS</div>
          <div className="text-sm font-black text-[#FDE68A] font-mono tabular-nums mt-0.5">
            NT${valuation.actualCogs.toLocaleString()}
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
          <div className="text-[11px] text-slate-400">實際還元率</div>
          <div className="text-sm font-black text-white font-mono tabular-nums mt-0.5">
            {valuation.actualPayoutPct.toFixed(1)}%
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
          <div className="text-[11px] text-slate-400">預估毛利（毛利率）</div>
          <div className="text-sm font-black text-emerald-400 font-mono tabular-nums mt-0.5">
            NT${valuation.actualGrossProfit.toLocaleString()} ({valuation.actualGrossMarginPct.toFixed(1)}%)
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
          <div className="text-[11px] text-slate-400">損益兩平抽數</div>
          <div className="text-sm font-black text-cyan-300 font-mono tabular-nums mt-0.5">
            {valuation.breakevenPulls} / {totalPulls} 抽
          </div>
        </div>
        <div className="rounded-xl bg-white/[0.03] border border-white/[0.08] p-3">
          <div className="text-[11px] text-slate-400 flex items-center gap-1">
            <TrendingUp className="w-3 h-3 text-amber-300" />
            尾盤 13 抽防死池
          </div>
          <div
            className={cn(
              'text-sm font-black font-mono tabular-nums mt-0.5',
              valuation.snipe13RoiPct >= 0 ? 'text-emerald-400' : 'text-rose-400'
            )}
          >
            {valuation.snipe13RoiPct >= 0 ? '+' : ''}
            {valuation.snipe13RoiPct.toFixed(1)}% {valuation.snipe13RoiPct >= 0 ? '🟢' : '⚠️'}
          </div>
        </div>
      </div>

      {/* 抽數總和防呆提示 */}
      <div
        className={cn(
          'rounded-xl border px-3.5 py-2.5 flex items-center justify-between text-xs',
          valuation.totalPullsMatch
            ? 'bg-emerald-500/10 border-emerald-400/35 text-emerald-300'
            : 'bg-rose-500/15 border-rose-400/45 text-rose-200'
        )}
      >
        <span className="font-bold">
          {valuation.totalPullsMatch
            ? `✅ 抽數總和檢核通過：目前所有可抽獎項合計 ${valuation.pullItemsTotalQty} 抽，等於總抽數 ${totalPulls} 抽`
            : `⚠️ 抽數總和不符：目前可抽獎項合計 ${valuation.pullItemsTotalQty} 抽，與設定總抽數 ${totalPulls} 抽相差 ${
                valuation.pullDiff > 0 ? `+${valuation.pullDiff}` : valuation.pullDiff
              } 抽（發布上架已鎖定）`}
        </span>
        <span className="font-mono tabular-nums">單抽 NT${pricePerPull.toLocaleString()}</span>
      </div>

      {/* 分級偏差檢核明細表 */}
      <div className="overflow-x-auto rounded-xl border border-white/[0.08] bg-black/40">
        <table className="w-full text-xs text-left">
          <thead className="border-b border-white/[0.08] text-slate-400">
            <tr>
              <th className="py-2.5 px-3 font-bold">獎項分級</th>
              <th className="py-2.5 px-3 font-bold text-right">數量 / 基準</th>
              <th className="py-2.5 px-3 font-bold text-right">動態建議單價</th>
              <th className="py-2.5 px-3 font-bold text-right">實際平均單價</th>
              <th className="py-2.5 px-3 font-bold text-right">小計成本</th>
              <th className="py-2.5 px-3 font-bold text-right">偏差檢核</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.06]">
            {valuation.tiers.map((tier) => {
              const meta = HYBRID_TIER_META[tier.code];
              const devText =
                tier.qty === 0
                  ? '尚未配置'
                  : `${tier.deviationPct >= 0 ? '+' : ''}${tier.deviationPct.toFixed(1)}%`;

              return (
                <tr key={tier.code} className="hover:bg-white/[0.03]">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      <Badge className={cn('text-[10px] font-black border', meta.badgeClass)}>
                        {meta.label}
                      </Badge>
                      {!tier.isPull && <span className="text-[10px] text-slate-400">(贈品)</span>}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums">
                    <span className="font-bold text-white">{tier.qty}</span>
                    <span className="text-slate-500"> / {tier.targetQty}</span>
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">
                    NT${tier.targetUnitCost.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-white font-bold">
                    {tier.qty > 0 ? `NT$${Math.round(tier.avgCost).toLocaleString()}` : '-'}
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-[#FDE68A]">
                    NT${tier.subtotal.toLocaleString()}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {tier.status === 'empty' ? (
                      <span className="text-slate-500">未配置</span>
                    ) : tier.status === 'green' ? (
                      <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-400/35 font-mono tabular-nums">
                        🟢 {devText}
                      </Badge>
                    ) : tier.status === 'yellow' ? (
                      <Badge className="bg-amber-400/15 text-amber-200 border-amber-300/45 font-mono tabular-nums">
                        🟡 {devText}
                      </Badge>
                    ) : (
                      <Badge className="bg-rose-500/20 text-rose-300 border-rose-400/50 font-mono tabular-nums">
                        🔴 {devText}
                      </Badge>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
