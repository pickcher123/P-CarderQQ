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
              "absolute -top-2.5 -right-2.5 sm:-top-3 sm:-right-3 z-[60] w-6 h-6 flex items-center justify-center rounded-full border shadow-xl transition-all duration-200",
              "bg-slate-950/95 backdrop-blur-md border-red-500/50 text-red-300",
              "hover:bg-red-600 hover:text-white hover:border-red-400 cursor-pointer active:scale-95"
            )}
            title="關閉直播按鈕"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <Link
            href={systemConfig.liveYoutubeUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="LIVE直播"
            className={cn(
              "flex items-center justify-center w-[72px] h-[72px] sm:w-20 sm:h-20",
              "rounded-full shadow-[0_0_30px_rgba(239,68,68,0.5)] transition-all duration-300",
              "bg-red-600/95 backdrop-blur-xl border-2 border-red-400/70",
              "hover:scale-105 active:scale-95",
              "hover:bg-red-600 hover:shadow-[0_0_40px_rgba(239,68,68,0.8)]"
            )}
          >
            <div className="relative flex items-center justify-center">
              <Radio className="w-8 h-8 sm:w-9 sm:h-9 text-white drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-white shadow-sm"></span>
              </span>
            </div>
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
              "absolute -top-2.5 -right-2.5 sm:-top-3 sm:-right-3 z-[60] w-6 h-6 flex items-center justify-center rounded-full border shadow-xl transition-all duration-200",
              "bg-slate-950/95 backdrop-blur-md border-[#06C755]/50 text-[#06C755]",
              "hover:bg-[#06C755] hover:text-slate-950 hover:border-[#06C755] cursor-pointer active:scale-95"
            )}
            title="關閉客服按鈕"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <Link
            href={systemConfig.supportLineUrl}
            target="_blank"
            rel="noopener noreferrer"
            title="LINE客服"
            className={cn(
              "flex items-center justify-center w-[72px] h-[72px] sm:w-20 sm:h-20",
              "rounded-full shadow-[0_0_30px_rgba(6,199,85,0.45)] transition-all duration-300",
              "bg-[#080d19]/95 backdrop-blur-xl border-2 border-[#06C755]/70",
              "hover:scale-105 active:scale-95",
              "hover:border-[#06C755] hover:shadow-[0_0_40px_rgba(6,199,85,0.8)]"
            )}
          >
            <div className="relative flex items-center justify-center">
              <MessageCircleCode className="w-8 h-8 sm:w-9 sm:h-9 text-[#06C755] drop-shadow-[0_0_12px_rgba(6,199,85,0.9)]" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#06C755] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-[#06C755] shadow-sm"></span>
              </span>
            </div>
          </Link>
        </div>
      )}

      {/* 社群跳球 */}
      {systemConfig?.isCommunityEnabled && systemConfig.communityUrl && isCommunityVisible && (
        <div className="relative group/community flex items-center">
          <button
            onClick={(e) => {
              e.preventDefault();
              setIsCommunityVisible(false);
            }}
            className={cn(
              "absolute -top-2.5 -right-2.5 sm:-top-3 sm:-right-3 z-[60] w-6 h-6 flex items-center justify-center rounded-full border shadow-xl transition-all duration-200",
              "bg-slate-950/95 backdrop-blur-md border-blue-400/50 text-blue-300",
              "hover:bg-red-600 hover:text-white hover:border-red-400 cursor-pointer active:scale-95"
            )}
            title="關閉社群按鈕"
          >
            <X className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>

          <Link
            href={systemConfig.communityUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleCommunityClick}
            title="加入官方社群（領取免費券）"
            className={cn(
              "flex items-center justify-center w-[72px] h-[72px] sm:w-20 sm:h-20 relative",
              "rounded-full shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all duration-300",
              "bg-[#080d19]/95 backdrop-blur-xl border-2 border-blue-500/70",
              "hover:scale-105 active:scale-95",
              "hover:border-blue-400 hover:shadow-[0_0_40px_rgba(59,130,246,0.8)]"
            )}
          >
            <div className="relative flex items-center justify-center">
              <Users className="w-8 h-8 sm:w-9 sm:h-9 text-blue-400 drop-shadow-[0_0_12px_rgba(59,130,246,0.9)]" />
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-400 shadow-sm"></span>
              </span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
