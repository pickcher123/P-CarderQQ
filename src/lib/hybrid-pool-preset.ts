import type { HybridTierCode } from '@/types/draw';

export type HybridTierDisplayMode =
  | 'revealed_pool_blind_open'
  | 'hidden_blind_box'
  | 'standard_blind_box'
  | 'last_one_bonus';

export interface HybridTierConfig {
  code: HybridTierCode;
  name: string;
  shortLabel: string;
  boxName: string;
  mode: HybridTierDisplayMode;
  is_pull: boolean;
  target_qty: number;
  target_unit_cost: number;
  target_subtotal: number;
  cost_multiple_of_price: number;
  default_buyback_points?: number;
  tolerance_warn_pct: number;
  tolerance_danger_pct: number;
}

export const HYBRID_68_PRESET = {
  preset_name: '68% 高毛利穩健版',
  preset_id: 'high_margin_68',
  price_per_pull: 2099,
  total_pulls: 100,
  total_revenue: 209900,
  target_cogs: 142700,
  target_payout_ratio_pct: 68.0,
  target_gross_profit: 67200,
  target_gross_margin_pct: 32.0,
  target_breakeven_pulls: 68,
  sp_buyback_rate: 0.8,
  snipe_alert_threshold: 15,
  tiers: [
    {
      code: 'A' as HybridTierCode,
      name: 'A 賞（金包・明池盲開）',
      shortLabel: 'A 賞',
      boxName: '金包',
      mode: 'revealed_pool_blind_open' as HybridTierDisplayMode,
      is_pull: true,
      target_qty: 2,
      target_unit_cost: 18000,
      target_subtotal: 36000,
      cost_multiple_of_price: 8.58,
      tolerance_warn_pct: 10,
      tolerance_danger_pct: 20,
    },
    {
      code: 'SP' as HybridTierCode,
      name: 'SP 賞（黑包・隱藏卡包）',
      shortLabel: 'SP 賞',
      boxName: '黑包',
      mode: 'hidden_blind_box' as HybridTierDisplayMode,
      is_pull: true,
      target_qty: 1,
      target_unit_cost: 14000,
      target_subtotal: 14000,
      cost_multiple_of_price: 6.67,
      default_buyback_points: 11200,
      tolerance_warn_pct: 10,
      tolerance_danger_pct: 20,
    },
    {
      code: 'B' as HybridTierCode,
      name: 'B 賞（銀包・明池盲開）',
      shortLabel: 'B 賞',
      boxName: '銀包',
      mode: 'revealed_pool_blind_open' as HybridTierDisplayMode,
      is_pull: true,
      target_qty: 6,
      target_unit_cost: 4200,
      target_subtotal: 25200,
      cost_multiple_of_price: 2.0,
      tolerance_warn_pct: 10,
      tolerance_danger_pct: 20,
    },
    {
      code: 'C' as HybridTierCode,
      name: 'C 賞（銅包・回血卡包）',
      shortLabel: 'C 賞',
      boxName: '銅包',
      mode: 'standard_blind_box' as HybridTierDisplayMode,
      is_pull: true,
      target_qty: 13,
      target_unit_cost: 1800,
      target_subtotal: 23400,
      cost_multiple_of_price: 0.86,
      tolerance_warn_pct: 10,
      tolerance_danger_pct: 20,
    },
    {
      code: 'D' as HybridTierCode,
      name: 'D 賞（星光包・保底卡包）',
      shortLabel: 'D 賞',
      boxName: '星光包',
      mode: 'standard_blind_box' as HybridTierDisplayMode,
      is_pull: true,
      target_qty: 78,
      target_unit_cost: 450,
      target_subtotal: 35100,
      cost_multiple_of_price: 0.21,
      tolerance_warn_pct: 10,
      tolerance_danger_pct: 20,
    },
    {
      code: 'LAST' as HybridTierCode,
      name: '最後賞（Last One・明賞）',
      shortLabel: '最後賞',
      boxName: '王者冠包',
      mode: 'last_one_bonus' as HybridTierDisplayMode,
      is_pull: false,
      target_qty: 1,
      target_unit_cost: 9000,
      target_subtotal: 9000,
      cost_multiple_of_price: 4.29,
      tolerance_warn_pct: 10,
      tolerance_danger_pct: 20,
    },
  ] satisfies HybridTierConfig[],
  pool_health_thresholds: {
    payout_red_low_pct: 63.0,
    payout_yellow_low_pct: 66.0,
    payout_yellow_high_pct: 70.0,
    payout_red_high_pct: 73.0,
  },
} as const;

export const HYBRID_TIER_META: Record<
  HybridTierCode,
  {
    code: HybridTierCode;
    label: string;
    boxName: string;
    badgeClass: string;
    accentHex: string;
  }
> = {
  A: {
    code: 'A',
    label: 'A 賞・金包',
    boxName: '金包',
    badgeClass: 'bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border-amber-300/60',
    accentHex: '#FBBF24',
  },
  SP: {
    code: 'SP',
    label: 'SP 賞・黑包',
    boxName: '黑包',
    badgeClass: 'bg-[#0a0f1c] text-[#FDE68A] border-amber-300/65',
    accentHex: '#FDE68A',
  },
  B: {
    code: 'B',
    label: 'B 賞・銀包',
    boxName: '銀包',
    badgeClass: 'bg-slate-200/15 text-slate-100 border-slate-300/45',
    accentHex: '#CBD5E1',
  },
  C: {
    code: 'C',
    label: 'C 賞・銅包',
    boxName: '銅包',
    badgeClass: 'bg-amber-900/40 text-amber-200 border-amber-600/50',
    accentHex: '#D97706',
  },
  D: {
    code: 'D',
    label: 'D 賞・星光包',
    boxName: '星光包',
    badgeClass: 'bg-white/10 text-slate-200 border-white/25',
    accentHex: '#E2E8F0',
  },
  LAST: {
    code: 'LAST',
    label: '最後賞・明賞',
    boxName: '王者冠包',
    badgeClass: 'bg-gradient-to-r from-amber-400 to-rose-500 text-slate-950 border-amber-300/70',
    accentHex: '#F59E0B',
  },
};

export interface HybridValuationItemInput {
  tierCode: HybridTierCode;
  cost: number;
  qty: number;
}

export type TierHealthStatus = 'green' | 'yellow' | 'red' | 'empty';
export type PoolHealthLevel = 'green' | 'yellow_low' | 'yellow_high' | 'red_low' | 'red_high';

export interface TierValuationResult {
  code: HybridTierCode;
  name: string;
  isPull: boolean;
  qty: number;
  targetQty: number;
  subtotal: number;
  avgCost: number;
  targetUnitCost: number;
  deviationPct: number;
  status: TierHealthStatus;
}

export interface HybridPoolValuationResult {
  totalRevenue: number;
  actualCogs: number;
  actualPayoutPct: number;
  actualGrossProfit: number;
  actualGrossMarginPct: number;
  breakevenPulls: number;
  payoutVariancePp: number;
  cogsVarianceNtd: number;
  pullItemsTotalQty: number;
  totalPullsMatch: boolean;
  pullDiff: number;
  healthLevel: PoolHealthLevel;
  healthStatus: 'green' | 'yellow' | 'red';
  healthMessage: string;
  requiresForceConfirm: boolean;
  snipe13Cost: number;
  snipe13MinVal: number;
  snipe13RoiPct: number;
  tiers: TierValuationResult[];
}

export function calculateHybridPoolValuation(params: {
  pricePerPull: number;
  totalPulls: number;
  items: HybridValuationItemInput[];
}): HybridPoolValuationResult {
  const pricePerPull = Math.max(0, Number(params.pricePerPull || 0));
  const totalPulls = Math.max(0, Number(params.totalPulls || 0));
  const totalRevenue = pricePerPull * totalPulls;
  const actualCogs = params.items.reduce(
    (sum, item) => sum + Math.max(0, Number(item.cost || 0)) * Math.max(0, Number(item.qty || 0)),
    0
  );

  const actualPayoutPct = totalRevenue > 0 ? (actualCogs / totalRevenue) * 100 : 0;
  const actualGrossProfit = totalRevenue - actualCogs;
  const actualGrossMarginPct = totalRevenue > 0 ? (actualGrossProfit / totalRevenue) * 100 : 0;
  const breakevenPulls = pricePerPull > 0 ? Math.ceil(actualCogs / pricePerPull) : 0;

  const payoutVariancePp = actualPayoutPct - HYBRID_68_PRESET.target_payout_ratio_pct;
  const cogsVarianceNtd = actualCogs - Math.round(totalRevenue * (HYBRID_68_PRESET.target_payout_ratio_pct / 100));

  const thresholds = HYBRID_68_PRESET.pool_health_thresholds;
  let healthLevel: PoolHealthLevel = 'green';
  let healthStatus: 'green' | 'yellow' | 'red' = 'green';
  let healthMessage = '符合 68% 高毛利穩健標準，可直接上架。';
  let requiresForceConfirm = false;

  if (actualPayoutPct < thresholds.payout_red_low_pct) {
    healthLevel = 'red_low';
    healthStatus = 'red';
    healthMessage = '⚠️ 還元率嚴重過低，極高機率變死池！需勾選『強制確認』才能上架。';
    requiresForceConfirm = true;
  } else if (actualPayoutPct < thresholds.payout_yellow_low_pct) {
    healthLevel = 'yellow_low';
    healthStatus = 'yellow';
    healthMessage = '獎品價值略低，可能影響玩家進場意願，建議微調大獎或最後賞。';
  } else if (actualPayoutPct <= thresholds.payout_yellow_high_pct) {
    healthLevel = 'green';
    healthStatus = 'green';
    healthMessage = '符合 68% 高毛利穩健標準，可直接上架。';
  } else if (actualPayoutPct <= thresholds.payout_red_high_pct) {
    healthLevel = 'yellow_high';
    healthStatus = 'yellow';
    healthMessage = '成本略超標，毛利空間壓縮，請確認是否有 KOL 分潤或廣告費。';
  } else {
    healthLevel = 'red_high';
    healthStatus = 'red';
    healthMessage = '🚨 成本嚴重超標（毛利跌破 27%），扣除金流與分潤恐虧損！需強制確認。';
    requiresForceConfirm = true;
  }

  let pullItemsTotalQty = 0;
  const tierResults: TierValuationResult[] = HYBRID_68_PRESET.tiers.map((tierCfg) => {
    const tierItems = params.items.filter((i) => i.tierCode === tierCfg.code);
    const qty = tierItems.reduce((s, i) => s + Math.max(0, Number(i.qty || 0)), 0);
    const subtotal = tierItems.reduce(
      (s, i) => s + Math.max(0, Number(i.cost || 0)) * Math.max(0, Number(i.qty || 0)),
      0
    );
    if (tierCfg.is_pull) {
      pullItemsTotalQty += qty;
    }

    const avgCost = qty > 0 ? subtotal / qty : 0;
    const targetUnitCost = Math.round(pricePerPull * tierCfg.cost_multiple_of_price);
    const deviationPct = targetUnitCost > 0 && qty > 0 ? ((avgCost - targetUnitCost) / targetUnitCost) * 100 : 0;

    let status: TierHealthStatus = 'empty';
    if (qty > 0) {
      const absDev = Math.abs(deviationPct);
      if (absDev <= tierCfg.tolerance_warn_pct) {
        status = 'green';
      } else if (absDev <= tierCfg.tolerance_danger_pct) {
        status = 'yellow';
      } else {
        status = 'red';
      }
    }

    return {
      code: tierCfg.code,
      name: tierCfg.name,
      isPull: tierCfg.is_pull,
      qty,
      targetQty: tierCfg.target_qty,
      subtotal,
      avgCost,
      targetUnitCost,
      deviationPct,
      status,
    };
  });

  const spRes = tierResults.find((t) => t.code === 'SP');
  const lastRes = tierResults.find((t) => t.code === 'LAST');
  const dRes = tierResults.find((t) => t.code === 'D');

  const actualSpAvgCost = spRes?.avgCost || 0;
  const actualLastOneCost = lastRes?.avgCost || 0;
  const actualDAvgCost = dRes?.avgCost || 0;

  const snipe13Cost = 13 * pricePerPull;
  const snipe13MinVal = actualSpAvgCost + actualLastOneCost + 12 * actualDAvgCost;
  const snipe13RoiPct = snipe13Cost > 0 ? ((snipe13MinVal - snipe13Cost) / snipe13Cost) * 100 : 0;

  const pullDiff = pullItemsTotalQty - totalPulls;

  return {
    totalRevenue,
    actualCogs,
    actualPayoutPct,
    actualGrossProfit,
    actualGrossMarginPct,
    breakevenPulls,
    payoutVariancePp,
    cogsVarianceNtd,
    pullItemsTotalQty,
    totalPullsMatch: totalPulls > 0 && pullItemsTotalQty === totalPulls,
    pullDiff,
    healthLevel,
    healthStatus,
    healthMessage,
    requiresForceConfirm,
    snipe13Cost,
    snipe13MinVal,
    snipe13RoiPct,
    tiers: tierResults,
  };
}

export interface AutoBalanceInput {
  heroPullQty: number;       // 已上傳大獎佔用抽數（A + SP + B，不含最後賞）
  heroTotalCost: number;     // 已上傳大獎總成本（含最後賞）
  cCost: number;             // C 賞標準單價（預設 1800）
  dCost: number;             // D 賞標準單價（預設 450）
  targetPayoutRatio: number; // 目標還元率（預設 0.68）
  defaultCRatio?: number;    // 反推時預設 C 賞佔總抽數比例（預設 0.13）
}

// 模式 A：鎖定總抽數 -> 建議漂亮單抽價（99 結尾）
export function suggestNicePrice(input: AutoBalanceInput, lockedTotalPulls: number): number {
  const safePulls = Math.max(1, lockedTotalPulls);
  const cRatio = input.defaultCRatio ?? 0.13;
  const estQtyC = Math.round(safePulls * cRatio);
  const estQtyD = Math.max(0, safePulls - input.heroPullQty - estQtyC);
  const estTotalCogs = input.heroTotalCost + estQtyC * input.cCost + estQtyD * input.dCost;
  const rawPrice = estTotalCogs / input.targetPayoutRatio / safePulls;
  return Math.max(99, Math.round(rawPrice / 100) * 100 - 1);
}

// 模式 B：鎖定單抽價 -> 建議漂亮總抽數（10 的倍數）
export function suggestNicePulls(input: AutoBalanceInput, lockedPricePerPull: number): number {
  const cRatio = input.defaultCRatio ?? 0.13;
  const dRatio = 1 - cRatio;
  const denominator =
    input.targetPayoutRatio * lockedPricePerPull - cRatio * input.cCost - dRatio * input.dCost;
  if (denominator <= 0) return input.heroPullQty + 20;
  const rawPulls = (input.heroTotalCost - input.heroPullQty * input.dCost) / denominator;
  return Math.max(input.heroPullQty + 10, Math.round(rawPulls / 10) * 10);
}

// 核心配平函式：已知單抽價與總抽數，自動算出精準 C / D 賞數量與健康狀態
export function autoBalancePool(
  input: AutoBalanceInput,
  pricePerPull: number,
  totalPulls: number
) {
  const safePrice = Math.max(1, pricePerPull);
  const safePulls = Math.max(input.heroPullQty + 1, totalPulls);
  const totalRevenue = safePrice * safePulls;
  const remainingPulls = Math.max(0, safePulls - input.heroPullQty);
  const targetTotalCogs = totalRevenue * input.targetPayoutRatio;
  const remainingBudget = targetTotalCogs - input.heroTotalCost;

  const costSpread = input.cCost - input.dCost;
  let rawQtyC = costSpread > 0 ? (remainingBudget - remainingPulls * input.dCost) / costSpread : 0;
  let warning: string | null = null;

  if (rawQtyC < 0) {
    warning = '大獎成本過高：即使剩餘抽數全放 D 賞仍會超出目標還元率，請調高單抽價、增加總抽數或減少大獎成本。';
    rawQtyC = 0;
  } else if (rawQtyC > remainingPulls) {
    warning = '大獎成本偏低：即使剩餘抽數全放 C 賞仍低於目標還元率，請調降單抽價、減少總抽數或加碼大獎。';
    rawQtyC = remainingPulls;
  }

  const qtyC = Math.round(rawQtyC);
  const qtyD = Math.max(0, remainingPulls - qtyC);

  const actualCogs = input.heroTotalCost + qtyC * input.cCost + qtyD * input.dCost;
  const actualPayoutPct = (actualCogs / totalRevenue) * 100;
  const actualGrossProfit = totalRevenue - actualCogs;
  const actualGrossMarginPct = (actualGrossProfit / totalRevenue) * 100;
  const breakevenPulls = Math.ceil(actualCogs / safePrice);

  return {
    pricePerPull: safePrice,
    totalPulls: safePulls,
    totalRevenue,
    qtyC,
    qtyD,
    actualCogs,
    actualPayoutPct: Number(actualPayoutPct.toFixed(1)),
    actualGrossProfit,
    actualGrossMarginPct: Number(actualGrossMarginPct.toFixed(1)),
    breakevenPulls,
    payoutVariancePp: Number((actualPayoutPct - input.targetPayoutRatio * 100).toFixed(1)),
    warning,
  };
}
