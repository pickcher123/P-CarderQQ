'use client';

import { useState, useMemo, useEffect, useCallback } from "react";
import { useSystemConfig } from "@/components/providers/system-config-provider";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
    Trophy, 
    Sparkles, 
    CalendarCheck, 
    CheckCircle2, 
    Loader2, 
    Star, 
    Gem, 
    Lock, 
    Crown, 
    Package, 
    Library, 
    ChevronRight,
    Dices,
    Zap,
    Gift,
    Truck,
    ListOrdered,
    Medal as MedalIcon,
    Users2,
    Archive,
    RefreshCw,
    Ticket,
    User as UserIcon,
    History,
    Shield,
    AlertCircle,
    Settings,
    Award,
    ShieldCheck,
    Copy,
    Check,
    Plus,
    ExternalLink
} from 'lucide-react';
import { PPlusIcon, DiamondIcon } from "@/components/icons";
import { PurchasePointsDialog } from "@/components/purchase-points-dialog";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, increment, query, where, limit, updateDoc, serverTimestamp, orderBy, writeBatch, getDocs } from "firebase/firestore";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberLevelCrown, userLevels } from "@/components/member-level-crown";
import { InteractiveHonorAtlas } from "@/components/interactive-honor-atlas";
import { InteractiveAchievementWall, InteractiveAchievement } from "@/components/interactive-achievement-wall";
import type { UserProfile } from "@/types/user-profile";
import type { DailyMission, UserMissionProgress } from '@/types/missions';
import type { SystemConfig } from "@/types/system";
import { getBonusMultiplier } from "@/lib/bonus-event";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn, toSafeDate } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TransactionFairnessModal } from '@/components/transaction-fairness-modal';
import type { ProvablyFairData } from '@/lib/provably-fair';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'cancelled';

interface ShippedCard {
    cardId: string;
    rarity: string;
    isFoil: boolean;
    category: string;
}

interface ShippingOrder {
    id: string;
    userId: string;
    cardIds: ShippedCard[];
    cardCount: number;
    name: string;
    phone: string;
    address: string;
    status: OrderStatus;
    shippingMethod: '7-11' | '郵寄' | '面交自取';
    createdAt: { seconds: number };
    trackingNumber?: string;
    fee: number;
    redemptionItem?: string;
}

interface Transaction {
    id: string;
    userId: string;
    transactionDate: { seconds: number };
    amount: number;
    currency?: 'diamond' | 'p-point';
    transactionType: 'Purchase' | 'Deposit' | 'Withdrawal' | 'QuickSell' | 'Refund' | 'Issuance';
    section?: 'draw' | 'lucky-bag' | 'betting' | 'admin' | 'shipping' | 'group-break' | 'deposit' | 'arena';
    details?: string;
    provablyFair?: ProvablyFairData;
}


const statusVariant: Record<OrderStatus, 'default' | 'secondary' | 'destructive' | 'outline'> = {
    pending: 'destructive',
    processing: 'default',
    shipped: 'secondary',
    cancelled: 'outline',
};

const statusText: Record<OrderStatus, string> = {
    pending: '待處理',
    processing: '處理中',
    shipped: '已出貨',
    cancelled: '已取消',
};

function translateDetails(details?: string): string {
    if (typeof details !== 'string' || !details) return '-';
    
    let match = details.match(/^Draw (\d+) from pool: (.*)$/);
    if (match) return `從「${match[2]}」卡池抽 ${match[1]} 次`;
    
    match = details.match(/^Won (.*) P-Points from pool: (.*)$/);
    if (match) return `從「${match[2]}」卡池贏得 ${match[1]} P+`;
    
    match = details.match(/^Bet on (.*)\. Currency: (.*)\. Spots: \[(.*)\]\. Result: (.*)\. Win: (.*)$/);
    if (match) {
        const [, cardName, currency, spots, result, didWin] = match;
        const curName = currency === 'diamond' ? '鑽石' : 'P+';
        const winText = didWin === 'true' ? '中獎' : '未中獎';
        return `拼卡「${cardName}」(${curName})。選號: [${spots}]。結果: ${result} (${winText})`;
    }
    
    match = details.match(/^Direct purchase of card: (.*) via (.*)$/);
    if (match) {
        const [, cardName, currency] = match;
        const curName = currency === 'diamond' ? '鑽石' : 'P+';
        return `直購卡片: ${cardName} (${curName})`;
    }
    
    match = details.match(/^Purchased (\d+) spots in Luck Bag: (.*)$/);
    if (match) return `購買「${match[2]}」福袋 ${match[1]} 格`;
    
    if (details.startsWith('Refund for cancelled shipping order')) return '取消運單退款';
    
    match = details.match(/^Quick sold (\d+) cards\.$/);
    if (match) return `快速轉點 ${match[1]} 張卡片`;
    
    if (details.startsWith('快速轉點')) return details;
    if (details.startsWith('紅利兌換:')) return details;
    if (details.startsWith('運單手續費')) return '出貨運費支付';
    if (details.startsWith('線上儲值')) return details;
    if (details.startsWith('管理員手動調整')) return details;
    if (details.startsWith('獲得福袋大獎')) return details;
    if (details.startsWith('獲得福袋獎項')) return details;
    if (details.startsWith('PAYUNi TradeNo:')) return '線上儲值成功';
    
    return details;
}

function StatCard({ label, value, icon: Icon, color }: { label: string, value: number, icon: any, color: string }) {
    return (
        <div className="p-3 sm:p-4 rounded-xl bg-white/[0.03] hover:bg-white/[0.05] border border-white/[0.08] flex items-center gap-3 transition-[background-color,border-color] duration-150">
            <div className={cn("p-2 rounded-lg bg-white/[0.04] border border-white/[0.08] shrink-0", color)}>
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 opacity-90" />
            </div>
            <div className="min-w-0">
                <p className="text-[11px] text-slate-400 truncate">{label}</p>
                <p className="text-base sm:text-lg font-black font-mono tabular-nums text-white leading-tight">{value.toLocaleString()}</p>
            </div>
        </div>
    );
}

function LeaderboardDialog({ children }: { children: React.ReactNode }) {
    const firestore = useFirestore();
    const [open, setOpen] = useState(false);

    // 僅在打開排行榜彈窗時才查詢 Firestore，且合併為單一查詢避免重複讀取
    const topUsersQuery = useMemoFirebase(() => {
        if (!firestore || !open) return null;
        return query(collection(firestore, 'users'), orderBy('totalSpent', 'desc'), limit(10));
    }, [firestore, open]);
    const { data: topUsers, isLoading } = useCollection<any>(topUsersQuery);

    const rankColors = ["text-[#FDE68A]", "text-slate-300", "text-amber-600"];

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl bg-[#0a0f1c]/95 backdrop-blur-2xl border border-white/[0.1] border-t-amber-300/65 p-0 flex flex-col shadow-[0_24px_64px_rgba(0,0,0,0.85)] text-white">
                <DialogHeader className="p-6 pb-4 bg-white/[0.02] border-b border-white/[0.08]">
                    <div className="flex items-center gap-3">
                        <div className="w-[3px] h-8 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700 shrink-0" />
                        <div>
                            <DialogTitle className="flex items-center gap-2 text-xl font-black font-headline tracking-wider text-white">
                                <Trophy className="h-5 w-5 text-[#FDE68A]" />
                                榮耀排行榜殿堂
                            </DialogTitle>
                            <DialogDescription className="text-slate-400 text-xs mt-0.5">紀錄頂尖藏家的卓越功勳。</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <Tabs defaultValue="spending" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2 h-12 bg-black/40 rounded-none border-b border-white/[0.08] p-1">
                        <TabsTrigger value="spending" className="rounded-lg data-[state=active]:bg-amber-400/[0.12] data-[state=active]:text-[#FDE68A] data-[state=active]:border data-[state=active]:border-amber-300/35 text-slate-400 font-bold text-xs transition-colors">
                            <Gem className="mr-1.5 h-3.5 w-3.5 text-cyan-300" /> 消費實力榜
                        </TabsTrigger>
                        <TabsTrigger value="achievements" className="rounded-lg data-[state=active]:bg-amber-400/[0.12] data-[state=active]:text-[#FDE68A] data-[state=active]:border data-[state=active]:border-amber-300/35 text-slate-400 font-bold text-xs transition-colors">
                            <MedalIcon className="mr-1.5 h-3.5 w-3.5 text-amber-300" /> 成就榮譽榜
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="spending" className="flex-1 overflow-hidden mt-0 p-0">
                        <ScrollArea className="h-[420px]">
                            <div className="p-4 sm:p-5 space-y-2.5">
                                {isLoading ? Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl bg-white/[0.04]" />) :
                                topUsers?.map((u, i) => (
                                    <div key={u.id} className={cn(
                                        "flex items-center justify-between p-3.5 rounded-xl border transition-colors group",
                                        i === 0 ? "bg-amber-400/[0.08] border-amber-300/35" : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]"
                                    )}>
                                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                                            <div className="w-7 flex justify-center font-mono tabular-nums font-black text-base">
                                                {i < 3 ? <Trophy className={cn("h-5 w-5", rankColors[i])} /> : <span className="text-slate-500">{i + 1}</span>}
                                            </div>
                                            <MemberLevelCrown level={u.userLevel} size="sm" />
                                            <div className="overflow-hidden">
                                                <p className="font-bold text-sm text-white group-hover:text-[#FDE68A] transition-colors truncate">{u.username}</p>
                                                <Badge variant="outline" className="text-[9px] h-4 border-white/10 text-slate-400 font-bold">{u.userLevel}</Badge>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0 flex items-center gap-1.5 font-mono tabular-nums font-black text-sm sm:text-base text-white">
                                            <span>{(u.totalSpent || 0).toLocaleString()}</span>
                                            <DiamondIcon className="w-3.5 h-3.5 text-cyan-300" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="achievements" className="flex-1 overflow-hidden mt-0 p-0">
                        <ScrollArea className="h-[420px]">
                            <div className="p-4 sm:p-5 space-y-2.5">
                                {isLoading ? Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-14 w-full rounded-xl bg-white/[0.04]" />) :
                                topUsers?.map((u, i) => (
                                    <div key={u.id} className={cn(
                                        "flex items-center justify-between p-3.5 rounded-xl border transition-colors group",
                                        i === 0 ? "bg-amber-400/[0.08] border-amber-300/35" : "bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.05]"
                                    )}>
                                        <div className="flex items-center gap-3 overflow-hidden flex-1">
                                            <div className="w-7 flex justify-center font-mono tabular-nums font-black text-base">
                                                {i < 3 ? <MedalIcon className={cn("h-5 w-5", rankColors[i])} /> : <span className="text-slate-500">{i + 1}</span>}
                                            </div>
                                            <MemberLevelCrown level={u.userLevel} size="sm" />
                                            <div className="overflow-hidden">
                                                <p className="font-bold text-sm text-white group-hover:text-[#FDE68A] transition-colors truncate">{u.username}</p>
                                                <Badge variant="outline" className="text-[9px] h-4 border-amber-300/30 text-amber-200 font-bold">{u.userLevel}</Badge>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="flex items-center justify-end gap-1 text-[#FDE68A] font-black font-mono tabular-nums text-base">
                                                <Star className="w-4 h-4 fill-amber-300 text-amber-300" />
                                                {Math.floor((u.totalSpent || 0) / 100).toLocaleString()}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}

function ShippingOrdersTab({ userId }: { userId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isCancelling, setIsCancelling] = useState<string | null>(null);
    const [copiedTrackingId, setCopiedTrackingId] = useState<string | null>(null);

    const shippingQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'shippingOrders'), where('userId', '==', userId));
    }, [firestore, userId]);
    const { data: orders, isLoading, forceRefetch } = useCollection<ShippingOrder>(shippingQuery);
    
    const sortedOrders = useMemo(() => orders ? [...orders].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)) : [], [orders]);

    const handleCopyTracking = (orderId: string, tracking: string) => {
        navigator.clipboard.writeText(tracking);
        setCopiedTrackingId(orderId);
        toast({ title: '已複製物流單號', description: tracking });
        setTimeout(() => setCopiedTrackingId(null), 2000);
    };

    const handleTrack711 = (orderId: string, tracking: string) => {
        navigator.clipboard?.writeText(tracking).catch(() => {});
        setCopiedTrackingId(orderId);
        toast({ title: '已複製單號並開啟 7-11 貨態查詢', description: `請於 7-11 查詢頁面貼上單號：${tracking}` });
        setTimeout(() => setCopiedTrackingId(null), 2000);
        window.open('https://eservice.7-11.com.tw/e-tracking/search.aspx', '_blank', 'noopener,noreferrer');
    };

    const handleCancelOrder = async (order: ShippingOrder) => {
        if (!firestore || !userId || order.status !== 'pending') return;
        setIsCancelling(order.id);
        try {
            const batch = writeBatch(firestore);
            batch.update(doc(firestore, 'shippingOrders', order.id), { status: 'cancelled' });
            if ((order.fee || 0) > 0) {
              batch.update(doc(firestore, 'users', userId), { points: increment(order.fee) });
              batch.set(doc(collection(firestore, 'transactions')), { userId, transactionType: 'Refund', section: 'shipping', currency: 'diamond', amount: order.fee, details: `取消運單 ${order.id} 退款`, transactionDate: serverTimestamp() });
            }
            for (const cardInfo of order.cardIds) {
                batch.set(doc(collection(firestore, 'users', userId, 'userCards')), { cardId: (cardInfo as any).cardId, userId, isFoil: (cardInfo as any).isFoil, rarity: (cardInfo as any).rarity, category: (cardInfo as any).category });
            }
            await batch.commit();
            toast({ title: '成功', description: '訂單已取消，鑽石與卡片已退回。' });
            if (forceRefetch) forceRefetch();
        } catch (e) { toast({ variant: 'destructive', title: '錯誤' }); } finally { setIsCancelling(null); }
    };

    return (
        <Card className="border-white/[0.08] border-t-amber-300/50 bg-[#0a0f1c]/95 backdrop-blur-2xl rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
            <CardHeader className="bg-white/[0.02] border-b border-white/[0.08] py-4 px-5">
                <div className="flex items-center gap-3">
                    <div className="w-[3px] h-6 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700" />
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
                        <Truck className="h-4 w-4 sm:h-5 sm:w-5 text-[#FDE68A]" /> 出貨進度查詢
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {/* 手機版卡片視圖 (< md) */}
                <div className="md:hidden divide-y divide-white/[0.06]">
                    {isLoading ? (
                        <div className="p-4 space-y-3">
                            <Skeleton className="h-20 w-full rounded-xl bg-white/[0.04]" />
                            <Skeleton className="h-20 w-full rounded-xl bg-white/[0.04]" />
                        </div>
                    ) : sortedOrders.length === 0 ? (
                        <div className="h-32 flex items-center justify-center text-slate-400 text-xs">
                            目前暫無出貨紀錄
                        </div>
                    ) : (
                        sortedOrders.map(order => (
                            <div key={order.id} className="p-4 space-y-2.5 hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-start justify-between gap-2">
                                    <div className="space-y-1 min-w-0">
                                        <div className="text-sm font-bold text-white">
                                            {order.redemptionItem ? `🎁 ${order.redemptionItem}` : `${order.cardCount} 張球員卡`}
                                        </div>
                                        <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono tabular-nums">
                                            <span>{order.shippingMethod || '標準寄送'}</span>
                                            <span>·</span>
                                            <span>{order.createdAt?.seconds ? format(new Date(order.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '-'}</span>
                                        </div>
                                    </div>
                                    <Badge variant={statusVariant[order.status] || 'default'} className="text-[10px] font-bold shrink-0">
                                        {statusText[order.status]}
                                    </Badge>
                                </div>

                                {order.trackingNumber && (
                                    <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-black/40 border border-white/[0.08]">
                                        <div className="text-[11px] text-slate-300 font-mono tabular-nums truncate">
                                            <span className="text-slate-500 mr-1.5">物流單號</span>
                                            <span className="text-[#FDE68A]">{order.trackingNumber}</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => handleCopyTracking(order.id, order.trackingNumber!)}
                                                className="text-[11px] text-amber-200 hover:text-amber-100 flex items-center gap-1 cursor-pointer"
                                            >
                                                {copiedTrackingId === order.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                                                <span>{copiedTrackingId === order.id ? '已複製' : '複製'}</span>
                                            </button>
                                            {order.shippingMethod === '7-11' && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleTrack711(order.id, order.trackingNumber!)}
                                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-300/15 hover:bg-amber-300/25 border border-amber-300/40 text-[10px] font-bold text-[#FDE68A] cursor-pointer transition-colors"
                                                >
                                                    <span>查貨態</span>
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {order.status === 'pending' && !order.redemptionItem && (
                                    <div className="flex justify-end pt-1">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleCancelOrder(order)}
                                            disabled={!!isCancelling}
                                            className="h-8 text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                        >
                                            {isCancelling === order.id ? '取消中...' : '取消申請'}
                                        </Button>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* 桌面版表格視圖 (>= md) */}
                <div className="hidden md:block overflow-x-auto custom-scrollbar">
                    <Table className="min-w-full">
                        <TableHeader className="bg-black/30">
                            <TableRow className="border-white/[0.08]">
                                <TableHead className="pl-6 text-slate-300">內容 / 張數</TableHead>
                                <TableHead className="text-slate-300">寄送方式 / 物流單號</TableHead>
                                <TableHead className="text-slate-300">申請時間</TableHead>
                                <TableHead className="text-slate-300">狀態</TableHead>
                                <TableHead className="text-right pr-6 text-slate-300">操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow><TableCell colSpan={5} className="p-6"><Skeleton className="h-10 w-full bg-white/[0.04]"/></TableCell></TableRow>
                            ) : sortedOrders.map(order => (
                                <TableRow key={order.id} className="border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                                    <TableCell className="pl-6 font-bold text-white">
                                        {order.redemptionItem ? `🎁 ${order.redemptionItem}` : `${order.cardCount} 張`}
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-300">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-full bg-white/[0.05] border border-white/[0.08] text-[11px] text-slate-300">
                                                {order.shippingMethod || '標準寄送'}
                                            </span>
                                            {order.trackingNumber ? (
                                                <div className="inline-flex items-center gap-2 flex-wrap">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopyTracking(order.id, order.trackingNumber!)}
                                                        className="inline-flex items-center gap-1 font-mono tabular-nums text-[11px] text-[#FDE68A] hover:underline cursor-pointer"
                                                        title="點擊複製物流單號"
                                                    >
                                                        <span>{order.trackingNumber}</span>
                                                        {copiedTrackingId === order.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-75" />}
                                                    </button>
                                                    {order.shippingMethod === '7-11' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleTrack711(order.id, order.trackingNumber!)}
                                                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-300/15 hover:bg-amber-300/25 border border-amber-300/40 text-[10px] font-bold text-[#FDE68A] cursor-pointer transition-colors"
                                                            title="複製單號並開啟 7-11 官方貨態查詢頁"
                                                        >
                                                            <span>查 7-11 貨態</span>
                                                            <ExternalLink className="w-2.5 h-2.5" />
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <span className="text-[11px] text-slate-500">尚未產生單號</span>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs text-slate-400 font-mono tabular-nums">
                                        {order.createdAt?.seconds ? format(new Date(order.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '-'}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant={statusVariant[order.status] || 'default'} className="text-[10px] font-bold">
                                            {statusText[order.status]}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        {order.status === 'pending' && !order.redemptionItem && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleCancelOrder(order)}
                                                disabled={!!isCancelling}
                                                className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-500/10"
                                            >
                                                {isCancelling === order.id ? '取消中...' : '取消申請'}
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {!isLoading && sortedOrders.length === 0 && (
                                <TableRow><TableCell colSpan={5} className="h-32 text-center text-slate-400">目前暫無出貨紀錄</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function TransactionsTab({ transactions, isLoading }: { transactions: Transaction[] | null; isLoading: boolean }) {
    const sorted = useMemo(
        () => transactions ? [...transactions].sort((a, b) => (b.transactionDate?.seconds || 0) - (a.transactionDate?.seconds || 0)).slice(0, 30) : [],
        [transactions]
    );

    return (
        <Card className="border-white/[0.08] border-t-amber-300/50 bg-[#0a0f1c]/95 backdrop-blur-2xl rounded-2xl overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.65)]">
            <CardHeader className="bg-white/[0.02] border-b border-white/[0.08] py-4 px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-center gap-3">
                    <div className="w-[3px] h-6 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700" />
                    <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2 text-white">
                        <History className="h-4 w-4 sm:h-5 sm:w-5 text-[#FDE68A]" /> 最近 30 筆交易明細
                    </CardTitle>
                </div>
                <div className="inline-flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 rounded-full self-start sm:self-auto">
                    <Shield className="w-3.5 h-3.5 shrink-0" />
                    <span>Provably Fair 開獎參數可查</span>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {/* 手機版卡片視圖 (< md) */}
                <div className="md:hidden divide-y divide-white/[0.06]">
                    {isLoading ? (
                        <div className="p-4 space-y-3">
                            <Skeleton className="h-16 w-full rounded-xl bg-white/[0.04]" />
                            <Skeleton className="h-16 w-full rounded-xl bg-white/[0.04]" />
                        </div>
                    ) : sorted.length === 0 ? (
                        <div className="h-32 flex items-center justify-center text-slate-400 text-xs">
                            目前尚無交易紀錄
                        </div>
                    ) : (
                        sorted.map(tx => {
                            const isGameTx = tx.section === 'betting' || tx.section === 'draw' || tx.section === 'lucky-bag' ||
                                (tx.details && (tx.details.includes('拼卡') || tx.details.includes('抽卡') || tx.details.includes('連抽') || tx.details.includes('福袋')));

                            return (
                                <div key={tx.id} className="p-3.5 space-y-2 hover:bg-white/[0.02] transition-colors">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="space-y-0.5 flex-1 min-w-0">
                                            <div className="text-xs font-semibold text-slate-200 line-clamp-2 leading-relaxed">
                                                {translateDetails(tx.details)}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-mono tabular-nums">
                                                {tx.transactionDate?.seconds ? format(new Date(tx.transactionDate.seconds * 1000), 'yyyy-MM-dd HH:mm') : '-'}
                                            </div>
                                        </div>
                                        <div className={cn("font-mono tabular-nums text-sm font-black shrink-0", tx.amount > 0 ? "text-emerald-400" : "text-white")}>
                                            <div className="flex items-center gap-1 justify-end">
                                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                                {tx.currency === 'p-point' ? <PPlusIcon className="h-3 w-3 text-amber-300" /> : <DiamondIcon className="h-3 w-3 text-cyan-300"/>}
                                            </div>
                                        </div>
                                    </div>

                                    {isGameTx && (
                                        <div className="flex items-center justify-between pt-1.5 border-t border-white/[0.06] text-[11px]">
                                            <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                <Shield className="w-3 h-3 text-emerald-400" />
                                                <span>開獎防偽數據</span>
                                            </span>
                                            <TransactionFairnessModal transaction={tx} />
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>

                {/* 桌面版表格視圖 (>= md) */}
                <div className="hidden md:block overflow-x-auto custom-scrollbar">
                    <Table className="min-w-full">
                        <TableHeader className="bg-black/30">
                            <TableRow className="border-white/[0.08]">
                                <TableHead className="pl-6 text-slate-300">詳情內容</TableHead>
                                <TableHead className="text-slate-300">變動金額</TableHead>
                                <TableHead className="text-center text-slate-300">密碼學開獎參數</TableHead>
                                <TableHead className="pr-6 text-slate-300">交易時間</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? <TableRow><TableCell colSpan={4} className="p-6"><Skeleton className="h-10 w-full bg-white/[0.04]"/></TableCell></TableRow> :
                            sorted.map(tx => {
                                const isGameTx = tx.section === 'betting' || tx.section === 'draw' || tx.section === 'lucky-bag' ||
                                    (tx.details && (tx.details.includes('拼卡') || tx.details.includes('抽卡') || tx.details.includes('連抽') || tx.details.includes('福袋')));

                                return (
                                    <TableRow key={tx.id} className="border-white/[0.06] hover:bg-white/[0.03] transition-colors">
                                        <TableCell className="pl-6 text-xs max-w-[300px] truncate leading-relaxed text-slate-200">
                                            {translateDetails(tx.details)}
                                        </TableCell>
                                        <TableCell className={cn("font-mono tabular-nums text-sm font-black", tx.amount > 0 ? "text-emerald-400" : "text-white")}>
                                            <div className="flex items-center gap-1">
                                                {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                                {tx.currency === 'p-point' ? <PPlusIcon className="h-3.5 w-3.5 text-amber-300" /> : <DiamondIcon className="h-3.5 w-3.5 text-cyan-300"/>}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-center py-2">
                                            {isGameTx ? (
                                                <TransactionFairnessModal transaction={tx} />
                                            ) : (
                                                <span className="text-[10px] text-slate-500 font-mono">-</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-xs text-slate-400 font-mono tabular-nums pr-6">
                                            {tx.transactionDate?.seconds ? format(new Date(tx.transactionDate.seconds * 1000), 'MM-dd HH:mm') : '-'}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {!isLoading && sorted.length === 0 && (
                                <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-400">目前尚無交易紀錄</TableCell></TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}

// 依 UID 隔離的模組級記憶體快取：切換分頁回到會員中心時 0ms 秒開，不顯示整頁轉圈
const cachedProfileByUid = new Map<string, UserProfile>();
const cachedProfileUserCardsByUid = new Map<string, any[]>();
const cachedProfileTransactionsByUid = new Map<string, Transaction[]>();

export default function UnifiedMemberCenterPage() {
    const firestore = useFirestore();
    const { user, isUserLoading } = useUser();
    const router = useRouter();
    const { toast } = useToast();
    const [isMounted, setIsMounted] = useState(false);
    
    useEffect(() => {
        setIsMounted(true);
    }, []);

    const userProfileRef = useMemoFirebase(() => (firestore && user && isMounted) ? doc(firestore, "users", user.uid) : null, [firestore, user, isMounted]);
    const { data: liveUserProfile, isLoading: isProfileLoadingRaw, error: profileError } = useDoc<UserProfile>(userProfileRef);
    const userProfile = useMemo(() => {
        if (!user?.uid) return null;
        if (liveUserProfile) {
            cachedProfileByUid.set(user.uid, liveUserProfile);
            return liveUserProfile;
        }
        return cachedProfileByUid.get(user.uid) ?? null;
    }, [liveUserProfile, user?.uid]);
    const isProfileLoading = isProfileLoadingRaw && userProfile === null;

    const { isAdmin: isHookAdmin, isSuperAdmin } = useIsAdmin();
    const isUserAdmin = Boolean(isHookAdmin || isSuperAdmin || userProfile?.role?.toLowerCase() === 'admin' || userProfile?.isAdmin === true);

    const { systemConfig } = useSystemConfig();

    const userCardsQuery = useMemoFirebase(() => (firestore && user?.uid && isMounted) ? collection(firestore, 'users', user.uid, 'userCards') : null, [firestore, user, isMounted]);
    const { data: liveUserCards } = useCollection(userCardsQuery);
    const userCards = useMemo(() => {
        if (!user?.uid) return null;
        if (liveUserCards) {
            cachedProfileUserCardsByUid.set(user.uid, liveUserCards);
            return liveUserCards;
        }
        return cachedProfileUserCardsByUid.get(user.uid) ?? null;
    }, [liveUserCards, user?.uid]);
    
    const txQuery = useMemoFirebase(() => (firestore && user?.uid && isMounted) ? query(collection(firestore, 'transactions'), where('userId', '==', user.uid)) : null, [firestore, user, isMounted]);
    const { data: liveTransactions, isLoading: isTxLoadingRaw } = useCollection<Transaction>(txQuery);
    const allTransactions = useMemo(() => {
        if (!user?.uid) return null;
        if (liveTransactions) {
            cachedProfileTransactionsByUid.set(user.uid, liveTransactions);
            return liveTransactions;
        }
        return cachedProfileTransactionsByUid.get(user.uid) ?? null;
    }, [liveTransactions, user?.uid]);
    const isTxLoading = isTxLoadingRaw && allTransactions === null;
    
    const [username, setUsername] = useState('');
    const [realName, setRealName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isCopiedUid, setIsCopiedUid] = useState(false);

    useEffect(() => {
        if (userProfile) {
            setUsername(userProfile.username || '');
            setRealName(userProfile.realName || '');
            setPhone(userProfile.phone || '');
            setAddress(userProfile.address || ''); 
        }
    }, [userProfile]);

    useEffect(() => {
        if (isMounted && !isUserLoading && !user) router.push('/login');
    }, [isMounted, isUserLoading, user, router]);

    const stats = useMemo(() => {
        if (!userCards || !allTransactions || !userProfile) return { legends: 0, draws: 0, bets: 0, maxAdminGift: 0, foils: 0, luckyBags: 0, groupBreaks: 0, quickSells: 0, daysJoined: 0 };
        
        const adminGifts = allTransactions.filter(t => t.section === 'admin' && t.transactionType === 'Deposit').map(t => t.amount);
        
        let daysJoined = 0;
        if (userProfile.createdAt) {
            const createdDate = toSafeDate(userProfile.createdAt);
            if (createdDate) {
                const now = new Date();
                const diffTime = Math.abs(now.getTime() - createdDate.getTime());
                daysJoined = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            }
        }

        return { 
            legends: userCards.filter(c => c.rarity === 'legendary').length, 
            draws: allTransactions.filter(t => t.section === 'draw').length, 
            bets: allTransactions.filter(t => t.section === 'betting').length, 
            maxAdminGift: adminGifts.length > 0 ? Math.max(...adminGifts) : 0,
            foils: userCards.filter(c => c.isFoil).length,
            luckyBags: allTransactions.filter(t => t.section === 'lucky-bag').length,
            groupBreaks: allTransactions.filter(t => t.section === 'group-break').length,
            quickSells: allTransactions.filter(t => t.transactionType === 'QuickSell').length,
            daysJoined,
        };
    }, [userCards, allTransactions, userProfile]);

    const achievements: InteractiveAchievement[] = useMemo(() => [
        { 
            id: 'first-card', 
            title: '初次啼聲', 
            category: '收藏', 
            icon: Package, 
            unlocked: (userCards?.length || 0) > 0, 
            condition: '獲得第一張卡片',
            current: userCards?.length || 0,
            target: 1,
            unit: '張',
            points: 10,
            rarity: 'common',
            flavorText: '第一張收入口袋的卡牌，正是偉大收藏家生涯的基石。',
            actionLink: '/',
            actionText: '前往抽卡'
        },
        { 
            id: 'collection-50', 
            title: '資深館長', 
            category: '收藏', 
            icon: Library, 
            unlocked: (userCards?.length || 0) >= 50, 
            condition: '收藏達到 50 張卡片',
            current: userCards?.length || 0,
            target: 50,
            unit: '張',
            points: 30,
            rarity: 'rare',
            flavorText: '卡冊已漸漸充實，每一頁都記錄著滿滿的熱情與回憶。',
            actionLink: '/collection',
            actionText: '查看收藏庫'
        },
        { 
            id: 'collector-max', 
            title: '收藏之巔', 
            category: '收藏', 
            icon: Archive, 
            unlocked: (userCards?.length || 0) >= 200, 
            condition: '收藏達到 200 張卡片',
            current: userCards?.length || 0,
            target: 200,
            unit: '張',
            points: 100,
            rarity: 'legendary',
            flavorText: '藏品汗牛充棟，這是一座專屬於你的微型卡牌博物館。',
            actionLink: '/collection',
            actionText: '瞻仰卡冊'
        },
        { 
            id: 'legend-collector', 
            title: '傳奇見證者', 
            category: '稀有度', 
            icon: Crown, 
            unlocked: stats.legends > 0, 
            condition: '獲得 1 張傳奇卡',
            current: stats.legends,
            target: 1,
            unit: '張',
            points: 20,
            rarity: 'rare',
            flavorText: '金光驟閃之時，命定傳奇已烙印在卡盒之中。',
            actionLink: '/',
            actionText: '挑戰傳奇'
        },
        { 
            id: 'lucky-star', 
            title: '強運體質', 
            category: '機率', 
            icon: Sparkles, 
            unlocked: stats.legends >= 5, 
            condition: '獲得 5 張傳奇卡',
            current: stats.legends,
            target: 5,
            unit: '張',
            points: 50,
            rarity: 'epic',
            flavorText: '被幸運女神長期眷顧，五度打破機率天花板。',
            actionLink: '/',
            actionText: '延續歐氣'
        },
        { 
            id: 'legend-20', 
            title: '傳說級收藏家', 
            category: '稀有度', 
            icon: Trophy, 
            unlocked: stats.legends >= 20, 
            condition: '獲得 20 張傳奇卡',
            current: stats.legends,
            target: 20,
            unit: '張',
            points: 100,
            rarity: 'legendary',
            flavorText: '傳說已然成為常態，任何頂級藏品皆難逃你的法眼。',
            actionLink: '/',
            actionText: '傳奇之路'
        },
        { 
            id: 'foil-lover', 
            title: '萬中選一', 
            category: '特殊', 
            icon: Zap, 
            unlocked: stats.foils > 0, 
            condition: '獲得 1 張亮面卡',
            current: stats.foils,
            target: 1,
            unit: '張',
            points: 20,
            rarity: 'rare',
            flavorText: '閃耀動人的折射虹光，是卡迷心中永不褪色的浪漫。',
            actionLink: '/',
            actionText: '尋覓閃卡'
        },
        { 
            id: 'bet-master', 
            title: '拼卡大師', 
            category: '拼卡', 
            icon: Dices, 
            unlocked: stats.bets >= 50, 
            condition: '參與拼卡 50 次',
            current: stats.bets,
            target: 50,
            unit: '次',
            points: 30,
            rarity: 'rare',
            flavorText: '在勝負毫釐之間遊刃有餘，掌握拼卡桌上的絕對節奏。',
            actionLink: '/bet',
            actionText: '參與拼卡'
        },
        { 
            id: 'bet-legend', 
            title: '拼卡之神', 
            category: '拼卡', 
            icon: Dices, 
            unlocked: stats.bets >= 200, 
            condition: '參與拼卡 200 次',
            current: stats.bets,
            target: 200,
            unit: '次',
            points: 100,
            rarity: 'legendary',
            flavorText: '拼卡桌上的不敗神話，每一次出牌都令全場屏息。',
            actionLink: '/bet',
            actionText: '封神之戰'
        },
        { 
            id: 'lucky-bag-pro', 
            title: '福袋達人', 
            category: '活動', 
            icon: Ticket, 
            unlocked: stats.luckyBags >= 10, 
            condition: '購買福袋 10 次',
            current: stats.luckyBags,
            target: 10,
            unit: '次',
            points: 30,
            rarity: 'rare',
            flavorText: '拆開未知驚喜的瞬間，正是收藏最令人心跳加速的魔法。',
            actionLink: '/lucky-bags',
            actionText: '搶購福袋'
        },
        { 
            id: 'break-pioneer', 
            title: '團拆先鋒', 
            category: '活動', 
            icon: Users2, 
            unlocked: stats.groupBreaks >= 5, 
            condition: '參與團拆 5 次',
            current: stats.groupBreaks,
            target: 5,
            unit: '次',
            points: 30,
            rarity: 'rare',
            flavorText: '與志同道合的卡友一同開箱，同享揭曉名卡的震撼與狂歡。',
            actionLink: '/group-break',
            actionText: '加入團拆'
        },
        { 
            id: 'sell-king', 
            title: '快速轉點王', 
            category: '管理', 
            icon: RefreshCw, 
            unlocked: stats.quickSells >= 10, 
            condition: '使用快速轉點 10 次',
            current: stats.quickSells,
            target: 10,
            unit: '次',
            points: 20,
            rarity: 'common',
            flavorText: '靈活調度手頭資源，將暫不需要的卡片瞬間轉化為新戰力。',
            actionLink: '/collection',
            actionText: '資產管理'
        },
        { 
            id: 'wealthy', 
            title: '點數大亨', 
            category: '資產', 
            icon: Gem, 
            unlocked: (userProfile?.points || 0) >= 50000, 
            condition: '持有 50,000 以上鑽石',
            current: userProfile?.points || 0,
            target: 50000,
            unit: '💎',
            points: 50,
            rarity: 'epic',
            flavorText: '深不見底的晶鑽儲備，足以在任何大型展覽現場縱橫捭闔。',
            actionLink: '/shop',
            actionText: '儲值鑽石'
        },
        { 
            id: 'super-draw', 
            title: '十連狂熱', 
            category: '抽卡', 
            icon: Zap, 
            unlocked: stats.draws >= 1000, 
            condition: '累計抽卡 1000 次',
            current: stats.draws,
            target: 1000,
            unit: '次',
            points: 100,
            rarity: 'legendary',
            flavorText: '千次抽卡淬煉出的鋼鐵意志，是全站最堅定的信仰者。',
            actionLink: '/',
            actionText: '十連連抽'
        },
        { 
            id: 'p-plus-pro', 
            title: '紅利狂人', 
            category: '資產', 
            icon: PPlusIcon, 
            unlocked: (userProfile?.totalBonusEarned || 0) >= 1000000, 
            condition: '累計獲得紅利破百萬',
            current: userProfile?.totalBonusEarned || 0,
            target: 1000000,
            unit: '點',
            points: 100,
            rarity: 'legendary',
            flavorText: '百萬紅利點數入帳，這是對尊榮會員最崇高的敬意。',
            actionLink: '/profile',
            actionText: '檢視回饋'
        },
    ], [userCards, stats, userProfile]);

    const currentLevelBenefits = [
        { free: false, rate: 0 },   // 新手
        { free: false, rate: 1 },   // 進階
        { free: false, rate: 1.5 }, // 資深
        { free: false, rate: 2 },   // 大師
        { free: false, rate: 4 },   // 殿堂
        { free: false, rate: 5 },   // 傳奇
        { free: false, rate: 10 },  // 卡神
    ];

    const handleSaveChanges = async () => {
        if (!userProfileRef || !userProfile || !firestore || !user || isSaving) return;
        
        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 2 || trimmedUsername.length > 12) {
            toast({ variant: "destructive", title: "修改失敗", description: "會員名稱長度限定為 2 ~ 12 個字。" });
            return;
        }

        setIsSaving(true);
        try {
            const updates: any = { realName, phone, address };
            
            if (trimmedUsername !== userProfile.username) {
                if (userProfile.hasChangedUsername) {
                    toast({ variant: "destructive", title: "修改失敗", description: "會員名稱僅限修改一次。" });
                    return;
                }
                
                // 檢查名稱是否重複
                const q = query(collection(firestore, 'users'), where('username', '==', trimmedUsername));
                const snapshot = await getDocs(q);
                const isDuplicate = snapshot.docs.some(doc => doc.id !== user.uid);
                
                if (isDuplicate) {
                    toast({ variant: "destructive", title: "修改失敗", description: "此會員名稱已被使用。" });
                    return;
                }

                updates.username = trimmedUsername;
                updates.hasChangedUsername = true;
            }

            await updateDoc(userProfileRef, updates);
            toast({ title: "成功", description: "個人資料已更新。" });
        } catch (e) {
            toast({ variant: "destructive", title: "錯誤", description: "儲存失敗，請稍後再試。" });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCopyUid = () => {
        if (!userProfile?.id) return;
        navigator.clipboard.writeText(userProfile.id);
        setIsCopiedUid(true);
        toast({ title: "已複製 UID", description: userProfile.id });
        setTimeout(() => setIsCopiedUid(false), 2000);
    };

    if (!isMounted || isUserLoading || isProfileLoading) {
        return (
            <div className="container py-32 text-center flex flex-col items-center gap-4">
                <Loader2 className="animate-spin h-12 w-12 text-primary" />
                <p className="font-headline tracking-widest text-muted-foreground animate-pulse">正在讀取會員數據庫...</p>
            </div>
        );
    }

    if (profileError) return <div className="container py-32 text-center text-white">載入資料失敗，請稍後再試。</div>;
    if (!user || !userProfile) return <div className="container py-32 text-center space-y-8 text-white"><Lock className="w-16 h-16 opacity-20 inline-block" /><h2 className="text-2xl font-black uppercase">會員專區</h2><Button size="lg" asChild className="h-14 px-12 rounded-2xl bg-primary text-primary-foreground"><Link href="/login">前往登入</Link></Button></div>;

    const currentLevel = userProfile.userLevel || '新手收藏家';
    const levelInfo = userLevels.find(l => l.level === currentLevel) || userLevels[0];

    return (
        <div className="container py-8 sm:py-12 md:py-16 max-w-7xl relative text-white">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[380px] bg-amber-400/[0.06] blur-[120px] pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] pointer-events-none" />

            {/* 👑 管理員後台專屬入口 (只要具備管理員權限立即呈現) */}
            {isUserAdmin && (
              <div className="relative z-10 mb-5 sm:mb-6 p-4 sm:p-5 rounded-2xl bg-[#0a0f1c]/95 border border-amber-300/40 border-t-amber-300/70 shadow-[0_16px_48px_rgba(0,0,0,0.75)] flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-3.5 text-left w-full sm:w-auto">
                  <div className="w-11 h-11 rounded-xl bg-white/[0.04] border border-amber-300/30 flex items-center justify-center shrink-0">
                    <ShieldCheck className="w-5 h-5 text-[#FDE68A]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm sm:text-base font-black text-[#FDE68A]">
                        {isSuperAdmin ? '系統最高管理員權限已開通' : '系統後台管理權限已開通'}
                      </h2>
                      <Badge className="bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black text-[9px] px-2 py-0.5 border-none rounded-full">
                        ADMIN ACCESS
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      您具備管理後台存取權限，可直接點擊進入營運總覽與各項功能模組。
                    </p>
                  </div>
                </div>
                <Button 
                  asChild
                  className="w-full sm:w-auto shrink-0 h-10 px-5 rounded-xl font-black bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 hover:brightness-105 text-[#120d02] active:scale-[0.98] transition-[transform,filter] text-xs sm:text-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Link href="/admin">
                    <ShieldCheck className="w-4 h-4" />
                    <span>進入後台管理中心</span>
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </Button>
              </div>
            )}

            {/* 頂部會員名片與資產概覽 */}
            <div className="relative z-10 mb-5 sm:mb-6 p-4 sm:p-6 rounded-2xl bg-[#0a0f1c]/95 border border-white/[0.1] border-t-amber-300/65 shadow-[0_24px_64px_rgba(0,0,0,0.85)] backdrop-blur-2xl overflow-hidden">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 sm:gap-6">
                    
                    {/* 左側：會員身份資料 */}
                    <div className="flex items-center gap-3.5 sm:gap-4 min-w-0">
                        <div className="relative shrink-0">
                            <MemberLevelCrown level={userProfile.userLevel} size="sm" />
                        </div>
                        <div className="min-w-0 space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-lg sm:text-xl md:text-2xl font-black text-white tracking-tight truncate">
                                    {userProfile.username}
                                </h1>
                                <Badge className="bg-amber-400/[0.12] text-[#FDE68A] border border-amber-300/35 text-[10px] font-bold px-2.5 py-0.5 rounded-full shrink-0">
                                    <Crown className="w-3 h-3 inline mr-1 text-amber-300" />
                                    {userProfile.userLevel || '新手收藏家'}
                                </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                                <button
                                    type="button"
                                    onClick={handleCopyUid}
                                    className="inline-flex items-center gap-1 hover:text-slate-200 transition-colors cursor-pointer"
                                    title="點擊複製完整 UID"
                                >
                                    <span>UID: <span className="font-mono text-slate-300">{userProfile.id?.slice(0, 10)}...</span></span>
                                    {isCopiedUid ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3 opacity-60" />}
                                </button>
                                <span>•</span>
                                <span className="tabular-nums">已加入 {stats.daysJoined} 天</span>
                            </div>
                        </div>
                    </div>

                    {/* 右側：資產概覽 (鑽石 & 紅利) 與快捷操作 */}
                    <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 w-full lg:w-auto justify-between lg:justify-end">
                        <div className="flex items-center gap-3 sm:gap-4 bg-black/40 border border-white/[0.08] rounded-xl px-3.5 sm:px-4 py-2">
                            {/* 鑽石 */}
                            <div className="flex items-center gap-2">
                                <DiamondIcon className="w-4 h-4 text-cyan-300" />
                                <div>
                                    <div className="text-[10px] text-slate-400 leading-none">鑽石</div>
                                    <div className="text-base sm:text-lg font-black font-mono tabular-nums text-white leading-tight">
                                        {(userProfile?.points ?? 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div className="w-px h-6 bg-white/[0.08]" />

                            {/* 紅利 P+ */}
                            <div className="flex items-center gap-2">
                                <PPlusIcon className="w-4 h-4 text-amber-300" />
                                <div>
                                    <div className="text-[10px] text-slate-400 leading-none">紅利 P+</div>
                                    <div className="text-base sm:text-lg font-black font-mono tabular-nums text-[#FDE68A] leading-tight">
                                        {(userProfile?.bonusPoints ?? 0).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 快捷操作按鈕群 */}
                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            <PurchasePointsDialog>
                                <Button size="sm" className="h-9 px-3 text-xs font-black rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 hover:brightness-105 text-[#120d02] active:scale-[0.98] transition-[transform,filter] cursor-pointer">
                                    <Plus className="w-3.5 h-3.5 mr-1 stroke-[2.5]" />
                                    儲值鑽石
                                </Button>
                            </PurchasePointsDialog>
                            <Button asChild size="sm" variant="ghost" className="h-9 px-3 text-xs font-bold text-slate-200 hover:text-[#FDE68A] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl transition-colors">
                                <Link href="/collection">
                                    <Library className="w-3.5 h-3.5 text-amber-300 mr-1.5" />
                                    收藏庫
                                </Link>
                            </Button>
                            <LeaderboardDialog>
                                <Button size="sm" variant="ghost" className="h-9 px-3 text-xs font-bold text-slate-200 hover:text-[#FDE68A] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] rounded-xl transition-colors cursor-pointer" title="榮耀排行榜">
                                    <ListOrdered className="w-3.5 h-3.5 text-amber-300 mr-1.5" />
                                    排行榜
                                </Button>
                            </LeaderboardDialog>
                        </div>
                    </div>
                </div>
            </div>

            {/* 總覽數據統計卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 mb-6 sm:mb-8 relative z-10">
                <StatCard label="加入天數" value={stats.daysJoined} icon={CalendarCheck} color="text-[#FDE68A]" />
                <StatCard label="收藏卡片數" value={userCards?.length || 0} icon={Library} color="text-amber-300" />
                <StatCard label="累計抽卡數" value={stats.draws} icon={Package} color="text-cyan-300" />
                <StatCard label="拼卡參與次數" value={stats.bets} icon={Dices} color="text-rose-400" />
            </div>

            {/* 會員中心整合導覽分頁 */}
            <Tabs defaultValue="vip" className="space-y-6 sm:space-y-8 relative z-10">
                <TabsList className="grid w-full grid-cols-4 bg-black/40 p-1 sm:p-1.5 rounded-2xl h-12 sm:h-14 border border-white/[0.08] backdrop-blur-xl">
                    <TabsTrigger value="vip" className="rounded-xl data-[state=active]:bg-amber-400/[0.14] data-[state=active]:text-[#FDE68A] data-[state=active]:border data-[state=active]:border-amber-300/40 text-slate-400 hover:text-slate-200 font-bold text-[11px] sm:text-sm tracking-tight sm:tracking-wide transition-colors px-1 sm:px-2 flex items-center justify-center gap-1 sm:gap-1.5">
                        <Crown className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-300 shrink-0" />
                        <span className="truncate">VIP 特權</span>
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-amber-400/[0.14] data-[state=active]:text-[#FDE68A] data-[state=active]:border data-[state=active]:border-amber-300/40 text-slate-400 hover:text-slate-200 font-bold text-[11px] sm:text-sm tracking-tight sm:tracking-wide transition-colors px-1 sm:px-2 flex items-center justify-center gap-1 sm:gap-1.5">
                        <UserIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-300 shrink-0" />
                        <span className="truncate">基本資料</span>
                    </TabsTrigger>
                    <TabsTrigger value="transactions" className="rounded-xl data-[state=active]:bg-amber-400/[0.14] data-[state=active]:text-[#FDE68A] data-[state=active]:border data-[state=active]:border-amber-300/40 text-slate-400 hover:text-slate-200 font-bold text-[11px] sm:text-sm tracking-tight sm:tracking-wide transition-colors px-1 sm:px-2 flex items-center justify-center gap-1 sm:gap-1.5">
                        <History className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-300 shrink-0" />
                        <span className="truncate">帳務紀錄</span>
                    </TabsTrigger>
                    <TabsTrigger value="shipping" className="rounded-xl data-[state=active]:bg-amber-400/[0.14] data-[state=active]:text-[#FDE68A] data-[state=active]:border data-[state=active]:border-amber-300/40 text-slate-400 hover:text-slate-200 font-bold text-[11px] sm:text-sm tracking-tight sm:tracking-wide transition-colors px-1 sm:px-2 flex items-center justify-center gap-1 sm:gap-1.5">
                        <Truck className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-300 shrink-0" />
                        <span className="truncate">出貨管理</span>
                    </TabsTrigger>
                </TabsList>

                {/* 分頁 1: VIP 特權與榮耀成就 */}
                <TabsContent value="vip" className="space-y-10 sm:space-y-14 animate-in fade-in duration-300">
                    
                    {/* 榮耀階級圖譜 (全互動式星軌天梯與全像卡冊) */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-[3px] h-8 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700" />
                                <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-[#FDE68A]">
                                    <Crown className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-xl font-black font-headline tracking-wider text-white flex items-center gap-2 flex-wrap">
                                        <span>榮耀階級圖譜</span>
                                        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#FDE68A] bg-amber-400/[0.12] px-2.5 py-0.5 rounded-full border border-amber-300/35">
                                            INTERACTIVE ATLAS
                                        </span>
                                    </h2>
                                </div>
                            </div>
                            <div className="h-px flex-1 mx-4 sm:mx-6 bg-gradient-to-r from-amber-300/30 via-white/10 to-transparent hidden sm:block" />
                        </div>

                        <InteractiveHonorAtlas
                            currentLevel={userProfile.userLevel || '新手收藏家'}
                            totalSpent={userProfile.totalSpent || 0}
                            bonusPoints={userProfile.bonusPoints || 0}
                            diamondBalance={userProfile.points ?? userProfile.diamondBalance ?? 0}
                            username={userProfile.username || '收藏家'}
                        />
                    </section>

                    {/* 榮譽成就牆 (高科技互動式成就殿堂與全息勳章展位) */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-[3px] h-8 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700" />
                                <div className="p-2 rounded-xl bg-white/[0.04] border border-white/10 text-[#FDE68A]">
                                    <MedalIcon className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-xl font-black font-headline tracking-wider text-white flex items-center gap-2 flex-wrap">
                                        <span>榮譽成就牆</span>
                                        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-[#FDE68A] bg-amber-400/[0.12] px-2.5 py-0.5 rounded-full border border-amber-300/35">
                                            HALL OF ACHIEVEMENTS
                                        </span>
                                    </h2>
                                </div>
                            </div>
                            <div className="h-px flex-1 mx-4 sm:mx-6 bg-gradient-to-r from-amber-300/30 via-white/10 to-transparent hidden sm:block" />
                        </div>

                        <InteractiveAchievementWall
                            achievements={achievements}
                            username={userProfile?.username || '收藏家'}
                        />
                    </section>
                </TabsContent>

                {/* 分頁 2: 個人資料修改 */}
                <TabsContent value="profile" className="animate-in fade-in duration-300">
                    <Card className="border-white/[0.08] border-t-amber-300/60 bg-[#0a0f1c]/95 backdrop-blur-2xl rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,0.75)]">
                        <CardHeader className="p-6 sm:p-7 pb-4 border-b border-white/[0.06]">
                            <div className="flex items-center gap-3">
                                <div className="w-[3px] h-8 rounded-full bg-gradient-to-b from-amber-200 via-amber-400 to-amber-700" />
                                <div>
                                    <CardTitle className="text-lg sm:text-xl font-black font-headline flex items-center gap-2 text-white">
                                        <UserIcon className="h-5 w-5 text-[#FDE68A]" /> 個人資料修改
                                    </CardTitle>
                                    <CardDescription className="text-slate-400 text-xs sm:text-sm mt-0.5">
                                        請務必提供正確的收件資訊，以確保卡片能準確寄送至您的手中。
                                    </CardDescription>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-6 sm:p-7 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="username" className="text-xs font-bold text-slate-300 tracking-wider">會員名稱</Label>
                                        {userProfile.hasChangedUsername && (
                                            <span className="text-[10px] text-rose-400 font-bold flex items-center gap-1">
                                                <AlertCircle className="w-3 h-3" /> 已修改
                                            </span>
                                        )}
                                    </div>
                                    <Input 
                                        id="username" 
                                        value={username} 
                                        onChange={(e) => setUsername(e.target.value)} 
                                        disabled={userProfile.hasChangedUsername}
                                        className={cn(
                                            "h-11 bg-black/40 border-white/[0.1] rounded-xl transition-colors font-bold text-white",
                                            userProfile.hasChangedUsername ? "opacity-50 cursor-not-allowed" : "focus:border-amber-300/60"
                                        )} 
                                        placeholder="請輸入 2-12 位會員名稱"
                                    />
                                    {!userProfile.hasChangedUsername ? (
                                        <p className="text-[11px] text-amber-200/90 font-medium bg-amber-400/[0.08] p-2.5 rounded-xl border border-amber-300/25">
                                            <Sparkles className="w-3.5 h-3.5 inline mr-1 text-[#FDE68A]" /> 
                                            注意：會員名稱限修改 <span className="text-[#FDE68A] font-bold">一次</span>，長度限定為 <span className="text-[#FDE68A] font-bold">2 ~ 12</span> 個字。
                                        </p>
                                    ) : (
                                        <p className="text-[11px] text-slate-400">您已使用過更名機會。</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="realName" className="text-xs font-bold text-slate-300 tracking-wider">收件姓名 (真實姓名)</Label>
                                    <Input id="realName" value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="用於物流核對身份" className="h-11 bg-black/40 border-white/[0.1] rounded-xl focus:border-amber-300/60 transition-colors text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="text-xs font-bold text-slate-300 tracking-wider">聯絡電話</Label>
                                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-11 bg-black/40 border-white/[0.1] rounded-xl focus:border-amber-300/60 transition-colors text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address" className="text-xs font-bold text-slate-300 tracking-wider">預設收件地址 / 7-11 門市</Label>
                                    <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="例如：7-11 台北門市" className="h-11 bg-black/40 border-white/[0.1] rounded-xl focus:border-amber-300/60 transition-colors text-white" />
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-white/[0.06] space-y-2.5">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Shield className="w-4 h-4 text-[#FDE68A]" />
                                    <span className="text-[11px] font-bold tracking-wider">帳戶安全標籤 (UID)</span>
                                </div>
                                <div className="flex items-center justify-between gap-3 p-3 bg-black/40 rounded-xl border border-white/[0.08]">
                                    <code className="text-xs font-mono text-slate-200 break-all">{userProfile.id}</code>
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="ghost"
                                        onClick={handleCopyUid}
                                        className="h-8 px-2.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-xs text-[#FDE68A] shrink-0 cursor-pointer"
                                    >
                                        {isCopiedUid ? <Check className="w-3.5 h-3.5 text-emerald-400 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                                        {isCopiedUid ? '已複製' : '複製'}
                                    </Button>
                                </div>
                            </div>

                            <Button
                                onClick={handleSaveChanges}
                                disabled={isSaving}
                                className="w-full sm:w-auto h-11 px-8 font-black text-sm rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 hover:brightness-105 text-[#120d02] active:scale-[0.98] transition-[transform,filter] cursor-pointer"
                            >
                                {isSaving ? (
                                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 儲存中...</>
                                ) : (
                                    <><CheckCircle2 className="mr-2 h-4 w-4" /> 儲存變更內容</>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 分頁 3: 交易帳務明細（複用外層 transactions 監聽，不重複訂閱） */}
                <TabsContent value="transactions" className="animate-in fade-in duration-300">
                    <TransactionsTab transactions={allTransactions} isLoading={isTxLoading} />
                </TabsContent>
                
                {/* 分頁 4: 出貨管理查詢 */}
                <TabsContent value="shipping" className="animate-in fade-in duration-300">
                    <ShippingOrdersTab userId={user.uid} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
