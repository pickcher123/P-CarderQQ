import { motion } from 'framer-motion';
import { CardItem } from '@/components/card-item';
import { RandomPlayerCard } from '@/components/random-player-card';
import { Button } from '@/components/ui/button';
import { FastForward, Disc3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export function RevealComponent({
    currentPrize,
    step,
    isChanging,
    isSqueezing,
    revealPercent,
    rarityVisuals,
    pointPrizeRarityStyles,
    handleSqueezeStart,
    handleSqueezeMove,
    handleSqueezeEnd,
    completeReveal,
    squeezeRef
}: {
    currentPrize: any,
    step: string,
    isChanging: boolean,
    isSqueezing: boolean,
    revealPercent: number,
    rarityVisuals: any,
    pointPrizeRarityStyles: any,
    handleSqueezeStart: any,
    handleSqueezeMove: any,
    handleSqueezeEnd: any,
    completeReveal: any,
    squeezeRef: any
}) {
    const visual = currentPrize ? (rarityVisuals[currentPrize.rarity] || rarityVisuals.common) : rarityVisuals.common;

    return (
        <motion.div 
            initial={{ y: -800, opacity: 0, scale: 0.2, rotate: -45, filter: 'blur(50px)' }}
            animate={{ y: 0, opacity: 1, scale: 1, rotate: 0, filter: 'blur(0px)' }}
            transition={{ 
                type: 'spring', 
                stiffness: 120, 
                damping: 10,
                mass: 1.5,
                duration: 1.2
            }}
            className="flex flex-col items-center w-full max-w-[170px] md:max-w-[220px] relative"
        >
            <div className={cn("relative p-1 bg-slate-900 border-[5px] border-slate-950 rounded-[2.2rem] shadow-2xl overflow-hidden w-full transition-all duration-700", step === 'revealing' && revealPercent === 100 && visual.glow)}>
                <div 
                    ref={squeezeRef} 
                    className="relative bg-transparent rounded-[1.1rem] border-[5px] border-slate-950 overflow-hidden aspect-[2.5/4] flex items-center justify-center touch-none cursor-pointer select-none transition-transform duration-100"
                    style={{ transform: isSqueezing ? `perspective(1000px) rotateX(${revealPercent * 0.2}deg) rotateY(-${revealPercent * 0.1}deg) scale(1.05)` : 'none' }}
                    onPointerDown={handleSqueezeStart} 
                    onPointerMove={handleSqueezeMove} 
                    onPointerUp={handleSqueezeEnd} 
                    onPointerCancel={handleSqueezeEnd}
                >
                    <div className={cn(
                        "relative w-full h-full z-10 flex items-center justify-center pointer-events-none p-1.5 select-none transition-opacity duration-200",
                        isChanging ? "opacity-0" : "opacity-100"
                    )}>
                        {currentPrize && (
                            (currentPrize.type === 'card' || currentPrize.type === 'last-prize') && !currentPrize.name?.includes('隨機球員') && !currentPrize.isPoints ? (
                                <div className="relative w-full h-full rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                                    <CardItem 
                                        name={currentPrize.name} 
                                        imageUrl={currentPrize.imageUrl} 
                                        backImageUrl={currentPrize.backImageUrl} 
                                        imageHint={currentPrize.name} 
                                        rarity={currentPrize.rarity} 
                                        serialNumber={currentPrize.serialNumber} 
                                        isFlippable={true} 
                                        priority 
                                    />
                                </div>
                            ) : (
                                <div className="relative w-full h-full rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,0,0,0.5)]">
                                    <RandomPlayerCard 
                                        rarity={currentPrize.rarity} 
                                        points={currentPrize.points} 
                                        title={currentPrize.name}
                                        showBuybackHint={false}
                                    />
                                </div>
                            )
                        )}
                    </div>
                    
                    <div 
                        className={cn(
                            "absolute inset-0 z-30 bg-slate-900 rounded-xl border-4 border-primary/50 flex flex-col items-center justify-center pointer-events-none select-none shadow-[inset_0_0_20px_rgba(6,182,212,0.3)]",
                            (!isSqueezing && (revealPercent === 0 || isChanging)) ? "" : "transition-all duration-500 ease-out",
                            (revealPercent >= 100) ? "opacity-0" : "opacity-100"
                        )} 
                        style={{ transform: `translateY(-${revealPercent}%)` }} 
                    >
                        <div className="absolute -right-2 top-2 bottom-2 w-2 bg-primary/20 rounded-r-lg shadow-lg" />
                        <div className="absolute -bottom-2 left-2 right-2 h-2 bg-primary/20 rounded-b-lg shadow-lg" />
                        
                        <div className="relative">
                            <div className="absolute inset-0 bg-primary blur-xl opacity-30 animate-pulse" />
                            <Disc3 className="w-12 h-12 text-primary animate-spin-slow mb-3 relative z-10" />
                        </div>
                        <span className="font-headline text-sm font-black text-primary tracking-[0.3em] italic drop-shadow-md">P+ CARDER</span>
                        <p className="text-[9px] text-primary/60 mt-4 animate-pulse uppercase font-black tracking-widest">往上掀開</p>
                    </div>
                </div>
            </div>
            {step === 'ready-to-reveal' && (
                <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={completeReveal}
                    className="mt-4 h-8 px-6 rounded-full bg-white/10 border border-white/20 text-[10px] font-black text-primary uppercase tracking-[0.2em] hover:bg-primary/20 transition-all shadow-xl"
                >
                    <FastForward className="w-3 h-3 mr-1.5 animate-pulse" /> 快速開獎 SKIP
                </Button>
            )}
        </motion.div>
    );
}
