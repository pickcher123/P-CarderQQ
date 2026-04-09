
'use client';

import { useState, useMemo, ChangeEvent } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
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
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { PlusCircle, Edit, Trash2, Image as ImageIcon, Sparkles, Loader2, Save } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeImage } from '@/components/safe-image';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

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

export default function RedemptionsAdminPage() {
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [currentItem, setCurrentItem] = useState<Partial<RedemptionItem>>(defaultItem);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const redemptionsQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'redemptionItems'), orderBy('order', 'asc'));
  }, [firestore]);
  
  const { data: items, isLoading } = useCollection<RedemptionItem>(redemptionsQuery);

  const handleAddNew = () => {
    setCurrentItem({...defaultItem, order: (items?.length || 0) + 1});
    setPreviewUrl(null);
    setSelectedFile(null);
    setIsEditMode(false);
    setIsDialogOpen(true);
  };

  const handleEdit = (item: RedemptionItem) => {
    setCurrentItem(item);
    setPreviewUrl(item.imageUrl);
    setIsEditMode(true);
    setIsDialogOpen(true);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleSave = async () => {
    if (!firestore || !currentItem.name || !currentItem.points) return;
    setIsProcessing(true);

    try {
        let finalImageUrl = currentItem.imageUrl || '';

        if (selectedFile && storage) {
            setUploadProgress(0);
            const fileRef = ref(storage, `P-Carder/redemptions/${uuidv4()}`);
            const uploadTask = uploadBytesResumable(fileRef, selectedFile);
            
            finalImageUrl = await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', 
                    (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100),
                    reject,
                    () => getDownloadURL(uploadTask.snapshot.ref).then(resolve)
                );
            });
        }

        const dataToSave = {
            name: currentItem.name,
            description: currentItem.description || '',
            points: Number(currentItem.points),
            imageUrl: finalImageUrl,
            isActive: currentItem.isActive ?? true,
            order: Number(currentItem.order || 0),
        };

        if (isEditMode && currentItem.id) {
            await updateDoc(doc(firestore, 'redemptionItems', currentItem.id), dataToSave);
            toast({ title: "成功", description: "獎品已更新。" });
        } else {
            if (!finalImageUrl) throw new Error("必須上傳獎品圖片");
            await addDoc(collection(firestore, 'redemptionItems'), dataToSave);
            toast({ title: "成功", description: "新獎品已建立。" });
        }
        
        setIsDialogOpen(false);
        setUploadProgress(null);
        setSelectedFile(null);
    } catch (e: any) { 
        toast({ variant: "destructive", title: "失敗", description: e.message }); 
    } finally {
        setIsProcessing(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!firestore) return;
    try {
        await deleteDoc(doc(firestore, 'redemptionItems', id));
        toast({ title: "已刪除" });
    } catch (e) { toast({ variant: "destructive" }); }
  };

  const handleToggleActive = async (id: string, current: boolean) => {
    if (!firestore) return;
    try {
        await updateDoc(doc(firestore, 'redemptionItems', id), { isActive: !current });
        toast({ title: "狀態已更新" });
    } catch (e) { toast({ variant: "destructive" }); }
  };

  return (
    <div className="container mx-auto p-6 md:p-8 space-y-8">
       <div className="flex justify-between items-center">
            <div>
                <h1 className="font-headline text-3xl font-bold tracking-tight">紅利兌換管理</h1>
                <p className="mt-2 text-muted-foreground">管理玩家可使用紅利 P 點兌換的實體獎品。</p>
            </div>
            <Button onClick={handleAddNew}><PlusCircle className="mr-2" /> 新增獎品</Button>
        </div>

        <div className="bg-card border rounded-lg">
            <Table>
            <TableHeader>
                <TableRow>
                <TableHead className="w-24">圖片</TableHead>
                <TableHead>名稱</TableHead>
                <TableHead>所需點數</TableHead>
                <TableHead>排序</TableHead>
                <TableHead>啟用</TableHead>
                <TableHead className="text-right">操作</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {isLoading && Array.from({length: 3}).map((_, i) => <TableRow key={i}><TableCell colSpan={6}><Skeleton className="h-12 w-full" /></TableCell></TableRow>)}
                {items?.map((item) => (
                <TableRow key={item.id}>
                    <TableCell>
                        <div className="relative h-16 w-16 rounded overflow-hidden border">
                            <SafeImage src={item.imageUrl} alt={item.name} fill className="object-cover" />
                        </div>
                    </TableCell>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-code text-accent font-bold">{item.points.toLocaleString()} P</TableCell>
                    <TableCell>{item.order}</TableCell>
                    <TableCell>
                        <Switch checked={item.isActive} onCheckedChange={() => handleToggleActive(item.id, item.isActive)} />
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}><Edit className="h-4 w-4" /></Button>
                        <AlertDialog>
                            <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>確定刪除？</AlertDialogTitle></AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>取消</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDelete(item.id)}>刪除</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    </TableCell>
                </TableRow>
                ))}
            </TableBody>
            </Table>
            {!isLoading && items?.length === 0 && (
                <div className="text-center p-12 text-muted-foreground">尚未建立任何紅利兌換獎品。</div>
            )}
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>{isEditMode ? '編輯獎品' : '新增紅利獎品'}</DialogTitle>
                    <DialogDescription>填寫獎品資訊並上傳清晰的實體照片。</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                        <Label>獎品名稱</Label>
                        <Input value={currentItem.name} onChange={e => setCurrentItem({...currentItem, name: e.target.value})} placeholder="例如：P+ 限量毛巾" />
                    </div>
                    <div className="space-y-2">
                        <Label>獎品描述</Label>
                        <Textarea value={currentItem.description} onChange={e => setCurrentItem({...currentItem, description: e.target.value})} placeholder="簡短介紹規格或說明..." />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>所需 P 點</Label>
                            <Input type="number" value={currentItem.points} onChange={e => setCurrentItem({...currentItem, points: Number(e.target.value)})} />
                        </div>
                        <div className="space-y-2">
                            <Label>排序權重</Label>
                            <Input type="number" value={currentItem.order} onChange={e => setCurrentItem({...currentItem, order: Number(e.target.value)})} />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>獎品圖片</Label>
                        <Input type="file" accept="image/*" onChange={handleFileChange} />
                        {previewUrl && (
                            <div className="mt-2 relative aspect-square w-32 border rounded-md overflow-hidden">
                                <SafeImage src={previewUrl} alt="preview" fill className="object-cover" />
                            </div>
                        )}
                        {uploadProgress !== null && <Progress value={uploadProgress} className="mt-2" />}
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isProcessing}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        儲存獎品
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
