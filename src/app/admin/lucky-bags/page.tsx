'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, deleteDoc, doc, updateDoc, getCountFromServer } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Gem, Users, Trash2, Edit, Search, ShoppingBag, CheckCircle2, Layers, RotateCcw } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';

type LuckBagStatus = 'draft' | 'published';

interface LuckBag {
  id?: string;
  name: string;
  price: number;
  currency?: 'diamond' | 'pplus';
  totalParticipants: number;
  revealLottery?: boolean;
  imageUrl?: string;
  status?: LuckBagStatus;
  order?: number;
  prizes?: {
    first?: string;
    second?: string;
    third?: string;
  };
}

interface LuckBagWithData extends LuckBag {
    participantCount: number;
}

const defaultLuckBag: Omit<LuckBag, 'id'> = {
    name: '',
    price: 100,
    totalParticipants: 100,
    revealLottery: false,
    status: 'draft',
    order: 0,
};

export default function LuckyBagsAdminPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBag, setNewBag] = useState(defaultLuckBag);
  const [luckyBagsWithData, setLuckyBagsWithData] = useState<LuckBagWithData[]>([]);
  const [isListLoading, setIsListLoading] = useState(true);

  // 篩選與搜尋狀態
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'sold' | 'draft'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const luckBagsCollection = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'luckBags'));
  }, [firestore]);

  const { data: luckyBags, isLoading: isLoadingBags } = useCollection<LuckBag>(luckBagsCollection);

  useEffect(() => {
    const fetchExtraData = async () => {
        if (!luckyBags || !firestore) return;

        setIsListLoading(true);
        const sortedLuckyBags = [...luckyBags].sort((a,b) => (a.order ?? 0) - (b.order ?? 0));

        const bagsWithData = await Promise.all(
            sortedLuckyBags.map(async (bag) => {
                if (!bag.id) return { ...bag, participantCount: 0 };
                const purchasesColRef = collection(firestore, 'luckBags', bag.id, 'luckBagPurchases');
                const countSnapshot = await getCountFromServer(query(purchasesColRef));
                const participantCount = countSnapshot.data().count;

                return {
                    ...bag,
                    participantCount,
                };
            })
        );
        setLuckyBagsWithData(bagsWithData);
        setIsListLoading(false);
    };

    if (!isLoadingBags) {
        fetchExtraData();
    }
  }, [luckyBags, firestore, isLoadingBags]);

  // 統計指標
  const stats = useMemo(() => {
    const total = luckyBagsWithData.length;
    let availableCount = 0;
    let soldCount = 0;
    let draftCount = 0;

    luckyBagsWithData.forEach(bag => {
      const isFull = bag.participantCount >= (bag.totalParticipants || 1);
      if (bag.status === 'draft') {
        draftCount++;
      } else if (isFull) {
        soldCount++;
      } else {
        availableCount++;
      }
    });

    return { total, availableCount, soldCount, draftCount };
  }, [luckyBagsWithData]);

  // 篩選後的福袋列表
  const filteredBags = useMemo(() => {
    let result = [...luckyBagsWithData];

    if (statusFilter === 'available') {
      result = result.filter(b => b.status === 'published' && b.participantCount < (b.totalParticipants || 1));
    } else if (statusFilter === 'sold') {
      result = result.filter(b => b.participantCount >= (b.totalParticipants || 1));
    } else if (statusFilter === 'draft') {
      result = result.filter(b => b.status === 'draft');
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(b => b.name.toLowerCase().includes(q));
    }

    return result;
  }, [luckyBagsWithData, statusFilter, searchTerm]);

  const handleAddNew = () => {
    setNewBag({...defaultLuckBag, order: (luckyBags?.length ?? 0) + 1});
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !newBag.name || !newBag.totalParticipants || !newBag.price) {
        toast({ variant: "destructive", title: "錯誤", description: "所有欄位皆為必填項。" });
        return;
    }

    try {
      const dataToSave = {
        ...newBag,
        prizes: {
            first: '',
            second: '',
            third: '',
        },
        imageUrl: '',
        imageHint: 'custom upload',
      };

      const docRef = await addDoc(collection(firestore, 'luckBags'), dataToSave);
      toast({ title: "成功", description: "新福袋已新增。請點擊進入詳情頁以設定獎品。" });
      
      setIsDialogOpen(false);
      router.push(`/admin/lucky-bags/${docRef.id}`);

    } catch (error) {
      console.error("Error creating luck bag: ", error);
      toast({ variant: "destructive", title: "錯誤", description: "建立福袋時發生錯誤。" });
    }
  };

  const handleDeleteBag = async (bagId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'luckBags', bagId));
      toast({ title: "成功", description: "福袋已刪除。" });
    } catch (error) {
        console.error("Error deleting luck bag: ", error);
        toast({ variant: "destructive", title: "錯誤", description: "刪除福袋時發生錯誤。" });
    }
  };
  
  const handleStatusToggle = async (bagId: string, currentStatus: string = 'draft') => {
      if(!firestore) return;
      const newStatus = currentStatus === 'published' ? 'draft' : 'published';
      try {
          await updateDoc(doc(firestore, 'luckBags', bagId), { status: newStatus });
          toast({ title: "狀態已更新", description: `福袋已更新為 ${newStatus === 'published' ? '已發佈' : '草稿'}`});
      } catch (error) {
          console.error("Error updating status:", error);
          toast({ variant: "destructive", title: "錯誤", description: "更新狀態時發生錯誤" });
      }
  };

  const handleOrderChange = useCallback(async (bagId: string, newOrder: number) => {
    if (!firestore || !bagId) return;
    if (isNaN(newOrder)) {
        toast({ variant: 'destructive', title: '錯誤', description: '請輸入有效的數字。' });
        return;
    }
    try {
        const bagRef = doc(firestore, 'luckBags', bagId);
        await updateDoc(bagRef, { order: newOrder });
        toast({ title: '成功', description: '順序已更新。' });
    } catch (error) {
        console.error("Error updating bag order:", error);
        toast({ variant: 'destructive', title: '錯誤', description: '更新順序失敗。' });
    }
  }, [firestore, toast]);

  const finalIsLoading = isLoadingBags || isListLoading;
  const isFilterActive = statusFilter !== 'all' || searchTerm.trim() !== '';

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-primary">福袋管理</h1>
            <p className="mt-1 text-muted-foreground text-sm">建立並管理集滿即開的福袋活動、檢視名額售罄狀態與設定獎項。</p>
        </div>
        <Button onClick={handleAddNew} className="bg-slate-900 text-white hover:bg-slate-800 shadow-md">
          <PlusCircle className="mr-2 h-4 w-4" /> 新增福袋
        </Button>
      </div>

      {/* 頂部數據看板 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div 
          onClick={() => setStatusFilter('all')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center justify-between",
            statusFilter === 'all'
              ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20"
              : "bg-white border-slate-200/80 hover:border-slate-400"
          )}
        >
          <div>
            <p className={cn("text-[11px] font-black uppercase tracking-wider", statusFilter === 'all' ? "text-slate-300" : "text-slate-400")}>
              總福袋專案
            </p>
            <p className={cn("text-2xl font-black font-code mt-0.5", statusFilter === 'all' ? "text-white" : "text-slate-900")}>
              {stats.total}
            </p>
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold", statusFilter === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700")}>
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('available')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center justify-between",
            statusFilter === 'available'
              ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20"
              : "bg-white border-slate-200/80 hover:border-emerald-300"
          )}
        >
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-600">銷售中 (未售完)</p>
            <p className="text-2xl font-black font-code text-emerald-600 mt-0.5">{stats.availableCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
            <ShoppingBag className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('sold')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center justify-between",
            statusFilter === 'sold'
              ? "bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/20"
              : "bg-white border-slate-200/80 hover:border-amber-300"
          )}
        >
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-600">已售罄 / 已滿袋</p>
            <p className="text-2xl font-black font-code text-amber-600 mt-0.5">{stats.soldCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('draft')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center justify-between",
            statusFilter === 'draft'
              ? "bg-slate-700 text-white border-slate-700 ring-2 ring-slate-700/20"
              : "bg-white border-slate-200/80 hover:border-slate-400"
          )}
        >
          <div>
            <p className={cn("text-[11px] font-black uppercase tracking-wider", statusFilter === 'draft' ? "text-slate-300" : "text-slate-400")}>
              草稿 (未上架)
            </p>
            <p className={cn("text-2xl font-black font-code mt-0.5", statusFilter === 'draft' ? "text-white" : "text-slate-900")}>
              {stats.draftCount}
            </p>
          </div>
          <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold", statusFilter === 'draft' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700")}>
            <Edit className="w-5 h-5" />
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>新增福袋</DialogTitle>
            <DialogDescription>
              填寫新福袋的基本資訊。獎品細節可在詳情頁中設定。
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">福袋名稱</Label>
              <Input id="name" value={newBag.name} onChange={e => setNewBag({...newBag, name: e.target.value})} />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="price">價格 (每格)</Label>
                    <Input id="price" type="number" value={newBag.price} onChange={e => setNewBag({...newBag, price: Number(e.target.value)})} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="totalParticipants">總參與人數</Label>
                    <Input id="totalParticipants" type="number" value={newBag.totalParticipants} onChange={e => setNewBag({...newBag, totalParticipants: Number(e.target.value)})} />
                </div>
            </div>
             <div className="space-y-2">
                <Label htmlFor="order">排序權重</Label>
                <Input id="order" type="number" value={newBag.order} onChange={e => setNewBag({...newBag, order: Number(e.target.value)})} />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleSave}>儲存並前往設定</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 福袋列表與篩選卡片 */}
      <Card className="border-slate-200 bg-white rounded-2xl overflow-hidden shadow-sm">
        {/* 工具列 */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                statusFilter === 'all' ? "bg-slate-900 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              全部 ({stats.total})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('available')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                statusFilter === 'available' ? "bg-emerald-600 text-white shadow-xs" : "text-slate-600 hover:text-emerald-700"
              )}
            >
              <span className={cn("w-1.5 h-1.5 rounded-full", statusFilter === 'available' ? "bg-white" : "bg-emerald-500")} />
              未售完 ({stats.availableCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('sold')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                statusFilter === 'sold' ? "bg-amber-600 text-white shadow-xs" : "text-slate-600 hover:text-amber-700"
              )}
            >
              已售罄 ({stats.soldCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('draft')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                statusFilter === 'draft' ? "bg-slate-700 text-white shadow-xs" : "text-slate-500 hover:text-slate-700"
              )}
            >
              草稿 ({stats.draftCount})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input 
                placeholder="搜尋福袋名稱..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs bg-white border-slate-200 rounded-xl"
              />
            </div>
            {isFilterActive && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setStatusFilter('all'); setSearchTerm(''); }}
                className="h-9 w-9 text-rose-500 hover:bg-rose-50 rounded-xl shrink-0"
                title="重設篩選"
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        <Table>
          <TableHeader className="bg-slate-50">
            <TableRow>
              <TableHead className="pl-6 text-[10px] font-black uppercase">福袋名稱</TableHead>
              <TableHead className="text-[10px] font-black uppercase">價格</TableHead>
              <TableHead className="text-[10px] font-black uppercase">參與進度</TableHead>
              <TableHead className="text-[10px] font-black uppercase">售罄狀態</TableHead>
              <TableHead className="text-[10px] font-black uppercase">上架狀態</TableHead>
              <TableHead className="w-24 text-[10px] font-black uppercase">排序</TableHead>
              <TableHead className="text-right pr-6 text-[10px] font-black uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {finalIsLoading && Array.from({length: 4}).map((_, i) => (
                <TableRow key={i}>
                    <TableCell className="pl-6"><Skeleton className="h-5 w-48" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                    <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                    <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                    <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                    <TableCell className="text-right pr-6"><Skeleton className="h-8 w-16 ml-auto" /></TableCell>
                </TableRow>
            ))}
            {filteredBags.map((bag) => {
                const total = bag.totalParticipants || 1;
                const count = bag.participantCount || 0;
                const isFull = count >= total;
                const percent = Math.min(100, Math.round((count / total) * 100));
                return (
                <TableRow key={bag.id} className="hover:bg-slate-50/80 transition-colors border-b">
                    <TableCell className="pl-6">
                        <button 
                            onClick={() => router.push(`/admin/lucky-bags/${bag.id}`)}
                            className="font-bold text-base hover:text-primary transition-colors text-left text-slate-900"
                        >
                            {bag.name}
                        </button>
                    </TableCell>
                    <TableCell className="font-code font-bold text-accent">
                        <div className="flex items-center gap-1">
                            {(bag.price || 0).toLocaleString()}
                            {bag.currency === 'diamond' ? <Gem className="w-4 h-4 text-primary" /> : <PPlusIcon className="w-4 h-4" />}
                        </div>
                    </TableCell>
                    <TableCell>
                        <div className="space-y-1 w-32">
                          <div className="flex items-center justify-between text-[11px] font-bold">
                            <span className="font-code text-slate-600">{count} / {total}</span>
                            <span className="font-code text-slate-400">{percent}%</span>
                          </div>
                          <Progress value={percent} className="h-1.5" />
                        </div>
                    </TableCell>
                    <TableCell>
                        {bag.revealLottery ? (
                          <Badge className="bg-purple-600 text-white font-bold text-[10px]">開獎中</Badge>
                        ) : isFull ? (
                          <Badge className="bg-amber-600 text-white font-bold text-[10px]">已售罄 / 已滿袋</Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-300 font-bold text-[10px]">未售完 (尚餘 {total - count})</Badge>
                        )}
                    </TableCell>
                    <TableCell>
                        <div className="flex items-center space-x-2">
                            <Switch 
                                id={`status-switch-${bag.id}`}
                                checked={bag.status === 'published'}
                                onCheckedChange={() => handleStatusToggle(bag.id!, bag.status)}
                            />
                            <Label htmlFor={`status-switch-${bag.id}`} className={cn("text-xs font-bold", bag.status === 'published' ? 'text-green-600' : 'text-slate-400')}>
                                {bag.status === 'published' ? '上架中' : '草稿'}
                            </Label>
                        </div>
                    </TableCell>
                    <TableCell>
                         <Input
                            type="number"
                            defaultValue={bag.order}
                            className="h-8 w-16 text-center font-code text-xs bg-white border-slate-200 rounded-lg"
                            onBlur={(e) => handleOrderChange(bag.id!, parseInt(e.target.value))}
                        />
                    </TableCell>
                    <TableCell className="text-right pr-6">
                        <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/lucky-bags/${bag.id}`)} className="h-8 w-8 hover:bg-slate-100">
                                <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive hover:bg-rose-50">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-3xl bg-white text-slate-900 border shadow-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="font-bold">確定要刪除「{bag.name}」嗎？</AlertDialogTitle>
                                        <AlertDialogDescription className="text-slate-500 font-medium">
                                            此操作將永久刪除此福袋活動及其所有關聯數據，無法復原。
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="gap-2">
                                        <AlertDialogCancel className="font-bold rounded-xl">取消</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteBag(bag.id!)} className="bg-destructive hover:bg-destructive/90 text-white font-bold rounded-xl">確認刪除</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        </div>
                    </TableCell>
                </TableRow>
                );
            })}
          </TableBody>
        </Table>
        {!finalIsLoading && filteredBags.length === 0 && (
          <div className="text-center py-16 text-muted-foreground space-y-2">
            <p className="font-bold text-sm text-slate-600">無符合條件的福袋專案</p>
            {isFilterActive && (
              <Button size="sm" variant="outline" onClick={() => { setStatusFilter('all'); setSearchTerm(''); }} className="text-xs rounded-xl font-bold">
                重設篩選
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
