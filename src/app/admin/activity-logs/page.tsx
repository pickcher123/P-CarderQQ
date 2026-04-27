'use client';
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FileText, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function ActivityLogsPage() {
    const firestore = useFirestore();
    
    // Assuming 'activityLogs' collection. 
    // If it doesn't exist, this will just be empty/loading.
    const logsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'activityLogs'), orderBy('createdAt', 'desc'), limit(100)) : null, [firestore]);
    const { data: logs, isLoading } = useCollection<any>(logsQuery);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">操作日誌查詢</h1>
            <Card className="border-slate-200 shadow-lg rounded-3xl bg-white">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead>時間</TableHead>
                            <TableHead>操作者</TableHead>
                            <TableHead>動作</TableHead>
                            <TableHead>詳細內容</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow><TableCell colSpan={4} className="text-center py-10"><Loader2 className="animate-spin mx-auto text-slate-400"/></TableCell></TableRow>
                        ) : logs?.map(log => (
                            <TableRow key={log.id}>
                                <TableCell className="font-code text-xs font-bold text-slate-500">
                                    {log.createdAt ? format(log.createdAt.toDate(), 'MM-dd HH:mm:ss') : '-'}
                                </TableCell>
                                <TableCell className="font-bold text-slate-900 text-sm">
                                    {log.userName || log.userEmail || '系統'}
                                </TableCell>
                                <TableCell className="text-sm font-bold text-slate-700">{log.action}</TableCell>
                                <TableCell className="text-xs text-slate-600 font-mono break-all max-w-[300px]">
                                    {typeof log.details === 'string' ? log.details : JSON.stringify(log.details)}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
