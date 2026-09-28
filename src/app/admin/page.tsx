'use client';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { 
  Users, 
  Truck, 
  Ticket, 
  Archive, 
  Package, 
  Swords, 
  ShieldCheck, 
  Plus, 
  BarChartHorizontal, 
  Megaphone, 
  Trash2, 
  AlertTriangle, 
  FileText, 
  Loader2, 
  RefreshCw, 
  ArrowUpRight, 
  Share2, 
  Sparkles, 
  ExternalLink, 
  Activity, 
  Info, 
  Disc3,
  CheckCircle,
  Clock,
  Layers,
  ShoppingBag,
  Palette
} from 'lucide-react';
import { useRequest, useFirestore, useMemoFirebase, useDoc, useUser } from "@/firebase";
import { collection, doc, updateDoc, query, where, getDocs, writeBatch, setDoc } from "firebase/firestore";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useState, useEffect, useMemo } from "react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { SystemConfig } from "@/types/system";
import { APP_VERSION } from "@/lib/version";
import { cn } from "@/lib/utils";
import Link from 'next/link';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface GenericDoc { id: string; [key: string]: any; }

const SUPER_ADMIN_EMAIL = 'pickcher123@gmail.com';
const WIPE_PASSWORD = '90301251';

const QUICK_ACTIONS = [
  { 
    label: '新增卡片資產', 
    desc: '單張或批量上傳卡牌', 
    href: '/admin/cards/area/all', 
    icon: Plus, 
    accent: 'border-blue-200 text-blue-600 bg-blue-50/50 hover:bg-blue-50' 
  },
  { 
    label: '出貨訂單審核', 
    desc: '檢視待發貨與物流單', 
    href: '/admin/shipping', 
    icon: Truck, 
    accent: 'border-amber-200 text-amber-600 bg-amber-50/50 hover:bg-amber-50' 
  },
  { 
    label: '發布首頁公告', 
    desc: '更新首頁公告與跑馬燈', 
    href: '/admin/announcements', 
    icon: Megaphone, 
    accent: 'border-purple-200 text-purple-600 bg-purple-50/50 hover:bg-purple-50' 
  },
  { 
    label: '營業報表分析', 
    desc: '營收流水與毛利統計', 
    href: '/admin/reports', 
    icon: BarChartHorizontal, 
    accent: 'border-emerald-200 text-emerald-600 bg-emerald-50/50 hover:bg-emerald-50' 
  },
];

const CORE_MODULES = [
  {
    category: '遊戲與卡池',
    items: [
      { label: '卡片總管', desc: '全站卡牌資產管理', href: '/admin/cards', icon: Archive },
      { label: '抽卡管理', desc: '轉蛋卡池機率配置', href: '/admin/card-pools', icon: Package },
      { label: '拼卡管理', desc: '選號競猜項目', href: '/admin/betting', icon: Swords },
      { label: '福袋管理', desc: '福袋獎品配置與上架', href: '/admin/lucky-bags', icon: Ticket },
      { label: '團拆管理', desc: '直播拆盒專案', href: '/admin/group-breaks', icon: Layers },
      { label: '幸運轉盤', desc: '大轉盤號碼抽獎', href: '/admin/lucky-wheel', icon: Disc3 },
    ]
  },
  {
    category: '用戶與財務',
    items: [
      { label: '會員名冊', desc: '帳號資訊、權限與點數', href: '/admin/users', icon: Users },
      { label: '交易流水', desc: '點數紀錄與消費歷史', href: '/admin/orders', icon: FileText },
      { label: '儲值審核', desc: '金流儲值審核管理', href: '/admin/deposits', icon: Archive },
      { label: '兌換商城', desc: '紅利積點兌換項目', href: '/admin/rewards', icon: ShoppingBag },
    ]
  },
  {
    category: '行銷與運營',
    items: [
      { label: '賽事預測', desc: '競猜賽事發布與結算', href: '/admin/predictions', icon: Activity },
      { label: '推薦邀請碼', desc: '推廣碼統計與設定', href: '/admin/referrals', icon: Share2 },
      { label: '優惠券管理', desc: '折價券與兌換碼發放', href: '/admin/coupons', icon: Ticket },
      { label: '素材管理', desc: '全站橫幅與主題圖庫', href: '/admin/materials', icon: Palette },
    ]
  }
];

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

      toast({ title: '數據清除成功', description: '所有測試數據已重置歸零。' });
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
        <Button variant="outline" className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs font-semibold rounded-lg h-9">
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> 清除全站測試數據
        </Button>
      </DialogTrigger>
      <DialogContent className="light bg-white text-slate-900 border-slate-200 shadow-xl rounded-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-rose-600 font-bold text-lg">
            <AlertTriangle className="h-5 w-5" /> 危險操作確認
          </DialogTitle>
          <DialogDescription className="text-slate-600 text-xs pt-1.5 leading-relaxed">
            此操作將永久清空全站的訂單記錄、出貨單、交易流水，並重置所有會員點數與資產。
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Label className="text-xs font-semibold text-slate-700">請輸入授權密碼</Label>
          <Input
            type="password"
            placeholder="輸入清除密碼..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-slate-50 border-slate-200 rounded-lg text-xs"
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={() => setIsOpen(false)} className="rounded-lg text-xs font-medium">
            取消
          </Button>
          <Button
            variant="destructive"
            onClick={handleWipe}
            disabled={isWiping || !password}
            className="rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-700"
          >
            {isWiping ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
            確認永久重置
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
  const [isSavingAnnouncement, setIsSavingAnnouncement] = useState(false);
  
  useEffect(() => {
    if (systemConfig?.announcement) setAnnouncement(systemConfig.announcement);
  }, [systemConfig]);

  const isSuperAdmin = currentUser?.email === SUPER_ADMIN_EMAIL;

  const totalUsers = users?.length ?? 0;
  const adminUsers = users?.filter((u: any) => u.role === 'admin').length ?? 0;
  const totalCards = allCards?.length ?? 0;
  const cardsInStock = allCards?.filter((c: any) => !c.isSold).length ?? 0;
  const pendingCount = pendingOrders?.length || 0;

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
      await setDoc(systemConfigRef, {
        [`featureFlags.${flagName}`]: isEnabled,
      }, { merge: true });
      toast({ title: '已更新開關', description: '模組運行狀態已即時生效。' });
      if (forceRefetch) forceRefetch();
    } catch (error) {
      toast({ variant: 'destructive', title: '更新失敗' });
    }
  };

  const handleSaveAnnouncement = async () => {
    if (!systemConfigRef) return;
    setIsSavingAnnouncement(true);
    try {
      await setDoc(systemConfigRef, { announcement }, { merge: true });
      toast({ title: '公告更新成功', description: '首頁跑馬燈已同步生效。' });
      if (forceRefetch) forceRefetch();
    } catch (e) {
      toast({ variant: 'destructive', title: '儲存失敗' });
    } finally {
      setIsSavingAnnouncement(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Executive Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">營運總覽控制台</h1>
            <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              v{APP_VERSION}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            全站會員、卡牌庫存、玩法模組與核心操作集中監控。
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 text-xs font-medium rounded-lg border-slate-200">
            <Link href="/admin/reports">
              <BarChartHorizontal className="mr-1.5 h-3.5 w-3.5 text-slate-500" />
              營運報表
            </Link>
          </Button>
          <Button asChild size="sm" className="h-8 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800">
            <Link href="/" target="_blank">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              前往前台網站
            </Link>
          </Button>
        </div>
      </div>

      {/* Action Notice (Pending Shipping Orders) */}
      {pendingCount > 0 && (
        <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="h-6 w-6 rounded-md bg-amber-200/60 flex items-center justify-center shrink-0">
              <Truck className="h-3.5 w-3.5 text-amber-700" />
            </div>
            <div>
              <span className="font-bold">待處理提醒：</span>
              <span>目前有 <strong className="font-bold text-amber-950 underline">{pendingCount}</strong> 筆實體出貨訂單等待填寫物流單號與發貨。</span>
            </div>
          </div>
          <Button asChild size="sm" variant="outline" className="h-7 text-xs font-semibold bg-white border-amber-300 text-amber-900 hover:bg-amber-100/60 rounded-md shrink-0 ml-3">
            <Link href="/admin/shipping">
              即刻審核出貨 →
            </Link>
          </Button>
        </div>
      )}

      {/* 4 Core KPI Highlights */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="border-slate-200/90 shadow-xs bg-white rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">會員規模</span>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoadingUsers ? (
              <Skeleton className="h-7 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold text-slate-900 font-mono">
                {totalUsers.toLocaleString()}
              </div>
            )}
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span>{adminUsers} 位管理人員</span>
              <span aria-hidden="true">·</span>
              <span className="text-emerald-600 font-medium">持續成長</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 shadow-xs bg-white rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">在庫卡牌</span>
            <Archive className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoadingCards ? (
              <Skeleton className="h-7 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold text-slate-900 font-mono">
                {cardsInStock.toLocaleString()}
              </div>
            )}
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span>總建檔 {totalCards} 張</span>
              <span aria-hidden="true">·</span>
              <span>在庫率 {totalCards > 0 ? Math.round((cardsInStock / totalCards) * 100) : 0}%</span>
            </div>
          </CardContent>
        </Card>

        <Card className={cn(
          "border-slate-200/90 shadow-xs bg-white rounded-xl transition-colors",
          pendingCount > 0 && "border-amber-300/80 bg-amber-50/20"
        )}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">待出貨訂單</span>
            <Truck className={cn("h-4 w-4", pendingCount > 0 ? "text-amber-600" : "text-slate-400")} />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoadingOrders ? (
              <Skeleton className="h-7 w-16 my-1" />
            ) : (
              <div className={cn("text-2xl font-bold font-mono", pendingCount > 0 ? "text-amber-600" : "text-slate-900")}>
                {pendingCount}
              </div>
            )}
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
              {pendingCount > 0 ? (
                <span className="text-amber-700 font-semibold">需要安排出貨發送</span>
              ) : (
                <span className="text-slate-500">已全數完成發貨審核</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200/90 shadow-xs bg-white rounded-xl">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">在線玩法專案</span>
            <Package className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {isLoadingCardPools || isLoadingLuckBags ? (
              <Skeleton className="h-7 w-20 my-1" />
            ) : (
              <div className="text-2xl font-bold text-slate-900 font-mono">
                {activePoolsCount + (luckBags?.length || 0)}
              </div>
            )}
            <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-1.5">
              <span>{activePoolsCount} 個在線抽卡池</span>
              <span aria-hidden="true">·</span>
              <span>{luckBags?.length || 0} 個福袋</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Action Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {QUICK_ACTIONS.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.label}
              href={action.href}
              className={cn(
                "p-3 rounded-xl border bg-white shadow-2xs hover:shadow-xs transition-all flex items-center gap-3 group",
                action.accent
              )}
            >
              <div className="h-8 w-8 rounded-lg bg-white shadow-2xs flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-900 group-hover:text-primary transition-colors">{action.label}</h3>
                  <ArrowUpRight className="h-3 w-3 text-slate-400 opacity-60 group-hover:opacity-100 transition-opacity" />
                </div>
                <p className="text-[10px] text-slate-500 truncate">{action.desc}</p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main Tabbed Management Center */}
      <Tabs defaultValue="modules" className="space-y-4">
        <TabsList className="bg-slate-100/90 p-1 rounded-lg border border-slate-200/80">
          <TabsTrigger value="modules" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-xs px-3.5 py-1.5">
            功能模組導覽
          </TabsTrigger>
          <TabsTrigger value="flags" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-xs px-3.5 py-1.5">
            前台模組開關
          </TabsTrigger>
          <TabsTrigger value="announcement" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-xs px-3.5 py-1.5">
            首頁公告維護
          </TabsTrigger>
          <TabsTrigger value="system" className="rounded-md text-xs font-semibold data-[state=active]:bg-white data-[state=active]:shadow-xs px-3.5 py-1.5">
            系統資訊與安全
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Module Jump Grid */}
        <TabsContent value="modules" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {CORE_MODULES.map((group) => (
              <Card key={group.category} className="border-slate-200/90 shadow-xs bg-white rounded-xl">
                <CardHeader className="p-4 pb-2 border-b border-slate-100">
                  <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {group.category}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 text-slate-700 hover:text-slate-900 transition-colors group"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-md bg-slate-100 group-hover:bg-white border border-transparent group-hover:border-slate-200 flex items-center justify-center shrink-0 transition-colors">
                            <Icon className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-900" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate leading-tight">{item.label}</p>
                            <p className="text-[10px] text-slate-400 truncate">{item.desc}</p>
                          </div>
                        </div>
                        <ArrowUpRight className="h-3 w-3 text-slate-300 group-hover:text-slate-600 shrink-0 ml-2" />
                      </Link>
                    );
                  })}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Tab 2: Feature Flags */}
        <TabsContent value="flags">
          <Card className="border-slate-200/90 shadow-xs bg-white rounded-xl">
            <CardHeader className="p-5 pb-3 border-b border-slate-100 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-600"/> 前台各玩法模組運行開關
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-0.5">
                  即時啟用或暫停前台個別玩法與活動入口，變更即刻同步全站。
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { label: '抽卡轉蛋池', flag: 'isDrawEnabled', desc: '控制全站轉蛋抽卡', defaultVal: true },
                  { label: '幸運福袋', flag: 'isLuckyBagEnabled', desc: '控制福袋選購拆封', defaultVal: true },
                  { label: '競猜拼卡', flag: 'isBettingEnabled', desc: '控制拼卡選號專區', defaultVal: true },
                  { label: '直播團拆', flag: 'isGroupBreakEnabled', desc: '控制團拆開盒專案', defaultVal: true },
                  { label: '賽事預測專區', flag: 'isPredictionsEnabled', desc: '體育與賽事競猜下注', defaultVal: true },
                  { label: '卡展行事曆', flag: 'isExhibitionsEnabled', desc: '線下卡展行程資訊', defaultVal: true },
                  { label: '中獎跑馬燈廣播', flag: 'isMarqueeEnabled', desc: '首頁中獎輪播通知', defaultVal: true },
                  { label: '活動代碼公開展示', flag: 'showPromoHints', desc: '前台顯示優惠碼提示', defaultVal: false },
                ].map((feat) => {
                  const isChecked = systemConfig?.featureFlags?.[feat.flag as keyof NonNullable<SystemConfig['featureFlags']>] ?? feat.defaultVal;
                  return (
                    <div 
                      key={feat.flag} 
                      className={cn(
                        "p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-3",
                        isChecked ? "bg-white border-slate-200" : "bg-slate-50/70 border-slate-200/60 opacity-80"
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className={cn(
                            "h-1.5 w-1.5 rounded-full shrink-0",
                            isChecked ? "bg-emerald-500" : "bg-slate-400"
                          )}/>
                          <p className="font-semibold text-xs text-slate-900 truncate">{feat.label}</p>
                        </div>
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate">{feat.desc}</p>
                      </div>
                      <Switch
                        checked={isChecked}
                        onCheckedChange={(checked) => handleFeatureToggle(feat.flag as any, checked)}
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Announcements */}
        <TabsContent value="announcement">
          <Card className="border-slate-200/90 shadow-xs bg-white rounded-xl">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Megaphone className="h-4 w-4 text-primary"/> 首頁跑馬燈系統即時公告
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 mt-0.5">
                此公告將會置頂顯示在首頁跑馬燈與快訊欄位中，內容空白則自動隱藏。
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="font-medium">公告內容編輯</span>
                  <span className="text-[11px] text-slate-400">{announcement.length} 字元</span>
                </div>
                <textarea 
                  className="w-full min-h-[100px] p-3 rounded-lg border border-slate-200 font-normal text-xs focus:ring-1 focus:ring-slate-400 focus:border-slate-400 outline-none transition-colors resize-none placeholder:text-slate-400"
                  value={announcement}
                  onChange={(e) => setAnnouncement(e.target.value)}
                  placeholder="請輸入首頁即時顯示的跑馬燈公告內容..."
                />
              </div>

              {/* Quick Template Buttons */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-slate-400 font-medium">常用範本快捷填入：</span>
                {[
                  { text: '【系統維護】伺服器將於本週三凌晨 03:00~05:00 進行例行升級優化。', label: '系統維護' },
                  { text: '【新品上架】全新限定特典抽卡池與限量幸運福袋現已全面開放！', label: '新品上架' },
                  { text: '【物流公告】連假期間實體卡片出貨可能順延 1~2 個工作天，敬請見諒。', label: '出貨通知' },
                ].map((tpl) => (
                  <button
                    key={tpl.label}
                    type="button"
                    onClick={() => setAnnouncement(tpl.text)}
                    className="text-[11px] text-slate-600 bg-slate-100 hover:bg-slate-200/80 px-2 py-1 rounded transition-colors"
                  >
                    {tpl.label}
                  </button>
                ))}
              </div>

              {/* Live Preview Box */}
              {announcement.trim() && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-2 text-slate-400 text-[10px] font-semibold uppercase tracking-wider mb-1">
                    <Info className="h-3 w-3" /> 前台即時預覽效果
                  </div>
                  <p className="text-slate-800 font-medium">{announcement}</p>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setAnnouncement('')}
                  className="rounded-lg text-xs h-8 px-3 border-slate-200"
                >
                  清除內容
                </Button>
                <Button 
                  size="sm" 
                  disabled={isSavingAnnouncement}
                  onClick={handleSaveAnnouncement}
                  className="bg-slate-900 text-white font-semibold rounded-lg text-xs h-8 px-4 hover:bg-slate-800"
                >
                  {isSavingAnnouncement ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
                  儲存並發布
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: System Information */}
        <TabsContent value="system" className="space-y-4">
          <Card className="border-slate-200/90 shadow-xs bg-white rounded-xl">
            <CardHeader className="p-5 pb-3 border-b border-slate-100">
              <CardTitle className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-blue-600"/> 系統架構與狀態
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">應用程式版本</p>
                  <p className="text-sm font-bold text-slate-800 mt-1 font-mono">v{APP_VERSION}</p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">資料庫連線</p>
                  <p className="text-sm font-bold text-emerald-600 mt-1 flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    Firebase Firestore 正常
                  </p>
                </div>
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50">
                  <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">登入管理者</p>
                  <p className="text-sm font-bold text-slate-800 mt-1 truncate">{currentUser?.email}</p>
                </div>
              </div>

              {isSuperAdmin && (
                <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">最高主管維護功能</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">重置測試期間生成的交易訂單與帳號數據（需輸入授權密碼）。</p>
                  </div>
                  <BetaWipeDialog />
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
