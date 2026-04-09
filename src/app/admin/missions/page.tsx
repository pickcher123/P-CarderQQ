'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash2, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { DailyMission } from '@/types/missions';

const defaultMission: Omit<DailyMission, 'id'> = {
    title: '',
    description: '',
    rewardPoints: 10,
    type: 'login',
    taskTarget: 1,
    isActive: false,
};

const MISSION_TYPES = [
    { value: 'login', label: '每日登入' },
    { value: 'drawCard', label: '抽卡挑戰' },
    { value: 'winBet', label: '拼卡勝利' },
];

export default function MissionsAdminPage() {
  const firestore = useFirestore();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<DailyMission>>(defaultMission);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const missionsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'dailyMissions'), orderBy('type'));
  }, [firestore]);
  
  const { data: missions, isLoading: isLoadingMissions } = useCollection<DailyMission>(missionsCollectionRef);

  const resetDialog = () => {
    setCurrentItem(defaultMission);
    setIsEditMode(false);
    setIsProcessing(false);
  };
  
  const handleAddNew = () => {
    resetDialog();
    setIsDialogOpen(true);
  };

  const handleEdit = (item: DailyMission) => {
    setCurrentItem(item);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleDialogClose = (open: boolean) => {
    if(!open) {
        resetDialog();
    }
    setIsDialogOpen(open);
  }

  const handleSave = async () => {
    if (!firestore || !currentItem.title || !currentItem.type || !currentItem.rewardPoints || !currentItem.taskTarget) {
        toast({ variant: "destructive", title: "錯誤", description: "所有欄位皆為必填項。" });
        return;
    }
    setIsProcessing(true);

    try {
        const dataToSave = {
            title: currentItem.title,
            description: currentItem.description,
            rewardPoints: Number(currentItem.rewardPoints),
            type: currentItem.type,
            taskTarget: Number(currentItem.taskTarget),
            isActive: currentItem.isActive || false,
        };

        if (isEditMode && currentItem.id) {
            const itemDocRef = doc(firestore, 'dailyMissions', currentItem.id);
            await updateDoc(itemDocRef, dataToSave);
            toast({ title: "成功", description: "任務已更新。" });
        } else {
            await addDoc(collection(firestore, 'dailyMissions'), dataToSave);
            toast({ title: "成功", description: "新任務已建立。" });
        }
        handleDialogClose(false);

    } catch (error) {
        console.error("Error saving mission:", error);
        const errorMessage = error instanceof Error ? error.message : "發生未知錯誤。";
        toast({ variant: "destructive", title: "儲存失敗", description: `儲存任務時發生錯誤: ${errorMessage}` });
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDelete = async (itemId: string) => {
    if (!firestore) return;
    try {
        await deleteDoc(doc(firestore, 'dailyMissions', itemId));
        toast({ title: "成功", description: "任務已刪除。" });
    } catch (error) {
        console.error("Error deleting mission: ", error);
        toast({ variant: "destructive", title: "錯誤", description: "刪除任務時發生錯誤。" });
    }
  }

  const handleToggleActive = async (item: DailyMission) => {
    if (!firestore) return;
    try {
      const itemDocRef = doc(firestore, 'dailyMissions', item.id);
      await updateDoc(itemDocRef, { isActive: !item.isActive });
      toast({ title: '成功', description: '任務狀態已更新。' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: '錯誤', description: '更新任務狀態失敗。' });
    }
  }
  
  return (
    <div className="container mx-auto p-6 md:p-8 space-y-8">
       <div className="flex justify-between items-center">
            <div>
                <h1 className="font-headline text-3xl font-bold tracking-tight">每日任務管理</h1>
                <p className="mt-2 text-muted-foreground">建立、編輯並啟用每日任務來增加玩家黏著度。</p>
            </div>
            <Button onClick={() => handleAddNew()}><PlusCircle className="mr-2" /> 新增任務</Button>
        </div>

        <div className="bg-card border rounded-lg">
            <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>標題</TableHead>
                    <TableHead>類型</TableHead>
                    <TableHead>目標</TableHead>
                    <TableHead>獎勵 (點)</TableHead>
                    <TableHead>啟用</TableHead>
                    <TableHead className="w-[120px] text-right">操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoadingMissions && Array.from({length: 3}).map((_, i) => (
                    <TableRow key={i}>
                        <TableCell><Skeleton className="h-5 w-48" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-6 w-12" /></TableCell>
                        <TableCell className="text-right space-x-2">
                            <Skeleton className="h-8 w-8 inline-block" />
                            <Skeleton className="h-8 w-8 inline-block" />
                        </TableCell>
                    </TableRow>
                ))}
                {missions?.map((item) => (
                <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.title}</TableCell>
                    <TableCell className="text-muted-foreground">{MISSION_TYPES.find(t => t.value === item.type)?.label}</TableCell>
                    <TableCell className="text-muted-foreground">{item.taskTarget}</TableCell>
                    <TableCell className="font-code text-primary">{item.rewardPoints.toLocaleString()}</TableCell>
                    <TableCell>
                      <Switch
                        checked={item.isActive}
                        onCheckedChange={() => handleToggleActive(item)}
                      />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => handleEdit(item as DailyMission)}>
                        <Edit className="h-4 w-4" />
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>確定要刪除嗎？</AlertDialogTitle>
                                <AlertDialogDescription>
                                    這個操作無法復原。這將永久刪除任務「{item.title}」。
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(item.id!)} className="bg-destructive hover:bg-destructive/90">刪除</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
            {!isLoadingMissions && missions?.length === 0 && (
                <div className="text-center p-8 text-muted-foreground">
                    尚未建立任何每日任務。
                </div>
            )}
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
            <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>{isEditMode ? '編輯任務' : '新增任務'}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
                <div className="space-y-2">
                    <Label htmlFor="mission-title">標題</Label>
                    <Input id="mission-title" value={currentItem.title} onChange={e => setCurrentItem({...currentItem, title: e.target.value})} disabled={isProcessing} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="mission-description">描述</Label>
                    <Textarea id="mission-description" value={currentItem.description} onChange={e => setCurrentItem({...currentItem, description: e.target.value})} disabled={isProcessing} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                      <Label htmlFor="mission-type">任務類型</Label>
                      <Select value={currentItem.type} onValueChange={(value) => setCurrentItem({...currentItem, type: value as any})} disabled={isProcessing}>
                          <SelectTrigger id="mission-type">
                              <SelectValue placeholder="選擇類型" />
                          </SelectTrigger>
                          <SelectContent>
                              {MISSION_TYPES.map(cat => <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>)}
                          </SelectContent>
                      </Select>
                  </div>
                   <div className="space-y-2">
                      <Label htmlFor="mission-target">任務目標</Label>
                      <Input id="mission-target" type="number" value={currentItem.taskTarget ?? ''} onChange={e => setCurrentItem({...currentItem, taskTarget: Number(e.target.value)})} disabled={isProcessing} />
                  </div>
                </div>
                 <div className="space-y-2">
                    <Label htmlFor="mission-reward">獎勵點數</Label>
                    <Input id="mission-reward" type="number" value={currentItem.rewardPoints ?? ''} onChange={e => setCurrentItem({...currentItem, rewardPoints: Number(e.target.value)})} disabled={isProcessing} />
                </div>
                 <div className="flex items-center space-x-2">
                    <Switch id="mission-active" checked={currentItem.isActive} onCheckedChange={(checked) => setCurrentItem({...currentItem, isActive: checked})} disabled={isProcessing} />
                    <Label htmlFor="mission-active">啟用任務</Label>
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => handleDialogClose(false)}>取消</Button>
                <Button type="submit" onClick={handleSave} disabled={isProcessing}>
                    {isProcessing && <Loader2 className="animate-spin mr-2" />}
                    儲存
                </Button>
            </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}

    