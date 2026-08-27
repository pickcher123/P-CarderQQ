'use client';

import { useState, useMemo, ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useCollection, useFirestore, useMemoFirebase, useAuth, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL, deleteObject } from 'firebase/storage';
import { collection, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import { format, isToday, isYesterday, subDays, isAfter, startOfDay } from 'date-fns';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { 
  PlusCircle, Edit, Trash2, ArrowLeft, Search, Loader2, 
  UploadCloud, Files, X, Archive, Ban, Calendar, CalendarDays, 
  Clock, ArrowUpDown, Sparkles, LayoutList, LayoutGrid, RotateCcw, Filter
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeImage } from '@/components/safe-image';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { userLevels } from '@/components/member-level-crown';

export interface CardData {
    id?: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
    category: string;
    sellPrice?: number;
    source?: string;
    isSold?: boolean;
    isRecycled?: boolean;
    dailyLimit?: number;
    minLevel?: string;
    createdAt?: any;
}

export function parseCardDate(createdAt: any): Date | null {
    if (!createdAt) return null;
    if (typeof createdAt === 'string') {
        const d = new Date(createdAt);
        return isNaN(d.getTime()) ? null : d;
    }
    if (typeof createdAt?.toDate === 'function') {
        return createdAt.toDate();
    }
    if (typeof createdAt?.seconds === 'number') {
        return new Date(createdAt.seconds * 1000);
    }
    if (createdAt instanceof Date && !isNaN(createdAt.getTime())) {
        return createdAt;
    }
    return null;
}

export function formatCardDateBadge(createdAt: any) {
    const d = parseCardDate(createdAt);
    if (!d) return { label: '歷史舊卡', isNew: false, isYesterday: false, dateStr: '未記錄', timeStr: '' };
    
    const dateStr = format(d, 'yyyy-MM-dd');
    const timeStr = format(d, 'HH:mm');
    
    if (isToday(d)) {
        return { label: `今日 ${timeStr}`, isNew: true, isYesterday: false, dateStr, timeStr };
    }
    if (isYesterday(d)) {
        return { label: `昨日 ${timeStr}`, isNew: false, isYesterday: true, dateStr, timeStr };
    }
    return { label: format(d, 'yyyy-MM-dd HH:mm'), isNew: false, isYesterday: false, dateStr, timeStr };
}

const SPORT_CATEGORIES = ["全部", "籃球", "棒球", "足球", "女孩卡", "女優", "TCG", "其他"];

const AREA_NAMES: Record<string, string> = {
    'draw': '抽卡區域',
    'betting': '拼卡區域',
    'lucky-bag': '福袋區域',
    'group-break': '團拆區域',
    'all': '全部卡片',
};

function BulkUploadDialog({ area, onComplete }: { area: string, onComplete: (count: number) => void }) {
    const firestore = useFirestore();
    const storage = useStorage();
    const { toast } = useToast();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [currentFileIndex, setCurrentFileIndex] = useState(0);

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const filesArray = Array.from(e.target.files);
            setSelectedFiles(prev => [...prev, ...filesArray]);
        }
    };

    const removeFile = (index: number) => {
        setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    };

    const startBulkUpload = async () => {
        if (!firestore || !storage || selectedFiles.length === 0) return;
        setIsUploading(true);
        setUploadProgress(0);
        let successCount = 0;
        const uploadTimestamp = new Date().toISOString();

        for (let i = 0; i < selectedFiles.length; i++) {
            setCurrentFileIndex(i + 1);
            const file = selectedFiles[i];
            try {
                const fileExtension = file.name.split('.').pop();
                const fileName = `P-Carder/cards/bulk-${uuidv4()}.${fileExtension}`;
                const storageRef = ref(storage, fileName);
                const uploadTask = uploadBytesResumable(storageRef, file);
                const imageUrl = await new Promise<string>((resolve, reject) => {
                    uploadTask.on('state_changed', null, reject, () => {
                        getDownloadURL(uploadTask.snapshot.ref).then(resolve);
                    });
                });
                const cardName = file.name.replace(/\.[^/.]+$/, "");
                const cardData: any = { 
                    name: cardName, 
                    imageUrl, 
                    category: '其他', 
                    sellPrice: 10, 
                    isSold: area === 'group-break',
                    createdAt: uploadTimestamp
                };
                if (area === 'group-break') cardData.source = 'group-break';
                await addDoc(collection(firestore, 'allCards'), cardData);
                successCount++;
                setUploadProgress(((i + 1) / selectedFiles.length) * 100);
            } catch (error) { console.error(`Failed to upload ${file.name}:`, error); }
        }
        toast({ title: "批量上傳完成", description: `成功上傳 ${successCount} 張卡片！上傳日期已自動登記為今日。` });
        setIsUploading(false);
        setSelectedFiles([]);
        setIsOpen(false);
        onComplete(successCount);
    };

    return (
        <>
            <Button variant="outline" onClick={() => setIsOpen(true)} className="h-10 border-slate-200 bg-white font-bold text-slate-700 hover:bg-slate-50">
                <UploadCloud className="mr-2 h-4 w-4" /> 批量上傳
            </Button>
            <Dialog open={isOpen} onOpenChange={(val) => !isUploading && setIsOpen(val)}>
                <DialogContent className="light sm:max-w-xl bg-white text-slate-900 border-none shadow-2xl rounded-3xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 font-black text-xl">
                            <Files className="h-5 w-5 text-slate-400" /> 批量卡片上傳協議
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-6 py-4">
                        {!isUploading ? (
                            <div className="space-y-4">
                                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-10 text-center hover:bg-slate-50 transition-all relative group cursor-pointer">
                                    <input type="file" multiple accept="image/*" onChange={handleFileChange} className="absolute inset-0 opacity-0 cursor-pointer" />
                                    <UploadCloud className="h-12 w-12 text-slate-300 mx-auto mb-4 group-hover:scale-110 transition-transform" />
                                    <p className="text-sm font-black text-slate-600">點擊或拖放圖片至此區域</p>
                                    <p className="text-[10px] text-slate-400 mt-1 uppercase font-bold tracking-widest">Supported: JPG, PNG, WEBP</p>
                                </div>
                                <div className="p-3 bg-emerald-50 border border-emerald-200/60 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-bold">
                                    <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                                    <span>系統將自動為此批上傳卡片附加今日日期標籤，方便後續篩選分類。</span>
                                </div>
                                {selectedFiles.length > 0 && (
                                    <ScrollArea className="h-40 border rounded-2xl bg-slate-50 p-3 shadow-inner">
                                        <div className="space-y-1.5">
                                            {selectedFiles.map((file, idx) => (
                                                <div key={idx} className="flex items-center justify-between p-2.5 rounded-xl bg-white border border-slate-100 text-xs shadow-sm">
                                                    <span className="truncate flex-1 mr-4 font-bold text-slate-700">{file.name}</span>
                                                    <button onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-500 transition-colors"><X className="h-4 w-4" /></button>
                                                </div>
                                            ))}
                                        </div>
                                    </ScrollArea>
                                )}
                            </div>
                        ) : (
                            <div className="py-10 text-center space-y-6">
                                <Loader2 className="h-12 w-12 animate-spin text-slate-900 mx-auto" />
                                <div className="space-y-2">
                                    <p className="font-black text-slate-900">正在處理第 {currentFileIndex} 張 / 共 {selectedFiles.length} 張</p>
                                    <Progress value={uploadProgress} className="h-2 w-64 mx-auto bg-slate-100" indicatorClassName="bg-slate-900" />
                                </div>
                            </div>
                        )}
                    </div>
                    <DialogFooter className="gap-3">
                        <Button variant="ghost" onClick={() => setIsOpen(false)} disabled={isUploading} className="font-bold">取消操作</Button>
                        <Button onClick={startBulkUpload} disabled={isUploading || selectedFiles.length === 0} className="px-10 font-black bg-slate-900 text-white rounded-xl shadow-xl hover:bg-slate-800">
                            {isUploading ? "系統上傳中..." : "確認開始上傳"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}

export default function CardAreaManagementPage() {
  const params = useParams();
  const area = params.area as string;
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [isCardDialogOpen, setIsCardDialogOpen] = useState(false);
  const [currentCard, setCurrentCard] = useState<Partial<CardData>>({ 
    name: '', 
    category: '其他', 
    sellPrice: 10, 
    isSold: false, 
    dailyLimit: 0, 
    minLevel: '新手收藏家' 
  });
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedBackFile, setSelectedBackFile] = useState<File | null>(null);
  const [backPreviewUrl, setBackPreviewUrl] = useState<string | null>(null);
  const [backUploadProgress, setBackUploadProgress] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sportFilter, setSportFilter] = useState('全部');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortBy, setSortBy] = useState('date-desc');
  const [isGroupedByDate, setIsGroupedByDate] = useState(false);
  const [activeTab, setActiveTab] = useState('active');

  const { data: allCards, isLoading: isLoadingCards, forceRefetch } = useCollection<CardData>(useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]));
  const { data: cardPools } = useCollection<{cards?: {cardId: string}[]}>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));
  const { data: bettingItems } = useCollection<{allCardIds: string[]}>(useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]));
  const { data: luckBags } = useCollection<{prizes?: any, otherPrizes?: {cardId: string}[]}>(useMemoFirebase(() => firestore ? collection(firestore, 'luckBags') : null, [firestore]));

  const cardAssignmentMap = useMemo(() => {
    const map = new Map<string, { type: string, name: string }>();
    
    cardPools?.forEach((p: any) => {
        p.cards?.forEach((c: any) => map.set(c.cardId, { type: 'cardPool', name: p.name || '卡池' }));
        if (p.lastPrizeCardId) map.set(p.lastPrizeCardId, { type: 'cardPool', name: (p.name || '卡池') + ' (最後賞)' });
    });

    bettingItems?.forEach((item: any) => {
        item.allCardIds?.forEach((id: string) => map.set(id, { type: 'betting', name: item.id || '競猜' }));
    });

    luckBags?.forEach((bag: any) => {
        if (bag.prizes?.first) map.set(bag.prizes.first, { type: 'luckyBag', name: bag.name || '福袋' });
        if (bag.prizes?.second) map.set(bag.prizes.second, { type: 'luckyBag', name: bag.name || '福袋' });
        if (bag.prizes?.third) map.set(bag.prizes.third, { type: 'luckyBag', name: bag.name || '福袋' });
        bag.otherPrizes?.forEach((p: any) => {
            if (p.cardId) map.set(p.cardId, { type: 'luckyBag', name: bag.name || '福袋' });
        });
    });

    return map;
  }, [cardPools, bettingItems, luckBags]);

  // Date statistics for quick filters
  const dateStats = useMemo(() => {
    if (!allCards) return { today: 0, yesterday: 0, last7Days: 0, unrecorded: 0, dateGroups: [] as { date: string, count: number }[] };
    
    let today = 0;
    let yesterday = 0;
    let last7Days = 0;
    let unrecorded = 0;
    const dateMap = new Map<string, number>();

    const sevenDaysAgo = subDays(startOfDay(new Date()), 6);

    allCards.forEach(c => {
        const d = parseCardDate(c.createdAt);
        if (!d) {
            unrecorded++;
        } else {
            const dateStr = format(d, 'yyyy-MM-dd');
            dateMap.set(dateStr, (dateMap.get(dateStr) || 0) + 1);

            if (isToday(d)) today++;
            if (isYesterday(d)) yesterday++;
            if (isAfter(d, sevenDaysAgo)) last7Days++;
        }
    });

    const dateGroups = Array.from(dateMap.entries())
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => b.date.localeCompare(a.date));

    return { today, yesterday, last7Days, unrecorded, dateGroups };
  }, [allCards]);

  const filteredCards = useMemo(() => {
    if (!allCards) return [];
    let cards = [...allCards];
    const allCardIdSet = new Set(allCards.map(c => c.id));

    if (area === 'draw') {
        const ids = new Set<string>();
        cardPools?.forEach(p => p.cards?.forEach(c => {
            if (allCardIdSet.has(c.cardId)) ids.add(c.cardId);
        }));
        cards = cards.filter(c => ids.has(c.id!));
    } else if (area === 'betting') {
        const ids = new Set<string>();
        bettingItems?.forEach(i => i.allCardIds?.forEach(id => {
            if (allCardIdSet.has(id)) ids.add(id);
        }));
        cards = cards.filter(c => ids.has(c.id!));
    } else if (area === 'lucky-bag') {
        const ids = new Set<string>();
        luckBags?.forEach(b => {
            if(b.prizes?.first && allCardIdSet.has(b.prizes.first)) ids.add(b.prizes.first);
            if(b.prizes?.second && allCardIdSet.has(b.prizes.second)) ids.add(b.prizes.second);
            if(b.prizes?.third && allCardIdSet.has(b.prizes.third)) ids.add(b.prizes.third);
            b.otherPrizes?.forEach(p => {
                if (allCardIdSet.has(p.cardId)) ids.add(p.cardId);
            });
        });
        cards = cards.filter(c => ids.has(c.id!));
    } else if (area === 'group-break') {
        cards = cards.filter(c => c.source === 'group-break');
    }
    
    // Status tab filter
    if (activeTab === 'active') {
        cards = cards.filter(c => !c.isSold);
    } else if (activeTab === 'recycled') {
        cards = cards.filter(c => c.isRecycled);
    } else {
        cards = cards.filter(c => c.isSold && !c.isRecycled);
    }

    // Search keyword
    if (searchTerm.trim()) cards = cards.filter(c => c.name.toLowerCase().includes(searchTerm.toLowerCase()));
    
    // Category filter
    if (sportFilter !== '全部') cards = cards.filter(c => c.category === sportFilter);
    
    // Date filter
    if (dateFilter === 'today') {
        cards = cards.filter(c => {
            const d = parseCardDate(c.createdAt);
            return d ? isToday(d) : false;
        });
    } else if (dateFilter === 'yesterday') {
        cards = cards.filter(c => {
            const d = parseCardDate(c.createdAt);
            return d ? isYesterday(d) : false;
        });
    } else if (dateFilter === '7days') {
        const sevenDaysAgo = subDays(startOfDay(new Date()), 6);
        cards = cards.filter(c => {
            const d = parseCardDate(c.createdAt);
            return d ? isAfter(d, sevenDaysAgo) : false;
        });
    } else if (dateFilter === '30days') {
        const thirtyDaysAgo = subDays(startOfDay(new Date()), 29);
        cards = cards.filter(c => {
            const d = parseCardDate(c.createdAt);
            return d ? isAfter(d, thirtyDaysAgo) : false;
        });
    } else if (dateFilter === 'unrecorded') {
        cards = cards.filter(c => !parseCardDate(c.createdAt));
    } else if (dateFilter !== 'all') {
        // Specific date like '2026-08-27'
        cards = cards.filter(c => {
            const d = parseCardDate(c.createdAt);
            return d ? format(d, 'yyyy-MM-dd') === dateFilter : false;
        });
    }
    
    // Sorting
    return cards.sort((a, b) => {
        if (sortBy === 'date-desc') {
            const da = parseCardDate(a.createdAt)?.getTime() || 0;
            const db = parseCardDate(b.createdAt)?.getTime() || 0;
            if (da !== db) return db - da; // Newest first
            return a.name.localeCompare(b.name);
        }
        if (sortBy === 'date-asc') {
            const da = parseCardDate(a.createdAt)?.getTime() || Infinity;
            const db = parseCardDate(b.createdAt)?.getTime() || Infinity;
            if (da !== db) return da - db; // Oldest first
            return a.name.localeCompare(b.name);
        }
        if (sortBy === 'name-asc') {
            return a.name.localeCompare(b.name);
        }
        if (sortBy === 'price-desc') {
            return (b.sellPrice || 0) - (a.sellPrice || 0);
        }
        if (sortBy === 'price-asc') {
            return (a.sellPrice || 0) - (b.sellPrice || 0);
        }
        return 0;
    });
  }, [allCards, area, cardPools, bettingItems, luckBags, searchTerm, sportFilter, dateFilter, sortBy, activeTab]);

  // Grouped cards when date grouping mode is enabled
  const groupedCards = useMemo(() => {
    if (!isGroupedByDate) return [];
    
    const groupsMap = new Map<string, { title: string, date: string, isToday: boolean, isYesterday: boolean, cards: CardData[] }>();
    
    filteredCards.forEach(card => {
        const d = parseCardDate(card.createdAt);
        let key = 'unrecorded';
        let title = '📦 歷史舊卡 / 未記錄日期';
        let date = '9999-99-99';
        let isTodayDate = false;
        let isYesterdayDate = false;

        if (d) {
            date = format(d, 'yyyy-MM-dd');
            key = date;
            if (isToday(d)) {
                title = `✨ 今日上傳 (${date})`;
                isTodayDate = true;
            } else if (isYesterday(d)) {
                title = `⏳ 昨日上傳 (${date})`;
                isYesterdayDate = true;
            } else {
                title = `📅 ${date}`;
            }
        }

        if (!groupsMap.has(key)) {
            groupsMap.set(key, { title, date, isToday: isTodayDate, isYesterday: isYesterdayDate, cards: [] });
        }
        groupsMap.get(key)!.cards.push(card);
    });

    return Array.from(groupsMap.values()).sort((a, b) => {
        if (a.date === '9999-99-99') return 1;
        if (b.date === '9999-99-99') return -1;
        return b.date.localeCompare(a.date);
    });
  }, [filteredCards, isGroupedByDate]);

  const handleSaveCard = async () => {
    if (!firestore || !currentCard.name || !storage) return;
    try {
        let imageUrl = currentCard.imageUrl || '';
        let backImageUrl = currentCard.backImageUrl || '';
        if (selectedFile) {
            const storageRef = ref(storage, `P-Carder/cards/${uuidv4()}`);
            const uploadTask = uploadBytesResumable(storageRef, selectedFile);
            imageUrl = await new Promise((resolve, reject) => {
                uploadTask.on('state_changed', (s) => setUploadProgress((s.bytesTransferred / s.totalBytes) * 100), reject, () => getDownloadURL(uploadTask.snapshot.ref).then(resolve));
            });
        }
        if (selectedBackFile) {
            const backStorageRef = ref(storage, `P-Carder/cards/${uuidv4()}-back`);
            const backUploadTask = uploadBytesResumable(backStorageRef, selectedBackFile);
            backImageUrl = await new Promise((resolve, reject) => {
                backUploadTask.on('state_changed', (s) => setBackUploadProgress((s.bytesTransferred / s.totalBytes) * 100), reject, () => getDownloadURL(backUploadTask.snapshot.ref).then(resolve));
            });
        }
        
        const nowIso = new Date().toISOString();
        const cardData: any = { 
            name: currentCard.name, 
            category: currentCard.category, 
            sellPrice: currentCard.sellPrice || 0, 
            imageUrl, 
            backImageUrl, 
            isSold: currentCard.isSold || false, 
            isRecycled: currentCard.isRecycled || false,
            dailyLimit: Number(currentCard.dailyLimit || 0), 
            minLevel: currentCard.minLevel || '新手收藏家',
            createdAt: currentCard.createdAt || nowIso
        };
        
        if (!isEditMode && area === 'group-break') { cardData.source = 'group-break'; cardData.isSold = true; }
        
        if (isEditMode && currentCard.id) {
            await updateDoc(doc(firestore, 'allCards', currentCard.id), cardData);
            toast({ title: "卡片已更新", description: `「${currentCard.name}」已儲存。` });
        } else {
            cardData.createdAt = nowIso;
            await addDoc(collection(firestore, 'allCards'), cardData);
            toast({ title: "卡片已建立", description: `新卡片「${currentCard.name}」已上傳至系統。` });
        }

        setIsCardDialogOpen(false); 
        setUploadProgress(null); 
        setBackUploadProgress(null); 
        setSelectedFile(null); 
        setSelectedBackFile(null);
    } catch (e) { 
        console.error(e);
        toast({ variant: "destructive", title: "儲存失敗", description: "請檢查網絡連線或圖片上傳。" }); 
    }
  };

  const handleToggleSold = async (card: CardData) => {
    if (!firestore || !card.id) return;
    try { 
        const newSold = !card.isSold;
        const updateData: any = { isSold: newSold };
        if (!newSold) updateData.isRecycled = false;
        await updateDoc(doc(firestore, 'allCards', card.id), updateData); 
        toast({ title: '狀態已更新' }); 
    } catch (e) { console.error(e); toast({ variant: 'destructive' }); }
  };

  const handleDeleteCard = async (card: CardData) => {
    if (!firestore || !card.id || !storage) return;
    
    if (cardAssignmentMap.has(card.id)) {
        toast({ 
            variant: "destructive", 
            title: "無法刪除", 
            description: `此卡片目前已分配至「${cardAssignmentMap.get(card.id)?.name}」，請先從該處移除後再行刪除。` 
        });
        return;
    }

    try {
        if (card.imageUrl && card.imageUrl.includes('firebasestorage.googleapis.com')) {
            try { await deleteObject(ref(storage, card.imageUrl)); } catch (err) { console.error(err); }
        }
        await deleteDoc(doc(firestore, 'allCards', card.id));
        toast({ title: "已刪除卡片" });
    } catch (e) { toast({ variant: "destructive" }); }
  };

  return (
    <div className="space-y-8 text-slate-900">
        {/* Header section */}
        <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
            <div>
                <button onClick={() => router.push('/admin/cards')} className="flex items-center gap-2 mb-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-black uppercase tracking-widest">
                    <ArrowLeft className="h-4 w-4" /> 返回區域選擇
                </button>
                <div className="flex items-center gap-3">
                    <h1 className="text-3xl font-black tracking-tight">
                        {AREA_NAMES[area] || '區域管理'}
                    </h1>
                    <Badge className="bg-slate-900 text-white font-code px-3 text-xs">{filteredCards.length} ITEMS</Badge>
                </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
                <BulkUploadDialog 
                    area={area} 
                    onComplete={() => {
                        setDateFilter('today');
                        setSortBy('date-desc');
                        if (forceRefetch) forceRefetch();
                    }} 
                />
                <Button 
                    onClick={() => { 
                        setIsEditMode(false); 
                        setCurrentCard({
                            name: '', 
                            category: '其他', 
                            sellPrice: 10, 
                            isSold: area === 'group-break', 
                            dailyLimit: 0, 
                            minLevel: '新手收藏家',
                            createdAt: new Date().toISOString()
                        }); 
                        setPreviewUrl(null); 
                        setBackPreviewUrl(null); 
                        setIsCardDialogOpen(true); 
                    }} 
                    className="h-10 rounded-xl font-black bg-slate-900 text-white hover:bg-slate-800 shadow-lg"
                >
                    <PlusCircle className="mr-2 h-4 w-4" /> 新增卡片
                </Button>
            </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
                {/* Search & Selectors */}
                <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input 
                            placeholder="搜尋卡片名稱..." 
                            className="pl-10 h-10 bg-slate-50 border-slate-200 rounded-xl shadow-inner font-bold text-slate-900 text-xs" 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                        />
                    </div>

                    <Select value={sportFilter} onValueChange={setSportFilter}>
                        <SelectTrigger className="w-[120px] h-10 bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-700 text-xs">
                            <SelectValue placeholder="所有分類" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            {SPORT_CATEGORIES.map(c => <SelectItem key={c} value={c} className="font-bold text-xs">{c}</SelectItem>)}
                        </SelectContent>
                    </Select>

                    {/* Date filter dropdown */}
                    <Select value={dateFilter} onValueChange={setDateFilter}>
                        <SelectTrigger className={cn(
                            "w-[170px] h-10 border rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors",
                            dateFilter !== 'all' 
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-sm" 
                                : "bg-slate-50 border-slate-200 text-slate-700"
                        )}>
                            <CalendarDays className={cn("w-3.5 h-3.5", dateFilter !== 'all' ? "text-emerald-600" : "text-slate-400")} />
                            <SelectValue placeholder="📅 日期篩選" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl max-h-72">
                            <SelectItem value="all" className="font-bold text-xs">全部上傳日期 ({allCards?.length || 0})</SelectItem>
                            <SelectItem value="today" className="font-bold text-xs text-emerald-700">✨ 今日上傳 ({dateStats.today})</SelectItem>
                            <SelectItem value="yesterday" className="font-bold text-xs text-blue-700">⏳ 昨日上傳 ({dateStats.yesterday})</SelectItem>
                            <SelectItem value="7days" className="font-bold text-xs">📅 最近 7 天 ({dateStats.last7Days})</SelectItem>
                            <SelectItem value="30days" className="font-bold text-xs">📅 最近 30 天</SelectItem>
                            
                            {dateStats.dateGroups.length > 0 && (
                                <div className="border-t border-slate-100 my-1 px-2 py-1 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                                    依具體上傳日期
                                </div>
                            )}
                            {dateStats.dateGroups.map(g => (
                                <SelectItem key={g.date} value={g.date} className="font-bold text-xs pl-4">
                                    {g.date} ({g.count} 張)
                                </SelectItem>
                            ))}

                            <div className="border-t border-slate-100 my-1" />
                            <SelectItem value="unrecorded" className="font-bold text-xs text-slate-500">📦 歷史舊卡 / 未標記日期 ({dateStats.unrecorded})</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Sorting selector */}
                    <Select value={sortBy} onValueChange={setSortBy}>
                        <SelectTrigger className="w-[160px] h-10 bg-slate-50 border-slate-200 rounded-xl font-bold text-slate-700 text-xs flex items-center gap-1.5">
                            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                            <SelectValue placeholder="排序方式" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="date-desc" className="font-bold text-xs">⚡ 最新上傳優先</SelectItem>
                            <SelectItem value="date-asc" className="font-bold text-xs">⏱️ 最早上傳優先</SelectItem>
                            <SelectItem value="name-asc" className="font-bold text-xs">🔤 卡片名稱 (A-Z)</SelectItem>
                            <SelectItem value="price-desc" className="font-bold text-xs">💎 價值：高至低</SelectItem>
                            <SelectItem value="price-asc" className="font-bold text-xs">💎 價值：低至高</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* View toggle (Group by date vs standard list) */}
                <div className="flex items-center gap-2">
                    <Button 
                        variant={isGroupedByDate ? "default" : "outline"} 
                        size="sm"
                        onClick={() => setIsGroupedByDate(!isGroupedByDate)}
                        className={cn(
                            "h-10 rounded-xl font-black text-xs transition-all",
                            isGroupedByDate 
                                ? "bg-slate-900 text-white shadow-md" 
                                : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        )}
                    >
                        {isGroupedByDate ? <LayoutGrid className="mr-1.5 h-4 w-4 text-emerald-400" /> : <LayoutList className="mr-1.5 h-4 w-4" />}
                        {isGroupedByDate ? "日期分組中" : "依日期分組"}
                    </Button>
                </div>
            </div>

            {/* Quick date filter chips */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 text-xs">
                <span className="text-[11px] font-black uppercase text-slate-400 mr-1 flex items-center gap-1">
                    <Filter className="w-3 h-3" /> 快捷篩選：
                </span>
                <button 
                    onClick={() => setDateFilter('all')}
                    className={cn(
                        "px-2.5 py-1 rounded-lg font-bold transition-all text-xs",
                        dateFilter === 'all' 
                            ? "bg-slate-900 text-white shadow-sm" 
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    )}
                >
                    全部 ({allCards?.length || 0})
                </button>
                <button 
                    onClick={() => setDateFilter('today')}
                    className={cn(
                        "px-2.5 py-1 rounded-lg font-bold transition-all text-xs flex items-center gap-1",
                        dateFilter === 'today' 
                            ? "bg-emerald-600 text-white shadow-sm" 
                            : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/50"
                    )}
                >
                    <Sparkles className="w-3 h-3" /> 今日上傳 ({dateStats.today})
                </button>
                <button 
                    onClick={() => setDateFilter('yesterday')}
                    className={cn(
                        "px-2.5 py-1 rounded-lg font-bold transition-all text-xs flex items-center gap-1",
                        dateFilter === 'yesterday' 
                            ? "bg-blue-600 text-white shadow-sm" 
                            : "bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200/50"
                    )}
                >
                    <Clock className="w-3 h-3" /> 昨日上傳 ({dateStats.yesterday})
                </button>
                <button 
                    onClick={() => setDateFilter('7days')}
                    className={cn(
                        "px-2.5 py-1 rounded-lg font-bold transition-all text-xs",
                        dateFilter === '7days' 
                            ? "bg-purple-600 text-white shadow-sm" 
                            : "bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200/50"
                    )}
                >
                    最近7天 ({dateStats.last7Days})
                </button>

                {dateFilter !== 'all' && (
                    <button 
                        onClick={() => { setDateFilter('all'); setSearchTerm(''); setSportFilter('全部'); }}
                        className="ml-auto text-[11px] font-bold text-slate-400 hover:text-slate-700 flex items-center gap-1 underline"
                    >
                        <RotateCcw className="w-3 h-3" /> 重設所有篩選
                    </button>
                )}
            </div>
        </div>

        {/* Tabs for inventory status */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="bg-slate-200/50 p-1 rounded-2xl h-12 w-fit border border-slate-200 shadow-inner">
                <TabsTrigger value="active" className="rounded-xl px-8 font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-md">在庫資產</TabsTrigger>
                <TabsTrigger value="recycled" className="rounded-xl px-8 font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-md">已回收</TabsTrigger>
                <TabsTrigger value="sold" className="rounded-xl px-8 font-black text-xs data-[state=active]:bg-white data-[state=active]:shadow-md">已抽出</TabsTrigger>
            </TabsList>

            {/* GROUPED BY DATE VIEW */}
            {isGroupedByDate ? (
                <div className="space-y-6">
                    {isLoadingCards ? (
                        Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-3xl" />)
                    ) : groupedCards.length === 0 ? (
                        <div className="bg-white border border-slate-200 rounded-3xl p-16 text-center text-slate-400 font-bold">
                            <Archive className="h-10 w-10 opacity-20 mx-auto mb-3" />
                            目前此條件下沒有卡片資產
                        </div>
                    ) : (
                        groupedCards.map((group) => (
                            <div key={group.date} className="bg-white border border-slate-200/90 rounded-3xl overflow-hidden shadow-sm">
                                {/* Group header banner */}
                                <div className={cn(
                                    "px-6 py-3.5 flex items-center justify-between border-b",
                                    group.isToday 
                                        ? "bg-emerald-50/80 border-emerald-200/60" 
                                        : (group.isYesterday ? "bg-blue-50/70 border-blue-200/50" : "bg-slate-50 border-slate-200")
                                )}>
                                    <div className="flex items-center gap-3">
                                        <div className={cn(
                                            "p-1.5 rounded-lg",
                                            group.isToday ? "bg-emerald-500 text-white" : (group.isYesterday ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-700")
                                        )}>
                                            <Calendar className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                                                {group.title}
                                                {group.isToday && (
                                                    <span className="px-2 py-0.5 bg-emerald-600 text-white text-[10px] rounded-full font-black uppercase tracking-wider animate-pulse">
                                                        NEW 今日
                                                    </span>
                                                )}
                                            </h3>
                                        </div>
                                    </div>
                                    <Badge variant="secondary" className="font-code font-bold bg-white text-slate-800 border border-slate-200 shadow-sm">
                                        {group.cards.length} 張卡片
                                    </Badge>
                                </div>

                                {/* Group cards grid */}
                                <div className="p-5 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                                    {group.cards.map((card) => {
                                        const dateBadge = formatCardDateBadge(card.createdAt);
                                        return (
                                            <div 
                                                key={card.id}
                                                className="group relative bg-slate-50/60 hover:bg-white border border-slate-200/80 hover:border-slate-400 rounded-2xl p-3 transition-all hover:shadow-lg flex flex-col justify-between"
                                            >
                                                <div className="space-y-2">
                                                    <div className="aspect-[2.5/3.5] relative rounded-xl border border-slate-200 bg-slate-100 overflow-hidden shadow-sm">
                                                        <SafeImage src={card.imageUrl} alt={card.name} fill className="object-contain p-1 group-hover:scale-105 transition-transform" />
                                                        <div className="absolute top-1.5 left-1.5">
                                                            <Badge className="bg-slate-900/90 text-white text-[9px] font-black border-none px-1.5 py-0 h-4">
                                                                {card.category}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-xs text-slate-900 truncate" title={card.name}>{card.name}</p>
                                                        <div className="flex items-center justify-between mt-1 text-[11px]">
                                                            <span className="font-code font-bold text-slate-700">{card.sellPrice?.toLocaleString()} 💎</span>
                                                            <span className="text-[10px] text-slate-400 font-bold">{dateBadge.timeStr || dateBadge.dateStr}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="pt-2.5 mt-2 border-t border-slate-200/60 flex items-center justify-between">
                                                    <div className="flex items-center gap-1.5">
                                                        <Switch 
                                                            checked={card.isSold} 
                                                            onCheckedChange={() => handleToggleSold(card)} 
                                                            className="scale-75 origin-left"
                                                        />
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase",
                                                            card.isRecycled ? "text-amber-600" : (card.isSold ? "text-rose-600" : "text-emerald-600")
                                                        )}>
                                                            {card.isRecycled ? "回收" : (card.isSold ? "售出" : "在庫")}
                                                        </span>
                                                    </div>

                                                    <div className="flex items-center">
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-7 w-7 rounded-lg hover:bg-slate-200" 
                                                            onClick={() => { 
                                                                setCurrentCard(card); 
                                                                setPreviewUrl(card.imageUrl); 
                                                                setBackPreviewUrl(card.backImageUrl || null); 
                                                                setIsEditMode(true); 
                                                                setIsCardDialogOpen(true); 
                                                            }}
                                                        >
                                                            <Edit className="h-3.5 w-3.5 text-slate-600" />
                                                        </Button>
                                                        <Button 
                                                            variant="ghost" 
                                                            size="icon" 
                                                            className="h-7 w-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50" 
                                                            onClick={() => handleDeleteCard(card)}
                                                        >
                                                            <Trash2 className="h-3.5 w-3.5" />
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                /* STANDARD TABLE VIEW */
                <div className="bg-white border border-slate-200 rounded-[2rem] overflow-hidden shadow-md">
                    <ScrollArea className="w-full">
                        <Table className="min-w-[900px]">
                            <TableHeader className="bg-slate-50 border-b-slate-200">
                                <TableRow>
                                    <TableHead className="pl-8 text-slate-900 font-black uppercase text-[10px] tracking-widest py-5">名稱資訊</TableHead>
                                    <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest text-center">分配位置</TableHead>
                                    <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">運動分類</TableHead>
                                    <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest text-center">視覺預覽</TableHead>
                                    <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">上傳日期</TableHead>
                                    <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">庫存狀態</TableHead>
                                    <TableHead className="text-slate-900 font-black uppercase text-[10px] tracking-widest">卡片價值</TableHead>
                                    <TableHead className="text-right pr-8 text-slate-900 font-black uppercase text-[10px] tracking-widest">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingCards ? Array.from({length: 5}).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={8} className="p-6"><Skeleton className="h-12 w-full rounded-2xl" /></TableCell>
                                    </TableRow>
                                )) : 
                                filteredCards.map((card) => {
                                    const dateBadge = formatCardDateBadge(card.createdAt);
                                    return (
                                        <TableRow key={card.id} className="hover:bg-slate-50 transition-colors border-b-slate-100 group">
                                            <TableCell className="pl-8 font-black text-slate-900 py-4 max-w-[200px] truncate" title={card.name}>
                                                {card.name}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {cardAssignmentMap.has(card.id!) ? (
                                                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 text-[10px] font-black uppercase">
                                                        {cardAssignmentMap.get(card.id!)?.name}
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-slate-400 border-slate-200 text-[10px] font-black uppercase">閒置中</Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-[10px] font-black border-slate-300 text-slate-700 bg-white px-3 h-6 uppercase">{card.category}</Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex justify-center">
                                                    <div className="relative w-10 h-14 rounded-lg border-2 border-white bg-slate-100 overflow-hidden shadow-md group-hover:scale-110 transition-all">
                                                        <SafeImage src={card.imageUrl} alt={card.name} fill className="object-contain p-0.5" />
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className={cn(
                                                        "text-xs font-bold font-code",
                                                        dateBadge.isNew ? "text-emerald-600 font-black" : (dateBadge.isYesterday ? "text-blue-600 font-black" : "text-slate-700")
                                                    )}>
                                                        {dateBadge.label}
                                                    </span>
                                                    {dateBadge.timeStr && (
                                                        <span className="text-[10px] text-slate-400 font-bold">{dateBadge.dateStr}</span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center space-x-3">
                                                    <Switch checked={card.isSold} onCheckedChange={() => handleToggleSold(card)} />
                                                    <Label className={cn("text-[10px] font-black uppercase tracking-tighter", 
                                                        card.isRecycled ? "text-amber-600" : (card.isSold ? "text-rose-600" : "text-emerald-600")
                                                    )}>
                                                        {card.isRecycled ? "已回收" : (card.isSold ? "已抽出" : "在庫中")}
                                                    </Label>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-code font-black text-slate-900 text-lg">
                                                {card.sellPrice?.toLocaleString()} <span className="text-[10px] font-normal text-slate-400">💎</span>
                                            </TableCell>
                                            <TableCell className="text-right pr-8 space-x-1">
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-9 w-9 rounded-xl hover:bg-slate-100" 
                                                    onClick={() => { 
                                                        setCurrentCard(card); 
                                                        setPreviewUrl(card.imageUrl); 
                                                        setBackPreviewUrl(card.backImageUrl || null); 
                                                        setIsEditMode(true); 
                                                        setIsCardDialogOpen(true); 
                                                    }}
                                                >
                                                    <Edit className="h-4 w-4 text-slate-600" />
                                                </Button>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-9 w-9 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50" 
                                                    onClick={() => handleDeleteCard(card)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                                {!isLoadingCards && filteredCards.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="h-40 text-center text-slate-400 font-bold italic">
                                            <div className="flex flex-col items-center gap-3">
                                                <Archive className="h-8 w-8 opacity-20" />
                                                目前此條件下沒有卡片資產
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            )}
        </Tabs>

        {/* Edit / Create Dialog */}
        <Dialog open={isCardDialogOpen} onOpenChange={setIsCardDialogOpen}>
            <DialogContent className="light sm:max-w-xl bg-white border-none shadow-2xl p-10 rounded-[2.5rem] text-slate-900 overflow-hidden">
                <DialogHeader className="mb-6">
                    <DialogTitle className="text-2xl font-black tracking-tight flex items-center justify-between">
                        <span>{isEditMode ? '修改資產數據' : '建立新資產草稿'}</span>
                        {isEditMode && currentCard.createdAt && (
                            <Badge variant="outline" className="text-xs font-code font-bold text-slate-500 bg-slate-50">
                                {formatCardDateBadge(currentCard.createdAt).label}
                            </Badge>
                        )}
                    </DialogTitle>
                </DialogHeader>
                <ScrollArea className="max-h-[70vh] pr-4">
                    <div className="grid gap-8 py-4">
                        <div className="space-y-2">
                            <Label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">卡片名稱</Label>
                            <Input value={currentCard.name} onChange={e => setCurrentCard({...currentCard, name: e.target.value})} className="h-14 border-slate-200 rounded-2xl font-bold text-lg bg-white" placeholder="輸入完整卡片名稱" />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">運動分類</Label>
                                <Select value={currentCard.category} onValueChange={v => setCurrentCard({...currentCard, category: v})}>
                                    <SelectTrigger className="h-12 border-slate-200 rounded-xl font-bold bg-white text-slate-900"><SelectValue /></SelectTrigger>
                                    <SelectContent className="rounded-xl">{SPORT_CATEGORIES.filter(c => c !== '全部').map(c => <SelectItem key={c} value={c} className="font-bold">{c}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">卡片價值 (💎)</Label>
                                <Input type="number" value={currentCard.sellPrice} onChange={e => setCurrentCard({...currentCard, sellPrice: Number(e.target.value)})} className="h-12 border-slate-200 rounded-xl font-code font-black text-xl bg-white" />
                            </div>
                        </div>

                        <div className="p-6 rounded-[2rem] border border-slate-200 bg-slate-50/50 space-y-6">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-slate-900 font-black text-sm uppercase tracking-widest">
                                    <Ban className="w-4 h-4 text-rose-500" /> 參與限制 (用於拼卡專區)
                                </div>
                                <div className="flex items-center gap-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">已回收狀態</Label>
                                    <Switch 
                                        checked={currentCard.isRecycled || false} 
                                        onCheckedChange={(val) => setCurrentCard({...currentCard, isRecycled: val, isSold: val ? true : currentCard.isSold})} 
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">每日限購次數 (0為不限)</Label>
                                    <Input type="number" value={currentCard.dailyLimit ?? 0} onChange={e => setCurrentCard({...currentCard, dailyLimit: Number(e.target.value)})} className="h-12 border-slate-200 rounded-xl font-code font-black text-lg bg-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-[10px] font-black uppercase text-slate-500 tracking-widest">最低等級要求</Label>
                                    <Select value={currentCard.minLevel || '新手收藏家'} onValueChange={(val) => setCurrentCard({...currentCard, minLevel: val})}>
                                        <SelectTrigger className="h-12 border-slate-200 rounded-xl font-bold bg-white text-slate-900">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {userLevels.map(l => <SelectItem key={l.level} value={l.level} className="font-bold">{l.level}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">正面圖片 (必填)</Label>
                                <Input type="file" accept="image/*" onChange={e => { if(e.target.files?.[0]) { setSelectedFile(e.target.files[0]); setPreviewUrl(URL.createObjectURL(e.target.files[0])); } }} className="text-xs border-slate-200 rounded-xl h-10 file:font-black bg-white" />
                                {previewUrl && <div className="aspect-[2.5/3.5] relative rounded-2xl border-2 border-slate-100 bg-slate-50 overflow-hidden mt-3 shadow-md"><SafeImage src={previewUrl} alt="p" fill className="object-contain p-2" /></div>}
                            </div>
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">背面圖片 (選填)</Label>
                                <Input type="file" accept="image/*" onChange={e => { if(e.target.files?.[0]) { setSelectedBackFile(e.target.files[0]); setBackPreviewUrl(URL.createObjectURL(e.target.files[0])); } }} className="text-xs border-slate-200 rounded-xl h-10 file:font-black bg-white" />
                                {backPreviewUrl && <div className="aspect-[2.5/3.5] relative rounded-2xl border-2 border-slate-100 bg-slate-50 overflow-hidden mt-3 shadow-md"><SafeImage src={backPreviewUrl} alt="p" fill className="object-contain p-2" /></div>}
                            </div>
                        </div>
                    </div>
                </ScrollArea>
                <DialogFooter className="mt-6"><Button onClick={handleSaveCard} className="w-full h-14 rounded-2xl font-black bg-slate-900 text-white text-lg shadow-xl hover:bg-slate-800 transition-all">儲存資產並同步資料庫</Button></DialogFooter>
            </DialogContent>
        </Dialog>
    </div>
  );
}
