'use client';

import { useState, useEffect, useMemo, ChangeEvent } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useDoc, useStorage } from '@/firebase';
import { collection, addDoc, updateDoc, doc, query, where, limit, deleteDoc, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, CalendarCheck, Save, Sparkles, Trophy, PlusCircle, Trash2, Edit, ShoppingBag, Image as ImageIcon } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Textarea } from '@/components/ui/textarea';
import { SafeImage } from '@/components/safe-image';
import type { DailyMission } from '@/types/missions';
import type { SystemConfig, LevelBenefit } from '@/types/system';
import { PPlusIcon } from '@/components/icons';

const DEFAULT_LEVELS: LevelBenefit[] = [
    { level: '新手收藏家', threshold: 0, freeShipping: false, depositBonus: 0, cashbackRate: 0 },
    { level: '進階收藏家', threshold: 15000, freeShipping: true, depositBonus: 0, cashbackRate: 1 },
    { level: '資深收藏家', threshold: 50000, freeShipping: true, depositBonus: 0, cashbackRate: 1.5 },
    { level: '卡牌大師', threshold: 100000, freeShipping: true, depositBonus: 0, cashbackRate: 2 },
    { level: '殿堂級玩家', threshold: 500000, freeShipping: true, depositBonus: 0, cashbackRate: 4 },
    { level: '傳奇收藏家', threshold: 1000000, freeShipping: true, depositBonus: 0, cashbackRate: 5 },
    { level: 'P+卡神', threshold: 2000000, freeShipping: true, depositBonus: 0, cashbackRate: 10 },
];

interface RedemptionItem {
    id: string;
    name: string;
    description: string;
    points: number;
    imageUrl: string;
    isActive: boolean;
    order: number;
}

const defaultItem: Omit<RedemptionItem, 'id'> = {
    name: '',
    description: '',
    points: 1000,
    imageUrl: '',
    isActive: true,
    order: 0,
};

export default function RewardsAdminPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isProcessing, setIsProcessing] = useState(false);
  const [checkInPoints, setCheckInPoints] = useState<number>(10);
  const [isCheckInActive, setIsCheckInActive] = useState<boolean>(true);
  const [checkInId, setCheckInId] = useState<string | null>(null);
  const [levelBenefits, setLevelBenefits] = useState<LevelBenefit[]>([]);

  const [isRedeemDialogOpen, setIsRedeemDialogOpen] = useState(false);
  const [currentRedeem, setCurrentRedeem] = useState<Partial<RedemptionItem>>({ name: '', points: 1000, isActive: true });
  const [isRedeemEditMode, setIsRedeemEditMode] = useState(false);
  const [redeemFile, setRedeemFile] = useState<File | null>(null);
  const [redeemPreview, setRedeemPreview] = useState<string | null>(null);
  const [redeemProgress, setRedeemUploadProgress] = useState<number | null>(null);

  const missionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'dailyMissions'), where('type', '==', 'login'), limit(1)) : null, [firestore]);
  const { data: missions } = useCollection<DailyMission>(missionsQuery);
  
  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig, isLoading: isLoadingConfig } = useDoc<SystemConfig>(systemConfigRef);
  
  const redemptionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'redemptionItems'), orderBy('order', 'asc')) : null, [firestore]);
  const { data: redemptionItems, isLoading: isLoadingRedemptions } = useCollection<RedemptionItem>(redemptionsQuery);

  useEffect(() => { if (missions?.[0]) { setCheckInPoints(missions[0].rewardPoints); setIsCheckInActive(missions[0].isActive); setCheckInId(missions[0].id); } }, [missions]);
  useEffect(() => { if (systemConfig) setLevelBenefits(DEFAULT_LEVELS.map(def => ({ ...def, ...(systemConfig.levelBenefits?.find(b => b.level === def.level) || {}) }))); }, [systemConfig]);

  const handleSaveCheckIn = async () => {
    if (!firestore) return;
    setIsProcessing(true);
    try {
      if (checkInId) await updateDoc(doc(firestore, 'dailyMissions', checkInId), { rewardPoints: Number(checkInPoints), isActive: isCheckInActive });
      else await addDoc(collection(firestore, 'dailyMissions'), { type: 'login', title: '每日簽到', rewardPoints: Number(checkInPoints), isActive: isCheckInActive });
      toast({ title: '已儲存' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive' });
    } finally { setIsProcessing(false); }
  };

  const handleRedeemAddNew = () => {
    setCurrentRedeem({ ...defaultItem, order: (redemptionItems?.length || 0) + 1 });
    setRedeemPreview(null);
    setRedeemFile(null);
    setIsRedeemEditMode(false);
    setIsRedeemDialogOpen(true);
  };

  const handleRedeemEdit = (item: RedemptionItem) => {
    setCurrentRedeem(item);
    setRedeemPreview(item.imageUrl);
    setIsRedeemEditMode(true);
    setIsRedeemDialogOpen(true);
  };

  const handleRedeemFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setRedeemFile(file);
      setRedeemPreview(URL.createObjectURL(file));
    }
  };

  const handleSaveRedemption = async () => {
    if (!firestore || !currentRedeem.name) return;
    setIsProcessing(true);
    try {
        let finalUrl = currentRedeem.imageUrl || '';
        if (redeemFile && storage) {
            setRedeemUploadProgress(0);
            const fileRef = ref(storage, `P-Carder/redemptions/${uuidv4()}`);
            const uploadTask = uploadBytesResumable(fileRef, redeemFile);
            finalUrl = await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', (s) => setRedeemUploadProgress((s.bytesTransferred / s.totalBytes) * 100), reject, () => getDownloadURL(uploadTask.snapshot.ref).then(resolve));
            });
        }
        const data = { ...currentRedeem, imageUrl: finalUrl, points: Number(currentRedeem.points), order: Number(currentRedeem.order || 0) };
        if (isRedeemEditMode && currentRedeem.id) await updateDoc(doc(firestore, 'redemptionItems', currentRedeem.id), data);
        else await addDoc(collection(firestore, 'redemptionItems'), data);
        setIsRedeemDialogOpen(false); setRedeemUploadProgress(null);
        toast({ title: '成功' });
    } catch (e) {
        console.error(e);
        toast({ variant: "destructive" });
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-8 text-slate-900">
      <h1 className="text-3xl font-black tracking-tight">會員回饋管理</h1>

      <Tabs defaultValue="checkin" className="space-y-6">
        <TabsList className="bg-slate-100 p-1 rounded-xl h-12 w-fit">
            <TabsTrigger value="checkin" className="rounded-lg px-6 font-bold text-xs">簽到設定</TabsTrigger>
            <TabsTrigger value="levels" className="rounded-lg px-6 font-bold text-xs">等級權益</TabsTrigger>
            <TabsTrigger value="redemptions" className="rounded-lg px-6 font-bold text-xs">紅利兌換</TabsTrigger>
        </TabsList>

        <TabsContent value="checkin">
            <Card className="border-slate-200 shadow-sm max-w-md bg-white">
                <CardHeader><CardTitle className="text-lg flex items-center gap-2 text-slate-900"><CalendarCheck className="h-5 w-5 text-slate-400" /> 簽到獎勵</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500">每日獲得點數 (P)</Label>
                        <div className="relative">
                            <PPlusIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" />
                            <Input type="number" value={checkInPoints} onChange={e => setCheckInPoints(Number(e.target.value))} className="h-12 pl-10 border-slate-200 font-bold bg-white text-slate-900" />
                        </div>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100"><Label className="font-bold">功能啟用</Label><Switch checked={isCheckInActive} onCheckedChange={setIsCheckInActive} /></div>
                    <Button onClick={handleSaveCheckIn} className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold" disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : '儲存設定'}</Button>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="levels">
            <Card className="border-slate-200 shadow-sm bg-white">
                <CardHeader className="flex flex-row justify-between items-center"><CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5 text-slate-400" /> 等級權益矩陣</CardTitle><Button onClick={async () => { setIsProcessing(true); try { await updateDoc(systemConfigRef!, { levelBenefits }); toast({title:'已更新'}); } catch(e){} finally {setIsProcessing(false);}}} disabled={isProcessing} className="bg-slate-900 text-white font-bold h-10 px-6">確認更新</Button></CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50"><TableRow><TableHead className="pl-8">等級名稱</TableHead><TableHead>門檻 (💎)</TableHead><TableHead>免運</TableHead><TableHead className="pr-8">回饋 (%)</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {levelBenefits.map((lb, i) => (
                                <TableRow key={lb.level} className="border-slate-100">
                                    <TableCell className="pl-8 font-bold text-slate-900">{lb.level}</TableCell>
                                    <TableCell className="font-code font-bold">{lb.threshold.toLocaleString()}</TableCell>
                                    <TableCell><Switch checked={lb.freeShipping} onCheckedChange={v => { const n = [...levelBenefits]; n[i].freeShipping = v; setLevelBenefits(n); }} /></TableCell>
                                    <TableCell className="pr-8"><Input type="number" step="0.1" value={lb.cashbackRate} onChange={e => { const n = [...levelBenefits]; n[i].cashbackRate = Number(e.target.value); setLevelBenefits(n); }} className="h-8 w-20 bg-slate-50 border-slate-200 font-bold" /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="redemptions">
            <div className="flex justify-between items-center mb-4"><h3 className="text-lg font-bold">商品列表</h3><Button onClick={handleRedeemAddNew} className="bg-slate-900 text-white font-bold h-10"><PlusCircle className="mr-2 h-4 w-4"/> 新增商品</Button></div>
            <Card className="border-slate-200 shadow-sm bg-white overflow-hidden rounded-2xl">
                <Table>
                    <TableHeader className="bg-slate-50"><TableRow><TableHead className="pl-8">圖片</TableHead><TableHead>名稱</TableHead><TableHead>點數</TableHead><TableHead>啟用</TableHead><TableHead className="text-right pr-8">操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoadingRedemptions ? Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={5} className="p-6"><Skeleton className="h-10 w-full rounded-xl"/></TableCell></TableRow>) : 
                        redemptionItems?.map(item => (
                            <TableRow key={item.id} className="border-slate-100 hover:bg-slate-50">
                                <TableCell className="pl-8"><div className="relative h-12 w-12 rounded border bg-slate-100 overflow-hidden"><SafeImage src={item.imageUrl} alt="p" fill className="object-cover" /></div></TableCell>
                                <TableCell className="font-bold text-slate-900">{item.name}</TableCell>
                                <TableCell className="font-code font-bold text-amber-600">
                                    <div className="flex items-center gap-1.5">
                                        <PPlusIcon className="w-3.5 h-3.5" />
                                        {item.points.toLocaleString()} P
                                    </div>
                                </TableCell>
                                <TableCell><Switch checked={item.isActive} onCheckedChange={() => updateDoc(doc(firestore!, 'redemptionItems', item.id), { isActive: !item.isActive })} /></TableCell>
                                <TableCell className="text-right pr-8 space-x-1">
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRedeemEdit(item)}><Edit className="h-4 w-4" /></Button>
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500" onClick={() => deleteDoc(doc(firestore!, 'redemptionItems', item.id))}><Trash2 className="h-4 w-4" /></Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={isRedeemDialogOpen} onOpenChange={setIsRedeemDialogOpen}>
            <DialogContent className="light sm:max-w-md bg-white border-none shadow-2xl p-8 rounded-2xl text-slate-900">
                <DialogHeader><DialogTitle className="font-bold"> {isRedeemEditMode ? '編輯商品' : '新增商品'} </DialogTitle></DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500">商品名稱</Label>
                        <Input value={currentRedeem.name} onChange={e => setCurrentRedeem({...currentRedeem, name: e.target.value})} className="border-slate-200 h-12 bg-white text-slate-900 font-bold" />
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500">描述</Label>
                        <Textarea value={currentRedeem.description} onChange={e => setCurrentRedeem({...currentRedeem, description: e.target.value})} className="border-slate-200 bg-white text-slate-900 font-medium" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">點數</Label>
                            <Input type="number" value={currentRedeem.points} onChange={e => setCurrentRedeem({...currentRedeem, points: Number(e.target.value)})} className="border-slate-200 h-12 bg-white text-slate-900 font-bold" />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500">排序</Label>
                            <Input type="number" value={currentRedeem.order} onChange={e => setCurrentRedeem({...currentRedeem, order: Number(e.target.value)})} className="border-slate-200 h-12 bg-white text-slate-900 font-bold" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500">商品圖片</Label>
                        <Input type="file" accept="image/*" onChange={handleRedeemFileChange} className="text-xs border-slate-200 bg-white" />
                        {redeemPreview && <div className="mt-2 relative aspect-square w-24 border rounded-lg bg-slate-50 overflow-hidden"><SafeImage src={redeemPreview} alt="pv" fill className="object-contain" /></div>}
                        {redeemProgress !== null && <Progress value={redeemProgress} className="h-1 mt-2" />}
                    </div>
                </div>
                <DialogFooter><Button onClick={handleSaveRedemption} disabled={isProcessing} className="w-full h-12 rounded-xl bg-slate-900 text-white font-bold">{isProcessing ? <Loader2 className="animate-spin h-4 w-4"/> : '儲存商品'}</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
