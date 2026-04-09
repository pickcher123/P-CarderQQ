'use client';

import { useState, useCallback, useMemo, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, writeBatch, updateDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, List, Image as ImageIcon, Save, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { SafeImage } from '@/components/safe-image';

interface BettingCategory {
    id?: string;
    name: string;
    imageUrl: string;
    order?: number;
}

interface BettingItems {
    id: string;
    allCardIds: string[];
}

export default function BettingAdminPage() {
    const router = useRouter();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [categoryName, setCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<BettingCategory | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Image upload states
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    const categoriesCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'bettingCategories'), orderBy('order', 'asc'));
    }, [firestore]);

    const { data: categories, isLoading: isLoadingCategories } = useCollection<BettingCategory>(categoriesCollectionRef);
    const { data: bettingItems, isLoading: isLoadingBettingItems } = useCollection<BettingItems>(useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]));

    const categoriesWithCount = useMemo(() => {
        if (!categories || !bettingItems) return [];
        const itemsMap = new Map(bettingItems.map(i => [i.id, i.allCardIds?.length || 0]));
        return categories.map(cat => ({
            ...cat,
            cardCount: itemsMap.get(cat.id!) || 0
        }));
    }, [categories, bettingItems]);

    const resetForm = () => {
        setCategoryName('');
        setEditingCategory(null);
        setIsProcessing(false);
        setSelectedFile(null);
        setPreviewUrl(null);
        setUploadProgress(null);
    };

    const handleOpenAddDialog = () => {
        resetForm();
        setIsAddDialogOpen(true);
    };

    const handleOpenEditDialog = (category: BettingCategory) => {
        resetForm();
        setEditingCategory(category);
        setCategoryName(category.name);
        setPreviewUrl(category.imageUrl || null);
        setIsEditDialogOpen(true);
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSaveCategory = async (mode: 'add' | 'edit') => {
        if (!categoryName.trim() || !firestore) return;
        setIsProcessing(true);

        try {
            let imageUrl = editingCategory?.imageUrl || '';

            if (selectedFile && storage) {
                const fileExtension = selectedFile.name.split('.').pop();
                const fileName = `P-Carder/betting-categories/${uuidv4()}.${fileExtension}`;
                const storageRef = ref(storage, fileName);
                const uploadTask = uploadBytesResumable(storageRef, selectedFile);

                imageUrl = await new Promise((resolve, reject) => {
                    uploadTask.on('state_changed', 
                        (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                        reject,
                        () => getDownloadURL(uploadTask.snapshot.ref).then(resolve)
                    );
                });
            }

            if (mode === 'add') {
                const categoryId = categoryName.toLowerCase().replace(/\s+/g, '-');
                const categoryDocRef = doc(firestore, 'bettingCategories', categoryId);
                await setDoc(categoryDocRef, {
                    id: categoryId,
                    name: categoryName,
                    imageUrl: imageUrl || `https://picsum.photos/seed/${Math.random()}/800/1000`,
                    order: (categories?.length ?? 0) + 1,
                });
                
                const bettingItemsDocRef = doc(firestore, 'betting-items', categoryId);
                await setDoc(bettingItemsDocRef, { allCardIds: [], soldCardIds: [] });

                toast({ title: '成功', description: `已新增拼卡分類：${categoryName}` });
                setIsAddDialogOpen(false);
            } else if (mode === 'edit' && editingCategory?.id) {
                await updateDoc(doc(firestore, 'bettingCategories', editingCategory.id), {
                    name: categoryName,
                    imageUrl: imageUrl
                });
                toast({ title: '成功', description: `分類「${categoryName}」已更新。` });
                setIsEditDialogOpen(false);
            }
            resetForm();
        } catch (error) {
            console.error("Error saving betting category:", error);
            toast({ variant: 'destructive', title: '錯誤', description: '儲存分類失敗。' });
        } finally {
            setIsProcessing(false);
        }
    }
    
    const handleDeleteCategory = async (category: BettingCategory) => {
      if (!firestore || !category.id) return;
      
      const batch = writeBatch(firestore);
      batch.delete(doc(firestore, 'bettingCategories', category.id));
      batch.delete(doc(firestore, 'betting-items', category.id));
      
      try {
        await batch.commit();
        toast({ title: '成功', description: `分類「${category.name}」已刪除。`});
      } catch (error) {
        console.error("Error deleting category:", error);
        toast({ variant: 'destructive', title: '錯誤', description: '刪除分類失敗。' });
      }
    }
    
    const handleOrderChange = useCallback(async (categoryId: string, newOrder: number) => {
        if (!firestore || !categoryId) return;
        if (isNaN(newOrder)) return;
        try {
            await updateDoc(doc(firestore, 'bettingCategories', categoryId), { order: newOrder });
            toast({ title: '成功', description: '分類順序已更新。' });
        } catch (error) {
            console.error("Error updating category order:", error);
            toast({ variant: 'destructive', title: '錯誤', description: '更新順序失敗。' });
        }
    }, [firestore, toast]);

    const isLoading = isLoadingCategories || isLoadingBettingItems;

    return (
        <div className="container mx-auto p-6 md:p-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold font-headline text-primary">拼卡分類管理</h1>
                    <p className="mt-2 text-muted-foreground">管理拼卡專區的主題分類，您可以設定專屬封面圖片與排序。</p>
                </div>
                <Button onClick={handleOpenAddDialog} className="font-bold bg-slate-900 text-white hover:bg-slate-800"><PlusCircle className="mr-2" /> 新增分類</Button>
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={(val) => !isProcessing && setIsAddDialogOpen(val)}>
                <DialogContent className="light sm:max-w-md bg-white border-none shadow-2xl rounded-2xl p-8 text-slate-900">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-xl">新增拼卡分類</DialogTitle>
                        <DialogDescription className="font-medium text-slate-500">輸入分類名稱並上傳封面圖片。</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="category-name" className="text-xs font-bold text-slate-500 uppercase tracking-widest">分類名稱</Label>
                            <Input 
                                id="category-name" 
                                value={categoryName}
                                onChange={e => setCategoryName(e.target.value)}
                                placeholder="例如：NBA 精選"
                                disabled={isProcessing}
                                className="h-12 border-slate-200 bg-white text-slate-900 font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">封面圖片</Label>
                            <div className="flex flex-col gap-4">
                                <div className="aspect-[4/5] relative w-32 mx-auto bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
                                    {previewUrl ? (
                                        <SafeImage src={previewUrl} alt="preview" fill className="object-cover" />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-slate-200" />
                                    )}
                                </div>
                                <Input type="file" accept="image/*" onChange={handleFileChange} disabled={isProcessing} className="text-xs" />
                                {uploadProgress !== null && (
                                    <div className="space-y-1">
                                        <Progress value={uploadProgress} className="h-1.5" />
                                        <p className="text-[10px] text-center font-bold text-primary">{Math.round(uploadProgress)}%</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => resetForm() || setIsAddDialogOpen(false)} disabled={isProcessing} className="font-bold">取消</Button>
                        <Button onClick={() => handleSaveCategory('add')} disabled={isProcessing || !categoryName} className="bg-slate-900 text-white font-bold h-12 px-8 rounded-xl shadow-lg">
                            {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            確認建立
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={(val) => !isProcessing && setIsEditDialogOpen(val)}>
                <DialogContent className="light sm:max-w-md bg-white border-none shadow-2xl rounded-2xl p-8 text-slate-900">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-xl">編輯分類詳情</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name" className="text-xs font-bold text-slate-500 uppercase tracking-widest">分類名稱</Label>
                            <Input 
                                id="edit-name" 
                                value={categoryName}
                                onChange={e => setCategoryName(e.target.value)}
                                disabled={isProcessing}
                                className="h-12 border-slate-200 bg-white text-slate-900 font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">封面圖片</Label>
                            <div className="flex flex-col gap-4">
                                <div className="aspect-[4/5] relative w-32 mx-auto bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center">
                                    {previewUrl ? (
                                        <SafeImage src={previewUrl} alt="preview" fill className="object-cover" />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-slate-200" />
                                    )}
                                </div>
                                <Input type="file" accept="image/*" onChange={handleFileChange} disabled={isProcessing} className="text-xs" />
                                {uploadProgress !== null && (
                                    <div className="space-y-1">
                                        <Progress value={uploadProgress} className="h-1.5" />
                                        <p className="text-[10px] text-center font-bold text-primary">{Math.round(uploadProgress)}%</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => resetForm() || setIsEditDialogOpen(false)} disabled={isProcessing} className="font-bold">取消</Button>
                        <Button onClick={() => handleSaveCategory('edit')} disabled={isProcessing || !categoryName} className="bg-slate-900 text-white font-bold h-12 px-8 rounded-xl shadow-lg">
                            {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4"/>}
                            儲存變更
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="border-slate-200 bg-white overflow-hidden shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-16 text-center text-[10px] font-black uppercase py-5">排序</TableHead>
                            <TableHead className="w-24 text-[10px] font-black uppercase">封面</TableHead>
                            <TableHead className="pl-6 text-[10px] font-black uppercase">分類名稱</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">卡片數量</TableHead>
                            <TableHead className="text-right pr-8 text-[10px] font-black uppercase">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-8 w-12 mx-auto" /></TableCell>
                                <TableCell><Skeleton className="h-12 w-16 rounded" /></TableCell>
                                <TableCell className="pl-6"><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell className="text-right pr-8"><Skeleton className="h-9 w-32 ml-auto" /></TableCell>
                            </TableRow>
                        ))}
                        {categoriesWithCount.map(category => (
                            <TableRow key={category.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 group">
                                <TableCell>
                                    <Input
                                        type="number"
                                        defaultValue={category.order}
                                        className="h-8 w-16 text-center font-code mx-auto bg-white border-slate-200"
                                        onBlur={(e) => handleOrderChange(category.id!, parseInt(e.target.value))}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="relative h-12 w-16 rounded-lg bg-slate-50 overflow-hidden border border-slate-200 shadow-sm">
                                        <SafeImage src={category.imageUrl} alt={category.name} fill className="object-cover" />
                                    </div>
                                </TableCell>
                                <TableCell className="pl-6 font-bold text-lg text-slate-900">
                                    <button 
                                        onClick={() => router.push(`/admin/betting/${category.id}`)}
                                        className="hover:text-primary transition-colors flex items-center gap-2"
                                    >
                                        <List className="h-4 w-4 opacity-30 group-hover:opacity-100" />
                                        {category.name}
                                    </button>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="bg-slate-100 text-slate-600 border-none font-code">
                                        {category.cardCount} CARDS
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-8">
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="outline" onClick={() => router.push(`/admin/betting/${category.id}`)} className="h-8 rounded-lg font-bold border-slate-200">
                                            管理獎品
                                        </Button>
                                        <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-slate-100" onClick={() => handleOpenEditDialog(category)}>
                                            <Edit className="h-4 w-4 text-slate-500" />
                                        </Button>
                                        <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button size="sm" variant="ghost" className="h-8 w-8 rounded-lg text-slate-400 hover:text-destructive">
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </AlertDialogTrigger>
                                            <AlertDialogContent className="light rounded-3xl bg-white text-slate-900 border-none shadow-2xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-bold">確定要刪除「{category.name}」嗎？</AlertDialogTitle>
                                                    <AlertDialogDescription className="font-medium text-slate-500">
                                                        此操作將永久刪除此分類及其下的所有拼卡數據。
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="gap-3">
                                                    <AlertDialogCancel className="font-bold">取消</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteCategory(category)} className="bg-destructive text-white font-bold">確認刪除</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {!isLoading && categoriesWithCount.length === 0 && (
                    <div className="text-center py-20 text-slate-400 font-medium italic">
                        目前尚未建立任何拼卡分類。
                    </div>
                )}
            </Card>
        </div>
    );
}
