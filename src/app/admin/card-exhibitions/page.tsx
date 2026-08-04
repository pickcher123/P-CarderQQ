'use client';

import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, addDoc, deleteDoc, updateDoc, doc, Timestamp, orderBy, query } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Trash2, Plus } from 'lucide-react';

export default function CardExhibitionsAdmin() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [time, setTime] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [imageUrl, setImageUrl] = useState('');

    const q = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
    }, [firestore]);
    const { data: exhibitions } = useCollection<any>(q);

    const handleAdd = async () => {
        if (!firestore || !title || !startDate) return;
        try {
            await addDoc(collection(firestore, 'card_exhibitions'), {
                title,
                date: Timestamp.fromDate(new Date(startDate)),
                endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : Timestamp.fromDate(new Date(startDate)),
                time,
                location,
                description,
                imageUrl,
            });
            toast({ title: '成功', description: '卡展已新增' });
            setTitle('');
            setStartDate('');
            setEndDate('');
            setTime('');
            setLocation('');
            setDescription('');
            setImageUrl('');
        } catch (e) {
            toast({ variant: 'destructive', title: '錯誤', description: '新增失敗' });
        }
    };

    const handleUpdate = async (id: string, updatedData: any) => {
        if (!firestore) return;
        try {
            await updateDoc(doc(firestore, 'card_exhibitions', id), updatedData);
            toast({ title: '成功', description: '卡展已更新' });
        } catch (e) {
            toast({ variant: 'destructive', title: '錯誤', description: '更新失敗' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        await deleteDoc(doc(firestore, 'card_exhibitions', id));
        toast({ title: '已刪除' });
    };

    const ExhibitionItem = ({ exh }: { exh: any }) => {
        const [isEditing, setIsEditing] = useState(false);
        const [title, setTitle] = useState(exh.title || '');
        const [location, setLocation] = useState(exh.location || '');
        const [time, setTime] = useState(exh.time || '');
        const [description, setDescription] = useState(exh.description || '');
        const [imageUrl, setImageUrl] = useState(exh.imageUrl || '');
        const [startDate, setStartDate] = useState(exh.date ? format(new Date(exh.date.seconds * 1000), 'yyyy-MM-dd') : '');
        const [endDate, setEndDate] = useState(exh.endDate ? format(new Date(exh.endDate.seconds * 1000), 'yyyy-MM-dd') : '');

        if (isEditing) {
            return (
                <Card className="p-4 space-y-3">
                    <div className="space-y-1">
                        <Label className="text-xs font-bold">標題</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="展覽標題" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">開始日期</Label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">結束日期</Label>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">地點</Label>
                            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例如：龍山文創基地" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-xs font-bold">時間</Label>
                            <Input value={time} onChange={(e) => setTime(e.target.value)} placeholder="例如：11:00 - 17:00" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs font-bold">描述</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="詳細活動介紹或說明" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-xs font-bold">宣傳圖片 (URL)</Label>
                        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                    </div>
                    <div className="flex gap-2 pt-2">
                        <Button onClick={() => { 
                            handleUpdate(exh.id, { 
                                title, 
                                location,
                                time,
                                description, 
                                imageUrl, 
                                date: Timestamp.fromDate(new Date(startDate)),
                                endDate: endDate ? Timestamp.fromDate(new Date(endDate)) : Timestamp.fromDate(new Date(startDate))
                            }); 
                            setIsEditing(false); 
                        }}>儲存</Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>取消</Button>
                    </div>
                </Card>
            );
        }

        return (
            <Card key={exh.id} className="p-4 flex flex-col justify-between gap-3">
                <div className="space-y-2">
                    <div className="flex justify-between items-start gap-2">
                        <h3 className="font-bold text-base">{exh.title}</h3>
                        <div className="flex gap-1.5 shrink-0">
                            <Button size="sm" variant="outline" onClick={() => setIsEditing(true)}>編輯</Button>
                            <Button size="sm" variant="destructive" onClick={() => handleDelete(exh.id)}><Trash2 className="w-4 h-4" /></Button>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                        📅 {exh.date ? format(new Date(exh.date.seconds * 1000), 'yyyy/MM/dd') : ''}
                        {exh.endDate && ` ~ ${format(new Date(exh.endDate.seconds * 1000), 'yyyy/MM/dd')}`}
                    </p>
                    {(exh.location || exh.time) && (
                        <div className="text-xs text-slate-700 bg-slate-100 p-2 rounded-lg space-y-1 font-medium">
                            {exh.location && <div>📍 <strong>地點：</strong>{exh.location}</div>}
                            {exh.time && <div>⏰ <strong>時間：</strong>{exh.time}</div>}
                        </div>
                    )}
                    {exh.description && (
                        <p className="text-xs text-slate-500 line-clamp-2">{exh.description}</p>
                    )}
                </div>
            </Card>
        );
    };

    return (
        <div className="space-y-8 p-8">
            <h1 className="text-3xl font-black">卡展管理</h1>
            <Card>
                <CardHeader><CardTitle>新增卡展</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label>標題 *</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例：CARDNEX 台北收藏卡展" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>開始日期 *</Label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>結束日期</Label>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>地點</Label>
                            <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例：龍山文創基地 (捷運龍山寺站1號出口)" />
                        </div>
                        <div className="space-y-2">
                            <Label>時間</Label>
                            <Input value={time} onChange={(e) => setTime(e.target.value)} placeholder="例：11:00 - 17:00" />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label>描述說明</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="輸入展覽相關活動規範、備註或補充說明..." />
                    </div>
                    <div className="space-y-2">
                        <Label>宣傳圖片 (URL)</Label>
                        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                    </div>
                    <Button onClick={handleAdd}><Plus className="mr-2 h-4 w-4" /> 新增卡展</Button>
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exhibitions?.map((exh) => <ExhibitionItem key={exh.id} exh={exh} />)}
            </div>
        </div>
    );
}
