'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore, useMemoFirebase, useUser } from '@/firebase';
import { collection, doc, addDoc, updateDoc, increment, serverTimestamp, query, orderBy, limit, where } from 'firebase/firestore';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Ticket, Search, UserCheck, ShieldCheck, Sparkles, Clock, AlertCircle, RefreshCw, Send, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { UserProfile } from '@/types/user-profile';

export interface EventTicketDispatchRecord {
    id: string;
    poolId: string;
    poolName: string;
    userId: string;
    userName: string;
    userEmail?: string;
    userAvatar?: string;
    ticketName?: string;
    amount: number;
    reason: string;
    adminUid: string;
    adminEmail?: string;
    createdAt: any;
    type?: 'grant' | 'revoke';
}

interface PoolOption {
    id: string;
    name: string;
    isEventPool?: boolean;
    exclusiveTicketOnly?: boolean;
    eventTicketName?: string;
}

interface DispatchDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    pool?: PoolOption;
    allPools?: PoolOption[];
    onSuccess?: () => void;
}

export function EventTicketDispatchDialog({
    open,
    onOpenChange,
    pool,
    allPools,
    onSuccess,
}: DispatchDialogProps) {
    const firestore = useFirestore();
    const { user: currentAdmin } = useUser();
    const { toast } = useToast();

    const [selectedPoolId, setSelectedPoolId] = useState<string>(pool?.id || (allPools?.[0]?.id || ''));
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
    const [ticketCount, setTicketCount] = useState<number>(1);
    const [reason, setReason] = useState('管理員特邀活動資格');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Fetch users for selection
    const usersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), limit(150));
    }, [firestore]);

    const { data: users, isLoading: isLoadingUsers } = useCollection<UserProfile>(usersQuery);

    const activePool = useMemo(() => {
        if (pool) return pool;
        return allPools?.find(p => p.id === selectedPoolId) || allPools?.[0];
    }, [pool, allPools, selectedPoolId]);

    const filteredUsers = useMemo(() => {
        if (!users) return [];
        if (!searchTerm.trim()) return users.slice(0, 10);
        const term = searchTerm.toLowerCase();
        return users.filter(u =>
            (u.username && u.username.toLowerCase().includes(term)) ||
            (u.email && u.email.toLowerCase().includes(term)) ||
            (u.id && u.id.toLowerCase().includes(term))
        ).slice(0, 15);
    }, [users, searchTerm]);

    const currentTicketsForSelected = useMemo(() => {
        if (!selectedUser || !activePool?.id) return 0;
        return selectedUser.eventPoolTickets?.[activePool.id] || 0;
    }, [selectedUser, activePool?.id]);

    const quickReasons = [
        '管理員特邀活動資格',
        'VIP貴賓專屬回饋',
        '線上/線下卡展大獎',
        '社群競賽前列殊榮',
        '官方賽事先知優勝',
        '特定活動回饋補償'
    ];

    const handleSubmit = async () => {
        if (!firestore || !selectedUser || !activePool) {
            toast({ variant: 'destructive', title: '請先選擇獲派玩家與卡池' });
            return;
        }

        if (ticketCount <= 0) {
            toast({ variant: 'destructive', title: '派發張數必須大於 0' });
            return;
        }

        setIsSubmitting(true);
        try {
            const ticketName = activePool.eventTicketName || '活動專屬抽卡券';
            const finalReason = reason.trim() || '管理員專屬派發';

            // 1. 更新使用者 eventPoolTickets[poolId]
            const userRef = doc(firestore, 'users', selectedUser.id);
            await updateDoc(userRef, {
                [`eventPoolTickets.${activePool.id}`]: increment(ticketCount)
            });

            // 2. 建立派發詳細記錄 (供管理員後台稽核與日誌檢視)
            await addDoc(collection(firestore, 'eventTicketDispatches'), {
                poolId: activePool.id,
                poolName: activePool.name,
                userId: selectedUser.id,
                userName: selectedUser.username || selectedUser.email || '玩家',
                userEmail: selectedUser.email || '',
                userAvatar: selectedUser.photoURL || '',
                ticketName: ticketName,
                amount: ticketCount,
                reason: finalReason,
                adminUid: currentAdmin?.uid || 'admin',
                adminEmail: currentAdmin?.email || 'admin@platform',
                createdAt: serverTimestamp(),
                type: 'grant'
            });

            // 3. 記錄至交易記錄，讓玩家能在其個人明細中看到獲贈說明
            await addDoc(collection(firestore, 'transactions'), {
                userId: selectedUser.id,
                transactionType: 'AdminGrant',
                currency: 'event-ticket',
                amount: ticketCount,
                details: `管理員派發【${activePool.name}】${ticketName}: ${finalReason} (+${ticketCount}張)`,
                transactionDate: serverTimestamp(),
                section: 'admin_grant'
            });

            toast({
                title: '🎟️ 抽卡券派發成功！',
                description: `已成功為「${selectedUser.username || selectedUser.email}」派發 ${ticketCount} 張【${activePool.name}】專屬券！`,
            });

            onOpenChange(false);
            setSelectedUser(null);
            setTicketCount(1);
            onSuccess?.();
        } catch (error: any) {
            console.error('Error dispatching event ticket:', error);
            toast({
                variant: 'destructive',
                title: '派發失敗',
                description: error.message || '派發過程發生錯誤，請稍後重試。',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl bg-[#0d1322] border-slate-700 text-slate-100 rounded-3xl shadow-2xl p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
                <DialogHeader className="space-y-2">
                    <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                            <Ticket className="w-5 h-5" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                                派發活動卡池專屬抽卡券
                                <Badge className="bg-amber-500/20 text-amber-300 border border-amber-500/30 font-mono text-[10px]">
                                    ADMIN EXCLUSIVE
                                </Badge>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400">
                                依活動規則為特定玩家派發指定卡池之專屬抽卡券，系統將永久記錄派發名單與稽核日誌。
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-5 pt-2">
                    {/* 目標卡池選擇 (若未鎖定特定卡池) */}
                    {allPools && !pool && (
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-300">選擇目標活動卡池</Label>
                            <select
                                value={selectedPoolId}
                                onChange={(e) => setSelectedPoolId(e.target.value)}
                                className="w-full h-11 px-3.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white font-medium focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            >
                                {allPools.map((p) => (
                                    <option key={p.id} value={p.id}>
                                        {p.isEventPool ? '🎪 [活動池] ' : ''}{p.name} {p.exclusiveTicketOnly ? '(僅限專屬券)' : ''}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {activePool && (
                        <div className="p-3.5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-purple-950/30 to-slate-900 border border-amber-500/30 flex items-center justify-between">
                            <div className="space-y-0.5">
                                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <Sparkles className="w-3 h-3" /> 目前選中卡池
                                </div>
                                <div className="text-base font-black text-white">{activePool.name}</div>
                                <div className="text-xs text-slate-400">
                                    券種：<span className="text-amber-300 font-bold">{activePool.eventTicketName || '活動專屬抽卡券'}</span>
                                    {activePool.exclusiveTicketOnly && (
                                        <span className="ml-2 text-rose-300 font-medium">· 限制只有管理員派發可抽</span>
                                    )}
                                </div>
                            </div>
                            <div className="text-right">
                                <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10 font-bold">
                                    活動限定
                                </Badge>
                            </div>
                        </div>
                    )}

                    {/* 選擇獲派玩家 */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-cyan-400" />
                                選擇受贈玩家（搜尋暱稱、信箱或 ID）
                            </Label>
                            {selectedUser && (
                                <button
                                    type="button"
                                    onClick={() => setSelectedUser(null)}
                                    className="text-[11px] text-cyan-400 hover:underline"
                                >
                                    重新選擇玩家
                                </button>
                            )}
                        </div>

                        {!selectedUser ? (
                            <div className="space-y-2">
                                <div className="relative">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
                                    <Input
                                        placeholder="輸入玩家暱稱、Email 搜尋..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="pl-9 h-11 bg-slate-900/90 border-slate-700 text-sm text-white placeholder:text-slate-500 rounded-xl"
                                    />
                                </div>

                                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60 divide-y divide-slate-850">
                                    {isLoadingUsers ? (
                                        <div className="p-4 text-center text-xs text-slate-500">正在讀取會員列表...</div>
                                    ) : filteredUsers.length === 0 ? (
                                        <div className="p-4 text-center text-xs text-slate-500">未找到符合條件的會員</div>
                                    ) : (
                                        filteredUsers.map((u) => (
                                            <div
                                                key={u.id}
                                                onClick={() => setSelectedUser(u)}
                                                className="p-2.5 flex items-center justify-between hover:bg-slate-800/60 cursor-pointer transition-colors"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0">
                                                    <Avatar className="w-8 h-8 rounded-full border border-slate-700 shrink-0">
                                                        <AvatarImage src={u.photoURL} />
                                                        <AvatarFallback className="bg-slate-800 text-xs font-bold text-slate-300">
                                                            {(u.username || 'U')[0]}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="truncate">
                                                        <div className="text-xs font-bold text-white truncate flex items-center gap-1.5">
                                                            {u.username || '未命名玩家'}
                                                            {u.role === 'admin' && (
                                                                <Badge className="bg-purple-500/20 text-purple-300 text-[9px] px-1 py-0">管理員</Badge>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-mono truncate">{u.email || u.id}</div>
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <span className="text-[11px] text-slate-400">目前持有: </span>
                                                    <span className="font-mono font-bold text-amber-400 text-xs">
                                                        {u.eventPoolTickets?.[activePool?.id || ''] || 0} 張
                                                    </span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="p-3.5 rounded-2xl bg-slate-900 border border-cyan-500/40 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Avatar className="w-10 h-10 rounded-xl border border-cyan-500/40">
                                        <AvatarImage src={selectedUser.photoURL} />
                                        <AvatarFallback className="bg-cyan-950 text-cyan-300 font-bold">
                                            {(selectedUser.username || 'U')[0]}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="text-sm font-black text-white flex items-center gap-1.5">
                                            {selectedUser.username || '玩家'}
                                            <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                                        </div>
                                        <div className="text-xs text-slate-400 font-mono">{selectedUser.email || selectedUser.id}</div>
                                    </div>
                                </div>
                                <div className="text-right bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
                                    <div className="text-[10px] text-slate-400">本卡池現有券數</div>
                                    <div className="font-mono font-black text-amber-400 text-sm">
                                        {currentTicketsForSelected} 張
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 派發張數 */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-300">派發抽卡券張數</Label>
                        <div className="flex items-center gap-2">
                            {[1, 2, 3, 5, 10].map((num) => (
                                <Button
                                    key={num}
                                    type="button"
                                    variant={ticketCount === num ? 'default' : 'outline'}
                                    onClick={() => setTicketCount(num)}
                                    className={cn(
                                        'flex-1 h-9 rounded-xl font-mono font-bold text-xs transition-all',
                                        ticketCount === num
                                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md shadow-amber-500/20'
                                            : 'border-slate-700 bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                                    )}
                                >
                                    +{num} 張
                                </Button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <Input
                                type="number"
                                min={1}
                                max={100}
                                value={ticketCount}
                                onChange={(e) => setTicketCount(Math.max(1, parseInt(e.target.value) || 1))}
                                className="h-10 bg-slate-900/90 border-slate-700 text-white font-mono font-bold text-sm rounded-xl"
                            />
                            <span className="text-xs text-slate-400 shrink-0 font-medium">
                                派發後該玩家總計持有：
                                <span className="font-mono font-bold text-amber-300 ml-1">
                                    {currentTicketsForSelected + ticketCount} 張
                                </span>
                            </span>
                        </div>
                    </div>

                    {/* 派發原因 / 規則說明 */}
                    <div className="space-y-2">
                        <Label className="text-xs font-bold text-slate-300">派發原因 / 規則備註（將完整存檔供查詢）</Label>
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                            {quickReasons.map((qr) => (
                                <button
                                    key={qr}
                                    type="button"
                                    onClick={() => setReason(qr)}
                                    className={cn(
                                        'px-2 py-1 rounded-lg text-[11px] font-medium transition-all',
                                        reason === qr
                                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                                    )}
                                >
                                    {qr}
                                </button>
                            ))}
                        </div>
                        <Textarea
                            rows={2}
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            placeholder="填寫派發原因，例如：線下球星卡展VIP預購名額、社群預測優勝等..."
                            className="bg-slate-900/90 border-slate-700 text-sm text-white placeholder:text-slate-500 rounded-xl"
                        />
                    </div>
                </div>

                <DialogFooter className="gap-2 pt-4 border-t border-slate-800">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={() => onOpenChange(false)}
                        disabled={isSubmitting}
                        className="text-slate-400 hover:text-white"
                    >
                        取消
                    </Button>
                    <Button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || !selectedUser || ticketCount <= 0}
                        className="h-11 px-6 rounded-xl font-black bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 shadow-lg shadow-amber-500/20 flex items-center gap-2"
                    >
                        {isSubmitting ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                            <Send className="w-4 h-4" />
                        )}
                        確認派發 {ticketCount} 張專屬券
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

interface LogsProps {
    poolId?: string; // Optional: if provided, filters by poolId
    title?: string;
}

export function EventTicketDispatchLogs({ poolId, title }: LogsProps) {
    const firestore = useFirestore();
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPoolFilter, setSelectedPoolFilter] = useState<string>(poolId || 'ALL');

    const logsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        if (poolId) {
            return query(
                collection(firestore, 'eventTicketDispatches'),
                where('poolId', '==', poolId),
                orderBy('createdAt', 'desc'),
                limit(100)
            );
        }
        return query(
            collection(firestore, 'eventTicketDispatches'),
            orderBy('createdAt', 'desc'),
            limit(150)
        );
    }, [firestore, poolId]);

    const { data: rawLogs, isLoading, refresh } = useCollection<EventTicketDispatchRecord>(logsQuery);

    const poolsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'cardPools'), limit(100));
    }, [firestore]);
    const { data: allPools } = useCollection<any>(poolsQuery);

    const filteredLogs = useMemo(() => {
        if (!rawLogs) return [];
        return rawLogs.filter((log) => {
            const matchesSearch =
                !searchTerm.trim() ||
                (log.userName && log.userName.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (log.userEmail && log.userEmail.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (log.reason && log.reason.toLowerCase().includes(searchTerm.toLowerCase())) ||
                (log.poolName && log.poolName.toLowerCase().includes(searchTerm.toLowerCase()));

            const matchesPool =
                selectedPoolFilter === 'ALL' ||
                log.poolId === selectedPoolFilter;

            return matchesSearch && matchesPool;
        });
    }, [rawLogs, searchTerm, selectedPoolFilter]);

    // Statistics
    const stats = useMemo(() => {
        if (!rawLogs) return { totalTickets: 0, totalCount: 0, distinctUsers: 0 };
        const userSet = new Set<string>();
        let totalTickets = 0;
        rawLogs.forEach((l) => {
            totalTickets += l.amount || 0;
            if (l.userId) userSet.add(l.userId);
        });
        return {
            totalTickets,
            totalCount: rawLogs.length,
            distinctUsers: userSet.size,
        };
    }, [rawLogs]);

    return (
        <div className="space-y-4">
            {/* 統計與標題 */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <Ticket className="w-5 h-5 text-amber-500" />
                        {title || '活動抽卡券派發與稽核日誌'}
                    </h3>
                    <p className="text-xs text-slate-500">
                        永久記載管理員派發給玩家之專屬抽卡券清單，包含受贈對象、張數、原因與時間。
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => refresh()}
                        className="h-8 text-xs font-bold border-slate-200 text-slate-700"
                    >
                        <RefreshCw className="w-3.5 h-3.5 mr-1" />
                        重新整理
                    </Button>
                </div>
            </div>

            {/* 統計面板卡片 */}
            <div className="grid grid-cols-3 gap-3">
                <Card className="p-3.5 border-slate-200 bg-white rounded-2xl shadow-sm">
                    <div className="text-[11px] font-bold text-slate-500">累計派發票券</div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-amber-600 mt-0.5">
                        {stats.totalTickets} <span className="text-xs font-normal text-slate-500">張</span>
                    </div>
                </Card>
                <Card className="p-3.5 border-slate-200 bg-white rounded-2xl shadow-sm">
                    <div className="text-[11px] font-bold text-slate-500">總派發次數</div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-cyan-600 mt-0.5">
                        {stats.totalCount} <span className="text-xs font-normal text-slate-500">筆</span>
                    </div>
                </Card>
                <Card className="p-3.5 border-slate-200 bg-white rounded-2xl shadow-sm">
                    <div className="text-[11px] font-bold text-slate-500">獲券玩家人數</div>
                    <div className="text-xl sm:text-2xl font-black font-mono text-emerald-600 mt-0.5">
                        {stats.distinctUsers} <span className="text-xs font-normal text-slate-500">人</span>
                    </div>
                </Card>
            </div>

            {/* 篩選與搜尋列 */}
            <div className="flex flex-col sm:flex-row gap-2.5">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                    <Input
                        placeholder="搜尋玩家暱稱、信箱、派發原因或卡池..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-9 h-9 text-xs bg-white border-slate-200 rounded-xl"
                    />
                </div>

                {!poolId && allPools && (
                    <select
                        value={selectedPoolFilter}
                        onChange={(e) => setSelectedPoolFilter(e.target.value)}
                        className="h-9 px-3 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700"
                    >
                        <option value="ALL">全部卡池</option>
                        {allPools.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.name}
                            </option>
                        ))}
                    </select>
                )}
            </div>

            {/* 表格 */}
            <Card className="border-slate-200 bg-white rounded-2xl shadow-sm overflow-hidden">
                <Table>
                    <TableHeader className="bg-slate-50">
                        <TableRow className="border-b-slate-200">
                            <TableHead className="w-36 text-[10px] font-black uppercase text-slate-800 tracking-wider">派發時間</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-800 tracking-wider">獲贈玩家</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-800 tracking-wider">目標卡池</TableHead>
                            <TableHead className="w-28 text-center text-[10px] font-black uppercase text-slate-800 tracking-wider">派發張數</TableHead>
                            <TableHead className="text-[10px] font-black uppercase text-slate-800 tracking-wider">派發原因 / 規則備註</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase text-slate-800 tracking-wider pr-4">操作管理員</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-12 text-slate-400 text-xs">
                                    正在載入派發日誌...
                                </TableCell>
                            </TableRow>
                        ) : filteredLogs.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-16 text-slate-400 text-xs italic">
                                    <div className="flex flex-col items-center gap-2">
                                        <AlertCircle className="w-8 h-8 opacity-20 text-slate-400" />
                                        <span>尚無符合條件的抽卡券派發記錄</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            filteredLogs.map((log) => {
                                const createdDate = log.createdAt?.toDate ? log.createdAt.toDate() : (log.createdAt ? new Date(log.createdAt.seconds * 1000) : new Date());
                                return (
                                    <TableRow key={log.id} className="hover:bg-slate-50/70 border-b-slate-100">
                                        <TableCell className="text-xs font-mono text-slate-600">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                {format(createdDate, 'yyyy/MM/dd HH:mm')}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <Avatar className="w-7 h-7 rounded-full border border-slate-200">
                                                    <AvatarImage src={log.userAvatar} />
                                                    <AvatarFallback className="bg-slate-100 text-[10px] font-bold text-slate-600">
                                                        {(log.userName || 'U')[0]}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div>
                                                    <div className="text-xs font-bold text-slate-900">{log.userName || '玩家'}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{log.userEmail || log.userId}</div>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 font-bold text-[11px]">
                                                {log.poolName || log.poolId}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-mono font-black bg-amber-100 text-amber-800 border border-amber-200">
                                                +{log.amount} 張
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-700 max-w-xs truncate font-medium">
                                            {log.reason || '管理員手動派發'}
                                        </TableCell>
                                        <TableCell className="text-right text-[11px] font-mono text-slate-500 pr-4">
                                            {log.adminEmail || 'Admin'}
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
