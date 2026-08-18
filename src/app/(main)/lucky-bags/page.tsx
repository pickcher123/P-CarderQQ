'use client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Users, Gem, Trophy, Package, ChevronDown, ChevronUp, Sparkles, ChevronRight, 
  Settings, Disc3, Info, Flame, ShieldCheck, ArrowRight, Zap, Target,
  Dices, Percent, Award, Coins
} from 'lucide-react';
import { LuckyBagIcon, PPlusIcon } from '@/components/icons';
import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, getDocs, orderBy, doc, getCountFromServer } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { SafeImage } from '@/components/safe-image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import type { SystemConfig } from '@/types/system';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type LuckBagStatus = 'draft' | 'published' | '已開獎';

export interface CardData {
    id: string;
    name: string;
    imageUrl: string;
    imageHint: string;
    backImageUrl?: string;
    sellPrice?: number;
}

export interface LuckBag {
    id: string;
    name: string;
    totalParticipants: number;
    price: number;
    revealLottery?: boolean;
    imageUrl?: string;
    imageHint?: string;
    status?: LuckBagStatus;
    order?: number;
    currency?: 'diamond' | 'p-point';
    prizes?: {
        first?: string;
        second?: string;
        third?: string;
    };
    otherPrizes?: { cardId: string; prizeId: string; type?: 'card' | 'points'; points?: number }[];
    winners?: {
      [key: string]: number;
    }
}

export interface LuckBagWithCount extends LuckBag {
    participantCount: number;
    prizeCards: {
        first?: CardData;
        second?: CardData;
        third?: CardData;
    };
    otherPrizesList: (CardData & { prizeId: string }) [];
    otherPointsList: { prizeId: string; points: number }[];
}

const LuckBagCard = ({ bag, priority = false, index }: { bag: LuckBagWithCount, priority?: boolean, index: number }) => {
    const isDone = bag.status === '已開獎';
    const currency = bag.currency || 'p-point';
    const progress = Math.min(100, Math.round((bag.participantCount / (bag.totalParticipants || 1)) * 100));

    return (
        <Link 
            href={`/lucky-bags/${bag.id}`}
            className={cn(
                "group relative flex flex-col lg:flex-row p-4 sm:p-6 bg-slate-950/80 border rounded-3xl backdrop-blur-xl shadow-2xl transition-all duration-500 hover:-translate-y-1.5 cursor-pointer overflow-hidden select-none",
                isDone 
                    ? "border-slate-800/80 hover:border-slate-700 opacity-85" 
                    : progress >= 80 
                        ? "border-amber-500/50 hover:border-amber-400 shadow-[0_0_35px_rgba(245,158,11,0.15)]" 
                        : "border-slate-800/80 hover:border-amber-400/60 hover:shadow-[0_12px_40px_rgba(0,0,0,0.6)]",
                "animate-fade-in-up"
            )}>
            
            {/* 背景科技流光 */}
            <div className="absolute top-0 right-1/4 w-72 h-72 bg-amber-500/5 rounded-full blur-[100px] pointer-events-none group-hover:bg-amber-500/10 transition-colors" />
            <div className="absolute -bottom-10 -left-10 w-60 h-60 bg-purple-500/5 rounded-full blur-[90px] pointer-events-none" />

            {/* 左側：大獎展示櫥窗 */}
            <div className="relative flex-[1.2] flex flex-col sm:flex-row items-center gap-5 p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-slate-900/90 via-slate-950/90 to-slate-900/90 border border-slate-800/80 shadow-inner overflow-hidden">
                {/* 狀態角標 */}
                <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5">
                    <Badge className={cn(
                        "text-[10px] font-black px-2.5 py-0.5 rounded-md border shadow-md font-mono",
                        isDone 
                            ? "bg-slate-800/90 text-slate-300 border-slate-700" 
                            : bag.revealLottery 
                                ? "bg-rose-500 text-white border-rose-400 animate-pulse" 
                                : "bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 border-amber-400 font-bold"
                    )}>
                        {isDone ? '已開獎結案' : bag.revealLottery ? '🔥 開獎中' : '✨ 募集進行中'}
                    </Badge>
                    {progress >= 80 && !isDone && (
                        <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-bold animate-pulse">
                            即將滿額
                        </Badge>
                    )}
                </div>

                {/* 卡片封面 */}
                <div className={cn(
                    "relative w-28 sm:w-36 aspect-[2.5/4] shrink-0 rounded-xl overflow-hidden border border-slate-700/80 bg-slate-950 shadow-2xl mt-6 sm:mt-0 transition-transform duration-500 group-hover:scale-105",
                    isDone && "opacity-60 grayscale-[40%]"
                )}>
                    {bag.prizeCards.first ? (
                        <SafeImage 
                            src={bag.prizeCards.first.imageUrl} 
                            alt={bag.prizeCards.first.name}
                            fill
                            className="object-contain"
                            priority={priority}
                            sizes="160px"
                        />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-3 text-center bg-slate-900">
                            <LuckyBagIcon className="w-10 h-10 text-amber-400/40 mb-2" />
                            <span className="text-[10px] text-slate-500 font-mono">頂級頭獎</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                    <div className="absolute bottom-1.5 inset-x-1.5 text-center">
                        <span className="text-[9px] font-mono font-black text-amber-300 bg-black/80 px-2 py-0.5 rounded border border-amber-500/30 backdrop-blur-sm">
                            TOP JACKPOT
                        </span>
                    </div>
                </div>

                {/* 福袋標題與大獎資訊 */}
                <div className="flex-1 flex flex-col justify-center text-center sm:text-left overflow-hidden space-y-2">
                    <div>
                        <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-widest block mb-1">
                            LIMITED EDITION LUCKY BAG
                        </span>
                        <h3 className="text-lg sm:text-2xl font-black font-headline text-white group-hover:text-amber-300 transition-colors line-clamp-2 leading-tight">
                            {bag.name}
                        </h3>
                    </div>

                    {bag.prizeCards.first && (
                        <div className="inline-flex items-center gap-1.5 text-xs text-slate-300 font-medium bg-slate-950/60 p-2 rounded-xl border border-slate-800/80">
                            <Trophy className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="truncate">頭獎：{bag.prizeCards.first.name}</span>
                        </div>
                    )}

                    {isDone && bag.winners?.first && (
                        <div className="text-[11px] font-mono font-black text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30 inline-flex items-center gap-1.5 w-fit">
                            <Sparkles className="w-3 h-3 text-amber-400" />
                            <span>頭獎幸運兒：#{bag.winners.first} 號位</span>
                        </div>
                    )}
                </div>
            </div>

            {/* 右側：參與進度與控制面板 */}
            <div className="flex-1 flex flex-col justify-between p-4 sm:p-6 text-white mt-4 lg:mt-0 space-y-5">
                <div className="space-y-4">
                    {/* 價格與當前募集 */}
                    <div className="flex justify-between items-end border-b border-slate-800/80 pb-4">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-mono">
                                ENTRY PRICE / 格
                            </p>
                            <div className="flex items-center gap-2">
                                <p className="text-2xl sm:text-4xl font-black text-amber-400 font-code tracking-tight">
                                    {(bag.price || 0).toLocaleString()}
                                </p>
                                {currency === 'diamond' ? (
                                    <Gem className="w-5 h-5 sm:w-6 sm:h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]" />
                                ) : (
                                    <PPlusIcon className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.6)]" />
                                )}
                            </div>
                        </div>
                        <div className="text-right space-y-1">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] font-mono">
                                PARTICIPATION
                            </p>
                            <p className="text-base sm:text-xl font-black text-white font-code">
                                <span className="text-amber-400">{bag.participantCount}</span> 
                                <span className="text-slate-500 font-normal"> / {bag.totalParticipants} 格</span>
                            </p>
                        </div>
                    </div>

                    {/* 進度條 */}
                    <div className="space-y-2">
                        <div className="flex justify-between text-xs font-mono font-bold">
                            <span className="text-slate-400">募集進度</span>
                            <span className={progress >= 80 ? "text-rose-400" : "text-amber-400"}>{progress}%</span>
                        </div>
                        <div className="w-full bg-slate-900 h-3 rounded-full overflow-hidden border border-slate-800 p-0.5 shadow-inner">
                            <div 
                                className={cn(
                                    "h-full rounded-full transition-all duration-1000 ease-out",
                                    isDone 
                                        ? "bg-slate-700" 
                                        : progress >= 80 
                                            ? "bg-gradient-to-r from-orange-500 to-rose-500 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.5)]" 
                                            : "bg-gradient-to-r from-amber-500 to-yellow-400 shadow-[0_0_12px_rgba(245,158,11,0.4)]"
                                )} 
                                style={{ width: `${progress}%` }} 
                            />
                        </div>
                    </div>
                </div>

                {/* 底部行動按鈕提示 */}
                <div className="pt-2 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-slate-400 font-mono">
                        <ShieldCheck className="w-4 h-4 text-emerald-400" />
                        <span>公平亂數配獎 • 即時存證</span>
                    </div>

                    <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-amber-400 to-yellow-500 px-4 sm:px-5 py-2.5 rounded-xl shadow-lg shadow-amber-500/20 group-hover:from-amber-300 group-hover:to-yellow-400 group-hover:shadow-amber-500/40 transition-all font-headline">
                        <span>{isDone ? '查看開獎結果' : '立即選位參與'}</span>
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                    </div>
                </div>
            </div>
        </Link>
    );
}

export default function LuckyBagsPage() {
    const firestore = useFirestore();
    const [luckyBagsWithData, setLuckyBagsWithData] = useState<LuckBagWithCount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAllCompleted, setShowAllCompleted] = useState(false);

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

    const luckBagsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'luckBags'), orderBy('order', 'asc'));
    }, [firestore]);

    const { data: allLuckyBags, isLoading: isLoadingBags } = useCollection<LuckBag>(luckBagsQuery);
    
    const { data: allCards, isLoading: isLoadingCards } = useCollection<CardData>(
        useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore])
    );

    const fetchExtraData = useCallback(async () => {
        if (!allLuckyBags || !firestore || !allCards) return;

        setIsLoading(true);
        try {
            const cardMap = new Map(allCards.map(c => [c.id, c]));

            const bagsWithData = await Promise.all(
                allLuckyBags.map(async (bag) => {
                    const purchasesColRef = collection(firestore, 'luckBags', bag.id, 'luckBagPurchases');
                    const countSnapshot = await getCountFromServer(query(purchasesColRef));
                    const participantCount = countSnapshot.data().count;

                    const prizeCards = {
                        first: bag.prizes?.first ? cardMap.get(bag.prizes.first) : undefined,
                        second: bag.prizes?.second ? cardMap.get(bag.prizes.second) : undefined,
                        third: bag.prizes?.third ? cardMap.get(bag.prizes.third) : undefined,
                    };
                    
                    const otherPrizesList = (bag.otherPrizes || [])
                        .filter(p => p.type !== 'points')
                        .map(p => {
                            const card = cardMap.get(p.cardId);
                            return card ? { ...card, prizeId: p.prizeId } : null;
                        })
                        .filter((c): c is CardData & { prizeId: string } => !!c);
                    
                    const otherPointsList = (bag.otherPrizes || [])
                        .filter(p => p.type === 'points')
                        .map(p => ({ prizeId: p.prizeId, points: p.points || 0 }));

                    return {
                        ...bag,
                        participantCount,
                        prizeCards,
                        otherPrizesList,
                        otherPointsList,
                    };
                })
            );
            setLuckyBagsWithData(bagsWithData);
        } catch (error) {
            console.error("Error fetching luck bag data:", error);
        } finally {
            setIsLoading(false);
        }
    }, [allLuckyBags, allCards, firestore]);

    useEffect(() => {
        if (!isLoadingBags && !isLoadingCards && allLuckyBags) {
            fetchExtraData();
        }
    }, [allLuckyBags, allCards, firestore, isLoadingBags, isLoadingCards, fetchExtraData]);

    const { inProgressBags, completedBags } = useMemo(() => {
        const inProgress = luckyBagsWithData.filter(bag => bag.status !== '已開獎');
        const completed = luckyBagsWithData.filter(bag => bag.status === '已開獎');
        return { inProgressBags: inProgress, completedBags: completed };
    }, [luckyBagsWithData]);

    const finalIsLoading = isLoadingBags || isLoadingCards || isLoading;

    return (
      <div className="min-h-screen relative overflow-hidden pb-24 text-white">
          {/* Ambient Background Lighting */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[450px] bg-gradient-to-b from-amber-500/15 via-purple-500/10 to-transparent blur-[140px] pointer-events-none -z-10" />
          <div className="absolute top-[600px] right-0 w-[600px] h-[600px] bg-amber-500/5 blur-[160px] pointer-events-none -z-10" />

          <div className="container px-3 sm:px-6 py-3 sm:py-8 max-w-7xl mx-auto space-y-5 sm:space-y-10">
              
              {/* === HERO SECTION: 頂級賽博幸運福袋 === */}
              <div className="relative rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] p-3.5 sm:p-6 md:p-8 overflow-hidden border border-amber-500/20 bg-gradient-to-b from-slate-900/90 via-[#0a0f1d]/95 to-[#050811] shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
                  {/* Background Grid Pattern */}
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,#f59e0b10_1px,transparent_1px),linear-gradient(to_bottom,#f59e0b10_1px,transparent_1px)] bg-[size:32px_32px] opacity-60 pointer-events-none" />
                  
                  {/* Top Glow Accent Bar */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_15px_#f59e0b]" />
                  
                  <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-6 md:gap-12">
                      <div className="space-y-2 sm:space-y-3 text-center lg:text-left max-w-2xl">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/40 backdrop-blur-md shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                              <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                              <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.15em] text-amber-300">
                                  限定幸運福袋 專區
                              </span>
                          </div>

                          <h1 className="font-headline text-2xl sm:text-4xl md:text-6xl font-black text-white tracking-tight leading-none uppercase">
                              幸運福袋
                          </h1>

                          <p className="text-xs sm:text-sm md:text-base text-slate-300 font-medium leading-normal">
                              採募集制公平抽獎，每格中獎機率完全均等，滿額即時自動開獎入庫。
                          </p>

                          {/* Rules Quick Dialog Button */}
                          <div className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-2">
                              <Dialog>
                                  <DialogTrigger asChild>
                                      <Button className="h-8 sm:h-10 px-4 sm:px-5 rounded-lg sm:rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 text-xs sm:text-sm font-black shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all gap-1.5 group cursor-pointer">
                                          <Dices className="w-3.5 h-3.5 text-slate-950 group-hover:rotate-45 transition-transform" />
                                          <span>玩法說明</span>
                                      </Button>
                                  </DialogTrigger>
                                  <DialogContent className="rounded-[2rem] bg-slate-950 border border-amber-500/30 text-white max-w-2xl backdrop-blur-2xl shadow-2xl">
                                      <DialogHeader>
                                          <DialogTitle className="text-xl md:text-2xl font-black text-amber-400 flex items-center gap-2 font-headline">
                                              <Target className="w-6 h-6 text-amber-400" />
                                              幸運福袋機制說明
                                          </DialogTitle>
                                      </DialogHeader>
                                      <div className="space-y-4 py-3 text-sm text-slate-300">
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                  <div className="flex items-center gap-2 text-amber-400 font-bold">
                                                      <Percent className="w-4 h-4" /> 募集滿額即開獎
                                                  </div>
                                                  <p className="text-xs text-slate-400">達到指定參與人數與格數後，系統即刻公正自動開獎。</p>
                                              </div>
                                              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                  <div className="flex items-center gap-2 text-purple-400 font-bold">
                                                      <Award className="w-4 h-4" /> 機率絕對均等
                                                  </div>
                                                  <p className="text-xs text-slate-400">每個號碼位置中獎機率均等，保證包含展示之頂級大獎。</p>
                                              </div>
                                              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                  <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                                      <Coins className="w-4 h-4" /> 雙幣自由參與
                                                  </div>
                                                  <p className="text-xs text-slate-400">支援鑽石 💎 與紅利 P+ 點數自由兌換參與，極高性價比。</p>
                                              </div>
                                              <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                                  <div className="flex items-center gap-2 text-cyan-400 font-bold">
                                                      <ShieldCheck className="w-4 h-4" /> 自動入庫保障
                                                  </div>
                                                  <p className="text-xs text-slate-400">開獎後系統隨機配對，獲獎卡片與點數將直接入庫至收藏庫。</p>
                                              </div>
                                          </div>
                                      </div>
                                  </DialogContent>
                              </Dialog>

                              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg sm:rounded-xl bg-white/5 border border-white/10 text-[11px] text-slate-300">
                                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                                  <span>系統自動開獎保障</span>
                              </div>
                          </div>
                      </div>

                      {/* Live Stats Widget */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full lg:w-auto shrink-0">
                          <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0b1329] border border-amber-500/30 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(245,158,11,0.15)]">
                              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">進行中福袋</span>
                              <span className="text-xl sm:text-3xl font-black font-headline text-amber-400 mt-0.5 sm:mt-1">
                                  {finalIsLoading ? '--' : inProgressBags.length}
                              </span>
                              <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">熱烈募集中</span>
                          </div>

                          <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0b1329] border border-purple-500/30 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(168,85,247,0.15)]">
                              <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">歷史開獎</span>
                              <span className="text-xl sm:text-3xl font-black font-headline text-purple-400 mt-0.5 sm:mt-1">
                                  {finalIsLoading ? '--' : completedBags.length}
                              </span>
                              <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">已全數派發</span>
                          </div>
                      </div>
                  </div>
              </div>

              {/* 內容區塊 */}
              <div className="space-y-10 sm:space-y-12">
                  {/* 正在募集中的福袋 */}
                  <section>
                      <div className="mb-4 sm:mb-6 flex items-center justify-between">
                          <div className="flex items-center gap-2 sm:gap-2.5">
                              <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                  <Flame className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400 animate-pulse" />
                              </div>
                              <h2 className="text-base sm:text-xl font-black font-headline text-white tracking-wide">
                                  正在募集熱門福袋
                              </h2>
                              <span className="text-[10px] sm:text-xs font-mono font-bold text-amber-300 bg-amber-500/10 px-2 sm:px-2.5 py-0.5 rounded-full border border-amber-500/30">
                                  {inProgressBags.length} 個進行中
                              </span>
                          </div>
                      </div>

                      <div className="grid grid-cols-1 gap-4 sm:gap-6">
                          {finalIsLoading ? (
                              Array.from({length: 2}).map((_, i) => (
                                  <div key={i} className="aspect-[21/9] rounded-2xl overflow-hidden bg-slate-900/80">
                                      <Skeleton className="w-full h-full" />
                                  </div>
                              ))
                          ) : inProgressBags.length > 0 ? (
                              inProgressBags.map((bag, index) => (
                                  <LuckBagCard key={bag.id} bag={bag} priority={index < 3} index={index} />
                              ))
                          ) : (
                              <div className="py-16 text-center rounded-2xl bg-slate-950/80 border border-dashed border-slate-800 p-8">
                                  <LuckyBagIcon className="h-12 w-12 mx-auto mb-3 text-slate-600" />
                                  <h3 className="text-base font-bold text-slate-300 mb-1">目前尚無進行中的福袋</h3>
                                  <p className="text-xs text-slate-500">新福袋即將上線，敬請期待官方消息公告</p>
                              </div>
                          )}
                      </div>
                  </section>

                  {/* 精彩回顧（已開獎） */}
                  {completedBags.length > 0 && (
                      <section>
                          <div className="mb-4 sm:mb-6 flex items-center justify-between">
                              <div className="flex items-center gap-2 sm:gap-2.5">
                                  <div className="p-1.5 sm:p-2 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-300">
                                      <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                                  </div>
                                  <h2 className="text-base sm:text-xl font-black font-headline text-slate-300 tracking-wide">
                                      歷史精彩回顧
                                  </h2>
                              </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:gap-6">
                              {completedBags.slice(0, showAllCompleted ? undefined : 3).map((bag, index) => (
                                  <LuckBagCard key={bag.id} bag={bag} index={index} />
                              ))}
                          </div>
                          
                          {!showAllCompleted && completedBags.length > 3 && (
                              <div className="mt-8 flex justify-center">
                                  <Button 
                                      variant="outline" 
                                      onClick={() => setShowAllCompleted(true)}
                                      className="rounded-xl px-8 h-11 border-slate-800 bg-slate-900/80 hover:bg-slate-800 hover:border-slate-700 text-slate-300 font-bold text-xs"
                                  >
                                      <ChevronDown className="mr-2 h-4 w-4 text-amber-400" /> 查看更多已開獎福袋 ({completedBags.length - 3})
                                  </Button>
                              </div>
                          )}
                      </section>
                  )}
              </div>
          </div>
      </div>
    );
}
