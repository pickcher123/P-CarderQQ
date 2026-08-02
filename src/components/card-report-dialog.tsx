'use client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

interface CardData {
    name: string;
    rarity: string;
    sellPrice?: number;
}

export function CardReportDialog({ card, open, onOpenChange }: { card: CardData | null, open: boolean, onOpenChange: (open: boolean) => void }) {
    if (!card) return null;

    const rarityScore = card.rarity === 'legendary' ? 95 : card.rarity === 'rare' ? 75 : 40;
    const marketScore = Math.min(100, Math.max(30, Math.round(((card.sellPrice || 100) / 500) * 100)));
    const collectScore = card.rarity === 'legendary' ? 98 : card.rarity === 'rare' ? 82 : 60;

    const data = [
        { name: '稀有度', value: rarityScore },
        { name: '市場價值', value: marketScore },
        { name: '收藏價值', value: collectScore },
    ];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-slate-950 border-cyan-500/30 text-white rounded-[2rem] p-6 sm:p-8 max-w-md w-11/12 mx-auto shadow-[0_0_50px_rgba(6,182,212,0.15)]">
                <DialogHeader className="text-center space-y-1">
                    <DialogTitle className="text-xl sm:text-2xl font-black italic text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                        {card.name} 鑑定報告
                    </DialogTitle>
                    <DialogDescription className="text-slate-400 text-xs">
                        卡片多維度價值綜合評析數據
                    </DialogDescription>
                </DialogHeader>

                <div className="h-64 w-full relative my-2">
                    <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="75%" data={data}>
                            <PolarGrid stroke="#334155" />
                            <PolarAngleAxis 
                                dataKey="name" 
                                tick={{ fill: '#38bdf8', fontSize: 13, fontWeight: 'bold' }} 
                            />
                            {/* Hide messy vertical tick numbers */}
                            <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                            <Radar 
                                name="分析" 
                                dataKey="value" 
                                stroke="#06b6d4" 
                                fill="#06b6d4" 
                                fillOpacity={0.4} 
                                strokeWidth={2}
                            />
                        </RadarChart>
                    </ResponsiveContainer>
                </div>

                {/* Score Summary Grid */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-center">
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-400 font-bold mb-0.5">稀有度</p>
                        <p className="text-base font-black text-amber-400 font-mono">{rarityScore}<span className="text-[10px] text-slate-500">/100</span></p>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-400 font-bold mb-0.5">市場價值</p>
                        <p className="text-base font-black text-cyan-400 font-mono">{marketScore}<span className="text-[10px] text-slate-500">/100</span></p>
                    </div>
                    <div className="bg-slate-900/80 p-2.5 rounded-xl border border-slate-800">
                        <p className="text-[10px] text-slate-400 font-bold mb-0.5">收藏價值</p>
                        <p className="text-base font-black text-purple-400 font-mono">{collectScore}<span className="text-[10px] text-slate-500">/100</span></p>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}

