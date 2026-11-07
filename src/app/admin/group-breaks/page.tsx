'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { 
  PlusCircle, Edit, Trash2, Search, Filter, RotateCcw, 
  Users2, Radio, CheckCircle2, ShoppingBag, Layers, Flame, Dices 
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

import { v4 as uuidv4 } from 'uuid';
import { MLB_TEAMS_DETAILED, NBA_TEAMS_DETAILED } from '@/lib/draw-constants';

type BreakType = 'spot' | 'team';

interface GroupBreak {
  id: string;
  title: string;
  pricePerSpot?: number;
  totalSpots?: number;
  teams?: { userId?: string }[];
  spots?: { userId?: string }[];
  breakType: BreakType;
  status: 'draft' | 'published' | 'in_progress' | 'completed';
  createdAt: { seconds: number };
  isAdult?: boolean;
}

const defaultBreak: Omit<GroupBreak, 'id' | 'createdAt'> = {
  title: '',
  pricePerSpot: 100,
  totalSpots: 30,
  status: 'draft',
  breakType: 'spot',
};

export default function GroupBreaksAdminPage() {
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newBreak, setNewBreak] = useState(defaultBreak);
  const [teamPreset, setTeamPreset] = useState<'none' | 'nba' | 'mlb'>('none');
  const [defaultTeamPrice, setDefaultTeamPrice] = useState<number>(100);

  // 篩選與搜尋狀態
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'sold' | 'in_progress' | 'completed' | 'draft'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'team' | 'spot'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const groupBreaksQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'groupBreaks'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: groupBreaks, isLoading } = useCollection<GroupBreak>(groupBreaksQuery);

  // 整理每個活動的售出資訊
  const processedBreaks = useMemo(() => {
    if (!groupBreaks) return [];
    return groupBreaks.map(b => {
      const participantCount = b.breakType === 'team'
        ? (b.teams?.filter(t => t.userId).length || 0)
        : (b.spots?.filter(s => s.userId).length || 0);

      const totalSpots = b.breakType === 'team'
        ? (b.teams?.length || 0)
        : (b.totalSpots || 0);

      const isFull = totalSpots > 0 && participantCount >= totalSpots;
      const progressPercent = totalSpots > 0 ? Math.min(100, Math.round((participantCount / totalSpots) * 100)) : 0;

      // 售出狀態判定
      // sold: 已滿團 (名額全數售出)
      // available: 募集中且未滿團 (尚有名額未售出)
      const isSoldOut = isFull;
      const isAvailable = !isFull && (b.status === 'published' || b.status === 'in_progress');

      return {
        ...b,
        participantCount,
        totalSpots,
        isFull,
        progressPercent,
        isSoldOut,
        isAvailable,
      };
    });
  }, [groupBreaks]);

  // 統計指標
  const stats = useMemo(() => {
    const total = processedBreaks.length;
    let availableCount = 0;
    let soldCount = 0;
    let inProgressCount = 0;
    let completedCount = 0;

    processedBreaks.forEach(b => {
      if (b.isAvailable) availableCount++;
      if (b.isSoldOut && b.status !== 'completed') soldCount++;
      if (b.status === 'in_progress') inProgressCount++;
      if (b.status === 'completed') completedCount++;
    });

    return { total, availableCount, soldCount, inProgressCount, completedCount };
  }, [processedBreaks]);

  // 經過篩選後展示的列表
  const filteredBreaks = useMemo(() => {
    let result = [...processedBreaks];

    // 狀態與售出分類篩選
    if (statusFilter === 'available') {
      result = result.filter(b => b.isAvailable);
    } else if (statusFilter === 'sold') {
      result = result.filter(b => b.isSoldOut);
    } else if (statusFilter === 'in_progress') {
      result = result.filter(b => b.status === 'in_progress');
    } else if (statusFilter === 'completed') {
      result = result.filter(b => b.status === 'completed');
    } else if (statusFilter === 'draft') {
      result = result.filter(b => b.status === 'draft');
    }

    // 模式篩選
    if (typeFilter !== 'all') {
      result = result.filter(b => b.breakType === typeFilter);
    }

    // 關鍵字搜尋
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(b => 
        b.title.toLowerCase().includes(q) || 
        b.id.toLowerCase().includes(q)
      );
    }

    return result;
  }, [processedBreaks, statusFilter, typeFilter, searchTerm]);

  const handleAddNew = () => {
    setNewBreak(defaultBreak);
    setTeamPreset('none');
    setDefaultTeamPrice(100);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!firestore || !newBreak.title) {
      toast({ variant: 'destructive', title: '錯誤', description: '標題為必填項。' });
      return;
    }

    try {
      const dataToSave: any = {
        title: newBreak.title,
        isAdult: !!newBreak.isAdult,
        status: newBreak.status,
        breakType: newBreak.breakType,
        createdAt: new Date(),
        imageUrl: `https://picsum.photos/seed/${Math.random()}/1280/720`,
      };
      
      if (newBreak.breakType === 'spot') {
        dataToSave.pricePerSpot = newBreak.pricePerSpot;
        dataToSave.totalSpots = newBreak.totalSpots;
        dataToSave.spots = Array.from({ length: newBreak.totalSpots || 0 }, (_, i) => ({ spotNumber: i + 1 }));
      } else {
        if (teamPreset === 'nba') {
          dataToSave.teams = NBA_TEAMS_DETAILED.map(team => ({ 
            teamId: uuidv4(), 
            name: team.name, 
            logoUrl: team.logoUrl,
            price: defaultTeamPrice || 100 
          }));
        } else if (teamPreset === 'mlb') {
          dataToSave.teams = MLB_TEAMS_DETAILED.map(team => ({ 
            teamId: uuidv4(), 
            name: team.name, 
            logoUrl: team.logoUrl,
            price: defaultTeamPrice || 100 
          }));
        } else {
          dataToSave.teams = [];
        }
      }

      const docRef = await addDoc(collection(firestore, 'groupBreaks'), dataToSave);
      toast({ title: '成功', description: '新團拆活動已建立。' });
      setIsDialogOpen(false);
      router.push(`/admin/group-breaks/${docRef.id}`);
    } catch (error) {
      console.error('Error creating group break:', error);
      toast({ variant: 'destructive', title: '錯誤', description: '建立活動失敗。' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
        await deleteDoc(doc(firestore, 'groupBreaks', id));
        toast({ title: '成功', description: '團拆活動已刪除。'});
    } catch (e) {
        console.error('Error deleting group break:', e);
        toast({ variant: 'destructive', title: '刪除失敗' });
    }
  };

  const handleStatusChange = async (id: string, newStatus: 'draft' | 'published' | 'in_progress' | 'completed') => {
    if (!firestore) return;
    try {
        await updateDoc(doc(firestore, 'groupBreaks', id), { status: newStatus });
        const statusMap = {
          draft: '草稿 (隱藏)',
          published: '開團中 (前台募集中)',
          in_progress: '直播拆卡中',
          completed: '派發完成'
        };
        toast({ title: '成功', description: `狀態已更新為：${statusMap[newStatus] || newStatus}`});
    } catch (e) {
        console.error('Error updating status:', e);
        toast({ variant: 'destructive', title: '錯誤', description: '更新狀態失敗。'});
    }
  };

  const isFilterActive = statusFilter !== 'all' || typeFilter !== 'all' || searchTerm.trim() !== '';

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-headline text-3xl font-bold tracking-tight">團拆 / 拼卡管理</h1>
          <p className="mt-1 text-muted-foreground text-sm">建立並管理直播團拆專案、檢視名額售出狀況與開獎配對。</p>
        </div>
        <Button onClick={handleAddNew} className="bg-slate-900 text-white hover:bg-slate-800 shadow-md">
          <PlusCircle className="mr-2 h-4 w-4" /> 新增團拆活動
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
              總活動數
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
            <p className="text-[11px] font-black uppercase tracking-wider text-emerald-600">未售出 / 募集中</p>
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
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-600">已售出 / 已滿團</p>
            <p className="text-2xl font-black font-code text-amber-600 mt-0.5">{stats.soldCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div 
          onClick={() => setStatusFilter('completed')}
          className={cn(
            "p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center justify-between",
            statusFilter === 'completed'
              ? "bg-purple-500/10 border-purple-500 ring-2 ring-purple-500/20"
              : "bg-white border-slate-200/80 hover:border-purple-300"
          )}
        >
          <div>
            <p className="text-[11px] font-black uppercase tracking-wider text-purple-600">派發完成 / 已結束</p>
            <p className="text-2xl font-black font-code text-purple-600 mt-0.5">{stats.completedCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
            <Dices className="w-5 h-5" />
          </div>
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>新增團拆活動</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">標題</Label>
              <Input id="title" value={newBreak.title} onChange={e => setNewBreak({ ...newBreak, title: e.target.value })} />
            </div>
             <div className="space-y-2">
                <Label>團拆模式</Label>
                <RadioGroup defaultValue="spot" value={newBreak.breakType} onValueChange={(value: BreakType) => setNewBreak({...newBreak, breakType: value})}>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="spot" id="r1" />
                        <Label htmlFor="r1">號碼模式</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="team" id="r2" />
                        <Label htmlFor="r2">隊伍模式</Label>
                    </div>
                </RadioGroup>
             </div>
             <div className="flex items-center space-x-2 pt-2">
                <Switch
                    id="isAdult"
                    checked={newBreak.isAdult || false}
                    onCheckedChange={(checked) => setNewBreak({...newBreak, isAdult: checked})}
                />
                <Label htmlFor="isAdult">限制級內容 (18+)</Label>
            </div>
            {newBreak.breakType === 'spot' && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price">每位置價格</Label>
                    <Input id="price" type="number" value={newBreak.pricePerSpot} onChange={e => setNewBreak({ ...newBreak, pricePerSpot: Number(e.target.value) })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spots">總位置</Label>
                    <Input id="spots" type="number" value={newBreak.totalSpots} onChange={e => setNewBreak({ ...newBreak, totalSpots: Number(e.target.value) })} />
                  </div>
                </div>
            )}
             {newBreak.breakType === 'team' && (
                <div className="space-y-3 p-4 bg-muted/40 rounded-lg border">
                  <Label className="font-bold text-sm flex items-center gap-2">
                    ⚡ 一鍵帶入聯盟隊伍
                  </Label>
                  <RadioGroup value={teamPreset} onValueChange={(v: any) => setTeamPreset(v)} className="space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="none" id="preset-none" />
                      <Label htmlFor="preset-none" className="cursor-pointer">無 (建立後再手動新增)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="nba" id="preset-nba" />
                      <Label htmlFor="preset-nba" className="cursor-pointer font-bold text-emerald-600 dark:text-emerald-400">🏀 NBA (一鍵帶入 30 支隊伍)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="mlb" id="preset-mlb" />
                      <Label htmlFor="preset-mlb" className="cursor-pointer font-bold text-blue-600 dark:text-blue-400">⚾ MLB (一鍵帶入 30 支隊伍)</Label>
                    </div>
                  </RadioGroup>
                  {teamPreset !== 'none' && (
                    <div className="space-y-1.5 pt-2 border-t border-muted-foreground/20">
                      <Label htmlFor="presetPrice" className="text-xs font-semibold">預設單隊價格</Label>
                      <Input
                        id="presetPrice"
                        type="number"
                        value={defaultTeamPrice}
                        onChange={e => setDefaultTeamPrice(Number(e.target.value))}
                        placeholder="100"
                      />
                    </div>
                  )}
                </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave}>建立活動</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 篩選與列表卡片 */}
      <Card className="border-slate-200 bg-white overflow-hidden shadow-sm">
        {/* 篩選工具列 */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* 售出狀態分頁按鈕 */}
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
              未售出 / 募集中 ({stats.availableCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('sold')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                statusFilter === 'sold' ? "bg-amber-600 text-white shadow-xs" : "text-slate-600 hover:text-amber-700"
              )}
            >
              已售出 / 已滿團 ({stats.soldCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('in_progress')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                statusFilter === 'in_progress' ? "bg-rose-600 text-white shadow-xs" : "text-slate-600 hover:text-rose-700"
              )}
            >
              直播中 ({stats.inProgressCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('completed')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                statusFilter === 'completed' ? "bg-purple-600 text-white shadow-xs" : "text-slate-600 hover:text-purple-700"
              )}
            >
              已結束 ({stats.completedCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('draft')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                statusFilter === 'draft' ? "bg-slate-700 text-white shadow-xs" : "text-slate-500 hover:text-slate-700"
              )}
            >
              草稿
            </button>
          </div>

          {/* 模式篩選與搜尋 */}
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
              <SelectTrigger className="w-32 h-9 text-xs bg-white border-slate-200 rounded-xl font-bold">
                <SelectValue placeholder="模式" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="text-xs font-medium">全部模式</SelectItem>
                <SelectItem value="team" className="text-xs font-medium">隊伍模式</SelectItem>
                <SelectItem value="spot" className="text-xs font-medium">號碼模式</SelectItem>
              </SelectContent>
            </Select>

            <div className="relative w-48 sm:w-56">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input 
                placeholder="搜尋團拆標題..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs bg-white border-slate-200 rounded-xl"
              />
            </div>

            {isFilterActive && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSearchTerm(''); }}
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
              <TableHead className="pl-6 text-[10px] font-black uppercase">活動標題</TableHead>
              <TableHead className="text-[10px] font-black uppercase">模式</TableHead>
              <TableHead className="text-[10px] font-black uppercase">售出進度</TableHead>
              <TableHead className="text-[10px] font-black uppercase">前台狀態</TableHead>
              <TableHead className="text-[10px] font-black uppercase">價格</TableHead>
              <TableHead className="text-[10px] font-black uppercase">建立時間</TableHead>
              <TableHead className="text-[10px] font-black uppercase">狀態設定</TableHead>
              <TableHead className="text-right pr-6 text-[10px] font-black uppercase">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && Array.from({ length: 3 }).map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-36" /></TableCell>
                <TableCell><Skeleton className="h-6 w-20 rounded-full" /></TableCell>
                <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                <TableCell><Skeleton className="h-6 w-28" /></TableCell>
                <TableCell className="text-right"><Skeleton className="h-9 w-20 ml-auto" /></TableCell>
              </TableRow>
            ))}
            {filteredBreaks.map((b) => {
              return (
                <TableRow key={b.id} className="hover:bg-slate-50/80 transition-colors border-b">
                  <TableCell className="font-bold pl-6 text-slate-900">
                    <div className="space-y-0.5">
                      <p className="hover:text-primary transition-colors cursor-pointer" onClick={() => router.push(`/admin/group-breaks/${b.id}`)}>
                        {b.title}
                      </p>
                      <p className="text-[10px] font-mono text-slate-400">ID: {b.id.substring(0, 8)}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-bold text-xs">
                      {b.breakType === 'team' ? '隊伍' : '號碼'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1 w-32">
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className={cn(b.isSoldOut ? "text-amber-600 font-black" : "text-emerald-600 font-bold")}>
                          {b.isSoldOut ? '● 已全售出' : `未售出 ${b.totalSpots - b.participantCount}`}
                        </span>
                        <span className="font-code text-slate-500">{b.participantCount}/{b.totalSpots}</span>
                      </div>
                      <Progress value={b.progressPercent} className="h-1.5" />
                    </div>
                  </TableCell>
                  <TableCell>
                    {b.status === 'completed' ? (
                      <Badge className="bg-slate-700 text-slate-300 font-black text-[10px]">派發完成 / 已結束</Badge>
                    ) : b.status === 'in_progress' ? (
                      <Badge className="bg-amber-500 text-slate-950 font-black animate-pulse text-[10px]">● 直播拆卡中</Badge>
                    ) : b.isSoldOut ? (
                      <Badge className="bg-amber-600 text-white font-black text-[10px]">已滿團 (已售出)</Badge>
                    ) : b.status === 'published' ? (
                      <Badge className="bg-emerald-600 text-white font-black text-[10px]">開團募集中</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-400 text-[10px]">草稿 (前台隱藏)</Badge>
                    )}
                  </TableCell>
                  <TableCell className="font-code font-bold">
                    {b.breakType === 'spot' ? `$${b.pricePerSpot}` : '按隊伍'}
                  </TableCell>
                  <TableCell className="text-slate-500 text-xs font-medium">
                    {b.createdAt ? format(b.createdAt.seconds * 1000, 'yyyy-MM-dd') : 'N/A'}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={b.status || 'draft'}
                      onValueChange={(val: any) => handleStatusChange(b.id, val)}
                    >
                      <SelectTrigger className="w-[130px] h-8 text-xs font-bold rounded-lg border-slate-200">
                        <SelectValue placeholder="選擇狀態" />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        <SelectItem value="draft" className="text-xs">草稿 (隱藏)</SelectItem>
                        <SelectItem value="published" className="text-xs text-emerald-600 font-bold">開團中 (募集中)</SelectItem>
                        <SelectItem value="in_progress" className="text-xs text-amber-600 font-bold">● 直播拆卡中</SelectItem>
                        <SelectItem value="completed" className="text-xs text-purple-600 font-bold">派發完成 (結束)</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <Button variant="ghost" size="icon" onClick={() => router.push(`/admin/group-breaks/${b.id}`)} className="h-8 w-8 hover:bg-slate-100"><Edit className="h-4 w-4" /></Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-rose-50"><Trash2 className="h-4 w-4" /></Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="rounded-3xl bg-white text-slate-900 border shadow-2xl">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="font-bold">確定刪除此團拆活動？</AlertDialogTitle>
                          <AlertDialogDescription className="text-slate-500 font-medium">此操作將永久刪除「{b.title}」，無法復原。</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                          <AlertDialogCancel className="rounded-xl font-bold">取消</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDelete(b.id)} className="bg-destructive text-white font-bold rounded-xl">確認刪除</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
        {!isLoading && filteredBreaks.length === 0 && (
          <div className="text-center py-16 text-muted-foreground space-y-2">
            <p className="font-bold text-sm text-slate-600">無符合條件的團拆活動</p>
            {isFilterActive && (
              <Button size="sm" variant="outline" onClick={() => { setStatusFilter('all'); setTypeFilter('all'); setSearchTerm(''); }} className="text-xs rounded-xl font-bold">
                重設所有篩選
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}