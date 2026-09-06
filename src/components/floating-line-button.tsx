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
        description: '登入會員後點擊即可自動領取「免費抽卡券 1 張」！'
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
          title: '🎉 加入社群成功領取！',
          description: '感謝加入社群！已為您發送免費抽卡券 1 張，快去抽卡吧！'
        });
      } else if (res.alreadyClaimed) {
        toast({
          title: '歡迎前往官方社群！',
          description: '您已領取過社群專屬免費抽卡券，歡迎在社群與卡友交流！'
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
      "fixed right-3.5 bottom-[calc(max(env(safe-area-inset-bottom),0px)+5.5rem)] md:right-7 md:bottom-8 z-40",
      "flex flex-col gap-2.5 sm:gap-3 items-end pointer-events-auto"
    )}>
      {/* Live 直播跳球 */}
      {systemConfig?.isLiveEnabled && systemConfig.liveYoutubeUrl && isLiveVisible && (
        <div className="relative group/live">
          {/* 關閉按鈕：放置於左上角，徹底避開右上角狀態徽章 */}
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsLiveVisible(false);
            }}
            className={cn(
              "absolute -top-1 -left-1 z-[60] w-4.5 h-4.5 flex items-center justify-center rounded-full border shadow-md transition-all duration-200",
              "bg-slate-950/95 backdrop-blur-md border-red-500/50 text-red-300",
              "hover:bg-red-600 hover:text-white hover:border-red-400 cursor-pointer active:scale-95"
            )}
            title="關閉直播按鈕"
          >
            <X className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>

          <Link
            href={systemConfig.liveYoutubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="LIVE直播"
            className={cn(
              "flex items-center justify-center w-12 h-12 sm:w-[50px] sm:h-[50px]",
              "rounded-full shadow-[0_0_18px_rgba(239,68,68,0.45)] transition-all duration-300",
              "bg-red-600/95 backdrop-blur-xl border-2 border-red-400/80",
              "hover:scale-105 active:scale-95",
              "hover:bg-red-600 hover:shadow-[0_0_26px_rgba(239,68,68,0.7)]"
            )}
          >
            <div className="relative flex items-center justify-center">
              <Radio className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white shadow-sm"></span>
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* 客服跳球 */}
      {systemConfig?.isSupportEnabled && systemConfig.supportLineUrl && isSupportVisible && (
        <div className="relative group/support">
          {/* 關閉按鈕：放置於左上角 */}
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsSupportVisible(false);
            }}
            className={cn(
              "absolute -top-1 -left-1 z-[60] w-4.5 h-4.5 flex items-center justify-center rounded-full border shadow-md transition-all duration-200",
              "bg-slate-950/95 backdrop-blur-md border-[#06C755]/50 text-[#06C755]",
              "hover:bg-[#06C755] hover:text-slate-950 hover:border-[#06C755] cursor-pointer active:scale-95"
            )}
            title="關閉客服按鈕"
          >
            <X className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>

          <Link
            href={systemConfig.supportLineUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="LINE客服"
            className={cn(
              "flex items-center justify-center w-12 h-12 sm:w-[50px] sm:h-[50px]",
              "rounded-full shadow-[0_0_18px_rgba(6,199,85,0.4)] transition-all duration-300",
              "bg-[#080d19]/95 backdrop-blur-xl border-2 border-[#06C755]/80",
              "hover:scale-105 active:scale-95",
              "hover:border-[#06C755] hover:shadow-[0_0_26px_rgba(6,199,85,0.7)]"
            )}
          >
            <div className="relative flex items-center justify-center">
              <MessageCircleCode className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-[#06C755] drop-shadow-[0_0_8px_rgba(6,199,85,0.9)]" />
              <span className="absolute -top-1 -right-1 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#06C755] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#06C755] shadow-sm"></span>
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* 社群跳球 (精巧圓圈、無重疊干擾、清晰免領券提示) */}
      {systemConfig?.isCommunityEnabled && systemConfig.communityUrl && isCommunityVisible && (
        <div className="relative group/community">
          {/* 關閉按鈕：放置於左上角，與右上角免費券徽章分開 */}
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsCommunityVisible(false);
            }}
            className={cn(
              "absolute -top-1 -left-1 z-[60] w-4.5 h-4.5 flex items-center justify-center rounded-full border shadow-md transition-all duration-200",
              "bg-slate-950/95 backdrop-blur-md border-cyan-400/50 text-cyan-300",
              "hover:bg-red-600 hover:text-white hover:border-red-400 cursor-pointer active:scale-95"
            )}
            title="關閉社群按鈕"
          >
            <X className="w-2.5 h-2.5 stroke-[2.5]" />
          </button>

          <Link
            href={systemConfig.communityUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCommunityClick}
            title="加入官方社群（點擊領取免費券）"
            className={cn(
              "flex items-center justify-center w-12 h-12 sm:w-[50px] sm:h-[50px] relative",
              "rounded-full shadow-[0_0_20px_rgba(6,182,212,0.45)] transition-all duration-300",
              "bg-gradient-to-br from-cyan-950/90 via-slate-900/95 to-slate-950/98 backdrop-blur-xl",
              "border-2 border-cyan-400/85 hover:border-cyan-300",
              "hover:scale-105 active:scale-95",
              "hover:shadow-[0_0_28px_rgba(34,211,238,0.7)]"
            )}
          >
            <div className="relative flex items-center justify-center">
              <Users className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.9)] group-hover/community:text-cyan-200 transition-colors" />
              
              {/* 右上角領券發光小徽章 */}
              <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 text-[9px] font-black text-slate-950 shadow-[0_0_8px_rgba(251,191,36,0.8)] border border-amber-200">
                券
              </span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
