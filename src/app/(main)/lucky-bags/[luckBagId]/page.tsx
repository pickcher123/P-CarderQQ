'use client';

import { useParams, useRouter } from 'next/navigation';
import { useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, getDocs, query, where, getCountFromServer } from 'firebase/firestore';
import { LuckBagDetailView } from '@/components/luck-bag-detail-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';
import type { LuckBag, LuckBagWithCount, CardData } from '@/app/(main)/lucky-bags/page';

export default function LuckyBagPage() {
    const params = useParams();
    const luckBagId = params.luckBagId as string;
    const firestore = useFirestore();
    const router = useRouter();
    
    const [luckBagWithData, setLuckBagWithData] = useState<LuckBagWithCount | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const luckBagRef = useMemoFirebase(() => {
        if (!firestore || !luckBagId) return null;
        return doc(firestore, 'luckBags', luckBagId);
    }, [firestore, luckBagId]);

    const { data: rawLuckBag, isLoading: isLoadingBag } = useDoc<LuckBag>(luckBagRef);
    const { data: allCards, isLoading: isLoadingCards } = useCollection<CardData>(useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]));

    useEffect(() => {
        const fetchExtraData = async () => {
            if (!rawLuckBag || !firestore || !allCards) return;

            setIsLoading(true);
            try {
                const purchasesColRef = collection(firestore, 'luckBags', rawLuckBag.id, 'luckBagPurchases');
                const countSnapshot = await getCountFromServer(query(purchasesColRef));
                const participantCount = countSnapshot.data().count;

                const cardMap = new Map(allCards.map(c => [c.id, c]));

                const prizeCards = {
                    first: rawLuckBag.prizes?.first ? cardMap.get(rawLuckBag.prizes.first) : undefined,
                    second: rawLuckBag.prizes?.second ? cardMap.get(rawLuckBag.prizes.second) : undefined,
                    third: rawLuckBag.prizes?.third ? cardMap.get(rawLuckBag.prizes.third) : undefined,
                };
                
                const otherPrizesList = (rawLuckBag.otherPrizes || [])
                    .filter(p => p.type !== 'points')
                    .map(p => {
                        const card = cardMap.get(p.cardId);
                        return card ? { ...card, prizeId: p.prizeId } : null;
                    })
                    .filter((c): c is CardData & { prizeId: string } => !!c);
                
                const otherPointsList = (rawLuckBag.otherPrizes || [])
                    .filter(p => p.type === 'points')
                    .map(p => ({ prizeId: p.prizeId, points: p.points || 0 }));

                setLuckBagWithData({
                    ...rawLuckBag,
                    participantCount,
                    prizeCards,
                    otherPrizesList,
                    otherPointsList,
                });
            } catch (error) {
                console.error("Error fetching luck bag data:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (!isLoadingBag && !isLoadingCards && rawLuckBag) {
            fetchExtraData();
        }
    }, [rawLuckBag, allCards, firestore, isLoadingBag, isLoadingCards]);

    const finalLoading = isLoadingBag || isLoadingCards || isLoading;

    if (finalLoading) {
        return (
            <div className="container py-20 flex flex-col items-center justify-center min-h-[60vh] gap-6">
                <Loader2 className="w-16 h-16 animate-spin text-accent" />
                <p className="font-headline tracking-[0.3em] text-accent text-xl animate-pulse uppercase">Syncing Lucky Bag Module</p>
            </div>
        );
    }

    if (!luckBagWithData) {
        return (
            <div className="container py-20 text-center">
                <h2 className="text-2xl font-bold">找不到此福袋活動。</h2>
                <Button variant="outline" className="mt-4 rounded-xl" onClick={() => router.push('/lucky-bags')}>
                    返回福袋清單
                </Button>
            </div>
        );
    }

    return (
        <div className="min-h-[calc(100vh-4rem)] w-full py-3 sm:py-6 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-fade-in relative">
            {/* 喜慶暖金環境氛圍光 (Festive Warm Gold Ambient Lighting) */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] bg-gradient-to-b from-amber-500/15 via-yellow-600/10 to-transparent blur-[120px] pointer-events-none -z-10" />

            {/* 頂部操作列 */}
            <div className="mb-4 sm:mb-6 flex items-center justify-between">
                <Button 
                    variant="ghost" 
                    onClick={() => router.push('/lucky-bags')} 
                    className="hover:bg-amber-500/20 font-black text-amber-200 hover:text-yellow-200 group rounded-xl px-4 py-2 text-xs sm:text-sm bg-[#181308]/90 border border-amber-500/40 backdrop-blur-md shadow-[0_2px_12px_rgba(0,0,0,0.5)] transition-all cursor-pointer"
                >
                    <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform text-amber-400" /> 
                    返回福袋專區
                </Button>
                
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#181308]/90 border border-amber-500/30 text-amber-300 text-xs font-bold shadow-sm">
                    <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                    <span>公平募集 · 金禧福袋</span>
                </div>
            </div>

            <div className="w-full">
                <LuckBagDetailView luckBag={luckBagWithData} />
            </div>
        </div>
    );
}
