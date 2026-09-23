'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { 
  Crown, 
  Gem, 
  Sparkles, 
  Star, 
  Trophy, 
  Shield, 
  Award, 
  Lock, 
  CheckCircle2, 
  ChevronRight, 
  Zap, 
  Gift, 
  ArrowRight, 
  Calculator, 
  Layers, 
  Flame, 
  Percent, 
  Sliders, 
  RotateCcw,
  Sparkle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { RefinedPoints } from '@/components/ui/refined-points';
import { cn } from '@/lib/utils';
import { userLevels } from '@/components/member-level-crown';

export interface TierDetailInfo {
  level: string;
  enTitle: string;
  subtitle: string;
  threshold: number;
  rate: number;
  icon: React.ElementType;
  themeColor: string;
  glowColor: string;
  accentBg: string;
  borderColor: string;
  auraGradient: string;
  cardBgGradient: string;
  badgeText: string;
  motto: string;
  perks: {
    icon: React.ElementType;
    title: string;
    desc: string;
  }[];
}

export const TIER_DETAILS: TierDetailInfo[] = [
  {
    level: '新手收藏家',
    enTitle: 'NOVICE COLLECTOR',
    subtitle: '榮耀啟程 · 初入卡牌殿堂',
    threshold: 0,
    rate: 0,
    icon: Shield,
    themeColor: 'text-slate-300',
    glowColor: 'rgba(148, 163, 184, 0.4)',
    accentBg: 'bg-slate-500/10',
    borderColor: 'border-slate-600/60',
    auraGradient: 'from-slate-600/30 via-slate-800/20 to-transparent',
    cardBgGradient: 'from-slate-900 via-slate-950 to-[#0b0f19]',
    badgeText: '初始階級',
    motto: '每一位傳奇大師，都始於最初拆開的第一包卡。',
    perks: [
      { icon: Zap, title: '全站卡池開放體驗', desc: '可直接參與常態拼卡、轉盤與一番賞挑戰' },
      { icon: Gift, title: '每日簽到紅利獎勵', desc: '天天登入簽到免費領取 P+ 紅利點數' },
      { icon: Shield, title: '雲端收藏庫保存', desc: '實體卡片資產安全防護與即時查閱' },
    ]
  },
  {
    level: '進階收藏家',
    enTitle: 'ADEPT COLLECTOR',
    subtitle: '破曉之星 · 嶄露收藏鋒芒',
    threshold: 15000,
    rate: 1,
    icon: Star,
    themeColor: 'text-slate-100',
    glowColor: 'rgba(203, 213, 225, 0.5)',
    accentBg: 'bg-slate-300/10',
    borderColor: 'border-slate-400/60',
    auraGradient: 'from-slate-400/30 via-slate-600/20 to-transparent',
    cardBgGradient: 'from-[#1e2538] via-slate-900 to-[#0c101d]',
    badgeText: '1% 紅利回饋',
    motto: '星芒初露，實力與敏銳眼光的最佳證明。',
    perks: [
      { icon: Percent, title: '1% 紅利點數回饋', desc: '全站消費每 100 鑽石額外累積 1 點 P+ 紅利' },
      { icon: Star, title: '進階名片身分標記', desc: '個人首頁與開獎公告顯示進階白銀徽記' },
      { icon: Zap, title: '官方社群專屬福利', desc: '定期參與社群限定抽卡券與活動碼發送' },
    ]
  },
  {
    level: '資深收藏家',
    enTitle: 'VETERAN COLLECTOR',
    subtitle: '黃金先驅 · 縱橫展覽現場',
    threshold: 50000,
    rate: 1.5,
    icon: Award,
    themeColor: 'text-amber-400',
    glowColor: 'rgba(245, 158, 11, 0.5)',
    accentBg: 'bg-amber-500/10',
    borderColor: 'border-amber-500/60',
    auraGradient: 'from-amber-500/30 via-yellow-700/20 to-transparent',
    cardBgGradient: 'from-[#2a1d0f] via-slate-950 to-[#120e09]',
    badgeText: '1.5% 紅利回饋',
    motto: '歷經百戰淬鍊，掌握實體卡市脈動的資深行家。',
    perks: [
      { icon: Percent, title: '1.5% 紅利點數回饋', desc: '紅利累積速度提升 1.5 倍，點數兌換更快速' },
      { icon: Gift, title: '實體出貨優先封箱', desc: '抽中稀有卡片享有專屬防折角與優先包裝通道' },
      { icon: Award, title: '專屬資深卡友勳章', desc: '解鎖排行榜金色先驅銘牌與社群身分組' },
    ]
  },
  {
    level: '卡牌大師',
    enTitle: 'CARD MASTER',
    subtitle: '晶鑽匠人 · 頂尖對決者',
    threshold: 100000,
    rate: 2,
    icon: Gem,
    themeColor: 'text-yellow-300',
    glowColor: 'rgba(253, 224, 71, 0.6)',
    accentBg: 'bg-yellow-500/15',
    borderColor: 'border-yellow-400/70',
    auraGradient: 'from-yellow-400/40 via-amber-600/25 to-transparent',
    cardBgGradient: 'from-[#332207] via-slate-900 to-[#161005]',
    badgeText: '2% 雙倍回饋',
    motto: '卡牌如神兵利器，於瞬息萬變中洞悉全場勝機。',
    perks: [
      { icon: Percent, title: '2% 雙倍點數回饋', desc: '每消費 100 鑽直接賺回 2 點紅利' },
      { icon: Gem, title: '大師高階拼卡權限', desc: '可自由進入限定「大師門檻」之高價值卡池' },
      { icon: Sparkle, title: '動態寶石全息銘牌', desc: '個人檔案專屬閃耀金鑽微光與全站播報特權' },
    ]
  },
  {
    level: '殿堂級玩家',
    enTitle: 'HALL OF FAME',
    subtitle: '熾紅霸主 · 屹立榮耀殿堂',
    threshold: 500000,
    rate: 4,
    icon: Trophy,
    themeColor: 'text-rose-400',
    glowColor: 'rgba(244, 63, 94, 0.6)',
    accentBg: 'bg-rose-500/15',
    borderColor: 'border-rose-500/70',
    auraGradient: 'from-rose-500/40 via-pink-700/25 to-transparent',
    cardBgGradient: 'from-[#350d18] via-slate-900 to-[#17050a]',
    badgeText: '4% 飆速回饋',
    motto: '登上殿堂王座，每一個名字都是展場傳頌的傳奇。',
    perks: [
      { icon: Percent, title: '4% 飆速紅利返點', desc: '超高回饋率，大幅加速紅利兌換商城獎勵' },
      { icon: Trophy, title: '全服大獎跑馬燈播報', desc: '中獎時享有專屬熾紅霸主全頻跑馬燈榮譽特效' },
      { icon: Shield, title: '一對一專屬 VIP 客服', desc: '享有專屬客服專線，優先處理訂單與收件疑問' },
    ]
  },
  {
    level: '傳奇收藏家',
    enTitle: 'LEGENDARY COLLECTOR',
    subtitle: '永恆星芒 · 虛空神話再臨',
    threshold: 1000000,
    rate: 5,
    icon: Sparkles,
    themeColor: 'text-purple-400',
    glowColor: 'rgba(192, 132, 252, 0.7)',
    accentBg: 'bg-purple-500/15',
    borderColor: 'border-purple-500/80',
    auraGradient: 'from-purple-500/40 via-indigo-700/25 to-transparent',
    cardBgGradient: 'from-[#2a0c3b] via-slate-900 to-[#12041a]',
    badgeText: '5% 傳奇特權',
    motto: '星河倒映其身，手中卡藏皆是當世僅見的絕世珍品。',
    perks: [
      { icon: Percent, title: '5% 傳奇極速回饋', desc: '尊享全通路 5% 紅利反饋，累積點數毫無上限' },
      { icon: Sparkles, title: '限定一番賞優先預約', desc: '官方重大線上一番賞專案享有優先鎖定通道' },
      { icon: Gift, title: '實體卡片黑貓免運保價', desc: '出貨享全額保價寄送與專人加固硬殼保護盒' },
    ]
  },
  {
    level: 'P+卡神',
    enTitle: 'GOD OF CARDS',
    subtitle: '至高無上 · 全站天花板神話',
    threshold: 2000000,
    rate: 10,
    icon: Crown,
    themeColor: 'text-cyan-400',
    glowColor: 'rgba(34, 211, 238, 0.8)',
    accentBg: 'bg-cyan-500/20',
    borderColor: 'border-cyan-400',
    auraGradient: 'from-cyan-400/50 via-teal-600/30 to-transparent',
    cardBgGradient: 'from-[#062c35] via-slate-900 to-[#021317]',
    badgeText: '10% 終極神級回饋',
    motto: '眾神之巔，手握乾坤。卡界的規律與傳奇，由你譜寫。',
    perks: [
      { icon: Crown, title: '10% 頂級天花板返還', desc: '全站史上最高 10% 回饋，消費即返大額紅利' },
      { icon: Zap, title: '專屬神級客製化展示專區', desc: '享有官方活動冠名與首頁個人神殿級展示欄位' },
      { icon: Gift, title: '年度卡神尊榮聚會邀請', desc: '享有官方核心年會貴賓席與專屬限量雷雕黑金卡' },
    ]
  }
];

interface InteractiveHonorAtlasProps {
  currentLevel: string;
  totalSpent: number;
  bonusPoints?: number;
  diamondBalance?: number;
  username?: string;
}

export function InteractiveHonorAtlas({
  currentLevel,
  totalSpent,
  bonusPoints = 0,
  diamondBalance = 0,
  username = '收藏家'
}: InteractiveHonorAtlasProps) {
  // 當前用戶所在的階級 index
  const userLevelIndex = useMemo(() => {
    const idx = TIER_DETAILS.findIndex(t => t.level === currentLevel);
    return idx >= 0 ? idx : 0;
  }, [currentLevel]);

  // 目前被點選檢視的階級（預設選中使用者自己的階級）
  const [selectedTierIndex, setSelectedTierIndex] = useState<number>(userLevelIndex);

  // 視圖模式：'pathway' (星軌天梯動態圖譜) vs 'cards' (全像階級卡冊)
  const [viewMode, setViewMode] = useState<'pathway' | 'cards'>('pathway');

  // 晉級試算器（模擬追加消費鑽石）
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const [simulatedExtraSpend, setSimulatedExtraSpend] = useState<number>(0);

  // 試算後的總累計消費
  const effectiveSpent = totalSpent + simulatedExtraSpend;

  // 試算後達到的最高階級
  const simulatedLevelIndex = useMemo(() => {
    let maxIdx = 0;
    for (let i = 0; i < TIER_DETAILS.length; i++) {
      if (effectiveSpent >= TIER_DETAILS[i].threshold) {
        maxIdx = i;
      }
    }
    return maxIdx;
  }, [effectiveSpent]);

  // 當前聚焦的階級資料
  const activeTier = TIER_DETAILS[selectedTierIndex];
  const ActiveIcon = activeTier.icon;

  // 下一階級目標
  const nextTier = userLevelIndex < TIER_DETAILS.length - 1 ? TIER_DETAILS[userLevelIndex + 1] : null;
  const currentTier = TIER_DETAILS[userLevelIndex];
  
  // 計算到下一階級的進度百分比
  const nextTierProgress = useMemo(() => {
    if (!nextTier) return 100;
    const range = nextTier.threshold - currentTier.threshold;
    const currentProgress = Math.max(0, effectiveSpent - currentTier.threshold);
    return Math.min(100, Math.max(0, Math.round((currentProgress / range) * 100)));
  }, [nextTier, currentTier, effectiveSpent]);

  const diamondsToNext = useMemo(() => {
    if (!nextTier) return 0;
    return Math.max(0, nextTier.threshold - effectiveSpent);
  }, [nextTier, effectiveSpent]);

  // 觸發慶祝特效
  const triggerConfetti = (e?: React.MouseEvent) => {
    const rect = e?.currentTarget.getBoundingClientRect();
    const x = rect ? (rect.left + rect.width / 2) / window.innerWidth : 0.5;
    const y = rect ? (rect.top + rect.height / 2) / window.innerHeight : 0.5;

    confetti({
      particleCount: 50,
      spread: 70,
      origin: { x, y }
    });
  };

  return (
    <div className="space-y-6 select-none">
      {/* 🌟 頂部互動控制列與模式切換 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-gradient-to-r from-slate-900/90 via-slate-950/80 to-slate-900/90 p-3 sm:p-4 rounded-2xl border border-white/10 backdrop-blur-xl shadow-lg">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-amber-400 tracking-wider uppercase">
              HONOR PROGRESSION ATLAS
            </span>
            <span className="inline-flex items-center px-2 py-0.2 rounded-full text-[10px] font-black bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
              互動探索中
            </span>
          </div>
          <p className="text-xs text-slate-300">
            點擊星軌節點或階級卡牌，即時探索各尊榮會員特權與晉級路徑。
          </p>
        </div>

        {/* 右側按鈕組：視圖切換 & 晉升試算 */}
        <div className="flex items-center gap-2 self-stretch sm:self-auto shrink-0">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setViewMode('pathway')}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                viewMode === 'pathway'
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>星軌天梯</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className={cn(
                "px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer",
                viewMode === 'cards'
                  ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>卡冊全覽</span>
            </button>
          </div>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
            className={cn(
              "h-9 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
              isSimulatorOpen 
                ? "bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                : "border-slate-700 bg-slate-900/80 text-slate-300 hover:text-white hover:border-slate-500"
            )}
          >
            <Calculator className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden xs:inline">晉級試算</span>
            <span className="xs:hidden">試算</span>
          </Button>
        </div>
      </div>

      {/* 🧮 晉升模擬器展開面板 */}
      <AnimatePresence>
        {isSimulatorOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-cyan-950/40 via-slate-950 to-slate-900 border border-cyan-500/40 shadow-[0_0_25px_rgba(6,182,212,0.15)] space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white flex items-center gap-2">
                      <span>晉級榮耀模擬器</span>
                      <span className="text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-500/30">
                        SIMULATION
                      </span>
                    </h4>
                    <p className="text-[11px] text-slate-400">
                      模擬增加消費額，即時預覽圖譜星軌點亮狀態與未來可解鎖特權
                    </p>
                  </div>
                </div>

                {simulatedExtraSpend > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSimulatedExtraSpend(0)}
                    className="h-7 px-2 text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    重設歸零
                  </Button>
                )}
              </div>

              {/* 滑桿與快捷加額按鈕 */}
              <div className="space-y-3 bg-slate-900/80 p-3 sm:p-4 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-slate-400">模擬追加消費：</span>
                  <span className="text-cyan-300 font-bold text-sm sm:text-base">
                    +{simulatedExtraSpend.toLocaleString()} 💎 鑽石
                  </span>
                </div>

                <Slider
                  value={[simulatedExtraSpend]}
                  max={2000000}
                  step={5000}
                  onValueChange={(vals) => setSimulatedExtraSpend(vals[0] || 0)}
                  className="py-1"
                />

                {/* 快捷點選加額按鈕 */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 mr-1">快捷試算：</span>
                  {[
                    { label: '+1萬', val: 10000 },
                    { label: '+5萬', val: 50000 },
                    { label: '+10萬', val: 100000 },
                    { label: '+50萬', val: 500000 },
                    { label: '+100萬', val: 1000000 },
                    { label: '直達卡神', val: Math.max(0, 2000000 - totalSpent) }
                  ].map(btn => (
                    <button
                      key={btn.label}
                      type="button"
                      onClick={() => {
                        setSimulatedExtraSpend(btn.val);
                        setSelectedTierIndex(
                          TIER_DETAILS.findIndex(t => (totalSpent + btn.val) >= t.threshold) >= 0
                            ? [...TIER_DETAILS].reverse().find(t => (totalSpent + btn.val) >= t.threshold)
                              ? TIER_DETAILS.indexOf([...TIER_DETAILS].reverse().find(t => (totalSpent + btn.val) >= t.threshold)!)
                              : 0
                            : 0
                        );
                      }}
                      className={cn(
                        "text-[11px] font-mono px-2 py-0.5 rounded-lg border transition-all cursor-pointer",
                        simulatedExtraSpend === btn.val
                          ? "bg-cyan-500 text-slate-950 font-bold border-cyan-400 shadow-sm"
                          : "bg-slate-800/80 hover:bg-slate-700 text-slate-300 border-slate-700"
                      )}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 試算結果比對條 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">目前實際累計</span>
                  <div className="mt-0.5">
                    <RefinedPoints value={totalSpent} currency="diamond" size="sm" showIcon variant="solid" />
                  </div>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    ({currentLevel})
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-cyan-950/50 border border-cyan-500/30">
                  <span className="text-[10px] text-cyan-300 block">模擬預計累計</span>
                  <div className="mt-0.5">
                    <RefinedPoints value={effectiveSpent} currency="diamond" size="sm" showIcon variant="luxury" />
                  </div>
                  <span className="text-[10px] text-cyan-300 block mt-0.5">
                    ({TIER_DETAILS[simulatedLevelIndex].level})
                  </span>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-500/30">
                  <span className="text-[10px] text-amber-300 block">預估返還紅利</span>
                  <div className="mt-0.5">
                    <RefinedPoints 
                      value={Math.floor((effectiveSpent * TIER_DETAILS[simulatedLevelIndex].rate) / 100)} 
                      currency="pplus" 
                      size="sm" 
                      prefix="+" 
                      suffix="點" 
                      variant="luxury" 
                    />
                  </div>
                  <span className="text-[10px] text-amber-300/80 block mt-0.5">
                    (享 {TIER_DETAILS[simulatedLevelIndex].rate}% 回饋率)
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 🚀 主視覺區域：星軌天梯動態圖譜 (Pathway View) OR 卡冊全覽 (Cards View) */}
      {viewMode === 'pathway' ? (
        <div className="relative p-4 sm:p-6 md:p-8 rounded-[1.75rem] bg-gradient-to-b from-[#0e1424] via-[#090d17] to-[#060810] border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl overflow-hidden">
          {/* 背景高科技光暈微網格 */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f293d15_1px,transparent_1px),linear-gradient(to_bottom,#1f293d15_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-3xl h-64 bg-cyan-500/5 blur-[100px] pointer-events-none" />

          {/* 頂部進度指引標示 */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-white/5">
            <div className="space-y-0.5">
              <span className="text-[11px] text-slate-400 font-mono">
                我的當前進度：
              </span>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-black text-white font-headline">
                  {currentLevel}
                </span>
                <Badge className="bg-cyan-500/20 text-cyan-300 border-cyan-500/40 text-[10px] font-bold">
                  目前階級
                </Badge>
              </div>
            </div>

            {nextTier ? (
              <div className="text-right space-y-0.5">
                <span className="text-[11px] text-slate-400 font-mono">
                  距離「{nextTier.level}」尚需
                </span>
                <div className="flex items-center justify-end">
                  <RefinedPoints 
                    value={diamondsToNext} 
                    currency="diamond" 
                    size="lg" 
                    suffix="鑽石" 
                    showIcon 
                    variant="luxury" 
                  />
                </div>
              </div>
            ) : (
              <Badge className="bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-black px-3 py-1 text-xs shadow-lg">
                👑 已登頂至高神位
              </Badge>
            )}
          </div>

          {/* 🌟 核心互動天梯星軌 (7 個階級節點 + 連接光軌) */}
          <div className="relative z-10 py-4 sm:py-6">
            {/* 桌面與平板橫向光軌導航 (橫向捲動自適應) */}
            <div className="overflow-x-auto pb-4 pt-2 -mx-2 px-2 scrollbar-thin scrollbar-thumb-slate-800">
              <div className="min-w-[760px] relative flex items-center justify-between">
                
                {/* 橫向發光能量軌道線 */}
                <div className="absolute top-1/2 -translate-y-1/2 left-6 right-6 h-1.5 bg-slate-800/90 rounded-full overflow-hidden">
                  {/* 動態點亮軌跡 */}
                  <div 
                    className="h-full bg-gradient-to-r from-slate-400 via-amber-400 to-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.8)] transition-all duration-700 ease-out"
                    style={{ 
                      width: `${(Math.max(userLevelIndex, simulatedLevelIndex) / (TIER_DETAILS.length - 1)) * 100}%` 
                    }}
                  />
                </div>

                {/* 7 個節點 */}
                {TIER_DETAILS.map((tier, idx) => {
                  const Icon = tier.icon;
                  const isCurrent = currentLevel === tier.level;
                  const isSimulated = simulatedLevelIndex === idx && simulatedExtraSpend > 0;
                  const isUnlocked = effectiveSpent >= tier.threshold;
                  const isSelected = selectedTierIndex === idx;

                  return (
                    <div 
                      key={tier.level}
                      onClick={() => {
                        setSelectedTierIndex(idx);
                        if (isCurrent) triggerConfetti();
                      }}
                      className={cn(
                        "relative flex flex-col items-center group cursor-pointer transition-all duration-300 p-2",
                        isSelected ? "scale-105" : "hover:scale-102"
                      )}
                    >
                      {/* 當前定位雷達標籤 */}
                      {isCurrent && (
                        <motion.div 
                          initial={{ y: -5, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="absolute -top-7 flex flex-col items-center pointer-events-none"
                        >
                          <span className="text-[9px] font-black font-mono tracking-tighter px-1.5 py-0.2 rounded-full bg-cyan-400 text-slate-950 shadow-[0_0_10px_rgba(6,182,212,0.8)] whitespace-nowrap animate-bounce">
                            YOU ARE HERE
                          </span>
                          <span className="w-1.5 h-1.5 rotate-45 bg-cyan-400 -mt-0.5" />
                        </motion.div>
                      )}

                      {/* 模擬到達標籤 */}
                      {isSimulated && !isCurrent && (
                        <motion.div 
                          initial={{ y: -5, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          className="absolute -top-7 flex flex-col items-center pointer-events-none"
                        >
                          <span className="text-[9px] font-black font-mono tracking-tighter px-1.5 py-0.2 rounded-full bg-amber-400 text-slate-950 shadow-[0_0_10px_rgba(245,158,11,0.8)] whitespace-nowrap animate-pulse">
                            SIMULATED
                          </span>
                        </motion.div>
                      )}

                      {/* 能量水晶節點本體 */}
                      <div 
                        className={cn(
                          "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all duration-300 relative border-2 backdrop-blur-xl",
                          isSelected
                            ? cn("ring-4 ring-offset-2 ring-offset-slate-950 shadow-2xl scale-110", tier.borderColor, tier.accentBg)
                            : isUnlocked 
                              ? cn(tier.borderColor, tier.accentBg, "hover:shadow-[0_0_15px_rgba(245,158,11,0.3)]")
                              : "border-slate-800 bg-slate-950/80 opacity-50 grayscale hover:opacity-80"
                        )}
                        style={{
                          boxShadow: isSelected ? `0 0 25px ${tier.glowColor}` : undefined
                        }}
                      >
                        <Icon className={cn("w-6 h-6 transition-transform duration-300 group-hover:scale-110", tier.themeColor)} />

                        {/* 解鎖或鎖定微型角標 */}
                        <div className="absolute -bottom-1 -right-1">
                          {isUnlocked ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 bg-slate-950 rounded-full" />
                          ) : (
                            <Lock className="w-4 h-4 text-slate-500 bg-slate-950 rounded-full" />
                          )}
                        </div>
                      </div>

                      {/* 節點下方標題與門檻 */}
                      <div className="mt-2 text-center space-y-0.5">
                        <span className={cn(
                          "text-xs font-black block tracking-tight transition-colors",
                          isSelected ? "text-white font-headline" : isUnlocked ? tier.themeColor : "text-slate-500"
                        )}>
                          {tier.level}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400 block">
                          {tier.threshold === 0 ? '無門檻' : `${(tier.threshold / 1000).toFixed(0)}k 💎`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 🌟 下半部：目前選取階級之「全像特權檢視終端機 (Inspector)」 */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTier.level}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.25 }}
                className={cn(
                  "relative rounded-2xl p-5 sm:p-6 md:p-7 border bg-gradient-to-br overflow-hidden shadow-2xl transition-all duration-300",
                  activeTier.borderColor,
                  activeTier.cardBgGradient
                )}
              >
                {/* 背景光暈效果 */}
                <div 
                  className="absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl pointer-events-none opacity-20"
                  style={{ backgroundColor: activeTier.glowColor }}
                />

                <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                  
                  {/* 左側：大徽章 + 階級名稱 + 格言 */}
                  <div className="flex items-start sm:items-center gap-4 sm:gap-5 min-w-0">
                    <div 
                      className={cn(
                        "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl sm:rounded-3xl flex items-center justify-center border-2 shrink-0 shadow-xl relative group",
                        activeTier.borderColor,
                        activeTier.accentBg
                      )}
                      style={{ boxShadow: `0 0 30px ${activeTier.glowColor}` }}
                    >
                      <ActiveIcon className={cn("w-9 h-9 sm:w-11 sm:h-11", activeTier.themeColor)} />
                      <div className="absolute -inset-1 rounded-3xl border border-white/20 animate-pulse pointer-events-none" />
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className={cn("text-xl sm:text-2xl font-black font-headline tracking-wide", activeTier.themeColor)}>
                          {activeTier.level}
                        </h3>
                        <Badge className={cn("text-[10px] font-mono font-bold px-2 py-0.5", activeTier.accentBg, activeTier.themeColor, activeTier.borderColor)}>
                          {activeTier.badgeText}
                        </Badge>
                        {effectiveSpent >= activeTier.threshold ? (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold">
                            ✅ 已達成
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px] font-mono">
                            🔒 尚需 {(activeTier.threshold - effectiveSpent).toLocaleString()} 💎
                          </Badge>
                        )}
                      </div>

                      <span className="text-[11px] font-mono text-slate-400 block uppercase tracking-wider">
                        {activeTier.enTitle} · {activeTier.subtitle}
                      </span>

                      <p className="text-xs text-slate-300 italic font-medium pt-0.5">
                        「{activeTier.motto}」
                      </p>
                    </div>
                  </div>

                  {/* 右側：門檻與進度條 */}
                  <div className="w-full lg:w-72 bg-black/40 p-3.5 sm:p-4 rounded-xl border border-white/5 space-y-2 shrink-0">
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">晉升門檻：</span>
                      <span className="text-white font-bold font-mono">
                        {activeTier.threshold.toLocaleString()} 💎 鑽石
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-400">消費回饋率：</span>
                      <span className={cn("font-bold font-mono", activeTier.themeColor)}>
                        {activeTier.rate}% 紅利點數
                      </span>
                    </div>

                    {/* 進度條 */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                        <span>解鎖達成率</span>
                        <span className="font-mono font-bold text-white">
                          {Math.min(100, Math.round((effectiveSpent / (activeTier.threshold || 1)) * 100))}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-amber-400 to-cyan-400 transition-all duration-500"
                          style={{ 
                            width: `${Math.min(100, Math.round((effectiveSpent / (activeTier.threshold || 1)) * 100))}%` 
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* 特權權益列表 */}
                <div className="mt-5 pt-4 border-t border-white/10 grid grid-cols-1 md:grid-cols-3 gap-3">
                  {activeTier.perks.map((perk, pIdx) => {
                    const PerkIcon = perk.icon;
                    return (
                      <div 
                        key={perk.title}
                        className="p-3 rounded-xl bg-slate-950/60 border border-white/5 flex items-start gap-2.5 hover:border-white/15 transition-colors"
                      >
                        <div className={cn("p-1.5 rounded-lg shrink-0 mt-0.5", activeTier.accentBg, activeTier.themeColor)}>
                          <PerkIcon className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <h5 className="text-xs font-bold text-white tracking-tight">
                            {perk.title}
                          </h5>
                          <p className="text-[11px] text-slate-400 leading-snug">
                            {perk.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      ) : (
        /* 🎴 階級全像卡冊模式 (Cards Grid View) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TIER_DETAILS.map((tier, idx) => {
            const Icon = tier.icon;
            const isCurrent = currentLevel === tier.level;
            const isUnlocked = effectiveSpent >= tier.threshold;
            const isSelected = selectedTierIndex === idx;

            return (
              <motion.div
                key={tier.level}
                whileHover={{ y: -4 }}
                onClick={() => {
                  setSelectedTierIndex(idx);
                  if (isCurrent) triggerConfetti();
                }}
                className={cn(
                  "relative rounded-2xl p-5 border cursor-pointer transition-all duration-300 flex flex-col justify-between overflow-hidden group",
                  tier.cardBgGradient,
                  isSelected
                    ? cn("ring-2 ring-offset-2 ring-offset-slate-950 shadow-2xl", tier.borderColor)
                    : isUnlocked
                      ? cn("border-white/10 hover:border-white/30", tier.borderColor)
                      : "border-slate-800/80 opacity-60 grayscale hover:opacity-90 hover:grayscale-0"
                )}
                style={{
                  boxShadow: isSelected ? `0 0 25px ${tier.glowColor}` : undefined
                }}
              >
                {/* 裝飾性全息反光紋路 */}
                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-white/5 blur-2xl group-hover:scale-150 transition-transform duration-500 pointer-events-none" />

                <div className="space-y-3 relative z-10">
                  <div className="flex items-start justify-between">
                    <div className={cn("p-3 rounded-2xl border-2 shrink-0 shadow-lg", tier.borderColor, tier.accentBg)}>
                      <Icon className={cn("w-6 h-6", tier.themeColor)} />
                    </div>

                    <div className="flex flex-col items-end gap-1">
                      {isCurrent ? (
                        <Badge className="bg-cyan-400 text-slate-950 font-black px-2.5 py-0.5 text-xs shadow-md">
                          當前等級
                        </Badge>
                      ) : isUnlocked ? (
                        <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] font-bold">
                          已達成
                        </Badge>
                      ) : (
                        <Badge className="bg-slate-800 text-slate-400 border-slate-700 text-[10px] font-mono">
                          未解鎖
                        </Badge>
                      )}
                      <span className="text-[10px] font-mono text-slate-400">
                        {tier.threshold === 0 ? '無門檻' : `${tier.threshold.toLocaleString()} 💎`}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className={cn("text-base font-black font-headline tracking-wide", tier.themeColor)}>
                      {tier.level}
                    </h4>
                    <p className="text-[11px] text-slate-400 leading-tight">
                      {tier.subtitle}
                    </p>
                  </div>

                  {/* 特權簡述 */}
                  <div className="space-y-1.5 pt-2 border-t border-white/5 text-[11px]">
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1">
                        <Percent className="w-3.5 h-3.5 text-cyan-400" />
                        消費回饋
                      </span>
                      <span className="font-mono font-bold text-white">{tier.rate}%</span>
                    </div>
                    <div className="flex items-center justify-between text-slate-300">
                      <span className="flex items-center gap-1">
                        <Gift className="w-3.5 h-3.5 text-amber-400" />
                        核心特權
                      </span>
                      <span className="text-slate-400 truncate max-w-[130px]">
                        {tier.perks[1]?.title || tier.perks[0]?.title}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 mt-3 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="italic truncate max-w-[200px]">「{tier.motto}」</span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
