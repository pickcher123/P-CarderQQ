'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, updateDoc, doc } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function AdminAlertsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    
    const alertsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'alerts'), orderBy('createdAt', 'desc'), limit(50)) : null, [firestore]);
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

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">異常風險預警</h1>
            <Card className="border-slate-200 shadow-lg rounded-3xl bg-white">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>時間</TableHead>
                            <TableHead>類別</TableHead>
                            <TableHead>說明</TableHead>
                            <TableHead className="text-right">動作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto"/></TableCell></TableRow>
                        ) : alerts?.map(alert => (
                            <TableRow key={alert.id} className={cn(alert.resolved ? 'opacity-50' : '')}>
                                <TableCell className="font-code text-xs font-bold text-slate-500">
                                    {alert.createdAt ? format(alert.createdAt.toDate(), 'MM-dd HH:mm') : '-'}
                                </TableCell>
                                <TableCell><AlertTriangle className="h-4 w-4 text-rose-500" /></TableCell>
                                <TableCell className="text-sm font-bold text-slate-900">{alert.message}</TableCell>
                                <TableCell className="text-right">
                                    {!alert.resolved && (
                                        <Button size="sm" variant="outline" onClick={() => handleResolve(alert.id)}>
                                            <Check className="h-4 w-4 mr-2" /> 標記處理
                                        </Button>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}

function cn(...classes: (string | undefined | null | false)[]) {
    return classes.filter(Boolean).join(' ');
}
