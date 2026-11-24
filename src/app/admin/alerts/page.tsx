'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where, updateDoc, deleteDoc, addDoc, doc, Timestamp } from '@/lib/audited-firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    AlertTriangle,
    Check,
    CheckCircle2,
    ShieldAlert,
    Clock,
    Package,
    Truck,
    Lock,
    Wrench,
    ExternalLink,
    Mail,
    Plus,
    Trash2,
    Activity,
    EyeOff,
    Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

type AlertSeverity = 'critical' | 'warning' | 'info';

interface LiveDiagnosticAlert {
    id: string;
    severity: AlertSeverity;
    category: 'pool' | 'shipping' | 'security';
    title: string;
    detail: string;
    href?: string;
    hrefLabel?: string;
    actionLabel?: string;
    onAction?: () => Promise<void>;
    secondaryHref?: string;
    secondaryLabel?: string;
}

function toSafeMillis(val: any): number | null {
    if (!val) return null;
    if (typeof val.toMillis === 'function') return val.toMillis();
    if (typeof val.seconds === 'number') return val.seconds * 1000;
    const ms = new Date(val).getTime();
    return Number.isFinite(ms) ? ms : null;
}

export default function AdminAlertsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();

    const [activeTab, setActiveTab] = useState<'live' | 'records'>('live');
    const [severityFilter, setSeverityFilter] = useState<'all' | AlertSeverity>('all');
    const [busyActionId, setBusyActionId] = useState<string | null>(null);

    // 手動新增異常備忘
    const [newAlertLevel, setNewAlertLevel] = useState<'critical' | 'warning'>('warning');
    const [newAlertMessage, setNewAlertMessage] = useState('');
    const [isAddingAlert, setIsAddingAlert] = useState(false);

    // 1. 歷史系統警報紀錄 (alerts)
    const alertsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'alerts'), orderBy('createdAt', 'desc'), limit(100));
    }, [firestore]);
    const { data: alerts, isLoading: isLoadingAlerts } = useCollection<any>(alertsQuery);

    // 2. 卡池即時健康掃描 (cardPools)
    const poolsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return collection(firestore, 'cardPools');
    }, [firestore]);
    const { data: cardPools, isLoading: isLoadingPools } = useCollection<any>(poolsQuery);

    // 3. 待處理出貨單逾期掃描 (shippingOrders where status == 'pending')
    const pendingShippingQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'shippingOrders'), where('status', '==', 'pending'), limit(100));
    }, [firestore]);
    const { data: pendingOrders, isLoading: isLoadingShipping } = useCollection<any>(pendingShippingQuery);

    // 4. 近期高風險後台操作掃描 (activityLogs 最新 50 筆)
    const recentLogsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'activityLogs'), orderBy('createdAt', 'desc'), limit(50));
    }, [firestore]);
    const { data: recentLogs, isLoading: isLoadingLogs } = useCollection<any>(recentLogsQuery);

    // 一鍵修復輔助動作
    const runQuickFix = async (id: string, fn: () => Promise<void>, successTitle: string) => {
        setBusyActionId(id);
        try {
            await fn();
            toast({ title: successTitle });
        } catch (err: any) {
            toast({ variant: 'destructive', title: '操作失敗', description: err?.message || '請稍後再試' });
        } finally {
            setBusyActionId(null);
        }
    };

    // 即時計算所有主動掃描出的風險預警
    const liveDiagnostics = useMemo<LiveDiagnosticAlert[]>(() => {
        const list: LiveDiagnosticAlert[] = [];
        const nowMs = Date.now();

        // A. 卡池健康巡檢
        if (Array.isArray(cardPools)) {
            cardPools.forEach((pool: any) => {
                if (!pool || pool.isActive === false) return;
                const poolName = pool.name || pool.id;
                const poolHref = `/admin/card-pools/p/${pool.id}`;

                const computedRemaining =
                    (Array.isArray(pool.cards) ? pool.cards.reduce((s: number, c: any) => s + Math.max(0, Number(c?.quantity || 0)), 0) : 0) +
                    (Array.isArray(pool.pointPrizes) ? pool.pointPrizes.reduce((s: number, p: any) => s + Math.max(0, Number(p?.quantity || 0)), 0) : 0);

                const isNumberRemaining = typeof pool.remainingPacks === 'number' && Number.isFinite(pool.remainingPacks);
                const actualRemaining = isNumberRemaining ? pool.remainingPacks : computedRemaining;
                const totalPacks = typeof pool.totalPacks === 'number' && pool.totalPacks > 0 ? pool.totalPacks : Math.max(1, actualRemaining);

                // A1. 庫存欄位異常或與實際品項數嚴重不符
                if (!isNumberRemaining || (computedRemaining > 0 && Math.abs(actualRemaining - computedRemaining) >= 3)) {
                    list.push({
                        id: `pool-sync-${pool.id}`,
                        severity: 'critical',
                        category: 'pool',
                        title: `卡池庫存異常：${poolName}`,
                        detail: !isNumberRemaining
                            ? `剩餘包數欄位格式異常，依池內實際品項推算應為 ${computedRemaining} 包。`
                            : `顯示剩餘 ${actualRemaining} 包，但池內實際卡片＋點數賞總計為 ${computedRemaining} 包（差異 ${Math.abs(actualRemaining - computedRemaining)} 包）。`,
                        href: poolHref,
                        hrefLabel: '查看卡池',
                        actionLabel: `一鍵校正為 ${computedRemaining} 包`,
                        onAction: async () => {
                            if (!firestore) return;
                            await updateDoc(doc(firestore, 'cardPools', pool.id), { remainingPacks: computedRemaining });
                        },
                    });
                }

                // A2. 保護鎖卡死（超過 5 分鐘仍未釋放）
                if (pool.lockedBy && pool.lockedAt) {
                    const lockMs = toSafeMillis(pool.lockedAt);
                    if (lockMs && nowMs - lockMs > 5 * 60 * 1000) {
                        const mins = Math.floor((nowMs - lockMs) / 60000);
                        list.push({
                            id: `pool-lock-${pool.id}`,
                            severity: 'warning',
                            category: 'pool',
                            title: `保護鎖殘留未清：${poolName}`,
                            detail: `鎖定紀錄已超過 ${mins} 分鐘（雖已逾 120 秒保護期，建議清理殘留欄位保持資料整潔）。`,
                            actionLabel: '一鍵清除鎖定',
                            onAction: async () => {
                                if (!firestore) return;
                                await updateDoc(doc(firestore, 'cardPools', pool.id), { lockedBy: null, lockedAt: null });
                            },
                        });
                    }
                }

                // A3. 已售罄但仍掛在上架狀態
                if (actualRemaining <= 0) {
                    list.push({
                        id: `pool-soldout-${pool.id}`,
                        severity: 'warning',
                        category: 'pool',
                        title: `已售罄仍上架中：${poolName}`,
                        detail: `此卡池剩餘 0 包，但狀態仍為「上架中」，建議下架或補貨。`,
                        href: poolHref,
                        hrefLabel: '前往補貨',
                        actionLabel: '一鍵下架',
                        onAction: async () => {
                            if (!firestore) return;
                            await updateDoc(doc(firestore, 'cardPools', pool.id), { isActive: false });
                        },
                    });
                } else {
                    // A4. 低庫存尾盤預警（剩餘 <= 15% 或 <= 10 包）
                    const pctLeft = Math.round((actualRemaining / totalPacks) * 100);
                    if (actualRemaining <= 10 || pctLeft <= 15) {
                        list.push({
                            id: `pool-low-${pool.id}`,
                            severity: 'info',
                            category: 'pool',
                            title: `尾盤低庫存提醒：${poolName}`,
                            detail: `僅剩 ${actualRemaining} / ${totalPacks} 抽（剩餘 ${pctLeft}%），適合立即發送尾盤推播郵件或準備補貨。`,
                            href: poolHref,
                            hrefLabel: '管理卡池',
                            secondaryHref: '/admin/marketing-emails',
                            secondaryLabel: '發送尾盤信',
                        });
                    }
                }

                // A5. 即將到期下架（3 天內）
                if (pool.expiresAt) {
                    const expMs = toSafeMillis(pool.expiresAt);
                    if (expMs && expMs > nowMs && expMs - nowMs <= 3 * 24 * 60 * 60 * 1000) {
                        const hoursLeft = Math.max(1, Math.round((expMs - nowMs) / (1000 * 60 * 60)));
                        list.push({
                            id: `pool-exp-${pool.id}`,
                            severity: 'warning',
                            category: 'pool',
                            title: `卡池即將到期下架：${poolName}`,
                            detail: `預計於 ${format(new Date(expMs), 'yyyy/MM/dd HH:mm')} 下架（約剩 ${hoursLeft} 小時），剩餘 ${actualRemaining} 抽。`,
                            href: poolHref,
                            hrefLabel: '調整時間',
                            secondaryHref: '/admin/marketing-emails',
                            secondaryLabel: '發下架提醒信',
                        });
                    }
                }
            });
        }

        // B. 待出貨逾期巡檢
        if (Array.isArray(pendingOrders)) {
            const overdue72h = pendingOrders.filter((o: any) => {
                const ms = toSafeMillis(o.createdAt);
                return ms !== null && nowMs - ms >= 72 * 60 * 60 * 1000;
            });
            const overdue48h = pendingOrders.filter((o: any) => {
                const ms = toSafeMillis(o.createdAt);
                return ms !== null && nowMs - ms >= 48 * 60 * 60 * 1000 && nowMs - ms < 72 * 60 * 60 * 1000;
            });

            if (overdue72h.length > 0) {
                list.push({
                    id: 'shipping-overdue-72h',
                    severity: 'critical',
                    category: 'shipping',
                    title: `有 ${overdue72h.length} 筆出貨單超過 72 小時未處理`,
                    detail: '請盡快前往出貨管理確認打包與填寫物流單號，避免影響玩家體驗。',
                    href: '/admin/shipping',
                    hrefLabel: '前往出貨管理',
                });
            }
            if (overdue48h.length > 0) {
                list.push({
                    id: 'shipping-overdue-48h',
                    severity: 'warning',
                    category: 'shipping',
                    title: `有 ${overdue48h.length} 筆出貨單等待超過 48 小時`,
                    detail: '建議於今日內完成出貨處理並更新寄送狀態。',
                    href: '/admin/shipping',
                    hrefLabel: '前往出貨管理',
                });
            }
        }

        // C. 近 24 小時高風險後台操作巡檢
        if (Array.isArray(recentLogs)) {
            const highRiskLogs = recentLogs.filter((log: any) => {
                const ms = toSafeMillis(log.createdAt);
                if (!ms || nowMs - ms > 24 * 60 * 60 * 1000) return false;
                const text = `${log.action || ''} ${log.summary || ''} ${log.collectionName || ''}`;
                return /刪除|點數|權限|管理員|機率|價格|清空|重置/.test(text);
            });

            if (highRiskLogs.length > 0) {
                list.push({
                    id: 'security-high-risk-ops',
                    severity: 'info',
                    category: 'security',
                    title: `近 24 小時有 ${highRiskLogs.length} 筆高敏感度後台操作`,
                    detail: `最近一筆：${highRiskLogs[0]?.operatorName || highRiskLogs[0]?.operatorEmail || '管理員'} 執行「${highRiskLogs[0]?.action || '異動'}」。`,
                    href: '/admin/activity-logs',
                    hrefLabel: '查閱操作日誌',
                });
            }
        }

        // 依嚴重層級排序（critical -> warning -> info）
        const rank: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 };
        return list.sort((a, b) => rank[a.severity] - rank[b.severity]);
    }, [cardPools, pendingOrders, recentLogs, firestore]);

    const filteredLiveDiagnostics = useMemo(() => {
        if (severityFilter === 'all') return liveDiagnostics;
        return liveDiagnostics.filter((d) => d.severity === severityFilter);
    }, [liveDiagnostics, severityFilter]);

    const criticalCount = liveDiagnostics.filter((d) => d.severity === 'critical').length;
    const warningCount = liveDiagnostics.filter((d) => d.severity === 'warning').length;
    const infoCount = liveDiagnostics.filter((d) => d.severity === 'info').length;
    const unresolvedRecordCount = alerts?.filter((a: any) => !a.resolved).length || 0;

    const handleResolve = async (id: string) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'alerts', id), { resolved: true });
            toast({ title: '已標記為已處理' });
        } catch {
            toast({ variant: 'destructive', title: '處理失敗' });
        }
    };

    const handleResolveAll = async () => {
        if (!firestore || !alerts) return;
        const targets = alerts.filter((a: any) => !a.resolved);
        if (targets.length === 0) return;
        try {
            await Promise.all(targets.map((a: any) => updateDoc(doc(firestore, 'alerts', a.id), { resolved: true })));
            toast({ title: `已批次結案 ${targets.length} 筆警報` });
        } catch {
            toast({ variant: 'destructive', title: '批次處理失敗' });
        }
    };

    const handleDeleteRecord = async (id: string) => {
        if (!firestore) return;
        if (typeof window !== 'undefined' && !window.confirm('確定要刪除此筆警報紀錄嗎？')) return;
        try {
            await deleteDoc(doc(firestore, 'alerts', id));
            toast({ title: '已刪除紀錄' });
        } catch {
            toast({ variant: 'destructive', title: '刪除失敗' });
        }
    };

    const handleAddManualAlert = async () => {
        if (!firestore || !newAlertMessage.trim()) return;
        setIsAddingAlert(true);
        try {
            await addDoc(collection(firestore, 'alerts'), {
                level: newAlertLevel,
                message: newAlertMessage.trim(),
                resolved: false,
                createdAt: Timestamp.now(),
            });
            setNewAlertMessage('');
            toast({ title: '已新增異常追蹤紀錄' });
        } catch {
            toast({ variant: 'destructive', title: '新增失敗' });
        } finally {
            setIsAddingAlert(false);
        }
    };

    const isScanning = isLoadingPools || isLoadingShipping || isLoadingLogs;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                        <ShieldAlert className="h-7 w-7 text-rose-600" /> 系統異常與風險預警中心
                    </h1>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                        即時主動巡檢卡池庫存、保護鎖狀態、出貨逾期與高敏感後台操作，並提供一鍵修復。
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                        variant="outline"
                        className={cn(
                            'text-xs font-black px-3 py-1 rounded-lg tabular-nums',
                            criticalCount + warningCount > 0
                                ? 'bg-rose-50 text-rose-700 border-rose-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        )}
                    >
                        {criticalCount + warningCount > 0
                            ? `${criticalCount + warningCount} 項即時風險待關注`
                            : '全站巡檢狀態良好'}
                    </Badge>
                </div>
            </div>

            {/* 4 個即時健康度 KPI 卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <Card
                    onClick={() => { setActiveTab('live'); setSeverityFilter(severityFilter === 'critical' ? 'all' : 'critical'); }}
                    className={cn(
                        'cursor-pointer rounded-2xl border transition-all bg-white',
                        severityFilter === 'critical' ? 'border-rose-400 ring-2 ring-rose-100' : 'border-slate-200 hover:border-rose-300'
                    )}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500">重大異常</p>
                            <p className={cn('text-2xl font-black font-mono tabular-nums mt-1', criticalCount > 0 ? 'text-rose-600' : 'text-slate-900')}>
                                {isScanning ? '--' : criticalCount}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card
                    onClick={() => { setActiveTab('live'); setSeverityFilter(severityFilter === 'warning' ? 'all' : 'warning'); }}
                    className={cn(
                        'cursor-pointer rounded-2xl border transition-all bg-white',
                        severityFilter === 'warning' ? 'border-amber-400 ring-2 ring-amber-100' : 'border-slate-200 hover:border-amber-300'
                    )}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500">庫存 / 效期警示</p>
                            <p className={cn('text-2xl font-black font-mono tabular-nums mt-1', warningCount > 0 ? 'text-amber-600' : 'text-slate-900')}>
                                {isScanning ? '--' : warningCount}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
                            <Clock className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card
                    onClick={() => { setActiveTab('live'); setSeverityFilter(severityFilter === 'info' ? 'all' : 'info'); }}
                    className={cn(
                        'cursor-pointer rounded-2xl border transition-all bg-white',
                        severityFilter === 'info' ? 'border-sky-400 ring-2 ring-sky-100' : 'border-slate-200 hover:border-sky-300'
                    )}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500">營運提醒 / 敏感日誌</p>
                            <p className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
                                {isScanning ? '--' : infoCount}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-100 flex items-center justify-center text-sky-600">
                            <Activity className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>

                <Card
                    onClick={() => setActiveTab('records')}
                    className={cn(
                        'cursor-pointer rounded-2xl border transition-all bg-white',
                        activeTab === 'records' ? 'border-slate-400 ring-2 ring-slate-100' : 'border-slate-200 hover:border-slate-300'
                    )}
                >
                    <CardContent className="p-4 flex items-center justify-between">
                        <div>
                            <p className="text-xs font-bold text-slate-500">待處理工單紀錄</p>
                            <p className="text-2xl font-black font-mono tabular-nums text-slate-900 mt-1">
                                {isLoadingAlerts ? '--' : unresolvedRecordCount}
                            </p>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="space-y-4">
                <TabsList className="bg-slate-100 p-1 rounded-xl">
                    <TabsTrigger value="live" className="rounded-lg text-xs font-bold px-4">
                        即時自動巡檢 ({liveDiagnostics.length})
                    </TabsTrigger>
                    <TabsTrigger value="records" className="rounded-lg text-xs font-bold px-4">
                        異常事件工單 ({alerts?.length || 0})
                    </TabsTrigger>
                </TabsList>

                {/* Tab 1: 即時自動巡檢 */}
                <TabsContent value="live" className="space-y-4">
                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                                <CardTitle className="text-base font-black text-slate-900">即時巡檢結果</CardTitle>
                                <CardDescription className="text-xs text-slate-500 font-medium">
                                    自動偵測卡池庫存不一致、售罄未下架、保護鎖殘留、即將到期、出貨逾期與高風險後台異動
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {(['all', 'critical', 'warning', 'info'] as const).map((lvl) => (
                                    <button
                                        key={lvl}
                                        type="button"
                                        onClick={() => setSeverityFilter(lvl)}
                                        className={cn(
                                            'px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer',
                                            severityFilter === lvl
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                        )}
                                    >
                                        {lvl === 'all' ? '全部' : lvl === 'critical' ? '重大' : lvl === 'warning' ? '警示' : '提醒'}
                                    </button>
                                ))}
                            </div>
                        </CardHeader>
                        <CardContent className="p-4 sm:p-5">
                            {isScanning ? (
                                <div className="space-y-3">
                                    {Array.from({ length: 3 }).map((_, i) => (
                                        <Skeleton key={i} className="h-20 w-full rounded-xl" />
                                    ))}
                                </div>
                            ) : filteredLiveDiagnostics.length > 0 ? (
                                <div className="space-y-3">
                                    {filteredLiveDiagnostics.map((item) => {
                                        const isBusy = busyActionId === item.id;
                                        return (
                                            <div
                                                key={item.id}
                                                className={cn(
                                                    'p-4 rounded-xl border flex flex-col md:flex-row md:items-center justify-between gap-3 transition-colors',
                                                    item.severity === 'critical'
                                                        ? 'bg-rose-50/50 border-rose-200'
                                                        : item.severity === 'warning'
                                                        ? 'bg-amber-50/50 border-amber-200'
                                                        : 'bg-slate-50/70 border-slate-200'
                                                )}
                                            >
                                                <div className="flex items-start gap-3 min-w-0">
                                                    <div className={cn(
                                                        'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                                                        item.severity === 'critical'
                                                            ? 'bg-rose-100 text-rose-700'
                                                            : item.severity === 'warning'
                                                            ? 'bg-amber-100 text-amber-700'
                                                            : 'bg-sky-100 text-sky-700'
                                                    )}>
                                                        {item.category === 'pool' ? (
                                                            item.id.startsWith('pool-lock-') ? <Lock className="w-4 h-4" /> : <Package className="w-4 h-4" />
                                                        ) : item.category === 'shipping' ? (
                                                            <Truck className="w-4 h-4" />
                                                        ) : (
                                                            <ShieldAlert className="w-4 h-4" />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0 space-y-1">
                                                        <div className="flex items-center gap-2 flex-wrap">
                                                            <Badge variant="outline" className={cn(
                                                                'text-[10px] font-black',
                                                                item.severity === 'critical'
                                                                    ? 'bg-rose-100 text-rose-700 border-rose-200'
                                                                    : item.severity === 'warning'
                                                                    ? 'bg-amber-100 text-amber-700 border-amber-200'
                                                                    : 'bg-sky-100 text-sky-700 border-sky-200'
                                                            )}>
                                                                {item.severity === 'critical' ? '重大異常' : item.severity === 'warning' ? '風險警示' : '營運提醒'}
                                                            </Badge>
                                                            <p className="text-sm font-black text-slate-900">{item.title}</p>
                                                        </div>
                                                        <p className="text-xs text-slate-600 leading-relaxed">{item.detail}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 flex-wrap shrink-0">
                                                    {item.onAction && item.actionLabel && (
                                                        <Button
                                                            type="button"
                                                            size="sm"
                                                            disabled={isBusy}
                                                            onClick={() => runQuickFix(item.id, item.onAction!, `已完成：${item.actionLabel}`)}
                                                            className="h-8 px-3 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                                                        >
                                                            {isBusy ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" />
                                                            ) : item.id.startsWith('pool-soldout-') ? (
                                                                <EyeOff className="w-3.5 h-3.5 mr-1" />
                                                            ) : (
                                                                <Wrench className="w-3.5 h-3.5 mr-1" />
                                                            )}
                                                            {item.actionLabel}
                                                        </Button>
                                                    )}
                                                    {item.secondaryHref && item.secondaryLabel && (
                                                        <Button asChild size="sm" variant="outline" className="h-8 px-3 rounded-lg text-xs font-bold border-amber-300 text-amber-800 hover:bg-amber-50">
                                                            <Link href={item.secondaryHref} className="inline-flex items-center gap-1">
                                                                <Mail className="w-3.5 h-3.5" />
                                                                <span>{item.secondaryLabel}</span>
                                                            </Link>
                                                        </Button>
                                                    )}
                                                    {item.href && item.hrefLabel && (
                                                        <Button asChild size="sm" variant="outline" className="h-8 px-3 rounded-lg text-xs font-bold border-slate-200 hover:bg-white">
                                                            <Link href={item.href} className="inline-flex items-center gap-1">
                                                                <span>{item.hrefLabel}</span>
                                                                <ExternalLink className="w-3 h-3" />
                                                            </Link>
                                                        </Button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="py-12 text-center space-y-2">
                                    <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto opacity-75" />
                                    <p className="text-sm font-black text-slate-800">目前全站巡檢正常，無任何異常項目！</p>
                                    <p className="text-xs text-slate-400">卡池庫存、保護鎖、出貨時效與高敏操作皆在安全範圍內</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Tab 2: 異常事件工單紀錄 (alerts 集合) */}
                <TabsContent value="records" className="space-y-4">
                    {/* 快速新增手動追蹤工單 */}
                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
                        <CardContent className="p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                            <select
                                value={newAlertLevel}
                                onChange={(e) => setNewAlertLevel(e.target.value as any)}
                                className="h-9 px-3 rounded-xl border border-slate-200 bg-slate-50 text-xs font-bold text-slate-700"
                            >
                                <option value="warning">系統提醒</option>
                                <option value="critical">重大警報</option>
                            </select>
                            <Input
                                placeholder="手動記錄異常事件或待追蹤客訴事項..."
                                value={newAlertMessage}
                                onChange={(e) => setNewAlertMessage(e.target.value)}
                                className="h-9 rounded-xl bg-slate-50 border-slate-200 text-xs flex-1"
                            />
                            <Button
                                type="button"
                                size="sm"
                                disabled={isAddingAlert || !newAlertMessage.trim()}
                                onClick={handleAddManualAlert}
                                className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold shrink-0 cursor-pointer"
                            >
                                {isAddingAlert ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                                新增紀錄
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between gap-2">
                            <div>
                                <CardTitle className="text-base font-black text-slate-900">歷史異常事件紀錄</CardTitle>
                                <CardDescription className="text-xs text-slate-500 font-medium">
                                    共 {alerts?.length || 0} 筆紀錄（未處理 {unresolvedRecordCount} 筆）
                                </CardDescription>
                            </div>
                            {unresolvedRecordCount > 0 && (
                                <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    onClick={handleResolveAll}
                                    className="h-8 rounded-lg text-xs font-bold border-emerald-200 text-emerald-700 hover:bg-emerald-50 cursor-pointer"
                                >
                                    <Check className="w-3.5 h-3.5 mr-1" /> 全部標記結案
                                </Button>
                            )}
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/80">
                                    <TableRow>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400 pl-6">記錄時間</TableHead>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400">嚴重層級</TableHead>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400">警報訊息與詳情</TableHead>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400">處理狀態</TableHead>
                                        <TableHead className="text-right text-[11px] font-black uppercase text-slate-400 pr-6">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoadingAlerts ? (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={5} className="p-4"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : alerts && alerts.length > 0 ? (
                                        alerts.map((alert: any) => {
                                            const ms = toSafeMillis(alert.createdAt);
                                            return (
                                                <TableRow key={alert.id} className={cn('hover:bg-slate-50/50 border-slate-100', alert.resolved && 'opacity-60')}>
                                                    <TableCell className="pl-6 py-4 font-mono text-[11px] text-slate-500 font-bold whitespace-nowrap tabular-nums">
                                                        {ms ? format(new Date(ms), 'yyyy-MM-dd HH:mm') : '-'}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn(
                                                            'text-[10px] font-black',
                                                            alert.level === 'critical' ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                                        )}>
                                                            <AlertTriangle className="h-3 w-3 mr-1" />
                                                            {alert.level === 'critical' ? '重大警報' : '系統提醒'}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-xs font-bold text-slate-800 max-w-[360px]">
                                                        {alert.message || '系統監控事件'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {alert.resolved ? (
                                                            <Badge className="bg-slate-100 text-slate-500 border-slate-200 text-[10px] font-bold">
                                                                已結案
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold">
                                                                未處理
                                                            </Badge>
                                                        )}
                                                    </TableCell>
                                                    <TableCell className="text-right pr-6 whitespace-nowrap">
                                                        <div className="inline-flex items-center gap-1">
                                                            {!alert.resolved && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() => handleResolve(alert.id)}
                                                                    className="h-8 rounded-lg text-xs font-bold border-slate-200 hover:bg-slate-50 cursor-pointer"
                                                                >
                                                                    <Check className="h-3.5 w-3.5 mr-1 text-emerald-600" /> 結案
                                                                </Button>
                                                            )}
                                                            <Button
                                                                size="icon"
                                                                variant="ghost"
                                                                onClick={() => handleDeleteRecord(alert.id)}
                                                                className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                                                                title="刪除紀錄"
                                                            >
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </Button>
                                                        </div>
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-12 text-center text-xs text-slate-400 font-bold">
                                                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto mb-2 opacity-40" />
                                                目前無手動或歷史警報工單紀錄。
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
