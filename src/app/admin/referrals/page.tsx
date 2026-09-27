'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { 
    Users, 
    Gift, 
    Copy, 
    Check, 
    Sparkles, 
    Share2, 
    Loader2, 
    Trophy, 
    Ticket, 
    Plus, 
    Trash2, 
    RefreshCw, 
    Search, 
    ExternalLink,
    TrendingUp,
    Settings,
    Calendar,
    Flame
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function AdminReferralPage() {
    const { toast } = useToast();
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [isCreatingCode, setIsCreatingCode] = useState(false);
    
    // 推薦設定
    const [config, setConfig] = useState({
        isEnabled: true,
        referrerBonusPoints: 100,
        refereeBonusPoints: 50,
        refereeDiamonds: 0,
        freeDrawTickets: 1,
    });

    // 專案推薦碼列表
    const [codes, setCodes] = useState<any[]>([]);
    // 推薦成功紀錄
    const [logs, setLogs] = useState<any[]>([]);
    // 排行榜
    const [topReferrers, setTopReferrers] = useState<any[]>([]);

    // 新增推薦碼表單
    const [newCode, setNewCode] = useState({
        code: '',
        campaignName: '',
        referrerBonusPoints: 0,
        refereeBonusPoints: 50,
        freeDrawTickets: 1,
    });

    // 搜尋與複製狀態
    const [copied, setCopied] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchConfig = async () => {
        try {
            const res = await fetch('/api/admin/referral/config');
            const data = await res.json();
            if (data.success && data.config) {
                setConfig({
                    isEnabled: data.config.isEnabled !== false,
                    referrerBonusPoints: data.config.referrerBonusPoints ?? 100,
                    refereeBonusPoints: data.config.refereeBonusPoints ?? 50,
                    refereeDiamonds: data.config.refereeDiamonds ?? 0,
                    freeDrawTickets: data.config.freeDrawTickets ?? 1,
                });
            }
        } catch (e) {
            console.error('Fetch config error:', e);
        }
    };

    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            await fetchConfig();
            const res = await fetch('/api/admin/referral');
            const data = await res.json();
            if (data.success) {
                setCodes(data.codes || []);
                setLogs(data.logs || []);
                setTopReferrers(data.topReferrers || []);
            }
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: '載入失敗',
                description: e.message,
            });
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // 儲存全站獎勵配置
    const handleSaveConfig = async () => {
        setIsSavingConfig(true);
        try {
            const res = await fetch('/api/admin/referral/config', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: '推薦獎勵設定已儲存！' });
            } else {
                toast({ variant: 'destructive', title: '儲存失敗', description: data.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: '網路錯誤', description: e.message });
        } finally {
            setIsSavingConfig(false);
        }
    };

    // 建立官方/合作專案推薦碼
    const handleCreateCode = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCode.code.trim() || !newCode.campaignName.trim()) {
            toast({ variant: 'destructive', title: '請填寫完整代碼與專案名稱' });
            return;
        }

        setIsCreatingCode(true);
        try {
            const res = await fetch('/api/admin/referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create',
                    ...newCode,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: '專案推薦碼建立成功！' });
                setNewCode({
                    code: '',
                    campaignName: '',
                    referrerBonusPoints: 0,
                    refereeBonusPoints: 50,
                    freeDrawTickets: 1,
                });
                fetchData();
            } else {
                toast({ variant: 'destructive', title: '建立失敗', description: data.error });
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: '錯誤', description: e.message });
        } finally {
            setIsCreatingCode(false);
        }
    };

    // 切換官方推薦碼啟用狀態
    const handleToggleCode = async (code: string, currentActive: boolean) => {
        try {
            const res = await fetch('/api/admin/referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'toggle',
                    code,
                    isActive: !currentActive,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: !currentActive ? '推薦碼已啟用' : '推薦碼已停用' });
                setCodes(codes.map(c => c.code === code ? { ...c, isActive: !currentActive } : c));
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: '更新失敗' });
        }
    };

    // 刪除官方推薦碼
    const handleDeleteCode = async (code: string) => {
        if (!confirm(`確定要刪除專案推薦碼【${code}】嗎？`)) return;
        try {
            const res = await fetch('/api/admin/referral', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    code,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast({ title: '已成功刪除推薦碼' });
                setCodes(codes.filter(c => c.code !== code));
            }
        } catch (e: any) {
            toast({ variant: 'destructive', title: '刪除失敗' });
        }
    };

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCopied(id);
        toast({ title: '已複製到剪貼簿', description: text });
        setTimeout(() => setCopied(null), 2000);
    };

    // 取得當前網域的邀請連結
    const getShareUrl = (code: string) => {
        if (typeof window === 'undefined') return `/login?ref=${code}`;
        return `${window.location.origin}/login?ref=${encodeURIComponent(code)}`;
    };

    const filteredLogs = logs.filter(l => 
        (l.code && l.code.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.newUserName && l.newUserName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.referrerName && l.referrerName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (l.newUserEmail && l.newUserEmail.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-8 p-1 sm:p-2">
            {/* 頁面標題 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <Share2 className="h-7 w-7 text-violet-600" />
                        <span>推薦碼與邀請推廣管理</span>
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                        管理全站會員推薦人脈裂變、專案 KOL 邀請代碼、邀請獎勵額度與成效紀錄。
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={fetchData} 
                        disabled={isLoadingData}
                        className="h-9 px-3 rounded-xl border-slate-200 text-slate-700 bg-white hover:bg-slate-50 font-bold"
                    >
                        <RefreshCw className={cn("w-4 h-4 mr-1.5", isLoadingData && "animate-spin")} />
                        重新整理
                    </Button>
                </div>
            </div>

            {/* 關鍵營運指標卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500">累計推薦成功人數</p>
                            <p className="text-2xl font-black text-slate-900 font-mono mt-1">
                                {logs.length} <span className="text-xs font-normal text-slate-500">人</span>
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-violet-50 text-violet-600">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500">官方合作/專案代碼</p>
                            <p className="text-2xl font-black text-slate-900 font-mono mt-1">
                                {codes.length} <span className="text-xs font-normal text-slate-500">組</span>
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-blue-50 text-blue-600">
                            <Ticket className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500">最高邀請冠軍</p>
                            <p className="text-lg font-black text-slate-900 truncate mt-1">
                                {topReferrers[0]?.username || '尚無紀錄'}
                            </p>
                            <p className="text-[11px] text-amber-600 font-bold">
                                {topReferrers[0] ? `已邀請 ${topReferrers[0].inviteCount} 位好友` : '-'}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-amber-50 text-amber-600">
                            <Trophy className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
                    <CardContent className="p-5 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500">推薦功能運行狀態</p>
                            <div className="flex items-center gap-2 mt-1">
                                <Badge className={cn("text-xs font-black", config.isEnabled ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-600")}>
                                    {config.isEnabled ? '正常開放運行中' : '目前已暫停'}
                                </Badge>
                            </div>
                        </div>
                        <div className="p-3 rounded-xl bg-emerald-50 text-emerald-600">
                            <Sparkles className="w-6 h-6" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* 功能分頁 */}
            <Tabs defaultValue="codes" className="space-y-6">
                <TabsList className="bg-slate-100 p-1 rounded-xl h-11">
                    <TabsTrigger value="codes" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs text-xs font-bold">
                        專案/活動推薦碼
                    </TabsTrigger>
                    <TabsTrigger value="logs" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs text-xs font-bold">
                        推薦成功紀錄 ({logs.length})
                    </TabsTrigger>
                    <TabsTrigger value="top" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs text-xs font-bold">
                        邀請達人排行榜
                    </TabsTrigger>
                    <TabsTrigger value="config" className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-xs text-xs font-bold">
                        推薦獎勵額度設定
                    </TabsTrigger>
                </TabsList>

                {/* 分頁 1: 專案推薦碼 */}
                <TabsContent value="codes" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 左側：建立專案推薦碼 */}
                        <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl h-fit">
                            <CardHeader className="p-5 border-b border-slate-100">
                                <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                                    <Plus className="h-4 w-4 text-violet-600" />
                                    <span>建立官方/KOL 專案推薦碼</span>
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500">
                                    適用於特定宣傳活動、合作創作者、線下展覽專屬推廣代號。
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="p-5 space-y-4">
                                <form onSubmit={handleCreateCode} className="space-y-3.5">
                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-700">推薦代碼 (英數大寫)</Label>
                                        <Input 
                                            placeholder="例如：VIP888, YOUTUBER_A" 
                                            value={newCode.code} 
                                            onChange={e => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                                            className="h-9.5 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-mono font-black uppercase"
                                            required
                                        />
                                    </div>

                                    <div className="space-y-1">
                                        <Label className="text-xs font-bold text-slate-700">專案/來源名稱</Label>
                                        <Input 
                                            placeholder="例如：2026 夏季卡展現場宣傳" 
                                            value={newCode.campaignName} 
                                            onChange={e => setNewCode({ ...newCode, campaignName: e.target.value })}
                                            className="h-9.5 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-bold"
                                            required
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-700">新人紅利 P+</Label>
                                            <Input 
                                                type="number" 
                                                value={newCode.refereeBonusPoints} 
                                                onChange={e => setNewCode({ ...newCode, refereeBonusPoints: Number(e.target.value) })}
                                                className="h-9 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-bold"
                                            />
                                        </div>
                                        <div className="space-y-1">
                                            <Label className="text-xs font-bold text-slate-700">新人免費抽卡券</Label>
                                            <Input 
                                                type="number" 
                                                value={newCode.freeDrawTickets} 
                                                onChange={e => setNewCode({ ...newCode, freeDrawTickets: Number(e.target.value) })}
                                                className="h-9 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-bold"
                                            />
                                        </div>
                                    </div>

                                    <Button 
                                        type="submit" 
                                        disabled={isCreatingCode}
                                        className="w-full h-10 mt-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs shadow-xs"
                                    >
                                        {isCreatingCode ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Plus className="w-4 h-4 mr-1.5" />}
                                        建立專案推薦碼
                                    </Button>
                                </form>
                            </CardContent>
                        </Card>

                        {/* 右側：專案推薦碼清單 */}
                        <Card className="lg:col-span-2 border-slate-200/90 shadow-2xs bg-white rounded-2xl overflow-hidden">
                            <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle className="text-base font-black text-slate-900">
                                        已建立之專案推薦碼 ({codes.length})
                                    </CardTitle>
                                    <CardDescription className="text-xs text-slate-500">
                                        點擊可快速複製代碼或帶有參數的推薦登入註冊網址
                                    </CardDescription>
                                </div>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                                            <tr>
                                                <th className="p-3.5 pl-5 font-bold">推薦代碼</th>
                                                <th className="p-3.5 font-bold">專案名稱</th>
                                                <th className="p-3.5 font-bold">新人贈品</th>
                                                <th className="p-3.5 font-bold">已使用次數</th>
                                                <th className="p-3.5 font-bold">狀態</th>
                                                <th className="p-3.5 pr-5 text-right font-bold">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {codes.length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="p-8 text-center text-slate-400">
                                                        尚未建立專案推薦碼，請從左側建立第一組。
                                                    </td>
                                                </tr>
                                            ) : (
                                                codes.map(c => {
                                                    const shareUrl = getShareUrl(c.code);
                                                    return (
                                                        <tr key={c.id} className="hover:bg-slate-50/80 transition-colors">
                                                            <td className="p-3.5 pl-5 font-mono font-black text-violet-700">
                                                                <div className="flex items-center gap-1.5">
                                                                    <span>{c.code}</span>
                                                                    <button 
                                                                        onClick={() => handleCopy(c.code, c.code)} 
                                                                        className="text-slate-400 hover:text-slate-600 p-0.5"
                                                                        title="複製代碼"
                                                                    >
                                                                        {copied === c.code ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                                                                    </button>
                                                                </div>
                                                            </td>
                                                            <td className="p-3.5 font-bold text-slate-800">
                                                                {c.campaignName}
                                                            </td>
                                                            <td className="p-3.5 text-slate-600">
                                                                +{c.refereeBonusPoints || 0} P+
                                                                {c.freeDrawTickets ? ` / ${c.freeDrawTickets} 券` : ''}
                                                            </td>
                                                            <td className="p-3.5 font-mono font-bold text-slate-900">
                                                                {c.usageCount || 0} 次
                                                            </td>
                                                            <td className="p-3.5">
                                                                <Switch 
                                                                    checked={c.isActive !== false} 
                                                                    onCheckedChange={() => handleToggleCode(c.code, c.isActive !== false)} 
                                                                />
                                                            </td>
                                                            <td className="p-3.5 pr-5 text-right space-x-1">
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost" 
                                                                    onClick={() => handleCopy(shareUrl, `link-${c.code}`)}
                                                                    className="h-7 px-2 text-[11px] font-bold text-violet-600 hover:bg-violet-50"
                                                                >
                                                                    {copied === `link-${c.code}` ? '已複製連結' : '複製連結'}
                                                                </Button>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost" 
                                                                    onClick={() => handleDeleteCode(c.code)}
                                                                    className="h-7 w-7 p-0 text-rose-500 hover:bg-rose-50"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </Button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* 分頁 2: 推薦紀錄 */}
                <TabsContent value="logs" className="space-y-4">
                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base font-black text-slate-900">
                                    最新 100 筆成功推薦記錄
                                </CardTitle>
                                <CardDescription className="text-xs text-slate-500">
                                    即時查閱會員透過推薦碼註冊之詳細數據與點數撥發情況
                                </CardDescription>
                            </div>
                            <div className="relative w-full sm:w-64">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                <Input 
                                    placeholder="搜尋會員暱稱/代碼/信箱..." 
                                    value={searchTerm} 
                                    onChange={e => setSearchTerm(e.target.value)}
                                    className="h-8.5 pl-8 text-xs bg-slate-50 border-slate-200 rounded-xl"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                                        <tr>
                                            <th className="p-3.5 pl-5 font-bold">新註冊會員</th>
                                            <th className="p-3.5 font-bold">所用推薦碼</th>
                                            <th className="p-3.5 font-bold">推薦人 / 專案來源</th>
                                            <th className="p-3.5 font-bold">新人贈點</th>
                                            <th className="p-3.5 font-bold">推薦人獎勵</th>
                                            <th className="p-3.5 pr-5 text-right font-bold">註冊時間</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {filteredLogs.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-400">
                                                    尚無符合條件的推薦紀錄。
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredLogs.map(l => (
                                                <tr key={l.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="p-3.5 pl-5">
                                                        <div className="font-bold text-slate-900">{l.newUserName || '新會員'}</div>
                                                        <div className="text-[10px] text-slate-400 font-mono truncate max-w-[150px]">{l.newUserEmail || l.newUserId}</div>
                                                    </td>
                                                    <td className="p-3.5 font-mono font-black text-amber-600">
                                                        {l.code}
                                                    </td>
                                                    <td className="p-3.5 font-bold text-slate-700">
                                                        {l.referrerName || '官方專案'}
                                                    </td>
                                                    <td className="p-3.5">
                                                        <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold">
                                                            +{l.refereeBonusGiven || 0} P+
                                                            {l.refereeTicketsGiven ? ` / ${l.refereeTicketsGiven}券` : ''}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-3.5">
                                                        <Badge className="bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold">
                                                            +{l.referrerBonusGiven || 0} P+
                                                        </Badge>
                                                    </td>
                                                    <td className="p-3.5 pr-5 text-right font-mono text-slate-400 text-[11px]">
                                                        {l.createdAtFormatted ? format(new Date(l.createdAtFormatted), 'yyyy-MM-dd HH:mm') : '-'}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 分頁 3: 達人排行榜 */}
                <TabsContent value="top" className="space-y-4">
                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="p-5 border-b border-slate-100">
                            <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                                <Trophy className="w-5 h-5 text-amber-500" />
                                <span>全站會員邀請達人排行榜</span>
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500">
                                根據成功邀請好友註冊之人數排序，可作為頒發社群推廣大使特殊獎項之依據
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-0">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500">
                                        <tr>
                                            <th className="p-3.5 pl-5 font-bold w-16">名次</th>
                                            <th className="p-3.5 font-bold">會員暱稱</th>
                                            <th className="p-3.5 font-bold">會員信箱</th>
                                            <th className="p-3.5 font-bold">會員階級</th>
                                            <th className="p-3.5 font-bold">專屬邀請碼</th>
                                            <th className="p-3.5 pr-5 text-right font-bold">成功推薦人數</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {topReferrers.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-slate-400">
                                                    目前尚無會員達成推薦邀請。
                                                </td>
                                            </tr>
                                        ) : (
                                            topReferrers.map((user, idx) => (
                                                <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                                                    <td className="p-3.5 pl-5 font-mono font-black">
                                                        {idx === 0 ? (
                                                            <span className="text-amber-500 flex items-center gap-1 font-bold">
                                                                <Flame className="w-4 h-4 fill-amber-500" /> 1
                                                            </span>
                                                        ) : idx === 1 ? (
                                                            <span className="text-slate-500 font-bold">2</span>
                                                        ) : idx === 2 ? (
                                                            <span className="text-amber-700 font-bold">3</span>
                                                        ) : (
                                                            <span className="text-slate-400">{idx + 1}</span>
                                                        )}
                                                    </td>
                                                    <td className="p-3.5 font-bold text-slate-900">
                                                        {user.username}
                                                    </td>
                                                    <td className="p-3.5 text-slate-500 font-mono">
                                                        {user.email}
                                                    </td>
                                                    <td className="p-3.5">
                                                        <Badge variant="outline" className="text-[10px] font-bold border-slate-200">
                                                            {user.userLevel}
                                                        </Badge>
                                                    </td>
                                                    <td className="p-3.5 font-mono font-bold text-violet-600">
                                                        {user.inviteCode}
                                                    </td>
                                                    <td className="p-3.5 pr-5 text-right font-mono font-black text-base text-amber-600">
                                                        {user.inviteCount} 位
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 分頁 4: 系統設定 */}
                <TabsContent value="config" className="space-y-4">
                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl max-w-2xl">
                        <CardHeader className="p-6 border-b border-slate-100">
                            <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                                <Settings className="w-5 h-5 text-slate-700" />
                                <span>推薦活動全站獎勵額度設定</span>
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500">
                                當一般會員互相分享推薦碼，或透過推薦連結註冊時，雙方自動獲得的預設回饋禮包。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-5">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                                <div>
                                    <p className="text-xs font-bold text-slate-900">推薦碼功能總開關</p>
                                    <p className="text-[11px] text-slate-500 mt-0.5">關閉後前台將暫停接受新推薦碼綁定與發獎</p>
                                </div>
                                <Switch 
                                    checked={config.isEnabled} 
                                    onCheckedChange={v => setConfig({ ...config, isEnabled: v })} 
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5 p-4 rounded-xl bg-violet-50/50 border border-violet-100">
                                    <Label className="text-xs font-bold text-violet-900">推薦人獲得紅利 P+</Label>
                                    <p className="text-[10px] text-violet-600">每成功邀請一位好友時發放</p>
                                    <Input 
                                        type="number" 
                                        value={config.referrerBonusPoints} 
                                        onChange={e => setConfig({ ...config, referrerBonusPoints: Number(e.target.value) })}
                                        className="h-10 bg-white border-violet-200 rounded-xl text-sm font-mono font-bold mt-1"
                                    />
                                </div>

                                <div className="space-y-1.5 p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                                    <Label className="text-xs font-bold text-emerald-900">新人被推薦人獲得紅利 P+</Label>
                                    <p className="text-[10px] text-emerald-600">填寫推薦碼完成註冊時發放</p>
                                    <Input 
                                        type="number" 
                                        value={config.refereeBonusPoints} 
                                        onChange={e => setConfig({ ...config, refereeBonusPoints: Number(e.target.value) })}
                                        className="h-10 bg-white border-emerald-200 rounded-xl text-sm font-mono font-bold mt-1"
                                    />
                                </div>

                                <div className="space-y-1.5 p-4 rounded-xl bg-cyan-50/50 border border-cyan-100">
                                    <Label className="text-xs font-bold text-cyan-900">新人免費抽卡券</Label>
                                    <p className="text-[10px] text-cyan-600">贈送額外活動試玩免費抽券</p>
                                    <Input 
                                        type="number" 
                                        value={config.freeDrawTickets} 
                                        onChange={e => setConfig({ ...config, freeDrawTickets: Number(e.target.value) })}
                                        className="h-10 bg-white border-cyan-200 rounded-xl text-sm font-mono font-bold mt-1"
                                    />
                                </div>

                                <div className="space-y-1.5 p-4 rounded-xl bg-slate-50 border border-slate-100">
                                    <Label className="text-xs font-bold text-slate-700">新人贈送鑽石 (選填)</Label>
                                    <p className="text-[10px] text-slate-500">一般建議為 0，避免刷號惡意註冊</p>
                                    <Input 
                                        type="number" 
                                        value={config.refereeDiamonds} 
                                        onChange={e => setConfig({ ...config, refereeDiamonds: Number(e.target.value) })}
                                        className="h-10 bg-white border-slate-200 rounded-xl text-sm font-mono font-bold mt-1"
                                    />
                                </div>
                            </div>

                            <Button 
                                onClick={handleSaveConfig} 
                                disabled={isSavingConfig}
                                className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs shadow-md"
                            >
                                {isSavingConfig ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Check className="w-4 h-4 mr-1.5" />}
                                儲存獎勵參數設定
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
