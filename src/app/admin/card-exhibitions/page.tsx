'use client';

import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, deleteDoc, updateDoc, doc, Timestamp, orderBy, query, writeBatch } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { format } from 'date-fns';
import { Trash2, Plus, Sparkles, Loader2, Calendar, MapPin, Clock, CheckCircle2, RefreshCw, ExternalLink } from 'lucide-react';

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

    // AI Fetch states
    const [isAiFetching, setIsAiFetching] = useState(false);
    const [isAiDialogOpen, setIsAiDialogOpen] = useState(false);
    const [aiExtractedList, setAiExtractedList] = useState<ExtractedExhibition[]>([]);
    const [isImporting, setIsImporting] = useState(false);

    const q = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
    }, [firestore]);
    const { data: exhibitions } = useCollection<any>(q);

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
                toast({
                    title: 'AI 提取成功',
                    description: `成功聯網找到 ${items.length} 場台灣球員卡展情報！`,
                });
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
        if (!firestore || !title || !startDate) return;
        try {
            await addDoc(collection(firestore, 'card_exhibitions'), {
                title,
                date: Timestamp.fromDate(new Date(startDate)),
                endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : Timestamp.fromDate(new Date(startDate)),
                time,
                location,
                description,
                imageUrl,
            });
            toast({ title: '成功', description: '卡展已新增' });
            setTitle('');
            setStartDate('');
            setEndDate('');
            setTime('');
            setLocation('');
            setDescription('');
            setImageUrl('');
        } catch (e) {
            toast({ variant: 'destructive', title: '錯誤', description: '新增失敗' });
        }
    };

    const handleUpdate = async (id: string, updatedData: any) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'card_exhibitions', id), updatedData);
            toast({ title: '成功', description: '卡展已更新' });
        } catch (e) {
            toast({ variant: 'destructive', title: '錯誤', description: '更新失敗' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        await deleteDoc(doc(firestore, 'card_exhibitions', id));
        toast({ title: '已刪除' });
    };

    const ExhibitionItem = ({ exh }: { exh: any }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [title, setTitle] = useState(exh.title || '');
        const [location, setLocation] = useState(exh.location || '');
        const [time, setTime] = useState(exh.time || '');
        const [description, setDescription] = useState(exh.description || '');
        const [imageUrl, setImageUrl] = useState(exh.imageUrl || '');
        const [startDate, setStartDate] = useState(exh.date ? format(new Date(exh.date.seconds * 1000), 'yyyy-MM-dd') : '');
        const [endDate, setEndDate] = useState(exh.endDate ? format(new Date(exh.endDate.seconds * 1000), 'yyyy-MM-dd') : '');

        if (isEditing) {
            return (
                <Card className="p-4 space-y-3">
                    <div className="space-y-1">
                        <Label className="text-xs font-bold">標題</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="展覽標題" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">開始日期</Label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">結束日期</Label>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">地點</Label>
                            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例如：龍山文創基地" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">時間</Label>
                            <Input value={time} onChange={(e) => setTime(e.target.value)} placeholder="例如：11:00 - 17:00" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs font-bold">描述</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="詳細活動介紹或說明" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs font-bold">宣傳圖片 (URL)</Label>
                        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button onClick={() => { 
                            handleUpdate(exh.id, { 
                                title, 
                                location,
                                time,
                                description, 
                                imageUrl, 
                                date: Timestamp.fromDate(new Date(startDate)),
                                endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : Timestamp.fromDate(new Date(startDate))
                            }); 
                            setIsEditing(false); 
                        }}>儲存</Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>取消</Button>
                    </div>
                </Card>
            );
        }

        return (
            <Card key={exh.id} className="p-4 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-base">{exh.title}</h3>
                        <div className="flex gap-1.5 shrink-0">
                            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>編輯</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(exh.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                        📅 {exh.date ? format(new Date(exh.date.seconds * 1000), 'yyyy/MM/dd') : ''}
                        {exh.endDate && ` ~ ${format(new Date(exh.endDate.seconds * 1000), 'yyyy/MM/dd')}`}
                    </p>
                    {(exh.location || exh.time) && (
                        <div className="text-xs text-slate-700 bg-slate-100 p-2 rounded-lg space-y-1 font-medium">
                            {exh.location && <div>📍 <strong>地點：</strong>{exh.location}</div>}
                            {exh.time && <div>⏰ <strong>時間：</strong>{exh.time}</div>}
                        </div>
                    )}
                    {exh.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">{exh.description}</p>
                    )}
                </div>
            </Card>
        );
    };

    return (
        <div className="space-y-8 p-8 max-w-7xl mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
                        卡展管理
                        <span className="text-xs font-semibold px-2.5 py-1 bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 rounded-full">
                            全台情報
                        </span>
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        管理卡展行事曆活動，或利用 AI 自動聯網搜尋台灣各地球員卡展並一鍵匯入。
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <Button 
                        onClick={handleFetchFromAi} 
                        disabled={isAiFetching}
                        className="bg-gradient-to-r from-cyan-600 via-blue-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-bold shadow-lg shadow-cyan-500/20 border border-cyan-400/30 transition-all duration-300 active:scale-95"
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
                                className={`p-4 rounded-xl border transition-all cursor-pointer select-none ${
                                    item.selected 
                                        ? 'bg-cyan-950/40 border-cyan-500/50 shadow-md shadow-cyan-500/10' 
                                        : 'bg-slate-900/50 border-slate-800 opacity-60 hover:opacity-80'
                                }`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-start gap-3">
                                        <div className={`mt-1 h-5 w-5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                                            item.selected ? 'bg-cyan-500 border-cyan-400 text-slate-950' : 'border-slate-600 bg-slate-800'
                                        }`}>
                                            {item.selected && <CheckCircle2 className="h-4 w-4" />}
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

            <Card>
                <CardHeader><CardTitle>手動新增卡展</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>標題 *</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：CARDNEX 台北收藏卡展" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>開始日期 *</Label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>結束日期</Label>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>地點</Label>
                            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例：龍山文創基地 (捷運龍山寺站1號出口)" />
                        </div>
                        <div className="space-y-2">
                            <Label>時間</Label>
                            <Input value={time} onChange={(e) => setTime(e.target.value)} placeholder="例：11:00 - 17:00" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>描述說明</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="輸入展覽相關活動規範、備註或補充說明..." />
                    </div>
                    <div className="space-y-2">
                        <Label>宣傳圖片 (URL)</Label>
                        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                    </div>
                    <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" /> 新增卡展</Button>
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exhibitions?.map((exh) => <ExhibitionItem key={exh.id} exh={exh} />)}
            </div>
        </div>
    );
}
