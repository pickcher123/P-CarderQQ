import { CardItem } from '@/components/card-item';
import { RandomPlayerCard } from '@/components/random-player-card';
import { ChevronRight } from 'lucide-react';

export function DrawResults({
    sessionPrizes,
    pointPrizeRarityStyles,
    setPreviewCard
}: {
    sessionPrizes: any[],
    pointPrizeRarityStyles: any,
    setPreviewCard: (_card: any) => void
}) {
    const isFew = sessionPrizes.length <= 3;
    return (
        <div className="w-full max-w-6xl px-4 z-20 mt-0 flex flex-col relative select-none">
            <div className="relative group">
                <div
                    id="prize-scroll-container"
                    className={`flex flex-row gap-4 py-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth ${isFew ? 'justify-center' : ''}`}
                >
                    {sessionPrizes.map((p, i) => (
                        <div key={i} className="animate-fade-in-up snap-center w-[165px] md:w-[205px] flex-shrink-0 flex flex-col gap-2" style={{ animationDelay: `${i * 80}ms` }}>
                            {p.type === 'points' || p.isPoints || p.name?.includes('隨機球員') ? (
                                <div className="w-full aspect-[2.5/4] rounded-xl overflow-hidden shadow-2xl border border-white/[0.1] transition-transform duration-200 hover:scale-[1.03]">
                                    <RandomPlayerCard 
                                        rarity={p.rarity} 
                                        points={p.points}
                                        title={p.name}
                                        className="w-full h-full aspect-[2.5/4] rounded-xl hover:scale-100"
                                        onClick={() => setPreviewCard({ ...p, isPoints: true })} 
                                    />
                                </div>
                            ) : (
                                <div 
                                    className="w-full aspect-[2.5/4] rounded-xl overflow-hidden shadow-2xl border border-white/[0.1] hover:border-amber-300/45 transition-all duration-200 hover:scale-[1.03] group cursor-zoom-in"
                                    onClick={() => setPreviewCard({ ...p, rarity: p.rarity })}
                                >
                                    <CardItem 
                                        name={p.name} 
                                        imageUrl={p.imageUrl}
                                        backImageUrl={p.backImageUrl} 
                                        imageHint={p.name} 
                                        rarity={p.rarity} 
                                        className="w-full h-full aspect-[2.5/4] hover:scale-100"
                                        isFlippable={false}
                                    />
                                </div>
                            )}
                            <div className="px-2 py-1 rounded-lg bg-[#0a0f1c]/85 border border-white/[0.08] text-center">
                                <p className="text-[11px] font-bold text-slate-200 truncate">{p.name || '戰利品'}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {sessionPrizes.length > 2 && (
                    <>
                        <button 
                            className="absolute left-1 top-1/2 -translate-y-1/2 z-50 bg-[#0a0f1c]/85 backdrop-blur-md p-3 rounded-full border border-amber-300/40 shadow-xl hover:bg-amber-400/15 transition-all hidden md:flex items-center justify-center cursor-pointer"
                            onClick={() => {
                                const container = document.getElementById('prize-scroll-container');
                                if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
                            }}
                        >
                            <ChevronRight className="w-6 h-6 text-[#FDE68A] rotate-180" />
                        </button>

                        <button 
                            className="absolute right-1 top-1/2 -translate-y-1/2 z-50 bg-[#0a0f1c]/85 backdrop-blur-md p-3 rounded-full border border-amber-300/40 shadow-xl hover:bg-amber-400/15 transition-all hidden md:flex items-center justify-center cursor-pointer"
                            onClick={() => {
                                const container = document.getElementById('prize-scroll-container');
                                if (container) container.scrollBy({ left: 300, behavior: 'smooth' });
                            }}
                        >
                            <ChevronRight className="w-6 h-6 text-[#FDE68A]" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
