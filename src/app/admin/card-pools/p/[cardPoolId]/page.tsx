'use client';

import { useState, ChangeEvent, useEffect, useMemo, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useAuth, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, updateDoc, doc, arrayUnion, arrayRemove, Timestamp, runTransaction, query, where } from '@/lib/audited-firestore';
import { v4 as uuidv4 } from 'uuid';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card as UICard, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  PlusCircle, Trash2, ArrowLeft, Check, Settings, Gem, Package, Clock, 
  GripVertical, Palette, Trophy, Star, Diamond, Layers, Gift, ShieldCheck, 
  Sparkles, Calculator, CheckCircle2, Search, Archive, Crown, Loader2, Save, 
  Ban, BarChart3, Ticket, Flame, Shuffle, RotateCcw, ExternalLink, Eye, 
  Upload, Filter, AlertCircle, ChevronRight, CheckSquare, Square
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { SafeImage } from '@/components/safe-image';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format } from 'date-fns';
import { cn, cleanFirestoreData, toSafeDate } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { userLevels } from '@/components/member-level-crown';
import { PPlusIcon } from '@/components/icons';
import { EventTicketDispatchDialog, EventTicketDispatchLogs } from '@/components/admin/event-ticket-manager';
import { HybridPoolValuationPanel } from '@/components/admin/HybridPoolValuationPanel';
import { HybridBoxWorkspace } from '@/components/admin/HybridBoxWorkspace';
import { HYBRID_68_PRESET, HYBRID_TIER_META, calculateHybridPoolValuation, suggestNicePrice } from '@/lib/hybrid-pool-preset';
import type { HybridTierCode } from '@/types/draw';
import { generateKujiTickets } from '@/lib/draw-utils';

const CATEGORIES = ["籃球", "棒球", "足球", "女孩卡", "女優", "TCG", "其他", "全部"];
const RARITIES = ['legendary', 'rare', 'common'] as const;
type Rarity = typeof RARITIES[number];

const RARITY_LABELS: Record<Rarity, string> = {
  legendary: '傳奇 (Legendary)',
  rare: '稀有 (Rare)',
  common: '普通 (Common)'
};

const RARITY_BADGE_STYLES: Record<Rarity, string> = {
  legendary: 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black shadow-sm border border-amber-300/60',
  rare: 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-bold shadow-sm border border-cyan-400/40',
  common: 'bg-slate-200 text-slate-700 font-bold border border-slate-300/60'
};

interface CardInPool {
  cardId: string;
  quantity: number;
}

interface PointPrize {
  prizeId: string;
  points: number;
  quantity: number;
  rarity: Rarity;
  name?: string;
}

interface CardPool {
  id?: string;
  name: string;
  description: string;
  imageUrl: string;
  cards?: CardInPool[];
  pointPrizes?: PointPrize[];
  price?: number;
  price3Draws?: number;
  price10Draws?: number;
  totalPacks?: number;
  remainingPacks?: number;
  hasProtection?: boolean;
  isActive?: boolean;
  isFeatured?: boolean;
  currency?: 'diamond' | 'p-point';
  cardRarities?: { [cardId: string]: Rarity };
  lastPrizeCardId?: string;
  startsAt?: Timestamp;
  expiresAt?: Timestamp;
  pointMultiplier?: number;
  pointMultiplierExpiresAt?: Timestamp;
  dailyLimit?: number;
  minLevel?: string;
  agentId?: string;
  allowFreeDraw?: boolean;
  isEventPool?: boolean;
  exclusiveTicketOnly?: boolean;
  eventTicketName?: string;
  eventRules?: string;
  eventMaxDrawsPerUser?: number;
  categoryId?: string;
  isAdult?: boolean;
  enablePickNumber?: boolean;
  isBlindBoxMode?: boolean;
  isHybridBlindSpMode?: boolean;
  presetUsed?: string;
  snipeAlertThreshold?: number;
  snipeWebhookUrl?: string;
  cardTiers?: Record<string, HybridTierCode>;
  cardCosts?: Record<string, number>;
  cardCertNumbers?: Record<string, string>;
  spBuybackPoints?: Record<string, number>;
  lastPrizeCost?: number;
  totalTicketsCount?: number;
  kujiTickets?: any[];
  lastPrizeClaimed?: boolean;
}

interface CardData {
  id: string;
  name: string;
  category: string;
  imageUrl: string;
  backImageUrl?: string;
  sellPrice?: number;
  source?: string;
  isSold?: boolean;
  isRecycled?: boolean;
  status?: string;
  createdAt?: any;
}

export default function CardPoolDetailPage() {
  const router = useRouter();
  const params = useParams();
  const cardPoolId = params.cardPoolId as string;
  
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'basic' | 'cards' | 'special'>('basic');
  const [isAddCardDialogOpen, setIsAddCardDialogOpen] = useState(false);
  const [selectedCardsToAdd, setSelectedCardsToAdd] = useState<string[]>([]);
  const [targetPrizeType, setTargetPrizeType] = useState<'standard' | 'last'>('standard');
  
  const [poolDetails, setPoolDetails] = useState<Partial<CardPool>>({});
  const [addCardCategoryFilter, setAddCardCategoryFilter] = useState('全部');
  const [addCardSearchTerm, setAddCardSearchTerm] = useState('');
  const [addCardSortOption, setAddCardSortOption] = useState<'newest' | 'price-desc' | 'price-asc'>('newest');
  const [addCardMinPrice, setAddCardMinPrice] = useState('');
  const [addCardMaxPrice, setAddCardMaxPrice] = useState('');
  const [timeValue, setTimeValue] = useState("00:00");
  const [startTimeValue, setStartTimeValue] = useState("00:00");
  
  // 池內卡片搜尋與篩選
  const [poolCardSearch, setPoolCardSearch] = useState('');
  const [poolRarityFilter, setPoolRarityFilter] = useState<string>('all');
  const [selectedPoolCards, setSelectedPoolCards] = useState<string[]>([]);
  const [previewZoomCard, setPreviewZoomCard] = useState<CardData | null>(null);

  // 儲存狀態指示
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // 一番賞籤位篩選
  const [kujiFilter, setKujiFilter] = useState<'all' | 'available' | 'drawn'>('all');

  const [newPointPrize, setNewPointPrize] = useState({ points: 50, quantity: 10, rarity: 'common' as Rarity });
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);
  const [forceConfirmRedHealth, setForceConfirmRedHealth] = useState(false);
  const [targetBoxTier, setTargetBoxTier] = useState<'A' | 'SP' | 'B' | 'C' | 'D'>('A');

  const agentsQuery = useMemoFirebase(() => (firestore ? collection(firestore, 'agents') : null), [firestore]);
  const { data: agents } = useCollection<{ id: string, name: string }>(agentsQuery);

  // 讀取卡池詳情
  const cardPoolRef = useMemoFirebase(() => {
    if (!firestore || !cardPoolId) return null;
    return doc(firestore, 'cardPools', cardPoolId);
  }, [firestore, cardPoolId]);
  const { data: cardPool, isLoading: isLoadingPool, error: poolError } = useDoc<CardPool>(cardPoolRef);

  // 讀取全域卡片
  const allCardsCollectionRef = useMemoFirebase(() => {
    if (!firestore) return null;
    return collection(firestore, 'allCards');
  }, [firestore]);
  const { data: allCards, isLoading: isLoadingAllCards } = useCollection<CardData>(allCardsCollectionRef);

  // 讀取卡池與其他活動以進行已指派卡片防呆
  const { data: allCardPools } = useCollection<CardPool>(useMemoFirebase(() => firestore ? collection(firestore, 'cardPools') : null, [firestore]));
  const { data: bettingItems } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'betting-items') : null, [firestore]));
  const { data: luckBags } = useCollection<any>(useMemoFirebase(() => firestore ? collection(firestore, 'luckBags') : null, [firestore]));

  // 匯總已被任何卡池（包含本池已抽出為 0 的卡片、籤表、最後賞）、拼卡或福袋佔用/抽出的卡片 ID
  const { globallyAssignedCardIds, historicallyDrawnCardIds } = useMemo(() => {
    const assignedIds = new Set<string>();
    const drawnIds = new Set<string>();

    allCardPools?.forEach(p => {
      p.cards?.forEach(c => {
        if (!c?.cardId) return;
        assignedIds.add(c.cardId);
        if ((c.quantity ?? 0) <= 0) {
          drawnIds.add(c.cardId);
        }
      });
      p.kujiTickets?.forEach((t: any) => {
        if (!t?.cardId) return;
        assignedIds.add(t.cardId);
        if (t.isDrawn) {
          drawnIds.add(t.cardId);
        }
      });
      if (p.lastPrizeCardId) {
        assignedIds.add(p.lastPrizeCardId);
        if ((p as any).lastPrizeClaimed || (p.remainingPacks !== undefined && p.remainingPacks <= 0 && (p.totalPacks ?? 0) > 0)) {
          drawnIds.add(p.lastPrizeCardId);
        }
      }
    });

    bettingItems?.forEach(item => {
      item.allCardIds?.forEach((id: string) => assignedIds.add(id));
      item.soldCardIds?.forEach((id: string) => {
        assignedIds.add(id);
        drawnIds.add(id);
      });
    });

    luckBags?.forEach(bag => {
      if (bag.prizes?.first) assignedIds.add(bag.prizes.first);
      if (bag.prizes?.second) assignedIds.add(bag.prizes.second);
      if (bag.prizes?.third) assignedIds.add(bag.prizes.third);
      bag.otherPrizes?.forEach((p: any) => {
        if (p?.type === 'card' && p?.cardId) assignedIds.add(p.cardId);
      });
    });

    return { globallyAssignedCardIds: assignedIds, historicallyDrawnCardIds: drawnIds };
  }, [allCardPools, bettingItems, luckBags]);

  // 自動校正歷史已抽出但尚未標記 isSold 的大獎卡片，確保刪除舊卡池後也不會回到在庫清單被重複調用
  const hasSyncedHistoricalSoldRef = useRef(false);
  useEffect(() => {
    if (!firestore || !allCards || historicallyDrawnCardIds.size === 0 || hasSyncedHistoricalSoldRef.current) return;
    const unsyncedDrawnCards = allCards.filter(c => historicallyDrawnCardIds.has(c.id) && !c.isSold);
    hasSyncedHistoricalSoldRef.current = true;
    if (unsyncedDrawnCards.length === 0) return;

    Promise.allSettled(
      unsyncedDrawnCards.map(c =>
        updateDoc(doc(firestore, 'allCards', c.id), {
          isSold: true,
          status: 'sold',
          soldVia: 'draw',
        })
      )
    ).catch(err => console.warn('Sync drawn card sold status failed:', err));
  }, [firestore, allCards, historicallyDrawnCardIds]);

  // 同步卡池資料至 state
  useEffect(() => {
    if (cardPool) {
      const details: Partial<CardPool> = {
        name: cardPool.name || '',
        description: cardPool.description || '',
        imageUrl: cardPool.imageUrl || '',
        cards: cardPool.cards || [],
        pointPrizes: (cardPool.pointPrizes || []).filter(p => p && typeof p === 'object' && 'points' in p),
        price: cardPool.price || 0,
        price3Draws: cardPool.price3Draws || 0,
        price10Draws: cardPool.price10Draws || 0,
        totalPacks: cardPool.totalPacks || 0,
        remainingPacks: cardPool.remainingPacks || 0,
        hasProtection: cardPool.hasProtection !== false,
        isActive: cardPool.isActive !== false,
        isFeatured: cardPool.isFeatured || false,
        currency: cardPool.currency || 'diamond',
        cardRarities: cardPool.cardRarities || {},
        lastPrizeCardId: cardPool.lastPrizeCardId || '',
        startsAt: cardPool.startsAt,
        expiresAt: cardPool.expiresAt,
        pointMultiplier: cardPool.pointMultiplier || 1,
        pointMultiplierExpiresAt: cardPool.pointMultiplierExpiresAt,
        dailyLimit: cardPool.dailyLimit ?? 0,
        minLevel: cardPool.minLevel || '新手收藏家',
        agentId: cardPool.agentId || '',
        allowFreeDraw: cardPool.allowFreeDraw !== false,
        isEventPool: cardPool.isEventPool || false,
        exclusiveTicketOnly: cardPool.exclusiveTicketOnly || false,
        eventTicketName: cardPool.eventTicketName || '活動專屬抽卡券',
        eventRules: cardPool.eventRules || '',
        eventMaxDrawsPerUser: cardPool.eventMaxDrawsPerUser || 0,
        enablePickNumber: cardPool.enablePickNumber || false,
        isBlindBoxMode: cardPool.isBlindBoxMode || false,
        isHybridBlindSpMode: cardPool.isHybridBlindSpMode || false,
        presetUsed: cardPool.presetUsed || 'high_margin_68',
        snipeAlertThreshold: cardPool.snipeAlertThreshold ?? 15,
        snipeWebhookUrl: cardPool.snipeWebhookUrl || '',
        cardTiers: cardPool.cardTiers || {},
        cardCosts: cardPool.cardCosts || {},
        cardCertNumbers: cardPool.cardCertNumbers || {},
        spBuybackPoints: cardPool.spBuybackPoints || {},
        lastPrizeCost: cardPool.lastPrizeCost ?? 9000,
        totalTicketsCount: cardPool.totalTicketsCount || cardPool.remainingPacks || 80,
        kujiTickets: cardPool.kujiTickets || [],
        isAdult: cardPool.isAdult || false,
      };
      setPoolDetails(details);
      if (cardPool.expiresAt) {
        const expDate = toSafeDate(cardPool.expiresAt);
        if (expDate) setTimeValue(format(expDate, "HH:mm"));
      }
      if (cardPool.startsAt) {
        const startDate = toSafeDate(cardPool.startsAt);
        if (startDate) setStartTimeValue(format(startDate, "HH:mm"));
      }
    }
  }, [cardPool]);

  // 池內卡片解析（保留已抽出 quantity === 0 的紀錄供後台檢視並鎖定 ID，防止重複加入）
  const { cardsInPool, cardsInPoolIds } = useMemo(() => {
    if (!allCards || !cardPool?.cards) return { cardsInPool: [], cardsInPoolIds: new Set<string>() };
    const cardIdToDataMap = new Map(allCards.map(c => [c.id, c]));
    const idSet = new Set<string>();

    const cards = cardPool.cards.map(poolCard => {
      idSet.add(poolCard.cardId);
      const cardData = cardIdToDataMap.get(poolCard.cardId);
      if (cardData) {
        return { ...cardData, quantity: Math.max(0, poolCard.quantity || 0) };
      }
      return null;
    }).filter((c): c is CardData & { quantity: number } => c !== null);

    return { cardsInPool: cards, cardsInPoolIds: idSet };
  }, [allCards, cardPool]);

  // 過濾後的池內卡片
  const filteredCardsInPool = useMemo(() => {
    return cardsInPool.filter(card => {
      const matchesSearch = !poolCardSearch.trim() || 
        card.name.toLowerCase().includes(poolCardSearch.toLowerCase()) ||
        card.category.toLowerCase().includes(poolCardSearch.toLowerCase());
      
      const currentRarity = poolDetails.cardRarities?.[card.id] || 'common';
      const matchesRarity = poolRarityFilter === 'all' || currentRarity === poolRarityFilter;

      return matchesSearch && matchesRarity;
    });
  }, [cardsInPool, poolCardSearch, poolRarityFilter, poolDetails.cardRarities]);

  // 獎品統計
  const totalCardsCount = useMemo(() => {
    return (poolDetails.cards || []).reduce((sum, c) => sum + (c.quantity || 0), 0);
  }, [poolDetails.cards]);

  const totalPointPrizesCount = useMemo(() => {
    return (poolDetails.pointPrizes || []).reduce((sum, p) => sum + (p.quantity || 0), 0);
  }, [poolDetails.pointPrizes]);

  const totalPrizesCount = totalCardsCount + totalPointPrizesCount;

  // 總卡池參考市場價值與售價預估
  const { totalPoolValue, estimatedGrossRevenue } = useMemo(() => {
    if (!allCards || !poolDetails) return { totalPoolValue: 0, estimatedGrossRevenue: 0 };

    let totalValue = 0;
    const cardMap = new Map(allCards.map(c => [c.id, c.sellPrice || 0]));

    poolDetails.cards?.forEach(pc => {
      const price = cardMap.get(pc.cardId) || 0;
      totalValue += price * pc.quantity;
    });

    if (poolDetails.lastPrizeCardId) {
      totalValue += cardMap.get(poolDetails.lastPrizeCardId) || 0;
    }

    poolDetails.pointPrizes?.forEach(pp => {
      totalValue += pp.points * pp.quantity;
    });

    const estimatedGrossRevenue = (poolDetails.price || 0) * (poolDetails.totalPacks || 0);

    return { 
      totalPoolValue: totalValue, 
      estimatedGrossRevenue
    };
  }, [allCards, poolDetails]);

  // 最後賞卡片
  const lastPrizeCard = useMemo(() => {
    if (!allCards || !poolDetails.lastPrizeCardId) return null;
    return allCards.find(c => c.id === poolDetails.lastPrizeCardId);
  }, [allCards, poolDetails.lastPrizeCardId]);

  // 傳奇大獎卡片清單
  const topPrizeCards = useMemo(() => {
    if (!allCards || !cardPool?.cardRarities) return [];
    const cardIdToDataMap = new Map(allCards.map(c => [c.id, c]));
    const activePrizeCards: CardData[] = [];
    const addedCardIds = new Set<string>();

    for (const rarity of RARITIES) {
      if (activePrizeCards.length >= 6) break;
      const cardIdsForRarity = Object.entries(cardPool.cardRarities)
        .filter(([, r]) => r === rarity)
        .map(([id]) => id);

      for (const cardId of cardIdsForRarity) {
        if (activePrizeCards.length >= 6) break;
        const cardData = cardIdToDataMap.get(cardId);
        const poolEntry = cardPool.cards?.find(c => c.cardId === cardId);
        if (cardData && poolEntry && poolEntry.quantity > 0 && !addedCardIds.has(cardId)) {
          activePrizeCards.push(cardData);
          addedCardIds.add(cardId);
        }
      }
    }
    return activePrizeCards;
  }, [allCards, cardPool]);

  // 可加入卡池的卡片清單（嚴格排除已抽出、已售出、已回收、或已綁定任何卡池/活動之實體卡）
  const availableCardsToAdd = useMemo(() => {
    if (!allCards) return [];
    const available = allCards.filter(card => 
      !card.isSold && 
      !card.isRecycled &&
      card.status !== 'sold' &&
      !historicallyDrawnCardIds.has(card.id) &&
      !globallyAssignedCardIds.has(card.id) &&
      !cardsInPoolIds.has(card.id) &&
      card.id !== poolDetails.lastPrizeCardId &&
      card.source !== 'group-break'
    );

    let filtered = available;
    if (addCardCategoryFilter !== '全部') {
      filtered = filtered.filter(card => card.category === addCardCategoryFilter);
    }
    if (addCardSearchTerm.trim()) {
      filtered = filtered.filter(card => card.name.toLowerCase().includes(addCardSearchTerm.toLowerCase()));
    }

    const minP = addCardMinPrice.trim() !== '' ? Number(addCardMinPrice) : null;
    const maxP = addCardMaxPrice.trim() !== '' ? Number(addCardMaxPrice) : null;
    if (minP !== null && !Number.isNaN(minP)) {
      filtered = filtered.filter(card => (card.sellPrice ?? 0) >= minP);
    }
    if (maxP !== null && !Number.isNaN(maxP)) {
      filtered = filtered.filter(card => (card.sellPrice ?? 0) <= maxP);
    }

    const getCreatedTime = (c: CardData) => {
      if (!c.createdAt) return 0;
      const raw = typeof c.createdAt === 'string'
        ? c.createdAt
        : c.createdAt?.seconds
          ? c.createdAt.seconds * 1000
          : c.createdAt;
      const t = new Date(raw).getTime();
      return Number.isNaN(t) ? 0 : t;
    };

    filtered = [...filtered].sort((a, b) => {
      if (addCardSortOption === 'price-desc') {
        const diff = (b.sellPrice ?? 0) - (a.sellPrice ?? 0);
        if (diff !== 0) return diff;
      } else if (addCardSortOption === 'price-asc') {
        const diff = (a.sellPrice ?? 0) - (b.sellPrice ?? 0);
        if (diff !== 0) return diff;
      }
      const da = getCreatedTime(a);
      const db = getCreatedTime(b);
      if (da !== db) return db - da;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [allCards, historicallyDrawnCardIds, globallyAssignedCardIds, cardsInPoolIds, poolDetails.lastPrizeCardId, addCardCategoryFilter, addCardSearchTerm, addCardMinPrice, addCardMaxPrice, addCardSortOption]);

  // 機率計算
  const probabilities = useMemo(() => {
    const rarityCounts = { legendary: 0, rare: 0, common: 0 };
    let totalItems = 0;

    if (poolDetails.cardRarities && poolDetails.cards) {
      poolDetails.cards.forEach(cardInPool => {
        if (cardInPool.quantity > 0) {
          const rarity = poolDetails.cardRarities?.[cardInPool.cardId];
          if (rarity) {
            rarityCounts[rarity] += cardInPool.quantity;
            totalItems += cardInPool.quantity;
          }
        }
      });
    }

    if (poolDetails.pointPrizes) {
      poolDetails.pointPrizes.forEach(prize => {
        if (prize.rarity && prize.quantity > 0) {
          rarityCounts[prize.rarity] += prize.quantity;
          totalItems += prize.quantity;
        }
      });
    }

    if (totalItems === 0) return { legendary: 0, rare: 0, common: 0, totalItems: 0 };

    return {
      legendary: (rarityCounts.legendary / totalItems) * 100,
      rare: (rarityCounts.rare / totalItems) * 100,
      common: (rarityCounts.common / totalItems) * 100,
      totalItems,
      counts: rarityCounts
    };
  }, [poolDetails]);

  // 錯誤處理
  useEffect(() => {
    if (poolError) {
      toast({ variant: 'destructive', title: '錯誤', description: '無法載入卡池資料。' });
      router.push('/admin/card-pools');
    }
  }, [poolError, router, toast]);

  // 核心欄位更新
  const handleUpdatePoolDetails = async (field: keyof CardPool, value: any) => {
    if (!cardPoolRef) return;
    try {
      setIsSaving(true);
      const updateData: Partial<CardPool> = { [field]: value === undefined ? null : value };
      await updateDoc(cardPoolRef, cleanFirestoreData(updateData));
      setLastSavedTime(format(new Date(), 'HH:mm:ss'));
      toast({ title: '已儲存', description: `欄位「${String(field)}」設定已同步。` });
    } catch(e) {
      console.error(e);
      toast({ variant: 'destructive', title: '錯誤', description: '更新卡池失敗。' });
    } finally {
      setIsSaving(false);
    }
  };

  // 手動全量儲存
  const handleSaveAllChanges = async () => {
    if (!cardPoolRef) return;
    try {
      setIsSaving(true);
      await updateDoc(cardPoolRef, cleanFirestoreData(poolDetails));
      setLastSavedTime(format(new Date(), 'HH:mm:ss'));
      toast({ title: '儲存成功', description: '卡池所有設定已全數同步至伺服器。' });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: '儲存失敗', description: '請檢查網路連線。' });
    } finally {
      setIsSaving(false);
    }
  };

  // 一番賞籤位生成
  const handleGenerateKujiTickets = async () => {
    if (!cardPoolRef || !cardPool) return;
    const cardsTotal = (poolDetails.cards || []).reduce((sum, c) => sum + (c.quantity || 0), 0);
    const pointsTotal = (poolDetails.pointPrizes || []).reduce((sum, p) => sum + (p.quantity || 0), 0);
    const exactTotalPrizes = cardsTotal + pointsTotal;
    
    if (exactTotalPrizes <= 0) {
      toast({
        variant: 'destructive',
        title: '無法產生籤位',
        description: '卡池中尚未配置任何卡牌或點數獎品，請先在「卡片與庫存配置」區加入獎項。',
      });
      return;
    }

    const newTickets = generateKujiTickets({
      ...cardPool,
      cards: poolDetails.cards,
      pointPrizes: poolDetails.pointPrizes,
    }, exactTotalPrizes);

    const updatePayload = {
      kujiTickets: newTickets,
      enablePickNumber: true,
      totalTicketsCount: exactTotalPrizes,
      totalPacks: exactTotalPrizes,
      remainingPacks: newTickets.filter(t => !t.isDrawn).length,
    };

    setPoolDetails(prev => ({
      ...prev,
      ...updatePayload,
    }));

    await updateDoc(cardPoolRef, cleanFirestoreData(updatePayload));
    toast({
      title: '一番賞籤位產生成功！',
      description: `已成功與獎品數量（共 ${exactTotalPrizes} 個獎項）1:1 綁定生成 ${newTickets.length} 張番號籤牌！`,
    });
  };

  // 一番賞重置（嚴格保護已被抽出的實體大獎卡片，禁止將已開出的大獎重置回未開出狀態）
  const handleResetKujiTickets = async () => {
    if (!cardPoolRef || !poolDetails.kujiTickets) return;
    const soldSet = new Set(
      (allCards || [])
        .filter(c => c.isSold || c.isRecycled || c.status === 'sold' || historicallyDrawnCardIds.has(c.id))
        .map(c => c.id)
    );
    let lockedCardCount = 0;

    const resetTickets = poolDetails.kujiTickets.map(t => {
      const isAlreadyWonPhysicalCard = Boolean(t.cardId && (t.isDrawn || soldSet.has(t.cardId)));
      if (isAlreadyWonPhysicalCard) {
        lockedCardCount += 1;
        return t;
      }
      const item: any = {
        number: t.number,
        isDrawn: false,
        drawnBy: null,
        drawnByName: null,
        drawnAt: null,
      };
      if (t.cardId) item.cardId = t.cardId;
      if (t.pointPrizeId) item.pointPrizeId = t.pointPrizeId;
      return item;
    });

    const availableCount = resetTickets.filter(t => !t.isDrawn).length;
    setPoolDetails(prev => ({ ...prev, kujiTickets: resetTickets, remainingPacks: availableCount }));
    await updateDoc(cardPoolRef, cleanFirestoreData({ kujiTickets: resetTickets, remainingPacks: availableCount }));
    toast({
      title: '一番賞籤位已重置',
      description: lockedCardCount > 0
        ? `小賞號碼已恢復為未開出；其中 ${lockedCardCount} 張已抽出的實體大獎維持鎖定，防止重複開出！`
        : '全數號碼已恢復為未開出狀態！',
    });
  };

  // 日期選取處理
  const handleDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const [hours, minutes] = timeValue.split(':').map(Number);
    date.setHours(hours || 0, minutes || 0);
    const newTimestamp = Timestamp.fromDate(date);
    setPoolDetails({...poolDetails, expiresAt: newTimestamp });
    handleUpdatePoolDetails('expiresAt', newTimestamp);
  };

  const handleTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setTimeValue(newTime);
    const expDate = toSafeDate(poolDetails.expiresAt);
    if (expDate) {
      const newDate = new Date(expDate);
      const [hours, minutes] = newTime.split(':').map(Number);
      newDate.setHours(hours || 0, minutes || 0);
      const newTimestamp = Timestamp.fromDate(newDate);
      setPoolDetails({...poolDetails, expiresAt: newTimestamp });
      handleUpdatePoolDetails('expiresAt', newTimestamp);
    }
  };
  
  const handleStartDateSelect = (date: Date | undefined) => {
    if (!date) return;
    const [hours, minutes] = startTimeValue.split(':').map(Number);
    date.setHours(hours || 0, minutes || 0);
    const newTimestamp = Timestamp.fromDate(date);
    setPoolDetails({...poolDetails, startsAt: newTimestamp });
    handleUpdatePoolDetails('startsAt', newTimestamp);
  };

  const handleStartTimeChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newTime = e.target.value;
    setStartTimeValue(newTime);
    const startDate = toSafeDate(poolDetails.startsAt);
    if (startDate) {
      const newDate = new Date(startDate);
      const [hours, minutes] = newTime.split(':').map(Number);
      newDate.setHours(hours || 0, minutes || 0);
      const newTimestamp = Timestamp.fromDate(newDate);
      setPoolDetails({...poolDetails, startsAt: newTimestamp });
      handleUpdatePoolDetails('startsAt', newTimestamp);
    }
  };

  // 開啟加入卡片彈窗
  const handleOpenAddCardDialog = (type: 'standard' | 'last' = 'standard') => {
    setTargetPrizeType(type);
    setSelectedCardsToAdd([]);
    setAddCardCategoryFilter('全部');
    setAddCardSearchTerm('');
    setAddCardMinPrice('');
    setAddCardMaxPrice('');
    setAddCardSortOption('newest');
    setIsAddCardDialogOpen(true);
  };

  // 確認將卡片加入卡池（交易層級二次驗證 isSold 與歷史抽出狀態，徹底杜絕已抽出大獎再次被調用）
  const handleConfirmAddCards = async () => {
    if (!cardPoolRef || selectedCardsToAdd.length === 0 || !cardPool || !firestore) return;

    if (targetPrizeType === 'last') {
      const cardId = selectedCardsToAdd[0];
      try {
        await runTransaction(firestore, async (transaction) => {
          const cSnap = await transaction.get(doc(firestore, 'allCards', cardId));
          if (!cSnap.exists()) throw new Error('找不到該卡片主檔。');
          const cData = cSnap.data() as CardData;
          if (cData.isSold || cData.isRecycled || cData.status === 'sold' || historicallyDrawnCardIds.has(cardId)) {
            throw new Error(`卡片「${cData.name || cardId}」已被抽出或售出，無法再次設為最後賞！`);
          }
          transaction.update(cardPoolRef, cleanFirestoreData({
            lastPrizeCardId: cardId,
            lastPrizeClaimed: false,
          }));
        });
        setPoolDetails(prev => ({ ...prev, lastPrizeCardId: cardId, lastPrizeClaimed: false }));
        toast({ title: '成功', description: '已設定最後賞卡片。' });
        setIsAddCardDialogOpen(false);
      } catch (error) {
        toast({
          variant: 'destructive',
          title: '無法設定最後賞',
          description: error instanceof Error ? error.message : String(error),
        });
      }
      return;
    }

    try {
      const uniqueSelectedIds = Array.from(new Set(selectedCardsToAdd));
      await runTransaction(firestore, async (transaction) => {
        const pSnap = await transaction.get(cardPoolRef);
        if (!pSnap.exists()) throw new Error('找不到指定的卡池。');
        const pData = pSnap.data() as CardPool;

        const cardSnaps = await Promise.all(
          uniqueSelectedIds.map(cid => transaction.get(doc(firestore, 'allCards', cid)))
        );

        const existingCards = [...(pData.cards || [])];
        const existingRarities = { ...(pData.cardRarities || {}) };
        const existingTiers = { ...(pData.cardTiers || {}) };
        const existingCosts = { ...(pData.cardCosts || {}) };
        const existingBuybacks = { ...(pData.spBuybackPoints || {}) };
        let addedCount = 0;

        cardSnaps.forEach((cSnap, index) => {
          const cardId = uniqueSelectedIds[index];
          if (!cSnap.exists()) {
            throw new Error(`找不到卡片資料 (${cardId})。`);
          }
          const cData = cSnap.data() as CardData;
          if (cData.isSold || cData.isRecycled || cData.status === 'sold' || historicallyDrawnCardIds.has(cardId)) {
            throw new Error(`大獎卡片「${cData.name || cardId}」已被抽出，不可再次被卡池調用！`);
          }
          if (existingCards.some(c => c.cardId === cardId)) {
            throw new Error(`卡片「${cData.name || cardId}」已存在於此卡池中，不可重複配置！`);
          }
          existingCards.push({ cardId, quantity: 1 });
          if (pData.isHybridBlindSpMode) {
            existingTiers[cardId] = targetBoxTier;
            existingRarities[cardId] =
              targetBoxTier === 'A' || targetBoxTier === 'SP'
                ? 'legendary'
                : targetBoxTier === 'B' || targetBoxTier === 'C'
                  ? 'rare'
                  : 'common';
            const tierCfg = HYBRID_68_PRESET.tiers.find((t) => t.code === targetBoxTier);
            const fallbackCost = Math.round(Number(pData.price || HYBRID_68_PRESET.price_per_pull) * (tierCfg?.cost_multiple_of_price || 1));
            const resolvedCost = Number(cData.sellPrice || fallbackCost);
            existingCosts[cardId] = resolvedCost;
            if (targetBoxTier === 'SP') {
              existingBuybacks[cardId] = Math.round(resolvedCost * HYBRID_68_PRESET.sp_buyback_rate);
            }
          } else if (!existingRarities[cardId]) {
            existingRarities[cardId] = 'common';
          }
          addedCount += 1;
        });

        const updateData: any = {
          cards: existingCards,
          cardRarities: existingRarities,
        };
        if (pData.isHybridBlindSpMode) {
          const actualRemaining =
            existingCards.reduce((s, c) => s + Math.max(0, c.quantity || 0), 0) +
            (pData.pointPrizes || []).reduce((s: number, p: any) => s + Math.max(0, p?.quantity || 0), 0);
          updateData.cardTiers = existingTiers;
          updateData.cardCosts = existingCosts;
          updateData.spBuybackPoints = existingBuybacks;
          updateData.remainingPacks = actualRemaining;
        } else {
          updateData.totalPacks = (pData.totalPacks || 0) + addedCount;
          updateData.remainingPacks = (pData.remainingPacks || 0) + addedCount;
        }

        transaction.update(cardPoolRef, cleanFirestoreData(updateData));
      });

      toast({ title: '成功', description: `${uniqueSelectedIds.length} 張卡片已加入卡池。`});
      setIsAddCardDialogOpen(false);
    } catch (error) {
      console.error("Error adding cards to pool:", error);
      toast({ 
        variant: "destructive", 
        title: "無法加入卡片", 
        description: error instanceof Error ? error.message : String(error) 
      });
    }
  };

  // 稀有度等級變更
  const handleCardRarityInPoolChange = async (cardId: string, newRarity: Rarity) => {
    if (!cardPoolRef) return;
    try {
      const fieldPath = `cardRarities.${cardId}`;
      await updateDoc(cardPoolRef, { [fieldPath]: newRarity });
      setPoolDetails(prev => ({
        ...prev,
        cardRarities: {
          ...prev.cardRarities,
          [cardId]: newRarity
        }
      }));
      toast({ title: '成功', description: `卡片稀有度已更新為「${RARITY_LABELS[newRarity]}」。` });
    } catch (error) {
      console.error("Error updating card rarity in pool:", error);
      toast({ variant: "destructive", title: "錯誤", description: "更新卡片稀有度失敗。" });
    }
  };

  // 批次設定選取卡片的稀有度
  const handleBatchSetRarity = async (newRarity: Rarity) => {
    if (!cardPoolRef || selectedPoolCards.length === 0) return;
    try {
      const updates: Record<string, Rarity> = {};
      selectedPoolCards.forEach(id => {
        updates[`cardRarities.${id}`] = newRarity;
      });
      await updateDoc(cardPoolRef, updates);

      setPoolDetails(prev => {
        const nextRarities = { ...(prev.cardRarities || {}) };
        selectedPoolCards.forEach(id => { nextRarities[id] = newRarity; });
        return { ...prev, cardRarities: nextRarities };
      });

      toast({ 
        title: '批次設定成功', 
        description: `已將 ${selectedPoolCards.length} 張卡片設定為「${RARITY_LABELS[newRarity]}」。` 
      });
      setSelectedPoolCards([]);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: '批次更新失敗' });
    }
  };

  // 從池中移除卡片（若該卡片已被抽出 quantity <= 0，移除池內顯示紀錄時仍強制維持 allCards.isSold = true）
  const handleRemoveCardFromPool = async (cardIdToRemove: string) => {
    if (!cardPoolRef || !cardPool || !cardPool.cards || !firestore) return;
    const cardToRemove = cardPool.cards.find(c => c.cardId === cardIdToRemove);
    if (!cardToRemove) return;
    try {
      const newCardRarities = { ...cardPool.cardRarities };
      delete (newCardRarities as Record<string, Rarity>)[cardIdToRemove];
      
      const quantityToRemove = Math.max(0, cardToRemove.quantity || 0);
      const newRemainingPacks = Math.max(0, (cardPool.remainingPacks || 0) - quantityToRemove);

      if (quantityToRemove <= 0) {
        await updateDoc(doc(firestore, 'allCards', cardIdToRemove), {
          isSold: true,
          status: 'sold',
          soldVia: 'draw',
        }).catch(() => {});
      }

      await updateDoc(cardPoolRef, {
        cards: arrayRemove(cardToRemove),
        cardRarities: newCardRarities,
        ...(cardPool.isHybridBlindSpMode ? {} : { totalPacks: Math.max(0, (cardPool.totalPacks || 0) - quantityToRemove) }),
        remainingPacks: newRemainingPacks
      });
      toast({
        title: '成功',
        description: quantityToRemove <= 0
          ? '已移除池內顯示紀錄（該大獎已抽出，庫存維持鎖定不可重複調用）。'
          : '卡片已從卡池中移除並釋回庫存。',
      });
    } catch (error) {
      console.error("Error removing card from pool:", error);
      toast({ variant: "destructive", title: "錯誤", description: "移除卡片時發生錯誤。" });
    }
  };

  // 新增小賞 (Buy Back)
  const handleAddNewPointPrize = async () => {
    if (!cardPoolRef || !newPointPrize.quantity) {
      toast({ variant: 'destructive', title: '錯誤', description: '配置數量必須大於 0。' });
      return;
    }
    const prizeToAdd: PointPrize = { 
      prizeId: uuidv4(),
      points: 50,
      quantity: Number(newPointPrize.quantity),
      name: '隨機球員 普/特 卡',
      rarity: newPointPrize.rarity || 'common'
    };

    try {
      await runTransaction(firestore, async (transaction) => {
        const poolDoc = await transaction.get(cardPoolRef);
        if (!poolDoc.exists()) throw "Pool not found";

        const currentPool = poolDoc.data() as CardPool;
        const existingPrizes = (currentPool.pointPrizes || []).filter(p => p && typeof p === 'object' && 'points' in p);
        const newPointPrizes = [...existingPrizes, prizeToAdd];
        const newRemainingPacks = (currentPool.remainingPacks || 0) + prizeToAdd.quantity;
        
        transaction.update(cardPoolRef, cleanFirestoreData({
          pointPrizes: newPointPrizes,
          totalPacks: (currentPool.totalPacks || 0) + prizeToAdd.quantity,
          remainingPacks: newRemainingPacks
        }));
      });
      toast({ title: '成功', description: `已配置 ${prizeToAdd.quantity} 包隨機小賞。` });
      setNewPointPrize({ points: 300, quantity: 10, rarity: 'common' });
    } catch (error) {
      console.error("Error adding point prize:", error);
      toast({ variant: "destructive", title: "錯誤", description: "新增獎項失敗。" });
    }
  };

  // 移除小賞
  const handleRemovePointPrize = async (prizeId: string) => {
    if (!cardPoolRef || !cardPool?.pointPrizes) return;
    const prizeToRemove = (cardPool.pointPrizes || []).filter(p => p).find(p => p.prizeId === prizeId);
    if (!prizeToRemove) return;

    try {
      await runTransaction(firestore, async (transaction) => {
        const poolDoc = await transaction.get(cardPoolRef);
        if (!poolDoc.exists()) throw "Pool not found";

        const currentPool = poolDoc.data() as CardPool;
        const newPointPrizes = (currentPool.pointPrizes || []).filter(p => p && p.prizeId !== prizeId);
        const newRemainingPacks = Math.max(0, (currentPool.remainingPacks || 0) - prizeToRemove.quantity);

        transaction.update(cardPoolRef, cleanFirestoreData({
          pointPrizes: newPointPrizes,
          totalPacks: Math.max(0, (currentPool.totalPacks || 0) - prizeToRemove.quantity),
          remainingPacks: newRemainingPacks
        }));
      });
      toast({ title: '成功', description: '獎項已移除。' });
    } catch (error) {
      console.error("Error removing point prize:", error);
      toast({ variant: "destructive", title: "錯誤", description: "移除獎項失敗。" });
    }
  };

  const hybridValuation = useMemo(() => {
    const items: Array<{ tierCode: HybridTierCode; cost: number; qty: number }> = [];
    const tiersMap = poolDetails.cardTiers || {};
    const costsMap = poolDetails.cardCosts || {};
    const raritiesMap = poolDetails.cardRarities || {};

    (poolDetails.cards || []).forEach((c) => {
      if (!c?.cardId || (c.quantity || 0) <= 0) return;
      const cardDoc = (allCards || []).find((x) => x.id === c.cardId);
      const fallbackTier: HybridTierCode =
        raritiesMap[c.cardId] === 'legendary' ? 'A' : raritiesMap[c.cardId] === 'rare' ? 'B' : 'C';
      const tierCode = (tiersMap[c.cardId] as HybridTierCode) || fallbackTier;
      const cost = costsMap[c.cardId] ?? cardDoc?.sellPrice ?? 0;
      items.push({ tierCode, cost, qty: c.quantity || 0 });
    });

    (poolDetails.pointPrizes || []).forEach((p: any) => {
      if (!p || (p.quantity || 0) <= 0) return;
      const tierCode: HybridTierCode = p.tierCode || (p.rarity === 'rare' ? 'C' : 'D');
      const cost = p.unitCost !== undefined ? Number(p.unitCost) : Number(p.points || 0);
      items.push({ tierCode, cost, qty: p.quantity || 0 });
    });

    if (poolDetails.lastPrizeCardId) {
      const lpDoc = (allCards || []).find((x) => x.id === poolDetails.lastPrizeCardId);
      const lpCost = poolDetails.lastPrizeCost ?? lpDoc?.sellPrice ?? 0;
      items.push({ tierCode: 'LAST', cost: lpCost, qty: 1 });
    }

    return calculateHybridPoolValuation({
      pricePerPull: Number(poolDetails.price || HYBRID_68_PRESET.price_per_pull),
      totalPulls: Number(poolDetails.totalPacks || HYBRID_68_PRESET.total_pulls),
      items,
    });
  }, [poolDetails, allCards]);

  const handleApply68Preset = async () => {
    if (!cardPoolRef) return;
    const defaultPointPrizes = [
      {
        prizeId: 'hybrid_c_box',
        name: 'C 賞（銅盒・回血盲盒）',
        points: 1800,
        unitCost: 1800,
        quantity: 13,
        rarity: 'rare' as Rarity,
        tierCode: 'C' as const,
      },
      {
        prizeId: 'hybrid_d_box',
        name: 'D 賞（白盒・保底盲盒）',
        points: 450,
        unitCost: 450,
        quantity: 78,
        rarity: 'common' as Rarity,
        tierCode: 'D' as const,
      },
    ];

    const actualRemaining =
      (poolDetails.cards || []).reduce((s, c) => s + Math.max(0, c.quantity || 0), 0) +
      defaultPointPrizes.reduce((s, p) => s + Math.max(0, p.quantity || 0), 0);
    const patch: Partial<CardPool> = {
      price: HYBRID_68_PRESET.price_per_pull,
      price3Draws: HYBRID_68_PRESET.price_per_pull * 3,
      price10Draws: HYBRID_68_PRESET.price_per_pull * 10,
      totalPacks: HYBRID_68_PRESET.total_pulls,
      remainingPacks: actualRemaining,
      presetUsed: HYBRID_68_PRESET.preset_id,
      snipeAlertThreshold: HYBRID_68_PRESET.snipe_alert_threshold,
      lastPrizeCost: poolDetails.lastPrizeCost ?? 9000,
      pointPrizes: defaultPointPrizes as any,
    };

    setPoolDetails((prev) => ({ ...prev, ...patch }));
    await updateDoc(cardPoolRef, cleanFirestoreData(patch));
    toast({
      title: '✅ 已套用「68% 高毛利穩健版」範本',
      description: '單抽 NT$2,099、總抽數 100 抽，並自動建立 C 賞 13 抽與 D 賞 78 抽。請再加入 A/SP/B 賞與最後賞卡片。',
    });
  };

  const handleCardTierChange = async (cardId: string, tier: HybridTierCode) => {
    const nextTiers = { ...(poolDetails.cardTiers || {}), [cardId]: tier };
    const nextRarities = {
      ...(poolDetails.cardRarities || {}),
      [cardId]: (tier === 'A' || tier === 'SP' ? 'legendary' : tier === 'B' ? 'rare' : 'common') as Rarity,
    };
    const updates: any = { cardTiers: nextTiers, cardRarities: nextRarities };
    if (tier === 'SP') {
      const cardDoc = (allCards || []).find((x) => x.id === cardId);
      const unitCost = poolDetails.cardCosts?.[cardId] ?? cardDoc?.sellPrice ?? 14000;
      updates.spBuybackPoints = {
        ...(poolDetails.spBuybackPoints || {}),
        [cardId]: Math.round(unitCost * HYBRID_68_PRESET.sp_buyback_rate),
      };
    }
    setPoolDetails((prev) => ({ ...prev, ...updates }));
    if (cardPoolRef) await updateDoc(cardPoolRef, cleanFirestoreData(updates));
  };

  const handleCardCostChange = async (cardId: string, cost: number) => {
    const safeCost = Math.max(0, Math.round(cost || 0));
    const nextCosts = { ...(poolDetails.cardCosts || {}), [cardId]: safeCost };
    const updates: any = { cardCosts: nextCosts };
    if (poolDetails.cardTiers?.[cardId] === 'SP') {
      updates.spBuybackPoints = {
        ...(poolDetails.spBuybackPoints || {}),
        [cardId]: Math.round(safeCost * HYBRID_68_PRESET.sp_buyback_rate),
      };
    }
    setPoolDetails((prev) => ({ ...prev, ...updates }));
    if (cardPoolRef) await updateDoc(cardPoolRef, cleanFirestoreData(updates));
  };

  const handleCardCertChange = async (cardId: string, certNumber: string) => {
    const nextCerts = { ...(poolDetails.cardCertNumbers || {}), [cardId]: certNumber };
    setPoolDetails((prev) => ({ ...prev, cardCertNumbers: nextCerts }));
    if (cardPoolRef) await updateDoc(cardPoolRef, cleanFirestoreData({ cardCertNumbers: nextCerts }));
  };

  const handleUpdateStandardBoxPrize = async (tier: 'C' | 'D', quantity: number, unitCost: number) => {
    const prizeId = tier === 'C' ? 'hybrid_c_box' : 'hybrid_d_box';
    const current = [...(poolDetails.pointPrizes || [])] as any[];
    const idx = current.findIndex((p) => p.tierCode === tier || p.prizeId === prizeId);
    const updatedItem = {
      prizeId,
      name: tier === 'C' ? 'C 賞（銅盒・回血盲盒）' : 'D 賞（白盒・保底盲盒）',
      points: unitCost,
      unitCost,
      quantity,
      rarity: (tier === 'C' ? 'rare' : 'common') as Rarity,
      tierCode: tier,
    };
    if (idx >= 0) {
      current[idx] = updatedItem;
    } else {
      current.push(updatedItem);
    }
    const actualRemaining =
      (poolDetails.cards || []).reduce((s, c) => s + Math.max(0, c.quantity || 0), 0) +
      current.reduce((s, p) => s + Math.max(0, p?.quantity || 0), 0);
    setPoolDetails((prev) => ({ ...prev, pointPrizes: current, remainingPacks: actualRemaining }));
    if (cardPoolRef) await updateDoc(cardPoolRef, cleanFirestoreData({ pointPrizes: current, remainingPacks: actualRemaining }));
  };

  const handleLastPrizeCostChange = async (cost: number) => {
    setPoolDetails((prev) => ({ ...prev, lastPrizeCost: cost }));
    if (cardPoolRef) await updateDoc(cardPoolRef, cleanFirestoreData({ lastPrizeCost: cost }));
  };

  const handleRemoveLastPrize = async () => {
    setPoolDetails((prev) => ({ ...prev, lastPrizeCardId: undefined }));
    if (cardPoolRef) await updateDoc(cardPoolRef, { lastPrizeCardId: null });
  };

  const hybridHeroMetrics = useMemo(() => {
    const aTier = hybridValuation.tiers.find((t) => t.code === 'A');
    const spTier = hybridValuation.tiers.find((t) => t.code === 'SP');
    const bTier = hybridValuation.tiers.find((t) => t.code === 'B');
    const lastTier = hybridValuation.tiers.find((t) => t.code === 'LAST');
    const heroPullQty = (aTier?.qty || 0) + (spTier?.qty || 0) + (bTier?.qty || 0);
    const heroTotalCost =
      (aTier?.subtotal || 0) + (spTier?.subtotal || 0) + (bTier?.subtotal || 0) + (lastTier?.subtotal || 0);
    const cPrize = (poolDetails.pointPrizes || []).find((p: any) => p.tierCode === 'C' || p.prizeId === 'hybrid_c_box') as any;
    const dPrize = (poolDetails.pointPrizes || []).find((p: any) => p.tierCode === 'D' || p.prizeId === 'hybrid_d_box') as any;
    return {
      heroPullQty,
      heroTotalCost,
      cCost: cPrize?.unitCost ?? cPrize?.points ?? 1800,
      dCost: dPrize?.unitCost ?? dPrize?.points ?? 450,
    };
  }, [hybridValuation, poolDetails.pointPrizes]);

  const [balancerParams, setBalancerParams] = useState({
    targetPayoutPct: 68.0,
    cCost: 1800,
    dCost: 450,
  });

  const handleBalancerParamsChange = useCallback(
    (params: { targetPayoutPct: number; cCost: number; dCost: number }) => {
      setBalancerParams((prev) =>
        prev.targetPayoutPct === params.targetPayoutPct &&
        prev.cCost === params.cCost &&
        prev.dCost === params.dCost
          ? prev
          : params
      );
    },
    []
  );

  const recommendedPrices = useMemo(() => {
    if (!allCards || !poolDetails) return null;
    const totalPacks = Math.max(1, poolDetails.totalPacks || totalPrizesCount || 1);

    if (poolDetails.isHybridBlindSpMode) {
      const single = suggestNicePrice(
        {
          heroPullQty: hybridHeroMetrics.heroPullQty,
          heroTotalCost: hybridHeroMetrics.heroTotalCost,
          cCost: balancerParams.cCost || hybridHeroMetrics.cCost,
          dCost: balancerParams.dCost || hybridHeroMetrics.dCost,
          targetPayoutRatio: Math.max(0.1, Math.min(0.95, balancerParams.targetPayoutPct / 100)),
          defaultCRatio: 0.13,
        },
        totalPacks
      );
      const triple = Math.round(single * 0.95 * 3);
      return { single, triple };
    }

    const single = Math.round((totalPoolValue * 2.5) / totalPacks);
    const triple = Math.round(single * 0.95 * 3);
    return { single, triple };
  }, [allCards, poolDetails, totalPrizesCount, totalPoolValue, hybridHeroMetrics, balancerParams]);

  const handleAutoBalanceApply = async (params: {
    pricePerPull: number;
    totalPulls: number;
    cCost: number;
    dCost: number;
    qtyC: number;
    qtyD: number;
  }) => {
    if (!cardPoolRef) return;
    const otherPointPrizes = (poolDetails.pointPrizes || []).filter(
      (p: any) => p.tierCode !== 'C' && p.tierCode !== 'D' && p.prizeId !== 'hybrid_c_box' && p.prizeId !== 'hybrid_d_box'
    );
    const balancedPointPrizes = [
      ...otherPointPrizes,
      {
        prizeId: 'hybrid_c_box',
        name: 'C 賞（銅盒・回血盲盒）',
        points: params.cCost,
        unitCost: params.cCost,
        quantity: params.qtyC,
        rarity: 'rare' as Rarity,
        tierCode: 'C' as const,
      },
      {
        prizeId: 'hybrid_d_box',
        name: 'D 賞（白盒・保底盲盒）',
        points: params.dCost,
        unitCost: params.dCost,
        quantity: params.qtyD,
        rarity: 'common' as Rarity,
        tierCode: 'D' as const,
      },
    ];

    const actualRemaining =
      (poolDetails.cards || []).reduce((s, c) => s + Math.max(0, c.quantity || 0), 0) +
      balancedPointPrizes.reduce((s, p: any) => s + Math.max(0, p?.quantity || 0), 0);
    const patch: Partial<CardPool> = {
      price: params.pricePerPull,
      price3Draws: params.pricePerPull * 3,
      price10Draws: params.pricePerPull * 10,
      totalPacks: params.totalPulls,
      remainingPacks: actualRemaining,
      pointPrizes: balancedPointPrizes as any,
    };
    setPoolDetails((prev) => ({ ...prev, ...patch }));
    await updateDoc(cardPoolRef, cleanFirestoreData(patch));
    toast({
      title: '⚡ 已自動配平 C／D 賞數量',
      description: `單抽 NT$${params.pricePerPull.toLocaleString()} × ${params.totalPulls} 抽｜已寫入 C 賞 ${params.qtyC} 抽、D 賞 ${params.qtyD} 抽`,
    });
  };

  if (isLoadingPool || !cardPool) {
    return (
      <div className="container p-8 space-y-6">
        <div className="flex justify-between items-center">
          <Skeleton className="h-10 w-48 rounded-xl" />
          <Skeleton className="h-10 w-32 rounded-xl" />
        </div>
        <Skeleton className="w-full h-40 rounded-3xl" />
        <Skeleton className="w-full h-96 rounded-3xl" />
      </div>
    );
  }

  const remainingPercent = poolDetails.totalPacks && poolDetails.totalPacks > 0
    ? Math.round(((poolDetails.remainingPacks || 0) / poolDetails.totalPacks) * 100)
    : 0;

  return (
    <div className="container mx-auto p-4 sm:p-6 md:p-8 space-y-6 text-slate-900 pb-24">
      {/* 頂部導航與即時狀態列 */}
      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button 
            variant="ghost" 
            onClick={() => router.push(`/admin/card-pools/c/${cardPool.categoryId}`)} 
            className="text-slate-700 font-bold hover:bg-slate-100 rounded-xl px-3 h-9"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            返回卡池列表
            {cardPool.categoryId && (
              <Badge variant="outline" className="ml-2 font-code text-[11px] border-slate-300 bg-white">
                {cardPool.categoryId}
              </Badge>
            )}
          </Button>

          <div className="flex items-center gap-2.5">
            {lastSavedTime && (
              <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                上次同步：{lastSavedTime}
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`/draw/open?poolId=${cardPoolId}`, '_blank')}
              className="h-9 px-3 rounded-xl border-slate-200 font-bold text-xs bg-white text-slate-700 hover:bg-slate-50 shadow-sm flex items-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5 text-primary" />
              前台實機開箱預覽
            </Button>

            <Button
              size="sm"
              onClick={handleSaveAllChanges}
              disabled={isSaving}
              className="h-9 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md flex items-center gap-1.5"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-amber-400" />}
              {isSaving ? '同步中...' : '儲存所有變更'}
            </Button>
          </div>
        </div>

        {/* 頂部卡池狀態即時儀表板 */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white rounded-3xl p-5 sm:p-6 shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <Badge className={cn(
                  "font-black text-xs px-2.5 py-0.5 uppercase tracking-wider",
                  poolDetails.isActive !== false ? "bg-emerald-500 text-slate-950" : "bg-rose-500/80 text-white"
                )}>
                  {poolDetails.isActive !== false ? '● 販售中 (Active)' : '○ 已下架 (Draft)'}
                </Badge>
                
                {poolDetails.isFeatured && (
                  <Badge className="bg-amber-400 text-slate-950 font-black text-xs px-2.5 py-0.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 fill-slate-950" /> 精選專區
                  </Badge>
                )}

                {poolDetails.isHybridBlindSpMode ? (
                  <Badge className="bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] font-black text-xs px-2.5 py-0.5 flex items-center gap-1">
                    <Package className="w-3 h-3" /> GodPack 一番賞
                  </Badge>
                ) : poolDetails.isBlindBoxMode ? (
                  <Badge className="bg-slate-800 text-[#FDE68A] border border-amber-300/50 font-black text-xs px-2.5 py-0.5 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-[#FDE68A]" /> Blez 盲盒模式（保密）
                  </Badge>
                ) : poolDetails.enablePickNumber ? (
                  <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 flex items-center gap-1">
                    <Flame className="w-3 h-3 fill-slate-950" /> 一番賞挑號模式
                  </Badge>
                ) : poolDetails.isEventPool ? (
                  <Badge className="bg-purple-600 text-white font-black text-xs px-2.5 py-0.5 flex items-center gap-1">
                    <Ticket className="w-3 h-3" /> 活動專屬卡池
                  </Badge>
                ) : (
                  <Badge className="bg-white/15 text-white border border-white/25 font-black text-xs px-2.5 py-0.5 flex items-center gap-1">
                    <Layers className="w-3 h-3" /> 一般抽卡池（公開機率）
                  </Badge>
                )}
              </div>

              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-white flex items-center gap-2">
                {poolDetails.name || '未命名卡池'}
              </h1>

              <p className="text-xs sm:text-sm text-slate-300 line-clamp-1">
                {poolDetails.description || '暫無活動描述'}
              </p>
            </div>

            {/* 即時指標區塊 */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 lg:gap-4 shrink-0">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                <p className="text-[10px] font-black uppercase text-amber-400 tracking-wider">庫存進度</p>
                <p className="text-lg font-black font-code text-white mt-0.5">
                  {poolDetails.remainingPacks ?? 0} <span className="text-xs text-slate-400 font-normal">/ {poolDetails.totalPacks ?? 0} 包</span>
                </p>
                <div className="mt-1.5 w-full bg-white/20 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-amber-400 h-full rounded-full transition-all duration-500" 
                    style={{ width: `${Math.min(100, remainingPercent)}%` }}
                  />
                </div>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                <p className="text-[10px] font-black uppercase text-cyan-400 tracking-wider">單抽定價</p>
                <p className="text-lg font-black font-code text-white mt-0.5 flex items-center gap-1">
                  {poolDetails.price?.toLocaleString() || 0}
                  <span className="text-xs font-bold text-slate-300">
                    {poolDetails.currency === 'p-point' ? 'P 點' : '💎'}
                  </span>
                </p>
                <p className="text-[10px] text-slate-300 mt-0.5 font-medium">
                  3抽: {poolDetails.price3Draws?.toLocaleString() || '-'} | 10抽: {poolDetails.price10Draws?.toLocaleString() || '-'}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                <p className="text-[10px] font-black uppercase text-emerald-400 tracking-wider">卡池總價值</p>
                <p className="text-lg font-black font-code text-white mt-0.5">
                  {totalPoolValue.toLocaleString()} <span className="text-xs font-bold text-slate-400">💎</span>
                </p>
                <p className="text-[10px] text-slate-300 mt-0.5 font-medium truncate">
                  預估總營收: {estimatedGrossRevenue.toLocaleString()}
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10">
                <p className="text-[10px] font-black uppercase text-rose-400 tracking-wider">最後賞配置</p>
                <div className="flex items-center gap-2 mt-1">
                  {lastPrizeCard ? (
                    <Badge className="bg-amber-400 text-slate-950 font-black text-[11px] truncate max-w-[110px]">
                      ✓ {lastPrizeCard.name}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-rose-300 border-rose-400/40 text-[11px] font-bold">
                      未設定最後賞
                    </Badge>
                  )}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">
                  大獎卡數：{cardsInPool.length} 張
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 核心分頁切換 Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as any)} className="space-y-6">
        <TabsList className="bg-slate-200/70 p-1.5 rounded-2xl h-14 w-full sm:w-auto grid grid-cols-2 max-w-md border border-slate-200 shadow-inner">
          <TabsTrigger value="basic" className="rounded-xl font-black text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <span>基本與銷售定價</span>
          </TabsTrigger>
                  <TabsTrigger value="cards" className="rounded-xl font-black text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md flex items-center gap-2">
                    <Layers className="w-4 h-4 text-amber-500" />
                    <span>{poolDetails.isHybridBlindSpMode ? `五色卡包配置 (${cardsInPool.length})` : `卡片與庫存配置 (${cardsInPool.length})`}</span>
                  </TabsTrigger>
        </TabsList>

        {/* ===================== TAB 1: 基本與定價銷售 ===================== */}
        <TabsContent value="basic" className="space-y-8 animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* 左側兩欄：主要表單 */}
            <div className="lg:col-span-2 space-y-8">
              {/* 基本資訊 Card */}
              <UICard className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-6">
                  <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2.5">
                    <Settings className="w-5 h-5 text-primary" />
                    卡池基本資訊設定
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium">
                    設定負責業務、前台展示名稱與活動詳細介紹文案。
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="pool-agent" className="text-xs font-black uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                        <Crown className="w-3.5 h-3.5 text-amber-500" /> 負責業務 (Agent)
                      </Label>
                      <Select 
                        value={poolDetails.agentId || ''} 
                        onValueChange={(val) => { 
                          setPoolDetails({...poolDetails, agentId: val}); 
                          handleUpdatePoolDetails('agentId', val); 
                        }}
                      >
                        <SelectTrigger className="h-11 border-slate-200 font-bold bg-white text-slate-900 rounded-xl">
                          <SelectValue placeholder="請選擇負責業務" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {agents?.map(agent => (
                            <SelectItem key={agent.id} value={agent.id} className="font-bold">
                              {agent.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="pool-name" className="text-xs font-black uppercase text-slate-600 tracking-wider">
                        卡池正式名稱
                      </Label>
                      <Input 
                        id="pool-name" 
                        value={poolDetails.name || ''} 
                        onChange={e => setPoolDetails({...poolDetails, name: e.target.value})} 
                        onBlur={e => handleUpdatePoolDetails('name', e.target.value)} 
                        placeholder="例如：2026 中華職棒經典簽名卡包 #01"
                        className="h-11 border-slate-200 font-black text-slate-900 bg-white rounded-xl text-sm" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="pool-description" className="text-xs font-black uppercase text-slate-600 tracking-wider">
                      活動規則與卡池描述
                    </Label>
                    <Textarea 
                      id="pool-description" 
                      rows={3}
                      value={poolDetails.description || ''} 
                      onChange={e => setPoolDetails({...poolDetails, description: e.target.value})} 
                      onBlur={e => handleUpdatePoolDetails('description', e.target.value)} 
                      placeholder="請填寫卡包大獎說明、玩法規則或特色..."
                      className="border-slate-200 font-medium bg-white rounded-xl text-xs" 
                    />
                  </div>
                </CardContent>
              </UICard>

              {/* 定價與結算策略 Card */}
              <UICard className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-6">
                  <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2.5">
                    <Gem className="w-5 h-5 text-primary" />
                    定價與結算貨幣策略
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium">
                    設定抽卡計價單位、單抽與多連抽折扣，並提供智能建議售價試算。
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* 貨幣選擇 */}
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                    <Label className="text-xs font-black uppercase text-slate-700 tracking-wider">
                      支付幣別設定
                    </Label>
                    <RadioGroup 
                      value={poolDetails.currency || 'diamond'} 
                      onValueChange={(val) => {
                        setPoolDetails({ ...poolDetails, currency: val as 'diamond' | 'p-point' });
                        handleUpdatePoolDetails('currency', val);
                      }}
                      className="flex gap-8 pt-1"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="diamond" id="cur-dia" />
                        <Label htmlFor="cur-dia" className="cursor-pointer font-bold text-slate-800 text-sm flex items-center gap-1.5">
                          💎 鑽石 (Diamonds)
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="p-point" id="cur-p" />
                        <Label htmlFor="cur-p" className="cursor-pointer text-amber-700 font-bold text-sm flex items-center gap-1">
                          <PPlusIcon className="h-4 w-4"/> 紅利 P 點專區
                        </Label>
                      </div>
                    </RadioGroup>
                  </div>

                  {/* 明池盲開＋隱藏 SP 專屬參數（總抽數與尾盤狙擊警報） */}
                  {poolDetails.isHybridBlindSpMode && (
                    <div className="p-4 rounded-2xl bg-[#0a0f1c] text-white border border-amber-300/40 space-y-3">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-xs font-black text-[#FDE68A] flex items-center gap-1.5">
                          <Package className="w-4 h-4" />
                          GodPack 一番賞專屬設定
                        </span>
                        <span className="text-[11px] text-slate-400">
                          調整單抽價格或總抽數時，五色卡包建議單價與毛利將即時連動重算
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px] text-slate-300 font-bold">總抽數（預設 100 抽）</Label>
                          <Input
                            type="number"
                            value={poolDetails.totalPacks ?? 100}
                            onChange={(e) => setPoolDetails({ ...poolDetails, totalPacks: Math.max(1, Number(e.target.value)) })}
                            onBlur={(e) => {
                              const val = Math.max(1, Number(e.target.value || 100));
                              handleUpdatePoolDetails('totalPacks', val);
                            }}
                            className="h-10 bg-black/50 border-white/15 text-white font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-slate-300 font-bold">尾盤狙擊警報門檻（抽）</Label>
                          <Input
                            type="number"
                            value={poolDetails.snipeAlertThreshold ?? 15}
                            onChange={(e) => setPoolDetails({ ...poolDetails, snipeAlertThreshold: Math.max(1, Number(e.target.value)) })}
                            onBlur={(e) => handleUpdatePoolDetails('snipeAlertThreshold', Math.max(1, Number(e.target.value || 15)))}
                            className="h-10 bg-black/50 border-white/15 text-white font-mono font-bold"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px] text-slate-300 font-bold">LINE / Discord 推播 Webhook</Label>
                          <Input
                            type="url"
                            placeholder="https://..."
                            value={poolDetails.snipeWebhookUrl || ''}
                            onChange={(e) => setPoolDetails({ ...poolDetails, snipeWebhookUrl: e.target.value })}
                            onBlur={(e) => handleUpdatePoolDetails('snipeWebhookUrl', e.target.value)}
                            className="h-10 bg-black/50 border-white/15 text-white text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 價格輸入 */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="pool-price" className="text-xs font-black text-slate-700">
                        1 抽價格 ({poolDetails.currency === 'p-point' ? 'P 點' : '鑽石'})
                      </Label>
                      <Input 
                        id="pool-price" 
                        type="number" 
                        value={poolDetails.price || 0} 
                        onChange={e => setPoolDetails({...poolDetails, price: Number(e.target.value)})} 
                        onBlur={e => handleUpdatePoolDetails('price', Number(e.target.value))} 
                        className="h-11 border-slate-200 font-code font-black text-base text-slate-900 bg-white rounded-xl" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="pool-price-3" className="text-xs font-black text-slate-700">
                        三連抽優惠價
                      </Label>
                      <Input 
                        id="pool-price-3" 
                        type="number" 
                        value={poolDetails.price3Draws || ''} 
                        placeholder="例如: 420" 
                        onChange={e => setPoolDetails({...poolDetails, price3Draws: Number(e.target.value)})} 
                        onBlur={e => handleUpdatePoolDetails('price3Draws', Number(e.target.value))} 
                        className="h-11 border-slate-200 font-code font-black text-base text-slate-900 bg-white rounded-xl" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="pool-price-10" className="text-xs font-black text-slate-700">
                        十連抽優惠價
                      </Label>
                      <Input 
                        id="pool-price-10" 
                        type="number" 
                        value={poolDetails.price10Draws || ''} 
                        placeholder="例如: 1350" 
                        onChange={e => setPoolDetails({...poolDetails, price10Draws: Number(e.target.value)})} 
                        onBlur={e => handleUpdatePoolDetails('price10Draws', Number(e.target.value))} 
                        className="h-11 border-slate-200 font-code font-black text-base text-slate-900 bg-white rounded-xl" 
                      />
                    </div>
                  </div>

                  {/* 智能建議售價卡片 */}
                  {recommendedPrices && (
                    <div className="p-5 rounded-2xl border border-cyan-200 bg-cyan-50/50 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-cyan-800 font-black text-xs uppercase tracking-wider">
                          <Calculator className="w-4 h-4 text-cyan-600" />
                          <span>
                            {poolDetails.isHybridBlindSpMode
                              ? `系統智能建議售價 (連動配平引擎・目標還元率 ${balancerParams.targetPayoutPct}%)`
                              : '系統智能建議售價 (依據全池卡片價值試算)'}
                          </span>
                        </div>
                        <span className="text-[10px] text-cyan-700 font-bold">
                          全池參考價值：{totalPoolValue.toLocaleString()} 💎
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-cyan-100 shadow-sm">
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold">建議 1 抽定價</p>
                            <p className="font-code font-black text-xl text-slate-900 mt-0.5">
                              {recommendedPrices.single.toLocaleString()} 
                              <span className="text-xs font-normal text-slate-400 ml-1">{poolDetails.currency === 'p-point' ? 'P' : '💎'}</span>
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-3 rounded-lg text-xs font-black bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100"
                            onClick={() => {
                              setPoolDetails(prev => ({ ...prev, price: recommendedPrices.single }));
                              handleUpdatePoolDetails('price', recommendedPrices.single);
                            }}
                          >
                            套用 1 抽
                          </Button>
                        </div>

                        <div className="flex items-center justify-between p-3.5 bg-white rounded-xl border border-cyan-100 shadow-sm">
                          <div>
                            <p className="text-[10px] text-slate-500 font-bold">建議 3 抽 (95折)</p>
                            <p className="font-code font-black text-xl text-slate-900 mt-0.5">
                              {recommendedPrices.triple.toLocaleString()} 
                              <span className="text-xs font-normal text-slate-400 ml-1">{poolDetails.currency === 'p-point' ? 'P' : '💎'}</span>
                            </p>
                          </div>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-8 px-3 rounded-lg text-xs font-black bg-cyan-50 text-cyan-800 border-cyan-200 hover:bg-cyan-100"
                            onClick={() => {
                              setPoolDetails(prev => ({ ...prev, price3Draws: recommendedPrices.triple }));
                              handleUpdatePoolDetails('price3Draws', recommendedPrices.triple);
                            }}
                          >
                            套用 3 抽
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 限時 P 點回饋倍率 */}
                  <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200 space-y-3">
                    <Label className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                      限時紅利 P 點回饋倍率
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500 font-bold">回饋倍率 (例如: 1.5 倍)</Label>
                        <Input 
                          id="multiplier" 
                          type="number" 
                          step="0.1" 
                          value={poolDetails.pointMultiplier || 1} 
                          onChange={e => setPoolDetails({...poolDetails, pointMultiplier: Number(e.target.value)})} 
                          onBlur={e => handleUpdatePoolDetails('pointMultiplier', Number(e.target.value))} 
                          className="h-10 border-slate-200 font-code font-black text-base bg-white rounded-xl" 
                        />
                      </div>

                      <div className="space-y-1">
                        <Label className="text-[11px] text-slate-500 font-bold">倍率活動截止時間</Label>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-10 justify-start text-left font-bold border-slate-200 bg-white rounded-xl text-xs">
                              {toSafeDate(poolDetails.pointMultiplierExpiresAt) 
                                ? format(toSafeDate(poolDetails.pointMultiplierExpiresAt)!, "PPP HH:mm") 
                                : "選擇活動結束時間"}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="end">
                            <Calendar 
                              mode="single" 
                              selected={toSafeDate(poolDetails.pointMultiplierExpiresAt) || undefined} 
                              onSelect={(date) => {
                                if (!date) return;
                                date.setHours(23, 59);
                                handleUpdatePoolDetails('pointMultiplierExpiresAt', Timestamp.fromDate(date));
                                setPoolDetails({...poolDetails, pointMultiplierExpiresAt: Timestamp.fromDate(date)});
                              }} 
                              initialFocus 
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </UICard>

              {/* 銷售時程與限購條件 Card */}
              <UICard className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-6">
                  <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2.5">
                    <Clock className="w-5 h-5 text-emerald-600" />
                    銷售時程與參與門檻
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-500" /> 預約開賣時間
                      </Label>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "flex-grow justify-start text-left font-bold border-slate-200 h-11 text-slate-900 bg-white rounded-xl text-xs",
                                !poolDetails.startsAt && "text-slate-400"
                              )}
                            >
                              {toSafeDate(poolDetails.startsAt) ? format(toSafeDate(poolDetails.startsAt)!, "PPP") : <span>選擇開賣日期</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={toSafeDate(poolDetails.startsAt) || undefined}
                              onSelect={handleStartDateSelect}
                              captionLayout="dropdown-buttons"
                              fromYear={new Date().getFullYear()}
                              toYear={new Date().getFullYear() + 5}
                            />
                          </PopoverContent>
                        </Popover>
                        <Input 
                          type="time" 
                          value={startTimeValue} 
                          onChange={handleStartTimeChange} 
                          className="w-[100px] shrink-0 h-11 border-slate-200 font-code font-black text-slate-900 bg-white rounded-xl text-xs" 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-rose-500" /> 結束銷售時間
                      </Label>
                      <div className="flex gap-2">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              className={cn(
                                "flex-grow justify-start text-left font-bold border-slate-200 h-11 text-slate-900 bg-white rounded-xl text-xs",
                                !poolDetails.expiresAt && "text-slate-400"
                              )}
                            >
                              {toSafeDate(poolDetails.expiresAt) ? format(toSafeDate(poolDetails.expiresAt)!, "PPP") : <span>選擇結束日期</span>}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0">
                            <Calendar
                              mode="single"
                              selected={toSafeDate(poolDetails.expiresAt) || undefined}
                              onSelect={handleDateSelect}
                              captionLayout="dropdown-buttons"
                              fromYear={new Date().getFullYear()}
                              toYear={new Date().getFullYear() + 5}
                            />
                          </PopoverContent>
                        </Popover>
                        <Input 
                          type="time" 
                          value={timeValue} 
                          onChange={handleTimeChange} 
                          className="w-[100px] shrink-0 h-11 border-slate-200 font-code font-black text-slate-900 bg-white rounded-xl text-xs" 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="daily-limit" className="text-xs font-black text-slate-700">
                        每日抽數限制 (0 表示不限)
                      </Label>
                      <Input 
                        id="daily-limit" 
                        type="number" 
                        value={poolDetails.dailyLimit ?? 0} 
                        onChange={e => setPoolDetails({...poolDetails, dailyLimit: Number(e.target.value)})} 
                        onBlur={e => handleUpdatePoolDetails('dailyLimit', Number(e.target.value))} 
                        className="h-11 border-slate-200 font-code font-black text-base bg-white rounded-xl" 
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="min-level" className="text-xs font-black text-slate-700">
                        最低參與等級要求
                      </Label>
                      <Select 
                        value={poolDetails.minLevel || '新手收藏家'} 
                        onValueChange={(val) => { 
                          setPoolDetails({...poolDetails, minLevel: val}); 
                          handleUpdatePoolDetails('minLevel', val); 
                        }}
                      >
                        <SelectTrigger className="h-11 border-slate-200 font-bold bg-white text-slate-900 rounded-xl">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {userLevels.map(l => (
                            <SelectItem key={l.level} value={l.level} className="font-bold">
                              {l.level}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </UICard>
            </div>

            {/* 右側一欄：核心開關與即時機率小部件 */}
            <div className="space-y-6">
              {/* 核心運作開關 Card */}
              <UICard className="border-slate-200 bg-white shadow-sm rounded-3xl p-6 space-y-4">
                <CardTitle className="text-sm font-black uppercase tracking-wider text-slate-900 pb-2 border-b">
                  卡池運作狀態開關
                </CardTitle>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-black text-slate-900">卡池啟用狀態</Label>
                    <p className="text-[10px] text-slate-500">關閉後前台將不會顯示此卡池</p>
                  </div>
                  <Switch
                    checked={poolDetails.isActive !== false}
                    onCheckedChange={(checked) => {
                      if (checked && poolDetails.isHybridBlindSpMode) {
                        if (!hybridValuation.totalPullsMatch) {
                          toast({
                            variant: 'destructive',
                            title: '抽數總和不符，無法上架',
                            description: `目前可抽獎項合計 ${hybridValuation.pullItemsTotalQty} 抽，需等於總抽數 ${poolDetails.totalPacks || 0} 抽才能發布上架。`,
                          });
                          return;
                        }
                        if (hybridValuation.requiresForceConfirm && !forceConfirmRedHealth) {
                          toast({
                            variant: 'destructive',
                            title: '紅燈風險警示',
                            description: '請先於「即時財務估值與偏差估算器」勾選『強制確認』後再上架。',
                          });
                          return;
                        }
                      }
                      setPoolDetails({ ...poolDetails, isActive: checked });
                      handleUpdatePoolDetails('isActive', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/60 border border-amber-100">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-black text-amber-900 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-600" /> 標記為精選 (Spotlight)
                    </Label>
                    <p className="text-[10px] text-amber-700">置頂於首頁精選輪播</p>
                  </div>
                  <Switch
                    checked={poolDetails.isFeatured || false}
                    onCheckedChange={(checked) => {
                      setPoolDetails({ ...poolDetails, isFeatured: checked });
                      handleUpdatePoolDetails('isFeatured', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-primary" /> 120秒防搶開獎保護
                    </Label>
                    <p className="text-[10px] text-slate-500">抽出傳奇卡時鎖定卡池防止衝突</p>
                  </div>
                  <Switch
                    checked={poolDetails.hasProtection !== false}
                    onCheckedChange={(checked) => {
                      setPoolDetails({ ...poolDetails, hasProtection: checked });
                      handleUpdatePoolDetails('hasProtection', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-50/70 border border-emerald-100">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-black text-emerald-900 flex items-center gap-1.5">
                      <Ticket className="w-3.5 h-3.5 text-emerald-600" /> 支援活動免費抽卡券
                    </Label>
                    <p className="text-[10px] text-emerald-700">允許玩家使用免費抵用券抽取</p>
                  </div>
                  <Switch
                    checked={poolDetails.allowFreeDraw !== false}
                    onCheckedChange={(checked) => {
                      setPoolDetails({ ...poolDetails, allowFreeDraw: checked });
                      handleUpdatePoolDetails('allowFreeDraw', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/60 border border-rose-100">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-black text-rose-900 flex items-center gap-1.5">
                      <Ban className="w-3.5 h-3.5 text-rose-600" /> 限制級內容 (18+)
                    </Label>
                    <p className="text-[10px] text-rose-700">僅限年滿 18 歲會員購買</p>
                  </div>
                  <Switch
                    checked={poolDetails.isAdult || false}
                    onCheckedChange={(checked) => {
                      setPoolDetails({ ...poolDetails, isAdult: checked });
                      handleUpdatePoolDetails('isAdult', checked);
                    }}
                  />
                </div>
              </UICard>
            </div>
          </div>
        </TabsContent>

        {/* ===================== TAB 2: 卡片與庫存配置 ===================== */}
        <TabsContent value="cards" className="space-y-8 animate-in fade-in-50 duration-200">
          {poolDetails.isHybridBlindSpMode ? (
            <>
              <HybridPoolValuationPanel
                valuation={hybridValuation}
                pricePerPull={Number(poolDetails.price || HYBRID_68_PRESET.price_per_pull)}
                totalPulls={Number(poolDetails.totalPacks || HYBRID_68_PRESET.total_pulls)}
                heroPullQty={hybridHeroMetrics.heroPullQty}
                heroTotalCost={hybridHeroMetrics.heroTotalCost}
                cCost={hybridHeroMetrics.cCost}
                dCost={hybridHeroMetrics.dCost}
                forceConfirmRedHealth={forceConfirmRedHealth}
                onForceConfirmChange={setForceConfirmRedHealth}
                onApply68Preset={handleApply68Preset}
                onPricePerPullChange={(nextPrice) => setPoolDetails((prev) => ({ ...prev, price: nextPrice }))}
                onBalancerParamsChange={handleBalancerParamsChange}
                onAutoBalanceApply={handleAutoBalanceApply}
              />
              <HybridBoxWorkspace
                valuation={hybridValuation}
                cardsInPool={cardsInPool.map((c) => {
                  const mappedRarity = poolDetails.cardRarities?.[c.id];
                  const tierCode: HybridTierCode =
                    (poolDetails.cardTiers?.[c.id] as HybridTierCode) ||
                    (mappedRarity === 'legendary' ? 'A' : mappedRarity === 'rare' ? 'B' : 'C');
                  const unitCost = poolDetails.cardCosts?.[c.id] ?? c.sellPrice ?? 0;
                  return {
                    id: c.id,
                    name: c.name,
                    imageUrl: c.imageUrl,
                    sellPrice: c.sellPrice,
                    quantity: c.quantity,
                    tierCode,
                    unitCost,
                    certNumber: poolDetails.cardCertNumbers?.[c.id] || '',
                    buybackPoints: poolDetails.spBuybackPoints?.[c.id] ?? Math.round(unitCost * 0.8),
                  };
                })}
                pointPrizes={(poolDetails.pointPrizes || []) as any}
                lastPrizeCard={lastPrizeCard}
                lastPrizeCost={poolDetails.lastPrizeCost ?? lastPrizeCard?.sellPrice ?? 9000}
                onOpenAddCardToBox={(tier) => {
                  setTargetBoxTier(tier);
                  handleOpenAddCardDialog('standard');
                }}
                onOpenSelectLastPrize={() => handleOpenAddCardDialog('last')}
                onRemoveLastPrize={handleRemoveLastPrize}
                onLastPrizeCostChange={handleLastPrizeCostChange}
                onCardTierChange={handleCardTierChange}
                onCardCostChange={handleCardCostChange}
                onCardCertChange={handleCardCertChange}
                onRemoveCard={handleRemoveCardFromPool}
                onUpdateStandardBoxPrize={handleUpdateStandardBoxPrize}
                onQuickAddRandomPlayerToD={async (qty: number) => {
                  const addQty = Math.max(1, Math.round(qty || 1));
                  const current = [...(poolDetails.pointPrizes || [])] as any[];
                  const idx = current.findIndex((p) => p.tierCode === 'D' || p.prizeId === 'hybrid_d_box');
                  if (idx >= 0) {
                    const prevItem = current[idx];
                    current[idx] = {
                      ...prevItem,
                      name: '隨機球員 普/特 卡',
                      points: 50,
                      unitCost: 50,
                      quantity: Number(prevItem.quantity || 0) + addQty,
                      rarity: 'common' as Rarity,
                      tierCode: 'D',
                    };
                  } else {
                    current.push({
                      prizeId: 'hybrid_d_box',
                      name: '隨機球員 普/特 卡',
                      points: 50,
                      unitCost: 50,
                      quantity: addQty,
                      rarity: 'common' as Rarity,
                      tierCode: 'D',
                    });
                  }
                  const actualRemaining =
                    (poolDetails.cards || []).reduce((s, c) => s + Math.max(0, c.quantity || 0), 0) +
                    current.reduce((s, p) => s + Math.max(0, p?.quantity || 0), 0);
                  setPoolDetails((prev) => ({ ...prev, pointPrizes: current, remainingPacks: actualRemaining }));
                  if (cardPoolRef) {
                    await updateDoc(cardPoolRef, cleanFirestoreData({ pointPrizes: current, remainingPacks: actualRemaining }));
                  }
                  toast({
                    title: `已加入 ${addQty} 張「隨機球員 普/特 卡 (50💎)」`,
                    description: '已寫入 D 賞（白盒）並同步更新即時估值。',
                  });
                }}
              />
            </>
          ) : (
            <>
          {/* 大獎卡片清單與稀有度管理 */}
          <UICard className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-xl font-black text-slate-900 flex items-center gap-2.5">
                    <Palette className="w-5 h-5 text-primary" />
                    卡片獎項清單與稀有度設定 ({cardsInPool.length} 款)
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500 font-medium mt-1">
                    為卡池中的各張卡片指定稀有度等級（傳奇/稀有/普通）。玩家抽出後系統將自動扣除剩餘包數。
                  </CardDescription>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      if (!cardPoolRef || !firestore) return;
                      const prizeToAdd: PointPrize = {
                        prizeId: uuidv4(),
                        points: 50,
                        quantity: 1,
                        name: '隨機球員 普/特 卡',
                        rarity: 'common',
                      };
                      await runTransaction(firestore, async (transaction) => {
                        const poolDoc = await transaction.get(cardPoolRef);
                        if (!poolDoc.exists()) throw new Error('找不到卡池');
                        const currentPool = poolDoc.data() as CardPool;
                        const existing = [...(currentPool.pointPrizes || [])];
                        existing.push(prizeToAdd);
                        transaction.update(
                          cardPoolRef,
                          cleanFirestoreData({
                            pointPrizes: existing,
                            totalPacks: (currentPool.totalPacks || 0) + 1,
                            remainingPacks: (currentPool.remainingPacks || 0) + 1,
                          })
                        );
                      });
                      toast({ title: '已加入「隨機球員 普/特 卡 (50💎)」', description: '已新增 1 包至小賞清單。' });
                    }}
                    className="h-10 px-3.5 rounded-xl border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-black text-xs shadow-sm flex items-center gap-1.5"
                  >
                    <PlusCircle className="h-4 w-4 text-amber-600" />
                    加入隨機球員 普/特 卡 (50💎)
                  </Button>
                  <Button 
                    onClick={() => handleOpenAddCardDialog('standard')} 
                    size="sm" 
                    className="h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs shadow-md flex items-center gap-1.5"
                  >
                    <PlusCircle className="h-4 w-4 text-amber-400" />
                    從庫存加入卡片
                  </Button>
                </div>
              </div>

              {/* 篩選與批次工具列 */}
              <div className="pt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/60 mt-4">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[240px]">
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <Input 
                      placeholder="搜尋池內卡名或分類..." 
                      value={poolCardSearch}
                      onChange={(e) => setPoolCardSearch(e.target.value)}
                      className="pl-9 h-9 text-xs bg-white border-slate-200 rounded-xl"
                    />
                  </div>

                  <Select value={poolRarityFilter} onValueChange={setPoolRarityFilter}>
                    <SelectTrigger className="w-[130px] h-9 text-xs font-bold rounded-xl bg-white border-slate-200">
                      <SelectValue placeholder="所有稀有度" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      <SelectItem value="all" className="font-bold text-xs">全部稀有度</SelectItem>
                      <SelectItem value="legendary" className="font-bold text-xs text-amber-600">🌟 傳奇 (Legendary)</SelectItem>
                      <SelectItem value="rare" className="font-bold text-xs text-cyan-600">💎 稀有 (Rare)</SelectItem>
                      <SelectItem value="common" className="font-bold text-xs text-slate-600">📦 普通 (Common)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* 批次修改稀有度工具 */}
                {selectedPoolCards.length > 0 && (
                  <div className="flex items-center gap-2 bg-amber-50 px-3 py-1.5 rounded-xl border border-amber-200 animate-in fade-in-50">
                    <span className="text-xs font-black text-amber-900">
                      已勾選 {selectedPoolCards.length} 張：
                    </span>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleBatchSetRarity('legendary')}
                      className="h-7 px-2.5 text-[10px] font-black bg-amber-500 hover:bg-amber-600 text-slate-950 border-none rounded-lg"
                    >
                      設為傳奇
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleBatchSetRarity('rare')}
                      className="h-7 px-2.5 text-[10px] font-black bg-cyan-600 hover:bg-cyan-700 text-white border-none rounded-lg"
                    >
                      設為稀有
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => handleBatchSetRarity('common')}
                      className="h-7 px-2.5 text-[10px] font-black bg-slate-200 hover:bg-slate-300 text-slate-800 border-none rounded-lg"
                    >
                      設為普通
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost" 
                      onClick={() => setSelectedPoolCards([])}
                      className="h-7 px-2 text-[10px] text-slate-500 hover:text-slate-800"
                    >
                      取消
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="max-h-[38rem] overflow-y-auto">
                <Table>
                  <TableHeader className="bg-slate-50/80 sticky top-0 z-10 border-b border-slate-200">
                    <TableRow>
                      <TableHead className="w-12 pl-6">
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedPoolCards.length === filteredCardsInPool.length) {
                              setSelectedPoolCards([]);
                            } else {
                              setSelectedPoolCards(filteredCardsInPool.map(c => c.id));
                            }
                          }}
                          className="text-slate-400 hover:text-slate-700"
                        >
                          {selectedPoolCards.length === filteredCardsInPool.length && filteredCardsInPool.length > 0 ? (
                            <CheckSquare className="w-4 h-4 text-primary" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </TableHead>
                      <TableHead className="w-16 text-center text-slate-700 font-black uppercase text-[10px]">卡面縮圖</TableHead>
                      <TableHead className="text-slate-900 font-black uppercase text-[10px] py-4">卡片名稱與分類</TableHead>
                      <TableHead className="text-slate-900 font-black uppercase text-[10px] w-28 text-center">剩餘數量</TableHead>
                      <TableHead className="text-slate-900 font-black uppercase text-[10px] w-48">指定等級 (稀有度)</TableHead>
                      <TableHead className="text-slate-900 font-black uppercase text-[10px] w-24 text-right pr-6">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCardsInPool.map(card => {
                      const isChecked = selectedPoolCards.includes(card.id);
                      const currentRarity = poolDetails.cardRarities?.[card.id] || 'common';

                      return (
                        <TableRow key={card.id} className="hover:bg-slate-50 transition-colors border-b border-slate-100 group">
                          <TableCell className="pl-6">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedPoolCards(prev => 
                                  prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]
                                );
                              }}
                              className="text-slate-400 hover:text-slate-700"
                            >
                              {isChecked ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
                            </button>
                          </TableCell>
                          
                          <TableCell className="text-center py-2.5">
                            <button 
                              type="button"
                              onClick={() => setPreviewZoomCard(card)}
                              className="relative w-10 h-14 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shadow-sm mx-auto group-hover:scale-105 transition-transform hover:ring-2 hover:ring-primary/40"
                              title="點擊放大卡面"
                            >
                              <SafeImage src={card.imageUrl} alt={card.name} fill className="object-cover" />
                            </button>
                          </TableCell>

                          <TableCell className="font-black text-slate-900 py-3">
                            <div className="flex flex-col">
                              <span className="text-sm font-black text-slate-900 hover:text-primary cursor-pointer truncate max-w-md" onClick={() => setPreviewZoomCard(card)}>
                                {card.name}
                              </span>
                              <div className="flex items-center gap-2 mt-1">
                                <Badge variant="outline" className="text-[10px] font-bold border-slate-300 text-slate-600 bg-white">
                                  {card.category}
                                </Badge>
                                <span className="text-[11px] font-code font-bold text-slate-500">
                                  參考價: {card.sellPrice?.toLocaleString() || 0} 💎
                                </span>
                              </div>
                            </div>
                          </TableCell>

                          <TableCell className="text-center font-code font-black text-sm text-slate-800">
                            {card.quantity <= 0 ? (
                              <Badge variant="destructive" className="font-code font-bold text-xs bg-rose-100 border border-rose-300 text-rose-700">
                                已抽出 (鎖定)
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="font-code font-bold text-xs bg-slate-100 border border-slate-200 text-slate-800">
                                {card.quantity} 包
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell>
                            {poolDetails.isHybridBlindSpMode ? (
                              <div className="space-y-1.5 min-w-[200px]">
                                <div className="flex items-center gap-1.5">
                                  <Select
                                    value={(poolDetails.cardTiers?.[card.id] as HybridTierCode) || (currentRarity === 'legendary' ? 'A' : currentRarity === 'rare' ? 'B' : 'C')}
                                    onValueChange={(value) => handleCardTierChange(card.id, value as HybridTierCode)}
                                  >
                                    <SelectTrigger className="h-8 text-xs font-black rounded-lg bg-slate-900 text-[#FDE68A] border-amber-300/40 w-[115px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="rounded-xl">
                                      <SelectItem value="A" className="font-bold text-xs">A 賞（金盒）</SelectItem>
                                      <SelectItem value="SP" className="font-bold text-xs">SP 賞（黑盒）</SelectItem>
                                      <SelectItem value="B" className="font-bold text-xs">B 賞（銀盒）</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Input
                                    type="number"
                                    placeholder="成本 NT$"
                                    value={poolDetails.cardCosts?.[card.id] ?? card.sellPrice ?? 0}
                                    onChange={(e) => handleCardCostChange(card.id, Number(e.target.value))}
                                    className="h-8 w-24 text-xs font-mono"
                                  />
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Input
                                    type="text"
                                    placeholder="PSA/BGS 鑑定編號"
                                    value={poolDetails.cardCertNumbers?.[card.id] || ''}
                                    onChange={(e) => handleCardCertChange(card.id, e.target.value)}
                                    className="h-7 text-[11px] font-mono flex-1"
                                  />
                                  {poolDetails.cardTiers?.[card.id] === 'SP' && (
                                    <Badge className="bg-slate-900 text-[#FDE68A] border border-amber-300/50 text-[10px] font-mono shrink-0">
                                      回收 {(poolDetails.spBuybackPoints?.[card.id] ?? Math.round((poolDetails.cardCosts?.[card.id] ?? card.sellPrice ?? 0) * 0.8)).toLocaleString()}P
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <Select
                                value={currentRarity}
                                onValueChange={(value) => handleCardRarityInPoolChange(card.id, value as Rarity)}
                              >
                                <SelectTrigger className={cn("h-9 border font-black text-xs rounded-xl", RARITY_BADGE_STYLES[currentRarity])}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl">
                                  {RARITIES.map(r => (
                                    <SelectItem key={r} value={r} className="font-bold text-xs">
                                      {RARITY_LABELS[r]}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>

                          <TableCell className="text-right pr-6">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl h-9 w-9" 
                              onClick={() => handleRemoveCardFromPool(card.id)}
                              title="從此池移除"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}

                    {filteredCardsInPool.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="h-40 text-center text-slate-400 font-bold italic">
                          <Package className="h-10 w-10 mx-auto mb-2 opacity-20" />
                          {cardsInPool.length === 0 ? '目前卡池尚未配置任何卡片，請點擊上方按鈕從庫存加入。' : '沒有符合篩選條件的卡片。'}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </UICard>

          {/* 普/特卡小賞 (Buy Back) 配置 */}
          <UICard className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-6">
              <CardTitle className="text-lg font-black text-amber-700 flex items-center gap-2.5">
                <PPlusIcon className="w-5 h-5 text-amber-600" />
                隨機球員 普/特 卡 (小賞) 配置
              </CardTitle>
              <CardDescription className="text-xs text-slate-500 font-medium">
                配置隨機球員普卡/特卡等安慰獎小賞，玩家抽出後可選擇放入收藏或於背包 Buy Back 回收為紅利 P 點。
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
              <div className="flex flex-col sm:flex-row items-end gap-4 p-5 border border-amber-200/80 rounded-2xl bg-amber-50/40">
                <div className="space-y-1.5 flex-1 w-full">
                  <Label htmlFor="points-prize" className="text-xs font-black uppercase text-amber-900 tracking-wider">
                    小賞 Buy Back 回收價值 (P 點)
                  </Label>
                  <Input disabled value="300 P" className="h-11 border-slate-200 font-code font-black text-slate-600 bg-slate-100 rounded-xl" />
                </div>

                <div className="space-y-1.5 flex-1 w-full">
                  <Label htmlFor="points-quantity" className="text-xs font-black uppercase text-amber-900 tracking-wider">
                    配置數量 (包)
                  </Label>
                  <Input 
                    id="points-quantity" 
                    type="number" 
                    value={newPointPrize.quantity} 
                    onChange={e => setNewPointPrize({...newPointPrize, quantity: Number(e.target.value)})} 
                    className="h-11 border-slate-200 font-code font-black text-slate-900 bg-white rounded-xl" 
                    placeholder="例如: 20" 
                  />
                </div>

                <div className="space-y-1.5 w-full sm:w-52">
                  <Label htmlFor="points-rarity" className="text-xs font-black uppercase text-amber-900 tracking-wider">
                    指定等級 (稀有度)
                  </Label>
                  <Select
                    value={newPointPrize.rarity}
                    onValueChange={(value) => setNewPointPrize(prev => ({...prev, rarity: value as Rarity}))}
                  >
                    <SelectTrigger id="points-rarity" className="h-11 border-slate-200 font-bold bg-white text-slate-900 rounded-xl">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl">
                      {RARITIES.map(r => (
                        <SelectItem key={r} value={r} className="font-bold text-xs">{RARITY_LABELS[r]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <Button 
                  onClick={handleAddNewPointPrize} 
                  className="h-11 w-full sm:w-auto px-6 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl shadow-md"
                >
                  <PlusCircle className="mr-1.5 h-4 w-4"/>
                  確認配置小賞
                </Button>
              </div>

              {/* 小賞清單 */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <Table>
                  <TableHeader className="bg-slate-50">
                    <TableRow className="border-b border-slate-200">
                      <TableHead className="text-slate-900 font-black uppercase text-[10px] pl-6 py-3.5">小賞內容 / Buy Back 價值</TableHead>
                      <TableHead className="text-slate-900 font-black uppercase text-[10px] w-28 text-center">剩餘包數</TableHead>
                      <TableHead className="text-slate-900 font-black uppercase text-[10px] w-48">等級 / 稀有度</TableHead>
                      <TableHead className="text-slate-900 font-black uppercase text-[10px] w-20 text-right pr-6">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {poolDetails.pointPrizes?.map(prize => (
                      <TableRow key={prize.prizeId} className="hover:bg-slate-50 border-b border-slate-100">
                        <TableCell className="font-black font-code text-amber-700 flex items-center gap-2 text-sm pl-6 py-3">
                          <PPlusIcon className="w-4 h-4 text-amber-600"/>
                          隨機球員卡 (可 Buy Back 300 P)
                        </TableCell>
                        <TableCell className="font-black text-slate-800 text-center font-code">
                          <Badge variant="secondary" className="font-code font-bold bg-slate-100 border border-slate-200">
                            {prize.quantity} 包
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs font-black", RARITY_BADGE_STYLES[prize.rarity || 'common'])}>
                            {RARITY_LABELS[prize.rarity || 'common']}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl h-8 w-8" 
                            onClick={() => handleRemovePointPrize(prize.prizeId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {(!poolDetails.pointPrizes || poolDetails.pointPrizes.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={4} className="h-20 text-center text-slate-400 font-bold italic text-xs">
                          尚未新增隨機普/特卡小賞。
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </UICard>

          {/* 最後賞 (Last One) 限定配置 Card — 移至卡片與庫存配置，沒新增最後賞即代表無最後賞 */}
          <UICard className="border-2 border-amber-300 bg-gradient-to-b from-amber-50/60 to-white shadow-sm rounded-3xl overflow-hidden">
            <CardHeader className="bg-amber-100/60 border-b border-amber-200/80 p-5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div>
                  <CardTitle className="flex items-center text-amber-900 text-base font-black uppercase tracking-wider">
                    <Gift className="mr-2.5 h-5 w-5 text-amber-600" />
                    最後賞限定配置（選填）
                  </CardTitle>
                  <CardDescription className="text-amber-800/80 text-xs font-medium mt-1">
                    抽完池內最後一包的幸運藏家將額外獲得此項卡片；若未新增最後賞，即代表本卡池沒有最後賞。
                  </CardDescription>
                </div>
                <Badge className="bg-amber-500 text-slate-950 font-black text-[10px]">
                  {lastPrizeCard ? '已設定最後賞' : '無最後賞'}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-5">
              {lastPrizeCard ? (
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <div className="relative w-28 aspect-[2.5/3.5] rounded-2xl overflow-hidden border-2 border-amber-400 shadow-lg bg-white p-1.5 shrink-0">
                    <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-100">
                      <SafeImage src={lastPrizeCard.imageUrl} alt={lastPrizeCard.name} fill className="object-cover" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 text-center sm:text-left space-y-2">
                    <p className="font-black text-sm text-slate-900 truncate">{lastPrizeCard.name}</p>
                    <div className="flex items-center justify-center sm:justify-start gap-2">
                      <Badge className="bg-amber-400 text-slate-950 text-[10px] font-black h-5 px-2 border-none">
                        {lastPrizeCard.category}
                      </Badge>
                      <span className="text-xs font-code font-black text-amber-700">
                        {lastPrizeCard.sellPrice?.toLocaleString() || 0} 💎
                      </span>
                    </div>
                    <div className="flex items-center justify-center sm:justify-start gap-2 pt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 border-slate-200 font-bold bg-white text-slate-800 rounded-xl text-xs hover:bg-slate-50"
                        onClick={() => handleOpenAddCardDialog('last')}
                      >
                        更換最後賞卡片
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-9 rounded-xl text-rose-600 border-rose-200 hover:bg-rose-50 text-xs font-bold"
                        onClick={() => handleUpdatePoolDetails('lastPrizeCardId', '')}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        移除最後賞
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="w-full h-28 border-dashed border-2 border-amber-300 bg-amber-50/40 hover:bg-white hover:border-amber-500 transition-all rounded-2xl flex flex-col items-center justify-center gap-1.5 group cursor-pointer"
                  onClick={() => handleOpenAddCardDialog('last')}
                >
                  <PlusCircle className="h-5 w-5 text-amber-600 group-hover:scale-110 transition-transform" />
                  <span className="font-black text-slate-800 tracking-wider text-xs">點擊新增最後賞卡片（未設定即為無最後賞）</span>
                </Button>
              )}
            </CardContent>
          </UICard>

          {/* 一番賞挑號模式（僅於啟用挑籤時顯示籤表管理） */}
          {poolDetails.enablePickNumber && (
              <UICard className="border-2 border-amber-300 bg-gradient-to-br from-amber-50/80 via-yellow-50/40 to-slate-50 shadow-sm rounded-3xl overflow-hidden p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs px-2.5 py-0.5">
                        KUJI NUMBER WALL
                      </Badge>
                      <h3 className="text-lg font-black text-slate-950 flex items-center gap-1.5">
                        <Flame className="w-5 h-5 text-amber-600 fill-amber-500" />
                        一番賞挑籤選號籤表管理
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600">
                      前台將顯示「自選號碼（一番賞挑籤）」按鈕與 1 ~ N 號數字籤牆，可於下方洗籤或監控開出狀態。
                    </p>
                  </div>
                </div>

                {poolDetails.enablePickNumber && (
                  <div className="space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
                      <div className="p-3.5 bg-amber-100/70 border border-amber-300 rounded-2xl space-y-1">
                        <p className="text-[10px] font-black uppercase text-amber-900 tracking-wider">
                          總籤數 (與獎品 1:1 連動)
                        </p>
                        <p className="font-code text-2xl font-black text-amber-950">
                          {totalPrizesCount} 籤
                        </p>
                        <p className="text-[10px] text-amber-800 font-medium">
                          卡牌 {totalCardsCount} 張 + 小賞 {totalPointPrizesCount} 包
                        </p>
                      </div>

                      <div className="sm:col-span-2 flex flex-wrap gap-2.5">
                        <Button
                          onClick={handleGenerateKujiTickets}
                          className="h-10 text-xs font-black bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-md shadow-amber-500/20 rounded-xl"
                        >
                          <Shuffle className="w-3.5 h-3.5 mr-1.5" />
                          🎲 一鍵隨機打散洗籤 (生成 {totalPrizesCount} 張籤表)
                        </Button>

                        {poolDetails.kujiTickets && poolDetails.kujiTickets.length > 0 && (
                          <Button
                            variant="outline"
                            onClick={handleResetKujiTickets}
                            className="h-10 text-xs font-bold border-amber-300 text-slate-700 hover:bg-amber-100/60 rounded-xl"
                          >
                            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                            重置全數籤位
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 即時籤位監控牆 */}
                    {poolDetails.kujiTickets && poolDetails.kujiTickets.length > 0 && (
                      <div className="p-4 bg-white/95 rounded-2xl border border-amber-200 space-y-3 shadow-sm">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold">
                          <span className="text-slate-800 flex items-center gap-1.5 font-black">
                            <Layers className="w-4 h-4 text-amber-500" />
                            番號籤牌即時狀態 ({poolDetails.kujiTickets.length} 張)
                          </span>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setKujiFilter('all')}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-black transition-all",
                                kujiFilter === 'all' ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                              )}
                            >
                              全部 ({poolDetails.kujiTickets.length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setKujiFilter('available')}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-black transition-all",
                                kujiFilter === 'available' ? "bg-emerald-600 text-white" : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                              )}
                            >
                              未開 ({poolDetails.kujiTickets.filter(t => !t.isDrawn).length})
                            </button>
                            <button
                              type="button"
                              onClick={() => setKujiFilter('drawn')}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-xs font-black transition-all",
                                kujiFilter === 'drawn' ? "bg-slate-600 text-white" : "bg-slate-100 text-slate-600 border border-slate-200"
                              )}
                            >
                              已開出 ({poolDetails.kujiTickets.filter(t => t.isDrawn).length})
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-12 lg:grid-cols-16 gap-1.5 max-h-56 overflow-y-auto p-2 bg-slate-50/80 rounded-xl border border-slate-200">
                          {poolDetails.kujiTickets
                            .filter(t => {
                              if (kujiFilter === 'available') return !t.isDrawn;
                              if (kujiFilter === 'drawn') return t.isDrawn;
                              return true;
                            })
                            .map(t => (
                              <div
                                key={t.number}
                                title={`#${t.number}：${t.isDrawn ? `已由 ${t.drawnByName || '藏家'} 抽出` : '可選'}`}
                                className={cn(
                                  "h-8 rounded-lg flex items-center justify-center text-xs font-black border transition-all cursor-default",
                                  t.isDrawn
                                    ? "bg-slate-200/80 border-slate-300 text-slate-400 line-through"
                                    : "bg-amber-400/20 border-amber-400 text-amber-900 hover:bg-amber-400/40 shadow-xs"
                                )}
                              >
                                #{t.number}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </UICard>
              )}

              {/* 活動卡池與專屬規則（僅於活動卡池模式顯示） */}
              {poolDetails.isEventPool && (
              <UICard className="border-2 border-purple-200 bg-gradient-to-br from-purple-50/70 via-slate-50 to-amber-50/50 shadow-sm rounded-3xl p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-purple-100 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-purple-600 text-white font-bold text-xs px-2.5 py-0.5">
                        EVENT POOL
                      </Badge>
                      <h3 className="text-lg font-black text-slate-950 flex items-center gap-1.5">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        活動卡池與管理員派券規則
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600">
                      此卡池為指定活動專屬，可設定「僅限管理員派發專屬券抽取」與派發抽卡券。
                    </p>
                  </div>
                </div>

                {poolDetails.isEventPool && (
                  <div className="space-y-4 pt-1">
                    <div className="p-4 rounded-2xl bg-white border-2 border-amber-300 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0" />
                          <Label className="text-sm font-black text-slate-900 cursor-pointer">
                            🔒 僅限管理員派發專屬券方可抽取（禁止鑽石/P幣直接抽）
                          </Label>
                        </div>
                        <p className="text-xs text-slate-500 pl-7">
                          啟用後一般玩家無法使用點數或鑽石進行抽卡；只有獲得管理員親自派發專屬抽卡券的玩家方可抽取。
                        </p>
                      </div>
                      <Switch
                        checked={poolDetails.exclusiveTicketOnly || false}
                        onCheckedChange={(checked) => {
                          setPoolDetails({ ...poolDetails, exclusiveTicketOnly: checked });
                          handleUpdatePoolDetails('exclusiveTicketOnly', checked);
                        }}
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">專屬活動券名稱</Label>
                        <Input
                          value={poolDetails.eventTicketName || ''}
                          placeholder="例如：2026 週年慶特邀券"
                          onChange={(e) => setPoolDetails({ ...poolDetails, eventTicketName: e.target.value })}
                          onBlur={(e) => handleUpdatePoolDetails('eventTicketName', e.target.value)}
                          className="h-10 bg-white border-slate-200 text-sm font-medium rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">單一玩家抽取上限 (0 為不限)</Label>
                        <Input
                          type="number"
                          min={0}
                          value={poolDetails.eventMaxDrawsPerUser || ''}
                          placeholder="0 表示依持有券數抽完為止"
                          onChange={(e) => setPoolDetails({ ...poolDetails, eventMaxDrawsPerUser: Number(e.target.value) })}
                          onBlur={(e) => handleUpdatePoolDetails('eventMaxDrawsPerUser', Number(e.target.value))}
                          className="h-10 bg-white border-slate-200 text-sm font-medium rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-slate-700">活動說明與獲券資格</Label>
                      <Textarea
                        rows={2}
                        value={poolDetails.eventRules || ''}
                        placeholder="請說明此活動卡池的舉辦目的與資格..."
                        onChange={(e) => setPoolDetails({ ...poolDetails, eventRules: e.target.value })}
                        onBlur={(e) => handleUpdatePoolDetails('eventRules', e.target.value)}
                        className="bg-white border-slate-200 text-xs text-slate-800 rounded-xl"
                      />
                    </div>

                    <div className="pt-2 flex flex-wrap items-center gap-3">
                      <Button
                        type="button"
                        onClick={() => setIsDispatchDialogOpen(true)}
                        className="h-10 px-5 rounded-xl font-black bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-md flex items-center gap-2"
                      >
                        <Ticket className="w-4 h-4" />
                        派發專屬抽卡券給玩家
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsLogsDialogOpen(true)}
                        className="h-10 px-4 rounded-xl font-bold border-purple-200 text-purple-900 bg-white hover:bg-purple-50 flex items-center gap-2"
                      >
                        <Clock className="w-4 h-4 text-purple-600" />
                        查看本池派發記錄
                      </Button>
                    </div>
                  </div>
                )}
              </UICard>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* 彈窗：配置卡片至卡池 Dialog */}
      <Dialog open={isAddCardDialogOpen} onOpenChange={setIsAddCardDialogOpen}>
        <DialogContent className="max-w-4xl h-[88vh] flex flex-col p-6 sm:p-8 rounded-3xl bg-white text-slate-900 shadow-2xl">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900">
              {targetPrizeType === 'last' ? '選擇最後賞 (LAST ONE) 指定卡片' : `配置卡片至「${poolDetails.name || '卡池'}」`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 font-medium">
              {targetPrizeType === 'last' 
                ? '請從庫存中點選一張卡片作為卡包全部抽完時的額外大獎。' 
                : '勾選您想加入此卡池的卡片。已售出或已指派於其他區域的資產已被系統自動過濾。'}
            </DialogDescription>
          </DialogHeader>

          {/* GodPack 一番賞模式：直接選擇要放入哪一個顏色的卡包 */}
          {poolDetails.isHybridBlindSpMode && targetPrizeType !== 'last' && (
            <div className="mb-3 p-3 rounded-2xl bg-[#0a0f1c] text-white border border-amber-300/35 flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-black text-[#FDE68A]">選擇放入卡包顏色：</span>
              <div className="flex flex-wrap gap-1.5">
                {(['A', 'SP', 'B', 'C', 'D'] as const).map((tier) => {
                  const meta = HYBRID_TIER_META[tier];
                  const selected = targetBoxTier === tier;
                  return (
                    <button
                      key={tier}
                      type="button"
                      onClick={() => setTargetBoxTier(tier)}
                      className={cn(
                        'px-3 py-1 rounded-xl text-xs font-black border transition-all cursor-pointer',
                        selected
                          ? 'bg-gradient-to-r from-[#FDE68A] via-amber-300 to-amber-400 text-[#120d02] border-amber-300 shadow'
                          : 'bg-white/[0.05] text-slate-300 border-white/15 hover:bg-white/10'
                      )}
                    >
                      {meta.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* 搜尋、排序與金額區間篩選列 */}
          <div className="mb-3 space-y-2.5">
            <div className="flex flex-wrap gap-2.5">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input 
                  placeholder="搜尋卡片名稱..." 
                  className="pl-10 h-10 border-slate-200 rounded-xl font-bold bg-white text-slate-900 text-xs" 
                  value={addCardSearchTerm}
                  onChange={(e) => setAddCardSearchTerm(e.target.value)}
                />
              </div>
              <Select value={addCardCategoryFilter} onValueChange={setAddCardCategoryFilter}>
                <SelectTrigger className="w-32 sm:w-36 h-10 border-slate-200 rounded-xl font-bold bg-white text-slate-900 text-xs">
                  <SelectValue placeholder="所有運動分類" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {CATEGORIES.map(cat => <SelectItem key={cat} value={cat} className="font-bold text-xs">{cat}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={addCardSortOption} onValueChange={(v) => setAddCardSortOption(v as 'newest' | 'price-desc' | 'price-asc')}>
                <SelectTrigger className="w-36 sm:w-40 h-10 border-slate-200 rounded-xl font-bold bg-white text-slate-900 text-xs">
                  <SelectValue placeholder="排序方式" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="newest" className="font-bold text-xs">上傳時間：新到舊</SelectItem>
                  <SelectItem value="price-desc" className="font-bold text-xs">金額：高到低</SelectItem>
                  <SelectItem value="price-asc" className="font-bold text-xs">金額：低到高</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 金額區間篩選列（自訂輸入 + 快速區間） */}
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/80">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-black text-slate-500 mr-1">金額區間</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="最低"
                  value={addCardMinPrice}
                  onChange={(e) => setAddCardMinPrice(e.target.value)}
                  className="w-24 h-8 rounded-lg border-slate-200 bg-white text-xs font-mono tabular-nums font-bold text-slate-900 px-2.5"
                />
                <span className="text-xs font-bold text-slate-400">~</span>
                <Input
                  type="number"
                  min={0}
                  placeholder="最高"
                  value={addCardMaxPrice}
                  onChange={(e) => setAddCardMaxPrice(e.target.value)}
                  className="w-24 h-8 rounded-lg border-slate-200 bg-white text-xs font-mono tabular-nums font-bold text-slate-900 px-2.5"
                />
                <div className="flex flex-wrap items-center gap-1 ml-1">
                  {[
                    { label: '全部', min: '', max: '' },
                    { label: '1,000 以下', min: '', max: '1000' },
                    { label: '1,000~5,000', min: '1000', max: '5000' },
                    { label: '5,000~15,000', min: '5000', max: '15000' },
                    { label: '15,000 以上', min: '15000', max: '' },
                  ].map((preset) => {
                    const isActive = addCardMinPrice === preset.min && addCardMaxPrice === preset.max;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => {
                          setAddCardMinPrice(preset.min);
                          setAddCardMaxPrice(preset.max);
                        }}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer tabular-nums',
                          isActive
                            ? 'bg-slate-900 text-white border-slate-900'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400 hover:text-slate-900'
                        )}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <span className="text-[11px] font-bold text-slate-500 tabular-nums">
                  符合 <span className="text-slate-900 font-black">{availableCardsToAdd.length}</span> 張
                </span>
                {(addCardSearchTerm || addCardCategoryFilter !== '全部' || addCardMinPrice || addCardMaxPrice || addCardSortOption !== 'newest') && (
                  <button
                    type="button"
                    onClick={() => {
                      setAddCardSearchTerm('');
                      setAddCardCategoryFilter('全部');
                      setAddCardMinPrice('');
                      setAddCardMaxPrice('');
                      setAddCardSortOption('newest');
                    }}
                    className="text-[11px] font-bold text-rose-600 hover:text-rose-700 underline cursor-pointer"
                  >
                    重設
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 卡片網格列表 */}
          <div className="flex-grow overflow-hidden">
            <ScrollArea className="h-full pr-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5 pb-8">
                {isLoadingAllCards && Array.from({length: 10}).map((_, i) => (
                  <Skeleton key={i} className="aspect-[2.5/3.5] rounded-2xl" />
                ))}

                {availableCardsToAdd.map(card => {
                  const isChecked = selectedCardsToAdd.includes(card.id);

                  return (
                    <div 
                      key={card.id} 
                      className={cn(
                        "relative group p-2 border rounded-2xl cursor-pointer transition-all flex flex-col justify-between",
                        isChecked 
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md" 
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                      )}
                      onClick={() => {
                        if (targetPrizeType === 'last') {
                          setSelectedCardsToAdd([card.id]);
                        } else {
                          setSelectedCardsToAdd(prev => 
                            prev.includes(card.id) ? prev.filter(id => id !== card.id) : [...prev, card.id]
                          );
                        }
                      }}
                    >
                      <div className="aspect-[2.5/3.5] relative rounded-xl overflow-hidden border border-slate-100 bg-slate-50">
                        <SafeImage src={card.imageUrl} alt={card.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                        {isChecked && (
                          <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center">
                            <CheckCircle2 className="w-8 h-8 text-primary fill-white shadow-xl" />
                          </div>
                        )}
                        <div className="absolute top-1.5 left-1.5">
                          <Badge className="bg-slate-900/90 text-white text-[9px] font-black border-none px-1.5 py-0 h-4">
                            {card.category}
                          </Badge>
                        </div>
                      </div>

                      <div className="p-1.5 space-y-0.5">
                        <p className="text-xs font-black text-slate-900 truncate" title={card.name}>{card.name}</p>
                        <p className="text-[10px] font-code font-bold text-slate-500">{card.sellPrice?.toLocaleString() || 0} 💎</p>
                      </div>
                    </div>
                  );
                })}

                {!isLoadingAllCards && availableCardsToAdd.length === 0 && (
                  <div className="col-span-full py-20 text-center text-slate-400 italic">
                    <Archive className="h-10 w-10 opacity-20 mx-auto mb-3" />
                    目前庫存中沒有符合條件或未被指派的卡片。
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          <DialogFooter className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 font-bold">
              已選取 <span className="text-slate-900 font-black">{selectedCardsToAdd.length}</span> 張卡片
            </span>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setIsAddCardDialogOpen(false)} className="h-10 rounded-xl font-bold px-4">
                取消
              </Button>
              <Button 
                onClick={handleConfirmAddCards} 
                disabled={selectedCardsToAdd.length === 0} 
                className="h-10 rounded-xl bg-slate-900 text-white font-black px-6 shadow-md hover:bg-slate-800"
              >
                {targetPrizeType === 'last' ? '確認選為最後賞' : `確認加入 ${selectedCardsToAdd.length} 張`}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 彈窗：卡面放大高解析預覽 Dialog */}
      <Dialog open={!!previewZoomCard} onOpenChange={() => setPreviewZoomCard(null)}>
        <DialogContent className="max-w-md bg-white p-6 rounded-3xl shadow-2xl">
          {previewZoomCard && (
            <div className="space-y-4">
              <div className="relative aspect-[2.5/3.5] rounded-2xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-xl">
                <SafeImage src={previewZoomCard.imageUrl} alt={previewZoomCard.name} fill className="object-contain p-2" />
              </div>
              <div className="space-y-1 text-center">
                <Badge variant="outline" className="font-bold border-slate-300 text-slate-700">{previewZoomCard.category}</Badge>
                <h3 className="text-lg font-black text-slate-900">{previewZoomCard.name}</h3>
                <p className="text-xs font-code font-bold text-slate-500">參考市場行情：{previewZoomCard.sellPrice?.toLocaleString() || 0} 💎</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 🎟️ 派發專屬抽卡券 Dialog */}
      <EventTicketDispatchDialog
        open={isDispatchDialogOpen}
        onOpenChange={setIsDispatchDialogOpen}
        pool={{
          id: cardPoolId,
          name: poolDetails.name || '活動卡池',
          isEventPool: poolDetails.isEventPool,
          exclusiveTicketOnly: poolDetails.exclusiveTicketOnly,
          eventTicketName: poolDetails.eventTicketName || '活動專屬抽卡券',
        }}
      />

      {/* 📋 本池專屬抽卡券派發記錄 Dialog */}
      <Dialog open={isLogsDialogOpen} onOpenChange={setIsLogsDialogOpen}>
        <DialogContent className="max-w-4xl bg-slate-50 border-slate-200 p-6 rounded-3xl shadow-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-900">
              【{poolDetails.name || '活動卡池'}】專屬抽卡券派發名單與稽核記錄
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              查看本活動卡池所有已獲派專屬抽卡券之玩家名單、張數與派發備註。
            </DialogDescription>
          </DialogHeader>
          <div className="pt-2">
            <EventTicketDispatchLogs poolId={cardPoolId} title="本卡池派發記錄" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
