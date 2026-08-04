import { cn } from '@/lib/utils';
import React from 'react';

interface MarqueeContainerProps {
    children: React.ReactNode;
    className?: string;
    speed?: 'fast' | 'normal' | 'slow';
}

export function MarqueeContainer({ children, className, speed = 'normal' }: MarqueeContainerProps) {
    const speedClass = {
        fast: 'animate-marquee-fast',
        normal: 'animate-marquee',
        slow: 'animate-marquee-slow',
    }[speed];

    return (
        <div className={cn("flex overflow-hidden relative group/marquee", className)}>
            <div className={cn("flex min-w-full shrink-0 items-center group-hover/marquee:[animation-play-state:paused]", speedClass)}>
                {children}
            </div>
            <div className={cn("flex min-w-full shrink-0 items-center group-hover/marquee:[animation-play-state:paused]", speedClass)} aria-hidden="true">
                {children}
            </div>
        </div>
    );
}
