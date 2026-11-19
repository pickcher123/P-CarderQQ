'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { CardItem } from '@/components/card-item';
import { RandomPlayerCard } from '@/components/random-player-card';
import { cn, cleanFirestoreData } from '@/lib/utils';
import Image from 'next/image';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as VisuallyHiddenPrimitive from "@radix-ui/react-visually-hidden";
import { Gem, Sparkles, Loader2, RotateCcw, ArrowLeft, PlayCircle, FastForward, Check, Disc3, RotateCw, Clock, ChevronsUp, X, ShieldCheck, Star, Trophy, Layers, Zap, AlertCircle, Ban, ChevronRight, Hash, Download } from 'lucide-react';
import { PackPreview, RevealComponent, DrawResults, CelebrationVFX, CloveSummoningAnimation, KujiNumberPickerDialog, BoxOpeningStage } from '@/components/draw';
import { rarityVisuals, pointPrizeRarityStyles } from '@/lib/draw-constants';
import { drawFromPool, drawKujiTickets } from '@/lib/draw-utils';
import { createProvablyFairRound } from '@/lib/provably-fair';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useUser, useAuth, useDoc, useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { addDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { collection, query, where, getDoc, doc, serverTimestamp, increment, runTransaction, getDocs, updateDoc, Timestamp, limit, setDoc, onSnapshot } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getApp } from 'firebase/app';
import type { UserProfile } from '@/types/user-profile';
import type { SystemConfig } from '@/types/system';
import type { Card, CardPool, DrawnPrize, PointPrize, Rarity, Step } from '@/types/draw';
import { Logo, PPlusIcon, CrossedCardsIcon } from '@/components/icons';
import { DrawButtons } from '@/components/draw-buttons';
import { Badge } from '@/components/ui/badge';
import { userLevels } from '@/components/member-level-crown';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { performDrawAction, redeemSpBuybackAction } from '@/app/actions/draw';
import { getEffectiveTicketCount, syncLocalPromoClaimsToFirestore, getLocalAvailableTicketsCount } from '@/lib/promo-draw-service';
import {
  type PeelCorner,
  PEEL_CORNER_LABELS,
  detectPeelCorner,
  detectPeelDirectionFromSwipe,
  isNearCornerHotspot,
  computeCornerPeelPercent,
  getCornerPeelGeometry,
} from '@/lib/corner-peel';

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
    const [isPickNumberOpen, setIsPickNumberOpen] = useState(false);
    const [targetPickCount, setTargetPickCount] = useState<number>(1);

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

    const currentPrize = drawnPrizes[revealedIndex];
    const isLegendaryRevealed = (step === 'revealing' || revealPercent === 100) && currentPrize && (currentPrize.rarity === 'legendary' || currentPrize.type === 'last-prize');

    // 傳奇卡片震撼現世時觸發手機震動體感回饋
    useEffect(() => {
        if (isLegendaryRevealed && typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
                navigator.vibrate([60, 40, 100, 50, 180]);
            } catch {
                // ignore
            }
        }
    }, [isLegendaryRevealed]);

    const squeezeRef = useRef<HTMLDivElement>(null);
    const [peelCorner, setPeelCorner] = useState<PeelCorner>('tr');
    const startGestureRef = useRef<{
        x: number;
        y: number;
        time: number;
        width: number;
        height: number;
        corner: PeelCorner;
    }>({ x: 0, y: 0, time: 0, width: 230, height: 368, corner: 'tr' });
    const poolId = searchParams.get('poolId');
    const initialDrawCount = parseInt(searchParams.get('draws') || '1', 10);
    const isUsingTicket = searchParams.get('useTicket') === 'true';
    const isUsingEventTicket = searchParams.get('useEventTicket') === 'true';
    const isTrialParam = searchParams.get('trial') === 'true';
    
    const numbersParam = searchParams.get('numbers');
    const parsedInitialNumbers = useMemo(() => {
        if (!numbersParam) return [];
        return numbersParam.split(',')
            .map(n => parseInt(n.trim(), 10))
            .filter(n => !isNaN(n) && n > 0);
    }, [numbersParam]);
    const [selectedNumbers, setSelectedNumbers] = useState<number[]>([]);
    const hasAppliedInitialNumbersRef = useRef(false);

    useEffect(() => {
        if (!hasAppliedInitialNumbersRef.current && parsedInitialNumbers.length > 0) {
            setSelectedNumbers(parsedInitialNumbers);
            hasAppliedInitialNumbersRef.current = true;
        }
    }, [parsedInitialNumbers]);

    // 即時防護：若卡池籤表中的號碼已開出，強制自 selectedNumbers 中剔除
    useEffect(() => {
        if (cardPool?.kujiTickets && cardPool.kujiTickets.length > 0) {
            const drawnNums = new Set(cardPool.kujiTickets.filter(t => t.isDrawn).map(t => t.number));
            setSelectedNumbers(prev => {
                const filtered = prev.filter(num => !drawnNums.has(num));
                return filtered.length === prev.length ? prev : filtered;
            });
        }
    }, [cardPool?.kujiTickets]);

    useEffect(() => {
        if (isTrialParam) {
            setIsTrialMode(true);
        }
    }, [isTrialParam]);
    
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
        const unsub = onSnapshot(doc(firestore, 'cardPools', poolId), (snap) => {
            if (!snap.exists()) {
                setError("找不到指定的卡池。");
                setStep('error');
                return;
            }
            const poolData = { id: snap.id, ...snap.data() } as CardPool;
            
            // 檢查是否處於 120 秒開獎保護鎖定狀態 (僅對已登入且非鎖定者進行提示)
            if (user && poolData.hasProtection !== false && poolData.lockedAt && poolData.lockedBy && poolData.lockedBy !== user.uid) {
                const lockSecs = typeof (poolData.lockedAt as any).seconds === 'number'
                    ? (poolData.lockedAt as any).seconds
                    : Math.floor(new Date(poolData.lockedAt as any).getTime() / 1000);
                const diff = Math.floor(Date.now() / 1000 - lockSecs);
                if (diff < LOCK_DURATION) {
                    setError(`此卡池正處於 120 秒開獎保護中（由其他玩家鎖定中，剩餘 ${LOCK_DURATION - diff} 秒），請稍後再試。`);
                    setStep('error');
                    return;
                }
            }

            setCardPool(poolData);
            setStep(prev => (prev === 'loading' || prev === 'init-loading' ? 'waiting-to-start' : prev));
        }, (e) => { 
            console.error(e);
            setError(e.message); 
            setStep('error'); 
        });

        return () => unsub();
    }, [firestore, poolId, user]);

    const cardsRef = useMemoFirebase(() => (firestore ? collection(firestore, 'allCards') : null), [firestore]);
    const { data: allCards, isLoading: isLoadingCards } = useCollection<Card>(cardsRef);
    const allCardsMap = useMemo(() => {
        const map = new Map<string, Card>();
        allCards?.forEach(c => map.set(c.id, c));
        return map;
    }, [allCards]);

    // Dynamically enrich drawn prizes if allCardsMap loads or updates
    useEffect(() => {
        if (!allCardsMap || allCardsMap.size === 0) return;
        const enrichPrize = (p: DrawnPrize): DrawnPrize => {
            if (p.type === 'card' || p.type === 'last-prize') {
                const card = allCardsMap.get(p.id);
                if (card) {
                    const validCategory = (card.category && card.category !== '抽賞' && card.category !== 'all')
                        ? card.category
                        : ((p.category && p.category !== '抽賞' && p.category !== 'all') ? p.category : '一般');
                    return {
                        ...p,
                        name: card.name || p.name,
                        imageUrl: card.imageUrl || p.imageUrl,
                        backImageUrl: card.backImageUrl || p.backImageUrl,
                        category: validCategory,
                        rarity: p.rarity || card.rarity || 'common',
                        sellPrice: card.sellPrice ?? p.sellPrice ?? 0,
                        serialNumber: p.serialNumber || (card as any).serialNumber || '',
                    };
                }
            }
            return p;
        };
        setDrawnPrizes(prev => prev.map(enrichPrize));
        setSessionPrizes(prev => prev.map(enrichPrize));
    }, [allCardsMap]);

    const performTrialDraw = useCallback((count: number, chosenNumbers?: number[]) => {
        if (!cardPool) return;
        setIsTrialMode(true);
        let drawn: any[] = [];
        const numbersToDraw = (chosenNumbers && chosenNumbers.length > 0) ? chosenNumbers : (selectedNumbers.length > 0 ? selectedNumbers : undefined);
        const isKujiPool = !!(cardPool.enablePickNumber || (cardPool.kujiTickets && cardPool.kujiTickets.length > 0) || (numbersToDraw && numbersToDraw.length > 0));

        if (numbersToDraw && numbersToDraw.length > 0) {
            const kujiRes = drawKujiTickets(cardPool, numbersToDraw, numbersToDraw.length, allCardsMap);
            drawn = kujiRes.drawn;
        } else {
            const { drawn: normalDrawn } = drawFromPool(cardPool, count, allCardsMap, true);
            drawn = normalDrawn;
        }

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
        setSelectedNumbers([]);
        setTargetPickCount(undefined);
        if (typeof window !== 'undefined') {
            const url = new URL(window.location.href);
            if (url.searchParams.has('numbers') || url.searchParams.has('pick')) {
                url.searchParams.delete('numbers');
                url.searchParams.delete('pick');
                window.history.replaceState({}, '', url.toString());
            }
        }
        toast({
            title: numbersToDraw && numbersToDraw.length > 0
                ? `🎯 試抽自選號碼 (#${numbersToDraw.join(', #')})`
                : '🧪 免費試手氣模式啟動',
            description: '此為純模擬開獎體驗，完全未扣除點數，亦不會派發卡牌與扣減庫存！',
        });
    }, [cardPool, allCardsMap, toast, selectedNumbers]);

    // Auto-trigger pick number dialog if URL param has pick=true
    useEffect(() => {
        if (cardPool && searchParams.get('pick') === 'true' && step === 'waiting-to-start') {
            setIsPickNumberOpen(true);
        }
    }, [cardPool, searchParams, step]);

    const performDraw = useCallback(async (
        count: number, 
        forceUseTicket?: boolean, 
        forceUseEventTicket?: boolean,
        chosenNumbers?: number[],
    ) => {
        const rawNumbers = (chosenNumbers && chosenNumbers.length > 0) ? chosenNumbers : (selectedNumbers.length > 0 ? selectedNumbers : undefined);
        const numbersToDraw = rawNumbers ? rawNumbers.filter(num => {
            if (!cardPool?.kujiTickets) return true;
            const t = cardPool.kujiTickets.find(ticket => ticket.number === num);
            return !t || !t.isDrawn;
        }) : undefined;
        const isEventExclusive = !!(cardPool?.isEventPool && cardPool?.exclusiveTicketOnly);
        const useEventTicketMode = forceUseEventTicket !== undefined 
            ? forceUseEventTicket 
            : (isUsingEventTicket || isEventExclusive);
        const useTicketMode = !useEventTicketMode && (forceUseTicket !== undefined ? forceUseTicket : isUsingTicket);

        if (!user) {
            toast({ variant: 'destructive', title: '請先登入', description: '正式開獎需要登入帳戶以扣除點數與發放卡牌。' });
            return;
        }
        if (!firestore || !cardPool) {
            toast({ variant: 'destructive', title: '錯誤', description: '系統尚未就緒，請重試。' });
            return;
        }
        if (!poolId) return;

        if (useTicketMode && user?.uid && firestore) {
            try {
                await syncLocalPromoClaimsToFirestore(firestore, user.uid);
            } catch (e) {
                console.warn('Sync promo claims failed:', e);
            }
        }

        setStep('loading');
        
        try {
            const result = await runTransaction(firestore, async (transaction) => {
                const userDocRef = doc(firestore, 'users', user.uid);
                const poolDocRef = doc(firestore, 'cardPools', poolId);
                const poolStatsRef = doc(firestore, 'users', user.uid, 'poolStats', poolId);                

                // 1. 讀取最新資料 (所有 transaction.get 必須在任何寫入之前執行)
                const userSnap = await transaction.get(userDocRef);
                const poolSnap = await transaction.get(poolDocRef);
                const poolStatsSnap = await transaction.get(poolStatsRef);

                if (!poolSnap.exists()) throw new Error('此卡池已下架或不存在。');

                const poolData = poolSnap.data() as CardPool;

                // 讀取卡池內所有關聯實體卡片主檔 (必須在任何寫入前完成讀取，同時作為原子鎖定 isSold 之依據)
                const txCardsMap = new Map<string, Card>(allCardsMap);
                const existingAllCardIds = new Set<string>();
                const referencedCardIds = new Set<string>();
                if (Array.isArray(poolData.cards)) {
                    poolData.cards.forEach((c: any) => {
                        if (c?.cardId) referencedCardIds.add(String(c.cardId));
                    });
                }
                if (Array.isArray(poolData.kujiTickets)) {
                    poolData.kujiTickets.forEach((t: any) => {
                        if (t?.cardId) referencedCardIds.add(String(t.cardId));
                    });
                }
                if (poolData.lastPrizeCardId) {
                    referencedCardIds.add(String(poolData.lastPrizeCardId));
                }

                if (referencedCardIds.size > 0) {
                    const fetchedCardSnaps = await Promise.all(
                        Array.from(referencedCardIds).map((cid) => transaction.get(doc(firestore, 'allCards', cid)))
                    );
                    fetchedCardSnaps.forEach((cSnap) => {
                        if (cSnap.exists()) {
                            existingAllCardIds.add(cSnap.id);
                            txCardsMap.set(cSnap.id, { id: cSnap.id, ...cSnap.data() } as Card);
                        }
                    });
                }

                let userData = userSnap.data();
                if (!userSnap.exists()) {
                    userData = {
                        id: user.uid,
                        username: user.displayName || '新玩家',
                        points: 1000,
                        bonusPoints: 0,
                        freeDrawTickets: 0,
                        eventPoolTickets: {},
                        role: 'user',
                        userLevel: '普通會員',
                        createdAt: serverTimestamp()
                    };
                    transaction.set(userDocRef, userData);
                }

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

                // 驗證活動專屬限制：若為 exclusiveTicketOnly，禁止一般貨幣/免費券抽卡
                if (poolData.isEventPool && poolData.exclusiveTicketOnly && !useEventTicketMode) {
                    throw new Error(`此卡池為專屬活動卡池，僅限使用管理員派發之【${poolData.eventTicketName || '專屬活動抽卡券'}】！`);
                }

                const actualDrawCount = useTicketMode ? 1 : count;

                // 檢查卡池剩餘庫存包數，防止超抽
                if (poolData.remainingPacks !== undefined && poolData.remainingPacks !== null) {
                    if (poolData.remainingPacks <= 0) {
                        throw new Error('此卡池已全數售罄！');
                    }
                    if (poolData.remainingPacks < actualDrawCount) {
                        throw new Error(`卡池目前僅剩餘 ${poolData.remainingPacks} 包，無法抽取 ${actualDrawCount} 包！`);
                    }
                }

                const basePrice = poolData.price || cardPool.price || 0;
                const cost = (useEventTicketMode || useTicketMode) 
                    ? 0 
                    : (actualDrawCount === 1 
                        ? basePrice 
                        : actualDrawCount === 3 
                            ? (poolData.price3Draws || cardPool.price3Draws || basePrice * 3) 
                            : actualDrawCount === 10 
                                ? (poolData.price10Draws || cardPool.price10Draws || basePrice * 10) 
                                : basePrice * actualDrawCount);
                const currencyField = cardPool.currency === 'p-point' ? 'bonusPoints' : 'points';
                const balance = (userData as any)[currencyField] || 0;
                const tickets = (userData as any).freeDrawTickets || 0;
                const localTickets = getLocalAvailableTicketsCount();

                const eventTicketsMap = (userData as any).eventPoolTickets || {};
                const currentEventTickets = typeof eventTicketsMap[poolId] === 'number' ? eventTicketsMap[poolId] : 0;

                if (useEventTicketMode) {
                    if (currentEventTickets < actualDrawCount) {
                        throw new Error(`【${poolData.eventTicketName || '活動專屬抽卡券'}】不足！您持有 ${currentEventTickets} 張，本次需消耗 ${actualDrawCount} 張。此券僅能由管理員依活動規則指名派發。`);
                    }
                } else if (useTicketMode) {
                    if (poolData.allowFreeDraw === false) throw new Error('此卡池目前未開放免費抽卡券兌換。');
                    if (tickets < 1 && localTickets < 1) throw new Error('您的活動免費抽卡券不足，請先至選單中的免費領取活動獲取！');
                } else {
                    if (balance < cost) throw new Error('點數不足，無法抽卡。');
                }

                // 檢查活動專屬每人最大抽取限制
                if (poolData.isEventPool && poolData.eventMaxDrawsPerUser && poolData.eventMaxDrawsPerUser > 0) {
                    const poolStatsData = poolStatsSnap.exists() ? poolStatsSnap.data() : { count: 0, totalCount: 0 };
                    const userTotalDraws = (poolStatsData.totalCount || poolStatsData.count || 0);
                    if (userTotalDraws + actualDrawCount > poolData.eventMaxDrawsPerUser) {
                        throw new Error(`此活動卡池每位玩家最多僅限抽取 ${poolData.eventMaxDrawsPerUser} 次，您目前已累積抽取 ${userTotalDraws} 次。`);
                    }
                }

                // 2. 進行抽選 (傳入完整 txCardsMap 確保大獎圖案與資訊 100% 載入)
                const isKujiPool = !!(poolData.enablePickNumber || (poolData.kujiTickets && poolData.kujiTickets.length > 0));
                let drawn: any[] = [];
                let updatedCards: any[] = [];
                let updatedPointPrizes: any[] = [];
                let updatedTickets: any[] | undefined = undefined;

                if (isKujiPool || (numbersToDraw && numbersToDraw.length > 0)) {
                    if (poolData.kujiTickets && poolData.kujiTickets.length > 0 && numbersToDraw && numbersToDraw.length > 0) {
                        for (const num of numbersToDraw) {
                            const found = poolData.kujiTickets.find(t => t.number === num);
                            if (!found) throw new Error(`號碼 #${num} 不存在於此卡池中。`);
                            if (found.isDrawn) throw new Error(`號碼 #${num} 剛剛已被其他玩家抽走，請重新挑選其他號碼！`);
                        }
                    }
                    const kujiRes = drawKujiTickets(poolData, numbersToDraw, actualDrawCount, txCardsMap);
                    drawn = kujiRes.drawn;
                    updatedCards = kujiRes.updatedCards;
                    updatedPointPrizes = kujiRes.updatedPointPrizes;
                    updatedTickets = kujiRes.updatedTickets;
                } else {
                    const sysSnap = await transaction.get(doc(firestore, 'systemConfig', 'main'));
                    const storeProtection = sysSnap.exists() ? (sysSnap.data() as any)?.storeProtection : undefined;
                    const normalRes = drawFromPool(poolData, actualDrawCount, txCardsMap, false, storeProtection);
                    drawn = normalRes.drawn;
                    updatedCards = normalRes.updatedCards;
                    updatedPointPrizes = normalRes.updatedPointPrizes;
                }

                if (drawn.length === 0) throw new Error('卡池目前已無獎項可供抽取。');

                const packsConsumed = drawn.length;
                let claimLastPrize = false;

                // 檢查並派發最後賞 (Last One Prize)
                if (
                    poolData.remainingPacks !== undefined &&
                    poolData.remainingPacks !== null &&
                    poolData.remainingPacks - packsConsumed <= 0 &&
                    poolData.lastPrizeCardId &&
                    !(poolData as any).lastPrizeClaimed
                ) {
                    const lpId = String(poolData.lastPrizeCardId);
                    const lpDetails = txCardsMap.get(lpId);
                    drawn.push({
                        id: lpId,
                        name: lpDetails?.name || '最後賞限定大獎',
                        imageUrl: lpDetails?.imageUrl || '',
                        backImageUrl: lpDetails?.backImageUrl || '',
                        serialNumber: '',
                        imageHint: lpDetails?.name || '最後賞限定大獎',
                        category: (lpDetails?.category && lpDetails.category !== '抽賞' && lpDetails.category !== 'all') ? lpDetails.category : '一般',
                        rarity: 'legendary',
                        sellPrice: lpDetails?.sellPrice || 0,
                        type: 'last-prize',
                    });
                    claimLastPrize = true;
                }

                // 3. 處理獲獎結果並寫入收藏庫，同時將抽出的實體大獎卡片原子標記為 isSold: true 永久鎖定防重複調用
                const drawSource = useEventTicketMode ? 'event_ticket_draw' : (useTicketMode ? 'promo_ticket_draw' : 'draw');
                const soldCardIdsToLock = new Set<string>();

                for (const prize of drawn) {
                    const newUserCardRef = doc(collection(firestore, 'users', user.uid, 'userCards'));
                    const serialNumber = `${Math.floor(Math.random() * 9000) + 1000}`;
                    const isPointOrRandom = prize.type === 'points' || Boolean(prize.isPoints) || Boolean(prize.name?.includes('隨機球員'));
                    const rawId = String(prize.id || '');

                    const cardPayload: any = isPointOrRandom
                        ? {
                            cardId: rawId.startsWith('random-player-') ? rawId : `random-player-${rawId || 'points_50'}`,
                            name: prize.name || '隨機球員 普/特 卡',
                            userId: user.uid,
                            category: '抽賞',
                            rarity: prize.rarity || 'common',
                            isFoil: false,
                            isPoints: true,
                            points: Number(prize.points || 50),
                            source: drawSource,
                            poolId: poolId,
                            poolName: poolData.name || cardPool.name || '',
                            serialNumber: serialNumber,
                            createdAt: serverTimestamp()
                        }
                        : {
                            cardId: rawId,
                            name: prize.name || '典藏球員卡',
                            imageUrl: prize.imageUrl || '',
                            backImageUrl: prize.backImageUrl || '',
                            sellPrice: Number(prize.sellPrice || 0),
                            userId: user.uid,
                            category: (prize.category && !['抽賞', 'all', 'normal'].includes(prize.category)) ? prize.category : '一般',
                            rarity: prize.rarity || 'common',
                            isFoil: prize.rarity === 'legendary' || prize.type === 'last-prize',
                            isPoints: false,
                            source: drawSource,
                            poolId: poolId,
                            poolName: poolData.name || cardPool.name || '',
                            serialNumber: serialNumber,
                            ...(prize.tierCode ? { tierCode: prize.tierCode } : {}),
                            ...(prize.buybackPoints ? { buybackPoints: prize.buybackPoints } : {}),
                            createdAt: serverTimestamp()
                        };

                    if (prize.ticketNumber !== undefined && prize.ticketNumber !== null) {
                        cardPayload.ticketNumber = prize.ticketNumber;
                    }
                    transaction.set(newUserCardRef, cleanFirestoreData(cardPayload));
                    prize.serialNumber = serialNumber;
                    prize.userCardId = newUserCardRef.id;

                    if (!isPointOrRandom && rawId && existingAllCardIds.has(rawId)) {
                        soldCardIdsToLock.add(rawId);
                    }
                }

                // 原子鎖定已抽出的大獎卡片狀態，防止任何卡池/福袋/拼卡再次調用
                soldCardIdsToLock.forEach((soldCardId) => {
                    transaction.update(doc(firestore, 'allCards', soldCardId), {
                        isSold: true,
                        status: 'sold',
                        soldVia: 'draw',
                        soldFromPoolId: poolId,
                        soldBy: user.uid,
                        soldAt: serverTimestamp(),
                    });
                });

                // 4. 套用使用者資產更新 (扣除專屬券、免費券或花費)
                const updateFields: any = {};
                if (useEventTicketMode) {
                    const nextTickets = Math.max(0, currentEventTickets - actualDrawCount);
                    updateFields[`eventPoolTickets.${poolId}`] = nextTickets;
                } else if (useTicketMode) {
                    updateFields.freeDrawTickets = Math.max(0, tickets - 1);
                } else if (cardPool.currency === 'p-point') {
                    updateFields.bonusPoints = increment(-cost);
                } else {
                    updateFields.points = increment(-cost);
                }
                transaction.update(userDocRef, cleanFirestoreData(updateFields));

                // 5. 更新卡池資料 (全面清理 undefined 屬性，杜絕 Transaction.update 錯誤)
                const poolUpdates: any = {
                    remainingPacks: increment(-packsConsumed),
                    cards: updatedCards
                };
                if (updatedPointPrizes && updatedPointPrizes.length > 0) {
                    poolUpdates.pointPrizes = updatedPointPrizes;
                }
                if (updatedTickets && updatedTickets.length > 0) {
                    poolUpdates.kujiTickets = updatedTickets;
                }
                if (claimLastPrize) {
                    poolUpdates.lastPrizeClaimed = true;
                }
                const spDrawnInClientTx = drawn.some((p: any) => p.tierCode === 'SP');
                if (spDrawnInClientTx) {
                    poolUpdates.spRevealed = true;
                }
                transaction.update(poolDocRef, cleanFirestoreData(poolUpdates));

                // 若為明池盲開＋隱藏 SP 模式，寫入公開開獎紀錄（防作弊證明）
                if (poolData.isHybridBlindSpMode) {
                    const totalPacksNum = Number(poolData.totalPacks || 100);
                    const prevRemainingNum = Number(poolData.remainingPacks ?? totalPacksNum);
                    const rawDisplayName = String(userData?.displayName || userData?.username || userData?.email || user.uid);
                    const maskedUsername = rawDisplayName.length <= 2
                        ? `${rawDisplayName[0] || 'u'}***`
                        : `${rawDisplayName.slice(0, 2)}***${rawDisplayName.slice(-1)}`;
                    drawn.forEach((p: any, idx: number) => {
                        const pullNumber = p.type === 'last-prize'
                            ? totalPacksNum
                            : Math.max(1, totalPacksNum - prevRemainingNum + idx + 1);
                        const publicLogRef = doc(collection(firestore, 'cardPools', poolId, 'drawLogs'));
                        transaction.set(publicLogRef, cleanFirestoreData({
                            poolId,
                            pullNumber,
                            userId: user.uid,
                            maskedUsername,
                            tierCode: p.type === 'last-prize' ? 'LAST' : (p.tierCode || (p.rarity === 'legendary' ? 'A' : p.rarity === 'rare' ? 'B' : 'D')),
                            prizeId: String(p.id || ''),
                            prizeName: p.name || '典藏卡包獎項',
                            userCardId: p.userCardId || null,
                            isOpened: true,
                            redeemedAsPoints: false,
                            createdAt: serverTimestamp(),
                        }));
                    });
                }

                // 6. 紀錄交易日誌與 Provably Fair 開獎參數
                const pfRound = await createProvablyFairRound({
                    clientSeed: `${user.uid.substring(0, 8)}_${Date.now()}`,
                    outcomeType: 'draw',
                    poolSize: cardPool.totalPacks || 80
                });

                const notablePrize = drawn.find((p: any) => (p.type === 'card' || p.type === 'last-prize') && (p.rarity === 'legendary' || p.rarity === 'rare')) || drawn[0];
                const primaryCardName = notablePrize?.name || (notablePrize as any)?.cardName || '卡牌';
                const prizeSummaryText = drawn.length === 1
                    ? `獲得【${primaryCardName}】`
                    : `獲得【${primaryCardName}】等共 ${drawn.length} 張卡牌`;

                const transactionRef = doc(collection(firestore, 'transactions'));
                transaction.set(transactionRef, cleanFirestoreData({
                    userId: user.uid,
                    transactionType: 'Draw',
                    currency: useEventTicketMode ? 'event_ticket' : (useTicketMode ? 'free_ticket' : (cardPool.currency || 'diamond')),
                    amount: (useEventTicketMode || useTicketMode) ? 0 : -cost,
                    details: useEventTicketMode
                        ? `在活動卡池 [${cardPool.name}] 使用專屬抽卡券【${cardPool.eventTicketName || '活動券'}】 (${actualDrawCount} 抽) - ${prizeSummaryText}`
                        : (useTicketMode
                            ? `在卡池 [${cardPool.name}] 使用活動免費抽卡券 (1抽) - ${prizeSummaryText}`
                            : `在卡池 [${cardPool.name}] 進行 ${count} 連抽 - ${prizeSummaryText}`),
                    transactionDate: serverTimestamp(),
                    section: 'draw',
                    provablyFair: {
                        serverSeed: pfRound.serverSeed,
                        serverHash: pfRound.serverHash,
                        clientSeed: pfRound.clientSeed,
                        nonce: pfRound.nonce,
                        outcomeType: 'pack',
                        cardName: primaryCardName,
                        poolSize: cardPool.totalPacks || 80,
                        timestamp: Date.now()
                    }
                }));

                // 紀錄抽卡日誌
                const logRef = doc(collection(firestore, 'drawnCardLogs'));
                transaction.set(logRef, cleanFirestoreData({
                    userId: user.uid,
                    poolId: poolId,
                    agentId: cardPool.agentId || null,
                    drawnAt: serverTimestamp(),
                    cost: cost,
                    count: actualDrawCount,
                    isTicket: useTicketMode || useEventTicketMode,
                    isEventTicket: useEventTicketMode,
                    eventTicketName: useEventTicketMode ? (cardPool.eventTicketName || '活動專屬抽卡券') : null
                }));
                
                // 7. 更新統計
                const todayStr = format(new Date(), 'yyyy-MM-dd');
                const poolStatsData = poolStatsSnap.exists() ? poolStatsSnap.data() : { count: 0, totalCount: 0, lastDrawDate: '' };
                const newCount = (poolStatsData.lastDrawDate === todayStr ? (poolStatsData.count || 0) : 0) + packsConsumed;
                const newTotalCount = (poolStatsData.totalCount || poolStatsData.count || 0) + packsConsumed;
                transaction.set(poolStatsRef, cleanFirestoreData({
                  count: newCount,
                  totalCount: newTotalCount,
                  lastDrawDate: todayStr
                }), { merge: true });

                return {
                    drawn,
                    packsConsumed,
                    claimLastPrize,
                    updatedCards,
                    updatedPointPrizes,
                    updatedTickets,
                    winnerName: (userData as any)?.username || user.displayName || '神秘藏家'
                };
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
                setSelectedNumbers([]);
                setTargetPickCount(undefined);

                // 立即更新本地 cardPool 狀態，確保已抽出的號碼立即在前端標記為 isDrawn: true，杜絕下一抽重複選取
                setCardPool(prev => prev ? {
                    ...prev,
                    remainingPacks: Math.max(0, (prev.remainingPacks || 0) - result.packsConsumed),
                    cards: result.updatedCards || prev.cards,
                    pointPrizes: (result.updatedPointPrizes && result.updatedPointPrizes.length > 0) ? result.updatedPointPrizes : prev.pointPrizes,
                    kujiTickets: (result.updatedTickets && result.updatedTickets.length > 0) ? result.updatedTickets : prev.kujiTickets,
                    ...(result.claimLastPrize ? { lastPrizeClaimed: true } : {}),
                } as CardPool : prev);

                // 若抽中稀有賞或傳奇賞大獎，非同步發布中獎榮譽榜公告（盲盒模式不對外播報，維持保密感）
                const bigHits = !cardPool.isBlindBoxMode
                    ? result.drawn.filter(
                        (p: any) => (p.type === 'card' || p.type === 'last-prize') && (p.rarity === 'legendary' || p.rarity === 'rare')
                    )
                    : [];
                if (bigHits.length > 0) {
                    Promise.allSettled(
                        bigHits.map((hit: any) =>
                            setDoc(doc(collection(firestore, 'announcements')), cleanFirestoreData({
                                username: result.winnerName,
                                action: hit.type === 'last-prize' ? '抱走了最後賞' : '抽中了',
                                prize: hit.name || '精選頂級球員卡',
                                prizeImageUrl: hit.imageUrl || '',
                                rarity: hit.rarity || 'legendary',
                                section: 'draw',
                                poolName: cardPool.name || '',
                                timestamp: serverTimestamp(),
                            }))
                        )
                    ).catch(() => {});
                }

                if (typeof window !== 'undefined') {
                    const url = new URL(window.location.href);
                    if (url.searchParams.has('numbers') || url.searchParams.has('pick')) {
                        url.searchParams.delete('numbers');
                        url.searchParams.delete('pick');
                        window.history.replaceState({}, '', url.toString());
                    }
                }
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
    }, [poolId, firestore, user, cardPool, isUsingTicket, isUsingEventTicket, toast, allCardsMap, selectedNumbers]);

    const handleSqueezeStart = (e: React.PointerEvent) => {
        if (step !== 'ready-to-reveal' || isChanging) return;
        window.getSelection()?.removeAllRanges();
        const rect = squeezeRef.current?.getBoundingClientRect();
        const corner = rect ? detectPeelCorner(e.clientX, e.clientY, rect) : 'bottom';
        setPeelCorner(corner);
        startGestureRef.current = {
            x: e.clientX,
            y: e.clientY,
            time: Date.now(),
            width: rect?.width || 230,
            height: rect?.height || 368,
            corner,
            locked: false,
        } as any;
        setIsSqueezing(true);
        try {
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } catch {
            // ignore pointer capture failure on synthetic events
        }
    };

    const handleSqueezeMove = (e: React.PointerEvent) => {
        if (!isSqueezing) return;
        const g = startGestureRef.current as typeof startGestureRef.current & { locked?: boolean };
        const dx = e.clientX - g.x;
        const dy = e.clientY - g.y;
        const dist = Math.hypot(dx, dy);

        // 依據實際滑動向量動態決定全方位 8 向翻開方向
        if (!g.locked && dist >= 10) {
            const dir = detectPeelDirectionFromSwipe(dx, dy);
            g.corner = dir;
            g.locked = true;
            setPeelCorner(dir);
        }

        const nextPct = computeCornerPeelPercent(g.corner, dx, dy, g.width, g.height);
        setRevealPercent(nextPct);
        if (nextPct >= 92) {
            setIsSqueezing(false);
            completeReveal();
        }
    };

    const handleSqueezeEnd = (e: React.PointerEvent) => {
        if (!isSqueezing) return;
        setIsSqueezing(false);
        const g = startGestureRef.current;
        const elapsed = Date.now() - g.time;
        const moveDist = Math.hypot(e.clientX - g.x, e.clientY - g.y);
        const rect = squeezeRef.current?.getBoundingClientRect();

        // 若玩家直接輕觸四個折角任一處，立即沿該角落順暢掀開
        if (elapsed < 280 && moveDist < 12 && rect && isNearCornerHotspot(e.clientX, e.clientY, rect)) {
            setPeelCorner(g.corner);
            setRevealPercent(18);
            requestAnimationFrame(() => {
                completeReveal();
            });
            return;
        }

        if (revealPercent >= 40) {
            completeReveal();
        } else {
            setRevealPercent(0);
        }
    };

    const completeReveal = () => {
        setRevealPercent(100);
        setStep('revealing');
        const p = drawnPrizes[revealedIndex];
        if (p) {
            if (p.rarity === 'legendary' || p.type === 'last-prize') {
                setShowCelebration('legendary');
            } else if (rarityVisuals[p.rarity]?.celebration !== 'none') {
                setShowCelebration(rarityVisuals[p.rarity].celebration);
            }
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
                className="flex flex-col justify-center items-center min-h-[100dvh] w-full p-2 sm:p-4 relative overflow-y-auto select-none" 
                style={{ backgroundImage: `url("${activeBackgroundUrl}")`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat' }}
            >
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-[5]" />
                <div className="relative z-10 w-full min-h-full flex flex-col justify-center items-center my-auto py-2">
                    <PackPreview 
                        cardPool={cardPool}
                        initialDrawCount={selectedNumbers.length > 0 ? selectedNumbers.length : initialDrawCount}
                        selectedNumbers={selectedNumbers}
                        isLevelMet={isLevelMet}
                        isLimitReachedForInitial={isLimitReachedForInitial}
                        isLoadingStats={isLoadingStats}
                        isUsingTicket={isUsingTicket}
                        isUsingEventTicket={isUsingEventTicket || !!(cardPool.isEventPool && cardPool.exclusiveTicketOnly)}
                        eventPoolTickets={poolId && userProfile?.eventPoolTickets ? (userProfile.eventPoolTickets[poolId] || 0) : 0}
                        freeDrawTickets={getEffectiveTicketCount(userProfile)}
                        performDraw={(count, forceTicket, forceEventTicket, numbers) => performDraw(count, forceTicket, forceEventTicket, numbers || selectedNumbers)}
                        performTrialDraw={(count, numbers) => performTrialDraw(count, numbers || selectedNumbers)}
                        onOpenPickNumber={
                            (cardPool.enablePickNumber || (cardPool.kujiTickets && cardPool.kujiTickets.length > 0))
                                ? () => setIsPickNumberOpen(true)
                                : undefined
                        }
                    />
                </div>

                {/* 🎯 一番賞自選號碼彈窗（確保在開獎確認頁面點擊開獎/選號時立即響應彈出） */}
                <KujiNumberPickerDialog
                    isOpen={isPickNumberOpen}
                    onClose={() => setIsPickNumberOpen(false)}
                    cardPool={cardPool}
                    isTrialMode={isTrialMode}
                    initialSelectedNumbers={selectedNumbers}
                    targetPickCount={targetPickCount}
                    userBalance={
                        userProfile 
                            ? (cardPool?.currency === 'p-point' ? (userProfile.bonusPoints || 0) : (userProfile.points || 0))
                            : 0
                    }
                    isDrawing={false}
                    onSelectNumbersOnly={(chosenNumbers) => {
                        setSelectedNumbers(chosenNumbers);
                        setIsPickNumberOpen(false);
                        toast({
                            title: '🎯 已鎖定自選號碼',
                            description: `已選取番號：#${chosenNumbers.join(', #')}，點擊下方「啟動開獎」即可開始抽卡！`,
                        });
                    }}
                    onConfirmDraw={(chosenNumbers, asTrial) => {
                        setSelectedNumbers(chosenNumbers);
                        setIsPickNumberOpen(false);
                        if (asTrial || isTrialMode) {
                            performTrialDraw(chosenNumbers.length, chosenNumbers);
                        } else {
                            performDraw(chosenNumbers.length, false, false, chosenNumbers);
                        }
                    }}
                />
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
        const tierOrder: Record<string, number> = { LAST: 6, SP: 5, A: 4, B: 3, C: 2, D: 1 };
        const topHybridTier = cardPool?.isHybridBlindSpMode
            ? drawnPrizes.reduce((best: any, cur: any) => {
                  const t = cur?.tierCode || (cur?.type === 'last-prize' ? 'LAST' : cur?.rarity === 'legendary' ? 'A' : cur?.rarity === 'rare' ? 'B' : 'D');
                  return !best || (tierOrder[t] || 0) > (tierOrder[best] || 0) ? t : best;
              }, undefined)
            : undefined;
        return (
            <CloveSummoningAnimation
                highestRarity={topRarityCelebration}
                drawCount={drawnPrizes.length}
                poolName={cardPool?.name || '頂級卡包'}
                backgroundUrl={activeBackgroundUrl}
                selectedNumbers={selectedNumbers.length > 0 ? selectedNumbers : undefined}
                hybridTier={topHybridTier}
                onAnimationComplete={() => {
                    setStep('ready-to-reveal');
                }}
            />
        );
    }

    const visual = currentPrize ? (rarityVisuals[currentPrize.rarity] || rarityVisuals.common) : rarityVisuals.common;

    const canDraw3 = !isLoadingStats && (!cardPool?.dailyLimit || cardPool.dailyLimit === 0 || (todayDrawCount + 3 <= cardPool.dailyLimit));
    const canDraw10 = !isLoadingStats && (!cardPool?.dailyLimit || cardPool.dailyLimit === 0 || (todayDrawCount + 10 <= cardPool.dailyLimit));

    return (
        <motion.div 
            animate={isLegendaryRevealed ? {
                x: [0, -9, 9, -7, 7, -5, 5, -2, 2, 0],
                y: [0, 7, -7, 5, -5, 3, -3, 1, -1, 0],
            } : { x: 0, y: 0 }}
            transition={{ duration: 0.65, ease: "easeOut" }}
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

                {step !== 'done' && (
                    <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[10px] font-black uppercase shadow-lg backdrop-blur-md">
                        <ShieldCheck className="h-3 w-3" /> 保護時間剩餘 {lockCountdown}s
                    </div>
                )}

                {/* Top-Right Quick Skip & Settlement Button */}
                {step !== 'done' && drawnPrizes.length > 0 ? (
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
                    <div className="text-center animate-fade-in-up select-none w-full max-w-xl px-3">
                        <p className="text-[10px] text-slate-400 font-bold tracking-[0.18em] tabular-nums">
                            {currentPrize.type === 'last-prize' ? '最後賞限定' : `第 ${revealedIndex + 1} / ${drawnPrizes.length} 項`}
                        </p>
                        <div className="flex items-center justify-center mt-0.5">
                            {(currentPrize.type === 'points' || currentPrize.isPoints || currentPrize.name?.includes('隨機球員')) ? (
                                <h2 className="text-xs sm:text-sm font-bold text-white leading-snug text-center break-words">
                                    {currentPrize.rarity === 'rare' || currentPrize.rarity === 'legendary' ? '隨機球員 特卡' : '隨機球員 普/特 卡'}
                                </h2>
                            ) : (
                                <h2 className="text-[11px] sm:text-xs font-bold text-white leading-snug text-center break-words">
                                    {currentPrize.name}
                                </h2>
                            )}
                        </div>
                        <div className="flex items-center justify-center gap-1.5 mt-1 flex-wrap">
                            <span className={cn(
                                "text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border",
                                currentPrize.tierCode === 'A' || currentPrize.tierCode === 'LAST' || (!currentPrize.tierCode && visual.label === 'LEGENDARY')
                                    ? "bg-amber-400/15 text-[#FDE68A] border-amber-300/40"
                                    : currentPrize.tierCode === 'SP'
                                    ? "bg-[#0a0f1c] text-[#FDE68A] border-amber-300/65"
                                    : currentPrize.tierCode === 'B' || (!currentPrize.tierCode && visual.label === 'RARE')
                                    ? "bg-slate-200/15 text-slate-100 border-slate-300/45"
                                    : currentPrize.tierCode === 'C'
                                    ? "bg-amber-700/30 text-amber-200 border-amber-500/45"
                                    : "bg-white/[0.08] text-slate-200 border-white/[0.15]"
                            )}>
                                {currentPrize.tierCode === 'A'
                                    ? 'A 賞・金包'
                                    : currentPrize.tierCode === 'SP'
                                    ? 'SP 賞・黑包'
                                    : currentPrize.tierCode === 'B'
                                    ? 'B 賞・銀包'
                                    : currentPrize.tierCode === 'C'
                                    ? 'C 賞・銅包'
                                    : currentPrize.tierCode === 'D'
                                    ? 'D 賞・白包'
                                    : currentPrize.tierCode === 'LAST'
                                    ? '最後賞'
                                    : (currentPrize.type === 'points' || currentPrize.isPoints || currentPrize.name?.includes('隨機球員'))
                                    ? (currentPrize.rarity === 'rare' || currentPrize.rarity === 'legendary' ? '特卡' : '普/特卡')
                                    : visual.label}
                            </span>
                            {!(currentPrize.type === 'points' || currentPrize.isPoints || currentPrize.name?.includes('隨機球員')) && currentPrize.category && (
                                <span className="text-[9px] font-bold text-slate-200 px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.12]">
                                    {currentPrize.category}
                                </span>
                            )}
                            {!(currentPrize.type === 'points' || currentPrize.isPoints || currentPrize.name?.includes('隨機球員')) && (currentPrize.sellPrice || 0) > 0 && (
                                <span className="text-[9px] font-mono font-bold text-[#FDE68A] px-2 py-0.5 rounded-full bg-amber-400/15 border border-amber-300/35 tabular-nums">
                                    估值 {Number(currentPrize.sellPrice).toLocaleString()}
                                </span>
                            )}
                        </div>
                    </div>
                )}
                {step === 'done' && (
                    <div className="text-center animate-fade-in-up select-none space-y-1">
                        <div className="inline-flex items-center gap-2 px-3 py-0.5 rounded-full bg-white/[0.04] border border-amber-300/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#FDE68A]" />
                            <span className="text-[10px] font-bold tracking-widest text-[#FDE68A] uppercase">開獎結算</span>
                        </div>
                        <p className="text-xs sm:text-sm text-slate-200 font-bold tabular-nums">
                            本次共獲得 <span className="text-[#FDE68A] font-black">{sessionPrizes.length}</span> 項戰利品
                        </p>
                    </div>
                )}
            </div>

            {/* Central Stage: Scratch / Reveal OR Result Shelf */}
            {step !== 'done' ? (
                <div className="flex-1 flex flex-col items-center justify-center w-full relative z-[20] min-h-0 py-1">
                    <motion.div 
                        initial={{ y: -300, opacity: 0, scale: 0.6, rotate: -8 }}
                        animate={isLegendaryRevealed ? { 
                            y: [0, -12, 4, 0], 
                            scale: [1, 1.1, 0.98, 1], 
                            rotate: [0, -2, 2, 0], 
                            opacity: 1 
                        } : { y: 0, opacity: 1, scale: 1, rotate: 0 }}
                        onAnimationComplete={() => {
                            if (topRarityCelebration !== 'none' && landingVFX === 'none') {
                                setLandingVFX(topRarityCelebration);
                                setTimeout(() => setLandingVFX('none'), 1800);
                            }
                        }}
                        transition={isLegendaryRevealed ? {
                            duration: 0.55,
                            ease: "easeOut",
                        } : { 
                            type: 'spring', 
                            stiffness: 200, 
                            damping: 18,
                            mass: 0.9
                        }}
                        className="flex flex-col items-center w-[min(65vw,215px)] sm:w-[235px] relative transform-gpu will-change-transform"
                    >
                        {/* 依卡包顏色發散的能量衝擊波（金包發金光、黑包發紫金光、銀包發銀光、銅包發銅光、白包發白光） */}
                        {(isLegendaryRevealed || (revealPercent === 100 && Boolean(currentPrize?.tierCode))) && (
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[-1]">
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0.9 }}
                                    animate={{ scale: [0.8, 2.2], opacity: [0.9, 0] }}
                                    transition={{ duration: 1.1, ease: "easeOut", repeat: Infinity, repeatDelay: 0.4 }}
                                    className={cn(
                                        "absolute w-full h-full rounded-[2.2rem] border-2 transform-gpu will-change-transform",
                                        currentPrize?.tierCode === 'SP'
                                            ? "border-purple-400 shadow-[0_0_35px_rgba(168,85,247,0.7)]"
                                            : currentPrize?.tierCode === 'B'
                                            ? "border-slate-200 shadow-[0_0_30px_rgba(226,232,240,0.7)]"
                                            : currentPrize?.tierCode === 'C'
                                            ? "border-amber-600 shadow-[0_0_28px_rgba(217,119,6,0.65)]"
                                            : currentPrize?.tierCode === 'D'
                                            ? "border-white shadow-[0_0_24px_rgba(255,255,255,0.6)]"
                                            : "border-amber-300 shadow-[0_0_30px_rgba(251,191,36,0.6)]"
                                    )}
                                />
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0.7 }}
                                    animate={{ scale: [0.8, 2.7], opacity: [0.7, 0] }}
                                    transition={{ duration: 1.3, ease: "easeOut", delay: 0.2, repeat: Infinity, repeatDelay: 0.4 }}
                                    className={cn(
                                        "absolute w-full h-full rounded-[2.8rem] border transform-gpu will-change-transform",
                                        currentPrize?.tierCode === 'SP'
                                            ? "border-amber-300 shadow-[0_0_40px_rgba(253,230,138,0.55)]"
                                            : currentPrize?.tierCode === 'B'
                                            ? "border-slate-300 shadow-[0_0_35px_rgba(203,213,225,0.5)]"
                                            : currentPrize?.tierCode === 'C'
                                            ? "border-amber-500 shadow-[0_0_30px_rgba(217,119,6,0.45)]"
                                            : currentPrize?.tierCode === 'D'
                                            ? "border-slate-100 shadow-[0_0_28px_rgba(255,255,255,0.4)]"
                                            : "border-yellow-200 shadow-[0_0_40px_rgba(245,158,11,0.5)]"
                                    )}
                                />
                            </div>
                        )}

                        <div className={cn(
                            "relative w-full aspect-[2.5/4] p-0.5 sm:p-1 bg-slate-900 border-[3px] sm:border-[4px] rounded-[1.4rem] sm:rounded-[1.6rem] shadow-2xl overflow-hidden transition-all duration-500 flex items-center justify-center shrink-0", 
                            revealPercent === 100 && currentPrize?.tierCode
                                ? currentPrize.tierCode === 'A' || currentPrize.tierCode === 'LAST'
                                    ? "border-amber-400 shadow-[0_0_85px_rgba(245,158,11,1),0_0_160px_rgba(251,191,36,0.75)] ring-4 ring-amber-300/90 scale-[1.03]"
                                    : currentPrize.tierCode === 'SP'
                                    ? "border-amber-300 shadow-[0_0_85px_rgba(168,85,247,0.8),0_0_140px_rgba(253,230,138,0.65)] ring-4 ring-amber-300/80 scale-[1.03]"
                                    : currentPrize.tierCode === 'B'
                                    ? "border-slate-200 shadow-[0_0_75px_rgba(226,232,240,0.85)] ring-2 ring-slate-200/80 scale-[1.02]"
                                    : currentPrize.tierCode === 'C'
                                    ? "border-amber-600 shadow-[0_0_65px_rgba(217,119,6,0.75)] ring-2 ring-amber-500/70"
                                    : "border-white shadow-[0_0_55px_rgba(248,250,252,0.7)] ring-2 ring-white/75"
                                : isLegendaryRevealed
                                ? "border-amber-400 shadow-[0_0_85px_rgba(245,158,11,1),0_0_160px_rgba(251,191,36,0.75),inset_0_0_30px_rgba(254,240,138,0.85)] ring-4 ring-amber-300/90 scale-[1.03]"
                                : (step === 'revealing' && revealPercent === 100 && visual.glow),
                            !isLegendaryRevealed && !(revealPercent === 100 && currentPrize?.tierCode) && "border-slate-950"
                        )}>
                            {(() => {
                                const peelGeo = getCornerPeelGeometry(peelCorner, revealPercent);
                                return (
                                    <div 
                                        ref={squeezeRef} 
                                        className="relative bg-transparent rounded-[1.1rem] sm:rounded-[1.3rem] border-2 border-slate-950/60 overflow-hidden w-full h-full flex items-center justify-center touch-none cursor-grab active:cursor-grabbing select-none transition-transform duration-150"
                                        style={{ transform: isSqueezing && revealPercent > 0 ? peelGeo.tiltTransform : 'none' }}
                                        onPointerDown={handleSqueezeStart} 
                                        onPointerMove={handleSqueezeMove} 
                                        onPointerUp={handleSqueezeEnd} 
                                        onPointerCancel={handleSqueezeEnd}
                                    >
                                        <div className={cn(
                                            "relative w-full h-full z-10 flex items-center justify-center pointer-events-none select-none transition-opacity duration-200",
                                            isChanging ? "opacity-0" : "opacity-100"
                                        )}>
                                            {currentPrize && (
                                                (currentPrize.type === 'card' || currentPrize.type === 'last-prize') ? (
                                                    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                                                        <CardItem 
                                                            key={`${revealedIndex}-${currentPrize.id}`}
                                                            name={currentPrize.name} 
                                                            imageUrl={currentPrize.imageUrl} 
                                                            backImageUrl={currentPrize.backImageUrl} 
                                                            imageHint={currentPrize.name} 
                                                            rarity={currentPrize.rarity} 
                                                            serialNumber={currentPrize.serialNumber} 
                                                            isFlippable={true} 
                                                            className="w-full h-full aspect-[2.5/4]"
                                                            priority 
                                                        />
                                                    </div>
                                                ) : (
                                                    <div className="relative w-full h-full rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                                                        <RandomPlayerCard 
                                                            rarity={currentPrize.rarity} 
                                                            points={currentPrize.points} 
                                                            title={currentPrize.rarity === 'rare' || currentPrize.rarity === 'legendary' ? '隨機球員 特卡' : '隨機球員 普/特 卡'} 
                                                            showBuybackHint={false} 
                                                            className="w-full h-full aspect-[2.5/4] !rounded-xl"
                                                        />
                                                    </div>
                                                )
                                            )}
                                        </div>

                                        {/* 四角自由撕開遮罩 (支援左上 / 右上 / 左下 / 右下任一角往內滑動或輕觸掀開) */}
                                        <div 
                                            className={cn(
                                                "absolute inset-0 z-30 bg-[#0a0f1c] rounded-[1.1rem] sm:rounded-[1.3rem] border-2 sm:border-3 border-amber-300/45 flex flex-col items-center justify-center pointer-events-none select-none shadow-[inset_0_0_24px_rgba(251,191,36,0.16)]",
                                                isSqueezing || isChanging
                                                    ? "transition-none"
                                                    : "transition-[clip-path,opacity] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]",
                                                revealPercent >= 100 ? "opacity-0" : "opacity-100"
                                            )} 
                                            style={{ clipPath: peelGeo.coverClipPath }} 
                                        >
                                            {/* 四個角落的擬真微折角引導標記 */}
                                            {revealPercent === 0 && (
                                                <>
                                                    <div className="absolute top-1.5 left-1.5 w-6 h-6 border-t-2 border-l-2 border-amber-300/80 rounded-tl-lg flex items-start justify-start p-0.5">
                                                        <div className="w-2.5 h-2.5 bg-gradient-to-br from-amber-300/60 to-transparent rounded-tl-sm" />
                                                    </div>
                                                    <div className="absolute top-1.5 right-1.5 w-6 h-6 border-t-2 border-r-2 border-amber-300/80 rounded-tr-lg flex items-start justify-end p-0.5">
                                                        <div className="w-2.5 h-2.5 bg-gradient-to-bl from-amber-300/60 to-transparent rounded-tr-sm" />
                                                    </div>
                                                    <div className="absolute bottom-1.5 left-1.5 w-6 h-6 border-b-2 border-l-2 border-amber-300/80 rounded-bl-lg flex items-end justify-start p-0.5">
                                                        <div className="w-2.5 h-2.5 bg-gradient-to-tr from-amber-300/60 to-transparent rounded-bl-sm" />
                                                    </div>
                                                    <div className="absolute bottom-1.5 right-1.5 w-6 h-6 border-b-2 border-r-2 border-amber-300/80 rounded-br-lg flex items-end justify-end p-0.5">
                                                        <div className="w-2.5 h-2.5 bg-gradient-to-tl from-amber-300/60 to-transparent rounded-br-sm" />
                                                    </div>
                                                </>
                                            )}

                                            <div className="relative">
                                                <div className="absolute inset-0 bg-amber-400/20 blur-xl" />
                                                <Disc3 className="w-10 h-10 sm:w-12 sm:h-12 text-[#FDE68A] animate-spin-slow mb-2 sm:mb-3 relative z-10" />
                                            </div>
                                            <span className="font-headline text-xs sm:text-sm font-black text-[#FDE68A] tracking-[0.25em] italic drop-shadow-md">P+ CARDER</span>
                                            <p className="text-[10px] text-slate-300 mt-2 sm:mt-3 font-bold tracking-wider text-center px-3">
                                                {isSqueezing && revealPercent > 0
                                                    ? `正從${PEEL_CORNER_LABELS[peelCorner]}掀開...`
                                                    : '全方向滑動掀開，或輕觸翻牌'}
                                            </p>
                                        </div>

                                        {/* 3D 擬真鋁箔折角反光層 (隨所選角落動態對角翻折) */}
                                        {revealPercent > 0 && revealPercent < 100 && (
                                            <div
                                                className={cn(
                                                    "absolute inset-0 z-40 pointer-events-none select-none drop-shadow-[0_8px_16px_rgba(0,0,0,0.85)]",
                                                    isSqueezing
                                                        ? "transition-none"
                                                        : "transition-[clip-path,opacity] duration-400 ease-[cubic-bezier(0.22,1,0.36,1)]"
                                                )}
                                                style={{
                                                    clipPath: peelGeo.flapClipPath,
                                                    background: peelGeo.flapGradient,
                                                }}
                                            />
                                        )}
                                    </div>
                                );
                            })()}
                        </div>

                        {currentPrize?.ticketNumber && (
                            <div className="mt-1.5 px-3 py-1 rounded-full bg-gradient-to-r from-[#FDE68A] to-amber-400 text-[#120d02] font-black text-xs shadow-md flex items-center gap-1 tabular-nums">
                                <span>一番賞番號 #{currentPrize.ticketNumber}</span>
                            </div>
                        )}

                        {step === 'ready-to-reveal' && (
                            <div className="flex items-center gap-2 mt-2.5 sm:mt-3 shrink-0">
                                <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={completeReveal}
                                    className="h-8 px-3.5 sm:px-4 rounded-full bg-white/[0.06] border border-white/[0.15] text-[10px] sm:text-xs font-bold text-white hover:bg-white/[0.12] hover:border-amber-300/40 transition-all shadow-lg shrink-0 cursor-pointer"
                                >
                                    <FastForward className="w-3.5 h-3.5 mr-1 text-[#FDE68A]" /> 翻開本張
                                </Button>
                                {drawnPrizes.length > 1 && (
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        onClick={skipAllToDone}
                                        className="h-8 px-3.5 sm:px-4 rounded-full bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] text-[10px] sm:text-xs font-black hover:brightness-105 transition-all shadow-lg shrink-0 cursor-pointer"
                                    >
                                        <Zap className="w-3.5 h-3.5 mr-1 fill-[#120d02]" /> 全部跳過結算
                                    </Button>
                                )}
                            </div>
                        )}
                    </motion.div>
                </div>
            ) : (
                <div className="flex-1 w-full max-w-5xl px-2 sm:px-4 z-20 min-h-0 flex flex-col justify-center relative select-none py-1">
                    {/* Horizontal swipeable prize shelf (centered when <= 3 items) */}
                    <div 
                        id="prize-scroll-container" 
                        className={cn(
                            "flex flex-row gap-3 sm:gap-4 py-2 px-2 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth items-center min-h-0",
                            sessionPrizes.length <= 3 && "justify-center"
                        )}
                    >
                        {sessionPrizes.map((p, i) => (
                            <div 
                                key={i} 
                                className="animate-fade-in-up snap-center w-[145px] sm:w-[175px] md:w-[200px] flex-shrink-0 relative flex flex-col gap-1.5" 
                                style={{ animationDelay: `${i * 70}ms` }}
                            >
                                {p.ticketNumber && (
                                    <div className="absolute top-2 left-2 z-30 px-2 py-0.5 rounded-md bg-gradient-to-r from-[#FDE68A] to-amber-400 text-[#120d02] font-black text-[10px] shadow-md pointer-events-none tabular-nums">
                                        #{p.ticketNumber}
                                    </div>
                                )}
                                {p.type === 'points' || p.isPoints || p.name?.includes('隨機球員') ? (
                                    <div className="w-full aspect-[2.5/4] rounded-xl overflow-hidden shadow-2xl border border-white/[0.1] hover:border-amber-300/45 transition-all duration-200 hover:scale-[1.03] relative">
                                        <RandomPlayerCard 
                                            rarity={p.rarity} 
                                            points={p.points}
                                            title={p.name}
                                            className="w-full h-full aspect-[2.5/4] rounded-xl hover:scale-100"
                                            onClick={() => setPreviewCard({ ...p, isPoints: true })} 
                                        />
                                    </div>
                                ) : (
                                    <div 
                                        className="w-full aspect-[2.5/4] rounded-xl overflow-hidden shadow-2xl border border-white/[0.1] hover:border-amber-300/45 transition-all duration-200 hover:scale-[1.03] group cursor-zoom-in relative"
                                        onClick={() => setPreviewCard({ ...p, rarity: p.rarity })}
                                    >
                                        <CardItem 
                                            name={p.name} 
                                            imageUrl={p.imageUrl}
                                            backImageUrl={p.backImageUrl} 
                                            imageHint={p.name} 
                                            rarity={p.rarity} 
                                            className="w-full h-full aspect-[2.5/4] hover:scale-100"
                                            isFlippable={false}
                                        />
                                    </div>
                                )}
                                <div className="px-2 py-1 rounded-lg bg-[#0a0f1c]/90 border border-white/[0.08] text-center">
                                    <p className="text-[11px] font-bold text-slate-200 truncate">{p.name || '戰利品'}</p>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Left / Right Scroll Buttons on Desktop */}
                    {sessionPrizes.length > 2 && (
                        <>
                            <button 
                                className="absolute left-1 top-1/2 -translate-y-1/2 z-50 bg-[#0a0f1c]/85 backdrop-blur-md p-2.5 rounded-full border border-amber-300/40 shadow-xl hover:bg-amber-400/15 transition-all hidden md:flex items-center justify-center cursor-pointer text-[#FDE68A]"
                                onClick={() => {
                                    const container = document.getElementById('prize-scroll-container');
                                    if (container) container.scrollBy({ left: -260, behavior: 'smooth' });
                                }}
                            >
                                <ChevronRight className="w-5 h-5 rotate-180" />
                            </button>

                            <button 
                                className="absolute right-1 top-1/2 -translate-y-1/2 z-50 bg-[#0a0f1c]/85 backdrop-blur-md p-2.5 rounded-full border border-amber-300/40 shadow-xl hover:bg-amber-400/15 transition-all hidden md:flex items-center justify-center cursor-pointer text-[#FDE68A]"
                                onClick={() => {
                                    const container = document.getElementById('prize-scroll-container');
                                    if (container) container.scrollBy({ left: 260, behavior: 'smooth' });
                                }}
                            >
                                <ChevronRight className="w-5 h-5" />
                            </button>
                        </>
                    )}

                    <p className="text-center text-[11px] text-slate-400 font-medium mt-1">
                        {sessionPrizes.length > 1 ? '左右滑動瀏覽戰利品 • 點擊卡片放大查看' : '點擊卡片放大查看詳情'}
                    </p>
                </div>
            )}

            {/* Bottom Action Area: Strictly Anchored, Compact & Mobile-Safe */}
            <div className="w-full max-w-md shrink-0 z-30 pb-2 sm:pb-4 px-2">
                 {(step === 'revealing' || step === 'done') && (
                    <div className="bg-[#0a0f1c]/95 backdrop-blur-2xl border border-white/[0.1] border-t-2 border-t-amber-300/60 p-3 sm:p-4 rounded-2xl w-full shadow-[0_24px_64px_rgba(0,0,0,0.88)] animate-fade-in-up transition-all space-y-2.5">
                        {cashbackPPoints > 0 && (
                            <div className="flex items-center justify-center gap-1.5 font-bold text-[11px] text-[#FDE68A] tabular-nums">
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                <span>VIP 回饋：+{cashbackPPoints}</span>
                                <PPlusIcon className="w-3.5 h-3.5 text-amber-300" />
                            </div>
                        )}
                        
                        {step === 'revealing' && revealedIndex < drawnPrizes.length - 1 ? (
                            <div className="space-y-2">
                                <Button 
                                    onClick={nextPrize} 
                                    className="w-full h-11 sm:h-12 font-black bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] rounded-xl shadow-[0_8px_24px_rgba(251,191,36,0.28)] text-xs sm:text-sm hover:brightness-105 active:scale-[0.98] transition-all cursor-pointer tabular-nums"
                                >
                                    {drawnPrizes[revealedIndex+1]?.type === 'last-prize' ? '揭曉最後賞限定！' : `揭曉下一項 (${revealedIndex+1}/${drawnPrizes.length})`}
                                </Button>
                                <Button 
                                    variant="outline"
                                    onClick={skipAllToDone} 
                                    className="w-full h-8 font-bold bg-white/[0.04] border-white/[0.1] text-amber-200 rounded-xl text-[11px] hover:bg-white/[0.08] hover:border-amber-300/40 active:scale-[0.98] transition-all cursor-pointer gap-1"
                                >
                                    <Zap className="w-3.5 h-3.5 text-amber-300 fill-amber-300" />
                                    <span>跳過剩餘動畫，直接結算全部</span>
                                </Button>
                            </div>
                        ) : (step === 'done' || (step === 'revealing' && revealedIndex === drawnPrizes.length - 1)) && (
                            <div className="space-y-2">
                                <div className="flex gap-2 w-full">
                                    {isLimitReachedForSingle ? (
                                        <Button disabled className="flex-1 h-12 text-xs font-bold rounded-xl bg-white/[0.04] text-slate-500 border border-white/[0.08]">
                                            今日次數已用完
                                        </Button>
                                    ) : (
                                        <DrawButtons 
                                            isLoadingStats={isLoadingStats}
                                            isLimitReachedForSingle={isLimitReachedForSingle}
                                            canDraw3={canDraw3}
                                            canDraw10={canDraw10}
                                            cardPool={cardPool}
                                            performDraw={(count, forceTicket, forceEventTicket) => performDraw(count, forceTicket, forceEventTicket, undefined)}
                                            performTrialDraw={(count) => performTrialDraw(count, undefined)}
                                            isTrialMode={isTrialMode}
                                            freeDrawTickets={userProfile?.freeDrawTickets || 0}
                                            eventPoolTickets={poolId && userProfile?.eventPoolTickets ? (userProfile.eventPoolTickets[poolId] || 0) : 0}
                                            onOpenPickNumber={
                                                (cardPool?.enablePickNumber || (cardPool?.kujiTickets && cardPool.kujiTickets.length > 0))
                                                    ? (count) => {
                                                        setSelectedNumbers([]);
                                                        setTargetPickCount(count || 1);
                                                        setIsPickNumberOpen(true);
                                                    }
                                                    : undefined
                                            }
                                        />
                                    )}
                                </div>
                                <div className="grid grid-cols-2 gap-2 pt-0.5">
                                    <Button asChild variant="outline" className="h-9 text-xs font-semibold border-white/[0.1] rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-slate-200 hover:text-white">
                                        <Link href="/draw">返回卡池</Link>
                                    </Button>
                                    
                                    {step === 'done' ? (
                                        <Button asChild variant="outline" className="h-9 text-xs font-bold border-amber-300/40 text-[#FDE68A] rounded-xl bg-amber-400/[0.12] hover:bg-amber-400/[0.2] hover:text-amber-200">
                                            <Link href="/collection">前往收藏庫</Link>
                                        </Button>
                                    ) : (
                                        <Button 
                                            onClick={() => setStep('done')} 
                                            variant="outline" 
                                            className="h-9 text-xs font-bold border-amber-300/40 text-[#FDE68A] rounded-xl bg-amber-400/[0.12] hover:bg-amber-400/[0.2] hover:text-amber-200 cursor-pointer"
                                        >
                                            查看本次總結
                                        </Button>
                                    )}
                                </div>

                                {/* 🌟 拼卡 · 自選專區專屬動線引導 */}
                                {step === 'done' && (
                                    <div className="mt-1 p-2.5 sm:p-3 rounded-xl bg-white/[0.03] border border-amber-300/25 flex items-center justify-between gap-2.5">
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-8 h-8 rounded-xl bg-amber-400/15 border border-amber-300/35 flex items-center justify-center text-[#FDE68A] shrink-0">
                                                <CrossedCardsIcon className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <span className="text-xs font-bold text-white">沒抽到心儀大獎？</span>
                                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-400/15 text-[#FDE68A] border border-amber-300/30">
                                                        自選專區
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 truncate mt-0.5">
                                                    前往「拼卡」挑選自選卡片與實體獎品，1/10 成本直接挑戰！
                                                </p>
                                            </div>
                                        </div>
                                        <Button asChild size="sm" className="h-8 px-3 text-xs font-black rounded-xl bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 hover:brightness-105 text-[#120d02] shrink-0 shadow-md">
                                            <Link href="/bet">前往拼卡</Link>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
            
            {/* 一番賞自選號碼彈窗 */}
            <KujiNumberPickerDialog
                isOpen={isPickNumberOpen}
                onClose={() => setIsPickNumberOpen(false)}
                cardPool={cardPool}
                isTrialMode={isTrialMode}
                initialSelectedNumbers={selectedNumbers}
                targetPickCount={targetPickCount}
                userBalance={
                    userProfile 
                        ? (cardPool?.currency === 'p-point' ? (userProfile.bonusPoints || 0) : (userProfile.points || 0))
                        : 0
                }
                isDrawing={false}
                onSelectNumbersOnly={(chosenNumbers) => {
                    setSelectedNumbers(chosenNumbers);
                    setIsPickNumberOpen(false);
                    toast({
                        title: '🎯 已鎖定自選號碼',
                        description: `已選取番號：#${chosenNumbers.join(', #')}，點擊下方「啟動開獎」即可開始抽卡！`,
                    });
                }}
                onConfirmDraw={(chosenNumbers, asTrial) => {
                    setSelectedNumbers(chosenNumbers);
                    setIsPickNumberOpen(false);
                    if (asTrial || isTrialMode) {
                        performTrialDraw(chosenNumbers.length, chosenNumbers);
                    } else {
                        performDraw(chosenNumbers.length, false, false, chosenNumbers);
                    }
                }}
            />

            {/* Full Screen Card Zoom Dialog (典藏級卡磚預覽) */}
            <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
                <DialogContent className="max-w-[min(92vw,360px)] bg-slate-950/95 backdrop-blur-2xl border border-white/10 rounded-[28px] p-5 flex flex-col items-center justify-center gap-3.5 [&>button:last-child]:hidden z-[200] shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] overflow-hidden">
                    <DialogTitle><VisuallyHiddenPrimitive.Root>卡片預覽</VisuallyHiddenPrimitive.Root></DialogTitle>
                    {previewCard && (
                        <div className="w-full flex flex-col items-center gap-3">
                            {/* 卡片標題與資訊 */}
                            <div className="text-center w-full px-2 space-y-1">
                                <p className="text-sm font-black text-white leading-snug line-clamp-2">{previewCard.name}</p>
                                {!(previewCard.isPoints || previewCard.type === 'points' || previewCard.name?.includes('隨機球員')) && (
                                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                        {previewCard.category && (
                                            <span className="text-[10px] font-bold text-slate-300 px-2 py-0.5 rounded-full bg-white/10 border border-white/15">
                                                {previewCard.category}
                                            </span>
                                        )}
                                        {(previewCard.sellPrice || 0) > 0 && (
                                            <span className="text-[10px] font-code font-black text-amber-300 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/30">
                                                參考估值 {Number(previewCard.sellPrice).toLocaleString()}
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div className="w-full max-w-[230px] aspect-[2.5/4] drop-shadow-[0_15px_30px_rgba(0,0,0,0.85)]">
                                {previewCard.isPoints || previewCard.type === 'points' || previewCard.name?.includes('隨機球員') ? (
                                    <RandomPlayerCard 
                                        rarity={previewCard.rarity} 
                                        points={previewCard.points} 
                                        title={previewCard.name}
                                        showBuybackHint={false}
                                        className="w-full h-full aspect-[2.5/4] rounded-xl"
                                    />
                                ) : (
                                    <CardItem
                                        name={previewCard.name}
                                        imageUrl={previewCard.imageUrl}
                                        backImageUrl={previewCard.backImageUrl}
                                        imageHint={previewCard.name}
                                        rarity={previewCard.rarity}
                                        isFlippable={true}
                                        className="w-full h-full aspect-[2.5/4]"
                                    />
                                )}
                            </div>
                            {!previewCard.isPoints && (
                                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] font-semibold text-slate-300">
                                    <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" />
                                    <span>點擊卡片可 3D 翻面觀看背卡</span>
                                </div>
                            )}
                        </div>
                    )}
                    <Button variant="ghost" size="icon" className="rounded-full bg-white/5 hover:bg-white/15 border border-white/10 h-9 w-9 text-slate-300 hover:text-white transition-all" onClick={() => setPreviewCard(null)}>
                        <X className="h-4 w-4" />
                    </Button>
                </DialogContent>
            </Dialog>
        </motion.div>
    );
}