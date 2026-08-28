'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, deleteDoc, updateDoc, doc, Timestamp, orderBy, query, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { format, isSameMonth, isAfter, isBefore, startOfDay, endOfDay } from 'date-fns';
import { zhTW } from 'date-fns/locale';
import { 
    Trash2, 
    Plus, 
    Sparkles, 
    Loader2, 
    Calendar, 
    MapPin, 
    Clock, 
    CheckCircle2, 
    RefreshCw, 
    ExternalLink,
    Search,
    Filter,
    Layers,
    List,
    LayoutGrid,
    CalendarDays,
    AlertCircle,
    ArrowUpDown,
    Check,
    X,
    CalendarRange,
    Flame,
    Tag
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExtractedExhibition {
    title: string;
    startDate: string;
    endDate?: string;
    time?: string;
    location: string;
    description?: string;
    imageUrl?: string;
    selected?: boolean;
}

export type DateFilterType = 'all' | 'ongoing' | 'upcoming' | 'this_month' | 'ended';
export type RegionFilterType = 'all' | 'north' | 'central' | 'south' | 'other';
export type SortOrderType = 'date_asc' | 'date_desc' | 'created_desc';

export function getExhibitionStatus(exh: any): { 
    status: 'ongoing' | 'upcoming' | 'ended'; 
    label: string; 
    color: string;
    daysDiff?: number;
} {
    const now = new Date();
    const today = startOfDay(now);
    
    let startDate: Date;
    if (exh.date?.seconds) {
        startDate = new Date(exh.date.seconds * 1000);
    } else if (exh.date) {
        startDate = new Date(exh.date);
    } else {
        startDate = new Date();
    }
    const start = startOfDay(startDate);

    let endDate: Date;
    if (exh.endDate?.seconds) {
        endDate = new Date(exh.endDate.seconds * 1000);
    } else if (exh.endDate) {
        endDate = new Date(exh.endDate);
    } else {
        endDate = start;
    }
    const end = endOfDay(endDate);

    if (now > end) {
        return { status: 'ended', label: '已結束', color: 'bg-slate-100 text-slate-500 border-slate-200' };
    } else if (now >= start && now <= end) {
        return { status: 'ongoing', label: '🔥 進行中', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' };
    } else {
        const diffTime = start.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const badgeLabel = diffDays <= 7 ? `即將開展 (倒數 ${diffDays} 天)` : `預告 (倒數 ${diffDays} 天)`;
        return { 
            status: 'upcoming', 
            label: badgeLabel, 
            color: diffDays <= 7 ? 'bg-amber-500/10 text-amber-600 border-amber-500/30' : 'bg-cyan-500/10 text-cyan-600 border-cyan-500/30',
            daysDiff: diffDays
        };
    }
}

export function detectExhibitionRegion(locationStr?: string): RegionFilterType {
    if (!locationStr) return 'other';
    const loc = locationStr.toLowerCase();
    if (/台北|新北|基隆|桃園|新竹|宜蘭|龍山|松山|世貿|花博|華山|南港/.test(loc)) return 'north';
    if (/台中|彰化|苗栗|南投|雲林|烏日/.test(loc)) return 'central';
    if (/高雄|台南|屏東|嘉義|巨蛋|駁二/.test(loc)) return 'south';
    return 'other';
}

export default function CardExhibitionsAdmin() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [time, setTime] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    // 篩選與分類狀態
    const [dateFilter, setDateFilter] = useState<DateFilterType>('all');
    const [regionFilter, setRegionFilter] = useState<RegionFilterType>('all');
    const [monthFilter, setMonthFilter] = useState<string>('all');
    const [sortOrder, setSortOrder] = useState<SortOrderType>('date_asc');
    const [searchKeyword, setSearchKeyword] = useState('');
    const [viewMode, setViewMode] = useState<'grouped' | 'grid'>('grouped');
    const [isAddFormExpanded, setIsAddFormExpanded] = useState(false);

    // AI Fetch states
    const [isAiFetching, setIsAiFetching] = useState(false);
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [aiExtractedList, setAiExtractedList] = useState<ExtractedExhibition[]>([]);
    const [isImporting, setIsImporting] = useState(false);

    // 刪除確認 Modal 狀態
    const [deletingExhibition, setDeletingExhibition] = useState<{ id: string; title: string; dateStr?: string; location?: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showBatchDeleteModal, setShowBatchDeleteModal] = useState(false);
    const [isBatchDeleting, setIsBatchDeleting] = useState(false);

    const q = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
    }, [firestore]);
    const { data: rawExhibitions, isLoading } = useCollection<any>(q);

    // 取得所有資料中的年月份列表（供下拉選單快速篩選）
    const availableMonths = useMemo(() => {
        if (!rawExhibitions) return [];
        const monthSet = new Set<string>();
        rawExhibitions.forEach(exh => {
            if (exh.date?.seconds) {
                const d = new Date(exh.date.seconds * 1000);
                monthSet.add(format(d, 'yyyy-MM'));
            }
        });
        return Array.from(monthSet).sort();
    }, [rawExhibitions]);

    // 統計指標
    const stats = useMemo(() => {
        if (!rawExhibitions) return { total: 0, ongoing: 0, upcoming: 0, ended: 0, thisMonth: 0 };
        const now = new Date();
        let ongoing = 0;
        let upcoming = 0;
        let ended = 0;
        let thisMonth = 0;

        rawExhibitions.forEach(exh => {
            const { status } = getExhibitionStatus(exh);
            if (status === 'ongoing') ongoing++;
            if (status === 'upcoming') upcoming++;
            if (status === 'ended') ended++;

            if (exh.date?.seconds) {
                const d = new Date(exh.date.seconds * 1000);
                if (isSameMonth(d, now)) {
                    thisMonth++;
                }
            }
        });

        return {
            total: rawExhibitions.length,
            ongoing,
            upcoming,
            ended,
            thisMonth
        };
    }, [rawExhibitions]);

    // 經篩選與排序後的展覽列表
    const filteredExhibitions = useMemo(() => {
        if (!rawExhibitions) return [];
        const now = new Date();

        return rawExhibitions.filter(exh => {
            const { status } = getExhibitionStatus(exh);
            
            // 1. 日期分類篩選
            if (dateFilter === 'ongoing' && status !== 'ongoing') return false;
            if (dateFilter === 'upcoming' && status !== 'upcoming') return false;
            if (dateFilter === 'ended' && status !== 'ended') return false;
            if (dateFilter === 'this_month') {
                if (!exh.date?.seconds) return false;
                const d = new Date(exh.date.seconds * 1000);
                if (!isSameMonth(d, now)) return false;
            }

            // 2. 年月份特定篩選
            if (monthFilter !== 'all') {
                if (!exh.date?.seconds) return false;
                const d = new Date(exh.date.seconds * 1000);
                if (format(d, 'yyyy-MM') !== monthFilter) return false;
            }

            // 3. 地區篩選
            if (regionFilter !== 'all') {
                const reg = detectExhibitionRegion(exh.location);
                if (reg !== regionFilter) return false;
            }

            // 4. 關鍵字搜尋
            if (searchKeyword.trim()) {
                const kw = searchKeyword.toLowerCase();
                const titleMatch = (exh.title || '').toLowerCase().includes(kw);
                const locMatch = (exh.location || '').toLowerCase().includes(kw);
                const descMatch = (exh.description || '').toLowerCase().includes(kw);
                if (!titleMatch && !locMatch && !descMatch) return false;
            }

            return true;
        }).sort((a, b) => {
            const aTime = a.date?.seconds ? a.date.seconds * 1000 : 0;
            const bTime = b.date?.seconds ? b.date.seconds * 1000 : 0;

            if (sortOrder === 'date_asc') return aTime - bTime;
            if (sortOrder === 'date_desc') return bTime - aTime;
            if (sortOrder === 'created_desc') {
                const aCreated = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : aTime;
                const bCreated = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : bTime;
                return bCreated - aCreated;
            }
            return 0;
        });
    }, [rawExhibitions, dateFilter, regionFilter, monthFilter, sortOrder, searchKeyword]);

    // 按月份分組資料
    const groupedByMonth = useMemo(() => {
        const groups: Record<string, any[]> = {};
        filteredExhibitions.forEach(exh => {
            let monthKey = '未定日期';
            if (exh.date?.seconds) {
                const d = new Date(exh.date.seconds * 1000);
                monthKey = format(d, 'yyyy 年 MM 月');
            }
            if (!groups[monthKey]) {
                groups[monthKey] = [];
            }
            groups[monthKey].push(exh);
        });
        return groups;
    }, [filteredExhibitions]);

    // Call AI fetch endpoint
    const handleFetchFromAi = async () => {
        setIsAiFetching(true);
        try {
            const res = await fetch('/api/admin/fetch-exhibitions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            const data = await res.json();
            if (!data.success) {
                throw new Error(data.error || 'AI 抓取卡展失敗');
            }

            const items: ExtractedExhibition[] = (data.exhibitions || []).map((item: any) => ({
                ...item,
                selected: true,
            }));

            if (items.length === 0) {
                toast({
                    title: '未找到近期公開卡展',
                    description: 'AI 暫時未檢索到近期即將舉辦的公開卡展，建議稍後再試或手動新增。',
                });
            } else {
                setAiExtractedList(items);
                setIsAiDialogOpen(true);
                if (data.warning) {
                    toast({
                        title: '已載入精選卡展資料庫',
                        description: data.warning,
                    });
                } else {
                    toast({
                        title: 'AI 提取成功',
                        description: `成功聯網找到 ${items.length} 場台灣球員卡展情報！`,
                    });
                }
            }
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'AI 檢索失敗',
                description: error.message || '無法連線至 AI 聯網檢索服務',
            });
        } finally {
            setIsAiFetching(false);
        }
    };

    // Batch import AI extracted items into Firestore
    const handleBatchImportAiExhibitions = async () => {
        if (!firestore) return;
        const selectedItems = aiExtractedList.filter(item => item.selected);
        if (selectedItems.length === 0) {
            toast({ variant: 'destructive', title: '請至少選擇一場卡展' });
            return;
        }

        setIsImporting(true);
        try {
            const batch = writeBatch(firestore);
            const exhibitionsCol = collection(firestore, 'card_exhibitions');

            for (const item of selectedItems) {
                const newDocRef = doc(exhibitionsCol);
                const sDate = item.startDate ? new Date(item.startDate) : new Date();
                const eDate = item.endDate ? new Date(item.endDate) : sDate;

                batch.set(newDocRef, {
                    title: item.title || '台灣球員卡展',
                    date: Timestamp.fromDate(sDate),
                    endDate: Timestamp.fromDate(eDate),
                    time: item.time || '',
                    location: item.location || '台灣',
                    description: item.description || '',
                    imageUrl: item.imageUrl || '',
                    createdAt: Timestamp.now(),
                    source: 'AI-Extracted',
                });
            }

            await batch.commit();
            toast({
                title: '🎉 匯入成功',
                description: `已將 ${selectedItems.length} 場台灣卡展情報同步至卡展行事曆！`,
            });
            setIsAiDialogOpen(false);
            setAiExtractedList([]);
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: '匯入失敗',
                description: error.message || '寫入資料庫時發生錯誤',
            });
        } finally {
            setIsImporting(false);
        }
    };

    const handleAdd = async () => {
        if (!firestore || !title.trim() || !startDate) {
            toast({ variant: 'destructive', title: '請填寫必要欄位', description: '展覽標題與開始日期為必填。' });
            return;
        }
        try {
            await addDoc(collection(firestore, 'card_exhibitions'), {
                title: title.trim(),
                date: Timestamp.fromDate(new Date(startDate)),
                endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : Timestamp.fromDate(new Date(startDate)),
                time: time.trim(),
                location: location.trim(),
                description: description.trim(),
                imageUrl: imageUrl.trim(),
                createdAt: Timestamp.now(),
            });
            toast({ title: '新增成功', description: '卡展已新增至行事曆' });
            setTitle('');
            setStartDate('');
            setEndDate('');
            setTime('');
            setLocation('');
            setDescription('');
            setImageUrl('');
            setIsAddFormExpanded(false);
        } catch (e) {
            toast({ variant: 'destructive', title: '錯誤', description: '新增失敗' });
        }
    };

    const handleUpdate = async (id: string, updatedData: any) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'card_exhibitions', id), updatedData);
            toast({ title: '成功', description: '卡展資料已更新' });
        } catch (e) {
            toast({ variant: 'destructive', title: '錯誤', description: '更新失敗' });
        }
    };

    // 觸發單筆刪除確認視窗
    const handleRequestDelete = (exh: any) => {
        const startStr = exh.date ? format(new Date(exh.date.seconds * 1000), 'yyyy/MM/dd', { locale: zhTW }) : '';
        setDeletingExhibition({
            id: exh.id,
            title: exh.title || '未命名卡展',
            dateStr: startStr,
            location: exh.location || ''
        });
    };

    // 執行單筆刪除
    const handleConfirmDelete = async () => {
        if (!firestore || !deletingExhibition) return;
        setIsDeleting(true);
        try {
            await deleteDoc(doc(firestore, 'card_exhibitions', deletingExhibition.id));
            toast({
                title: '🎉 卡展已成功刪除',
                description: `「${deletingExhibition.title}」已自資料庫與前台行事曆同步移除。`
            });
            setDeletingExhibition(null);
        } catch (error: any) {
            console.error('Delete exhibition error:', error);
            toast({
                variant: 'destructive',
                title: '刪除失敗',
                description: error.message || '寫入資料庫時發生錯誤，請確認管理員權限'
            });
        } finally {
            setIsDeleting(false);
        }
    };

    // 觸發批次清理過期歷史展覽確認視窗
    const handleRequestBatchDeleteEnded = () => {
        if (!rawExhibitions) return;
        const endedItems = rawExhibitions.filter(exh => getExhibitionStatus(exh).status === 'ended');
        if (endedItems.length === 0) {
            toast({ title: '無歷史展覽', description: '目前沒有已結束的歷史展覽需要清理。' });
            return;
        }
        setShowBatchDeleteModal(true);
    };

    // 執行批次清理已結束展覽
    const handleConfirmBatchDeleteEnded = async () => {
        if (!firestore || !rawExhibitions) return;
        const endedItems = rawExhibitions.filter(exh => getExhibitionStatus(exh).status === 'ended');
        if (endedItems.length === 0) {
            setShowBatchDeleteModal(false);
            return;
        }

        setIsBatchDeleting(true);
        try {
            const batch = writeBatch(firestore);
            endedItems.forEach(item => {
                batch.delete(doc(firestore, 'card_exhibitions', item.id));
            });
            await batch.commit();
            toast({
                title: '清理完成',
                description: `已成功批次刪除 ${endedItems.length} 場過期歷史卡展。`
            });
            setShowBatchDeleteModal(false);
        } catch (err: any) {
            console.error('Batch delete error:', err);
            toast({
                variant: 'destructive',
                title: '批次刪除失敗',
                description: err.message || '寫入資料庫時發生錯誤'
            });
        } finally {
            setIsBatchDeleting(false);
        }
    };

    const ExhibitionItemCard = ({ exh }: { exh: any }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [editTitle, setEditTitle] = useState(exh.title || '');
        const [editLocation, setEditLocation] = useState(exh.location || '');
        const [editTime, setEditTime] = useState(exh.time || '');
        const [editDescription, setEditDescription] = useState(exh.description || '');
        const [editImageUrl, setEditImageUrl] = useState(exh.imageUrl || '');
        const [editStartDate, setEditStartDate] = useState(exh.date ? format(new Date(exh.date.seconds * 1000), 'yyyy-MM-dd') : '');
        const [editEndDate, setEditEndDate] = useState(exh.endDate ? format(new Date(exh.endDate.seconds * 1000), 'yyyy-MM-dd') : '');

        const statusInfo = getExhibitionStatus(exh);
        const region = detectExhibitionRegion(exh.location);
        const regionLabel = region === 'north' ? '北部' : region === 'central' ? '中部' : region === 'south' ? '南部' : '其他';

        if (isEditing) {
            return (
                <Card className="p-5 space-y-4 border-2 border-indigo-500/40 bg-slate-900/90 text-white shadow-xl rounded-2xl">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-700">
                        <span className="font-black text-sm text-indigo-300">編輯卡展資料</span>
                        <Badge variant="outline" className="text-[10px] text-slate-400">ID: {exh.id.slice(0, 6)}</Badge>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-300">展覽標題 *</Label>
                        <Input 
                            value={editTitle} 
                            onChange={(e) => setEditTitle(e.target.value)} 
                            placeholder="展覽標題" 
                            className="bg-slate-800 border-slate-700 text-white font-bold"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-300">開始日期 *</Label>
                            <Input 
                                type="date" 
                                value={editStartDate} 
                                onChange={(e) => setEditStartDate(e.target.value)} 
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-300">結束日期</Label>
                            <Input 
                                type="date" 
                                value={editEndDate} 
                                onChange={(e) => setEditEndDate(e.target.value)} 
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-300">地點</Label>
                            <Input 
                                value={editLocation} 
                                onChange={(e) => setEditLocation(e.target.value)} 
                                placeholder="如：龍山文創基地" 
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-300">時間</Label>
                            <Input 
                                value={editTime} 
                                onChange={(e) => setEditTime(e.target.value)} 
                                placeholder="如：11:00 - 17:00" 
                                className="bg-slate-800 border-slate-700 text-white"
                            />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-300">活動說明與描述</Label>
                        <Textarea 
                            value={editDescription} 
                            onChange={(e) => setEditDescription(e.target.value)} 
                            placeholder="活動相關說明、備註、主辦單位資訊" 
                            rows={3}
                            className="bg-slate-800 border-slate-700 text-white text-xs"
                        />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-300">宣傳圖片 (URL)</Label>
                        <Input 
                            value={editImageUrl} 
                            onChange={(e) => setEditImageUrl(e.target.value)} 
                            placeholder="https://..." 
                            className="bg-slate-800 border-slate-700 text-white text-xs font-mono"
                        />
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-slate-700">
                        <Button 
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                            onClick={() => { 
                                if (!editTitle.trim() || !editStartDate) {
                                    toast({ variant: 'destructive', title: '標題與開始日期為必填' });
                                    return;
                                }
                                handleUpdate(exh.id, { 
                                    title: editTitle.trim(), 
                                    location: editLocation.trim(),
                                    time: editTime.trim(),
                                    description: editDescription.trim(), 
                                    imageUrl: editImageUrl.trim(), 
                                    date: Timestamp.fromDate(new Date(editStartDate)),
                                    endDate: editEndDate ? Timestamp.fromDate(new Date(editEndDate)) : Timestamp.fromDate(new Date(editStartDate))
                                }); 
                                setIsEditing(false); 
                            }}
                        >
                            儲存變更
                        </Button>
                        <Button variant="outline" className="border-slate-700 text-slate-300 hover:bg-slate-800" onClick={() => setIsEditing(false)}>
                            取消
                        </Button>
                    </div>
                </Card>
            );
        }

        const startDateStr = exh.date ? format(new Date(exh.date.seconds * 1000), 'yyyy/MM/dd (E)', { locale: zhTW }) : '';
        const endDateStr = exh.endDate ? format(new Date(exh.endDate.seconds * 1000), 'yyyy/MM/dd (E)', { locale: zhTW }) : '';
        const isMultiDay = exh.endDate && exh.date && format(new Date(exh.date.seconds * 1000), 'yyyyMMdd') !== format(new Date(exh.endDate.seconds * 1000), 'yyyyMMdd');

        return (
            <Card key={exh.id} className={cn(
                "p-5 flex flex-col justify-between gap-4 rounded-2xl border transition-all duration-200 hover:shadow-md bg-white",
                statusInfo.status === 'ongoing' ? "border-emerald-300 ring-1 ring-emerald-200/60 bg-emerald-50/20" : 
                statusInfo.status === 'ended' ? "border-slate-200 opacity-70 bg-slate-50/40" : "border-slate-200 shadow-sm"
            )}>
                <div className="space-y-3">
                    {/* 頂部標籤與狀態 */}
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <Badge variant="outline" className={cn("text-[11px] font-black border px-2.5 py-0.5 rounded-full shadow-xs", statusInfo.color)}>
                                {statusInfo.label}
                            </Badge>
                            <Badge variant="outline" className="text-[10px] font-bold border-slate-200 bg-slate-100/70 text-slate-700">
                                📍 {regionLabel}
                            </Badge>
                            {exh.source === 'AI-Extracted' && (
                                <Badge variant="outline" className="text-[10px] font-bold border-indigo-200 bg-indigo-50 text-indigo-700">
                                    🤖 AI 檢索
                                </Badge>
                            )}
                        </div>

                        <div className="flex gap-1.5 shrink-0">
                            <Button size="sm" variant="outline" className="h-8 text-xs font-bold text-slate-700 bg-slate-50 border-slate-200 hover:bg-slate-100" onClick={() => setIsEditing(true)}>
                                編輯
                            </Button>
                            <Button 
                                size="sm" 
                                variant="outline" 
                                className="h-8 w-8 p-0 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 transition-colors" 
                                onClick={() => handleRequestDelete(exh)}
                                title="刪除卡展"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                        </div>
                    </div>

                    {/* 標題 */}
                    <h3 className="font-black text-base text-slate-900 tracking-tight leading-snug line-clamp-2">
                        {exh.title}
                    </h3>

                    {/* 日期與時間區塊 */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-800 font-mono">
                            <Calendar className="w-4 h-4 text-cyan-600 shrink-0" />
                            <span>{startDateStr}</span>
                            {isMultiDay && (
                                <>
                                    <span className="text-slate-400">至</span>
                                    <span>{endDateStr}</span>
                                </>
                            )}
                        </div>
                        {exh.time && (
                            <div className="flex items-center gap-2 text-xs text-slate-600 font-mono">
                                <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                <span>{exh.time}</span>
                            </div>
                        )}
                        {exh.location && (
                            <div className="flex items-center gap-2 text-xs text-slate-700 font-medium">
                                <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                <span className="line-clamp-1">{exh.location}</span>
                            </div>
                        )}
                    </div>

                    {/* 說明文字 */}
                    {exh.description && (
                        <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                            {exh.description}
                        </p>
                    )}

                    {/* 圖片預覽縮圖 */}
                    {exh.imageUrl && (
                        <div className="text-[11px] text-cyan-600 font-mono flex items-center gap-1 truncate pt-1">
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <a href={exh.imageUrl} target="_blank" rel="noreferrer" className="hover:underline truncate">
                                宣傳圖檔連結
                            </a>
                        </div>
                    )}
                </div>
            </Card>
        );
    };

    return (
        <div className="space-y-8 p-8 max-w-7xl mx-auto text-slate-900">
            {/* 頁面頂部 Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div>
                    <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-3">
                        卡展管理行事曆
                        <span className="text-xs font-semibold px-2.5 py-1 bg-cyan-500/10 text-cyan-700 border border-cyan-500/20 rounded-full">
                            全台情報資料庫
                        </span>
                        {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                    </h1>
                    <p className="text-xs text-slate-500 font-bold mt-1">
                        依日期分類、月份歸檔與地區篩選管理全台卡展，亦可使用 AI 智慧聯網抓取最新展訊。
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <Button 
                        onClick={handleFetchFromAi} 
                        disabled={isAiFetching}
                        className="rounded-xl bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-black shadow-md border border-cyan-400/30 transition-all duration-200 active:scale-95 text-xs h-10 px-4"
                    >
                        {isAiFetching ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin text-cyan-200" />
                                正在全網檢索台灣卡展...
                            </>
                        ) : (
                            <>
                                <Sparkles className="mr-2 h-4 w-4 text-amber-300 animate-pulse" />
                                🤖 AI 一鍵提取全台卡展
                            </>
                        )}
                    </Button>

                    <Button 
                        onClick={() => setIsAddFormExpanded(!isAddFormExpanded)}
                        className="rounded-xl font-black bg-slate-900 text-white hover:bg-slate-800 shadow-sm text-xs h-10 px-4 flex items-center gap-1.5"
                    >
                        <Plus className="w-4 h-4" />
                        {isAddFormExpanded ? '收合表單' : '手動新增卡展'}
                    </Button>
                </div>
            </div>

            {/* 統計指標膠囊看板 */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div 
                    onClick={() => setDateFilter('all')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer bg-white shadow-xs",
                        dateFilter === 'all' ? "ring-2 ring-slate-900 border-slate-900" : "border-slate-200 hover:bg-slate-50"
                    )}
                >
                    <div className="text-xs text-slate-500 font-bold flex items-center justify-between">
                        <span>全部展覽</span>
                        <CalendarDays className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{stats.total} <span className="text-xs font-normal text-slate-400">場</span></div>
                </div>

                <div 
                    onClick={() => setDateFilter('ongoing')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer bg-white shadow-xs",
                        dateFilter === 'ongoing' ? "ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/30" : "border-slate-200 hover:bg-slate-50"
                    )}
                >
                    <div className="text-xs text-emerald-600 font-bold flex items-center justify-between">
                        <span>🔥 進行中</span>
                        <Flame className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-600 mt-1">{stats.ongoing} <span className="text-xs font-normal text-emerald-400">場</span></div>
                </div>

                <div 
                    onClick={() => setDateFilter('upcoming')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer bg-white shadow-xs",
                        dateFilter === 'upcoming' ? "ring-2 ring-cyan-500 border-cyan-500 bg-cyan-50/30" : "border-slate-200 hover:bg-slate-50"
                    )}
                >
                    <div className="text-xs text-cyan-600 font-bold flex items-center justify-between">
                        <span>🚀 即將開展</span>
                        <Clock className="w-4 h-4 text-cyan-500" />
                    </div>
                    <div className="text-2xl font-black text-cyan-600 mt-1">{stats.upcoming} <span className="text-xs font-normal text-cyan-400">場</span></div>
                </div>

                <div 
                    onClick={() => setDateFilter('this_month')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer bg-white shadow-xs",
                        dateFilter === 'this_month' ? "ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/30" : "border-slate-200 hover:bg-slate-50"
                    )}
                >
                    <div className="text-xs text-indigo-600 font-bold flex items-center justify-between">
                        <span>📅 本月展覽</span>
                        <Calendar className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="text-2xl font-black text-indigo-600 mt-1">{stats.thisMonth} <span className="text-xs font-normal text-indigo-400">場</span></div>
                </div>

                <div 
                    onClick={() => setDateFilter('ended')}
                    className={cn(
                        "p-4 rounded-2xl border transition-all cursor-pointer bg-white shadow-xs col-span-2 sm:col-span-1",
                        dateFilter === 'ended' ? "ring-2 ring-slate-400 border-slate-400 bg-slate-100" : "border-slate-200 hover:bg-slate-50"
                    )}
                >
                    <div className="text-xs text-slate-500 font-bold flex items-center justify-between">
                        <span>⚪ 已結束歷史</span>
                        <CheckCircle2 className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-black text-slate-500 mt-1">{stats.ended} <span className="text-xs font-normal text-slate-400">場</span></div>
                </div>
            </div>

            {/* AI Extracted Review Dialog */}
            <Dialog open={isAiDialogOpen} onOpenChange={setIsAiDialogOpen}>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto bg-slate-950 text-white border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2 text-cyan-400">
                            <Sparkles className="h-5 w-5 text-amber-400" />
                            AI 聯網檢索：台灣球員卡展情報 ({aiExtractedList.length} 場)
                        </DialogTitle>
                        <DialogDescription className="text-slate-400 text-xs">
                            以下為 Gemini 聯網搜尋並解析之全台卡展活動。您可以勾選欲匯入之項目，點擊匯入後將直接同步發布至前台卡展行事曆。
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-3 my-3">
                        {aiExtractedList.map((item, idx) => (
                            <div 
                                key={idx}
                                onClick={() => {
                                    setAiExtractedList(prev => prev.map((it, i) => i === idx ? { ...it, selected: !it.selected } : it));
                                }}
                                className={cn(
                                    "p-4 rounded-xl border transition-all cursor-pointer select-none",
                                    item.selected 
                                        ? "bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-500/10" 
                                        : "bg-slate-900/50 border-slate-800 opacity-60 hover:opacity-80"
                                )}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className={cn(
                                            "mt-1 h-5 w-5 rounded border flex items-center justify-center transition-colors shrink-0",
                                            item.selected ? "bg-cyan-500 border-cyan-400 text-slate-900 font-bold" : "border-slate-600 bg-slate-800"
                                        )}>
                                            {item.selected && <Check className="h-3.5 w-3.5 stroke-[3]" />}
                                        </div>
                                        <div className="space-y-1.5">
                                            <h4 className="font-bold text-base text-white">{item.title}</h4>
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300">
                                                <span className="flex items-center gap-1 text-amber-400 font-mono">
                                                    <Calendar className="h-3.5 w-3.5" />
                                                    {item.startDate} {item.endDate && item.endDate !== item.startDate ? `~ ${item.endDate}` : ''}
                                                </span>
                                                {item.time && (
                                                    <span className="flex items-center gap-1 text-slate-400 font-mono">
                                                        <Clock className="h-3.5 w-3.5" />
                                                        {item.time}
                                                    </span>
                                                )}
                                                <span className="flex items-center gap-1 text-cyan-300 font-medium">
                                                    <MapPin className="h-3.5 w-3.5" />
                                                    {item.location}
                                                </span>
                                            </div>
                                            {item.description && (
                                                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed pt-1">
                                                    {item.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <DialogFooter className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-slate-800">
                        <div className="flex items-center gap-2 text-xs text-slate-400 mr-auto">
                            已選取 <strong className="text-cyan-400 font-bold">{aiExtractedList.filter(i => i.selected).length}</strong> / {aiExtractedList.length} 場卡展
                        </div>
                        <Button 
                            variant="ghost" 
                            onClick={() => setIsAiDialogOpen(false)}
                            className="text-slate-400 hover:text-white"
                        >
                            取消
                        </Button>
                        <Button 
                            onClick={handleBatchImportAiExhibitions}
                            disabled={isImporting || aiExtractedList.filter(i => i.selected).length === 0}
                            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold"
                        >
                            {isImporting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    正在同步寫入行事曆...
                                </>
                            ) : (
                                <>
                                    <Plus className="mr-1.5 h-4 w-4" />
                                    一鍵同步匯入至行事曆
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 手動新增卡展折疊表單 */}
            {isAddFormExpanded && (
                <Card className="border-slate-200 shadow-md bg-white rounded-3xl overflow-hidden animate-in fade-in slide-in-from-top-4 duration-200">
                    <CardHeader className="bg-slate-50/60 border-b border-slate-100 flex flex-row items-center justify-between py-4">
                        <div>
                            <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-cyan-600" /> 手動新增卡展情報
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 font-bold">填寫展覽資訊，發布後立即同步呈現於前台卡展行事曆。</CardDescription>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => setIsAddFormExpanded(false)} className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                            <X className="w-4 h-4" />
                        </Button>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-black text-slate-700">展覽標題 *</Label>
                            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：2026 CARDNEX 台北收藏卡展" className="h-10 rounded-xl" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-black text-slate-700">開始日期 *</Label>
                                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-10 rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-black text-slate-700">結束日期 (單日展覽可不填)</Label>
                                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-10 rounded-xl" />
                            </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-black text-slate-700">地點</Label>
                                <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例：龍山文創基地 (台北市萬華區西園路一段145號)" className="h-10 rounded-xl" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-black text-slate-700">時間</Label>
                                <Input value={time} onChange={(e) => setTime(e.target.value)} placeholder="例：11:00 - 17:00" className="h-10 rounded-xl" />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-black text-slate-700">活動描述說明</Label>
                            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="輸入展覽特色、入場資格、特惠或備註說明..." className="rounded-xl" rows={3} />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-black text-slate-700">宣傳圖片 (URL)</Label>
                            <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." className="h-10 rounded-xl" />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button onClick={handleAdd} className="bg-slate-900 hover:bg-slate-800 text-white font-black rounded-xl px-5 h-10">
                                <Plus className="mr-1.5 h-4 w-4" /> 確認建立並發布
                            </Button>
                            <Button variant="outline" onClick={() => setIsAddFormExpanded(false)} className="rounded-xl h-10">
                                取消
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* 日期分類與多維度篩選控制列 */}
            <Card className="border-slate-200 shadow-sm rounded-3xl bg-white p-5 space-y-4">
                {/* 第一排：日期分類快速標籤 */}
                <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
                        <button
                            type="button"
                            onClick={() => setDateFilter('all')}
                            className={cn(
                                "px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border whitespace-nowrap",
                                dateFilter === 'all'
                                    ? "bg-slate-900 text-white border-slate-900 shadow-xs"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                        >
                            全部展期 ({stats.total})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateFilter('ongoing')}
                            className={cn(
                                "px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1 whitespace-nowrap",
                                dateFilter === 'ongoing'
                                    ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                        >
                            <Flame className="w-3.5 h-3.5 text-emerald-400" />
                            進行中 ({stats.ongoing})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateFilter('upcoming')}
                            className={cn(
                                "px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1 whitespace-nowrap",
                                dateFilter === 'upcoming'
                                    ? "bg-cyan-600 text-white border-cyan-600 shadow-xs"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                        >
                            <Clock className="w-3.5 h-3.5 text-cyan-400" />
                            即將開展 ({stats.upcoming})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateFilter('this_month')}
                            className={cn(
                                "px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1 whitespace-nowrap",
                                dateFilter === 'this_month'
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                        >
                            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                            本月展訊 ({stats.thisMonth})
                        </button>
                        <button
                            type="button"
                            onClick={() => setDateFilter('ended')}
                            className={cn(
                                "px-3.5 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1 whitespace-nowrap",
                                dateFilter === 'ended'
                                    ? "bg-slate-600 text-white border-slate-600 shadow-xs"
                                    : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                            )}
                        >
                            已結束歷史 ({stats.ended})
                        </button>
                    </div>

                    {/* 檢視模式切換 */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setViewMode('grouped')}
                            className={cn(
                                "h-7 px-2.5 text-xs font-bold rounded-lg transition-all",
                                viewMode === 'grouped' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            <Layers className="w-3.5 h-3.5 mr-1" /> 按月份歸檔
                        </Button>
                        <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setViewMode('grid')}
                            className={cn(
                                "h-7 px-2.5 text-xs font-bold rounded-lg transition-all",
                                viewMode === 'grid' ? "bg-white text-slate-900 shadow-xs" : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            <LayoutGrid className="w-3.5 h-3.5 mr-1" /> 緊湊網格
                        </Button>
                    </div>
                </div>

                {/* 第二排：搜尋、月份下拉、地區下拉、排序 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* 關鍵字搜尋 */}
                    <div className="relative">
                        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                        <Input 
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="搜尋展覽標題或地點..."
                            className="pl-9 h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold"
                        />
                        {searchKeyword && (
                            <button onClick={() => setSearchKeyword('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* 月份選單 */}
                    <Select value={monthFilter} onValueChange={setMonthFilter}>
                        <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold text-slate-700">
                            <CalendarRange className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                            <SelectValue placeholder="指定年月份" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                            <SelectItem value="all">📅 全部年月份</SelectItem>
                            {availableMonths.map(m => (
                                <SelectItem key={m} value={m}>
                                    {m.replace('-', ' 年 ')} 月
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* 地區選單 */}
                    <Select value={regionFilter} onValueChange={(val: RegionFilterType) => setRegionFilter(val)}>
                        <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold text-slate-700">
                            <MapPin className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                            <SelectValue placeholder="地區篩選" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                            <SelectItem value="all">📍 全台所有地區</SelectItem>
                            <SelectItem value="north">🏙️ 北部 (雙北 / 桃竹)</SelectItem>
                            <SelectItem value="central">🌳 中部 (台中 / 彰苗)</SelectItem>
                            <SelectItem value="south">☀️ 南部 (高屏 / 台南)</SelectItem>
                            <SelectItem value="other">🌐 東部 / 海外 / 其他</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* 排序方式 */}
                    <Select value={sortOrder} onValueChange={(val: SortOrderType) => setSortOrder(val)}>
                        <SelectTrigger className="h-10 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold text-slate-700">
                            <ArrowUpDown className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                            <SelectValue placeholder="排序方式" />
                        </SelectTrigger>
                        <SelectContent className="bg-white">
                            <SelectItem value="date_asc">開展日期：由近到遠 ⏳</SelectItem>
                            <SelectItem value="date_desc">開展日期：由遠到近 📅</SelectItem>
                            <SelectItem value="created_desc">最新建立時間 🆕</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* 篩選結果總覽與重設 */}
                <div className="flex items-center justify-between text-xs text-slate-500 pt-1 font-bold">
                    <div>
                        顯示篩選結果：<strong className="text-slate-900">{filteredExhibitions.length}</strong> 場卡展
                        {(dateFilter !== 'all' || regionFilter !== 'all' || monthFilter !== 'all' || searchKeyword) && (
                            <span className="text-cyan-600 ml-2">（已套用自訂篩選條件）</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        {stats.ended > 0 && dateFilter === 'ended' && (
                            <button 
                                onClick={handleRequestBatchDeleteEnded}
                                className="text-red-500 hover:text-red-600 font-bold hover:underline flex items-center gap-1"
                            >
                                <Trash2 className="w-3 h-3" /> 一鍵清空過期歷史展覽
                            </button>
                        )}
                        {(dateFilter !== 'all' || regionFilter !== 'all' || monthFilter !== 'all' || searchKeyword) && (
                            <button 
                                onClick={() => {
                                    setDateFilter('all');
                                    setRegionFilter('all');
                                    setMonthFilter('all');
                                    setSearchKeyword('');
                                }} 
                                className="text-slate-400 hover:text-slate-700 font-bold hover:underline"
                            >
                                重設全部篩選
                            </button>
                        )}
                    </div>
                </div>
            </Card>

            {/* 展覽清單展示區 */}
            {filteredExhibitions.length === 0 ? (
                <Card className="border-dashed border-2 border-slate-200 bg-white p-12 text-center rounded-3xl">
                    <CalendarDays className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                    <h3 className="font-black text-slate-700 text-base">未找到符合條件的卡展情報</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                        您可以嘗試清除篩選條件，或使用「AI 一鍵提取全台卡展」抓取最新展訊。
                    </p>
                    <div className="mt-4 flex justify-center gap-2">
                        <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => {
                                setDateFilter('all');
                                setRegionFilter('all');
                                setMonthFilter('all');
                                setSearchKeyword('');
                            }}
                            className="rounded-xl text-xs font-bold"
                        >
                            清除所有篩選
                        </Button>
                    </div>
                </Card>
            ) : viewMode === 'grouped' ? (
                // 按月份分組檢視
                <div className="space-y-6">
                    {Object.entries(groupedByMonth).map(([monthKey, list]) => (
                        <div key={monthKey} className="space-y-3">
                            <div className="flex items-center gap-2 px-1">
                                <div className="h-6 w-1.5 rounded-full bg-cyan-600" />
                                <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                                    <span>{monthKey}</span>
                                    <Badge variant="outline" className="text-xs font-bold border-slate-200 bg-white text-slate-600">
                                        {list.length} 場展覽
                                    </Badge>
                                </h2>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {list.map(exh => (
                                    <ExhibitionItemCard key={exh.id} exh={exh} />
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                // 緊湊網格檢視
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredExhibitions.map((exh) => (
                        <ExhibitionItemCard key={exh.id} exh={exh} />
                    ))}
                </div>
            )}

            {/* 單筆刪除確認 Modal */}
            <Dialog open={!!deletingExhibition} onOpenChange={(open) => { if (!open && !isDeleting) setDeletingExhibition(null); }}>
                <DialogContent className="max-w-md bg-white border-slate-200 text-slate-900 rounded-3xl p-6 shadow-2xl">
                    <DialogHeader className="space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 mb-1">
                            <Trash2 className="w-6 h-6" />
                        </div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            確定要刪除此卡展嗎？
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 font-medium leading-relaxed">
                            此操作將從資料庫永久移除該場活動情報，並自前台卡展行事曆同步下架。此動作無法復原。
                        </DialogDescription>
                    </DialogHeader>

                    {deletingExhibition && (
                        <div className="my-2 p-3.5 rounded-2xl bg-slate-50 border border-slate-100 space-y-1.5">
                            <div className="font-black text-sm text-slate-900 line-clamp-2">
                                {deletingExhibition.title}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-bold">
                                {deletingExhibition.dateStr && (
                                    <span className="flex items-center gap-1 font-mono text-cyan-700">
                                        <Calendar className="w-3.5 h-3.5" />
                                        {deletingExhibition.dateStr}
                                    </span>
                                )}
                                {deletingExhibition.location && (
                                    <span className="flex items-center gap-1 text-slate-600">
                                        <MapPin className="w-3.5 h-3.5 text-amber-500" />
                                        {deletingExhibition.location}
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setDeletingExhibition(null)}
                            disabled={isDeleting}
                            className="rounded-xl h-10 px-4 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                            取消
                        </Button>
                        <Button
                            type="button"
                            onClick={handleConfirmDelete}
                            disabled={isDeleting}
                            className="rounded-xl h-10 px-5 text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                                    正在刪除...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 mr-1.5" />
                                    確認刪除
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 批次清理已結束展覽確認 Modal */}
            <Dialog open={showBatchDeleteModal} onOpenChange={(open) => { if (!open && !isBatchDeleting) setShowBatchDeleteModal(false); }}>
                <DialogContent className="max-w-md bg-white border-slate-200 text-slate-900 rounded-3xl p-6 shadow-2xl">
                    <DialogHeader className="space-y-2">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mb-1">
                            <AlertCircle className="w-6 h-6" />
                        </div>
                        <DialogTitle className="text-lg font-black text-slate-900">
                            確定要批次清空已結束的歷史卡展嗎？
                        </DialogTitle>
                        <DialogDescription className="text-xs text-slate-500 font-medium leading-relaxed">
                            系統偵測到目前共有 <strong className="text-red-600 font-black">{stats.ended} 場</strong> 已過期結束的歷史展覽。確認後將一次性從資料庫中清除。
                        </DialogDescription>
                    </DialogHeader>

                    <DialogFooter className="flex flex-row items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setShowBatchDeleteModal(false)}
                            disabled={isBatchDeleting}
                            className="rounded-xl h-10 px-4 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50"
                        >
                            取消
                        </Button>
                        <Button
                            type="button"
                            onClick={handleConfirmBatchDeleteEnded}
                            disabled={isBatchDeleting}
                            className="rounded-xl h-10 px-5 text-xs font-black bg-red-600 hover:bg-red-700 text-white shadow-md shadow-red-500/20"
                        >
                            {isBatchDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                                    正在批次清理...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 mr-1.5" />
                                    確認批次清空 ({stats.ended} 場)
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
