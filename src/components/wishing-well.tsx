'use client';

import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Sparkles, Send, Loader2, History, Wand2, Star, Zap } from 'lucide-react';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { polishWish } from '@/ai/flows/polish-wish-flow';

const WISH_TYPES = [
    { value: 'new-card', label: '想要出某張卡' },
    { value: 'feature', label: '功能建議' },
    { value: 'event', label: '活動願望' },
    { value: 'other', label: '其他心願' },
];

export function WishingWell() {
    const { user } = useUser();
    const firestore = useFirestore();
    const { toast } = useToast();

    const [content, setContent] = useState('');
    const [type, setType] = useState('new-card');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isPolishing, setIsPolishing] = useState(false);

    const wishesQuery = useMemoFirebase(() => {
        if (!firestore || !user?.uid) return null;
        return query(
            collection(firestore, 'wishes'),
            where('userId', '==', user.uid),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
    }, [firestore, user?.uid]);

    const { data: myWishes } = useCollection(wishesQuery);

    const handlePolish = async () => {
        if (!content.trim()) return;
        setIsPolishing(true);
        try {
            const result = await polishWish({ wish: content });
            setContent(result.polishedWish);
            toast({ title: 'AI 心願修飾完成！', description: '已為您的心願注入收藏家熱魂。' });
        } catch (error) {
            toast({ variant: 'destructive', title: 'AI 服務忙碌中' });
        } finally {
            setIsPolishing(false);
        }
    };

    const handleSubmit = async () => {
        if (!user || !firestore || !content.trim()) return;

        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'wishes'), {
                userId: user.uid,
                username: user.displayName || '未知玩家',
                type,
                content: content.trim(),
                status: 'pending',
                createdAt: serverTimestamp(),
            });

            toast({
                title: '願願投遞成功！',
                description: '許願成功！營運團隊將會定期查看許願池喔。',
            });
            setContent('');
        } catch (error) {
            console.error("Wishing error:", error);
            toast({
                variant: 'destructive',
                title: '許願失敗',
                description: '許願池目前維護中，請稍後再試。',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6 p-2">
            <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-accent font-headline tracking-widest text-2xl">
                    <Wand2 className="w-6 h-6 animate-pulse" /> 許願池
                </div>
                <p className="text-sm text-muted-foreground">投下您對 P+Carder 的期許，或許哪天就會實現！</p>
            </div>

            <div className="space-y-4">
                <div className="space-y-2">
                    <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">我想許願...</Label>
                    <Select value={type} onValueChange={setType}>
                        <SelectTrigger className="bg-background/50 border-accent/20 h-11">
                            <SelectValue placeholder="選擇心願類型" />
                        </SelectTrigger>
                        <SelectContent>
                            {WISH_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between items-end mb-1">
                        <Label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">心願內容</Label>
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={handlePolish}
                            disabled={!content.trim() || isPolishing}
                            className="h-7 text-[10px] bg-primary/10 border border-primary/20 text-primary hover:bg-primary/20 font-black rounded-full"
                        >
                            {isPolishing ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                            AI 修飾心願
                        </Button>
                    </div>
                    <Textarea 
                        placeholder="請輸入您的心願內容，例如：希望出 2024 年度 MVP 卡包..." 
                        className="bg-background/50 border-accent/20 resize-none min-h-[120px] text-base leading-relaxed"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        maxLength={200}
                    />
                    <div className="flex justify-end">
                        <span className="text-[10px] font-code text-muted-foreground">{content.length}/200</span>
                    </div>
                </div>

                <Button 
                    className="w-full h-12 bg-accent text-accent-foreground hover:bg-accent/90 font-black text-lg shadow-[0_0_20px_rgba(234,179,8,0.3)] transition-all active:scale-95" 
                    onClick={handleSubmit}
                    disabled={isSubmitting || !content.trim()}
                >
                    {isSubmitting ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Send className="mr-2 h-5 w-5" />}
                    投遞心願
                </Button>

                {myWishes && myWishes.length > 0 && (
                    <div className="pt-4 space-y-3">
                        <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] border-t border-white/10 pt-6 mb-2">
                            <History className="w-3.5 h-3.5" /> 近期許願紀錄
                        </div>
                        <ScrollArea className="h-[180px] pr-2">
                            <div className="space-y-3">
                                {myWishes.map((wish) => (
                                    <div key={wish.id} className="p-3 rounded-xl bg-white/5 border border-white/5 space-y-2 relative overflow-hidden group">
                                        <div className="absolute top-0 left-0 w-1 h-full bg-accent opacity-50" />
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="text-[9px] h-4 border-accent/30 text-accent px-2 font-bold">
                                                {WISH_TYPES.find(t => t.value === wish.type)?.label}
                                            </Badge>
                                            <span className="text-[10px] font-code text-muted-foreground">
                                                {wish.createdAt ? format((wish.createdAt as any).toDate(), 'yyyy-MM-dd') : ''}
                                            </span>
                                        </div>
                                        <p className="text-xs text-foreground/90 leading-relaxed font-medium">
                                            {wish.content}
                                        </p>
                                        <div className="flex justify-end">
                                            {wish.status === 'granted' ? (
                                                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[8px] h-4">已實現</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[8px] h-4 opacity-50">待處理</Badge>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </div>
                )}
            </div>
        </div>
    );
}
