'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CardItem } from '@/components/card-item';
import { RandomPlayerCard } from '@/components/random-player-card';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as VisuallyHiddenPrimitive from "@radix-ui/react-visually-hidden";
import { Gem, Sparkles, Loader2, RotateCcw, ArrowLeft, PlayCircle, FastForward, Check, Disc3, RotateCw, Clock, ChevronsUp, X, ShieldCheck, Star, Trophy, Layers, Zap, AlertCircle, Ban, ChevronRight, Hash, Download } from 'lucide-react';
import { PackPreview, RevealComponent, DrawResults, CelebrationVFX, CloveSummoningAnimation } from '@/components/draw';
import { rarityVisuals, pointPrizeRarityStyles } from '@/lib/draw-constants';
import { drawFromPool } from '@/lib/draw-utils';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, where, getDoc, doc, serverTimestamp, increment, runTransaction, getDocs, updateDoc, Timestamp, limit, setDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';
import type { UserProfile } from '@/types/user-profile';
import type { SystemConfig } from '@/types/system';
import type { Card, CardPool, DrawnPrize, PointPrize, Rarity, Step } from '@/types/draw';
import { Logo, PPlusIcon } from '@/components/icons';
import { DrawButtons } from '@/components/draw-buttons';
import { Badge } from '@/components/ui/badge';
import { userLevels } from '@/components/member-level-crown';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { performDrawAction } from '@/app/actions/draw';
import { toPng } from 'html-to-image';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  console.error('Firestore Error Object: ', error);
  const auth = getAuth(getApp());
  
  // 紀錄完整的除錯資訊到 console
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || 'unknown',
      email: auth.currentUser?.email || 'unknown',
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName || '',
        email: provider.email || '',
        photoUrl: provider.photoURL || ''
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error Info: ', errInfo.error, errInfo.path, errInfo.authInfo);

  // 轉換為親切提示
  let userFriendlyMessage = '系統發生異常，請稍後再試。';
  const errorMessage = errInfo.error.toLowerCase();

  if (errorMessage.includes('permission')) {
    userFriendlyMessage = '權限不足，請重新整理頁面。';
  } else if (errorMessage.includes('unavailable') || errorMessage.includes('timeout')) {
    userFriendlyMessage = '交易逾時，若點數已扣除請稍候查看背包。';
  } else if (errorMessage.includes('insufficient') || errorMessage.includes('點數不足')) {
    userFriendlyMessage = '點數不足，無法進行抽卡。';
  } else if (errorMessage.includes('fully sold') || errorMessage.includes('sold out')) {
    userFriendlyMessage = '卡包已售罄。';
  }

  throw new Error(userFriendlyMessage);
}

// Types moved to @/types/draw.ts

const LOCK_DURATION = 120;

export default function OpenPackPage() {
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();
    const searchParams = useSearchParams();
    const router = useRouter();
    const { toast } = useToast();
    
    const [step, setStep] = useState<Step>('init-loading');
    const [isTrialMode, setIsTrialMode] = useState(false);
    const [drawnPrizes, setDrawnPrizes] = useState<DrawnPrize[]>([]);
    const [sessionPrizes, setSessionPrizes] = useState<DrawnPrize[]>([]); 
    const [revealedIndex, setRevealedIndex] = useState(-1);
    const [error, setError] = useState<string | null>(null);
    const [cashbackPPoints, setCashbackPPoints] = useState(0);
    const [cardPool, setCardPool] = useState<CardPool | null>(null);
    const [lockCountdown, setLockCountdown] = useState<number>(LOCK_DURATION);
    const [showCelebration, setShowCelebration] = useState<'none' | 'rare' | 'legendary'>('none');
    const [revealPercent, setRevealPercent] = useState(0);
    const [isSqueezing, setIsSqueezing] = useState(false);
    const [isChanging, setIsChanging] = useState(false); 
    const [landingVFX, setLandingVFX] = useState<'none' | 'rare' | 'legendary'>('none');
    const [previewCard, setPreviewCard] = useState<any | null>(null);

    const topRarityCelebration = useMemo(() => {
        if (drawnPrizes.length === 0) return 'none';
        const hasLegendary = drawnPrizes.some(p => p.rarity === 'legendary');
        const hasRare = drawnPrizes.some(p => p.rarity === 'rare');
        return hasLegendary ? 'legendary' : (hasRare ? 'rare' : 'none');
    }, [drawnPrizes]);
    
    // Reset timer on draw
    useEffect(() => {
        if (step === 'ready-to-reveal' || step === 'revealing') {
            setLockCountdown(LOCK_DURATION);
        }
    }, [step, revealedIndex]);

    const squeezeRef = useRef<HTMLDivElement>(null);
    const startY = useRef(0);
    const poolId = searchParams.get('poolId');
    const initialDrawCount = parseInt(searchParams.get('draws') || '1', 10);
    
    const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
    const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);
    const userProfileRef = useMemoFirebase(() => (firestore && user) ? doc(firestore, "users", user.uid) : null, [firestore, user]);
    const { data: userProfile } = useDoc<UserProfile>(userProfileRef);
    
    const [isMounted, setIsMounted] = useState(false);
    useEffect(() => { setIsMounted(true); }, []);

    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const poolStatsRef = useMemoFirebase(() => 
        (firestore && user?.uid && poolId) ? doc(firestore, 'users', user.uid, 'poolStats', poolId) : null, 
        [firestore, user?.uid, poolId]
    );
    const { data: poolStats, isLoading: isLoadingStats } = useDoc<any>(poolStatsRef);

    const todayDrawCount = useMemo(() => {
        if (!poolStats || poolStats.lastDrawDate !== todayStr) return 0;
        return poolStats.count || 0;
    }, [poolStats, todayStr]);

    const isLimitReachedForInitial = useMemo(() => {
        if (!cardPool?.dailyLimit || cardPool.dailyLimit <= 0) return false;
        if (isLoadingStats) return true;
        return todayDrawCount + initialDrawCount > cardPool.dailyLimit;
    }, [cardPool, todayDrawCount, initialDrawCount, isLoadingStats]);

    const isLimitReachedForSingle = useMemo(() => {
        if (!cardPool?.dailyLimit || cardPool.dailyLimit <= 0) return false;
        return todayDrawCount + 1 > cardPool.dailyLimit;
    }, [cardPool, todayDrawCount]);

    useEffect(() => {
        if (!isMounted || step === 'done' || step === 'error' || step === 'waiting-to-start' || step === 'init-loading') return;
        const timer = setInterval(() => {
            setLockCountdown(prev => Math.max(0, prev - 1));
        }, 1000);
        return () => clearInterval(timer);
    }, [isMounted, step]);

    useEffect(() => {
        if (!firestore || !poolId) return;
        getDoc(doc(firestore, 'cardPools', poolId)).then(snap => {
            if (!snap.exists()) throw new Error("找不到指定的卡池。");
            const poolData = { id: snap.id, ...snap.data() } as CardPool;
            
            // 檢查是否處於 120 秒開獎保護鎖定狀態 (僅對已登入且非鎖定者進行提示)
            if (user && poolData.hasProtection !== false && poolData.lockedAt && poolData.lockedBy && poolData.lockedBy !== user.uid) {
                const lockSecs = typeof (poolData.lockedAt as any).seconds === 'number'
                    ? (poolData.lockedAt as any).seconds
                    : Math.floor(new Date(poolData.lockedAt as any).getTime() / 1000);
                const diff = Math.floor(Date.now() / 1000 - lockSecs);
                if (diff < LOCK_DURATION) {
                    throw new Error(`此卡池正處於 120 秒開獎保護中（由其他玩家鎖定中，剩餘 ${LOCK_DURATION - diff} 秒），請稍後再試。`);
                }
            }

            setCardPool(poolData);
            setStep('waiting-to-start');
        }).catch(e => { 
            console.error(e);
            setError(e.message); 
            setStep('error'); 
        });
    }, [firestore, poolId, user]);

    const cardsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'cards') : null), [firestore]);
    const { data: allCards } = useCollection<Card>(cardsRef);
    const allCardsMap = useMemo(() => {
        const map = new Map<string, Card>();
        allCards?.forEach(c => map.set(c.id, c));
        return map;
    }, [allCards]);

    const performTrialDraw = useCallback((count: number) => {
        if (!cardPool) return;
        setIsTrialMode(true);
        const { drawn } = drawFromPool(cardPool, count, allCardsMap);
        if (drawn.length === 0) {
            toast({ variant: 'destructive', title: '告示', description: '卡池目前已無獎項可供試手氣。' });
            return;
        }
        setDrawnPrizes(drawn);
        setSessionPrizes(prev => [...prev, ...drawn]);
        setRevealedIndex(0);
        setRevealPercent(0);
        setIsSqueezing(false);
        setShowCelebration('none');
        setLandingVFX('none');
        setStep('summoning');
        toast({
            title: '🧪 免費試手氣模式啟動',
            description: '此為純模擬開獎體驗，完全未扣除點數，亦不會派發卡牌與扣減庫存！',
        });
    }, [cardPool, allCardsMap, toast]);

    // Auto-trigger trial if URL param has trial=true
    useEffect(() => {
        if (cardPool && searchParams.get('trial') === 'true' && step === 'waiting-to-start') {
            performTrialDraw(initialDrawCount);
        }
    }, [cardPool, searchParams, step, initialDrawCount, performTrialDraw]);

    const performDraw = useCallback(async (count: number) => {
        if (!user) {
            toast({ variant: 'destructive', title: '請先登入', description: '正式開獎需要登入帳戶以扣除點數與發放卡牌。' });
            return;
        }
        if (!firestore || !cardPool) {
            toast({ variant: 'destructive', title: '錯誤', description: '系統尚未就緒，請重試。' });
            return;
        }
        if (!poolId) return;

        setStep('loading');
        
        try {
            const result = await runTransaction(firestore, async (transaction) => {
                const userDocRef = doc(firestore, 'users', user.uid);
                const poolDocRef = doc(firestore, 'cardPools', poolId);
                const poolStatsRef = doc(firestore, 'users', user.uid, 'poolStats', poolId);                

                // 1. 讀取最新資料
                const userSnap = await transaction.get(userDocRef);
                const poolSnap = await transaction.get(poolDocRef);
                const poolStatsSnap = await transaction.get(poolStatsRef);

                if (!poolSnap.exists()) throw new Error('此卡池已下架或不存在。');
                
                let userData = userSnap.data();
                if (!userSnap.exists()) {
                    userData = {
                        id: user.uid,
                        username: user.displayName || '新玩家',
                        points: 1000,
                        bonusPoints: 0,
                        role: 'user',
                        userLevel: '普通會員',
                        createdAt: serverTimestamp()
                    };
                    transaction.set(userDocRef, userData);
                }

                const poolData = poolSnap.data() as CardPool;

                // 驗證 120 秒開獎保護鎖定
                if (poolData.hasProtection !== false && poolData.lockedAt && poolData.lockedBy && poolData.lockedBy !== user.uid) {
                    const lockSecs = typeof (poolData.lockedAt as any).seconds === 'number'
                        ? (poolData.lockedAt as any).seconds
                        : Math.floor(new Date(poolData.lockedAt as any).getTime() / 1000);
                    const diff = Math.floor(Date.now() / 1000 - lockSecs);
                    if (diff < LOCK_DURATION) {
                        throw new Error(`開獎保護中：其他玩家正在開獎，請稍等 ${LOCK_DURATION - diff} 秒。`);
                    }
                }

                const cost = count === 3 && cardPool.price3Draws ? cardPool.price3Draws : (cardPool.price || 0) * count;
                const currencyField = cardPool.currency === 'p-point' ? 'bonusPoints' : 'points';
                const balance = (userData as any)[currencyField] || 0;

                if (balance < cost) throw new Error('點數不足，無法抽卡。');

                // 2. 進行抽選
                const { drawn, updatedCards } = drawFromPool(poolData, count);

                if (drawn.length === 0) throw new Error('卡池目前已無獎項可供抽取。');

                // 3. 處理獲獎結果並存檔
                for (const prize of drawn) {
                    // 儲存卡片到使用者收藏
                    const newUserCardRef = doc(collection(firestore, 'users', user.uid, 'userCards'));
                    const serialNumber = `${Math.floor(Math.random() * 9000) + 1000}`;
                    transaction.set(newUserCardRef, {
                        cardId: (prize as any).id,
                        userId: user.uid,
                        category: (prize as any).category,
                        rarity: (prize as any).rarity,
                        isFoil: (prize as any).rarity === 'legendary',
                        source: 'draw',
                        poolId: poolId,
                        serialNumber: serialNumber,
                        createdAt: serverTimestamp()
                    });
                    // 同步更新本地顯示的 ID (雖然目前是用 prize.id，但我們可以多加資訊)
                    (prize as any).serialNumber = serialNumber;
                }

                // 4. 套用使用者資產更新 (扣除花費)
                const updateFields: any = {};
                if (cardPool.currency === 'p-point') {
                    updateFields.bonusPoints = increment(-cost);
                } else {
                    updateFields.points = increment(-cost);
                }
                transaction.update(userDocRef, updateFields);

                // 5. 更新卡池資料
                transaction.update(poolDocRef, {
                    remainingPacks: increment(-drawn.length),
                    cards: updatedCards
                });

                // 6. 紀錄交易日誌
                const transactionRef = doc(collection(firestore, 'transactions'));
                transaction.set(transactionRef, {
                    userId: user.uid,
                    transactionType: 'Draw',
                    currency: cardPool.currency || 'diamond',
                    amount: -cost,
                    details: `在卡池 [${cardPool.name}] 進行 ${count} 連抽`,
                    transactionDate: serverTimestamp(),
                    section: 'draw'
                });

                // 紀錄抽卡日誌
                const logRef = doc(collection(firestore, 'drawnCardLogs'));
                transaction.set(logRef, {
                    userId: user.uid,
                    poolId: poolId,
                    agentId: cardPool.agentId || null,
                    drawnAt: serverTimestamp(),
                    cost: cost,
                    count: count
                });
                
                // 7. 更新統計 (統計邏輯)
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const poolStatsData = poolStatsSnap.exists() ? poolStatsSnap.data() : { count: 0, lastDrawDate: '' };
                const newCount = (poolStatsData.lastDrawDate === todayStr ? (poolStatsData.count || 0) : 0) + drawn.length;
                transaction.set(poolStatsRef, {
                  count: newCount,
                  lastDrawDate: todayStr
                }, { merge: true });

                return { drawn };
            });

            if (result && result.drawn) {
                // 非同步更新頁面狀態
                setDrawnPrizes(result.drawn);
                setSessionPrizes(prev => [...prev, ...result.drawn]);
                setRevealedIndex(0);
                setRevealPercent(0);
                setIsSqueezing(false);
                setShowCelebration('none');
                setLandingVFX('none');
                setStep('summoning');
            }

        } catch (error: any) {
            console.error("抽卡失敗:", error);
            setError(error.message);
            setStep('error');
            
            if (error.message.includes('permission')) {
                toast({ 
                    variant: 'destructive', 
                    title: '連線被阻擋', 
                    description: 'Firestore 規則可能已恢復限制，請確認 Rules 設定。' 
                });
            }
        }
    }, [poolId, firestore, user, cardPool, toast]);

    const handleSqueezeStart = (e: React.PointerEvent) => { 
        if (step !== 'ready-to-reveal' || isChanging) return; 
        window.getSelection()?.removeAllRanges();
        setIsSqueezing(true); 
        startY.current = e.clientY; 
        (e.target as HTMLElement).setPointerCapture(e.pointerId); 
    };
    
    const handleSqueezeMove = (e: React.PointerEvent) => { 
        if (!isSqueezing) return; 
        const deltaY = startY.current - e.clientY; 
        const containerHeight = squeezeRef.current?.offsetHeight || 400; 
        setRevealPercent(Math.max(0, Math.min(100, (deltaY / (containerHeight * 0.6)) * 100))); 
    };
    
    const handleSqueezeEnd = () => { 
        if (!isSqueezing) return; 
        setIsSqueezing(false); 
        if (revealPercent > 60) { 
            completeReveal();
        } else {
            setRevealPercent(0); 
        }
    };

    const completeReveal = () => {
        setRevealPercent(100); 
        setStep('revealing'); 
        const p = drawnPrizes[revealedIndex]; 
        if (p && rarityVisuals[p.rarity].celebration !== 'none') {
            setShowCelebration(rarityVisuals[p.rarity].celebration);
        }
    };

    const nextPrize = () => {
        if (isChanging) return;
        window.getSelection()?.removeAllRanges();
        
        setIsChanging(true);
        setRevealPercent(0);
        setIsSqueezing(false);
        setShowCelebration('none');
        
        setTimeout(() => {
            setRevealedIndex(prev => prev + 1);
            setStep('ready-to-reveal');
            
            setTimeout(() => {
                setIsChanging(false);
            }, 200);
        }, 400);
    };

    const skipAllToDone = () => {
        window.getSelection()?.removeAllRanges();
        setIsChanging(false);
        setIsSqueezing(false);
        setRevealPercent(100);
        setShowCelebration('none');
        setRevealedIndex(drawnPrizes.length - 1);
        setStep('done');
    };

    const activeBackgroundUrl = '/draw_background.png';

    if (step === 'init-loading' || !isMounted) {
        return (
            <div 
                className="flex h-screen items-center justify-center bg-background relative overflow-hidden"
                style={{ backgroundImage: `url("${activeBackgroundUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[5]" />
                <div className="relative z-10">
                    <Loader2 className="animate-spin text-primary w-12 h-12" />
                </div>
            </div>
        );
    }

    if (step === 'waiting-to-start' && cardPool) {
        const levelNames = userLevels.map(l => l.level);
        const userLevelIdx = userProfile ? levelNames.indexOf(userProfile.userLevel) : -1;
        const minLevelIdx = cardPool.minLevel ? levelNames.indexOf(cardPool.minLevel) : 0;
        const isLevelMet = userLevelIdx >= minLevelIdx;
        
        return (
            <div 
                className="flex flex-col justify-between items-center h-[100dvh] min-h-[100dvh] w-full p-2 sm:p-4 relative overflow-hidden select-none" 
                style={{ backgroundImage: `url("${activeBackgroundUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[5]" />
                <div className="relative z-10 w-full h-full flex flex-col justify-center items-center">
                    <PackPreview 
                        cardPool={cardPool}
                        initialDrawCount={initialDrawCount}
                        isLevelMet={isLevelMet}
                        isLimitReachedForInitial={isLimitReachedForInitial}
                        isLoadingStats={isLoadingStats}
                        performDraw={(count) => performDraw(count)}
                    />
                </div>
            </div>
        );
    }

    if (step === 'loading' || step === 'error') {
        return (
            <div 
                className="flex flex-col h-screen items-center justify-center p-6 text-white select-none relative overflow-hidden"
                style={{ backgroundImage: `url("${activeBackgroundUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[5]" />
                <div className="relative z-10 flex flex-col items-center justify-center">
                    <Loader2 className="animate-spin text-primary w-12 h-12 mb-4" />
                    <p className="text-muted-foreground">{step === 'loading' ? '正在從資料庫讀取卡包...' : error}</p>
                    {step === 'error' && <Button className="mt-6 rounded-xl font-bold px-10" asChild><Link href="/draw">返回抽卡</Link></Button>}
                </div>
            </div>
        );
    }

    if (step === 'summoning' && drawnPrizes.length > 0) {
        return (
            <CloveSummoningAnimation
                highestRarity={topRarityCelebration}
                drawCount={drawnPrizes.length}
                poolName={cardPool?.name || '頂級卡包'}
                backgroundUrl={activeBackgroundUrl}
                onAnimationComplete={() => {
                    setStep('ready-to-reveal');
                }}
            />
        );
    }

    const currentPrize = drawnPrizes[revealedIndex];
    const visual = currentPrize ? (rarityVisuals[currentPrize.rarity] || rarityVisuals.common) : rarityVisuals.common;

    const canDraw3 = !isLoadingStats && (!cardPool?.dailyLimit || cardPool.dailyLimit === 0 || (todayDrawCount + 3 <= cardPool.dailyLimit));
    const canDraw10 = !isLoadingStats && (!cardPool?.dailyLimit || cardPool.dailyLimit === 0 || (todayDrawCount + 10 <= cardPool.dailyLimit));

    return (
        <div 
            className="flex flex-col justify-between items-center h-[100dvh] min-h-[100dvh] w-full p-2 sm:p-4 relative overflow-hidden select-none" 
            style={{ backgroundImage: `url("${activeBackgroundUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
        >
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[5]" />
            <CelebrationVFX type={landingVFX !== 'none' ? landingVFX : showCelebration} />
            
            {/* Top Navigation Bar */}
            <div className="w-full flex items-center justify-between z-[25] shrink-0 px-1 pt-1">
                <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => router.back()} 
                    className="font-bold text-white/60 hover:text-white hover:bg-white/10 text-xs h-8 px-2 rounded-xl transition-all"
                >
                    <ArrowLeft className="mr-1 h-3.5 w-3.5" /> 返回
                </Button>

                {step !== 'done' && step !== 'waiting-to-start' && step !== 'init-loading' && (
                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase shadow-lg backdrop-blur-md">
                        <ShieldCheck className="h-3 w-3" /> 保護時間剩餘 {lockCountdown}s
                    </div>
                )}

                {/* Top-Right Quick Skip & Settlement Button */}
                {step !== 'done' && step !== 'waiting-to-start' && step !== 'init-loading' && drawnPrizes.length > 0 ? (
                    <Button
                        size="sm"
                        onClick={skipAllToDone}
                        className="h-8 px-3 rounded-full bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-black text-[10px] sm:text-xs shadow-[0_0_15px_rgba(245,158,11,0.4)] border border-amber-300/40 gap-1 active:scale-95 transition-all"
                    >
                        <Zap className="w-3 h-3 fill-slate-950" />
                        <span>一鍵跳過結算</span>
                    </Button>
                ) : (
                    <div className="w-12" />
                )}
            </div>
            
            {/* Status & Title Header */}
            <div className="w-full flex flex-col items-center justify-center shrink-0 z-[15] select-none py-1 min-h-[48px]">
                {(step === 'ready-to-reveal' || step === 'revealing') && currentPrize && revealPercent === 100 && (
                    <div className="text-center animate-fade-in-up select-none max-w-xs px-2">
                        <p className="text-[10px] text-white/50 uppercase font-black tracking-[0.2em]">
                            {currentPrize.type === 'last-prize' ? '🎉 最後賞限定' : `第 ${revealedIndex + 1} / ${drawnPrizes.length} 項`}
                        </p>
                        <div className="flex items-center justify-center gap-1.5 mt-0.5">
                            {(currentPrize.type === 'points') ? (
                                <div className="flex items-center gap-1.5">
                                    <PPlusIcon className="w-5 h-5 text-sky-400" />
                                    <span className="text-xl sm:text-2xl font-black font-headline text-white">+{currentPrize.points}</span>
                                </div>
                            ) : (
                                <h2 className="text-base sm:text-xl font-headline font-black text-white uppercase drop-shadow-lg truncate max-w-[260px]">
                                    {currentPrize.name}
                                </h2>
                            )}
                        </div>
                        <p className={cn("text-[10px] font-black uppercase tracking-[0.25em] mt-0.5", visual.color)}>
                            {visual.label}
                        </p>
                    </div>
                )}
                {step === 'done' && (
                    <div className="text-center animate-fade-in-up select-none">
                        <h2 className="text-xl sm:text-3xl font-headline font-black text-white uppercase italic drop-shadow-[0_0_20px_rgba(6,182,212,0.4)]">
                            開獎結算
                        </h2>
                        <p className="text-[10px] sm:text-xs text-primary font-bold mt-0.5 uppercase tracking-wider">
                            本次共獲得 {sessionPrizes.length} 項戰利品
                        </p>
                    </div>
                )}
            </div>

            {/* Central Stage: Scratch / Reveal OR Result Shelf */}
            {step !== 'done' ? (
                <div className="flex-1 flex flex-col items-center justify-center w-full relative z-[20] min-h-0 py-1">
                    <motion.div 
                        initial={{ y: -600, opacity: 0, scale: 0.3, rotate: -30, filter: 'blur(30px)' }}
                        animate={{ y: 0, opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
                        onAnimationComplete={() => {
                            if (topRarityCelebration !== 'none' && landingVFX === 'none') {
                                setLandingVFX(topRarityCelebration);
                                setTimeout(() => setLandingVFX('none'), 2000);
                            }
                        }}
                        transition={{ 
                            type: 'spring', 
                            stiffness: 140, 
                            damping: 12,
                            mass: 1.2
                        }}
                        className="flex flex-col items-center w-[min(60vw,200px)] sm:w-[220px] relative max-h-[46dvh] aspect-[2.5/4]"
                    >
                        <div className={cn(
                            "relative p-1 bg-slate-900 border-[4px] sm:border-[5px] border-slate-950 rounded-[1.8rem] sm:rounded-[2.2rem] shadow-2xl overflow-hidden w-full h-full transition-all duration-700", 
                            step === 'revealing' && revealPercent === 100 && visual.glow
                        )}>
                            <div 
                                ref={squeezeRef} 
                                className="relative bg-transparent rounded-[1rem] border-[3px] sm:border-[4px] border-slate-950 overflow-hidden w-full h-full flex items-center justify-center touch-none cursor-pointer select-none transition-transform duration-100"
                                style={{ transform: isSqueezing ? `perspective(1000px) rotateX(${revealPercent * 0.2}deg) rotateY(-${revealPercent * 0.1}deg) scale(1.03)` : 'none' }}
                                onPointerDown={handleSqueezeStart} 
                                onPointerMove={handleSqueezeMove} 
                                onPointerUp={handleSqueezeEnd} 
                                onPointerCancel={handleSqueezeEnd}
                            >
                                <div className={cn(
                                    "relative w-full h-full z-10 flex items-center justify-center pointer-events-none p-1 select-none transition-opacity duration-200",
                                    isChanging ? "opacity-0" : "opacity-100"
                                )}>
                                    {currentPrize && (
                                        (currentPrize.type === 'card' || currentPrize.type === 'last-prize') ? (
                                            <div className="relative w-full h-full rounded-lg sm:rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                                                <CardItem 
                                                    name={currentPrize.name} 
                                                    imageUrl={currentPrize.imageUrl} 
                                                    backImageUrl={currentPrize.backImageUrl} 
                                                    imageHint={currentPrize.name} 
                                                    rarity={currentPrize.rarity} 
                                                    serialNumber={currentPrize.serialNumber} 
                                                    isFlippable={true} 
                                                    priority 
                                                />
                                            </div>
                                        ) : (
                                            <div className={cn("w-full h-full flex flex-col items-center justify-center p-2 rounded-lg sm:rounded-xl shadow-inner border-2", pointPrizeRarityStyles[currentPrize.rarity].bg, pointPrizeRarityStyles[currentPrize.rarity].border)}>
                                                <PPlusIcon className={cn("w-12 h-12 sm:w-16 sm:h-16 mb-2 sm:mb-4 drop-shadow-[0_0_20px_currentColor]", pointPrizeRarityStyles[currentPrize.rarity].text)} />
                                                <p className="font-headline text-2xl sm:text-4xl font-black text-white drop-shadow-lg">{currentPrize.points}</p>
                                                <Badge variant="outline" className="mt-2 border-white/20 text-[7px] sm:text-[8px] font-black uppercase tracking-widest text-white/40">Digital Bonus</Badge>
                                            </div>
                                        )
                                    )}
                                </div>
                                
                                <div 
                                    className={cn(
                                        "absolute inset-0 z-30 bg-slate-900 rounded-lg sm:rounded-xl border-2 sm:border-4 border-primary/50 flex flex-col items-center justify-center pointer-events-none select-none shadow-[inset_0_0_20px_rgba(6,182,212,0.3)]",
                                        (!isSqueezing && (revealPercent === 0 || isChanging)) ? "" : "transition-all duration-500 ease-out",
                                        (revealPercent >= 100) ? "opacity-0" : "opacity-100"
                                    )} 
                                    style={{ transform: `translateY(-${revealPercent}%)` }} 
                                >
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-primary blur-xl opacity-30 animate-pulse" />
                                        <Disc3 className="w-10 h-10 sm:w-12 sm:h-12 text-primary animate-spin-slow mb-2 sm:mb-3 relative z-10" />
                                    </div>
                                    <span className="font-headline text-xs sm:text-sm font-black text-primary tracking-[0.25em] italic drop-shadow-md">P+ CARDER</span>
                                    <p className="text-[9px] text-primary/60 mt-2 sm:mt-3 animate-pulse uppercase font-black tracking-widest">往上掀開</p>
                                </div>
                            </div>
                        </div>

                        {step === 'ready-to-reveal' && (
                            <div className="flex items-center gap-2 mt-2 sm:mt-3">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={completeReveal}
                                    className="h-7 sm:h-8 px-3 sm:px-4 rounded-full bg-white/10 border border-white/20 text-[9px] sm:text-[10px] font-black text-primary uppercase tracking-wider hover:bg-primary/20 transition-all shadow-lg shrink-0"
                                >
                                    <FastForward className="w-3 h-3 mr-1 animate-pulse" /> 翻開本張
                                </Button>
                                {drawnPrizes.length > 1 && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={skipAllToDone}
                                        className="h-7 sm:h-8 px-3 sm:px-4 rounded-full bg-amber-500/20 border border-amber-500/40 text-[9px] sm:text-[10px] font-black text-amber-300 uppercase tracking-wider hover:bg-amber-500/30 transition-all shadow-lg shrink-0"
                                    >
                                        <Zap className="w-3 h-3 mr-1 text-amber-400 fill-amber-400" /> 全部跳過結算
                                    </Button>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>
            ) : (
                <div className="flex-1 w-full max-w-4xl px-2 sm:px-4 z-20 min-h-0 flex flex-col justify-center relative select-none py-1">
                    {/* Horizontal swipeable prize shelf */}
                    <div 
                        id="prize-scroll-container" 
                        className="flex flex-row gap-3 sm:gap-4 py-2 px-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth items-center min-h-0"
                    >
                        {sessionPrizes.map((p, i) => (
                            <div 
                                key={i} 
                                className="animate-fade-in-up snap-center w-[125px] sm:w-[170px] md:w-[200px] flex-shrink-0" 
                                style={{ animationDelay: `${i * 70}ms` }}
                            >
                                {p.type === 'points' || p.isPoints || p.name?.includes('隨機球員') ? (
                                    <div className="w-full aspect-[2.5/4]">
                                        <RandomPlayerCard 
                                            rarity={p.rarity} 
                                            points={p.points}
                                            title={p.name}
                                            onClick={() => setPreviewCard({ ...p, isPoints: true })} 
                                        />
                                    </div>
                                ) : (
                                    <div 
                                        className="w-full aspect-[2.5/4] rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl transition-all hover:scale-105 group border border-white/10 h-full cursor-zoom-in relative"
                                        onClick={() => setPreviewCard({ ...p, rarity: p.rarity })}
                                    >
                                        <CardItem 
                                            name={p.name} 
                                            imageUrl={p.imageUrl}
                                            backImageUrl={p.backImageUrl} 
                                            imageHint={p.name} 
                                            rarity={p.rarity} 
                                            className="h-full"
                                            isFlippable={false}
                                        />
                                        <div className="absolute inset-x-0 bottom-0 p-1.5 bg-gradient-to-t from-black/80 to-transparent flex items-center justify-center">
                                            <span className="text-[9px] text-white/70 font-bold truncate max-w-full">{p.name}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Left / Right Scroll Buttons on Desktop */}
                    {sessionPrizes.length > 2 && (
                        <>
                            <button 
                                className="absolute left-1 top-1/2 -translate-y-1/2 z-50 bg-black/70 backdrop-blur-md p-2.5 rounded-full border border-white/20 shadow-xl hover:bg-white/10 transition-all hidden md:flex items-center justify-center cursor-pointer text-white"
                                onClick={() => {
                                    const container = document.getElementById('prize-scroll-container');
                                    if (container) container.scrollBy({ left: -260, behavior: 'smooth' });
                                }}
                            >
                                <ChevronRight className="w-5 h-5 rotate-180" />
                            </button>

                            <button 
                                className="absolute right-1 top-1/2 -translate-y-1/2 z-50 bg-black/70 backdrop-blur-md p-2.5 rounded-full border border-white/20 shadow-xl hover:bg-white/10 transition-all hidden md:flex items-center justify-center cursor-pointer text-white"
                                onClick={() => {
                                    const container = document.getElementById('prize-scroll-container');
                                    if (container) container.scrollBy({ left: 260, behavior: 'smooth' });
                                }}
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </>
                    )}

                    <p className="text-center text-[10px] text-white/40 font-bold mt-1">
                        👉 左右滑動瀏覽戰利品 • 點擊卡片放大查看
                    </p>
                </div>
            )}

            {/* Bottom Action Area: Strictly Anchored, Compact & Mobile-Safe */}
            <div className="w-full max-w-sm shrink-0 z-30 pb-2 sm:pb-3 px-2">
                 {(step === 'revealing' || step === 'done') && (
                    <div className="bg-slate-950/90 backdrop-blur-2xl border border-white/15 p-2.5 sm:p-3.5 rounded-2xl sm:rounded-3xl w-full shadow-[0_10px_40px_rgba(0,0,0,0.85)] animate-fade-in-up transition-all space-y-2">
                        {cashbackPPoints > 0 && (
                            <div className="flex items-center justify-center gap-1.5 font-black text-[10px] uppercase text-accent animate-pulse">
                                <Sparkles className="w-3 h-3" />
                                <span>VIP回饋: +{cashbackPPoints}</span>
                                <PPlusIcon className="w-3 h-3" />
                            </div>
                        )}
                        
                        {step === 'revealing' && revealedIndex < drawnPrizes.length - 1 ? (
                            <div className="space-y-1.5">
                                <Button 
                                    onClick={nextPrize} 
                                    className="w-full h-11 sm:h-12 font-black bg-primary text-primary-foreground rounded-xl sm:rounded-2xl shadow-xl text-xs sm:text-sm hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                                >
                                    {drawnPrizes[revealedIndex+1]?.type === 'last-prize' ? '🎉 揭曉最後賞限定！' : `揭曉下一項 (${revealedIndex+1}/${drawnPrizes.length})`}
                                </Button>
                                <Button 
                                    variant="outline"
                                    onClick={skipAllToDone} 
                                    className="w-full h-8 font-black bg-amber-500/10 border-amber-500/30 text-amber-300 rounded-xl text-[11px] hover:bg-amber-500/20 active:scale-95 transition-all cursor-pointer gap-1"
                                >
                                    <Zap className="w-3 h-3 text-amber-400 fill-amber-400" />
                                    <span>跳過剩餘動畫，直接結算全部</span>
                                </Button>
                            </div>
                        ) : (step === 'done' || (step === 'revealing' && revealedIndex === drawnPrizes.length - 1)) && (
                            <div className="space-y-1.5">
                                <div className="flex gap-1.5 w-full">
                                    {isLimitReachedForSingle ? (
                                        <Button disabled className="flex-1 h-12 text-xs font-black rounded-xl bg-slate-800 text-slate-500 border border-slate-700 opacity-50 italic">
                                            今日次數已用完
                                        </Button>
                                    ) : (
                                        <DrawButtons 
                                            isLoadingStats={isLoadingStats}
                                            isLimitReachedForSingle={isLimitReachedForSingle}
                                            canDraw3={canDraw3}
                                            canDraw10={canDraw10}
                                            cardPool={cardPool}
                                            performDraw={performDraw}
                                        />
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                                    <Button asChild variant="outline" className="h-9 text-[11px] font-bold border-white/10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-200">
                                        <Link href="/draw">返回卡池</Link>
                                    </Button>
                                    
                                    {step === 'done' ? (
                                        <Button asChild variant="outline" className="h-9 text-[11px] font-bold border-primary/50 text-primary rounded-xl bg-primary/10 shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:bg-primary/20">
                                            <Link href="/collection">前往收藏庫</Link>
                                        </Button>
                                    ) : (
                                        <Button 
                                            onClick={() => setStep('done')} 
                                            variant="outline" 
                                            className="h-9 text-[11px] font-bold border-primary/50 text-primary rounded-xl bg-primary/10 shadow-[0_0_15px_rgba(6,182,212,0.25)] hover:bg-primary/20 cursor-pointer"
                                        >
                                            查看本次總結
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* Full Screen Card Zoom Dialog */}
            <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
                <DialogContent className="max-w-[min(92vw,400px)] bg-slate-950/95 backdrop-blur-2xl border border-white/20 rounded-3xl p-4 flex flex-col items-center justify-center gap-3 [&>button:last-child]:hidden z-[200]">
                    <DialogTitle><VisuallyHiddenPrimitive.Root>卡片預覽</VisuallyHiddenPrimitive.Root></DialogTitle>
                    {previewCard && (
                        <div className="w-full flex flex-col items-center gap-2">
                            <h2 className="text-xs sm:text-sm font-black text-white text-center px-2 uppercase truncate max-w-full">{previewCard.name}</h2>
                            <div className="w-full max-w-[260px] aspect-[2.5/4]">
                                {previewCard.isPoints || previewCard.type === 'points' || previewCard.name?.includes('隨機球員') ? (
                                    <RandomPlayerCard 
                                        rarity={previewCard.rarity} 
                                        points={previewCard.points} 
                                        title={previewCard.name}
                                        showBuybackHint={false} 
                                    />
                                ) : (
                                    <CardItem name={previewCard.name} imageUrl={previewCard.imageUrl} backImageUrl={previewCard.backImageUrl} imageHint={previewCard.name} rarity={previewCard.rarity} isFlippable={true}/>
                                )}
                            </div>
                            {!previewCard.isPoints && <p className="text-[10px] text-primary font-bold uppercase animate-pulse">點擊翻轉卡片</p>}
                        </div>
                    )}
                    <Button variant="ghost" size="icon" className="rounded-full bg-white/10 h-9 w-9 text-white hover:bg-white/20" onClick={() => setPreviewCard(null)}>
                        <X className="h-4 w-4" />
                    </Button>
                </DialogContent>
            </Dialog>
        </div>
    );
}