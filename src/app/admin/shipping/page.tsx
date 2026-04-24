'use client';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, writeBatch, serverTimestamp, increment } from 'firebase/firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { Package, Gift, SearchCode, Eye, X, Image as ImageIcon, CheckCircle2, Loader2, MapPin, Truck, Hash, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { SafeImage } from '@/components/safe-image';
import { Card } from '@/components/ui/card';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'cancelled';

interface ShippedCard {
    cardId: string;
    rarity: string;
    isFoil: boolean;
    category: string;
}

interface ShippingOrder {
    id: string;
    userId: string;
    name: string;
    phone: string;
    cardIds: ShippedCard[];
    cardCount: number;
    address: string;
    status: OrderStatus;
    shippingMethod: '7-11' | '郵寄' | '面交自取';
    createdAt: { seconds: number };
    trackingNumber?: string;
    redemptionItem?: string;
    fee?: number;
}

interface CardData {
    id: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
}

const statusTabs = [
    { value: 'pending', label: '待處理' },
    { value: 'processing', label: '處理中' },
    { value: 'shipped', label: '已出貨' },
    { value: 'cancelled', label: '已取消' }
];

function OrderDetailsDialog({ order, cardMap, isOpen, onOpenChange }: { 
    order: ShippingOrder | null, 
    cardMap: Map<string, CardData>,
    isOpen: boolean,
    onOpenChange: (open: boolean) => void 
}) {
    if (!order) return null;
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="light max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white rounded-2xl border-none shadow-2xl text-slate-900">
                <DialogHeader className="p-8 pb-6 border-b border-slate-100 bg-slate-50">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <SearchCode className="text-slate-400 h-5 w-5" /> 揀貨詳情
                    </DialogTitle>
                    <DialogDescription className="font-mono text-[10px] font-bold text-slate-400">ID: {order.id}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 p-8">
                    {order.redemptionItem ? (
                        <div className="flex flex-col items-center py-20 text-center space-y-4">
                            <Gift className="w-20 h-20 text-amber-500 opacity-20" />
                            <p className="text-xl font-black">{order.redemptionItem}</p>
                            <Badge variant="outline">紅利兌換獎品</Badge>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {order.cardIds?.map((c, i) => {
                                const cardInfo = cardMap.get(c.cardId);
                                return (
                                    <div key={i} className="space-y-2">
                                        <div className="relative aspect-[2.5/3.5] rounded-xl border border-slate-100 bg-slate-50 overflow-hidden shadow-sm">
                                            {cardInfo ? <SafeImage src={cardInfo.imageUrl} alt="c" fill className="object-cover" /> : <ImageIcon className="absolute inset-0 m-auto text-slate-200" />}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-900 truncate">{cardInfo?.name || '未知卡片'}</p>
                                        <Badge className="text-[8px] h-4 uppercase font-bold" variant="outline">{c.rarity}</Badge>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><MapPin className="h-4 w-4 text-slate-400"/> {order.address}</div>
                    <Button onClick={() => onOpenChange(false)} className="rounded-xl bg-slate-900 px-8 text-white">關閉</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function ShippingAdminPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<OrderStatus>('pending');
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [selectedOrder, setSelectedOrder] = useState<ShippingOrder | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  // 取消訂單確認視窗狀態
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<ShippingOrder | null>(null);
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);

  const ordersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'shippingOrders') : null, [firestore]);
  const { data: allOrders, isLoading, forceRefetch } = useCollection<ShippingOrder>(ordersQuery);
  const cardsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]);
  const { data: allCards } = useCollection<CardData>(cardsQuery);

  const cardMap = useMemo(() => {
      const map = new Map<string, CardData>();
      allCards?.forEach(c => map.set(c.id, c));
      return map;
  }, [allCards]);

  const filteredOrders = useMemo(() => {
    if (!allOrders) return [];
    return allOrders.filter(o => o.status === activeTab).sort((a,b) => b.createdAt.seconds - a.createdAt.seconds);
  }, [allOrders, activeTab]);

  useEffect(() => {
    if (allOrders) {
        const trks: Record<string, string> = {};
        allOrders.forEach(o => trks[o.id] = o.trackingNumber || '');
        setTrackingNumbers(prev => ({ ...prev, ...trks }));
    }
  }, [allOrders]);

  const handleStatusChange = async (order: ShippingOrder, newStatus: string) => {
    if (!firestore) return;
    
    // 如果是改為「已取消」，先開啟確認視窗
    if (newStatus === 'cancelled') {
        setOrderToCancel(order);
        setIsCancelConfirmOpen(true);
        return;
    }

    try {
        await updateDoc(doc(firestore, 'shippingOrders', order.id), { status: newStatus });
        toast({ title: '狀態已更新' });
    } catch (e) {
        toast({ variant: 'destructive', title: '更新失敗' });
    }
  };

  const confirmCancelOrder = async () => {
    if (!firestore || !orderToCancel) return;
    
    setIsProcessingCancel(true);
    try {
        const batch = writeBatch(firestore);
        
        // 1. 更新訂單狀態
        batch.update(doc(firestore, 'shippingOrders', orderToCancel.id), { status: 'cancelled' });
        
        // 2. 退還手續費 (如果有)
        if ((orderToCancel.fee || 0) > 0) {
            batch.update(doc(firestore, 'users', orderToCancel.userId), { 
                points: increment(orderToCancel.fee!) 
            });
            batch.set(doc(collection(firestore, 'transactions')), { 
                userId: orderToCancel.userId, 
                transactionType: 'Refund', 
                section: 'shipping', 
                currency: 'diamond', 
                amount: orderToCancel.fee, 
                details: `管理員取消運單 ${orderToCancel.id} 並退還手續費`, 
                transactionDate: serverTimestamp() 
            });
        }
        
        // 3. 退還卡片資產
        for (const cardInfo of orderToCancel.cardIds) {
            const newUserCardRef = doc(collection(firestore, 'users', orderToCancel.userId, 'userCards'));
            batch.set(newUserCardRef, { 
                cardId: cardInfo.cardId, 
                userId: orderToCancel.userId, 
                isFoil: cardInfo.isFoil, 
                rarity: cardInfo.rarity, 
                category: cardInfo.category,
                returnedFrom: orderToCancel.id,
                returnedAt: serverTimestamp()
            });
        }
        
        await batch.commit();
        toast({ title: '成功', description: '訂單已取消，資產已退還給會員。' });
        if (forceRefetch) forceRefetch();
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: '取消失敗', description: '處理資產退還時發生錯誤。' });
    } finally {
        setIsProcessingCancel(false);
        setIsCancelConfirmOpen(false);
        setOrderToCancel(null);
    }
  };

  return (
    <div className="space-y-8 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-black tracking-tight">出貨中心</h1>
        <Badge variant="outline" className="bg-white border-slate-200">實時同步：已啟動</Badge>
      </div>

       <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OrderStatus)} className="space-y-6">
            <TabsList className="bg-slate-100 p-1 rounded-xl h-12 w-fit">
                {statusTabs.map(tab => (
                     <TabsTrigger key={tab.value} value={tab.value} className="rounded-lg px-6 font-bold text-xs">{tab.label}</TabsTrigger>
                ))}
            </TabsList>
            
            <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
                <ScrollArea className="w-full">
                    <Table className="min-w-[1000px]">
                        <TableHeader className="bg-slate-50"><TableRow><TableHead className="pl-8">收件人</TableHead><TableHead>內容</TableHead><TableHead>地址</TableHead><TableHead>物流單號</TableHead><TableHead className="text-right pr-8">狀態管理</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {isLoading ? Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={5} className="p-6"><Skeleton className="h-10 w-full rounded-xl"/></TableCell></TableRow>) : 
                            filteredOrders.map(order => (
                                <TableRow key={order.id} className="hover:bg-slate-50 transition-colors border-slate-100">
                                    <TableCell className="pl-8">
                                        <p className="font-bold text-slate-900">{order.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400">{order.phone}</p>
                                    </TableCell>
                                    <TableCell>
                                        <button onClick={() => { setSelectedOrder(order); setIsDetailsOpen(true); }} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                            {order.redemptionItem ? '紅利禮品' : `${order.cardCount} 張卡片`} <Eye className="h-3 w-3" />
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[200px] truncate text-slate-500">{order.address}</TableCell>
                                    <TableCell>
                                        <Input 
                                            value={trackingNumbers[order.id] || ''}
                                            onChange={(e) => setTrackingNumbers(prev => ({ ...prev, [order.id]: e.target.value }))}
                                            onBlur={() => updateDoc(doc(firestore!, 'shippingOrders', order.id), { trackingNumber: trackingNumbers[order.id] })}
                                            placeholder="輸入單號"
                                            className="h-9 w-36 bg-slate-50 border-slate-200 text-xs font-bold text-slate-900"
                                            disabled={order.status === 'cancelled'}
                                        />
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <Select 
                                            defaultValue={order.status} 
                                            onValueChange={(v) => handleStatusChange(order, v)}
                                            disabled={order.status === 'cancelled'}
                                        >
                                            <SelectTrigger className="w-[110px] h-9 rounded-lg font-bold text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl light">
                                                {statusTabs.map(s => (
                                                    <SelectItem key={s.value} value={s.value} className="text-xs font-bold">
                                                        {s.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </Card>
        </Tabs>
        
        <OrderDetailsDialog order={selectedOrder} cardMap={cardMap} isOpen={isDetailsOpen} onOpenChange={setIsDetailsOpen} />

        <AlertDialog open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
            <AlertDialogContent className="light rounded-3xl border-none shadow-2xl bg-white text-slate-900">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-xl font-black text-rose-600">
                        <AlertTriangle className="h-6 w-6" /> 確認取消訂單並退還資產？
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="font-bold text-slate-600 space-y-4">
                            <p>您即將把此訂單標記為「已取消」。這將會觸發以下自動程序：</p>
                            <ul className="list-disc pl-5 space-y-1 text-slate-900">
                                <li>退還該訂單所有卡片至會員收藏庫</li>
                                <li>退還該訂單扣除的手續費 (鑽石)</li>
                                <li><span className="text-rose-600 underline">注意：訂單一旦取消並退產，將無法再變更為其他狀態。</span></li>
                            </ul>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold" disabled={isProcessingCancel}>暫不取消</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={confirmCancelOrder} 
                        className="rounded-xl bg-rose-600 text-white font-black hover:bg-rose-700 shadow-xl px-8"
                        disabled={isProcessingCancel}
                    >
                        {isProcessingCancel ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                        確認取消並執行退產
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
