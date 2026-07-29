'use client';

import { useState } from 'react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trash2 } from 'lucide-react';

export default function AdminPredictionsPage() {
    const db = useFirestore();
    const eventsCollection = useMemoFirebase(() => collection(db, 'predictionEvents'), [db]);
    const { data: events, isLoading } = useCollection(eventsCollection);

    const [matchName, setMatchName] = useState('');
    const [question, setQuestion] = useState('');
    const [options, setOptions] = useState('');
    const [reward, setReward] = useState('');
    const [bettingEndTime, setBettingEndTime] = useState('');

    const handleCreateEvent = async () => {
        if (!matchName || !question || !options || !reward || !bettingEndTime) return;
        try {
            await addDoc(eventsCollection, {
                matchName,
                startTime: new Date().toISOString(), // Simplified for now
                bettingEndTime,
                question,
                options: options.split(',').map(o => o.trim()),
                reward: Number(reward),
                status: 'open'
            });

            setMatchName('');
            setQuestion('');
            setOptions('');
            setReward('');
            setBettingEndTime('');
        } catch (error) {
            console.error(error);
        }
    };

    const handleDelete = async (id: string) => {
        try {
            await deleteDoc(doc(db, 'predictionEvents', id));
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <div className="container py-8 space-y-8">
            <h1 className="text-3xl font-black">賽事預測管理</h1>

            <Card>
                <CardHeader><CardTitle>新增賽事</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    <Label>比賽名稱</Label>
                    <Input value={matchName} onChange={e => setMatchName(e.target.value)} />
                    <Label>問題</Label>
                    <Input value={question} onChange={e => setQuestion(e.target.value)} />
                    <Label>選項 (逗號分隔)</Label>
                    <Input value={options} onChange={e => setOptions(e.target.value)} />
                    <Label>紅利積分</Label>
                    <Input type="number" value={reward} onChange={e => setReward(e.target.value)} />
                    <Label>下注截止時間</Label>
                    <Input type="datetime-local" value={bettingEndTime} onChange={e => setBettingEndTime(e.target.value)} />
                    <Button onClick={handleCreateEvent}>建立賽事</Button>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>現有賽事</CardTitle></CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>比賽</TableHead>
                                <TableHead>問題</TableHead>
                                <TableHead>操作</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {events?.map(event => (
                                <TableRow key={event.id}>
                                    <TableCell>{event.matchName}</TableCell>
                                    <TableCell>{event.question}</TableCell>
                                    <TableCell>
                                        <Button variant="destructive" size="sm" onClick={() => handleDelete(event.id)}>
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
