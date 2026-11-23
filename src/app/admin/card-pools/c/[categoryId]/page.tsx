'use client';

import { useState, useCallback } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, Timestamp, deleteDoc, doc, updateDoc, query, orderBy, where } from '@/lib/audited-firestore';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Ticket, Package, Trash2, Edit, ArrowLeft, Sparkles, Flame, Layers, Check } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useParams } from 'next/navigation';
import { cn } from "@/lib/utils";
import { Badge } from '@/components/ui/badge';

type PoolModeType = 'standard' | 'blindbox' | 'kuji' | 'event' | 'hybrid_sp';

interface CardPool {
  id?: string;
  name: string;
  description: string;
  price?: number;
  price3Draws?: number;
  totalPacks?: number;
  remainingPacks?: number;
  categoryId?: string;
  order?: number;
  status?: 'draft' | 'published';
  allowFreeDraw?: boolean;
  isEventPool?: boolean;
  isBlindBoxMode?: boolean;
  enablePickNumber?: boolean;
  isHybridBlindSpMode?: boolean;
  exclusiveTicketOnly?: boolean;
  eventTicketName?: string;
}

function getPoolModeType(pool: CardPool): PoolModeType {
  if (pool.isHybridBlindSpMode) return 'hybrid_sp';
  if (pool.isBlindBoxMode) return 'blindbox';
  if (pool.enablePickNumber) return 'kuji';
  if (pool.isEventPool) return 'event';
  return 'standard';
}

const POOL_MODE_OPTIONS: Array<{
  id: PoolModeType;
  label: string;
  badge: string;
  desc: string;
  icon: any;
}> = [
  {
    id: 'standard',
    label: '一般抽卡池',
    badge: '透明機率',
    desc: '公開各賞別剩餘張數與機率，適合標準卡池。',
    icon: Layers,
  },
  {
    id: 'blindbox',
    label: 'Blez 盲盒模式',
    badge: '保密不公開',
    desc: '隱藏頭獎是否開出、剩餘張數與跑馬燈播報。',
    icon: Sparkles,
  },
  {
    id: 'kuji',
    label: '一番賞挑籤模式',
    badge: '自選號碼牆',
    desc: '玩家可從 1~N 號數字籤牆自選幸運號碼開獎。',
    icon: Flame,
  },
  {
    id: 'event',
    label: '活動專屬卡池',
    badge: '活動派券',
    desc: '指定活動專用，支援管理員審核派發專屬券。',
    icon: Ticket,
  },
  {
    id: 'hybrid_sp',
    label: 'GodPack 一番賞',
    badge: '68% 穩健版',
    desc: '結合透明看盤與五色卡包（金/黑/銀/銅/星光包），內建 68% 毛利即時估值與 SP 保底回收。',
    icon: Package,
  },
];

export default function CardPoolsAdminPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const categoryId = params.categoryId as string;

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newPoolName, setNewPoolName] = useState('新卡池');
  const [newPoolMode, setNewPoolMode] = useState<PoolModeType>('standard');
  const [modeFilter, setModeFilter] = useState<'all' | PoolModeType>('all');
  const [isCreating, setIsCreating] = useState(false);

  const cardPoolsCollection = useMemoFirebase(() => {
    if (!firestore || !categoryId) return null;
    return query(collection(firestore, 'cardPools'), where('categoryId', '==', decodeURIComponent(categoryId)));
  }, [firestore, categoryId]);

  const { data: cardPools, isLoading: isLoadingPools } = useCollection<CardPool>(cardPoolsCollection);

  const handleOpenCreateDialog = () => {
    setNewPoolName('新卡池');
    setNewPoolMode('standard');
    setIsCreateDialogOpen(true);
  };

  const handleAddNew = async () => {
    if (!firestore || !categoryId) {
        toast({ variant: "destructive", title: "錯誤", description: "缺少分類資訊。" });
        return;
    }
    setIsCreating(true);
    try {
      const trimmedName = newPoolName.trim() || '新卡池';
      const dataToSave = {
        name: trimmedName,
        description: '請填寫描述',
        price: 150,
        price3Draws: 400,
        totalPacks: 0,
        remainingPacks: 0,
        categoryId: decodeURIComponent(categoryId),
        order: (cardPools?.length ?? 0) + 1,
        cards: [],
        pointPrizes: [],
        cardRarities: {},
        expiresAt: Timestamp.fromDate(new Date(new Date().setDate(new Date().getDate() + 30))),
        imageUrl: `https://picsum.photos/seed/${Math.random()}/800/600`,
        status: 'draft',
        isBlindBoxMode: newPoolMode === 'blindbox',
        enablePickNumber: newPoolMode === 'kuji',
        isEventPool: newPoolMode === 'event',
        isHybridBlindSpMode: newPoolMode === 'hybrid_sp',
        ...(newPoolMode === 'hybrid_sp' ? {
          price: 2099,
          totalPacks: 100,
          remainingPacks: 0,
          presetUsed: 'high_margin_68',
          snipeAlertThreshold: 15,
        } : {}),
      };

      const docRef = await addDoc(collection(firestore, 'cardPools'), dataToSave);
      setIsCreateDialogOpen(false);
      toast({ title: "成功", description: `已建立「${trimmedName}」。` });
      router.push(`/admin/card-pools/p/${docRef.id}`);

    } catch (error) {
      console.error("Error creating card pool: ", error);
      toast({ variant: "destructive", title: "錯誤", description: "建立卡池時發生錯誤。" });
    } finally {
      setIsCreating(false);
    }
  };
  
  const handleDelete = async (poolId: string) => {
    if (!firestore) return;
    try {
      await deleteDoc(doc(firestore, 'cardPools', poolId));
      toast({ title: "成功", description: "卡池已刪除。" });
    } catch (error) {
      console.error("Error deleting card pool: ", error);
      toast({ variant: "destructive", title: "錯誤", description: "刪除卡池時發生錯誤。" });
    }
  };

  const handleStatusToggle = async (poolId: string, currentStatus: string = 'draft') => {
      if(!firestore) return;
      const newStatus = currentStatus === 'published' ? 'draft' : 'published';
      try {
          await updateDoc(doc(firestore, 'cardPools', poolId), { status: newStatus });
          toast({ title: "狀態已更新", description: `卡池已更新為 ${newStatus === 'published' ? '已上架' : '草稿'}`});
      } catch (error) {
          console.error("Error updating status:", error);
          toast({ variant: "destructive", title: "錯誤", description: "更新狀態時發生錯誤" });
      }
  }

  const handleFreeDrawToggle = async (poolId: string, currentVal: boolean = false) => {
      if (!firestore) return;
      try {
          await updateDoc(doc(firestore, 'cardPools', poolId), { allowFreeDraw: !currentVal });
          toast({ title: "免費券設定已更新", description: `卡池已${!currentVal ? '開放' : '關閉'}免費抽卡券` });
      } catch (error) {
          console.error("Error updating free draw status:", error);
          toast({ variant: "destructive", title: "錯誤", description: "更新失敗" });
      }
  };

  const handleOrderChange = useCallback(async (poolId: string, newOrder: number) => {
    if (!firestore) return;
     if (isNaN(newOrder)) {
        toast({ variant: 'destructive', title: '錯誤', description: '請輸入有效的數字。' });
        return;
    }
    try {
        await updateDoc(doc(firestore, 'cardPools', poolId), { order: newOrder });
        toast({ title: '成功', description: '順序已更新。' });
    } catch (error) {
        console.error('Error updating pool order:', error);
        toast({ variant: 'destructive', title: '錯誤', description: '更新順序失敗。' });
    }
  }, [firestore, toast]);
  
  const isLoading = isLoadingPools;

  return (
    <div className="container mx-auto p-6 md:p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
            <Button variant="ghost" onClick={() => router.push('/admin/card-pools')} className="mb-2 -ml-4">
                <ArrowLeft className="mr-2" />
                返回分類列表
            </Button>
            <h1 className="font-headline text-3xl font-bold tracking-tight text-primary">卡池管理: {decodeURIComponent(categoryId)}</h1>
            <p className="mt-2 text-muted-foreground">管理此分類下的所有卡池數據。預覽圖片已移除以優化載入速度。</p>
        </div>
        <Button onClick={handleOpenCreateDialog}><PlusCircle className="mr-2" /> 新增卡池</Button>
      </div>

      {/* 依功能池模式快速分類篩選 */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => setModeFilter('all')}
          className={cn(
            'px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all cursor-pointer',
            modeFilter === 'all'
              ? 'bg-slate-900 text-[#FDE68A] border-slate-900 shadow-sm'
              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
          )}
        >
          全部模式 ({cardPools?.length || 0})
        </button>
        {POOL_MODE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const count = (cardPools || []).filter((p) => getPoolModeType(p) === opt.id).length;
          const active = modeFilter === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => setModeFilter(opt.id)}
              className={cn(
                'px-3.5 py-1.5 rounded-full text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer',
                active
                  ? 'bg-slate-900 text-[#FDE68A] border-slate-900 shadow-sm'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{opt.label}</span>
              <span className={cn('font-mono text-[11px] tabular-nums', active ? 'text-amber-300' : 'text-slate-400')}>
                ({count})
              </span>
            </button>
          );
        })}
      </div>

      <div className="bg-card border border-white/5 rounded-lg overflow-hidden">
        <Table>
          <TableHeader className="bg-muted/50">
            <TableRow>
              <TableHead className="pl-6">卡池名稱</TableHead>
              <TableHead>功能池模式</TableHead>
              <TableHead>價格 (1抽/三抽)</TableHead>
              <TableHead>存量狀態</TableHead>
              <TableHead>免費抽卡券</TableHead>
              <TableHead>上架狀態</TableHead>
              <TableHead className="w-24">排序權重</TableHead>
              <TableHead className="text-right pr-6 w-32">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({length: 5}).map((_, i) => (
              <TableRow key={i}>
                <TableCell className="pl-6"><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                <TableCell><Skeleton className="h-8 w-16" /></TableCell>
                <TableCell className="text-right pr-6"><Skeleton className="h-8 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
            {cardPools
              ?.filter((pool) => modeFilter === 'all' || getPoolModeType(pool) === modeFilter)
              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
              .map((pool) => {
                const poolMode = getPoolModeType(pool);
                const modeOption = POOL_MODE_OPTIONS.find((m) => m.id === poolMode) || POOL_MODE_OPTIONS[0];
                const ModeIcon = modeOption.icon;
                return (
              <TableRow key={pool.id} className="hover:bg-white/5 transition-colors group">
                <TableCell className="pl-6">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button 
                            onClick={() => router.push(`/admin/card-pools/p/${pool.id}`)}
                            className="font-bold text-lg hover:text-primary transition-colors text-left"
                        >
                            {pool.name}
                        </button>
                        {pool.exclusiveTicketOnly && (
                            <Badge className="bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] px-1.5 py-0">
                                🔒 僅派券
                            </Badge>
                        )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate max-w-[300px] mt-0.5">{pool.description}</p>
                </TableCell>
                <TableCell>
                  <Badge
                    className={cn(
                      'text-[11px] font-bold px-2.5 py-1 border inline-flex items-center gap-1.5 whitespace-nowrap',
                      poolMode === 'hybrid_sp'
                        ? 'bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border-amber-300/60'
                        : poolMode === 'blindbox'
                          ? 'bg-slate-900 text-[#FDE68A] border-amber-300/50'
                          : poolMode === 'kuji'
                            ? 'bg-amber-500/20 text-amber-700 border-amber-500/40'
                            : poolMode === 'event'
                              ? 'bg-purple-500/20 text-purple-700 border-purple-500/40'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                    )}
                  >
                    <ModeIcon className="w-3 h-3" />
                    <span>{modeOption.label}</span>
                  </Badge>
                </TableCell>
                <TableCell>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center text-sm font-bold">
                            <Ticket className="mr-1.5 h-3.5 w-3.5 text-primary" />
                            {pool.price}
                        </div>
                        {pool.price3Draws && (
                            <div className="text-[10px] text-muted-foreground flex items-center">
                                <Package className="mr-1 h-2.5 w-2.5" />
                                3抽: {pool.price3Draws}
                            </div>
                        )}
                    </div>
                </TableCell>
                <TableCell>
                    <Badge variant={pool.remainingPacks === 0 ? "destructive" : "secondary"} className={cn("font-code text-xs px-2", pool.remainingPacks! > 0 && "bg-green-500/10 text-green-500 border-green-500/20")}>
                        {typeof pool.remainingPacks === 'number' ? pool.remainingPacks : 0} / {typeof pool.totalPacks === 'number' ? pool.totalPacks : 0} PACKS
                    </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                        <Switch 
                            id={`freedraw-switch-${pool.id}`}
                            checked={pool.allowFreeDraw === true}
                            onCheckedChange={() => handleFreeDrawToggle(pool.id!, pool.allowFreeDraw)}
                        />
                        <Label htmlFor={`freedraw-switch-${pool.id}`} className={cn("text-[10px] font-bold", pool.allowFreeDraw ? 'text-emerald-400' : 'text-muted-foreground')}>
                            {pool.allowFreeDraw ? '已開放' : '未開放'}
                        </Label>
                    </div>
                </TableCell>
                <TableCell>
                  <div className="flex items-center space-x-2">
                        <Switch 
                            id={`status-switch-${pool.id}`}
                            checked={pool.status === 'published'}
                            onCheckedChange={() => handleStatusToggle(pool.id!, pool.status)}
                        />
                        <Label htmlFor={`status-switch-${pool.id}`} className={cn("text-[10px]", pool.status === 'published' ? 'text-green-500' : 'text-muted-foreground')}>
                            {pool.status === 'published' ? '已上架' : '草稿'}
                        </Label>
                    </div>
                </TableCell>
                <TableCell>
                    <Input
                        id={`order-${pool.id}`}
                        type="number"
                        defaultValue={pool.order}
                        className="h-8 w-16 text-center font-code bg-background/50"
                        onBlur={(e) => handleOrderChange(pool.id!, parseInt(e.target.value))}
                    />
                </TableCell>
                <TableCell className="text-right pr-6">
                    <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="hover:bg-primary/10" onClick={() => router.push(`/admin/card-pools/p/${pool.id}`)}>
                            <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                               <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive">
                                <Trash2 className="h-4 w-4" />
                               </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>確定要刪除「{pool.name}」嗎？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  此操作將永久刪除整個卡池及其所有設定，此動作無法復原。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(pool.id!)} className="bg-destructive hover:bg-destructive/90">確認刪除</AlertDialogAction>
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
         {!isLoading && cardPools?.length === 0 && (
            <div className="text-center p-20 text-muted-foreground border border-dashed border-white/5 m-6 rounded-lg bg-white/5">
                目前此分類下沒有卡池。
            </div>
        )}
      </div>

      {/* 新增卡池（含功能池模式選擇）彈窗 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-white border-slate-200 text-slate-900 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-black text-slate-900">
              新增卡池 — 選擇功能池模式
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              建立卡池時即鎖定功能模式，避免進入後台編輯後再切換造成庫存或籤表錯亂。
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="new-pool-name" className="text-xs font-bold text-slate-700">
                卡池名稱
              </Label>
              <Input
                id="new-pool-name"
                value={newPoolName}
                onChange={(e) => setNewPoolName(e.target.value)}
                placeholder="請輸入卡池名稱..."
                className="h-10 rounded-xl border-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">選擇功能池類型</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {POOL_MODE_OPTIONS.map((opt) => {
                  const Icon = opt.icon;
                  const isSelected = newPoolMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setNewPoolMode(opt.id)}
                      className={cn(
                        'relative flex flex-col items-start text-left p-3.5 rounded-xl border-2 transition-all cursor-pointer',
                        isSelected
                          ? 'border-slate-900 bg-slate-900 text-white shadow-md'
                          : 'border-slate-200 bg-slate-50/70 hover:border-slate-300 hover:bg-white text-slate-800'
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Icon className={cn('w-4 h-4', isSelected ? 'text-amber-300' : 'text-slate-600')} />
                          <span className="text-xs font-black">{opt.label}</span>
                        </div>
                        {isSelected ? (
                          <Check className="w-4 h-4 text-amber-300 shrink-0" />
                        ) : (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200/80 text-slate-600">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      <p className={cn('text-[11px] leading-snug', isSelected ? 'text-slate-300' : 'text-slate-500')}>
                        {opt.desc}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="rounded-xl">
              取消
            </Button>
            <Button
              onClick={handleAddNew}
              disabled={isCreating}
              className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold"
            >
              {isCreating ? '建立中...' : '確認建立並進入配置'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
