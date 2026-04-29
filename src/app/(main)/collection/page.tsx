'use client';
import { useState, useMemo, useEffect } from 'react';
import { CardItem } from '@/components/card-item';
import { Button } from '@/components/ui/button';
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from '@/components/ui/checkbox';
import * as VisuallyHiddenPrimitive from "@radix-ui/react-visually-hidden";
import { Ship, RefreshCw, Gem, Loader2, CheckSquare, Square, Shield, LayoutGrid, Users, Users2, MapPin, SearchCode, X, Sparkles, ChevronRight, Package, Library, Hash, Info, AlertTriangle, RotateCcw, Filter, ArrowUpDown, RotateCw } from 'lucide-react';
import { useCollection, useUser, useFirestore, useMemoFirebase, useDoc } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, getDoc, increment, updateDoc } from 'firebase/firestore';
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
  
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>('7-11');
  const [shippingName, setShippingName] = useState('');
  const [shippingPhone, setShippingPhone] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');

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
          serialNumber: userCard.serialNumber || '0000'
        }
      }
      return null;
    }).filter((c): c is MergedCard => c !== null);
  }, [userCards, allCards]);

  const standardCards = useMemo(() => mergedCards.filter(c => c.source !== 'group-break'), [mergedCards]);
  const groupBreakCards = useMemo(() => mergedCards.filter(c => c.source === 'group-break'), [mergedCards]);

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
        const basePrice = card.sellPrice || 10;
        diamonds += basePrice * 0.7;
        pPoints += basePrice * 0.1 * 10; 
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

      for (const card of cardsToSell) {
        batch.delete(doc(firestore, 'users', user.uid, 'userCards', card.id));
        batch.update(doc(firestore, 'allCards', card.cardId), { 
            isSold: true,
            isRecycled: true 
        });
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
    <div className="min-h-screen bg-slate-950/20 text-white">
      <div className="container py-12 md:py-24 relative">
        {/* Futuristic Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[600px] bg-primary/10 blur-[120px] pointer-events-none opacity-50" />
        <div className="absolute top-[20%] right-[10%] w-64 h-64 bg-accent/20 blur-[100px] pointer-events-none opacity-30 animate-pulse" />
        <div className="absolute top-[40%] left-[5%] w-48 h-48 bg-primary/20 blur-[80px] pointer-events-none opacity-30" />
        
        {/* Header Section */}
        <div className="text-center mb-20 relative z-20">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/50 backdrop-blur-xl border border-white/10 text-primary text-[11px] font-black tracking-[0.4em] mb-6 uppercase shadow-2xl"
          >
            <Library className="w-3.5 h-3.5" /> Premium Digital Vault
          </motion.div>
          
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="font-headline text-5xl md:text-7xl font-black tracking-tighter text-white mb-4 italic"
          >
            我的<span className="text-transparent bg-clip-text bg-gradient-to-br from-white via-white to-white/30">數位收藏</span>
          </motion.h1>
          
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto text-slate-400 font-medium tracking-wide text-sm md:text-base leading-relaxed"
          >
            在這裡管理您的珍稀卡片與數位資產。所有收藏均已鏈上驗證，隨時可進行實體交付或快速轉點。
          </motion.p>
        </div>

        {/* Selection & Actions Bar - Fixed at bottom when active */}
        <AnimatePresence>
            {selectedCardIds.size > 0 && (
                <motion.div 
                    initial={{ y: 100, opacity: 0, x: '-50%' }}
                    animate={{ y: 0, opacity: 1, x: '-50%' }}
                    exit={{ y: 100, opacity: 0, x: '-50%' }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[95vw] max-w-5xl"
                >
                    <div className="bg-slate-900/80 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-4 md:p-6 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] flex flex-col md:flex-row items-center gap-6 justify-between">
                        <div className="flex items-center gap-5">
                            <div className="relative">
                                <div className="absolute inset-0 bg-primary/20 blur-md rounded-xl" />
                                <div className="relative bg-slate-950 p-4 rounded-xl border border-primary/30">
                                    <Package className="w-6 h-6 text-primary" />
                                </div>
                                <div className="absolute -top-2 -right-2 bg-primary text-black text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-lg">
                                    {selectedCardIds.size}
                                </div>
                            </div>
                            
                            <div className="space-y-1">
                                <p className="text-white font-black text-lg tracking-tight">已選擇卡片</p>
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 group cursor-help">
                                        <Gem className="w-3.5 h-3.5 text-primary" />
                                        <span className="text-sm font-code font-black text-white">{conversionValues.diamonds.toLocaleString()}</span>
                                    </div>
                                    <div className="flex items-center gap-2 group cursor-help">
                                        <PPlusIcon className="w-3.5 h-3.5 text-accent" />
                                        <span className="text-sm font-code font-black text-white">{conversionValues.pPoints.toLocaleString()}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={handleClearSelection}
                                className="h-12 rounded-2xl hover:bg-white/5 text-slate-400 font-bold px-6"
                            >
                                <RotateCcw className="mr-2 h-4 w-4" /> 清除所選
                            </Button>
                            
                            <div className="flex gap-2 flex-1 md:flex-none">
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button className="flex-1 md:flex-none h-14 px-8 rounded-2xl bg-white text-black hover:bg-slate-200 font-black transition-all active:scale-95 shadow-xl">
                                            <Ship className="mr-2 h-5 w-5" /> 批量出貨
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-[3rem] bg-slate-950 border-white/5 shadow-3xl text-white p-8 md:p-12 overflow-hidden max-w-2xl">
                                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                                            <Ship className="w-64 h-64 text-primary" />
                                        </div>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-3xl font-black italic tracking-tighter text-white flex items-center gap-4">
                                                DELIVERY REQUEST
                                                {hasFreeShipping && <Badge className="bg-emerald-500 text-black font-black border-none animate-pulse">FREE SHIP</Badge>}
                                            </AlertDialogTitle>
                                            <AlertDialogDescription className="text-slate-400 font-medium text-lg mt-2">
                                                請填寫您的收件資訊，我們將盡速為您安排配送。
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="space-y-8 my-8 relative z-10">
                                            <RadioGroup defaultValue="7-11" onValueChange={(value: ShippingMethod) => setShippingMethod(value)} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                <div className={cn("flex flex-col gap-2 border p-5 rounded-3xl transition-all cursor-pointer", shippingMethod === '7-11' ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/40' : 'bg-slate-900 border-white/5 hover:bg-slate-800')}>
                                                    <div className="flex justify-between items-center">
                                                        <RadioGroupItem value="7-11" id="r1" className="border-white/20 text-primary" />
                                                        <Package className="w-4 h-4 text-primary/40" />
                                                    </div>
                                                    <Label htmlFor="r1" className="cursor-pointer font-black text-sm text-white mt-2">7-11 門市</Label>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">{hasFreeShipping ? '運費 0' : `${SHIPPING_FEE} DIAMONDS`}</p>
                                                </div>
                                                <div className={cn("flex flex-col gap-2 border p-5 rounded-3xl transition-all cursor-pointer", shippingMethod === '郵寄' ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/40' : 'bg-slate-900 border-white/5 hover:bg-slate-800')}>
                                                    <div className="flex justify-between items-center">
                                                        <RadioGroupItem value="郵寄" id="r2" className="border-white/20 text-primary" />
                                                        <MapPin className="w-4 h-4 text-primary/40" />
                                                    </div>
                                                    <Label htmlFor="r2" className="cursor-pointer font-black text-sm text-white mt-2">實體郵寄</Label>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">{hasFreeShipping ? '運費 0' : `${SHIPPING_FEE} DIAMONDS`}</p>
                                                </div>
                                                <div className={cn("flex flex-col gap-2 border p-5 rounded-3xl transition-all cursor-pointer", shippingMethod === '面交自取' ? 'bg-primary/5 border-primary/40 ring-1 ring-primary/40' : 'bg-slate-900 border-white/5 hover:bg-slate-800')}>
                                                    <div className="flex justify-between items-center">
                                                        <RadioGroupItem value="面交自取" id="r3" className="border-white/20 text-primary" />
                                                        <Users className="w-4 h-4 text-primary/40" />
                                                    </div>
                                                    <Label htmlFor="r3" className="cursor-pointer font-black text-sm text-white mt-2">面交自取</Label>
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">NO FEE</p>
                                                </div>
                                            </RadioGroup>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <Label className="text-[11px] uppercase font-black text-slate-500 tracking-[0.2em] ml-1">Recipient Name</Label>
                                                    <Input 
                                                        value={shippingName} 
                                                        onChange={(e) => setShippingName(e.target.value)} 
                                                        className="h-14 bg-slate-900/50 backdrop-blur-md rounded-2xl text-white border-white/5 focus:border-primary/50 transition-all font-bold"
                                                        placeholder="收件人全名"
                                                    />
                                                </div>
                                                <div className="space-y-3">
                                                    <Label className="text-[11px] uppercase font-black text-slate-500 tracking-[0.2em] ml-1">Contact Phone</Label>
                                                    <Input 
                                                        value={shippingPhone} 
                                                        onChange={(e) => setShippingPhone(e.target.value)} 
                                                        className="h-14 bg-slate-900/50 backdrop-blur-md rounded-2xl text-white border-white/5 focus:border-primary/50 transition-all font-bold"
                                                        placeholder="聯絡電話"
                                                    />
                                                </div>
                                            </div>
                                            
                                            <div className="space-y-3">
                                                <Label className="text-[11px] uppercase font-black text-slate-500 tracking-[0.2em] ml-1">{addressLabel}</Label>
                                                {shippingMethod === '面交自取' ? (
                                                    <div className="p-6 bg-primary/5 rounded-[2rem] border border-dashed border-primary/30 space-y-3">
                                                        <p className="text-base font-black text-primary flex items-center gap-3">
                                                            <MapPin className="w-5 h-5" />
                                                            {PICKUP_ADDRESS}
                                                        </p>
                                                        <p className="text-xs text-slate-400 font-medium leading-relaxed italic">
                                                            * 注意：自取需事先完成預約。
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="relative">
                                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                                                            <SearchCode className="w-5 h-5" />
                                                        </div>
                                                        <Input 
                                                            value={shippingAddress} 
                                                            onChange={(e) => setShippingAddress(e.target.value)} 
                                                            placeholder={shippingMethod === '7-11' ? "請輸入 7-11 門市名稱或店號" : "請輸入詳細配送地址"}
                                                            className="h-16 pl-12 bg-slate-900/50 backdrop-blur-md rounded-2xl text-white border-white/5 focus:border-primary/50 transition-all font-bold"
                                                        />
                                                    </div>
                                                )}
                                            </div>

                                            <div className="p-6 rounded-[2rem] bg-amber-500/5 border border-amber-500/20 flex items-start gap-4">
                                                <div className="p-3 bg-amber-500/10 rounded-2xl">
                                                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                                                </div>
                                                <div className="space-y-1">
                                                    <p className="text-xs font-black text-amber-500 uppercase tracking-widest">重要安全提醒</p>
                                                    <p className="text-[11px] font-bold text-amber-200/60 leading-relaxed">
                                                        所有包裹出貨前皆會進行數位化存證。為保障您的權益，請務必【全程錄影開箱】，若無影片佐證，恕不受理任何瑕疵退換貨。
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                        <AlertDialogFooter className="gap-4">
                                            <AlertDialogCancel className="h-16 rounded-[2rem] font-bold bg-white/5 border-white/5 text-white hover:bg-white/10 px-8">取消操作</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleShipping} disabled={isProcessing} className="h-16 rounded-[2rem] font-black bg-primary text-black hover:bg-primary/90 shadow-2xl px-12">
                                                {isProcessing ? <Loader2 className="animate-spin" /> : '確認申請與支付'}
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" className="flex-1 md:flex-none h-14 px-8 rounded-2xl border-white/10 bg-slate-950/50 text-white hover:bg-white/5 font-bold transition-all active:scale-95 shadow-xl">
                                            <RefreshCw className="mr-2 h-5 w-5 text-primary" /> 快速轉點
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="rounded-[3rem] bg-slate-950 border-white/5 shadow-3xl text-white p-8 md:p-12 overflow-hidden max-w-xl">
                                        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
                                            <RefreshCw className="w-64 h-64 text-destructive" />
                                        </div>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle className="text-3xl font-black italic tracking-tighter text-white flex items-center gap-4">
                                                ASSET RECOVERY
                                            </AlertDialogTitle>
                                            <AlertDialogDescription className="text-slate-400 font-medium text-lg mt-2">
                                                將卡片資產轉換為數位代幣。此操作具有不可逆性。
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <div className="space-y-8 my-8 relative z-10">
                                            <div className="bg-slate-900 border border-white/5 p-8 rounded-[2.5rem] space-y-6 shadow-2xl">
                                                <div className="flex justify-between items-center border-b border-white/5 pb-6">
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">獲得鑽石獲取</p>
                                                        <p className="text-xs text-slate-600 font-bold">💎 鑽石資產</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-code text-4xl font-black text-primary flex items-center gap-3 drop-shadow-md">
                                                            +{conversionValues.diamonds.toLocaleString()} <Gem className="w-6 h-6"/>
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="flex justify-between items-center">
                                                    <div className="space-y-1">
                                                        <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest leading-none">獲得紅利P點</p>
                                                        <p className="text-xs text-slate-600 font-bold">✨ 紅利資產</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <span className="font-code text-4xl font-black text-accent flex items-center gap-3 drop-shadow-md">
                                                            +{conversionValues.pPoints.toLocaleString()} <PPlusIcon className="w-6 h-6"/>
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="p-6 rounded-[2rem] bg-rose-500/5 border border-rose-500/20 flex items-start gap-4">
                                                <div className="p-3 bg-rose-500/10 rounded-2xl">
                                                    <Info className="w-5 h-5 text-rose-500" />
                                                </div>
                                                <p className="text-[11px] font-bold text-rose-200/60 leading-relaxed">
                                                    警告：快速轉點完成後，所選的 {selectedCardIds.size} 張卡片將立即從您的收藏中永久移除並銷毀，相關權益將無法恢復。
                                                </p>
                                            </div>
                                        </div>
                                        <AlertDialogFooter className="gap-4">
                                            <AlertDialogCancel className="h-16 rounded-[2rem] font-bold bg-white/5 border-white/5 text-white hover:bg-white/10 px-8">放棄轉點</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleQuickSell} disabled={isProcessing} className="h-16 rounded-[2rem] font-black bg-rose-600 text-white hover:bg-rose-700 shadow-[0_0_30px_rgba(225,29,72,0.3)] px-12 border-none">
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

        {/* Filters & Sorting Placeholder (UI Only) */}
        <div className="flex flex-col md:flex-row justify-between items-end mb-10 gap-6 relative z-10 px-4">
          <div className="flex items-center gap-6">
              <div className="flex items-center gap-2 text-slate-400">
                  <LayoutGrid className="w-4 h-4" />
                  <span className="text-xs font-black uppercase tracking-widest">Total Assets: {mergedCards.length}</span>
              </div>
          </div>
          <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={handleSelectAll} disabled={mergedCards.length === 0} className="rounded-xl hover:bg-white/5 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                  <CheckSquare className="mr-2 h-4 w-4 text-primary" /> 
                  {isAllSelected ? 'Deselect All' : 'Select All'}
              </Button>
              <Separator orientation="vertical" className="h-4 bg-white/10" />
              <Button variant="ghost" size="sm" className="rounded-xl hover:bg-white/5 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                  <Filter className="mr-2 h-4 w-4" /> Filter
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl hover:bg-white/5 text-slate-400 font-black text-[10px] uppercase tracking-widest">
                  <ArrowUpDown className="mr-2 h-4 w-4" /> Sort
              </Button>
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
                            <LayoutGrid className="text-primary w-6 h-6" />
                        </div>
                    </div>
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black italic text-white tracking-tighter">STANDARD COLLECTION</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mt-1">一般收藏區域 • Verified Digital Assets</p>
                    </div>
                    <div className="h-[2px] flex-1 bg-gradient-to-r from-white/10 to-transparent ml-4" />
                </div>
                
                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-4 md:gap-6">
                    {standardCards.map((card, index) => (
                        <motion.div 
                            key={card.id} 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1 + index * 0.02 }}
                            className={cn(
                                "group relative rounded-2xl transition-all duration-500 cursor-pointer",
                                selectedCardIds.has(card.id) ? "ring-2 ring-primary ring-offset-4 ring-offset-slate-950 scale-[0.98]" : "hover:scale-[1.02]"
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
                            
                            {/* Selection Overlay */}
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
                                        ? "bg-primary border-primary text-black shadow-[0_0_15px_rgba(6,182,212,0.5)]" 
                                        : "bg-black/40 border-white/20 hover:border-white/40"
                                )}>
                                    {selectedCardIds.has(card.id) && <CheckSquare className="w-4 h-4 stroke-[3]" />}
                                </div>
                            </div>

                            {/* Hover info */}
                            <div className="absolute inset-x-0 bottom-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity z-20 pointer-events-none">
                                <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 p-2 rounded-xl text-center shadow-2xl">
                                    <p className="text-[10px] font-black text-white line-clamp-1 truncate">{card.name}</p>
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
                    <div>
                        <h2 className="text-2xl md:text-3xl font-black italic text-orange-400 tracking-tighter">EXCLUSIVE BREAKS</h2>
                        <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mt-1">團拆精選專區 • Team Break Rewards</p>
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
                    <h3 className="text-3xl font-black italic text-white tracking-widest mb-4">VAULT IS EMPTY</h3>
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
        <DialogContent className="max-w-[min(95vw,500px)] bg-slate-950/40 backdrop-blur-3xl border-white/10 shadow-none p-0 overflow-visible flex flex-col items-center justify-center gap-8 rounded-[3rem]">
            <DialogTitle><VisuallyHiddenPrimitive.Root>Card Showroom</VisuallyHiddenPrimitive.Root></DialogTitle>
            {previewCard && (
                <div className="w-full h-full p-8 md:p-12 flex flex-col items-center gap-10">
                    <div className="flex flex-col items-center text-center gap-3">
                        <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 px-4 py-1 font-black italic tracking-[0.2em] uppercase text-[10px] mb-2 rounded-full">
                            {previewCard.rarity} ASSET
                        </Badge>
                        <h2 className="text-2xl md:text-3xl font-black italic tracking-tighter text-white uppercase drop-shadow-2xl">{previewCard.name}</h2>
                    </div>

                    <div className="w-full max-w-[280px] perspective-1000">
                        <motion.div 
                            initial={{ rotateX: 20, y: 20, opacity: 0 }}
                            animate={{ rotateX: 0, y: 0, opacity: 1 }}
                            className="relative group cursor-grab active:cursor-grabbing"
                        >
                            <div className="absolute -inset-10 bg-primary/20 blur-[60px] opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
                            <CardItem 
                                name={previewCard.name} 
                                imageUrl={previewCard.imageUrl} 
                                backImageUrl={previewCard.backImageUrl}
                                imageHint={previewCard.imageHint} 
                                serialNumber={previewCard.serialNumber} 
                                rarity={previewCard.rarity} 
                                isFlippable={true}
                                priority={true}
                            />
                        </motion.div>
                    </div>

                    <div className="flex flex-col items-center gap-6 w-full">
                        <div className="flex items-center gap-3">
                             <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 px-5 py-2.5 rounded-2xl text-xs font-code font-black text-white shadow-xl tracking-widest uppercase">
                                <Hash className="w-3.5 h-3.5 text-primary" />
                                {previewCard.serialNumber}
                            </div>
                            <Separator orientation="vertical" className="h-6 bg-white/10" />
                            <div className="flex items-center gap-1.5 bg-slate-900 border border-white/10 px-5 py-2.5 rounded-2xl text-xs font-code font-black text-white shadow-xl tracking-widest uppercase">
                                <Gem className="w-3.5 h-3.5 text-primary" />
                                {previewCard.sellPrice || 10}
                            </div>
                        </div>

                        <div className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] flex items-center gap-2">
                           <RotateCw className="w-3 h-3 animate-spin-slow" /> Click to Flip Card
                        </div>
                    </div>
                </div>
            )}
            
            <Button 
                variant="ghost" 
                size="icon" 
                className="absolute -top-16 md:-top-20 right-0 md:-right-12 rounded-full bg-slate-900/80 backdrop-blur-md text-white border border-white/10 h-10 w-10 md:h-12 md:w-12 hover:bg-white/10 transition-all flex items-center justify-center p-0"
                onClick={() => setPreviewCard(null)}
            >
                <X className="h-6 w-6" />
            </Button>
        </DialogContent>
      </Dialog>
    </div>
  </div>
);
}
