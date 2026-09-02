'use client';

import React, { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
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
    ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { SystemConfig } from '@/types/system';
import { UserProfile } from '@/types/user-profile';
import { claimCommunityFreeDraw } from '@/lib/promo-draw-service';

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
    const { user } = useAuth();
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

    // 載入本地兌換歷史
    useEffect(() => {
        try {
            const saved = localStorage.getItem('card_exhibition_promo_claims');
            if (saved) {
                setClaimedHistory(JSON.parse(saved));
            }
        } catch (e) {
            console.error('Failed to load claim history', e);
        }
    }, []);

    // 儲存兌換紀錄
    const saveClaimHistory = (newHistory: ClaimHistoryItem[]) => {
        setClaimedHistory(newHistory);
        try {
            localStorage.setItem('card_exhibition_promo_claims', JSON.stringify(newHistory));
        } catch (e) {
            console.error('Failed to save claim history', e);
        }
    };

    // 執行兌換碼兌換
    const handleRedeem = (codeToRedeem?: string) => {
        const targetCode = (codeToRedeem || inputCode).trim().toUpperCase();

        if (!targetCode) {
            toast({
                title: '請輸入兌換碼',
                description: '請輸入活動或社群取得之專屬代碼。',
                variant: 'destructive'
            });
            return;
        }

        // 檢查是否已兌換過
        const isAlreadyClaimed = claimedHistory.some(item => item.code.toUpperCase() === targetCode);
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
                description: '請確認代碼是否輸入正確。',
                variant: 'destructive'
            });
            return;
        }

        const newClaimItem: ClaimHistoryItem = {
            id: 'claim-' + Date.now(),
            code: matched.code,
            label: matched.label,
            targetEvent: matched.targetEvent,
            freePlays: matched.freePlays,
            claimedAt: new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
            status: 'ACTIVE'
        };

        const updatedHistory = [newClaimItem, ...claimedHistory];
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
            onApplyReward(matched.targetEvent, matched.freePlays);
        }
    };

    const handleOneClickLoginClaim = () => {
        handleRedeem('OPEN2024');
    };

    const handleClaimCommunityReward = async () => {
        const targetUrl = systemConfig?.communityUrl || 'https://line.me/ti/g2/';
        window.open(targetUrl, '_blank', 'noopener,noreferrer');

        if (!user || !firestore) {
            toast({
                title: '歡迎加入官方社群！',
                description: '登入會員後點擊即可自動領取「免費首抽券 1 張」！'
            });
            return;
        }

        if (isClaimingCommunity) return;
        setIsClaimingCommunity(true);

        try {
            const res = await claimCommunityFreeDraw(firestore, user.uid, '官方社群');
            if (res.success && !res.alreadyClaimed) {
                const newClaimItem: ClaimHistoryItem = {
                    id: 'claim-community-' + Date.now(),
                    code: 'COMMUNITY_JOIN',
                    label: '官方社群專屬・免費首抽',
                    targetEvent: 'all',
                    freePlays: 1,
                    claimedAt: new Date().toLocaleDateString('zh-TW', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }),
                    status: 'ACTIVE'
                };
                const updatedHistory = [newClaimItem, ...claimedHistory];
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
            } else if (res.alreadyClaimed) {
                toast({
                    title: '您已領取過社群首抽券',
                    description: '歡迎前往社群與卡友交流分享戰績！'
                });
            }
        } catch (err: any) {
            console.error('Error claiming community reward:', err);
        } finally {
            setIsClaimingCommunity(false);
        }
    };

    const isStarterClaimed = claimedHistory.some(item => item.code === 'OPEN2024');
    const isCommunityClaimed = Boolean(
        userProfile?.claimedCommunityTicket || 
        userProfile?.claimedPromoCodes?.includes('COMMUNITY_JOIN') ||
        claimedHistory.some(item => item.code === 'COMMUNITY_JOIN')
    );

    return (
        <>
            <Dialog open={open} onOpenChange={onOpenChange}>
                <DialogContent className="sm:max-w-lg bg-[#0c101a] border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-2xl text-slate-100">
                    <DialogHeader className="pb-3 border-b border-slate-800/80">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1 text-left">
                                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                                    <Gift className="w-4 h-4 text-amber-400" />
                                    <span>兌換代碼與福利</span>
                                </DialogTitle>
                                <DialogDescription className="text-xs text-slate-400">
                                    輸入官方活動代碼或領取新手禮，獲得免費抽卡次數。
                                </DialogDescription>
                            </div>
                        </div>

                        {/* 極簡分頁導航 */}
                        <div className="flex items-center gap-1.5 pt-3">
                            <button
                                onClick={() => setSelectedTab('redeem')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5",
                                    selectedTab === 'redeem'
                                        ? "bg-slate-800 text-white border border-slate-700"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                                )}
                            >
                                <KeyRound className="w-3.5 h-3.5" /> 代碼兌換
                            </button>
                            <button
                                onClick={() => setSelectedTab('history')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5",
                                    selectedTab === 'history'
                                        ? "bg-slate-800 text-white border border-slate-700"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                                )}
                            >
                                <Ticket className="w-3.5 h-3.5" /> 領取紀錄
                                {claimedHistory.length > 0 && (
                                    <span className="ml-0.5 px-1.5 py-0.2 rounded-full bg-slate-700 text-[10px] text-slate-300 font-mono">
                                        {claimedHistory.length}
                                    </span>
                                )}
                            </button>
                            <button
                                onClick={() => setSelectedTab('poster')}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5",
                                    selectedTab === 'poster'
                                        ? "bg-slate-800 text-white border border-slate-700"
                                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/40"
                                )}
                            >
                                <QrCode className="w-3.5 h-3.5" /> 現場專區
                            </button>
                        </div>
                    </DialogHeader>

                    {/* 內容區塊 */}
                    <div className="py-3">
                        {/* 1. 兌換區 */}
                        {selectedTab === 'redeem' && (
                            <div className="space-y-4">
                                {/* 福利卡片列表 */}
                                <div className="space-y-2.5">
                                    {/* 新手首抽福利卡片 */}
                                    <div className="p-3.5 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3">
                                        <div className="space-y-0.5 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-white">新手首抽禮</span>
                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                                    免費 1 次
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 truncate">
                                                所有會員皆可直接領取開幕首抽福利
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            disabled={isStarterClaimed}
                                            onClick={handleOneClickLoginClaim}
                                            className={cn(
                                                "h-8 px-3.5 rounded-lg text-xs font-semibold shrink-0 transition-colors",
                                                isStarterClaimed
                                                    ? "bg-slate-800 text-slate-500 border border-slate-700/50"
                                                    : "bg-amber-400 hover:bg-amber-300 text-slate-950"
                                            )}
                                        >
                                            {isStarterClaimed ? '已領取' : '立即領取'}
                                        </Button>
                                    </div>

                                    {/* 加入社群首抽福利卡片 */}
                                    <div className="p-3.5 rounded-xl bg-gradient-to-r from-blue-950/40 via-slate-900/80 to-indigo-950/40 border border-blue-500/30 flex items-center justify-between gap-3">
                                        <div className="space-y-0.5 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                                                    <Users className="w-3.5 h-3.5 text-blue-400" />
                                                    <span>加入官方社群禮</span>
                                                </span>
                                                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                                    免費 1 次
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-400 truncate">
                                                點擊加入官方社群，立即加碼送免費抽卡券
                                            </p>
                                        </div>
                                        <Button
                                            size="sm"
                                            disabled={isCommunityClaimed}
                                            onClick={handleClaimCommunityReward}
                                            className={cn(
                                                "h-8 px-3.5 rounded-lg text-xs font-semibold shrink-0 transition-colors flex items-center gap-1",
                                                isCommunityClaimed
                                                    ? "bg-slate-800 text-slate-500 border border-slate-700/50"
                                                    : "bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                                            )}
                                        >
                                            {isCommunityClaimed ? '已領取' : (
                                                <>
                                                    <span>加入並領取</span>
                                                    <ExternalLink className="w-3 h-3 ml-0.5" />
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* 代碼輸入 */}
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-slate-300">
                                        輸入兌換碼
                                    </Label>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="請輸入兌換代碼 (如 OPEN2024)"
                                            value={inputCode}
                                            onChange={(e) => setInputCode(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                                            className="h-10 bg-slate-900 border-slate-800 text-white font-mono uppercase tracking-wider text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-slate-400"
                                        />
                                        <Button
                                            onClick={() => handleRedeem()}
                                            className="h-10 px-5 rounded-xl bg-slate-100 hover:bg-white text-slate-950 font-bold text-xs shrink-0"
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
                                                            "p-2.5 rounded-lg border text-left transition-colors flex items-center justify-between",
                                                            isClaimed
                                                                ? "bg-slate-900/30 border-slate-800/40 opacity-50 cursor-not-allowed"
                                                                : "bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-850 cursor-pointer"
                                                        )}
                                                    >
                                                        <div className="min-w-0 pr-2">
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
                                    <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                                        {claimedHistory.map((item) => (
                                            <div
                                                key={item.id}
                                                className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 flex items-center justify-between gap-3 text-xs"
                                            >
                                                <div className="space-y-0.5 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-mono font-bold text-white">{item.code}</span>
                                                        <span className="text-slate-400 truncate">{item.label}</span>
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                                        <Clock className="w-3 h-3" />
                                                        <span>{item.claimedAt}</span>
                                                    </div>
                                                </div>
                                                <span className="text-xs font-bold text-emerald-400 shrink-0">
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
                                    <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between text-xs max-w-xs mx-auto">
                                        <span className="text-slate-400">官方預設代碼：</span>
                                        <span className="font-mono font-bold text-amber-400">OPEN2024</span>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText('OPEN2024');
                                                toast({ title: '已複製代碼 OPEN2024' });
                                            }}
                                            className="text-slate-300 hover:text-white p-1 rounded hover:bg-slate-800"
                                        >
                                            <Copy className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>

                                {/* 社群快捷專區 */}
                                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-950/40 via-slate-900/80 to-slate-900/60 border border-blue-500/30 flex items-center justify-between gap-3">
                                    <div className="space-y-0.5 text-left min-w-0">
                                        <div className="flex items-center gap-1.5">
                                            <Users className="w-4 h-4 text-blue-400" />
                                            <h5 className="text-xs font-bold text-white">官方卡友社群</h5>
                                        </div>
                                        <p className="text-[11px] text-slate-400 truncate">
                                            加入交流群即送 1 次首抽，天天獲取專屬好康
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={handleClaimCommunityReward}
                                        disabled={isCommunityClaimed}
                                        className={cn(
                                            "h-8 px-3 text-xs font-bold shrink-0",
                                            isCommunityClaimed
                                                ? "bg-slate-800 text-slate-500 border border-slate-700"
                                                : "bg-blue-600 hover:bg-blue-500 text-white shadow-md"
                                        )}
                                    >
                                        {isCommunityClaimed ? '已領取' : '立即加入 ➜'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="pt-2 border-t border-slate-800/80 flex items-center justify-between sm:justify-between">
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
                <DialogContent className="sm:max-w-sm bg-[#0c101a] border border-slate-800 rounded-2xl p-6 text-center text-slate-100 shadow-2xl">
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
