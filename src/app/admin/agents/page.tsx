'use client';

import { useCollection, useFirestore, useMemoFirebase, useUser, useRequest } from '@/firebase';
import { collection, collectionGroup, query, addDoc, doc, deleteDoc } from 'firebase/firestore';
import type { UserProfile } from '@/types/user-profile';
import { useEffect } from 'react';

const SUPER_ADMIN_EMAIL = 'pickcher123@gmail.com';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth, getYear, getMonth } from 'date-fns';
import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2, ChevronDown, ChevronUp, Layers, DollarSign, Eye, Sparkles, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

interface LuckBagPurchase {
    id: string;
    agentId: string;
    agentName: string;
    purchasedAt: { seconds: number };
    luckBagId: string;
    spotNumber: number;
    username?: string;
    userId?: string;
}

interface DrawLog {
    id: string;
    poolId: string;
    agentId: string;
    drawnAt: { seconds: number };
    cost: number;
    count: number;
    userId?: string;
}

interface CardPoolItem {
    id: string;
    name?: string;
    price?: number;
    currency?: 'diamond' | 'p-point';
    agentId?: string;
}

interface LuckBagItem {
    id: string;
    name?: string;
    price?: number;
    currency?: 'diamond' | 'p-point';
    agentId?: string;
}

const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);
const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i + 1}月` }));

export default function AgentsAdminPage() {
    const firestore = useFirestore();
    const { user: authUser } = useUser();

    // 讀取當前使用者資料
    const userProfileQuery = useMemoFirebase(() => {
        if (!firestore || !authUser?.uid) return null;
        return doc(firestore, 'users', authUser.uid);
    }, [firestore, authUser?.uid]);
    const { data: userProfile } = useRequest<UserProfile>(userProfileQuery);

    const isSuperAdmin = authUser?.email === SUPER_ADMIN_EMAIL;
    const assignedAgentId = userProfile?.agentId;
    const isSalesOnly = !isSuperAdmin && !!assignedAgentId;

    const [currentYear, setCurrentYear] = useState(getYear(new Date()).toString());
    const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()).toString());
    const [newAgentName, setNewAgentName] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [agentFilter, setAgentFilter] = useState<string>('all');

    useEffect(() => {
        if (isSalesOnly && assignedAgentId) {
            setAgentFilter(assignedAgentId);
        }
    }, [isSalesOnly, assignedAgentId]);
    
    // 控制展開哪些業務的套件明細
    const [expandedAgents, setExpandedAgents] = useState<Record<string, boolean>>({});
    // 檢視特定「套」的交易明細彈窗
    const [selectedSetDetails, setSelectedSetDetails] = useState<{
        agentName: string;
        setName: string;
        unitPrice: number;
        currency: string;
        logs: Array<{ id: string; time: string; buyer: string; count: number; amount: number; detailsText?: string }>;
    } | null>(null);

    // 業務清單 query
    const agentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'agents'));
    }, [firestore]);
    const { data: agents } = useCollection<{ id: string, name: string }>(agentsQuery);

    // 卡池集合 query (用來獲得「套」的名稱與單價)
    const cardPoolsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'cardPools'));
    }, [firestore]);
    const { data: cardPools } = useCollection<CardPoolItem>(cardPoolsQuery);

    // 福袋集合 query
    const luckBagsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'luckBags'));
    }, [firestore]);
    const { data: luckBags } = useCollection<LuckBagItem>(luckBagsQuery);

    // 抽卡日誌 query
    const drawLogsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collectionGroup(firestore, 'drawnCardLogs'));
    }, [firestore]);

    // 福袋購買 query
    const purchasesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collectionGroup(firestore, 'luckBagPurchases'));
    }, [firestore]);

    const { data: purchases, isLoading: isLoadingPurchases } = useCollection<LuckBagPurchase>(purchasesQuery);
    const { data: drawLogs, isLoading: isLoadingDraws } = useCollection<DrawLog>(drawLogsQuery);
    const isLoading = isLoadingPurchases || isLoadingDraws;

    // 建立 ID 對應名稱與價格的地圖
    const cardPoolMap = useMemo(() => {
        const map = new Map<string, CardPoolItem>();
        cardPools?.forEach(p => map.set(p.id, p));
        return map;
    }, [cardPools]);

    const luckBagMap = useMemo(() => {
        const map = new Map<string, LuckBagItem>();
        luckBags?.forEach(b => map.set(b.id, b));
        return map;
    }, [luckBags]);

    const agentNameMap = useMemo(() => {
        const map = new Map<string, string>();
        agents?.forEach(a => map.set(a.id, a.name));
        return map;
    }, [agents]);

    const handleAddAgent = async () => {
        if (!firestore || !newAgentName.trim()) return;
        await addDoc(collection(firestore, 'agents'), { name: newAgentName.trim() });
        setNewAgentName('');
        setIsAddDialogOpen(false);
    };

    const handleDeleteAgent = async (id: string) => {
        if (!firestore) return;
        await deleteDoc(doc(firestore, 'agents', id));
    };

    const toggleAgentExpand = (agentId: string) => {
        setExpandedAgents(prev => ({
            ...prev,
            [agentId]: !prev[agentId]
        }));
    };

    // 依年月過濾 Purchases
    const filteredPurchases = useMemo(() => {
        if (!purchases) return [];
        const selectedDate = new Date(parseInt(currentYear), parseInt(currentMonth));
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        
        return purchases.filter(p => {
            if (!p.purchasedAt || !p.agentId) return false;
            const pDate = new Date(p.purchasedAt.seconds * 1000);
            return pDate >= monthStart && pDate <= monthEnd;
        });
    }, [purchases, currentYear, currentMonth]);

    // 依年月過濾 Draws
    const filteredDraws = useMemo(() => {
        if (!drawLogs) return [];
        const selectedDate = new Date(parseInt(currentYear), parseInt(currentMonth));
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        
        return drawLogs.filter(d => {
            if (!d.drawnAt || !d.agentId) return false;
            const dDate = new Date(d.drawnAt.seconds * 1000);
            return dDate >= monthStart && dDate <= monthEnd;
        });
    }, [drawLogs, currentYear, currentMonth]);

    // **核心：聚合業務與旗下「每一套」的詳細銷售數據**
    const agentDetailedStats = useMemo(() => {
        const stats: Record<string, {
            agentId: string;
            agentName: string;
            totalPacksCount: number; // 總銷售套數/包數/抽數
            totalRevenue: number;    // 總金額
            sets: Record<string, {
                setId: string;
                setName: string;
                setType: 'cardPool' | 'luckBag' | 'other';
                unitPrice: number;
                currency: 'diamond' | 'p-point';
                salesCount: number;    // 此套當月總售出數
                totalAmount: number;   // 此套當月總金額
                logs: Array<{
                    id: string;
                    time: string;
                    buyer: string;
                    count: number;
                    amount: number;
                    detailsText?: string;
                }>;
            }>;
        }> = {};

        // 初始化已知業務
        agents?.forEach(agent => {
            if (agentFilter !== 'all' && agent.id !== agentFilter) return;
            stats[agent.id] = {
                agentId: agent.id,
                agentName: agent.name,
                totalPacksCount: 0,
                totalRevenue: 0,
                sets: {}
            };
        });

        // 處理抽卡/卡池 Logs
        filteredDraws.forEach(d => {
            const aId = d.agentId || 'unknown';
            if (agentFilter !== 'all' && aId !== agentFilter) return;

            if (!stats[aId]) {
                stats[aId] = {
                    agentId: aId,
                    agentName: agentNameMap.get(aId) || '未知業務',
                    totalPacksCount: 0,
                    totalRevenue: 0,
                    sets: {}
                };
            }

            const poolInfo = cardPoolMap.get(d.poolId);
            const setId = d.poolId || 'unknown_pool';
            const setName = poolInfo?.name || `卡池 [${setId.slice(0, 6)}]`;
            const unitPrice = poolInfo?.price || (d.count > 0 ? Math.round(d.cost / d.count) : d.cost);
            const currency = poolInfo?.currency || 'diamond';
            const count = d.count || 1;
            const amount = d.cost || (unitPrice * count);

            stats[aId].totalPacksCount += count;
            stats[aId].totalRevenue += amount;

            if (!stats[aId].sets[setId]) {
                stats[aId].sets[setId] = {
                    setId,
                    setName,
                    setType: 'cardPool',
                    unitPrice,
                    currency,
                    salesCount: 0,
                    totalAmount: 0,
                    logs: []
                };
            }

            stats[aId].sets[setId].salesCount += count;
            stats[aId].sets[setId].totalAmount += amount;

            const timeStr = d.drawnAt?.seconds ? format(new Date(d.drawnAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '未知時間';
            stats[aId].sets[setId].logs.push({
                id: d.id,
                time: timeStr,
                buyer: d.userId ? `用戶 ${d.userId.slice(0, 6)}` : '匿名藏友',
                count,
                amount,
                detailsText: `抽卡 ${count} 抽`
            });
        });

        // 處理福袋 Purchases
        filteredPurchases.forEach(p => {
            const aId = p.agentId || 'unknown';
            if (agentFilter !== 'all' && aId !== agentFilter) return;

            if (!stats[aId]) {
                stats[aId] = {
                    agentId: aId,
                    agentName: p.agentName || agentNameMap.get(aId) || '未知業務',
                    totalPacksCount: 0,
                    totalRevenue: 0,
                    sets: {}
                };
            }

            const luckBagInfo = luckBagMap.get(p.luckBagId);
            const setId = p.luckBagId || 'unknown_luckbag';
            const setName = luckBagInfo?.name || `幸運福袋 [${setId.slice(0, 6)}]`;
            const unitPrice = luckBagInfo?.price || 100;
            const currency = luckBagInfo?.currency || 'p-point';
            const count = 1;
            const amount = unitPrice;

            stats[aId].totalPacksCount += count;
            stats[aId].totalRevenue += amount;

            if (!stats[aId].sets[setId]) {
                stats[aId].sets[setId] = {
                    setId,
                    setName,
                    setType: 'luckBag',
                    unitPrice,
                    currency,
                    salesCount: 0,
                    totalAmount: 0,
                    logs: []
                };
            }

            stats[aId].sets[setId].salesCount += count;
            stats[aId].sets[setId].totalAmount += amount;

            const timeStr = p.purchasedAt?.seconds ? format(new Date(p.purchasedAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '未知時間';
            stats[aId].sets[setId].logs.push({
                id: p.id,
                time: timeStr,
                buyer: p.username || (p.userId ? `用戶 ${p.userId.slice(0, 6)}` : '匿名藏友'),
                count: 1,
                amount,
                detailsText: `購買幸運福袋 ${p.spotNumber ? `(號碼 #${p.spotNumber})` : ''}`
            });
        });

        return Object.values(stats);
    }, [agents, filteredDraws, filteredPurchases, agentFilter, cardPoolMap, luckBagMap, agentNameMap]);

    // 全局 KPI 統計
    const totalKPI = useMemo(() => {
        let revenue = 0;
        let packs = 0;
        agentDetailedStats.forEach(a => {
            revenue += a.totalRevenue;
            packs += a.totalPacksCount;
        });
        return {
            totalRevenue: revenue,
            totalPacks: packs,
            activeAgents: agentDetailedStats.filter(a => a.totalPacksCount > 0).length
        };
    }, [agentDetailedStats]);

    return (
        <div className="container mx-auto p-6 md:p-8 space-y-8">
            {/* 頁面頂部標題與篩選 */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-headline text-3xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                        <Receipt className="h-8 w-8 text-primary" /> 業務銷售統計細節
                    </h1>
                    <p className="mt-1 text-slate-600 font-bold">查看各業務每個銷售套數、每一套銷售金額與交易細節明細。</p>
                </div>
                
                <div className="flex flex-wrap items-center gap-2">
                    <Select value={agentFilter} onValueChange={setAgentFilter} disabled={isSalesOnly}>
                        <SelectTrigger className="w-[150px] bg-white border-slate-200 font-bold shadow-sm">
                            <SelectValue placeholder="所有業務" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="font-bold">所有業務</SelectItem>
                            {agents?.map(agent => (
                                <SelectItem key={agent.id} value={agent.id} className="font-bold">{agent.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={currentYear} onValueChange={setCurrentYear}>
                        <SelectTrigger className="w-[110px] bg-white border-slate-200 font-bold shadow-sm">
                            <SelectValue placeholder="年份" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(year => (
                                <SelectItem key={year} value={year.toString()} className="font-bold">{year}年</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={currentMonth} onValueChange={setCurrentMonth}>
                        <SelectTrigger className="w-[110px] bg-white border-slate-200 font-bold shadow-sm">
                            <SelectValue placeholder="月份" />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map(month => (
                                <SelectItem key={month.value} value={month.value.toString()} className="font-bold">{month.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="font-bold bg-slate-900 text-white rounded-full shadow-md hover:bg-slate-800">
                                <UserPlus className="mr-2 h-4 w-4" /> 新增業務
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>新增業務成員</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>業務姓名 / 代號</Label>
                                    <Input value={newAgentName} onChange={e => setNewAgentName(e.target.value)} placeholder="例如：張小明 / 羅勝群" />
                                </div>
                                <Button onClick={handleAddAgent} className="w-full font-bold">確認新增</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* 全局數據指標 (KPI Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold text-slate-500 text-xs uppercase flex items-center justify-between">
                            <span>當月總銷售額</span>
                            <DollarSign className="h-4 w-4 text-emerald-600" />
                        </CardDescription>
                        <CardTitle className="text-3xl font-black text-slate-900">
                            {isLoading ? <Skeleton className="h-8 w-24" /> : `$${totalKPI.totalRevenue.toLocaleString()}`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-500 font-semibold">
                        跨業務當月銷售金額累積總額
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold text-slate-500 text-xs uppercase flex items-center justify-between">
                            <span>當月總銷售套數/抽數</span>
                            <Layers className="h-4 w-4 text-blue-600" />
                        </CardDescription>
                        <CardTitle className="text-3xl font-black text-slate-900">
                            {isLoading ? <Skeleton className="h-8 w-24" /> : totalKPI.totalPacks.toLocaleString()} <span className="text-sm font-bold text-slate-500">套</span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-500 font-semibold">
                        包含卡池套賞與福袋等銷售數
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-white to-slate-50">
                    <CardHeader className="pb-2">
                        <CardDescription className="font-bold text-slate-500 text-xs uppercase flex items-center justify-between">
                            <span>獲利活躍業務</span>
                            <UserPlus className="h-4 w-4 text-purple-600" />
                        </CardDescription>
                        <CardTitle className="text-3xl font-black text-slate-900">
                            {isLoading ? <Skeleton className="h-8 w-16" /> : `${totalKPI.activeAgents} / ${agents?.length || 0}`}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="text-xs text-slate-500 font-semibold">
                        當月有業績銷售紀錄的業務數
                    </CardContent>
                </Card>
            </div>

            {/* 主要區域：業務銷售與每套銷售金額細節 */}
            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-md">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <div>
                        <h2 className="font-headline text-xl font-black text-slate-900 flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-amber-500" /> 各業務每一套銷售金額統計列表
                        </h2>
                        <p className="text-xs text-slate-500 font-bold mt-1">
                            點擊「展開銷售細節」可完整檢視該業務旗下進行中的每一套卡池/福袋銷售金額與項目
                        </p>
                    </div>
                    <Badge variant="outline" className="font-bold bg-white text-slate-700">
                        {currentYear} 年 {parseInt(currentMonth) + 1} 月
                    </Badge>
                </div>

                {isLoading ? (
                    <div className="p-8 space-y-4">
                        <Skeleton className="h-16 w-full rounded-2xl" />
                        <Skeleton className="h-16 w-full rounded-2xl" />
                        <Skeleton className="h-16 w-full rounded-2xl" />
                    </div>
                ) : agentDetailedStats.length === 0 ? (
                    <div className="text-center py-24 text-slate-400 font-bold italic">
                        <p>此月份無任何業務銷售紀錄。</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {agentDetailedStats.map((agent) => {
                            const isExpanded = expandedAgents[agent.agentId] ?? true; // 預設展開
                            const setsList = Object.values(agent.sets);

                            return (
                                <div key={agent.agentId} className="transition-colors">
                                    {/* 業務摘要標頭 (Agent Header Row) */}
                                    <div 
                                        onClick={() => toggleAgentExpand(agent.agentId)}
                                        className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/80 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-slate-900 text-white font-black text-base flex items-center justify-center shadow-sm">
                                                {agent.agentName.slice(0, 1)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-headline text-lg font-black text-slate-900">{agent.agentName}</span>
                                                    <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 font-bold border-slate-200">
                                                        {setsList.length} 套銷售項目
                                                    </Badge>
                                                </div>
                                                <span className="text-xs text-slate-500 font-semibold">
                                                    業務代號 ID: {agent.agentId}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6 self-end sm:self-center">
                                            <div className="text-right">
                                                <div className="text-xs font-bold text-slate-400 uppercase">總銷售套數</div>
                                                <div className="font-black text-base text-slate-800">{agent.totalPacksCount.toLocaleString()} 套</div>
                                            </div>

                                            <div className="text-right">
                                                <div className="text-xs font-bold text-slate-400 uppercase">總銷售金額</div>
                                                <div className="font-black text-xl text-emerald-600">${agent.totalRevenue.toLocaleString()}</div>
                                            </div>

                                            <Button variant="ghost" size="sm" className="font-bold text-slate-600 gap-1 hover:bg-slate-200/60">
                                                {isExpanded ? (
                                                    <>收合細節 <ChevronUp className="h-4 w-4" /></>
                                                ) : (
                                                    <>展開每一套金額 <ChevronDown className="h-4 w-4" /></>
                                                )}
                                            </Button>
                                        </div>
                                    </div>

                                    {/* 展開區域：該業務銷售的每一套項目的金額細節 */}
                                    {isExpanded && (
                                        <div className="px-6 pb-6 pt-2 bg-slate-50/40 border-t border-slate-100">
                                            {setsList.length === 0 ? (
                                                <div className="p-4 text-center text-xs text-slate-400 font-bold italic">
                                                    該業務當月無進行中的卡套銷售數據。
                                                </div>
                                            ) : (
                                                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                                                    <Table>
                                                        <TableHeader className="bg-slate-100/70">
                                                            <TableRow>
                                                                <TableHead className="text-xs font-black text-slate-700 py-3 pl-6">銷售套數/卡池名稱</TableHead>
                                                                <TableHead className="text-xs font-black text-slate-700 py-3">類型</TableHead>
                                                                <TableHead className="text-xs font-black text-slate-700 py-3 text-right">單價</TableHead>
                                                                <TableHead className="text-xs font-black text-slate-700 py-3 text-right">當月銷售套/抽數</TableHead>
                                                                <TableHead className="text-xs font-black text-slate-700 py-3 text-right">該套小計銷售金額</TableHead>
                                                                <TableHead className="text-xs font-black text-slate-700 py-3 text-center pr-6">操作細節</TableHead>
                                                            </TableRow>
                                                        </TableHeader>
                                                        <TableBody>
                                                            {setsList.map((setItem) => (
                                                                <TableRow key={setItem.setId} className="hover:bg-slate-50">
                                                                    <TableCell className="pl-6 py-3 font-bold text-slate-900">
                                                                        <div className="flex items-center gap-2">
                                                                            <Layers className="h-4 w-4 text-indigo-500" />
                                                                            <span>{setItem.setName}</span>
                                                                        </div>
                                                                    </TableCell>
                                                                    <TableCell className="py-3">
                                                                        <Badge variant="outline" className={
                                                                            setItem.setType === 'cardPool' 
                                                                                ? 'bg-purple-50 text-purple-700 border-purple-200 font-bold'
                                                                                : 'bg-amber-50 text-amber-700 border-amber-200 font-bold'
                                                                        }>
                                                                            {setItem.setType === 'cardPool' ? '🎴 卡池/套賞' : '🎁 幸運福袋'}
                                                                        </Badge>
                                                                    </TableCell>
                                                                    <TableCell className="py-3 text-right font-bold text-slate-700">
                                                                        ${setItem.unitPrice.toLocaleString()} {setItem.currency === 'diamond' ? '鑽石' : 'P點'}
                                                                    </TableCell>
                                                                    <TableCell className="py-3 text-right font-black text-slate-900">
                                                                        {setItem.salesCount.toLocaleString()} 次/套
                                                                    </TableCell>
                                                                    <TableCell className="py-3 text-right font-black text-emerald-600 text-base">
                                                                        ${setItem.totalAmount.toLocaleString()}
                                                                    </TableCell>
                                                                    <TableCell className="py-3 text-center pr-6">
                                                                        <Button 
                                                                            size="sm" 
                                                                            variant="outline" 
                                                                            onClick={() => setSelectedSetDetails({
                                                                                agentName: agent.agentName,
                                                                                setName: setItem.setName,
                                                                                unitPrice: setItem.unitPrice,
                                                                                currency: setItem.currency === 'diamond' ? '鑽石' : 'P點',
                                                                                logs: setItem.logs
                                                                            })}
                                                                            className="font-bold text-xs h-8 gap-1 border-slate-300 hover:bg-slate-100"
                                                                        >
                                                                            <Eye className="h-3.5 w-3.5 text-slate-500" /> 檢視買家交易明細
                                                                        </Button>
                                                                    </TableCell>
                                                                </TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* 管理業務成員名單 */}
            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-md">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                    <h2 className="font-headline text-xl font-black text-slate-900">業務成員管理</h2>
                    <span className="text-xs font-bold text-slate-500">共 {agents?.length || 0} 位業務</span>
                </div>
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="border-b-slate-200">
                            <TableHead className="pl-8 text-[10px] font-black uppercase text-slate-900 tracking-widest py-4">業務姓名</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest">業務 ID</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest text-right pr-8">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {agents?.map((agent) => (
                            <TableRow key={agent.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                                <TableCell className="pl-8 py-3.5 font-bold text-slate-900">{agent.name}</TableCell>
                                <TableCell className="py-3.5 font-mono text-xs text-slate-500">{agent.id}</TableCell>
                                <TableCell className="text-right pr-8">
                                    <Button 
                                        variant="ghost" 
                                        size="icon" 
                                        onClick={() => handleDeleteAgent(agent.id)} 
                                        className="text-destructive hover:bg-destructive/10 rounded-full h-8 w-8"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>

            {/* 查看特定「套」的交易買家明細彈窗 Dialog */}
            <Dialog open={!!selectedSetDetails} onOpenChange={(open) => !open && setSelectedSetDetails(null)}>
                <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                            <Receipt className="h-5 w-5 text-emerald-600" />
                            銷售明細紀錄：{selectedSetDetails?.setName}
                        </DialogTitle>
                    </DialogHeader>

                    {selectedSetDetails && (
                        <div className="space-y-4 pt-2">
                            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-wrap justify-between items-center text-xs font-bold text-slate-700 gap-2">
                                <div>歸屬業務：<span className="text-slate-900 font-black text-sm">{selectedSetDetails.agentName}</span></div>
                                <div>單價：<span className="text-slate-900 font-black">${selectedSetDetails.unitPrice} {selectedSetDetails.currency}</span></div>
                                <div>總銷售筆數：<span className="text-emerald-600 font-black">{selectedSetDetails.logs.length} 筆</span></div>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <Table>
                                    <TableHeader className="bg-slate-100">
                                        <TableRow>
                                            <TableHead className="text-xs font-black py-2.5 pl-4">購買時間</TableHead>
                                            <TableHead className="text-xs font-black py-2.5">買家</TableHead>
                                            <TableHead className="text-xs font-black py-2.5">購買內容/詳情</TableHead>
                                            <TableHead className="text-xs font-black py-2.5 text-right pr-4">金額</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {selectedSetDetails.logs.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-8 text-xs text-slate-400 font-bold italic">
                                                    尚無具體交易筆數明細。
                                                </TableCell>
                                            </TableRow>
                                        ) : (
                                            selectedSetDetails.logs.map((log) => (
                                                <TableRow key={log.id} className="hover:bg-slate-50 text-xs font-semibold">
                                                    <TableCell className="py-2.5 pl-4 font-mono text-slate-500">{log.time}</TableCell>
                                                    <TableCell className="py-2.5 font-bold text-slate-800">{log.buyer}</TableCell>
                                                    <TableCell className="py-2.5 text-slate-600">{log.detailsText || `${log.count} 次`}</TableCell>
                                                    <TableCell className="py-2.5 text-right pr-4 font-black text-emerald-600">${log.amount.toLocaleString()}</TableCell>
                                                </TableRow>
                                            ))
                                        )}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

