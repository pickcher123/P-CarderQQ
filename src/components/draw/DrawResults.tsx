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
    return (
        <div className="w-full max-w-6xl px-4 z-20 mt-0 flex flex-col relative select-none">
            <div className="relative group">
                <div id="prize-scroll-container" className="flex flex-row gap-4 py-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide scroll-smooth">
                    {sessionPrizes.map((p, i) => (
                        <div key={i} className="animate-fade-in-up snap-center w-[160px] md:w-[200px] flex-shrink-0" style={{ animationDelay: `${i * 80}ms` }}>
                            {p.type === 'points' ? (
                                <RandomPlayerCard 
                                    rarity={p.rarity} 
                                    onClick={() => setPreviewCard({ ...p, isPoints: true })} 
                                />
                            ) : (
                                <div 
                                    className="w-full aspect-[2.5/4] rounded-3xl overflow-hidden shadow-2xl transition-all hover:scale-105 group border border-white/5 h-full cursor-zoom-in"
                                    onClick={() => setPreviewCard({ ...p, rarity: p.rarity })}
                                >
                                    <CardItem 
                                        name={p.name} 
                                        imageUrl={p.imageUrl}
                                        backImageUrl={p.backImageUrl} 
                                        imageHint={p.name} 
                                        rarity={p.rarity} 
                                        className="h-full"
                                        isFlippable={false}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {sessionPrizes.length > 2 && (
                    <>
                        <button 
                            className="absolute left-0 top-1/2 -translate-y-1/2 z-50 bg-black/60 backdrop-blur-md p-4 rounded-r-full border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:bg-red-500/20 transition-all hidden md:block"
                            onClick={() => {
                                const container = document.getElementById('prize-scroll-container');
                                if (container) container.scrollBy({ left: -300, behavior: 'smooth' });
                            }}
                        >
                            <ChevronRight className="w-8 h-8 text-red-500 rotate-180" />
                        </button>

                        <button 
                            className="absolute right-0 top-1/2 -translate-y-1/2 z-50 bg-black/60 backdrop-blur-md p-4 rounded-l-full border border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.5)] hover:bg-red-500/20 transition-all hidden md:block"
                            onClick={() => {
                                const container = document.getElementById('prize-scroll-container');
                                if (container) container.scrollBy({ left: 300, behavior: 'smooth' });
                            }}
                        >
                            <ChevronRight className="w-8 h-8 text-red-500" />
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
