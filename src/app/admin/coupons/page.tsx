'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, addDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Ticket } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

export default function AdminCouponsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [newCoupon, setNewCoupon] = useState({ code: '', discount: 0, expiresAt: '' });

    const couponsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'coupons'), orderBy('createdAt', 'desc'), limit(50)) : null, [firestore]);
    const { data: coupons, isLoading } = useCollection<any>(couponsQuery);

    const handleCreateCoupon = async () => {
        if (!firestore || !newCoupon.code) return;
        try {
            await addDoc(collection(firestore, 'coupons'), {
                ...newCoupon,
                createdAt: Timestamp.now(),
                isActive: true
            });
            setNewCoupon({ code: '', discount: 0, expiresAt: '' });
            toast({ title: '優惠券已建立' });
        } catch (error) {
            toast({ variant: 'destructive', title: '建立失敗' });
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">優惠券自動管理</h1>
            <Card>
                <CardHeader>
                    <CardTitle>建立新優惠券</CardTitle>
                </CardHeader>
                <CardContent className="flex gap-4">
                    <Input placeholder="優惠券代碼" value={newCoupon.code} onChange={e => setNewCoupon({...newCoupon, code: e.target.value})} />
                    <Input type="number" placeholder="折扣金額" value={newCoupon.discount} onChange={e => setNewCoupon({...newCoupon, discount: Number(e.target.value)})} />
                    <Button onClick={handleCreateCoupon}><Plus className="h-4 w-4 mr-2" /> 新增</Button>
                </CardContent>
            </Card>
            <Card>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>代碼</TableHead>
                            <TableHead>折扣</TableHead>
                            <TableHead>建立時間</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {coupons?.map(coupon => (
                            <TableRow key={coupon.id}>
                                <TableCell className="font-bold">{coupon.code}</TableCell>
                                <TableCell>{coupon.discount}</TableCell>
                                <TableCell>{coupon.createdAt ? format(coupon.createdAt.toDate(), 'yyyy-MM-dd') : '-'}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
