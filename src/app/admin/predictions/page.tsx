'use client';

import { useState, useMemo } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
    Pencil,
    Trash2,
    Plus,
    Trophy,
    Clock,
    Target,
    CheckCircle2,
    Loader2,
    Users,
    Search,
    User,
    Sparkles,
    X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';

export interface PredictionEvent {
    id: string;
    matchName: string;
    question: string;
    options: string[];
    reward: number;
    bettingEndTime: string;
    startTime?: string;
    status: 'open' | 'closed' | 'finished';
    winningOption?: string;
    winningOptions?: string[];
}

export interface UserPredictionRecord {
    id?: string;
    userId: string;
    userName?: string;
    userAvatar?: string;
    userLevel?: string;
    eventId: string;
    matchName?: string;
    option: string;
    confirmed: boolean;
    timestamp?: any;
    createdAt?: string;
}

export function getWinningOptions(event: Partial<PredictionEvent>): string[] {
    if (Array.isArray(event.winningOptions) && event.winningOptions.length > 0) {
        return event.winningOptions.filter(Boolean);
    }
    if (typeof event.winningOption === 'string' && event.winningOption.trim()) {
        return event.winningOption.split(/[,，、]/).map(s => s.trim()).filter(Boolean);
    }
    return [];
}

function formatTime(val: any): string {
    if (!val) return '-';
    try {
        let date: Date;
        if (val.seconds) {
            date = new Date(val.seconds * 1000);
        } else if (typeof val === 'string' || typeof val === 'number') {
            date = new Date(val);
        } else if (val.toDate && typeof val.toDate === 'function') {
            date = val.toDate();
        } else {
            return '-';
        }
        return date.toLocaleString('zh-TW', { hour12: false });
    } catch {
        return '-';
    }
}

export default function AdminPredictionsPage() {
    const db = useFirestore();
    const { toast } = useToast();
    const eventsCollection = useMemoFirebase(() => collection(db, 'predictionEvents'), [db]);
    const { data: events, isLoading } = useCollection<PredictionEvent>(eventsCollection);

    // 載入所有玩家的預測記錄
    const predictionsCollection = useMemoFirebase(() => collection(db, 'userPredictions'), [db]);
    const { data: allPredictions } = useCollection<UserPredictionRecord>(predictionsCollection);

    // 依 eventId 分組預測名單
    const predictionsByEvent = useMemo(() => {
        const map: Record<string, UserPredictionRecord[]> = {};
        if (!allPredictions) return map;
        allPredictions.forEach((pred) => {
            if (pred.eventId && pred.confirmed !== false) {
                if (!map[pred.eventId]) {
                    map[pred.eventId] = [];
                }
                map[pred.eventId].push(pred);
            }
        });
        return map;
    }, [allPredictions]);

    // 預測名單 Modal 狀態
    const [selectedEventForRoster, setSelectedEventForRoster] = useState<PredictionEvent | null>(null);
    const [rosterOptionFilter, setRosterOptionFilter] = useState<string>('all');
    const [rosterSearch, setRosterSearch] = useState<string>('');

    // 新增 Modal 狀態
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createMatchName, setCreateMatchName] = useState('');
    const [createQuestion, setCreateQuestion] = useState('');
    const [createOptions, setCreateOptions] = useState('');
    const [createReward, setCreateReward] = useState('100');
    const [createBettingEndTime, setCreateBettingEndTime] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 編輯 Modal 狀態
    const [editingEvent, setEditingEvent] = useState<PredictionEvent | null>(null);
    const [editMatchName, setEditMatchName] = useState('');
    const [editQuestion, setEditQuestion] = useState('');
    const [editOptions, setEditOptions] = useState('');
    const [editReward, setEditReward] = useState('100');
    const [editBettingEndTime, setEditBettingEndTime] = useState('');
    const [editStatus, setEditStatus] = useState<'open' | 'closed' | 'finished'>('open');
    const [editWinningOptions, setEditWinningOptions] = useState<string[]>([]);

    // 開啟名單視窗
    const handleOpenRoster = (event: PredictionEvent) => {
        setSelectedEventForRoster(event);
        setRosterOptionFilter('all');
        setRosterSearch('');
    };

    // 開啟編輯視窗並帶入資料
    const handleOpenEdit = (event: PredictionEvent) => {
        setEditingEvent(event);
        setEditMatchName(event.matchName || '');
        setEditQuestion(event.question || '');
        setEditOptions(Array.isArray(event.options) ? event.options.join(', ') : '');
        setEditReward((event.reward ?? 100).toString());
        setEditBettingEndTime(event.bettingEndTime || '');
        setEditStatus(event.status || 'open');
        setEditWinningOptions(getWinningOptions(event));
    };

    // 切換獲勝選項 (複選)
    const toggleWinningOption = (opt: string) => {
        setEditWinningOptions(prev => 
            prev.includes(opt) 
                ? prev.filter(item => item !== opt) 
                : [...prev, opt]
        );
    };

    // 新增賽事
    const handleCreateEvent = async () => {
        if (!createMatchName.trim() || !createQuestion.trim() || !createOptions.trim() || !createBettingEndTime) {
            toast({ variant: 'destructive', title: '請填寫所有必要欄位' });
            return;
        }

        const optionsArray = createOptions.split(/[,，]/).map(o => o.trim()).filter(Boolean);
        if (optionsArray.length < 2) {
            toast({ variant: 'destructive', title: '預測選項至少需要 2 個' });
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(eventsCollection, {
                matchName: createMatchName.trim(),
                question: createQuestion.trim(),
                options: optionsArray,
                reward: Number(createReward) || 100,
                bettingEndTime: createBettingEndTime,
                startTime: new Date().toISOString(),
                status: 'open',
                winningOption: '',
                winningOptions: []
            });

            toast({ title: '新增賽事預測成功！' });
            setIsCreateOpen(false);
            setCreateMatchName('');
            setCreateQuestion('');
            setCreateOptions('');
            setCreateReward('100');
            setCreateBettingEndTime('');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '新增失敗，請稍後再試' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // 儲存編輯
    const handleSaveEdit = async () => {
        if (!editingEvent) return;

        if (!editMatchName.trim() || !editQuestion.trim() || !editOptions.trim() || !editBettingEndTime) {
            toast({ variant: 'destructive', title: '請填寫所有必要欄位' });
            return;
        }

        const optionsArray = editOptions.split(/[,，]/).map(o => o.trim()).filter(Boolean);
        if (optionsArray.length < 2) {
            toast({ variant: 'destructive', title: '預測選項至少需要 2 個' });
            return;
        }

        const validWinningOptions = editWinningOptions.filter(opt => optionsArray.includes(opt));
        const finalWinningOptions = editStatus === 'finished' ? validWinningOptions : validWinningOptions;
        const finalWinningString = finalWinningOptions.join(', ');

        setIsSubmitting(true);
        try {
            const eventRef = doc(db, 'predictionEvents', editingEvent.id);
            await updateDoc(eventRef, {
                matchName: editMatchName.trim(),
                question: editQuestion.trim(),
                options: optionsArray,
                reward: Number(editReward) || 0,
                bettingEndTime: editBettingEndTime,
                status: editStatus,
                winningOption: finalWinningString,
                winningOptions: finalWinningOptions
            });

            toast({ title: '賽事預測已成功修改！' });
            setEditingEvent(null);
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '更新失敗，請再試一次' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // 刪除賽事
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`確定要刪除賽事「${name}」嗎？此操作無法復原。`)) return;

        try {
            await deleteDoc(doc(db, 'predictionEvents', id));
            toast({ title: '已成功刪除該賽事預測' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '刪除失敗' });
        }
    };

    // 計算全站統計數據
    const totalPredictionsCount = allPredictions ? allPredictions.length : 0;

    return (
        <div className="space-y-8 text-slate-900">
            {/* 標題與操作按鈕 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shrink-0">
                        <Trophy className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                            賽事預測管理
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        </h1>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">
                            發起體育或電競賽事預測題，設定選項、獎勵點數與開獎答案，並檢視全體玩家預測名單。
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
                        <Users className="w-4 h-4 text-orange-500" />
                        <span>總下注筆數：<strong className="text-slate-900 font-mono">{totalPredictionsCount}</strong></span>
                    </div>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl font-black bg-slate-900 text-white hover:bg-slate-800 shadow-lg px-5 h-11 flex items-center gap-2">
                                <Plus className="w-4 h-4" />
                                新增預測賽事
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="light w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl border-none p-0 overflow-hidden text-slate-900">
                            <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50">
                                <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                                    <Trophy className="w-5 h-5 text-amber-500" /> 新增預測賽事
                                </DialogTitle>
                                <p className="text-xs text-slate-500 font-bold mt-1">建立全新的賽事下注預測活動</p>
                            </DialogHeader>

                            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-black text-slate-700">比賽名稱 (例: NBA 總決賽 G7)</Label>
                                    <Input 
                                        placeholder="輸入賽事標題..." 
                                        value={createMatchName} 
                                        onChange={e => setCreateMatchName(e.target.value)} 
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-black text-slate-700">預測問題 (例: 哪一隊將獲得最終總冠軍？)</Label>
                                    <Input 
                                        placeholder="輸入題目問題..." 
                                        value={createQuestion} 
                                        onChange={e => setCreateQuestion(e.target.value)} 
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-black text-slate-700">預測選項 (用逗號分隔，例: 塞爾提克, 獨行俠)</Label>
                                    <Input 
                                        placeholder="選項1, 選項2, 選項3" 
                                        value={createOptions} 
                                        onChange={e => setCreateOptions(e.target.value)} 
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                    />
                                    <p className="text-[11px] text-slate-400 font-bold">請輸入多個可供選擇的結果，以半形或全形逗號隔開。</p>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-black text-slate-700">猜對獎勵 P+ 點數</Label>
                                        <Input 
                                            type="number" 
                                            value={createReward} 
                                            onChange={e => setCreateReward(e.target.value)} 
                                            className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-black text-slate-700">下注截止時間</Label>
                                        <Input 
                                            type="datetime-local" 
                                            value={createBettingEndTime} 
                                            onChange={e => setCreateBettingEndTime(e.target.value)} 
                                            className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                                        />
                                    </div>
                                </div>
                            </div>

                            <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50 gap-2">
                                <Button variant="outline" onClick={() => setIsCreateOpen(false)} className="rounded-xl font-bold border-slate-200">取消</Button>
                                <Button onClick={handleCreateEvent} disabled={isSubmitting} className="rounded-xl bg-slate-900 text-white font-black px-6 hover:bg-slate-800">
                                    {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : '確認建立賽事'}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* 賽事列表展示 */}
            <Card className="border-slate-200 shadow-sm rounded-3xl bg-white overflow-hidden">
                <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                    <CardTitle className="text-base font-black flex items-center gap-2">
                        <Trophy className="h-5 w-5 text-amber-500" /> 現有賽事預測列表
                    </CardTitle>
                    <CardDescription className="text-xs font-bold text-slate-500">檢視、編輯、關閉、結算全站賽事預測活動，或查看各賽事的玩家預測名單。</CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50">
                            <TableRow className="border-b-slate-200">
                                <TableHead className="pl-6 font-black text-slate-900 text-[10px] uppercase">比賽名稱 / 狀態</TableHead>
                                <TableHead className="font-black text-slate-900 text-[10px] uppercase">預測問題</TableHead>
                                <TableHead className="font-black text-slate-900 text-[10px] uppercase">可選項目</TableHead>
                                <TableHead className="font-black text-slate-900 text-[10px] uppercase">猜對獎勵</TableHead>
                                <TableHead className="font-black text-slate-900 text-[10px] uppercase">預測名單</TableHead>
                                <TableHead className="font-black text-slate-900 text-[10px] uppercase">截止時間</TableHead>
                                <TableHead className="text-right pr-6 font-black text-slate-900 text-[10px] uppercase">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events && events.length > 0 ? (
                                events.map((event) => {
                                    const isEnded = new Date() > new Date(event.bettingEndTime);
                                    const status = event.status || (isEnded ? 'closed' : 'open');
                                    const winningList = getWinningOptions(event);
                                    const eventPreds = predictionsByEvent[event.id] || [];
                                    const bettorsCount = eventPreds.length;

                                    return (
                                        <TableRow key={event.id} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                                            <TableCell className="pl-6 py-4 font-bold text-slate-900">
                                                <div className="space-y-1">
                                                    <div className="font-black text-sm text-slate-900">{event.matchName}</div>
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {status === 'open' && (
                                                            <Badge className="bg-emerald-100 text-emerald-800 border-none font-black text-[9px]">
                                                                開放下注中
                                                            </Badge>
                                                        )}
                                                        {status === 'closed' && (
                                                            <Badge variant="secondary" className="bg-slate-200 text-slate-700 border-none font-black text-[9px]">
                                                                已截止下注
                                                            </Badge>
                                                        )}
                                                        {status === 'finished' && (
                                                            <Badge className="bg-amber-100 text-amber-800 border-none font-black text-[9px]">
                                                                已開獎結算
                                                            </Badge>
                                                        )}
                                                        {winningList.length > 0 && (
                                                            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                                                                <CheckCircle2 className="w-3 h-3 text-amber-500 shrink-0" />
                                                                勝出: {winningList.join(' / ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-slate-800 text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <Target className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    {event.question}
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {event.options?.map((opt) => {
                                                        const isWinner = winningList.includes(opt);
                                                        const optCount = eventPreds.filter(p => p.option === opt).length;
                                                        return (
                                                            <Badge key={opt} variant="outline" className={cn("text-[10px] font-bold border-slate-200 bg-white", isWinner && "border-amber-400 bg-amber-50 text-amber-800 font-black shadow-xs")}>
                                                                {isWinner && "🏆 "}
                                                                {opt} ({optCount})
                                                            </Badge>
                                                        );
                                                    })}
                                                </div>
                                            </TableCell>
                                            <TableCell className="font-bold text-amber-600 font-code text-sm">
                                                <span className="flex items-center gap-1">
                                                    +{event.reward || 0} <PPlusIcon className="w-3.5 h-3.5" />
                                                </span>
                                            </TableCell>

                                            {/* 玩家預測名單按鈕 */}
                                            <TableCell>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleOpenRoster(event)}
                                                    className={cn(
                                                        "h-8 text-xs rounded-xl font-bold border-slate-200 flex items-center gap-1.5 transition-all shadow-xs",
                                                        bettorsCount > 0 
                                                            ? "bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100 hover:text-orange-800" 
                                                            : "bg-slate-50 text-slate-500 hover:bg-slate-100"
                                                    )}
                                                >
                                                    <Users className="w-3.5 h-3.5 text-orange-500" />
                                                    <span>名單 ({bettorsCount}人)</span>
                                                </Button>
                                            </TableCell>

                                            <TableCell className="font-bold text-slate-500 text-xs font-mono">
                                                <div className="flex items-center gap-1">
                                                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                                                    {event.bettingEndTime ? event.bettingEndTime.replace('T', ' ') : '-'}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6 py-4">
                                                <div className="flex justify-end gap-2">
                                                    {/* 編輯按鈕 */}
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => handleOpenEdit(event)} 
                                                        className="h-8 text-[11px] rounded-lg font-black bg-white border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center gap-1"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5 text-slate-500" />
                                                        編輯
                                                    </Button>

                                                    {/* 刪除按鈕 */}
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => handleDelete(event.id, event.matchName)} 
                                                        className="h-8 text-[11px] rounded-lg font-black border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 flex items-center gap-1"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                        刪除
                                                    </Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-12 text-slate-400 font-bold">
                                        目前尚無預測賽事，請點擊上方「新增預測賽事」建立第一個題庫。
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

            {/* 後台：玩家預測名單檢視 Dialog (Admin Player Predictions Roster Dialog) */}
            {selectedEventForRoster && (() => {
                const event = selectedEventForRoster;
                const eventPreds = predictionsByEvent[event.id] || [];
                const winningList = getWinningOptions(event);
                const isFinished = event.status === 'finished';

                // 篩選與搜尋
                const filtered = eventPreds.filter(p => {
                    const matchOpt = rosterOptionFilter === 'all' || p.option === rosterOptionFilter;
                    const matchKw = !rosterSearch.trim() ||
                        (p.userName && p.userName.toLowerCase().includes(rosterSearch.toLowerCase())) ||
                        (p.userId && p.userId.toLowerCase().includes(rosterSearch.toLowerCase()));
                    return matchOpt && matchKw;
                });

                // 勝出玩家統計
                const winningBettors = eventPreds.filter(p => winningList.includes(p.option));
                const totalPayout = winningBettors.length * (event.reward || 0);

                return (
                    <Dialog open={!!selectedEventForRoster} onOpenChange={(open) => !open && setSelectedEventForRoster(null)}>
                        <DialogContent className="light w-[95vw] md:max-w-3xl rounded-3xl bg-white shadow-2xl border-none p-0 overflow-hidden text-slate-900 flex flex-col max-h-[88vh]">
                            <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50 shrink-0">
                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                    <div className="flex items-center gap-2">
                                        <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-bold">
                                            <Users className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                                                <span>玩家預測名單</span>
                                                <Badge variant="outline" className="text-xs border-orange-200 bg-orange-50 text-orange-700 font-black">
                                                    {eventPreds.length} 位玩家下注
                                                </Badge>
                                            </DialogTitle>
                                            <p className="text-xs text-slate-500 font-bold mt-0.5">
                                                賽事：{event.matchName} ｜ 題目：{event.question}
                                            </p>
                                        </div>
                                    </div>
                                    
                                    {isFinished && winningList.length > 0 && (
                                        <div className="px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-800 flex items-center gap-1.5">
                                            <Trophy className="w-4 h-4 text-amber-500" />
                                            <span>勝出答案：<strong>{winningList.join(' / ')}</strong></span>
                                            <span className="text-slate-400">|</span>
                                            <span>猜中人數：<strong>{winningBettors.length}</strong> (預計發放 {totalPayout} P+)</span>
                                        </div>
                                    )}
                                </div>
                            </DialogHeader>

                            {/* 統計指標與選項分佈 */}
                            <div className="p-6 pb-2 space-y-4 shrink-0 bg-slate-50/50 border-b border-slate-100">
                                {/* 選項分佈進度條 */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {event.options?.map(opt => {
                                        const count = eventPreds.filter(p => p.option === opt).length;
                                        const percent = eventPreds.length > 0 ? Math.round((count / eventPreds.length) * 100) : 0;
                                        const isWinner = winningList.includes(opt);

                                        return (
                                            <div key={opt} className={cn(
                                                "p-3 rounded-2xl border bg-white shadow-xs space-y-1",
                                                isWinner ? "border-amber-300 bg-amber-50/40 ring-1 ring-amber-200" : "border-slate-200"
                                            )}>
                                                <div className="flex items-center justify-between text-xs">
                                                    <span className="font-black text-slate-800 truncate flex items-center gap-1">
                                                        {isWinner && <Trophy className="w-3 h-3 text-amber-500 shrink-0" />}
                                                        {opt}
                                                    </span>
                                                    <span className="text-slate-400 font-mono font-bold">{percent}%</span>
                                                </div>
                                                <div className="flex items-baseline gap-1">
                                                    <span className="text-lg font-black text-slate-900">{count}</span>
                                                    <span className="text-[10px] text-slate-400 font-bold">人</span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* 篩選與搜尋列 */}
                                <div className="flex items-center gap-3 flex-wrap sm:flex-nowrap">
                                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5">
                                        <button
                                            type="button"
                                            onClick={() => setRosterOptionFilter('all')}
                                            className={cn(
                                                "px-3 py-1.5 rounded-xl text-xs font-black transition-all border whitespace-nowrap",
                                                rosterOptionFilter === 'all'
                                                    ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                                                    : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                            )}
                                        >
                                            全部選項 ({eventPreds.length})
                                        </button>
                                        {event.options?.map(opt => {
                                            const count = eventPreds.filter(p => p.option === opt).length;
                                            const isSelected = rosterOptionFilter === opt;
                                            return (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() => setRosterOptionFilter(opt)}
                                                    className={cn(
                                                        "px-3 py-1.5 rounded-xl text-xs font-black transition-all border flex items-center gap-1 whitespace-nowrap",
                                                        isSelected
                                                            ? "bg-orange-500 text-white border-orange-500 shadow-sm"
                                                            : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                                                    )}
                                                >
                                                    <span>{opt}</span>
                                                    <span className="font-mono text-[10px] opacity-80">({count})</span>
                                                </button>
                                            );
                                        })}
                                    </div>

                                    <div className="relative flex-1 min-w-[180px]">
                                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                        <Input
                                            placeholder="搜尋玩家姓名或 UID..."
                                            value={rosterSearch}
                                            onChange={(e) => setRosterSearch(e.target.value)}
                                            className="h-9 pl-9 pr-3 rounded-xl bg-white border-slate-200 text-xs font-bold"
                                        />
                                        {rosterSearch && (
                                            <button 
                                                type="button" 
                                                onClick={() => setRosterSearch('')}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* 玩家預測列表 Table */}
                            <div className="flex-1 overflow-y-auto p-0 min-h-[260px]">
                                <Table>
                                    <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                        <TableRow className="border-b-slate-200">
                                            <TableHead className="pl-6 font-black text-slate-900 text-[10px] uppercase">玩家</TableHead>
                                            <TableHead className="font-black text-slate-900 text-[10px] uppercase">預測選項</TableHead>
                                            <TableHead className="font-black text-slate-900 text-[10px] uppercase">結果狀態</TableHead>
                                            <TableHead className="font-black text-slate-900 text-[10px] uppercase">下注時間</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filtered.length > 0 ? (
                                            filtered.map((pred, index) => {
                                                const isWinner = isFinished && winningList.includes(pred.option);
                                                const timeStr = formatTime(pred.timestamp || pred.createdAt);

                                                return (
                                                    <TableRow key={pred.id || `${pred.userId}_${index}`} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                                                        <TableCell className="pl-6 py-3">
                                                            <div className="flex items-center gap-2.5">
                                                                <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center overflow-hidden shrink-0">
                                                                    {pred.userAvatar ? (
                                                                        <img src={pred.userAvatar} alt="" className="w-full h-full object-cover" />
                                                                    ) : (
                                                                        <User className="w-4 h-4 text-slate-400" />
                                                                    )}
                                                                </div>
                                                                <div>
                                                                    <div className="font-black text-xs text-slate-900">
                                                                        {pred.userName || '匿名玩家'}
                                                                    </div>
                                                                    <div className="text-[10px] text-slate-400 font-mono">
                                                                        UID: {pred.userId}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge className={cn(
                                                                "font-black text-xs px-2.5 py-1 rounded-lg border shadow-xs",
                                                                isWinner 
                                                                    ? "bg-amber-100 text-amber-900 border-amber-300" 
                                                                    : "bg-slate-100 text-slate-800 border-slate-200"
                                                            )}>
                                                                {isWinner && "🏆 "}
                                                                {pred.option}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {isFinished ? (
                                                                isWinner ? (
                                                                    <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-black text-[10px]">
                                                                        <Sparkles className="w-3 h-3 mr-1" />
                                                                        猜中勝出 (+{event.reward || 0} P+)
                                                                    </Badge>
                                                                ) : (
                                                                    <Badge variant="secondary" className="bg-slate-100 text-slate-500 border-slate-200 font-bold text-[10px]">
                                                                        未猜中
                                                                    </Badge>
                                                                )
                                                            ) : (
                                                                <Badge variant="outline" className="border-blue-200 bg-blue-50 text-blue-700 font-bold text-[10px]">
                                                                    已下注待開獎
                                                                </Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="font-mono text-xs text-slate-500 font-bold">
                                                            {timeStr}
                                                        </TableCell>
                                                    </TableRow>
                                                );
                                            })
                                        ) : (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center py-12 text-slate-400 font-bold">
                                                    {rosterSearch ? "查無符合關鍵字的玩家紀錄" : "目前尚無玩家對此賽事進行預測下注。"}
                                                </TableCell>
                                            </TableRow>
                                        )}
                                    </TableBody>
                                </Table>
                            </div>

                            <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                                <span className="text-xs text-slate-400 font-bold">
                                    顯示 {filtered.length} / {eventPreds.length} 筆預測紀錄
                                </span>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setSelectedEventForRoster(null)} 
                                    className="rounded-xl font-bold border-slate-200 text-slate-700"
                                >
                                    關閉名單
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                );
            })()}

            {/* 編輯對話框 */}
            {editingEvent && (
                <Dialog open={!!editingEvent} onOpenChange={(open) => !open && setEditingEvent(null)}>
                    <DialogContent className="light w-[95vw] md:max-w-lg rounded-3xl bg-white shadow-2xl border-none p-0 overflow-hidden text-slate-900">
                        <DialogHeader className="p-6 border-b border-slate-100 bg-slate-50">
                            <DialogTitle className="text-xl font-black text-slate-900 flex items-center gap-2">
                                <Pencil className="w-5 h-5 text-sky-600" /> 編輯預測賽事
                            </DialogTitle>
                            <p className="text-xs text-slate-500 font-bold mt-1">修改比賽資訊、選項、狀態或設定最終開獎優勝結果</p>
                        </DialogHeader>

                        <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-black text-slate-700">比賽名稱</Label>
                                <Input 
                                    value={editMatchName} 
                                    onChange={e => setEditMatchName(e.target.value)} 
                                    className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-black text-slate-700">預測問題</Label>
                                <Input 
                                    value={editQuestion} 
                                    onChange={e => setEditQuestion(e.target.value)} 
                                    className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-black text-slate-700">預測選項 (用逗號分隔)</Label>
                                <Input 
                                    value={editOptions} 
                                    onChange={e => setEditOptions(e.target.value)} 
                                    className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-black text-slate-700">猜對獎勵 P+ 點數</Label>
                                    <Input 
                                        type="number" 
                                        value={editReward} 
                                        onChange={e => setEditReward(e.target.value)} 
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-black text-slate-700">下注截止時間</Label>
                                    <Input 
                                        type="datetime-local" 
                                        value={editBettingEndTime} 
                                        onChange={e => setEditBettingEndTime(e.target.value)} 
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-slate-100">
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-black text-slate-700">賽事狀態</Label>
                                    <Select value={editStatus} onValueChange={(val: any) => setEditStatus(val)}>
                                        <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                            <SelectItem value="open" className="font-bold text-emerald-600">🟢 開放下注中 (open)</SelectItem>
                                            <SelectItem value="closed" className="font-bold text-slate-600">🔴 已截止下注 (closed)</SelectItem>
                                            <SelectItem value="finished" className="font-bold text-amber-600">🏆 已開獎結算 (finished)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5 col-span-2">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                                            <Trophy className="w-4 h-4 text-amber-500" />
                                            獲勝選項 (答案 - 可複選)
                                        </Label>
                                        {editWinningOptions.length > 0 && (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 text-[11px] text-slate-400 hover:text-red-500 font-bold px-2"
                                                onClick={() => setEditWinningOptions([])}
                                            >
                                                清空選項
                                            </Button>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-slate-400 font-bold">點擊下方按鈕可複選多個獲勝答案，再次點擊取消：</p>
                                    <div className="flex flex-wrap gap-2 pt-1">
                                        {editOptions.split(/[,，]/).map(o => o.trim()).filter(Boolean).map(opt => {
                                            const isSelected = editWinningOptions.includes(opt);
                                            return (
                                                <button
                                                    key={opt}
                                                    type="button"
                                                    onClick={() => toggleWinningOption(opt)}
                                                    className={cn(
                                                        "px-3.5 py-2 rounded-xl text-xs font-black border transition-all flex items-center gap-1.5 cursor-pointer select-none",
                                                        isSelected 
                                                            ? "bg-amber-500 text-white border-amber-600 shadow-md ring-2 ring-amber-300 scale-[1.02]" 
                                                            : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                                    )}
                                                >
                                                    {isSelected ? <CheckCircle2 className="w-4 h-4 text-white shrink-0" /> : <Trophy className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                                                    {opt}
                                                </button>
                                            );
                                        })}
                                        {editOptions.split(/[,，]/).map(o => o.trim()).filter(Boolean).length === 0 && (
                                            <span className="text-xs text-slate-400 font-bold italic">請先在上方的「預測選項」輸入選項項目</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <DialogFooter className="p-6 border-t border-slate-100 bg-slate-50 gap-2">
                            <Button variant="outline" onClick={() => setEditingEvent(null)} className="rounded-xl font-bold border-slate-200">取消</Button>
                            <Button onClick={handleSaveEdit} disabled={isSubmitting} className="rounded-xl bg-slate-900 text-white font-black px-6 hover:bg-slate-800">
                                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : '儲存賽事變更'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            )}
        </div>
    );
}
