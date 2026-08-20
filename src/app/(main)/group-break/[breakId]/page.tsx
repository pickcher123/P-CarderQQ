'use client';

import { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { SafeImage } from '@/components/safe-image';
import { useDoc, useFirestore, useUser, useMemoFirebase } from '@/firebase';
import { doc, collection, serverTimestamp, increment, runTransaction, writeBatch } from 'firebase/firestore';
import { useParams, useRouter } from 'next/navigation';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowLeft, Gem, Loader2, Dices, 
  CheckCircle2, 
  Radio, Zap, SearchCode, X, Hash,
  TicketCheck, AlertCircle, User, Tv, Sparkles,
  Flame, Check, Play, ShieldAlert, Award,
  ZoomIn, Maximize2, ChevronDown, ChevronUp, ExternalLink
} from 'lucide-react';
import { useCollection } from '@/firebase';
import { query } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { UserProfile } from '@/types/user-profile';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Logo, PPlusIcon } from '@/components/icons';
import { CardItem } from '@/components/card-item';
import { VerifyAgeModal } from '@/components/verify-age-modal';
import { getTeamLogoUrl } from '@/lib/draw-constants';


type Spot = {
  spotNumber: number;
  userId?: string;
  userName?: string;
};

type Team = {
  teamId: string;
  name: string;
  price: number;
  userId?: string;
  userName?: string;
  logoUrl?: string;
}

interface GroupBreak {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pricePerSpot?: number;
  totalSpots?: number;
  youtubeUrl?: string;
  spots?: Spot[];
  teams?: Team[];
  breakType: 'spot' | 'team';
  currency?: 'diamond' | 'p-point';
  status: 'draft' | 'published' | 'in_progress' | 'completed';
  winnings?: Winnings[];
}

interface Winnings {
    userId: string;
    username: string;
    teamId: string;
    teamName: string;
    cardId?: string;
    cardName?: string;
    cardImageUrl?: string;
    cardBackImageUrl?: string;
}

export default function GroupBreakDetailPage() {
  const { breakId } = useParams();
  const firestore = useFirestore();
  const { user } = useUser();
  const router = useRouter();
  const { toast } = useToast();

  const userProfileRef = useMemoFirebase(() => user ? doc(firestore, 'users', user.uid) : null, [firestore, user]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const [selectedSpots, setSelectedSpots] = useState<Set<number>>(new Set());
  const [selectedTeams, setSelectedTeams] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAgeModalOpen, setIsAgeModalOpen] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  
  const [isRandomPickOpen, setIsRandomPickOpen] = useState(false);
  const [randomPickCount, setRandomPickCount] = useState(1);
  const [previewCard, setPreviewCard] = useState<Winnings | null>(null);
  const [isFullscreenImageOpen, setIsFullscreenImageOpen] = useState(false);
  const [isStreamExpanded, setIsStreamExpanded] = useState(true);

  const getYouTubeEmbedUrl = (url?: string): string | null => {
    if (!url) return null;
    const trimmed = url.trim();
    if (!trimmed) return null;
    if (trimmed.includes('youtube.com/embed/')) {
      return trimmed.includes('autoplay') ? trimmed : `${trimmed}${trimmed.includes('?') ? '&' : '?'}autoplay=1&rel=0`;
    }
    const watchMatch = trimmed.match(/[?&]v=([^&]+)/);
    if (watchMatch && watchMatch[1]) {
      return `https://www.youtube.com/embed/${watchMatch[1]}?autoplay=1&rel=0`;
    }
    const shortMatch = trimmed.match(/youtu\.be\/([^?&]+)/);
    if (shortMatch && shortMatch[1]) {
      return `https://www.youtube.com/embed/${shortMatch[1]}?autoplay=1&rel=0`;
    }
    const liveMatch = trimmed.match(/youtube\.com\/live\/([^?&]+)/);
    if (liveMatch && liveMatch[1]) {
      return `https://www.youtube.com/embed/${liveMatch[1]}?autoplay=1&rel=0`;
    }
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return `https://www.youtube.com/embed/${trimmed}?autoplay=1&rel=0`;
    }
    return trimmed;
  };


  const groupBreakRef = useMemoFirebase(() => {
    if (!firestore || !breakId) return null;
    return doc(firestore, 'groupBreaks', breakId as string);
  }, [firestore, breakId]);

  const { data: groupBreak, isLoading: isLoadingBreak, forceRefetch } = useDoc<GroupBreak>(groupBreakRef);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    allUsers?.forEach(u => {
      if (u.id) map.set(u.id, u.username || u.displayName || '藏友');
    });
    return map;
  }, [allUsers]);

  const getBuyerName = (userId?: string, savedName?: string) => {
    if (!userId) return '';
    if (savedName) return savedName;
    if (userMap.has(userId)) return userMap.get(userId)!;
    if (user?.uid === userId) return userProfile?.username || userProfile?.displayName || '我';
    return `藏友 ${userId.slice(0, 5)}`;
  };

  const { takenSpots, takenTeams, isFull } = useMemo(() => {
    if (!groupBreak) return { takenSpots: new Set(), takenTeams: new Set(), isFull: false };
    
    let currentParticipantCount = 0;
    let totalPossibleSpots = 0;

    const spots = new Set<number>();
    if (groupBreak.breakType === 'spot') {
      groupBreak.spots?.forEach(spot => { if (spot.userId) spots.add(spot.spotNumber); });
      currentParticipantCount = spots.size;
      totalPossibleSpots = groupBreak.totalSpots || 0;
    }

    const teams = new Set<string>();
    if (groupBreak.breakType === 'team') {
        groupBreak.teams?.forEach(team => { if(team.userId) teams.add(team.teamId); });
        currentParticipantCount = teams.size;
        totalPossibleSpots = groupBreak.teams?.length || 0;
    }
    
    return { takenSpots: spots, takenTeams: teams, isFull: totalPossibleSpots > 0 && currentParticipantCount >= totalPossibleSpots };
  }, [groupBreak]);
  
  const handleSpotClick = (spotNumber: number) => {
    if (takenSpots.has(spotNumber)) return;
    setSelectedSpots(prev => {
      const newSet = new Set(prev);
      if (newSet.has(spotNumber)) newSet.delete(spotNumber);
      else newSet.add(spotNumber);
      return newSet;
    });
  };
  
  const handleTeamClick = (teamId: string) => {
    if(takenTeams.has(teamId)) return;
    setSelectedTeams(prev => {
        const newSet = new Set(prev);
        if(newSet.has(teamId)) newSet.delete(teamId);
        else newSet.add(teamId);
        return newSet;
    })
  }

  const handleConfirmRandomPick = () => {
    if (!groupBreak) return;
    const isTeamBreak = groupBreak.breakType === 'team';
    
    const available = isTeamBreak 
        ? (groupBreak.teams || []).filter(t => !t.userId && !selectedTeams.has(t.teamId))
        : Array.from({ length: groupBreak.totalSpots || 0 }).map((_, i) => i + 1).filter(s => !takenSpots.has(s) && !selectedSpots.has(s));

    if (available.length < randomPickCount) {
        toast({ variant: "destructive", title: "名額不足", description: `剩餘可選名額不足 ${randomPickCount} 個。`});
        return;
    }

    const shuffled = [...available].sort(() => 0.5 - Math.random());
    const picked = shuffled.slice(0, randomPickCount);

    if (isTeamBreak) {
        setSelectedTeams(prev => {
            const newSet = new Set(prev);
            picked.forEach((t: any) => newSet.add(t.teamId));
            return newSet;
        });
    } else {
        setSelectedSpots(prev => {
            const newSet = new Set(prev);
            picked.forEach((s: any) => newSet.add(s));
            return newSet;
        });
    }
    setIsRandomPickOpen(false);
  };

  const handlePurchase = async () => {
    if (groupBreak?.isAdult && !isVerified) {
        setIsAgeModalOpen(true);
        return;
    }
    if (!user || !firestore || !groupBreakRef || !groupBreak) return;
    const isTeamBreak = groupBreak.breakType === 'team';
    const hasSelection = isTeamBreak ? selectedTeams.size > 0 : selectedSpots.size > 0;
    if (!hasSelection) return;

    const currency = groupBreak.currency || 'diamond';

    setIsSubmitting(true);
    try {
        await runTransaction(firestore, async (transaction) => {
            const groupBreakSnap = await transaction.get(groupBreakRef);
            if (!groupBreakSnap.exists()) throw new Error("此團拆活動不存在。");
            const currentGroupBreak = groupBreakSnap.data() as GroupBreak;
            
            let totalCost = isTeamBreak 
                ? Array.from(selectedTeams).reduce((acc, teamId) => acc + (currentGroupBreak.teams?.find(t => t.teamId === teamId)?.price || 0), 0)
                : selectedSpots.size * (currentGroupBreak.pricePerSpot || 0);
            
            const userRef = doc(firestore, 'users', user.uid);
            const userSnap = await transaction.get(userRef);
            if (!userSnap.exists()) throw new Error("找不到使用者資料。");
            
            const userData = userSnap.data() as UserProfile;
            const walletBalance = currency === 'diamond' ? (userData.points || 0) : (userData.bonusPoints || 0);

            if (walletBalance < totalCost) {
                throw new Error(`您的${currency === 'diamond' ? '鑽石' : 'P點'}餘額不足，需要 ${totalCost} 點。`);
            }
            
            const currentBuyerName = userData.username || userData.displayName || user.displayName || '藏友';

            if(isTeamBreak) {
                for (const teamId of selectedTeams) {
                    const team = currentGroupBreak.teams?.find(t => t.teamId === teamId);
                    if (team?.userId) throw new Error("部分隊伍已被選走，請重新整理後再試。");
                }
                const updatedTeams = currentGroupBreak.teams?.map(t => selectedTeams.has(t.teamId) ? { ...t, userId: user.uid, userName: currentBuyerName } : t);
                transaction.update(groupBreakRef, { teams: updatedTeams });
            } else {
                for (const spotNumber of selectedSpots) {
                    const spot = currentGroupBreak.spots?.find(s => s.spotNumber === spotNumber);
                    if (spot?.userId) throw new Error("部分號碼已被選走，請重新整理後再試。");
                }
                 const updatedSpots = currentGroupBreak.spots?.map(s => selectedSpots.has(s.spotNumber) ? { ...s, userId: user.uid, userName: currentBuyerName } : s);
                 transaction.update(groupBreakRef, { spots: updatedSpots });
            }
            
            const walletField = currency === 'diamond' ? 'points' : 'bonusPoints';
            const updates: any = { [walletField]: increment(-totalCost) };

            if (currency === 'diamond') {
                updates.totalSpent = increment(totalCost);
            }

            transaction.update(userRef, updates);
            transaction.set(doc(collection(firestore, 'transactions')), { 
                userId: user.uid, 
                transactionType: 'Purchase', 
                section: 'group-break', 
                currency: currency,
                amount: -totalCost, 
                details: `購買 ${currentGroupBreak.title} 的位置/隊伍 (${currency})`, 
                transactionDate: serverTimestamp() 
            });
        });

        toast({ title: '購買成功！', description: `祝您在團拆中獲得大獎！` });
        setSelectedTeams(new Set());
        setSelectedSpots(new Set());
        if (forceRefetch) forceRefetch();
    } catch (error: any) {
        toast({ variant: 'destructive', title: '購買失敗', description: error.message });
    } finally { setIsSubmitting(false); }
  };

  if (isLoadingBreak) {
    return (
      <div className="container min-h-[60vh] flex flex-col items-center justify-center text-center">
        <div className="relative">
          <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center animate-pulse">
            <Radio className="h-8 w-8 text-cyan-400 animate-spin-slow" />
          </div>
          <div className="absolute -inset-2 bg-cyan-500/20 rounded-full blur-xl animate-pulse" />
        </div>
        <p className="mt-6 font-headline tracking-widest text-cyan-300 font-bold text-sm uppercase">正在連線至實況終端...</p>
        <p className="text-xs text-slate-500 mt-1">Connecting to live group break channel</p>
      </div>
    );
  }

  if (!groupBreak) {
    return (
      <div className="container py-24 text-center">
        <div className="inline-flex p-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 mb-4">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-black text-white">頻道訊號中斷</h2>
        <p className="text-slate-400 text-sm mt-1 mb-6">找不到此團拆活動或已被下架。</p>
        <Button onClick={() => router.push('/group-break')} className="bg-white/10 hover:bg-white/20 text-white font-bold rounded-xl">
          返回頻道列表
        </Button>
      </div>
    );
  }

  const isTeamBreak = groupBreak.breakType === 'team';
  const totalCost = isTeamBreak 
    ? (groupBreak.teams || []).reduce((acc, team) => selectedTeams.has(team.teamId) ? acc + team.price : acc, 0)
    : selectedSpots.size * (groupBreak.pricePerSpot || 0);
  const selectionCount = isTeamBreak ? selectedTeams.size : selectedSpots.size;
  const currency = groupBreak.currency || 'diamond';

  const participantCount = isTeamBreak ? takenTeams.size : takenSpots.size;
  const totalSpotsCount = isTeamBreak ? (groupBreak.teams?.length || 0) : (groupBreak.totalSpots || 0);
  const progressPercent = totalSpotsCount > 0 ? Math.min(100, Math.round((participantCount / totalSpotsCount) * 100)) : 0;
  const remainingSpotsCount = Math.max(0, totalSpotsCount - participantCount);

  return (
    <div className="container max-w-7xl py-6 md:py-10 relative">
      {/* Background Cyber Ambient Glows */}
      <div className="absolute top-0 left-1/4 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none" />
      
      {/* Top Breadcrumb & Status Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <Button 
          variant="ghost" 
          onClick={() => router.back()} 
          className="h-10 px-3.5 rounded-xl text-slate-300 hover:text-white hover:bg-white/5 font-bold gap-2 text-xs border border-white/5 transition-all"
        >
          <ArrowLeft className="h-4 w-4 text-cyan-400" />
          <span>返回頻道列表</span>
        </Button>

        <div className="flex items-center gap-2">
          <Badge className="bg-slate-900/90 text-cyan-300 border border-cyan-500/30 text-[11px] px-3 py-1 font-bold rounded-xl gap-1.5 shadow-sm">
            <Radio className="w-3 h-3 text-cyan-400 animate-pulse" />
            <span>{isTeamBreak ? '球隊模式團拆' : '隨機位置團拆'}</span>
          </Badge>
          
          <Badge className={cn(
            "text-[11px] px-3 py-1 font-bold rounded-xl shadow-sm border",
            groupBreak.status === 'completed' ? "bg-slate-800 text-slate-400 border-slate-700" :
            groupBreak.status === 'in_progress' ? "bg-rose-500/20 text-rose-400 border-rose-500/40 animate-pulse" :
            isFull ? "bg-amber-500/20 text-amber-300 border-amber-500/40" :
            "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
          )}>
            {groupBreak.status === 'completed' ? '已結束' :
             groupBreak.status === 'in_progress' ? '🔥 直播拆卡中' :
             isFull ? '已滿團' : '✨ 開團熱搶中'}
          </Badge>
        </div>
      </div>

      {/* === TOP PINNED LIVE STREAM CONSOLE === */}
      {(groupBreak.status === 'in_progress' || groupBreak.youtubeUrl) && (
        <div className="mb-8 relative rounded-3xl border border-rose-500/40 bg-gradient-to-b from-[#1c0d16]/95 via-[#120810]/95 to-[#090508]/95 p-3.5 sm:p-5 shadow-[0_15px_40px_rgba(244,63,94,0.15),0_0_30px_rgba(0,0,0,0.8)] overflow-hidden">
          {/* Ambient red/pink glow for live feel */}
          <div className="absolute top-0 right-1/4 w-80 h-32 bg-rose-500/15 blur-3xl pointer-events-none" />
          
          <div className="flex items-center justify-between gap-3 mb-3 relative z-10 flex-wrap">
            <div className="flex items-center gap-2.5">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Tv className="w-4 h-4" /> 
                    {groupBreak.status === 'in_progress' ? '官方即時拆卡直播中 • LIVE STREAM' : '官方拆卡實況回放 • BROADCAST'}
                  </span>
                  <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] font-mono px-2 py-0.5">
                    PINNED TOP
                  </Badge>
                </div>
                <span className="text-[11px] text-slate-400 font-medium line-clamp-1">
                  正在即時開箱拆盒【{groupBreak.title}】，請鎖定您的幸運席位！
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {groupBreak.youtubeUrl && (
                <Button
                  variant="outline"
                  size="sm"
                  asChild
                  className="h-8 px-2.5 rounded-xl border-white/10 bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold gap-1.5"
                >
                  <a href={groupBreak.youtubeUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="w-3.5 h-3.5 text-rose-400" />
                    <span className="hidden sm:inline">新視窗觀看</span>
                  </a>
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsStreamExpanded(!isStreamExpanded)}
                className="h-8 px-3 rounded-xl border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-bold gap-1.5 transition-all"
              >
                {isStreamExpanded ? (
                  <>
                    <ChevronUp className="w-3.5 h-3.5 text-rose-400" />
                    <span>收合直播視窗</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-3.5 h-3.5 text-rose-400" />
                    <span>展開直播視窗</span>
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Embedded Player */}
          {isStreamExpanded && (
            <div className="relative w-full aspect-video sm:aspect-[21/9] max-h-[480px] bg-slate-950 rounded-2xl overflow-hidden border border-rose-500/30 shadow-2xl mt-1">
              {groupBreak.youtubeUrl && getYouTubeEmbedUrl(groupBreak.youtubeUrl) ? (
                <iframe
                  src={getYouTubeEmbedUrl(groupBreak.youtubeUrl)!}
                  title="團拆官方現場直播"
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center bg-slate-950/80">
                  <div className="p-4 rounded-full bg-rose-500/10 border border-rose-500/30">
                    <Radio className="w-8 h-8 text-rose-400 animate-pulse" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm font-black text-white">直播訊號連線中</p>
                    <p className="text-xs text-slate-400 max-w-sm">
                      官方主播即將開啟現場拆卡串流，請保持此頁面開啟，即時觀看您的戰利品開出！
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* === LEFT COLUMN: LIVE STREAM / POSTER DECK (5 cols on lg) === */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Main Large Image Frame (Unobstructed & Crystal Clear) */}
          <div className="relative bg-gradient-to-b from-[#13192a]/95 via-[#0d1220]/95 to-[#090c15]/95 border border-cyan-500/30 rounded-3xl p-2.5 sm:p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.8),0_0_25px_rgba(6,182,212,0.15)] overflow-hidden group">
            
            {/* Poster Aspect Ratio Display (Large, Uncropped & Unobstructed) */}
            <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full bg-slate-950/90 rounded-2xl overflow-hidden border border-white/10 shadow-inner group/poster flex items-center justify-center p-2">
              {/* Blur backdrop for wide/tall ratios */}
              {groupBreak.imageUrl && (
                <div 
                  className="absolute inset-0 bg-cover bg-center blur-2xl scale-125 opacity-30 pointer-events-none"
                  style={{ backgroundImage: `url(${groupBreak.imageUrl})` }}
                />
              )}

              {/* Main Crisp Foreground Image */}
              <SafeImage 
                src={groupBreak.imageUrl} 
                alt={groupBreak.title} 
                fill 
                className={cn(
                  "object-contain p-1 transition-transform duration-500 group-hover/poster:scale-105",
                  groupBreak.status === 'completed' && "grayscale brightness-75"
                )} 
              />

              {/* Floating Top Header Badges (No space taken from image) */}
              <div className="absolute top-2.5 inset-x-2.5 flex items-center justify-between pointer-events-none z-20">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md border border-cyan-400/30 text-[10px] font-bold text-cyan-300 font-code pointer-events-auto">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_6px_#22d3ee]" />
                  <span>CH #{breakId?.slice(0, 4).toUpperCase()}</span>
                </div>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsFullscreenImageOpen(true)}
                  className="h-7 w-7 p-0 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md border border-white/20 text-white pointer-events-auto shadow-md"
                  title="點擊放大查看大圖"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </Button>
              </div>

              {/* Status Overlay Banner if Full / In Progress / Completed */}
              {(isFull || groupBreak.status === 'completed' || groupBreak.status === 'in_progress') && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[2px] z-20">
                  <Badge className={cn(
                    "text-xs sm:text-sm font-black px-5 py-1.5 rounded-full shadow-2xl border-2 uppercase tracking-wider backdrop-blur-md",
                    groupBreak.status === 'completed' ? "bg-slate-900/90 text-slate-300 border-slate-700" :
                    groupBreak.status === 'in_progress' ? "bg-rose-500 text-white animate-pulse border-rose-300 shadow-[0_0_20px_rgba(244,63,94,0.6)]" :
                    "bg-amber-500/95 text-slate-950 border-amber-300 font-extrabold"
                  )}>
                    {groupBreak.status === 'completed' ? '活動已結束' : groupBreak.status === 'in_progress' ? '● 直播拆卡進行中' : '已全數售罄 (滿團)'}
                  </Badge>
                </div>
              )}
            </div>

            {/* Click to Zoom Tip */}
            <button 
              type="button" 
              onClick={() => setIsFullscreenImageOpen(true)}
              className="w-full mt-2 py-1 flex items-center justify-center gap-1.5 text-[11px] font-bold text-cyan-400/80 hover:text-cyan-300 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
              <span>點擊圖片可放大檢視卡盒高清海報</span>
            </button>
          </div>

          {/* Progress & Slots Bar (Dedicated Card, Separated from Image) */}
          <div className="p-4 rounded-3xl bg-slate-900/80 border border-white/10 space-y-2.5 shadow-lg">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-300 flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-cyan-400" />
                席次鎖定進度
              </span>
              <span className="font-code text-cyan-300 text-sm font-black">
                {participantCount} / {totalSpotsCount} 席 ({progressPercent}%)
              </span>
            </div>
            <Progress value={progressPercent} className="h-2.5 bg-slate-950" />
            <div className="flex items-center justify-between text-xs text-slate-400 pt-0.5">
              <span>剩餘名額: <strong className="text-white font-code text-sm">{remainingSpotsCount}</strong> 個</span>
              <span className={cn("font-bold text-xs", isFull ? "text-slate-400" : remainingSpotsCount <= 3 ? "text-amber-400" : "text-emerald-400")}>
                {isFull ? '已搶購一空' : remainingSpotsCount <= 3 ? '即將滿團！' : '開放選購中'}
              </span>
            </div>

            {/* YouTube Live Stream External Button */}
            {groupBreak.youtubeUrl && (
              <div className="pt-2 border-t border-white/10">
                <Button asChild className="w-full h-11 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-black shadow-lg shadow-red-600/20 text-xs gap-2">
                  <Link href={groupBreak.youtubeUrl.includes('youtube.com') ? groupBreak.youtubeUrl : `https://youtube.com/watch?v=${groupBreak.youtubeUrl}`} target="_blank">
                    <Play className="w-4 h-4 fill-white" />
                    {groupBreak.status === 'completed' ? '點擊觀看直播檔案回顧' : '前往 YouTube 收看實況直播'}
                  </Link>
                </Button>
              </div>
            )}
          </div>

          {/* Title & Description Box */}
          <div className="p-4 sm:p-5 rounded-3xl bg-slate-900/60 border border-white/10 space-y-2">
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-snug">
              {groupBreak.title}
            </h1>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-medium">
              {groupBreak.description || '官方實體球員卡團拆活動，拆出之所屬球隊卡片將全數歸屬於該席次持有者。'}
            </p>
          </div>
        </div>

        {/* === RIGHT COLUMN: SPOT / TEAM SELECTION MATRIX (7 cols on lg) === */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-gradient-to-b from-[#13192a]/95 via-[#0d1220]/95 to-[#090c15]/95 border border-white/10 rounded-3xl p-4 sm:p-7 shadow-2xl backdrop-blur-xl">
            
            {/* Header / Selection Control */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 mb-4 border-b border-white/10">
              <div className="space-y-0.5">
                <h2 className="text-base sm:text-lg font-black text-white flex items-center gap-2 tracking-tight">
                  <TicketCheck className="h-5 w-5 text-cyan-400" />
                  <span>{isTeamBreak ? '選擇球隊席位' : '選擇號碼位置'}</span>
                </h2>
                <p className="text-[11px] text-slate-400">點擊下方卡片即可加入選購清單</p>
              </div>

              {/* Random Pick Tool Button */}
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsRandomPickOpen(true)} 
                disabled={isFull || groupBreak.status === 'completed'} 
                className="h-9 px-3 rounded-xl bg-slate-900/90 border-cyan-500/30 text-cyan-300 hover:bg-cyan-950/40 hover:text-white font-bold text-xs gap-1.5 shadow-sm transition-all active:scale-95"
              >
                <Dices className="h-3.5 w-3.5 text-cyan-400" />
                <span>自動快速選號</span>
              </Button>
            </div>

            {/* Matrix Scroll Area */}
            <ScrollArea className="h-[380px] sm:h-[420px] pr-2 custom-scrollbar">
              {isTeamBreak ? (
                /* === TEAM BREAK GRID === */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 gap-2.5 pb-2">
                  {(groupBreak.teams || []).map(team => {
                    const isTaken = takenTeams.has(team.teamId);
                    const isSelected = selectedTeams.has(team.teamId);
                    const logoUrl = getTeamLogoUrl(team.name, team.logoUrl);
                    const buyerName = getBuyerName(team.userId, team.userName);

                    return (
                      <button
                        key={team.teamId}
                        type="button"
                        disabled={isTaken || isFull || groupBreak.status === 'completed'}
                        onClick={() => handleTeamClick(team.teamId)}
                        className={cn(
                          "relative min-h-[116px] rounded-2xl flex flex-col items-center justify-between p-3 text-center transition-all duration-200 border text-left group overflow-hidden select-none",
                          isTaken 
                            ? "bg-black/40 border-white/5 opacity-65 cursor-not-allowed" 
                            : isSelected 
                              ? "bg-gradient-to-b from-cyan-950/90 to-sky-950/90 border-2 border-cyan-400 text-white shadow-[0_0_20px_rgba(6,182,212,0.35)] ring-2 ring-cyan-400/20" 
                              : "bg-slate-900/80 border-white/10 text-slate-200 hover:border-cyan-500/50 hover:bg-slate-800/80 hover:shadow-lg active:scale-98"
                        )}
                      >
                        {/* Selected Indicator Badge */}
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-cyan-400 text-slate-950 flex items-center justify-center shadow-md">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}

                        {/* Team Logo */}
                        <div className="relative w-10 h-10 my-0.5 flex items-center justify-center flex-shrink-0">
                          {logoUrl ? (
                            <img 
                              src={logoUrl} 
                              alt={team.name} 
                              className={cn(
                                "w-10 h-10 object-contain transition-transform drop-shadow-md",
                                isTaken ? "opacity-60" : "group-hover:scale-110"
                              )} 
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-xl bg-slate-800 border border-white/10 text-cyan-300 text-sm font-black flex items-center justify-center shadow-inner">
                              {team.name.slice(0, 2)}
                            </div>
                          )}
                        </div>
                        
                        {/* Team Name */}
                        <span className="text-xs font-black uppercase tracking-tight text-white line-clamp-1 w-full mt-1">
                          {team.name}
                        </span>

                        {/* Bottom Status / Price Badge */}
                        {isTaken ? (
                          <div className="w-full bg-slate-950/90 text-amber-300 rounded-lg py-1 px-1.5 text-[10.5px] font-bold flex items-center justify-center gap-1 mt-1.5 border border-amber-500/20 truncate">
                            <User className="w-3 h-3 text-amber-400 shrink-0" />
                            <span className="truncate">{buyerName || '已售出'}</span>
                          </div>
                        ) : (
                          <div className={cn(
                            "w-full py-1 px-2 rounded-lg font-code flex items-center justify-center gap-1 mt-1.5 text-xs font-black transition-colors",
                            isSelected ? "bg-cyan-400 text-slate-950" : "bg-white/5 text-cyan-300 border border-white/5"
                          )}>
                            <span>{team.price.toLocaleString()}</span>
                            {currency === 'diamond' ? <Gem className="w-3 h-3"/> : <PPlusIcon className="w-3 h-3" />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              ) : (
                /* === SPOT BREAK NUMBER GRID === */
                <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2 pb-2">
                  {Array.from({ length: groupBreak.totalSpots || 0 }).map((_, i) => {
                    const spotNumber = i + 1;
                    const spotObj = groupBreak.spots?.find(s => s.spotNumber === spotNumber);
                    const isTaken = takenSpots.has(spotNumber);
                    const isSelected = selectedSpots.has(spotNumber);
                    const buyerName = getBuyerName(spotObj?.userId, spotObj?.userName);

                    return (
                      <button
                        key={spotNumber}
                        type="button"
                        disabled={isTaken || isFull || groupBreak.status === 'completed'}
                        onClick={() => handleSpotClick(spotNumber)}
                        title={isTaken ? `買家: ${buyerName}` : `號碼 ${spotNumber}`}
                        className={cn(
                          "relative min-h-[64px] rounded-xl flex flex-col items-center justify-center p-1.5 font-black text-xs transition-all border select-none",
                          isTaken 
                            ? "bg-black/40 border-white/5 text-slate-500 opacity-65 cursor-not-allowed" 
                            : isSelected 
                              ? "bg-gradient-to-b from-cyan-950 to-sky-950 border-2 border-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.4)] ring-1 ring-cyan-400/30" 
                              : "bg-slate-900/80 border-white/10 text-slate-200 hover:border-cyan-500/50 hover:bg-slate-800"
                        )}
                      >
                        <span className="font-code text-sm font-black">#{spotNumber}</span>
                        {isTaken && (
                          <span className="w-full text-[9px] font-bold text-amber-300 bg-amber-500/10 py-0.5 px-0.5 rounded truncate mt-1 border border-amber-500/20 flex items-center justify-center gap-0.5">
                            <span className="truncate">{buyerName || '已售'}</span>
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* === ORDER CHECKOUT SUMMARY BAR === */}
            <div className="mt-6 pt-5 border-t border-white/10 space-y-4">
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-black/40 border border-white/5">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">已選取席位</span>
                  <p className="font-bold text-white text-sm">
                    共 <span className="text-cyan-400 font-code font-black text-base">{selectionCount}</span> 個席次
                  </p>
                </div>
                
                <div className="text-right space-y-0.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">總計需支付</span>
                  <div className="flex items-center justify-end gap-1.5 text-xl sm:text-2xl font-black font-code text-white">
                    <span className="text-cyan-400">{totalCost.toLocaleString()}</span>
                    {currency === 'diamond' ? <Gem className="h-4 w-4 text-cyan-400"/> : <PPlusIcon className="h-4 w-4 text-amber-400" />}
                  </div>
                </div>
              </div>
              
              {/* Purchase Trigger Dialog */}
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button 
                    size="lg" 
                    className="w-full h-14 text-base font-black rounded-2xl bg-gradient-to-r from-cyan-500 via-sky-400 to-cyan-500 hover:from-cyan-400 text-slate-950 shadow-xl shadow-cyan-500/25 active:scale-98 group transition-all" 
                    disabled={selectionCount === 0 || isSubmitting || isFull || groupBreak.status === 'completed'}
                  >
                    <Zap className="mr-2 h-5 w-5 fill-slate-950 group-hover:scale-110 transition-transform" />
                    {isFull ? '本場活動名額已全數售罄' : selectionCount === 0 ? '請點選上方席次進行購買' : `立即確認連線購買 (${selectionCount} 席)`}
                  </Button>
                </AlertDialogTrigger>
                
                <AlertDialogContent className="w-[94vw] max-w-md bg-slate-950 border border-cyan-500/30 rounded-3xl p-5 sm:p-6 shadow-2xl text-white">
                  <AlertDialogHeader className="space-y-2 text-left">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase w-fit">
                      <Zap className="w-3 h-3 text-cyan-400" />
                      <span>TRANSACTION ORDER • 團拆席次訂單</span>
                    </div>
                    <AlertDialogTitle className="text-xl font-black text-white tracking-tight">
                      確認購買 {selectionCount} 個團拆席次？
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                      <div className="text-slate-400 text-xs space-y-3 pt-1">
                        <div className="p-3.5 rounded-xl bg-cyan-950/40 border border-cyan-500/30 flex items-center justify-between text-white font-bold">
                          <span>預計扣除費用:</span>
                          <span className="text-cyan-400 font-code text-base font-black flex items-center gap-1">
                            {totalCost.toLocaleString()} {currency === 'diamond' ? '鑽石' : 'P點'}
                          </span>
                        </div>

                        <div className="p-3 rounded-xl border border-destructive/20 bg-destructive/5 text-[11px] text-slate-300 space-y-1">
                          <p className="font-bold text-destructive flex items-center gap-1.5">
                            <ShieldAlert className="w-3.5 h-3.5" /> 購買規則須知：
                          </p>
                          <p className="leading-relaxed text-slate-400">
                            本服務屬機率型卡牌團拆，購買後將直接鎖定所選席次。拆卡過程將於官方頻道公開直播進行。
                          </p>
                        </div>
                      </div>
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="gap-2.5 mt-5">
                    <AlertDialogCancel className="h-11 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 font-bold text-xs">
                      取消
                    </AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handlePurchase} 
                      disabled={isSubmitting} 
                      className="h-11 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 uppercase"
                    >
                      {isSubmitting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                      確認扣款購買
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </div>

      {/* === COMPLETED WINNINGS RESULTS SECTION === */}
      {groupBreak.status === 'completed' && groupBreak.winnings && (
        <section className="mt-16 animate-fade-in-up">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-lg">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">官方開獎結果清單</h2>
              <p className="text-xs text-slate-400">Session Completion & Prize Registry</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {groupBreak.winnings.map((winning, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/70 backdrop-blur-md border border-white/10 hover:border-cyan-500/40 transition-all group shadow-lg cursor-pointer"
                onClick={() => winning.cardId && setPreviewCard(winning)}
              >
                <div className="flex flex-col gap-0.5 overflow-hidden">
                  <span className="text-[10px] text-cyan-300 font-bold uppercase tracking-wider truncate">{winning.teamName}</span>
                  <span className="text-sm font-bold text-white truncate group-hover:text-cyan-400 transition-colors">{winning.username}</span>
                </div>
                {winning.cardId ? (
                  <div className="relative w-10 h-14 rounded-lg overflow-hidden border border-white/10 shadow-md group-hover:scale-110 transition-transform">
                    <SafeImage src={winning.cardImageUrl!} alt={winning.cardName!} fill className="object-cover" />
                  </div>
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-emerald-400/40" />
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Card 3D Preview Dialog */}
      <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
        <DialogContent className="max-w-[min(95vw,420px)] sm:max-w-md bg-transparent border-none shadow-none p-0 overflow-visible flex flex-col items-center gap-6 [&>button:last-child]:hidden">
          {previewCard && (
            <div className="w-full flex flex-col items-center gap-4 animate-in zoom-in-95 duration-300">
              <h2 className="text-base font-black text-white drop-shadow-2xl tracking-tight leading-tight uppercase px-6 text-center max-w-[280px]">
                {previewCard.cardName}
              </h2>
              
              <div className="w-full max-w-[220px] mx-auto relative group">
                <div className="absolute -inset-4 bg-cyan-500/20 rounded-[2rem] blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                <CardItem 
                  name={previewCard.cardName!} 
                  imageUrl={previewCard.cardImageUrl!} 
                  backImageUrl={previewCard.cardBackImageUrl}
                  imageHint={previewCard.cardName!} 
                  rarity="rare" 
                  isFlippable={true}
                />
              </div>

              <div className="flex flex-col items-center text-center gap-2">
                <div className="flex items-center gap-2 mt-2">
                  <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold px-3 py-0.5 text-xs">
                    {previewCard.teamName}
                  </Badge>
                  <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 px-3 py-0.5 rounded-full text-xs font-code font-bold text-white shadow-lg">
                    <Hash className="w-3 h-3 text-cyan-400" />
                    {previewCard.userId.substring(0,4).toUpperCase()}
                  </div>
                </div>
                <p className="text-xs text-cyan-300 font-bold mt-1">獲獎藏家: {previewCard.username}</p>
              </div>
            </div>
          )}
          <button 
            type="button"
            className="mt-2 rounded-full bg-slate-900/80 hover:bg-slate-800 text-white border border-white/20 h-10 w-10 shadow-2xl transition-all flex items-center justify-center"
            onClick={() => setPreviewCard(null)}
          >
            <X className="h-5 w-5" />
          </button>
        </DialogContent>
      </Dialog>

      {/* Random Pick Dialog */}
      <Dialog open={isRandomPickOpen} onOpenChange={setIsRandomPickOpen}>
        <DialogContent className="w-[92vw] max-w-xs rounded-3xl bg-slate-950 border border-cyan-500/30 p-6 text-white shadow-2xl">
          <DialogHeader className="space-y-1 text-left">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase w-fit">
              <Dices className="w-3 h-3 text-cyan-400" />
              <span>AUTO SELECTION • 自動隨機選號</span>
            </div>
            <DialogTitle className="text-lg font-black text-white tracking-tight">設定欲選取的數量</DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              系統將為您自動於尚未被認領的席位中隨機抽選分配。
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 space-y-3">
            <div className="flex items-center justify-center gap-3">
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setRandomPickCount(Math.max(1, randomPickCount - 1))}
                className="h-11 w-11 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10 text-lg font-bold"
              >
                -
              </Button>
              <Input 
                type="number" 
                value={randomPickCount} 
                onChange={(e) => setRandomPickCount(Math.max(1, Math.min(remainingSpotsCount || 10, Number(e.target.value))))} 
                className="h-12 w-24 bg-slate-900 border-white/10 rounded-xl font-code text-2xl font-black text-center text-cyan-400"
              />
              <Button 
                variant="outline" 
                size="icon" 
                onClick={() => setRandomPickCount(Math.min(remainingSpotsCount || 10, randomPickCount + 1))}
                className="h-11 w-11 rounded-xl bg-white/5 border-white/10 text-white hover:bg-white/10 text-lg font-bold"
              >
                +
              </Button>
            </div>
          </div>

          <DialogFooter className="flex flex-col gap-2">
            <Button onClick={handleConfirmRandomPick} className="w-full h-11 font-black rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 text-xs">
              執行自動選位
            </Button>
            <Button variant="ghost" onClick={() => setIsRandomPickOpen(false)} className="w-full h-9 font-bold text-slate-400 text-xs hover:text-white">
              取消
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Poster / Card Box Zoom Modal */}
      <Dialog open={isFullscreenImageOpen} onOpenChange={setIsFullscreenImageOpen}>
        <DialogContent className="max-w-[min(96vw,720px)] bg-slate-950/95 border border-cyan-500/30 rounded-3xl p-4 sm:p-6 shadow-2xl backdrop-blur-xl">
          <DialogHeader className="flex flex-row items-center justify-between pb-3 border-b border-white/10">
            <div className="space-y-0.5 text-left">
              <DialogTitle className="text-base sm:text-lg font-black text-white tracking-tight">
                {groupBreak.title}
              </DialogTitle>
              <p className="text-xs text-cyan-300 font-bold">官方卡盒高解析海報預覽</p>
            </div>
          </DialogHeader>

          <div className="relative w-full aspect-[4/3] sm:aspect-[16/10] max-h-[70vh] bg-black rounded-2xl overflow-hidden border border-white/10 my-2 flex items-center justify-center">
            <SafeImage 
              src={groupBreak.imageUrl} 
              alt={groupBreak.title} 
              fill 
              className="object-contain" 
            />
          </div>

          <DialogFooter>
            <Button 
              onClick={() => setIsFullscreenImageOpen(false)}
              className="w-full h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs"
            >
              關閉預覽
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Age Verification Modal */}
      <VerifyAgeModal 
        isOpen={isAgeModalOpen}
        onClose={() => setIsAgeModalOpen(false)}
        onConfirm={() => {
          setIsAgeModalOpen(false);
          setIsVerified(true);
          handlePurchase();
        }}
      />
    </div>
  );
}
