
'use client';

import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, Timestamp } from 'firebase/firestore';
import { Trophy } from 'lucide-react';
import { useMemo } from 'react';

interface Announcement {
    id: string;
    username: string;
    action: string;
    prize: string;
    rarity: 'legendary' | 'rare' | 'common';
    timestamp: Timestamp;
    section?: string;
}

const rarityStyles = {
    legendary: 'text-amber-400',
    rare: 'text-blue-400',
    common: 'text-slate-300',
};

export function WinFeedMarquee() {
    const firestore = useFirestore();

    const announcementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'announcements'),
            orderBy('timestamp', 'desc'),
            limit(5)
        );
    }, [firestore]);

    const { data: announcements, isLoading } = useCollection<Announcement>(announcementsQuery);

    const marqueeItems = useMemo(() => {
        if (!announcements) return [];
        return announcements;
    }, [announcements]);

    if (isLoading || !marqueeItems || marqueeItems.length === 0) {
        return null;
    }

    const MarqueeItem = ({ item }: { item: Announcement }) => (
        <div className="flex-shrink-0 flex items-center mx-4 text-sm text-muted-foreground">
            <Trophy className="w-4 h-4 mr-2 text-accent" />
            <p>
                恭喜
                <span className="font-bold text-foreground mx-1">{item.username}</span>
                {item.section && (
                    <span className="ml-1">
                        在「{item.section}」{item.action}
                    </span>
                )}
                {!item.section && (
                    <span className="ml-1">{item.action}</span>
                )}
                <span className={`font-bold ml-1 ${rarityStyles[item.rarity] || 'text-foreground'}`}>
                   「{item.prize}」!
                </span>
            </p>
        </div>
    );

    return (
        <div className="bg-background/80 backdrop-blur-sm border-b border-border/50 h-8 overflow-hidden relative flex items-center">
            <div className="animate-marquee flex min-w-full shrink-0 items-center">
                {marqueeItems.map((item, index) => (
                    <MarqueeItem key={`${item.id}-${index}`} item={item} />
                ))}
            </div>
            <div className="animate-marquee flex min-w-full shrink-0 items-center" aria-hidden="true">
                {marqueeItems.map((item, index) => (
                    <MarqueeItem key={`duplicate-${item.id}-${index}`} item={item} />
                ))}
            </div>
        </div>
    );
}
