'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import confetti from 'canvas-confetti';
import Link from 'next/link';
import { 
    Gift, 
    QrCode, 
    Sparkles, 
    CheckCircle2, 
    KeyRound, 
    Copy, 
    Ticket, 
    Clock,
    ArrowRight,
    Users,
    ExternalLink,
    Loader2,
    CalendarCheck,
    Coins,
    Calendar
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, limit, runTransaction, increment } from 'firebase/firestore';
import { format } from 'date-fns';
import { DailyMission, UserMissionProgress } from '@/types/missions';
import { SystemConfig } from '@/types/system';
import { UserProfile } from '@/types/user-profile';
import { claimCommunityFreeDraw, redeemPromoDrawCode, syncLocalPromoClaimsToFirestore } from '@/lib/promo-draw-service';

// 預設可兌換的活動代碼庫
export interface PromoCodeConfig {
    code: string;
    label: string;
    targetEvent: 'wheel' | 'kuji' | 'price-guess' | 'punch-grid' | 'all';
    freePlays: number;
    description: string;
    source: 'LINE' | 'DISCORD' | 'IG' | 'STAFF' | 'VIP';
    expiresAt: string;
}

export const OFFICIAL_PROMO_CODES: PromoCodeConfig[] = [
    {
        code: 'OPEN2024',
        label: '開幕專屬・免費首抽',
        targetEvent: 'all',
        freePlays: 1,
        description: '全場活動免費 1 次試手氣機會',
        source: 'LINE',
        expiresAt: '2026-12-31'
    },
    {
        code: 'LUCKYCARD',
        label: '轉盤專屬・加碼券',
        targetEvent: 'wheel',
        freePlays: 2,
        description: '轉盤大福袋專屬 2 次抽獎加碼',
        source: 'DISCORD',
        expiresAt: '2026-12-31'
    },
    {
        code: 'KUJI888',
        label: '一番賞・首抽特典',
        targetEvent: 'kuji',
        freePlays: 1,
        description: '活動套一番賞免費撕籤 1 次',
        source: 'IG',
        expiresAt: '2026-12-31'
    },
    {
        code: 'VIPGIFT',
        label: '貴賓專屬・九宮格券',
        targetEvent: 'punch-grid',
        freePlays: 3,
        description: '九宮格盲盒 3 次破箱連線挑戰',
        source: 'VIP',
        expiresAt: '2026-12-31'
    }
];

export interface ClaimHistoryItem {
    id: string;
    code: string;
    label: string;
    targetEvent: string;
    freePlays: number;
    claimedAt: string;
    status: 'ACTIVE' | 'USED';
}

interface PromoRedeemModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApplyReward?: (targetEvent: string, freePlays: number) => void;
}

export function PromoRedeemModal({ open, onOpenChange, onApplyReward }: PromoRedeemModalProps) {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
    const showPromoCodeHints = Boolean(systemConfig?.showPromoCodeHints || systemConfig?.featureFlags?.showPromoHints);

    const userDocRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    const [inputCode, setInputCode] = useState('');
    const [selectedTab, setSelectedTab] = useState<'redeem' | 'history' | 'poster'>('redeem');
    const [claimedHistory, setClaimedHistory] = useState<ClaimHistoryItem[]>([]);
    const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
    const [lastClaimedReward, setLastClaimedReward] = useState<ClaimHistoryItem | null>(null);
    const [isClaimingCommunity, setIsClaimingCommunity] = useState(false);

    // 每日簽到狀態與查詢
    const missionsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'dailyMissions'), where('type', '==', 'login'), limit(1)) : null, [firestore]);
    const progressQuery = useMemoFirebase(() => (firestore && user) ? collection(firestore, `users/${user.uid}/missionProgress`) : null, [firestore, user]);
    const { data: missions } = useCollection<DailyMission>(missionsQuery);
    const { data: missionProgressList, forceRefetch: refetchProgress } = useCollection<UserMissionProgress>(progressQuery);
    
    const [isCheckingIn, setIsCheckingIn] = useState(false);
    const [localCheckInDone, setLocalCheckInDone] = useState(false);

    const loginMission = useMemo(() => missions?.[0] || null, [missions]);
    const missionId = loginMission?.id || 'daily-login';
    const rewardPoints = loginMission?.rewardPoints ?? 10;

    const userLoginProgress = useMemo(() => {
        return missionProgressList?.find(p => p.id === missionId || p.id === loginMission?.id);
    }, [missionProgressList, missionId, loginMission]);

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    const hasClaimedCheckInToday = useMemo(() => {
        if (localCheckInDone) return true;
        if (userProfile?.lastCheckInDate === todayStr) return true;
        if (userLoginProgress?.lastCompleted === todayStr) return true;
        return false;
    }, [localCheckInDone, userProfile?.lastCheckInDate, userLoginProgress?.lastCompleted, todayStr]);

    const handleCheckIn = useCallback(async () => {
        if (!user) {
            toast({
                title: '請先登入',
                description: '登入會員即可每日簽到領取紅利點數！',
                variant: 'destructive',
            });
            return;
        }
        if (!firestore) return;
        if (hasClaimedCheckInToday) {
            toast({
                title: '今日已完成簽到',
                description: '明天再來領取簽到好禮吧！',
            });
            return;
        }

        setIsCheckingIn(true);
        try {
            const currentToday = format(new Date(), 'yyyy-MM-dd');
            await runTransaction(firestore, async (transaction) => {
                const userRef = doc(firestore, 'users', user.uid);
                const progressRef = doc(firestore, `users/${user.uid}/missionProgress`, missionId);
                const [userDoc, existingProgress] = await Promise.all([
                    transaction.get(userRef), 
                    transaction.get(progressRef)
                ]);

                const userData = userDoc.data();
                const progressData = existingProgress.data();

                if (userData?.lastCheckInDate === currentToday || (existingProgress.exists() && progressData?.lastCompleted === currentToday)) {
                    throw new Error("今日已領取");
                }

                transaction.update(userRef, { 
                    bonusPoints: increment(rewardPoints),
                    lastCheckInDate: currentToday
                });

                if (!existingProgress.exists()) {
                    transaction.set(progressRef, { 
                        progress: 1, 
                        lastCompleted: currentToday, 
                        userId: user.uid,
                        updatedAt: new Date().toISOString()
                    });
                } else {
                    transaction.update(progressRef, { 
                        progress: increment(1), 
                        lastCompleted: currentToday,
                        updatedAt: new Date().toISOString()
                    });
                }
            });

            setLocalCheckInDone(true);
            confetti({
                particleCount: 70,
                spread: 80,
                origin: { y: 0.6 }
            });

            toast({
                title: '🎉 簽到成功！',
                description: `恭喜獲得 +${rewardPoints} 紅利 P+ 點數！`,
            });

            if (refetchProgress) refetchProgress();
        } catch (e: any) {
            if (e.message === "今日已領取") {
                setLocalCheckInDone(true);
                toast({ title: '今日已簽到', description: '您今天已經領取過簽到獎勵囉！' });
            } else {
                toast({ variant: 'destructive', title: '簽到失敗', description: e.message || '請稍後再試' });
            }
        } finally {
            setIsCheckingIn(false);
        }
    }, [user, firestore, hasClaimedCheckInToday, missionId, rewardPoints, todayStr, refetchProgress, toast]);

    // 載入本地兌換歷史並在開啟時自動同步至 Firestore
    useEffect(() => {
        try {
            const saved = localStorage.getItem('card_exhibition_promo_claims');
            if (saved) {
                setClaimedHistory(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to load claim history', e);
        }

        if (open && user && firestore) {
            syncLocalPromoClaimsToFirestore(firestore, user.uid).catch(e => {
                console.warn('Sync promo claims error:', e);
            });
        }
    }, [open, user, firestore]);

    // 儲存兌換紀錄
    const saveClaimHistory = (newHistory: ClaimHistoryItem[]) => {
        setClaimedHistory(newHistory);
        try {
            localStorage.setItem('card_exhibition_promo_claims', JSON.stringify(newHistory));
            localStorage.setItem('promo_claim_history', JSON.stringify(newHistory));
        } catch (e) {
            console.error('Failed to save claim history', e);
        }
    };

    // 執行兌換碼兌換
    const handleRedeem = async (codeToRedeem?: string) => {
        const targetCode = (codeToRedeem || inputCode).trim().toUpperCase();

        if (!user) {
            toast({
                title: '請先登入會員',
                description: '登入會員後即可輸入兌換碼兌換專屬抽卡券！',
                variant: 'destructive'
            });
            return;
        }

        if (!targetCode) {
            toast({
                title: '請輸入兌換碼',
                description: '請輸入活動或社群取得之專屬代碼。',
                variant: 'destructive'
            });
            return;
        }

        // 檢查是否已兌換過 (同時檢查 Firestore 會員紀錄與本機紀錄)
        const isAlreadyClaimed = 
            userProfile?.claimedPromoCodes?.includes(targetCode) || 
            claimedHistory.some(item => item.code.toUpperCase() === targetCode);

        if (isAlreadyClaimed) {
            toast({
                title: '此代碼已領取過',
                description: '每個代碼限兌換乙次，您已成功領取該福利。',
                variant: 'destructive'
            });
            return;
        }

        // 匹配兌換碼
        const matched = OFFICIAL_PROMO_CODES.find(p => p.code.toUpperCase() === targetCode);

        if (!matched) {
            toast({
                title: '代碼無效',
                description: '請確認代碼是否輸入正確，或該活動已結束。',
                variant: 'destructive'
            });
            return;
        }

        try {
            if (!firestore) return;
            const res = await redeemPromoDrawCode(firestore, user.uid, targetCode);

            const newClaimItem: ClaimHistoryItem = {
                id: 'claim-' + Date.now(),
                code: matched.code,
                label: matched.label,
                targetEvent: matched.targetEvent,
                freePlays: res.ticketsAdded || matched.freePlays,
                claimedAt: new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
                status: 'ACTIVE'
            };

            const updatedHistory = [newClaimItem, ...claimedHistory.filter(i => i.code !== targetCode)];
            saveClaimHistory(updatedHistory);
            setLastClaimedReward(newClaimItem);
            setInputCode('');
            setIsSuccessDialogOpen(true);

            confetti({
                particleCount: 50,
                spread: 60,
                origin: { y: 0.7 }
            });

            if (onApplyReward) {
                onApplyReward(matched.targetEvent, res.ticketsAdded || matched.freePlays);
            }

            toast({
                title: '🎉 兌換成功！',
                description: res.message
            });
        } catch (err: any) {
            toast({
                variant: 'destructive',
                title: '兌換失敗',
                description: err.message || '兌換失敗，請稍後再試'
            });
        }
    };

    const handleOneClickLoginClaim = () => {
        handleRedeem('OPEN2024');
    };

    const handleClaimCommunityReward = async () => {
        const targetUrl = systemConfig?.communityUrl || 'https://line.me/ti/g2/';

        if (!user) {
            toast({
                title: '請先登入會員',
                description: '登入會員後加入官方社群，即可將免費首抽券 1 張存入您的帳號！',
                variant: 'destructive'
            });
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        if (isCommunityClaimed) {
            toast({
                title: '您已領取過社群首抽券',
                description: '每位會員限領 1 次，歡迎前往社群與卡友交流分享戰績！'
            });
            window.open(targetUrl, '_blank', 'noopener,noreferrer');
            return;
        }

        if (isClaimingCommunity) return;
        setIsClaimingCommunity(true);

        try {
            if (!firestore) throw new Error('連線中，請稍後重試');

            const res = await claimCommunityFreeDraw(firestore, user.uid, '官方社群');

            if (res.alreadyClaimed) {
                toast({
                    title: '您已領取過社群首抽券',
                    description: '每位會員限領 1 次，歡迎前往社群與卡友交流分享戰績！'
                });
                window.open(targetUrl, '_blank', 'noopener,noreferrer');
                return;
            }

            if (res.success) {
                const newClaimItem: ClaimHistoryItem = {
                    id: 'claim-community-' + Date.now(),
                    code: 'COMMUNITY_JOIN',
                    label: '官方社群專屬・免費首抽',
                    targetEvent: 'all',
                    freePlays: 1,
                    claimedAt: new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    status: 'ACTIVE'
                };

                const updatedHistory = [newClaimItem, ...claimedHistory.filter(i => i.code !== 'COMMUNITY_JOIN')];
                saveClaimHistory(updatedHistory);
                setLastClaimedReward(newClaimItem);
                setIsSuccessDialogOpen(true);

                confetti({
                    particleCount: 60,
                    spread: 70,
                    origin: { y: 0.7 }
                });

                if (onApplyReward) {
                    onApplyReward('all', 1);
                }

                toast({
                    title: '🎉 成功領取社群專屬免費首抽券！',
                    description: '已為您的帳號存入 1 張免費抽卡券，即將開啟官方社群！'
                });

                window.open(targetUrl, '_blank', 'noopener,noreferrer');
            }
        } catch (err: any) {
            console.error('Error claiming community reward:', err);
            toast({
                variant: 'destructive',
                title: '領取失敗',
                description: err.message || '請稍候重試'
            });
        } finally {
            setIsClaimingCommunity(false);
        }
    };

    const isStarterClaimed = Boolean(
        userProfile?.claimedPromoCodes?.includes('OPEN2024') ||
        claimedHistory.some(item => item.code === 'OPEN2024')
    );
    const isCommunityClaimed = Boolean(
        userProfile?.claimedCommunityTicket || 
        userProfile?.claimedPromoCodes?.includes('COMMUNITY_JOIN') ||
        claimedHistory.some(item => item.code === 'COMMUNITY_JOIN')
    );

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="w-[calc(100vw-20px)] sm:w-full sm:max-w-lg h-auto max-h-[88vh] flex flex-col p-0 gap-0 overflow-hidden bg-[#0c101a] border border-slate-800/90 rounded-2xl shadow-2xl text-slate-100">
                    <DialogHeader className="p-4 sm:p-5 pb-3 border-b border-slate-800/80 shrink-0 bg-[#0c101a] pr-10 text-left">
                        <div className="space-y-1">
                            <DialogTitle className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                                <CalendarCheck className="w-5 h-5 text-amber-400 shrink-0" />
                                <span>簽到 / 領券中心</span>
                            </DialogTitle>
                            <DialogDescription className="text-xs text-slate-400 leading-tight">
                                每日簽到領紅利 P+ 點，輸入兌換碼或加入社群享免費抽卡！
                            </DialogDescription>
                        </div>

                        {/* 自適應分頁導航 */}
                        <div className="flex items-center gap-1 mt-3 bg-slate-950/80 p-1 rounded-xl border border-slate-800/70">
                            <button
                                type="button"
                                onClick={() => setSelectedTab('redeem')}
                                className={cn(
                                    "flex-1 py-1.5 px-1 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1",
                                    selectedTab === 'redeem'
                                        ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <CalendarCheck className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                <span className="truncate">簽到與領券</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTab('history')}
                                className={cn(
                                    "flex-1 py-1.5 px-1 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1",
                                    selectedTab === 'history'
                                        ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <Ticket className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">領取紀錄</span>
                                {claimedHistory.length > 0 && (
                                    <span className="px-1.5 py-0.2 rounded-full bg-slate-700 text-[10px] text-slate-300 font-mono shrink-0">
                                        {claimedHistory.length}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTab('poster')}
                                className={cn(
                                    "flex-1 py-1.5 px-1 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1",
                                    selectedTab === 'poster'
                                        ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <QrCode className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">現場專區</span>
                            </button>
                        </div>
                    </DialogHeader>

                    {/* 內容獨立滾動區塊 */}
                    <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 overscroll-contain">
                        {/* 1. 兌換區 */}
                        {selectedTab === 'redeem' && (
                            <div className="space-y-4">
                                {/* 福利卡片列表 */}
                                <div className="space-y-2.5">
                                    {/* 🌟 每日簽到福利卡片 (核心高光首位) */}
                                    <div className="relative overflow-hidden p-3.5 sm:p-4 rounded-xl bg-gradient-to-br from-amber-500/15 via-rose-500/10 to-slate-900 border border-amber-500/40 shadow-[0_4px_20px_rgba(245,158,11,0.12)] flex flex-col gap-2.5 group">
                                        <div className="flex items-center justify-between gap-2.5">
                                            <div className="space-y-1 min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <div className="flex items-center gap-1 font-black text-xs sm:text-sm text-white whitespace-nowrap">
                                                        <CalendarCheck className="w-4 h-4 text-amber-400" />
                                                        <span>每日簽到福利</span>
                                                    </div>
                                                    <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-mono px-1.5 py-0 h-4.5 whitespace-nowrap">
                                                        +{rewardPoints} 紅利 P+ 點
                                                    </Badge>
                                                </div>
                                                <p className="text-[11px] text-slate-300 leading-tight">
                                                    天天登入免費簽到，累積紅利點數換專屬好禮
                                                </p>
                                            </div>

                                            {!user ? (
                                                <Button
                                                    size="sm"
                                                    asChild
                                                    className="h-8 px-3 rounded-lg text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm shrink-0 whitespace-nowrap"
                                                >
                                                    <Link href="/login">
                                                        登入簽到
                                                    </Link>
                                                </Button>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    disabled={hasClaimedCheckInToday || isCheckingIn}
                                                    onClick={handleCheckIn}
                                                    className={cn(
                                                        "h-8 px-3 rounded-lg text-xs font-bold shrink-0 transition-all whitespace-nowrap flex items-center gap-1.5",
                                                        hasClaimedCheckInToday
                                                            ? "bg-emerald-950/60 text-emerald-400 border border-emerald-500/30 shadow-none cursor-not-allowed"
                                                            : "bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-300 hover:to-rose-300 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)] active:scale-95 cursor-pointer"
                                                    )}
                                                >
                                                    {isCheckingIn ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : hasClaimedCheckInToday ? (
                                                        <>
                                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                                            <span>今日已簽到</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Sparkles className="w-3.5 h-3.5 shrink-0" />
                                                            <span>立即簽到</span>
                                                        </>
                                                    )}
                                                </Button>
                                            )}
                                        </div>

                                        {user && (
                                            <div className="flex items-center justify-between pt-2 border-t border-white/5 text-[11px] text-slate-400">
                                                <span className="flex items-center gap-1">
                                                    <span className={cn("w-1.5 h-1.5 rounded-full inline-block", hasClaimedCheckInToday ? "bg-emerald-400" : "bg-amber-400 animate-ping")} />
                                                    {hasClaimedCheckInToday ? '今日獎勵已入帳，明日 00:00 重置' : '今日尚未簽到，點擊立即領取獎勵'}
                                                </span>
                                                <span className="font-mono text-amber-300/90 font-bold">
                                                    目前紅利：{(userProfile?.bonusPoints ?? 0).toLocaleString()} 點
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* 新手首抽福利卡片 */}
                                    <div className="p-3 sm:p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-2.5">
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-xs font-bold text-white whitespace-nowrap">新手首抽禮</span>
                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                                                    免費 1 次
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 leading-tight">
                                                所有會員皆可直接領取開幕首抽福利
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            disabled={isStarterClaimed}
                                            onClick={handleOneClickLoginClaim}
                                            className={cn(
                                                "h-8 px-3 rounded-lg text-xs font-bold shrink-0 transition-colors whitespace-nowrap",
                                                isStarterClaimed
                                                    ? "bg-slate-800 text-slate-500 border border-slate-700/50"
                                                    : "bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm"
                                            )}
                                        >
                                            {isStarterClaimed ? '已領取' : '立即領取'}
                                        </Button>
                                    </div>

                                    {/* 加入社群首抽福利卡片 */}
                                    <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-slate-900/90 to-indigo-950/40 border border-blue-500/30 flex items-center justify-between gap-2.5">
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="text-xs font-bold text-white flex items-center gap-1 whitespace-nowrap">
                                                    <Users className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                                                    <span>官方社群禮</span>
                                                </span>
                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30 whitespace-nowrap">
                                                    免費 1 次
                                                </span>
                                            </div>
                                            <p className="text-[11px] text-slate-400 leading-tight">
                                                加入官方卡友交流群，立即加碼送抽卡券
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            disabled={isCommunityClaimed || isClaimingCommunity}
                                            onClick={handleClaimCommunityReward}
                                            className={cn(
                                                "h-8 px-2.5 sm:px-3 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1 whitespace-nowrap",
                                                isCommunityClaimed
                                                    ? "bg-slate-800 text-slate-500 border border-slate-700/50 cursor-not-allowed"
                                                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)] cursor-pointer active:scale-95"
                                            )}
                                        >
                                            {isClaimingCommunity ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : isCommunityClaimed ? '已領取' : (
                                                <>
                                                    <span className="hidden xs:inline">加入領取</span>
                                                    <span className="xs:hidden">領取</span>
                                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* 代碼輸入 */}
                                <div className="space-y-1.5">
                                    <Label className="text-xs font-medium text-slate-300">
                                        輸入兌換碼
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="請輸入代碼 (如 OPEN2024)"
                                            value={inputCode}
                                            onChange={(e) => setInputCode(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                                            className="h-10 bg-slate-900 border-slate-800 text-white font-mono uppercase tracking-wider text-xs sm:text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-slate-400 flex-1 min-w-0"
                                        />
                                        <Button
                                            onClick={() => handleRedeem()}
                                            className="h-10 px-4 sm:px-5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs shrink-0 whitespace-nowrap active:scale-95 transition-transform"
                                        >
                                            兌換
                                        </Button>
                                    </div>
                                </div>

                                {/* 官方可用代碼提示 (可選) */}
                                {showPromoCodeHints && (
                                    <div className="pt-2 border-t border-slate-800/60 space-y-2">
                                        <span className="text-[11px] text-slate-400">
                                            可用代碼快捷填入：
                                        </span>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {OFFICIAL_PROMO_CODES.map((item) => {
                                                const isClaimed = claimedHistory.some(c => c.code === item.code);
                                                return (
                                                    <div
                                                        key={item.code}
                                                        onClick={() => !isClaimed && handleRedeem(item.code)}
                                                        className={cn(
                                                            "p-2.5 rounded-lg border text-left transition-colors flex items-center justify-between gap-2",
                                                            isClaimed
                                                                ? "bg-slate-900/30 border-slate-800/40 opacity-50 cursor-not-allowed"
                                                                : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850 cursor-pointer"
                                                        )}
                                                    >
                                                        <div className="min-w-0 flex-1 pr-1">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="font-mono text-xs font-bold text-slate-200">{item.code}</span>
                                                                <span className="text-[10px] text-slate-400">({item.freePlays}次)</span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-400 truncate">{item.label}</p>
                                                        </div>
                                                        <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                                                            {isClaimed ? '已領' : '填入'}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 2. 領取紀錄 */}
                        {selectedTab === 'history' && (
                            <div className="space-y-2.5">
                                {claimedHistory.length === 0 ? (
                                    <div className="py-10 text-center text-slate-500 space-y-1.5">
                                        <Ticket className="w-8 h-8 mx-auto text-slate-600 stroke-[1.5]" />
                                        <p className="text-xs">尚無已領取之票券</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {claimedHistory.map((item) => (
                                            <div
                                                key={item.id}
                                                className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-2.5 text-xs"
                                            >
                                                <div className="space-y-0.5 min-w-0 flex-1">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-white shrink-0">{item.code}</span>
                                                        <span className="text-slate-400 truncate">{item.label}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-1.5">
                                                        <Clock className="w-3 h-3 shrink-0" />
                                                        <span>{item.claimedAt}</span>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold text-emerald-400 shrink-0 whitespace-nowrap">
                                                    +{item.freePlays} 次
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. 現場/社群專區 */}
                        {selectedTab === 'poster' && (
                            <div className="space-y-3">
                                <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-3 text-center">
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-bold text-white">現場活動兌換專區</h4>
                                        <p className="text-xs text-slate-400">
                                            出示代碼或於現場直接輸入領取
                                        </p>
                                    </div>
                                    <div className="p-2.5 sm:p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs max-w-xs mx-auto gap-2">
                                        <span className="text-slate-400 whitespace-nowrap">預設代碼：</span>
                                        <span className="font-mono font-bold text-amber-400 truncate">OPEN2024</span>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                navigator.clipboard.writeText('OPEN2024');
                                                toast({ title: '已複製代碼 OPEN2024' });
                                            }}
                                            className="text-slate-300 hover:text-white p-1 rounded hover:bg-slate-800 shrink-0"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* 社群快捷專區 */}
                                <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-br from-blue-950/40 via-slate-900/80 to-slate-900/60 border border-blue-500/30 flex items-center justify-between gap-2.5">
                                    <div className="space-y-0.5 text-left min-w-0 flex-1">
                                        <div className="flex items-center gap-1.5">
                                            <Users className="w-4 h-4 text-blue-400 shrink-0" />
                                            <h5 className="text-xs font-bold text-white">官方卡友社群</h5>
                                        </div>
                                        <p className="text-[11px] text-slate-400 leading-tight">
                                            加入交流群即送首抽，獲取第一手好康
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleClaimCommunityReward}
                                        disabled={isCommunityClaimed || isClaimingCommunity}
                                        className={cn(
                                            "h-8 px-2.5 sm:px-3 text-xs font-bold shrink-0 whitespace-nowrap",
                                            isCommunityClaimed
                                                ? "bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed"
                                                : "bg-blue-600 hover:bg-blue-500 text-white shadow-md cursor-pointer active:scale-95"
                                        )}
                                    >
                                        {isClaimingCommunity ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                        ) : isCommunityClaimed ? '已領取' : '立即加入 ➜'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="p-3 sm:p-4 border-t border-slate-800/80 shrink-0 bg-[#0c101a] !flex-row flex-row items-center justify-between">
                        <span className="text-[11px] text-slate-500">每個代碼限領取乙次</span>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="text-xs text-slate-400 hover:text-white h-8 px-3 rounded-lg"
                        >
                            關閉
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* 極簡兌換成功彈窗 */}
            <Dialog open={isSuccessDialogOpen} onOpenChange={setIsSuccessDialogOpen}>
                <DialogContent className="w-[calc(100vw-32px)] sm:w-full sm:max-w-sm bg-[#0c101a] border border-slate-800 rounded-2xl p-6 text-center text-slate-100 shadow-2xl">
                    <div className="w-12 h-12 mx-auto rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
                        <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <DialogTitle className="text-base font-bold text-white">
                        兌換成功
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-400 mt-1">
                        已成功為您增加免費體驗次數
                    </DialogDescription>

                    {lastClaimedReward && (
                        <div className="p-3 my-4 rounded-xl bg-slate-900 border border-slate-800 space-y-1 text-left">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-white">{lastClaimedReward.label}</span>
                                <span className="text-xs font-bold text-amber-400">+{lastClaimedReward.freePlays} 次</span>
                            </div>
                            <span className="text-[11px] text-slate-400 font-mono">代碼：{lastClaimedReward.code}</span>
                        </div>
                    )}

                    <DialogFooter className="sm:justify-center">
                        <Button
                            onClick={() => {
                                setIsSuccessDialogOpen(false);
                                onOpenChange(false);
                            }}
                            className="w-full h-10 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs"
                        >
                            確定
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
