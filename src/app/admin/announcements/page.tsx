'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, addDoc, deleteDoc, updateDoc, doc, Timestamp } from "@/lib/audited-firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Megaphone, Plus, Trash2, Pencil, RotateCcw, Pin, Radio, PanelTop, X, Link2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AnnouncementDoc {
    id: string;
    title: string;
    content: string;
    createdAt?: { seconds: number };
    updatedAt?: { seconds: number };
    isGlobal?: boolean;
    showBanner?: boolean;
    isPinned?: boolean;
    isActive?: boolean;
    tag?: string;
    ctaText?: string;
    ctaUrl?: string;
}

const TAG_PRESETS = ['系統通知', '維護公告', '活動快訊', '規則更新', '緊急通知'];

export default function AdminAnnouncementsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();

    const [editingId, setEditingId] = useState<string | null>(null);
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tag, setTag] = useState('系統通知');
    const [isGlobal, setIsGlobal] = useState(true);
    const [showBanner, setShowBanner] = useState(false);
    const [isPinned, setIsPinned] = useState(false);
    const [ctaText, setCtaText] = useState('');
    const [ctaUrl, setCtaUrl] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const announcementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'announcements'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const { data: announcements, isLoading } = useCollection<AnnouncementDoc>(announcementsQuery);

    const resetForm = () => {
        setEditingId(null);
        setTitle('');
        setContent('');
        setTag('系統通知');
        setIsGlobal(true);
        setShowBanner(false);
        setIsPinned(false);
        setCtaText('');
        setCtaUrl('');
    };

    const handleStartEdit = (item: AnnouncementDoc) => {
        setEditingId(item.id);
        setTitle(item.title || '');
        setContent(item.content || '');
        setTag(item.tag || '系統通知');
        setIsGlobal(item.isGlobal !== false);
        setShowBanner(Boolean(item.showBanner));
        setIsPinned(Boolean(item.isPinned));
        setCtaText(item.ctaText || '');
        setCtaUrl(item.ctaUrl || '');
    };

    const handlePublish = async () => {
        if (!firestore || !title.trim() || !content.trim()) {
            toast({ variant: 'destructive', title: '請填寫完整內容', description: '標題與內容皆為必填項目。' });
            return;
        }

        setIsSubmitting(true);
        try {
            const now = Timestamp.now();
            const payload = {
                title: title.trim(),
                content: content.trim(),
                tag: tag.trim() || '系統通知',
                isGlobal,
                showBanner,
                isPinned,
                ctaText: ctaText.trim(),
                ctaUrl: ctaUrl.trim(),
                updatedAt: now,
            };

            if (editingId) {
                await updateDoc(doc(firestore, 'announcements', editingId), payload);
                toast({ title: '公告已更新', description: '前台站內公告已同步更新。' });
            } else {
                await addDoc(collection(firestore, 'announcements'), {
                    ...payload,
                    createdAt: now,
                    isActive: true,
                });
                toast({
                    title: '站內公告已發布',
                    description: isGlobal
                        ? '會員進站時將優先看到此站內公告彈窗（與最新消息跳窗分開）。'
                        : '已上架至前台站內公告中心。',
                });
            }
            resetForm();
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: editingId ? '更新失敗' : '發布失敗', description: '請檢查權限或稍後再試。' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (item: AnnouncementDoc) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'announcements', item.id), {
                isActive: item.isActive === false ? true : false,
            });
            toast({ title: item.isActive === false ? '公告已重新上線' : '公告已下架' });
        } catch (e) {
            toast({ variant: 'destructive', title: '更新失敗' });
        }
    };

    const handleRebroadcast = async (item: AnnouncementDoc) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'announcements', item.id), {
                isActive: true,
                isGlobal: true,
                updatedAt: Timestamp.now(),
            });
            toast({
                title: '已重新推播',
                description: `「${item.title}」將再次對所有會員彈出通知。`,
            });
        } catch (e) {
            toast({ variant: 'destructive', title: '推播失敗' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        if (typeof window !== 'undefined' && !window.confirm('確定要永久刪除此則站內公告嗎？')) return;
        try {
            await deleteDoc(doc(firestore, 'announcements', id));
            if (editingId === id) resetForm();
            toast({ title: '已刪除公告' });
        } catch (e) {
            toast({ variant: 'destructive', title: '刪除失敗' });
        }
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <Megaphone className="h-7 w-7 text-primary" /> 站內公告與全域推播
                </h1>
                <p className="mt-1 text-sm text-slate-500 font-medium">
                    發布系統維護、重大活動與全域推播訊息；前台擁有獨立的「站內公告彈窗」、「頂部公告橫幅」與「導覽列鈴鐺中心」，與最新消息跳窗完全分離。
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form */}
                <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
                    <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between gap-2">
                        <div>
                            <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                                {editingId ? (
                                    <>
                                        <Pencil className="h-4 w-4 text-amber-600" /> 編輯公告
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 text-primary" /> 發布新公告
                                    </>
                                )}
                            </CardTitle>
                            <CardDescription className="text-xs text-slate-500 font-medium">
                                {editingId ? '修改後儲存會立即同步至前台並重新標記為未讀' : '即時發送通知至全站會員專區'}
                            </CardDescription>
                        </div>
                        {editingId && (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={resetForm}
                                className="h-7 px-2 text-xs text-slate-500 hover:text-slate-900"
                            >
                                <X className="w-3.5 h-3.5 mr-1" /> 取消
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-slate-700">公告標籤 / 類別</label>
                            <div className="flex flex-wrap gap-1.5">
                                {TAG_PRESETS.map((preset) => (
                                    <button
                                        key={preset}
                                        type="button"
                                        onClick={() => setTag(preset)}
                                        className={cn(
                                            'px-2.5 py-1 rounded-full text-[11px] font-bold border transition-colors cursor-pointer',
                                            tag === preset
                                                ? 'bg-slate-900 text-white border-slate-900'
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                        )}
                                    >
                                        {preset}
                                    </button>
                                ))}
                            </div>
                            <Input
                                placeholder="或自訂標籤，例如：系統維護、優惠通知"
                                value={tag}
                                onChange={e => setTag(e.target.value)}
                                className="h-9 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-bold"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">公告主標題</label>
                            <Input
                                placeholder="輸入清晰吸引人的公告標題..."
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="h-10 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-bold"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">公告詳細內文</label>
                            <Textarea
                                placeholder="輸入詳細說明事項、維護時間或活動規則（支援換行）..."
                                value={content}
                                onChange={e => setContent(e.target.value)}
                                className="min-h-[130px] p-3 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-medium resize-y outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        {/* 可選跳轉連結按鈕 */}
                        <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2">
                            <p className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5">
                                <Link2 className="w-3.5 h-3.5 text-slate-400" /> 附帶行動按鈕（選填）
                            </p>
                            <div className="grid grid-cols-2 gap-2">
                                <Input
                                    placeholder="按鈕文字，如：前往抽卡"
                                    value={ctaText}
                                    onChange={e => setCtaText(e.target.value)}
                                    className="h-8 bg-white border-slate-200 rounded-lg text-[11px]"
                                />
                                <Input
                                    placeholder="連結，如：/draw"
                                    value={ctaUrl}
                                    onChange={e => setCtaUrl(e.target.value)}
                                    className="h-8 bg-white border-slate-200 rounded-lg text-[11px]"
                                />
                            </div>
                        </div>

                        {/* 顯示管道開關 */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div>
                                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Radio className="w-3.5 h-3.5 text-amber-600" /> 全域彈窗廣播
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium">啟用後會員進站會自動跳出站內公告彈窗（獨立於最新消息）</p>
                                </div>
                                <Switch checked={isGlobal} onCheckedChange={setIsGlobal} />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div>
                                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <PanelTop className="w-3.5 h-3.5 text-sky-600" /> 頂部常駐橫幅
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium">啟用後會在全站導覽列下方顯示醒目公告條</p>
                                </div>
                                <Switch checked={showBanner} onCheckedChange={setShowBanner} />
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                                <div>
                                    <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                                        <Pin className="w-3.5 h-3.5 text-rose-500" /> 置頂公告
                                    </p>
                                    <p className="text-[10px] text-slate-400 font-medium">優先排在公告中心與橫幅最前方</p>
                                </div>
                                <Switch checked={isPinned} onCheckedChange={setIsPinned} />
                            </div>
                        </div>

                        <Button
                            onClick={handlePublish}
                            disabled={isSubmitting || !title.trim() || !content.trim()}
                            className="w-full h-10 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-xs"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}
                            {editingId ? '儲存變更並同步' : '立即發布公告'}
                        </Button>
                    </CardContent>
                </Card>

                {/* Announcement List */}
                <div className="lg:col-span-2 space-y-4">
                    <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="p-5 border-b border-slate-100 flex flex-row items-center justify-between">
                            <div>
                                <CardTitle className="text-base font-black text-slate-900">歷史公告列表</CardTitle>
                                <CardDescription className="text-xs text-slate-500 font-medium">
                                    共 {announcements?.length || 0} 則已發布的公告記錄（點擊狀態可快速上下架）
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0 overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-50/80">
                                    <TableRow>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400 pl-6">標題與內容</TableHead>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400">類型 / 推播方式</TableHead>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400">發布時間</TableHead>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400">狀態</TableHead>
                                        <TableHead className="text-right text-[11px] font-black uppercase text-slate-400 pr-6">操作</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        Array.from({ length: 4 }).map((_, i) => (
                                            <TableRow key={i}>
                                                <TableCell colSpan={5} className="p-4"><Skeleton className="h-10 w-full rounded-xl" /></TableCell>
                                            </TableRow>
                                        ))
                                    ) : announcements && announcements.length > 0 ? (
                                        announcements.map((item) => (
                                            <TableRow
                                                key={item.id}
                                                className={cn(
                                                    'hover:bg-slate-50/50 border-slate-100',
                                                    editingId === item.id && 'bg-amber-50/60'
                                                )}
                                            >
                                                <TableCell className="pl-6 py-4 max-w-[260px]">
                                                    <div className="flex items-center gap-1.5">
                                                        {item.isPinned && <Pin className="w-3 h-3 text-amber-600 shrink-0" />}
                                                        <p className="text-xs font-black text-slate-900 truncate">{item.title}</p>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{item.content}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex flex-wrap gap-1">
                                                        <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 text-[10px] font-bold">
                                                            {item.tag || '系統通知'}
                                                        </Badge>
                                                        {item.isGlobal !== false && (
                                                            <Badge variant="outline" className="bg-amber-50 border-amber-200 text-amber-700 text-[10px] font-bold">
                                                                全域彈窗
                                                            </Badge>
                                                        )}
                                                        {item.showBanner && (
                                                            <Badge variant="outline" className="bg-sky-50 border-sky-200 text-sky-700 text-[10px] font-bold">
                                                                頂部橫幅
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-[11px] text-slate-400 font-mono font-bold whitespace-nowrap tabular-nums">
                                                    {item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleToggleStatus(item)}
                                                        className="cursor-pointer"
                                                    >
                                                        {item.isActive !== false ? (
                                                            <Badge className="bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200 text-[10px] font-bold">
                                                                已上線
                                                            </Badge>
                                                        ) : (
                                                            <Badge className="bg-slate-100 text-slate-500 hover:bg-slate-200 border-slate-200 text-[10px] font-bold">
                                                                已下架
                                                            </Badge>
                                                        )}
                                                    </button>
                                                </TableCell>
                                                <TableCell className="text-right pr-6 whitespace-nowrap">
                                                    <div className="inline-flex items-center gap-1">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleRebroadcast(item)}
                                                            title="重新推播（讓所有會員再次看到彈窗）"
                                                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50"
                                                        >
                                                            <RotateCcw className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleStartEdit(item)}
                                                            title="編輯公告"
                                                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                                                        >
                                                            <Pencil className="h-3.5 w-3.5" />
                                                        </Button>
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            onClick={() => handleDelete(item.id)}
                                                            title="刪除公告"
                                                            className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                        >
                                                            <Trash2 className="h-4 w-4" />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    ) : (
                                        <TableRow>
                                            <TableCell colSpan={5} className="py-12 text-center text-xs text-slate-400 font-bold">
                                                尚未建立任何公告，歡迎使用左側表單進行發布。
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
