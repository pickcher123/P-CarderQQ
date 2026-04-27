'use client';
import { useState } from 'react';
import { useCollection, useFirestore, useMemoFirebase } from "@/firebase";
import { collection, query, orderBy, limit, addDoc, Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Megaphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function AdminAnnouncementsPage() {
    const firestore = useFirestore();
    const { toast } = useToast();
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');

    const handlePublish = async () => {
        if (!firestore || !title.trim() || !content.trim()) return;
        try {
            await addDoc(collection(firestore, 'announcements'), {
                title,
                content,
                createdAt: Timestamp.now(),
                isGlobal: true,
                isActive: true
            });
            setTitle('');
            setContent('');
            toast({ title: '全域公告已發布' });
        } catch (error) {
            toast({ variant: 'destructive', title: '發布失敗' });
        }
    };

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">全域推播與公告</h1>
            <Card>
                <CardHeader>
                    <CardTitle>發布新公告</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Input placeholder="公告標題" value={title} onChange={e => setTitle(e.target.value)} />
                    <Textarea placeholder="公告內容" value={content} onChange={e => setContent(e.target.value)} />
                    <Button onClick={handlePublish}><Megaphone className="h-4 w-4 mr-2" /> 發布</Button>
                </CardContent>
            </Card>
        </div>
    );
}
