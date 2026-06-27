'use client';

import { useState, useMemo } from 'react';
import { useCollection, useFirestore } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, Timestamp, orderBy, query } from 'firebase/firestore';
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
    const [date, setDate] = useState('');
    const [description, setDescription] = useState('');

    const q = useMemo(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'card_exhibitions'), orderBy('date', 'asc'));
    }, [firestore]);
    const { data: exhibitions } = useCollection<any>(q);

    const handleAdd = async () => {
        if (!firestore || !title || !date) return;
        try {
            await addDoc(collection(firestore, 'card_exhibitions'), {
                title,
                date: Timestamp.fromDate(new Date(date)),
                description,
            });
            toast({ title: '成功', description: '卡展已新增' });
            setTitle('');
            setDate('');
            setDescription('');
        } catch (e) {
            toast({ variant: 'destructive', title: '錯誤', description: '新增失敗' });
        }
    };

    const handleDelete = async (id: string) => {
        if (!firestore) return;
        await deleteDoc(doc(firestore, 'card_exhibitions', id));
        toast({ title: '已刪除' });
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
                        <Label>日期</Label>
                        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <Label>描述</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
                    </div>
                    <Button onClick={handleAdd}><Plus className="mr-2" /> 新增</Button>
                </CardContent>
            </Card>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exhibitions?.map((exh) => (
                    <Card key={exh.id} className="p-4 flex justify-between items-center">
                        <div>
                            <h3 className="font-bold">{exh.title}</h3>
                            <p>{format(new Date(exh.date.seconds * 1000), 'yyyy-MM-dd')}</p>
                        </div>
                        <Button variant="destructive" onClick={() => handleDelete(exh.id)}><Trash2 /></Button>
                    </Card>
                ))}
            </div>
        </div>
    );
}
