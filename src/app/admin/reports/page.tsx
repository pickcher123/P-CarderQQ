'use client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { useMemo, useState } from "react";
import { Gem, ShoppingCart, Users, BarChart, Calendar, ArrowDownRight, TrendingUp, ArrowUpRight } from 'lucide-react';
import { getYear, getMonth, startOfMonth, endOfMonth } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bar, BarChart as RechartsBarChart, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';
import { PPlusIcon } from "@/components/icons";

interface Transaction {
    id: string;
    userId: string;
    transactionDate: { seconds: number };
    amount: number;
    issuedValue?: number;
    transactionType: string;
    section?: string;
    currency?: 'diamond' | 'p-point';
}

const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);
const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i + 1}月` }));

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{label}</p>
        <p className="font-black text-slate-900">{payload[0].value.toLocaleString()} 點</p>
      </div>
    );
  }
  return null;
};

export default function ReportsPage() {
    const firestore = useFirestore();
    const [currentYear, setCurrentYear] = useState(getYear(new Date()).toString());
    const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()).toString());

    const transactionsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'transactions'), orderBy('transactionDate', 'desc'));
    }, [firestore]);

    const { data: allTransactions, isLoading } = useCollection<Transaction>(transactionsQuery);

    const { reportStats, chartData } = useMemo(() => {
        if (!allTransactions) return { reportStats: { totalIncome: 0, totalConsumption: 0, totalIssuedValue: 0, netIncome: 0, activePlayers: 0 }, chartData: [] };
        const selectedDate = new Date(parseInt(currentYear), parseInt(currentMonth));
        const monthStart = startOfMonth(selectedDate);
        const monthEnd = endOfMonth(selectedDate);
        const filteredTransactions = allTransactions.filter(tx => {
            if (!tx.transactionDate) return false;
            const txDate = new Date(tx.transactionDate.seconds * 1000);
            return txDate >= monthStart && txDate <= monthEnd;
        });
        const activePlayerIds = new Set<string>();
        const sectionIssuedValue: { [key: string]: number } = { draw: 0, 'lucky-bag': 0, betting: 0, arena: 0, 'group-break': 0 };
        const stats = filteredTransactions.reduce((acc, tx) => {
            if (tx.transactionType === 'Deposit' && tx.section === 'deposit') acc.totalIncome += tx.amount;
            if (tx.amount < 0 && ['draw', 'lucky-bag', 'betting', 'arena', 'group-break', 'shipping'].includes(tx.section || '')) acc.totalConsumption += Math.abs(tx.amount);
            const val = tx.issuedValue || 0;
            acc.totalIssuedValue += val;
            if (tx.section && sectionIssuedValue.hasOwnProperty(tx.section)) sectionIssuedValue[tx.section] += val;
            if (['draw', 'lucky-bag', 'betting', 'arena', 'group-break'].includes(tx.section || '')) activePlayerIds.add(tx.userId);
            return acc;
        }, { totalIncome: 0, totalConsumption: 0, totalIssuedValue: 0 });
        return {
            reportStats: { ...stats, netIncome: stats.totalIncome - stats.totalIssuedValue, activePlayers: activePlayerIds.size },
            chartData: [
                { section: '抽卡', value: sectionIssuedValue.draw, fill: "#0ea5e9" },
                { section: '福袋', value: sectionIssuedValue['lucky-bag'], fill: "#f59e0b" },
                { section: '拼卡', value: sectionIssuedValue.betting, fill: "#ec4899" },
                { section: '競技', value: sectionIssuedValue.arena, fill: "#10b981" },
                { section: '團拆', value: sectionIssuedValue['group-break'] || 0, fill: "#8b5cf6" },
            ],
        };
    }, [allTransactions, currentYear, currentMonth]);
    
    return (
        <div className="space-y-8 text-slate-900">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h1 className="text-3xl font-black tracking-tight">營業報表</h1>
                <div className="flex gap-2">
                    <Select value={currentYear} onValueChange={setCurrentYear}>
                        <SelectTrigger className="w-[120px] bg-white border-slate-200 font-bold"><Calendar className="w-4 h-4 mr-2" /><SelectValue /></SelectTrigger>
                        <SelectContent>{years.map(year => <SelectItem key={year} value={year.toString()}>{year}年</SelectItem>)}</SelectContent>
                    </Select>
                     <Select value={currentMonth} onValueChange={setCurrentMonth}>
                        <SelectTrigger className="w-[120px] bg-white border-slate-200 font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent>{months.map(month => <SelectItem key={month.value} value={month.value.toString()}>{month.label}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {[
                    { label: '儲值總收', value: reportStats.totalIncome, icon: ArrowUpRight, color: 'text-emerald-600', bg: 'bg-white' },
                    { label: '消耗總額', value: reportStats.totalConsumption, icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-white' },
                    { label: '發放價值', value: reportStats.totalIssuedValue, icon: ArrowDownRight, color: 'text-pink-600', bg: 'bg-white' },
                    { label: '本月盈餘', value: reportStats.netIncome, icon: TrendingUp, color: reportStats.netIncome >= 0 ? 'text-emerald-600' : 'text-red-600', bg: 'bg-slate-50 border-2' },
                    { label: '活躍人數', value: reportStats.activePlayers, icon: Users, color: 'text-slate-600', bg: 'bg-white' },
                ].map((stat, i) => (
                    <Card key={i} className={cn("border-slate-200 shadow-sm rounded-2xl", stat.bg)}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-[10px] font-bold uppercase text-slate-400">{stat.label}</CardTitle>
                            <stat.icon className={cn("h-4 w-4", stat.color)} />
                        </CardHeader>
                        <CardContent>
                            <div className={cn("text-2xl font-black font-code", stat.color)}>{stat.value.toLocaleString()}</div>
                        </CardContent>
                    </Card>
                ))}
            </div>
            
            <Card className="border-slate-200 shadow-sm rounded-2xl bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-50 bg-slate-50/50">
                    <CardTitle className="text-lg font-bold flex items-center gap-2"><BarChart className="h-5 w-5 text-slate-400" /> 專區發放價值分佈</CardTitle>
                </CardHeader>
                <CardContent className="p-8">
                    <div className="h-[400px] w-full">
                         <ResponsiveContainer width="100%" height="100%">
                            <RechartsBarChart data={chartData} margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                                <XAxis dataKey="section" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip cursor={{ fill: '#f8fafc' }} content={<CustomTooltip />} />
                                <Bar dataKey="value" radius={[6, 6, 0, 0]} barSize={50} />
                            </RechartsBarChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
