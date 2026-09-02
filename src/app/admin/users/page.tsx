'use client';
import { useState, useMemo } from 'react';
import { useCollection, useRequest, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, query, doc, updateDoc, writeBatch, serverTimestamp, increment, where, limit } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import type { UserProfile } from '@/types/user-profile';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Loader2, User as UserIcon, Gem, MapPin, Search, UserCheck, Briefcase, Mail, Ticket, Send } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MemberLevelCrown } from '@/components/member-level-crown';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { PPlusIcon } from '@/components/icons';

const PERMISSION_ITEMS = [
    { id: 'reports', label: '營業報表', category: '數據中心' },
    { id: 'orders', label: '交易紀錄', category: '數據中心' },
    { id: 'deposits', label: '儲值管理', category: '數據中心' },
    { id: 'conversions', label: '轉點紀錄', category: '數據中心' },
    { id: 'agents', label: '業務專區', category: '數據中心' },
    { id: 'cards', label: '卡片總管', category: '遊戲管理' },
    { id: 'card-pools', label: '抽卡管理', category: '遊戲管理' },
    { id: 'betting', label: '拼卡管理', category: '遊戲管理' },
    { id: 'lucky-bags', label: '福袋管理', category: '遊戲管理' },
    { id: 'group-breaks', label: '團拆管理', category: '遊戲管理' },
    { id: 'predictions', label: '賽事預測管理', category: '遊戲管理' },
    { id: 'users', label: '會員資訊', category: '會員管理' },
    { id: 'rewards', label: '會員回饋', category: '會員管理' },
    { id: 'marketing-emails', label: '行銷郵件', category: '行銷管理' },
    { id: 'news', label: '消息管理', category: '行銷管理' },
    { id: 'announcements', label: '站內公告', category: '行銷管理' },
    { id: 'coupons', label: '優惠券管理', category: '行銷管理' },
    { id: 'card-exhibitions', label: '卡展行事曆', category: '行銷管理' },
    { id: 'partners', label: '合作夥伴', category: '營運操作' },
    { id: 'shipping', label: '出貨管理', category: '營運操作' },
    { id: 'materials', label: '素材管理', category: '素材管理' },
];

const SUPER_ADMIN_EMAIL = 'pickcher123@gmail.com';

function translateDetails(details?: string): string {
    if (typeof details !== 'string' || !details) return '-';
    return details;
}

interface Transaction {
    id: string;
    userId: string;
    transactionDate: any;
    amount: number;
    currency?: 'diamond' | 'p-point' | 'free-ticket';
    transactionType: string;
    details?: string;
}

interface ShippingOrder {
    id: string;
    userId: string;
    cardCount: number;
    shippingMethod: string;
    status: string;
    trackingNumber?: string;
    createdAt: any;
}

function UserDetailsDialog({ user }: { user: UserProfile }) {
    const firestore = useFirestore();
    const [isOpen, setIsOpen] = useState(false);
    const [newTag, setNewTag] = useState('');
    const { toast } = useToast();

    const handleAddTag = async () => {
        if (!firestore || !newTag.trim()) return;
        try {
            const userRef = doc(firestore, 'users', user.id);
            const currentTags = user.tags || [];
            await updateDoc(userRef, { tags: [...currentTags, newTag.trim()] });
            setNewTag('');
            toast({ title: '標籤已新增' });
        } catch (error) {
            toast({ variant: 'destructive', title: '新增失敗' });
        }
    }

    const txQuery = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;
        return query(collection(firestore, 'transactions'), where('userId', '==', user.id), limit(50));
    }, [firestore, user.id, isOpen]);
    
    // Optimization: Transactions are historical data. 
    // Using useRequest (one-time fetch) instead of useCollection (real-time listener)
    // saves significant reads as admins browse through many user records.
    const { data: rawTransactions, isLoading: isLoadingTx } = useRequest<Transaction[]>(txQuery);

    const sortedTransactions = useMemo(() => {
        if (!rawTransactions) return [];
        return [...rawTransactions].sort((a, b) => (b.transactionDate?.seconds || 0) - (a.transactionDate?.seconds || 0));
    }, [rawTransactions]);

    const shippingQuery = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;
        return query(collection(firestore, 'shippingOrders'), where('userId', '==', user.id));
    }, [firestore, user.id, isOpen]);
    const { data: rawOrders, isLoading: isLoadingShipping } = useRequest<ShippingOrder[]>(shippingQuery);

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <div className="flex items-center gap-3 cursor-pointer group hover:bg-slate-50 p-2 rounded-xl transition-all">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center shrink-0 border border-slate-200">
                        <UserIcon className="w-5 h-5 text-slate-400 group-hover:text-slate-900" />
                    </div>
                    <div className="overflow-hidden">
                        <p className="font-bold text-slate-900 truncate max-w-[120px] md:max-w-full">{user.username}</p>
                        <p className="text-[10px] text-slate-500 font-medium truncate">{user.email}</p>
                    </div>
                </div>
            </DialogTrigger>
            <DialogContent className="light w-[95vw] md:max-w-4xl max-h-[95vh] flex flex-col p-0 overflow-hidden bg-white border-none shadow-2xl text-slate-900">
                <DialogTitle className="sr-only">會員詳細資料</DialogTitle>
                <DialogHeader className="p-4 md:p-8 pb-3 md:pb-4 bg-slate-50 border-b border-slate-100">
                    <DialogTitle className="flex items-center gap-3 text-lg md:text-xl font-black text-slate-900">
                        <UserIcon className="text-slate-400 h-5 w-5" /> 會員詳細資料
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    <Tabs defaultValue="overview" className="h-full flex flex-col">
                        <div className="px-4 md:px-8 pt-4">
                            <TabsList className="bg-slate-100 min-h-[44px] w-full grid grid-cols-3 rounded-lg p-1">
                                <TabsTrigger value="overview" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">帳戶概覽</TabsTrigger>
                                <TabsTrigger value="transactions" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">交易紀錄</TabsTrigger>
                                <TabsTrigger value="shipping" className="font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">物流訂單</TabsTrigger>
                            </TabsList>
                        </div>

                        <TabsContent value="overview" className="flex-1 mt-0 overflow-hidden focus-visible:outline-none">
                            <ScrollArea className="h-full">
                                <div className="p-4 md:p-8 space-y-6 text-slate-900">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <Card className="p-6 text-center rounded-2xl border-slate-200 bg-white shadow-sm flex flex-col items-center">
                                            <MemberLevelCrown level={user.userLevel} size="sm" showLabel />
                                            <h3 className="mt-4 font-black text-lg text-slate-900 break-all">{user.username}</h3>
                                            <Badge variant="outline" className="mt-2 text-[10px] uppercase font-black text-slate-600 border-slate-300">{user.role}</Badge>
                                            <div className="mt-6 w-full space-y-3 text-xs">
                                                <div className="flex justify-between border-b border-slate-100 pb-2">
                                                    <span className="text-slate-500 font-black uppercase text-[9px]">註冊日期</span>
                                                    <span className="font-code font-bold text-slate-700">{user.createdAt ? format((user.createdAt as any).toDate(), 'yyyy-MM-dd') : '-'}</span>
                                                </div>
                                                <div className="text-left"><p className="text-slate-500 text-[9px] font-black uppercase mb-1">UID</p><p className="font-mono text-[10px] font-bold break-all bg-slate-50 p-2 rounded border border-slate-100">{user.id}</p></div>
                                                <div className="text-left">
                                                    <p className="text-slate-500 text-[9px] font-black uppercase mb-1">用戶標籤</p>
                                                    <div className="flex flex-wrap gap-1 mb-2">
                                                        {(user.tags || []).map(tag => (
                                                            <Badge key={tag} className="text-[10px] bg-sky-100 text-sky-800 flex items-center gap-1">{tag}</Badge>
                                                        ))}
                                                    </div>
                                                    <div className="flex gap-1">
                                                        <Input placeholder="新增標籤" className="h-6 text-[10px]" value={newTag} onChange={e => setNewTag(e.target.value)} />
                                                        <Button size="sm" className="h-6 text-[10px]" onClick={handleAddTag}>新增</Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </Card>

                                        <div className="md:col-span-2 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm text-center">
                                                    <p className="text-[10px] font-black uppercase text-slate-500 mb-1">鑽石資產</p>
                                                    <p className="text-xl font-black font-code flex items-center justify-center gap-1.5 text-cyan-700">
                                                        {user.points?.toLocaleString() || 0} <Gem className="w-4 h-4 text-cyan-600" />
                                                    </p>
                                                </div>
                                                <div className="p-4 rounded-2xl border border-slate-200 bg-white shadow-sm text-center">
                                                    <p className="text-[10px] font-black uppercase text-slate-500 mb-1">紅利 P 點</p>
                                                    <p className="text-xl font-black font-code text-amber-700 flex items-center justify-center gap-1.5">
                                                        {user.bonusPoints?.toLocaleString() || 0} <PPlusIcon className="w-4 h-4" />
                                                    </p>
                                                </div>
                                                <div className="p-4 rounded-2xl border border-emerald-200 bg-emerald-50/50 shadow-sm text-center">
                                                    <p className="text-[10px] font-black uppercase text-emerald-800 mb-1">免費抽卡券</p>
                                                    <p className="text-xl font-black font-code text-emerald-700 flex items-center justify-center gap-1.5">
                                                        {user.freeDrawTickets || 0} <Ticket className="w-4 h-4 text-emerald-600" />
                                                    </p>
                                                </div>
                                            </div>

                                            <Card className="rounded-2xl border-slate-200 bg-white shadow-sm overflow-hidden text-slate-900">
                                                <div className="px-6 py-4 border-b border-slate-100 bg-slate-50 flex items-center gap-2">
                                                    <MapPin className="w-4 h-4 text-slate-500" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-600">配送資訊</span>
                                                </div>
                                                <CardContent className="p-6 space-y-4">
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                        <div className="space-y-1"><p className="text-slate-500 text-[9px] uppercase font-black">收件姓名</p><p className="font-black text-slate-900">{user.realName || '未填寫'}</p></div>
                                                        <div className="space-y-1"><p className="text-slate-500 text-[9px] uppercase font-black">聯絡電話</p><p className="font-bold font-code text-slate-900">{user.phone || '未填寫'}</p></div>
                                                    </div>
                                                    <div className="space-y-1 pt-4 border-t border-slate-100 items-start flex flex-col"><p className="text-slate-500 text-[9px] uppercase font-black">預設配送地址</p><p className="font-bold text-sm leading-relaxed text-slate-800 text-left">{user.address || '未設定'}</p></div>
                                                </CardContent>
                                            </Card>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="transactions" className="flex-1 mt-0 overflow-hidden focus-visible:outline-none">
                            <ScrollArea className="h-full">
                                <div className="p-4 md:p-8">
                                    <div className="rounded-xl border border-slate-200 bg-white shadow-inner overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <Table className="min-w-[500px]">
                                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                                    <TableRow className="border-b-slate-200">
                                                        <TableHead className="text-[10px] font-black text-slate-900 uppercase tracking-widest pl-6">交易詳情</TableHead>
                                                        <TableHead className="text-[10px] font-black text-slate-900 uppercase tracking-widest">變動</TableHead>
                                                        <TableHead className="text-right text-[10px] font-black text-slate-900 uppercase tracking-widest pr-6">日期時間</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isLoadingTx ? (
                                                        <TableRow><TableCell colSpan={3} className="text-center py-20"><Loader2 className="animate-spin mx-auto h-6 w-6 text-slate-300"/></TableCell></TableRow>
                                                    ) : (
                                                        sortedTransactions.map(tx => (
                                                            <TableRow key={tx.id} className="hover:bg-slate-50 border-b-slate-100">
                                                                <TableCell className="text-xs font-bold text-slate-700 pl-6">{translateDetails(tx.details)}</TableCell>
                                                                <TableCell className={cn("font-code font-black text-sm", tx.amount > 0 ? "text-emerald-700" : "text-slate-900")}>
                                                                    {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                                                    {tx.currency === 'free-ticket' ? '🎟️張' : tx.currency === 'p-point' ? 'P' : '💎'}
                                                                </TableCell>
                                                                <TableCell className="text-[10px] text-slate-500 font-bold text-right pr-6">
                                                                    {tx.transactionDate ? format((tx.transactionDate as any).toDate(), 'MM-dd HH:mm') : '-'}
                                                                </TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>

                        <TabsContent value="shipping" className="flex-1 mt-0 overflow-hidden focus-visible:outline-none">
                            <ScrollArea className="h-full">
                                <div className="p-4 md:p-8">
                                    <div className="rounded-xl border border-slate-200 bg-white shadow-inner overflow-hidden">
                                        <div className="overflow-x-auto">
                                            <Table className="min-w-[500px]">
                                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                                    <TableRow className="border-b-slate-200">
                                                        <TableHead className="text-[10px] font-black text-slate-900 uppercase tracking-widest pl-6">日期</TableHead>
                                                        <TableHead className="text-[10px] font-black text-slate-900 uppercase tracking-widest">數量</TableHead>
                                                        <TableHead className="text-[10px] font-black text-slate-900 uppercase tracking-widest">狀態</TableHead>
                                                        <TableHead className="text-right text-[10px] font-black text-slate-900 uppercase tracking-widest pr-6">單號</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {isLoadingShipping ? (
                                                        <TableRow><TableCell colSpan={4} className="text-center py-20"><Loader2 className="animate-spin mx-auto h-6 w-6 text-slate-300"/></TableCell></TableRow>
                                                    ) : (
                                                        rawOrders?.map(order => (
                                                            <TableRow key={order.id} className="hover:bg-slate-50 border-b-slate-100">
                                                                <TableCell className="text-[10px] font-code text-slate-600 font-bold pl-6">{order.createdAt ? format((order.createdAt as any).toDate(), 'MM-dd') : '-'}</TableCell>
                                                                <TableCell className="text-xs font-black text-slate-900">{order.cardCount} 張</TableCell>
                                                                <TableCell><Badge variant="secondary" className="text-[9px] h-5 uppercase font-black bg-slate-900 text-white border-none">{order.status}</Badge></TableCell>
                                                                <TableCell className="text-[10px] text-right font-mono text-cyan-700 font-black pr-6">{order.trackingNumber || '--'}</TableCell>
                                                            </TableRow>
                                                        ))
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </div>
                                </div>
                            </ScrollArea>
                        </TabsContent>
                    </Tabs>
                </div>
                <div className="p-6 border-t border-slate-100 bg-slate-50">
                    <Button variant="outline" onClick={() => setIsOpen(false)} className="w-full h-12 rounded-xl font-black bg-white border-slate-200 text-slate-700 hover:bg-slate-100 transition-all">關閉詳細資料</Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function ToggleRoleDialog({ user, onUpdate }: { user: UserProfile, onUpdate: () => void }) {
    const [isProcessing, setIsProcessing] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleToggle = async () => {
        if (!firestore) return;
        setIsProcessing(true);
        const newRole = user.role === 'admin' ? 'user' : 'admin';
        try {
            await updateDoc(doc(firestore, 'users', user.id), { role: newRole });
            toast({ title: '角色已變更' });
            onUpdate();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '變更失敗' });
        } finally { setIsProcessing(false); }
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-[10px] rounded-lg font-black bg-white border-slate-200 text-slate-700 hover:bg-slate-50 transition-all">
                    變更角色
                </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="light rounded-3xl border-none shadow-2xl bg-white text-slate-900">
                <AlertDialogHeader>
                    <AlertDialogTitle className="text-xl font-black text-slate-900 tracking-tight">系統角色權限變更</AlertDialogTitle>
                    <AlertDialogDescription className="font-bold text-slate-600">
                        確定要將 「{user.username}」 從 {user.role} 變更為 {user.role === 'admin' ? '一般會員' : '管理員'} 嗎？<br/>這將影響該帳戶對後台功能的存取能力。
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold">取消</AlertDialogCancel>
                    <AlertDialogAction onClick={handleToggle} disabled={isProcessing} className="rounded-xl bg-slate-900 text-white font-black px-8">
                        {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : '確認執行變更'}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

function AssignAgentDialog({ user, onUpdate }: { user: UserProfile, onUpdate: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedAgentId, setSelectedAgentId] = useState(user.agentId || 'none');
    const [isProcessing, setIsProcessing] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

    const agentsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'agents')) : null, [firestore]);
    const { data: agents } = useCollection<{ id: string; name: string }>(agentsQuery);

    const handleConfirm = async () => {
        if (!firestore) return;
        setIsProcessing(true);
        try {
            if (selectedAgentId === 'none') {
                await updateDoc(doc(firestore, 'users', user.id), {
                    agentId: null,
                    agentName: null
                });
                toast({ title: '已取消業務指定' });
            } else {
                const targetAgent = agents?.find(a => a.id === selectedAgentId);
                await updateDoc(doc(firestore, 'users', user.id), {
                    agentId: selectedAgentId,
                    agentName: targetAgent?.name || '未知業務'
                });
                toast({ title: `已成功指定業務：${targetAgent?.name || selectedAgentId}` });
            }
            onUpdate();
            setIsOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '指定失敗' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className={cn("h-8 text-[10px] rounded-lg font-black bg-white border-slate-200 hover:bg-slate-50 transition-all flex items-center gap-1", user.agentName ? "text-sky-700 border-sky-200 bg-sky-50/50" : "text-slate-700")}>
                    <Briefcase className="w-3 h-3 text-sky-600" />
                    {user.agentName ? `業務: ${user.agentName}` : '指定業務'}
                </Button>
            </DialogTrigger>
            <DialogContent className="light w-[95vw] md:max-w-md rounded-3xl bg-white shadow-2xl border-none p-0 flex flex-col overflow-hidden text-slate-900">
                <DialogTitle className="sr-only">指定業務帳號</DialogTitle>
                <DialogHeader className="p-6 text-center border-b border-slate-100 bg-slate-50">
                    <DialogTitle className="text-lg font-black text-slate-900 tracking-tight">指定業務身份 / 綁定代理</DialogTitle>
                    <p className="text-xs text-slate-500 font-bold mt-1">將用戶 「{user.username}」 指定綁定至特定業務，該業務可查看專屬數據報表與績效。</p>
                </DialogHeader>
                <div className="p-6 space-y-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-700">選擇業務名稱</Label>
                        <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                            <SelectTrigger className="h-12 rounded-xl bg-white border-slate-200 font-bold">
                                <SelectValue placeholder="選擇業務..." />
                            </SelectTrigger>
                            <SelectContent className="bg-white">
                                <SelectItem value="none" className="font-bold text-slate-500">🚫 無業務 (不綁定)</SelectItem>
                                {agents?.map(agent => (
                                    <SelectItem key={agent.id} value={agent.id} className="font-bold text-slate-900">
                                        💼 {agent.name} (ID: {agent.id})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50 gap-2">
                    <Button variant="outline" onClick={() => setIsOpen(false)} className="rounded-xl font-bold border-slate-200">取消</Button>
                    <Button onClick={handleConfirm} disabled={isProcessing} className="rounded-xl bg-slate-900 text-white font-black px-6 hover:bg-slate-800">
                        {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : '確認指定業務'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function ModifyPermissionsDialog({ user, onUpdate }: { user: UserProfile, onUpdate: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [permissions, setPermissions] = useState<string[]>(user.permissions || []);
    const [isProcessing, setIsProcessing] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleConfirm = async () => {
        if(!firestore) return;
        setIsProcessing(true);
        try {
            await updateDoc(doc(firestore, 'users', user.id), { permissions });
            toast({ title: '權限已更新' });
            onUpdate();
            setIsOpen(false);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '設定失敗' });
        } finally { setIsProcessing(false); }
    }

    const handleSelectAll = () => {
        setPermissions(PERMISSION_ITEMS.map(p => p.id));
    };

    const handleClearAll = () => {
        setPermissions([]);
    };

    // 按分類整理
    const categories = Array.from(new Set(PERMISSION_ITEMS.map(p => p.category)));

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="h-8 text-[10px] rounded-lg font-black bg-white border-slate-200 text-slate-700">模組授權</Button></DialogTrigger>
            <DialogContent className="light w-[95vw] md:max-w-2xl max-h-[90vh] rounded-3xl bg-white shadow-2xl border-none text-slate-900 p-0 flex flex-col overflow-hidden">
                <DialogTitle className="sr-only">管理模組授權</DialogTitle>
                <DialogHeader className="p-6 border-b border-slate-100 flex flex-row items-center justify-between">
                    <div>
                        <DialogTitle className="text-xl font-black text-slate-900">管理模組授權 - {user.username}</DialogTitle>
                        <p className="text-xs text-slate-500 font-bold mt-1">獨立開關各後台功能模組的讀取與操作權限。</p>
                    </div>
                    <div className="flex gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={handleSelectAll} className="h-8 text-[10px] font-bold rounded-lg border-slate-200">全選</Button>
                        <Button type="button" variant="outline" size="sm" onClick={handleClearAll} className="h-8 text-[10px] font-bold rounded-lg border-slate-200 text-red-600 hover:text-red-700">全不選</Button>
                    </div>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-6 space-y-6">
                        {categories.map(cat => {
                            const catItems = PERMISSION_ITEMS.filter(p => p.category === cat);
                            return (
                                <div key={cat} className="space-y-3">
                                    <h4 className="text-xs font-black text-slate-500 uppercase tracking-widest pl-1">{cat}</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                                        {catItems.map(item => (
                                            <div key={item.id} className="flex items-center space-x-2.5 p-3 border border-slate-100 rounded-2xl hover:bg-slate-50 transition-all cursor-pointer group hover:border-slate-300 shadow-sm bg-white">
                                                <Checkbox id={`p-${item.id}`} checked={permissions.includes(item.id)} onCheckedChange={(c) => setPermissions(prev => c ? [...prev, item.id] : prev.filter(p => p !== item.id))} />
                                                <Label htmlFor={`p-${item.id}`} className="text-xs cursor-pointer font-bold text-slate-800 group-hover:text-slate-950">{item.label}</Label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </ScrollArea>
                </div>
                <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50">
                    <Button onClick={handleConfirm} disabled={isProcessing} className="w-full rounded-2xl h-14 font-black bg-slate-900 text-white shadow-xl hover:bg-slate-800 text-base">{isProcessing ? <Loader2 className="animate-spin"/> : '儲存授權設定'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function ModifyPointsDialog({ user, onUpdate }: { user: UserProfile, onUpdate: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [points, setPoints] = useState(0);
    const [currency, setCurrency] = useState<'diamond' | 'p-point' | 'free-ticket'>('diamond');
    const [isProcessing, setIsProcessing] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

    const handleConfirm = async () => {
        if (!firestore || points === 0) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const userRef = doc(firestore, 'users', user.id);
            
            if (currency === 'free-ticket') {
                const currentTickets = user.freeDrawTickets || 0;
                const newTotal = Math.max(0, currentTickets + points);
                batch.update(userRef, { freeDrawTickets: newTotal });
                batch.set(doc(collection(firestore, 'transactions')), { 
                    userId: user.id, 
                    transactionType: 'Deposit', 
                    amount: points, 
                    currency: 'free-ticket', 
                    section: 'admin', 
                    details: `管理員手動調整 (免費抽卡券)`, 
                    transactionDate: serverTimestamp() 
                });
            } else {
                const field = currency === 'diamond' ? 'points' : 'bonusPoints';
                batch.update(userRef, { [field]: increment(points) });
                batch.set(doc(collection(firestore, 'transactions')), { 
                    userId: user.id, 
                    transactionType: 'Deposit', 
                    amount: points, 
                    currency, 
                    section: 'admin', 
                    details: `管理員手動調整 (${currency === 'diamond' ? '鑽石' : 'P點'})`, 
                    transactionDate: serverTimestamp() 
                });
            }
            await batch.commit();
            toast({ title: '資產已更新' });
            onUpdate(); setIsOpen(false); setPoints(0);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: '調整失敗' });
        } finally { setIsProcessing(false); }
    };
    
    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild><Button variant="outline" size="sm" className="h-8 text-[10px] rounded-lg font-black bg-white border-slate-200 text-slate-700">資產修正</Button></DialogTrigger>
            <DialogContent className="light w-[95vw] md:max-w-md max-h-[90vh] rounded-3xl bg-white shadow-2xl border-none p-0 flex flex-col overflow-hidden text-slate-900">
                <DialogTitle className="sr-only">資產手動修正</DialogTitle>
                <DialogHeader className="p-6 md:p-8 pb-3 md:pb-4 text-center border-b border-slate-50">
                    <DialogTitle className="text-lg md:text-xl font-black text-slate-900 uppercase tracking-widest italic">資產手動修正協議</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-6 md:p-8">
                        <div className="space-y-6 md:space-y-8">
                            <RadioGroup value={currency} onValueChange={(v: any) => setCurrency(v)} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className={cn("flex flex-col items-center gap-2 p-3.5 border-2 rounded-2xl cursor-pointer transition-all", currency === 'diamond' ? 'border-cyan-600 bg-cyan-50 shadow-md' : 'border-slate-100 bg-slate-50 opacity-60')}>
                                    <RadioGroupItem value="diamond" id="dia" className="sr-only"/><Gem className="h-5 w-5 text-cyan-600"/><Label htmlFor="dia" className={cn("cursor-pointer font-black text-[10px] uppercase text-center", currency === 'diamond' ? "text-slate-900" : "text-slate-400")}>鑽石 💎</Label>
                                </div>
                                <div className={cn("flex flex-col items-center gap-2 p-3.5 border-2 rounded-2xl cursor-pointer transition-all", currency === 'p-point' ? 'border-amber-600 bg-amber-50 shadow-md' : 'border-slate-100 bg-slate-50 opacity-60')}>
                                    <RadioGroupItem value="p-point" id="pt" className="sr-only"/><PPlusIcon className="h-5 w-5"/><Label htmlFor="pt" className={cn("cursor-pointer font-black text-[10px] uppercase text-center", currency === 'p-point' ? "text-slate-900" : "text-slate-400")}>紅利 P點</Label>
                                </div>
                                <div className={cn("flex flex-col items-center gap-2 p-3.5 border-2 rounded-2xl cursor-pointer transition-all", currency === 'free-ticket' ? 'border-emerald-600 bg-emerald-50 shadow-md' : 'border-slate-100 bg-slate-50 opacity-60')}>
                                    <RadioGroupItem value="free-ticket" id="ft" className="sr-only"/><Ticket className="h-5 w-5 text-emerald-600"/><Label htmlFor="ft" className={cn("cursor-pointer font-black text-[10px] uppercase text-center", currency === 'free-ticket' ? "text-slate-900" : "text-slate-400")}>免費抽卡券 🎟️</Label>
                                </div>
                            </RadioGroup>
                            <div className="space-y-3">
                                <Label className="text-[9px] md:text-[10px] font-black uppercase text-slate-500 tracking-widest block text-center">調整數量 (正數增加，負數扣除)</Label>
                                <Input type="number" value={points || ''} onChange={(e) => setPoints(parseInt(e.target.value) || 0)} className="h-14 md:h-16 rounded-2xl text-2xl md:text-3xl font-black text-center border-slate-200 bg-white text-slate-900" placeholder="0" />
                            </div>
                        </div>
                    </ScrollArea>
                </div>
                <DialogFooter className="p-6 md:p-8 border-t border-slate-50">
                    <Button onClick={handleConfirm} disabled={isProcessing} className="w-full rounded-2xl h-14 font-black bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-all text-lg">{isProcessing ? <Loader2 className="animate-spin h-5 w-5"/> : '確認執行資產變動'}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function GrantFreeTicketDialog({ user, onUpdate }: { user: UserProfile, onUpdate: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [ticketCount, setTicketCount] = useState<number>(1);
    const [reason, setReason] = useState<string>('新春/節慶活動贈送');
    const [customReason, setCustomReason] = useState<string>('');
    const [isProcessing, setIsProcessing] = useState(false);
    const firestore = useFirestore();
    const { toast } = useToast();

    const quickReasons = [
        '新春/節慶活動贈送',
        'VIP會員專屬福利',
        '系統維護/延遲補償',
        '直播抽獎/社群互動獎勵',
        '首充/滿額回饋',
        '客訴協調補償',
        '手動自訂原因'
    ];

    const currentTickets = user.freeDrawTickets || 0;
    const finalReason = reason === '手動自訂原因' ? (customReason.trim() || '管理員手動贈送') : reason;

    const handleConfirm = async () => {
        if (!firestore || ticketCount === 0) return;
        setIsProcessing(true);
        try {
            const batch = writeBatch(firestore);
            const userRef = doc(firestore, 'users', user.id);
            
            const updatedTotal = Math.max(0, currentTickets + ticketCount);
            batch.update(userRef, { freeDrawTickets: updatedTotal });

            batch.set(doc(collection(firestore, 'transactions')), {
                userId: user.id,
                transactionType: 'GrantFreeTicket',
                amount: ticketCount,
                currency: 'free-ticket',
                section: 'admin',
                details: `管理員派發免費券: ${finalReason} (${ticketCount > 0 ? `+${ticketCount}` : ticketCount}張，現有: ${updatedTotal}張)`,
                transactionDate: serverTimestamp()
            });

            await batch.commit();
            toast({ 
                title: ticketCount > 0 ? '免費抽卡券已發放！🎟️' : '免費抽卡券已調整', 
                description: `已為會員「${user.username}」${ticketCount > 0 ? `發放 ${ticketCount} 張` : `扣除 ${Math.abs(ticketCount)} 張`}免費抽卡券（現持有: ${updatedTotal} 張）` 
            });
            onUpdate();
            setIsOpen(false);
            setTicketCount(1);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: '派發失敗', description: '請確認權限與網路連線後重試' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-8 text-[10px] rounded-lg font-black bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 shadow-sm flex items-center gap-1 transition-all"
                >
                    <Ticket className="w-3 h-3 text-emerald-600" />
                    <span>贈免費券</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="light w-[95vw] md:max-w-md max-h-[92vh] rounded-3xl bg-white shadow-2xl border-none p-0 flex flex-col overflow-hidden text-slate-900">
                <DialogTitle className="sr-only">派發活動免費抽卡券</DialogTitle>
                <DialogHeader className="p-6 md:p-8 pb-3 md:pb-4 text-center border-b border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-white">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300 mx-auto flex items-center justify-center text-2xl shadow-inner mb-2">
                        🎟️
                    </div>
                    <DialogTitle className="text-lg md:text-xl font-black text-slate-900 tracking-tight">
                        發放活動免費抽卡券
                    </DialogTitle>
                    <p className="text-xs text-slate-500 font-bold mt-0.5">
                        目標會員：<span className="text-emerald-700 font-black">{user.username}</span> ({user.email})
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-6 md:p-8">
                        <div className="space-y-6">
                            {/* 目前持有張數狀態 */}
                            <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 flex items-center justify-between shadow-sm">
                                <div className="flex items-center gap-2.5">
                                    <Ticket className="w-6 h-6 text-emerald-600 shrink-0" />
                                    <div>
                                        <p className="text-xs font-black text-slate-800">目前持有票券</p>
                                        <p className="text-[10px] text-emerald-700 font-bold">可用於支援免費券抽卡之卡池</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black font-code text-emerald-700">{currentTickets}</span>
                                    <span className="text-xs font-bold text-slate-500 ml-1">張</span>
                                </div>
                            </div>

                            {/* 快捷增減按鈕 */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    快捷選擇發放張數
                                </Label>
                                <div className="grid grid-cols-6 gap-1.5">
                                    {[1, 2, 3, 5, 10, -1].map((val) => (
                                        <Button
                                            key={val}
                                            type="button"
                                            variant={ticketCount === val ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setTicketCount(val)}
                                            className={cn(
                                                "h-9 font-black text-xs rounded-xl transition-all",
                                                ticketCount === val 
                                                    ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-md" 
                                                    : "border-slate-200 text-slate-700 hover:bg-slate-50"
                                            )}
                                        >
                                            {val > 0 ? `+${val}` : val}
                                        </Button>
                                    ))}
                                </div>
                            </div>

                            {/* 自訂數量輸入框 */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block text-center">
                                    調整張數 (輸入正數發放，負數扣除)
                                </Label>
                                <div className="relative max-w-[200px] mx-auto">
                                    <Input
                                        type="number"
                                        value={ticketCount || ''}
                                        onChange={(e) => setTicketCount(parseInt(e.target.value) || 0)}
                                        className="h-14 rounded-2xl text-2xl font-black text-center border-2 border-emerald-300 bg-white text-slate-900 focus-visible:ring-emerald-500 shadow-inner"
                                        placeholder="1"
                                    />
                                </div>
                                <p className="text-[11px] text-center text-slate-500 font-bold">
                                    調整後預計持有：
                                    <span className="font-black text-emerald-700 ml-1">
                                        {Math.max(0, currentTickets + ticketCount)} 張
                                    </span>
                                </p>
                            </div>

                            {/* 發放原因選單 */}
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">
                                    發放原因 / 活動備註
                                </Label>
                                <Select value={reason} onValueChange={setReason}>
                                    <SelectTrigger className="h-11 rounded-xl bg-white border-slate-200 font-bold text-xs">
                                        <SelectValue placeholder="選擇發放原因..." />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white">
                                        {quickReasons.map(r => (
                                            <SelectItem key={r} value={r} className="font-bold text-xs">
                                                {r}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>

                                {reason === '手動自訂原因' && (
                                    <Input
                                        placeholder="請輸入自訂派發原因..."
                                        value={customReason}
                                        onChange={(e) => setCustomReason(e.target.value)}
                                        className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs mt-2"
                                    />
                                )}
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                <DialogFooter className="p-6 md:p-8 border-t border-slate-100 bg-slate-50">
                    <Button 
                        onClick={handleConfirm} 
                        disabled={isProcessing || ticketCount === 0} 
                        className="w-full rounded-2xl h-12 sm:h-14 font-black bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xl hover:from-emerald-500 hover:to-teal-500 transition-all text-sm sm:text-base cursor-pointer"
                    >
                        {isProcessing ? (
                            <><Loader2 className="animate-spin mr-2 h-5 w-5" /> 處理中...</>
                        ) : (
                            <><Ticket className="mr-2 h-5 w-5" /> 確認發放 {ticketCount > 0 ? `+${ticketCount}` : ticketCount} 張免費券</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function BatchGrantFreeTicketsDialog({ onComplete }: { onComplete: () => void }) {
    const [isOpen, setIsOpen] = useState(false);
    const [targetScope, setTargetScope] = useState<'all' | 'level' | 'tag' | 'users_only'>('all');
    const [selectedLevel, setSelectedLevel] = useState<string>('all');
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [ticketCount, setTicketCount] = useState<number>(1);
    const [reason, setReason] = useState<string>('全服活動福利');
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);

    const firestore = useFirestore();
    const { toast } = useToast();

    const usersQuery = useMemoFirebase(() => {
        if (!firestore || !isOpen) return null;
        return query(collection(firestore, 'users'), limit(500));
    }, [firestore, isOpen]);
    const { data: allUsers } = useCollection<UserProfile>(usersQuery);

    const targetUsers = useMemo(() => {
        if (!allUsers) return [];
        return allUsers.filter(u => {
            if (targetScope === 'users_only') return u.role !== 'admin';
            if (targetScope === 'level') {
                if (selectedLevel === 'all') return true;
                return u.userLevel === selectedLevel;
            }
            if (targetScope === 'tag') {
                if (!selectedTag.trim()) return true;
                return u.tags?.includes(selectedTag.trim());
            }
            return true;
        });
    }, [allUsers, targetScope, selectedLevel, selectedTag]);

    const handleBatchGrant = async () => {
        if (!firestore || targetUsers.length === 0 || ticketCount <= 0) return;
        setIsProcessing(true);
        setProgress({ current: 0, total: targetUsers.length });

        try {
            const chunkSize = 200;
            let processed = 0;

            for (let i = 0; i < targetUsers.length; i += chunkSize) {
                const chunk = targetUsers.slice(i, i + chunkSize);
                const batch = writeBatch(firestore);

                for (const u of chunk) {
                    const userRef = doc(firestore, 'users', u.id);
                    const currentTickets = u.freeDrawTickets || 0;
                    const newTotal = Math.max(0, currentTickets + ticketCount);

                    batch.update(userRef, { freeDrawTickets: newTotal });

                    batch.set(doc(collection(firestore, 'transactions')), {
                        userId: u.id,
                        transactionType: 'BatchGrantFreeTicket',
                        amount: ticketCount,
                        currency: 'free-ticket',
                        section: 'admin',
                        details: `【全體/批次派發】免費抽卡券: ${reason} (+${ticketCount}張)`,
                        transactionDate: serverTimestamp()
                    });
                }

                await batch.commit();
                processed += chunk.length;
                setProgress({ current: processed, total: targetUsers.length });
            }

            toast({
                title: '批次派發成功！🎉',
                description: `已成功為 ${targetUsers.length} 位會員每人發送 ${ticketCount} 張免費抽卡券（共派發 ${targetUsers.length * ticketCount} 張）`
            });
            onComplete();
            setIsOpen(false);
            setProgress(null);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '批次發放失敗', description: '部分會員可能未完成更新，請檢查紀錄' });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button 
                    className="h-11 sm:h-12 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white font-black shadow-lg shadow-emerald-700/20 flex items-center gap-2 cursor-pointer transition-all active:scale-95 text-xs sm:text-sm"
                >
                    <Ticket className="w-4 h-4 text-amber-300" />
                    <span>🎟️ 批次 / 全站派發免費券</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="light w-[95vw] md:max-w-lg max-h-[92vh] rounded-3xl bg-white shadow-2xl border-none p-0 flex flex-col overflow-hidden text-slate-900">
                <DialogTitle className="sr-only">批次派發免費抽卡券</DialogTitle>
                <DialogHeader className="p-6 text-center border-b border-emerald-100 bg-gradient-to-b from-emerald-50 to-white">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-100 border border-emerald-300 mx-auto flex items-center justify-center text-2xl shadow-inner mb-2">
                        🎁
                    </div>
                    <DialogTitle className="text-xl font-black text-slate-900 tracking-tight">
                        全站 / 批次派發活動免費券
                    </DialogTitle>
                    <p className="text-xs text-slate-500 font-bold mt-1">
                        一鍵向全體會員或指定等級/群組發送活動免費抽卡券
                    </p>
                </DialogHeader>

                <div className="flex-1 overflow-hidden">
                    <ScrollArea className="h-full p-6 space-y-5">
                        {/* 發送對象範圍 */}
                        <div className="space-y-2">
                            <Label className="text-xs font-black text-slate-700">1. 選擇發送對象範圍</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button
                                    type="button"
                                    variant={targetScope === 'all' ? "default" : "outline"}
                                    onClick={() => setTargetScope('all')}
                                    className={cn("h-10 text-xs font-bold rounded-xl", targetScope === 'all' ? "bg-emerald-700 text-white" : "border-slate-200 text-slate-700")}
                                >
                                    🌟 全體會員 ({allUsers?.length || 0}人)
                                </Button>
                                <Button
                                    type="button"
                                    variant={targetScope === 'users_only' ? "default" : "outline"}
                                    onClick={() => setTargetScope('users_only')}
                                    className={cn("h-10 text-xs font-bold rounded-xl", targetScope === 'users_only' ? "bg-emerald-700 text-white" : "border-slate-200 text-slate-700")}
                                >
                                    👤 僅一般玩家 (排除管理員)
                                </Button>
                                <Button
                                    type="button"
                                    variant={targetScope === 'level' ? "default" : "outline"}
                                    onClick={() => setTargetScope('level')}
                                    className={cn("h-10 text-xs font-bold rounded-xl", targetScope === 'level' ? "bg-emerald-700 text-white" : "border-slate-200 text-slate-700")}
                                >
                                    👑 依會員等級指定
                                </Button>
                                <Button
                                    type="button"
                                    variant={targetScope === 'tag' ? "default" : "outline"}
                                    onClick={() => setTargetScope('tag')}
                                    className={cn("h-10 text-xs font-bold rounded-xl", targetScope === 'tag' ? "bg-emerald-700 text-white" : "border-slate-200 text-slate-700")}
                                >
                                    🏷️ 依會員標籤指定
                                </Button>
                            </div>

                            {targetScope === 'level' && (
                                <div className="pt-2">
                                    <Select value={selectedLevel} onValueChange={setSelectedLevel}>
                                        <SelectTrigger className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs">
                                            <SelectValue placeholder="選擇目標等級..." />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                            <SelectItem value="all">全部等級</SelectItem>
                                            <SelectItem value="新手收藏家">新手收藏家</SelectItem>
                                            <SelectItem value="進階收藏家">進階收藏家</SelectItem>
                                            <SelectItem value="資深收藏家">資深收藏家</SelectItem>
                                            <SelectItem value="卡牌大師">卡牌大師</SelectItem>
                                            <SelectItem value="殿堂級玩家">殿堂級玩家</SelectItem>
                                            <SelectItem value="傳奇收藏家">傳奇收藏家</SelectItem>
                                            <SelectItem value="P+卡神">P+卡神</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            {targetScope === 'tag' && (
                                <div className="pt-2">
                                    <Input
                                        placeholder="輸入標籤名稱 (如: VIP, 大戶)..."
                                        value={selectedTag}
                                        onChange={e => setSelectedTag(e.target.value)}
                                        className="h-10 rounded-xl bg-white border-slate-200 font-bold text-xs"
                                    />
                                </div>
                            )}
                        </div>

                        {/* 每人派發張數 */}
                        <div className="space-y-2 pt-2">
                            <Label className="text-xs font-black text-slate-700">2. 每人派發張數</Label>
                            <div className="grid grid-cols-5 gap-1.5 mb-2">
                                {[1, 2, 3, 5, 10].map(cnt => (
                                    <Button
                                        key={cnt}
                                        type="button"
                                        variant={ticketCount === cnt ? "default" : "outline"}
                                        size="sm"
                                        onClick={() => setTicketCount(cnt)}
                                        className={cn("h-9 font-black text-xs rounded-xl", ticketCount === cnt ? "bg-emerald-600 text-white" : "border-slate-200 text-slate-700")}
                                    >
                                        {cnt} 張
                                    </Button>
                                ))}
                            </div>
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={ticketCount || ''}
                                onChange={e => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="h-11 rounded-xl text-center font-black text-base border-slate-200 bg-white"
                                placeholder="輸入張數..."
                            />
                        </div>

                        {/* 派發原因/活動名稱 */}
                        <div className="space-y-2 pt-2">
                            <Label className="text-xs font-black text-slate-700">3. 派發活動名稱 / 理由備註</Label>
                            <Input
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                placeholder="例：全服維護補償、春節狂歡贈禮..."
                                className="h-11 rounded-xl bg-white border-slate-200 font-bold text-xs"
                            />
                        </div>

                        {/* 即時預覽摘要卡片 */}
                        <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-900 to-slate-900 text-white shadow-md space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-300 font-bold">預計符合發放人數：</span>
                                <span className="font-mono font-black text-emerald-300 text-sm">{targetUsers.length} 位會員</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-slate-300 font-bold">每人發放：</span>
                                <span className="font-mono font-black text-amber-300 text-sm">{ticketCount} 張免費券</span>
                            </div>
                            <div className="border-t border-slate-700/80 pt-2 flex items-center justify-between text-xs">
                                <span className="text-slate-200 font-black">總計將發送免費券：</span>
                                <span className="font-mono font-black text-emerald-400 text-base">{targetUsers.length * ticketCount} 張</span>
                            </div>
                        </div>

                        {/* 進度條 */}
                        {progress && (
                            <div className="space-y-1.5 pt-2">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                    <span>派發進度</span>
                                    <span>{progress.current} / {progress.total} 位</span>
                                </div>
                                <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden">
                                    <div 
                                        className="h-full bg-emerald-500 transition-all duration-300"
                                        style={{ width: `${(progress.current / (progress.total || 1)) * 100}%` }}
                                    />
                                </div>
                            </div>
                        )}
                    </ScrollArea>
                </div>

                <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50">
                    <Button 
                        onClick={handleBatchGrant} 
                        disabled={isProcessing || targetUsers.length === 0 || ticketCount <= 0} 
                        className="w-full rounded-2xl h-12 sm:h-14 font-black bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-700 hover:from-emerald-500 hover:to-teal-500 text-white shadow-xl transition-all text-sm sm:text-base cursor-pointer"
                    >
                        {isProcessing ? (
                            <><Loader2 className="animate-spin mr-2 h-5 w-5" /> 正在批量發送中...</>
                        ) : (
                            <><Send className="mr-2 h-5 w-5" /> 確認執行批量派發 ({targetUsers.length} 人)</>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function UsersAdminPage() {
  const firestore = useFirestore();
  const { user: currentUser } = useUser();
  const [searchTerm, setSearchTerm] = useState('');
  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;

  const usersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'users'), limit(50)) : null, [firestore]);
  const { data: users, isLoading, forceRefetch } = useCollection<UserProfile>(usersQuery);
  
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    let result = users.filter(u => !searchTerm.trim() || u.username?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()) || u.id.includes(searchTerm));
    return result.sort((a, b) => ((b.createdAt as any)?.seconds || 0) - ((a.createdAt as any)?.seconds || 0));
  }, [users, searchTerm]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-6">
        <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">會員管理</h1>
            <p className="mt-1 text-sm text-slate-600 font-bold">查閱並管理全站會員資料、帳戶資產與活動抽卡券發放。</p>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full xl:w-auto">
            <BatchGrantFreeTicketsDialog onComplete={() => forceRefetch?.()} />
            <div className="relative w-full sm:w-80 xl:w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input placeholder="搜尋名稱、Email 或 UID..." className="pl-12 h-11 sm:h-12 bg-white border-slate-200 rounded-2xl shadow-sm font-black text-slate-900 placeholder:text-slate-400" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-lg overflow-hidden rounded-3xl bg-white">
        <div className="overflow-x-auto custom-scrollbar">
            <Table className="min-w-[1050px]">
            <TableHeader className="bg-slate-50">
                <TableRow className="border-b-slate-200">
                    <TableHead className="pl-8 text-[10px] font-black uppercase text-slate-900 tracking-widest py-5">會員資訊</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest">等級稱號</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest">帳戶資產</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-slate-900 tracking-widest">系統角色</TableHead>
                    <TableHead className="text-right pr-8 text-[10px] font-black uppercase text-slate-900 tracking-widest">管理操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}><TableCell colSpan={5} className="p-6"><Skeleton className="h-12 w-full rounded-2xl" /></TableCell></TableRow>
                )) : filteredUsers.length > 0 ? filteredUsers.map((user) => (
                    <TableRow key={user.id} className={cn("hover:bg-slate-50/80 transition-colors border-b-slate-100", user.email === SUPER_ADMIN_EMAIL && "bg-blue-50/40")}>
                    <TableCell className="pl-8 py-5"><UserDetailsDialog user={user} /></TableCell>
                    <TableCell><Badge variant="outline" className="font-black text-[10px] border-slate-300 text-slate-700 uppercase h-6 px-3 bg-white shadow-sm">{user.userLevel}</Badge></TableCell>
                    <TableCell className="font-code">
                        <div className="flex flex-col gap-1">
                            <span className="flex items-center gap-1.5 text-sm font-black text-slate-900">{user.points?.toLocaleString() || 0} <Gem className="w-3.5 h-3.5 text-cyan-600" /></span>
                            <span className="flex items-center gap-1.5 text-[11px] font-black text-amber-700">{user.bonusPoints?.toLocaleString() || 0} <PPlusIcon className="w-3.5 h-3.5" /></span>
                            <span className="flex items-center gap-1.5 text-[11px] font-black text-emerald-700">
                                {user.freeDrawTickets || 0} <Ticket className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-[9px] text-emerald-600/80 font-bold">張免費券</span>
                            </span>
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                            <Badge variant={user.role === 'admin' ? 'destructive' : 'secondary'} className={cn("text-[9px] uppercase font-black h-5 px-2 border-none shadow-sm", user.role === 'admin' ? "bg-red-600 text-white" : "bg-slate-200 text-slate-700")}>{user.role}</Badge>
                            {user.agentName && (
                                <Badge variant="outline" className="text-[9px] font-bold h-5 px-2 bg-sky-50 text-sky-700 border-sky-200 flex items-center gap-1">
                                    <Briefcase className="w-2.5 h-2.5 text-sky-600" />
                                    {user.agentName}
                                </Badge>
                            )}
                        </div>
                    </TableCell>
                    <TableCell className="text-right pr-8 py-5"><div className="flex justify-end gap-2 flex-wrap items-center">
                        {isSuperAdmin && user.email !== SUPER_ADMIN_EMAIL && (
                            <>
                                <ToggleRoleDialog user={user} onUpdate={() => forceRefetch?.()} />
                                {user.role === 'admin' && <ModifyPermissionsDialog user={user} onUpdate={() => forceRefetch?.()} />}
                                <AssignAgentDialog user={user} onUpdate={() => forceRefetch?.()} />
                            </>
                        )}
                        <GrantFreeTicketDialog user={user} onUpdate={() => forceRefetch?.()} />
                        <Link href={`/admin/marketing-emails?targetUser=${user.id}`}>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] rounded-lg font-black bg-white border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 shadow-sm flex items-center gap-1">
                                <Mail className="w-3 h-3" />
                                寄信
                            </Button>
                        </Link>
                        <ModifyPointsDialog user={user} onUpdate={() => forceRefetch?.()} />
                    </div></TableCell>
                    </TableRow>
                )) : (
                    <TableRow>
                        <TableCell colSpan={5} className="py-20 text-center text-slate-400 font-black tracking-widest uppercase">
                            查無符合條件的會員
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
            </Table>
        </div>
      </Card>
    </div>
  );
}
