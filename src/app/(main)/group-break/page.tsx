'use client';

import { useCollection, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, query, where, orderBy, doc } from 'firebase/firestore';
import Link from 'next/link';
import { SafeImage } from '@/components/safe-image';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Users, Users2, Info, ChevronDown, ChevronUp, Sparkles, Gem, ChevronRight, Package, Trophy, Settings, Disc3, Monitor, Radio } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Separator } from '@/components/ui/separator';
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
  teams?: { userId?: string }[];
  status: 'draft' | 'published' | 'completed';
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

  const progress = totalSpots > 0 ? (participantCount / totalSpots) * 100 : 0;
  const isFull = totalSpots > 0 && participantCount >= totalSpots;
  const isCompleted = b.status === 'completed';

  return (
    <Link 
        href={`/group-break/${b.id}`} 
        className={cn(
            "group relative flex flex-col p-4 bg-slate-800 border-b-[8px] border-r-[8px] border-slate-950 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.5)] transition-all duration-500 hover:-translate-y-2",
            "animate-fade-in-up"
        )}
    >
        <div className="relative flex-1 flex flex-col bg-slate-900 rounded-[1.5rem] p-3 md:p-5 border-b-4 border-white/5 shadow-inner overflow-hidden">
            <div className="relative flex-1 aspect-video rounded-xl overflow-hidden bg-black shadow-[inset:0_0_20px_rgba(0,0,0,1)] border-2 border-slate-950">
                <SafeImage 
                    src={b.imageUrl} 
                    alt={b.title} 
                    fill 
                    className={cn(
                        "object-cover transition-all duration-1000 group-hover:scale-110 opacity-80",
                        isCompleted && "grayscale brightness-50"
                    )} 
                />
                
                <div className="absolute inset-0 pointer-events-none z-10 opacity-[0.08] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-[length:100%_3px,4px_100%]" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent z-10" />

                <div className="absolute top-2 right-2 z-20">
                    <Badge variant={isCompleted ? "secondary" : isFull ? "destructive" : "default"} className="font-black text-xs tracking-widest uppercase border-none shadow-xl px-3 py-1">
                        {isCompleted ? '已結束' : isFull ? '已滿團' : '直播中'}
                    </Badge>
                </div>

                <div className="absolute inset-0 flex flex-col justify-end p-4 md:p-6 z-20">
                    <h3 className="font-headline text-lg md:text-2xl font-black text-white tracking-tighter drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)] group-hover:text-primary transition-colors line-clamp-1">
                        {b.title}
                    </h3>
                </div>
            </div>

            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col gap-2 opacity-40 group-hover:opacity-100 transition-opacity hidden md:flex">
                <div className="w-4 h-4 rounded-full bg-slate-950 border border-white/5 shadow-inner" />
                <div className="w-4 h-4 rounded-full bg-slate-950 border border-white/5 shadow-inner" />
                <div className="w-1 h-8 bg-slate-950 mx-auto rounded-full" />
            </div>
        </div>

        <div className="mt-5 px-2 space-y-4">
            <div className="flex justify-between items-end">
                <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-red-600 shadow-[0_0_5px_red] animate-pulse" />
                        <p className="text-xs font-black text-white/40 uppercase tracking-[0.2em]">頻道訊號穩定</p>
                    </div>
                    <div className="flex items-baseline gap-2">
                        <span className="font-code text-2xl md:text-3xl font-black text-primary drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                            {b.breakType === 'spot' ? b.pricePerSpot?.toLocaleString() : '依隊伍定價'}
                        </span>
                        <span className="text-[10px] font-bold text-white/30 uppercase tracking-widest">參與金額</span>
                    </div>
                </div>
                <div className="text-right">
                    <div className="flex justify-between text-xs font-black uppercase tracking-widest text-white/60 mb-2">
                        <span>募集進度</span>
                        <span className="font-code ml-4">{participantCount} / {totalSpots}</span>
                    </div>
                    <div className="w-40 h-2 bg-black/40 rounded-full overflow-hidden border border-white/5 shadow-inner">
                        <div className="h-full bg-primary shadow-[0_0_10px_rgba(6,182,212,0.6)] transition-all duration-1000" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </div>
            
            <div className="flex justify-center gap-16 opacity-40">
                <div className="w-6 h-1.5 bg-slate-950 rounded-full" />
                <div className="w-6 h-1.5 bg-slate-950 rounded-full" />
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
    return query(collection(firestore, 'groupBreaks'), where('status', 'in', ['published', 'completed']));
  }, [firestore]);

  const { data: groupBreaks, isLoading } = useCollection<GroupBreak>(groupBreaksQuery);

  const { publishedBreaks, completedBreaks } = useMemo(() => {
    if (!groupBreaks) return { publishedBreaks: [], completedBreaks: [] };
    const sorted = [...groupBreaks].sort((a, b) => b.createdAt.seconds - a.createdAt.seconds);
    const published = sorted.filter(b => b.status === 'published');
    const completed = sorted.filter(b => b.status === 'completed');
    return { publishedBreaks: published, completedBreaks: completed };
  }, [groupBreaks]);

  const displayedCompletedBreaks = showAllCompleted ? completedBreaks : completedBreaks.slice(0, 4);

  if (!isLoading && systemConfig?.featureFlags?.isGroupBreakEnabled === false) {
    return (
        <div className="container py-32 flex flex-col items-center justify-center min-h-[60vh] text-center space-y-8 animate-fade-in-up">
            <div className="p-10 rounded-full bg-primary/10 border border-primary/20 animate-pulse shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                <Settings className="w-20 h-20 text-primary" />
            </div>
            <div className="space-y-3">
                <h2 className="text-4xl font-black font-headline tracking-widest text-white italic">專區維護中</h2>
                <p className="text-muted-foreground font-medium max-w-md mx-auto leading-relaxed">
                    團拆專區正在調整直播串流配置與獎品派發系統，請各位藏友耐心等候。
                </p>
            </div>
            <Button asChild variant="outline" className="h-12 px-10 rounded-xl border-primary/30 hover:bg-primary/5 text-primary font-bold transition-all">
                <Link href="/">返回榮耀大廳</Link>
            </Button>
        </div>
    )
  }

  const cardOpacity = systemConfig?.cardOpacity ?? 0.85;

  return (
    <div className="container py-12 md:py-20 relative overflow-hidden px-4 md:px-8">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-primary/5 blur-[120px] pointer-events-none" />

      {/* 右上角規則按鈕 */}
      <div className="absolute top-4 right-4 md:top-10 md:right-10 z-30">
          <Dialog>
              <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="h-9 w-9 md:w-auto px-0 md:px-4 rounded-full border-white/10 bg-white/5 backdrop-blur-md hover:bg-primary/10 hover:border-primary/30 text-white font-bold transition-all gap-2">
                      <Info className="h-4 w-4 text-primary" />
                      <span className="text-xs uppercase tracking-widest hidden md:inline">遊戲規則</span>
                  </Button>
              </DialogTrigger>
              <DialogContent className="rounded-[2.5rem] bg-background/95 backdrop-blur-2xl border-primary/20 shadow-2xl">
                  <DialogHeader>
                      <DialogTitle className="text-2xl font-black font-headline text-primary italic tracking-tighter uppercase">團拆模式規則說明</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-5 text-sm text-white/80 leading-relaxed py-2">
                      <div className="p-5 rounded-3xl bg-white/5 border border-white/10 space-y-4">
                          <p className="flex items-start gap-4"><span className="text-primary font-black font-code text-lg">01.</span> 玩家購買「團拆活動」中的特定位置或隊伍。</p>
                          <p className="flex items-start gap-4"><span className="text-primary font-black font-code text-lg">02.</span> 當所有名額售出後，此活動狀態會變為「已滿團」。</p>
                          <p className="flex items-start gap-4"><span className="text-primary font-black font-code text-lg">03.</span> 平台會安排線上直播，現場開封實體卡盒並分配獎項。</p>
                          <p className="flex items-start gap-4"><span className="text-primary font-black font-code text-lg">04.</span> 活動結束後，可於頁面查看最終的開獎配對結果。</p>
                      </div>
                  </div>
              </DialogContent>
          </Dialog>
      </div>

      <div className="text-center mb-12 md:mb-16 relative z-10 space-y-4">
        <div className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold tracking-[0.3em] uppercase animate-fade-in-up">
                <Monitor className="w-3 h-3 text-primary animate-pulse" /> LIVE UNBOXING CHANNELS
            </div>
        </div>
        
        <div className="flex items-center justify-center animate-fade-in-up">
            <h1 className="font-headline text-3xl font-black tracking-[0.2em] sm:text-6xl text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.4)]">
                團拆專區
            </h1>
        </div>
      </div>

      <div className="space-y-16 md:space-y-24 max-w-5xl mx-auto">
        <section>
          <div className="mb-8 md:mb-10 flex items-center justify-between animate-fade-in-up">
            <h2 className="flex items-center text-lg md:text-xl font-bold font-headline text-white tracking-widest uppercase text-left">
                <Radio className="w-5 h-5 md:w-6 md:h-6 mr-3 text-red-500 animate-pulse" />
                正在播映場次
            </h2>
            <div className="h-px flex-1 mx-4 md:mx-6 bg-gradient-to-r from-primary/30 to-transparent hidden md:block" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
            {isLoading && Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="aspect-video rounded-[2.5rem] overflow-hidden bg-card/20"><Skeleton className="h-full w-full" /></div>
            ))}
            {!isLoading && publishedBreaks.map((b, i) => (
              <GroupBreakCard key={b.id} groupBreak={b} index={i} cardOpacity={cardOpacity} />
            ))}
            {!isLoading && publishedBreaks.length === 0 && (
                <div className="col-span-full text-center py-20 md:py-24 text-muted-foreground border border-dashed border-white/5 rounded-[2.5rem] bg-card/20 backdrop-blur-md">
                    <p className="font-bold tracking-widest uppercase opacity-40">目前沒有正在播映的場次</p>
                </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-8 md:mb-10 flex items-center justify-between animate-fade-in-up">
            <h2 className="flex items-center text-lg md:text-xl font-bold font-headline text-muted-foreground tracking-widest uppercase text-left">
                <Trophy className="w-5 h-5 md:w-6 md:h-6 mr-3" />
                精彩回顧紀錄
            </h2>
            <div className="h-px flex-1 mx-4 md:mx-6 bg-gradient-to-r from-white/10 to-transparent hidden md:block" />
          </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12 opacity-80">
            {!isLoading && displayedCompletedBreaks.map((b, i) => (
              <GroupBreakCard key={b.id} groupBreak={b} index={i} cardOpacity={cardOpacity} />
            ))}
            {!isLoading && completedBreaks.length === 0 && (
                <div className="col-span-full text-center py-20 text-muted-foreground italic">
                    <p>目前沒有已完成的團拆紀錄。</p>
                </div>
            )}
          </div>

          {!isLoading && completedBreaks.length > 4 && (
            <div className="mt-10 md:mt-12 flex justify-center">
              <Button 
                variant="outline" 
                size="lg" 
                onClick={() => setShowAllCompleted(!showAllCompleted)}
                className="rounded-full px-8 md:px-10 h-12 md:h-14 border-primary/20 bg-primary/5 hover:bg-primary/10 font-black shadow-xl transition-all"
              >
                {showAllCompleted ? (
                  <><ChevronUp className="mr-2 h-5 w-5" /> 收合名單</>
                ) : (
                  <><ChevronDown className="mr-2 h-5 w-5" /> 查看更多紀錄 ({completedBreaks.length - 4})</>
                )}
              </Button>
            </div>
          )}
        </section>
      </div>

      <div className="mt-20 text-center flex flex-col items-center opacity-20">
        <p className="text-[10px] md:text-[12px] text-muted-foreground font-headline uppercase tracking-[0.5em] origin-center scale-[0.2]">P+Carder Official Transmission Channel • Link Stable</p>
      </div>
    </div>
  );
}
