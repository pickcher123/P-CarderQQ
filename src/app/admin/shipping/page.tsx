'use client';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, doc, updateDoc, writeBatch, serverTimestamp, increment, getDoc, setDoc } from '@/lib/audited-firestore';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useState, useEffect, useMemo } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, SearchCode, Eye, Image as ImageIcon, Loader2, MapPin, AlertTriangle, Copy, Check, Download, ExternalLink, Store, Settings, Sparkles } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useCardTemplatesByIds } from '@/lib/pool-cards-cache';
import { SafeImage } from '@/components/safe-image';
import { Card } from '@/components/ui/card';
import { buildSevenElevenBatchXlsx, type SevenElevenOrderRow } from '@/lib/seven-eleven-xlsx';

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'cancelled';

interface ShippedCard {
    cardId: string;
    rarity: string;
    isFoil: boolean;
    category: string;
}

interface ShippingOrder {
    id: string;
    userId: string;
    name: string;
    phone: string;
    email?: string;
    cardIds: ShippedCard[];
    cardCount: number;
    address: string;
    storeId?: string | null;
    storeName?: string | null;
    status: OrderStatus;
    shippingMethod: '7-11' | '郵寄' | '面交自取';
    createdAt: { seconds: number };
    trackingNumber?: string;
    redemptionItem?: string;
    fee?: number;
}

interface SevenElevenSenderConfig {
    senderName: string;
    senderPhone: string;
    senderEmail: string;
    defaultPackageValue: string;
    returnStoreName: string;
    returnStoreId: string;
}

const SENDER_CONFIG_STORAGE_KEY = 'pcarder_711_sender_config_v1';

const DEFAULT_SENDER_CONFIG: SevenElevenSenderConfig = {
    senderName: '',
    senderPhone: '',
    senderEmail: '',
    defaultPackageValue: '1000',
    returnStoreName: '',
    returnStoreId: '',
};

const SEVEN_ELEVEN_TRACKING_URL = 'https://eservice.7-11.com.tw/e-tracking/search.aspx';

function parse711Info(order: ShippingOrder): { storeId: string; storeName: string } {
    const rawAddr = order.address || '';
    const matchId = rawAddr.match(/\b(\d{6})\b/);
    const storeId = (order.storeId || matchId?.[1] || '').trim();
    const storeName = (
        order.storeName ||
        rawAddr
            .replace(/7-?11/gi, '')
            .replace(/\(?\s*店號[:：\s]*\d{6}\s*\)?/g, '')
            .replace(storeId, '')
            .trim()
    ).trim();
    return { storeId, storeName };
}

interface CardData {
    id: string;
    name: string;
    imageUrl: string;
    backImageUrl?: string;
}

const statusTabs = [
    { value: 'pending', label: '待處理' },
    { value: 'processing', label: '處理中' },
    { value: 'shipped', label: '已出貨' },
    { value: 'cancelled', label: '已取消' }
];

function OrderDetailsDialog({ order, cardMap, isOpen, onOpenChange }: { 
    order: ShippingOrder | null, 
    cardMap: Map<string, CardData>,
    isOpen: boolean,
    onOpenChange: (_open: boolean) => void 
}) {
    if (!order) return null;
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="light max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden bg-white rounded-2xl border-none shadow-2xl text-slate-900">
                <DialogHeader className="p-8 pb-6 border-b border-slate-100 bg-slate-50">
                    <DialogTitle className="flex items-center gap-2 text-xl font-bold">
                        <SearchCode className="text-slate-400 h-5 w-5" /> 揀貨詳情
                    </DialogTitle>
                    <DialogDescription className="font-mono text-[10px] font-bold text-slate-400">ID: {order.id}</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 p-8">
                    {order.redemptionItem ? (
                        <div className="flex flex-col items-center py-20 text-center space-y-4">
                            <Gift className="w-20 h-20 text-amber-500 opacity-20" />
                            <p className="text-xl font-black">{order.redemptionItem}</p>
                            <Badge variant="outline">紅利兌換獎品</Badge>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                            {order.cardIds?.map((c, i) => {
                                const cardInfo = cardMap.get(c.cardId);
                                return (
                                    <div key={i} className="space-y-2">
                                        <div className="relative aspect-[2.5/3.5] rounded-xl border border-slate-100 bg-slate-50 overflow-hidden shadow-sm">
                                            {cardInfo ? <SafeImage src={cardInfo.imageUrl} alt="c" fill className="object-cover" /> : <ImageIcon className="absolute inset-0 m-auto text-slate-200" />}
                                        </div>
                                        <p className="text-[10px] font-bold text-slate-900 truncate">{cardInfo?.name || '未知卡片'}</p>
                                        <Badge className="text-[8px] h-4 uppercase font-bold" variant="outline">{c.rarity}</Badge>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
                <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
                    <div className="flex items-center gap-2 text-sm font-bold text-slate-900"><MapPin className="h-4 w-4 text-slate-400"/> {order.address}</div>
                    <Button onClick={() => onOpenChange(false)} className="rounded-xl bg-slate-900 px-8 text-white">關閉</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

export default function ShippingAdminPage() {
  const firestore = useFirestore();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<OrderStatus>('pending');
  const [trackingNumbers, setTrackingNumbers] = useState<Record<string, string>>({});
  const [selectedOrder, setSelectedOrder] = useState<ShippingOrder | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  
  // 取消訂單確認視窗狀態
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<ShippingOrder | null>(null);
  const [isProcessingCancel, setIsProcessingCancel] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState<string | null>(null);

  // 7-11 寄件人預設資料設定
  const [senderConfig, setSenderConfig] = useState<SevenElevenSenderConfig>(DEFAULT_SENDER_CONFIG);
  const [isSenderConfigOpen, setIsSenderConfigOpen] = useState(false);
  const [isSavingSenderConfig, setIsSavingSenderConfig] = useState(false);
  const [isExportingCsv, setIsExportingCsv] = useState(false);
  const [resolvingOrderIds, setResolvingOrderIds] = useState<Set<string>>(new Set());
  const [isBatchResolving, setIsBatchResolving] = useState(false);

  // 載入 7-11 寄件人預設資料（先讀 localStorage，再同步 Firestore system/shipping711）
  useEffect(() => {
    try {
      const cached = localStorage.getItem(SENDER_CONFIG_STORAGE_KEY);
      if (cached) {
        setSenderConfig(prev => ({ ...prev, ...JSON.parse(cached) }));
      }
    } catch {}

    if (!firestore) return;
    getDoc(doc(firestore, 'system', 'shipping711'))
      .then((snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<SevenElevenSenderConfig>;
          const merged = { ...DEFAULT_SENDER_CONFIG, ...data };
          setSenderConfig(merged);
          try {
            localStorage.setItem(SENDER_CONFIG_STORAGE_KEY, JSON.stringify(merged));
          } catch {}
        }
      })
      .catch(() => {});
  }, [firestore]);

  const ordersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'shippingOrders') : null, [firestore]);
  const { data: allOrders, isLoading, forceRefetch } = useCollection<ShippingOrder>(ordersQuery);

  // 僅按需批次載入出貨單實際用到的卡片（取代整庫監聽 allCards，節省大量 Firestore Reads）
  const shippingCardIds = useMemo(() => {
    if (!allOrders) return [];
    const ids = new Set<string>();
    allOrders.forEach(order => {
      order.cardIds?.forEach(c => {
        if (c?.cardId) ids.add(c.cardId);
      });
    });
    return Array.from(ids);
  }, [allOrders]);

  const cardMap = useCardTemplatesByIds(firestore, shippingCardIds) as unknown as Map<string, CardData>;

  const filteredOrders = useMemo(() => {
    if (!allOrders) return [];
    return allOrders.filter(o => o.status === activeTab).sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [allOrders, activeTab]);

  const sevenElevenFilteredOrders = useMemo(() => {
    return filteredOrders.filter(o => o.shippingMethod === '7-11');
  }, [filteredOrders]);

  const missingStoreIdOrders = useMemo(() => {
    return sevenElevenFilteredOrders.filter(o => !parse711Info(o).storeId);
  }, [sevenElevenFilteredOrders]);

  const fetchBest711Store = async (rawQuery: string): Promise<{ storeId: string; storeName: string; address: string } | null> => {
    const q = rawQuery.trim();
    if (!q) return null;
    try {
      const res = await fetch(`/api/logistics/711-store?q=${encodeURIComponent(q)}`);
      if (!res.ok) return null;
      const data = await res.json();
      const stores: Array<{ storeId: string; storeName: string; rawName: string; address: string }> = data.stores || [];
      if (stores.length === 0) return null;
      const cleaned = q.replace(/7-?11|門市$|店$/gi, '').trim();
      const exact = stores.find(s => s.rawName === cleaned || s.storeId === cleaned);
      // 優先回傳精準相符，否則若只有 1 筆唯一候選也直接採用
      const picked = exact || (stores.length === 1 ? stores[0] : stores[0]);
      return picked ? { storeId: picked.storeId, storeName: picked.storeName, address: picked.address } : null;
    } catch {
      return null;
    }
  };

  const handleAutoResolveStoreId = async (order: ShippingOrder) => {
    if (!firestore) return;
    const { storeId, storeName } = parse711Info(order);
    const queryText = storeName || order.address || storeId;
    if (!queryText.trim()) {
      toast({ variant: 'destructive', title: '無法查詢', description: '此訂單沒有門市名稱可供查詢。' });
      return;
    }

    setResolvingOrderIds(prev => new Set(prev).add(order.id));
    try {
      const matched = await fetchBest711Store(queryText);
      if (!matched) {
        toast({ variant: 'destructive', title: '查無相符 7-11 門市', description: `找不到「${queryText}」的 6 碼店號，請人工確認。` });
        return;
      }

      const normalizedAddress = `7-11 ${matched.storeName} (店號 ${matched.storeId})`;
      await updateDoc(doc(firestore, 'shippingOrders', order.id), {
        storeId: matched.storeId,
        storeName: matched.storeName,
        address: normalizedAddress,
      });
      toast({
        title: '已自動補齊 7-11 店號',
        description: `${order.name} → ${matched.storeName}（店號 ${matched.storeId}）`,
      });
      if (forceRefetch) forceRefetch();
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: '更新失敗', description: '寫入店號時發生錯誤。' });
    } finally {
      setResolvingOrderIds(prev => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  const handleBatchResolveStoreIds = async () => {
    if (!firestore || missingStoreIdOrders.length === 0) return;
    setIsBatchResolving(true);
    let resolvedCount = 0;
    let failedCount = 0;

    try {
      await Promise.all(
        missingStoreIdOrders.map(async (order) => {
          const { storeName } = parse711Info(order);
          const queryText = storeName || order.address;
          const matched = await fetchBest711Store(queryText);
          if (matched) {
            await updateDoc(doc(firestore, 'shippingOrders', order.id), {
              storeId: matched.storeId,
              storeName: matched.storeName,
              address: `7-11 ${matched.storeName} (店號 ${matched.storeId})`,
            });
            resolvedCount += 1;
          } else {
            failedCount += 1;
          }
        })
      );

      toast({
        title: `批次補齊完成：成功 ${resolvedCount} 筆`,
        description: failedCount > 0 ? `另有 ${failedCount} 筆查無相符門市，請手動確認。` : '所有缺漏店號皆已自動補齊並儲存！',
      });
      if (forceRefetch) forceRefetch();
    } finally {
      setIsBatchResolving(false);
    }
  };

  const handleCopyOrderInfo = async (order: ShippingOrder) => {
    const { storeId, storeName } = parse711Info(order);
    const contentLabel = order.redemptionItem ? `紅利禮品：${order.redemptionItem}` : `球員卡 ${order.cardCount} 張`;
    const lines =
      order.shippingMethod === '7-11'
        ? [
            `收件人：${order.name}`,
            `手機：${order.phone}`,
            `7-11 店號：${storeId || '未填寫'}`,
            `7-11 門市：${storeName || order.address}`,
            `內容：${contentLabel}`,
            `訂單編號：${order.id}`,
          ]
        : [
            `收件人：${order.name}`,
            `手機：${order.phone}`,
            `寄送方式：${order.shippingMethod}`,
            `地址：${order.address}`,
            `內容：${contentLabel}`,
            `訂單編號：${order.id}`,
          ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedOrderId(order.id);
      toast({ title: '已複製寄件資訊', description: `${order.name}（${order.shippingMethod}）可直接貼上至交貨便／賣貨便。` });
      setTimeout(() => setCopiedOrderId(null), 2000);
    } catch {
      toast({ variant: 'destructive', title: '複製失敗', description: '瀏覽器未允許存取剪貼簿。' });
    }
  };

  const handleSaveSenderConfig = async (exportAfterSave = false) => {
    const cleanConfig: SevenElevenSenderConfig = {
      senderName: senderConfig.senderName.trim(),
      senderPhone: senderConfig.senderPhone.trim(),
      senderEmail: senderConfig.senderEmail.trim(),
      defaultPackageValue: senderConfig.defaultPackageValue.replace(/\D/g, '') || '1000',
      returnStoreName: senderConfig.returnStoreName.trim(),
      returnStoreId: senderConfig.returnStoreId.replace(/\D/g, '').slice(0, 6),
    };

    if (!cleanConfig.senderName || !cleanConfig.senderPhone || !cleanConfig.senderEmail) {
      toast({ variant: 'destructive', title: '寄件人必填欄位未完成', description: '請填寫寄件人姓名、電話與 Email。' });
      return;
    }
    if (cleanConfig.returnStoreName && cleanConfig.returnStoreId.length !== 6) {
      toast({ variant: 'destructive', title: '退貨門市店號必填', description: '若有填寫退貨門市名稱，請一併填入 6 碼退貨門市店號。' });
      return;
    }

    setIsSavingSenderConfig(true);
    setSenderConfig(cleanConfig);
    try {
      localStorage.setItem(SENDER_CONFIG_STORAGE_KEY, JSON.stringify(cleanConfig));
    } catch {}

    try {
      if (firestore) {
        await setDoc(doc(firestore, 'system', 'shipping711'), {
          ...cleanConfig,
          updatedAt: serverTimestamp(),
        }, { merge: true });
      }
      toast({ title: '7-11 寄件人設定已儲存', description: '之後匯出交貨便 Excel (.xlsx) 將自動帶入這組預設資料。' });
      setIsSenderConfigOpen(false);
      if (exportAfterSave && sevenElevenFilteredOrders.length > 0) {
        await handleExport711Excel(cleanConfig);
      }
    } catch (e) {
      console.error(e);
      toast({ title: '已暫存於本機瀏覽器', description: '雲端同步失敗，但本次匯出仍可正常使用。' });
      setIsSenderConfigOpen(false);
      if (exportAfterSave && sevenElevenFilteredOrders.length > 0) {
        await handleExport711Excel(cleanConfig);
      }
    } finally {
      setIsSavingSenderConfig(false);
    }
  };

  const handleExport711Excel = async (overrideConfig?: SevenElevenSenderConfig) => {
    if (sevenElevenFilteredOrders.length === 0) {
      toast({ variant: 'destructive', title: '無可匯出的 7-11 訂單', description: '目前分頁中沒有 7-11 寄送訂單。' });
      return;
    }

    const cfg = overrideConfig || senderConfig;
    if (!cfg.senderName.trim() || !cfg.senderPhone.trim() || !cfg.senderEmail.trim()) {
      setIsSenderConfigOpen(true);
      toast({
        title: '請先完成 7-11 寄件人預設設定',
        description: '7-11 官方範例檔規定需填入寄件人姓名、電話與 Email，設定一次後即可永久自動帶入。',
      });
      return;
    }

    setIsExportingCsv(true);
    try {
      // 補齊舊訂單缺少的取件人 Email（按 userId 去重查詢 users 文件）
      const emailByUserId = new Map<string, string>();
      if (firestore) {
        const missingEmailUserIds = Array.from(
          new Set(
            sevenElevenFilteredOrders
              .filter(o => !o.email && o.userId)
              .map(o => o.userId)
          )
        );
        await Promise.all(
          missingEmailUserIds.map(async (uid) => {
            try {
              const userSnap = await getDoc(doc(firestore, 'users', uid));
              if (userSnap.exists()) {
                const uEmail = (userSnap.data()?.email as string) || '';
                if (uEmail) emailByUserId.set(uid, uEmail);
              }
            } catch {}
          })
        );
      }

      // 匯出前自動補抓缺漏的 7-11 6 碼店號並順手回寫 Firestore，避免匯出空白店號
      const resolvedStoreMap = new Map<string, { storeId: string; storeName: string }>();
      let autoResolvedDuringExport = 0;
      await Promise.all(
        sevenElevenFilteredOrders.map(async (order) => {
          const parsed = parse711Info(order);
          if (!parsed.storeId && (parsed.storeName || order.address)) {
            const matched = await fetchBest711Store(parsed.storeName || order.address);
            if (matched) {
              resolvedStoreMap.set(order.id, { storeId: matched.storeId, storeName: matched.storeName });
              autoResolvedDuringExport += 1;
              if (firestore) {
                updateDoc(doc(firestore, 'shippingOrders', order.id), {
                  storeId: matched.storeId,
                  storeName: matched.storeName,
                  address: `7-11 ${matched.storeName} (店號 ${matched.storeId})`,
                }).catch(() => {});
              }
            }
          }
        })
      );

      let incompleteCount = 0;
      const rows: SevenElevenOrderRow[] = sevenElevenFilteredOrders.map(order => {
        const parsed = parse711Info(order);
        const resolved = resolvedStoreMap.get(order.id);
        const storeId = resolved?.storeId || parsed.storeId;
        const storeName = resolved?.storeName || parsed.storeName;
        const recipientEmail = (order.email || emailByUserId.get(order.userId) || '').trim();
        if (!storeId || !storeName || !recipientEmail) {
          incompleteCount += 1;
        }
        return {
          packageValue: cfg.defaultPackageValue || '1000',
          senderName: cfg.senderName.trim(),
          senderPhone: cfg.senderPhone.trim(),
          senderEmail: cfg.senderEmail.trim(),
          returnStoreName: cfg.returnStoreName.trim(),
          returnStoreId: cfg.returnStoreName.trim() ? cfg.returnStoreId.trim() : '',
          recipientName: (order.name || '').trim(),
          recipientPhone: (order.phone || '').trim(),
          recipientEmail,
          pickupStoreName: storeName,
          pickupStoreId: storeId,
        };
      });

      const xlsxBlob = await buildSevenElevenBatchXlsx(rows);
      const url = URL.createObjectURL(xlsxBlob);
      const a = document.createElement('a');
      const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.href = url;
      a.download = `711-c2c-batch-${activeTab}-${dateStamp}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (autoResolvedDuringExport > 0 && forceRefetch) {
        forceRefetch();
      }

      toast({
        title: `已匯出 ${sevenElevenFilteredOrders.length} 筆 7-11 交貨便 Excel (.xlsx)`,
        description: incompleteCount > 0
          ? `${autoResolvedDuringExport > 0 ? `已自動補齊 ${autoResolvedDuringExport} 筆店號。` : ''}注意：仍有 ${incompleteCount} 筆缺少門市店號、門市名稱或 Email，上傳前請檢查。`
          : `${autoResolvedDuringExport > 0 ? `已自動補齊 ${autoResolvedDuringExport} 筆缺漏店號並` : '已'}完整保留官方範例檔結構（代碼 2：常溫取貨不付款-一般材積），可直接上傳 7-11！`,
      });
    } catch (e) {
      console.error(e);
      toast({
        variant: 'destructive',
        title: '匯出 7-11 Excel 失敗',
        description: e instanceof Error ? e.message : '處理範例檔時發生錯誤。',
      });
    } finally {
      setIsExportingCsv(false);
    }
  };

  const handleTrack711 = (tracking: string) => {
    const trimmed = tracking.trim();
    if (!trimmed) return;
    navigator.clipboard?.writeText(trimmed).catch(() => {});
    toast({ title: '已複製物流單號並開啟 7-11 貨態查詢', description: `單號：${trimmed}` });
    window.open(SEVEN_ELEVEN_TRACKING_URL, '_blank', 'noopener,noreferrer');
  };

  useEffect(() => {
    if (allOrders) {
        const trks: Record<string, string> = {};
        allOrders.forEach(o => trks[o.id] = o.trackingNumber || '');
        setTrackingNumbers(prev => ({ ...prev, ...trks }));
    }
  }, [allOrders]);

  const handleStatusChange = async (order: ShippingOrder, newStatus: string) => {
    if (!firestore) return;
    
    // 如果是改為「已取消」，先開啟確認視窗
    if (newStatus === 'cancelled') {
        setOrderToCancel(order);
        setIsCancelConfirmOpen(true);
        return;
    }

    try {
        await updateDoc(doc(firestore, 'shippingOrders', order.id), { status: newStatus });
        toast({ title: '狀態已更新' });
    } catch (e) {
        toast({ variant: 'destructive', title: '更新失敗' });
    }
  };

  const confirmCancelOrder = async () => {
    if (!firestore || !orderToCancel) return;
    
    setIsProcessingCancel(true);
    try {
        const batch = writeBatch(firestore);
        
        // 1. 更新訂單狀態
        batch.update(doc(firestore, 'shippingOrders', orderToCancel.id), { status: 'cancelled' });
        
        // 2. 退還手續費 (如果有)
        if ((orderToCancel.fee || 0) > 0) {
            batch.update(doc(firestore, 'users', orderToCancel.userId), { 
                points: increment(orderToCancel.fee!) 
            });
            batch.set(doc(collection(firestore, 'transactions')), { 
                userId: orderToCancel.userId, 
                transactionType: 'Refund', 
                section: 'shipping', 
                currency: 'diamond', 
                amount: orderToCancel.fee, 
                details: `管理員取消運單 ${orderToCancel.id} 並退還手續費`, 
                transactionDate: serverTimestamp() 
            });
        }
        
        // 3. 退還卡片資產
        for (const cardInfo of orderToCancel.cardIds) {
            const newUserCardRef = doc(collection(firestore, 'users', orderToCancel.userId, 'userCards'));
            batch.set(newUserCardRef, { 
                cardId: cardInfo.cardId, 
                userId: orderToCancel.userId, 
                isFoil: cardInfo.isFoil, 
                rarity: cardInfo.rarity, 
                category: cardInfo.category,
                returnedFrom: orderToCancel.id,
                returnedAt: serverTimestamp()
            });
        }
        
        await batch.commit();
        toast({ title: '成功', description: '訂單已取消，資產已退還給會員。' });
        if (forceRefetch) forceRefetch();
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: '取消失敗', description: '處理資產退還時發生錯誤。' });
    } finally {
        setIsProcessingCancel(false);
        setIsCancelConfirmOpen(false);
        setOrderToCancel(null);
    }
  };

  return (
    <div className="space-y-8 text-slate-900">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-black tracking-tight">出貨中心</h1>
          <p className="text-xs font-medium text-slate-500">支援 7-11 交貨便官方範例檔 (.xlsx) 一鍵匯出、複製寄件資訊與快速查貨態</p>
        </div>
        <div className="flex items-center gap-2.5 flex-wrap">
          {missingStoreIdOrders.length > 0 && (
            <Button
              type="button"
              variant="outline"
              onClick={handleBatchResolveStoreIds}
              disabled={isBatchResolving}
              className="h-9 rounded-xl bg-amber-50 hover:bg-amber-100 border-amber-300 text-amber-800 font-bold text-xs gap-1.5 shadow-sm"
            >
              {isBatchResolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              <span className="tabular-nums">一鍵補齊缺漏店號 ({missingStoreIdOrders.length})</span>
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsSenderConfigOpen(true)}
            className="h-9 rounded-xl bg-white hover:bg-slate-50 border-slate-200 text-slate-700 font-bold text-xs gap-1.5 shadow-sm"
          >
            <Settings className="h-3.5 w-3.5" />
            <span>7-11 寄件人設定</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => handleExport711Excel()}
            disabled={sevenElevenFilteredOrders.length === 0 || isExportingCsv}
            className="h-9 rounded-xl bg-white hover:bg-emerald-50 border-emerald-200 text-emerald-700 font-bold text-xs gap-1.5 shadow-sm"
          >
            {isExportingCsv ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            <span className="tabular-nums">匯出 7-11 交貨便 Excel ({sevenElevenFilteredOrders.length})</span>
          </Button>
          <Badge variant="outline" className="bg-white border-slate-200 h-9 px-3 rounded-xl">實時同步：已啟動</Badge>
        </div>
      </div>

       <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as OrderStatus)} className="space-y-6">
            <TabsList className="bg-slate-100 p-1 rounded-xl h-12 w-fit">
                {statusTabs.map(tab => (
                     <TabsTrigger key={tab.value} value={tab.value} className="rounded-lg px-6 font-bold text-xs">{tab.label}</TabsTrigger>
                ))}
            </TabsList>
            
            <Card className="border-slate-200 shadow-sm rounded-2xl overflow-hidden bg-white">
                <ScrollArea className="w-full">
                    <Table className="min-w-[1000px]">
                        <TableHeader className="bg-slate-50"><TableRow><TableHead className="pl-8">收件人</TableHead><TableHead>內容</TableHead><TableHead>寄送方式 / 門市地址</TableHead><TableHead>物流單號</TableHead><TableHead className="text-right pr-8">狀態管理</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {isLoading ? Array.from({length: 5}).map((_, i) => <TableRow key={i}><TableCell colSpan={5} className="p-6"><Skeleton className="h-10 w-full rounded-xl"/></TableCell></TableRow>) : 
                            filteredOrders.map(order => {
                                const { storeId, storeName } = parse711Info(order);
                                const currentTracking = trackingNumbers[order.id] || '';
                                return (
                                <TableRow key={order.id} className="hover:bg-slate-50 transition-colors border-slate-100">
                                    <TableCell className="pl-8">
                                        <p className="font-bold text-slate-900">{order.name}</p>
                                        <p className="text-[10px] font-bold text-slate-400 font-mono tabular-nums">{order.phone}</p>
                                    </TableCell>
                                    <TableCell>
                                        <button onClick={() => { setSelectedOrder(order); setIsDetailsOpen(true); }} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
                                            {order.redemptionItem ? '紅利禮品' : `${order.cardCount} 張卡片`} <Eye className="h-3 w-3" />
                                        </button>
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[300px]">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0 space-y-1">
                                                <div className="flex items-center gap-1.5 flex-wrap">
                                                    <Badge
                                                        variant="outline"
                                                        className={
                                                            order.shippingMethod === '7-11'
                                                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-bold px-2 py-0'
                                                                : order.shippingMethod === '郵寄'
                                                                    ? 'bg-sky-50 text-sky-700 border-sky-200 text-[10px] font-bold px-2 py-0'
                                                                    : 'bg-slate-100 text-slate-600 border-slate-200 text-[10px] font-bold px-2 py-0'
                                                        }
                                                    >
                                                        {order.shippingMethod === '7-11' && <Store className="h-2.5 w-2.5 mr-1 inline" />}
                                                        {order.shippingMethod || '7-11'}
                                                    </Badge>
                                                    {order.shippingMethod === '7-11' && (
                                                        storeId ? (
                                                            <span className="font-mono tabular-nums text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                                                店號 {storeId}
                                                            </span>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAutoResolveStoreId(order)}
                                                                disabled={resolvingOrderIds.has(order.id)}
                                                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-800 transition-colors cursor-pointer disabled:opacity-60"
                                                                title="自動向 7-11 官方資料庫查詢此門市的 6 碼店號並儲存"
                                                            >
                                                                {resolvingOrderIds.has(order.id) ? (
                                                                    <Loader2 className="h-2.5 w-2.5 animate-spin" />
                                                                ) : (
                                                                    <Sparkles className="h-2.5 w-2.5" />
                                                                )}
                                                                <span>自動抓店號</span>
                                                            </button>
                                                        )
                                                    )}
                                                </div>
                                                <p className="text-slate-600 truncate" title={order.address}>
                                                    {order.shippingMethod === '7-11' && storeName ? storeName : order.address}
                                                </p>
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleCopyOrderInfo(order)}
                                                className="h-7 px-2 rounded-lg text-[11px] font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 shrink-0 gap-1"
                                                title="複製收件人與門市資訊"
                                            >
                                                {copiedOrderId === order.id ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                                                <span>{copiedOrderId === order.id ? '已複製' : '複製'}</span>
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5">
                                            <Input 
                                                value={currentTracking}
                                                onChange={(e) => setTrackingNumbers(prev => ({ ...prev, [order.id]: e.target.value }))}
                                                onBlur={() => updateDoc(doc(firestore!, 'shippingOrders', order.id), { trackingNumber: trackingNumbers[order.id] })}
                                                placeholder="輸入交貨便單號"
                                                className="h-9 w-36 bg-slate-50 border-slate-200 text-xs font-bold font-mono tabular-nums text-slate-900"
                                                disabled={order.status === 'cancelled'}
                                            />
                                            {order.shippingMethod === '7-11' && currentTracking.trim() && (
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleTrack711(currentTracking)}
                                                    className="h-9 px-2.5 rounded-lg border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 text-emerald-700 text-[11px] font-bold gap-1 shrink-0"
                                                    title="複製單號並開啟 7-11 官方貨態查詢頁"
                                                >
                                                    <span>查貨態</span>
                                                    <ExternalLink className="h-3 w-3" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <Select 
                                            defaultValue={order.status} 
                                            onValueChange={(v) => handleStatusChange(order, v)}
                                            disabled={order.status === 'cancelled'}
                                        >
                                            <SelectTrigger className="w-[110px] h-9 rounded-lg font-bold text-xs"><SelectValue /></SelectTrigger>
                                            <SelectContent className="rounded-xl light">
                                                {statusTabs.map(s => (
                                                    <SelectItem key={s.value} value={s.value} className="text-xs font-bold">
                                                        {s.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </TableCell>
                                </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </Card>
        </Tabs>
        
        <OrderDetailsDialog order={selectedOrder} cardMap={cardMap} isOpen={isDetailsOpen} onOpenChange={setIsDetailsOpen} />

        {/* 7-11 寄件人預設資料設定 Dialog */}
        <Dialog open={isSenderConfigOpen} onOpenChange={setIsSenderConfigOpen}>
            <DialogContent className="light max-w-lg bg-white rounded-2xl border-slate-200 shadow-2xl text-slate-900">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-lg font-black text-slate-900">
                        <Store className="h-5 w-5 text-emerald-600" /> 7-11 交貨便寄件人預設設定
                    </DialogTitle>
                    <DialogDescription className="text-xs text-slate-500">
                        匯出將直接套用 7-11 官方範例檔 (.xlsx)，完整保留第 1～7 列與鎖定保護，並從第 8 列自動填入服務代碼 <span className="font-bold text-emerald-700">2（常溫取貨不付款-一般材積）</span>。
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">寄件人姓名（證件姓名）*</Label>
                            <Input
                                value={senderConfig.senderName}
                                onChange={(e) => setSenderConfig(prev => ({ ...prev, senderName: e.target.value }))}
                                placeholder="例如：王小明"
                                className="h-9 bg-slate-50 border-slate-200 text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">寄件人電話 *</Label>
                            <Input
                                value={senderConfig.senderPhone}
                                onChange={(e) => setSenderConfig(prev => ({ ...prev, senderPhone: e.target.value }))}
                                placeholder="例如：0912345678"
                                className="h-9 bg-slate-50 border-slate-200 text-xs font-mono tabular-nums"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">寄件人 Email *</Label>
                            <Input
                                type="email"
                                value={senderConfig.senderEmail}
                                onChange={(e) => setSenderConfig(prev => ({ ...prev, senderEmail: e.target.value }))}
                                placeholder="例如：service@pcarder.com"
                                className="h-9 bg-slate-50 border-slate-200 text-xs"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-xs font-bold text-slate-700">預設實際包裹價值（元）*</Label>
                            <Input
                                inputMode="numeric"
                                value={senderConfig.defaultPackageValue}
                                onChange={(e) => setSenderConfig(prev => ({ ...prev, defaultPackageValue: e.target.value.replace(/\D/g, '') }))}
                                placeholder="例如：1000"
                                className="h-9 bg-slate-50 border-slate-200 text-xs font-mono tabular-nums"
                            />
                        </div>
                    </div>
                    <div className="pt-2 border-t border-slate-100 space-y-2">
                        <p className="text-[11px] font-bold text-slate-500">
                            退貨門市（非必填；未填寫則依原寄件門市為退貨門市，若有填名稱則店號必填）
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">退貨門市名稱</Label>
                                <Input
                                    value={senderConfig.returnStoreName}
                                    onChange={(e) => setSenderConfig(prev => ({ ...prev, returnStoreName: e.target.value }))}
                                    placeholder="例如：見晴門市"
                                    className="h-9 bg-slate-50 border-slate-200 text-xs"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-slate-700">退貨門市店號（6 碼）</Label>
                                <Input
                                    inputMode="numeric"
                                    maxLength={6}
                                    value={senderConfig.returnStoreId}
                                    onChange={(e) => setSenderConfig(prev => ({ ...prev, returnStoreId: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                    placeholder="例如：217477"
                                    className="h-9 bg-slate-50 border-slate-200 text-xs font-mono tabular-nums"
                                />
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                    <Button type="button" variant="ghost" onClick={() => setIsSenderConfigOpen(false)} className="rounded-xl text-xs font-bold">
                        取消
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isSavingSenderConfig}
                        onClick={() => handleSaveSenderConfig(false)}
                        className="rounded-xl text-xs font-bold"
                    >
                        {isSavingSenderConfig ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                        僅儲存設定
                    </Button>
                    {sevenElevenFilteredOrders.length > 0 && (
                        <Button
                            type="button"
                            disabled={isSavingSenderConfig}
                            onClick={() => handleSaveSenderConfig(true)}
                            className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold gap-1.5"
                        >
                            <Download className="h-3.5 w-3.5" />
                            儲存並匯出 Excel
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>

        <AlertDialog open={isCancelConfirmOpen} onOpenChange={setIsCancelConfirmOpen}>
            <AlertDialogContent className="light rounded-3xl border-none shadow-2xl bg-white text-slate-900">
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-xl font-black text-rose-600">
                        <AlertTriangle className="h-6 w-6" /> 確認取消訂單並退還資產？
                    </AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="font-bold text-slate-600 space-y-4">
                            <p>您即將把此訂單標記為「已取消」。這將會觸發以下自動程序：</p>
                            <ul className="list-disc pl-5 space-y-1 text-slate-900">
                                <li>退還該訂單所有卡片至會員收藏庫</li>
                                <li>退還該訂單扣除的手續費 (鑽石)</li>
                                <li><span className="text-rose-600 underline">注意：訂單一旦取消並退產，將無法再變更為其他狀態。</span></li>
                            </ul>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-3">
                    <AlertDialogCancel className="rounded-xl font-bold" disabled={isProcessingCancel}>暫不取消</AlertDialogCancel>
                    <AlertDialogAction 
                        onClick={confirmCancelOrder} 
                        className="rounded-xl bg-rose-600 text-white font-black hover:bg-rose-700 shadow-xl px-8"
                        disabled={isProcessingCancel}
                    >
                        {isProcessingCancel ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : null}
                        確認取消並執行退產
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    </div>
  );
}
