'use client';

import { useState, useMemo, useEffect, useCallback } from "react";
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
    ShoppingBag,
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
    Award
} from 'lucide-react';
import { PPlusIcon, DiamondIcon } from "@/components/icons";
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, increment, runTransaction, query, where, limit, updateDoc, serverTimestamp, orderBy, writeBatch, getDocs } from "firebase/firestore";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberLevelCrown, userLevels } from "@/components/member-level-crown";
import type { UserProfile } from "@/types/user-profile";
import type { DailyMission, UserMissionProgress } from '@/types/missions';
import type { SystemConfig } from "@/types/system";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { SafeImage } from "@/components/safe-image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
}

interface RedemptionItem {
    id: string;
    name: string;
    points: number;
    imageUrl: string;
    description: string;
    isActive: boolean;
    order?: number;
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
        <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-b from-[#13192a]/95 via-[#0c101d]/95 to-[#080b14]/95 border border-white/10 shadow-[0_8px_25px_rgba(0,0,0,0.4)] hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)] transition-all group">
            <div className={cn("mb-2 sm:mb-3 flex items-center justify-center p-2.5 rounded-xl bg-white/5 border border-white/5 w-fit mx-auto group-hover:scale-110 transition-transform", color)}>
                <Icon className="w-6 h-6 sm:w-7 sm:h-7 opacity-90" />
            </div>
            <p className="text-[11px] sm:text-xs text-center font-bold text-slate-400 mb-1">{label}</p>
            <p className="text-lg sm:text-2xl font-black font-code text-center text-white">{value.toLocaleString()}</p>
        </div>
    );
}

function LeaderboardDialog({ children }: { children: React.ReactNode }) {
    const firestore = useFirestore();
    
    const topSpendersQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), orderBy('totalSpent', 'desc'), limit(10));
    }, [firestore]);
    const { data: topSpenders, isLoading: isLoadingSpenders } = useCollection<any>(topSpendersQuery);

    const topAchieversQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'users'), orderBy('totalSpent', 'desc'), limit(10));
    }, [firestore]);
    const { data: topAchievers, isLoading: isLoadingAchievers } = useCollection<any>(topAchieversQuery);

    const rankColors = ["text-amber-400", "text-slate-300", "text-amber-700"];

    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden rounded-[2.5rem] bg-background/95 backdrop-blur-3xl border-white/10 p-0 flex flex-col shadow-[0_0_50px_rgba(0,0,0,0.5)] text-white">
                <DialogHeader className="p-8 pb-4 bg-muted/10 border-b border-white/5">
                    <DialogTitle className="flex items-center gap-3 text-2xl font-black font-headline tracking-widest text-primary italic">
                        <Trophy className="h-8 w-8 text-primary animate-pulse" />榮耀排行榜殿堂
                    </DialogTitle>
                    <DialogDescription className="text-white/60">紀錄頂尖玩家的卓越功勳。</DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="spending" className="flex-1 flex flex-col overflow-hidden">
                    <TabsList className="grid w-full grid-cols-2 h-14 bg-muted/20 rounded-none border-b border-white/5 p-1">
                        <TabsTrigger value="spending" className="rounded-none data-[state=active]:bg-primary/10 data-[state=active]:text-primary font-black uppercase tracking-widest text-xs transition-all">
                            <Gem className="mr-2 h-4 w-4" /> 消費實力榜
                        </TabsTrigger>
                        <TabsTrigger value="achievements" className="rounded-none data-[state=active]:bg-accent/10 data-[state=active]:text-accent font-black uppercase tracking-widest text-xs transition-all">
                            <MedalIcon className="mr-2 h-4 w-4" /> 成就榮譽榜
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="spending" className="flex-1 overflow-hidden mt-0 p-0">
                        <ScrollArea className="h-[450px]">
                            <div className="p-4 md:p-6 space-y-3">
                                {isLoadingSpenders ? Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />) :
                                topSpenders?.map((u, i) => (
                                    <div key={u.id} className={cn(
                                        "flex items-center justify-between p-4 rounded-2xl border transition-all group",
                                        i === 0 ? "bg-primary/10 border-primary/30" : "bg-white/5 border-white/5 hover:bg-white/10"
                                    )}>
                                        <div className="flex items-center gap-3 md:gap-4 overflow-hidden flex-1">
                                            <div className="w-6 md:w-8 flex justify-center font-code font-black text-lg md:text-xl">
                                                {i < 3 ? <Trophy className={cn("h-5 w-5 md:h-6 md:w-6", rankColors[i])} /> : <span className="text-muted-foreground opacity-40">{i + 1}</span>}
                                            </div>
                                            <MemberLevelCrown level={u.userLevel} size="sm" />
                                            <div className="overflow-hidden">
                                                <p className="font-black text-sm text-white group-hover:text-primary transition-colors truncate">{u.username}</p>
                                                <Badge variant="outline" className="text-[8px] h-4 border-white/10 text-white/40 font-black uppercase">{u.userLevel}</Badge>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <p className="text-base md:text-lg font-black font-code text-white">{(u.totalSpent || 0).toLocaleString()} 💎</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </TabsContent>

                    <TabsContent value="achievements" className="flex-1 overflow-hidden mt-0 p-0">
                        <ScrollArea className="h-[450px]">
                            <div className="p-4 md:p-6 space-y-3">
                                {isLoadingAchievers ? Array.from({length: 5}).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />) :
                                topAchievers?.map((u, i) => (
                                    <div key={u.id} className={cn(
                                        "flex items-center justify-between p-4 rounded-2xl border transition-all group",
                                        i === 0 ? "bg-accent/10 border-accent/30" : "bg-white/5 border-white/5 hover:bg-white/10"
                                    )}>
                                        <div className="flex items-center gap-3 md:gap-4 overflow-hidden flex-1">
                                            <div className="w-6 md:w-8 flex justify-center font-code font-black text-lg md:text-xl">
                                                {i < 3 ? <MedalIcon className={cn("h-5 w-5 md:h-6 md:w-6", rankColors[i])} /> : <span className="text-muted-foreground opacity-40">{i + 1}</span>}
                                            </div>
                                            <MemberLevelCrown level={u.userLevel} size="sm" />
                                            <div className="overflow-hidden">
                                                <p className="font-black text-sm text-white group-hover:text-accent transition-colors truncate">{u.username}</p>
                                                <Badge variant="outline" className="text-[8px] h-4 border-accent/30 text-accent font-black uppercase">{u.userLevel}</Badge>
                                            </div>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <div className="flex items-center justify-end gap-1 text-accent font-black font-code text-lg">
                                                <Star className="w-4 h-4 fill-accent" />
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

function RedeemPrizesDialog({ children }: { children: React.ReactNode }) {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);
    const [selectedItem, setSelectedItem] = useState<RedemptionItem | null>(null);
    const [realName, setRealName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

    const userProfileRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'users', user.uid) : null, [firestore, user?.uid]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

    const redemptionsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'redemptionItems') : null, [firestore]);
    const { data: rawRedemptionItems, isLoading } = useCollection<RedemptionItem>(redemptionsQuery);

    const redemptionItems = useMemo(() => {
        if (!rawRedemptionItems) return [];
        return rawRedemptionItems.filter(item => item.isActive !== false).sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [rawRedemptionItems]);

    useEffect(() => {
        if (userProfile) {
            setRealName(userProfile.realName || userProfile.username || '');
            setPhone(userProfile.phone || '');
            setAddress(userProfile.address || '');
        }
    }, [userProfile]);

    const handleRedeem = async () => {
        if (!user || !firestore || !selectedItem || !realName || !phone || !address) {
            toast({ variant: 'destructive', title: '錯誤', description: '請填寫完整收件資訊。'});
            return;
        }
        if ((userProfile?.bonusPoints || 0) < selectedItem.points) {
            toast({ variant: 'destructive', title: '點數不足', description: '您的紅利 P+ 餘額不足。'});
            return;
        }
        setIsProcessing(true);
        try {
            await runTransaction(firestore, async (transaction) => {
                const uRef = doc(firestore, 'users', user.uid);
                const uSnap = await transaction.get(uRef);
                const userData = uSnap.data() as UserProfile;
                if (userData.bonusPoints < selectedItem.points) throw new Error("點數不足");
                transaction.update(uRef, { bonusPoints: increment(-selectedItem.points) });
                transaction.set(doc(collection(firestore, 'transactions')), { userId: user.uid, transactionType: 'Purchase', section: 'betting', currency: 'p-point', amount: -selectedItem.points, details: `紅利兌換: ${selectedItem.name}`, transactionDate: serverTimestamp() });
                transaction.set(doc(collection(firestore, 'shippingOrders')), { userId: user.uid, name: realName, phone: phone, address: address, cardCount: 1, cardIds: [], redemptionItem: selectedItem.name, status: 'pending', shippingMethod: '7-11', createdAt: serverTimestamp(), fee: 0 });
            });
            toast({ title: '兌換成功！', description: `您已成功兌換「${selectedItem.name}」` });
            setSelectedItem(null);
        } catch (e: any) {
            toast({ variant: 'destructive', title: '兌換失敗', description: e.message });
        } finally { setIsProcessing(false); }
    };

    return (
        <Dialog>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto rounded-[2.5rem] bg-background/95 backdrop-blur-3xl border-white/10 p-6 md:p-10 text-white">
                <DialogTitle className="flex items-center gap-2 text-xl md:text-2xl font-black font-headline"><ShoppingBag className="text-accent" /> 紅利兌換商店</DialogTitle>
                <DialogHeader>
                    <DialogDescription className="text-xs md:text-sm text-white/60">使用累積的 P+ 兌換實體獎品。</DialogDescription>
                </DialogHeader>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4 py-6">
                    {isLoading ? Array.from({length: 4}).map((_, i) => <Skeleton key={i} className="aspect-square rounded-xl" />) :
                    redemptionItems.map(item => (
                        <Card key={item.id} className={cn("cursor-pointer transition-all border border-white/5 bg-card/40 flex flex-col overflow-hidden group rounded-2xl", selectedItem?.id === item.id ? "border-primary bg-primary/10 ring-2 ring-primary" : "hover:border-primary/50")} onClick={() => setSelectedItem(item)}>
                            <div className="aspect-square relative overflow-hidden"><SafeImage src={item.imageUrl} alt={item.name} fill className="object-cover transition-transform group-hover:scale-110" /></div>
                            <CardContent className="p-2 md:p-3 text-center flex-1 flex flex-col justify-between">
                                <p className="font-bold text-[10px] md:text-sm truncate text-white">{item.name}</p>
                                <div className="flex items-center justify-center gap-1 mt-1 md:mt-2"><PPlusIcon className="w-3.5 h-3.5" /><p className="text-accent font-code font-black text-sm md:text-lg">{item.points.toLocaleString()}</p></div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
                {selectedItem && (
                    <div className="space-y-4 p-4 md:p-6 bg-primary/5 rounded-[1.5rem] md:rounded-[2rem] border border-primary/20">
                        <h4 className="font-bold text-xs md:text-sm flex items-center gap-2 text-primary uppercase tracking-widest"><Truck className="w-4 h-4"/> 確認收件資訊</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><Input value={realName} onChange={e => setRealName(e.target.value)} placeholder="真實姓名" className="bg-background/50 h-10" /><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="09xx..." className="bg-background/50 h-10" /></div>
                        <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="請輸入 7-11 門市名稱或地址" className="bg-background/50 h-10" />
                        <Button className="w-full font-black h-12 rounded-xl shadow-xl bg-primary text-primary-foreground" onClick={handleRedeem} disabled={isProcessing}>{isProcessing ? <Loader2 className="animate-spin h-5 w-5" /> : `確認花費 ${selectedItem.points.toLocaleString()} P+ 兌換`}</Button>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}

function CompactDailyCheckIn() {
  const { user } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  const missionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'dailyMissions'), where('type', '==', 'login'), limit(1)) : null, [firestore]);
  const progressQuery = useMemoFirebase(() => (firestore && user) ? collection(firestore, `users/${user.uid}/missionProgress`) : null, [firestore, user]);
  const { data: missions } = useCollection<DailyMission>(missionsQuery);
  const { data: progress, forceRefetch } = useCollection<UserMissionProgress>(progressQuery);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const loginMission = useMemo(() => missions?.[0] || null, [missions]);
  const userProgress = useMemo(() => progress?.find(p => p.id === loginMission?.id), [progress, loginMission]);
  const hasClaimedToday = useMemo(() => {
    if (!userProgress?.lastCompleted) return false;
    return userProgress.lastCompleted === format(new Date(), 'yyyy-MM-dd');
  }, [userProgress]);

  const handleCheckIn = useCallback(async () => {
    if (!user || !firestore || !loginMission) return;
    setClaimingId(loginMission.id);
    try {
      await runTransaction(firestore, async (transaction) => {
        const userRef = doc(firestore, 'users', user.uid);
        const progressRef = doc(firestore, `users/${user.uid}/missionProgress`, loginMission.id);
        const [userDoc, existingProgress] = await Promise.all([transaction.get(userRef), transaction.get(progressRef)]);
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        if (existingProgress.exists() && existingProgress.data()?.lastCompleted === todayStr) throw new Error("今日已領取");
        transaction.update(userRef, { bonusPoints: increment(loginMission.rewardPoints) });
        if (!existingProgress.exists()) transaction.set(progressRef, { progress: 1, lastCompleted: todayStr, userId: user.uid });
        else transaction.update(progressRef, { progress: increment(1), lastCompleted: todayStr });
      });
      toast({ title: '簽到成功！' });
      if(forceRefetch) forceRefetch();
    } catch (e: any) { toast({ variant: 'destructive', title: '簽到失敗', description: e.message }); } finally { setClaimingId(null); }
  }, [user, firestore, toast, forceRefetch, loginMission]);

  if (!loginMission) return null;
  return (
    <Button variant="outline" className={cn("h-7 sm:h-8 w-full px-2 rounded-lg border-primary/30 transition-all text-xs", hasClaimedToday ? "bg-white/5 opacity-60 text-white/40" : "bg-primary/10 hover:bg-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)] text-white")} disabled={hasClaimedToday || !loginMission.isActive || !!claimingId} onClick={handleCheckIn}>
        <div className="flex items-center justify-center gap-1.5 w-full">
            {claimingId === loginMission.id ? <Loader2 className="animate-spin h-3.5 w-3.5 text-primary" /> : hasClaimedToday ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <CalendarCheck className="h-3.5 w-3.5 text-primary" />}
            <span className="text-[10px] font-black uppercase tracking-wider">{hasClaimedToday ? '今日已領取' : '每日簽到'}</span>
            {!hasClaimedToday && <span className="text-[10px] text-accent font-black font-code">+{loginMission.rewardPoints}</span>}
        </div>
    </Button>
  );
}

function AchievementItem({ item }: { item: any }) {
    return (
        <div className={cn(
            "flex flex-col items-center p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden h-full group",
            item.unlocked 
                ? "bg-gradient-to-b from-[#13192a]/95 via-[#0c101d]/95 to-[#080b14]/95 border-cyan-500/30 shadow-[0_4px_20px_rgba(6,182,212,0.15)] hover:border-cyan-400 hover:shadow-[0_0_25px_rgba(6,182,212,0.3)]" 
                : "bg-slate-950/70 border-white/5 grayscale opacity-60 hover:opacity-80"
        )}>
            <div className={cn(
                "p-3.5 rounded-xl mb-3 transition-all duration-300", 
                item.unlocked 
                    ? "bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 group-hover:scale-110 shadow-[0_0_15px_rgba(6,182,212,0.2)]" 
                    : "bg-white/5 text-white/20 border border-white/5"
            )}>
                {item.unlocked ? <item.icon className="w-6 h-6 sm:w-7 sm:h-7" /> : <Lock className="w-5 h-5" />}
            </div>
            <h4 className={cn("font-black text-xs text-center line-clamp-1 mb-1 transition-colors tracking-wide", item.unlocked ? "text-white" : "text-white/40")}>{item.title}</h4>
            <p className={cn("text-[10px] text-center line-clamp-2 mb-3 leading-relaxed", item.unlocked ? "text-slate-400" : "text-white/20")}>{item.condition}</p>
            <Badge variant="outline" className={cn(
                "text-[9px] h-5 font-black uppercase tracking-wider px-2.5 mt-auto rounded-full transition-colors", 
                item.unlocked ? "border-cyan-500/30 text-cyan-300 bg-cyan-500/10" : "border-white/5 text-white/20 bg-black/40"
            )}>{item.category}</Badge>
        </div>
    );
}

function ShippingOrdersTab({ userId }: { userId: string }) {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [isCancelling, setIsCancelling] = useState<string | null>(null);

    const shippingQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'shippingOrders'), where('userId', '==', userId));
    }, [firestore, userId]);
    const { data: orders, isLoading, forceRefetch } = useCollection<ShippingOrder>(shippingQuery);
    
    const sortedOrders = useMemo(() => orders ? [...orders].sort((a, b) => b.createdAt.seconds - a.createdAt.seconds) : [], [orders]);

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
        <Card className="border-white/5 bg-card/30 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-muted/20 pb-4"><CardTitle className="text-lg flex items-center gap-2 text-white"><Truck className="h-5 w-5 text-primary"/> 出貨進度查詢</CardTitle></CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto custom-scrollbar">
                    <Table className="min-w-[500px] md:min-w-full">
                        <TableHeader className="bg-muted/10"><TableRow className="border-white/5"><TableHead className="pl-6 text-slate-300">張數</TableHead><TableHead className="text-slate-300">申請時間</TableHead><TableHead className="text-slate-300">狀態</TableHead><TableHead className="text-right pr-6 text-slate-300">操作</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? <TableRow><TableCell colSpan={4} className="p-6"><Skeleton className="h-10 w-full"/></TableCell></TableRow> : 
                        sortedOrders.map(order => (
                            <TableRow key={order.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                <TableCell className="pl-6 font-bold text-white">{order.cardCount} 張</TableCell>
                                <TableCell className="text-[10px] text-slate-400 font-code">{format(new Date(order.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm')}</TableCell>
                                <TableCell><Badge variant={statusVariant[order.status] || 'default'} className="text-[9px] uppercase tracking-tighter font-black">{statusText[order.status]}</Badge></TableCell>
                                <TableCell className="text-right pr-6">{order.status === 'pending' && <Button variant="ghost" size="sm" onClick={() => handleCancelOrder(order)} disabled={!!isCancelling} className="text-xs text-destructive hover:bg-destructive/10">取消申請</Button>}</TableCell>
                            </TableRow>
                        ))}
                        {!isLoading && sortedOrders.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="h-32 text-center text-slate-400 italic">目前暫無出貨紀錄</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
        </Card>
    );
}

function TransactionsTab({ userId }: { userId: string }) {
    const firestore = useFirestore();
    const transactionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'transactions'), where('userId', '==', userId)) : null, [firestore, userId]);
    const { data: transactions, isLoading } = useCollection<Transaction>(transactionsQuery);
    const sorted = useMemo(() => transactions ? [...transactions].sort((a, b) => b.transactionDate.seconds - a.transactionDate.seconds).slice(0, 30) : [], [transactions]);

    return (
        <Card className="border-white/5 bg-card/30 backdrop-blur-xl rounded-[2rem] overflow-hidden">
            <CardHeader className="bg-muted/20 pb-4"><CardTitle className="text-lg flex items-center gap-2 text-white"><History className="h-5 w-5 text-primary"/> 最近 30 筆交易明細</CardTitle></CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto custom-scrollbar">
                    <Table className="min-w-[600px] md:min-w-full">
                        <TableHeader className="bg-muted/10"><TableRow className="border-white/5"><TableHead className="pl-6 text-slate-300">詳情內容</TableHead><TableHead className="text-slate-300">變動金額</TableHead><TableHead className="pr-6 text-slate-300">交易時間</TableHead></TableRow></TableHeader>
                    <TableBody>
                        {isLoading ? <TableRow><TableCell colSpan={3} className="p-6"><Skeleton className="h-10 w-full"/></TableCell></TableRow> :
                        sorted.map(tx => (
                            <TableRow key={tx.id} className="border-white/5 hover:bg-white/5 transition-colors">
                                <TableCell className="pl-6 text-xs max-w-[300px] truncate leading-relaxed text-slate-200">{translateDetails(tx.details)}</TableCell>
                                <TableCell className={cn("font-code text-sm font-black", tx.amount > 0 ? "text-green-400" : "text-white")}>
                                    <div className="flex items-center gap-1">
                                        {tx.amount > 0 ? '+' : ''}{tx.amount.toLocaleString()}
                                        {tx.currency === 'p-point' ? <PPlusIcon className="h-3 w-3" /> : <Gem className="h-3 w-3 text-primary"/>}
                                    </div>
                                </TableCell>
                                <TableCell className="text-[10px] text-slate-400 font-code pr-6">{format(new Date(tx.transactionDate.seconds * 1000), 'MM-dd HH:mm')}</TableCell>
                            </TableRow>
                        ))}
                        {!isLoading && sorted.length === 0 && (
                            <TableRow><TableCell colSpan={3} className="h-32 text-center text-slate-400 italic">目前尚無交易紀錄</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
                </div>
            </CardContent>
        </Card>
    );
}

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
    const { data: userProfile, isLoading: isProfileLoading, error: profileError } = useDoc<UserProfile>(userProfileRef);

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

    const userCardsQuery = useMemoFirebase(() => (firestore && user?.uid && isMounted) ? collection(firestore, 'users', user.uid, 'userCards') : null, [firestore, user, isMounted]);
    const { data: userCards } = useCollection(userCardsQuery);
    
    const txQuery = useMemoFirebase(() => (firestore && user?.uid && isMounted) ? query(collection(firestore, 'transactions'), where('userId', '==', user.uid)) : null, [firestore, user, isMounted]);
    const { data: allTransactions } = useCollection<any>(txQuery);
    
    const [username, setUsername] = useState('');
    const [realName, setRealName] = useState('');
    const [phone, setPhone] = useState('');
    const [address, setAddress] = useState('');

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
            const createdDate = userProfile.createdAt.toDate ? userProfile.createdAt.toDate() : new Date((userProfile.createdAt as any).seconds * 1000);
            const now = new Date();
            const diffTime = Math.abs(now.getTime() - createdDate.getTime());
            daysJoined = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
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

    const achievements = useMemo(() => [
        { id: 'first-card', title: '初次啼聲', category: '收藏', icon: Package, unlocked: (userCards?.length || 0) > 0, condition: '獲得第一張卡片' },
        { id: 'collection-50', title: '資深館長', category: '收藏', icon: Library, unlocked: (userCards?.length || 0) >= 50, condition: '收藏達到 50 張卡片' },
        { id: 'legend-collector', title: '傳奇見證者', category: '稀有度', icon: Crown, unlocked: stats.legends > 0, condition: '獲得 1 張傳奇卡' },
        { id: 'lucky-star', title: '強運體質', category: '機率', icon: Sparkles, unlocked: stats.legends >= 5, condition: '獲得 5 張傳奇卡' },
        { id: 'foil-lover', title: '萬中選一', category: '特殊', icon: Zap, unlocked: stats.foils > 0, condition: '獲得 1 張亮面卡' },
        { id: 'bet-master', title: '拼卡大師', category: '拼卡', icon: Dices, unlocked: stats.bets >= 50, condition: '參與拼卡 50 次' },
        { id: 'lucky-bag-pro', title: '福袋達人', category: '活動', icon: Ticket, unlocked: stats.luckyBags >= 10, condition: '購買福袋 10 次' },
        { id: 'break-pioneer', title: '團拆先鋒', category: '活動', icon: Users2, unlocked: stats.groupBreaks >= 5, condition: '參與團拆 5 次' },
        { id: 'sell-king', title: '快速轉點王', category: '管理', icon: RefreshCw, unlocked: stats.quickSells >= 10, condition: '使用快速轉點 10 次' },
        { id: 'legend-20', title: '傳說級收藏家', category: '稀有度', icon: Trophy, unlocked: stats.legends >= 20, condition: '獲得 20 張傳奇卡' },
        { id: 'wealthy', title: '點數大亨', category: '資產', icon: Gem, unlocked: (userProfile?.points || 0) >= 50000, condition: '持有 50,000 以上鑽石' },
        { id: 'collector-max', title: '收藏之巔', category: '收藏', icon: Archive, unlocked: (userCards?.length || 0) >= 200, condition: '收藏達到 200 張卡片' },
        { id: 'super-draw', title: '十連狂熱', category: '抽卡', icon: Zap, unlocked: stats.draws >= 1000, condition: '累計抽卡 1000 次' },
        { id: 'p-plus-pro', title: '紅利狂人', category: '資產', icon: PPlusIcon, unlocked: (userProfile?.totalBonusEarned || 0) >= 1000000, condition: '累計獲得紅利破百萬' },
        { id: 'bet-legend', title: '拼卡之神', category: '拼卡', icon: Dices, unlocked: stats.bets >= 200, condition: '參與拼卡 200 次' },
    ], [userCards, stats, userProfile]);

    const { unlockedAchievements, lockedAchievements } = useMemo(() => {
        return {
            unlockedAchievements: achievements.filter(a => a.unlocked),
            lockedAchievements: achievements.filter(a => !a.unlocked),
        };
    }, [achievements]);

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
        if (!userProfileRef || !userProfile || !firestore || !user) return;
        
        const trimmedUsername = username.trim();
        if (trimmedUsername.length < 2 || trimmedUsername.length > 12) {
            toast({ variant: "destructive", title: "修改失敗", description: "會員名稱長度限定為 2 ~ 12 個字。" });
            return;
        }

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
        } catch (e) { toast({ variant: "destructive", title: "錯誤" }); }
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
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[450px] bg-cyan-500/5 blur-[120px] pointer-events-none" />
            <div className="absolute inset-0 bg-[url('/noise.png')] opacity-[0.02] pointer-events-none" />

            {/* 頂部尊榮會員資訊橫幅 */}
            <div className="relative z-10 mb-6 sm:mb-10 p-4 sm:p-6 md:p-8 rounded-[1.75rem] md:rounded-[2.5rem] bg-gradient-to-b from-[#13192a]/95 via-[#0c101d]/90 to-[#080b14]/95 border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.6)] backdrop-blur-2xl">
                <div className="flex flex-col lg:flex-row items-center justify-between gap-5 sm:gap-6 md:gap-8">
                    
                    {/* 左側：頭像與會員尊榮資訊 */}
                    <div className="flex flex-row items-center gap-4 sm:gap-5 text-left w-full lg:w-auto">
                        <div className="relative group shrink-0">
                            <div className="absolute -inset-2 bg-gradient-to-r from-amber-400/20 via-cyan-400/20 to-amber-400/20 rounded-full blur-xl opacity-60 animate-pulse" />
                            <MemberLevelCrown level={userProfile.userLevel} size="lg" />
                        </div>

                        <div className="space-y-1.5 sm:space-y-2 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <h1 className="text-xl sm:text-2xl md:text-3xl font-black font-headline text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-100 to-amber-200 drop-shadow-[0_0_15px_rgba(245,158,11,0.2)] tracking-tight truncate">
                                    {userProfile.username}
                                </h1>
                                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black px-2 py-0.5 text-[9px] sm:text-[10px] rounded-full border-none shadow-[0_0_12px_rgba(245,158,11,0.4)] shrink-0">
                                    VIP 會員
                                </Badge>
                            </div>

                            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <div className="flex items-center gap-1 text-amber-300 font-black text-[11px] sm:text-xs bg-amber-500/10 px-2.5 py-0.5 sm:py-1 rounded-full border border-amber-500/25 shadow-sm">
                                    <Crown className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-400 fill-amber-400/30" />
                                    <span>{userProfile.userLevel}</span>
                                </div>
                                <LeaderboardDialog>
                                    <Button variant="ghost" size="sm" className="h-6 sm:h-7 px-2 sm:px-2.5 rounded-full text-slate-300 hover:text-white font-bold text-[10px] sm:text-[11px] bg-white/5 hover:bg-white/10 border border-white/10 transition-all">
                                        <ListOrdered className="mr-1 h-3 w-3 sm:h-3.5 sm:w-3.5 text-amber-400" />
                                        榮耀排行榜
                                        <ChevronRight className="ml-0.5 h-3 w-3 opacity-60" />
                                    </Button>
                                </LeaderboardDialog>
                            </div>
                        </div>
                    </div>

                    {/* 右側：資產快覽與快捷操作 */}
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3.5 w-full lg:w-auto">
                        
                        {/* 鑽石 */}
                        <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/80 border border-cyan-500/20 flex flex-col justify-between min-w-[130px]">
                            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <DiamondIcon className="w-3.5 h-3.5 text-cyan-400" />
                                <span>鑽石餘額</span>
                            </div>
                            <p className="text-base sm:text-xl font-black font-code text-cyan-300 my-0.5">
                                {(userProfile?.points ?? 0).toLocaleString()}
                            </p>
                            <Button size="sm" variant="ghost" asChild className="mt-1 h-7 px-2 text-[10px] text-cyan-300 hover:text-white bg-cyan-500/10 hover:bg-cyan-500/20 rounded-lg w-full font-bold">
                                <Link href="/#pools">前往抽卡</Link>
                            </Button>
                        </div>

                        {/* 紅利 P+ */}
                        <div className="p-3 sm:p-4 rounded-2xl bg-slate-900/80 border border-amber-500/20 flex flex-col justify-between min-w-[130px]">
                            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <PPlusIcon className="w-3.5 h-3.5 text-amber-400" />
                                <span>紅利 P+</span>
                            </div>
                            <p className="text-base sm:text-xl font-black font-code text-amber-300 my-0.5">
                                {(userProfile?.bonusPoints ?? 0).toLocaleString()}
                            </p>
                            <RedeemPrizesDialog>
                                <Button size="sm" variant="ghost" className="mt-1 h-7 px-2 text-[10px] text-amber-300 hover:text-white bg-amber-500/10 hover:bg-amber-500/20 rounded-lg w-full font-bold">
                                    兌換獎品
                                </Button>
                            </RedeemPrizesDialog>
                        </div>

                        {/* 簽到 */}
                        <div className="col-span-2 sm:col-span-1 p-3 sm:p-4 rounded-2xl bg-slate-900/80 border border-white/10 flex flex-col justify-between min-w-[130px]">
                            <div className="flex items-center justify-between text-slate-400 text-[10px] font-bold uppercase tracking-wider mb-1">
                                <span className="flex items-center gap-1.5"><CalendarCheck className="w-3.5 h-3.5 text-primary" />每日簽到</span>
                                <span className="text-[9px] text-primary/80 font-bold">登入獎勵</span>
                            </div>
                            <div className="my-0.5 hidden sm:block">
                                <span className="text-[11px] text-slate-300 font-medium truncate block">簽到領取 P+ 點</span>
                            </div>
                            <div className="mt-1">
                                <CompactDailyCheckIn />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 總覽數據統計卡片 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-8 sm:mb-12 relative z-10">
                <StatCard label="加入天數" value={stats.daysJoined} icon={CalendarCheck} color="text-amber-400" />
                <StatCard label="累計抽卡數" value={stats.draws} icon={Package} color="text-cyan-400" />
                <StatCard label="拼卡參與次數" value={stats.bets} icon={Dices} color="text-rose-400" />
                <StatCard label="累計獲得贈點" value={stats.maxAdminGift} icon={Gift} color="text-emerald-400" />
            </div>

            {/* 會員中心整合導覽分頁 */}
            <Tabs defaultValue="vip" className="space-y-6 sm:space-y-8 relative z-10">
                <TabsList className="grid w-full grid-cols-4 bg-slate-900/80 p-1.5 rounded-2xl h-14 border border-white/10 backdrop-blur-xl">
                    <TabsTrigger value="vip" className="rounded-xl data-[state=active]:bg-gradient-to-r data-[state=active]:from-amber-500/30 data-[state=active]:to-yellow-500/20 data-[state=active]:text-amber-300 font-black text-xs sm:text-sm tracking-wide transition-all">
                        <Crown className="mr-1.5 sm:mr-2 h-4 w-4 text-amber-400" /> VIP 特權
                    </TabsTrigger>
                    <TabsTrigger value="profile" className="rounded-xl data-[state=active]:bg-primary/20 data-[state=active]:text-cyan-300 font-black text-xs sm:text-sm tracking-wide transition-all">
                        <UserIcon className="mr-1.5 sm:mr-2 h-4 w-4 text-cyan-400" /> 基本資料
                    </TabsTrigger>
                    <TabsTrigger value="transactions" className="rounded-xl data-[state=active]:bg-primary/20 data-[state=active]:text-cyan-300 font-black text-xs sm:text-sm tracking-wide transition-all">
                        <History className="mr-1.5 sm:mr-2 h-4 w-4 text-cyan-400" /> 帳務紀錄
                    </TabsTrigger>
                    <TabsTrigger value="shipping" className="rounded-xl data-[state=active]:bg-primary/20 data-[state=active]:text-cyan-300 font-black text-xs sm:text-sm tracking-wide transition-all">
                        <Truck className="mr-1.5 sm:mr-2 h-4 w-4 text-cyan-400" /> 出貨管理
                    </TabsTrigger>
                </TabsList>

                {/* 分頁 1: VIP 特權與榮耀成就 */}
                <TabsContent value="vip" className="space-y-10 sm:space-y-14 animate-in fade-in duration-300">
                    
                    {/* 榮耀階級圖譜 */}
                    <section className="space-y-6">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                                    <Crown className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-xl font-black font-headline tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)] flex items-center gap-2">
                                        <span>榮耀階級圖譜</span>
                                        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-full border border-amber-500/30">
                                            TIERS
                                        </span>
                                    </h2>
                                </div>
                            </div>
                            <div className="h-px flex-1 mx-4 sm:mx-6 bg-gradient-to-r from-amber-500/30 via-slate-700/40 to-transparent hidden sm:block" />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                            {userLevels.map((lvl, index) => {
                                const isCurrent = userProfile.userLevel === lvl.level;
                                const userSpend = userProfile.totalSpent || 0;
                                const isUnlocked = userSpend >= lvl.threshold;
                                const b = currentLevelBenefits[index];
                                
                                return (
                                    <div 
                                        key={lvl.level} 
                                        className={cn(
                                            "relative flex items-center p-4 sm:p-5 rounded-2xl border transition-all duration-300 group",
                                            isCurrent ? "bg-gradient-to-r from-cyan-950/40 to-slate-900/80 border-cyan-400/80 shadow-[0_0_25px_rgba(6,182,212,0.2)] ring-1 ring-cyan-400/40" : 
                                            isUnlocked ? "bg-gradient-to-b from-[#13192a]/90 via-[#0c101d]/90 to-[#080b14]/90 border-white/10 hover:border-amber-500/40 hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]" : "bg-slate-950/60 border-white/5 opacity-60 grayscale hover:opacity-90 hover:grayscale-0"
                                        )}
                                    >
                                        <div className="mr-4 shrink-0">
                                            <MemberLevelCrown level={lvl.level} size="sm" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <h3 className={cn("text-base font-black font-headline tracking-wide truncate", lvl.color)}>{lvl.level}</h3>
                                            <div className="flex items-center gap-3 text-xs font-bold font-code mt-1 text-slate-400">
                                                <span>門檻: {lvl.threshold.toLocaleString()} 💎</span>
                                                {b?.rate > 0 && <span className="text-cyan-400">● {b.rate}% 回饋</span>}
                                            </div>
                                        </div>
                                        {isCurrent && <Badge className="bg-cyan-400 text-slate-950 font-black px-3 py-0.5 ml-3 text-xs shadow-lg shadow-cyan-400/20">當前等級</Badge>}
                                        {isUnlocked && !isCurrent && <CheckCircle2 className="text-emerald-400 w-5 h-5 ml-3" />}
                                        {!isUnlocked && <Lock className="text-white/20 w-5 h-5 ml-3" />}
                                    </div>
                                );
                            })}
                        </div>
                    </section>

                    {/* 榮譽成就牆 */}
                    <section className="space-y-8">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                                    <MedalIcon className="w-5 h-5 animate-pulse" />
                                </div>
                                <div>
                                    <h2 className="text-base sm:text-xl font-black font-headline tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-blue-300 drop-shadow-[0_0_12px_rgba(6,182,212,0.3)] flex items-center gap-2">
                                        <span>榮譽成就牆</span>
                                        <span className="text-[9px] sm:text-[10px] font-mono font-bold text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-500/30">
                                            HALL OF FAME
                                        </span>
                                    </h2>
                                </div>
                            </div>
                            <Badge variant="outline" className="border-cyan-500/30 text-cyan-300 font-code bg-cyan-500/10 px-3 h-7 text-xs font-bold">
                                {unlockedAchievements.length} / {achievements.length} 已解鎖
                            </Badge>
                        </div>
                        
                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <Badge className="bg-emerald-500 text-slate-950 font-black px-3 py-0.5 text-xs shadow-md">已解鎖成就</Badge>
                                <div className="h-px flex-1 bg-emerald-500/20" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                                {unlockedAchievements.map((item) => (
                                    <AchievementItem key={item.id} item={item} />
                                ))}
                                {unlockedAchievements.length === 0 && (
                                    <div className="col-span-full py-10 text-center text-white/30 italic font-bold">
                                        尚未解鎖任何成就，快去體驗吧！
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="flex items-center gap-3">
                                <Badge variant="outline" className="border-white/20 text-slate-400 font-black px-3 py-0.5 text-xs">未解鎖成就</Badge>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
                                {lockedAchievements.map((item) => (
                                    <AchievementItem key={item.id} item={item} />
                                ))}
                            </div>
                        </div>
                    </section>
                </TabsContent>

                {/* 分頁 2: 個人資料修改 */}
                <TabsContent value="profile" className="animate-in fade-in duration-300">
                    <Card className="border-white/10 bg-gradient-to-b from-[#13192a]/95 via-[#0c101d]/90 to-[#080b14]/95 backdrop-blur-xl rounded-[2.5rem] shadow-2xl">
                        <CardHeader className="p-6 sm:p-8 pb-4">
                            <CardTitle className="text-xl font-black font-headline flex items-center gap-2 text-white">
                                <UserIcon className="h-5 w-5 text-primary"/> 個人資料修改
                            </CardTitle>
                            <CardDescription className="text-slate-400">
                                請務必提供正確的收件資訊，以確保卡片能準確寄送至您的手中。
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 sm:p-8 pt-4 space-y-8">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <Label htmlFor="username" className="text-xs uppercase font-bold text-slate-300 tracking-widest">會員名稱</Label>
                                        {userProfile.hasChangedUsername && (
                                            <span className="text-[10px] text-destructive font-bold flex items-center gap-1">
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
                                            "h-12 bg-background/50 border-white/10 rounded-xl transition-all font-bold text-white",
                                            userProfile.hasChangedUsername ? "opacity-50 cursor-not-allowed" : "focus:border-primary"
                                        )} 
                                        placeholder="請輸入 2-12 位會員名稱"
                                    />
                                    {!userProfile.hasChangedUsername ? (
                                        <p className="text-[10px] text-cyan-300 font-bold bg-cyan-500/10 p-2.5 rounded-lg border border-cyan-500/20">
                                            <Sparkles className="w-3.5 h-3.5 inline mr-1 text-cyan-400" /> 
                                            注意：會員名稱限修改 <span className="text-cyan-300 underline">一次</span>，長度限定為 <span className="text-cyan-300 underline">2 ~ 12</span> 個字。
                                        </p>
                                    ) : (
                                        <p className="text-[10px] text-slate-400 font-medium italic">您已使用過更名機會。</p>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="realName" className="text-xs uppercase font-bold text-slate-300 tracking-widest">收件姓名 (真實姓名)</Label>
                                    <Input id="realName" value={realName} onChange={(e) => setRealName(e.target.value)} placeholder="用於物流核對身份" className="h-12 bg-background/50 border-white/10 rounded-xl focus:border-primary transition-all text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="phone" className="text-xs uppercase font-bold text-slate-300 tracking-widest">聯絡電話</Label>
                                    <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} className="h-12 bg-background/50 border-white/10 rounded-xl focus:border-primary transition-all text-white" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="address" className="text-xs uppercase font-bold text-slate-300 tracking-widest">預設收件地址 / 7-11 門市</Label>
                                    <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="例如：7-11 台北門市" className="h-12 bg-background/50 border-white/10 rounded-xl focus:border-primary transition-all text-white" />
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-white/5 space-y-3">
                                <div className="flex items-center gap-2 text-slate-400">
                                    <Shield className="w-4 h-4 text-cyan-400"/>
                                    <span className="text-[10px] font-black uppercase tracking-widest">帳戶安全標籤 (UID)</span>
                                </div>
                                <div className="p-3.5 bg-black/40 rounded-xl border border-white/5">
                                    <code className="text-[11px] font-mono text-cyan-300/80 break-all">{userProfile.id}</code>
                                </div>
                            </div>

                            <Button onClick={handleSaveChanges} className="w-full sm:w-auto h-12 px-10 font-black text-sm rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:scale-105 active:scale-95 transition-all">
                                <CheckCircle2 className="mr-2 h-4 w-4" /> 儲存變更內容
                            </Button>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* 分頁 3: 交易帳務明細 */}
                <TabsContent value="transactions" className="animate-in fade-in duration-300">
                    <TransactionsTab userId={user.uid} />
                </TabsContent>
                
                {/* 分頁 4: 出貨管理查詢 */}
                <TabsContent value="shipping" className="animate-in fade-in duration-300">
                    <ShippingOrdersTab userId={user.uid} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
