import { useCollection, useFirestore, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useMemo } from 'react';

export function useAnnouncementData<T>(limitCount: number = 50, filterFn?: (_data: T[]) => T[]) {
    const firestore = useFirestore();
    const announcementsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(
            collection(firestore, 'announcements'),
            orderBy('timestamp', 'desc'),
            limit(limitCount)
        );
    }, [firestore, limitCount]);

    const { data, isLoading, error } = useCollection<T>(announcementsQuery);

    const processedData = useMemo(() => {
        if (!data) return [];
        return filterFn ? filterFn(data as T[]) : (data as T[]);
    }, [data, filterFn]);

    return { data: processedData, isLoading, error };
}
