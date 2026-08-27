'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, updateDoc, doc } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { AlertTriangle, Check, CheckCircle2, ShieldAlert, Clock, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function AdminAlertsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const alertsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'alerts'), orderBy('createdAt', 'desc'), limit(100));
    }, [firestore]);
    const { data: alerts, isLoading } = useCollection<any>(alertsQuery);

    const handleResolve = async (id: string) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'alerts', id), { resolved: true });
            toast({ title: '已標記為已處理' });
        } catch (error) {
            toast({ variant: 'destructive', title: '處理失敗' });
        }
    };

    const unresolvedCount = alerts?.filter(a => !a.resolved).length || 0;

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <ShieldAlert className="h-7 w-7 text-rose-600" /> 系統異常與風險預警
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                        即時監控卡池庫存不足、點數異常變動與系統警報事件。
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn(
                        "text-xs font-black px-3 py-1 rounded-lg",
                        unresolvedCount > 0 ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                    )}>
                        {unresolvedCount > 0 ? `${unresolvedCount} 項未處理警報` : '無待處理警報'}
                    </Badge>
                </div>
            </div>

            {/* List */}
            <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl overflow-hidden">
                <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-black text-slate-900">警報事件紀錄</CardTitle>
                        <CardDescription className="text-xs text-slate-500 font-medium">
                            共 {alerts?.length || 0} 筆系統記錄
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50/80">
                            <TableRow>
                                <TableHead className="text-[11px] font-black uppercase text-slate-400 pl-6">記錄時間</TableHead>
                                <TableHead className="text-[11px] font-black uppercase text-slate-400">嚴重層級</TableHead>
                                <TableHead className="text-[11px] font-black uppercase text-slate-400">警報訊息與詳情</TableHead>
                                <TableHead className="text-[11px] font-black uppercase text-slate-400">處理狀態</TableHead>
                                <TableHead className="text-right text-[11px] font-black uppercase text-slate-400 pr-6">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                Array.from({ length: 4 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={5} className="p-4"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                                    </TableRow>
                                ))
                            ) : alerts && alerts.length > 0 ? (
                                alerts.map((alert: any) => (
                                    <TableRow key={alert.id} className={cn("hover:bg-slate-50/50 border-slate-100", alert.resolved && "opacity-60")}>
                                        <TableCell className="pl-6 py-4 font-mono text-[11px] text-slate-500 font-bold">
                                            {alert.createdAt ? (typeof alert.createdAt.toDate === 'function' ? format(alert.createdAt.toDate(), 'yyyy-MM-dd HH:mm') : format(new Date(alert.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm')) : '-'}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(
                                                "text-[10px] font-black",
                                                alert.level === 'critical' ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-amber-50 text-amber-700 border-amber-200"
                                            )}>
                                                <AlertTriangle className="h-3 w-3 mr-1" />
                                                {alert.level === 'critical' ? '重大警報' : '系統提醒'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-xs font-bold text-slate-800 max-w-[360px]">
                                            {alert.message || '系統監控事件'}
                                        </TableCell>
                                        <TableCell>
                                            {alert.resolved ? (
                                                <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] font-bold">
                                                    已結案
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold">
                                                    未處理
                                                </Badge>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            {!alert.resolved && (
                                                <Button 
                                                    size="sm" 
                                                    variant="outline" 
                                                    onClick={() => handleResolve(alert.id)}
                                                    className="h-8 rounded-lg text-xs font-bold border-slate-200 hover:bg-slate-50"
                                                >
                                                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> 標記處理
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="py-12 text-center text-xs text-slate-400 font-bold">
                                        <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-40" />
                                        目前全站運作正常，無任何風險或異常警報。
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
