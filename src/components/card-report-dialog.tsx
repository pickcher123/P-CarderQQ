'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface CardData {
    name: string;
    rarity: string;
    sellPrice?: number;
}

export function CardReportDialog({ card, open, onOpenChange }: { card: CardData | null, open: boolean, onOpenChange: (open: boolean) => void }) {
    if (!card) return null;

    const data = [
        { name: '稀有度', value: card.rarity === 'legendary' ? 100 : card.rarity === 'rare' ? 60 : 20 },
        { name: '市場價值', value: (card.sellPrice || 0) / 10 },
        { name: '收藏價值', value: 80 },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-950 border-white/10 text-white rounded-[2rem] p-8">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-black italic">{card.name} 鑑定報告</DialogTitle>
                </DialogHeader>
                <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
                            <PolarGrid />
                            <PolarAngleAxis dataKey="name" />
                            <PolarRadiusAxis />
                            <Radar name="分析" dataKey="value" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.6} />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>
            </DialogContent>
        </Dialog>
    );
}
