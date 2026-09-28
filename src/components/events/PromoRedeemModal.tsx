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
    Calendar,
    ChevronRight,
    Share2,
    Check,
    Trophy,
    HeartHandshake,
    UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, limit, runTransaction, increment } from 'firebase/firestore';
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
    initialTab?: 'redeem' | 'referral' | 'history' | 'poster';
}

export function PromoRedeemModal({ open, onOpenChange, onApplyReward, initialTab }: PromoRedeemModalProps) {
    const { toast } = useToast();
    const { user } = useUser();
    const firestore = useFirestore();

    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
    const showPromoCodeHints = Boolean(systemConfig?.showPromoCodeHints || systemConfig?.featureFlags?.showPromoHints);

    const userDocRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userDocRef);

    const [inputCode, setInputCode] = useState('');
    const [selectedTab, setSelectedTab] = useState<'redeem' | 'referral' | 'history' | 'poster'>(initialTab || 'redeem');

    useEffect(() => {
        if (open && initialTab) {
            setSelectedTab(initialTab);
        }
    }, [open, initialTab]);
    const [claimedHistory, setClaimedHistory] = useState<ClaimHistoryItem[]>([]);
    const [isSuccessDialogOpen, setIsSuccessDialogOpen] = useState(false);
    const [lastClaimedReward, setLastClaimedReward] = useState<ClaimHistoryItem | null>(null);
    const [isClaimingCommunity, setIsClaimingCommunity] = useState(false);

    // 推薦系統獎勵配置與使用者推薦紀錄
    const referralConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'referral') : null, [firestore]);
    const { data: referralConfig } = useDoc<any>(referralConfigRef);
    const bonusForReferrer = referralConfig?.referrerBonusPoints ?? 100;
    const bonusForReferee = referralConfig?.refereeBonusPoints ?? 50;
    const ticketsForReferee = referralConfig?.freeDrawTickets ?? 1;

    // 查詢我的成功推薦名單 (referralLogs) - 避免 Firestore composite index 要求
    const logsQuery = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collection(firestore, 'referralLogs'),
            where('referrerId', '==', user.uid),
            limit(50)
        );
    }, [firestore, user?.uid]);
    const { data: rawReferralLogs, isLoading: isLoadingLogs } = useCollection<any>(logsQuery);

    const myReferralLogs = useMemo(() => {
        if (!rawReferralLogs) return [];
        return [...rawReferralLogs].sort((a, b) => {
            const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (new Date(a.createdAt || 0).getTime() || 0);
            const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (new Date(b.createdAt || 0).getTime() || 0);
            return timeB - timeA;
        });
    }, [rawReferralLogs]);

    // 推薦碼狀態
    const [copiedReferralCode, setCopiedReferralCode] = useState(false);
    const [copiedReferralLink, setCopiedReferralLink] = useState(false);
    const [isGeneratingReferralCode, setIsGeneratingReferralCode] = useState(false);
    const [customReferralInput, setCustomReferralInput] = useState('');
    const [isSavingCustomReferral, setIsSavingCustomReferral] = useState(false);
    const [showCustomReferralInput, setShowCustomReferralInput] = useState(false);
    const [friendReferralInput, setFriendReferralInput] = useState('');
    const [isApplyingReferral, setIsApplyingReferral] = useState(false);

    const currentInviteCode = userProfile?.inviteCode || '';

    // 生成完整邀請連結
    const inviteLink = useMemo(() => {
        if (typeof window === 'undefined') return '';
        const origin = window.location.origin;
        if (!currentInviteCode) return `${origin}/login`;
        return `${origin}/login?ref=${encodeURIComponent(currentInviteCode)}`;
    }, [currentInviteCode]);

    // 一鍵啟用 / 自訂專屬推薦碼
    const handleGenerateReferralCode = async (customCodeToSet?: string) => {
        if (!user) {
            toast({
                title: '請先登入會員',
                description: '登入後即可免費啟用個人專屬推薦碼！',
                variant: 'destructive',
            });
            return;
        }
        setIsGeneratingReferralCode(true);
        try {
            const res = await fetch('/api/referral/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    customCode: customCodeToSet || undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                confetti({ particleCount: 50, spread: 60, origin: { y: 0.6 } });
                toast({
                    title: '🎉 專屬推薦碼已啟用！',
                    description: `您的專屬推薦碼為：${data.inviteCode}，分享好友註冊立享點數與抽卡券！`,
                });
                setShowCustomReferralInput(false);
                setCustomReferralInput('');
            } else {
                toast({
                    variant: 'destructive',
                    title: '啟用失敗',
                    description: data.error || '無法生成推薦碼',
                });
            }
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: '網路錯誤',
                description: e.message || '請稍候再試',
            });
        } finally {
            setIsGeneratingReferralCode(false);
            setIsSavingCustomReferral(false);
        }
    };

    // 複製推薦碼
    const handleCopyReferralCode = () => {
        if (!currentInviteCode) return;
        navigator.clipboard.writeText(currentInviteCode);
        setCopiedReferralCode(true);
        toast({ title: '已複製推薦碼', description: currentInviteCode });
        setTimeout(() => setCopiedReferralCode(false), 2000);
    };

    // 複製推薦連結
    const handleCopyReferralLink = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink);
        setCopiedReferralLink(true);
        toast({ title: '已複製專屬推薦連結', description: '傳送給好友即可自動套用優惠代碼！' });
        setTimeout(() => setCopiedReferralLink(false), 2000);
    };

    // 綁定好友推薦碼
    const handleApplyFriendReferral = async (codeToApply?: string): Promise<boolean> => {
        const code = (codeToApply || friendReferralInput).trim().toUpperCase();
        if (!code) {
            toast({ title: '請輸入好友推薦碼', description: '請輸入好友提供的 4-12 位推薦代碼。', variant: 'destructive' });
            return false;
        }
        if (!user) {
            toast({ title: '請先登入會員', description: '登入會員後即可綁定推薦碼並領取迎新加碼禮！', variant: 'destructive' });
            return false;
        }
        if (userProfile?.referredBy) {
            toast({ title: '已綁定過推薦人', description: `您已綁定過推薦碼：${userProfile.referredBy}` });
            return false;
        }

        setIsApplyingReferral(true);
        try {
            const res = await fetch('/api/referral/apply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user.uid,
                    referralCode: code,
                }),
            });
            const data = await res.json();
            if (data.success) {
                confetti({ particleCount: 70, spread: 80, origin: { y: 0.6 } });
                toast({
                    title: '🎉 推薦碼綁定成功！',
                    description: data.message || `恭喜獲得 +${bonusForReferee} 紅利 P+ 及 ${ticketsForReferee} 張免費抽卡券！`,
                });
                setFriendReferralInput('');

                const newClaimItem: ClaimHistoryItem = {
                    id: 'claim-referral-' + Date.now(),
                    code: code,
                    label: '好友推薦禮・新人迎新加碼',
                    targetEvent: 'all',
                    freePlays: ticketsForReferee,
                    claimedAt: new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    status: 'ACTIVE'
                };
                const updatedHistory = [newClaimItem, ...claimedHistory];
                saveClaimHistory(updatedHistory);
                setLastClaimedReward(newClaimItem);
                setIsSuccessDialogOpen(true);

                if (onApplyReward) {
                    onApplyReward('all', ticketsForReferee);
                }
                return true;
            } else {
                toast({
                    variant: 'destructive',
                    title: '推薦碼無效或失敗',
                    description: data.error || '無法綁定此推薦碼',
                });
                return false;
            }
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: '網路錯誤',
                description: e.message || '連線逾時，請稍後重試',
            });
            return false;
        } finally {
            setIsApplyingReferral(false);
        }
    };

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
    }, [user, firestore, hasClaimedCheckInToday, missionId, rewardPoints, refetchProgress, toast]);

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
            // 若非官方活動代碼，自動嘗試識別是否為好友會員推薦碼
            if (!userProfile?.referredBy) {
                const applied = await handleApplyFriendReferral(targetCode);
                if (applied) {
                    setInputCode('');
                    return;
                }
            } else {
                toast({
                    title: '代碼無效',
                    description: '請確認代碼是否輸入正確，或該活動已結束。',
                    variant: 'destructive'
                });
            }
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

    // 整合所有已領取項目（包含今日簽到、新手禮、社群禮及兌換碼）
    const allClaimedRecords = useMemo(() => {
        const records: Array<{
            id: string;
            type: 'checkin' | 'starter' | 'community' | 'code';
            title: string;
            subtitle: string;
            code?: string;
            rewardText: string;
            rewardType: 'points' | 'ticket';
            claimedAt: string;
            statusBadge: string;
        }> = [];

        // 1. 每日簽到 (若今日已簽到)
        if (hasClaimedCheckInToday) {
            records.push({
                id: 'claim-checkin-' + todayStr,
                type: 'checkin',
                title: '每日簽到福利',
                subtitle: '天天登入簽到，累積紅利點數',
                code: '每日簽到',
                rewardText: `+${rewardPoints} 紅利 P+ 點`,
                rewardType: 'points',
                claimedAt: '今日已完成 · 明日 00:00 重置',
                statusBadge: '已領取'
            });
        }

        // 2. 新手首抽禮
        if (isStarterClaimed) {
            const historyItem = claimedHistory.find(item => item.code === 'OPEN2024');
            records.push({
                id: 'claim-starter',
                type: 'starter',
                title: '新手首抽禮',
                subtitle: '所有會員皆可直接領取開幕首抽福利',
                code: 'OPEN2024',
                rewardText: '+1 次 免費抽卡券',
                rewardType: 'ticket',
                claimedAt: historyItem?.claimedAt || '已存入帳號',
                statusBadge: '已兌換'
            });
        }

        // 3. 官方社群禮
        if (isCommunityClaimed) {
            const historyItem = claimedHistory.find(item => item.code === 'COMMUNITY_JOIN');
            records.push({
                id: 'claim-community',
                type: 'community',
                title: '官方社群禮',
                subtitle: '加入官方卡友交流群加碼送抽卡券',
                code: 'COMMUNITY_JOIN',
                rewardText: '+1 次 免費抽卡券',
                rewardType: 'ticket',
                claimedAt: historyItem?.claimedAt || '已存入帳號',
                statusBadge: '已兌換'
            });
        }

        // 4. 好友推薦迎新禮 (若已綁定推薦人)
        if (userProfile?.referredBy) {
            records.push({
                id: 'claim-referral-bound',
                type: 'code',
                title: '好友推薦迎新禮',
                subtitle: `已綁定推薦人代碼：${userProfile.referredBy}`,
                code: userProfile.referredBy,
                rewardText: `+${bonusForReferee} P+ 及免費抽卡券`,
                rewardType: 'points',
                claimedAt: '已成功綁定發放',
                statusBadge: '已綁定'
            });
        }

        // 4. 其他兌換紀錄 (來自 local history 與 userProfile)
        claimedHistory.forEach(item => {
            if (item.code !== 'OPEN2024' && item.code !== 'COMMUNITY_JOIN') {
                records.push({
                    id: item.id || `claim-code-${item.code}`,
                    type: 'code',
                    title: item.label || item.code,
                    subtitle: `專屬活動代碼：${item.code}`,
                    code: item.code,
                    rewardText: `+${item.freePlays} 次 免費抽卡券`,
                    rewardType: 'ticket',
                    claimedAt: item.claimedAt || '已兌換',
                    statusBadge: '已兌換'
                });
            }
        });

        // 5. 若 userProfile.claimedPromoCodes 裡有但 claimedHistory 沒記錄的代碼
        if (userProfile?.claimedPromoCodes) {
            userProfile.claimedPromoCodes.forEach(code => {
                if (code !== 'OPEN2024' && code !== 'COMMUNITY_JOIN') {
                    const alreadyIn = records.some(r => r.code === code);
                    if (!alreadyIn) {
                        const matched = OFFICIAL_PROMO_CODES.find(p => p.code === code);
                        records.push({
                            id: `claim-profile-${code}`,
                            type: 'code',
                            title: matched?.label || code,
                            subtitle: `專屬活動代碼：${code}`,
                            code: code,
                            rewardText: `+${matched?.freePlays ?? 1} 次 免費抽卡券`,
                            rewardType: 'ticket',
                            claimedAt: '已兌換',
                            statusBadge: '已兌換'
                        });
                    }
                }
            });
        }

        return records;
    }, [hasClaimedCheckInToday, todayStr, rewardPoints, isStarterClaimed, isCommunityClaimed, claimedHistory, userProfile?.claimedPromoCodes, userProfile?.referredBy, bonusForReferee]);

    const showCheckInCard = !hasClaimedCheckInToday;
    const showStarterCard = !isStarterClaimed;
    const showCommunityCard = !isCommunityClaimed;
    const areAllRegularRewardsClaimed = !showCheckInCard && !showStarterCard && !showCommunityCard;

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
                        <div className="grid grid-cols-4 gap-1 mt-3 bg-slate-950/80 p-1 rounded-xl border border-slate-800/70">
                            <button
                                type="button"
                                onClick={() => setSelectedTab('redeem')}
                                className={cn(
                                    "py-1.5 px-0.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1",
                                    selectedTab === 'redeem'
                                        ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <CalendarCheck className="w-3.5 h-3.5 shrink-0 text-amber-400" />
                                <span className="truncate">簽到領券</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTab('referral')}
                                className={cn(
                                    "py-1.5 px-0.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1",
                                    selectedTab === 'referral'
                                        ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <Share2 className="w-3.5 h-3.5 shrink-0 text-cyan-400" />
                                <span className="truncate">會員推薦</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTab('history')}
                                className={cn(
                                    "py-1.5 px-0.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1",
                                    selectedTab === 'history'
                                        ? "bg-slate-800 text-white border border-slate-700 shadow-sm"
                                        : "text-slate-400 hover:text-slate-200"
                                )}
                            >
                                <Ticket className="w-3.5 h-3.5 shrink-0" />
                                <span className="truncate">領取紀錄</span>
                                {allClaimedRecords.length > 0 && (
                                    <span className="hidden xs:inline-block px-1.5 py-0.2 rounded-full bg-slate-700 text-[10px] text-slate-300 font-mono shrink-0">
                                        {allClaimedRecords.length}
                                    </span>
                                )}
                            </button>
                            <button
                                type="button"
                                onClick={() => setSelectedTab('poster')}
                                className={cn(
                                    "py-1.5 px-0.5 sm:px-2 rounded-lg text-[11px] sm:text-xs font-semibold transition-all flex items-center justify-center gap-1",
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
                                {/* 福利卡片列表 - 僅展示尚未領取的項目，已領取的自動移至「領取紀錄」 */}
                                {areAllRegularRewardsClaimed ? (
                                    <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900/90 to-slate-900/90 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-sm">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 shrink-0">
                                                <CheckCircle2 className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs sm:text-sm font-bold text-white flex items-center gap-1.5">
                                                    <span>常態福利皆已領取完畢</span>
                                                </p>
                                                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                                                    簽到與專屬禮已移至「領取紀錄」，明日 00:00 重置簽到
                                                </p>
                                            </div>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setSelectedTab('history')}
                                            className="h-8 px-2.5 sm:px-3 text-xs font-bold border-slate-700 bg-slate-800 text-amber-300 hover:text-amber-200 shrink-0 flex items-center gap-1 cursor-pointer"
                                        >
                                            <span>領取紀錄</span>
                                            <ChevronRight className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="space-y-2.5">
                                        {/* 🌟 每日簽到福利卡片 (若尚未簽到才顯示) */}
                                        {showCheckInCard && (
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
                                                            disabled={isCheckingIn}
                                                            onClick={handleCheckIn}
                                                            className="h-8 px-3 rounded-lg text-xs font-bold shrink-0 transition-all whitespace-nowrap flex items-center gap-1.5 bg-gradient-to-r from-amber-400 to-rose-400 hover:from-amber-300 hover:to-rose-300 text-slate-950 shadow-[0_0_12px_rgba(245,158,11,0.4)] active:scale-95 cursor-pointer"
                                                        >
                                                            {isCheckingIn ? (
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
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
                                                            <span className="w-1.5 h-1.5 rounded-full inline-block bg-amber-400 animate-ping" />
                                                            <span>今日尚未簽到，點擊立即領取獎勵</span>
                                                        </span>
                                                        <span className="font-mono text-amber-300/90 font-bold">
                                                            目前紅利：{(userProfile?.bonusPoints ?? 0).toLocaleString()} 點
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* 新手首抽福利卡片 (若尚未領取才顯示) */}
                                        {showStarterCard && (
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
                                                    onClick={handleOneClickLoginClaim}
                                                    className="h-8 px-3 rounded-lg text-xs font-bold shrink-0 transition-colors whitespace-nowrap bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm cursor-pointer active:scale-95"
                                                >
                                                    立即領取
                                                </Button>
                                            </div>
                                        )}

                                        {/* 加入社群首抽福利卡片 (若尚未領取才顯示) */}
                                        {showCommunityCard && (
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
                                                    disabled={isClaimingCommunity}
                                                    onClick={handleClaimCommunityReward}
                                                    className="h-8 px-2.5 sm:px-3 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1 whitespace-nowrap bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)] cursor-pointer active:scale-95"
                                                >
                                                    {isClaimingCommunity ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <>
                                                            <span className="hidden xs:inline">加入領取</span>
                                                            <span className="xs:hidden">領取</span>
                                                            <ExternalLink className="w-3 h-3 shrink-0" />
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        )}
                                        {/* 會員推薦好友加碼卡片 */}
                                        <div className="p-3 sm:p-3.5 rounded-xl bg-gradient-to-r from-violet-950/40 via-slate-900/90 to-cyan-950/40 border border-violet-500/30 flex items-center justify-between gap-2.5">
                                            <div className="space-y-1 min-w-0 flex-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-xs font-bold text-white flex items-center gap-1 whitespace-nowrap">
                                                        <Share2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                                        <span>會員好友推薦禮</span>
                                                    </span>
                                                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 whitespace-nowrap">
                                                        雙向加碼
                                                    </span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 leading-tight">
                                                    分享專屬推薦碼，好友註冊得免費首抽券，您得 +{bonusForReferrer} P+
                                                </p>
                                            </div>
                                            <Button
                                                size="sm"
                                                onClick={() => setSelectedTab('referral')}
                                                className="h-8 px-2.5 sm:px-3 rounded-lg text-xs font-bold shrink-0 transition-colors flex items-center gap-1 whitespace-nowrap bg-gradient-to-r from-violet-600 to-cyan-600 hover:from-violet-500 hover:to-cyan-500 text-white shadow-sm cursor-pointer active:scale-95"
                                            >
                                                <span>推薦專區</span>
                                                <ChevronRight className="w-3 h-3 shrink-0" />
                                            </Button>
                                        </div>
                                    </div>
                                )}

                                {/* 代碼輸入 */}
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <Label className="text-xs font-medium text-slate-300">
                                            輸入兌換碼 / 推薦碼
                                        </Label>
                                        <button
                                            type="button"
                                            onClick={() => setSelectedTab('referral')}
                                            className="text-[11px] text-cyan-400 hover:underline flex items-center gap-0.5"
                                        >
                                            <span>好友推薦碼專區</span>
                                            <ChevronRight className="w-3 h-3" />
                                        </button>
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="請輸入代碼或好友推薦碼 (如 OPEN2024)"
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

                        {/* 2. 會員推薦碼專區 */}
                        {selectedTab === 'referral' && (
                            <div className="space-y-4">
                                {/* 頂部推薦計畫說明橫幅 */}
                                <div className="relative overflow-hidden p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-violet-950/70 via-slate-900/90 to-cyan-950/50 border border-violet-500/30 shadow-md">
                                    <div className="space-y-1.5">
                                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-[11px] font-bold">
                                            <Sparkles className="w-3 h-3 text-violet-400" />
                                            <span>好友推廣分享計畫</span>
                                        </div>
                                        <h4 className="text-sm sm:text-base font-black text-white">
                                            邀請好友加入，雙方皆享豪華贈禮！
                                        </h4>
                                        <p className="text-xs text-slate-300 leading-relaxed">
                                            好友註冊即可獲得 <span className="text-amber-400 font-bold">+{bonusForReferee} 紅利 P+</span> 及 <span className="text-cyan-400 font-bold">{ticketsForReferee} 張免費抽卡券</span>；每成功推薦一位好友，您亦立得 <span className="text-amber-400 font-bold">+{bonusForReferrer} 紅利 P+</span>！
                                        </p>
                                    </div>

                                    {/* 推薦成效簡要統計 */}
                                    <div className="grid grid-cols-2 gap-2 pt-3 mt-3 border-t border-white/10">
                                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-center">
                                            <p className="text-[10px] text-slate-400 font-medium">已成功推薦</p>
                                            <p className="text-lg font-black font-mono text-cyan-400">
                                                {userProfile?.inviteCount || 0} <span className="text-[10px] text-slate-400 font-normal">人</span>
                                            </p>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-black/40 border border-white/5 text-center">
                                            <p className="text-[10px] text-slate-400 font-medium">累計推薦紅利</p>
                                            <p className="text-lg font-black font-mono text-amber-400">
                                                {((userProfile?.inviteCount || 0) * bonusForReferrer).toLocaleString()} <span className="text-[10px] text-slate-400 font-normal">P+</span>
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* 專屬推薦碼管理卡片 */}
                                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                                            <Gift className="w-4 h-4 text-amber-400" />
                                            <span>我的專屬推薦碼</span>
                                        </div>
                                        {currentInviteCode && !showCustomReferralInput && (
                                            <button
                                                type="button"
                                                onClick={() => setShowCustomReferralInput(true)}
                                                className="text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors"
                                            >
                                                自訂好記代碼
                                            </button>
                                        )}
                                    </div>

                                    {!user ? (
                                        <div className="p-4 text-center space-y-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
                                            <p className="text-xs text-slate-400">登入會員即可啟用您的專屬推薦碼與推廣網址</p>
                                            <Button size="sm" asChild className="h-8 px-4 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950">
                                                <Link href="/login">前往登入</Link>
                                            </Button>
                                        </div>
                                    ) : currentInviteCode ? (
                                        <div className="space-y-2.5">
                                            <div className="p-3 sm:p-3.5 rounded-xl bg-slate-950 border border-amber-500/30 flex items-center justify-between shadow-inner gap-2">
                                                <div className="min-w-0">
                                                    <span className="text-[9px] text-slate-500 uppercase font-mono tracking-wider block">REFERRAL CODE</span>
                                                    <span className="text-xl sm:text-2xl font-black font-mono tracking-wider text-amber-400 truncate block">
                                                        {currentInviteCode}
                                                    </span>
                                                </div>
                                                <Button
                                                    size="sm"
                                                    onClick={handleCopyReferralCode}
                                                    className={cn(
                                                        "h-8 px-3 text-xs font-bold shrink-0 transition-all",
                                                        copiedReferralCode ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-amber-400 hover:bg-amber-300 text-slate-950"
                                                    )}
                                                >
                                                    {copiedReferralCode ? (
                                                        <>
                                                            <Check className="w-3.5 h-3.5 mr-1" /> 已複製
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3.5 h-3.5 mr-1" /> 複製代碼
                                                        </>
                                                    )}
                                                </Button>
                                            </div>

                                            {showCustomReferralInput && (
                                                <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-2 animate-in fade-in duration-200">
                                                    <label className="text-[11px] font-bold text-slate-300 block">自訂個人推薦碼 (4-12 位英數字)</label>
                                                    <div className="flex gap-2">
                                                        <Input
                                                            value={customReferralInput}
                                                            onChange={e => setCustomReferralInput(e.target.value.toUpperCase())}
                                                            placeholder="如：VIPCARD88"
                                                            className="h-8 bg-black/50 border-white/10 font-mono text-white text-xs uppercase"
                                                            maxLength={12}
                                                        />
                                                        <Button
                                                            size="sm"
                                                            onClick={() => handleGenerateReferralCode(customReferralInput)}
                                                            disabled={isSavingCustomReferral || customReferralInput.length < 4}
                                                            className="h-8 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                                                        >
                                                            {isSavingCustomReferral ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '儲存'}
                                                        </Button>
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => setShowCustomReferralInput(false)}
                                                            className="h-8 px-2 text-xs text-slate-400 hover:text-white"
                                                        >
                                                            取消
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* 一鍵專屬推薦網址 */}
                                            <div className="space-y-1 pt-1">
                                                <label className="text-[11px] text-slate-400 block font-medium">專屬好友邀請連結（點擊自動帶入推薦碼）</label>
                                                <div className="flex items-center gap-1.5">
                                                    <Input
                                                        readOnly
                                                        value={inviteLink}
                                                        className="h-8 bg-slate-950 border-slate-800 text-cyan-300 font-mono text-xs select-all truncate"
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={handleCopyReferralLink}
                                                        className={cn(
                                                            "h-8 px-3 text-xs font-bold shrink-0 transition-all",
                                                            copiedReferralLink ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                                                        )}
                                                    >
                                                        {copiedReferralLink ? <Check className="w-3.5 h-3.5 mr-1" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
                                                        {copiedReferralLink ? '已複製' : '複製連結'}
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center py-4 space-y-2 bg-slate-950/60 rounded-xl border border-slate-800/80">
                                            <p className="text-xs text-slate-300">您尚未啟用專屬會員推薦碼</p>
                                            <Button
                                                size="sm"
                                                onClick={() => handleGenerateReferralCode()}
                                                disabled={isGeneratingReferralCode}
                                                className="h-9 px-5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-md cursor-pointer hover:scale-105 active:scale-95 transition-all"
                                            >
                                                {isGeneratingReferralCode ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                                                立即免費啟用推薦碼
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                {/* 綁定好友推薦碼卡片 */}
                                <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                                            <UserPlus className="w-4 h-4 text-emerald-400" />
                                            <span>綁定好友推薦碼（迎新加碼禮）</span>
                                        </div>
                                        {userProfile?.referredBy && (
                                            <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                                                已完成綁定
                                            </Badge>
                                        )}
                                    </div>

                                    {userProfile?.referredBy ? (
                                        <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 flex items-center justify-between text-xs text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                                                <span>已綁定好友推薦碼：<strong className="font-mono text-emerald-300">{userProfile.referredBy}</strong></span>
                                            </div>
                                            <span className="text-[11px] text-slate-400">迎新禮已入帳</span>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            <p className="text-[11px] text-slate-400">
                                                輸入好友提供的專屬推薦碼，立即額外獲得 +{bonusForReferee} 紅利 P+ 及 {ticketsForReferee} 張免費抽卡券！
                                            </p>
                                            <div className="flex gap-2">
                                                <Input
                                                    placeholder="輸入好友推薦碼 (4-12 碼)"
                                                    value={friendReferralInput}
                                                    onChange={e => setFriendReferralInput(e.target.value.toUpperCase())}
                                                    onKeyDown={e => e.key === 'Enter' && handleApplyFriendReferral()}
                                                    className="h-9 bg-slate-950 border-slate-800 text-white font-mono uppercase text-xs rounded-xl"
                                                />
                                                <Button
                                                    size="sm"
                                                    disabled={isApplyingReferral || !friendReferralInput.trim()}
                                                    onClick={() => handleApplyFriendReferral()}
                                                    className="h-9 px-4 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-slate-950 shrink-0 cursor-pointer active:scale-95"
                                                >
                                                    {isApplyingReferral ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '確認綁定'}
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 推薦好友名單明細 */}
                                {user && (
                                    <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-white flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5 text-cyan-400" />
                                                <span>我推薦的好友 ({myReferralLogs?.length || 0} 位)</span>
                                            </span>
                                            <span className="text-[11px] text-slate-400">最新推薦明細</span>
                                        </div>

                                        {isLoadingLogs ? (
                                            <div className="py-4 text-center text-xs text-slate-500">
                                                <Loader2 className="w-4 h-4 animate-spin mx-auto mb-1 text-cyan-400" />
                                                載入推薦紀錄中...
                                            </div>
                                        ) : myReferralLogs && myReferralLogs.length > 0 ? (
                                            <div className="space-y-1.5 max-h-36 overflow-y-auto">
                                                {myReferralLogs.map((log: any) => (
                                                    <div key={log.id} className="p-2 rounded-lg bg-slate-950/80 border border-white/5 flex items-center justify-between text-xs">
                                                        <div className="flex items-center gap-2 min-w-0">
                                                            <div className="w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[10px] font-bold flex items-center justify-center shrink-0">
                                                                {(log.newUserName || '友').charAt(0)}
                                                            </div>
                                                            <span className="font-bold text-white truncate text-[11px]">{log.newUserName || '新會員'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[9px] font-mono">
                                                                +{log.referrerBonusGiven || bonusForReferrer} P+
                                                            </Badge>
                                                            <span className="text-[10px] text-slate-500 font-mono">
                                                                {log.createdAt?.seconds 
                                                                    ? format(new Date(log.createdAt.seconds * 1000), 'MM/dd')
                                                                    : '剛剛'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <p className="text-center py-3 text-[11px] text-slate-500">
                                                尚未有好友透過您的代碼註冊，快複製推薦碼邀請好友吧！
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 3. 領取紀錄 */}
                        {selectedTab === 'history' && (
                            <div className="space-y-3">
                                {allClaimedRecords.length === 0 ? (
                                    <div className="py-12 text-center text-slate-500 space-y-2">
                                        <Ticket className="w-10 h-10 mx-auto text-slate-600 stroke-[1.5]" />
                                        <p className="text-xs font-medium">尚無已領取之福利或票券</p>
                                        <p className="text-[11px] text-slate-600">完成簽到或兌換活動代碼後將在此呈現</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        {allClaimedRecords.map((item) => (
                                            <div
                                                key={item.id}
                                                className="p-3 sm:p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 text-xs transition-colors hover:border-slate-700"
                                            >
                                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                                    <div className={cn(
                                                        "p-2 rounded-lg shrink-0",
                                                        item.type === 'checkin' ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" :
                                                        item.type === 'community' ? "bg-blue-500/15 text-blue-400 border border-blue-500/30" :
                                                        item.type === 'starter' ? "bg-rose-500/15 text-rose-400 border border-rose-500/30" :
                                                        "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                                    )}>
                                                        {item.type === 'checkin' ? <CalendarCheck className="w-4 h-4" /> :
                                                         item.type === 'community' ? <Users className="w-4 h-4" /> :
                                                         item.type === 'starter' ? <Sparkles className="w-4 h-4" /> :
                                                         <Ticket className="w-4 h-4" />}
                                                    </div>
                                                    <div className="space-y-0.5 min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 flex-wrap">
                                                            <span className="font-bold text-white text-xs truncate">{item.title}</span>
                                                            {item.code && (
                                                                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                                                                    {item.code}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                                                            <Clock className="w-3 h-3 text-slate-500 shrink-0" />
                                                            <span className="truncate">{item.claimedAt}</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="text-right shrink-0">
                                                    <span className={cn(
                                                        "text-xs font-bold font-mono px-2 py-0.5 rounded-md inline-block",
                                                        item.rewardType === 'points' 
                                                            ? "bg-amber-500/15 text-amber-300 border border-amber-500/30" 
                                                            : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                                                    )}>
                                                        {item.rewardText}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 帳戶當前資產總覽小卡 */}
                                {user && allClaimedRecords.length > 0 && (
                                    <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs text-slate-400 mt-2">
                                        <div className="flex items-center gap-1.5">
                                            <Coins className="w-3.5 h-3.5 text-amber-400" />
                                            <span>累積紅利：<span className="font-mono font-bold text-amber-300">{(userProfile?.bonusPoints ?? 0).toLocaleString()}</span> 點</span>
                                        </div>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            asChild
                                            className="h-7 px-2.5 text-xs font-bold text-amber-400 hover:text-amber-300 hover:bg-slate-800"
                                        >
                                            <Link href="/draw" onClick={() => onOpenChange(false)}>
                                                <span>前往抽卡 ➜</span>
                                            </Link>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* 4. 現場活動專區 */}
                        {selectedTab === 'poster' && (
                            <div className="space-y-4">
                                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-br from-amber-500/10 via-slate-900/90 to-slate-900 border border-amber-500/30 space-y-4 text-center">
                                    <div className="space-y-1.5">
                                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
                                            <QrCode className="w-3.5 h-3.5 text-amber-400" />
                                            <span>展會活動專屬代碼</span>
                                        </span>
                                        <h4 className="text-sm sm:text-base font-bold text-white pt-1">現場活動兌換專區</h4>
                                        <p className="text-xs text-slate-400">
                                            出示專屬代碼或直接於現場一鍵帶入領取開幕首抽禮
                                        </p>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 flex flex-col sm:flex-row items-center justify-between text-xs max-w-sm mx-auto gap-3 shadow-inner">
                                        <div className="text-center sm:text-left min-w-0">
                                            <span className="text-[10px] text-slate-500 block uppercase font-mono">Event Promo Code</span>
                                            <span className="font-mono font-black text-base sm:text-lg text-amber-400 tracking-wider">OPEN2024</span>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-center">
                                            <Button
                                                type="button"
                                                size="sm"
                                                variant="outline"
                                                onClick={() => {
                                                    navigator.clipboard.writeText('OPEN2024');
                                                    toast({ title: '已複製代碼 OPEN2024', description: '可前往兌換區貼上領取首抽禮' });
                                                }}
                                                className="h-8 px-2.5 text-xs font-bold border-slate-700 bg-slate-900 text-slate-200 hover:text-white"
                                            >
                                                <Copy className="w-3.5 h-3.5 mr-1" />
                                                <span>複製</span>
                                            </Button>
                                            <Button
                                                type="button"
                                                size="sm"
                                                onClick={() => {
                                                    setInputCode('OPEN2024');
                                                    setSelectedTab('redeem');
                                                }}
                                                className="h-8 px-3 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-sm cursor-pointer active:scale-95"
                                            >
                                                <span>帶入代碼前往兌換 ➜</span>
                                            </Button>
                                        </div>
                                    </div>
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
