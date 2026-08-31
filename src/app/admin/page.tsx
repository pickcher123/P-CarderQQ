'use client';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Truck, Ticket, Archive, Package, Swords, Newspaper, UserCircle, ShoppingBag, Palette, ShieldCheck, Plus, LayoutList, BarChartHorizontal, Megaphone, Trash2, AlertTriangle, FileText, Lock, Loader2, RefreshCw, ArrowUpRight, CheckCircle2 } from 'lucide-react';
import { useRequest, useFirestore, useMemoFirebase, useDoc, useUser } from "@/firebase";
import { collection, doc, updateDoc, query, where, getDocs, writeBatch } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import type { SystemConfig } from "@/types/system";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface GenericDoc { id: string; [key: string]: any; }

const QUICK_ACTIONS = [
    { label: '新增卡片 / 上傳', desc: '新增單張或批量上傳卡牌', href: '/admin/cards/area/all', icon: Plus, color: 'text-blue-600 bg-blue-50/70 border-blue-200/80 hover:bg-blue-100/80' },
    { label: '出貨訂單審核', desc: '檢視並填寫物流單號', href: '/admin/shipping', icon: Truck, color: 'text-amber-600 bg-amber-50/70 border-amber-200/80 hover:bg-amber-100/80' },
    { label: '發布全站公告', desc: '更新首頁公告與跑馬燈', href: '/admin/announcements', icon: Megaphone, color: 'text-purple-600 bg-purple-50/70 border-purple-200/80 hover:bg-purple-100/80' },
    { label: '營收報表分析', desc: '查看點數與營運毛利', href: '/admin/reports', icon: BarChartHorizontal, color: 'text-emerald-600 bg-emerald-50/70 border-emerald-200/80 hover:bg-emerald-100/80' },
];

const MODULE_CATEGORIES = [
    {
        title: '數據與營收',
        items: [
            { label: '營業報表', desc: '營收與毛利分析', href: '/admin/reports', icon: BarChartHorizontal, color: 'text-emerald-600' },
            { label: '交易紀錄', desc: '玩家點數與消費流水', href: '/admin/orders', icon: FileText, color: 'text-slate-700' },
            { label: '儲值管理', desc: '儲值審核與紀錄', href: '/admin/deposits', icon: Archive, color: 'text-indigo-600' },
            { label: '轉點紀錄', desc: '卡牌點數轉換記錄', href: '/admin/conversions', icon: RefreshCw, color: 'text-cyan-600' },
        ]
    },
    {
        title: '遊戲玩法管理',
        items: [
            { label: '卡片總管', desc: '全站卡牌資產庫', href: '/admin/cards', icon: Archive, color: 'text-blue-600' },
            { label: '抽卡管理', desc: '轉蛋卡池與機率配置', href: '/admin/card-pools', icon: Package, color: 'text-cyan-600' },
            { label: '拼卡管理', desc: '自選號碼競猜項目', href: '/admin/betting', icon: Swords, color: 'text-pink-600' },
            { label: '福袋管理', desc: '福袋獎品配置與上架', href: '/admin/lucky-bags', icon: Ticket, color: 'text-amber-600' },
            { label: '團拆管理', desc: '直播開盒項目建立', href: '/admin/group-breaks', icon: Users, color: 'text-violet-600' },
        ]
    },
    {
        title: '營運與行銷',
        items: [
            { label: '會員資訊', desc: '帳號查詢與權限設定', href: '/admin/users', icon: UserCircle, color: 'text-emerald-600' },
            { label: '兌換商城', desc: '紅利積點兌換項目', href: '/admin/rewards', icon: ShoppingBag, color: 'text-rose-600' },
            { label: '站內公告', desc: '首頁公告與彈出視窗', href: '/admin/announcements', icon: Megaphone, color: 'text-blue-600' },
            { label: '優惠券管理', desc: '發行折價券與代碼', href: '/admin/coupons', icon: Ticket, color: 'text-emerald-600' },
            { label: '素材管理', desc: '全站橫幅與主題圖庫', href: '/admin/materials', icon: Palette, color: 'text-orange-600' },
            { label: '異常預警', desc: '庫存與數據異常監控', href: '/admin/alerts', icon: AlertTriangle, color: 'text-rose-600' },
        ]
    }
];

const SUPER_ADMIN_EMAIL = 'pickcher123@gmail.com';
const WIPE_PASSWORD = '90301251';

function BetaWipeDialog() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [password, setPassword] = useState('');
    const [isWiping, setIsWiping] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    const handleWipe = async () => {
        if (!firestore) return;
        if (password !== WIPE_PASSWORD) {
            toast({ variant: 'destructive', title: '授權失敗', description: '刪除密碼不正確。' });
            return;
        }

        setIsWiping(true);
        try {
            const collectionsToClear = ['transactions', 'shippingOrders', 'wishes', 'announcements'];
            for (const colName of collectionsToClear) {
                const snap = await getDocs(collection(firestore, colName));
                const batch = writeBatch(firestore);
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }

            const usersSnap = await getDocs(collection(firestore, 'users'));
            for (const userDoc of usersSnap.docs) {
                const batch = writeBatch(firestore);
                batch.update(userDoc.ref, {
                    points: 0,
                    bonusPoints: 0,
                    totalSpent: 0,
                    userLevel: '新手收藏家',
                    hasChangedUsername: false
                });
                const subCollections = ['userCards', 'missionProgress', 'poolStats', 'newsPreferences'];
                for (const sub of subCollections) {
                    const subSnap = await getDocs(collection(firestore, 'users', userDoc.id, sub));
                    subSnap.docs.forEach(sd => batch.delete(sd.ref));
                }
                await batch.commit();
            }

            toast({ title: '數據清除成功', description: '所有 Beta 測試數據已歸零。' });
            setIsOpen(false);
            setPassword('');
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '清除失敗' });
        } finally {
            setIsWiping(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="destructive" className="w-full font-black rounded-xl">
                    <Trash2 className="mr-2 h-4 w-4" /> 清除全站測試數據
                </Button>
            </DialogTrigger>
            <DialogContent className="light bg-white text-slate-900 border-none shadow-2xl rounded-3xl sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-rose-600 font-black text-xl">
                        <AlertTriangle className="h-6 w-6" /> 危險操作確認
                    </DialogTitle>
                    <DialogDescription className="text-slate-600 font-medium pt-2">
                        此操作將會清空全站的訂單記錄、出貨單、交易流水，並將所有會員的點數、累積消費、卡包資產全部重置為 0。
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label className="text-xs font-black text-slate-500 uppercase tracking-widest">請輸入授權密碼</Label>
                        <Input
                            type="password"
                            placeholder="輸入清除密碼..."
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-slate-50 border-slate-200 rounded-xl"
                        />
                    </div>
                </div>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-xl font-bold">
                        取消
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleWipe}
                        disabled={isWiping || !password}
                        className="rounded-xl font-black bg-rose-600 hover:bg-rose-700"
                    >
                        {isWiping ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                        確認永久清除
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function AdminDashboardPage() {
    const firestore = useFirestore();
    const { user: currentUser } = useUser();
    const { toast } = useToast();

    const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const { data: users, isLoading: isLoadingUsers } = useRequest<GenericDoc[]>(usersQuery);

    const luckBagsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'luckBags') : null, [firestore]);
    const { data: luckBags, isLoading: isLoadingLuckBags } = useRequest<GenericDoc[]>(luckBagsQuery);

    const cardPoolsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]);
    const { data: cardPools, isLoading: isLoadingCardPools } = useRequest<GenericDoc[]>(cardPoolsQuery);

    const allCardsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore]);
    const { data: allCards, isLoading: isLoadingCards } = useRequest<any[]>(allCardsQuery);

    const pendingShippingQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'shippingOrders'), where('status', '==', 'pending'));
    }, [firestore]);
    const { data: pendingOrders, isLoading: isLoadingOrders } = useRequest<GenericDoc[]>(pendingShippingQuery);
    
    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig, forceRefetch } = useDoc<SystemConfig>(systemConfigRef);
    const [announcement, setAnnouncement] = useState('');
    
    useEffect(() => {
        if (systemConfig?.announcement) setAnnouncement(systemConfig.announcement);
    }, [systemConfig]);

    const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;

    const totalUsers = users?.length ?? 0;
    const adminUsers = users?.filter((u: any) => u.role === 'admin').length ?? 0;
    const cardsInStock = allCards?.filter((c: any) => !c.isSold).length ?? 0;

    const activePoolsCount = useMemo(() => {
        if (!cardPools) return 0;
        const now = Math.floor(Date.now() / 1000);
        return cardPools.filter(p => {
            const hasStock = (p.remainingPacks ?? 0) > 0;
            const isStarted = !p.startsAt || p.startsAt.seconds <= now;
            const isNotExpired = !p.expiresAt || p.expiresAt.seconds > now;
            return hasStock && isStarted && isNotExpired;
        }).length;
    }, [cardPools]);

    const handleFeatureToggle = async (flagName: keyof NonNullable<SystemConfig['featureFlags']>, isEnabled: boolean) => {
        if (!systemConfigRef) return;
        try {
            await updateDoc(systemConfigRef, {
                [`featureFlags.${flagName}`]: isEnabled,
            });
            toast({ title: '成功', description: '功能開關狀態已更新。' });
            if (forceRefetch) forceRefetch();
        } catch (error) {
            toast({ variant: 'destructive', title: '更新失敗' });
        }
    };

    return (
        <div className="space-y-8">
            {/* Header section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">營運總覽儀表板</h1>
                        <Badge variant="outline" className="text-[11px] font-bold text-slate-600 border-slate-300 bg-white">
                            V{APP_VERSION}
                        </Badge>
                    </div>
                    <p className="mt-1 text-sm text-slate-500 font-medium">即時監控全站營運狀況、卡牌庫存、玩法設定與快捷操作入口。</p>
                </div>
            </div>

            {/* Quick Action Shortcuts */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {QUICK_ACTIONS.map((action) => (
                    <Link
                        key={action.label} 
                        href={action.href}
                        className={cn(
                            "group p-4 rounded-2xl border transition-all flex items-start gap-3.5 bg-white shadow-2xs hover:shadow-sm",
                            action.color
                        )}
                    >
                        <div className="p-2.5 rounded-xl bg-white/90 shadow-2xs shrink-0 group-hover:scale-110 transition-transform">
                            <action.icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black text-slate-900 group-hover:text-primary transition-colors">{action.label}</h3>
                                <ArrowUpRight className="h-3.5 w-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{action.desc}</p>
                        </div>
                    </Link>
                ))}
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                    { label: '會員總數', value: totalUsers, sub: `${adminUsers} 位管理員`, icon: Users, color: 'text-blue-700', bg: 'border-blue-100/80', loading: isLoadingUsers },
                    { label: '在庫卡片', value: cardsInStock, sub: '張上架中資產', icon: Archive, color: 'text-indigo-700', bg: 'border-indigo-100/80', loading: isLoadingCards },
                    { label: '待出貨訂單', value: pendingOrders?.length || 0, sub: '筆待發貨申請', icon: Truck, color: 'text-amber-700', bg: 'border-amber-100/80', loading: isLoadingOrders },
                    { label: '進行中福袋', value: luckBags?.length || 0, sub: '個活動專案', icon: Ticket, color: 'text-rose-700', bg: 'border-rose-100/80', loading: isLoadingLuckBags },
                    { label: '在線抽卡池', value: activePoolsCount, sub: `共 ${cardPools?.length || 0} 個卡池`, icon: Package, color: 'text-cyan-700', bg: 'border-cyan-100/80', loading: isLoadingCardPools },
                ].map((stat, i) => (
                    <Card key={i} className={cn("border bg-white shadow-2xs rounded-2xl overflow-hidden", stat.bg)}>
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                            <CardTitle className="text-[11px] font-black uppercase tracking-wider text-slate-400">{stat.label}</CardTitle>
                            <stat.icon className={cn("h-4 w-4", stat.color)} />
                        </CardHeader>
                        <CardContent className="p-4 pt-0">
                            {stat.loading ? <Skeleton className="h-7 w-16 my-1" /> : <div className={cn("text-2xl font-black font-code text-slate-900")}>{stat.value.toLocaleString()}</div>}
                            <p className="text-[11px] text-slate-500 font-bold">{stat.sub}</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Main Content Layout (Chart + Settings) */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Column (2 Cols): Module directory & Chart */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Visual Chart */}
                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="p-5 pb-2 border-b border-slate-100 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-black text-slate-900">核心營運模組數據分佈</CardTitle>
                                <CardDescription className="text-xs text-slate-500 font-medium">各業務板塊最新資產與專案規模</CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-5 h-[280px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={[
                                    { name: '會員人數', count: totalUsers },
                                    { name: '在庫卡牌', count: cardsInStock },
                                    { name: '待出貨單', count: pendingOrders?.length || 0 },
                                    { name: '福袋專案', count: luckBags?.length || 0 },
                                    { name: '在線卡池', count: activePoolsCount },
                                ]}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                    <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} stroke="#e2e8f0" />
                                    <YAxis tick={{ fontSize: 12, fill: '#64748b', fontWeight: 600 }} stroke="#e2e8f0" />
                                    <Tooltip 
                                        contentStyle={{ backgroundColor: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                                        itemStyle={{ color: '#38bdf8' }}
                                    />
                                    <Bar dataKey="count" fill="#0284c7" radius={[6, 6, 0, 0]} maxBarSize={48} />
                                </BarChart>
                            </ResponsiveContainer>
                        </CardContent>
                    </Card>

                    {/* Categorized Module Directory */}
                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
                        <CardHeader className="p-5 border-b border-slate-100">
                            <CardTitle className="text-base font-black flex items-center gap-2 text-slate-900">
                                <LayoutList className="h-5 w-5 text-slate-400" /> 功能模組快速導覽
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 font-medium">分類直達各個管理子系統進行配置。</CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 space-y-6">
                            {MODULE_CATEGORIES.map((cat) => (
                                <div key={cat.title} className="space-y-3">
                                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider">{cat.title}</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {cat.items.map((item) => (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50/50 hover:bg-white hover:border-slate-300 hover:shadow-2xs transition-all group"
                                            >
                                                <div className="p-2 rounded-lg bg-white border border-slate-200/60 shrink-0 group-hover:scale-105 transition-transform">
                                                    <item.icon className={cn("h-4 w-4", item.color)} />
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <p className="text-xs font-black text-slate-800 group-hover:text-slate-950 truncate">{item.label}</p>
                                                    <p className="text-[11px] text-slate-400 font-medium truncate">{item.desc}</p>
                                                </div>
                                                <ArrowUpRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-700 transition-colors shrink-0" />
                                            </Link>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

                {/* Right Column (1 Col): Global site controls & maintenance */}
                <div className="space-y-6">
                    {/* Announcement control */}
                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
                        <CardHeader className="p-5 pb-3 border-b border-slate-100">
                            <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-900">
                                <Megaphone className="h-4 w-4 text-primary"/> 首頁跑馬燈系統公告
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-5 space-y-4">
                            <textarea 
                                className="w-full min-h-[90px] p-3 rounded-xl border border-slate-200 font-medium text-xs focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all resize-none placeholder:text-slate-400"
                                value={announcement}
                                onChange={(e) => setAnnouncement(e.target.value)}
                                placeholder="輸入首頁顯示的跑馬燈公告內容..."
                            />
                            <div className="flex items-center justify-between">
                                <span className="text-[11px] text-slate-400 font-bold">留空則首頁不顯示</span>
                                <Button 
                                    size="sm" 
                                    onClick={async () => {
                                        if (!systemConfigRef) return;
                                        await updateDoc(systemConfigRef, { announcement });
                                        toast({ title: '已儲存公告', description: '首頁跑馬燈公告已即時更新。' });
                                    }}
                                    className="bg-slate-900 text-white font-bold rounded-lg text-xs h-8 px-4 hover:bg-slate-800"
                                >
                                    儲存更新
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Feature Flags Maintenance switches */}
                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
                        <CardHeader className="p-5 pb-3 border-b border-slate-100">
                            <CardTitle className="text-sm font-black flex items-center gap-2 text-slate-900">
                                <ShieldCheck className="h-4 w-4 text-emerald-600"/> 前台模組運行開關
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 font-medium">即時啟用或暫停前台個別遊戲模組。</CardDescription>
                        </CardHeader>
                        <CardContent className="p-5 space-y-2.5">
                            {[
                                { label: '抽卡轉蛋池', flag: 'isDrawEnabled', desc: '控制全站抽卡功能', defaultVal: true },
                                { label: '幸運福袋', flag: 'isLuckyBagEnabled', desc: '控制福袋選購與拆封', defaultVal: true },
                                { label: '競猜拼卡', flag: 'isBettingEnabled', desc: '控制拼卡選號專區', defaultVal: true },
                                { label: '直播團拆', flag: 'isGroupBreakEnabled', desc: '控制團拆開盒專案', defaultVal: true },
                                { label: '中獎跑馬燈', flag: 'isMarqueeEnabled', desc: '首頁玩家即時中獎廣播', defaultVal: true },
                                { label: '活動代碼快捷推薦 (公開展示)', flag: 'showPromoHints', desc: '前台活動專區是否公開顯示 OPEN2024 等熱門代碼按鈕（預設關閉隱藏）', defaultVal: false },
                            ].map((feat) => (
                                <div key={feat.flag} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl bg-slate-50/60 hover:bg-slate-50 transition-colors">
                                    <div>
                                        <p className="font-bold text-xs text-slate-800">{feat.label}</p>
                                        <p className="text-[10px] text-slate-400 font-medium">{feat.desc}</p>
                                    </div>
                                    <Switch
                                        checked={systemConfig?.featureFlags?.[feat.flag as keyof NonNullable<SystemConfig['featureFlags']>] ?? feat.defaultVal}
                                        onCheckedChange={(checked) => handleFeatureToggle(feat.flag as any, checked)}
                                    />
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Super Admin Wipe Tools */}
                    {isSuperAdmin && (
                        <Card className="border-rose-200 bg-rose-50/20 rounded-2xl shadow-2xs">
                            <CardHeader className="p-5 pb-3">
                                <CardTitle className="text-xs font-black flex items-center gap-2 text-rose-700 uppercase tracking-wider">
                                    <AlertTriangle className="h-4 w-4" /> 超級管理員專區
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="p-5 pt-0">
                                <BetaWipeDialog />
                            </CardContent>
                        </Card>
                    )}
                </div>
            </div>
        </div>
    );
}
