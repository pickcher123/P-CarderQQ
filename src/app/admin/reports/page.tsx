'use client';

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { useRequest, useFirestore, useMemoFirebase, useUser, useCollection } from "@/firebase";
import { collection, collectionGroup, query, orderBy, where, Timestamp, doc } from "firebase/firestore";
import { useMemo, useState, useEffect } from "react";
import { ShoppingCart, Users, BarChart, Calendar, ArrowDownRight, TrendingUp, ArrowUpRight, Loader2, Download, Briefcase, Layers, Sparkles } from 'lucide-react';
import { getYear, getMonth, startOfMonth, endOfMonth, format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';
import type { UserProfile } from '@/types/user-profile';

const SUPER_ADMIN_EMAIL = 'pickcher123@gmail.com';

interface Transaction {
    id: string;
    userId: string;
    transactionDate: { seconds: number };
    amount: number;
    issuedValue?: number;
    transactionType: string;
    section?: string;
    currency?: 'diamond' | 'p-point';
    status: 'pending' | 'completed' | 'failed';
}

interface DrawLog {
    id: string;
    poolId: string;
    agentId?: string;
    drawnAt: { seconds: number };
    cost: number;
    count: number;
    userId?: string;
}

interface LuckBagPurchase {
    id: string;
    luckBagId: string;
    agentId?: string;
    purchasedAt: { seconds: number };
    userId?: string;
}

interface AgentItem {
    id: string;
    name: string;
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

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
        <p className="font-black text-slate-900">{payload[0].value.toLocaleString()} 點/元</p>
      </div>
    );
  }
  return null;
};

export default function ReportsPage() {
    const firestore = useFirestore();
    const { user: authUser } = useUser();

    // 取得當前登入使用者的 Profile，判定是否綁定為業務/代理
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
    const [agentFilter, setAgentFilter] = useState<string>('all');

    // 若為業務專屬帳號，自動鎖定業務篩選
    useEffect(() => {
        if (isSalesOnly && assignedAgentId) {
            setAgentFilter(assignedAgentId);
        }
    }, [isSalesOnly, assignedAgentId]);

    const { monthStart, monthEnd } = useMemo(() => {
        const selectedDate = new Date(parseInt(currentYear), parseInt(currentMonth));
        return {
            monthStart: startOfMonth(selectedDate),
            monthEnd: endOfMonth(selectedDate)
        };
    }, [currentYear, currentMonth]);

    // 業務選單 query
    const agentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'agents'));
    }, [firestore]);
    const { data: agents } = useCollection<AgentItem>(agentsQuery);

    // 卡池集合 query
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

    // 全站交易 Query
    const transactionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'transactions'), 
            where('transactionDate', '>=', Timestamp.fromDate(monthStart)),
            where('transactionDate', '<=', Timestamp.fromDate(monthEnd)),
            orderBy('transactionDate', 'desc')
        );
    }, [firestore, monthStart, monthEnd]);
    const { data: allTransactions, isLoading: isLoadingTx } = useRequest<Transaction[]>(transactionsQuery);

    // 抽卡 Log Group Query
    const drawLogsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collectionGroup(firestore, 'drawnCardLogs'));
    }, [firestore]);
    const { data: rawDrawLogs, isLoading: isLoadingDraws } = useCollection<DrawLog>(drawLogsQuery);

    // 福袋購買 Group Query
    const purchasesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collectionGroup(firestore, 'luckBagPurchases'));
    }, [firestore]);
    const { data: rawPurchases, isLoading: isLoadingPurchases } = useCollection<LuckBagPurchase>(purchasesQuery);

    const isLoading = isLoadingTx || isLoadingDraws || isLoadingPurchases;

    // ID 對應表
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

    const agentMap = useMemo(() => {
        const map = new Map<string, string>();
        agents?.forEach(a => map.set(a.id, a.name));
        return map;
    }, [agents]);

    // 依年月與 agentFilter 過濾抽卡紀錄
    const filteredDraws = useMemo(() => {
        if (!rawDrawLogs) return [];
        return rawDrawLogs.filter(d => {
            if (!d.drawnAt) return false;
            const dDate = new Date(d.drawnAt.seconds * 1000);
            const inMonth = dDate >= monthStart && dDate <= monthEnd;
            if (!inMonth) return false;
            if (agentFilter !== 'all' && d.agentId !== agentFilter) return false;
            return true;
        });
    }, [rawDrawLogs, monthStart, monthEnd, agentFilter]);

    // 依年月與 agentFilter 過濾福袋購買紀錄
    const filteredPurchases = useMemo(() => {
        if (!rawPurchases) return [];
        return rawPurchases.filter(p => {
            if (!p.purchasedAt) return false;
            const pDate = new Date(p.purchasedAt.seconds * 1000);
            const inMonth = pDate >= monthStart && pDate <= monthEnd;
            if (!inMonth) return false;
            if (agentFilter !== 'all' && p.agentId !== agentFilter) return false;
            return true;
        });
    }, [rawPurchases, monthStart, monthEnd, agentFilter]);

    // 計算報表統計數據與圖表數據
    const { reportStats, chartData, agentSummaryList, setProductList } = useMemo(() => {
        const dailyIncome: { [key: string]: number } = {};
        for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
            dailyIncome[d.getDate().toString()] = 0;
        }

        const activePlayerIds = new Set<string>();

        if (agentFilter === 'all') {
            // 全站數據報表
            let totalIncome = 0;
            let totalConsumption = 0;
            let totalIssuedValue = 0;

            allTransactions?.forEach(tx => {
                if (tx.transactionType === 'Deposit' && tx.section === 'deposit' && tx.status === 'completed') {
                    totalIncome += tx.amount;
                    const txDate = new Date(tx.transactionDate.seconds * 1000);
                    dailyIncome[txDate.getDate().toString()] += tx.amount;
                }
                if (tx.amount < 0 && ['draw', 'lucky-bag', 'betting', 'arena', 'group-break', 'shipping'].includes(tx.section || '')) {
                    totalConsumption += Math.abs(tx.amount);
                }
                totalIssuedValue += (tx.issuedValue || 0);
                if (['draw', 'lucky-bag', 'betting', 'arena', 'group-break'].includes(tx.section || '')) {
                    activePlayerIds.add(tx.userId);
                }
            });

            // 計算各業務在該月份的銷售績效
            const agentStatsMap: Record<string, { agentId: string; agentName: string; totalSales: number; drawCount: number; activeUsers: Set<string> }> = {};
            agents?.forEach(a => {
                agentStatsMap[a.id] = { agentId: a.id, agentName: a.name, totalSales: 0, drawCount: 0, activeUsers: new Set() };
            });

            filteredDraws.forEach(d => {
                const aId = d.agentId || 'unknown';
                if (!agentStatsMap[aId]) {
                    agentStatsMap[aId] = { agentId: aId, agentName: agentMap.get(aId) || '未設定業務', totalSales: 0, drawCount: 0, activeUsers: new Set() };
                }
                agentStatsMap[aId].totalSales += d.cost || 0;
                agentStatsMap[aId].drawCount += d.count || 1;
                if (d.userId) agentStatsMap[aId].activeUsers.add(d.userId);
            });

            filteredPurchases.forEach(p => {
                const aId = p.agentId || 'unknown';
                if (!agentStatsMap[aId]) {
                    agentStatsMap[aId] = { agentId: aId, agentName: agentMap.get(aId) || '未設定業務', totalSales: 0, drawCount: 0, activeUsers: new Set() };
                }
                const bag = luckBagMap.get(p.luckBagId);
                const price = bag?.price || 0;
                agentStatsMap[aId].totalSales += price;
                agentStatsMap[aId].drawCount += 1;
                if (p.userId) agentStatsMap[aId].activeUsers.add(p.userId);
            });

            const summaryList = Object.values(agentStatsMap).map(item => ({
                agentId: item.agentId,
                agentName: item.agentName,
                totalSales: item.totalSales,
                drawCount: item.drawCount,
                activeCount: item.activeUsers.size
            })).sort((a, b) => b.totalSales - a.totalSales);

            return {
                reportStats: {
                    title: '全站營業額',
                    totalIncome,
                    totalConsumption,
                    totalIssuedValue,
                    netIncome: totalIncome - totalIssuedValue,
                    activePlayers: activePlayerIds.size,
                },
                chartData: Object.entries(dailyIncome).map(([day, value]) => ({ day: `${day}日`, value })),
                agentSummaryList: summaryList,
                setProductList: []
            };
        } else {
            // 指定業務專用報表
            let totalAgentRevenue = 0;
            let totalPacks = 0;

            const productMap: Record<string, { id: string; name: string; type: '卡池' | '福袋'; price: number; salesCount: number; totalRevenue: number }> = {};

            filteredDraws.forEach(d => {
                const dDate = new Date(d.drawnAt.seconds * 1000);
                const dayStr = dDate.getDate().toString();
                const cost = d.cost || 0;
                dailyIncome[dayStr] += cost;
                totalAgentRevenue += cost;
                totalPacks += (d.count || 1);
                if (d.userId) activePlayerIds.add(d.userId);

                const pool = cardPoolMap.get(d.poolId);
                const name = pool?.name || `卡池 [${d.poolId.slice(0, 6)}]`;
                const price = pool?.price || (d.count > 0 ? Math.round(cost / d.count) : cost);

                if (!productMap[d.poolId]) {
                    productMap[d.poolId] = { id: d.poolId, name, type: '卡池', price, salesCount: 0, totalRevenue: 0 };
                }
                productMap[d.poolId].salesCount += (d.count || 1);
                productMap[d.poolId].totalRevenue += cost;
            });

            filteredPurchases.forEach(p => {
                const pDate = new Date(p.purchasedAt.seconds * 1000);
                const dayStr = pDate.getDate().toString();
                const bag = luckBagMap.get(p.luckBagId);
                const price = bag?.price || 0;
                dailyIncome[dayStr] += price;
                totalAgentRevenue += price;
                totalPacks += 1;
                if (p.userId) activePlayerIds.add(p.userId);

                const name = bag?.name || `福袋 [${p.luckBagId.slice(0, 6)}]`;

                if (!productMap[p.luckBagId]) {
                    productMap[p.luckBagId] = { id: p.luckBagId, name, type: '福袋', price, salesCount: 0, totalRevenue: 0 };
                }
                productMap[p.luckBagId].salesCount += 1;
                productMap[p.luckBagId].totalRevenue += price;
            });

            const productList = Object.values(productMap).sort((a, b) => b.totalRevenue - a.totalRevenue);

            return {
                reportStats: {
                    title: `業務業績 (${agentMap.get(agentFilter) || agentFilter})`,
                    totalIncome: totalAgentRevenue,
                    totalConsumption: totalAgentRevenue,
                    totalIssuedValue: 0,
                    netIncome: totalAgentRevenue,
                    activePlayers: activePlayerIds.size,
                },
                chartData: Object.entries(dailyIncome).map(([day, value]) => ({ day: `${day}日`, value })),
                agentSummaryList: [],
                setProductList: productList
            };
        }
    }, [agentFilter, monthStart, monthEnd, allTransactions, filteredDraws, filteredPurchases, agents, agentMap, cardPoolMap, luckBagMap]);

    const exportToCSV = () => {
        if (!allTransactions && agentFilter === 'all') return;
        const header = ["ID", "日期", "項目種類", "金額/消耗", "狀態"];
        const rows = agentFilter === 'all' 
            ? (allTransactions || []).map(tx => [
                tx.id,
                new Date(tx.transactionDate.seconds * 1000).toLocaleString(),
                tx.section || tx.transactionType,
                tx.amount,
                tx.status
            ])
            : setProductList.map(p => [
                p.id,
                `${currentYear}-${parseInt(currentMonth) + 1}`,
                `${p.type}: ${p.name}`,
                p.totalRevenue,
                `銷售: ${p.salesCount} 包`
            ]);
        
        const csvContent = [header, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `report_${agentFilter}_${currentYear}_${parseInt(currentMonth) + 1}.csv`);
        link.click();
    };

    return (
        <div className="space-y-8 text-slate-900">
            {/* 標題與過濾面板 */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shrink-0">
                        <BarChart className="w-6 h-6 text-emerald-400" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-2xl font-black tracking-tight text-slate-900">
                                {isSalesOnly ? `專屬業務報表 (${userProfile?.agentName || '業務'})` : '營業報表與數據分析'}
                            </h1>
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                            {isSalesOnly && (
                                <Badge className="bg-sky-100 text-sky-800 border-sky-200 font-bold text-[10px]">
                                    <Briefcase className="w-3 h-3 mr-1" /> 業務專用權限
                                </Badge>
                            )}
                        </div>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">
                            {isSalesOnly ? '即時檢視旗下卡池與福袋銷售績效、收益與活躍玩家狀況。' : '全站儲值總收入、消費消耗與各業務業績分析。'}
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    {/* 業務選擇 Dropdown */}
                    <div className="flex items-center gap-1.5">
                        <Briefcase className="w-4 h-4 text-slate-400" />
                        <Select value={agentFilter} onValueChange={setAgentFilter} disabled={isSalesOnly}>
                            <SelectTrigger className="w-[160px] bg-white border-slate-200 font-bold rounded-xl h-11">
                                <SelectValue placeholder="選擇業務..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                {!isSalesOnly && <SelectItem value="all" className="font-bold text-slate-900">🌐 全站整體報表</SelectItem>}
                                {agents?.map(agent => (
                                    <SelectItem key={agent.id} value={agent.id} className="font-bold text-slate-800">
                                        💼 {agent.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <Select value={currentYear} onValueChange={setCurrentYear}>
                        <SelectTrigger className="w-[110px] bg-white border-slate-200 font-bold rounded-xl h-11"><Calendar className="w-4 h-4 mr-1 text-slate-400" /><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">{years.map(year => <SelectItem key={year} value={year.toString()}>{year}年</SelectItem>)}</SelectContent>
                    </Select>

                    <Select value={currentMonth} onValueChange={setCurrentMonth}>
                        <SelectTrigger className="w-[100px] bg-white border-slate-200 font-bold rounded-xl h-11"><SelectValue /></SelectTrigger>
                        <SelectContent className="bg-white">{months.map(month => <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>)}</SelectContent>
                    </Select>

                    <Button variant="outline" onClick={exportToCSV} className="h-11 font-bold border-slate-200 rounded-xl px-4">
                        <Download className="w-4 h-4 mr-1.5" /> 匯出 CSV
                    </Button>
                </div>
            </div>

            {/* 統計指標 Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {agentFilter === 'all' ? (
                    <>
                        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase text-slate-400">儲值總收 (新台幣)</CardTitle>
                                <ArrowUpRight className="h-4 w-4 text-emerald-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black font-code text-emerald-600">{reportStats.totalIncome.toLocaleString()} 元</div>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase text-slate-400">消耗總額 (鑽石/點數)</CardTitle>
                                <ShoppingCart className="h-4 w-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black font-code text-blue-600">{reportStats.totalConsumption.toLocaleString()} 點</div>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase text-slate-400">發放商品價值</CardTitle>
                                <ArrowDownRight className="h-4 w-4 text-pink-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black font-code text-pink-600">{reportStats.totalIssuedValue.toLocaleString()} 點</div>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 shadow-sm rounded-2xl bg-slate-900 text-white shadow-xl">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase text-slate-300">活躍參與人數</CardTitle>
                                <Users className="h-4 w-4 text-cyan-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black font-code text-cyan-400">{reportStats.activePlayers.toLocaleString()} 人</div>
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    <>
                        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase text-slate-400">業務當月營業總額</CardTitle>
                                <TrendingUp className="h-4 w-4 text-emerald-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black font-code text-emerald-600">{reportStats.totalIncome.toLocaleString()} 點</div>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase text-slate-400">旗下熱銷套組數</CardTitle>
                                <Layers className="h-4 w-4 text-indigo-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black font-code text-indigo-600">{setProductList.length} 套/池</div>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 shadow-sm rounded-2xl bg-white">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase text-slate-400">專屬活躍玩家</CardTitle>
                                <Users className="h-4 w-4 text-sky-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-black font-code text-sky-600">{reportStats.activePlayers.toLocaleString()} 人</div>
                            </CardContent>
                        </Card>
                        <Card className="border-slate-200 shadow-sm rounded-2xl bg-slate-900 text-white shadow-xl">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-[10px] font-bold uppercase text-slate-300">目前選取業務</CardTitle>
                                <Briefcase className="h-4 w-4 text-amber-400" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-xl font-black truncate text-amber-400">{agentMap.get(agentFilter) || '專屬業務'}</div>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>

            {/* 趨勢柱狀圖 */}
            <Card className="border-slate-200 shadow-sm rounded-3xl bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                        <BarChart className="h-5 w-5 text-emerald-600" /> 
                        {agentFilter === 'all' ? '每日儲值收益趨勢' : `業務 ${agentMap.get(agentFilter) || ''} 每日抽卡/包累積銷售趨勢`}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 md:p-8">
                    <div className="h-[350px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="day" stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={20} fill="#10b981" />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* 明細表格 */}
            {agentFilter === 'all' ? (
                /* 全站各業務績效表 */
                <Card className="border-slate-200 shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="text-base font-black flex items-center gap-2">
                            <Briefcase className="h-5 w-5 text-slate-700" /> 各業務當月營業績效排行
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-slate-500">此表格列出全站各業務旗下卡池與福袋當月的總銷售與抽數統計。</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow className="border-b-slate-200">
                                    <TableHead className="pl-6 font-black text-slate-900 text-[10px] uppercase">業務名稱 / ID</TableHead>
                                    <TableHead className="font-black text-slate-900 text-[10px] uppercase">總銷售包數/抽數</TableHead>
                                    <TableHead className="font-black text-slate-900 text-[10px] uppercase">活躍玩家數</TableHead>
                                    <TableHead className="text-right pr-6 font-black text-slate-900 text-[10px] uppercase">當月總營業額</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {agentSummaryList.length > 0 ? (
                                    agentSummaryList.map(item => (
                                        <TableRow key={item.agentId} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                                            <TableCell className="pl-6 font-bold text-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-black text-sm">{item.agentName}</span>
                                                    <Badge variant="outline" className="text-[9px] font-mono border-slate-200 text-slate-500">{item.agentId}</Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-700 text-sm">{item.drawCount.toLocaleString()} 抽/包</TableCell>
                                            <TableCell className="font-bold text-sky-700 text-sm">{item.activeCount} 人</TableCell>
                                            <TableCell className="text-right pr-6 font-black text-emerald-600 text-base font-code">
                                                {item.totalSales.toLocaleString()} 點
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-slate-400 font-bold">當月尚無業務銷售紀錄</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            ) : (
                /* 指定業務產品售出明細 */
                <Card className="border-slate-200 shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="text-base font-black flex items-center gap-2">
                            <Layers className="h-5 w-5 text-slate-700" /> 旗下產品 / 卡池當月銷售明細
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-slate-500">列出該業務所發行與管理的套件售出狀況與業績貢獻。</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow className="border-b-slate-200">
                                    <TableHead className="pl-6 font-black text-slate-900 text-[10px] uppercase">產品名稱 / 種類</TableHead>
                                    <TableHead className="font-black text-slate-900 text-[10px] uppercase">單價</TableHead>
                                    <TableHead className="font-black text-slate-900 text-[10px] uppercase">當月售出數量</TableHead>
                                    <TableHead className="text-right pr-6 font-black text-slate-900 text-[10px] uppercase">當月銷售總額</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {setProductList.length > 0 ? (
                                    setProductList.map(prod => (
                                        <TableRow key={prod.id} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                                            <TableCell className="pl-6 font-bold text-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <Badge className={cn("text-[9px] font-black border-none", prod.type === '卡池' ? "bg-purple-100 text-purple-800" : "bg-amber-100 text-amber-800")}>
                                                        {prod.type}
                                                    </Badge>
                                                    <span className="font-black text-sm">{prod.name}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-700 font-code">{prod.price?.toLocaleString()} 點</TableCell>
                                            <TableCell className="font-bold text-slate-900 font-code">{prod.salesCount.toLocaleString()} 抽/包</TableCell>
                                            <TableCell className="text-right pr-6 font-black text-emerald-600 text-base font-code">
                                                {prod.totalRevenue.toLocaleString()} 點
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center py-10 text-slate-400 font-bold">該業務當月尚無產品售出紀錄</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
