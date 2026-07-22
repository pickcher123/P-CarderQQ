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
                description,
                imageUrl,
            });
            toast({ title: '成功', description: '卡展已新增' });
            setTitle('');
            setStartDate('');
            setEndDate('');
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
        const [title, setTitle] = useState(exh.title);
        const [description, setDescription] = useState(exh.description || '');
        const [imageUrl, setImageUrl] = useState(exh.imageUrl || '');

        if (isEditing) {
            return (
                <Card className="p-4 space-y-2">
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                    <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                    <div className="flex gap-2">
                        <Button onClick={() => { handleUpdate(exh.id, { title, description, imageUrl }); setIsEditing(false); }}>儲存</Button>
                        <Button variant="outline" onClick={() => setIsEditing(false)}>取消</Button>
                    </div>
                </Card>
            );
        }

        return (
            <Card key={exh.id} className="p-4 flex justify-between items-center">
                <div>
                    <h3 className="font-bold">{exh.title}</h3>
                    <p className="text-sm text-muted-foreground">{format(new Date(exh.date.seconds * 1000), 'yyyy-MM-dd')}</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setIsEditing(true)}>編輯</Button>
                    <Button variant="destructive" onClick={() => handleDelete(exh.id)}><Trash2 /></Button>
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
                        <Label>標題</Label>
                        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>開始日期</Label>
                        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>結束日期</Label>
                        <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>描述</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>宣傳圖片 (URL)</Label>
                        <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} />
                    </div>
                    <Button onClick={handleAdd}><Plus className="mr-2" /> 新增</Button>
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exhibitions?.map((exh) => <ExhibitionItem key={exh.id} exh={exh} />)}
            </div>
        </div>
    );
}
