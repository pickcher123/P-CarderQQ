'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useRequest, useFirestore, useMemoFirebase } from '@/firebase';
import { collection } from 'firebase/firestore';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Package, Swords, Ticket, Users2, ChevronRight, Layers, CreditCard, Plus, UploadCloud, Sparkles } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface CardData {
    id: string;
    source?: string;
    isRecycled?: boolean;
}

const AREAS = [
    { 
        id: 'all', 
        name: '全部卡片資產庫', 
        icon: Layers, 
        desc: '查看與管理全站所有卡片，支援全庫存搜尋與批次上傳', 
        color: 'text-slate-900', 
        bg: 'bg-slate-100',
        badge: '全庫總覽',
        badgeColor: 'bg-slate-900 text-white'
    },
    { 
        id: 'draw', 
        name: '抽卡區域資產', 
        icon: Package, 
        desc: '出現在轉蛋與抽卡卡池中的專屬卡片配置', 
        color: 'text-cyan-700', 
        bg: 'bg-cyan-50',
        badge: '轉蛋玩法',
        badgeColor: 'bg-cyan-100 text-cyan-800'
    },
    { 
        id: 'betting', 
        name: '拼卡區域資產', 
        icon: Swords, 
        desc: '出現在拼卡競猜專區中的卡片獎品資產', 
        color: 'text-pink-700', 
        bg: 'bg-pink-50',
        badge: '拼卡玩法',
        badgeColor: 'bg-pink-100 text-pink-800'
    },
    { 
        id: 'lucky-bag', 
        name: '福袋區域資產', 
        icon: Ticket, 
        desc: '配置為福袋專案的頭獎、貳獎或普獎卡片', 
        color: 'text-amber-700', 
        bg: 'bg-amber-50',
        badge: '福袋專案',
        badgeColor: 'bg-amber-100 text-amber-800'
    },
    { 
        id: 'group-break', 
        name: '直播團拆資產', 
        icon: Users2, 
        desc: '專供直播開盒與團拆分配的獨立卡片庫存', 
        color: 'text-emerald-700', 
        bg: 'bg-emerald-50',
        badge: '團拆項目',
        badgeColor: 'bg-emerald-100 text-emerald-800'
    },
];

export default function CardsAdminAreaListPage() {
    const router = useRouter();
    const firestore = useFirestore();

    const { data: allCards, isLoading: isLoadingCards } = useRequest<CardData[]>(useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]));
    const { data: cardPools } = useRequest<{cards?: {cardId: string}[]}[]>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));
    const { data: bettingItems } = useRequest<{allCardIds: string[]}[]>(useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]));
    const { data: luckBags } = useRequest<{prizes?: any, otherPrizes?: {cardId: string}[]}[]>(useMemoFirebase(() => firestore ? collection(firestore, 'luckBags') : null, [firestore]));

    const counts = useMemo(() => {
        if (!allCards) return { draw: 0, betting: 0, 'lucky-bag': 0, 'group-break': 0, all: 0 };
        const allCardIdSet = new Set(allCards.map(c => c.id));

        const drawIds = new Set<string>();
        cardPools?.forEach(p => p.cards?.forEach(c => {
            if (allCardIdSet.has(c.cardId)) drawIds.add(c.cardId);
        }));

        const bettingIds = new Set<string>();
        bettingItems?.forEach(i => i.allCardIds?.forEach(id => {
            if (allCardIdSet.has(id)) bettingIds.add(id);
        }));

        const luckyBagIds = new Set<string>();
        luckBags?.forEach(b => {
            if(b.prizes?.first && allCardIdSet.has(b.prizes.first)) luckyBagIds.add(b.prizes.first);
            if(b.prizes?.second && allCardIdSet.has(b.prizes.second)) luckyBagIds.add(b.prizes.second);
            if(b.prizes?.third && allCardIdSet.has(b.prizes.third)) luckyBagIds.add(b.prizes.third);
            b.otherPrizes?.forEach(p => {
                if (allCardIdSet.has(p.cardId)) luckyBagIds.add(p.cardId);
            });
        });

        const groupBreakCount = allCards.filter(c => c.source === 'group-break').length;

        return {
            draw: drawIds.size,
            betting: bettingIds.size,
            'lucky-bag': luckyBagIds.size,
            'group-break': groupBreakCount,
            all: allCards.length
        };
    }, [allCards, cardPools, bettingItems, luckBags]);

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <CreditCard className="h-7 w-7 text-primary" /> 卡片資產管理
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                        統一管理各遊戲模組的卡牌庫存、分配狀況與批次圖片上傳。
                    </p>
                </div>
                
                <div className="flex items-center gap-3">
                    <Button 
                        onClick={() => router.push('/admin/cards/area/all')}
                        className="bg-slate-900 text-white hover:bg-slate-800 font-bold rounded-xl shadow-xs"
                    >
                        <Plus className="mr-2 h-4 w-4" /> 新增卡片 / 批量上傳
                    </Button>
                </div>
            </div>

            {/* Quick KPI stats */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {AREAS.map((a) => {
                    const count = counts[a.id as keyof typeof counts];
                    return (
                        <div 
                            key={a.id} 
                            onClick={() => router.push(`/admin/cards/area/${a.id}`)}
                            className="p-4 rounded-2xl bg-white border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer group"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-[11px] font-black text-slate-400 uppercase tracking-wider">{a.badge}</span>
                                <a.icon className={cn("h-4 w-4", a.color)} />
                            </div>
                            <div className="text-2xl font-black text-slate-900 font-code">
                                {isLoadingCards ? <Skeleton className="h-7 w-12" /> : count.toLocaleString()}
                            </div>
                            <p className="text-[10px] font-bold text-slate-500 mt-0.5">張卡片資產</p>
                        </div>
                    );
                })}
            </div>

            {/* Area Grid Cards */}
            <div className="space-y-4">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-wider">選擇管理區域</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {AREAS.map((area) => (
                        <Card 
                            key={area.id} 
                            onClick={() => router.push(`/admin/cards/area/${area.id}`)}
                            className="border-slate-200/80 hover:border-slate-300 bg-white hover:shadow-md transition-all cursor-pointer group rounded-2xl overflow-hidden"
                        >
                            <CardContent className="p-6 flex items-center justify-between gap-4">
                                <div className="flex items-start gap-4">
                                    <div className={cn("p-3.5 rounded-2xl shrink-0 transition-transform group-hover:scale-105", area.bg, area.color)}>
                                        <area.icon className="h-6 w-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-base font-black text-slate-900 group-hover:text-primary transition-colors">
                                                {area.name}
                                            </h3>
                                            <Badge className={cn("text-[10px] font-bold border-none", area.badgeColor)}>
                                                {area.badge}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-slate-500 font-medium line-clamp-2">
                                            {area.desc}
                                        </p>
                                        <div className="pt-2 flex items-center gap-2 text-xs font-bold text-slate-700">
                                            <span>庫存數量：</span>
                                            {isLoadingCards ? (
                                                <Skeleton className="h-4 w-10 inline-block" />
                                            ) : (
                                                <span className="font-code font-black text-slate-900">
                                                    {counts[area.id as keyof typeof counts]} 張
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="h-9 w-9 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-slate-900 group-hover:bg-slate-100 shrink-0 transition-colors">
                                    <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>
        </div>
    );
}
