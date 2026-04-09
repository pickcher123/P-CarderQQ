'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash2, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeImage } from '@/components/safe-image';

interface Partner {
    id?: string;
    name: string;
    logoUrl: string;
    order: number;
    createdAt?: { seconds: number };
}

export default function PartnersAdminPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<Partner>>({ 
    name: '', 
    order: 0 
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const partnersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'partners'), orderBy('order', 'asc')) : null, [firestore]);
  const { data: partners, isLoading, forceRefetch } = useCollection<Partner>(partnersQuery);

  const handleSave = async () => {
    if (!firestore || !currentItem.name) return;
    setIsProcessing(true);
    try {
        let logoUrl = currentItem.logoUrl || '';
        if (selectedFile && storage) {
            setUploadProgress(0);
            const fileRef = ref(storage, `P-Carder/partners/${uuidv4()}`);
            const uploadTask = uploadBytesResumable(fileRef, selectedFile);
            logoUrl = await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), reject, () => getDownloadURL(uploadTask.snapshot.ref).then(resolve));
            });
        }
        const data = { 
            ...currentItem, 
            logoUrl,
            order: Number(currentItem.order) || 0,
            createdAt: currentItem.createdAt || serverTimestamp() 
        };
        if (isEditMode && currentItem.id) await updateDoc(doc(firestore, 'partners', currentItem.id), data);
        else await addDoc(collection(firestore, 'partners'), data);
        setIsDialogOpen(false); setUploadProgress(null); setSelectedFile(null);
        toast({ title: '成功' });
        if(forceRefetch) forceRefetch();
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive' });
    } finally { setIsProcessing(false); }
  };

  return (
    <div className="space-y-8 text-slate-900">
       <div className="flex justify-between items-center">
            <div>
                <h1 className="text-3xl font-black tracking-tight">合作夥伴管理</h1>
                <p className="text-sm text-slate-500 font-bold mt-1">管理首頁顯示的合作夥伴 LOGO。</p>
            </div>
            <Button onClick={() => { setIsEditMode(false); setCurrentItem({name: '', order: 0}); setPreviewUrl(null); setIsDialogOpen(true); }} className="bg-slate-900 text-white rounded-xl font-bold h-12 px-6 shadow-xl"><PlusCircle className="mr-2 h-4 w-4" /> 新增夥伴</Button>
        </div>

        <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
            <Table>
            <TableHeader className="bg-slate-50">
                <TableRow>
                    <TableHead className="w-24 text-center text-[10px] font-black uppercase py-5">LOGO</TableHead>
                    <TableHead className="text-[10px] font-black uppercase">名稱</TableHead>
                    <TableHead className="text-[10px] font-black uppercase text-center">排序</TableHead>
                    <TableHead className="text-right pr-8 text-[10px] font-black uppercase">操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading ? Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={4} className="p-6"><Skeleton className="h-10 w-full rounded-xl" /></TableCell></TableRow>) : 
                partners?.map((item) => (
                <TableRow key={item.id} className="hover:bg-slate-50 border-slate-100 group">
                    <TableCell className="py-4">
                        <div className="w-16 h-16 rounded-lg bg-slate-100 flex items-center justify-center overflow-hidden mx-auto">
                            <SafeImage src={item.logoUrl} alt={item.name} className="object-contain" width={64} height={64} />
                        </div>
                    </TableCell>
                    <TableCell>
                        <p className="font-bold text-slate-900">{item.name}</p>
                    </TableCell>
                    <TableCell className="text-center font-bold text-slate-500">{item.order}</TableCell>
                    <TableCell className="text-right pr-8 space-x-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-slate-100" onClick={() => { setCurrentItem(item); setPreviewUrl(item.logoUrl || null); setIsEditMode(true); setIsDialogOpen(true); }}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-9 w-9 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="light rounded-3xl border-none shadow-2xl bg-white text-slate-900">
                                <AlertDialogHeader>
                                    <AlertDialogTitle className="font-black text-xl">確認刪除夥伴？</AlertDialogTitle>
                                    <AlertDialogDescription className="font-bold text-slate-500">此動作將永久移除「{item.name}」，無法復原。</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="gap-3">
                                    <AlertDialogCancel className="rounded-xl font-bold">取消</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteDoc(doc(firestore!, 'partners', item.id!))} className="rounded-xl bg-red-600 font-black px-8 border-none shadow-xl text-white">確認刪除</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
            {!isLoading && partners?.length === 0 && (
                <div className="text-center py-20 text-slate-400 font-bold italic">目前尚無合作夥伴</div>
            )}
        </Card>
        
        <Dialog open={isDialogOpen} onOpenChange={(v) => !isProcessing && setIsDialogOpen(v)}>
            <DialogContent className="light sm:max-w-xl bg-white border-none shadow-2xl p-8 rounded-[2.5rem] text-slate-900 overflow-hidden">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black tracking-tight">{isEditMode ? '修改夥伴資訊' : '新增合作夥伴'}</DialogTitle>
                    <DialogDescription className="font-medium text-slate-500">設定夥伴名稱、LOGO 以及顯示排序。</DialogDescription>
                </DialogHeader>
                <div className="grid gap-6 py-6 overflow-y-auto max-h-[70vh] pr-2">
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">夥伴名稱</Label>
                        <Input value={currentItem.name} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} className="h-14 border-slate-200 rounded-2xl font-bold text-lg bg-white text-slate-900" placeholder="輸入夥伴名稱" />
                    </div>
                    
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">顯示排序 (數字越小越前面)</Label>
                        <Input type="number" value={currentItem.order} onChange={e => setCurrentItem({...currentItem, order: Number(e.target.value)})} className="h-14 border-slate-200 rounded-2xl font-bold text-lg bg-white text-slate-900" />
                    </div>

                    <div className="space-y-4">
                        <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">LOGO 圖片</Label>
                        <div className="flex flex-col gap-4">
                            <div className="aspect-video relative rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center group">
                                {previewUrl ? (
                                    <SafeImage src={previewUrl} alt="p" fill className="object-contain p-2" />
                                ) : (
                                    <div className="text-center space-y-2">
                                        <ImageIcon className="h-10 w-10 text-slate-200 mx-auto" />
                                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Image Selected</p>
                                    </div>
                                )}
                            </div>
                            <Input type="file" accept="image/*" onChange={e => { if(e.target.files?.[0]) { setSelectedFile(e.target.files[0]); setPreviewUrl(URL.createObjectURL(e.target.files[0])); } }} className="text-xs border-slate-200 h-10 file:font-black bg-white" />
                            {uploadProgress !== null && (
                                <div className="space-y-1">
                                    <Progress value={uploadProgress} className="h-1.5 bg-slate-100" />
                                    <p className="text-[10px] text-center font-black text-primary uppercase tracking-widest">{Math.round(uploadProgress)}% UPLOADING</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
                <DialogFooter className="pt-6 border-t border-slate-100">
                    <Button variant="ghost" onClick={() => setIsDialogOpen(false)} disabled={isProcessing} className="font-bold">取消</Button>
                    <Button onClick={handleSave} disabled={isProcessing || !currentItem.name || (!isEditMode && !selectedFile)} className="h-14 px-12 rounded-2xl font-black bg-slate-900 text-white shadow-xl hover:bg-slate-800 transition-all text-lg">
                        {isProcessing ? <Loader2 className="animate-spin h-5 w-5"/> : (isEditMode ? '儲存變更' : '確認新增')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
