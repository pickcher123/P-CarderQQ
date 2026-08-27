'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, addDoc, deleteDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Ticket, Trash2, Calendar, Copy, Check, Percent, Sparkles, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface CouponDoc {
    id: string;
    code: string;
    discount: number;
    type?: 'fixed' | 'percent';
    minSpend?: number;
    usageLimit?: number;
    usageCount?: number;
    expiresAt?: string;
    createdAt?: { seconds: number };
    isActive?: boolean;
}

export default function AdminCouponsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [newCoupon, setNewCoupon] = useState({ 
        code: '', 
        discount: 100, 
        type: 'fixed' as 'fixed' | 'percent',
        minSpend: 0,
        usageLimit: 100,
        expiresAt: '' 
    });
    const [isCreating, setIsCreating] = useState(false);
    const [copiedCode, setCopiedCode] = useState<string | null>(null);

    const couponsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'coupons'), orderBy('createdAt', 'desc'), limit(100));
    }, [firestore]);

    const { data: coupons, isLoading } = useCollection<CouponDoc>(couponsQuery);

    const handleCreateCoupon = async () => {
        if (!firestore || !newCoupon.code.trim()) {
            toast({ variant: 'destructive', title: '請輸入優惠券代碼' });
            return;
        }
        setIsCreating(true);
        try {
            await addDoc(collection(firestore, 'coupons'), {
                code: newCoupon.code.trim().toUpperCase(),
                discount: Number(newCoupon.discount) || 0,
                type: newCoupon.type,
                minSpend: Number(newCoupon.minSpend) || 0,
                usageLimit: Number(newCoupon.usageLimit) || 0,
                usageCount: 0,
                expiresAt: newCoupon.expiresAt || null,
                createdAt: Timestamp.now(),
                isActive: true
            });
            setNewCoupon({ code: '', discount: 100, type: 'fixed', minSpend: 0, usageLimit: 100, expiresAt: '' });
            toast({ title: '優惠券已成功發行' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '建立失敗' });
        } finally {
            setIsCreating(false);
        }
    };

    const handleToggleStatus = async (item: CouponDoc) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'coupons', item.id), {
                isActive: !item.isActive
            });
            toast({ title: '優惠券狀態已更新' });
        } catch (e) {
            toast({ variant: 'destructive', title: '更新失敗' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'coupons', id));
            toast({ title: '已刪除優惠券' });
        } catch (e) {
            toast({ variant: 'destructive', title: '刪除失敗' });
        }
    };

    const copyToClipboard = (code: string) => {
        navigator.clipboard.writeText(code);
        setCopiedCode(code);
        toast({ title: '已複製代碼', description: code });
        setTimeout(() => setCopiedCode(null), 2000);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <Ticket className="h-7 w-7 text-emerald-600" /> 優惠券發行與管理
                </h1>
                <p className="mt-1 text-sm text-slate-500 font-medium">
                    建立促銷折價券與紅利代碼，吸引新會員註冊或刺激全站儲值消費。
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Create form */}
                <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
                    <CardHeader className="p-5 border-b border-slate-100">
                        <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                            <Plus className="h-4 w-4 text-emerald-600" /> 發行新優惠券
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 font-medium">
                            配置代碼、折扣面額與使用門檻
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">優惠券代碼 (英數大寫)</label>
                            <Input 
                                placeholder="例如：SUMMER2026, VIP888" 
                                value={newCoupon.code} 
                                onChange={e => setNewCoupon({...newCoupon, code: e.target.value.toUpperCase()})}
                                className="h-10 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-mono font-black tracking-wider uppercase"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">折扣面額 (鑽石/點數)</label>
                                <Input 
                                    type="number"
                                    placeholder="100" 
                                    value={newCoupon.discount} 
                                    onChange={e => setNewCoupon({...newCoupon, discount: Number(e.target.value)})}
                                    className="h-10 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-bold"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">最低消費門檻</label>
                                <Input 
                                    type="number"
                                    placeholder="0" 
                                    value={newCoupon.minSpend} 
                                    onChange={e => setNewCoupon({...newCoupon, minSpend: Number(e.target.value)})}
                                    className="h-10 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-bold"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">發行數量上限</label>
                                <Input 
                                    type="number"
                                    placeholder="100" 
                                    value={newCoupon.usageLimit} 
                                    onChange={e => setNewCoupon({...newCoupon, usageLimit: Number(e.target.value)})}
                                    className="h-10 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-bold"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-xs font-bold text-slate-700">有效截止日期</label>
                                <Input 
                                    type="date"
                                    value={newCoupon.expiresAt} 
                                    onChange={e => setNewCoupon({...newCoupon, expiresAt: e.target.value})}
                                    className="h-10 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-medium"
                                />
                            </div>
                        </div>

                        <Button 
                            onClick={handleCreateCoupon} 
                            disabled={isCreating || !newCoupon.code}
                            className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-xs"
                        >
                            {isCreating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                            確認發行優惠券
                        </Button>
                    </CardContent>
                </Card>

                {/* List */}
                <div className="lg:col-span-2 space-y-4">
                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-black text-slate-900">已發行優惠券清單</CardTitle>
                                <CardDescription className="text-xs text-slate-500 font-medium">
                                    共 {coupons?.length || 0} 張代碼進行中
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50/80">
                                    <TableRow>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400 pl-6">優惠券代碼</TableHead>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400">折扣面額</TableHead>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400">使用額度</TableHead>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400">狀態</TableHead>
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
                                    ) : coupons && coupons.length > 0 ? (
                                        coupons.map((coupon) => (
                                            <TableRow key={coupon.id} className="hover:bg-slate-50/50 border-slate-100">
                                                <TableCell className="pl-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-black text-xs text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                                            {coupon.code}
                                                        </span>
                                                        <button 
                                                            onClick={() => copyToClipboard(coupon.code)}
                                                            className="p-1 text-slate-400 hover:text-slate-600 transition-colors"
                                                            title="複製代碼"
                                                        >
                                                            {copiedCode === coupon.code ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                                        </button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-bold text-xs text-emerald-600">
                                                        折抵 {coupon.discount?.toLocaleString()} 點
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-500 font-medium">
                                                    {coupon.usageCount || 0} / {coupon.usageLimit ? `${coupon.usageLimit} 次` : '無限制'}
                                                </TableCell>
                                                <TableCell>
                                                    <button 
                                                        onClick={() => handleToggleStatus(coupon)}
                                                        className="cursor-pointer"
                                                    >
                                                        {coupon.isActive !== false ? (
                                                            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px] font-bold">
                                                                有效中
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200 text-[10px] font-bold">
                                                                已停用
                                                            </Badge>
                                                        )}
                                                    </button>
                                                </TableCell>
                                                <TableCell className="text-right pr-6">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => handleDelete(coupon.id)}
                                                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-12 text-center text-xs text-slate-400 font-bold">
                                                目前尚無發行的優惠券，請利用左側表單建立。
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
