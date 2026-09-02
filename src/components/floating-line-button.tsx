'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { X, MessageCircleCode, Radio, Users, Sparkles } from 'lucide-react';
import type { SystemConfig } from '@/types/system';
import { useAuth, useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { claimCommunityFreeDraw } from '@/lib/promo-draw-service';
import confetti from 'canvas-confetti';

export function FloatingLineButton({ systemConfig }: { systemConfig: SystemConfig | null }) {
  const [isLiveVisible, setIsLiveVisible] = useState(true);
  const [isSupportVisible, setIsSupportVisible] = useState(true);
  const [isCommunityVisible, setIsCommunityVisible] = useState(true);
  const [isClaiming, setIsClaiming] = useState(false);

  const { user } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();

  // Reset visibility if config changes
  useEffect(() => {
    setIsLiveVisible(true);
    setIsSupportVisible(true);
    setIsCommunityVisible(true);
  }, [systemConfig?.isLiveEnabled, systemConfig?.liveYoutubeUrl, systemConfig?.isSupportEnabled, systemConfig?.supportLineUrl, systemConfig?.isCommunityEnabled, systemConfig?.communityUrl]);

  const handleCommunityClick = async (e: React.MouseEvent) => {
    const targetUrl = systemConfig?.communityUrl || 'https://line.me/ti/g2/';

    if (!user || !firestore) {
      toast({
        title: '歡迎加入官方社群！',
        description: '登入會員後點擊即可自動領取「免費首抽券 1 張」！'
      });
      return;
    }

    if (isClaiming) return;
    setIsClaiming(true);

    try {
      const res = await claimCommunityFreeDraw(firestore, user.uid, '官方社群');
      if (res.success && !res.alreadyClaimed) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.7 }
        });
        toast({
          title: '🎉 加入社群送首抽成功！',
          description: '感謝加入社群！已為您發送免費抽卡券 1 張，快去抽卡吧！'
        });
      } else if (res.alreadyClaimed) {
        toast({
          title: '歡迎前往官方社群！',
          description: '您已領取過社群專屬免費首抽券，歡迎在社群與卡友交流！'
        });
      }
    } catch (err: any) {
      console.error('Error claiming community reward:', err);
    } finally {
      setIsClaiming(false);
    }
  };

  if (!isLiveVisible && !isSupportVisible && !isCommunityVisible) return null;

  return (
    <div className={cn(
      "fixed right-3.5 bottom-[calc(max(env(safe-area-inset-bottom),0px)+5.8rem)] md:right-8 md:bottom-8 z-40",
      "flex flex-col gap-3.5 md:gap-4 items-end pointer-events-auto"
    )}>
      {/* Live 直播跳球 */}
      {systemConfig?.isLiveEnabled && systemConfig.liveYoutubeUrl && isLiveVisible && (
        <div className="relative group/live">
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsLiveVisible(false);
            }}
            className={cn(
              "absolute -top-1.5 -right-1.5 z-[60] p-1 rounded-full border shadow-md",
              "bg-slate-950/90 backdrop-blur-md border-red-500/40 text-red-300",
              "hover:bg-red-600 hover:text-white hover:border-red-400 transition-all duration-200",
              "cursor-pointer"
            )}
            title="關閉直播球"
          >
            <X className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>

          <Link
            href={systemConfig.liveYoutubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex flex-col items-center justify-center w-15 h-15 md:w-18 md:h-18",
              "rounded-full shadow-[0_0_25px_rgba(239,68,68,0.45)] transition-all duration-300",
              "bg-red-600/95 backdrop-blur-xl border-2 border-red-400/60",
              "hover:scale-105 active:scale-95",
              "hover:bg-red-600 hover:shadow-[0_0_35px_rgba(239,68,68,0.7)]"
            )}
          >
            <div className="relative">
              <Radio className="w-6 h-6 md:w-8 md:h-8 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.9)]" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white shadow-sm"></span>
              </span>
            </div>
            <span className="text-[10px] md:text-[11px] font-black text-white mt-0.5 whitespace-nowrap tracking-tight">
              LIVE直播
            </span>
          </Link>
        </div>
      )}

      {/* 客服跳球 */}
      {systemConfig?.isSupportEnabled && systemConfig.supportLineUrl && isSupportVisible && (
        <div className="relative group/support">
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsSupportVisible(false);
            }}
            className={cn(
              "absolute -top-1.5 -right-1.5 z-[60] p-1 rounded-full border shadow-md",
              "bg-slate-950/90 backdrop-blur-md border-[#06C755]/40 text-[#06C755]",
              "hover:bg-[#06C755] hover:text-slate-950 hover:border-[#06C755] transition-all duration-200",
              "cursor-pointer"
            )}
            title="關閉客服球"
          >
            <X className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>

          <Link
            href={systemConfig.supportLineUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "flex flex-col items-center justify-center w-15 h-15 md:w-18 md:h-18",
              "rounded-full shadow-[0_0_25px_rgba(6,199,85,0.4)] transition-all duration-300",
              "bg-[#080d19]/95 backdrop-blur-xl border-2 border-[#06C755]/60",
              "hover:scale-105 active:scale-95",
              "hover:border-[#06C755] hover:shadow-[0_0_35px_rgba(6,199,85,0.7)]"
            )}
          >
            <div className="relative">
              <MessageCircleCode className="w-6 h-6 md:w-8 md:h-8 text-[#06C755] drop-shadow-[0_0_10px_rgba(6,199,85,0.9)]" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#06C755] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#06C755] shadow-sm"></span>
              </span>
            </div>
            <span className="text-[10px] md:text-[11px] font-black text-[#06C755] mt-0.5 whitespace-nowrap tracking-tight">
              LINE客服
            </span>
          </Link>
        </div>
      )}

      {/* 社群跳球 */}
      {systemConfig?.isCommunityEnabled && systemConfig.communityUrl && isCommunityVisible && (
        <div className="relative group/community">
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsCommunityVisible(false);
            }}
            className={cn(
              "absolute -top-1.5 -right-1.5 z-[60] p-1 rounded-full border shadow-md",
              "bg-slate-950/90 backdrop-blur-md border-blue-400/50 text-blue-300",
              "hover:bg-blue-600 hover:text-white hover:border-blue-300 transition-all duration-200",
              "cursor-pointer"
            )}
            title="關閉社群球"
          >
            <X className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>

          <Link
            href={systemConfig.communityUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCommunityClick}
            className={cn(
              "flex flex-col items-center justify-center w-15 h-15 md:w-18 md:h-18 relative",
              "rounded-full shadow-[0_0_25px_rgba(59,130,246,0.45)] transition-all duration-300",
              "bg-[#080d19]/95 backdrop-blur-xl border-2 border-blue-500/60",
              "hover:scale-105 active:scale-95",
              "hover:border-blue-400 hover:shadow-[0_0_35px_rgba(59,130,246,0.7)]"
            )}
          >
            {/* 首抽獎勵徽章 */}
            <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded-full shadow-[0_0_10px_rgba(245,158,11,0.5)] border border-amber-200 animate-bounce whitespace-nowrap z-10 flex items-center gap-0.5">
              <Sparkles className="w-2.5 h-2.5 fill-slate-950" /> 送首抽
            </span>

            <div className="relative">
              <Users className="w-6 h-6 md:w-8 md:h-8 text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.9)]" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-400 shadow-sm"></span>
              </span>
            </div>
            <span className="text-[10px] md:text-[11px] font-black text-blue-400 mt-0.5 whitespace-nowrap tracking-tight">
              加入社群
            </span>
          </Link>
        </div>
      )}
    </div>
  );
}
