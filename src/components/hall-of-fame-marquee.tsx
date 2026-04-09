'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Trophy, Crown, Star, Sparkles } from 'lucide-react';
import { useMemo } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface Announcement {
    id: string;
    username: string;
    action: string;
    prize: string;
    prizeImageUrl?: string;
    rarity: 'legendary' | 'rare' | 'common';
    timestamp: any;
    section?: string;
}

export function HallOfFameMarquee() {
    const firestore = useFirestore();

    const announcementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'announcements'),
            orderBy('timestamp', 'desc'),
            limit(50)
        );
    }, [firestore]);

    const { data: rawAnnouncements, isLoading, error } = useCollection<Announcement>(announcementsQuery);

    const announcements = useMemo(() => {
        if (!rawAnnouncements) return [];
        return rawAnnouncements
            .filter(a => a.rarity === 'legendary' && a.section === 'draw')
            .slice(0, 10);
    }, [rawAnnouncements]);

    if (error || isLoading || !announcements || announcements.length === 0) {
        return null;
    }

    const MarqueeItem = ({ item }: { item: Announcement }) => (
        <div className="flex-shrink-0 flex items-center mx-4 md:mx-10 group py-2 md:py-4">
            <div className="relative w-24 h-32 md:w-32 md:h-44 rounded-xl md:rounded-2xl overflow-hidden border-[3px] border-accent/40 shadow-[0_0_20px_rgba(234,179,8,0.2)] transition-all duration-700 group-hover:scale-105 group-hover:shadow-[0_0_40px_rgba(234,179,8,0.4)] group-hover:border-white ring-4 ring-black/20">
                <Image 
                    src={item.prizeImageUrl || 'https://picsum.photos/seed/prize/200/300'} 
                    alt={item.prize}
                    fill
                    className="object-cover transition-transform duration-700 group-hover:scale-110"
                    sizes="(max-width: 768px) 96px, 128px"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/10 to-transparent opacity-70" />
                <div className="absolute top-2 right-2">
                    <div className="p-1 rounded-full bg-accent shadow-xl animate-pulse">
                        <Crown className="w-3 h-3 md:w-4 md:h-4 text-accent-foreground" />
                    </div>
                </div>
            </div>
            <div className="ml-4 md:ml-6 space-y-1 md:space-y-2 max-w-[140px] md:max-w-[200px]">
                <div className="flex items-center gap-1">
                    <Badge className="bg-accent text-accent-foreground text-[8px] md:text-[10px] h-4 md:h-5 px-1.5 md:px-2 font-black uppercase tracking-[0.15em] shadow-xl border-none">Legendary</Badge>
                </div>
                <h3 className="text-xs md:text-xl font-black text-white line-clamp-2 font-headline tracking-tighter group-hover:text-accent transition-colors drop-shadow-[0_2px_4px_rgba(0,0,0,1)] leading-tight uppercase">
                    {item.prize}
                </h3>
                <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                    <span className="text-[10px] md:text-xs text-white/70 font-bold tracking-wide truncate">
                        藏家: <span className="text-white font-black">{item.username}</span>
                    </span>
                </div>
            </div>
        </div>
    );

    return (
        <section className="py-2 md:py-4 bg-transparent overflow-hidden relative">
            <div className="container mb-2 md:mb-4 relative z-10">
                <div className="flex flex-col items-center text-center space-y-1.5">
                    <div className="flex items-center gap-3 animate-fade-in-up">
                        <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-accent animate-pulse" />
                        <h2 className="text-xl md:text-3xl font-black font-headline tracking-[0.2em] italic uppercase relative group">
                            <span className="bg-clip-text text-transparent bg-gradient-to-b from-amber-200 via-yellow-500 to-amber-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]">
                                傳奇大獎牆
                            </span>
                            <span className="absolute inset-0 text-amber-500 blur-[15px] opacity-20 pointer-events-none select-none">傳奇大獎牆</span>
                        </h2>
                        <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-accent animate-pulse" />
                    </div>
                    <div className="w-16 h-0.5 bg-gradient-to-r from-transparent via-accent to-transparent rounded-full shadow-[0_0_10px_rgba(234,179,8,0.6)]" />
                </div>
            </div>

            <div className="relative flex items-center group/marquee">
                <div className="absolute inset-y-0 left-0 w-24 md:w-48 bg-gradient-to-r from-background via-background/40 to-transparent z-20 pointer-events-none" />
                <div className="absolute inset-y-0 right-0 w-24 md:w-48 bg-gradient-to-l from-background via-background/40 to-transparent z-20 pointer-events-none" />

                <div className="animate-marquee flex min-w-full shrink-0 items-center">
                    {announcements.map((item, index) => (
                        <MarqueeItem key={`${item.id}-${index}`} item={item} />
                    ))}
                </div>
                <div className="animate-marquee flex min-w-full shrink-0 items-center" aria-hidden="true">
                    {announcements.map((item, index) => (
                        <MarqueeItem key={`duplicate-${item.id}-${index}`} item={item} />
                    ))}
                </div>
            </div>
        </section>
    );
}
