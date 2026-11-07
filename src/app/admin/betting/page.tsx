'use client';

import { useState, useCallback, useMemo, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useStorage, useDoc } from '@/firebase';
import { collection, doc, setDoc, writeBatch, updateDoc, query, orderBy } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import { 
  PlusCircle, Edit, Trash2, List, Save, Loader2, 
  RefreshCw, Search, CheckCircle2, ShoppingBag, Layers, RotateCcw
} from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import type { SystemConfig } from '@/types/system';
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
import { AIImageGeneratorDialog } from '@/components/admin/ai-image-generator-dialog';
import { cn } from '@/lib/utils';

interface BettingCategory {
    id?: string;
    name: string;
    imageUrl: string;
    order?: number;
}

interface BettingItems {
    id: string;
    allCardIds: string[];
    soldCardIds?: string[];
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

    // 篩選與搜尋狀態
    const [searchTerm, setSearchTerm] = useState('');
    const [inventoryFilter, setInventoryFilter] = useState<'all' | 'has_available' | 'sold_out'>('all');

    const categoriesCollectionRef = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'bettingCategories'), orderBy('order', 'asc'));
    }, [firestore]);

    const { data: categories, isLoading: isLoadingCategories } = useCollection<BettingCategory>(categoriesCollectionRef);
    const { data: bettingItems, isLoading: isLoadingBettingItems } = useCollection<BettingItems>(useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]));

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
    const isAutoRelistEnabled = systemConfig?.bettingAutoRelistOnBuyBack !== false; // 預設開啟

    const handleToggleAutoRelist = async (checked: boolean) => {
        if (!firestore) return;
        try {
            await setDoc(doc(firestore, 'systemConfig', 'main'), {
                bettingAutoRelistOnBuyBack: checked
            }, { merge: true });
            toast({
                title: checked ? "已開啟：拼卡 Buy Back 自動重新上架" : "已關閉：拼卡 Buy Back 自動重新上架",
                description: checked 
                    ? "玩家將拼卡獲得的卡片「快速轉點 / Buy Back」後，系統將自動復原該卡片狀態並重新上架至拼卡專區。"
                    : "玩家轉點後，拼卡卡片將標記為已售出 / 已回收。"
            });
        } catch (e: any) {
            toast({ variant: 'destructive', title: "設定更新失敗", description: e.message });
        }
    };

    const categoriesWithCount = useMemo(() => {
        if (!categories) return [];
        const itemsMap = new Map<string, { total: number, sold: number, available: number }>();
        bettingItems?.forEach(i => {
            const total = i.allCardIds?.length || 0;
            const sold = i.soldCardIds?.length || 0;
            const available = Math.max(0, total - sold);
            itemsMap.set(i.id, { total, sold, available });
        });

        return categories.map(cat => {
            const data = itemsMap.get(cat.id!) || { total: 0, sold: 0, available: 0 };
            return {
                ...cat,
                cardCount: data.total,
                soldCount: data.sold,
                availableCount: data.available,
            };
        });
    }, [categories, bettingItems]);

    // 總體統計
    const totalStats = useMemo(() => {
        let totalCategories = categoriesWithCount.length;
        let totalCards = 0;
        let totalAvailable = 0;
        let totalSold = 0;

        categoriesWithCount.forEach(c => {
            totalCards += c.cardCount;
            totalAvailable += c.availableCount;
            totalSold += c.soldCount;
        });

        return { totalCategories, totalCards, totalAvailable, totalSold };
    }, [categoriesWithCount]);

    // 經過篩選後的分類清單
    const filteredCategories = useMemo(() => {
        let result = [...categoriesWithCount];

        // 搜尋
        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            result = result.filter(c => c.name.toLowerCase().includes(q));
        }

        // 售出狀態篩選
        if (inventoryFilter === 'has_available') {
            result = result.filter(c => c.availableCount > 0);
        } else if (inventoryFilter === 'sold_out') {
            result = result.filter(c => c.cardCount > 0 && c.availableCount === 0);
        }

        return result;
    }, [categoriesWithCount, searchTerm, inventoryFilter]);

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
    };
    
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
    };
    
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
        <div className="container mx-auto p-4 sm:p-6 md:p-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold font-headline text-primary">拼卡分類管理</h1>
                    <p className="mt-1 text-muted-foreground text-sm">管理拼卡專區的主題分類、庫存售出狀況與封面圖片。</p>
                </div>
                <Button onClick={handleOpenAddDialog} className="font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-md">
                    <PlusCircle className="mr-2 h-4 w-4" /> 新增拼卡分類
                </Button>
            </div>

            {/* 頂部數據看板 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">總分類數</p>
                        <p className="text-2xl font-black font-code text-slate-900 mt-0.5">{totalStats.totalCategories}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
                        <Layers className="w-5 h-5" />
                    </div>
                </div>

                <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">全區配置卡片</p>
                        <p className="text-2xl font-black font-code text-slate-900 mt-0.5">{totalStats.totalCards}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold">
                        <List className="w-5 h-5" />
                    </div>
                </div>

                <div 
                    onClick={() => setInventoryFilter('has_available')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center justify-between",
                        inventoryFilter === 'has_available'
                            ? "bg-emerald-500/10 border-emerald-500 ring-2 ring-emerald-500/20"
                            : "bg-white border-slate-200/80 hover:border-emerald-300"
                    )}
                >
                    <div>
                        <p className="text-[11px] font-black uppercase tracking-wider text-emerald-600">未售出卡片 (販售中)</p>
                        <p className="text-2xl font-black font-code text-emerald-600 mt-0.5">{totalStats.totalAvailable}</p>
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                        <ShoppingBag className="w-5 h-5" />
                    </div>
                </div>

                <div 
                    onClick={() => setInventoryFilter('sold_out')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center justify-between",
                        inventoryFilter === 'sold_out'
                            ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20"
                            : "bg-white border-slate-200/80 hover:border-slate-400"
                    )}
                >
                    <div>
                        <p className={cn("text-[11px] font-black uppercase tracking-wider", inventoryFilter === 'sold_out' ? "text-slate-300" : "text-slate-500")}>
                            已售出卡片
                        </p>
                        <p className={cn("text-2xl font-black font-code mt-0.5", inventoryFilter === 'sold_out' ? "text-white" : "text-slate-700")}>
                            {totalStats.totalSold}
                        </p>
                    </div>
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center font-bold", inventoryFilter === 'sold_out' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700")}>
                        <CheckCircle2 className="w-5 h-5" />
                    </div>
                </div>
            </div>

            {/* Buy Back 回收自動重新上架設定卡片 */}
            <Card className="border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 text-white p-5 sm:p-6 rounded-2xl shadow-md">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                        <div className="p-3 bg-pink-500/20 text-pink-400 rounded-xl border border-pink-500/30 shrink-0">
                            <RefreshCw className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="font-bold text-base sm:text-lg text-white">Buy Back 回收自動重新上架</h3>
                                <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 text-[10px] font-bold">自動循環</Badge>
                            </div>
                            <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                                當玩家將拼卡獲得的卡片進行「快速轉點 / Buy Back」後，系統將自動復原該卡片狀態為「未售出」，並重新上架至拼卡專區。
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 self-end sm:self-auto bg-slate-950/60 p-2.5 sm:p-3 rounded-xl border border-white/10">
                        <span className="text-xs font-bold text-slate-300">
                            {isAutoRelistEnabled ? '自動重新上架：開啟' : '自動重新上架：關閉'}
                        </span>
                        <Switch 
                            checked={isAutoRelistEnabled}
                            onCheckedChange={handleToggleAutoRelist}
                            className="data-[state=checked]:bg-pink-500"
                        />
                    </div>
                </div>
            </Card>

            {/* 分類清單與快速篩選列 */}
            <Card className="border-slate-200 bg-white overflow-hidden shadow-sm">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    {/* 分類篩選 Tabs */}
                    <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-xs">
                        <button
                            type="button"
                            onClick={() => setInventoryFilter('all')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                                inventoryFilter === 'all'
                                    ? "bg-slate-900 text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            全部 ({categoriesWithCount.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setInventoryFilter('has_available')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer",
                                inventoryFilter === 'has_available'
                                    ? "bg-emerald-600 text-white shadow-xs"
                                    : "text-slate-600 hover:text-emerald-700"
                            )}
                        >
                            <span className={cn("w-1.5 h-1.5 rounded-full", inventoryFilter === 'has_available' ? "bg-white" : "bg-emerald-500")} />
                            尚有未售出
                        </button>
                        <button
                            type="button"
                            onClick={() => setInventoryFilter('sold_out')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer",
                                inventoryFilter === 'sold_out'
                                    ? "bg-slate-700 text-white shadow-xs"
                                    : "text-slate-600 hover:text-slate-900"
                            )}
                        >
                            全數已售罄
                        </button>
                    </div>

                    {/* 搜尋分類名稱 */}
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="搜尋分類名稱..." 
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 h-9 text-xs bg-white border-slate-200 rounded-xl"
                        />
                    </div>
                </div>

                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow>
                            <TableHead className="w-16 text-center text-[10px] font-black uppercase py-4">排序</TableHead>
                            <TableHead className="w-20 text-[10px] font-black uppercase">封面</TableHead>
                            <TableHead className="pl-6 text-[10px] font-black uppercase">分類名稱</TableHead>
                            <TableHead className="text-[10px] font-black uppercase">卡片庫存狀態</TableHead>
                            <TableHead className="text-right pr-8 text-[10px] font-black uppercase">操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading && Array.from({ length: 4 }).map((_, i) => (
                            <TableRow key={i}>
                                <TableCell><Skeleton className="h-8 w-12 mx-auto" /></TableCell>
                                <TableCell><Skeleton className="h-12 w-16 rounded" /></TableCell>
                                <TableCell className="pl-6"><Skeleton className="h-5 w-48" /></TableCell>
                                <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                                <TableCell className="text-right pr-8"><Skeleton className="h-9 w-32 ml-auto" /></TableCell>
                            </TableRow>
                        ))}
                        {filteredCategories.map(category => (
                            <TableRow key={category.id} className="hover:bg-slate-50/80 transition-colors border-b border-slate-100 group">
                                <TableCell>
                                    <Input
                                        type="number"
                                        defaultValue={category.order}
                                        className="h-8 w-14 text-center font-code text-xs mx-auto bg-white border-slate-200 rounded-lg"
                                        onBlur={(e) => handleOrderChange(category.id!, parseInt(e.target.value))}
                                    />
                                </TableCell>
                                <TableCell>
                                    <div className="relative h-14 w-11 rounded-xl bg-slate-50 overflow-hidden border border-slate-200 shadow-xs">
                                        <SafeImage src={category.imageUrl} alt={category.name} fill className="object-cover" />
                                    </div>
                                </TableCell>
                                <TableCell className="pl-6 font-bold text-slate-900">
                                    <button 
                                        onClick={() => router.push(`/admin/betting/${category.id}`)}
                                        className="hover:text-primary transition-colors flex items-center gap-2 text-left"
                                    >
                                        <List className="h-4 w-4 opacity-30 group-hover:opacity-100" />
                                        <span className="text-base font-black">{category.name}</span>
                                    </button>
                                </TableCell>
                                <TableCell>
                                    <div className="flex items-center gap-2">
                                        <Badge variant="outline" className="font-code text-xs font-black border-slate-300">
                                            共 {category.cardCount} 張
                                        </Badge>
                                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-300 font-code text-xs font-black">
                                            未售出 {category.availableCount}
                                        </Badge>
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-code text-xs font-black">
                                            已售出 {category.soldCount}
                                        </Badge>
                                    </div>
                                </TableCell>
                                <TableCell className="text-right pr-8">
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="outline" onClick={() => router.push(`/admin/betting/${category.id}`)} className="h-8 rounded-lg font-bold border-slate-200 text-xs">
                                            管理卡片 ({category.availableCount} 未售)
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
                                            <AlertDialogContent className="rounded-3xl bg-white text-slate-900 border shadow-2xl">
                                                <AlertDialogHeader>
                                                    <AlertDialogTitle className="font-bold">確定要刪除「{category.name}」嗎？</AlertDialogTitle>
                                                    <AlertDialogDescription className="font-medium text-slate-500">
                                                        此操作將刪除此拼卡分類及其配置資訊，但不會刪除原始卡片資產。
                                                    </AlertDialogDescription>
                                                </AlertDialogHeader>
                                                <AlertDialogFooter className="gap-2">
                                                    <AlertDialogCancel className="font-bold rounded-xl">取消</AlertDialogCancel>
                                                    <AlertDialogAction onClick={() => handleDeleteCategory(category)} className="bg-destructive text-white font-bold rounded-xl">確認刪除</AlertDialogAction>
                                                </AlertDialogFooter>
                                            </AlertDialogContent>
                                        </AlertDialog>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                {!isLoading && filteredCategories.length === 0 && (
                    <div className="text-center py-16 text-slate-400 font-medium italic">
                        {searchTerm ? '找不到符合關鍵字的分類。' : '目前尚無符合篩選條件的拼卡分類。'}
                    </div>
                )}
            </Card>

            {/* 新增分類 Dialog */}
            <Dialog open={isAddDialogOpen} onOpenChange={(val) => !isProcessing && setIsAddDialogOpen(val)}>
                <DialogContent className="sm:max-w-md bg-white shadow-2xl rounded-2xl p-6 sm:p-8 text-slate-900 border">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-xl">新增拼卡分類</DialogTitle>
                        <DialogDescription className="font-medium text-slate-500">輸入分類名稱並上傳封面圖片。</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="category-name" className="text-xs font-bold text-slate-500 uppercase tracking-widest">分類名稱</Label>
                            <Input 
                                id="category-name" 
                                value={categoryName}
                                onChange={e => setCategoryName(e.target.value)}
                                placeholder="例如：NBA 精選"
                                disabled={isProcessing}
                                className="h-11 border-slate-200 bg-white text-slate-900 font-bold"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="category-image" className="text-xs font-bold text-slate-500 uppercase tracking-widest">分類封面圖</Label>
                            <Input 
                                id="category-image" 
                                type="file" 
                                accept="image/*" 
                                onChange={handleFileChange} 
                                disabled={isProcessing} 
                                className="h-11 border-slate-200 bg-white text-slate-900 font-bold"
                            />
                        </div>
                        {previewUrl && (
                            <div className="relative aspect-[3/4] w-28 mx-auto rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                <SafeImage src={previewUrl} alt="預覽" fill className="object-cover" />
                            </div>
                        )}
                        {uploadProgress !== null && (
                            <div className="space-y-1">
                                <Progress value={uploadProgress} className="h-2" />
                                <p className="text-[10px] text-center text-slate-400 font-bold">{Math.round(uploadProgress)}%</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsAddDialogOpen(false)} disabled={isProcessing} className="font-bold rounded-xl">取消</Button>
                        <Button onClick={() => handleSaveCategory('add')} disabled={isProcessing || !categoryName.trim()} className="bg-slate-900 text-white font-bold h-11 px-6 rounded-xl">
                            {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4"/>}
                            建立分類
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 編輯分類 Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={(val) => !isProcessing && setIsEditDialogOpen(val)}>
                <DialogContent className="sm:max-w-md bg-white shadow-2xl rounded-2xl p-6 sm:p-8 text-slate-900 border">
                    <DialogHeader>
                        <DialogTitle className="font-bold text-xl">編輯拼卡分類</DialogTitle>
                        <DialogDescription className="font-medium text-slate-500">修改分類名稱或更換封面圖片。</DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-category-name" className="text-xs font-bold text-slate-500 uppercase tracking-widest">分類名稱</Label>
                            <Input 
                                id="edit-category-name" 
                                value={categoryName}
                                onChange={e => setCategoryName(e.target.value)}
                                disabled={isProcessing}
                                className="h-11 border-slate-200 bg-white text-slate-900 font-bold"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="edit-category-image" className="text-xs font-bold text-slate-500 uppercase tracking-widest">更換封面圖</Label>
                            <Input 
                                id="edit-category-image" 
                                type="file" 
                                accept="image/*" 
                                onChange={handleFileChange} 
                                disabled={isProcessing} 
                                className="h-11 border-slate-200 bg-white text-slate-900 font-bold"
                            />
                        </div>
                        {previewUrl && (
                            <div className="relative aspect-[3/4] w-28 mx-auto rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                <SafeImage src={previewUrl} alt="預覽" fill className="object-cover" />
                            </div>
                        )}
                        {uploadProgress !== null && (
                            <div className="space-y-1">
                                <Progress value={uploadProgress} className="h-2" />
                                <p className="text-[10px] text-center text-slate-400 font-bold">{Math.round(uploadProgress)}%</p>
                            </div>
                        )}
                    </div>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsEditDialogOpen(false)} disabled={isProcessing} className="font-bold rounded-xl">取消</Button>
                        <Button onClick={() => handleSaveCategory('edit')} disabled={isProcessing || !categoryName.trim()} className="bg-slate-900 text-white font-bold h-11 px-6 rounded-xl">
                            {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4"/>}
                            儲存變更
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
