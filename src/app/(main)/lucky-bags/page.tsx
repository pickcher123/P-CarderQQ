'use client';

import { Button } from '@/components/ui/button';
import { 
  Users, Gem, Trophy, Package, ChevronDown, ChevronUp, Sparkles, ChevronRight, 
  Settings, Disc3, Info, Flame, ShieldCheck, ArrowRight, Zap, Target,
  Dices, Percent, Award, Coins, Crown, LayoutGrid, RotateCw, HelpCircle
} from 'lucide-react';
import { LuckyBagIcon, PPlusIcon } from '@/components/icons';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, getDocs, orderBy, getCountFromServer, where, documentId } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import { useEffect, useState, useMemo, useCallback } from 'react';
import { SafeImage } from '@/components/safe-image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useSystemConfig } from '@/components/providers/system-config-provider';
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

// 模組級記憶體快取：切換分頁回到福袋頁時 0ms 秒開，且只按需查詢福袋獎項卡片（不下載整個 allCards 集合）
let cachedLuckyBags: LuckBag[] = [];
let cachedParticipantCounts: Record<string, number> = {};
const cachedPrizeCardsMap = new Map<string, CardData>();

export default function LuckyBagsPage() {
    const firestore = useFirestore();
    const router = useRouter();
    const [participantCounts, setParticipantCounts] = useState<Record<string, number>>(() => ({ ...cachedParticipantCounts }));
    const [prizeCardsVersion, setPrizeCardsVersion] = useState(0);
    const [showAllCompleted, setShowAllCompleted] = useState(false);
    const [activeCarouselIndex, setActiveCarouselIndex] = useState(0);
    const [viewMode, setViewMode] = useState<'carousel' | 'list'>('carousel');

    const { systemConfig } = useSystemConfig();

    const luckBagsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'luckBags'), orderBy('order', 'asc'));
    }, [firestore]);

    const { data: liveLuckyBags, isLoading: isLoadingBags } = useCollection<LuckBag>(luckBagsQuery);

    const allLuckyBags = useMemo(() => {
        if (liveLuckyBags && liveLuckyBags.length > 0) {
            cachedLuckyBags = liveLuckyBags;
            return liveLuckyBags;
        }
        return liveLuckyBags ?? (cachedLuckyBags.length > 0 ? cachedLuckyBags : null);
    }, [liveLuckyBags]);

    // 只按需查詢福袋實際用到的獎項卡片（每批 30 張），取代原本下載整個 allCards 資料庫集合
    useEffect(() => {
        if (!allLuckyBags || !firestore) return;
        const neededIds = new Set<string>();
        for (const bag of allLuckyBags) {
            if (bag.prizes?.first) neededIds.add(bag.prizes.first);
            if (bag.prizes?.second) neededIds.add(bag.prizes.second);
            if (bag.prizes?.third) neededIds.add(bag.prizes.third);
            bag.otherPrizes?.forEach((p) => {
                if (p.type !== 'points' && p.cardId) neededIds.add(p.cardId);
            });
        }

        const missingIds = Array.from(neededIds).filter((id) => !cachedPrizeCardsMap.has(id));
        if (missingIds.length === 0) return;

        let cancelled = false;
        const chunks: string[][] = [];
        for (let i = 0; i < missingIds.length; i += 30) {
            chunks.push(missingIds.slice(i, i + 30));
        }

        Promise.all(
            chunks.map(async (chunk) => {
                const snap = await getDocs(
                    query(collection(firestore, 'allCards'), where(documentId(), 'in', chunk))
                );
                snap.forEach((d) => {
                    cachedPrizeCardsMap.set(d.id, { id: d.id, ...(d.data() as Omit<CardData, 'id'>) });
                });
            })
        ).then(() => {
            if (!cancelled) {
                setPrizeCardsVersion((v) => v + 1);
            }
        }).catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [allLuckyBags, firestore]);

    // 僅針對「進行中」的福袋並行查詢參與格數，已開獎福袋直接使用 totalParticipants，大幅加快載入速度
    useEffect(() => {
        if (!allLuckyBags || !firestore) return;
        const activeBags = allLuckyBags.filter(b => b.status !== '已開獎');
        if (activeBags.length === 0) return;

        let cancelled = false;
        Promise.all(
            activeBags.map(async (bag) => {
                try {
                    const purchasesColRef = collection(firestore, 'luckBags', bag.id, 'luckBagPurchases');
                    const countSnapshot = await getCountFromServer(query(purchasesColRef));
                    return [bag.id, countSnapshot.data().count] as const;
                } catch {
                    return [bag.id, 0] as const;
                }
            })
        ).then((entries) => {
            if (cancelled) return;
            setParticipantCounts((prev) => {
                const next = { ...prev };
                for (const [id, count] of entries) {
                    next[id] = count;
                }
                cachedParticipantCounts = next;
                return next;
            });
        });

        return () => {
            cancelled = true;
        };
    }, [allLuckyBags, firestore]);

    // 即時組合福袋資料，不阻塞等待所有子集合查詢
    const luckyBagsWithData = useMemo<LuckBagWithCount[]>(() => {
        void prizeCardsVersion;
        if (!allLuckyBags) return [];

        return allLuckyBags.map((bag) => {
            const participantCount =
                bag.status === '已開獎'
                    ? (bag.totalParticipants || 0)
                    : (participantCounts[bag.id] ?? 0);

            const prizeCards = {
                first: bag.prizes?.first ? cachedPrizeCardsMap.get(bag.prizes.first) : undefined,
                second: bag.prizes?.second ? cachedPrizeCardsMap.get(bag.prizes.second) : undefined,
                third: bag.prizes?.third ? cachedPrizeCardsMap.get(bag.prizes.third) : undefined,
            };

            const otherPrizesList = (bag.otherPrizes || [])
                .filter(p => p.type !== 'points')
                .map(p => {
                    const card = cachedPrizeCardsMap.get(p.cardId);
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
        });
    }, [allLuckyBags, participantCounts, prizeCardsVersion]);

    // 預載進行中福袋的頭獎卡圖片至瀏覽器快取，旋轉切換不卡頓
    useEffect(() => {
        if (typeof window === 'undefined' || luckyBagsWithData.length === 0) return;
        luckyBagsWithData.forEach((bag) => {
            if (bag.status !== '已開獎' && bag.prizeCards?.first?.imageUrl) {
                const img = new window.Image();
                img.decoding = 'async';
                img.src = bag.prizeCards.first.imageUrl;
            }
        });
    }, [luckyBagsWithData]);

    const { inProgressBags, completedBags } = useMemo(() => {
        const inProgress = luckyBagsWithData.filter(bag => bag.status !== '已開獎');
        const completed = luckyBagsWithData.filter(bag => bag.status === '已開獎');
        return { inProgressBags: inProgress, completedBags: completed };
    }, [luckyBagsWithData]);

    const finalIsLoading = isLoadingBags && luckyBagsWithData.length === 0;

    if (!finalIsLoading && systemConfig?.featureFlags?.isLuckyBagEnabled === false) {
      return (
        <div className="container py-32 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6 animate-fade-in-up">
          <div className="p-8 rounded-full bg-[#0a0f1c]/90 border border-amber-300/30 shadow-[0_0_40px_rgba(251,191,36,0.12)]">
            <Settings className="w-16 h-16 text-[#FDE68A]" />
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-black font-headline tracking-widest text-white">維護中</h2>
            <p className="text-slate-400 text-sm max-w-md mx-auto leading-relaxed">
              幸運福袋目前暫停開放，我們正在進行優化與補貨作業，請稍後再試。
            </p>
          </div>
          <Button asChild variant="outline" className="h-11 px-8 rounded-xl border-amber-300/40 text-[#FDE68A] hover:bg-amber-400/15 font-bold">
            <Link href="/">返回大廳</Link>
          </Button>
        </div>
      );
    }

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
                                                          <span className="text-[11px] font-semibold text-amber-300 tracking-wide">
                                                              當前紅包焦點
                                                          </span>
                                                          <span className="text-[11px] text-amber-100/80 font-mono tabular-nums">
                                                              (已認購 {currentActiveBag.participantCount} / {currentActiveBag.totalParticipants} 格)
                                                          </span>
                                                      </div>
                                                      <p className="text-sm sm:text-base font-bold tracking-wide text-[#FFF7E2] truncate mt-0.5">
                                                          {currentActiveBag.name}
                                                      </p>
                                                  </div>
                                              </div>

                                              <Link
                                                  href={`/lucky-bags/${currentActiveBag.id}`}
                                                  className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 font-sans font-bold tracking-wide text-xs sm:text-sm text-slate-950 bg-gradient-to-r from-yellow-400 via-amber-300 to-yellow-500 px-6 py-2.5 rounded-xl shadow-[0_0_20px_rgba(245,158,11,0.45)] hover:brightness-110 active:scale-95 transition-all border border-yellow-200"
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
