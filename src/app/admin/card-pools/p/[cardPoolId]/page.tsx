'use client';

import { useState, ChangeEvent, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useAuth, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { collection, updateDoc, doc, arrayUnion, arrayRemove, Timestamp, runTransaction, query, where } from 'firebase/firestore';
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

const PACK_PRESETS = [
  {
    name: '奢華黑金鋁箔包',
    tag: '經典首選',
    url: '/images/card_pool_bg.jpg',
    gradient: 'from-amber-600 to-amber-950',
    description: '沈穩黑金光澤，極具收藏威儀'
  },
  {
    name: '傳奇特選紅金包',
    tag: 'HOT 限定',
    url: '/public/images/prize_stage_bg.jpg',
    gradient: 'from-rose-600 to-amber-900',
    description: '熱血冠軍紅金，適合高單價旗艦卡池'
  },
  {
    name: '殿堂黑曜石極光包',
    tag: '極光典藏',
    url: '/draw_background.png',
    gradient: 'from-slate-800 to-indigo-950',
    description: '賽博極光炫彩，現代運動感十足'
  }
];

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
  totalTicketsCount?: number;
  kujiTickets?: any[];
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
  const [timeValue, setTimeValue] = useState("00:00");
  const [startTimeValue, setStartTimeValue] = useState("00:00");
  
  // 池內卡片搜尋與篩選
  const [poolCardSearch, setPoolCardSearch] = useState('');
  const [poolRarityFilter, setPoolRarityFilter] = useState<string>('all');
  const [selectedPoolCards, setSelectedPoolCards] = useState<string[]>([]);
  const [previewZoomCard, setPreviewZoomCard] = useState<CardData | null>(null);

  // 封面圖片上傳進度
  const [isUploadingPackImage, setIsUploadingPackImage] = useState(false);
  const [packUploadProgress, setPackUploadProgress] = useState<number | null>(null);

  // 儲存狀態指示
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // 一番賞籤位篩選
  const [kujiFilter, setKujiFilter] = useState<'all' | 'available' | 'drawn'>('all');

  const [newPointPrize, setNewPointPrize] = useState({ points: 100, quantity: 10, rarity: 'common' as Rarity });
  const [isDispatchDialogOpen, setIsDispatchDialogOpen] = useState(false);
  const [isLogsDialogOpen, setIsLogsDialogOpen] = useState(false);

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

  // 匯總已被其他位置佔用的卡片 ID
  const globallyAssignedCardIds = useMemo(() => {
    const ids = new Set<string>();
    allCardPools?.forEach(p => {
      if (p.id === cardPoolId) return;
      p.cards?.forEach(c => ids.add(c.cardId));
      if (p.lastPrizeCardId) ids.add(p.lastPrizeCardId);
    });
    bettingItems?.forEach(item => {
      item.allCardIds?.forEach((id: string) => ids.add(id));
    });
    luckBags?.forEach(bag => {
      if (bag.prizes?.first) ids.add(bag.prizes.first);
      if (bag.prizes?.second) ids.add(bag.prizes.second);
      if (bag.prizes?.third) ids.add(bag.prizes.third);
    });
    return ids;
  }, [allCardPools, cardPoolId, bettingItems, luckBags]);

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

  // 池內卡片解析
  const { cardsInPool, cardsInPoolIds } = useMemo(() => {
    if (!allCards || !cardPool?.cards) return { cardsInPool: [], cardsInPoolIds: new Set<string>() };
    const cardIdToDataMap = new Map(allCards.map(c => [c.id, c]));
    const idSet = new Set<string>();

    const cards = cardPool.cards.filter(poolCard => poolCard.quantity > 0).map(poolCard => {
      const cardData = cardIdToDataMap.get(poolCard.cardId);
      if (cardData) {
        idSet.add(poolCard.cardId);
        return { ...cardData, quantity: poolCard.quantity };
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
  const { totalPoolValue, recommendedPrices, estimatedGrossRevenue } = useMemo(() => {
    if (!allCards || !poolDetails) return { totalPoolValue: 0, recommendedPrices: null, estimatedGrossRevenue: 0 };

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

    const totalPacks = poolDetails.totalPacks || totalPrizesCount || 1;
    const single = Math.round((totalValue * 2.5) / Math.max(1, totalPacks));
    const triple = Math.round(single * 0.95 * 3);
    const estimatedGrossRevenue = (poolDetails.price || 0) * (poolDetails.totalPacks || 0);

    return { 
      totalPoolValue: totalValue, 
      recommendedPrices: { single, triple },
      estimatedGrossRevenue
    };
  }, [allCards, poolDetails, totalPrizesCount]);

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

  // 可加入卡池的卡片清單
  const availableCardsToAdd = useMemo(() => {
    if (!allCards) return [];
    const available = allCards.filter(card => 
      !card.isSold && 
      !globallyAssignedCardIds.has(card.id) &&
      !cardsInPoolIds.has(card.id) &&
      card.id !== poolDetails.lastPrizeCardId &&
      card.source !== 'group-break'
    );

    let filtered = available;
    if (addCardCategoryFilter !== '全部') {
      filtered = available.filter(card => card.category === addCardCategoryFilter);
    }
    if (addCardSearchTerm.trim()) {
      filtered = filtered.filter(card => card.name.toLowerCase().includes(addCardSearchTerm.toLowerCase()));
    }

    filtered.sort((a, b) => {
      const da = a.createdAt ? new Date(typeof a.createdAt === 'string' ? a.createdAt : a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.createdAt).getTime() : 0;
      const db = b.createdAt ? new Date(typeof b.createdAt === 'string' ? b.createdAt : b.createdAt?.seconds ? b.createdAt.seconds * 1000 : b.createdAt).getTime() : 0;
      if (da !== db) return db - da;
      return a.name.localeCompare(b.name);
    });

    return filtered;
  }, [allCards, globallyAssignedCardIds, cardsInPoolIds, poolDetails.lastPrizeCardId, addCardCategoryFilter, addCardSearchTerm]);

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

  // 封面圖上傳處理
  const handlePackImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage || !cardPoolRef) return;

    try {
      setIsUploadingPackImage(true);
      setPackUploadProgress(10);
      const storageRef = ref(storage, `P-Carder/packs/${uuidv4()}-${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setPackUploadProgress(Math.round(progress));
        },
        (error) => {
          console.error('Upload error:', error);
          toast({ variant: 'destructive', title: '上傳失敗', description: '圖片上傳中斷，請重試。' });
          setIsUploadingPackImage(false);
          setPackUploadProgress(null);
        },
        async () => {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          setPoolDetails(prev => ({ ...prev, imageUrl: downloadUrl }));
          await updateDoc(cardPoolRef, { imageUrl: downloadUrl });
          setIsUploadingPackImage(false);
          setPackUploadProgress(null);
          toast({ title: '封面已上傳', description: '專屬卡包包裝圖片已成功套用！' });
        }
      );
    } catch (err) {
      console.error(err);
      setIsUploadingPackImage(false);
      setPackUploadProgress(null);
      toast({ variant: 'destructive', title: '上傳異常' });
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

  // 一番賞重置
  const handleResetKujiTickets = async () => {
    if (!cardPoolRef || !poolDetails.kujiTickets) return;
    const resetTickets = poolDetails.kujiTickets.map(t => {
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
    setPoolDetails(prev => ({ ...prev, kujiTickets: resetTickets, remainingPacks: resetTickets.length }));
    await updateDoc(cardPoolRef, cleanFirestoreData({ kujiTickets: resetTickets, remainingPacks: resetTickets.length }));
    toast({
      title: '一番賞籤位已重置',
      description: '全數號碼已恢復為未開出狀態！',
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
    setIsAddCardDialogOpen(true);
  };

  // 確認將卡片加入卡池
  const handleConfirmAddCards = async () => {
    if (!cardPoolRef || selectedCardsToAdd.length === 0 || !cardPool) return;
    
    if (targetPrizeType === 'last') {
      const cardId = selectedCardsToAdd[0];
      await handleUpdatePoolDetails('lastPrizeCardId', cardId);
      setIsAddCardDialogOpen(false);
      return;
    }

    try {
      await runTransaction(firestore, async (transaction) => {
        const pSnap = await transaction.get(cardPoolRef);
        if (!pSnap.exists()) throw "Pool not found";
        const pData = pSnap.data() as CardPool;
        
        const existingCards = [...(pData.cards || [])];
        const existingRarities = { ...(pData.cardRarities || {}) };
        let addedCount = 0;

        selectedCardsToAdd.forEach(cardId => {
          const idx = existingCards.findIndex(c => c.cardId === cardId);
          if (idx > -1) {
            existingCards[idx].quantity += 1;
          } else {
            existingCards.push({ cardId, quantity: 1 });
          }
          if (!existingRarities[cardId]) {
            existingRarities[cardId] = 'common';
          }
          addedCount += 1;
        });

        transaction.update(cardPoolRef, cleanFirestoreData({
          cards: existingCards,
          cardRarities: existingRarities,
          totalPacks: (pData.totalPacks || 0) + addedCount,
          remainingPacks: (pData.remainingPacks || 0) + addedCount
        }));
      });

      toast({ title: '成功', description: `${selectedCardsToAdd.length} 張卡片已加入卡池。`});
      setIsAddCardDialogOpen(false);
    } catch (error) {
      console.error("Error adding cards to pool:", error);
      toast({ 
        variant: "destructive", 
        title: "錯誤", 
        description: `加入卡片時發生錯誤: ${error instanceof Error ? error.message : '未知錯誤'}` 
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

  // 從池中移除卡片
  const handleRemoveCardFromPool = async (cardIdToRemove: string) => {
    if (!cardPoolRef || !cardPool || !cardPool.cards) return;
    const cardToRemove = cardPool.cards.find(c => c.cardId === cardIdToRemove);
    if (!cardToRemove) return;
    try {
      const newCardRarities = { ...cardPool.cardRarities };
      delete (newCardRarities as Record<string, Rarity>)[cardIdToRemove];
      
      const quantityToRemove = cardToRemove.quantity;
      const newRemainingPacks = Math.max(0, (cardPool.remainingPacks || 0) - quantityToRemove);

      await updateDoc(cardPoolRef, {
        cards: arrayRemove(cardToRemove),
        cardRarities: newCardRarities,
        totalPacks: Math.max(0, (cardPool.totalPacks || 0) - quantityToRemove),
        remainingPacks: newRemainingPacks
      });
      toast({ title: '成功', description: '卡片已從卡池中移除。' });
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
      points: 300,
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

                {poolDetails.isEventPool && (
                  <Badge className="bg-purple-600 text-white font-black text-xs px-2.5 py-0.5 flex items-center gap-1">
                    <Ticket className="w-3 h-3" /> 活動專屬券限定
                  </Badge>
                )}

                {poolDetails.enablePickNumber && (
                  <Badge className="bg-gradient-to-r from-yellow-500 to-amber-500 text-slate-950 font-black text-xs px-2.5 py-0.5 flex items-center gap-1">
                    <Flame className="w-3 h-3 fill-slate-950" /> 一番賞挑號模式
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
        <TabsList className="bg-slate-200/70 p-1.5 rounded-2xl h-14 w-full sm:w-auto grid grid-cols-3 max-w-xl border border-slate-200 shadow-inner">
          <TabsTrigger value="basic" className="rounded-xl font-black text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            <span>基本與銷售定價</span>
          </TabsTrigger>
          <TabsTrigger value="cards" className="rounded-xl font-black text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md flex items-center gap-2">
            <Layers className="w-4 h-4 text-amber-500" />
            <span>卡片與庫存配置 ({cardsInPool.length})</span>
          </TabsTrigger>
          <TabsTrigger value="special" className="rounded-xl font-black text-xs sm:text-sm data-[state=active]:bg-white data-[state=active]:text-slate-900 data-[state=active]:shadow-md flex items-center gap-2">
            <Gift className="w-4 h-4 text-rose-500" />
            <span>最後賞與特殊玩法</span>
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

                  {/* 升級版：卡包封面包裝外觀設計器 */}
                  <div className="p-5 bg-gradient-to-br from-amber-50/80 via-yellow-50/40 to-slate-50 rounded-2xl border border-amber-200/80 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <Label className="text-sm font-black text-slate-900 flex items-center gap-2">
                        <Package className="w-4 h-4 text-amber-600" />
                        卡包包裝封面圖 (Pack Artwork)
                      </Label>
                      <span className="text-[11px] text-amber-800 font-bold bg-amber-100/80 px-2.5 py-0.5 rounded-full">
                        若未設定將自動生成預設黑金鋁箔卡包
                      </span>
                    </div>

                    {/* 範本快捷點選 */}
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold text-slate-600">或一鍵套用經典卡包設計風格範本：</p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {PACK_PRESETS.map((preset) => (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => {
                              setPoolDetails(prev => ({ ...prev, imageUrl: preset.url }));
                              handleUpdatePoolDetails('imageUrl', preset.url);
                            }}
                            className={cn(
                              "p-3 rounded-xl border text-left transition-all relative overflow-hidden group flex flex-col justify-between",
                              poolDetails.imageUrl === preset.url
                                ? "border-amber-500 bg-amber-100/60 ring-2 ring-amber-400/40 shadow-sm"
                                : "border-slate-200 bg-white hover:border-slate-300"
                            )}
                          >
                            <div className="flex items-center justify-between w-full mb-1">
                              <span className="font-black text-xs text-slate-900">{preset.name}</span>
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-300 bg-amber-50 text-amber-800 font-bold">
                                {preset.tag}
                              </Badge>
                            </div>
                            <p className="text-[10px] text-slate-500 line-clamp-1">{preset.description}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 本地上傳或輸入 URL */}
                    <div className="flex flex-col sm:flex-row gap-3 pt-1">
                      <div className="relative flex-1">
                        <Input 
                          id="pool-pack-image" 
                          placeholder="輸入自訂卡包封面圖片網址 (https://...)" 
                          value={poolDetails.imageUrl || ''} 
                          onChange={e => setPoolDetails({...poolDetails, imageUrl: e.target.value})} 
                          onBlur={e => handleUpdatePoolDetails('imageUrl', e.target.value)} 
                          className="h-11 border-slate-200 font-mono text-xs text-slate-900 bg-white rounded-xl pl-3" 
                        />
                      </div>

                      <div className="relative shrink-0">
                        <input
                          type="file"
                          id="pack-file-upload"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePackImageUpload}
                          disabled={isUploadingPackImage}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('pack-file-upload')?.click()}
                          disabled={isUploadingPackImage}
                          className="h-11 px-4 rounded-xl border-amber-300 bg-white hover:bg-amber-50 font-bold text-xs text-slate-800 flex items-center gap-1.5 shadow-sm"
                        >
                          {isUploadingPackImage ? <Loader2 className="w-4 h-4 animate-spin text-amber-600" /> : <Upload className="w-4 h-4 text-amber-600" />}
                          {isUploadingPackImage ? `上傳中 ${packUploadProgress}%` : '本機上傳封面'}
                        </Button>
                      </div>
                    </div>

                    {/* 預覽目前卡包 */}
                    {poolDetails.imageUrl && (
                      <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
                        <div className="relative w-14 h-20 rounded-lg overflow-hidden border border-slate-200 bg-black shrink-0 shadow-sm">
                          <SafeImage src={poolDetails.imageUrl} alt="卡包預覽" fill className="object-cover" />
                        </div>
                        <div className="text-xs space-y-1 flex-1">
                          <p className="font-bold text-slate-900 flex items-center gap-1.5">
                            <Check className="w-4 h-4 text-emerald-600" /> 卡包封面套用中
                          </p>
                          <p className="text-[11px] text-slate-500">前台抽卡展示機台、開盒撕開動畫皆會直接呈現此卡包包裝。</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setPoolDetails(prev => ({ ...prev, imageUrl: '' }));
                            handleUpdatePoolDetails('imageUrl', '');
                          }}
                          className="text-slate-400 hover:text-rose-600 text-xs"
                        >
                          清除
                        </Button>
                      </div>
                    )}
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
                          <span>系統智能建議售價 (依據全池卡片價值試算)</span>
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

              {/* 實體卡包 2.5D 預覽卡 */}
              <UICard className="border-slate-200 bg-white shadow-sm rounded-3xl p-6 text-center space-y-3">
                <p className="text-xs font-black uppercase text-slate-500 tracking-wider">前台機台卡包外觀預覽</p>
                <div className="relative aspect-[2.5/3.8] max-w-[180px] mx-auto rounded-2xl overflow-hidden border-2 border-amber-300 shadow-xl bg-slate-900 group">
                  <SafeImage 
                    src={poolDetails.imageUrl || '/images/card_pool_bg.jpg'} 
                    alt="卡包外觀" 
                    fill 
                    className="object-cover group-hover:scale-105 transition-transform" 
                  />
                  <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/90 to-transparent text-left">
                    <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">{poolDetails.name || 'P+Carder Pack'}</p>
                    <p className="text-xs font-black text-white font-code mt-0.5">{poolDetails.price || 0} {poolDetails.currency === 'p-point' ? 'P' : '💎'}</p>
                  </div>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">玩家在抽卡機台撕包開卡時將看到此包裝</p>
              </UICard>
            </div>
          </div>
        </TabsContent>

        {/* ===================== TAB 2: 卡片與庫存配置 ===================== */}
        <TabsContent value="cards" className="space-y-8 animate-in fade-in-50 duration-200">
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
                            <Badge variant="secondary" className="font-code font-bold text-xs bg-slate-100 border border-slate-200 text-slate-800">
                              {card.quantity} 包
                            </Badge>
                          </TableCell>

                          <TableCell>
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
        </TabsContent>

        {/* ===================== TAB 3: 最後賞與特殊玩法 ===================== */}
        <TabsContent value="special" className="space-y-8 animate-in fade-in-50 duration-200">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* 左側兩欄：特殊機制設定 */}
            <div className="lg:col-span-2 space-y-8">
              {/* 一番賞挑號模式 */}
              <UICard className="border-2 border-amber-300 bg-gradient-to-br from-amber-50/80 via-yellow-50/40 to-slate-50 shadow-sm rounded-3xl overflow-hidden p-6 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/80 pb-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs px-2.5 py-0.5">
                        KUJI NUMBER WALL
                      </Badge>
                      <h3 className="text-lg font-black text-slate-950 flex items-center gap-1.5">
                        <Flame className="w-5 h-5 text-amber-600 fill-amber-500" />
                        一番賞挑籤選號模式 (玩家自選幸運號碼牆)
                      </h3>
                    </div>
                    <p className="text-xs text-slate-600">
                      開啟後前台將出現「自選號碼（一番賞挑籤）」按鈕與 1 ~ N 號數字籤牆，藏家可自由挑選心儀幸運號碼開獎。
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label htmlFor="kuji-switch" className="text-xs font-bold text-slate-800">
                      {poolDetails.enablePickNumber ? '已啟用挑籤模式' : '未啟用挑籤'}
                    </Label>
                    <Switch
                      id="kuji-switch"
                      checked={poolDetails.enablePickNumber || false}
                      onCheckedChange={(checked) => {
                        setPoolDetails({ ...poolDetails, enablePickNumber: checked });
                        handleUpdatePoolDetails('enablePickNumber', checked);
                        if (checked && (!poolDetails.kujiTickets || poolDetails.kujiTickets.length === 0)) {
                          handleGenerateKujiTickets();
                        }
                      }}
                    />
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

              {/* 活動卡池與專屬規則 */}
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
                      將此卡池設為指定活動專屬，可啟用「僅限管理員派發專屬券抽取」等規則。
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Label htmlFor="event-pool-switch" className="text-xs font-bold text-slate-800">
                      {poolDetails.isEventPool ? '已設為活動卡池' : '一般卡池'}
                    </Label>
                    <Switch
                      id="event-pool-switch"
                      checked={poolDetails.isEventPool || false}
                      onCheckedChange={(checked) => {
                        setPoolDetails({ ...poolDetails, isEventPool: checked });
                        handleUpdatePoolDetails('isEventPool', checked);
                      }}
                    />
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
            </div>

            {/* 右側一欄：最後賞、大獎預覽與機率即時看板 */}
            <div className="space-y-8">
              {/* 最後賞 (Last One) 限定配置 Card */}
              <UICard className="border-2 border-amber-300 bg-gradient-to-b from-amber-50/60 to-white shadow-md rounded-3xl overflow-hidden">
                <CardHeader className="bg-amber-100/60 border-b border-amber-200/80 p-5">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-amber-800 text-base font-black uppercase tracking-wider italic">
                      <Gift className="mr-2.5 h-5 w-5 text-amber-600"/>
                      最後賞限定配置 (LAST ONE)
                    </CardTitle>
                    <Badge className="bg-amber-500 text-slate-950 font-black text-[10px]">
                      LAST PRIZE
                    </Badge>
                  </div>
                  <CardDescription className="text-amber-800/80 text-xs font-medium mt-1">
                    抽完池內最後一包的幸運藏家將額外獲得此項傳奇資產。
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  {lastPrizeCard ? (
                    <div className="space-y-4">
                      <div className="relative aspect-[2.5/3.5] rounded-2xl overflow-hidden border-2 border-amber-400 shadow-xl shadow-amber-200/60 bg-white p-2 group">
                        <div className="relative w-full h-full rounded-xl overflow-hidden border border-slate-100">
                          <SafeImage src={lastPrizeCard.imageUrl} alt={lastPrizeCard.name} fill className="object-cover group-hover:scale-105 transition-transform" />
                        </div>
                        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />
                        <div className="absolute bottom-3 inset-x-3 text-center">
                          <p className="font-black text-xs text-white truncate drop-shadow-md">{lastPrizeCard.name}</p>
                          <div className="flex items-center justify-center gap-2 mt-1">
                            <Badge className="bg-amber-400 text-slate-950 text-[10px] font-black h-4 px-1.5 border-none">
                              {lastPrizeCard.category}
                            </Badge>
                            <span className="text-[11px] font-code font-black text-amber-300">
                              {lastPrizeCard.sellPrice?.toLocaleString() || 0} 💎
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button 
                          variant="outline" 
                          className="w-full h-10 border-slate-200 font-black bg-white text-slate-800 shadow-sm rounded-xl text-xs hover:bg-slate-50" 
                          onClick={() => handleOpenAddCardDialog('last')}
                        >
                          更換卡片
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-10 w-10 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50" 
                          onClick={() => handleUpdatePoolDetails('lastPrizeCardId', '')}
                          title="移除最後賞"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <Button 
                      variant="outline" 
                      className="w-full h-44 border-dashed border-2 border-amber-300 bg-amber-50/40 hover:bg-white hover:border-amber-500 transition-all rounded-2xl flex flex-col items-center justify-center gap-2.5 group" 
                      onClick={() => handleOpenAddCardDialog('last')}
                    >
                      <div className="p-3 bg-amber-100 rounded-full group-hover:scale-110 transition-transform">
                        <PlusCircle className="h-6 w-6 text-amber-600" />
                      </div>
                      <div className="text-center">
                        <span className="font-black text-slate-800 tracking-wider text-xs block">點擊設定最後賞</span>
                        <span className="text-[10px] text-slate-400 font-medium">指定抽完後的加碼大獎</span>
                      </div>
                    </Button>
                  )}
                </CardContent>
              </UICard>

              {/* 大獎預覽矩陣 */}
              <UICard className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-5">
                  <CardTitle className="flex items-center text-slate-900 font-black text-sm uppercase tracking-wider">
                    <Trophy className="mr-2 text-amber-500 h-4 w-4" />
                    池內傳奇大獎矩陣
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-xs font-medium">
                    池中剩餘之傳奇 (Legendary) 等級卡牌展示。
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5">
                  {topPrizeCards.length > 0 ? (
                    <div className="grid grid-cols-2 gap-3">
                      {topPrizeCards.map(card => (
                        <div 
                          key={card.id} 
                          onClick={() => setPreviewZoomCard(card)}
                          className="aspect-[2.5/3.5] relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-sm cursor-pointer group hover:ring-2 hover:ring-amber-400"
                        >
                          <SafeImage src={card.imageUrl} alt={card.name} fill className="object-cover group-hover:scale-105 transition-transform"/>
                          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-1.5">
                            <p className="text-[10px] font-black text-white truncate">{card.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center text-slate-400 py-12 text-xs font-bold italic">
                      <Archive className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      目前卡池中無剩餘傳奇獎項
                    </div>
                  )}
                </CardContent>
              </UICard>

              {/* 即時機率計算卡 */}
              <UICard className="border-slate-200 bg-white shadow-sm rounded-3xl overflow-hidden">
                <CardHeader className="bg-slate-50/70 border-b border-slate-100 p-5">
                  <CardTitle className="flex items-center text-slate-900 font-black text-sm uppercase tracking-wider">
                    <GripVertical className="mr-2 text-primary h-4 w-4"/>
                    即時開出機率預覽
                  </CardTitle>
                  <CardDescription className="text-slate-500 text-xs font-medium">
                    根據池內剩餘卡牌與點數獎項數量即時試算。
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-5 space-y-3">
                  <div className="flex justify-between items-center text-xs p-3 bg-amber-50/60 rounded-xl border border-amber-100">
                    <span className="flex items-center gap-1.5 font-black text-amber-700">
                      <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500"/>
                      傳奇 (LEGENDARY)
                    </span>
                    <span className="font-code font-black text-slate-900 text-sm">
                      {probabilities.legendary.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs p-3 bg-cyan-50/60 rounded-xl border border-cyan-100">
                    <span className="flex items-center gap-1.5 font-black text-cyan-700">
                      <Diamond className="h-3.5 w-3.5 fill-cyan-500 text-cyan-500"/>
                      稀有 (RARE)
                    </span>
                    <span className="font-code font-black text-slate-900 text-sm">
                      {probabilities.rare.toFixed(2)}%
                    </span>
                  </div>

                  <div className="flex justify-between items-center text-xs p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <span className="flex items-center gap-1.5 font-black text-slate-600">
                      <Layers className="h-3.5 w-3.5 text-slate-400"/>
                      普通 (COMMON)
                    </span>
                    <span className="font-code font-black text-slate-900 text-sm">
                      {probabilities.common.toFixed(2)}%
                    </span>
                  </div>
                </CardContent>
              </UICard>
            </div>
          </div>
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

          {/* 搜尋與篩選列 */}
          <div className="mb-4 flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input 
                placeholder="搜尋卡片名稱..." 
                className="pl-10 h-10 border-slate-200 rounded-xl font-bold bg-white text-slate-900 text-xs" 
                value={addCardSearchTerm}
                onChange={(e) => setAddCardSearchTerm(e.target.value)}
              />
            </div>
            <Select value={addCardCategoryFilter} onValueChange={setAddCardCategoryFilter}>
              <SelectTrigger className="w-40 h-10 border-slate-200 rounded-xl font-bold bg-white text-slate-900 text-xs">
                <SelectValue placeholder="所有運動分類" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {CATEGORIES.map(cat => <SelectItem key={cat} value={cat} className="font-bold text-xs">{cat}</SelectItem>)}
              </SelectContent>
            </Select>
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
