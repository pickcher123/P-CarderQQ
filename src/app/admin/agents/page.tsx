'use client';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, collectionGroup, query, addDoc, doc, deleteDoc } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { format, startOfMonth, endOfMonth, getYear, getMonth } from 'date-fns';
import { useMemo, useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserPlus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface LuckBagPurchase {
    id: string;
    agentId: string;
    agentName: string;
    purchasedAt: { seconds: number };
    luckBagId: string;
    spotNumber: number;
}

const years = Array.from({ length: 5 }, (_, i) => getYear(new Date()) - i);
const months = Array.from({ length: 12 }, (_, i) => ({ value: i, label: `${i + 1}月` }));

export default function AgentsAdminPage() {
    const firestore = useFirestore();
    const [currentYear, setCurrentYear] = useState(getYear(new Date()).toString());
    const [currentMonth, setCurrentMonth] = useState(getMonth(new Date()).toString());
    const [newAgentName, setNewAgentName] = useState('');
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [agentFilter, setAgentFilter] = useState<string>('all');

    const agentsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'agents'));
    }, [firestore]);
    const { data: agents } = useCollection<{ id: string, name: string }>(agentsQuery);
    
    const purchasesQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collectionGroup(firestore, 'luckBagPurchases'));
    }, [firestore]);
    const drawLogsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collectionGroup(firestore, 'drawnCardLogs'));
    }, [firestore]);

    const { data: purchases, isLoading: isLoadingPurchases } = useCollection<LuckBagPurchase>(purchasesQuery);
    const { data: drawLogs, isLoading: isLoadingDraws } = useCollection<any>(drawLogsQuery);
    const isLoading = isLoadingPurchases || isLoadingDraws;

    const handleAddAgent = async () => {
        if (!firestore || !newAgentName) return;
        await addDoc(collection(firestore, 'agents'), { name: newAgentName });
        setNewAgentName('');
        setIsAddDialogOpen(false);
    };

    const handleDeleteAgent = async (id: string) => {
        if (!firestore) return;
        await deleteDoc(doc(firestore, 'agents', id));
    };

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

    const agentStats = useMemo(() => {
        const stats: Record<string, { name: string, count: number }> = {};
        filteredPurchases.forEach(p => {
            if (agentFilter !== 'all' && p.agentId !== agentFilter) return;
            if (!stats[p.agentId]) {
                stats[p.agentId] = { name: p.agentName || '未知業務', count: 0 };
            }
            stats[p.agentId].count++;
        });
        filteredDraws.forEach(d => {
            if (agentFilter !== 'all' && d.agentId !== agentFilter) return;
            if (!stats[d.agentId]) {
                stats[d.agentId] = { name: '未知業務', count: 0 };
            }
            stats[d.agentId].count += d.count || 0;
        });
        return Object.entries(stats).map(([id, data]) => ({ id, ...data }));
    }, [filteredPurchases, filteredDraws, agentFilter]);

    return (
        <div className="container mx-auto p-6 md:p-8 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="font-headline text-3xl font-black tracking-tight text-slate-900">業務銷售統計</h1>
                    <p className="mt-2 text-slate-600 font-bold">查看各業務每個月的銷售套數。</p>
                </div>
                <div className="flex gap-2">
                    <Select value={agentFilter} onValueChange={setAgentFilter}>
                        <SelectTrigger className="w-[150px] bg-white border-slate-200 font-bold">
                            <SelectValue placeholder="篩選業務" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all" className="font-bold">所有業務</SelectItem>
                            {agents?.map(agent => <SelectItem key={agent.id} value={agent.id} className="font-bold">{agent.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                            <Button className="font-bold bg-slate-900 text-white rounded-full">
                                <UserPlus className="mr-2 h-4 w-4" /> 新增業務
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>新增業務</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>業務名稱</Label>
                                    <Input value={newAgentName} onChange={e => setNewAgentName(e.target.value)} placeholder="輸入業務姓名" />
                                </div>
                                <Button onClick={handleAddAgent} className="w-full font-bold">確認新增</Button>
                            </div>
                        </DialogContent>
                    </Dialog>
                    <Select value={currentYear} onValueChange={setCurrentYear}>
                        <SelectTrigger className="w-[120px] bg-white border-slate-200 font-bold">
                            <SelectValue placeholder="年份" />
                        </SelectTrigger>
                        <SelectContent>
                            {years.map(year => <SelectItem key={year} value={year.toString()} className="font-bold">{year}年</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={currentMonth} onValueChange={setCurrentMonth}>
                        <SelectTrigger className="w-[120px] bg-white border-slate-200 font-bold">
                            <SelectValue placeholder="月份" />
                        </SelectTrigger>
                        <SelectContent>
                            {months.map(month => <SelectItem key={month.value} value={month.value.toString()} className="font-bold">{month.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-md">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="border-b-slate-200">
                            <TableHead className="pl-8 text-[10px] font-black uppercase text-slate-900 tracking-widest py-5">業務名稱</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest text-right pr-8">銷售套數</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ?
                        Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell colSpan={2} className="p-6"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                            </TableRow>
                        )) :
                        agentStats.map((agent) => (
                            <TableRow key={agent.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                                <TableCell className="pl-8 py-4 font-bold text-slate-900">{agent.name}</TableCell>
                                <TableCell className="text-right pr-8 font-black text-slate-900">{agent.count}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {!isLoading && agentStats.length === 0 && (
                    <div className="text-center py-32 text-slate-400 font-bold italic">
                        <p>此月份沒有任何銷售紀錄。</p>
                    </div>
                )}
            </div>

            <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-md">
                <div className="p-8 border-b border-slate-100">
                    <h2 className="font-headline text-2xl font-black tracking-tight text-slate-900">管理業務</h2>
                </div>
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="border-b-slate-200">
                            <TableHead className="pl-8 text-[10px] font-black uppercase text-slate-900 tracking-widest py-5">業務名稱</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest text-right pr-8">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {agents?.map((agent) => (
                            <TableRow key={agent.id} className="hover:bg-slate-50/50 transition-colors border-slate-100">
                                <TableCell className="pl-8 py-4 font-bold text-slate-900">{agent.name}</TableCell>
                                <TableCell className="text-right pr-8">
                                    <Button variant="ghost" size="icon" onClick={() => handleDeleteAgent(agent.id)} className="text-destructive hover:bg-destructive/10">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
