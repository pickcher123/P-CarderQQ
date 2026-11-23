import { cn } from '@/lib/utils';
import React from 'react';

interface MarqueeContainerProps {
    children: React.ReactNode;
    className?: string;
    speed?: 'fast' | 'normal' | 'slow';
    durationSec?: number;
    isPaused?: boolean;
}

export function MarqueeContainer({ children, className, speed = 'normal', durationSec, isPaused = false }: MarqueeContainerProps) {
    const resolvedDuration = durationSec ?? ({
        fast: 45,
        normal: 80,
        slow: 120,
    }[speed]);
    const durationStyle = { animationDuration: `${resolvedDuration}s` };

    return (
        <div className={cn("flex overflow-hidden relative group/marquee", className)}>
            <div
                style={durationStyle}
                className={cn(
                    "flex min-w-full shrink-0 items-center animate-marquee group-hover/marquee:[animation-play-state:paused]",
                    isPaused && "[animation-play-state:paused]!"
                )}
            >
                {children}
            </div>
            <div
                style={durationStyle}
                className={cn(
                    "flex min-w-full shrink-0 items-center animate-marquee group-hover/marquee:[animation-play-state:paused]",
                    isPaused && "[animation-play-state:paused]!"
                )}
                aria-hidden="true"
            >
                {children}
            </div>
        </div>
    );
}
