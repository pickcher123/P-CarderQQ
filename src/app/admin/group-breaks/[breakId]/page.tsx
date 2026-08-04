'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useFirestore, useMemoFirebase, useStorage } from '@/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { doc, updateDoc, collection, addDoc, getDoc, setDoc, query, where, serverTimestamp, writeBatch } from 'firebase/firestore';
// ... existing imports
import { v4 as uuidv4 } from 'uuid';
import { Skeleton } from '@/components/ui/skeleton';
// ... (rest of imports)

import { MLB_TEAMS, NBA_TEAMS, MLB_TEAMS_DETAILED, NBA_TEAMS_DETAILED, getTeamLogoUrl } from '@/lib/draw-constants';

// ...
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, ImageIcon, Loader2, Upload, Youtube, Trash2, PlusCircle, Copy, Trophy, Check, Sparkles, Gem, Package, ShieldCheck, Search, Filter, Archive, User, Dices, Flame, RotateCcw, Shuffle, CheckCircle2, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Switch } from '@/components/ui/switch';
import type { UserProfile } from '@/types/user-profile';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent as DialogContentNew, DialogHeader as DialogHeaderNew, DialogTitle as DialogTitleNew, DialogFooter as DialogFooterNew } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { PPlusIcon } from '@/components/icons';
import { cn } from '@/lib/utils';

type Spot = {
  spotNumber: number;
  userId?: string;
  userName?: string;
};

type Team = {
  teamId: string;
  name: string;
  price: number;
  userId?: string;
  userName?: string;
  logoUrl?: string;
}

interface Winnings {
    userId: string;
    username: string;
    teamId: string;
    teamName: string;
    cardId?: string;
    cardName?: string;
    cardImageUrl?: string;
}

interface GroupBreak {
  id: string;
  title: string;
  description: string;
  imageUrl: string;
  pricePerSpot?: number;
  totalSpots?: number;
  youtubeUrl?: string;
  breakType: 'spot' | 'team';
  currency?: 'diamond' | 'p-point';
  status: 'draft' | 'published' | 'completed';
  isAdult?: boolean;
  winnings?: Winnings[];
  spots?: Spot[];
  teams?: Team[];
}

interface CardData {
    id: string;
    name: string;
    category: string;
    imageUrl: string;
    rarity?: string;
    isSold?: boolean;
}

function DrawControl({ groupBreak, groupBreakRef, getBuyerName, forceRefetch }: { 
    groupBreak: GroupBreak, 
    groupBreakRef: any, 
    getBuyerName: (userId?: string, savedName?: string) => string | null,
    forceRefetch?: () => void
}) {
    const { toast } = useToast();
    const [isDrawDialogOpen, setIsDrawDialogOpen] = useState(false);
    const [drawMode, setDrawMode] = useState<'direct' | 'shuffle'>('direct');
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawProgress, setDrawProgress] = useState(0);
    const [rollingTeam, setRollingTeam] = useState<string>('');

    const isTeamBreak = groupBreak.breakType === 'team';
    const totalItems = isTeamBreak ? (groupBreak.teams?.length || 0) : (groupBreak.totalSpots || 0);
    
    const soldItemsCount = isTeamBreak 
        ? (groupBreak.teams?.filter(t => t.userId)?.length || 0) 
        : (groupBreak.spots?.filter(s => s.userId)?.length || 0);

    const isCompleted = groupBreak.status === 'completed';

    const handleExecuteDraw = async () => {
        if (!groupBreakRef) return;
        setIsDrawing(true);
        setDrawProgress(0);

        const sampleNames = isTeamBreak 
            ? (groupBreak.teams?.map(t => t.name) || []) 
            : Array.from({ length: totalItems }, (_, i) => `位置 #${i + 1}`);

        let progress = 0;
        const interval = setInterval(() => {
            progress += 4;
            if (progress >= 100) {
                clearInterval(interval);
                setDrawProgress(100);
                finalizeDraw();
            } else {
                setDrawProgress(progress);
                if (sampleNames.length > 0) {
                    const randomIdx = Math.floor(Math.random() * sampleNames.length);
                    setRollingTeam(sampleNames[randomIdx]);
                }
            }
        }, 70);
    };

    const finalizeDraw = async () => {
        try {
            let newWinnings: Winnings[] = [];

            if (isTeamBreak && groupBreak.teams) {
                if (drawMode === 'shuffle') {
                    const buyers = groupBreak.teams
                        .filter(t => t.userId)
                        .map(t => ({ userId: t.userId!, username: getBuyerName(t.userId, t.userName) || '藏友' }));
                    
                    const shuffledBuyers = [...buyers].sort(() => Math.random() - 0.5);

                    newWinnings = groupBreak.teams.map((t, idx) => {
                        const buyer = shuffledBuyers[idx % (shuffledBuyers.length || 1)];
                        return {
                            teamId: t.teamId,
                            teamName: t.name,
                            userId: buyer?.userId || t.userId || 'system',
                            username: buyer?.username || (t.userId ? (getBuyerName(t.userId, t.userName) || '藏友') : '流局 (未售出)'),
                        };
                    });
                } else {
                    newWinnings = groupBreak.teams.map(t => ({
                        teamId: t.teamId,
                        teamName: t.name,
                        userId: t.userId || 'system',
                        username: t.userId ? (getBuyerName(t.userId, t.userName) || '藏友') : '流局 (未售出)',
                    }));
                }
            } else if (!isTeamBreak && groupBreak.spots) {
                newWinnings = groupBreak.spots.map(s => ({
                    teamId: `spot-${s.spotNumber}`,
                    teamName: `位置 #${s.spotNumber}`,
                    userId: s.userId || 'system',
                    username: s.userId ? (getBuyerName(s.userId, s.userName) || '藏友') : '流局 (未售出)',
                }));
            }

            await updateDoc(groupBreakRef, {
                status: 'completed',
                winnings: newWinnings
            });

            toast({
                title: '🎉 隨機開獎配對完成！',
                description: `開獎結果已成功儲存並同步至前台直播頻道。`,
            });

            setIsDrawDialogOpen(false);
            setIsDrawing(false);
            if (forceRefetch) forceRefetch();
        } catch (error: any) {
            console.error('Error in draw completion:', error);
            toast({ variant: 'destructive', title: '開獎失敗', description: error.message });
            setIsDrawing(false);
        }
    };

    return (
        <Card className={cn("shadow-xl border-2 transition-all overflow-hidden my-6", isCompleted ? "border-emerald-500/30 bg-emerald-950/20" : "border-amber-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950")}>
            <CardHeader className="pb-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="space-y-1">
                        <CardTitle className="text-xl sm:text-2xl font-black italic tracking-tight flex items-center gap-2.5 text-white">
                            <Dices className="h-6 w-6 text-amber-400 animate-bounce" />
                            【開獎控制台】隨機搖號與配對中心
                        </CardTitle>
                        <CardDescription className="text-slate-300 font-medium text-xs">
                            {isCompleted ? '活動已完成隨機開獎配對，中獎結果已發佈至直播頻道。' : '當購買名額達標或隨時可點擊下方按鈕啟動隨機搖號配對模式。'}
                        </CardDescription>
                    </div>

                    <Button 
                        onClick={() => setIsDrawDialogOpen(true)}
                        size="lg"
                        className={cn(
                            "h-13 px-6 text-base sm:text-lg font-black rounded-2xl shadow-2xl transition-all border-b-4 active:translate-y-1 active:border-b-0 shrink-0",
                            isCompleted 
                                ? "bg-slate-800 text-amber-400 border-slate-950 hover:bg-slate-700" 
                                : "bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 border-amber-800 hover:brightness-110 shadow-amber-500/20"
                        )}
                    >
                        {isCompleted ? (
                            <>
                                <RotateCcw className="mr-2 h-5 w-5" /> 重新隨機開獎
                            </>
                        ) : (
                            <>
                                <Zap className="mr-2 h-5 w-5 fill-slate-950" /> 啟動隨機開獎儀式
                            </>
                        )}
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 bg-slate-950/60 rounded-2xl border border-white/10">
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-400">開獎狀態</p>
                        <Badge className={cn("font-extrabold text-xs px-2.5 py-0.5", isCompleted ? "bg-emerald-500 text-slate-950" : "bg-amber-500 text-slate-950")}>
                            {isCompleted ? '🎉 已開獎' : '⏳ 待開獎'}
                        </Badge>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-400">已出售名額</p>
                        <p className="font-code font-black text-white text-base">
                            {soldItemsCount} / {totalItems} <span className="text-xs text-amber-400">({totalItems ? Math.round((soldItemsCount / totalItems) * 100) : 0}%)</span>
                        </p>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-400">標的規模</p>
                        <p className="font-code font-black text-white text-base">{totalItems} {isTeamBreak ? '隊' : '位置'}</p>
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-[10px] font-black uppercase text-slate-400">團拆類型</p>
                        <p className="font-black text-primary text-sm">{isTeamBreak ? '隊伍拆卡 (Team Break)' : '選號拆卡 (Spot Break)'}</p>
                    </div>
                </div>

                {/* 啟動開獎彈窗對話框 - 稍微往下置中 (top-[56%] -translate-y-[44%]) */}
                <Dialog open={isDrawDialogOpen} onOpenChange={(open) => !isDrawing && setIsDrawDialogOpen(open)}>
                    <DialogContentNew className="fixed left-[50%] top-[56%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-44%] gap-5 border-4 border-slate-700 bg-slate-900 p-6 sm:p-8 shadow-[0_25px_70px_rgba(0,0,0,0.85)] rounded-[2.5rem] text-white">
                        <DialogHeaderNew>
                            <DialogTitleNew className="font-headline text-2xl sm:text-3xl font-black text-amber-400 flex items-center gap-3 italic tracking-tight">
                                <Sparkles className="h-7 w-7 text-amber-400 animate-spin shrink-0" />
                                啟動隨機開獎與配對儀式
                            </DialogTitleNew>
                        </DialogHeaderNew>

                        {isDrawing ? (
                            <div className="py-8 flex flex-col items-center justify-center space-y-6 text-center">
                                <div className="relative w-28 h-28 flex items-center justify-center bg-slate-950 rounded-full border-4 border-amber-500/50 shadow-[0_0_35px_rgba(245,158,11,0.5)]">
                                    <div className="absolute inset-0 rounded-full border-4 border-amber-400 border-t-transparent animate-spin" />
                                    <Dices className="w-12 h-12 text-amber-400 animate-bounce" />
                                </div>

                                <div className="space-y-2 max-w-xs">
                                    <p className="text-xl font-black font-headline tracking-widest text-white animate-pulse">
                                        {rollingTeam || '亂數洗牌中...'}
                                    </p>
                                    <p className="text-xs font-bold text-amber-400/80 uppercase tracking-widest">
                                        正在執行加密亂數洗牌配對 ({drawProgress}%)
                                    </p>
                                </div>

                                <Progress value={drawProgress} className="h-3 w-full bg-slate-800 rounded-full" />
                            </div>
                        ) : (
                            <div className="space-y-5">
                                <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
                                    <Label className="text-xs font-black uppercase tracking-widest text-slate-400">請選擇開獎配對模式</Label>
                                    <RadioGroup value={drawMode} onValueChange={(v: any) => setDrawMode(v)} className="space-y-3">
                                        <div className="flex items-start space-x-3 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-colors cursor-pointer">
                                            <RadioGroupItem value="direct" id="mode-direct" className="mt-1" />
                                            <Label htmlFor="mode-direct" className="cursor-pointer space-y-1">
                                                <div className="font-bold text-white text-sm flex items-center gap-2">
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-400" /> 原位直接揭曉 (Direct Match)
                                                </div>
                                                <p className="text-xs text-slate-400 font-medium">
                                                    以買家原先選擇之隊伍/號碼作為最終獲勝標的，即時發佈中獎結果。
                                                </p>
                                            </Label>
                                        </div>

                                        {isTeamBreak && (
                                            <div className="flex items-start space-x-3 p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-amber-500/50 transition-colors cursor-pointer">
                                                <RadioGroupItem value="shuffle" id="mode-shuffle" className="mt-1" />
                                                <Label htmlFor="mode-shuffle" className="cursor-pointer space-y-1">
                                                    <div className="font-bold text-white text-sm flex items-center gap-2">
                                                        <Shuffle className="w-4 h-4 text-amber-400" /> 盲盒二次隨機洗牌 (Random Shuffle)
                                                    </div>
                                                    <p className="text-xs text-slate-400 font-medium">
                                                        將所有參團玩家與隊伍進行二次加密亂數洗牌分配，增加極致隨機樂趣！
                                                    </p>
                                                </Label>
                                            </div>
                                        )}
                                    </RadioGroup>
                                </div>

                                <div className="p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20 text-xs text-amber-300 leading-relaxed font-bold">
                                    ⚠️ 開獎提醒：點擊確定後將執行開獎，結果將即時發佈至前台直播頻道與玩家個人中心。
                                </div>

                                <DialogFooterNew className="gap-3 sm:gap-4 mt-2">
                                    <Button variant="ghost" onClick={() => setIsDrawDialogOpen(false)} className="h-12 rounded-xl text-slate-400 font-bold hover:bg-slate-800 hover:text-white">
                                        取消返回
                                    </Button>
                                    <Button onClick={handleExecuteDraw} className="h-12 px-6 rounded-xl font-black bg-amber-500 text-slate-950 hover:bg-amber-400 shadow-xl text-base">
                                        <Zap className="mr-2 h-5 w-5 fill-slate-950" /> 確認啟動開獎
                                    </Button>
                                </DialogFooterNew>
                            </div>
                        )}
                    </DialogContentNew>
                </Dialog>
            </CardContent>
        </Card>
    );
}


function PrizeAssignment({ groupBreak, groupBreakRef }: { groupBreak: GroupBreak, groupBreakRef: any }) {
    const { toast } = useToast();
    const firestore = useFirestore();
    const storage = useStorage();

    const [isPrizeDialogOpen, setIsPrizeDialogOpen] = useState(false);
    const [prizeTarget, setPrizeTarget] = useState<{userId: string, username: string, teamId: string, teamName: string} | null>(null);
    const [assignMode, setAssignMode] = useState<'upload' | 'inventory'>('upload');
    
    // Upload mode state
    const [cardName, setCardName] = useState('');
    const [cardCategory, setCardCategory] = useState('其他');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Inventory mode state
    const [inventorySearch, setInventorySearch] = useState('');
    const { data: allCards, isLoading: isLoadingInventory } = useCollection<CardData>(useMemoFirebase(() => firestore ? query(collection(firestore, 'allCards')) : null, [firestore]));

    const filteredInventory = useMemo(() => {
        if (!allCards) return [];
        return allCards.filter(c => 
            c.name.toLowerCase().includes(inventorySearch.toLowerCase()) && 
            !c.isSold
        );
    }, [allCards, inventorySearch]);

    const handleOpenPrizeDialog = (winning: Winnings) => {
        setPrizeTarget({ userId: winning.userId, username: winning.username, teamId: winning.teamId, teamName: winning.teamName });
        setIsPrizeDialogOpen(true);
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        }
    };
    
    const handleAssignUploadedPrize = async () => {
        if (!firestore || !storage || !groupBreakRef || !groupBreak.winnings || !prizeTarget || !cardName || !selectedFile) return;

        setUploadProgress(0);
        try {
            const filePath = `P-Carder/cards/${uuidv4()}`;
            const fileRef = ref(storage, filePath);
            const uploadTask = uploadBytesResumable(fileRef, selectedFile);

            uploadTask.on('state_changed', 
                (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
                (error) => { toast({ variant: 'destructive', title: '上傳失敗' }); setUploadProgress(null); },
                async () => {
                    const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
                    const newCardData = { 
                        name: cardName, 
                        imageUrl: downloadURL, 
                        category: cardCategory, 
                        sellPrice: 0, 
                        source: 'group-break', 
                        isSold: true,
                        rarity: 'rare' // Default for uploaded
                    };
                    
                    const newCardRef = await addDoc(collection(firestore, 'allCards'), newCardData);
                    await processFinalAssignment(newCardRef.id, newCardData.name, newCardData.imageUrl, newCardData.category, newCardData.rarity);
                }
            );
        } catch (err) { setUploadProgress(null); }
    }

    const handleAssignInventoryPrize = async (card: CardData) => {
        if (!firestore || !groupBreakRef || !prizeTarget) return;
        await processFinalAssignment(card.id, card.name, card.imageUrl, card.category, card.rarity || 'rare');
    }

    const processFinalAssignment = async (cardId: string, name: string, imageUrl: string, category: string, rarity: string) => {
        if (!firestore || !groupBreakRef || !prizeTarget || !groupBreak.winnings) return;
        
        try {
            const batch = writeBatch(firestore);
            
            // 1. Mark original card as sold (if from inventory)
            batch.update(doc(firestore, 'allCards', cardId), { isSold: true, source: 'group-break' });

            // 2. Add to user collection
            const newUserCardRef = doc(collection(firestore, 'users', prizeTarget.userId, 'userCards'));
            batch.set(newUserCardRef, {
                cardId,
                userId: prizeTarget.userId,
                category,
                isFoil: false,
                rarity: rarity,
                source: 'group-break',
                breakTitle: groupBreak.title,
                teamName: prizeTarget.teamName,
            });

            // 3. Update group break results
            const updatedWinnings = groupBreak.winnings.map(w => 
                w.teamId === prizeTarget.teamId ? { ...w, cardId, cardName: name, cardImageUrl: imageUrl } : w
            );
            batch.update(groupBreakRef, { winnings: updatedWinnings });

            // 4. Create announcement if legendary
            if (rarity === 'legendary') {
                batch.set(doc(collection(firestore, 'announcements')), {
                    username: prizeTarget.username,
                    action: '在團拆中獲得了',
                    prize: name,
                    prizeImageUrl: imageUrl,
                    rarity: 'legendary',
                    timestamp: serverTimestamp(),
                    section: groupBreak.title
                });
            }

            await batch.commit();
            toast({ title: '派獎成功' });
            setIsPrizeDialogOpen(false);
        } catch (e) { toast({ variant: 'destructive', title: '處理失敗' }); }
    }

    if(groupBreak.status !== 'completed' || !groupBreak.winnings) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Trophy className="h-5 w-5 text-muted-foreground"/> 派獎管理</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground text-sm">團拆活動完成隨機配對後，即可在此處為每位中獎玩家派發實體卡片獎項。</p>
                </CardContent>
            </Card>
        );
    }
    
    return (
        <>
            <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-primary">
                        <Sparkles className="h-5 w-5" /> 派獎管理中心
                    </CardTitle>
                    <CardDescription>為每個隊伍的中獎者設定獎品。派發後，玩家收藏庫將即時出現該卡片。</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="border rounded-xl bg-card/50 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="pl-6">隊伍</TableHead>
                                    <TableHead>玩家</TableHead>
                                    <TableHead>獎品狀態</TableHead>
                                    <TableHead className="text-right pr-6">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {groupBreak.winnings.map(w => (
                                    <TableRow key={w.teamId} className="hover:bg-white/5 transition-colors">
                                        <TableCell className="font-bold pl-6">{w.teamName}</TableCell>
                                        <TableCell>{w.username}</TableCell>
                                        <TableCell>
                                            {w.cardId ? (
                                                <div className="flex items-center gap-2">
                                                    <div className="relative w-8 h-11 border border-white/10 rounded overflow-hidden">
                                                        <Image src={w.cardImageUrl!} alt={w.cardName!} fill className="object-cover" />
                                                    </div>
                                                    <span className="text-xs font-medium text-green-400 truncate max-w-[120px]">{w.cardName}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-muted-foreground italic flex items-center gap-1">
                                                    <Loader2 className="h-3 w-3 animate-spin"/> 待派發
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Button size="sm" variant={w.cardId ? "outline" : "default"} onClick={() => handleOpenPrizeDialog(w)}>
                                                {w.cardId ? '更換獎品' : '派發獎品'}
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <Dialog open={isPrizeDialogOpen} onOpenChange={setIsPrizeDialogOpen}>
              <DialogContentNew className="sm:max-w-2xl">
                  <DialogHeaderNew>
                      <DialogTitleNew className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-accent" /> 設定獎品 - {prizeTarget?.teamName}
                      </DialogTitleNew>
                  </DialogHeaderNew>
                  
                  <Tabs value={assignMode} onValueChange={(v: any) => setAssignMode(v)} className="py-4">
                      <TabsList className="grid w-full grid-cols-2 bg-muted h-12">
                          <TabsTrigger value="upload" className="font-bold"><Upload className="w-4 h-4 mr-2"/> 上傳新卡片</TabsTrigger>
                          <TabsTrigger value="inventory" className="font-bold"><Archive className="w-4 h-4 mr-2"/> 從庫存挑選</TabsTrigger>
                      </TabsList>

                      <TabsContent value="upload" className="space-y-6 pt-6">
                          <div className="space-y-2">
                              <Label>獎品名稱</Label>
                              <Input value={cardName} onChange={e => setCardName(e.target.value)} placeholder="輸入獎品完整名稱" />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>卡片分類</Label>
                                <Input value={cardCategory} onChange={e => setCardCategory(e.target.value)} placeholder="例如：籃球" />
                            </div>
                            <div className="space-y-2">
                                <Label>實體圖片</Label>
                                <Input type="file" accept="image/*" onChange={handleFileChange} />
                            </div>
                          </div>
                          {previewUrl && (
                              <div className="aspect-[2.5/3.5] relative w-32 mx-auto bg-muted rounded-xl border border-white/10 overflow-hidden">
                                  <Image src={previewUrl} alt="preview" fill className="object-cover" />
                              </div>
                          )}
                          {uploadProgress !== null && <Progress value={uploadProgress} className="h-1.5" />}
                          <Button className="w-full h-12 font-bold" onClick={handleAssignUploadedPrize} disabled={uploadProgress !== null || !cardName || !selectedFile}>
                              確認並上傳派獎
                          </Button>
                      </TabsContent>

                      <TabsContent value="inventory" className="space-y-4 pt-6">
                          <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                              <Input placeholder="搜尋庫存卡片..." className="pl-10" value={inventorySearch} onChange={e => setInventorySearch(e.target.value)} />
                          </div>
                          <ScrollArea className="h-80 border rounded-xl p-2 bg-black/5">
                              <div className="grid grid-cols-3 gap-3">
                                  {isLoadingInventory ? <Loader2 className="animate-spin mx-auto col-span-3 my-10"/> :
                                  filteredInventory.map(card => (
                                      <div key={card.id} className="flex flex-col gap-2 p-2 border rounded-lg hover:border-primary cursor-pointer transition-all group" onClick={() => handleAssignInventoryPrize(card)}>
                                          <div className="relative aspect-[2.5/3.5] rounded bg-muted overflow-hidden">
                                              <Image src={card.imageUrl} alt={card.name} fill className="object-cover group-hover:scale-110 transition-transform" />
                                          </div>
                                          <p className="text-[10px] font-bold truncate text-center">{card.name}</p>
                                      </div>
                                  ))}
                              </div>
                          </ScrollArea>
                      </TabsContent>
                  </Tabs>
              </DialogContentNew>
            </Dialog>
        </>
    );
}



export default function GroupBreakAdminDetailPage() {
  const { breakId } = useParams();
  const router = useRouter();
  const firestore = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const [details, setDetails] = useState<Partial<GroupBreak>>({});
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamPrice, setNewTeamPrice] = useState(0);

  const groupBreakRef = useMemoFirebase(() => {
    if (!firestore || !breakId) return null;
    return doc(firestore, 'groupBreaks', breakId as string);
  }, [firestore, breakId]);

  const { data: groupBreak, isLoading: isLoadingBreak, forceRefetch } = useDoc<GroupBreak>(groupBreakRef);

  const usersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'users'));
  }, [firestore]);
  const { data: allUsers } = useCollection<UserProfile>(usersQuery);

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    allUsers?.forEach(u => {
      if (u.id) map.set(u.id, u.username || u.displayName || '藏友');
    });
    return map;
  }, [allUsers]);

  const getBuyerName = (userId?: string, savedName?: string) => {
    if (!userId) return null;
    if (savedName) return savedName;
    if (userMap.has(userId)) return userMap.get(userId)!;
    return `藏友 ${userId.slice(0, 5)}`;
  };

  useEffect(() => {
    if (groupBreak) {
      setDetails({
        title: groupBreak.title,
        description: groupBreak.description,
        imageUrl: groupBreak.imageUrl,
        pricePerSpot: groupBreak.pricePerSpot,
        totalSpots: groupBreak.totalSpots,
        youtubeUrl: groupBreak.youtubeUrl,
        status: groupBreak.status,
        breakType: groupBreak.breakType,
        teams: groupBreak.teams,
        currency: groupBreak.currency || 'diamond',
        isAdult: groupBreak.isAdult,
      });
      setPreviewUrl(groupBreak.imageUrl);
    }
  }, [groupBreak]);

  const handleDetailChange = (field: keyof GroupBreak, value: any) => {
    setDetails(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveDetails = async (field: keyof GroupBreak) => {
    if (!groupBreakRef) return;
    try {
        await updateDoc(groupBreakRef, { [field]: details[field] || '' });
        toast({ title: '成功', description: `欄位 ${field} 已更新。` });
    } catch (error) {
        console.error(`Error updating ${field}:`, error);
        toast({ variant: 'destructive', title: '錯誤', description: `無法更新 ${field}。` });
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleImageUpload = async () => {
    if (!selectedFile || !groupBreakRef || !storage) return;
    setUploadProgress(0);
    const filePath = `P-Carder/group-breaks/${breakId}/${uuidv4()}`;
    const fileRef = ref(storage, filePath);
    const uploadTask = uploadBytesResumable(fileRef, selectedFile);

    uploadTask.on('state_changed',
      (snapshot) => setUploadProgress((snapshot.bytesTransferred / snapshot.totalBytes) * 100),
      (error) => {
        setUploadProgress(null);
        toast({ variant: 'destructive', title: '上傳失敗', description: error.message });
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        await updateDoc(groupBreakRef, { imageUrl: downloadURL });
        setUploadProgress(null);
        setSelectedFile(null);
        toast({ title: '成功', description: '活動主圖已更新。' });
      }
    );
  };
  
  const handleResetParticipants = async () => {
    if (!groupBreakRef || !groupBreak) return;
    
    let updateData = {};
    if (groupBreak.breakType === 'team') {
        const resetTeams = (groupBreak.teams || []).map(({userId, ...rest}) => rest);
        updateData = { teams: resetTeams };
    } else {
        const newSpots = Array.from({ length: groupBreak.totalSpots || 0 }, (_, i) => ({ spotNumber: i + 1 }));
        updateData = { spots: newSpots };
    }
    
    try {
        await updateDoc(groupBreakRef, updateData);
        toast({ title: '成功', description: '所有參與者紀錄已清除。' });
        if(forceRefetch) forceRefetch();
    } catch(e) {
        console.error("Error resetting participants", e);
        toast({ variant: 'destructive', title: '錯誤', description: '重設失敗。'})
    }
  }

  const handleAddTeam = async () => {
    if (!newTeamName.trim() || newTeamPrice <= 0 || !groupBreakRef || !groupBreak) {
        toast({variant: 'destructive', title: '錯誤', description: '請輸入有效的隊伍名稱和價格。'});
        return;
    }
    const autoLogo = getTeamLogoUrl(newTeamName.trim());
    const newTeam: Team = {
        teamId: uuidv4(),
        name: newTeamName.trim(),
        price: newTeamPrice,
        ...(autoLogo ? { logoUrl: autoLogo } : {})
    };
    const updatedTeams = [...(groupBreak.teams || []), newTeam];
    try {
        await updateDoc(groupBreakRef, { teams: updatedTeams });
        setNewTeamName('');
        setNewTeamPrice(0);
        toast({ title: '成功', description: '隊伍已新增。'});
    } catch (e) {
        console.error("Error adding team", e);
        toast({ variant: 'destructive', title: '錯誤', description: '新增隊伍失敗。'})
    }
  }

  const handleBulkAddTeams = async (league: 'NBA' | 'MLB') => {
      if (!groupBreakRef || !groupBreak) return;
      const teamList = league === 'NBA' ? NBA_TEAMS_DETAILED : MLB_TEAMS_DETAILED;
      const currentTeams = groupBreak.teams || [];
      const existingNames = new Set(currentTeams.map(t => t.name));
      
      const teamsToAdd = teamList.filter(t => !existingNames.has(t.name));
      
      if (teamsToAdd.length === 0) {
          toast({ 
              title: '提示', 
              description: `目前活動已包含所有 ${league} 的 ${teamList.length} 支隊伍。` 
          });
          return;
      }

      const defaultPrice = newTeamPrice > 0 ? newTeamPrice : 100;
      const newTeams = teamsToAdd.map(t => ({
          teamId: uuidv4(),
          name: t.name,
          logoUrl: t.logoUrl,
          price: defaultPrice,
      }));

      const updatedTeams = [...currentTeams, ...newTeams];
      try {
          await updateDoc(groupBreakRef, { teams: updatedTeams });
          toast({ 
              title: '🎉 一鍵新增成功！', 
              description: `已新增 ${teamsToAdd.length} 支 ${league} 隊伍與球隊 LOGO（單價：${defaultPrice} ${details.currency === 'p-point' ? 'P點' : '鑽石'}）。`
          });
      } catch (e) {
          console.error("Error adding bulk teams", e);
          toast({ variant: 'destructive', title: '錯誤', description: '新增隊伍失敗。' });
      }
  };

  const handleClearAllTeams = async () => {
      if (!groupBreakRef) return;
      try {
          await updateDoc(groupBreakRef, { teams: [] });
          toast({ title: '已清空隊伍', description: '隊伍選項已成功重設。' });
      } catch (e) {
          console.error("Error clearing teams", e);
          toast({ variant: 'destructive', title: '錯誤', description: '清空隊伍失敗。' });
      }
  };

  const handleRemoveTeam = async (teamId: string) => {
    if (!groupBreakRef || !groupBreak?.teams) return;
    const updatedTeams = groupBreak.teams.filter(t => t.teamId !== teamId);
    try {
        await updateDoc(groupBreakRef, { teams: updatedTeams });
        toast({ title: '成功', description: '隊伍已移除。'});
    } catch (e) {
        console.error("Error removing team", e);
        toast({ variant: 'destructive', title: '錯誤', description: '移除隊伍失敗。'})
    }
  }

  const handleUpdateTeamPrice = async (teamId: string, price: number) => {
     if (!groupBreakRef || !groupBreak?.teams || isNaN(price) || price < 0) {
        toast({variant: 'destructive', title: '錯誤', description: '請輸入有效的價格。'});
        return;
    }
    const updatedTeams = groupBreak.teams.map(t => t.teamId === teamId ? {...t, price} : t);
    try {
        await updateDoc(groupBreakRef, { teams: updatedTeams });
        toast({ title: '成功', description: '隊伍價格已更新。'});
    } catch(e) {
        console.error(e);
        toast({variant: 'destructive', title: '錯誤', description: '更新價格失敗。'})
    }
  }

  const handleDuplicate = async () => {
    if (!firestore || !groupBreak) {
        toast({
            variant: "destructive",
            title: "錯誤",
            description: "無法載入原始活動資料以進行複製。",
        });
        return;
    }

    const { id, ...breakToCopy } = groupBreak;
    const newBreakData: any = { ...breakToCopy };

    newBreakData.title = `(複製) ${groupBreak.title}`;
    newBreakData.status = 'draft' as const;
    newBreakData.createdAt = serverTimestamp();
    delete newBreakData.winnings;

    if (newBreakData.breakType === 'spot' && newBreakData.spots) {
        newBreakData.spots = newBreakData.spots.map((spot: Spot) => ({ spotNumber: spot.spotNumber }));
    } else if (newBreakData.breakType === 'team' && newBreakData.teams) {
        newBreakData.teams = newBreakData.teams.map((team: Team) => {
            const { userId, ...rest } = team;
            return rest;
        });
    }

    try {
        const docRef = await addDoc(collection(firestore, 'groupBreaks'), newBreakData);
        toast({
            title: "複製成功",
            description: `已建立新的團拆活動，正在前往編輯頁面...`,
        });
        router.push(`/admin/group-breaks/${docRef.id}`);
    } catch (error) {
        console.error("Error duplicating group break:", error);
        toast({
            variant: "destructive",
            title: "複製失敗",
            description: "建立副本時發生錯誤。",
        });
    }
  };


  if (isLoadingBreak || !groupBreak) {
    return <div className="container p-8"><Skeleton className="h-[500px] w-full" /></div>;
  }

  const isTeamBreak = details.breakType === 'team';
  const currency = details.currency || 'diamond';
  
  return (
    <div className="container p-6 md:p-8 space-y-8">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <Button variant="ghost" onClick={() => router.push('/admin/group-breaks')} className="-ml-4">
            <ArrowLeft className="mr-2 h-4 w-4" /> 返回清單
        </Button>
        <div className="flex items-center gap-2">
            <Badge variant={groupBreak.status === 'completed' ? 'secondary' : 'default'} className="uppercase tracking-widest font-black h-7">
                {groupBreak.status}
            </Badge>
            <Badge variant="outline" className="font-code h-7 border-white/10">ID: {groupBreak.id.substring(0, 8)}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div className="lg:col-span-2 space-y-6">
          <Card className="shadow-lg border-white/5 bg-card/40">
            <CardHeader>
               <div className="flex justify-between items-center">
                 <CardTitle className="text-xl">團拆詳情設定</CardTitle>
                 <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                            <Copy className="mr-2 h-4 w-4" /> 複製副本
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>確定要複製此團拆活動嗎？</AlertDialogTitle>
                            <AlertDialogDescription>
                                將會建立一個新的草稿活動，包含「{groupBreak.title}」的所有設定（隊伍、價格等），但會清空所有參與者與開獎紀錄。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDuplicate}>確認複製</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              </div>
              <CardDescription>編輯活動的展示資訊與直播位址。</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">活動標題</Label>
                <Input id="title" value={details.title || ''} onChange={(e) => handleDetailChange('title', e.target.value)} onBlur={() => handleSaveDetails('title')} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">活動簡介</Label>
                <Textarea id="description" value={details.description || ''} onChange={(e) => handleDetailChange('description', e.target.value)} onBlur={() => handleSaveDetails('description')} className="min-h-[100px]" />
              </div>

              <div className="space-y-3 p-4 bg-muted/20 border rounded-lg">
                <Label className="flex items-center gap-2 font-bold"><Gem className="h-4 w-4 text-primary"/> 支付幣別設定</Label>
                <RadioGroup 
                    value={currency} 
                    onValueChange={(val) => {
                        handleDetailChange('currency', val);
                        handleSaveDetails('currency');
                    }}
                    className="flex gap-6 pt-2"
                >
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="diamond" id="cur-dia" />
                        <Label htmlFor="cur-dia" className="cursor-pointer">鑽石 (Diamonds)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                        <RadioGroupItem value="p-point" id="cur-p" />
                        <Label htmlFor="cur-p" className="cursor-pointer text-accent flex items-center gap-1"><PPlusIcon className="h-3 w-3"/> 紅利 P 點</Label>
                    </div>
                </RadioGroup>
              </div>
              
              {!isTeamBreak && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="price" className="flex items-center gap-2">
                        {currency === 'diamond' ? <Gem className="h-3 w-3 text-primary"/> : <PPlusIcon className="h-3 w-3 text-accent"/>}
                        每位置價格
                    </Label>
                    <Input id="price" type="number" value={details.pricePerSpot || 0} onChange={(e) => handleDetailChange('pricePerSpot', Number(e.target.value))} onBlur={() => handleSaveDetails('pricePerSpot')} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="spots" className="flex items-center gap-2"><Package className="h-3 w-3 text-primary"/> 總名額</Label>
                    <Input id="spots" type="number" value={details.totalSpots || 0} readOnly className="bg-muted/30" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="youtubeUrl" className="flex items-center gap-2"><Youtube className="h-4 w-4 text-destructive"/> YouTube 直播 ID 或 完整連結</Label>
                <Input id="youtubeUrl" value={details.youtubeUrl || ''} onChange={(e) => handleDetailChange('youtubeUrl', e.target.value)} onBlur={() => handleSaveDetails('youtubeUrl')} placeholder="例如：dQw4w9WgXcQ" />
              </div>
               <div className="flex items-center justify-between p-4 bg-muted/20 border rounded-lg">
                <div className="space-y-0.5">
                    <Label htmlFor="status" className="font-bold">公開上架狀態</Label>
                    <p className="text-xs text-muted-foreground">開啟後玩家即可在前台看到並購買此活動</p>
                </div>
                <Switch id="status" checked={details.status === 'published'} onCheckedChange={(checked) => {
                    const newStatus = checked ? 'published' : 'draft';
                    handleDetailChange('status', newStatus);
                    handleSaveDetails('status');
                }} disabled={groupBreak.status === 'completed'} />
              </div>
              <div className="flex items-center justify-between p-4 bg-rose-50 border rounded-lg">
                <div className="space-y-0.5">
                    <Label htmlFor="isAdult" className="font-bold text-rose-900">限制級內容 (18+)</Label>
                    <p className="text-xs text-rose-600/70">開啟後玩家購買前需進行年齡驗證</p>
                </div>
                <Switch id="isAdult" checked={!!details.isAdult} onCheckedChange={(checked) => {
                    handleDetailChange('isAdult', checked);
                    handleSaveDetails('isAdult');
                }} />
              </div>
            </CardContent>
          </Card>
          
           {isTeamBreak && (
             <Card className="shadow-lg border-white/5 bg-card/40">
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
                      <div>
                        <CardTitle className="text-xl flex items-center gap-2">
                          隊伍與價格矩陣
                          <Badge variant="secondary" className="font-mono text-xs">
                            {details.teams?.length || 0} 隊
                          </Badge>
                        </CardTitle>
                        <CardDescription>手動定義每個隊伍的價格，或點擊上方「一鍵新增隊伍」自動導入聯盟。</CardDescription>
                      </div>

                      {/* 一鍵增加隊伍 按鈕區 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button 
                          type="button" 
                          onClick={() => handleBulkAddTeams('NBA')} 
                          className="font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                        >
                          🏀 一鍵新增 NBA (30隊)
                        </Button>
                        <Button 
                          type="button" 
                          onClick={() => handleBulkAddTeams('MLB')} 
                          className="font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-sm"
                        >
                          ⚾ 一鍵新增 MLB (30隊)
                        </Button>
                        {details.teams && details.teams.length > 0 && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button type="button" variant="outline" size="sm" className="text-rose-400 border-rose-500/30 hover:bg-rose-500/10">
                                <Trash2 className="w-4 h-4 mr-1" /> 清空
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>確定要清空所有隊伍嗎？</AlertDialogTitle>
                                <AlertDialogDescription>
                                  此操作將清除目前設定的 {details.teams.length} 支隊伍，無法復原。
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>取消</AlertDialogCancel>
                                <AlertDialogAction onClick={handleClearAllTeams} className="bg-rose-600 hover:bg-rose-700">確定清空</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex gap-2 p-4 bg-muted/20 rounded-lg border border-dashed border-white/10 flex-wrap items-end">
                        <div className="flex-1 space-y-1 min-w-[200px]">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">手動新增單隊名稱</Label>
                            <Input placeholder="例如：洛杉磯道奇" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
                        </div>
                        <div className="w-32 space-y-1">
                            <Label className="text-[10px] uppercase font-bold text-muted-foreground">單隊價格 ({currency === 'diamond' ? '鑽石' : 'P點'})</Label>
                            <Input type="number" placeholder="100" value={newTeamPrice || ''} onChange={(e) => setNewTeamPrice(Number(e.target.value))} />
                        </div>
                        <Button onClick={handleAddTeam} className="font-bold"><PlusCircle className="mr-2 h-4 w-4"/>新增單隊</Button>
                    </div>
                    <p className="text-xs text-muted-foreground italic -mt-4">
                      💡 提示：點擊「一鍵新增 NBA / MLB」時，若「單隊價格」有填寫數字，會以此價格作為所有新新增隊伍的初始金額（預設為 100）。
                    </p>
                     <div className="border rounded-xl bg-card/50 max-h-96 overflow-y-auto">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="pl-6">隊伍名稱</TableHead>
                                    <TableHead className="w-36">購買玩家</TableHead>
                                    <TableHead className="w-32">價格</TableHead>
                                    <TableHead className="w-20 text-right pr-6">操作</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {details.teams?.map(team => {
                                    const logo = getTeamLogoUrl(team.name, team.logoUrl);
                                    const buyerName = getBuyerName(team.userId, team.userName);
                                    return (
                                     <TableRow key={team.teamId} className="hover:bg-white/5 transition-colors">
                                         <TableCell className="font-bold pl-6">
                                             <div className="flex items-center gap-3">
                                                 {logo ? (
                                                     <img src={logo} alt={team.name} className="w-7 h-7 object-contain flex-shrink-0 drop-shadow-sm" />
                                                 ) : (
                                                     <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 text-xs font-black flex items-center justify-center">
                                                         {team.name.slice(0, 1)}
                                                     </div>
                                                 )}
                                                 <span>{team.name}</span>
                                             </div>
                                         </TableCell>
                                         <TableCell>
                                             {team.userId ? (
                                                 <Badge className="bg-amber-100 text-amber-900 border-amber-300 font-bold hover:bg-amber-100 flex items-center gap-1 w-fit shadow-xs">
                                                     <User className="w-3 h-3 text-amber-700 shrink-0" />
                                                     <span className="truncate max-w-[100px]">{buyerName || '已卡位'}</span>
                                                 </Badge>
                                             ) : (
                                                 <Badge variant="outline" className="text-slate-400 border-dashed text-[11px]">
                                                     未售出
                                                 </Badge>
                                             )}
                                         </TableCell>
                                         <TableCell>
                                             <div className="flex items-center gap-2">
                                                 {currency === 'diamond' ? <Gem className="h-3 w-3 text-primary opacity-50"/> : <PPlusIcon className="h-3 w-3 opacity-50"/>}
                                                 <Input 
                                                     type="number" 
                                                     defaultValue={team.price}
                                                     onBlur={(e) => handleUpdateTeamPrice(team.teamId, Number(e.target.value))}
                                                     className="h-8 bg-transparent"
                                                 />
                                             </div>
                                         </TableCell>
                                         <TableCell className="text-right pr-6">
                                              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => handleRemoveTeam(team.teamId)}>
                                                 <Trash2 className="w-4 h-4"/>
                                              </Button>
                                         </TableCell>
                                     </TableRow>
                                    );
                                })}
                                {(!details.teams || details.teams.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={4} className="h-24 text-center text-muted-foreground italic">
                                          尚未新增任何隊伍選項。請點選上方「🏀 一鍵新增 NBA」或「⚾ 一鍵新增 MLB」快速為活動填入隊伍！
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                     </div>
                </CardContent>
             </Card>
           )}
           <DrawControl groupBreak={groupBreak} groupBreakRef={groupBreakRef} getBuyerName={getBuyerName} forceRefetch={forceRefetch} />
           <PrizeAssignment groupBreak={groupBreak} groupBreakRef={groupBreakRef} />
        </div>

        <div className="space-y-6">
          <Card className="shadow-lg border-white/5 bg-card/40">
            <CardHeader>
              <CardTitle className="text-lg">視覺封面</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="relative aspect-video rounded-xl bg-muted/30 border-2 border-dashed border-white/10 overflow-hidden flex items-center justify-center group">
                {previewUrl ? (
                  <Image src={previewUrl} alt="Preview" fill className="object-cover transition-transform group-hover:scale-105 duration-500" />
                ) : (
                  <ImageIcon className="h-12 w-12 text-muted-foreground opacity-20" />
                )}
              </div>
              <Input id="image-upload" type="file" accept="image/*" onChange={handleFileChange} className="bg-background/50" />
              {uploadProgress !== null ? (
                <div className="space-y-2">
                    <Progress value={uploadProgress} className="h-1.5" />
                    <p className="text-[10px] text-center font-bold text-primary">上傳中 {Math.round(uploadProgress)}%</p>
                </div>
              ) : (
                <Button onClick={handleImageUpload} disabled={!selectedFile} className="w-full font-bold">
                  <Upload className="mr-2 h-4 w-4" /> 更換活動圖片
                </Button>
              )}
            </CardContent>
          </Card>

          <Card className="border-destructive/20 bg-destructive/5">
            <CardHeader>
                <CardTitle className="text-lg text-destructive">危險區域</CardTitle>
            </CardHeader>
            <CardContent>
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button variant="destructive" className="w-full font-bold">重設參與者數據</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>確定要清空所有購買紀錄嗎？</AlertDialogTitle>
                            <AlertDialogDescription>
                                這將會移除所有已購買的位置/隊伍資料，且不會自動退款點數給玩家。請僅在測試或誤設時使用。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={handleResetParticipants} className="bg-destructive hover:bg-destructive/90">確認重設</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
