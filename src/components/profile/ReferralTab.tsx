'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
    Users, 
    Gift, 
    Copy, 
    Check, 
    Sparkles, 
    Share2, 
    Loader2, 
    Trophy, 
    Coins, 
    Ticket, 
    ArrowRight, 
    QrCode,
    CheckCircle2
} from 'lucide-react';
import { useToast } from "@/hooks/use-toast";
import { useDoc, useFirestore, useMemoFirebase, useCollection } from "@/firebase";
import { doc, collection, query, where, orderBy, limit } from "firebase/firestore";
import type { UserProfile } from "@/types/user-profile";
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface ReferralTabProps {
    userProfile: UserProfile;
    userId: string;
}

export function ReferralTab({ userProfile, userId }: ReferralTabProps) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const [copiedCode, setCopiedCode] = useState(false);
    const [copiedLink, setCopiedLink] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [customInput, setCustomInput] = useState('');
    const [isSavingCustom, setIsSavingCustom] = useState(false);
    const [showCustomInput, setShowCustomInput] = useState(false);

    // 系統推薦獎勵設定
    const referralConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'referral') : null, [firestore]);
    const { data: referralConfig } = useDoc<any>(referralConfigRef);

    const bonusForReferrer = referralConfig?.referrerBonusPoints ?? 100;
    const bonusForReferee = referralConfig?.refereeBonusPoints ?? 50;
    const ticketsForReferee = referralConfig?.freeDrawTickets ?? 1;

    // 查詢我的成功邀請紀錄 (從 referralLogs 查)
    const logsQuery = useMemoFirebase(() => {
        if (!firestore || !userId) return null;
        return query(
            collection(firestore, 'referralLogs'),
            where('referrerId', '==', userId),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
    }, [firestore, userId]);
    const { data: myReferralLogs, isLoading: isLoadingLogs } = useCollection<any>(logsQuery);

    const currentInviteCode = userProfile.inviteCode || '';

    // 生成完整邀請連結
    const inviteLink = useMemo(() => {
        if (typeof window === 'undefined') return '';
        const origin = window.location.origin;
        if (!currentInviteCode) return `${origin}/login`;
        return `${origin}/login?ref=${encodeURIComponent(currentInviteCode)}`;
    }, [currentInviteCode]);

    // 一鍵生成專屬推薦碼
    const handleGenerateCode = async (customCodeToSet?: string) => {
        setIsGenerating(true);
        try {
            const res = await fetch('/api/referral/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    customCode: customCodeToSet || undefined,
                }),
            });
            const data = await res.json();
            if (data.success) {
                toast({
                    title: '推薦碼已就緒！',
                    description: `您的專屬推薦碼為：${data.inviteCode}，快分享給好友吧！`,
                });
                setShowCustomInput(false);
                setCustomInput('');
            } else {
                toast({
                    variant: 'destructive',
                    title: '設定失敗',
                    description: data.error || '無法生成推薦碼',
                });
            }
        } catch (e: any) {
            toast({
                variant: 'destructive',
                title: '網路錯誤',
                description: e.message,
            });
        } finally {
            setIsGenerating(false);
            setIsSavingCustom(false);
        }
    };

    const handleCopyCode = () => {
        if (!currentInviteCode) return;
        navigator.clipboard.writeText(currentInviteCode);
        setCopiedCode(true);
        toast({ title: '已複製推薦碼', description: currentInviteCode });
        setTimeout(() => setCopiedCode(false), 2000);
    };

    const handleCopyLink = () => {
        if (!inviteLink) return;
        navigator.clipboard.writeText(inviteLink);
        setCopiedLink(true);
        toast({ title: '已複製專屬推薦連結', description: '傳送給好友即可自動套用優惠代碼！' });
        setTimeout(() => setCopiedLink(false), 2000);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-300">
            {/* 頂部推薦獎勵介紹橫幅 */}
            <div className="relative overflow-hidden p-6 sm:p-8 rounded-[2rem] bg-gradient-to-br from-violet-950/60 via-slate-900/90 to-cyan-950/40 border border-violet-500/30 shadow-[0_10px_35px_rgba(124,58,237,0.15)]">
                <div className="absolute top-0 right-0 w-80 h-80 bg-violet-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                    <div className="space-y-2 max-w-xl">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-violet-500/20 border border-violet-500/30 text-violet-300 text-xs font-bold">
                            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
                            <span>好友推廣分享計畫</span>
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black font-headline text-white tracking-tight">
                            邀請好友加入 P+Carder，雙方皆享豪華贈禮！
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                            分享您的專屬推薦碼或邀請連結給好友，好友完成註冊即可獲得 
                            <strong className="text-amber-400 mx-1">+{bonusForReferee} 紅利 P+</strong> 及 
                            <strong className="text-cyan-400 mx-1">{ticketsForReferee} 張免費抽卡券</strong>；
                            每成功推薦一位好友，您亦可立即獲得 
                            <strong className="text-amber-400 mx-1">+{bonusForReferrer} 紅利 P+</strong> 獎勵！
                        </p>
                    </div>

                    {/* 推薦成效數據 */}
                    <div className="grid grid-cols-2 gap-3 w-full md:w-auto shrink-0">
                        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center min-w-[120px]">
                            <p className="text-[11px] font-bold text-slate-400">已成功推薦</p>
                            <p className="text-2xl font-black font-code text-cyan-400 mt-1">
                                {userProfile.inviteCount || 0} <span className="text-xs text-slate-400">人</span>
                            </p>
                        </div>
                        <div className="p-4 rounded-2xl bg-black/40 border border-white/10 text-center min-w-[120px]">
                            <p className="text-[11px] font-bold text-slate-400">累計獲得紅利</p>
                            <p className="text-2xl font-black font-code text-amber-400 mt-1">
                                {((userProfile.inviteCount || 0) * bonusForReferrer).toLocaleString()} <span className="text-xs text-slate-400">P+</span>
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* 推薦工具箱：專屬代碼與連結 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 卡片 1: 專屬推薦碼 */}
                <Card className="border-white/10 bg-gradient-to-b from-[#13192a]/95 via-[#0c101d]/90 to-[#080b14]/95 backdrop-blur-xl rounded-[2rem] shadow-xl">
                    <CardHeader className="p-6 pb-4 border-b border-white/5">
                        <CardTitle className="text-base font-black text-white flex items-center gap-2">
                            <Gift className="w-5 h-5 text-amber-400" />
                            <span>我的專屬推薦碼</span>
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-xs">
                            好友在註冊頁面手動填入此代碼即可綁定
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        {currentInviteCode ? (
                            <div className="space-y-3">
                                <div className="p-4 rounded-2xl bg-slate-950/80 border border-amber-500/30 flex items-center justify-between shadow-[0_0_20px_rgba(245,158,11,0.1)]">
                                    <div className="space-y-0.5">
                                        <span className="text-[10px] text-slate-400 uppercase font-mono tracking-widest block">REFERRAL CODE</span>
                                        <span className="text-2xl sm:text-3xl font-black font-mono tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-300 drop-shadow">
                                            {currentInviteCode}
                                        </span>
                                    </div>
                                    <Button 
                                        size="sm"
                                        onClick={handleCopyCode} 
                                        className={cn(
                                            "h-10 px-4 rounded-xl font-bold text-xs transition-all shadow-md",
                                            copiedCode ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 hover:brightness-110"
                                        )}
                                    >
                                        {copiedCode ? (
                                            <>
                                                <Check className="w-4 h-4 mr-1.5" /> 已複製
                                            </>
                                        ) : (
                                            <>
                                                <Copy className="w-4 h-4 mr-1.5" /> 複製代碼
                                            </>
                                        )}
                                    </Button>
                                </div>

                                {!showCustomInput ? (
                                    <div className="text-right">
                                        <button 
                                            type="button" 
                                            onClick={() => setShowCustomInput(true)} 
                                            className="text-[11px] text-slate-400 hover:text-cyan-400 transition-colors"
                                        >
                                            想自訂好記的推薦碼？
                                        </button>
                                    </div>
                                ) : (
                                    <div className="p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                                        <label className="text-[11px] font-bold text-slate-300 block">自訂個人推薦碼 (4-12 位英數字)</label>
                                        <div className="flex gap-2">
                                            <Input 
                                                value={customInput} 
                                                onChange={e => setCustomInput(e.target.value.toUpperCase())}
                                                placeholder="例如：CARDKING88"
                                                className="h-9 bg-black/50 border-white/10 font-mono text-white text-xs uppercase"
                                                maxLength={12}
                                            />
                                            <Button 
                                                size="sm" 
                                                onClick={() => {
                                                    setIsSavingCustom(true);
                                                    handleGenerateCode(customInput);
                                                }}
                                                disabled={isSavingCustom || customInput.length < 4}
                                                className="h-9 px-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs"
                                            >
                                                {isSavingCustom ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : '確認更換'}
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                onClick={() => setShowCustomInput(false)}
                                                className="h-9 px-2 text-xs text-slate-400"
                                            >
                                                取消
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center py-6 space-y-3">
                                <p className="text-xs text-slate-300">您尚未生成個人專屬推薦碼</p>
                                <Button 
                                    onClick={() => handleGenerateCode()} 
                                    disabled={isGenerating}
                                    className="h-11 px-6 rounded-xl font-black text-xs bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 shadow-lg hover:scale-105 active:scale-95 transition-all"
                                >
                                    {isGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                                    立即免費啟用專屬推薦碼
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 卡片 2: 一鍵專屬推薦網址 */}
                <Card className="border-white/10 bg-gradient-to-b from-[#13192a]/95 via-[#0c101d]/90 to-[#080b14]/95 backdrop-blur-xl rounded-[2rem] shadow-xl">
                    <CardHeader className="p-6 pb-4 border-b border-white/5">
                        <CardTitle className="text-base font-black text-white flex items-center gap-2">
                            <Share2 className="w-5 h-5 text-cyan-400" />
                            <span>專屬一鍵推薦連結</span>
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-xs">
                            好友點擊此連結註冊將自動帶入您的推薦碼，最方便省心
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-[11px] font-bold text-slate-400 block">推廣分享網址</label>
                            <div className="flex items-center gap-2">
                                <Input 
                                    readOnly 
                                    value={inviteLink || '請先啟用推薦碼'} 
                                    className="h-10 bg-slate-950/80 border-white/10 text-cyan-300 font-mono text-xs select-all truncate"
                                />
                                <Button 
                                    onClick={handleCopyLink} 
                                    disabled={!currentInviteCode}
                                    className={cn(
                                        "h-10 px-4 rounded-xl font-bold text-xs shrink-0 transition-all",
                                        copiedLink ? "bg-emerald-500 hover:bg-emerald-600 text-white" : "bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                                    )}
                                >
                                    {copiedLink ? <Check className="w-4 h-4 mr-1" /> : <Copy className="w-4 h-4 mr-1" />}
                                    {copiedLink ? '已複製' : '複製連結'}
                                </Button>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-slate-300 text-xs flex items-start gap-2.5">
                            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                            <span>
                                支援社群、LINE、Discord 與各大卡牌論壇發布。好友點入即自動轉跳註冊並顯示已綁定您的邀請。
                            </span>
                        </div>
                    </CardContent>
                </Card>

            </div>

            {/* 推薦成功明細紀錄 */}
            <Card className="border-white/10 bg-gradient-to-b from-[#13192a]/95 via-[#0c101d]/90 to-[#080b14]/95 backdrop-blur-xl rounded-[2rem] overflow-hidden shadow-xl">
                <CardHeader className="p-6 border-b border-white/5 flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-base font-black text-white flex items-center gap-2">
                            <Users className="w-5 h-5 text-cyan-400" />
                            <span>我推薦的好友名單 ({myReferralLogs?.length || 0} 位)</span>
                        </CardTitle>
                        <CardDescription className="text-slate-400 text-xs">
                            即時顯示透過您的專屬推薦碼加入的新會員與回饋發放紀錄
                        </CardDescription>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-white/5 border-b border-white/5 text-slate-400">
                                <tr>
                                    <th className="p-4 pl-6 font-bold">新註冊好友</th>
                                    <th className="p-4 font-bold">使用代碼</th>
                                    <th className="p-4 font-bold">獲得回饋</th>
                                    <th className="p-4 pr-6 text-right font-bold">綁定時間</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {isLoadingLogs ? (
                                    <tr>
                                        <td colSpan={4} className="p-8 text-center text-slate-400">
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-cyan-400" />
                                            正在載入推薦紀錄...
                                        </td>
                                    </tr>
                                ) : myReferralLogs && myReferralLogs.length > 0 ? (
                                    myReferralLogs.map((log: any) => (
                                        <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                            <td className="p-4 pl-6 font-bold text-white flex items-center gap-2">
                                                <div className="w-7 h-7 rounded-full bg-cyan-500/20 text-cyan-300 font-bold flex items-center justify-center text-xs">
                                                    {(log.newUserName || '友').charAt(0)}
                                                </div>
                                                <span>{log.newUserName || '新會員'}</span>
                                            </td>
                                            <td className="p-4 font-mono font-bold text-amber-300">
                                                {log.code}
                                            </td>
                                            <td className="p-4">
                                                <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[10px] font-bold">
                                                    +{log.referrerBonusGiven || bonusForReferrer} P+
                                                </Badge>
                                            </td>
                                            <td className="p-4 pr-6 text-right font-mono text-slate-400">
                                                {log.createdAt?.seconds 
                                                    ? format(new Date(log.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm')
                                                    : '剛剛'}
                                            </td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan={4} className="p-12 text-center text-slate-400">
                                            <Gift className="w-8 h-8 opacity-30 mx-auto mb-2 text-slate-500" />
                                            尚無推薦好友紀錄，立即複製推薦碼邀請第一位好友加入吧！
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
