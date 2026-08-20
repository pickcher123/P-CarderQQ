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
        <div className="min-h-[calc(100vh-4rem)] w-full py-4 sm:py-8 px-3 sm:px-6 lg:px-8 max-w-7xl mx-auto animate-fade-in">
            <div className="mb-6 flex items-center justify-between">
                <Button 
                    variant="ghost" 
                    onClick={() => router.push('/lucky-bags')} 
                    className="hover:bg-white/10 font-bold text-slate-200 hover:text-white group rounded-xl px-4 py-2 text-sm bg-slate-900/60 border border-white/10 backdrop-blur-md shadow-sm transition-all"
                >
                    <ArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform text-amber-400" /> 
                    返回福袋清單
                </Button>
                
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-400 hidden sm:inline-block">公平募集制福袋</span>
                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                </div>
            </div>

            <div className="w-full">
                <LuckBagDetailView luckBag={luckBagWithData} />
            </div>
        </div>
    );
}
