'use client';

import { Button } from '@/components/ui/button';
import { 
  Users, Gem, Trophy, Package, ChevronDown, ChevronUp, Sparkles, ChevronRight, 
  Settings, Disc3, Info, Flame, ShieldCheck, ArrowRight, Zap, Target,
  Dices, Percent, Award, Coins, Crown, LayoutGrid, RotateCw, HelpCircle
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
import { RevolvingDoorLuckyBagCarousel } from '@/components/revolving-door-lucky-bag-carousel';
import { LuckyBagRedPacketCard } from '@/components/lucky-bag-red-packet-card';
import { BeginnerGuideDialog } from '@/components/beginner-guide-dialog';

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

export default function LuckyBagsPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const [luckyBagsWithData, setLuckyBagsWithData] = useState<LuckBagWithCount[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [showAllCompleted, setShowAllCompleted] = useState(false);
    const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'carousel' | 'list'>('carousel');

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

        // 僅在初次無資料時展示骨架屏，後續背景更新靜默平滑更新，杜絕頁面閃爍鈍感
        if (luckyBagsWithData.length === 0) {
            setIsLoading(true);
        }
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
    }, [allLuckyBags, allCards, firestore, luckyBagsWithData.length]);

    useEffect(() => {
        if (!isLoadingBags && !isLoadingCards && allLuckyBags) {
            fetchExtraData();
        }
    }, [allLuckyBags, allCards, isLoadingBags, isLoadingCards, fetchExtraData]);

    const { inProgressBags, completedBags } = useMemo(() => {
        const inProgress = luckyBagsWithData.filter(bag => bag.status !== '已開獎');
        const completed = luckyBagsWithData.filter(bag => bag.status === '已開獎');
        return { inProgressBags: inProgress, completedBags: completed };
    }, [luckyBagsWithData]);

    const finalIsLoading = (isLoadingBags || isLoadingCards || isLoading) && luckyBagsWithData.length === 0;

    // 當前旋轉門聚焦的紅包福袋
    const currentActiveBag = inProgressBags[activeCarouselIndex] || inProgressBags[0];

    return (
      <div className="min-h-screen relative overflow-hidden pb-24 text-white">
          {/* Ambient Background Lighting (暖金與喜慶朱紅絲絨環境光) */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1200px] h-[500px] bg-gradient-to-b from-rose-900/25 via-amber-600/15 to-transparent blur-[150px] pointer-events-none -z-10" />
          <div className="absolute top-[600px] right-0 w-[600px] h-[600px] bg-rose-950/20 blur-[180px] pointer-events-none -z-10" />

          <div className="container px-2 sm:px-6 pt-0 sm:pt-4 pb-12 sm:pb-20 max-w-7xl mx-auto space-y-3 sm:space-y-10">
              
                            {/* === 內容區塊 === */}
              <div className="space-y-8 sm:space-y-12">
                  {/* 正在募集中的福袋 (3D 旋轉門紅包袋舞台) */}
                  <section className="space-y-1 sm:space-y-5 -mt-2 sm:mt-0">

                      {/* 內容展台 */}
                      {finalIsLoading ? (
                          <div className="h-[380px] sm:h-[460px] w-full flex items-center justify-center">
                              <Skeleton className="w-[220px] h-[340px] sm:w-[250px] sm:h-[400px] rounded-[2rem] bg-rose-950/40 border border-amber-500/20" />
                          </div>
                      ) : inProgressBags.length > 0 ? (
                          <>
                              {viewMode === 'carousel' ? (
                                  <div className="space-y-4">
                                      {/* 3D 旋轉門本體 */}
                                      <RevolvingDoorLuckyBagCarousel
                                          bags={inProgressBags}
                                          onActiveIndexChange={setActiveCarouselIndex}
                                          onSelectBag={(bag) => router.push(`/lucky-bags/${bag.id}`)}
                                      />

                                      {/* 當前選中紅包袋的精緻高亮資訊欄 (Quick Control Dock) */}
                                      {currentActiveBag && (
                                          <div className="max-w-2xl mx-auto rounded-2xl bg-gradient-to-r from-[#450a0a]/95 via-[#2a040b]/95 to-[#450a0a]/95 border-2 border-amber-400/50 p-3 sm:p-4 shadow-[0_10px_30px_rgba(0,0,0,0.8)] backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3">
                                              <div className="flex items-center gap-3 w-full sm:w-auto">
                                                  <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/50 flex items-center justify-center shrink-0">
                                                      <Crown className="w-5 h-5 text-amber-300" />
                                                  </div>
                                                  <div className="min-w-0 flex-1">
                                                      <div className="flex items-center gap-2">
                                                          <span className="text-[10px] font-black text-amber-300 uppercase tracking-wider">
                                                              當前紅包焦點
                                                          </span>
                                                          <span className="text-[10px] text-yellow-300 font-mono">
                                                              (已認購 {currentActiveBag.participantCount} / {currentActiveBag.totalParticipants} 格)
                                                          </span>
                                                      </div>
                                                      <p className="text-sm sm:text-base font-black text-white truncate">
                                                          {currentActiveBag.name}
                                                      </p>
                                                  </div>
                                              </div>

                                              <Link
                                                  href={`/lucky-bags/${currentActiveBag.id}`}
                                                  className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 font-headline font-black text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-6 py-2.5 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.5)] hover:brightness-110 active:scale-95 transition-all border border-yellow-200"
                                              >
                                                  <span>拆開紅包 · 立即選位</span>
                                                  <ArrowRight className="w-4 h-4" />
                                              </Link>
                                          </div>
                                      )}
                                  </div>
                              ) : (
                                  /* 清單模式：紅包袋橫式列表 */
                                  <div className="grid grid-cols-1 gap-4 sm:gap-6">
                                      {inProgressBags.map((bag, index) => (
                                          <LuckyBagRedPacketCard
                                              key={bag.id}
                                              bag={bag}
                                              priority={index < 3}
                                              variant="standard"
                                          />
                                      ))}
                                  </div>
                              )}

                          </>
                      ) : (
                          <div className="py-16 text-center rounded-2xl bg-[#1a0205] border border-dashed border-amber-900/50 p-8">
                              <LuckyBagIcon className="h-12 w-12 mx-auto mb-3 text-amber-700" />
                              <h3 className="text-base font-bold text-amber-200 mb-1">目前尚無進行中的紅包福袋</h3>
                              <p className="text-xs text-amber-400/60">新福袋即將上線，敬請期待官方消息公告</p>
                          </div>
                      )}
                  </section>

                  {/* 歷史精彩回顧（已開獎） */}
                  {completedBags.length > 0 && (
                      <section className="space-y-4 sm:space-y-6 pt-4 border-t border-amber-900/30">
                          <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2 sm:gap-2.5">
                                  <div className="p-1.5 sm:p-2 rounded-xl bg-slate-900 border border-amber-500/30 text-amber-400">
                                      <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
                                  </div>
                                  <h2 className="text-base sm:text-xl font-black font-headline tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                                      歷史精彩回顧
                                  </h2>
                              </div>
                          </div>

                          <div className="grid grid-cols-1 gap-4 sm:gap-6">
                              {completedBags.slice(0, showAllCompleted ? undefined : 3).map((bag) => (
                                  <LuckyBagRedPacketCard
                                      key={bag.id}
                                      bag={bag}
                                      variant="standard"
                                  />
                              ))}
                          </div>
                          
                          {!showAllCompleted && completedBags.length > 3 && (
                              <div className="mt-8 flex justify-center">
                                  <Button 
                                      variant="outline" 
                                      onClick={() => setShowAllCompleted(true)}
                                      className="rounded-xl px-8 h-11 border-amber-900/50 bg-[#2a040b] hover:bg-[#3f0713] hover:border-amber-500/50 text-amber-200 font-bold text-xs"
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
