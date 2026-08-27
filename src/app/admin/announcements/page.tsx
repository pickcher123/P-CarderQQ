'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, addDoc, deleteDoc, updateDoc, doc, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Megaphone, Plus, Trash2, Bell, Radio, CheckCircle2, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface AnnouncementDoc {
    id: string;
    title: string;
    content: string;
    createdAt?: { seconds: number };
    isGlobal?: boolean;
    isActive?: boolean;
    tag?: string;
}

export default function AdminAnnouncementsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [tag, setTag] = useState('系統通知');
    const [isGlobal, setIsGlobal] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const announcementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'announcements'), orderBy('createdAt', 'desc'));
    }, [firestore]);

    const { data: announcements, isLoading } = useCollection<AnnouncementDoc>(announcementsQuery);

    const handlePublish = async () => {
        if (!firestore || !title.trim() || !content.trim()) {
            toast({ variant: 'destructive', title: '請填寫完整內容', description: '標題與內容皆為必填項目。' });
            return;
        }

        setIsSubmitting(true);
        try {
            await addDoc(collection(firestore, 'announcements'), {
                title: title.trim(),
                content: content.trim(),
                tag: tag || '系統通知',
                createdAt: Timestamp.now(),
                isGlobal,
                isActive: true
            });
            setTitle('');
            setContent('');
            toast({ title: '全域公告已發布', description: '前台會員即可在通知專區即時查看。' });
        } catch (error) {
            console.error(error);
            toast({ variant: 'destructive', title: '發布失敗' });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleToggleStatus = async (item: AnnouncementDoc) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'announcements', item.id), {
                isActive: !item.isActive
            });
            toast({ title: '狀態已更新' });
        } catch (e) {
            toast({ variant: 'destructive', title: '更新失敗' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        try {
            await deleteDoc(doc(firestore, 'announcements', id));
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
                    發布重大維護、活動更新與全域廣播訊息，即時傳遞給所有在線與登入會員。
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Form */}
                <Card className="border-slate-200/90 shadow-2xs bg-white rounded-2xl">
                    <CardHeader className="p-5 border-b border-slate-100">
                        <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                            <Plus className="h-4 w-4 text-primary" /> 發布新公告
                        </CardTitle>
                        <CardDescription className="text-xs text-slate-500 font-medium">
                            即時發送通知至全站會員專區
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-5 space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold text-slate-700">公告標籤 / 類別</label>
                            <Input 
                                placeholder="例如：系統維護、活動上線、優惠通知" 
                                value={tag} 
                                onChange={e => setTag(e.target.value)} 
                                className="h-10 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-bold"
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
                                placeholder="輸入詳細說明事項、維護時間或活動規則..." 
                                value={content} 
                                onChange={e => setContent(e.target.value)} 
                                className="min-h-[140px] p-3 bg-slate-50/70 border-slate-200 rounded-xl text-xs font-medium resize-none outline-none focus:ring-2 focus:ring-primary/20"
                            />
                        </div>

                        <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <div>
                                <p className="text-xs font-bold text-slate-800">全域彈窗廣播</p>
                                <p className="text-[10px] text-slate-400 font-medium">啟用後會員進站會優先看到通知</p>
                            </div>
                            <Switch checked={isGlobal} onCheckedChange={setIsGlobal} />
                        </div>

                        <Button 
                            onClick={handlePublish} 
                            disabled={isSubmitting || !title || !content}
                            className="w-full h-10 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 shadow-xs"
                        >
                            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}
                            立即發布公告
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
                                    共 {announcements?.length || 0} 則已發布的公告記錄
                                </CardDescription>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader className="bg-slate-50/80">
                                    <TableRow>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400 pl-6">標題與內容</TableHead>
                                        <TableHead className="text-[11px] font-black uppercase text-slate-400">類型</TableHead>
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
                                            <TableRow key={item.id} className="hover:bg-slate-50/50 border-slate-100">
                                                <TableCell className="pl-6 py-4 max-w-[240px]">
                                                    <p className="text-xs font-black text-slate-900 truncate">{item.title}</p>
                                                    <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{item.content}</p>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="bg-slate-50 border-slate-200 text-slate-700 text-[10px] font-bold">
                                                        {item.tag || '系統'}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-[11px] text-slate-400 font-mono font-bold">
                                                    {item.createdAt ? format(new Date(item.createdAt.seconds * 1000), 'yyyy-MM-dd HH:mm') : '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <button 
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
                                                <TableCell className="text-right pr-6">
                                                    <Button 
                                                        variant="ghost" 
                                                        size="icon" 
                                                        onClick={() => handleDelete(item.id)}
                                                        className="h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>
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
