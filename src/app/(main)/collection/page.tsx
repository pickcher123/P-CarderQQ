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
} from "@/components/ui/alert-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from '@/components/ui/checkbox';
import * as VisuallyHiddenPrimitive from "@radix-ui/react-visually-hidden";
import { Ship, RefreshCw, Gem, Loader2, CheckSquare, Square, Shield, LayoutGrid, Users, Users2, MapPin, SearchCode, X, Sparkles, ChevronRight, Package, Library, Hash, Info, AlertTriangle, RotateCcw, Filter, ArrowUpDown, RotateCw } from 'lucide-react';
import { useCollection, useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, getDoc, increment, updateDoc, getDocs, arrayRemove } from 'firebase/firestore';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
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
    category?: string; // Add this
    teamName?: string; // Maybe add this too
}

type MergedCard = UserCard & AllCards & { serialNumber: string };

const SHIPPING_FEE = 60;
const PICKUP_ADDRESS = "台北市中山區林森北路50號3樓之4";

export default function CollectionPage() {
  const { user, isUserLoading } = useUser();
  const firestore = useFirestore();
  const { toast } = useToast();
  
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewCard, setPreviewCard] = useState<MergedCard | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('7-11');
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [sortOption, setSortOption] = useState<'price' | 'unsold' | 'latest'>('latest');

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
      } else if (userCard.cardId.startsWith('random-player-')) {
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

  const sortedMergedCards = useMemo(() => {
      let sorted = [...mergedCards];
      if (sortOption === 'price') sorted.sort((a,b) => (b.sellPrice || 0) - (a.sellPrice || 0));
      else if (sortOption === 'unsold') sorted.sort((a,b) => (a.isSold ? 1 : -1) - (b.isSold ? 1 : -1));
      // latest increase is hard to know without timestamp on userCards, assuming index order is okay
      return sorted;
  }, [mergedCards, sortOption]);

  const filteredMergedCards = useMemo(() => {
      if (!filterCategory) return sortedMergedCards;
      return sortedMergedCards.filter(c => c.category === filterCategory);
  }, [sortedMergedCards, filterCategory]);

  const randomPlayerCards = useMemo(() => {
    return mergedCards.filter(c => c.name.includes('隨機球員') || c.category === '抽賞');
  }, [mergedCards]);

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

  const standardCards = useMemo(() => filteredMergedCards.filter(c => c.source !== 'group-break'), [filteredMergedCards]);
  const groupBreakCards = useMemo(() => filteredMergedCards.filter(c => c.source === 'group-break'), [filteredMergedCards]);

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

  const handleSelectAll = () => {
    if (selectedCardIds.size === mergedCards.length) {
        setSelectedCardIds(new Set());
    } else {
        setSelectedCardIds(new Set(mergedCards.map(card => card.id)));
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
        pPoints: Math.round(pPoints)
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
      const autoRelistBetting = systemConfig?.bettingAutoRelistOnBuyBack !== false; // 預設開啟自動重新上架

      // 若有開啟拼卡自動重新上架，預先取得 betting-items 資料庫內容
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
            // 重置卡片狀態為未售出，自動重新上架到拼卡專區
            batch.update(doc(firestore, 'allCards', card.cardId), { 
                isSold: false,
                isRecycled: false 
            });
            // 從包含此卡片之 betting-items 的 soldCardIds 中移除
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
        toast({ variant: 'destructive', title: '錯誤', description: '所有資訊皆為必填。'});
        return;
    }
    setIsProcessing(true);
    const fee = (shippingMethod === '面交自取' || hasFreeShipping) ? 0 : SHIPPING_FEE;
    try {
        const userRef = doc(firestore, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (fee > 0 && (userSnap.data()?.points || 0) < fee) {
            toast({ variant: "destructive", title: "點數不足", description: `手續費需要 ${fee} 點。` });
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
                userId: user.uid, transactionType: 'Purchase', section: 'shipping', amount: -fee, details: `運單手續費`, transactionDate: serverTimestamp(),
            });
            batch.update(userRef, { points: increment(-fee) });
        }
        await batch.commit();
        toast({ title: "出貨請求已提交！", description: "請至會員中心追蹤進度。" });
        setSelectedCardIds(new Set());
        if(forceRefetch) forceRefetch();
    } catch (e) {
        console.error(e);
        toast({ variant: "destructive", title: "出貨失敗", description: "權限不足或發生內部錯誤。" });
    } finally { setIsProcessing(false); }
  };

  if (!isUserLoading && !user) return (
    <div className="container py-20 text-center animate-fade-in-up">
      <h2 className="text-2xl font-bold mb-4 text-white font-headline">請先登入以查看收藏庫</h2>
      <Button asChild className="rounded-xl"><Link href="/login">前往登入</Link></Button>
    </div>
  );

  if (isUserLoading) return (
    <div className="container py-20 text-center animate-fade-in-up">
        <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
    </div>
  );

  const isAllSelected = mergedCards.length > 0 && selectedCardIds.size === mergedCards.length;

  const addressLabel = 
    shippingMethod === '7-11' ? '出貨門市' : 
    shippingMethod === '郵寄' ? '寄送地址' : '自取地點';

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-slate-950/20 text-white">
        <div className="container py-12 md:py-24 relative">
          {/* Futuristic Background Elements */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-primary/10 blur-[120px] pointer-events-none opacity-50" />
          <div className="absolute top-[20%] right-[10%] w-64 h-64 bg-accent/20 blur-[100px] pointer-events-none opacity-30 animate-pulse" />
          <div className="absolute top-[40%] left-[5%] w-48 h-48 bg-primary/20 blur-[80px] pointer-events-none opacity-30" />
          
          {/* Header Section */}
          <div className="text-center mb-8 relative z-20">
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="font-headline text-3xl font-black tracking-[0.2em] sm:text-6xl text-white drop-shadow-[0_0_15px_rgba(6,182,212,0.4)] mb-2 px-4 break-words text-center"
            >
              我的<span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/30">收藏</span>
            </motion.h1>
          </div>

        {/* Selection & Actions Bar - Fixed at bottom when active */}
        <AnimatePresence>
            {selectedCardIds.size > 0 && (
                <motion.div 
                    initial={{ y: 100, opacity: 0, x: '-50%' }}
                    animate={{ y: 0, opacity: 1, x: '-50%' }}
                    exit={{ y: 100, opacity: 0, x: '-50%' }}
                    className="fixed bottom-[75px] md:bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95vw] max-w-5xl"
                >
                    <div className="bg-slate-900/80 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-4 md:p-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] flex flex-wrap items-center gap-4 justify-between w-full">
                        <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                            <div className="relative shrink-0">
                                <div className="absolute inset-0 bg-primary/20 blur-md rounded-xl" />
                                <div className="relative bg-slate-950 p-3 md:p-4 rounded-xl border border-primary/30">
                                    <Package className="w-5 h-5 md:w-6 md:h-6 text-primary" />
                                </div>
                                <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-primary text-black text-[9px] md:text-[10px] font-black w-5 h-5 md:w-6 md:h-6 rounded-full flex items-center justify-center shadow-lg">
                                    {selectedCardIds.size}
                                </div>
                            </div>
                            
                            <div className="space-y-0.5">
                                <p className="text-white font-black text-sm md:text-lg tracking-tight">已選擇卡片</p>
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-1.5 group">
                                        <Gem className="w-3 h-3 text-primary" />
                                        <span className="text-xs font-code font-black text-white">{conversionValues.diamonds.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 group">
                                        <PPlusIcon className="w-3 h-3 text-accent" />
                                        <span className="text-xs font-code font-black text-white">{conversionValues.pPoints.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto mt-1 md:mt-0">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleClearSelection}
                                className="h-10 md:h-12 rounded-xl hover:bg-white/5 text-slate-400 font-bold px-3 md:px-6 text-xs md:text-sm"
                            >
                                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> 清除
                            </Button>
                            
                            <div className="flex gap-2 flex-1">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button className="flex-1 h-10 md:h-12 rounded-xl bg-white text-black hover:bg-slate-200 font-black transition-all active:scale-95 shadow-xl text-xs md:text-sm">
                                            <Ship className="mr-1 h-4 w-4" /> 批量出貨
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-2xl md:rounded-3xl bg-slate-950 border border-white/10 shadow-2xl text-white p-0 overflow-hidden max-w-[95vw] sm:max-w-lg md:max-w-2xl max-h-[90vh] flex flex-col">
                                        <div className="absolute top-0 right-0 p-6 md:p-8 opacity-5 pointer-events-none z-0">
                                            <Ship className="w-24 h-24 md:w-48 md:h-48 text-primary" />
                                        </div>
                                        <AlertDialogHeader className="p-5 md:p-6 pb-4 border-b border-white/10 bg-slate-900/80 relative z-10 flex-shrink-0">
                                            <AlertDialogTitle className="text-xl md:text-2xl font-black italic tracking-tight text-white flex flex-wrap items-center gap-2">
                                                DELIVERY REQUEST
                                            </AlertDialogTitle>
                                            <AlertDialogDescription className="text-slate-400 font-medium text-xs md:text-sm mt-1">
                                                請填寫您的收件資訊，我們將盡速為您安排配送。
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="p-5 md:p-6 space-y-5 md:space-y-6 overflow-y-auto flex-1 relative z-10">
                                            <RadioGroup defaultValue="7-11" onValueChange={(value: ShippingMethod) => setShippingMethod(value)} className="grid grid-cols-3 gap-2 md:gap-4">
                                                <div className={cn("flex flex-col gap-1.5 border p-3 md:p-4 rounded-xl md:rounded-2xl transition-all cursor-pointer relative", shippingMethod === '7-11' ? 'bg-primary/10 border-primary/60 ring-1 ring-primary/60 text-white shadow-lg shadow-primary/10' : 'bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800')}
                                                     onClick={() => setShippingMethod('7-11')}>
                                                    <div className="flex justify-between items-center">
                                                        <RadioGroupItem value="7-11" id="r1" className="border-white/30 text-primary" />
                                                        <Package className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                                                    </div>
                                                    <Label htmlFor="r1" className="cursor-pointer font-black text-xs md:text-sm text-white mt-1">7-11</Label>
                                                    <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase truncate">{SHIPPING_FEE} 點數</p>
                                                </div>
                                                <div className={cn("flex flex-col gap-1.5 border p-3 md:p-4 rounded-xl md:rounded-2xl transition-all cursor-pointer relative", shippingMethod === '郵寄' ? 'bg-primary/10 border-primary/60 ring-1 ring-primary/60 text-white shadow-lg shadow-primary/10' : 'bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800')}
                                                     onClick={() => setShippingMethod('郵寄')}>
                                                    <div className="flex justify-between items-center">
                                                        <RadioGroupItem value="郵寄" id="r2" className="border-white/30 text-primary" />
                                                        <MapPin className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                                                    </div>
                                                    <Label htmlFor="r2" className="cursor-pointer font-black text-xs md:text-sm text-white mt-1">郵寄</Label>
                                                    <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase truncate">{SHIPPING_FEE} 點數</p>
                                                </div>
                                                <div className={cn("flex flex-col gap-1.5 border p-3 md:p-4 rounded-xl md:rounded-2xl transition-all cursor-pointer relative", shippingMethod === '面交自取' ? 'bg-primary/10 border-primary/60 ring-1 ring-primary/60 text-white shadow-lg shadow-primary/10' : 'bg-slate-900/80 border-white/10 text-slate-300 hover:bg-slate-800')}
                                                     onClick={() => setShippingMethod('面交自取')}>
                                                    <div className="flex justify-between items-center">
                                                        <RadioGroupItem value="面交自取" id="r3" className="border-white/30 text-primary" />
                                                        <Users className="w-4 h-4 md:w-5 md:h-5 text-primary" />
                                                    </div>
                                                    <Label htmlFor="r3" className="cursor-pointer font-black text-xs md:text-sm text-white mt-1">自取</Label>
                                                    <p className="text-[10px] md:text-xs text-slate-400 font-bold uppercase truncate">免運費</p>
                                                </div>
                                            </RadioGroup>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                                        收件人姓名 <span className="text-rose-400">*</span>
                                                    </Label>
                                                    <Input 
                                                        value={shippingName} 
                                                        onChange={(e) => setShippingName(e.target.value)} 
                                                        className="h-11 bg-slate-900/90 rounded-xl text-white border-white/10 focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium text-sm px-3.5"
                                                        placeholder="例如：王小明"
                                                    />
                                                </div>
                                                <div className="space-y-1.5">
                                                    <Label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                                        聯絡電話 <span className="text-rose-400">*</span>
                                                    </Label>
                                                    <Input 
                                                        value={shippingPhone} 
                                                        onChange={(e) => setShippingPhone(e.target.value)} 
                                                        className="h-11 bg-slate-900/90 rounded-xl text-white border-white/10 focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium text-sm px-3.5"
                                                        placeholder="例如：0912345678"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-1.5">
                                                <Label className="text-xs font-bold text-slate-300 flex items-center gap-1">
                                                    {addressLabel} <span className="text-rose-400">*</span>
                                                </Label>
                                                {shippingMethod === '面交自取' ? (
                                                    <div className="p-4 bg-primary/10 rounded-xl border border-dashed border-primary/40 space-y-1">
                                                        <p className="text-sm font-bold text-primary flex items-center gap-2">
                                                            <MapPin className="w-4 h-4 flex-shrink-0" />
                                                            {PICKUP_ADDRESS}
                                                        </p>
                                                        <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                                            * 注意：面交自取需事先與客服人員聯繫完成預約。
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                                            <SearchCode className="w-4 h-4" />
                                                        </div>
                                                        <Input 
                                                            value={shippingAddress} 
                                                            onChange={(e) => setShippingAddress(e.target.value)} 
                                                            placeholder={shippingMethod === '7-11' ? "例如：長津門市 或 店號123456" : "例如：台北市信義區信義路五段7號"}
                                                            className="h-11 pl-10 bg-slate-900/90 rounded-xl text-white border-white/10 focus:border-primary focus:ring-1 focus:ring-primary transition-all font-medium text-sm"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-3.5 md:p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                                                <div className="p-2 bg-amber-500/20 rounded-lg flex-shrink-0 mt-0.5">
                                                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <p className="text-xs font-bold text-amber-400 uppercase tracking-wider">重要安全提醒</p>
                                                    <p className="text-xs font-medium text-amber-200/80 leading-relaxed">
                                                        包裹出貨均有錄影存證。收到包裹後請務必【全程開箱錄影】，否則退換貨將不受理。
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <AlertDialogFooter className="p-4 md:p-6 border-t border-white/10 bg-slate-900/90 flex-row justify-end gap-3 flex-shrink-0 relative z-10 m-0">
                                            <AlertDialogCancel className="h-11 rounded-xl font-bold bg-slate-800/80 border-white/10 text-slate-300 hover:bg-slate-700 hover:text-white px-5 text-sm m-0">取消</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleShipping} disabled={isProcessing} className="h-11 rounded-xl font-bold bg-primary text-slate-950 hover:bg-primary/90 shadow-lg shadow-primary/20 px-6 text-sm m-0">
                                                {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : '確認申請與支付'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>

                                </AlertDialog>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" className="flex-1 h-10 md:h-12 rounded-xl border-white/10 bg-slate-950/50 text-white hover:bg-white/5 font-bold transition-all active:scale-95 shadow-xl text-xs md:text-sm">
                                            <RefreshCw className="mr-1 h-4 w-4 text-primary" /> 快速轉點
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-[2rem] md:rounded-[3rem] bg-slate-950 border-white/5 shadow-3xl text-white p-4 md:p-12 overflow-hidden max-w-[90vw] md:max-w-xl">
                                        <div className="absolute top-0 right-0 p-6 md:p-12 opacity-5 pointer-events-none">
                                            <RefreshCw className="w-32 h-32 md:w-64 md:h-64 text-destructive" />
                                        </div>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-xl md:text-3xl font-black italic tracking-tighter text-white flex items-center gap-2 md:gap-4">
                                                ASSET RECOVERY
                                            </AlertDialogTitle>
                                            <AlertDialogDescription className="text-slate-400 font-medium text-sm md:text-lg mt-1 md:mt-2">
                                                將卡片資產轉換為數位代幣。此操作具有不可逆性。
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="space-y-4 md:space-y-8 my-4 md:my-8 relative z-10">
                                            <div className="bg-slate-900 border border-white/5 p-4 md:p-8 rounded-2xl md:rounded-[2.5rem] space-y-3 md:space-y-6 shadow-2xl">
                                                <div className="flex justify-between items-center border-b border-white/5 pb-3 md:pb-6">
                                                    <div className="space-y-0.5">
                                                        <p className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">獲得鑽石獲取</p>
                                                        <p className="text-[10px] md:text-xs text-slate-600 font-bold">💎 鑽石資產</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-code text-xl md:text-4xl font-black text-primary flex items-center gap-1.5 md:gap-3 drop-shadow-md">
                                                            +{conversionValues.diamonds.toLocaleString()} <Gem className="w-4 h-4 md:w-6 md:h-6"/>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div className="space-y-0.5">
                                                        <p className="text-[9px] md:text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">獲得紅利P點</p>
                                                        <p className="text-[10px] md:text-xs text-slate-600 font-bold">✨ 紅利資產</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-code text-xl md:text-4xl font-black text-accent flex items-center gap-1.5 md:gap-3 drop-shadow-md">
                                                            +{conversionValues.pPoints.toLocaleString()} <PPlusIcon className="w-4 h-4 md:w-6 md:h-6"/>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-3 md:p-6 rounded-2xl md:rounded-[2rem] bg-rose-500/5 border border-rose-500/20 flex items-start gap-2 md:gap-4">
                                                <div className="p-2 md:p-3 bg-rose-500/10 rounded-xl md:rounded-2xl">
                                                    <Info className="w-4 h-4 md:w-5 md:h-5 text-rose-500" />
                                                </div>
                                                <p className="text-[9px] md:text-[11px] font-bold text-rose-200/60 leading-relaxed">
                                                    警告：快速轉點完成後，所選的 {selectedCardIds.size} 張卡片將立即從您的收藏中永久移除並銷毀，相關權益將無法恢復。
                                                </p>
                                            </div>
                                        </div>
                                        <AlertDialogFooter className="gap-2 md:gap-4">
                                            <AlertDialogCancel className="h-10 md:h-16 rounded-xl md:rounded-[2rem] font-bold bg-white/5 border-white/5 text-white hover:bg-white/10 px-4 md:px-8 text-sm">放棄轉點</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleQuickSell} disabled={isProcessing} className="h-10 md:h-16 rounded-xl md:rounded-[2rem] font-black bg-rose-600 text-white hover:bg-rose-700 shadow-[0_0_30px_rgba(225,29,72,0.3)] px-6 md:px-12 border-none text-sm">
                                                確認資產變現
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        </div>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>

        {/* Filters & Sorting */}
        <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-3 relative z-10 px-2 lg:px-4 text-[10px] sm:text-[11px]">
          <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 text-slate-400 bg-slate-900/80 px-3 py-1.5 rounded-xl border border-white/10">
                  <LayoutGrid className="w-3.5 h-3.5 text-primary" />
                  <span className="font-bold tracking-wider text-slate-300">
                      持有總數：<span className="font-code font-black text-white">{mergedCards.length}</span> 張
                  </span>
              </div>

              {/* 隨機球員 普/特 卡 篩選與勾選按鈕 */}
              <Button
                variant={filterCategory === '抽賞' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterCategory(filterCategory === '抽賞' ? null : '抽賞')}
                className={cn(
                  "rounded-xl text-[11px] font-bold px-3 py-1.5 h-auto transition-all border shadow-sm",
                  filterCategory === '抽賞' 
                    ? "bg-amber-500 text-black border-amber-400 hover:bg-amber-400" 
                    : "bg-slate-900/80 text-amber-300 border-amber-500/30 hover:bg-amber-500/20"
                )}
              >
                <Sparkles className="mr-1.5 h-3.5 w-3.5 text-amber-400" />
                隨機球員 普/特 卡：<span className="font-code font-black ml-1">{randomPlayerCards.length}</span> 張
              </Button>

              {randomPlayerCards.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSelectRandomCards}
                  className="rounded-xl text-[11px] font-bold px-3 py-1.5 h-auto bg-amber-500/10 text-amber-300 border-amber-500/40 hover:bg-amber-500/20"
                >
                  <CheckSquare className="mr-1.5 h-3.5 w-3.5" />
                  {randomPlayerCards.every(c => selectedCardIds.has(c.id)) ? '取消勾選所有普特卡' : '勾選所有普特卡'}
                </Button>
              )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
              <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleSelectAll} disabled={mergedCards.length === 0} className="rounded-lg hover:bg-white/5 text-slate-300 font-bold text-[11px] px-2.5 h-8 border border-white/5">
                        <CheckSquare className="mr-1.5 h-3.5 w-3.5 text-primary" /> 
                        {isAllSelected ? '取消全選' : '全選卡片'}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isAllSelected ? '取消全選' : '勾選頁面上所有卡片'}
                  </TooltipContent>
              </Tooltip>
              <Separator orientation="vertical" className="h-4 bg-white/10 hidden sm:block" />
              <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="rounded-lg hover:bg-white/5 text-slate-300 font-bold text-[11px] px-2.5 h-8 border border-white/5">
                              <Filter className="mr-1.5 h-3.5 w-3.5 text-amber-400" /> 分類：{filterCategory || '全部分類'}
                          </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>按分類篩選卡片</TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="bg-slate-900 border-white/10 text-white min-w-[130px]">
                    <DropdownMenuItem onClick={() => setFilterCategory(null)}>全部分類</DropdownMenuItem>
                    {Array.from(new Set(mergedCards.map(c => c.category))).filter(Boolean).map(cat => (
                        <DropdownMenuItem key={cat} onClick={() => setFilterCategory(cat!)}>{cat}</DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <Tooltip>
                    <TooltipTrigger asChild>
                      <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="rounded-lg hover:bg-white/5 text-slate-300 font-bold text-[11px] px-2.5 h-8 border border-white/5">
                              <ArrowUpDown className="mr-1.5 h-3.5 w-3.5 text-sky-400" /> 排序：{
                                sortOption === 'price' ? '價值 (高到低)' :
                                sortOption === 'unsold' ? '在庫卡片優先' : '最新加入'
                              }
                          </Button>
                      </DropdownMenuTrigger>
                    </TooltipTrigger>
                    <TooltipContent>選擇卡片排序方式</TooltipContent>
                </Tooltip>
                <DropdownMenuContent className="bg-slate-900 border-white/10 text-white min-w-[140px]">
                    <DropdownMenuItem onClick={() => setSortOption('latest')}>最新加入</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('price')}>價值 (高到低)</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setSortOption('unsold')}>在庫卡片優先</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
          </div>
        </div>

      <div className="space-y-24 relative z-10 pt-12 pb-24">
        {standardCards.length > 0 && (
            <motion.section 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
            >
                <div className="flex items-center gap-6 mb-12">
                    <div className="relative group">
                        <div className="absolute -inset-2 bg-primary/20 blur-lg rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative p-3.5 rounded-2xl bg-slate-900 border border-white/5 shadow-2xl">
                            <Library className="text-primary w-6 h-6" />
                        </div>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-3xl md:text-4xl font-black italic text-white tracking-tighter">我的卡片</h2>
                        <div className="h-[2px] w-12 bg-primary mt-2"></div>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-3 md:gap-4">
                    {standardCards.map((card, index) => (
                        <motion.div 
                            key={card.id} 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + index * 0.02 }}
                            className={cn(
                                "group relative rounded-xl transition-all duration-300 cursor-pointer p-2 bg-slate-900/50 hover:bg-slate-800/50 border border-white/5",
                                selectedCardIds.has(card.id) ? "ring-2 ring-primary bg-primary/5" : ""
                            )}
                            onClick={() => setPreviewCard(card)}
                        >
                            <CardItem 
                                name={card.name} 
                                imageUrl={card.imageUrl} 
                                backImageUrl={card.backImageUrl}
                                imageHint={card.imageHint} 
                                isFlippable={false} 
                                rarity={card.rarity} 
                                priority={index < 12} 
                            />
                            
                            {/* Selection Overlay */}
                            <div 
                                className="absolute top-2 left-2 z-30" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectCard(card.id, !selectedCardIds.has(card.id));
                                }}
                            >
                                <div className={cn(
                                    "w-5 h-5 rounded-md border transition-all flex items-center justify-center",
                                    selectedCardIds.has(card.id) 
                                        ? "bg-primary border-primary text-black" 
                                        : "bg-black/40 border-white/20 hover:border-white/40"
                                )}>
                                    {selectedCardIds.has(card.id) && <CheckSquare className="w-3 h-3 stroke-[3]" />}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.section>
        )}

        {groupBreakCards.length > 0 && (
            <motion.section
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
            >
                <div className="flex items-center gap-6 mb-12">
                    <div className="relative group">
                        <div className="absolute -inset-2 bg-orange-500/20 blur-lg rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative p-3.5 rounded-2xl bg-slate-900 border border-white/5 shadow-2xl">
                            <Users2 className="text-orange-500 w-6 h-6" />
                        </div>
                    </div>
                    <div className="flex-1">
                        <h2 className="text-3xl md:text-4xl font-black italic text-orange-400 tracking-tighter">團拆精選</h2>
                        <div className="h-[2px] w-12 bg-orange-400 mt-2"></div>
                    </div>
                    <div className="h-[2px] flex-1 bg-gradient-to-r from-orange-500/20 to-transparent ml-4" />
                </div>

                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 md:gap-6">
                    {groupBreakCards.map((card, index) => (
                        <motion.div 
                            key={card.id} 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.2 + index * 0.02 }}
                            className={cn(
                                "group relative rounded-2xl transition-all duration-500 cursor-pointer",
                                selectedCardIds.has(card.id) ? "ring-2 ring-orange-500 ring-offset-4 ring-offset-slate-950 scale-[0.98]" : "hover:scale-[1.02]"
                            )}
                            onClick={() => setPreviewCard(card)}
                        >
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
                            
                            {/* <div className="absolute top-3 left-16 bg-slate-900/80 backdrop-blur-md text-[9px] font-black tracking-widest text-primary px-2 py-0.5 rounded-lg border border-primary/20 pointer-events-none z-20">
                                {card.sellPrice ? `${card.sellPrice}💎` : 'N/A'}
                            </div> */}

                            <div className="absolute top-3 right-3 z-30">
                                <Badge className="bg-orange-500 text-black text-[9px] px-2 py-0.5 font-bold italic tracking-tighter shadow-lg border-none animate-pulse">BREAK</Badge>
                            </div>

                            <div 
                                className="absolute top-3 left-3 z-30" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    handleSelectCard(card.id, !selectedCardIds.has(card.id));
                                }}
                            >
                                <div className={cn(
                                    "w-6 h-6 rounded-lg border-2 transition-all flex items-center justify-center backdrop-blur-md",
                                    selectedCardIds.has(card.id) 
                                        ? "bg-orange-500 border-orange-500 text-black shadow-[0_0_15px_rgba(249,115,22,0.5)]" 
                                        : "bg-black/40 border-white/20 hover:border-white/40"
                                )}>
                                    {selectedCardIds.has(card.id) && <CheckSquare className="w-4 h-4 stroke-[3]" />}
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </motion.section>
        )}

        {(isLoadingUserCards || isLoadingCards) && (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-6">
                {Array.from({length: 16}).map((_, i) => <div key={i} className="aspect-[2.5/4]"><Skeleton className="h-full w-full rounded-2xl bg-white/5" /></div>)}
            </div>
        )}

        {!isLoadingUserCards && !isLoadingCards && mergedCards.length === 0 && (
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-center py-40 bg-slate-900/20 backdrop-blur-sm rounded-[4rem] border border-white/5 relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                <div className="relative z-10 flex flex-col items-center">
                    <div className="p-12 rounded-full bg-slate-950 border border-white/5 shadow-inner mb-8 group">
                        <Library className="w-20 h-20 text-slate-700 group-hover:text-primary transition-colors duration-500" />
                    </div>
                    <h3 className="text-3xl font-black italic text-white tracking-widest mb-4">收藏庫為空</h3>
                    <p className="text-slate-500 font-medium max-w-sm mb-12">您目前的數位收藏庫尚無卡片。立即前往商城，開啟您的第一包珍稀收藏。</p>
                    <Button asChild size="lg" className="h-16 px-12 rounded-[2rem] font-black text-lg bg-primary text-black hover:bg-primary/90 shadow-[0_20px_40px_-10px_rgba(6,182,212,0.5)] transition-all active:scale-95 border-none">
                        <Link href="/draw">
                            START COLLECTION <ChevronRight className="ml-2 h-6 w-6" />
                        </Link>
                    </Button>
                </div>
            </motion.div>
        )}
      </div>

      {/* Showroom Preview Dialog */}
      <Dialog open={!!previewCard} onOpenChange={(open) => !open && setPreviewCard(null)}>
        <DialogContent className="max-w-[min(90vw,360px)] bg-slate-950/90 backdrop-blur-2xl border-white/15 shadow-2xl p-5 overflow-hidden flex flex-col items-center justify-center gap-4 rounded-3xl">
            <DialogTitle><VisuallyHiddenPrimitive.Root>Card Showroom</VisuallyHiddenPrimitive.Root></DialogTitle>
            {previewCard && (
                <div className="w-full flex flex-col items-center gap-4">
                    <div className="flex flex-col items-center text-center gap-1">
                        <Badge variant="outline" className="border-primary/40 text-primary bg-primary/10 px-3 py-0.5 font-bold tracking-wider uppercase text-[10px] rounded-full">
                            {previewCard.category ? previewCard.category.toUpperCase() : 'GENERAL ASSET'}
                            {previewCard.teamName ? ` | ${previewCard.teamName.toUpperCase()}` : ''}
                        </Badge>
                        <h2 className="text-base sm:text-lg font-black italic tracking-tight text-white uppercase drop-shadow-md max-w-[260px] truncate">{previewCard.name}</h2>
                    </div>

                    <div className="w-full max-w-[160px] sm:max-w-[190px] perspective-1000 my-1">
                        <motion.div 
                            initial={{ rotateX: 15, y: 10, opacity: 0 }}
                            animate={{ rotateX: 0, y: 0, opacity: 1 }}
                            className="relative group cursor-grab active:cursor-grabbing"
                        >
                            <div className="absolute -inset-4 bg-primary/20 blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
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

                    <div className="flex flex-col items-center gap-3 w-full pt-1">
                        <div className="flex items-center gap-1.5 bg-slate-900/90 border border-white/10 px-4 py-1.5 rounded-xl text-xs font-code font-black text-white shadow-md tracking-wider">
                            <Gem className="w-3.5 h-3.5 text-primary" />
                            {previewCard.sellPrice || 10}
                        </div>

                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                           <RotateCw className="w-3 h-3 text-primary animate-spin-slow" /> 點擊卡片可翻面觀看
                        </div>
                        <Button onClick={() => setIsReportOpen(true)} className="bg-primary text-black font-bold h-9 w-full rounded-xl text-xs hover:bg-primary/90 transition-all shadow-md">
                            生成鑑定報告
                        </Button>
                    </div>
                </div>
            )}
            
        </DialogContent>
      </Dialog>
      <CardReportDialog card={previewCard} open={isReportOpen} onOpenChange={setIsReportOpen} />
    </div>
  </div>
</TooltipProvider>
);
}
