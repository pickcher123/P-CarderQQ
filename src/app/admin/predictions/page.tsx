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
    Flame,
    Zap,
    TrendingUp,
    Calendar,
    ArrowUpRight,
    SlidersHorizontal,
    Check,
    Filter,
    Layers,
    LayoutGrid,
    List,
    Activity,
    RefreshCw,
    Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';
import type { SportsMatchOdd } from '@/app/api/admin/fetch-sports-odds/route';

export interface PredictionEvent {
    id: string;
    matchName: string;
    question: string;
    options: string[];
    reward: number;
    bettingEndTime: string;
    startTime?: string;
    status: 'open' | 'closed' | 'finished';
    sportCategory?: 'basketball' | 'baseball' | 'football' | 'esports' | 'other' | string;
    league?: string;
    winningOption?: string;
    winningOptions?: string[];
}

export type SportCategory = 'all' | 'basketball' | 'baseball' | 'football' | 'esports' | 'other';

export interface SportCategoryInfo {
    id: SportCategory;
    name: string;
    icon: string;
    badgeColor: string;
    activeBg: string;
    borderAccent: string;
    lightBg: string;
    textAccent: string;
}

export const SPORT_CATEGORIES: SportCategoryInfo[] = [
    { id: 'all', name: '全部運動', icon: '🏆', badgeColor: 'bg-slate-100 text-slate-800 border-slate-300', activeBg: 'bg-slate-900 text-white', borderAccent: 'border-slate-900', lightBg: 'bg-slate-50', textAccent: 'text-slate-900' },
    { id: 'basketball', name: '籃球', icon: '🏀', badgeColor: 'bg-orange-50 text-orange-700 border-orange-200', activeBg: 'bg-orange-600 text-white', borderAccent: 'border-orange-500', lightBg: 'bg-orange-50/50', textAccent: 'text-orange-600' },
    { id: 'baseball', name: '棒球', icon: '⚾', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200', activeBg: 'bg-blue-600 text-white', borderAccent: 'border-blue-500', lightBg: 'bg-blue-50/50', textAccent: 'text-blue-600' },
    { id: 'football', name: '足球', icon: '⚽', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200', activeBg: 'bg-emerald-600 text-white', borderAccent: 'border-emerald-500', lightBg: 'bg-emerald-50/50', textAccent: 'text-emerald-600' },
    { id: 'esports', name: '電競', icon: '🎮', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200', activeBg: 'bg-purple-600 text-white', borderAccent: 'border-purple-500', lightBg: 'bg-purple-50/50', textAccent: 'text-purple-600' },
    { id: 'other', name: '綜合 / 其他', icon: '🥊', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200', activeBg: 'bg-amber-600 text-white', borderAccent: 'border-amber-500', lightBg: 'bg-amber-50/50', textAccent: 'text-amber-600' },
];

export function detectSportCategory(event: { sportCategory?: string; category?: string; league?: string; matchName?: string; question?: string }): 'basketball' | 'baseball' | 'football' | 'esports' | 'other' {
    const rawCat = event.sportCategory || event.category;
    if (rawCat && ['basketball', 'baseball', 'football', 'esports', 'other'].includes(rawCat)) {
        return rawCat as any;
    }
    const text = `${event.league || ''} ${event.matchName || ''} ${event.question || ''}`.toLowerCase();
    
    // 籃球關鍵字
    if (/nba|籃球|p\.league|tpbl|t1|pleague|cba|wnba|湖人|勇士|塞爾提克|獨行俠|快艇|太陽|公牛|熱火|金塊|公鹿|籃網|76人|尼克|騎士|溜馬|魔術|活塞|黃蜂|巫師|老鷹|暴龍|灰熊|鵜鶘|馬刺|火箭|拓荒者|爵士|國王|雷霆|灰狼|三分球|得分王|籃板|助攻|灌籃|basketball|gsw|lal|bos|dal|nyk/.test(text)) {
        return 'basketball';
    }
    // 棒球關鍵字
    if (/mlb|棒球|cpbl|中職|日職|韓職|道奇|洋基|大谷|經典賽|wbc|兄弟|統一|樂天|富邦|味全|台鋼|紅襪|天使|巨人|教士|大都會|費城人|baseball|全壘打|勝投|安打|三振|打擊率|lad|nyy|sd/.test(text)) {
        return 'baseball';
    }
    // 足球關鍵字
    if (/足球|英超|歐冠|西甲|德甲|意甲|法甲|世界盃|歐國盃|歐聯|曼聯|曼城|利物浦|阿森納|切爾西|熱刺|皇馬|巴薩|拜仁|巴黎|梅西|c羅|soccer|football|進球|射手|角球|越位|premier league|champions league/.test(text)) {
        return 'football';
    }
    // 電競關鍵字
    if (/電競|lol|英雄聯盟|lpl|lck|pcs|lcs|lec|msi|s賽|傳說對決|gcs|aic|awc|瓦羅蘭|valorant|cs2|cs:go|dota|esports|faker|t1|gen\.g|blg|wbg|jdg|hle|edg|首殺|擊殺|吃巴龍|首塔/.test(text)) {
        return 'esports';
    }
    return 'other';
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

    // 分類與篩選狀態
    const [selectedSportCategory, setSelectedSportCategory] = useState<SportCategory>('all');
    const [selectedStatusFilter, setSelectedStatusFilter] = useState<'all' | 'open' | 'closed' | 'finished'>('all');
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [viewMode, setViewMode] = useState<'grouped' | 'table'>('grouped');

    // 新增 Modal 狀態
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [createMatchName, setCreateMatchName] = useState('');
    const [createSportCategory, setCreateSportCategory] = useState<'auto' | 'basketball' | 'baseball' | 'football' | 'esports' | 'other'>('auto');
    const [createQuestion, setCreateQuestion] = useState('');
    const [createOptions, setCreateOptions] = useState('');
    const [createReward, setCreateReward] = useState('100');
    const [createBettingEndTime, setCreateBettingEndTime] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // AI 賽事情報與盤口檢索狀態
    const [isAiSearchOpen, setIsAiSearchOpen] = useState(false);
    const [aiSearchQuery, setAiSearchQuery] = useState('');
    const [isAiSearching, setIsAiSearching] = useState(false);
    const [aiSearchResults, setAiSearchResults] = useState<SportsMatchOdd[]>([]);
    const [publishingMatchId, setPublishingMatchId] = useState<string | null>(null);

    // 編輯 Modal 狀態
    const [editingEvent, setEditingEvent] = useState<PredictionEvent | null>(null);
    const [editMatchName, setEditMatchName] = useState('');
    const [editSportCategory, setEditSportCategory] = useState<'basketball' | 'baseball' | 'football' | 'esports' | 'other'>('other');
    const [editQuestion, setEditQuestion] = useState('');
    const [editOptions, setEditOptions] = useState('');
    const [editReward, setEditReward] = useState('100');
    const [editBettingEndTime, setEditBettingEndTime] = useState('');
    const [editStatus, setEditStatus] = useState<'open' | 'closed' | 'finished'>('open');
    const [editWinningOptions, setEditWinningOptions] = useState<string[]>([]);

    // 依運動分類與條件篩選賽事
    const filteredEvents = useMemo(() => {
        if (!events) return [];
        return events.filter(event => {
            const cat = detectSportCategory(event);
            // 運動分類過濾
            if (selectedSportCategory !== 'all' && cat !== selectedSportCategory) {
                return false;
            }

            // 狀態過濾
            const isEnded = new Date() > new Date(event.bettingEndTime);
            const status = event.status || (isEnded ? 'closed' : 'open');
            if (selectedStatusFilter !== 'all' && status !== selectedStatusFilter) {
                return false;
            }

            // 關鍵字搜尋
            if (searchKeyword.trim()) {
                const kw = searchKeyword.trim().toLowerCase();
                const matchName = (event.matchName || '').toLowerCase();
                const question = (event.question || '').toLowerCase();
                const options = Array.isArray(event.options) ? event.options.join(' ').toLowerCase() : '';
                if (!matchName.includes(kw) && !question.includes(kw) && !options.includes(kw)) {
                    return false;
                }
            }

            return true;
        });
    }, [events, selectedSportCategory, selectedStatusFilter, searchKeyword]);

    // 依運動分類分組統計
    const sportStats = useMemo(() => {
        const counts: Record<SportCategory, number> = {
            all: 0,
            basketball: 0,
            baseball: 0,
            football: 0,
            esports: 0,
            other: 0,
        };
        if (!events) return counts;

        counts.all = events.length;
        events.forEach(ev => {
            const cat = detectSportCategory(ev);
            if (counts[cat] !== undefined) {
                counts[cat] += 1;
            } else {
                counts.other += 1;
            }
        });
        return counts;
    }, [events]);

    // 依運動分類將賽事分群
    const eventsGroupedBySport = useMemo(() => {
        const groups: Record<string, PredictionEvent[]> = {
            basketball: [],
            baseball: [],
            football: [],
            esports: [],
            other: [],
        };
        filteredEvents.forEach(ev => {
            const cat = detectSportCategory(ev);
            if (groups[cat]) {
                groups[cat].push(ev);
            } else {
                groups.other.push(ev);
            }
        });
        return groups;
    }, [filteredEvents]);

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
        setEditSportCategory(detectSportCategory(event));
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

        const finalCategory = createSportCategory === 'auto'
            ? detectSportCategory({ matchName: createMatchName, question: createQuestion })
            : createSportCategory;

        setIsSubmitting(true);
        try {
            await addDoc(eventsCollection, {
                matchName: createMatchName.trim(),
                sportCategory: finalCategory,
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
            setCreateSportCategory('auto');
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
                sportCategory: editSportCategory,
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

    // 執行 AI 賽事與盤口檢索
    const handleFetchSportsOdds = async (customQuery?: string) => {
        const queryToUse = typeof customQuery === 'string' ? customQuery : aiSearchQuery;
        setIsAiSearching(true);
        try {
            const res = await fetch('/api/admin/fetch-sports-odds', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: queryToUse })
            });
            const data = await res.json();
            if (data.success && Array.isArray(data.matches)) {
                setAiSearchResults(data.matches);
                if (data.warning) {
                    toast({
                        title: '已載入精選賽事與盤口資料',
                        description: data.warning,
                    });
                } else {
                    toast({
                        title: 'AI 賽事與盤口檢索成功',
                        description: `成功找到 ${data.matches.length} 場比賽時間與主客讓分盤口！`,
                    });
                }
            } else {
                toast({
                    variant: 'destructive',
                    title: '檢索失敗',
                    description: data.warning || '無法獲取賽事盤口資料，請稍後重試。'
                });
            }
        } catch (err: any) {
            console.error('Fetch sports odds error:', err);
            toast({
                variant: 'destructive',
                title: '連線錯誤',
                description: '請檢查網路連線或 API 設定。'
            });
        } finally {
            setIsAiSearching(false);
        }
    };

    // 一鍵直接發布 AI 賽事為預測活動
    const handleDirectPublishAiMatch = async (match: SportsMatchOdd) => {
        setPublishingMatchId(match.id);
        const autoCat = detectSportCategory({
            league: match.league,
            matchName: match.matchName,
            question: match.suggestedQuestion,
        });

        try {
            await addDoc(eventsCollection, {
                matchName: match.matchName,
                league: match.league,
                sportCategory: autoCat,
                question: match.suggestedQuestion,
                options: match.suggestedOptions,
                reward: 100,
                bettingEndTime: match.bettingEndTime || match.matchTime.replace(' ', 'T'),
                startTime: new Date().toISOString(),
                status: 'open',
                winningOption: '',
                winningOptions: []
            });

            toast({
                title: '發布成功！',
                description: `已將「${match.matchName}」歸類為【${SPORT_CATEGORIES.find(c => c.id === autoCat)?.name || '運動'}】並發布。`
            });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '發布失敗，請稍後重試' });
        } finally {
            setPublishingMatchId(null);
        }
    };

    // 帶入建立表單並微調
    const handleApplyMatchToCreateForm = (match: SportsMatchOdd) => {
        const autoCat = detectSportCategory({
            league: match.league,
            matchName: match.matchName,
            question: match.suggestedQuestion,
        });
        setCreateMatchName(match.matchName);
        setCreateSportCategory(autoCat);
        setCreateQuestion(match.suggestedQuestion);
        setCreateOptions(match.suggestedOptions.join(', '));
        setCreateReward('100');
        setCreateBettingEndTime(match.bettingEndTime || match.matchTime.replace(' ', 'T'));
        setIsAiSearchOpen(false);
        setIsCreateOpen(true);
        toast({
            title: '已帶入建立表單',
            description: '已自動辨識運動分類，您可以自由微調預測題目或獎勵後送出。'
        });
    };

    // 計算全站統計數據
    const totalPredictionsCount = allPredictions ? allPredictions.length : 0;

    return (
        <div className="space-y-8 text-slate-900 pb-12">
            {/* 標題與操作按鈕 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-white shrink-0 shadow-md">
                        <Trophy className="w-6 h-6 text-amber-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
                            賽事預測管理
                            {isLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
                        </h1>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">
                            依運動項目管理體育與電競賽事預測，支援 AI 盤口檢索、獎勵點數設定、獲勝答案結算與玩家名單檢視。
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-600">
                        <Users className="w-4 h-4 text-orange-500" />
                        <span>總下注筆數：<strong className="text-slate-900 font-mono">{totalPredictionsCount}</strong></span>
                    </div>

                    {/* AI 賽事與盤口檢索按鈕 */}
                    <Button 
                        onClick={() => {
                            setIsAiSearchOpen(true);
                            if (aiSearchResults.length === 0) {
                                handleFetchSportsOdds('');
                            }
                        }}
                        className="rounded-xl font-black bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white shadow-md px-4 h-11 flex items-center gap-2 transition-all hover:scale-[1.02]"
                    >
                        <Sparkles className="w-4 h-4 text-amber-300 animate-pulse" />
                        <span>AI 賽事與盤口檢索</span>
                    </Button>

                    <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
                        <DialogTrigger asChild>
                            <Button className="rounded-xl font-black bg-slate-900 text-white hover:bg-slate-800 shadow-lg px-5 h-11 flex items-center gap-2 transition-all hover:scale-[1.02]">
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
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-2 space-y-1.5">
                                        <Label className="text-xs font-black text-slate-700">比賽名稱 (例: NBA 湖人 vs 勇士)</Label>
                                        <Input 
                                            placeholder="輸入賽事標題..." 
                                            value={createMatchName} 
                                            onChange={e => {
                                                setCreateMatchName(e.target.value);
                                                if (createSportCategory === 'auto') {
                                                    // 自動即時偵測
                                                }
                                            }} 
                                            className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <Label className="text-xs font-black text-slate-700">運動分類</Label>
                                        <Select 
                                            value={createSportCategory} 
                                            onValueChange={(val: any) => setCreateSportCategory(val)}
                                        >
                                            <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white">
                                                <SelectItem value="auto" className="font-bold text-slate-600">✨ 智慧自動判斷</SelectItem>
                                                <SelectItem value="basketball" className="font-bold text-orange-600">🏀 籃球</SelectItem>
                                                <SelectItem value="baseball" className="font-bold text-blue-600">⚾ 棒球</SelectItem>
                                                <SelectItem value="football" className="font-bold text-emerald-600">⚽ 足球</SelectItem>
                                                <SelectItem value="esports" className="font-bold text-purple-600">🎮 電競</SelectItem>
                                                <SelectItem value="other" className="font-bold text-amber-600">🥊 綜合 / 其他</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-black text-slate-700">預測問題 (例: 哪一隊將獲勝？或 讓分盤誰能過盤？)</Label>
                                    <Input 
                                        placeholder="輸入題目問題..." 
                                        value={createQuestion} 
                                        onChange={e => setCreateQuestion(e.target.value)} 
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-black text-slate-700">預測選項 (用逗號分隔，例: 湖人 (+3.5), 勇士 (-3.5))</Label>
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

            {/* 運動分類篩選卡片列表 (Sport Category Filter Cards) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {SPORT_CATEGORIES.map((cat) => {
                    const count = sportStats[cat.id] || 0;
                    const isSelected = selectedSportCategory === cat.id;

                    return (
                        <button
                            key={cat.id}
                            type="button"
                            onClick={() => setSelectedSportCategory(cat.id)}
                            className={cn(
                                "p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden flex flex-col justify-between group cursor-pointer",
                                isSelected
                                    ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900/20 scale-[1.02]"
                                    : "bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-2xs"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span className="text-xl group-hover:scale-110 transition-transform">
                                    {cat.icon}
                                </span>
                                <Badge
                                    variant="outline"
                                    className={cn(
                                        "text-[10px] font-mono font-bold px-1.5 py-0 h-5",
                                        isSelected
                                            ? "border-white/30 text-white bg-white/10"
                                            : "border-slate-200 text-slate-500 bg-slate-50"
                                    )}
                                >
                                    {count} 場
                                </Badge>
                            </div>
                            <div className="mt-3">
                                <div className={cn("text-xs font-black", isSelected ? "text-white" : "text-slate-900")}>
                                    {cat.name}
                                </div>
                                <div className={cn("text-[10px] font-bold mt-0.5", isSelected ? "text-slate-300" : "text-slate-400")}>
                                    {cat.id === 'all' ? '所有賽事' : `${count} 筆活動`}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* 篩選與檢視控制列 (Filter & View Toolbar) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap flex-1">
                    {/* 搜尋欄 */}
                    <div className="relative flex-1 min-w-[200px] max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <Input
                            placeholder="搜尋比賽名稱、題目、球隊或選項..."
                            value={searchKeyword}
                            onChange={e => setSearchKeyword(e.target.value)}
                            className="h-10 pl-9 pr-8 rounded-xl bg-slate-50 border-slate-200 text-xs font-bold"
                        />
                        {searchKeyword && (
                            <button
                                type="button"
                                onClick={() => setSearchKeyword('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    {/* 狀態過濾 */}
                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setSelectedStatusFilter('all')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-black transition-all",
                                selectedStatusFilter === 'all'
                                    ? "bg-white text-slate-900 shadow-2xs"
                                    : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            全部狀態
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedStatusFilter('open')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1",
                                selectedStatusFilter === 'open'
                                    ? "bg-emerald-500 text-white shadow-2xs"
                                    : "text-emerald-700 hover:bg-emerald-50"
                            )}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            開放中
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedStatusFilter('closed')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1",
                                selectedStatusFilter === 'closed'
                                    ? "bg-slate-700 text-white shadow-2xs"
                                    : "text-slate-600 hover:bg-slate-100"
                            )}
                        >
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            已截止
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedStatusFilter('finished')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1",
                                selectedStatusFilter === 'finished'
                                    ? "bg-amber-500 text-white shadow-2xs"
                                    : "text-amber-700 hover:bg-amber-50"
                            )}
                        >
                            <Trophy className="w-3 h-3" />
                            已開獎
                        </button>
                    </div>
                </div>

                {/* 視圖切換與數量提示 */}
                <div className="flex items-center justify-between md:justify-end gap-3 pt-2 md:pt-0 border-t md:border-t-0 border-slate-100">
                    <span className="text-xs font-bold text-slate-500">
                        符合條件：<strong className="text-slate-900 font-black">{filteredEvents.length}</strong> 場賽事
                    </span>

                    <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
                        <button
                            type="button"
                            onClick={() => setViewMode('grouped')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all",
                                viewMode === 'grouped'
                                    ? "bg-white text-slate-900 shadow-2xs"
                                    : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            運動分組
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('table')}
                            className={cn(
                                "px-3 py-1.5 rounded-lg text-xs font-black flex items-center gap-1.5 transition-all",
                                viewMode === 'table'
                                    ? "bg-white text-slate-900 shadow-2xs"
                                    : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            <List className="w-3.5 h-3.5" />
                            完整表格
                        </button>
                    </div>
                </div>
            </div>

            {/* 視圖 1: 運動分類分組檢視 (Grouped View) */}
            {viewMode === 'grouped' && (
                <div className="space-y-8">
                    {SPORT_CATEGORIES.filter(c => c.id !== 'all').map((cat) => {
                        // 如果有指定 sport filter 且非當前類別則跳過
                        if (selectedSportCategory !== 'all' && selectedSportCategory !== cat.id) {
                            return null;
                        }

                        const groupEvents = eventsGroupedBySport[cat.id] || [];
                        if (groupEvents.length === 0 && selectedSportCategory !== cat.id) {
                            return null;
                        }

                        return (
                            <div key={cat.id} className="space-y-3">
                                {/* 分類群組標題 */}
                                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xl">{cat.icon}</span>
                                        <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                            <span>{cat.name}</span>
                                            <Badge variant="outline" className={cn("text-xs font-bold", cat.badgeColor)}>
                                                {groupEvents.length} 場賽事
                                            </Badge>
                                        </h2>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCreateSportCategory(cat.id as any);
                                            setIsCreateOpen(true);
                                        }}
                                        className="text-xs font-bold text-slate-500 hover:text-slate-900 flex items-center gap-1 bg-white hover:bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200"
                                    >
                                        <Plus className="w-3 h-3" />
                                        <span>新增{cat.name}賽事</span>
                                    </button>
                                </div>

                                {/* 賽事卡片列表 */}
                                {groupEvents.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {groupEvents.map((event) => {
                                            const isEnded = new Date() > new Date(event.bettingEndTime);
                                            const status = event.status || (isEnded ? 'closed' : 'open');
                                            const winningList = getWinningOptions(event);
                                            const eventPreds = predictionsByEvent[event.id] || [];
                                            const bettorsCount = eventPreds.length;

                                            return (
                                                <Card key={event.id} className="rounded-2xl border-slate-200 bg-white hover:shadow-md transition-all flex flex-col justify-between overflow-hidden">
                                                    <div className="p-4 space-y-3">
                                                        {/* 卡片頭部：運動徽章、狀態、獎勵 */}
                                                        <div className="flex items-center justify-between gap-2">
                                                            <Badge className={cn("font-black text-[11px] px-2 py-0.5 border shadow-2xs", cat.badgeColor)}>
                                                                <span className="mr-1">{cat.icon}</span>
                                                                {cat.name}
                                                            </Badge>

                                                            <div className="flex items-center gap-1.5">
                                                                {status === 'open' && (
                                                                    <Badge className="bg-emerald-100 text-emerald-800 border-none font-black text-[9px]">
                                                                        開放中
                                                                    </Badge>
                                                                )}
                                                                {status === 'closed' && (
                                                                    <Badge variant="secondary" className="bg-slate-200 text-slate-700 border-none font-black text-[9px]">
                                                                        已截止
                                                                    </Badge>
                                                                )}
                                                                {status === 'finished' && (
                                                                    <Badge className="bg-amber-100 text-amber-800 border-none font-black text-[9px]">
                                                                        已開獎
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* 比賽名稱與題目 */}
                                                        <div>
                                                            <h3 className="font-black text-sm text-slate-900 line-clamp-1">
                                                                {event.matchName}
                                                            </h3>
                                                            <p className="text-xs text-slate-600 font-bold mt-1 flex items-start gap-1">
                                                                <Target className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                                <span className="line-clamp-2">{event.question}</span>
                                                            </p>
                                                        </div>

                                                        {/* 選項清單 */}
                                                        <div className="flex flex-wrap gap-1 pt-1">
                                                            {event.options?.map((opt) => {
                                                                const isWinner = winningList.includes(opt);
                                                                const optCount = eventPreds.filter(p => p.option === opt).length;
                                                                return (
                                                                    <Badge 
                                                                        key={opt} 
                                                                        variant="outline" 
                                                                        className={cn(
                                                                            "text-[10px] font-bold border-slate-200 bg-slate-50/50",
                                                                            isWinner && "border-amber-400 bg-amber-50 text-amber-800 font-black"
                                                                        )}
                                                                    >
                                                                        {isWinner && "🏆 "}
                                                                        {opt} ({optCount})
                                                                    </Badge>
                                                                );
                                                            })}
                                                        </div>

                                                        {/* 猜對結果或截止時間 */}
                                                        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
                                                            <span className="flex items-center gap-1 font-bold text-amber-600">
                                                                +{event.reward || 0} <PPlusIcon className="w-3 h-3" />
                                                            </span>
                                                            <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                                                                <Clock className="w-3 h-3" />
                                                                {event.bettingEndTime ? event.bettingEndTime.split('T')[0] : '-'}
                                                            </span>
                                                        </div>
                                                    </div>

                                                    {/* 底部操作按鈕列 */}
                                                    <div className="bg-slate-50/80 p-3 border-t border-slate-100 flex items-center justify-between gap-2">
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleOpenRoster(event)}
                                                            className={cn(
                                                                "h-8 text-xs rounded-xl font-bold flex items-center gap-1 border-slate-200 bg-white",
                                                                bettorsCount > 0 ? "text-orange-600 border-orange-200 hover:bg-orange-50" : "text-slate-600"
                                                            )}
                                                        >
                                                            <Users className="w-3.5 h-3.5 text-orange-500" />
                                                            <span>名單 ({bettorsCount})</span>
                                                        </Button>

                                                        <div className="flex items-center gap-1.5">
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => handleOpenEdit(event)}
                                                                className="h-8 text-xs rounded-xl font-black border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                                                            >
                                                                <Pencil className="w-3 h-3 mr-1" />
                                                                編輯
                                                            </Button>
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                onClick={() => handleDelete(event.id, event.matchName)}
                                                                className="h-8 w-8 p-0 rounded-xl text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </Card>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 font-bold text-xs">
                                        此運動分類目前沒有符合條件的賽事。
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 視圖 2: 完整表格列表檢視 (Table View) */}
            {viewMode === 'table' && (
                <Card className="border-slate-200 shadow-sm rounded-3xl bg-white overflow-hidden">
                    <CardHeader className="border-b border-slate-100 bg-slate-50/50">
                        <CardTitle className="text-base font-black flex items-center gap-2">
                            <Trophy className="h-5 w-5 text-amber-500" /> 賽事預測完整列表
                        </CardTitle>
                        <CardDescription className="text-xs font-bold text-slate-500">
                            顯示目前篩選條件下的所有賽事預測，支援批次檢視與編輯。
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-slate-50">
                                <TableRow className="border-b-slate-200">
                                    <TableHead className="pl-6 font-black text-slate-900 text-[10px] uppercase">運動 / 比賽名稱</TableHead>
                                    <TableHead className="font-black text-slate-900 text-[10px] uppercase">狀態</TableHead>
                                    <TableHead className="font-black text-slate-900 text-[10px] uppercase">預測問題</TableHead>
                                    <TableHead className="font-black text-slate-900 text-[10px] uppercase">可選項目</TableHead>
                                    <TableHead className="font-black text-slate-900 text-[10px] uppercase">猜對獎勵</TableHead>
                                    <TableHead className="font-black text-slate-900 text-[10px] uppercase">預測名單</TableHead>
                                    <TableHead className="font-black text-slate-900 text-[10px] uppercase">截止時間</TableHead>
                                    <TableHead className="text-right pr-6 font-black text-slate-900 text-[10px] uppercase">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEvents.length > 0 ? (
                                    filteredEvents.map((event) => {
                                        const cat = detectSportCategory(event);
                                        const catInfo = SPORT_CATEGORIES.find(c => c.id === cat) || SPORT_CATEGORIES[5];
                                        const isEnded = new Date() > new Date(event.bettingEndTime);
                                        const status = event.status || (isEnded ? 'closed' : 'open');
                                        const winningList = getWinningOptions(event);
                                        const eventPreds = predictionsByEvent[event.id] || [];
                                        const bettorsCount = eventPreds.length;

                                        return (
                                            <TableRow key={event.id} className="hover:bg-slate-50 transition-colors border-b-slate-100">
                                                <TableCell className="pl-6 py-4 font-bold text-slate-900">
                                                    <div className="space-y-1.5">
                                                        <Badge className={cn("text-[10px] font-bold border", catInfo.badgeColor)}>
                                                            <span className="mr-1">{catInfo.icon}</span>
                                                            {catInfo.name}
                                                        </Badge>
                                                        <div className="font-black text-sm text-slate-900">{event.matchName}</div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-col gap-1">
                                                        {status === 'open' && (
                                                            <Badge className="bg-emerald-100 text-emerald-800 border-none font-black text-[9px] w-fit">
                                                                開放下注中
                                                            </Badge>
                                                        )}
                                                        {status === 'closed' && (
                                                            <Badge variant="secondary" className="bg-slate-200 text-slate-700 border-none font-black text-[9px] w-fit">
                                                                已截止下注
                                                            </Badge>
                                                        )}
                                                        {status === 'finished' && (
                                                            <Badge className="bg-amber-100 text-amber-800 border-none font-black text-[9px] w-fit">
                                                                已開獎結算
                                                            </Badge>
                                                        )}
                                                        {winningList.length > 0 && (
                                                            <span className="text-[10px] text-amber-600 font-bold flex items-center gap-0.5 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 w-fit">
                                                                <CheckCircle2 className="w-3 h-3 text-amber-500 shrink-0" />
                                                                勝出: {winningList.join(' / ')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-800 text-xs max-w-xs">
                                                    <div className="flex items-start gap-1.5">
                                                        <Target className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                        <span>{event.question}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1 max-w-xs">
                                                        {event.options?.map((opt) => {
                                                            const isWinner = winningList.includes(opt);
                                                            const optCount = eventPreds.filter(p => p.option === opt).length;
                                                            return (
                                                                <Badge key={opt} variant="outline" className={cn("text-[10px] font-bold border-slate-200 bg-white", isWinner && "border-amber-400 bg-amber-50 text-amber-800 font-black shadow-2xs")}>
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
                                                            "h-8 text-xs rounded-xl font-bold border-slate-200 flex items-center gap-1.5 transition-all shadow-2xs",
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
                                        <TableCell colSpan={8} className="text-center py-12 text-slate-400 font-bold">
                                            {searchKeyword || selectedSportCategory !== 'all' || selectedStatusFilter !== 'all'
                                                ? "查無符合篩選條件的預測賽事。"
                                                : "目前尚無預測賽事，請點擊上方「新增預測賽事」建立第一個題庫。"}
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

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
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div className="sm:col-span-2 space-y-1.5">
                                    <Label className="text-xs font-black text-slate-700">比賽名稱</Label>
                                    <Input 
                                        value={editMatchName} 
                                        onChange={e => setEditMatchName(e.target.value)} 
                                        className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <Label className="text-xs font-black text-slate-700">運動分類</Label>
                                    <Select 
                                        value={editSportCategory} 
                                        onValueChange={(val: any) => setEditSportCategory(val)}
                                    >
                                        <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-slate-200 font-bold text-xs">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white">
                                            <SelectItem value="basketball" className="font-bold text-orange-600">🏀 籃球</SelectItem>
                                            <SelectItem value="baseball" className="font-bold text-blue-600">⚾ 棒球</SelectItem>
                                            <SelectItem value="football" className="font-bold text-emerald-600">⚽ 足球</SelectItem>
                                            <SelectItem value="esports" className="font-bold text-purple-600">🎮 電競</SelectItem>
                                            <SelectItem value="other" className="font-bold text-amber-600">🥊 綜合 / 其他</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
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

            {/* AI 賽事情報與盤口檢索 Dialog */}
            <Dialog open={isAiSearchOpen} onOpenChange={setIsAiSearchOpen}>
                <DialogContent className="light w-[95vw] md:max-w-4xl rounded-3xl bg-white shadow-2xl border-none p-0 overflow-hidden text-slate-900 max-h-[90vh] flex flex-col">
                    <DialogHeader className="p-6 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white shrink-0">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-400 to-cyan-400 flex items-center justify-center text-slate-900 shrink-0 font-black shadow-md">
                                    <Sparkles className="w-5 h-5 text-slate-950" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black text-white flex items-center gap-2">
                                        AI 賽事情報與盤口檢索小幫手
                                    </DialogTitle>
                                    <p className="text-xs text-slate-300 font-medium mt-0.5">
                                        利用 Gemini 3.7 聯網搜尋指定球隊最近比賽時間、主客對戰、讓分盤口 (Spread) 與大小分賠率
                                    </p>
                                </div>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* 搜尋與快選區 */}
                    <div className="p-6 pb-3 border-b border-slate-100 bg-slate-50/70 shrink-0 space-y-3">
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                <Input
                                    placeholder="輸入球隊名稱或聯賽 (例: 湖人, 道奇, 兄弟, 勇士, 曼城, NBA, CPBL)..."
                                    value={aiSearchQuery}
                                    onChange={e => setAiSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleFetchSportsOdds()}
                                    className="pl-10 h-11 rounded-xl bg-white border-slate-200 font-bold text-sm"
                                />
                            </div>
                            <Button
                                onClick={() => handleFetchSportsOdds()}
                                disabled={isAiSearching}
                                className="h-11 px-6 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-700 hover:to-cyan-700 text-white font-black shadow-md shrink-0 flex items-center gap-2"
                            >
                                {isAiSearching ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>AI 檢索中...</span>
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-4 h-4 text-amber-300" />
                                        <span>即時 AI 檢索</span>
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* 快捷標籤 */}
                        <div className="flex items-center gap-2 flex-wrap text-xs">
                            <span className="text-[11px] font-black text-slate-400 flex items-center gap-1">
                                <Flame className="w-3 h-3 text-orange-500" /> 熱門快選：
                            </span>
                            {[
                                { label: '🏀 NBA 勇士 / 湖人', query: 'NBA 勇士 湖人' },
                                { label: '⚾ MLB 道奇 / 教士', query: 'MLB 洛杉磯道奇' },
                                { label: '⚾ CPBL 中信兄弟', query: 'CPBL 中信兄弟' },
                                { label: '⚽ 英超 曼城 / 利物浦', query: '英超 曼城' },
                                { label: '🏀 TPBL / PLG 職籃', query: 'TPBL 台灣職籃' },
                                { label: '🔥 當前所有熱門賽事', query: '' },
                            ].map(preset => (
                                <button
                                    key={preset.label}
                                    type="button"
                                    onClick={() => {
                                        setAiSearchQuery(preset.query);
                                        handleFetchSportsOdds(preset.query);
                                    }}
                                    className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 hover:border-slate-300 font-bold transition-all text-[11px]"
                                >
                                    {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 檢索結果列表 */}
                    <div className="p-6 overflow-y-auto flex-1 space-y-4">
                        {isAiSearching ? (
                            <div className="space-y-4 py-8">
                                <div className="text-center space-y-2">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-600 mx-auto" />
                                    <p className="text-sm font-black text-slate-700">正在利用 AI 與 Google 搜尋最新賽事時間與運彩讓分盤口...</p>
                                    <p className="text-xs text-slate-400 font-medium">分析主客對戰、傷兵現況、盤口賠率與預測題目建議中</p>
                                </div>
                            </div>
                        ) : aiSearchResults.length > 0 ? (
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <p className="text-xs font-black text-slate-500">
                                        共找到 <strong className="text-indigo-600">{aiSearchResults.length}</strong> 場賽事與盤口情報
                                    </p>
                                    <span className="text-[11px] text-slate-400 font-medium">開賽時間均已換算為台灣時間 (GMT+8)</span>
                                </div>

                                {aiSearchResults.map((match) => {
                                    const matchSport = detectSportCategory({ league: match.league, matchName: match.matchName, question: match.suggestedQuestion });
                                    const sportInfo = SPORT_CATEGORIES.find(c => c.id === matchSport) || SPORT_CATEGORIES[5];

                                    return (
                                        <div 
                                            key={match.id}
                                            className="p-5 rounded-2xl border border-slate-200/90 bg-white hover:border-indigo-200 transition-all shadow-xs space-y-4"
                                        >
                                            {/* 賽事頭部 */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge className={cn("text-xs font-black px-2.5 py-0.5 border shadow-2xs", sportInfo.badgeColor)}>
                                                        <span className="mr-1">{sportInfo.icon}</span>
                                                        {sportInfo.name}
                                                    </Badge>
                                                    <Badge className="bg-indigo-50 text-indigo-700 border-indigo-200 font-black text-xs px-2.5 py-0.5">
                                                        {match.league}
                                                    </Badge>
                                                    <h3 className="text-base font-black text-slate-900">
                                                        {match.matchName}
                                                    </h3>
                                                </div>
                                                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 bg-slate-50 px-3 py-1.5 rounded-xl shrink-0">
                                                    <Clock className="w-3.5 h-3.5 text-cyan-600" />
                                                    <span>開賽：{match.matchTime}</span>
                                                </div>
                                            </div>

                                        {/* 盤口與賠率資訊展示卡 */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                            {/* 讓分盤 */}
                                            <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200/70 space-y-1">
                                                <div className="flex items-center justify-between text-[11px] font-black text-amber-900">
                                                    <span className="flex items-center gap-1">
                                                        <TrendingUp className="w-3.5 h-3.5 text-amber-600" /> 主客讓分 (Spread)
                                                    </span>
                                                    <Badge variant="outline" className="bg-amber-100/80 border-amber-300 text-amber-900 text-[10px] py-0 px-1.5 font-bold">
                                                        盤口
                                                    </Badge>
                                                </div>
                                                <p className="text-xs font-black text-slate-800 leading-snug">
                                                    {match.spread}
                                                </p>
                                            </div>

                                            {/* 獨贏賠率 */}
                                            {match.moneyline && (
                                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                                    <div className="text-[11px] font-black text-slate-500 flex items-center gap-1">
                                                        <Zap className="w-3.5 h-3.5 text-cyan-600" /> 不讓分獨贏 (Moneyline)
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-800 leading-snug">
                                                        {match.moneyline}
                                                    </p>
                                                </div>
                                            )}

                                            {/* 大小分 */}
                                            {match.totalPoints && (
                                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                                                    <div className="text-[11px] font-black text-slate-500 flex items-center gap-1">
                                                        <Target className="w-3.5 h-3.5 text-emerald-600" /> 大小總分 (Over / Under)
                                                    </div>
                                                    <p className="text-xs font-bold text-slate-800 leading-snug">
                                                        {match.totalPoints}
                                                    </p>
                                                </div>
                                            )}
                                        </div>

                                        {/* 賽事分析 */}
                                        {match.analysis && (
                                            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-xs text-slate-700 leading-relaxed font-medium">
                                                <strong className="text-indigo-900 font-black mr-1">🔍 賽前焦點簡評：</strong>
                                                {match.analysis}
                                            </div>
                                        )}

                                        {/* 建議預測題目與選項 */}
                                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                            <div className="flex items-center gap-1.5 text-xs font-black text-slate-700">
                                                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                                                <span>預測題目建議：</span>
                                                <span className="text-slate-900 font-bold">{match.suggestedQuestion}</span>
                                            </div>
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-[11px] font-bold text-slate-400">可選項目：</span>
                                                {match.suggestedOptions.map((opt, i) => (
                                                    <Badge key={i} variant="outline" className="bg-white border-slate-200 text-slate-700 text-xs font-bold px-2 py-0.5">
                                                        {opt}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>

                                        {/* 操作按鈕 */}
                                        <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleApplyMatchToCreateForm(match)}
                                                className="rounded-xl border-slate-200 text-slate-700 font-bold hover:bg-slate-100 flex items-center gap-1.5 text-xs h-9 px-3"
                                            >
                                                <SlidersHorizontal className="w-3.5 h-3.5" />
                                                帶入表單並微調
                                            </Button>

                                            <Button
                                                type="button"
                                                size="sm"
                                                disabled={publishingMatchId === match.id}
                                                onClick={() => handleDirectPublishAiMatch(match)}
                                                className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black flex items-center gap-1.5 text-xs h-9 px-4 shadow-sm"
                                            >
                                                {publishingMatchId === match.id ? (
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                ) : (
                                                    <Check className="w-3.5 h-3.5 text-emerald-400" />
                                                )}
                                                一鍵發布預測 (100 P+)
                                            </Button>
                                        </div>
                                    </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="py-12 text-center space-y-3">
                                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                                    <Search className="w-6 h-6" />
                                </div>
                                <p className="text-sm font-bold text-slate-600">請輸入球隊名稱或點選上方熱門標籤開始 AI 檢索</p>
                                <p className="text-xs text-slate-400">支援 NBA、MLB、中華職棒 CPBL、英超/歐冠足球、TPBL 職籃等全球體育賽事</p>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-4 border-t border-slate-100 bg-slate-50 gap-2 shrink-0">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsAiSearchOpen(false)} 
                            className="rounded-xl font-bold border-slate-200"
                        >
                            關閉
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
