'use client';

import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import Link from 'next/link';
import { SafeImage } from '@/components/safe-image';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { 
  Users, Users2, Info, ChevronDown, ChevronUp, Sparkles, Gem, ChevronRight, 
  Package, Trophy, Settings, Disc3, Monitor, Radio, ShieldCheck, Target, 
  Dices, Percent, Award, Coins 
} from 'lucide-react';
import { PPlusIcon } from '@/components/icons';
import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { SystemConfig } from '@/types/system';

interface GroupBreak {
  id: string;
  title: string;
  imageUrl: string;
  pricePerSpot?: number;
  totalSpots?: number;
  breakType: 'spot' | 'team';
  spots?: { userId?: string }[];
  teams?: { userId?: string; price?: number }[];
  status: 'draft' | 'published' | 'in_progress' | 'completed';
  currency?: 'diamond' | 'p-point';
  createdAt: { seconds: number, nanoseconds: number };
}

const GroupBreakCard = ({ groupBreak, index, cardOpacity }: { groupBreak: GroupBreak, index: number, cardOpacity: number }) => {
  const b = groupBreak;
  const participantCount = b.breakType === 'team' 
    ? (b.teams?.filter(t => t.userId).length || 0)
    : (b.spots?.filter(s => s.userId).length || 0);
  
  const totalSpots = b.breakType === 'team'
    ? (b.teams?.length || 0)
    : (b.totalSpots || 0);

  const progress = totalSpots > 0 ? Math.min(100, Math.round((participantCount / totalSpots) * 100)) : 0;
  const isFull = totalSpots > 0 && participantCount >= totalSpots;
  const isCompleted = b.status === 'completed';
  const isInProgress = b.status === 'in_progress';
  const currency = b.currency || 'p-point';

  const minTeamPrice = useMemo(() => {
    if (b.breakType !== 'team' || !b.teams?.length) return 0;
    const prices = b.teams.map(t => t.price || 0).filter(p => p > 0);
    return prices.length ? Math.min(...prices) : 0;
  }, [b]);

  return (
    <Link 
        href={`/group-break/${b.id}`} 
        className={cn(
            "group relative flex flex-col p-3.5 sm:p-5 bg-gradient-to-b from-[#0e1f1a]/90 via-[#0a1514]/95 to-[#050b0a]/95 border border-emerald-500/20 rounded-2xl sm:rounded-3xl shadow-[0_10px_35px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-emerald-400/60 hover:shadow-[0_0_30px_rgba(16,185,129,0.25)] hover:-translate-y-1 select-none",
            "animate-fade-in-up"
        )}
    >
        {/* 上方封面圖片容器 */}
        <div className="relative aspect-[16/10] sm:aspect-[16/10] rounded-xl sm:rounded-2xl overflow-hidden bg-slate-950/90 border border-emerald-500/20 shadow-inner flex items-center justify-center p-1.5 sm:p-2">
            {b.imageUrl && (
              <div 
                className="absolute inset-0 bg-cover bg-center blur-2xl scale-125 opacity-30 pointer-events-none"
                style={{ backgroundImage: `url(${b.imageUrl})` }}
              />
            )}
            <SafeImage 
                src={b.imageUrl} 
                alt={b.title} 
                fill 
                className={cn(
                    "object-contain p-1 transition-all duration-500 group-hover:scale-105",
                    isCompleted && "grayscale brightness-60"
                )} 
            />

            {/* 狀態標籤 */}
            <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1.5">
                {isCompleted ? (
                  <Badge className="bg-slate-900/90 text-slate-300 font-bold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-md border border-slate-700 shadow-md backdrop-blur-xs">
                    已結束
                  </Badge>
                ) : isInProgress ? (
                  <Badge className="bg-rose-500 text-white font-bold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-md shadow-md animate-pulse">
                    🔥 直播中
                  </Badge>
                ) : isFull ? (
                  <Badge className="bg-amber-500/90 text-slate-950 border border-amber-300 font-bold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-md shadow-md backdrop-blur-xs">
                    已滿團
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500 text-slate-950 border border-emerald-300 font-bold text-[10px] sm:text-xs px-2.5 py-0.5 rounded-md shadow-[0_0_12px_rgba(16,185,129,0.4)] backdrop-blur-xs">
                    ✨ 開團中
                  </Badge>
                )}
            </div>
        </div>

        {/* 下方標題與資訊欄 */}
        <div className="mt-3 space-y-2.5">
            <h3 className="font-headline text-base sm:text-lg font-black text-white tracking-tight group-hover:text-emerald-300 transition-colors line-clamp-1">
                {b.title}
            </h3>
            <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                    <span className="text-[10px] font-bold text-emerald-400/80 uppercase tracking-wider block">參與金額</span>
                    <div className="flex items-center gap-1.5">
                        {currency === 'diamond' ? (
                            <Gem className="w-4 h-4 text-cyan-400 shrink-0" />
                        ) : (
                            <PPlusIcon className="w-4 h-4 text-amber-400 shrink-0" />
                        )}
                        <span className="font-code text-xl sm:text-2xl font-black text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                            {b.breakType === 'spot' 
                              ? `${b.pricePerSpot?.toLocaleString()}` 
                              : minTeamPrice > 0 ? `${minTeamPrice.toLocaleString()} 起` : '依隊伍定價'}
                        </span>
                        {b.breakType === 'spot' && <span className="text-[10px] font-bold text-slate-400">/ 位置</span>}
                    </div>
                </div>

                <div className="text-right space-y-1">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-end gap-2">
                        <span>募集進度</span>
                        <span className="font-code text-white text-xs font-black">{participantCount} / {totalSpots}</span>
                    </div>
                    <div className="w-28 sm:w-36 h-2 bg-slate-900 rounded-full overflow-hidden border border-emerald-500/20">
                        <div className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-[0_0_8px_rgba(16,185,129,0.6)] transition-all duration-700" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </div>
        </div>
    </Link>
  );
};


export default function GroupBreakPage() {
  const firestore = useFirestore();
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
  
  const groupBreaksQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'groupBreaks'), where('status', 'in', ['published', 'in_progress', 'completed']));
  }, [firestore]);

  const { data: groupBreaks, isLoading } = useCollection<GroupBreak>(groupBreaksQuery);

  const { publishedBreaks, completedBreaks } = useMemo(() => {
    if (!groupBreaks) return { publishedBreaks: [], completedBreaks: [] };
    const sorted = [...groupBreaks].sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
    const active = sorted.filter(b => b.status === 'published' || b.status === 'in_progress');
    const completed = sorted.filter(b => b.status === 'completed');
    return { publishedBreaks: active, completedBreaks: completed };
  }, [groupBreaks]);

  const displayedCompletedBreaks = showAllCompleted ? completedBreaks : completedBreaks.slice(0, 4);

  if (!isLoading && systemConfig?.featureFlags?.isGroupBreakEnabled === false) {
    return (
        <div className="container py-32 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in-up">
            <div className="p-10 rounded-full bg-cyan-500/10 border border-cyan-500/20 animate-pulse shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                <Settings className="w-20 h-20 text-cyan-400" />
            </div>
            <div className="space-y-3">
                <h2 className="text-4xl font-black font-headline tracking-widest text-white italic">維護中</h2>
                <p className="text-muted-foreground font-medium max-w-md mx-auto leading-relaxed">
                    團拆正在調整直播串流配置與獎品派發系統，請各位藏友耐心等候。
                </p>
            </div>
            <Button asChild variant="outline" className="h-12 px-10 rounded-xl border-cyan-500/30 hover:bg-cyan-500/5 text-cyan-400 font-bold transition-all">
                <Link href="/">返回榮耀大廳</Link>
            </Button>
        </div>
    )
  }

  const cardOpacity = systemConfig?.cardOpacity ?? 0.85;

  return (
    <div className="min-h-screen relative overflow-hidden pb-24 text-white">
      {/* Background Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1100px] h-[450px] bg-gradient-to-b from-emerald-500/15 via-teal-500/10 to-transparent blur-[140px] pointer-events-none -z-10" />

      <div className="container px-3 sm:px-6 py-3 sm:py-8 max-w-7xl mx-auto space-y-5 sm:space-y-10">

        {/* === HERO SECTION: 賽博直播團拆 === */}
        <div className="relative rounded-2xl sm:rounded-3xl md:rounded-[2.5rem] p-3.5 sm:p-6 md:p-8 overflow-hidden border border-emerald-500/25 bg-gradient-to-b from-[#0e1f1a]/90 via-[#0a1514]/95 to-[#050b0a] shadow-[0_20px_60px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
            {/* Background Grid Pattern */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#10b98110_1px,transparent_1px),linear-gradient(to_bottom,#10b98110_1px,transparent_1px)] bg-[size:32px_32px] opacity-60 pointer-events-none" />
            
            {/* Top Glow Accent Bar */}
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#34d399]" />
            
            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between gap-3 sm:gap-6 md:gap-12">
                <div className="space-y-2 sm:space-y-3 text-center lg:text-left max-w-2xl">
                    <h1 className="font-headline text-2xl sm:text-4xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-300 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)] tracking-tight leading-none uppercase">
                        直播團拆
                    </h1>

                    <p className="text-xs sm:text-sm md:text-base text-slate-300 font-medium leading-normal">
                        線上實體拆盒直播，公開公正分配熱門球星卡。
                    </p>

                    {/* Rules Quick Dialog Button */}
                    <div className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-2">
                        <Dialog>
                            <DialogTrigger asChild>
                                <Button className="h-8 sm:h-10 px-4 sm:px-5 rounded-lg sm:rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 text-xs sm:text-sm font-black shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all gap-1.5 group cursor-pointer">
                                    <Dices className="w-3.5 h-3.5 text-slate-950 group-hover:rotate-45 transition-transform" />
                                    <span>玩法說明</span>
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="rounded-[2rem] bg-slate-950 border border-emerald-500/30 text-white max-w-2xl backdrop-blur-2xl shadow-2xl">
                                <DialogHeader>
                                    <DialogTitle className="text-xl md:text-2xl font-black text-emerald-400 flex items-center gap-2 font-headline">
                                        <Target className="w-6 h-6 text-emerald-400" />
                                        團拆模式規則說明
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-3 text-sm text-slate-300">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                            <div className="flex items-center gap-2 text-emerald-400 font-bold">
                                                <Users className="w-4 h-4" /> 自由認購位置
                                            </div>
                                            <p className="text-xs text-slate-400">購買「團拆活動」中的特定位置或隊伍名額。</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                            <div className="flex items-center gap-2 text-teal-400 font-bold">
                                                <Award className="w-4 h-4" /> 滿團即安排拆卡
                                            </div>
                                            <p className="text-xs text-slate-400">當所有名額售出後，活動狀態轉為「已滿團」備拆。</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                            <div className="flex items-center gap-2 text-rose-400 font-bold">
                                                <Radio className="w-4 h-4" /> 線上直播拆盒
                                            </div>
                                            <p className="text-xs text-slate-400">平台安排線上直播，現場開封實體卡盒配對分配。</p>
                                        </div>
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 space-y-1.5">
                                            <div className="flex items-center gap-2 text-emerald-300 font-bold">
                                                <ShieldCheck className="w-4 h-4" /> 開獎紀錄查驗
                                            </div>
                                            <p className="text-xs text-slate-400">活動結束後可隨時於頁面回放查看最終配對結果。</p>
                                        </div>
                                    </div>
                                </div>
                            </DialogContent>
                        </Dialog>

                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg sm:rounded-xl bg-white/5 border border-emerald-500/20 text-[11px] text-slate-300">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                            <span>即時直播保護</span>
                        </div>
                    </div>
                </div>

                {/* Live Stats Widget */}
                <div className="grid grid-cols-2 gap-2 sm:gap-3 w-full lg:w-auto shrink-0">
                    <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#091512] border border-emerald-500/30 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(16,185,129,0.15)]">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">開團中場次</span>
                        <span className="text-xl sm:text-3xl font-black font-headline text-emerald-400 mt-0.5 sm:mt-1">
                            {isLoading ? '--' : publishedBreaks.length}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">熱烈募集中</span>
                    </div>

                    <div className="p-2.5 sm:p-4 rounded-xl sm:rounded-2xl bg-[#091512] border border-teal-500/30 flex flex-col items-center justify-center text-center shadow-[0_4px_20px_rgba(20,184,166,0.15)]">
                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider">歷史團拆</span>
                        <span className="text-xl sm:text-3xl font-black font-headline text-teal-300 mt-0.5 sm:mt-1">
                            {isLoading ? '--' : completedBreaks.length}
                        </span>
                        <span className="text-[9px] sm:text-[10px] text-slate-400 mt-0.5">精彩回顧</span>
                    </div>

                    <div className="p-2 sm:p-3 rounded-xl sm:rounded-2xl bg-[#091512] border border-emerald-500/30 flex flex-col items-center justify-center text-center shadow-lg col-span-2">
                        <div className="flex items-center gap-1.5">
                            <Gem className="w-3.5 h-3.5 text-emerald-400 animate-bounce" />
                            <span className="text-[11px] sm:text-xs font-bold text-emerald-300">線上直播 • 公平拆卡</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        {/* === 正在開團中的場次 === */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                <Radio className="w-4 h-4 sm:w-5 sm:h-5 text-emerald-400 animate-pulse" />
              </div>
              <h2 className="text-base sm:text-xl font-black tracking-wide font-headline text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-300 drop-shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                正在開團中的場次
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-6">
            {isLoading && Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="aspect-video rounded-2xl overflow-hidden bg-slate-900/50 border border-white/10"><Skeleton className="h-full w-full" /></div>
            ))}
            {!isLoading && publishedBreaks.map((b, i) => (
              <GroupBreakCard key={b.id} groupBreak={b} index={i} cardOpacity={cardOpacity} />
            ))}
            {!isLoading && publishedBreaks.length === 0 && (
                <div className="col-span-full text-center py-12 sm:py-16 text-slate-400 border border-dashed border-white/10 rounded-2xl bg-slate-900/40 backdrop-blur-md space-y-1">
                    <p className="font-bold text-sm tracking-wide">目前沒有正在開團或播映的場次</p>
                    <p className="text-xs text-slate-500">請關注官方發布訊息，下一波團拆即將上架！</p>
                </div>
            )}
          </div>
        </div>

        {/* === 精彩回顧紀錄 === */}
        <div className="space-y-4 sm:space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 sm:gap-3">
              <div className="p-1.5 sm:p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              </div>
              <h2 className="text-base sm:text-xl font-black tracking-wide font-headline text-transparent bg-clip-text bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-300 drop-shadow-[0_0_12px_rgba(245,158,11,0.3)]">
                精彩回顧紀錄
              </h2>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-6 opacity-90">
            {!isLoading && displayedCompletedBreaks.map((b, i) => (
              <GroupBreakCard key={b.id} groupBreak={b} index={i} cardOpacity={cardOpacity} />
            ))}
            {!isLoading && completedBreaks.length === 0 && (
                <div className="col-span-full text-center py-12 text-slate-500 italic text-xs">
                    <p>目前沒有已完成的團拆紀錄。</p>
                </div>
            )}
          </div>

          {!isLoading && completedBreaks.length > 4 && (
            <div className="pt-2 flex justify-center">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setShowAllCompleted(!showAllCompleted)}
                className="rounded-xl px-6 h-10 border-cyan-500/30 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 font-bold shadow-lg transition-all"
              >
                {showAllCompleted ? (
                  <><ChevronUp className="mr-1.5 h-4 w-4" /> 收合紀錄</>
                ) : (
                  <><ChevronDown className="mr-1.5 h-4 w-4" /> 查看更多紀錄 ({completedBreaks.length - 4})</>
                )}
              </Button>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
