'use client';

import { useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useStorage, useDoc } from '@/firebase';
import { collection, doc, updateDoc, arrayUnion, arrayRemove, setDoc, writeBatch, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  PlusCircle, Trash2, ArrowLeft, Check, Gem, Save, Search, 
  Archive, CheckCircle2, Loader2, Filter, RotateCcw, ArrowUpDown, 
  Tag, Swords, Layers, ShoppingBag, Eye, XCircle
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeImage } from '@/components/safe-image';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { userLevels } from '@/components/member-level-crown';
import { cn } from '@/lib/utils';

interface CardData {
    id: string;
    name: string;
    category: string;
    imageUrl: string;
    backImageUrl?: string;
    sellPrice?: number;
    source?: string;
    isSold?: boolean;
    minLevel?: string;
    dailyLimit?: number;
    createdAt?: any;
}

interface BettingCategory {
    id: string;
    name: string;
    imageUrl: string;
    order?: number;
}

interface BettingItems {
    allCardIds: string[];
    soldCardIds: string[];
}

const CATEGORIES = ["全部", "籃球", "棒球", "足球", "女孩卡", "女優", "TCG", "其他"];

export default function BettingCategoryDetailPage() {
  const router = useRouter();
  const params = useParams();
  const categoryName = params.categoryName as string;
  
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [selectedCards, setSelectedCards] = useState<string[]>([]);
  const [addCardCategoryFilter, setAddCardCategoryFilter] = useState('全部');
  const [addCardSearchTerm, setAddCardSearchTerm] = useState('');
  const [currentCategoryName, setCurrentCategoryName] = useState('');
  const [isSavingName, setIsSavingName] = useState(false);

  // 拼卡管理專屬分類與篩選狀態
  const [statusFilter, setStatusFilter] = useState<'all' | 'available' | 'sold'>('all');
  const [sportFilter, setSportFilter] = useState('全部');
  const [levelFilter, setLevelFilter] = useState('全部');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'default' | 'price-desc' | 'price-asc' | 'name-asc'>('default');

  const categoryDetailsRef = useMemoFirebase(() => {
      if (!firestore || !categoryName) return null;
      return doc(firestore, 'bettingCategories', decodeURIComponent(categoryName));
  }, [firestore, categoryName]);
  const { data: categoryDetails, isLoading: isLoadingCategoryDetails } = useDoc<BettingCategory>(categoryDetailsRef);

  const bettingItemsRef = useMemoFirebase(() => {
    if (!firestore || !categoryName) return null;
    return doc(firestore, 'betting-items', decodeURIComponent(categoryName));
  }, [firestore, categoryName]);
  const { data: bettingItems, isLoading: isLoadingBettingItems, setData: setBettingItems } = useDoc<BettingItems>(bettingItemsRef);

  const allCardsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'allCards');
  }, [firestore]);
  const { data: allCards, isLoading: isLoadingAllCards } = useCollection<CardData>(allCardsCollectionRef);

  // Global cross-area assignment check
  const { data: allCardPools } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));
  const { data: allBettingItems } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]));
  const { data: luckBags } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'luckBags') : null, [firestore]));

  const globallyAssignedCardIds = useMemo(() => {
    const ids = new Set<string>();
    allCardPools?.forEach(p => {
        p.cards?.forEach((c: any) => ids.add(c.cardId));
        if (p.lastPrizeCardId) ids.add(p.lastPrizeCardId);
    });
    allBettingItems?.forEach(item => {
        item.allCardIds?.forEach((id: string) => ids.add(id));
    });
    luckBags?.forEach(bag => {
        if (bag.prizes?.first) ids.add(bag.prizes.first);
        if (bag.prizes?.second) ids.add(bag.prizes.second);
        if (bag.prizes?.third) ids.add(bag.prizes.third);
        bag.otherPrizes?.forEach((p: any) => ids.add(p.cardId));
    });
    return ids;
  }, [allCardPools, allBettingItems, luckBags]);

  // 同步分類名稱
  useMemo(() => {
    if (categoryDetails && currentCategoryName === '') {
        setCurrentCategoryName(categoryDetails.name);
    }
  }, [categoryDetails, currentCategoryName]);

  const { rawCardsInBet, availableCardsToAdd, soldCardIds } = useMemo(() => {
    if (!allCards) {
        return { rawCardsInBet: [], availableCardsToAdd: [], soldCardIds: new Set<string>() };
    }
    const cardsInBetIds = new Set(bettingItems?.allCardIds || []);
    const soldIds = new Set(bettingItems?.soldCardIds || []);
    
    const rawCardsInBet = allCards.filter(c => cardsInBetIds.has(c.id));
    
    const available = allCards.filter(card => 
        !card.isSold &&
        !globallyAssignedCardIds.has(card.id) &&
        !cardsInBetIds.has(card.id) &&
        card.source !== 'group-break'
    );
    
    let filtered = available;
    if (addCardCategoryFilter !== '全部') {
      filtered = available.filter(card => card.category === addCardCategoryFilter);
    }
    if (addCardSearchTerm.trim()) {
      filtered = filtered.filter(card => card.name.toLowerCase().includes(addCardSearchTerm.toLowerCase()));
    }

    filtered.sort((a, b) => {
      const da = a.createdAt ? new Date(typeof a.createdAt === 'string' ? a.createdAt : a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(typeof b.createdAt === 'string' ? b.createdAt : b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt).getTime() : 0;
      if (da !== db) return db - da;
      return a.name.localeCompare(b.name);
    });
    
    return { rawCardsInBet, availableCardsToAdd: filtered, soldCardIds: soldIds };
  }, [allCards, bettingItems, globallyAssignedCardIds, addCardCategoryFilter, addCardSearchTerm]);

  // 統計數據：總數、未售出數、已售出數、總價值
  const stats = useMemo(() => {
    const total = rawCardsInBet.length;
    let soldCount = 0;
    let availableCount = 0;
    let totalDiamondValue = 0;

    rawCardsInBet.forEach(c => {
      const isSold = soldCardIds.has(c.id) || !!c.isSold;
      if (isSold) {
        soldCount++;
      } else {
        availableCount++;
      }
      totalDiamondValue += (c.sellPrice || 0);
    });

    const soldRate = total > 0 ? Math.round((soldCount / total) * 100) : 0;

    return { total, soldCount, availableCount, totalDiamondValue, soldRate };
  }, [rawCardsInBet, soldCardIds]);

  // 經過篩選後展示的拼卡列表
  const displayedCards = useMemo(() => {
    let result = [...rawCardsInBet];

    // 1. 已售出 / 未售出 分類篩選
    if (statusFilter === 'available') {
      result = result.filter(c => !soldCardIds.has(c.id) && !c.isSold);
    } else if (statusFilter === 'sold') {
      result = result.filter(c => soldCardIds.has(c.id) || !!c.isSold);
    }

    // 2. 運動項目篩選
    if (sportFilter !== '全部') {
      result = result.filter(c => c.category === sportFilter);
    }

    // 3. 階級門檻篩選
    if (levelFilter !== '全部') {
      result = result.filter(c => (c.minLevel || '新手收藏家') === levelFilter);
    }

    // 4. 關鍵字搜尋
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.id.toLowerCase().includes(q)
      );
    }

    // 5. 排序
    result.sort((a, b) => {
      if (sortBy === 'price-desc') {
        return (b.sellPrice || 0) - (a.sellPrice || 0);
      }
      if (sortBy === 'price-asc') {
        return (a.sellPrice || 0) - (b.sellPrice || 0);
      }
      if (sortBy === 'name-asc') {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return result;
  }, [rawCardsInBet, statusFilter, sportFilter, levelFilter, searchTerm, sortBy, soldCardIds]);

  const handleOpenAddCardDialog = () => {
    setSelectedCards([]);
    setAddCardCategoryFilter('全部');
    setAddCardSearchTerm('');
    setIsAddCardDialogOpen(true);
  };

  const handleConfirmAddCards = async () => {
    if (!firestore || !bettingItemsRef || selectedCards.length === 0) return;

    try {
        await updateDoc(bettingItemsRef, {
            allCardIds: arrayUnion(...selectedCards)
        });
        
        toast({ title: '成功', description: `已成功加入 ${selectedCards.length} 張卡片至拼卡清單。`});
        setIsAddCardDialogOpen(false);
        if (bettingItems && setBettingItems) {
            setBettingItems({
                ...bettingItems,
                allCardIds: [...(bettingItems.allCardIds || []), ...selectedCards]
            });
        }
    } catch (e) {
        console.error("Error adding cards to betting category:", e);
        if ((e as any).code === 'not-found') {
            await setDoc(bettingItemsRef, { allCardIds: selectedCards, soldCardIds: [] });
            toast({ title: '成功', description: `已成功加入 ${selectedCards.length} 張卡片至拼卡清單。`});
            setIsAddCardDialogOpen(false);
            if(setBettingItems) setBettingItems({ id: decodeURIComponent(categoryName), allCardIds: selectedCards, soldCardIds: [] });
        } else {
            toast({ variant: 'destructive', title: '錯誤', description: '加入卡片失敗。' });
        }
    }
  };
  
  const handleRemoveCard = async (cardId: string) => {
    if (!bettingItemsRef || !firestore) return;
    try {
        await updateDoc(bettingItemsRef, { 
          allCardIds: arrayRemove(cardId),
          soldCardIds: arrayRemove(cardId),
        });
        toast({ title: '成功', description: '卡片已從拼卡項目中移除。' });
        if (bettingItems && setBettingItems) {
            setBettingItems({
                ...bettingItems,
                allCardIds: (bettingItems.allCardIds || []).filter(id => id !== cardId),
                soldCardIds: (bettingItems.soldCardIds || []).filter(id => id !== cardId)
            });
        }
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: '錯誤', description: '移除卡片失敗。'});
    }
  };

  // 手動切換售出 / 未售出狀態
  const handleToggleSoldStatus = async (cardId: string, currentlySold: boolean, cardName: string) => {
    if (!firestore || !bettingItemsRef) return;
    try {
        const batch = writeBatch(firestore);
        if (currentlySold) {
            batch.update(bettingItemsRef, { soldCardIds: arrayRemove(cardId) });
            batch.update(doc(firestore, 'allCards', cardId), { isSold: false });
        } else {
            batch.update(bettingItemsRef, { soldCardIds: arrayUnion(cardId) });
            batch.update(doc(firestore, 'allCards', cardId), { isSold: true });
        }
        await batch.commit();

        toast({
            title: currentlySold ? '已恢復為「未售出 (販售中)」' : '已標記為「已售出」',
            description: `「${cardName}」的庫存售出狀態已成功更新。`,
        });

        if (bettingItems && setBettingItems) {
            const nextSold = currentlySold
                ? (bettingItems.soldCardIds || []).filter(id => id !== cardId)
                : [...(bettingItems.soldCardIds || []), cardId];
            setBettingItems({ ...bettingItems, soldCardIds: nextSold });
        }
    } catch (e: any) {
        toast({ variant: 'destructive', title: '狀態更新失敗', description: e.message });
    }
  };

  const handleValueChange = async (cardId: string, newPrice: number) => {
    if(!firestore) return;
    if (isNaN(newPrice) || newPrice < 0) {
        toast({ variant: 'destructive', title: '錯誤', description: '請輸入有效的價格。' });
        return;
    }
    try {
        const cardRef = doc(firestore, 'allCards', cardId);
        await updateDoc(cardRef, { sellPrice: newPrice });
        toast({ title: '成功', description: '卡片價值已更新。' });
    } catch(e) {
        console.error(e);
        toast({ variant: 'destructive', title: '錯誤', description: '更新卡片價值失敗。' });
    }
  };

  const handleMinLevelChange = async (cardId: string, cardName: string, newLevel: string) => {
    if (!firestore) return;
    try {
        const cardRef = doc(firestore, 'allCards', cardId);
        await updateDoc(cardRef, { minLevel: newLevel });
        toast({ title: '階級門檻已更新', description: `「${cardName}」拼卡門檻已設定為：${newLevel}` });
    } catch (e: any) {
        console.error(e);
        toast({ variant: 'destructive', title: '錯誤', description: '更新門檻失敗。' });
    }
  };

  const handleUpdateCategoryName = async () => {
    if (!firestore || !categoryDetails || !currentCategoryName || currentCategoryName === categoryDetails.name) {
        return;
    }

    setIsSavingName(true);
    const decodedOldId = decodeURIComponent(categoryName);
    const newCategoryId = currentCategoryName.toLowerCase().replace(/\s+/g, '-');
    
    try {
        if (newCategoryId === decodedOldId) {
            await updateDoc(doc(firestore, 'bettingCategories', decodedOldId), { name: currentCategoryName });
            toast({ title: '成功', description: '分類名稱已更新。' });
        } else {
            const batch = writeBatch(firestore);
            const newCategoryRef = doc(firestore, 'bettingCategories', newCategoryId);
            batch.set(newCategoryRef, { 
                ...categoryDetails, 
                id: newCategoryId, 
                name: currentCategoryName 
            });
            const oldItemsRef = doc(firestore, 'betting-items', decodedOldId);
            const itemsDoc = await getDoc(oldItemsRef);
            if (itemsDoc.exists()) {
                const newItemsRef = doc(firestore, 'betting-items', newCategoryId);
                batch.set(newItemsRef, itemsDoc.data());
                batch.delete(oldItemsRef);
            }
            batch.delete(doc(firestore, 'bettingCategories', decodedOldId));
            await batch.commit();
            toast({ title: '成功', description: `分類已重新命名為「${currentCategoryName}」。` });
            router.replace(`/admin/betting/${encodeURIComponent(newCategoryId)}`);
        }
    } catch (error) {
        console.error("Rename failed:", error);
        toast({ variant: 'destructive', title: '錯誤', description: '更名失敗。' });
    } finally {
        setIsSavingName(false);
    }
  };

  const resetAllFilters = () => {
    setStatusFilter('all');
    setSportFilter('全部');
    setLevelFilter('全部');
    setSearchTerm('');
    setSortBy('default');
  };

  const isFilterActive = statusFilter !== 'all' || sportFilter !== '全部' || levelFilter !== '全部' || searchTerm.trim() !== '' || sortBy !== 'default';
  const isLoading = isLoadingAllCards || isLoadingBettingItems || isLoadingCategoryDetails;

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8 space-y-6">
      {/* 頂部導航與標題 */}
      <div>
        <Button variant="ghost" onClick={() => router.push('/admin/betting')} className="mb-4 text-slate-700 font-bold hover:bg-slate-100">
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回拼卡專區分類
        </Button>

        {/* 頂部數據看板 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">配置總卡片</p>
              <p className="text-2xl sm:text-3xl font-black font-code text-slate-900 mt-0.5">{stats.total}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Swords className="w-5 h-5" />
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
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[11px] font-black uppercase tracking-wider text-emerald-600">未售出 (販售中)</p>
              </div>
              <p className="text-2xl sm:text-3xl font-black font-code text-emerald-600 mt-0.5">{stats.availableCount}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>

          <div 
            onClick={() => setStatusFilter('sold')} 
            className={cn(
              "p-4 rounded-2xl border transition-all cursor-pointer shadow-xs flex items-center justify-between",
              statusFilter === 'sold' 
                ? "bg-slate-900 text-white border-slate-900 ring-2 ring-slate-900/20" 
                : "bg-white border-slate-200/80 hover:border-slate-400"
            )}
          >
            <div>
              <p className={cn("text-[11px] font-black uppercase tracking-wider", statusFilter === 'sold' ? "text-slate-300" : "text-slate-500")}>
                已售出 (Sold)
              </p>
              <p className={cn("text-2xl sm:text-3xl font-black font-code mt-0.5", statusFilter === 'sold' ? "text-white" : "text-slate-700")}>
                {stats.soldCount}
              </p>
            </div>
            <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center font-bold", statusFilter === 'sold' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-700")}>
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400">總卡片估值 (💎)</p>
              <p className="text-2xl sm:text-3xl font-black font-code text-primary mt-0.5">{stats.totalDiamondValue.toLocaleString()}</p>
            </div>
            <div className="w-11 h-11 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold">
              <Gem className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* 分類主卡片 */}
        <UICard className="border-slate-200 bg-white shadow-sm overflow-hidden">
            <CardHeader className="border-b border-slate-100 pb-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                   <div className="flex-1 space-y-1">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">拼卡分類名稱</Label>
                        <div className="flex gap-2 max-w-md">
                            <Input 
                                className="text-xl sm:text-2xl font-headline font-bold h-11 sm:h-12 text-slate-900 bg-white border-slate-200"
                                value={currentCategoryName || ''}
                                onChange={(e) => setCurrentCategoryName(e.target.value)}
                                disabled={isSavingName}
                            />
                            <Button variant="outline" className="h-11 sm:h-12 border-slate-200" onClick={handleUpdateCategoryName} disabled={isSavingName || !currentCategoryName || currentCategoryName === categoryDetails?.name}>
                                {isSavingName ? <Loader2 className="animate-spin h-4 w-4"/> : <Save className="h-4 w-4" />}
                            </Button>
                        </div>
                   </div>
                   <div className="shrink-0 flex items-center gap-3">
                        <Button onClick={handleOpenAddCardDialog} className="h-11 sm:h-12 rounded-xl font-bold bg-slate-900 text-white hover:bg-slate-800 shadow-md">
                            <PlusCircle className="mr-2 h-4 w-4"/>從卡片總管配貨
                        </Button>
                   </div>
                </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-6 space-y-5">
                {/* 篩選與分類控制列 */}
                <div className="p-3.5 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3.5">
                    {/* 第一排：售出分類切換按鈕 (Tabs) */}
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex items-center gap-1.5 p-1 bg-white rounded-xl border border-slate-200 shadow-xs">
                            <button
                                type="button"
                                onClick={() => setStatusFilter('all')}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                                    statusFilter === 'all'
                                        ? "bg-slate-900 text-white shadow-xs"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                )}
                            >
                                <Layers className="w-3.5 h-3.5" />
                                <span>全部</span>
                                <Badge variant="secondary" className={cn("ml-0.5 text-[10px] px-1.5 py-0 h-4 font-code", statusFilter === 'all' ? "bg-slate-800 text-white" : "bg-slate-200 text-slate-700")}>
                                    {stats.total}
                                </Badge>
                            </button>

                            <button
                                type="button"
                                onClick={() => setStatusFilter('available')}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                                    statusFilter === 'available'
                                        ? "bg-emerald-600 text-white shadow-xs"
                                        : "text-slate-600 hover:text-emerald-700 hover:bg-emerald-50"
                                )}
                            >
                                <span className={cn("w-1.5 h-1.5 rounded-full", statusFilter === 'available' ? "bg-white" : "bg-emerald-500")} />
                                <span>未售出 (販售中)</span>
                                <Badge variant="secondary" className={cn("ml-0.5 text-[10px] px-1.5 py-0 h-4 font-code", statusFilter === 'available' ? "bg-emerald-700 text-white" : "bg-emerald-100 text-emerald-800")}>
                                    {stats.availableCount}
                                </Badge>
                            </button>

                            <button
                                type="button"
                                onClick={() => setStatusFilter('sold')}
                                className={cn(
                                    "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer",
                                    statusFilter === 'sold'
                                        ? "bg-slate-700 text-white shadow-xs"
                                        : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                                )}
                            >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>已售出</span>
                                <Badge variant="secondary" className={cn("ml-0.5 text-[10px] px-1.5 py-0 h-4 font-code", statusFilter === 'sold' ? "bg-slate-600 text-white" : "bg-slate-200 text-slate-700")}>
                                    {stats.soldCount}
                                </Badge>
                            </button>
                        </div>

                        {/* 重設篩選按鈕 */}
                        {isFilterActive && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={resetAllFilters} 
                                className="h-8 px-2.5 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold"
                            >
                                <RotateCcw className="w-3.5 h-3.5 mr-1" /> 重設所有篩選
                            </Button>
                        )}
                    </div>

                    {/* 第二排：關鍵字搜尋 + 運動類別 + 門檻階級 + 排序 */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                        {/* 搜尋 */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input 
                                placeholder="搜尋卡片名稱或 ID..." 
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 h-9 text-xs bg-white border-slate-200 rounded-xl"
                            />
                            {searchTerm && (
                                <button 
                                    onClick={() => setSearchTerm('')} 
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                >
                                    <XCircle className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>

                        {/* 運動類別篩選 */}
                        <Select value={sportFilter} onValueChange={setSportFilter}>
                            <SelectTrigger className="h-9 text-xs bg-white border-slate-200 rounded-xl font-bold text-slate-700">
                                <Tag className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                                <SelectValue placeholder="運動分類" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                {CATEGORIES.map(cat => (
                                    <SelectItem key={cat} value={cat} className="text-xs font-medium">
                                        {cat === '全部' ? '全部分類' : cat}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* 門檻等級篩選 */}
                        <Select value={levelFilter} onValueChange={setLevelFilter}>
                            <SelectTrigger className="h-9 text-xs bg-white border-slate-200 rounded-xl font-bold text-slate-700">
                                <SelectValue placeholder="門檻階級" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="全部" className="text-xs font-medium">全部階級門檻</SelectItem>
                                <SelectItem value="新手收藏家" className="text-xs font-medium">新手收藏家 (無門檻)</SelectItem>
                                {userLevels.filter(l => l.level !== '新手收藏家').map(l => (
                                    <SelectItem key={l.level} value={l.level} className="text-xs font-medium">
                                        {l.level} 以上
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>

                        {/* 排序 */}
                        <Select value={sortBy} onValueChange={(val: any) => setSortBy(val)}>
                            <SelectTrigger className="h-9 text-xs bg-white border-slate-200 rounded-xl font-bold text-slate-700">
                                <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-slate-400 shrink-0" />
                                <SelectValue placeholder="排序方式" />
                            </SelectTrigger>
                            <SelectContent className="rounded-xl">
                                <SelectItem value="default" className="text-xs font-medium">預設排序</SelectItem>
                                <SelectItem value="price-desc" className="text-xs font-medium">卡片價值 (高到低)</SelectItem>
                                <SelectItem value="price-asc" className="text-xs font-medium">卡片價值 (低到高)</SelectItem>
                                <SelectItem value="name-asc" className="text-xs font-medium">卡片名稱 (A-Z)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                {/* 卡片表格 */}
                <div className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-xs">
                    <Table>
                        <TableHeader className="bg-slate-100/80">
                            <TableRow>
                            <TableHead className="w-16 pl-6 text-slate-900 font-black uppercase text-[10px]">卡圖</TableHead>
                            <TableHead className="text-slate-900 font-black uppercase text-[10px]">卡片名稱</TableHead>
                            <TableHead className="w-24 text-slate-900 font-black uppercase text-[10px]">運動分類</TableHead>
                            <TableHead className="w-32 text-slate-900 font-black uppercase text-[10px]">售出狀態</TableHead>
                            <TableHead className="w-44 text-slate-900 font-black uppercase text-[10px]">拼卡階級門檻</TableHead>
                            <TableHead className="w-36 text-slate-900 font-black uppercase text-[10px]">卡片價值 (💎)</TableHead>
                            <TableHead className="w-32 text-right pr-6 text-slate-900 font-black uppercase text-[10px]">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading && Array.from({length: 3}).map((_, i) => (
                                <TableRow key={i}>
                                    <TableCell colSpan={7} className="p-6"><Skeleton className="h-12 w-full rounded-xl" /></TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && displayedCards.map(card => {
                                const isSold = soldCardIds.has(card.id) || !!card.isSold;
                                return (
                                <TableRow key={card.id} className={cn("hover:bg-slate-50/80 transition-colors border-b", isSold && "bg-slate-50/40")}>
                                    <TableCell className="pl-6 py-3.5">
                                        <div className="relative h-14 w-11 rounded-lg overflow-hidden border border-slate-200 shadow-xs bg-slate-100">
                                            <SafeImage src={card.imageUrl} alt={card.name} fill className={cn("object-cover", isSold && "grayscale brightness-75")} />
                                        </div>
                                    </TableCell>
                                    <TableCell className="font-bold text-slate-900">
                                        <div className="space-y-0.5">
                                            <p className={cn("font-bold text-sm", isSold && "text-slate-500 line-through decoration-slate-300")}>{card.name}</p>
                                            <p className="text-[10px] font-mono text-slate-400">ID: {card.id.substring(0, 8)}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="secondary" className="bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                                            {card.category || '未分類'}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            {isSold ? (
                                                <Badge variant="secondary" className="bg-slate-200 text-slate-700 text-[10px] font-black uppercase px-2 py-0.5">
                                                    已售出
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-300 text-[10px] font-black uppercase px-2 py-0.5 shadow-xs">
                                                    ● 未售出
                                                </Badge>
                                            )}
                                            
                                            {/* 快捷切換按鈕 */}
                                            <button
                                                type="button"
                                                onClick={() => handleToggleSoldStatus(card.id, isSold, card.name)}
                                                className="text-[10px] text-slate-400 hover:text-slate-700 underline ml-1 cursor-pointer"
                                                title={isSold ? "恢復為未售出" : "標記為已售出"}
                                            >
                                                {isSold ? "改為未售" : "標記已售"}
                                            </button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Select 
                                            defaultValue={card.minLevel || '新手收藏家'} 
                                            onValueChange={(val) => handleMinLevelChange(card.id, card.name, val)}
                                        >
                                            <SelectTrigger className="h-8 border-slate-200 bg-white text-slate-900 font-bold text-xs rounded-lg">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="rounded-xl bg-white shadow-xl">
                                                <SelectItem value="新手收藏家" className="font-bold text-xs">新手收藏家 (不限)</SelectItem>
                                                {userLevels.filter(l => l.level !== '新手收藏家').map(l => (
                                                    <SelectItem key={l.level} value={l.level} className="font-bold text-xs">
                                                        {l.level} 以上
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                    <TableCell>
                                        <div className="relative">
                                             <Gem className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary opacity-50" />
                                             <Input 
                                                 type="number" 
                                                 defaultValue={card.sellPrice} 
                                                 className="pl-8 h-8 bg-white border-slate-200 rounded-lg font-code font-bold text-xs text-slate-900"
                                                 onBlur={(e) => handleValueChange(card.id, Number(e.target.value))}
                                             />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex items-center justify-end gap-1">
                                            <AlertDialog>
                                                <AlertDialogTrigger asChild>
                                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-destructive transition-colors">
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
                                                </AlertDialogTrigger>
                                                <AlertDialogContent className="rounded-3xl bg-white text-slate-900 border shadow-2xl">
                                                    <AlertDialogHeader>
                                                        <AlertDialogTitle className="font-bold">從此拼卡分類移除</AlertDialogTitle>
                                                        <AlertDialogDescription className="font-medium text-slate-500">
                                                            確定要從本拼卡項目中移除「{card.name}」嗎？此操作僅將卡片從此拼卡分類撤下，不會刪除原始卡片資產。
                                                        </AlertDialogDescription>
                                                    </AlertDialogHeader>
                                                    <AlertDialogFooter className="gap-2">
                                                        <AlertDialogCancel className="font-bold rounded-xl">取消</AlertDialogCancel>
                                                        <AlertDialogAction onClick={() => handleRemoveCard(card.id)} className="bg-destructive text-white font-bold rounded-xl">
                                                            確定移除
                                                        </AlertDialogAction>
                                                    </AlertDialogFooter>
                                                </AlertDialogContent>
                                            </AlertDialog>
                                        </div>
                                    </TableCell>
                                </TableRow>
                                );
                            })}
                            {!isLoading && displayedCards.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={7} className="h-36 text-center text-muted-foreground">
                                        <div className="space-y-2">
                                            <Archive className="h-8 w-8 mx-auto opacity-30 text-slate-400" />
                                            <p className="text-sm font-bold text-slate-600">
                                                {isFilterActive ? '沒有符合目前篩選條件的卡片' : '尚未加入任何拼卡卡片'}
                                            </p>
                                            {isFilterActive && (
                                                <Button size="sm" variant="outline" onClick={resetAllFilters} className="text-xs rounded-xl font-bold">
                                                    清空篩選條件
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </UICard>
      </div>
      
      {/* 從卡片總管配貨彈窗 */}
      <Dialog open={isAddCardDialogOpen} onOpenChange={setIsAddCardDialogOpen}>
        <DialogContent className="max-w-4xl h-[85vh] flex flex-col p-6 sm:p-8 rounded-[2rem] bg-white text-slate-900 border shadow-2xl">
            <DialogHeader>
                <DialogTitle className="text-2xl font-black font-headline tracking-tighter italic text-primary uppercase">
                    從卡片總管配貨至拼卡清單
                </DialogTitle>
                <DialogDescription className="font-medium text-slate-500">
                    勾選欲配置於此拼卡分類的未售出卡片。系統已自動排除其他卡池、福袋及已售出的資產。
                </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col sm:flex-row gap-3 py-3">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input 
                        placeholder="搜尋在庫卡片名稱..." 
                        value={addCardSearchTerm} 
                        onChange={(e) => setAddCardSearchTerm(e.target.value)} 
                        className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200 text-xs"
                    />
                </div>
                <Select value={addCardCategoryFilter} onValueChange={setAddCardCategoryFilter}>
                    <SelectTrigger className="w-full sm:w-[160px] h-10 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs">
                        <SelectValue placeholder="分類" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                        {CATEGORIES.map(cat => (
                            <SelectItem key={cat} value={cat} className="text-xs font-medium">{cat}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <ScrollArea className="flex-1 pr-3 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {availableCardsToAdd.map(card => {
                        const isSelected = selectedCards.includes(card.id);
                        return (
                            <div 
                                key={card.id}
                                onClick={() => {
                                    if (isSelected) {
                                        setSelectedCards(selectedCards.filter(id => id !== card.id));
                                    } else {
                                        setSelectedCards([...selectedCards, card.id]);
                                    }
                                }}
                                className={cn(
                                    "p-2.5 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between group bg-white",
                                    isSelected 
                                        ? "border-primary bg-primary/5 shadow-md shadow-primary/10" 
                                        : "border-slate-200 hover:border-slate-300 hover:shadow-xs"
                                )}
                            >
                                <div className="space-y-2">
                                    <div className="aspect-[2.5/3.5] relative rounded-xl overflow-hidden bg-slate-100 border border-slate-100">
                                        <SafeImage src={card.imageUrl} alt={card.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                                        {isSelected && (
                                            <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center">
                                                <div className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
                                                    <Check className="h-5 w-5 stroke-[3]" />
                                                </div>
                                            </div>
                                        )}
                                        <div className="absolute top-1.5 left-1.5">
                                            <Badge className="bg-emerald-600 text-white text-[9px] px-1.5 py-0 font-bold">
                                                未售出
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-xs font-black text-slate-800 line-clamp-1 group-hover:text-primary transition-colors">{card.name}</p>
                                        <p className="text-[10px] text-slate-400 font-mono">{card.category || '未分類'}</p>
                                    </div>
                                </div>
                                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] font-bold">
                                    <span className="text-slate-400">價值</span>
                                    <span className="text-primary font-code font-black flex items-center gap-0.5">
                                        <Gem className="w-3 h-3 text-primary" /> {card.sellPrice || 0}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                    {availableCardsToAdd.length === 0 && (
                        <div className="col-span-full py-16 text-center text-muted-foreground">
                            <Archive className="h-10 w-10 mx-auto mb-2 opacity-20" />
                            <p className="font-bold text-sm text-slate-600">無可配置的在庫未售出卡片</p>
                            <p className="text-xs text-slate-400 mt-1">請先至「卡片總管」上傳新卡片或切換至其他分類搜尋。</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <p className="text-xs font-bold text-slate-600">
                    已選取 <span className="text-primary font-black font-code text-base">{selectedCards.length}</span> 張卡片
                </p>
                <div className="flex gap-2">
                    <Button variant="ghost" onClick={() => setIsAddCardDialogOpen(false)} className="rounded-xl font-bold">
                        取消
                    </Button>
                    <Button onClick={handleConfirmAddCards} disabled={selectedCards.length === 0} className="rounded-xl font-bold bg-primary text-white">
                        確認加入拼卡清單 ({selectedCards.length})
                    </Button>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
