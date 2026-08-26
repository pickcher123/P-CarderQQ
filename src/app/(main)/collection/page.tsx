'use client';

import { useState, useMemo, useEffect } from 'react';
import { CardItem } from '@/components/card-item';
import { CardReportDialog } from '@/components/card-report-dialog';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as VisuallyHiddenPrimitive from "@radix-ui/react-visually-hidden";
import { 
  Ship, RefreshCw, Gem, Loader2, CheckSquare, Square, Shield, LayoutGrid, 
  Users, Users2, MapPin, SearchCode, X, Sparkles, ChevronRight, Package, 
  Library, Hash, Info, AlertTriangle, RotateCcw, Filter, ArrowUpDown, 
  RotateCw, ArrowLeft, Search, Check, Flame, SlidersHorizontal, Layers, Eye,
  Coins, Truck, ShieldCheck, HelpCircle
} from 'lucide-react';
import { useCollection, useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, getDoc, increment, updateDoc, getDocs, arrayRemove } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import type { UserProfile } from '@/types/user-profile';
import type { SystemConfig } from '@/types/system';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { PPlusIcon } from '@/components/icons';
import { motion, AnimatePresence } from 'motion/react';

type Rarity = 'common' | 'rare' | 'legendary';
type ShippingMethod = '7-11' | '郵寄' | '面交自取';

interface UserCard {
    id: string;
    cardId: string;
    isFoil: boolean;
    userId: string;
    category: string;
    rarity: Rarity;
    source?: string;
    breakTitle?: string;
    teamName?: string;
    serialNumber?: string;
}

interface AllCards {
    id: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
    imageHint: string;
    sellPrice?: number;
    isSold?: boolean;
    category?: string;
    teamName?: string;
}

type MergedCard = UserCard & AllCards & { serialNumber: string };

const SHIPPING_FEE = 60;
const PICKUP_ADDRESS = "台北市中山區林森北路50號3樓之4";

export default function CollectionPage() {
  const router = useRouter();
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewCard, setPreviewCard] = useState<MergedCard | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  
  // Random Player Card Bulk Management States
  const [randomSellQty, setRandomSellQty] = useState<number>(1);
  const [randomShipQty, setRandomShipQty] = useState<number>(1);
  const [isRandomCardsExpanded, setIsRandomCardsExpanded] = useState<boolean>(false);
  const [isRandomSellDialogOpen, setIsRandomSellDialogOpen] = useState<boolean>(false);

  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('7-11');
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'standard' | 'break'>('all');
  const [sortOption, setSortOption] = useState<'price_desc' | 'price_asc' | 'unsold' | 'latest'>('latest');

  const userProfileRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user?.uid]);
  const { data: userProfile } = useDoc<UserProfile>(userProfileRef);

  const systemConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'systemConfig', 'main') : null, [firestore]);
  const { data: systemConfig } = useDoc<SystemConfig>(systemConfigRef);

  useEffect(() => {
    if (userProfile) {
      setShippingName(userProfile.realName || userProfile.username || '');
      setShippingPhone(userProfile.phone || '');
      setShippingAddress(userProfile.address || '');
    }
  }, [userProfile]);

  const { data: userCards, isLoading: isLoadingUserCards, forceRefetch } = useCollection<UserCard>(
    useMemoFirebase(() => (firestore && user?.uid) ? collection(firestore, 'users', user.uid, 'userCards') : null, [firestore, user?.uid])
  );

  const { data: allCards, isLoading: isLoadingCards } = useCollection<AllCards>(
    useMemoFirebase(() => firestore ? collection(firestore, 'allCards') : null, [firestore])
  );
  
  const mergedCards: MergedCard[] = useMemo(() => {
    if (!userCards || !allCards) return [];
    const cardMap = new Map(allCards.map(c => [c.id, c]));
    return userCards.map(userCard => {
      const cardDetails = cardMap.get(userCard.cardId);
      if (cardDetails) {
        return {
          ...cardDetails,
          ...userCard,
          category: (userCard.category && userCard.category !== 'all') ? userCard.category : (cardDetails.category || userCard.category || 'general'),
          serialNumber: userCard.serialNumber || '0000'
        }
      } else if (userCard.cardId?.startsWith('random-player-')) {
          return {
              ...userCard,
              name: '隨機球員 普/特 卡',
              imageUrl: `https://picsum.photos/seed/${userCard.cardId.replace('random-player-', '')}/400/600`,
              imageHint: '幸運獲獎',
              category: '抽賞',
              isSold: false,
              sellPrice: 10,
              serialNumber: userCard.serialNumber || '0000'
          } as MergedCard;
      }
      return null;
    }).filter((c): c is MergedCard => c !== null);
  }, [userCards, allCards]);

  // Categories list
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    mergedCards.forEach(c => {
      if (c.category && c.category !== 'all') cats.add(c.category);
    });
    return Array.from(cats);
  }, [mergedCards]);

  const isRandomPlayerCard = (card: MergedCard) => {
    return (
      card.name?.includes('隨機球員') ||
      card.name?.includes('普/特') ||
      card.category === '抽賞' ||
      card.cardId?.startsWith('random-player-')
    );
  };

  // Filter & Search Logic
  const filteredMergedCards = useMemo(() => {
    return mergedCards.filter(card => {
      // Tab filter
      if (activeTab === 'standard' && (card.source === 'group-break' || isRandomPlayerCard(card))) return false;
      if (activeTab === 'break' && card.source !== 'group-break') return false;

      // Category filter
      if (filterCategory && card.category !== filterCategory) return false;

      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchName = card.name?.toLowerCase().includes(query);
        const matchCategory = card.category?.toLowerCase().includes(query);
        const matchTeam = card.teamName?.toLowerCase().includes(query);
        const matchSerial = card.serialNumber?.toLowerCase().includes(query);
        if (!matchName && !matchCategory && !matchTeam && !matchSerial) return false;
      }

      return true;
    });
  }, [mergedCards, activeTab, filterCategory, searchQuery]);

  // Sort Logic
  const sortedMergedCards = useMemo(() => {
    const list = [...filteredMergedCards];
    if (sortOption === 'price_desc') {
      list.sort((a, b) => (b.sellPrice || 0) - (a.sellPrice || 0));
    } else if (sortOption === 'price_asc') {
      list.sort((a, b) => (a.sellPrice || 0) - (b.sellPrice || 0));
    } else if (sortOption === 'unsold') {
      list.sort((a, b) => (a.isSold ? 1 : -1) - (b.isSold ? 1 : -1));
    }
    return list;
  }, [filteredMergedCards, sortOption]);

  const randomPlayerCards = useMemo(() => {
    return mergedCards.filter(isRandomPlayerCard);
  }, [mergedCards]);

  // Keep randomSellQty and randomShipQty within bounds
  useEffect(() => {
    if (randomPlayerCards.length > 0) {
      setRandomSellQty(prev => Math.min(Math.max(1, prev), randomPlayerCards.length));
      setRandomShipQty(prev => Math.min(Math.max(1, prev), randomPlayerCards.length));
    }
  }, [randomPlayerCards.length]);

  const standardCards = useMemo(() => sortedMergedCards.filter(c => c.source !== 'group-break'), [sortedMergedCards]);
  const uniqueStandardCards = useMemo(() => sortedMergedCards.filter(c => c.source !== 'group-break' && !isRandomPlayerCard(c)), [sortedMergedCards]);
  const groupBreakCards = useMemo(() => sortedMergedCards.filter(c => c.source === 'group-break'), [sortedMergedCards]);

  // Total Portfolio Valuation
  const portfolioStats = useMemo(() => {
    let totalEstimatedDiamonds = 0;
    let totalEstimatedPPoints = 0;

    mergedCards.forEach(card => {
      if (card.source === 'group-break') return;
      if (isRandomPlayerCard(card)) {
        totalEstimatedPPoints += 300;
        totalEstimatedDiamonds += 10;
      } else {
        const basePrice = card.sellPrice || 10;
        totalEstimatedDiamonds += basePrice * 0.7;
        totalEstimatedPPoints += basePrice * 0.1 * 10;
      }
    });

    return {
      totalCards: mergedCards.length,
      standardCount: mergedCards.filter(c => c.source !== 'group-break').length,
      uniqueCount: mergedCards.filter(c => c.source !== 'group-break' && !isRandomPlayerCard(c)).length,
      breakCount: mergedCards.filter(c => c.source === 'group-break').length,
      randomCount: randomPlayerCards.length,
      totalDiamonds: Math.round(totalEstimatedDiamonds),
      totalPPoints: Math.round(totalEstimatedPPoints)
    };
  }, [mergedCards, randomPlayerCards]);

  const handleSelectRandomCards = () => {
    const randomCardIds = randomPlayerCards.map(c => c.id);
    const allRandomSelected = randomCardIds.length > 0 && randomCardIds.every(id => selectedCardIds.has(id));
    
    setSelectedCardIds(prev => {
      const next = new Set(prev);
      if (allRandomSelected) {
        randomCardIds.forEach(id => next.delete(id));
      } else {
        randomCardIds.forEach(id => next.add(id));
      }
      return next;
    });
  };

  const handleQuickSellRandomCount = async (count: number) => {
    if (count <= 0 || !user || !firestore || randomPlayerCards.length === 0) return;
    const actualCount = Math.min(count, randomPlayerCards.length);
    const cardsToSell = randomPlayerCards.slice(0, actualCount);
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      const pPointsGained = actualCount * 300;
      const diamondsGained = actualCount * 10;
      const soldCardNames = `隨機球員 普/特 卡 x ${actualCount}`;

      for (const card of cardsToSell) {
        batch.delete(doc(firestore, 'users', user.uid, 'userCards', card.id));
      }

      batch.set(doc(collection(firestore, 'transactions')), {
        userId: user.uid,
        transactionType: 'QuickSell',
        currency: 'diamond',
        amount: diamondsGained,
        details: `普特卡批量轉點 ${actualCount} 張 (獲得鑽石)。卡片內容: [${soldCardNames}]`,
        transactionDate: serverTimestamp(),
        section: 'admin'
      });

      batch.set(doc(collection(firestore, 'transactions')), {
        userId: user.uid,
        transactionType: 'QuickSell',
        currency: 'p-point',
        amount: pPointsGained,
        details: `普特卡批量轉點 ${actualCount} 張 (獲得紅利P點)。卡片內容: [${soldCardNames}]`,
        transactionDate: serverTimestamp(),
        section: 'admin'
      });

      batch.update(doc(firestore, 'users', user.uid), { 
        points: increment(diamondsGained),
        bonusPoints: increment(pPointsGained)
      });

      await batch.commit();
      toast({ 
        title: "普特卡轉點成功！", 
        description: `已成功將 ${actualCount} 張普特卡變現，獲得 +${diamondsGained} 鑽石 與 +${pPointsGained.toLocaleString()} 紅利P點！` 
      });
      setIsRandomSellDialogOpen(false);
      setSelectedCardIds(prev => {
        const next = new Set(prev);
        cardsToSell.forEach(c => next.delete(c.id));
        return next;
      });
      if (forceRefetch) forceRefetch();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "轉點失敗", description: "處理請求時發生錯誤。" });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSelectRandomForShipping = (count: number) => {
    if (count <= 0 || randomPlayerCards.length === 0) return;
    const actualCount = Math.min(count, randomPlayerCards.length);
    const cardsToShip = randomPlayerCards.slice(0, actualCount);
    setSelectedCardIds(new Set(cardsToShip.map(c => c.id)));
    toast({ 
      title: `已選取 ${actualCount} 張普特卡`, 
      description: "請點擊右下方浮動按鈕【申請出貨】填寫物流資料寄送。" 
    });
  };

  const hasFreeShipping = useMemo(() => {
      if (!userProfile || !systemConfig?.levelBenefits) return false;
      const benefit = systemConfig.levelBenefits.find(b => b.level === userProfile.userLevel);
      return benefit?.freeShipping || false;
  }, [userProfile, systemConfig]);

  const handleSelectCard = (userCardId: string, isSelected: boolean) => {
    setSelectedCardIds(prev => {
      const newSet = new Set(prev);
      if (isSelected) newSet.add(userCardId);
      else newSet.delete(userCardId);
      return newSet;
    });
  };

  const handleSelectAllVisible = () => {
    if (sortedMergedCards.every(c => selectedCardIds.has(c.id))) {
      // Deselect all visible
      setSelectedCardIds(prev => {
        const next = new Set(prev);
        sortedMergedCards.forEach(c => next.delete(c.id));
        return next;
      });
    } else {
      // Select all visible
      setSelectedCardIds(prev => {
        const next = new Set(prev);
        sortedMergedCards.forEach(c => next.add(c.id));
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedCardIds(new Set());
  };

  const conversionValues = useMemo(() => {
    const cardsToSell = mergedCards.filter(c => selectedCardIds.has(c.id) && c.source !== 'group-break');
    let diamonds = 0;
    let pPoints = 0;
    
    cardsToSell.forEach(card => {
        if (card.name.includes('隨機球員')) {
            pPoints += 300;
        } else {
            const basePrice = card.sellPrice || 10;
            diamonds += basePrice * 0.7;
            pPoints += basePrice * 0.1 * 10; 
        }
    });

    return {
        diamonds: Math.round(diamonds),
        pPoints: Math.round(pPoints),
        eligibleCount: cardsToSell.length,
        ineligibleCount: selectedCardIds.size - cardsToSell.length
    };
  }, [mergedCards, selectedCardIds]);

  const handleQuickSell = async () => {
    if (selectedCardIds.size === 0 || !user || !firestore) return;
    const cardsToSell = mergedCards.filter(c => selectedCardIds.has(c.id) && c.source !== 'group-break');
    if (cardsToSell.length === 0) {
        toast({ variant: "destructive", title: "轉點失敗", description: "所選項目均為團拆限定，無法進行轉點。" });
        return;
    }
    setIsProcessing(true);
    try {
      const batch = writeBatch(firestore);
      const { diamonds, pPoints } = conversionValues;
      const soldCardNames = cardsToSell.map(c => c.name).join(', ');

      const existingAllCardIds = new Set((allCards || []).map(c => c.id));
      const autoRelistBetting = systemConfig?.bettingAutoRelistOnBuyBack !== false;

      let bettingItemDocs: any[] = [];
      if (autoRelistBetting) {
        try {
          const bettingSnap = await getDocs(collection(firestore, 'betting-items'));
          bettingItemDocs = bettingSnap.docs;
        } catch (err) {
          console.error("Fetch betting items error:", err);
        }
      }

      for (const card of cardsToSell) {
        batch.delete(doc(firestore, 'users', user.uid, 'userCards', card.id));
        if (card.cardId && existingAllCardIds.has(card.cardId)) {
          const isBettingCard = card.source === 'betting' || card.source === 'direct-buy' || bettingItemDocs.some(d => d.data().allCardIds?.includes(card.cardId));

          if (isBettingCard && autoRelistBetting) {
            batch.update(doc(firestore, 'allCards', card.cardId), { 
                isSold: false,
                isRecycled: false 
            });
            for (const itemDoc of bettingItemDocs) {
              const itemData = itemDoc.data();
              if (itemData.soldCardIds?.includes(card.cardId)) {
                batch.update(itemDoc.ref, {
                  soldCardIds: arrayRemove(card.cardId)
                });
              }
            }
          } else {
            batch.update(doc(firestore, 'allCards', card.cardId), { 
                isSold: true,
                isRecycled: true 
            });
          }
        }
      }

      batch.set(doc(collection(firestore, 'transactions')), {
        userId: user.uid,
        transactionType: 'QuickSell',
        currency: 'diamond',
        amount: diamonds,
        details: `快速轉點 ${cardsToSell.length} 張卡片 (獲得鑽石)。卡片內容: [${soldCardNames}]`,
        transactionDate: serverTimestamp(),
        section: 'admin'
      });

      if (pPoints > 0) {
          batch.set(doc(collection(firestore, 'transactions')), {
            userId: user.uid,
            transactionType: 'QuickSell',
            currency: 'p-point',
            amount: pPoints,
            details: `快速轉點 ${cardsToSell.length} 張卡片 (獲得紅利P點)。卡片內容: [${soldCardNames}]`,
            transactionDate: serverTimestamp(),
            section: 'admin'
          });
      }

      batch.update(doc(firestore, 'users', user.uid), { 
          points: increment(diamonds),
          bonusPoints: increment(pPoints)
      });

      await batch.commit();
      toast({ title: "快速轉點成功！", description: `已將卡片資產轉換為 ${diamonds} 💎 與 ${pPoints} P點。` });
      setSelectedCardIds(new Set());
      if(forceRefetch) forceRefetch();
    } catch (e) {
      console.error(e);
      toast({ variant: "destructive", title: "轉點失敗", description: "處理請求時發生錯誤。" });
    } finally { setIsProcessing(false); }
  };

  const handleShipping = async () => {
    const finalAddress = shippingMethod === '面交自取' ? `${PICKUP_ADDRESS} (自取)` : shippingAddress;

    if (selectedCardIds.size === 0 || !user || !firestore || !finalAddress || !shippingName || !shippingPhone) {
        toast({ variant: 'destructive', title: '錯誤', description: '所有收件資訊皆為必填。'});
        return;
    }
    setIsProcessing(true);
    const fee = (shippingMethod === '面交自取' || hasFreeShipping) ? 0 : SHIPPING_FEE;
    try {
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (fee > 0 && (userSnap.data()?.points || 0) < fee) {
            toast({ variant: "destructive", title: "點數不足", description: `出貨手續費需要 ${fee} 點數。` });
            setIsProcessing(false);
            return;
        }
        const batch = writeBatch(firestore);
        const cardsToShip = mergedCards.filter(c => selectedCardIds.has(c.id));
        const shippingOrderRef = doc(collection(firestore, 'shippingOrders'));
        batch.set(shippingOrderRef, {
            userId: user.uid,
            name: shippingName,
            phone: shippingPhone,
            cardIds: cardsToShip.map(c => ({ cardId: c.cardId, rarity: c.rarity, category: c.category, isFoil: c.isFoil })),
            cardCount: selectedCardIds.size,
            address: finalAddress,
            shippingMethod,
            status: 'pending',
            createdAt: serverTimestamp(),
            fee,
        });
        for (const card of cardsToShip) batch.delete(doc(firestore, 'users', user.uid, 'userCards', card.id));
        if (fee > 0) {
            batch.set(doc(collection(firestore, 'transactions')), {
                userId: user.uid, transactionType: 'Purchase', section: 'shipping', amount: -fee, details: `運單手續費 (${cardsToShip.length}張)`, transactionDate: serverTimestamp(),
            });
            batch.update(userRef, { points: increment(-fee) });
        }
        await batch.commit();
        toast({ title: "出貨請求已提交！", description: "我們將盡快為您備貨出貨，請至會員中心追蹤物流進度。" });
        setSelectedCardIds(new Set());
        if(forceRefetch) forceRefetch();
    } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "出貨失敗", description: "權限不足或發生內部錯誤。" });
    } finally { setIsProcessing(false); }
  };

  if (!isUserLoading && !user) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center p-6 text-center space-y-6 animate-fade-in-up">
      <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-[0_0_50px_rgba(6,182,212,0.2)]">
        <Library className="w-10 h-10 text-cyan-400" />
      </div>
      <div className="space-y-2 max-w-sm">
        <h2 className="text-2xl font-black font-headline text-white tracking-wide">請先登入以開啟收藏庫</h2>
        <p className="text-sm text-slate-400 leading-relaxed">
          登入後即可隨時檢視您的珍稀卡牌、數位資產、申請實體出貨與快速轉點。
        </p>
      </div>
      <Button asChild className="h-12 px-8 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 hover:to-sky-300 text-slate-950 font-black shadow-lg shadow-cyan-500/20">
        <Link href="/login">前往會員登入</Link>
      </Button>
    </div>
  );

  if (isUserLoading) return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center gap-3 animate-fade-in-up">
        <Loader2 className="w-10 h-10 animate-spin text-cyan-400" />
        <p className="text-xs font-bold text-slate-400 tracking-wider">正在解鎖數位保險庫...</p>
    </div>
  );

  const isAllVisibleSelected = sortedMergedCards.length > 0 && sortedMergedCards.every(c => selectedCardIds.has(c.id));

  const addressLabel = 
    shippingMethod === '7-11' ? '7-11 門市名稱或店號' : 
    shippingMethod === '郵寄' ? '收件地址' : '自取提貨門市';

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-transparent text-white pb-32">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[350px] bg-gradient-to-b from-cyan-500/10 via-purple-500/5 to-transparent blur-[120px] pointer-events-none -z-10" />

        <div className="container px-3.5 sm:px-6 py-4 max-w-7xl mx-auto space-y-5 sm:space-y-7">
          
          {/* === TOP HERO / STATS HEADER === */}
          <div className="relative rounded-2xl sm:rounded-3xl p-5 sm:p-8 overflow-hidden border border-cyan-500/20 bg-gradient-to-b from-slate-900/95 via-[#0b101f]/95 to-[#060913] shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
            {/* Grid pattern background */}
            <div className="absolute inset-0 bg-[linear-gradient(to_right,#06b6d408_1px,transparent_1px),linear-gradient(to_bottom,#06b6d408_1px,transparent_1px)] bg-[size:28px_28px] opacity-70 pointer-events-none" />
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee]" />

            <div className="relative z-10 flex flex-col items-center text-center justify-center gap-6">
              
              {/* Centered Title & Subtitle */}
              <div className="space-y-2 max-w-2xl mx-auto text-center">
                <h1 className="font-headline text-2xl sm:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-sky-200 to-amber-300 drop-shadow-[0_0_20px_rgba(6,182,212,0.4)] tracking-tight leading-none">
                  我的卡牌收藏庫
                </h1>

                <p className="text-xs sm:text-sm text-slate-400 font-medium leading-relaxed">
                  管理您的數位藏品與實體球員卡。支援 3D 鑑賞、AI 報告、一鍵批量出貨或極速轉點變現。
                </p>
              </div>

              {/* Centered Portfolio Live Stats */}
              <div className="grid grid-cols-3 gap-2.5 sm:gap-4 w-full max-w-lg mx-auto shrink-0">
                {/* Total Cards Stat */}
                <div className="p-3 rounded-xl sm:rounded-2xl bg-slate-900/90 border border-white/10 flex flex-col items-center justify-center text-center shadow-lg min-w-[95px] sm:min-w-[120px]">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">持有藏品</span>
                  <span className="font-code text-xl sm:text-3xl font-black text-white mt-0.5">
                    {isLoadingUserCards ? '--' : portfolioStats.totalCards}
                  </span>
                  <span className="text-[9px] text-cyan-400/90 font-bold mt-0.5">
                    {portfolioStats.breakCount > 0 ? `含 ${portfolioStats.breakCount} 張團拆` : '張卡片'}
                  </span>
                </div>

                {/* Diamonds Recycle Value */}
                <div className="p-3 rounded-xl sm:rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex flex-col items-center justify-center text-center shadow-lg min-w-[95px] sm:min-w-[120px]">
                  <div className="flex items-center gap-1">
                    <Gem className="w-3 h-3 text-cyan-400" />
                    <span className="text-[10px] font-bold text-cyan-300 uppercase tracking-wider">預估鑽石</span>
                  </div>
                  <span className="font-code text-xl sm:text-3xl font-black text-cyan-400 mt-0.5 drop-shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                    {isLoadingUserCards ? '--' : portfolioStats.totalDiamonds.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold mt-0.5">變現回收值</span>
                </div>

                {/* P+ Points Recycle Value */}
                <div className="p-3 rounded-xl sm:rounded-2xl bg-amber-950/40 border border-amber-500/30 flex flex-col items-center justify-center text-center shadow-lg min-w-[95px] sm:min-w-[120px]">
                  <div className="flex items-center gap-1">
                    <PPlusIcon className="w-3 h-3 text-amber-400" />
                    <span className="text-[10px] font-bold text-amber-300 uppercase tracking-wider">紅利點數</span>
                  </div>
                  <span className="font-code text-xl sm:text-3xl font-black text-amber-400 mt-0.5 drop-shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                    {isLoadingUserCards ? '--' : portfolioStats.totalPPoints.toLocaleString()}
                  </span>
                  <span className="text-[9px] text-slate-400 font-bold mt-0.5">紅利收益</span>
                </div>
              </div>
            </div>
          </div>

          {/* === INTERACTIVE FILTER & TOOLBAR === */}
          <div className="space-y-3">
            {/* Top Row: Search, Tabs & Quick Actions */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              
              {/* Main Category Tabs */}
              <div className="flex items-center gap-1.5 p-1 bg-slate-900/90 border border-white/10 rounded-xl overflow-x-auto no-scrollbar shrink-0">
                <button
                  onClick={() => { setActiveTab('all'); setFilterCategory(null); }}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap",
                    activeTab === 'all' && !filterCategory
                      ? "bg-gradient-to-r from-cyan-500 to-sky-400 text-slate-950 shadow-md shadow-cyan-500/20" 
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>全部藏品</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-md font-code",
                    activeTab === 'all' && !filterCategory ? "bg-slate-950/30 text-slate-950 font-black" : "bg-white/10 text-slate-400"
                  )}>
                    {mergedCards.length}
                  </span>
                </button>

                <button
                  onClick={() => { setActiveTab('standard'); setFilterCategory(null); }}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap",
                    activeTab === 'standard' 
                      ? "bg-gradient-to-r from-cyan-500 to-sky-400 text-slate-950 shadow-md shadow-cyan-500/20" 
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Library className="w-3.5 h-3.5" />
                  <span>個人藏品</span>
                  <span className={cn(
                    "text-[10px] px-1.5 py-0.2 rounded-md font-code",
                    activeTab === 'standard' ? "bg-slate-950/30 text-slate-950 font-black" : "bg-white/10 text-slate-400"
                  )}>
                    {portfolioStats.uniqueCount}
                  </span>
                </button>

                {portfolioStats.breakCount > 0 && (
                  <button
                    onClick={() => { setActiveTab('break'); setFilterCategory(null); }}
                    className={cn(
                      "px-3.5 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 whitespace-nowrap",
                      activeTab === 'break' 
                        ? "bg-gradient-to-r from-orange-500 to-amber-400 text-slate-950 shadow-md shadow-orange-500/20" 
                        : "text-slate-400 hover:text-white hover:bg-white/5"
                    )}
                  >
                    <Users2 className="w-3.5 h-3.5" />
                    <span>團拆專區</span>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.2 rounded-md font-code",
                      activeTab === 'break' ? "bg-slate-950/30 text-slate-950 font-black" : "bg-white/10 text-slate-400"
                    )}>
                      {portfolioStats.breakCount}
                    </span>
                  </button>
                )}
              </div>

              {/* Search & Sort Controls */}
              <div className="flex items-center gap-2">
                {/* Search Bar */}
                <div className="relative flex-1 md:w-60">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <Input 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="搜尋卡名、球隊、編號..."
                    className="h-9 pl-9 pr-7 bg-slate-900/80 border-white/10 rounded-xl text-xs text-white placeholder:text-slate-500 focus:border-cyan-400"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => setSearchQuery('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Sort Dropdown */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9 px-3 rounded-xl bg-slate-900/80 border-white/10 hover:bg-slate-800 text-slate-200 text-xs font-bold gap-1.5 shrink-0">
                      <ArrowUpDown className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="hidden sm:inline">排序：</span>
                      <span>
                        {sortOption === 'price_desc' ? '價值 高→低' :
                         sortOption === 'price_asc' ? '價值 低→高' :
                         sortOption === 'unsold' ? '在庫優先' : '最新加入'}
                      </span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="bg-slate-950 border border-white/10 text-slate-200 text-xs rounded-xl shadow-xl">
                    <DropdownMenuItem onClick={() => setSortOption('latest')} className="cursor-pointer font-bold">
                      最新加入
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('price_desc')} className="cursor-pointer font-bold">
                      價值由高到低
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('price_asc')} className="cursor-pointer font-bold">
                      價值由低到高
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('unsold')} className="cursor-pointer font-bold">
                      在庫優先
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Bottom Row: Category Sub-filters & Bulk Checkbox Shortcuts */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5">
              
              {/* Category Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
                  <Filter className="w-3 h-3 text-slate-400" /> 標籤：
                </span>
                
                <button
                  onClick={() => setFilterCategory(null)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
                    !filterCategory ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" : "bg-white/5 text-slate-400 hover:text-white border border-transparent"
                  )}
                >
                  全部
                </button>

                {allCategories.map(cat => (
                  <button
                    key={cat}
                    onClick={() => setFilterCategory(filterCategory === cat ? null : cat)}
                    className={cn(
                      "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all",
                      filterCategory === cat 
                        ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40" 
                        : "bg-white/5 text-slate-400 hover:text-white border border-transparent"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Bulk Selection Actions */}
              <div className="flex items-center gap-2 ml-auto">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllVisible}
                  disabled={sortedMergedCards.length === 0}
                  className="h-8 px-2.5 rounded-lg text-[11px] font-bold text-slate-300 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-white/10 gap-1.5 transition-all"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{isAllVisibleSelected ? '取消全選' : `全選目前 (${sortedMergedCards.length})`}</span>
                </Button>
              </div>

            </div>
          </div>

          {/* === CARDS GALLERY SECTION === */}
          <div className="space-y-8 pt-2">

            {/* 1. Standard Collection Section (一般卡片 / 個人精選卡片藏品) */}
            {uniqueStandardCards.length > 0 && (activeTab === 'all' || activeTab === 'standard') && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-cyan-500/15 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
                      <Library className="w-4 h-4" />
                    </div>
                    <h2 className="text-base sm:text-lg font-black font-headline text-white tracking-wide flex items-center gap-2">
                      <span>個人精選卡片藏品</span>
                      <span className="text-[10px] font-code font-black text-cyan-300 bg-cyan-500/15 px-2 py-0.5 rounded-full border border-cyan-500/30">
                        {uniqueStandardCards.length} 張
                      </span>
                    </h2>
                  </div>
                  <div className="h-px flex-1 mx-4 bg-gradient-to-r from-cyan-500/20 to-transparent hidden sm:block" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
                  {uniqueStandardCards.map((card, index) => {
                    const isSelected = selectedCardIds.has(card.id);
                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.min(index * 0.02, 0.3) }}
                        onClick={() => setPreviewCard(card)}
                        className={cn(
                          "group relative flex flex-col rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 p-2",
                          "bg-gradient-to-b from-[#13192a]/95 via-[#0c101d]/95 to-[#080b14]/95 border",
                          isSelected 
                            ? "border-cyan-400 ring-2 ring-cyan-400/80 shadow-[0_0_20px_rgba(6,182,212,0.4)] bg-cyan-950/30 scale-[1.02]" 
                            : "border-white/10 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(6,182,212,0.2)] hover:-translate-y-0.5"
                        )}
                      >
                        {/* Card Image Wrapper */}
                        <div className="relative w-full aspect-[2.5/3.5] rounded-xl overflow-hidden bg-black/50">
                          <CardItem 
                            name={card.name} 
                            imageUrl={card.imageUrl} 
                            backImageUrl={card.backImageUrl}
                            imageHint={card.imageHint} 
                            isFlippable={false} 
                            rarity={card.rarity} 
                            priority={index < 12} 
                          />

                          {/* Quick Selection Checkbox on Upper-Left */}
                          <div 
                            className="absolute top-2 left-2 z-30" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCard(card.id, !isSelected);
                            }}
                          >
                            <div className={cn(
                              "w-6 h-6 rounded-lg border transition-all flex items-center justify-center backdrop-blur-md cursor-pointer",
                              isSelected 
                                ? "bg-cyan-400 border-cyan-400 text-slate-950 shadow-[0_0_12px_rgba(6,182,212,0.8)]" 
                                : "bg-black/60 border-white/30 hover:border-white/70 text-transparent"
                            )}>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </div>

                          {/* Card Serial Number Badge */}
                          {card.serialNumber && card.serialNumber !== '0000' && (
                            <div className="absolute top-2 right-2 z-20">
                              <Badge className="bg-slate-950/80 backdrop-blur-md text-cyan-300 border border-cyan-500/30 font-mono text-[9px] px-1.5 py-0.2 shadow">
                                #{card.serialNumber}
                              </Badge>
                            </div>
                          )}

                          {/* Hover Action Hint */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                            <div className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-white/20 text-[10px] font-black text-white flex items-center gap-1 shadow-lg">
                              <Eye className="w-3 h-3 text-cyan-400" /> 鑑賞卡片
                            </div>
                          </div>
                        </div>

                        {/* Card Info Footer */}
                        <div className="mt-2 space-y-1">
                          <h4 className="text-xs font-bold text-white group-hover:text-cyan-300 transition-colors line-clamp-2 leading-tight min-h-[2rem]" title={card.name}>
                            {card.name}
                          </h4>
                          
                          <div className="flex items-center justify-between pt-0.5 text-[10px]">
                            <span className="text-slate-400 truncate max-w-[70px]">
                              {card.category || '一般卡'}
                            </span>
                            <div className="flex items-center gap-1 font-code font-black text-cyan-400">
                              <Gem className="w-2.5 h-2.5" />
                              <span>{card.sellPrice || 10}</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {/* 2. RANDOM PLAYER CARDS TEXT VAULT (普特卡 文字聚合獨立專區 - 與一般卡片完全分開) */}
            {randomPlayerCards.length > 0 && activeTab === 'all' && (
              <motion.section
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="space-y-4"
              >
                {/* Clean Section Divider if there are also standard cards */}
                {uniqueStandardCards.length > 0 && (
                  <div className="relative py-2 flex items-center justify-center">
                    <div className="w-full h-px bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />
                    <div className="absolute px-3 py-0.5 bg-[#0a0e1a] text-[10px] font-black text-amber-400 uppercase tracking-widest border border-amber-500/30 rounded-full flex items-center gap-1.5 shadow-md">
                      <Sparkles className="w-3 h-3 text-amber-400" />
                      <span>普特卡專區 ({randomPlayerCards.length} 張)</span>
                    </div>
                  </div>
                )}

                <div className="relative rounded-2xl sm:rounded-3xl p-4 sm:p-5 bg-gradient-to-b from-amber-950/40 via-slate-900/95 to-[#0c101d] border border-amber-500/30 shadow-[0_10px_35px_rgba(245,158,11,0.15)] overflow-hidden space-y-4">
                  {/* Ambient Glow */}
                  <div className="absolute -top-10 -right-10 w-48 h-48 bg-amber-500/10 blur-3xl pointer-events-none" />
                  
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Left: Card Identity & Stats */}
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-20 sm:w-16 sm:h-22 rounded-xl overflow-hidden bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/90 border-2 border-amber-500/50 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.25)] relative flex flex-col items-center justify-between p-1.5 select-none">
                        {/* Ambient glow */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.2),transparent_70%)] pointer-events-none" />
                        <div className="w-full flex justify-between items-center relative z-10">
                          <span className="text-[7px] font-black text-amber-400 bg-amber-500/20 px-1 py-0.2 rounded">P+</span>
                          <span className="text-[7px] font-bold text-amber-300/80 font-code">普/特</span>
                        </div>
                        {/* Center Logo */}
                        <div className="relative z-10 flex flex-col items-center justify-center my-auto">
                          <PPlusIcon className="w-7 h-7 sm:w-8 sm:h-8 text-amber-400 drop-shadow-[0_0_10px_rgba(245,158,11,0.6)]" />
                        </div>
                        <div className="w-full flex justify-center relative z-10">
                          <span className="text-[6px] font-black text-amber-300/90 tracking-wider uppercase font-headline">P+ CARDER</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h3 className="text-lg sm:text-xl font-black text-white flex items-center gap-2 tracking-tight">
                          <span>隨機球員 普/特 卡</span>
                          <span className="font-code font-black text-amber-400 bg-amber-500/20 px-2.5 py-0.5 rounded-lg border border-amber-500/40 text-base sm:text-lg">
                            x {randomPlayerCards.length} 張
                          </span>
                        </h3>

                        <div className="flex items-center gap-3 text-xs font-code pt-0.5 flex-wrap">
                          <span className="text-cyan-400 font-bold flex items-center gap-1">
                            <Gem className="w-3.5 h-3.5" /> 總值 {randomPlayerCards.length * 10} 鑽石
                          </span>
                          <span className="text-slate-500 hidden sm:inline">•</span>
                          <span className="text-amber-400 font-bold flex items-center gap-1">
                            <PPlusIcon className="w-3.5 h-3.5" /> 總值 {(randomPlayerCards.length * 300).toLocaleString()} P點
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right: Quick Action Controls */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                      {/* Quick Sell Dialog Trigger */}
                      <AlertDialog open={isRandomSellDialogOpen} onOpenChange={setIsRandomSellDialogOpen}>
                        <AlertDialogTrigger asChild>
                          <Button 
                            className="h-10 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95 transition-all"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>快速轉點變現</span>
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="w-[94vw] max-w-md bg-slate-950 border border-amber-500/30 rounded-2xl p-5 sm:p-6 text-white space-y-4">
                          <AlertDialogHeader className="space-y-1 text-left">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase w-fit">
                              <RefreshCw className="w-3 h-3 animate-spin-slow" />
                              <span>普特卡批量變現</span>
                            </div>
                            <AlertDialogTitle className="text-lg sm:text-xl font-black text-white">
                              選擇要轉點的普特卡數量
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-xs text-slate-400">
                              目前持有總計 {randomPlayerCards.length} 張普特卡。可自訂轉換數量，點數即刻入帳。
                            </AlertDialogDescription>
                          </AlertDialogHeader>

                          <div className="space-y-3 p-4 rounded-xl bg-slate-900/90 border border-white/10">
                            <div className="flex items-center justify-between text-xs font-bold text-slate-300">
                              <span>欲轉點數量：</span>
                              <span className="text-amber-400 font-code font-black text-base">{randomSellQty} / {randomPlayerCards.length} 張</span>
                            </div>

                            {/* Quantity Stepper & Quick Pills */}
                            <div className="flex items-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setRandomSellQty(q => Math.max(1, q - 1))}
                                className="h-9 w-9 rounded-lg bg-slate-800 border-white/10 text-white font-bold"
                              >
                                -1
                              </Button>
                              <Input 
                                type="number" 
                                min={1} 
                                max={randomPlayerCards.length} 
                                value={randomSellQty} 
                                onChange={(e) => {
                                  const val = parseInt(e.target.value) || 1;
                                  setRandomSellQty(Math.min(Math.max(1, val), randomPlayerCards.length));
                                }}
                                className="h-9 text-center font-code font-black text-sm bg-slate-950 border-white/20 text-white rounded-lg"
                              />
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setRandomSellQty(q => Math.min(randomPlayerCards.length, q + 1))}
                                className="h-9 w-9 rounded-lg bg-slate-800 border-white/10 text-white font-bold"
                              >
                                +1
                              </Button>
                            </div>

                            <div className="grid grid-cols-4 gap-1.5 pt-1">
                              {[1, 5, 10, randomPlayerCards.length].map((num, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setRandomSellQty(Math.min(num, randomPlayerCards.length))}
                                  className={cn(
                                    "py-1 rounded-lg text-xs font-bold font-code transition-all border",
                                    randomSellQty === Math.min(num, randomPlayerCards.length)
                                      ? "bg-amber-500/20 border-amber-400 text-amber-300 font-black"
                                      : "bg-white/5 border-white/10 text-slate-400 hover:text-white"
                                  )}
                                >
                                  {idx === 3 ? `全部(${randomPlayerCards.length})` : `${num}張`}
                                </button>
                              ))}
                            </div>

                            {/* Reward Preview */}
                            <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-center">
                              <div className="p-2 rounded-lg bg-cyan-950/40 border border-cyan-500/30">
                                <span className="text-[10px] text-slate-400 block font-bold">獲得鑽石</span>
                                <span className="text-cyan-400 font-code font-black text-sm sm:text-base">+{randomSellQty * 10} 💎</span>
                              </div>
                              <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30">
                                <span className="text-[10px] text-slate-400 block font-bold">獲得紅利P點</span>
                                <span className="text-amber-400 font-code font-black text-sm sm:text-base">+{(randomSellQty * 300).toLocaleString()} 🎁</span>
                              </div>
                            </div>
                          </div>

                          <AlertDialogFooter className="flex flex-row items-center justify-end gap-2 w-full">
                            <AlertDialogCancel className="flex-1 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 font-bold text-xs">
                              取消
                            </AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleQuickSellRandomCount(randomSellQty)}
                              disabled={isProcessing || randomSellQty <= 0}
                              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-400 hover:from-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20"
                            >
                              {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : `確認轉點 ${randomSellQty} 張`}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>

                      {/* Quick Ship Action */}
                      <div className="flex items-center gap-1.5">
                        <Input 
                          type="number"
                          min={1}
                          max={randomPlayerCards.length}
                          value={randomShipQty}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 1;
                            setRandomShipQty(Math.min(Math.max(1, val), randomPlayerCards.length));
                          }}
                          className="w-16 h-10 text-center font-code font-black text-xs bg-slate-900 border-white/20 text-white rounded-xl"
                          title="出貨張數"
                        />
                        <Button 
                          onClick={() => handleSelectRandomForShipping(randomShipQty)}
                          variant="outline"
                          className="h-10 px-3.5 rounded-xl border-cyan-500/40 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 font-black text-xs gap-1.5 shadow-sm active:scale-95 transition-all"
                        >
                          <Ship className="w-3.5 h-3.5 text-cyan-400" />
                          <span>選取出貨 ({randomShipQty}張)</span>
                        </Button>
                      </div>

                      {/* Toggle Detailed View */}
                      <Button 
                        variant="ghost"
                        size="sm"
                        onClick={() => setIsRandomCardsExpanded(!isRandomCardsExpanded)}
                        className="h-10 px-2.5 rounded-xl text-slate-400 hover:text-white bg-white/5 border border-white/10 text-xs font-bold gap-1"
                        title="展開或收起每張卡片"
                      >
                        <Layers className="w-3.5 h-3.5 text-amber-400" />
                        <span>{isRandomCardsExpanded ? '收起卡片清單' : '展開單張序號'}</span>
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Individual Random Cards Grid */}
                  {isRandomCardsExpanded && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-3 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5"
                    >
                      {randomPlayerCards.map((card, idx) => {
                        const isSelected = selectedCardIds.has(card.id);
                        return (
                          <div 
                            key={card.id}
                            onClick={() => handleSelectCard(card.id, !isSelected)}
                            className={cn(
                              "p-2 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all",
                              isSelected 
                                ? "bg-amber-500/20 border-amber-400 text-white shadow-md shadow-amber-500/20 scale-[1.02]" 
                                : "bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800"
                            )}
                          >
                            <div className="w-full aspect-[2.5/3.5] rounded-lg overflow-hidden relative bg-gradient-to-br from-slate-900 via-slate-950 to-amber-950/80 border border-amber-500/40 flex flex-col items-center justify-between p-1.5 shadow-inner">
                              <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(245,158,11,0.15),transparent_70%)] pointer-events-none" />
                              <div className="absolute top-1 left-1 z-20">
                                <div className={cn(
                                  "w-4 h-4 rounded border flex items-center justify-center text-[10px]",
                                  isSelected ? "bg-amber-400 text-slate-950 border-amber-400 font-black" : "bg-black/60 border-white/30 text-transparent"
                                )}>
                                  ✓
                                </div>
                              </div>
                              <div className="absolute top-1 right-1 z-10">
                                <span className="text-[7px] font-black text-amber-400/90 bg-amber-500/20 px-1 rounded font-code">普/特</span>
                              </div>

                              {/* Centered Logo */}
                              <div className="my-auto relative z-10 flex flex-col items-center justify-center py-2">
                                <PPlusIcon className="w-6 h-6 text-amber-400 drop-shadow-[0_0_8px_rgba(245,158,11,0.5)]" />
                                <span className="text-[7px] font-black text-amber-300/90 font-headline tracking-tighter mt-0.5">P+ CARD</span>
                              </div>

                              <div className="w-full flex justify-between items-center relative z-10 text-[7px] font-mono text-slate-400 border-t border-white/10 pt-0.5">
                                <span>卡號</span>
                                <span className="text-amber-300 font-bold">#{card.serialNumber}</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold truncate max-w-full text-center">#{idx + 1} 普特卡</span>
                          </div>
                        );
                      })}
                    </motion.div>
                  )}
                </div>
              </motion.section>
            )}

            {/* Group Break Collection Section */}
            {groupBreakCards.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.1 }}
                className="space-y-3.5"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                      <Users2 className="w-4 h-4" />
                    </div>
                    <h2 className="text-base sm:text-lg font-black font-headline text-white tracking-wide flex items-center gap-2">
                      <span>團拆精選專區</span>
                      <span className="text-[10px] font-code font-black text-orange-300 bg-orange-500/15 px-2 py-0.5 rounded-full border border-orange-500/30">
                        {groupBreakCards.length} 張
                      </span>
                    </h2>
                  </div>
                  <div className="h-px flex-1 mx-4 bg-gradient-to-r from-orange-500/20 to-transparent hidden sm:block" />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
                  {groupBreakCards.map((card, index) => {
                    const isSelected = selectedCardIds.has(card.id);
                    return (
                      <motion.div
                        key={card.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: Math.min(index * 0.02, 0.3) }}
                        onClick={() => setPreviewCard(card)}
                        className={cn(
                          "group relative flex flex-col rounded-2xl overflow-hidden cursor-pointer transition-all duration-300 p-2",
                          "bg-gradient-to-b from-[#1c140e]/95 via-[#120d09]/95 to-[#0a0705]/95 border",
                          isSelected 
                            ? "border-orange-400 ring-2 ring-orange-400/80 shadow-[0_0_20px_rgba(249,115,22,0.4)] bg-orange-950/30 scale-[1.02]" 
                            : "border-white/10 hover:border-orange-500/50 hover:shadow-[0_0_20px_rgba(249,115,22,0.2)] hover:-translate-y-0.5"
                        )}
                      >
                        {/* Card Image Wrapper */}
                        <div className="relative w-full aspect-[2.5/3.5] rounded-xl overflow-hidden bg-black/50">
                          <CardItem 
                            name={card.name} 
                            imageUrl={card.imageUrl} 
                            backImageUrl={card.backImageUrl}
                            imageHint={card.imageHint} 
                            serialNumber={card.serialNumber} 
                            isFlippable={false} 
                            rarity={card.rarity} 
                            priority={index < 12} 
                          />

                          {/* Quick Selection Checkbox on Upper-Left */}
                          <div 
                            className="absolute top-2 left-2 z-30" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectCard(card.id, !isSelected);
                            }}
                          >
                            <div className={cn(
                              "w-6 h-6 rounded-lg border transition-all flex items-center justify-center backdrop-blur-md cursor-pointer",
                              isSelected 
                                ? "bg-orange-500 border-orange-500 text-slate-950 shadow-[0_0_12px_rgba(249,115,22,0.8)]" 
                                : "bg-black/60 border-white/30 hover:border-white/70 text-transparent"
                            )}>
                              <Check className="w-3.5 h-3.5 stroke-[3]" />
                            </div>
                          </div>

                          {/* BREAK BADGE */}
                          <div className="absolute top-2 right-2 z-20">
                            <Badge className="bg-orange-500 text-slate-950 text-[9px] font-black px-1.5 py-0.2 shadow-md border-none">
                              BREAK
                            </Badge>
                          </div>

                          {/* Hover Action Hint */}
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none z-20">
                            <div className="px-2.5 py-1 rounded-full bg-slate-900/90 border border-white/20 text-[10px] font-black text-white flex items-center gap-1 shadow-lg">
                              <Eye className="w-3 h-3 text-orange-400" /> 鑑賞卡片
                            </div>
                          </div>
                        </div>

                        {/* Card Info Footer */}
                        <div className="mt-2 space-y-1">
                          <h4 className="text-xs font-bold text-white group-hover:text-orange-300 transition-colors line-clamp-1">
                            {card.name}
                          </h4>
                          
                          <div className="flex items-center justify-between pt-0.5 text-[10px]">
                            <span className="text-orange-400/90 font-bold truncate max-w-[70px]">
                              {card.teamName || card.breakTitle || '團拆球星卡'}
                            </span>
                            <span className="text-[9px] text-slate-400 font-mono">
                              #{card.serialNumber || '0000'}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.section>
            )}

            {/* Skeletons Loading State */}
            {(isLoadingUserCards || isLoadingCards) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="aspect-[2.5/4] rounded-2xl bg-slate-900/60 border border-white/5 p-2 space-y-2 animate-pulse">
                    <Skeleton className="w-full h-4/5 rounded-xl bg-white/5" />
                    <Skeleton className="w-3/4 h-3 rounded bg-white/5" />
                    <Skeleton className="w-1/2 h-3 rounded bg-white/5" />
                  </div>
                ))}
              </div>
            )}

            {/* Empty Collection State */}
            {!isLoadingUserCards && !isLoadingCards && mergedCards.length === 0 && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-20 px-4 bg-slate-900/40 backdrop-blur-md rounded-3xl border border-white/10 relative overflow-hidden"
              >
                <div className="w-20 h-20 mx-auto rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mb-5 shadow-[0_0_50px_rgba(6,182,212,0.2)]">
                  <Library className="w-10 h-10 text-cyan-400" />
                </div>
                <h3 className="text-xl sm:text-2xl font-black font-headline text-white tracking-wide mb-2">
                  收藏庫目前尚無卡片
                </h3>
                <p className="text-xs sm:text-sm text-slate-400 font-medium max-w-sm mx-auto mb-6 leading-relaxed">
                  立即前往【一番賞】、【團拆專區】或【直購商城】，抽取您的首張限量球星卡！
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <Button asChild className="h-11 px-6 rounded-xl font-black text-xs bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20">
                    <Link href="/draw">
                      前往抽卡專區 <ChevronRight className="w-4 h-4 ml-1" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-11 px-6 rounded-xl font-bold text-xs bg-slate-900/80 border-white/10 hover:bg-slate-800 text-white">
                    <Link href="/group-break">
                      參與團拆開箱
                    </Link>
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Filtered Empty Results */}
            {!isLoadingUserCards && !isLoadingCards && mergedCards.length > 0 && sortedMergedCards.length === 0 && (
              <div className="text-center py-16 px-4 bg-slate-900/30 rounded-2xl border border-white/5 space-y-3">
                <SearchCode className="w-10 h-10 text-slate-500 mx-auto" />
                <p className="text-sm font-bold text-slate-300">查無符合條件的卡片</p>
                <p className="text-xs text-slate-500">請嘗試更換篩選分類或清除搜尋關鍵字</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { setSearchQuery(''); setFilterCategory(null); setActiveTab('all'); }}
                  className="rounded-xl text-xs font-bold border-white/10 bg-slate-800 text-slate-200"
                >
                  清除所有篩選
                </Button>
              </div>
            )}
          </div>

          {/* === FLOATING SELECTION & BATCH ACTION DOCK === */}
          <AnimatePresence>
            {selectedCardIds.size > 0 && (
              <motion.div 
                initial={{ y: 80, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 80, opacity: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="fixed bottom-[74px] sm:bottom-6 inset-x-0 mx-auto z-[60] w-[calc(100%-20px)] sm:w-[92vw] max-w-4xl pointer-events-none"
              >
                <div className="relative pointer-events-auto bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/40 rounded-2xl sm:rounded-3xl p-3 sm:p-5 shadow-[0_20px_50px_rgba(0,0,0,0.95),0_0_30px_rgba(6,182,212,0.35)] flex flex-col sm:flex-row items-center justify-between gap-2.5 sm:gap-4 overflow-hidden">
                  
                  {/* Top Ambient Glow Bar */}
                  <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] pointer-events-none" />

                  {/* Left / Top Selected Info */}
                  <div className="flex items-center justify-between sm:justify-start gap-2.5 w-full sm:w-auto">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 font-code font-black text-sm sm:text-base shrink-0 shadow-inner">
                        {selectedCardIds.size}
                      </div>

                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs sm:text-sm font-black text-white whitespace-nowrap">已選取卡片</span>
                          {conversionValues.ineligibleCount > 0 && (
                            <Badge className="bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[9px] px-1.5 py-0 whitespace-nowrap">
                              含 {conversionValues.ineligibleCount} 張團拆(僅出貨)
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-2 sm:gap-3 text-[11px] font-code">
                          <span className="text-cyan-400 flex items-center gap-1 font-bold whitespace-nowrap">
                            <Gem className="w-3 h-3" /> +{conversionValues.diamonds.toLocaleString()} 鑽
                          </span>
                          <span className="text-amber-400 flex items-center gap-1 font-bold whitespace-nowrap">
                            <PPlusIcon className="w-3 h-3" /> +{conversionValues.pPoints.toLocaleString()} P點
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Mobile Cancel Button in Top Row */}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleClearSelection}
                      className="h-8 px-2.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 text-xs font-bold gap-1 sm:hidden shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>取消</span>
                    </Button>
                  </div>

                  {/* Right / Bottom Actions */}
                  <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    
                    {/* Desktop Clear selection */}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={handleClearSelection}
                      className="h-10 px-3 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 text-xs font-bold gap-1 hidden sm:inline-flex"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>取消</span>
                    </Button>

                    {/* Quick Sell Modal */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          disabled={conversionValues.eligibleCount === 0}
                          className="h-10 flex-1 sm:flex-initial px-3 sm:px-4 rounded-xl border-cyan-500/30 bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 text-xs font-black gap-1 sm:gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-50 justify-center whitespace-nowrap"
                        >
                          <RefreshCw className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>快速轉點 ({conversionValues.eligibleCount})</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[94vw] max-w-md bg-slate-950 border border-cyan-500/30 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl text-white flex flex-col gap-3 max-h-[85vh] overflow-y-auto">
                        <AlertDialogHeader className="space-y-1.5 text-left">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase w-fit">
                            <RefreshCw className="w-3 h-3 animate-spin-slow" />
                            <span>ASSET RECYCLE • 資產變現轉點</span>
                          </div>
                          <AlertDialogTitle className="text-lg sm:text-xl font-black text-white tracking-tight">
                            確認將 {conversionValues.eligibleCount} 張卡片轉換為點數？
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-xs text-slate-400 leading-relaxed">
                            轉點完成後，卡片將從您的收藏庫扣除並回收，點數與鑽石將立即入帳。此操作無法撤回。
                          </AlertDialogDescription>
                        </AlertDialogHeader>

                        <div className="flex flex-row gap-2.5 my-2 w-full">
                          <div className="flex-1 p-3 rounded-2xl bg-cyan-950/40 border border-cyan-500/30 flex flex-col items-center justify-center text-center min-w-0">
                            <span className="text-[10px] font-bold text-cyan-300 uppercase whitespace-nowrap">預計獲得鑽石</span>
                            <span className="font-code text-lg sm:text-2xl font-black text-cyan-400 mt-1 flex items-center gap-1 truncate">
                              +{conversionValues.diamonds.toLocaleString()} <Gem className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            </span>
                          </div>

                          <div className="flex-1 p-3 rounded-2xl bg-amber-950/40 border border-amber-500/30 flex flex-col items-center justify-center text-center min-w-0">
                            <span className="text-[10px] font-bold text-amber-300 uppercase whitespace-nowrap">預計獲得紅利 P點</span>
                            <span className="font-code text-lg sm:text-2xl font-black text-amber-400 mt-1 flex items-center gap-1 truncate">
                              +{conversionValues.pPoints.toLocaleString()} <PPlusIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            </span>
                          </div>
                        </div>

                        {conversionValues.ineligibleCount > 0 && (
                          <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 text-orange-300 text-xs font-medium flex items-center gap-2">
                            <Info className="w-4 h-4 shrink-0 text-orange-400" />
                            <span className="leading-snug">所選之 {conversionValues.ineligibleCount} 張團拆卡片不支援轉點，將自動予以保留。</span>
                          </div>
                        )}

                        <AlertDialogFooter className="mt-3 flex flex-row items-center justify-end gap-2 w-full">
                          <AlertDialogCancel className="flex-1 sm:flex-initial h-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 font-bold text-xs">
                            取消
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleQuickSell}
                            disabled={isProcessing}
                            className="flex-1 sm:flex-initial h-10 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 whitespace-nowrap"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : '確認立即變現轉點'}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>

                    {/* Batch Shipping Modal */}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          className="h-10 flex-1 sm:flex-initial px-3.5 sm:px-5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 text-slate-950 text-xs font-black gap-1 sm:gap-1.5 transition-all shadow-lg shadow-cyan-500/20 active:scale-95 justify-center whitespace-nowrap"
                        >
                          <Ship className="w-3.5 h-3.5 shrink-0" />
                          <span>申請出貨 ({selectedCardIds.size})</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="w-[95vw] max-w-xl bg-slate-950 border border-cyan-500/30 rounded-2xl sm:rounded-3xl p-0 overflow-hidden shadow-2xl text-white max-h-[88vh] flex flex-col">
                        
                        <div className="p-4 sm:p-6 pb-3 border-b border-white/10 bg-slate-900/90 flex-shrink-0 flex flex-col gap-1">
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-[10px] font-black uppercase w-fit">
                            <Ship className="w-3 h-3 text-cyan-400" />
                            <span>SHIPPING LOGISTICS • 實體卡牌出貨</span>
                          </div>
                          <AlertDialogTitle className="text-lg sm:text-xl font-black text-white tracking-tight">
                            申請寄送 {selectedCardIds.size} 張實體卡牌
                          </AlertDialogTitle>
                          <AlertDialogDescription className="text-xs text-slate-400">
                            請選擇物流方式並填妥收件人資料，專人將於審核後進行防護包裝與寄出。
                          </AlertDialogDescription>
                        </div>

                        <div className="p-4 sm:p-6 space-y-3.5 overflow-y-auto flex-1 flex flex-col">
                          {/* Shipping Methods */}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-300">配送方式選擇</Label>
                            <RadioGroup 
                              value={shippingMethod} 
                              onValueChange={(val: ShippingMethod) => setShippingMethod(val)} 
                              className="flex flex-row gap-2 w-full"
                            >
                              <div 
                                onClick={() => setShippingMethod('7-11')}
                                className={cn(
                                  "flex-1 p-2 sm:p-3 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all gap-0.5 sm:gap-1 min-w-0",
                                  shippingMethod === '7-11' ? "bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10" : "bg-slate-900/80 border-white/10 text-slate-400 hover:bg-slate-800"
                                )}
                              >
                                <Package className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                                <span className="text-[11px] sm:text-xs font-black text-white mt-0.5 whitespace-nowrap">7-11 超商</span>
                                <span className="text-[9px] sm:text-[10px] font-bold text-cyan-300 font-code whitespace-nowrap">
                                  {hasFreeShipping ? '免運特權' : `${SHIPPING_FEE} 點`}
                                </span>
                              </div>

                              <div 
                                onClick={() => setShippingMethod('郵寄')}
                                className={cn(
                                  "flex-1 p-2 sm:p-3 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all gap-0.5 sm:gap-1 min-w-0",
                                  shippingMethod === '郵寄' ? "bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10" : "bg-slate-900/80 border-white/10 text-slate-400 hover:bg-slate-800"
                                )}
                              >
                                <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                                <span className="text-[11px] sm:text-xs font-black text-white mt-0.5 whitespace-nowrap">掛號郵寄</span>
                                <span className="text-[9px] sm:text-[10px] font-bold text-cyan-300 font-code whitespace-nowrap">
                                  {hasFreeShipping ? '免運特權' : `${SHIPPING_FEE} 點`}
                                </span>
                              </div>

                              <div 
                                onClick={() => setShippingMethod('面交自取')}
                                className={cn(
                                  "flex-1 p-2 sm:p-3 rounded-xl border flex flex-col items-center justify-center text-center cursor-pointer transition-all gap-0.5 sm:gap-1 min-w-0",
                                  shippingMethod === '面交自取' ? "bg-cyan-500/15 border-cyan-400 text-white shadow-md shadow-cyan-500/10" : "bg-slate-900/80 border-white/10 text-slate-400 hover:bg-slate-800"
                                )}
                              >
                                <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-400" />
                                <span className="text-[11px] sm:text-xs font-black text-white mt-0.5 whitespace-nowrap">門市自取</span>
                                <span className="text-[9px] sm:text-[10px] font-bold text-emerald-400 whitespace-nowrap">免手續費</span>
                              </div>
                            </RadioGroup>
                          </div>

                          {/* Inputs */}
                          <div className="flex flex-col sm:flex-row gap-2.5 w-full">
                            <div className="flex-1 space-y-1">
                              <Label className="text-xs font-bold text-slate-300">收件人姓名 *</Label>
                              <Input 
                                value={shippingName} 
                                onChange={(e) => setShippingName(e.target.value)} 
                                placeholder="請輸入收件人真實姓名"
                                className="h-9 sm:h-10 bg-slate-900 border-white/10 rounded-xl text-xs text-white"
                              />
                            </div>

                            <div className="flex-1 space-y-1">
                              <Label className="text-xs font-bold text-slate-300">聯絡電話 *</Label>
                              <Input 
                                value={shippingPhone} 
                                onChange={(e) => setShippingPhone(e.target.value)} 
                                placeholder="例如：0912345678"
                                className="h-9 sm:h-10 bg-slate-900 border-white/10 rounded-xl text-xs text-white"
                              />
                            </div>
                          </div>

                          <div className="space-y-1 w-full">
                            <Label className="text-xs font-bold text-slate-300">{addressLabel} *</Label>
                            {shippingMethod === '面交自取' ? (
                              <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/30 text-xs text-cyan-300 space-y-1">
                                <p className="font-bold flex items-center gap-1.5">
                                  <MapPin className="w-4 h-4 text-cyan-400 shrink-0" />
                                  <span>{PICKUP_ADDRESS}</span>
                                </p>
                                <p className="text-[11px] text-slate-400">
                                  ※ 面交自取請於下單後聯繫官方 LINE 客服預約取件時段。
                                </p>
                              </div>
                            ) : (
                              <Input 
                                value={shippingAddress} 
                                onChange={(e) => setShippingAddress(e.target.value)} 
                                placeholder={shippingMethod === '7-11' ? "例如：長津門市 或 店號123456" : "例如：台北市信義區信義路五段7號"}
                                className="h-9 sm:h-10 bg-slate-900 border-white/10 rounded-xl text-xs text-white"
                              />
                            )}
                          </div>

                          {/* Notice */}
                          <div className="p-2.5 sm:p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-200/90 space-y-1">
                            <div className="flex items-center gap-1.5 font-bold text-amber-400">
                              <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                              <span>保險與開箱須知</span>
                            </div>
                            <p className="leading-relaxed text-slate-300 text-[10.5px] sm:text-[11px]">
                              卡牌出貨前均經過嚴格品檢並附保護套。收到包裹後請務必【全程開箱錄影】以維護售後權益。
                            </p>
                          </div>
                        </div>

                        <div className="p-3.5 sm:p-4 border-t border-white/10 bg-slate-900/90 flex flex-row items-center justify-end gap-2.5 flex-shrink-0">
                          <AlertDialogCancel className="flex-1 sm:flex-initial h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 border-white/10 text-xs font-bold">
                            取消
                          </AlertDialogCancel>
                          <AlertDialogAction
                            onClick={handleShipping}
                            disabled={isProcessing}
                            className="flex-1 sm:flex-initial h-10 px-5 sm:px-6 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 text-slate-950 font-black text-xs shadow-lg shadow-cyan-500/20 whitespace-nowrap"
                          >
                            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : '確認並提交出貨單'}
                          </AlertDialogAction>
                        </div>
                      </AlertDialogContent>
                    </AlertDialog>

                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* === 3D SHOWROOM PREVIEW DIALOG === */}
          <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
            <DialogContent className="max-w-[min(92vw,380px)] bg-slate-950/95 backdrop-blur-2xl border border-cyan-500/30 shadow-2xl p-5 overflow-hidden flex flex-col items-center justify-center gap-4 rounded-3xl text-white">
              <DialogTitle><VisuallyHiddenPrimitive.Root>Card Showroom</VisuallyHiddenPrimitive.Root></DialogTitle>
              {previewCard && (
                <div className="w-full flex flex-col items-center gap-4">
                  
                  {/* Card Title & Badges */}
                  <div className="flex flex-col items-center text-center gap-1">
                    <div className="flex items-center gap-1.5 flex-wrap justify-center">
                      <Badge variant="outline" className="border-cyan-500/40 text-cyan-300 bg-cyan-500/10 px-2.5 py-0.5 font-bold tracking-wider uppercase text-[10px] rounded-full">
                        {previewCard.category ? previewCard.category.toUpperCase() : 'GENERAL ASSET'}
                      </Badge>
                      {previewCard.serialNumber && previewCard.serialNumber !== '0000' && (
                        <Badge className="bg-slate-900 text-cyan-300 border border-cyan-500/30 text-[10px] font-mono px-2 py-0.5">
                          #{previewCard.serialNumber}
                        </Badge>
                      )}
                    </div>
                    <h2 className="text-base sm:text-lg font-black font-headline tracking-tight text-white uppercase max-w-xs text-center leading-snug mt-1">
                      {previewCard.name}
                    </h2>
                  </div>

                  {/* 3D Flip Card Container */}
                  <div className="w-full max-w-[190px] aspect-[2.5/3.5] perspective-1000 my-1">
                    <motion.div 
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="relative w-full h-full group"
                    >
                      <div className="absolute -inset-4 bg-cyan-500/20 blur-xl opacity-70 group-hover:opacity-100 transition-opacity pointer-events-none" />
                      <CardItem 
                        name={previewCard.name} 
                        imageUrl={previewCard.imageUrl} 
                        backImageUrl={previewCard.backImageUrl}
                        imageHint={previewCard.imageHint} 
                        rarity={previewCard.rarity} 
                        isFlippable={true}
                        priority={true}
                      />
                    </motion.div>
                  </div>

                  {/* Valuation & Inspection Buttons */}
                  <div className="flex flex-col items-center gap-2.5 w-full pt-1">
                    <div className="flex items-center gap-2 bg-slate-900 border border-white/10 px-4 py-1.5 rounded-xl text-xs font-code font-black text-white shadow-md">
                      <span className="text-slate-400 font-sans text-[11px]">估值:</span>
                      <Gem className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-cyan-300">{previewCard.sellPrice || 10} 鑽石</span>
                    </div>

                    <p className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                      <RotateCw className="w-3 h-3 text-cyan-400 animate-spin-slow" /> 點擊卡片即可 3D 翻面觀看背卡
                    </p>

                    <Button 
                      onClick={() => setIsReportOpen(true)} 
                      className="h-10 w-full rounded-xl text-xs font-black bg-gradient-to-r from-cyan-500 to-sky-400 hover:from-cyan-400 text-slate-950 shadow-lg shadow-cyan-500/20 transition-all mt-1"
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-1" /> 生成 AI 智能鑑定報告
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* AI Report Dialog */}
          <CardReportDialog card={previewCard} open={isReportOpen} onOpenChange={setIsReportOpen} />

        </div>
      </div>
    </TooltipProvider>
  );
}
