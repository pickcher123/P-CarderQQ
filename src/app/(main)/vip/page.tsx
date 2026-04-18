
'use client';

import { useState, useMemo, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
    Ticket
} from 'lucide-react';
import { PPlusIcon } from "@/components/icons";
import { useUser, useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, increment, runTransaction, query, where, limit, updateDoc, serverTimestamp, orderBy } from "firebase/firestore";
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { MemberLevelCrown, userLevels } from "@/components/member-level-crown";
import type { UserProfile } from "@/types/user-profile";
import type { DailyMission, UserMissionProgress } from '@/types/missions';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { SafeImage } from "@/components/safe-image";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { SystemConfig } from "@/types/system";

interface RedemptionItem {
    id: string;
    name: string;
    points: number;
    imageUrl: string;
    description: string;
    isActive: boolean;
    order?: number;
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
                <div className="p-4 bg-muted/10 border-t border-white/5 text-center">
                    <p className="text-[9px] text-muted-foreground font-black uppercase tracking-[0.3em] opacity-40">P+Carder Official Ranking Protocol</p>
                </div>
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
    <Button variant="outline" className={cn("h-10 w-full px-3 rounded-xl border-primary/30 transition-all text-xs", hasClaimedToday ? "bg-white/5 opacity-60 text-white/40" : "bg-primary/10 hover:bg-primary/20 shadow-[0_0_10px_rgba(6,182,212,0.1)] text-white")} disabled={hasClaimedToday || !loginMission.isActive || !!claimingId} onClick={handleCheckIn}>
        <div className="flex items-center gap-2 w-full">
            {claimingId === loginMission.id ? <Loader2 className="animate-spin h-4 w-4 text-primary" /> : hasClaimedToday ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <CalendarCheck className="h-4 w-4 text-primary" />}
            <div className="text-left flex-1 truncate">
                <p className="text-[10px] font-black uppercase tracking-widest">{hasClaimedToday ? '今日已領取' : '每日簽到領取'}</p>
                {!hasClaimedToday && <p className="text-[9px] text-accent/80 font-bold">+ {loginMission.rewardPoints} P點</p>}
            </div>
            {!hasClaimedToday && <PPlusIcon className="w-3 h-3 text-accent" />}
        </div>
    </Button>
  );
}

function AchievementItem({ item }: { item: any }) {
    return (
        <div className={cn(
            "flex flex-col items-center p-4 md:p-6 rounded-[2rem] border transition-all duration-500 relative overflow-hidden h-full group",
            item.unlocked 
                ? "bg-gradient-to-br from-card/80 to-card/40 border-primary/50 shadow-[0_10px_30px_-10px_rgba(6,182,212,0.3)] hover:border-primary hover:shadow-[0_0_20px_rgba(6,182,212,0.2)]" 
                : "bg-black/90 border-white/5 grayscale hover:border-white/20"
        )}>
            <div className={cn(
                "p-3 md:p-5 rounded-3xl mb-3 md:mb-5 transition-all duration-300", 
                item.unlocked 
                    ? "bg-primary/10 text-primary group-hover:scale-110 group-hover:bg-primary/20" 
                    : "bg-white/5 text-white/10"
            )}>
                {item.unlocked ? <item.icon className="w-8 h-8 md:w-12 md:h-12" /> : <Lock className="w-6 h-6 md:w-8 h-8" />}
            </div>
            <h4 className={cn("font-black text-[11px] md:text-base text-center line-clamp-1 mb-1 transition-colors", item.unlocked ? "text-white" : "text-white/30")}>{item.title}</h4>
            <p className={cn("text-[9px] md:text-[11px] text-center line-clamp-2 mb-3", item.unlocked ? "text-white/50" : "text-white/20")}>{item.condition}</p>
            <Badge variant="outline" className={cn(
                "text-[7px] md:text-[10px] h-5 md:h-6 font-black uppercase tracking-widest px-3 md:px-4 mt-auto rounded-full transition-colors", 
                item.unlocked ? "border-primary/30 text-primary bg-primary/5" : "border-white/5 text-white/10 bg-black/40"
            )}>{item.category}</Badge>
            {item.unlocked && <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary to-accent opacity-0 group-hover:opacity-100 transition-opacity" />}
        </div>
    );
}

export default function VIPZonePage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);
    
    const userProfileRef = useMemoFirebase(() => (firestore && user && isMounted) ? doc(firestore, "users", user.uid) : null, [firestore, user, isMounted]);
    const { data: userProfile, isLoading: isProfileLoading, error: profileError } = useDoc<UserProfile>(userProfileRef);

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
    
    const userCardsQuery = useMemoFirebase(() => (firestore && user?.uid && isMounted) ? collection(firestore, 'users', user.uid, 'userCards') : null, [firestore, user, isMounted]);
    const { data: userCards } = useCollection(userCardsQuery);
    
    const txQuery = useMemoFirebase(() => (firestore && user?.uid && isMounted) ? query(collection(firestore, 'transactions'), where('userId', '==', user.uid)) : null, [firestore, user, isMounted]);
    const { data: allTransactions } = useCollection<any>(txQuery);

    const stats = useMemo(() => {
        if (!userCards || !allTransactions || !userProfile) return { legends: 0, draws: 0, bets: 0, maxAdminGift: 0, foils: 0, luckyBags: 0, groupBreaks: 0, quickSells: 0, daysJoined: 0 };
        
        const adminGifts = allTransactions.filter(t => t.section === 'admin' && t.transactionType === 'Deposit').map(t => t.amount);
        
        let daysJoined = 0;
        if (userProfile.createdAt) {
            const createdDate = userProfile.createdAt.toDate();
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

    const currentBenefit = useMemo(() => {
        if (!userProfile || !systemConfig?.levelBenefits) return null;
        return systemConfig.levelBenefits.find(b => b.level === userProfile.userLevel);
    }, [userProfile, systemConfig]);

    const achievements = useMemo(() => [
        { id: 'first-card', title: '初次啼聲', category: '收藏', icon: Package, unlocked: userCards && userCards.length > 0, condition: '獲得第一張卡片' },
        { id: 'collection-50', title: '資深館長', category: '收藏', icon: Library, unlocked: userCards && userCards.length >= 50, condition: '收藏達到 50 張卡片' },
        { id: 'legend-collector', title: '傳奇見證者', category: '稀有度', icon: Crown, unlocked: stats.legends > 0, condition: '獲得 1 張傳奇卡' },
        { id: 'draw-master', title: '卡池支配者', category: '抽卡', icon: Zap, unlocked: stats.draws >= 100, condition: '累計抽卡 100 次' },
        { id: 'bet-pro', title: '命運賭徒', category: '拼卡', icon: Dices, unlocked: stats.bets >= 20, condition: '參與拼卡 20 次' },
        { id: 'whale-gift', title: '官方之友', category: '特殊', icon: Gift, unlocked: stats.maxAdminGift >= 5000, condition: '單次獲得官方贈點 5000 以上' },
        { id: 'full-squad', title: '夢幻陣容', category: '收藏', icon: Users2, unlocked: userCards && userCards.length >= 100, condition: '收藏達到 100 張卡片' },
        { id: 'lucky-star', title: '強運體質', category: '機率', icon: Sparkles, unlocked: stats.legends >= 5, condition: '獲得 5 張傳奇卡' },
        { id: 'foil-lover', title: '萬中選一', category: '特殊', icon: Zap, unlocked: stats.foils > 0, condition: '獲得 1 張亮面卡' },
        { id: 'bet-master', title: '拼卡大師', category: '拼卡', icon: Dices, unlocked: stats.bets >= 50, condition: '參與拼卡 50 次' },
        { id: 'lucky-bag-pro', title: '福袋達人', category: '活動', icon: Ticket, unlocked: stats.luckyBags >= 10, condition: '購買福袋 10 次' },
        { id: 'break-pioneer', title: '團拆先鋒', category: '活動', icon: Users2, unlocked: stats.groupBreaks >= 5, condition: '參與團拆 5 次' },
        { id: 'sell-king', title: '快速轉點王', category: '管理', icon: RefreshCw, unlocked: stats.quickSells >= 10, condition: '使用快速轉點 10 次' },
        { id: 'legend-20', title: '傳說級收藏家', category: '稀有度', icon: Trophy, unlocked: stats.legends >= 20, condition: '獲得 20 張傳奇卡' },
        { id: 'wealthy', title: '點數大亨', category: '資產', icon: Gem, unlocked: (userProfile?.points || 0) >= 50000, condition: '持有 50,000 以上鑽石' },
        { id: 'collector-max', title: '收藏之巔', category: '收藏', icon: Archive, unlocked: userCards && userCards.length >= 200, condition: '收藏達到 200 張卡片' },
        // 新增成就
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

    if (!isMounted || isUserLoading || isProfileLoading) return <div className="container py-32 text-center flex flex-col items-center gap-6"><Loader2 className="h-16 w-16 animate-spin text-primary" /><p className="font-headline tracking-[0.3em] text-primary text-xl animate-pulse uppercase">Syncing Honor Database</p></div>;
    if (profileError) return <div className="container py-32 text-center text-white">載入資料失敗，請稍後再試。</div>;
    if (!user || !userProfile) return <div className="container py-32 text-center space-y-8 text-white"><Lock className="w-16 h-16 opacity-20 inline-block" /><h2 className="text-2xl font-black uppercase">Restricted Area</h2><Button size="lg" asChild className="h-14 px-12 rounded-2xl bg-primary text-primary-foreground"><Link href="/login">前往登入驗證</Link></Button></div>;

    const currentLevelBenefits = [
        { free: false, rate: 0 },   // 新手
        { free: true, rate: 1 },    // 進階
        { free: true, rate: 1.5 },  // 資深
        { free: true, rate: 2 },    // 大師
        { free: true, rate: 4 },    // 殿堂
        { free: true, rate: 5 },    // 傳奇
        { free: true, rate: 10 },   // 卡神
    ];

    return (
        <div className="container py-12 md:py-20 max-w-6xl relative text-white">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/5 blur-[120px] pointer-events-none" />
            
            <div className="flex flex-col lg:flex-row items-start justify-between mb-16 gap-10 animate-fade-in-up relative z-10">
                <div className="flex flex-col sm:flex-row items-center gap-8">
                    <MemberLevelCrown level={userProfile.userLevel} size="md" />
                    <div className="space-y-4 text-center sm:text-left">
                        <div className="flex items-center justify-center sm:justify-start gap-4">
                            <h1 className="text-4xl font-black font-headline text-white">{userProfile.username}</h1>
                            <Badge className="bg-accent text-accent-foreground font-black px-3 h-7 border-none shadow-[0_0_15px_rgba(234,179,8,0.4)]">VIP</Badge>
                        </div>
                            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-2 text-accent font-black text-sm bg-accent/10 px-4 py-1.5 rounded-full border border-accent/20">
                                        <Crown className="h-4 w-4" />
                                        {userProfile.userLevel}
                                    </div>
                                    <LeaderboardDialog>
                                        <Button className="h-9 px-5 rounded-full bg-gradient-to-r from-accent to-amber-600 text-accent-foreground font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                                            <ListOrdered className="mr-2 h-4 w-4" /> 榮耀排行榜 <ChevronRight className="ml-1 h-3 w-3" />
                                        </Button>
                                    </LeaderboardDialog>
                                </div>
                            </div>
                    </div>
                </div>

                {/* 新增：整合後的簽到與紅利區塊 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full lg:max-w-xl">
                    <Card className="bg-card/40 border-primary/30 rounded-3xl backdrop-blur-xl text-white p-4 flex flex-col justify-between">
                         <div className="flex items-center gap-2 mb-2">
                             <CalendarCheck className="w-5 h-5 text-primary" />
                             <span className="text-sm font-bold uppercase">每日簽到</span>
                         </div>
                         <CompactDailyCheckIn />
                    </Card>
                    <Card className="bg-card/40 border-accent/30 rounded-3xl backdrop-blur-xl text-white p-4 flex flex-col justify-between">
                        <div className="flex items-center gap-2 mb-2">
                             <PPlusIcon className="w-5 h-5 text-accent" />
                             <span className="text-sm font-bold uppercase">餘額</span>
                             <p className="text-xl font-black font-code text-accent ml-auto">{(userProfile?.bonusPoints ?? 0).toLocaleString()}</p>
                        </div>
                        <RedeemPrizesDialog>
                            <Button className="bg-accent text-accent-foreground font-black w-full h-8 rounded-xl text-xs shadow-[0_0_15px_rgba(234,179,8,0.3)]">前往兌換</Button>
                        </RedeemPrizesDialog>
                    </Card>
                </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-16 relative z-10 w-full max-w-5xl mx-auto">
                {[
                    { label: '加入天數', value: stats.daysJoined, icon: CalendarCheck, color: 'text-accent' },
                    { label: '累計抽卡數', value: stats.draws, icon: Package, color: 'text-primary' },
                    { label: '拼卡參與次數', value: stats.bets, icon: Dices, color: 'text-rose-500' },
                    { label: '獲得最高贈點', value: stats.maxAdminGift, icon: Gift, color: 'text-emerald-500' },
                    { label: '傳奇珍藏數', value: stats.legends, icon: Sparkles, color: 'text-purple-500' },
                ].map((stat, i) => (
                    <div key={i} className="p-4 md:p-6 rounded-[1.5rem] bg-white/5 border border-white/5 backdrop-blur-md text-center group hover:border-white/20 transition-all shadow-xl">
                        <div className={cn("p-2 rounded-xl bg-white/5 w-fit mx-auto mb-2 transition-transform group-hover:scale-110 group-hover:rotate-3", stat.color)}>
                            <stat.icon className="w-5 h-5 md:w-6 md:h-6" />
                        </div>
                        <p className="text-[9px] font-black uppercase text-white/40 tracking-[0.1em] mb-0.5">{stat.label}</p>
                        <p className="text-xl md:text-2xl font-black font-code text-white drop-shadow-sm">{stat.value.toLocaleString()}</p>
                    </div>
                ))}
            </div>


            <section className="space-y-10 mb-20 relative z-10 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
                <div className="flex items-center gap-4 mb-10">
                    <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        <Crown className="text-amber-500 w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black font-headline text-white tracking-widest uppercase italic">榮耀階級圖譜</h2>
                        <p className="text-xs text-muted-foreground uppercase tracking-widest font-bold mt-1 opacity-60">VIP Progression Matrix</p>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-r from-amber-500/30 to-transparent ml-4 hidden sm:block" />
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-1">
                    {userLevels.map((lvl, index) => {
                        const isCurrent = userProfile.userLevel === lvl.level;
                        const userSpend = userProfile.totalSpent || 0;
                        const isUnlocked = userSpend >= lvl.threshold;
                        const b = currentLevelBenefits[index];
                        
                        return (
                            <div 
                                key={lvl.level} 
                                className={cn(
                                    "flex flex-row items-center justify-between p-4 md:p-6 rounded-2xl md:rounded-[2rem] border transition-all duration-500 group",
                                    isCurrent ? "bg-primary/20 border-primary shadow-[0_0_30px_rgba(6,182,212,0.3)]" : 
                                    isUnlocked ? "bg-white/10 border-white/20" : "bg-black/80 border-white/10"
                                )}
                                style={!isUnlocked ? { opacity: 0.85 } : {}}
                            >
                                <div className="flex items-center gap-3 md:gap-6 text-left flex-1">
                                    <div className="relative shrink-0">
                                        <MemberLevelCrown level={lvl.level} size="xs" />
                                        {isUnlocked && !isCurrent && <CheckCircle2 className="absolute -top-1 -right-1 w-3 h-3 text-green-500 bg-background rounded-full" />}
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className={cn("text-sm md:text-xl font-black font-headline tracking-wide truncate", lvl.color, !isUnlocked && "opacity-60")}>{lvl.level}</h3>
                                        <p className="text-[9px] md:text-xs text-slate-300 font-bold font-code mt-0.5 flex items-center gap-1">
                                            門檻: <span className="text-white">{(lvl.threshold).toLocaleString()}</span> 💎
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center justify-end gap-2 shrink-0">
                                    {b.free && <Badge variant="outline" className="border-green-500/50 text-green-400 bg-green-500/10 px-2 py-0.5 text-[9px] md:text-xs font-black"><Truck className="w-2.5 h-2.5 md:w-3 md:h-3 mr-1"/> 免運</Badge>}
                                    {b.rate > 0 && <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10 px-2 py-0.5 text-[9px] md:text-xs font-black"><PPlusIcon className="w-2.5 h-2.5 md:w-3 md:h-3 mr-1"/> {b.rate}%</Badge>}
                                    
                                    {isCurrent && <Badge className="bg-primary text-primary-foreground font-black px-2 py-0.5 text-[9px] md:text-xs shadow-[0_0_15px_rgba(6,182,212,0.5)]">目前</Badge>}
                                    {!isUnlocked && <Lock className="w-4 h-4 text-white/40" />}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>

            <section className="space-y-16 relative z-10 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <div className="flex items-center justify-between">
                    <div className="space-y-1">
                        <h2 className="text-2xl md:text-3xl font-black font-headline tracking-widest flex items-center gap-3 italic">
                            <MedalIcon className="text-primary h-8 w-8 animate-pulse" /> 榮譽成就牆
                        </h2>
                        <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest ml-11">Hall of Achievement</p>
                    </div>
                    <Badge variant="outline" className="border-primary/30 text-primary font-code bg-primary/5 px-4 h-8 text-sm">
                        {unlockedAchievements.length} / {achievements.length} UNLOCKED
                    </Badge>
                </div>
                
                <div className="space-y-8">
                    <div className="flex items-center gap-3">
                        <Badge className="bg-emerald-500 text-white font-black px-3 py-0.5">ALREADY EARNED</Badge>
                        <div className="h-px flex-1 bg-emerald-500/20" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
                        {unlockedAchievements.map((item) => (
                            <AchievementItem key={item.id} item={item} />
                        ))}
                        {unlockedAchievements.length === 0 && (
                            <div className="col-span-full py-10 text-center text-white/20 italic font-bold">
                                尚未解鎖任何成就，快去專區體驗吧！
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-8">
                    <div className="flex items-center gap-3">
                        <Badge variant="outline" className="border-white/20 text-white/40 font-black px-3 py-0.5">NOT YET DISCOVERED</Badge>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 md:gap-6">
                        {lockedAchievements.map((item) => (
                            <AchievementItem key={item.id} item={item} />
                        ))}
                    </div>
                </div>
            </section>

            <div className="mt-32 text-center opacity-30">
                <p className="text-[10px] text-white/40 font-headline uppercase tracking-[0.5em]">P+Carder Honor System • Authenticity Guaranteed</p>
            </div>
        </div>
    );
}
