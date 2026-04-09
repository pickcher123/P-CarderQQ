'use client';

import { useState, useCallback, useMemo, useEffect, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { collection, doc, setDoc, deleteDoc, updateDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { Card } from "@/components/ui/card";
import { Button } from '@/components/ui/button';
import { PlusCircle, Edit, Trash2, Settings, Loader2, List, Image as ImageIcon, Upload, Save } from 'lucide-react';
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
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { SafeImage } from '@/components/safe-image';

interface DrawCategory {
    id?: string;
    name: string;
    imageUrl: string;
    order?: number;
}

interface CardPool {
    id: string;
    categoryId?: string;
}

interface CategoryWithData extends DrawCategory {
    poolCount: number;
}

export default function DrawCategoriesAdminPage() {
    const router = useRouter();
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();

    // Dialog states
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDetailsOpen] = useState(false);
    
    // Form states
    const [categoryName, setCategoryName] = useState('');
    const [editingCategory, setEditingCategory] = useState<DrawCategory | null>(null);
    const [isProcessing, setIsProcessing] = useState(false);

    // Image upload states
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    const [categoriesWithData, setCategoriesWithData] = useState<CategoryWithData[]>([]);

    const categoriesCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'drawCategories'), orderBy('order', 'asc'));
    }, [firestore]);

    const { data: categories, isLoading: isLoadingCategories } = useCollection<DrawCategory>(categoriesCollectionRef);
    const { data: cardPools, isLoading: isLoadingPools } = useCollection<CardPool>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));

     useEffect(() => {
        if (categories && cardPools) {
            const data = categories.map(cat => {
                const count = cardPools.filter(pool => pool.categoryId === cat.id).length;
                return { ...cat, poolCount: count };
            });
            setCategoriesWithData(data);
        }
    }, [categories, cardPools]);

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

    const handleOpenEditDialog = (category: DrawCategory) => {
        resetForm();
        setEditingCategory(category);
        setCategoryName(category.name);
        setPreviewUrl(category.imageUrl || null);
        setIsEditDetailsOpen(true);
    };

    const handleDialogClose = (open: boolean) => {
        if (!open && !isProcessing) {
            setIsAddDialogOpen(false);
            setIsEditDetailsOpen(false);
            resetForm();
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };

    const handleSaveCategory = async (mode: 'add' | 'edit') => {
        if (!categoryName.trim() || !firestore) {
            toast({ variant: 'destructive', title: '錯誤', description: '分類名稱不能為空。' });
            return;
        }

        setIsProcessing(true);
        
        try {
            let imageUrl = editingCategory?.imageUrl || '';

            if (selectedFile && storage) {
                const fileExtension = selectedFile.name.split('.').pop();
                const fileName = `P-Carder/categories/${uuidv4()}.${fileExtension}`;
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
                const categoryDocRef = doc(firestore, 'drawCategories', categoryId);
                await setDoc(categoryDocRef, {
                    id: categoryId,
                    name: categoryName,
                    imageUrl: imageUrl || `https://picsum.photos/seed/${Math.random()}/800/1000`,
                    order: (categories?.length ?? 0) + 1,
                });
                toast({ title: '成功', description: `已新增分類：${categoryName}` });
                setIsAddDialogOpen(false);
            } else if (mode === 'edit' && editingCategory?.id) {
                const categoryDocRef = doc(firestore, 'drawCategories', editingCategory.id);
                await updateDoc(categoryDocRef, {
                    name: categoryName,
                    imageUrl: imageUrl,
                });
                toast({ title: '成功', description: `分類「${categoryName}」已更新。` });
                setIsEditDetailsOpen(false);
            }

            resetForm();
        } catch (error: any) {
            console.error("Error saving category:", error);
            toast({ variant: 'destructive', title: '錯誤', description: `儲存失敗: ${error.message}` });
        } finally {
            setIsProcessing(false);
        }
    };
    
    const handleDeleteCategory = async (category: DrawCategory) => {
      if (!firestore || !category.id) return;
      try {
        await deleteDoc(doc(firestore, 'drawCategories', category.id));
        toast({ title: '成功', description: `分類「${category.name}」已刪除。`});
      } catch (error) {
        console.error("Error deleting category:", error);
        toast({ variant: 'destructive', title: '錯誤', description: '刪除失敗。' });
      }
    }
    
    const handleOrderChange = useCallback(async (categoryId: string, newOrder: number) => {
        if (!firestore || !categoryId) return;
        if (isNaN(newOrder)) return;
        try {
            const categoryRef = doc(firestore, 'drawCategories', categoryId);
            await updateDoc(categoryRef, { order: newOrder });
            toast({ title: '成功', description: '順序已更新。' });
        } catch (error) {
            console.error("Error updating category order:", error);
            toast({ variant: 'destructive', title: '錯誤', description: '更新順序失敗。' });
        }
    }, [firestore, toast]);
    
    const isLoading = isLoadingCategories || isLoadingPools;

    return (
        <div className="container mx-auto p-6 md:p-8 space-y-8 text-slate-900">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black font-headline text-slate-900 tracking-tight">抽卡分類管理</h1>
                    <p className="mt-2 text-slate-700 font-bold">管理抽卡專區的主題分類，您可以設定專屬封面圖片與排序。</p>
                </div>
                <Button onClick={handleOpenAddDialog} className="font-black bg-slate-900 text-white rounded-xl h-12 px-8 shadow-xl"><PlusCircle className="mr-2 h-4 w-4" /> 新增分類</Button>
            </div>
            
            <Dialog open={isAddDialogOpen} onOpenChange={handleDialogClose}>
                <DialogContent className="sm:max-w-md bg-white border-none shadow-2xl rounded-2xl p-8">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-900">新增抽卡分類</DialogTitle>
                        <DialogDescription className="font-medium text-slate-500">輸入分類名稱並上傳專屬封面圖片。</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="category-name" className="text-xs font-bold text-slate-500 uppercase tracking-widest">分類名稱</Label>
                            <Input 
                                id="category-name" 
                                value={categoryName}
                                onChange={e => setCategoryName(e.target.value)}
                                placeholder="例如：年度精選"
                                disabled={isProcessing}
                                className="h-12 border-slate-200 rounded-xl font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">封面圖片</Label>
                            <div className="flex flex-col gap-4">
                                <div className="aspect-[4/5] relative w-32 mx-auto bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center group">
                                    {previewUrl ? (
                                        <SafeImage src={previewUrl} alt="preview" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-slate-200" />
                                    )}
                                </div>
                                <Input type="file" accept="image/*" onChange={handleFileChange} disabled={isProcessing} className="text-xs border-slate-200 h-10 file:font-bold" />
                                {uploadProgress !== null && (
                                    <div className="space-y-1">
                                        <Progress value={uploadProgress} className="h-1.5 bg-slate-100" />
                                        <p className="text-[10px] text-center font-black text-primary uppercase tracking-widest">{Math.round(uploadProgress)}% 上傳中</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => handleDialogClose(false)} disabled={isProcessing} className="font-bold">取消操作</Button>
                        <Button onClick={() => handleSaveCategory('add')} disabled={isProcessing || !categoryName} className="h-12 px-8 font-black bg-slate-900 text-white rounded-xl shadow-lg">
                            {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                            確認建立
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={isEditDialogOpen} onOpenChange={handleDialogClose}>
                <DialogContent className="sm:max-w-md bg-white border-none shadow-2xl rounded-2xl p-8">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black text-slate-900">編輯分類詳情</DialogTitle>
                    </DialogHeader>
                    <div className="py-4 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="edit-name" className="text-xs font-bold text-slate-500 uppercase tracking-widest">分類名稱</Label>
                            <Input 
                                id="edit-name" 
                                value={categoryName}
                                onChange={e => setCategoryName(e.target.value)}
                                disabled={isProcessing}
                                className="h-12 border-slate-200 rounded-xl font-bold"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label className="text-xs font-bold text-slate-500 uppercase tracking-widest">封面圖片</Label>
                            <div className="flex flex-col gap-4">
                                <div className="aspect-[4/5] relative w-32 mx-auto bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden flex items-center justify-center group">
                                    {previewUrl ? (
                                        <SafeImage src={previewUrl} alt="preview" fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-slate-200" />
                                    )}
                                </div>
                                <Input type="file" accept="image/*" onChange={handleFileChange} disabled={isProcessing} className="text-xs border-slate-200 h-10 file:font-bold" />
                                {uploadProgress !== null && (
                                    <div className="space-y-1">
                                        <Progress value={uploadProgress} className="h-1.5 bg-slate-100" />
                                        <p className="text-[10px] text-center font-black text-primary uppercase tracking-widest">{Math.round(uploadProgress)}% 上傳中</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => handleDialogClose(false)} disabled={isProcessing} className="font-bold">取消</Button>
                        <Button onClick={() => handleSaveCategory('edit')} disabled={isProcessing || !categoryName} className="h-12 px-8 font-black bg-slate-900 text-white rounded-xl shadow-lg">
                            {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4"/>}
                            儲存變更
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card className="border-slate-200 bg-white overflow-hidden shadow-sm rounded-2xl">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="border-b-slate-200">
                            <TableHead className="w-20 text-center text-slate-900 font-black uppercase text-[10px] tracking-widest py-5">排序</TableHead>
                            <TableHead className="w-24 text-slate-900 font-black uppercase text-[10px] tracking-widest">封面</TableHead>
                            <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest pl-6">分類名稱</TableHead>
                            <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">卡池數量</TableHead>
                            <TableHead className="text-right pr-8 text-slate-900 font-black uppercase text-[10px] tracking-widest">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && Array.from({ length: 5 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-8 w-12 mx-auto" /></TableCell>
                                <TableCell><Skeleton className="h-12 w-16 rounded-xl" /></TableCell>
                                <TableCell className="pl-6"><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell className="text-right pr-8"><Skeleton className="h-9 w-24 ml-auto rounded-xl" /></TableCell>
                            </TableRow>
                        ))}
                        {categoriesWithData.map(category => (
                            <TableRow key={category.id} className="hover:bg-slate-50/50 transition-colors border-b-slate-100 group">
                                <TableCell>
                                    <Input
                                        type="number"
                                        defaultValue={category.order}
                                        className="h-9 w-16 text-center font-code font-black mx-auto bg-white border-slate-200 rounded-lg shadow-sm"
                                        onBlur={(e) => handleOrderChange(category.id!, parseInt(e.target.value))}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="relative h-14 w-20 rounded-xl bg-slate-100 overflow-hidden border border-slate-200 shadow-sm group-hover:scale-105 transition-transform duration-500">
                                        <SafeImage src={category.imageUrl} alt={category.name} fill className="object-cover" />
                                    </div>
                                </TableCell>
                                <TableCell className="pl-6 font-black text-lg text-slate-900">
                                    <button 
                                        onClick={() => router.push(`/admin/card-pools/c/${category.id}`)}
                                        className="hover:text-primary transition-colors flex items-center gap-2"
                                    >
                                        <List className="h-4 w-4 text-slate-400 group-hover:text-primary" />
                                        {category.name}
                                    </button>
                                </TableCell>
                                <TableCell>
                                    <Badge variant="secondary" className="bg-slate-900 text-white font-code px-3 border-none h-6">
                                        {category.poolCount} POOLS
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-right pr-8 space-x-1">
                                    <Button size="sm" variant="ghost" onClick={() => router.push(`/admin/card-pools/c/${category.id}`)} className="rounded-xl font-bold h-9 px-4 hover:bg-slate-100">
                                        管理卡池
                                    </Button>
                                    <Button size="sm" variant="ghost" className="h-9 w-9 rounded-xl hover:bg-slate-100" onClick={() => handleOpenEditDialog(category)}>
                                        <Edit className="h-4 w-4 text-slate-600" />
                                    </Button>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button size="sm" variant="ghost" className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50">
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                                            <AlertDialogHeader>
                                                <AlertDialogTitle className="text-xl font-black">確定要刪除「{category.name}」嗎？</AlertDialogTitle>
                                                <AlertDialogDescription className="font-bold text-slate-500">
                                                    此操作將永久刪除此分類及其關聯數據。此動作無法復原。
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter className="gap-3">
                                                <AlertDialogCancel className="rounded-xl font-bold">取消</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDeleteCategory(category)} className="rounded-xl bg-rose-600 text-white font-black hover:bg-rose-700 shadow-lg px-8">確認刪除</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {!isLoading && categoriesWithData.length === 0 && (
                    <div className="text-center py-32 text-slate-400 font-bold italic flex flex-col items-center gap-4">
                        <ImageIcon className="h-12 w-12 opacity-10" />
                        目前尚未建立任何抽卡分類
                    </div>
                )}
            </Card>
        </div>
    );
}
